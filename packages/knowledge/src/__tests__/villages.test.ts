/* КАТОТТГ village/raion tier — exact membership + snap. Plain tsx assert harness. */
import { snapCity, isKnownSettlement, isKnownRaion } from '../gazetteer'
import { VILLAGE_NAMES, RAION_NAMES } from '../registry/villages.generated'

let pass = 0, fail = 0
function ok(cond: boolean, msg: string) { if (cond) pass++; else { fail++; console.error('FAIL:', msg) } }

// The data loaded and is large (real village tier, not a stub).
ok(VILLAGE_NAMES.length > 15000, `village count ${VILLAGE_NAMES.length} > 15000`)
ok(RAION_NAMES.length > 100, `raion count ${RAION_NAMES.length} > 100`)

// A real village that was previously "unknown_geography" is now an EXACT settlement.
ok(isKnownSettlement('Моринці'), 'Моринці is a known settlement')
const snap = snapCity('Моринці')
ok(snap.matched && snap.review_required === false, 'snapCity Моринці → matched, no review')
ok(/КАТОТТГ|gazetteer/.test(snap.reason ?? ''), 'Моринці snap reason cites the registry')

// Settlement-type prefix is stripped before membership.
ok(isKnownSettlement('село Моринці'), '"село Моринці" matches by stripping the prefix')

// A modern raion is recognized (КАТОТТГ-2020 has 136 raions after the reform; many old
// raions like "Тростянецький" were abolished — historical-doc raions won't all validate).
ok(isKnownRaion('Ізюмський'), 'Ізюмський is a known modern raion')
ok(isKnownRaion('Ізюмського району'), '"…ого району" suffix stripped → known raion')

// Gibberish is NOT a settlement (no false-accept).
ok(!isKnownSettlement('Ззззxxx'), 'gibberish is not a settlement')

// Performance: 1000 membership checks are O(1) (must be fast, not a 17k scan each).
const t0 = Date.now()
for (let i = 0; i < 1000; i++) isKnownSettlement('Моринці')
ok(Date.now() - t0 < 200, `1000 membership checks < 200ms (was ${Date.now() - t0}ms)`)

console.log(`=== Villages Tests: ${pass} passed, ${fail} failed ===`)
if (fail > 0) process.exit(1)
