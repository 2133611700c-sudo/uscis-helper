#!/usr/bin/env node
/**
 * document-platform-coverage.mjs — deterministic coverage report for the official
 * document platform. Derives every status from the repository (schemas, mappings,
 * bureau registry, live E2E, source ledger) — NO hand-written matrices, NO manual
 * PASS. Emits markdown + JSON to docs/reports/.
 *
 * Rules (playbook Prompt 5):
 *   - active=true is FORBIDDEN unless every critical gate passes AND the doc type
 *     is on the explicit ACTIVE allowlist AND BUREAU_PDF is enabled. Default: none.
 *   - synthetic/golden tests do NOT count as fixture_e2e (only live-fixture runs do).
 *   - the generic 1:1 renderer does NOT count as a document-specific renderer
 *     (a per-doc canonical mapping is required).
 *   - a source that is invalid / search-incomplete blocks active.
 *
 * Usage: node scripts/document-platform-coverage.mjs
 * Exit:  0 always (reporting tool); prints red/yellow counts.
 */
import { readFileSync, existsSync, writeFileSync, mkdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const P = (...p) => join(ROOT, ...p)
const read = (p) => (existsSync(P(p)) ? readFileSync(P(p), 'utf8') : null)

// ── Canonical document types and how each is sourced ────────────────────────
// schemaFile / mappingFile are relative to the ukraine forms dir.
const FORMS = 'apps/web/src/lib/translation/forms/ukraine'
const DOC_TYPES = [
  { id: 'ua_birth_certificate',       schema: 'birth-certificate.schema.ts',       mapping: 'birthCertificate.mapping.ts', sourceKey: 'ua_kmu_1025_2010' },
  { id: 'ua_marriage_certificate',    schema: 'marriage-certificate.schema.ts',    mapping: null,                          sourceKey: 'ua_kmu_1025_2010' },
  { id: 'ua_divorce_certificate',     schema: 'divorce-certificate.schema.ts',     mapping: null,                          sourceKey: 'ua_kmu_1025_2010' },
  { id: 'ua_death_certificate',       schema: 'death-certificate.schema.ts',       mapping: null,                          sourceKey: 'ua_kmu_1025_2010' },
  { id: 'ua_name_change_certificate', schema: 'name-change-certificate.schema.ts', mapping: null,                          sourceKey: 'ua_kmu_1025_2010' },
  { id: 'ua_international_passport',   schema: null,                                mapping: null,                          sourceKey: 'ua_kmu_152_2014' },
  { id: 'ua_id_card',                 schema: null,                                mapping: null,                          sourceKey: 'ua_kmu_302_2015' },
  { id: 'ua_internal_passport_booklet', schema: null,                              mapping: null,                          sourceKey: 'kmu_353_booklet' },
  { id: 'ua_military_id',             schema: null,                                mapping: null,                          sourceKey: 'military_id' },
  { id: 'ua_education_diploma',       schema: null,                                mapping: null,                          sourceKey: 'education_diploma' },
  { id: 'ua_pension_certificate',     schema: null,                                mapping: null,                          sourceKey: 'pension_certificate' },
]

// Explicit allowlist of doc types permitted to go active (requires all gates +
// owner visual approval). Empty by design until the birth pilot is signed off.
const ACTIVE_ALLOWLIST = new Set([])

// ── Evidence loaders ────────────────────────────────────────────────────────
const ledger = JSON.parse(read(`docs/official-forms/ukraine/source-ledger.json`) || '{}')
const verif = ledger.official_verification_2026_05_29 || {}
const VERIFIED = new Set(Object.keys(verif.verified_official_print || {}))
const INVALID = new Set(Object.keys(verif.INVALID_URLs_need_resourcing || {}))

const bureau = read(`apps/web/src/lib/translation/bureauTranslation.ts`) || ''
const e2e = read(`apps/web/src/lib/engine/__tests__/pipeline.live.e2e.test.ts`) || ''
const genPdf = read(`apps/web/src/app/api/translation/generate-pdf/route.ts`) || ''
const reviewGateEnforced = /assertReviewGate/.test(genPdf)
const bureauFlagDefaultOff = /process\.env\.BUREAU_PDF\s*===\s*['"]on['"]/.test(genPdf) || /BUREAU_PDF/.test(bureau)

// Geography + agency (global)
const settlementsFile = read(`packages/knowledge/src/registry/settlements.generated.ts`)
const katottgCount = settlementsFile ? (settlementsFile.match(/key_uk/g) || []).length : 0
const registryCsv = read(`packages/knowledge/src/registry/registry.csv`) || ''
const agencyCount = (registryCsv.match(/^(authority|passport_authority|military_authority|civil_registry_term),/gm) || []).length
const geoByteVerified = /byte[_-]?verif/i.test(JSON.stringify(verif.geography_source_status || {})) &&
  /verified/i.test((verif.geography_source_status || {}).verification_status || '')

// ── Per-doc-type evaluation ─────────────────────────────────────────────────
function evalDoc(d) {
  const sourceStatus = VERIFIED.has(d.sourceKey) ? 'verified'
    : INVALID.has(d.sourceKey) ? 'invalid_or_incomplete'
    : 'unknown'

  const schemaSrc = d.schema ? read(`${FORMS}/schemas/${d.schema}`) : null
  const schemaStatus = !schemaSrc ? 'absent'
    : /applyCivilContract|canGuess|sourceRule/.test(schemaSrc) ? 'full' : 'present_no_contract'
  const contractStatus = schemaSrc && /canGuess\s*:\s*false|sourceRule|applyCivilContract/.test(schemaSrc) ? 'present' : 'absent'

  const mappingStatus = d.mapping && existsSync(P(`${FORMS}/mappings/${d.mapping}`)) ? 'complete' : 'absent'

  // renderer: in bureau registry? generic 1:1 does not count — needs a per-doc mapping.
  const inRegistry = new RegExp(`${d.id}\\s*:`).test(bureau)
  const rendererStatus = !inRegistry ? 'none'
    : mappingStatus === 'complete' ? 'document_specific' : 'generic_only'

  // fixture E2E: a LIVE run('...jpg', '<id>') in the live e2e suite. synthetic/golden excluded.
  const liveFixture = new RegExp(`run\\([^)]*,\\s*['"]${d.id}['"]\\)`).test(e2e)
  const fixtureStatus = liveFixture ? 'live' : 'none_or_synthetic'

  const reviewGateStatus = reviewGateEnforced ? 'enforced' : 'missing'

  // critical gates for activation
  const gates = {
    source: sourceStatus === 'verified',
    schema: schemaStatus === 'full',
    contract: contractStatus === 'present',
    mapping: mappingStatus === 'complete',
    renderer: rendererStatus === 'document_specific',
    review_gate: reviewGateStatus === 'enforced',
    fixture_e2e: fixtureStatus === 'live',
  }
  const allGatesPass = Object.values(gates).every(Boolean)
  const active = allGatesPass && ACTIVE_ALLOWLIST.has(d.id) && !bureauFlagDefaultOff ? true : false

  const blockers = []
  if (!gates.source) blockers.push(`source:${sourceStatus}`)
  if (!gates.schema) blockers.push(`schema:${schemaStatus}`)
  if (!gates.contract) blockers.push('field_contract')
  if (!gates.mapping) blockers.push('canonical_mapping')
  if (!gates.renderer) blockers.push(`renderer:${rendererStatus}`)
  if (!gates.review_gate) blockers.push('review_gate_not_enforced_on_this_branch')
  if (!gates.fixture_e2e) blockers.push('live_fixture_e2e')
  if (allGatesPass && !ACTIVE_ALLOWLIST.has(d.id)) blockers.push('owner_visual_approval (not on allowlist)')

  return {
    doc_type: d.id,
    source_status: sourceStatus,
    schema_status: schemaStatus,
    field_contract_status: contractStatus,
    mapping_status: mappingStatus,
    renderer_status: rendererStatus,
    review_gate_status: reviewGateStatus,
    fixture_e2e_status: fixtureStatus,
    geography_coverage: `${katottgCount} КАТОТТГ cities${geoByteVerified ? ' (byte-verified)' : ' (NOT byte-verified)'}`,
    agency_glossary_coverage: `${agencyCount} agency entries`,
    active_status: active,
    blockers,
  }
}

const rows = DOC_TYPES.map(evalDoc)
const redItems = rows.filter(r => r.source_status === 'invalid_or_incomplete').length
const yellowItems = rows.filter(r => !r.active_status && r.source_status === 'verified').length
const activeCount = rows.filter(r => r.active_status).length

// ── Emit ────────────────────────────────────────────────────────────────────
mkdirSync(P('docs/reports'), { recursive: true })
const stamp = process.env.REPORT_DATE || 'unstamped' // date passed in to keep output deterministic

const json = {
  generated_by: 'scripts/document-platform-coverage.mjs',
  branch_note: 'statuses reflect the CURRENT branch; review_gate + КАТОТТГ depend on branch',
  bureau_pdf_default_off: bureauFlagDefaultOff,
  review_gate_enforced_here: reviewGateEnforced,
  katottg_cities: katottgCount,
  agency_entries: agencyCount,
  active_documents_count: activeCount,
  red_items_count: redItems,
  yellow_items_count: yellowItems,
  documents: rows,
}
writeFileSync(P('docs/reports/DOCUMENT_PLATFORM_COVERAGE.generated.json'), JSON.stringify(json, null, 2) + '\n')

const col = (s) => String(s)
const md = [
  `# Document Platform Coverage — GENERATED`,
  ``,
  `> Auto-generated by \`scripts/document-platform-coverage.mjs\`. Do NOT hand-edit.`,
  `> Statuses reflect the **current branch**. \`active=true\` requires every critical`,
  `> gate to pass AND the doc type to be on the ACTIVE allowlist AND BUREAU_PDF on.`,
  ``,
  `**active documents:** ${activeCount} · **red (bad source):** ${redItems} · **yellow (verified-source, not active):** ${yellowItems}`,
  `**BUREAU_PDF default OFF:** ${bureauFlagDefaultOff} · **review-gate enforced on this branch:** ${reviewGateEnforced} · **КАТОТТГ cities:** ${katottgCount} · **agency entries:** ${agencyCount}`,
  ``,
  `| doc_type | source | schema | contract | mapping | renderer | review gate | fixture E2E | active | blockers |`,
  `|---|---|---|---|---|---|---|---|---|---|`,
  ...rows.map(r => `| ${r.doc_type} | ${col(r.source_status)} | ${col(r.schema_status)} | ${col(r.field_contract_status)} | ${col(r.mapping_status)} | ${col(r.renderer_status)} | ${col(r.review_gate_status)} | ${col(r.fixture_e2e_status)} | ${r.active_status ? 'YES' : 'NO'} | ${r.blockers.join('; ') || '—'} |`),
  ``,
  `_Geography/agency are global: ${katottgCount} КАТОТТГ cities, ${agencyCount} agency entries._`,
].join('\n')
writeFileSync(P('docs/reports/DOCUMENT_PLATFORM_COVERAGE.generated.md'), md + '\n')

console.log(`coverage: ${activeCount} active, ${redItems} red, ${yellowItems} yellow → docs/reports/DOCUMENT_PLATFORM_COVERAGE.generated.{md,json}`)
