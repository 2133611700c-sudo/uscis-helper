#!/usr/bin/env bash
# Re-download all 7 TPS-related PDFs from official USCIS pages and regenerate
# the manifest + field inventories. Run when an Edition Date on uscis.gov
# changes.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
TPS="$ROOT/docs/uscis/forms/tps"
UA='Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

mkdir -p "$TPS/html" "$TPS/pdf"

# 1. Fetch official form pages
for slug in i-821 i-765 i-912; do
  curl -sS -L -A "$UA" -o "$TPS/html/$slug.html" "https://www.uscis.gov/$slug"
done
curl -sS -L -A "$UA" -o "$TPS/html/tps-ukraine.html" \
  "https://www.uscis.gov/humanitarian/temporary-protected-status/TPS-Ukraine"

# 2. Download PDFs
for FILE in i-821.pdf i-821instr.pdf i-765.pdf i-765instr.pdf i-765ws.pdf i-912.pdf i-912instr.pdf; do
  curl -sS -L -A "$UA" -o "$TPS/pdf/$FILE" \
    "https://www.uscis.gov/sites/default/files/document/forms/$FILE"
done

# 3. Rebuild manifest + field inventories
python3 "$ROOT/scripts/uscis/build_manifest.py"
python3 "$ROOT/scripts/uscis/inventory_fields.py"

echo "Done. Review docs/uscis/forms/tps/forms_manifest.json — any 'mismatch' status blocks deploy."
