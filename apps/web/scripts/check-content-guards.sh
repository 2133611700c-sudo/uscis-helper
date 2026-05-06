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
