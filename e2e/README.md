> [!WARNING]
> This suite changes and deletes metadata, and installs and uninstalls the app. Run it only against a throwaway DHIS2 instance that you can reset or recreate. Never run it against a production, shared or play server.

# End-to-end suite

Drives the built app in Chromium on a live DHIS2 instance and checks every result against the API. It follows contract version 1 of the [tool testing conventions](https://github.com/dhis2-utils/reference-tool-conventions/blob/main/TESTING.md).

## Requirements

- Python 3 with Playwright: `pip install -r e2e/requirements.txt`, then `playwright install chromium`.
- A throwaway DHIS2 instance, 2.41 or later, preferably with a demo database. To start one locally, see [DHIS2 in Docker](https://developers.dhis2.org/docs/tutorials/dhis2-docker/).
- A user with the `ALL` authority.
- The built app: `pnpm run build` writes it to `build/bundle/`.

## Run it

```bash
mkdir -p e2e/results
DHIS2_URL=http://localhost:8080 DHIS2_USER=admin DHIS2_PASS=district \
APP_ZIP=$PWD/build/bundle/tool-whitespace-remover-1.0.1.zip \
RESULTS_DIR=$PWD/e2e/results LABEL=2.42 \
  e2e/run.sh
```

`run.sh` has no defaults for the URL or the credentials. `LABEL` (default: the server version) names the screenshots, and `APP_KEY` (default: the key the server gives the installed app) is rarely needed.

The suite writes `results.json`, and a screenshot for each failed test, to `RESULTS_DIR`. It exits with `0` when every test passes, `1` when a test fails, and `2` when it could not run (install or seeding failed).

## What it does

1. Installs `APP_ZIP`.
2. Deletes anything that an earlier, interrupted run left behind. Every run records the objects it creates in the dataStore at `e2e-state/tool-whitespace-remover` before it creates them.
3. Seeds about 55 objects with run-unique names that start with `E2E WSR`: data elements, organisation units, an indicator, option sets and options, constants, a visualization, and an event program with a program rule variable and a program rule.
4. Runs the tests, then deletes everything it created and uninstalls the app, whether the tests passed or not.

The tests cover the scan, highlighting, cleaning with no change to other fields (attribute values, translations, group membership, geometry, expressions), line breaks, tabs and non-breaking spaces in names and codes, line breaks kept in descriptions, issues only in the short name, conflicts (including values with commas, options in different option sets, and duplicates within a selection), the error shown when DHIS2 rejects a fix, whitespace-only codes, bulk fixes across batches, HTML in names, option set order, and the values the tool must never change: option codes and program rule variable names (with the program rule that uses the variable still valid). It also checks that visualizations and category option combinations are never offered.

A run takes about two minutes on the Sierra Leone demo database, and about six on the Laos demo, where deleting the seeded data elements is slow.
