"""Seeding and cleanup for the e2e suite (TESTING.md, "Seeding and cleanup").

Every object gets a run-unique name and a client-side UID, and is written to
the e2e-state record on the instance before it is created, so a killed run
is cleaned up by the next one.
"""

import random
import string
from datetime import datetime, timezone

STATE_PATH = "/api/dataStore/e2e-state/tool-whitespace-remover"
BATCH_SIZE = 21  # the app fixes in batches of 20, so this needs two
OK_DELETE = (200, 204, 404)

# Deleted in this order: things that reference others go first
DELETE_ORDER = [
    "visualizations",
    "programRules",
    "programRuleVariables",
    "programStages",
    "programs",
    "indicators",
    "dataElementGroups",
    "organisationUnitGroups",
    "constants",
    "options",
    "optionSets",
    "dataElements",
    "organisationUnits",
    "attributes",
]


def new_uid():
    return random.choice(string.ascii_letters) + "".join(
        random.choices(string.ascii_letters + string.digits, k=10)
    )


def run_id():
    return datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%S")


def clean_leftovers(api):
    """Delete whatever an earlier run recorded, then the record itself."""
    status, state = api.get(STATE_PATH)
    if status != 200:
        return []
    failures = delete_objects(api, state.get("objects", []))
    api.delete(STATE_PATH)
    return failures


def delete_objects(api, objects):
    rank = {t: i for i, t in enumerate(DELETE_ORDER)}
    failures = []
    for obj_type, uid in sorted(objects, key=lambda o: rank.get(o[0], -1)):
        status, _ = api.delete(f"/api/{obj_type}/{uid}")
        if status not in OK_DELETE:
            failures.append(f"{obj_type}/{uid}: {status}")
    return failures


def record_state(api, objects):
    body = {"objects": objects}
    status, _ = api.put(STATE_PATH, body)
    if status == 404:
        status, _ = api.post(STATE_PATH, body)
    if status not in (200, 201):
        raise RuntimeError(f"could not write the e2e-state record: {status}")


def _first_id(api, path, key):
    status, body = api.get(path)
    if status != 200 or not body.get(key):
        raise RuntimeError(f"seeding needs {path}: got {status}")
    return body[key][0]["id"]


class Seed:
    """The objects one run creates. Attribute names are the test fixtures."""

    def __init__(self, run):
        self.prefix = f"E2E WSR {run}"
        self.code = f"E2EWSR{run[-6:]}"
        self.variable = f"e2e_wsr_{run[-6:]}"
        self.uid = {}
        self.batch = [new_uid() for _ in range(BATCH_SIZE)]

    def id(self, key):
        return self.uid.setdefault(key, new_uid())

    def objects(self):
        types = {
            "attr": "attributes", "ou": "organisationUnits",
            "ou_twin": "organisationUnits", "oug": "organisationUnitGroups",
            "deg": "dataElementGroups", "ind": "indicators",
            "vis": "visualizations", "os1": "optionSets", "os2": "optionSets",
            "opt1": "options", "opt2": "options", "opt3": "options",
            "opt4": "options", "prog": "programs", "stage": "programStages",
            "prv": "programRuleVariables", "rule": "programRules",
        }
        objects = [[types.get(k, "dataElements"), v] for k, v in self.uid.items()]
        return objects + [["constants", uid] for uid in self.batch]


def seed(api, run):
    """Create the fixtures; returns the Seed."""
    s = Seed(run)
    cc = _first_id(api, "/api/categoryCombos?filter=name:eq:default&fields=id", "categoryCombos")
    coc = _first_id(api, "/api/categoryOptionCombos?filter=name:eq:default&fields=id", "categoryOptionCombos")
    root = _first_id(api, "/api/organisationUnits?filter=level:eq:1&fields=id&pageSize=1", "organisationUnits")
    itype = _first_id(api, "/api/indicatorTypes?fields=id&pageSize=1", "indicatorTypes")
    payload = _metadata(s, cc, root, itype)
    vis = _visualization(s, coc, root)
    record_state(api, s.objects())

    status, report = api.post("/api/metadata?atomicMode=NONE", payload)
    stats = (report or {}).get("response", report or {}).get("stats", {})
    if status != 200 or stats.get("ignored"):
        raise RuntimeError(f"metadata seeding failed: {status} {str(report)[:800]}")
    status, report = api.post("/api/visualizations", vis)
    if status not in (200, 201):
        raise RuntimeError(f"visualization seeding failed: {status} {str(report)[:800]}")
    return s


def _data_element(s, key, name, short, **extra):
    return {
        "id": s.id(key), "name": name, "shortName": short,
        "valueType": "NUMBER", "domainType": "AGGREGATE",
        "aggregationType": "SUM", "categoryCombo": {"id": extra.pop("cc")},
        **extra,
    }


def _metadata(s, cc, root, itype):
    p, c = s.prefix, s.code
    de = lambda key, name, short, **extra: _data_element(s, key, name, short, cc=cc, **extra)
    attr = {"attribute": {"id": s.id("attr")}}
    return {
        "attributes": [{
            "id": s.id("attr"), "name": f"{p} attribute", "valueType": "TEXT",
            "dataElementAttribute": True, "organisationUnitAttribute": True,
        }],
        "dataElements": [
            de("rich", f"{p} rich  name ", f"{p} rich short ", code=f" {c}_RICH",
               description="rich  description", formName="form  name ",
               zeroIsSignificant=True, aggregationLevels=[2],
               attributeValues=[{**attr, "value": "keep  this "}],
               translations=[{"locale": "fr", "property": "NAME", "value": "nom  fr "}]),
            de("dup_target", f"{p} dup", f"{p} dup t"),
            de("dup", f"{p} dup ", f"{p} dup d"),
            de("comma_target", f"{p} a:b, [c] (d)", f"{p} comma t"),
            de("comma", f"{p} a:b, [c] (d) ", f"{p} comma d"),
            de("peer1", f"{p} peer X ", f"{p} peer 1"),
            de("peer2", f"{p} peer  X", f"{p} peer 2"),
            de("stale1", f"{p} stale Y ", f"{p} stale 1"),
            de("stale2", f" {p} stale Y", f"{p} stale 2"),
            de("desc", f"{p} description only", f"{p} desc", description="only  here"),
            de("short", f"{p} short name only", f"{p} short  only "),
            # line breaks, tabs and non-breaking spaces in single-line fields
            de("control", f"{p} carriage return\r", f"{p}\u00A0nbsp", code=f"{c}_TAB\tX"),
            # descriptions keep their line breaks; only the space before one goes
            de("para", f"{p} paragraphs", f"{p} paragraphs",
               description="Line one. \nLine two.\n\n- an item"),
            de("ws1", f"{p} blank code one ", f"{p} blank 1", code="  "),
            de("ws2", f"{p} blank code two ", f"{p} blank 2", code="   "),
            de("xss", f'{p} <img src=x onerror="window.__e2eXss=1"> ', f"{p} xss"),
        ],
        "dataElementGroups": [{
            "id": s.id("deg"), "name": f"{p} group", "shortName": f"{p} group",
            "dataElements": [{"id": s.id("rich")}],
        }],
        "organisationUnits": [
            {"id": s.id("ou"), "name": f"{p} unit ", "shortName": f"{p} unit",
             "code": f"{c}_OU ", "openingDate": "2020-01-01", "parent": {"id": root},
             "geometry": {"type": "Point", "coordinates": [-11.5, 8.5]},
             "attributeValues": [{**attr, "value": "unit  value"}]},
            {"id": s.id("ou_twin"), "name": f"{p} unit", "shortName": f"{p} unit twin",
             "openingDate": "2020-01-01", "parent": {"id": root}},
        ],
        "organisationUnitGroups": [{
            "id": s.id("oug"), "name": f"{p} unit group", "shortName": f"{p} unit group",
            "organisationUnits": [{"id": s.id("ou")}],
        }],
        "indicators": [{
            "id": s.id("ind"), "name": f"{p} indicator  ", "shortName": f"{p} indicator",
            "indicatorType": {"id": itype}, "numerator": f"#{{{s.id('rich')}}}",
            "denominator": "1", "numeratorDescription": "numerator  text ",
        }],
        "optionSets": [
            {"id": s.id("os1"), "name": f"{p} options one", "valueType": "TEXT",
             "options": [{"id": s.id(k)} for k in ("opt1", "opt3", "opt4")]},
            {"id": s.id("os2"), "name": f"{p} options two", "valueType": "TEXT",
             "options": [{"id": s.id("opt2")}]},
        ],
        "options": [
            {"id": s.id("opt1"), "name": f"{p} yes ", "code": f"{c}_YES",
             "optionSet": {"id": s.id("os1")}},
            {"id": s.id("opt2"), "name": f"{p} yes", "code": f"{c}_YES",
             "optionSet": {"id": s.id("os2")}},
            # data stores option codes, so the tool must leave these as they are
            {"id": s.id("opt3"), "name": f"{p} maybe ", "code": f" {c}_MAYBE ",
             "optionSet": {"id": s.id("os1")}},
            {"id": s.id("opt4"), "name": f"{p} no", "code": f"{c}_NO  ",
             "optionSet": {"id": s.id("os1")}},
        ],
        # program rules refer to a variable by its exact name, so the tool
        # must leave this name alone
        "programs": [{
            "id": s.id("prog"), "name": f"{p} program", "shortName": f"{p} program",
            "programType": "WITHOUT_REGISTRATION", "categoryCombo": {"id": cc},
            "programStages": [{"id": s.id("stage")}],
        }],
        "programStages": [{"id": s.id("stage"), "name": f"{p} stage",
                           "program": {"id": s.id("prog")}}],
        "programRuleVariables": [{
            "id": s.id("prv"), "name": f"{s.variable} ", "program": {"id": s.id("prog")},
            "programRuleVariableSourceType": "CALCULATED_VALUE", "valueType": "NUMBER",
        }],
        "programRules": [{
            "id": s.id("rule"), "name": f"{p} rule", "program": {"id": s.id("prog")},
            "condition": f"#{{{s.variable} }} > 1",
        }],
        "constants": [
            {"id": uid, "name": f"{p} batch {n:02d} ", "shortName": f"{p} b{n:02d}",
             "value": 1}
            for n, uid in enumerate(s.batch)
        ],
    }


def _visualization(s, coc, root):
    """A pivot table on a data element operand, which a JSON patch would corrupt."""
    return {
        "id": s.id("vis"), "name": f"{s.prefix} chart ", "type": "PIVOT_TABLE",
        "columns": [{"dimension": "dx", "items": [{"id": f"{s.id('rich')}.{coc}"}]}],
        "rows": [{"dimension": "pe", "items": [{"id": "202401"}]}],
        "filters": [{"dimension": "ou", "items": [{"id": root}]}],
    }
