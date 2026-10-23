"""End-to-end suite for the Whitespace Remover Tool (TESTING.md contract v1).

Run through e2e/run.sh, which documents the environment it needs.
"""

import io
import json
import os
import re
import sys
import time
import urllib.parse
import zipfile

from playwright.sync_api import sync_playwright

import fixtures
from d2 import Api

CONTRACT_VERSION = 1
FIELDS_OWNER = "*,translations,attributeValues[value,attribute[id]]"
CLEANED = {"name", "shortName", "code", "description"}
VOLATILE = {
    "lastUpdated", "lastUpdatedBy", "href", "access", "favorite", "favorites",
    "displayName", "displayShortName", "displayDescription", "displayFormName",
}
GENERIC_ERROR = "One or more errors occurred"

ROW = "[data-test='metadata-row']"
TAG = "[data-test='dhis2-uicore-tag']"
TAB = "[data-test='dhis2-uicore-tab']"
CHECK = "[data-test='check-button']"
FIX = "[data-test='fix-button']"
ROW_CHECKBOX = "[data-test='row-checkbox'] input"
CHECK_SELECTED = "[data-test='check-selected']"
FIX_SELECTED = "[data-test='fix-selected']"
CLEAR_SELECTION = "[data-test='clear-selection']"
CONFLICT_MODAL = "[data-test='conflict-summary-modal']"
RESULTS_MODAL = "[data-test='fix-results-modal']"
PAGINATION = "[data-test='dhis2-uiwidgets-pagination']"
PAGE_SIZE_SELECT = "[data-test='dhis2-uiwidgets-pagination-pagesize-select']"
NEXT_PAGE = "[data-test='dhis2-uiwidgets-pagination-page-next']"
PREVIOUS_PAGE = "[data-test='dhis2-uiwidgets-pagination-page-previous']"
SCAN_DONE = "[data-test='dhis2-uicore-tabbar'], [data-test='dhis2-uicore-noticebox']"

DATA_ELEMENTS = "Data elements"
READY = "Ready"
CONFLICT = "Conflict"
CHECK_RESULT = re.compile("^(Ready|Conflict|Error)$")
TIMEOUT_MS = 120_000


class Run:
    def __init__(self):
        self.api = Api.from_env()
        self.results_dir = os.environ["RESULTS_DIR"]
        self.app_zip = os.environ["APP_ZIP"]
        self.label = os.environ.get("LABEL", "")
        self.app_key = os.environ.get("APP_KEY", "")
        self.tests = []
        self.seed = None
        self.page = None
        self.root = None

    def record(self, test_id, ok, message=""):
        status = "pass" if ok else "fail"
        self.tests.append({"id": test_id, "status": status, "message": str(message)[:500]})
        print(f"  [{status.upper()}] {test_id} {str(message)[:200]}", flush=True)

    def screenshot(self, name):
        if self.page:
            self.page.screenshot(path=f"{self.results_dir}/{self.label}-{name}.png", full_page=True)


# ------------------------------------------------------------------ setup


def app_manifest(zip_path):
    with zipfile.ZipFile(zip_path) as bundle:
        return json.loads(bundle.read("manifest.webapp"))


def install_app(run):
    with open(run.app_zip, "rb") as f:
        content = f.read()
    status, body = run.api.upload("/api/apps", "file", os.path.basename(run.app_zip), content)
    if status not in (200, 201, 204):
        raise RuntimeError(f"app install failed: {status} {body}")
    name = app_manifest(io.BytesIO(content))["name"]
    _, apps = run.api.get("/api/apps")
    keys = [a["key"] for a in apps if a.get("name") == name]
    if not keys:
        raise RuntimeError(f"installed app {name!r} not found in /api/apps")
    run.app_key = run.app_key or keys[0]


def uninstall_app(run):
    if run.app_key:
        run.api.delete(f"/api/apps/{run.app_key}")


def open_app(run, browser):
    host = urllib.parse.urlparse(run.api.base).hostname
    context = browser.new_context(viewport={"width": 1600, "height": 1000})
    name, value = run.api.session_cookie()
    context.add_cookies([{
        "name": name, "value": value, "domain": host,
        "path": "/", "httpOnly": True, "sameSite": "Lax",
    }])
    run.page = context.new_page()
    load_app(run)


def load_app(run):
    """Open the app and wait for the scan; 2.42+ serves it in an iframe."""
    run.page.goto(f"{run.api.base}/api/apps/{run.app_key}/index.html")
    deadline = time.time() + 600
    while time.time() < deadline:
        for frame in run.page.frames:
            try:
                if frame.query_selector(SCAN_DONE):
                    run.root = frame
                    return
            except Exception:  # frames detach while the shell loads
                pass
        run.page.wait_for_timeout(500)
    raise TimeoutError("the scan did not finish in 10 minutes")


# ------------------------------------------------------------------ UI helpers


def tab_labels(run):
    tabs = run.root.locator(TAB)
    return [tabs.nth(i).inner_text().rsplit(" (", 1)[0] for i in range(tabs.count())]


def open_tab(run, label):
    """Select a tab; the table remounts on page 1 with 50 rows per page."""
    tab = run.root.locator(TAB, has_text=re.compile(rf"^{re.escape(label)} \("))
    if tab.count() == 0:
        return False
    tab.first.click()
    run.page.wait_for_timeout(300)
    pagination = run.root.locator(PAGINATION)
    if pagination.count() and "Items per page 100" not in pagination.inner_text().replace("\n", " "):
        run.root.locator(PAGE_SIZE_SELECT).click()
        run.root.locator("[data-value='100']").first.click()
        run.page.keyboard.press("Escape")
    return True


def _go_to_first_page(run):
    previous = run.root.locator(PREVIOUS_PAGE)
    while previous.count() and not previous.is_disabled():
        previous.click()
        run.page.wait_for_timeout(200)


def row(run, uid):
    """The row of an object, paging from the first page until it is shown."""
    locator = run.root.locator(ROW, has_text=uid)
    if locator.count():
        return locator
    _go_to_first_page(run)
    while locator.count() == 0:
        next_page = run.root.locator(NEXT_PAGE)
        if next_page.count() == 0 or next_page.is_disabled():
            break
        next_page.click()
        run.page.wait_for_timeout(200)
    return locator


def wait_tag(locator, text):
    locator.locator(TAG, has_text=text).wait_for(timeout=TIMEOUT_MS)


def tag_of(locator):
    tags = locator.locator(TAG)
    return tags.inner_text() if tags.count() else ""


def close_modal(run, selector):
    run.root.locator(f"{selector} button", has_text="Close").click()
    run.root.locator(selector).wait_for(state="detached", timeout=10_000)


def check_one(run, tab, uid):
    open_tab(run, tab)
    target = row(run, uid)
    target.locator(CHECK).click()
    wait_tag(target, CHECK_RESULT)
    if run.root.locator(CONFLICT_MODAL).count():
        close_modal(run, CONFLICT_MODAL)
    return target


def check_and_fix(run, tab, uid):
    target = check_one(run, tab, uid)
    wait_tag(target, READY)
    target.locator(FIX).click()
    target.wait_for(state="detached", timeout=TIMEOUT_MS)


def select(run, uids):
    clear = run.root.locator(CLEAR_SELECTION)
    if clear.count():
        clear.click()
    for uid in uids:
        row(run, uid).locator(ROW_CHECKBOX).check(force=True)


# ------------------------------------------------------------------ server state


def owner_fields(run, obj_type, uid):
    status, body = run.api.get(f"/api/{obj_type}/{uid}?fields={FIELDS_OWNER}")
    if status != 200:
        return None
    return {k: v for k, v in body.items() if k not in VOLATILE}


def unexpected_changes(before, after):
    keys = (set(before) | set(after)) - CLEANED
    return {k: (before.get(k), after.get(k)) for k in keys
            if json.dumps(before.get(k), sort_keys=True) != json.dumps(after.get(k), sort_keys=True)}


def server_value(run, obj_type, uid, field):
    status, body = run.api.get(f"/api/{obj_type}/{uid}?fields={field}")
    return body.get(field) if status == 200 else f"HTTP {status}"


# ------------------------------------------------------------------ tests


def test_scan(run):
    labels = tab_labels(run)
    run.record("scan-completes", DATA_ELEMENTS in labels, "; ".join(labels))


def test_highlight(run):
    open_tab(run, DATA_ELEMENTS)
    marks = row(run, run.seed.id("rich")).locator("mark").count()
    run.record("whitespace-highlighted", marks >= 4, f"marks={marks}")


def test_xss(run):
    open_tab(run, DATA_ELEMENTS)
    shown = row(run, run.seed.id("xss")).count() == 1
    executed = run.root.evaluate("() => window.__e2eXss === 1")
    run.record("html-in-names-is-inert", shown and not executed, f"shown={shown} executed={executed}")


def test_analytical_objects(run):
    uid = run.seed.id("vis")
    listed = any(open_tab(run, label) and row(run, uid).count() for label in tab_labels(run)
                 if label in ("Visualizations", "Maps", "Event visualizations"))
    status, _ = run.api.get(f"/api/visualizations/{uid}?fields=*")
    run.record("analytical-objects-not-offered", not listed and status == 200,
               f"listed={listed} visualization GET={status}")


def test_fix_data_element(run):
    uid = run.seed.id("rich")
    before = owner_fields(run, "dataElements", uid)
    _, group_before = run.api.get(f"/api/dataElementGroups/{run.seed.id('deg')}?fields=dataElements[id]")
    check_and_fix(run, DATA_ELEMENTS, uid)
    after = owner_fields(run, "dataElements", uid)
    p, c = run.seed.prefix, run.seed.code
    expected = (f"{p} rich name", f"{p} rich short", f"{c}_RICH", "rich description")
    got = tuple(after.get(f) for f in ("name", "shortName", "code", "description"))
    run.record("fix-cleans-the-four-fields", got == expected, got)
    _, group_after = run.api.get(f"/api/dataElementGroups/{run.seed.id('deg')}?fields=dataElements[id]")
    changes = unexpected_changes(before, after)
    run.record("fix-changes-nothing-else", not changes and group_before == group_after,
               json.dumps(changes)[:400])


def test_fix_org_unit(run):
    uid = run.seed.id("ou")
    before = owner_fields(run, "organisationUnits", uid)
    check_and_fix(run, "Organisation units", uid)
    after = owner_fields(run, "organisationUnits", uid)
    _, group = run.api.get(f"/api/organisationUnitGroups/{run.seed.id('oug')}?fields=organisationUnits[id]")
    in_group = {"id": uid} in group.get("organisationUnits", [])
    changes = unexpected_changes(before, after)
    run.record("org-unit-duplicate-name-is-fixable",
               after.get("name") == f"{run.seed.prefix} unit" and not changes and in_group,
               f"name={after.get('name')!r} changes={json.dumps(changes)[:300]} in_group={in_group}")


def test_fix_indicator(run):
    uid = run.seed.id("ind")
    before = owner_fields(run, "indicators", uid)
    check_and_fix(run, "Indicators", uid)
    after = owner_fields(run, "indicators", uid)
    changes = unexpected_changes(before, after)
    run.record("indicator-fix-keeps-expressions",
               after.get("name") == f"{run.seed.prefix} indicator" and not changes,
               f"name={after.get('name')!r} changes={json.dumps(changes)[:300]}")


def _expect_conflict(run, test_id, uid, target):
    open_tab(run, DATA_ELEMENTS)
    source = row(run, uid)
    source.locator(CHECK).click()
    try:
        run.root.locator(CONFLICT_MODAL).wait_for(timeout=TIMEOUT_MS)
        text = run.root.locator(CONFLICT_MODAL).inner_text()
        close_modal(run, CONFLICT_MODAL)
        run.record(test_id, target in text and tag_of(source) == CONFLICT, text[:200])
    except Exception:
        run.record(test_id, False, f"no conflict reported; status={tag_of(source)!r}")


def test_conflicts(run):
    s = run.seed
    _expect_conflict(run, "conflict-detected", s.id("dup"), s.id("dup_target"))
    _expect_conflict(run, "conflict-detected-with-comma", s.id("comma"), s.id("comma_target"))


def test_options_scope(run):
    uid = run.seed.id("opt1")
    target = check_one(run, "Options", uid)
    status = tag_of(target)
    if status == READY:
        target.locator(FIX).click()
        target.wait_for(state="detached", timeout=TIMEOUT_MS)
    name = server_value(run, "options", uid, "name")
    run.record("option-checked-within-its-option-set",
               status == READY and name == f"{run.seed.prefix} yes", f"status={status!r} name={name!r}")


def test_bulk_peers(run):
    s = run.seed
    open_tab(run, DATA_ELEMENTS)
    select(run, [s.id("peer1"), s.id("peer2")])
    run.root.locator(CHECK_SELECTED).click()
    run.root.locator(CONFLICT_MODAL).wait_for(timeout=TIMEOUT_MS)
    close_modal(run, CONFLICT_MODAL)
    tags = [tag_of(row(run, s.id(k))) for k in ("peer1", "peer2")]
    run.record("bulk-check-flags-selected-duplicates", tags == [CONFLICT, CONFLICT], tags)


def test_failed_fix_reason(run):
    s = run.seed
    open_tab(run, DATA_ELEMENTS)
    first, second = row(run, s.id("stale1")), row(run, s.id("stale2"))
    for target in (first, second):
        target.locator(CHECK).click()
        wait_tag(target, READY)
    first.locator(FIX).click()
    first.wait_for(state="detached", timeout=TIMEOUT_MS)
    row(run, s.id("stale2")).locator(FIX).click()
    run.root.locator(RESULTS_MODAL).wait_for(timeout=TIMEOUT_MS)
    text = run.root.locator(RESULTS_MODAL).inner_text()
    run.screenshot("failed-fix")
    close_modal(run, RESULTS_MODAL)
    unchanged = server_value(run, "dataElements", s.id("stale2"), "name") == f" {s.prefix} stale Y"
    run.record("failed-fix-shows-reason-and-changes-nothing",
               "1 object(s) failed" in text and GENERIC_ERROR not in text and unchanged,
               f"unchanged={unchanged} modal={text[:300]!r}")


def test_description_only(run):
    uid = run.seed.id("desc")
    check_and_fix(run, DATA_ELEMENTS, uid)
    value = server_value(run, "dataElements", uid, "description")
    run.record("description-only-issue-fixed", value == "only here", repr(value))


def test_short_name_only(run):
    uid = run.seed.id("short")
    check_and_fix(run, DATA_ELEMENTS, uid)
    value = server_value(run, "dataElements", uid, "shortName")
    run.record("short-name-only-issue-fixed", value == f"{run.seed.prefix} short only", repr(value))


def test_blank_codes(run):
    s = run.seed
    for key in ("ws1", "ws2"):
        check_and_fix(run, DATA_ELEMENTS, s.id(key))
    codes = [server_value(run, "dataElements", s.id(k), "code") for k in ("ws1", "ws2")]
    run.record("whitespace-only-codes-fixed", all(not c for c in codes), codes)


def test_bulk_fix(run):
    s = run.seed
    open_tab(run, "Constants")
    select(run, s.batch)
    run.root.locator(CHECK_SELECTED).click()
    run.root.locator(CONFLICT_MODAL).wait_for(timeout=TIMEOUT_MS)
    close_modal(run, CONFLICT_MODAL)
    run.root.locator(FIX_SELECTED).click()
    run.root.locator(RESULTS_MODAL).wait_for(timeout=TIMEOUT_MS * 2)
    text = run.root.locator(RESULTS_MODAL).inner_text()
    close_modal(run, RESULTS_MODAL)
    names = [server_value(run, "constants", uid, "name") for uid in s.batch]
    dirty = [n for n in names if n != n.strip()]
    expected = f"{len(s.batch)} object(s) fixed, 0 object(s) failed"
    run.record("bulk-fix-across-batches", expected in text and not dirty, f"{text[:80]!r} dirty={dirty}")


TESTS = [
    test_scan, test_highlight, test_xss, test_analytical_objects,
    test_fix_data_element, test_fix_org_unit, test_fix_indicator,
    test_conflicts, test_options_scope, test_bulk_peers,
    test_failed_fix_reason, test_description_only, test_short_name_only,
    test_blank_codes,
    test_bulk_fix,
]


def run_tests(run):
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(headless=True)
        try:
            try:
                open_app(run, browser)
            except Exception as error:
                run.screenshot("open-app")
                return f"opening the app: {error}"
            for test in TESTS:
                try:
                    test(run)
                except Exception as error:
                    run.screenshot(test.__name__)
                    run.record(test.__name__.removeprefix("test_").replace("_", "-"), False, error)
                    load_app(run)
        finally:
            browser.close()
    return None


# ------------------------------------------------------------------ main


def write_results(run, started, error=None):
    _, info = run.api.get("/api/system/info")
    passed = sum(t["status"] == "pass" for t in run.tests)
    failed = sum(t["status"] == "fail" for t in run.tests)
    results = {
        "contract_version": CONTRACT_VERSION,
        "label": run.label or (info or {}).get("version", ""),
        "server_version": (info or {}).get("version", ""),
        "app_key": run.app_key,
        "app_version": app_manifest(run.app_zip).get("version", ""),
        "duration_s": round(time.time() - started),
        "total": len(run.tests), "passed": passed, "failed": failed,
        "skipped": len(run.tests) - passed - failed,
        "tests": run.tests,
    }
    if error:
        results["error"] = error
    with open(os.path.join(run.results_dir, "results.json"), "w") as f:
        json.dump(results, f, indent=2)
    print(f"== {results['label']}: {passed}/{len(run.tests)} passed", flush=True)


def setup(run):
    """Install, clean up after earlier runs, seed. Returns an error or None."""
    stage = "install"
    try:
        install_app(run)
        stage = "cleanup of an earlier run"
        leftovers = fixtures.clean_leftovers(run.api)
        if leftovers:
            raise RuntimeError(f"could not delete: {leftovers}")
        stage = "seeding"
        run.seed = fixtures.seed(run.api, fixtures.run_id())
        return None
    except Exception as error:
        return f"{stage}: {error}"


def teardown(run):
    """Runs whatever happened before: the state record lists what to delete."""
    failures = fixtures.clean_leftovers(run.api)
    uninstall_app(run)
    if run.tests:
        run.record("leaves-no-data-behind", not failures, failures)


def main():
    started = time.time()
    run = Run()
    run.label = run.label or (run.api.get("/api/system/info")[1] or {}).get("version", "")
    error = setup(run)
    try:
        if not error:
            error = run_tests(run)
    finally:
        teardown(run)
        write_results(run, started, error)
    if error:
        print(f"suite could not run: {error}", file=sys.stderr)
        return 2
    return 0 if all(t["status"] == "pass" for t in run.tests) else 1


if __name__ == "__main__":
    sys.exit(main())
