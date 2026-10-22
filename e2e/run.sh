#!/usr/bin/env bash
# End-to-end suite, contract version 1. See e2e/README.md before running:
# it changes and deletes data, so only run it against a throwaway instance.
set -euo pipefail

missing=()
for var in DHIS2_URL DHIS2_USER DHIS2_PASS APP_ZIP RESULTS_DIR; do
    [[ -n "${!var:-}" ]] || missing+=("$var")
done
if (( ${#missing[@]} )); then
    echo "Missing required environment variables: ${missing[*]}" >&2
    exit 2
fi
if [[ ! -f "$APP_ZIP" || ! -d "$RESULTS_DIR" ]]; then
    echo "APP_ZIP must be a file and RESULTS_DIR an existing directory" >&2
    exit 2
fi
export DHIS2_URL="${DHIS2_URL%/}"

cd "$(dirname "$0")"
exec python3 suite.py
