#!/usr/bin/env tsx
/**
 * gen-villages.mts — compile the КАТОТТГ village/rural-settlement (C+X) + raion (P) tiers
 * into a COMPACT name-only layer for the gazetteer (validation + exact-membership).
 *
 * Why name-only: the English value is deterministic (KMU-55), so storing it per row would
 * bloat 17k names to ~14MB. Names only = ~0.4MB, dedup'd, sorted.
 *
 * SOURCE: КАТОТТГ (Codifier), Наказ Мінрегіону №290; the village/rural tier the city
 * generator (gen-settlements.mts) intentionally skipped.
 * Re-run:
 *   curl -sL https://raw.githubusercontent.com/kaminarifox/katottg-json/master/katottg.min.json -o /tmp/katottg.json
 *   KATOTTG_JSON=/tmp/katottg.json npx tsx packages/knowledge/scripts/gen-villages.mts
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const dir = dirname(fileURLToPath(import.meta.url))
const SRC = process.env.KATOTTG_JSON || '/tmp/katottg.json'
const OUT = resolve(dir, '../src/registry/villages.generated.ts')

const d = JSON.parse(readFileSync(SRC, 'utf8')) as { items: Array<{ category: string; name: string }> }

const uniq = (cats: string[]) =>
  [...new Set(d.items.filter((i) => cats.includes(i.category)).map((i) => (i.name || '').trim()).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b, 'uk'))

const villages = uniq(['C', 'X']) // села + селища
const raions = uniq(['P'])        // райони

const banner =
  '/* AUTO-GENERATED from КАТОТТГ (mtu.gov.ua, Наказ Мінрегіону №290) by scripts/gen-villages.mts — DO NOT EDIT BY HAND.\n' +
  ' * Compact name-only village/rural-settlement (C+X) + raion (P) tiers for VALIDATION + fuzzy-snap.\n' +
  ' * English is computed on the fly via KMU-55 (not stored) so the names stay ~0.4MB, not ~14MB of rows. */\n'
const body =
  banner +
  `export const VILLAGE_NAMES: readonly string[] = ${JSON.stringify(villages)} as const\n\n` +
  `export const RAION_NAMES: readonly string[] = ${JSON.stringify(raions)} as const\n`

writeFileSync(OUT, body)
console.log(`generated ${villages.length} village/rural + ${raions.length} raion names → ${OUT}`)
