/**
 * ONE_BRAIN_RUNTIME_TRUTH hard lock.
 *
 * The inventory in docs/ocr/ONE_BRAIN_RUNTIME_TRUTH.md is the only allowed readiness
 * vocabulary for One Brain status claims. This guard keeps the table honest:
 *  - every inventory row carries EXACTLY ONE allowed class;
 *  - node ids are unique;
 *  - the current owner inventory has 15 rows;
 *  - the helper/detail table also carries exactly one allowed class per row.
 *
 * The goal is not prose quality. The goal is to make status inflation impossible in CI.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const REPO = resolve(process.cwd(), '../..')
const DOC = resolve(REPO, 'docs/ocr/ONE_BRAIN_RUNTIME_TRUTH.md')

const ALLOWED = ['LIVE', 'FLAGGED', 'SHADOW_ONLY', 'DARK', 'HISTORICAL', 'BLOCKED_EXTERNAL'] as const
const ALLOWED_SET = new Set<string>(ALLOWED)

function linesBetween(doc: string, startNeedle: string, endNeedle: string): string[] {
  const lines = doc.split('\n')
  const start = lines.findIndex((l) => l.includes(startNeedle))
  const end = lines.findIndex((l, i) => i > start && l.includes(endNeedle))
  if (start < 0 || end < 0 || end <= start) return []
  return lines.slice(start + 1, end)
}

function markdownRows(lines: string[]): string[] {
  return lines
    .map((l) => l.trim())
    .filter((l) => l.startsWith('|') && !/^\|\s*-+/.test(l))
}

function extractCells(row: string): string[] {
  return row
    .split('|')
    .slice(1, -1)
    .map((c) => c.trim())
}

function classHits(text: string): string[] {
  return ALLOWED.filter((klass) => new RegExp(`\\b${klass}\\b`).test(text))
}

describe('ONE_BRAIN_RUNTIME_TRUTH inventory hard lock', () => {
  const doc = readFileSync(DOC, 'utf8')

  it('every primary inventory node row carries exactly one allowed class', () => {
    const rows = markdownRows(
      linesBetween(doc, '## Инвентарь 15 узлов', '## Детализация'),
    )
    const dataRows = rows.filter((r) => /^\|\s*\d+\s*\|/.test(r))
    expect(dataRows.length, 'primary inventory row count drifted').toBe(15)

    const ids = new Set<string>()
    for (const row of dataRows) {
      const cells = extractCells(row)
      expect(cells.length).toBeGreaterThanOrEqual(4)
      const id = cells[0]
      expect(ids.has(id), `duplicate runtime-truth node id ${id}`).toBe(false)
      ids.add(id)

      const hits = classHits(cells[2] ?? '')
      expect(
        hits,
        `runtime-truth node ${id} must carry exactly one allowed class; got: ${cells[2] ?? '(missing)'}`,
      ).toHaveLength(1)
      expect(ALLOWED_SET.has(hits[0] ?? ''), `invalid class on node ${id}`).toBe(true)
    }
  })

  it('every detail row carries exactly one allowed class', () => {
    const rows = markdownRows(
      linesBetween(doc, '## Детализация', '## Признанные root-causes'),
    )
    const dataRows = rows.filter((r) => !r.includes('| Узел | Класс | Факт |'))
    expect(dataRows.length).toBeGreaterThan(0)
    for (const row of dataRows) {
      const cells = extractCells(row)
      expect(cells.length).toBeGreaterThanOrEqual(3)
      const subject = cells[0] || '(unknown detail row)'
      const hits = classHits(cells[1] ?? '')
      expect(
        hits,
        `detail row '${subject}' must carry exactly one allowed class; got: ${cells[1] ?? '(missing)'}`,
      ).toHaveLength(1)
    }
  })
})
