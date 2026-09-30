# Review findings — Whitespace Cleaner Tool (App Platform migration)

Review of the migrated codebase on branch `app-platform-migration` (React +
TypeScript + `@dhis2/app-runtime` + `@dhis2/ui`). Scope: full static review of
the new implementation, behavior-parity comparison against the legacy jQuery
implementation (`git show <pre-migration>:src/app.js`), verification of every
`@dhis2/ui` prop and app-runtime call against the installed package sources,
and functional testing on live DHIS2 41/42/43 instances (see
`UI-TEST-RESULTS.md`).

Baseline: `pnpm exec eslint src`, `pnpm exec tsc --noEmit` and
`pnpm run build` are all clean.

## Findings fixed during the review

These were found in the initial migration commit and fixed in commit
`c86cb12` ("Fix review findings"):

1. **HIGH — whitespace-only values broke the conflict check and made objects
   unfixable.** `src/api/conflicts.ts` used a value's _raw_ emptiness before
   cleaning, so a field like `code: "  "` produced `filter=code:eq:` (empty
   value). DHIS2's query parser (verified in dhis2-core 2.41
   `DefaultJpaQueryParser`) throws an NPE → HTTP 500, the row was marked
   `error`, and since Fix is gated on `ready`, such objects could never be
   fixed. Two whitespace-only values also reported a false peer conflict
   (`"" === ""`). Now cleans first and skips empty results.
2. **LOW — failed checks counted as "no conflicts".** The conflict summary
   modal reported errored checks in the "did not have any conflicts" count.
   Now reported separately.
3. **LOW — select-all checkbox not disabled during batch runs**, allowing the
   selection to change under an in-flight bulk check. Now busy-gated like
   every other control.
4. **LOW — `removeItems` could throw on a missing type key** (defensive; not
   user-triggerable today). Guarded.
5. **LOW — one alert string missing from i18n extraction.** Regenerated
   `i18n/en.pot`.

## Findings addressed in a follow-up pass

1. **MEDIUM — the scan was heavy on large databases (client side now
   fixed).** The tables now paginate client-side (`@dhis2/ui` `Pagination`,
   25/50/100 rows per page, default 50), rows are sorted by name, and
   select-all operates on the visible page. This bounds DOM size for
   databases with thousands of matches. The _server-side_ cost is unchanged:
   9 filtered `/api/metadata` queries (the metadata export endpoint does not
   support paging) — identical to the legacy app. If server load becomes a
   problem on very large instances, the scan would need to move to per-type
   paged queries against each schema endpoint.

2. **LOW — filter-syntax characters in values: verified safe, documented.**
   Conflict checks only use single-value operators (`eq`/`!eq`), for which
   the server rejoins everything after the second `:` as the value — colons,
   commas and brackets in metadata values cannot break the filter (verified
   against the dhis2-core query parser; documented in
   `src/api/conflicts.ts`). Multi-value operators would not be safe; none
   are used.

3. **LOW — non-patchable types excluded from the scan.** The scan now also
   fetches `/api/schemas` (`plural,metadata,persisted,relativeApiEndpoint`)
   and only keeps object types that are persisted metadata with their own
   API endpoint — i.e. types that can actually be patched via
   `/api/<type>/<id>`. Read-only/derived types no longer appear.

## Open findings (remaining)

1. **LOW — the `Program indicators (N)`-style tab labels are generated from
   API type names** (`typeLabel()` naive de-camelCase). Works well for all
   standard types, but a future type with an acronym (e.g. `dataElementSQL`)
   would render oddly. No action needed now.

## Architecture assessment

The migration to the App Platform is the right architecture for this tool:

- The hand-rolled fetch wrapper (`d2api.js`), the legacy-header-bar
  version-sniffing (`check-header-bar.js`), and the CORS/auth handling in dev
  mode are all replaced by `@dhis2/app-runtime`, which was the source of the
  version-drift bugs this repo has had (see commit history around the
  conditional header bar for 2.42).
- `@dhis2/ui` gives the standard DHIS2 look and feel, replacing Materialize
  CSS + jQuery (~650 lines of imperative DOM code → declarative components).
- The platform build produces an installable zip (`pnpm run build` →
  `build/bundle/whitespace-cleaner-1.0.0.zip`) and the app runs identically
  standalone (2.41) and inside the global shell iframe (2.42+), verified on
  41/42/43.
- `minDHIS2Version` is set to `2.41`. For older instances (≤2.40), the last
  legacy release (v0.2.0, `main` branch) remains usable.

## Intentional behavior changes vs the legacy app

1. Conflict checks now consistently skip name/shortName uniqueness for
   organisation units. The legacy _single-object_ check flagged OU name
   duplicates that the bulk check (correctly, per DHIS2 semantics) allowed.
2. Objects whose only whitespace issues are in non-cleanable properties are
   filtered out of the scan result instead of being listed with nothing to
   fix.
3. The legacy app read cell text back out of the DOM to build PATCH
   payloads; the new app works from the fetched API objects (more robust,
   e.g. against non-breaking-space rendering).
