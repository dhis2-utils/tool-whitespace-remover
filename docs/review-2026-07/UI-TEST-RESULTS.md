# UI test results — Whitespace Cleaner Tool (App Platform)

Functional testing of the migrated app (branch `app-platform-migration`,
production build `whitespace-cleaner-1.0.0.zip` installed via
`POST /api/apps`) against disposable d2-broker instances. Automated with
Playwright (Chromium, headless); authentication via `POST /api/auth/login`
session cookie.

## Test environment

| Label  | DHIS2 version | Tomcat | Database                                   |
| ------ | ------------- | ------ | ------------------------------------------ |
| 41-sl  | 2.41.9        | 9      | Sierra Leone demo (v41 seed)               |
| 41-lao | 2.41.9        | 9      | Laos HMIS demo (v41 seed)                  |
| 42-sl  | 2.42.5.1      | 10     | Sierra Leone demo (v42 seed)               |
| 42-lao | 2.42.5.1      | 10     | Laos HMIS demo (v41 seed, Flyway-migrated) |
| 43-sl  | 2.43.0.1      | 10     | Sierra Leone demo (v43 seed)               |
| 43-lao | 2.43.0.1      | 10     | Laos HMIS demo (v41 seed, Flyway-migrated) |

Each instance was seeded with deterministic test objects (see
`STATE-CHANGES.md`): a fixable data element with double/leading/trailing
whitespace in name/shortName/code/description, a data-element pair that
conflicts when cleaned, and an organisation-unit pair with identical cleaned
names (must NOT conflict). The demo databases also contributed their own
organic whitespace issues (e.g. Sierra Leone: 29 data elements, plus data
sets, indicators, option sets, org units …), exercised by the bulk check.

## Results

All 20 steps passed on all six version × database combinations:

| Step                             | 41-sl | 41-lao | 42-sl | 42-lao | 43-sl | 43-lao |
| -------------------------------- | ----- | ------ | ----- | ------ | ----- | ------ |
| App loads, scan completes        | PASS  | PASS   | PASS  | PASS   | PASS  | PASS   |
| Data elements tab present        | PASS  | PASS   | PASS  | PASS   | PASS  | PASS   |
| Seeded row visible               | PASS  | PASS   | PASS  | PASS   | PASS  | PASS   |
| Whitespace highlighted (5 marks) | PASS  | PASS   | PASS  | PASS   | PASS  | PASS   |
| Single check → Ready             | PASS  | PASS   | PASS  | PASS   | PASS  | PASS   |
| Single fix removes row           | PASS  | PASS   | PASS  | PASS   | PASS  | PASS   |
| API: name cleaned                | PASS  | PASS   | PASS  | PASS   | PASS  | PASS   |
| API: code cleaned                | PASS  | PASS   | PASS  | PASS   | PASS  | PASS   |
| API: shortName cleaned           | PASS  | PASS   | PASS  | PASS   | PASS  | PASS   |
| Conflict row visible             | PASS  | PASS   | PASS  | PASS   | PASS  | PASS   |
| Conflict modal shown             | PASS  | PASS   | PASS  | PASS   | PASS  | PASS   |
| Conflict lists conflicting UID   | PASS  | PASS   | PASS  | PASS   | PASS  | PASS   |
| Row tagged Conflict              | PASS  | PASS   | PASS  | PASS   | PASS  | PASS   |
| Org units tab present            | PASS  | PASS   | PASS  | PASS   | PASS  | PASS   |
| Seeded OU row visible            | PASS  | PASS   | PASS  | PASS   | PASS  | PASS   |
| OU duplicate name → no conflict  | PASS  | PASS   | PASS  | PASS   | PASS  | PASS   |
| OU fix removes row               | PASS  | PASS   | PASS  | PASS   | PASS  | PASS   |
| API: OU name cleaned             | PASS  | PASS   | PASS  | PASS   | PASS  | PASS   |
| Bulk check shows summary modal   | PASS  | PASS   | PASS  | PASS   | PASS  | PASS   |
| Fix-selected state resolved      | PASS  | PASS   | PASS  | PASS   | PASS  | PASS   |

The "API: … cleaned" steps verify server state after the fix via the Web API
(JSON-patch applied correctly), not just the UI.

## Re-validation after follow-up fixes

After the follow-up commit (client-side pagination, schema-based type
filtering, filter-safety documentation), the rebuilt zip was re-validated on
a **fresh DHIS2 2.41.9 Sierra Leone instance**: 21/21 steps passed — the 20
steps above plus a new check that the pagination control renders with
correct totals ("Page 1 of 1, items 1-29 of 29"). 2.41 was chosen for
re-validation as the oldest supported API (riskiest for the new
`/api/schemas` call); the pagination and filtering code paths are
version-independent client logic.

## Version-specific observations

- **2.41 vs 2.42+ shell**: on 2.41 the app is served directly at
  `/api/apps/whitespace-cleaner/index.html` with its own platform header
  bar; on 2.42/2.43 the global shell wraps the app in an iframe. Both modes
  work; the test suite is frame-aware for this reason.
- **Flyway migration**: the Laos v41 seed migrated cleanly to 2.42.5.1 and
  2.43.0.1 on first boot; the app behaved identically on migrated databases.
- **Console/network noise** (all versions, benign, not app defects):
  "not a secure context — PWA features will not work" warnings (plain-HTTP
  test instances) and `404 /api/staticContent/logo_banner` (no custom logo
  installed on fresh instances). Zero page errors on every run.

## Artifacts

- Per-run JSON results and full screenshot sets: test scratchpad
  (`results/<label>.json`, `results/<label>-*.png`).
- Key screenshots copied to `screenshots/` next to this document:
  `<label>-1-loaded.png` (app loaded, tabs + highlights) and
  `<label>-3-conflict-modal.png` (conflict summary modal), for all six
  combinations. Example: `43-sl-1-loaded.png` shows the app inside the 2.43
  global shell with the DHIS2 header bar, 13+ metadata-type tabs, and
  highlighted whitespace.
