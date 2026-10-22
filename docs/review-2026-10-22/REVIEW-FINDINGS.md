# Review findings: Whitespace Remover Tool v1.0.0

Reviewed: 2026-10-22 · Scope: pre-promotion review (safety, conformance with
[reference-tool-conventions](https://github.com/dhis2-utils/reference-tool-conventions),
functional testing) · Reviewer: agent (Claude Code, Claude Opus 5.5)
DHIS2 versions tested: 2.41.10, 2.42.7, 2.43.2 (Sierra Leone demo database for each version)

> **Status**: this review covers release 1.0.0. Release 1.0.1 fixes H1, M1, M2
> and L1 to L4 and the conformance errors, except the move to Ultracite, which is
> report-only. The DHIS2 core bug behind H1 is to be reported in Jira.

## Summary

The core cleaning logic is sound. On data elements, organisation units,
indicators and eleven other types, the tool cleans exactly the four fields it
claims to and leaves every other owner field, translation, attribute value and
group membership unchanged, on all three versions. Conflicts, bulk batches,
whitespace-only values and HTML in names are all handled correctly.

**It is not safe to promote as-is.** Fixing a visualization or a map whose
data items include data element operands (a data element with a category
option combo, for example "Amoxicillin Consumption") corrupts that object:
the operands lose their data element, and DHIS2 can no longer load the
object (H1). The root cause is a DHIS2 core JSON-patch bug, but the tool
triggers it and shows these objects as safe to fix. In the Sierra Leone
database, 18 of 292 visualizations and 2 maps use operands.

On conventions, the tool is badged **Validated** but does not meet the
Validated evidence. User documentation is not in `docs/user/`, the e2e
suite does not follow the `e2e/run.sh` contract, the README header and
developer topics are incomplete, the changelog lacks the required
`Upgrading` note for the 1.0.0 key change, and both workflows have drifted
from the templates. One of the workflow drifts is a security rule. See the
conformance table.

## Findings

### HIGH

#### H1. Fixing a visualization or map with data element operands corrupts it

- **Where**: `src/api/fixes.ts:27` (JSON-patch write), `src/hooks/useWhitespaceScan.ts:32`
  (`patchableTypes` admits `visualizations` and `maps`).
- **What**: Any JSON PATCH to a visualization or map that has
  `DATA_ELEMENT_OPERAND` data items replaces those items with new rows whose
  data element is NULL and whose category option combo is reset. Afterwards
  `GET /api/visualizations/<id>?fields=*` returns
  `400 Cannot invoke "DataElement.getAggregationType()" because "this.dataElement" is null`.
  Data Visualizer, Maps and dashboards then cannot load the object. The
  original data selection is gone and can only be recovered from a backup.
  Re-sending the object's own `:owner` JSON with PUT does not restore it: that
  silently empties `dataDimensionItems`. The tool lists these objects with
  **Check** returning **Ready**, so a user has no warning.
- **Evidence**: reproduced through the app UI on 2.43.2 on two visualizations
  and one map. To rule out a pre-existing fault, the names were given a
  trailing space directly in the database, and each object returned `200`
  before the fix. The same visualization (`SDRFaCK1lY9`) broke the same way
  on 2.41.10 and 2.42.7. A plain `curl` PATCH of an unrelated field
  (`/description`) reproduces it with no app involved, so this is a DHIS2
  core bug. Visualizations without operands (indicators and data elements
  only) were fixed with no collateral change.
- **Fix**: Exclude analytical objects (`visualizations`, `eventVisualizations`,
  `maps`, and the legacy `eventReports`/`eventCharts` where present) from Fix
  until core is fixed. Either drop them from `patchableTypes` or keep
  them listed read-only, with a note to rename them in their own app. Add this
  to the known limitations. Report the core bug in Jira (JSON patch on a
  visualization or map with data element operands nulls the operands, on
  2.41 to 2.43).

### MEDIUM

#### M1. Conflict check misses conflicts for values that contain a comma (2.42 and 2.43)

- **Where**: `src/api/conflicts.ts:61-70`
- **What**: On 2.42 and 2.43, a `name:eq:<value>` filter whose value contains a
  comma returns no matches, even when an exact match exists. Colons,
  brackets and parentheses still work. "WSR a:b, [c] (d) " checks as
  **Ready** although "WSR a:b, [c] (d)" exists. On 2.41 the conflict is
  found. The server's unique constraint then rejects the fix with a 409, so no
  duplicate is created. The user is still told the object is ready, and then
  sees a failure with a generic message (M2). The code comment at lines
  61-64, which says commas are safe, holds only for 2.41.
- **Fix**: Do not put the raw value in a filter. Query with an `ilike` on the
  longest comma-free substring of the cleaned value, then compare the cleaned
  values exactly on the client. Update the comment.

#### M2. Failed fixes show a generic message instead of the reason

- **Where**: `src/api/fixes.ts:47-53`
- **What**: When DHIS2 rejects a patch, the **Fix results** modal shows
  "One or more errors occurred, please see full details in import report."
  The actual reason, for example `E5003` (name already exists) or `E6000`
  (program validation on 2.41), is in `response.errorReports[].message` of the
  409 body, and the user never sees it. Seen in the duplicate-name case on all
  three versions, and for program `M3xtLkYBlKI` on 2.41.
- **Fix**: Read `error.details?.response?.errorReports` from the app-runtime
  fetch error and join the `message` values. Fall back to `error.message`.

### LOW

#### L1. One alert string is not translatable

`src/components/CleanerPage.tsx:201-204`. The key
`'Conflict check failed for {{count}} object(s)'` is missing from
`i18n/en.pot`, because the extractor drops keys that pass a `count` option
(LINTING.md, "Known gaps"). Rename the option, for example to `{{failed}}`,
and regenerate.

#### L2. Option conflicts are checked globally (static review, not tested)

`src/api/conflicts.ts:16-19`. Option names and codes are unique per option
set, but the check queries all options. A duplicate name in another option
set blocks a valid fix. This fails safe. Scope the query with
`optionSet.id:eq:<id>` for `options`.

#### L3. Stale `package.json` repository URL

`package.json:9` points to `github.com/dhis2/tool-whitespace-remover`.
Update it to `dhis2-utils`.

#### L4. Description starts with "Tool"

`d2.config.js:6-7`, `package.json:4`. NAMING.md asks for a description
without the word "tool", for example "Finds and removes leading, trailing and
double whitespace in metadata names, codes and descriptions."

### Not defects, but belong in the known limitations

- Fixing a data set, option set or program raises its `version`. Android
  clients then download that metadata again on their next sync.
- On 2.41, some programs cannot be patched at all (`E6000 Program has more than
one Enrollment`, unrelated to whitespace). The fix fails safely.
- Only `name`, `shortName`, `code` and `description` are cleaned. Translations,
  `formName`, attribute values and other text fields are not.
- Objects whose only issue is in `shortName` are not found (already documented).

## Conventions conformance

Checked against `reference-tool-conventions` at its current `main` (2026-10-22).
"Error" means it fails a Validated check; "report" means report-only.

| Area                    | Rule                                                                                                                                            | Result                                                                                                                                                                                                                                                                                                                                                                                                          |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Naming                  | Key = repo name, display name, `package.json` name                                                                                              | Pass                                                                                                                                                                                                                                                                                                                                                                                                            |
| Licence                 | `LICENSE` BSD-3-Clause, `package.json` licence                                                                                                  | Pass                                                                                                                                                                                                                                                                                                                                                                                                            |
| Release                 | GitHub release with bundle, version tagged                                                                                                      | Pass (v1.0.0)                                                                                                                                                                                                                                                                                                                                                                                                   |
| CI                      | Green on `main`                                                                                                                                 | Pass (cd4ac7e)                                                                                                                                                                                                                                                                                                                                                                                                  |
| App                     | `minDHIS2Version` set, icon present, `packageManager` set                                                                                       | Pass                                                                                                                                                                                                                                                                                                                                                                                                            |
| README header           | Badge, required lines                                                                                                                           | **Error**: the `Intended use:` line has no trailing two spaces, so it runs into `Maintainers:`; the warning uses the deprecated `**WARNING**` form inside the same blockquote instead of a separate `> [!WARNING]` blockquote                                                                                                                                                                                   |
| README developer topics | Prerequisites, release process, link to `docs/user/`                                                                                            | **Error**: Node and pnpm versions, the release process (with a link to RELEASE-WORKFLOW.md) and the one-line summary are missing; it links to `docs/MANUAL.md`                                                                                                                                                                                                                                                  |
| User documentation      | `docs/user/index.yml`, `index.md`, `tool-whitespace-remover.md`, anchors `tool-whitespace-remover-{about,before-you-start,install,limitations}` | **Error**: only `docs/MANUAL.md` exists (see notes)                                                                                                                                                                                                                                                                                                                                                             |
| Dev tooling             | No `dev_tooling_strings` anywhere                                                                                                               | **Error**: a listed string (the team's instance-broker name) in `docs/review-2026-07/STATE-CHANGES.md:17` and `UI-TEST-RESULTS.md:5`; agent working notes (`proposed-skill-improvements.md`, `STATE-CHANGES.md`) and an internal test hostname (`test/e2e/run_suite.py:4`) are committed                                                                                                                        |
| e2e                     | `e2e/run.sh` contract v1                                                                                                                        | **Error**: the suite is in `test/e2e/`; there is no `run.sh`, no `results.json`, and no `[!WARNING]` at the top of its README; `admin`/`district` are hard-coded (`test/e2e/d2.py:7`); UIDs are fixed rather than run-unique; there is no cleanup, no `e2e-state` record and no install or uninstall; there is no `requirements.txt`, no `.sonarcloud.properties`, and the results directory is not git-ignored |
| `ci.yml`                | Matches template                                                                                                                                | **Error**: `permissions: contents: read` is missing                                                                                                                                                                                                                                                                                                                                                             |
| `release.yml`           | Matches template                                                                                                                                | **Error (security)**: `setup-node` has `cache: pnpm` in the job that holds the write token (`no_cache_in`); the release step is not re-run-safe (no `gh release view` / `upload --clobber` branch)                                                                                                                                                                                                              |
| Changelog               | Format; `Upgrading` on key change                                                                                                               | **Error**: 1.0.0 changed the key (`whitespace-cleaner` to `tool-whitespace-remover`) and raised the minimum version with no `### Upgrading` section; NAMING.md requires all three points (uninstall the old app, add the new app to user roles, old bookmarks break). 0.2.0 has bullets directly under the heading and a typo ("header barn")                                                                   |
| Lint                    | Ultracite on Oxlint and Oxfmt                                                                                                                   | Report: still ESLint and Prettier                                                                                                                                                                                                                                                                                                                                                                               |
| Action pins             | Current SHAs                                                                                                                                    | Pass (the `next` majors are not adopted yet; report only)                                                                                                                                                                                                                                                                                                                                                       |

Validated evidence: the tool fails `readme_header_complete`, `user_docs_complete`,
`readme_developer_complete`, `e2e_pass_last_three_majors` (no contract suite
to run), `no_open_high_or_critical_findings` (H1) and `no_conformance_errors`.
The first failing check, in the order the review lists them, is
`readme_header_complete`.

RELEASE-WORKFLOW.md names this repo as the reference implementation of the
App Platform variant, so the workflow drift matters beyond this tool.

### Notes on `docs/MANUAL.md` for the move to `docs/user/`

- Missing sections: "Before you start" (2.41 and later; the authority needed,
  that is, metadata write for each type, or `ALL` for a full scan; a warning to
  try it on a copy of the database first), the install route through the
  tool-box app, and a full "Known limitations" section (H1, M1 until fixed, and
  the list in the previous section).
- Labels differ from the app (`i18n/en.pot`): the app shows **Fix results**,
  not "Import Results Modal"; **Check selected** and **Fix selected**, not
  `Check Selected` and `Fix Selected`; **Object name**, not `Object Name`.
- The "Using the App" section sits under "Known Issues", and the last sentence
  is cut off.
- Style guide words to replace: "launch", "click on", "e.g.", "select",
  "navigate". Interface labels are in code font or quotation marks instead of
  bold.

## Claims investigated and rejected

- **Claim**: unit tests fail (`Cannot find module '@babel/plugin-transform-private-property-in-object'`).
  **Source**: local `pnpm test` in the working copy.
  **Refuted by**: a clean clone with the CI install command
  (`pnpm install --frozen-lockfile --ignore-scripts`) passes lint, typecheck,
  40/40 tests and build. The working copy's `node_modules` predates the
  lockfile change.
- **Claim**: fixing an external map layer widens its sharing (`public` goes
  from null to `rw------` in the database).
  **Source**: the before and after diff of owner fields.
  **Refuted by**: a user with no authorities and users with
  `F_EXTERNAL_MAP_LAYER_PRIVATE_ADD` or `F_EXTERNAL_MAP_LAYER_PUBLIC_ADD` get
  the same effective access before and after. DHIS2 treats null as the
  default and writes it out on save.
- **Claim**: fixing data sets, program indicators, program stages and maps
  changes their nested collections.
  **Refuted by**: a structural comparison. The only differences are element
  order, nested timestamps, `version` increments, and null becoming `[]` for
  `rawPeriods` and `subscribers`.
- **Claim** (previous review, 2026-07): colons, commas and brackets are safe
  in `eq` filters. **Holds only on 2.41**; on 2.42 and later commas break
  (M1).

## Environment gaps

None blocking. Testing used the Sierra Leone demo database only (the July
review also covered Laos). The unauthenticated GitHub API cannot show the
repo's Dependabot settings, so that check was not done.
