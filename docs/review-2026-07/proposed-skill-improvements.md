# Proposed improvements to the `dhis2-app-review` skill

Lessons learned from the tool-whitespace-remover migration review
(2026-07-09; DHIS2 2.41.9 / 2.42.5.1 / 2.43.0.1 × Sierra Leone / Laos).
Each item states where in the skill it belongs and the proposed text. None
of these are applied to the skill itself — apply them gradually to the
master version.

## 1. `SKILL.md` § Provisioning test instances

Add these bullets:

- **Match the Tomcat major to the DHIS2 major**: DHIS2 ≤2.41 is
  `javax.servlet` (Tomcat 9), 2.42+ is `jakarta` (Tomcat 10). The broker
  create API accepts `"tomcat": "9"|"10"` — set it explicitly for
  41-and-below. Symptom of a mismatch: the create job succeeds and Tomcat
  answers, but every path (including `/api/*`) is 404 indefinitely.
  _(Encountered: first two 2.41 instances were created with the broker's
  default Tomcat 10 and never came up.)_
- **Boot one instance at a time** on resource-constrained hosts. Two DHIS2
  instances _booting_ concurrently can starve each other (20+ minutes with
  no webapp); create the next only after the previous answers on
  `/api/system/info`. Two already-_running_ instances is usually fine.
- The instance cap counts **stopped** instances too, including stale
  `agent-*` leftovers from earlier sessions — the cap error names deletion
  candidates. Delete only agent-managed instances and record it in
  `STATE-CHANGES.md`.
- **Verify credentials before building on an instance**: some seeds ship
  with `admin` disabled or a non-default password (e.g. the Laos HMIS demo
  seed → 401 "Account disabled"). Fix via direct DB update
  (`UPDATE userinfo SET disabled=false, password='<bcrypt of district>'
WHERE username='admin'`; DB at `dhis2-<name>-db:5432`, user/pass/db
  `dhis`/`dhis`/`dhis2`) — and do it **before the first login attempt**:
  DHIS2 caches user details, so after a failed login only a full instance
  restart clears it.
- Test fixtures with fixed UIDs: DHIS2 UIDs are **exactly 11 chars**,
  `[A-Za-z][A-Za-z0-9]{10}` — a 12-char "readable" UID fails metadata
  import with E4001/E4014.

## 2. `SKILL.md` § What to do when blocked

Add these symptom → cause entries:

- Tomcat answers but every path 404s forever after a "successful" create →
  Tomcat/DHIS2 major mismatch (see Provisioning).
- Dev server (`d2-app-scripts start`) dies with
  `ENOENT ... <file>.tmp.<pid>...` while source files are being edited →
  the i18n file-watcher raced an editor's atomic temp-file rename.
  Harmless: finish the edits, restart the dev server.

Strengthen the existing iframe bullet with the deterministic version
boundary:

- **Known version boundary**: DHIS2 2.42+ serves installed apps inside a
  global-shell iframe, while 2.41 serves the same
  `/api/apps/<key>/index.html` URL directly. Write suites frame-aware from
  the start (scan `page.frames` for a known app selector) so one suite
  covers all versions. _(Encountered: a suite that passed on 2.41 timed out
  on 2.42 even though the app rendered perfectly — selectors ran against
  the top document.)_

## 3. `references/playwright-patterns.md` — new section

### Measuring layout stability (jank findings)

"The table jumps when I click X" style UX complaints are objectively
testable: capture `bounding_box()` of stable landmarks (column headers, the
acted-on row) before and after the interaction and diff the coordinates:

```python
headers = root.locator("[data-test='my-table'] thead th")
before = [headers.nth(i).bounding_box()["x"] for i in range(headers.count())]
row.locator("button").click()
row.locator("[data-test='status-tag']").wait_for()
after = [headers.nth(i).bounding_box()["x"] for i in range(headers.count())]
shift = [round(a - b) for a, b in zip(after, before)]  # all zeros = stable
```

Common root cause in DHIS2 apps: an auto-layout `<table>` with an
initially-empty column (e.g. a Status column that later receives a Tag) —
the browser rebalances all column widths when content appears. Fix: give
the column a fixed `width` on its header. Verify the fix with the same
measurement (expect all-zero shifts). _(Encountered: 9px column shift on
check in this app; fixed with `width="110px"`.)_

## 4. `references/version-testing.md` — one addition

- The 2.41 → 2.42 shell change (direct serve → global-shell iframe) belongs
  in the list of things that drift between versions, next to auth and
  header-bar differences.

## 5. Possibly out of scope for the skill (sandbox/broker docs instead)

- Only one host-visible port per sandbox: when the user wants _manual_
  testing of a second instance/version simultaneously, install the built
  zip into DHIS2 (test at the instance's own host port) rather than trying
  to run a second dev server.
- `d2-app-scripts start` needs `--host 0.0.0.0` inside a container or the
  host-published port is refused (Vite binds localhost by default).
