#!/usr/bin/env bash
# ============================================================
# Content & Brand Guard — Messenginfo
# Blocks commits / CI builds if forbidden phrases are found
# in product-facing source files.
#
# Exit 0 = clean. Exit 1 = violations found.
# ============================================================

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SRC="$REPO_ROOT/src"
MSG="$REPO_ROOT/messages"

VIOLATIONS=0

banner() { echo ""; echo "▶ $1"; }
ok()     { echo "  ✅  $1 — CLEAN"; }
fail()   { echo "  ❌  $1"; VIOLATIONS=$((VIOLATIONS + 1)); }

echo ""
echo "╔══════════════════════════════════════════════════════╗"
echo "║   Messenginfo Content & Brand Guard                  ║"
echo "╚══════════════════════════════════════════════════════╝"

# ── Rule 1: No "translator certification statement" ──────────
banner "Rule 1 — No 'translator certification statement'"
HITS=$(grep -rn "translator certification statement" "$SRC" "$MSG" 2>/dev/null || true)
if [ -n "$HITS" ]; then
  fail "translator certification statement"
  echo "$HITS" | sed 's/^/     /'
else
  ok "translator certification statement"
fi

# ── Rule 2: No "USCIS-certified" ─────────────────────────────
banner "Rule 2 — No 'USCIS-certified'"
HITS=$(grep -rn "USCIS-certified" "$SRC" "$MSG" 2>/dev/null || true)
if [ -n "$HITS" ]; then
  fail "USCIS-certified"
  echo "$HITS" | sed 's/^/     /'
else
  ok "USCIS-certified"
fi

# ── Rule 3: No "we certify" (any case) ───────────────────────
banner "Rule 3 — No 'we certify' (case-insensitive)"
HITS=$(grep -rin "we certify" "$SRC" "$MSG" 2>/dev/null || true)
if [ -n "$HITS" ]; then
  fail "we certify"
  echo "$HITS" | sed 's/^/     /'
else
  ok "we certify"
fi

# ── Rule 4: No "certified translation" as product claim ──────
# Allowed: "not a certified translation", "does not create a certified translation"
# Blocked: any other occurrence in src/components, src/app, src/lib, messages
banner "Rule 4 — No 'certified translation' as product claim"
HITS=$(grep -rn "certified translation" "$SRC/components" "$SRC/app" "$SRC/lib" "$MSG" 2>/dev/null \
  | grep -v "not a certified translation\|not create a certified\|cannot create a certified\|does not produce a certified" \
  | grep -v "translationQaValidator\|FORBIDDEN_PHRASES\|# content-guard: detection-list" \
  | grep -v "__tests__\|\.test\.ts\|\.spec\.ts" \
  || true)
if [ -n "$HITS" ]; then
  fail "certified translation (product claim)"
  echo "$HITS" | sed 's/^/     /'
else
  ok "certified translation (product claim)"
fi

# ── Rule 5: No "Standalone translator certification" ─────────
banner "Rule 5 — No 'Standalone translator certification'"
HITS=$(grep -rn "Standalone translator certification" "$SRC" "$MSG" 2>/dev/null || true)
if [ -n "$HITS" ]; then
  fail "Standalone translator certification"
  echo "$HITS" | sed 's/^/     /'
else
  ok "Standalone translator certification"
fi

# ── Rule 6: No "translator certification is not included in this step" (old banner phrase) ──
banner "Rule 6 — No old banner 'translator certification is not included in this step'"
HITS=$(grep -rn "translator certification is not included in this step" "$SRC" "$MSG" 2>/dev/null || true)
if [ -n "$HITS" ]; then
  fail "translator certification is not included"
  echo "$HITS" | sed 's/^/     /'
else
  ok "translator certification is not included"
fi

# ── Rule 7: No "Translator Certification Statement" as heading ─
# (allowed in comments/docs, blocked in rendered HTML/JSX strings)
banner "Rule 7 — No 'Translator Certification Statement' in UI strings"
HITS=$(grep -rn "Translator Certification Statement" "$SRC/components" "$SRC/app" "$SRC/lib" "$MSG" 2>/dev/null || true)
if [ -n "$HITS" ]; then
  fail "Translator Certification Statement (UI string)"
  echo "$HITS" | sed 's/^/     /'
else
  ok "Translator Certification Statement (UI string)"
fi

# ── Rule 8: No UPL / legal advice claims ─────────────────────
banner "Rule 8 — No UPL / legal-advice phrases in UI"
UPL_PATTERNS=(
  "USCIS requires you"
  "USCIS will accept"
  "USCIS will reject"
  "guaranteed acceptance"
  "will cause denial"
  "will cause RFE"
  "RFE will"
  "legal advice"
  "must file"
  "case strategy"
  "This guarantees acceptance"
  "This is legally sufficient"
)
for PHRASE in "${UPL_PATTERNS[@]}"; do
  HITS=$(grep -rin "$PHRASE" "$SRC/components" "$SRC/app" "$MSG" 2>/dev/null \
    | grep -v "FORBIDDEN_PHRASES\|detection-list\|content-guard\|__tests__\|\.test\.ts\|\.spec\.ts" \
    | grep -vi "not legal advice\|no legal advice\|does not provide legal advice\|is not legal advice\|not a law firm\|is this legal advice\|for legal advice\|not provide legal\|does not.*legal\|is not.*legal\|constitutes legal advice\|WE DO NOT PROVIDE LEGAL\|nothing.*legal advice\|not.*legal advice" \
    || true)
  if [ -n "$HITS" ]; then
    fail "UPL phrase: $PHRASE"
    echo "$HITS" | sed 's/^/     /'
  else
    ok "UPL clean: $PHRASE"
  fi
done

# ── Rule 9: No PDF-forbidden phrases in renderer / PDF lib ────
banner "Rule 9 — No forbidden PDF phrases in renderer/packet"
PDF_PATTERNS=("CERTIFIED COPY" "Translator Note" "internal QA" "ocr_id" "source trace")
for PHRASE in "${PDF_PATTERNS[@]}"; do
  HITS=$(grep -rn "$PHRASE" "$SRC/lib/packet" "$SRC/lib/translation/bureauStyleRenderer.ts" 2>/dev/null \
    | grep -v "FORBIDDEN_PHRASES\|detection-list\|content-guard\|__tests__\|\.test\.ts" \
    | grep -v "^\s*[*\/]\|NO.*$PHRASE\|No.*$PHRASE\|no.*$PHRASE\|removed\|NOT.*$PHRASE\|without.*$PHRASE" \
    || true)
  if [ -n "$HITS" ]; then
    fail "PDF forbidden phrase: $PHRASE"
    echo "$HITS" | sed 's/^/     /'
  else
    ok "PDF clean: $PHRASE"
  fi
done

# ── Summary ───────────────────────────────────────────────────
echo ""
echo "══════════════════════════════════════════════════════"
if [ "$VIOLATIONS" -eq 0 ]; then
  echo "  ✅  ALL CONTENT GUARDS PASSED — $VIOLATIONS violations"
  echo "══════════════════════════════════════════════════════"
  echo ""
  exit 0
else
  echo "  ❌  CONTENT GUARD FAILED — $VIOLATIONS violation(s) found"
  echo "      Fix the phrases above before committing."
  echo "══════════════════════════════════════════════════════"
  echo ""
  exit 1
fi
