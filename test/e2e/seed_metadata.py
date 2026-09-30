"""Seed test metadata with known whitespace issues into a DHIS2 instance.

Creates (fixed UIDs so tests and cleanup are deterministic):
- dataElement AgentWsDe01 "AGENT WS Test A  double" - double/leading/trailing issues, fixable
- dataElement AgentWsDe02 "AGENT WS Conflict B"     - clean, conflict target
- dataElement AgentWsDe03 "AGENT WS Conflict B <trailing>" - conflicts with 002 when cleaned
- organisationUnit AgentWsOu01 "AGENT WS OU"  - clean sibling
- organisationUnit AgentWsOu02 "AGENT WS OU <trailing>" - same name cleaned; must NOT conflict (OU names not unique)
"""
import sys
from d2 import get, post

BASE = sys.argv[1]

UIDS = {
    "dataElements": ["AgentWsDe01", "AgentWsDe02", "AgentWsDe03"],
    "organisationUnits": ["AgentWsOu01", "AgentWsOu02"],
}


def main():
    status, cc = get(
        BASE, "/api/categoryCombos.json?filter=name:eq:default&fields=id"
    )
    assert status == 200, cc
    default_cc = cc["categoryCombos"][0]["id"]

    status, root = get(
        BASE,
        "/api/organisationUnits.json?filter=level:eq:1&fields=id,name&pageSize=1",
    )
    assert status == 200, root
    root_ou = root["organisationUnits"][0]["id"]
    print(f"default catCombo={default_cc} root OU={root_ou}")

    de = lambda uid, name, short, code=None, desc=None: {
        "id": uid,
        "name": name,
        "shortName": short,
        **({"code": code} if code else {}),
        **({"description": desc} if desc else {}),
        "valueType": "NUMBER",
        "domainType": "AGGREGATE",
        "aggregationType": "SUM",
        "categoryCombo": {"id": default_cc},
    }

    payload = {
        "dataElements": [
            de(
                "AgentWsDe01",
                "AGENT WS Test A  double",
                "AGENT WS Test A ",
                " AGENTWSA",
                "Test  description ",
            ),
            de("AgentWsDe02", "AGENT WS Conflict B", "AGENT WS Conflict B"),
            de(
                "AgentWsDe03",
                "AGENT WS Conflict B ",
                "AGENT WS Conflict B2",
                "AGENTWSB3",
            ),
        ],
        "organisationUnits": [
            {
                "id": "AgentWsOu01",
                "name": "AGENT WS OU",
                "shortName": "AGENT WS OU",
                "openingDate": "2020-01-01",
                "parent": {"id": root_ou},
            },
            {
                "id": "AgentWsOu02",
                "name": "AGENT WS OU ",
                "shortName": "AGENT WS OU 2",
                "openingDate": "2020-01-01",
                "parent": {"id": root_ou},
            },
        ],
    }

    status, result = post(
        BASE, "/api/metadata?importMode=COMMIT&atomicMode=NONE", payload
    )
    stats = (result or {}).get("stats") or (result or {}).get("response", {}).get(
        "stats"
    )
    print("import status:", status, "stats:", stats)
    if status != 200 or (stats and stats.get("ignored", 0) > 0):
        print(result)
        sys.exit(1)
    print("seeded OK")


if __name__ == "__main__":
    main()
