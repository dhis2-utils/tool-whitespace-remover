# State changes made during migration review/testing

## Repository (branch `app-platform-migration`)

- All work is on the dedicated branch `app-platform-migration`; `main` is
  untouched. Nothing was pushed (sandbox token push restrictions).
- Legacy build system removed (webpack, jQuery, Materialize, d2-manifest,
  `d2auth.template.json`, `.github/workflows/webpack.yml`, `yarn.lock`).
- The local `d2auth.json` (gitignored, localhost dev credentials for the old
  tooling) was left in place on disk; it is no longer used by anything.
- Old `build/` and `compiled/` directories on disk were left untouched; new
  production bundles are written to `build/bundle/`.
- `REVIEW-FINDINGS.md`, `UI-TEST-RESULTS.md`, `STATE-CHANGES.md` and the
  screenshots under `docs/review-2026-07/screenshots/` are review outputs, deliberately left
  uncommitted.

## Broker instances (d2-broker)

Created and **deleted** (nothing left running):

| Instance                              | Version/Tomcat                  | Seed                       | Outcome                                                                                                                                        |
| ------------------------------------- | ------------------------------- | -------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| `agent-ws-41-sl` (1st attempt)        | 41 / Tomcat 10 (broker default) | SL v41                     | Misconfigured (2.41 needs Tomcat 9); deleted                                                                                                   |
| `agent-ws-41-lao` (1st attempt)       | 41 / Tomcat 10                  | Laos v41                   | Same; deleted                                                                                                                                  |
| `agent-ws-probe`                      | 41                              | —                          | Accidentally created while probing the create API's field validation; deleted immediately                                                      |
| `agent-ws-41-sl`                      | 2.41.9 / Tomcat 9               | SL v41                     | Tested; deleted                                                                                                                                |
| `agent-ws-41-lao`                     | 2.41.9 / Tomcat 9               | Laos v41                   | Tested; deleted                                                                                                                                |
| `agent-ws-42-sl`                      | 2.42.5.1 / Tomcat 10            | SL v42                     | Tested; deleted                                                                                                                                |
| `agent-ws-42-lao`                     | 2.42.5.1 / Tomcat 10            | Laos v41 (Flyway-migrated) | Tested; deleted                                                                                                                                |
| `agent-ws-43-sl`                      | 2.43.0.1 / Tomcat 10            | SL v43                     | Tested; deleted                                                                                                                                |
| `agent-ws-43-lao`                     | 2.43.0.1 / Tomcat 10            | Laos v41 (Flyway-migrated) | Tested; deleted                                                                                                                                |
| `agent-ws-41-sl` (re-validation)      | 2.41.9 / Tomcat 9               | SL v41                     | Re-tested follow-up fixes (21/21); deleted                                                                                                     |
| `agent-ws-43-sl` (manual testing)     | 2.43.0.1 / Tomcat 10            | SL v43                     | Manual testing via dev server (CORS whitelist extended with http://localhost:49210, not reverted - instance deleted); deleted at end of review |
| `agent-ws-41-manual` (manual testing) | 2.41.9 / Tomcat 9               | SL v41                     | Manual testing with installed app zip; deleted at end of review                                                                                |

**Pre-existing instances deleted**: the broker's 5-instance cap was fully
occupied by stopped instances left by earlier agent sessions. To make room I
deleted **`agent-emr`** and **`agent-emis-ng`** (both stopped, agent-managed;
the broker error message listed them as deletion candidates).
`agent-asc-ind` and `agent-integrity-hmis` were left untouched.

Note: the broker accepted but ignored the custom `http_port`/`pg_port`
values on create (e.g. SL-41 still got host port 9010). Testing used the
dev-net URLs, so this did not affect results, but the host-port collision
concern remains for interactive use.

## Changes made inside test instances (all instances since deleted)

- Test metadata seeded on every instance: data elements `AgentWsDe01/02/03`,
  organisation units `AgentWsOu01/02` (under the root OU), with deliberate
  whitespace/conflict issues.
- The app zip (`whitespace-cleaner` 1.0.0) installed via `POST /api/apps`.
- Test runs fixed (whitespace-cleaned) `AgentWsDe01` and `AgentWsOu02` via
  the app — that was the test.
- **Laos instances only**: the `lao_hmis_demo_v41` seed ships with the
  `admin` account disabled and an unknown password. On each Laos instance I
  set `userinfo.disabled=false` and a bcrypt hash of `district` for `admin`
  directly in PostgreSQL (on 41 this required an instance restart to clear
  DHIS2's user-details cache; on 42/43 it was applied before first login).

## Sandbox

- Installed for testing: Playwright Chromium browser, Python packages
  `psycopg[binary]` and `bcrypt` (sandbox-local only).
