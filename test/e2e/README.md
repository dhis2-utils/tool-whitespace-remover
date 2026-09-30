# End-to-end acceptance suite

Playwright-based functional tests for the Whitespace Remover app, run against
a live DHIS2 instance with the production zip installed. This is the suite
used to verify the App Platform migration on DHIS2 2.41–2.43 with the Sierra
Leone and Laos demo databases (see `docs/review-2026-07/UI-TEST-RESULTS.md`).

## Requirements

- Python 3 with `playwright` installed (`pip install playwright`,
  `playwright install chromium`)
- A disposable DHIS2 instance with `admin`/`district` credentials
  (**never run against a real instance — the suite mutates metadata**)
- The built app zip: `pnpm run build` → `build/bundle/tool-whitespace-remover-<version>.zip`

## Usage

```bash
# 1. Seed deterministic test objects (data elements AgentWsDe01-03,
#    org units AgentWsOu01-02, with known whitespace/conflict issues)
python3 seed_metadata.py http://<instance>:8080

# 2. Install the built zip (POST /api/apps)
curl -u admin:district -F file=@../../build/bundle/tool-whitespace-remover-1.0.0.zip \
    "http://<instance>:8080/api/apps"
# verify it landed (app key: tool-whitespace-remover)
curl -su admin:district "http://<instance>:8080/api/apps.json" | grep -o tool-whitespace-remover | head -1

# 3. Run the suite; results JSON + screenshots land in ./results/
python3 run_suite.py http://<instance>:8080 <label>
```

The suite covers: scan completion, whitespace highlighting, pagination,
single check→fix with API-level verification of the cleaned values,
conflict detection (modal + row status), the organisation-unit
duplicate-name rule, and bulk check flows.

Notes:

- Authentication injects a session cookie from `POST /api/auth/login`
  (falls back to basic-auth `GET /api/me`); the DHIS2 login form is not
  scripted.
- On DHIS2 2.42+ the global shell serves installed apps inside an iframe;
  the suite locates the app frame automatically and works on 2.41's
  direct-serve mode too.
- The Laos demo seed (`lao_hmis_demo_v41`) ships with the `admin` account
  disabled — enable it directly in the instance database _before_ the first
  login attempt (DHIS2 caches user details; otherwise restart the instance).
