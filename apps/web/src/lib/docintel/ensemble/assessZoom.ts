/**
 * assessZoom — BLUEPRINT #2: the ASSESS→ZOOM node of the agentic reading loop.
 *
 * What an app does implicitly ("that date looks wrong — let me look closer") our one-shot
 * pipeline never did. This module adds it in the ONLY shape the constitution allows:
 *
 *   ASSESS (free, deterministic): the cross-field VERIFY critic (fieldConsistencyCritic)
 *     names the fields caught in a HARD contradiction (date order, implausible age,
 *     sex↔patronymic, invalid doc-number). Soft signals (place_unverified) do NOT zoom —
 *     registries are incomplete and a re-read cannot resolve them (cost-efficiency law).
 *   ZOOM (paid, capped): ONE targeted native-res re-read of those fields via the existing
 *     tile machinery. It is a VERIFICATION read, not a second writer:
 *       - it NEVER changes a value,
 *       - it NEVER lowers review (agreement is diagnostic only — a stable misread agrees
 *         with itself, so agreement must not auto-clear anything),
 *       - a DISAGREEMENT adds review reason 'zoom_mismatch' (monotonic UP).
 *
 * Flag: ASSESS_ZOOM_LOOP === '1' (strict), default OFF → byte-identical. Fail-open: any
 * error → fields unchanged. Marker [assess_zoom] is keys/counts only (PII-free).
 */
import type { ExtractedDocField } from '../types'
import { runConsistencyCritic } from '@/lib/canonical/core/fieldConsistencyCritic'
import type { CropFieldReadFn } from './tileRegionRead'

export function isAssessZoomEnabled(env: Record<string, string | undefined> = process.env): boolean {
  return env.ASSESS_ZOOM_LOOP === '1'
}

/** Hard cap on paid zoom targets per document (cost-efficiency law). */
const MAX_ZOOM_TARGETS = 4

export interface AssessZoomResult {
  fields: ExtractedDocField[]
  diag: {
    targets: string[]
    zoomed: number
    mismatched_keys: string[]
    agreed: number
    error?: string
  }
}

const norm = (s: string | null | undefined): string => (s ?? '').replace(/\s+/g, ' ').trim().toLowerCase()

/**
 * ASSESS: which non-empty fields are implicated in a HARD critic contradiction?
 * Pure + free. Empty fields are excluded — they belong to the tile-recover stage.
 */
export function assessZoomTargets(fields: ExtractedDocField[], now: Date): string[] {
  const findings = runConsistencyCritic(
    fields.map((f) => ({ key: f.field, value: f.value ?? null, rawCyrillic: f.raw_cyrillic ?? null })),
    now,
  )
  const targets = new Set<string>()
  for (const finding of findings) {
    if (finding.check === 'place_unverified') continue // soft signal — a re-read cannot resolve it
    for (const key of finding.fields) targets.add(key)
  }
  const nonEmpty = new Set(
    fields.filter((f) => (f.value ?? '').trim() !== '' || (f.raw_cyrillic ?? '').trim() !== '').map((f) => f.field),
  )
  return [...targets].filter((k) => nonEmpty.has(k)).slice(0, MAX_ZOOM_TARGETS)
}

/**
 * ZOOM: one verification re-read of the target fields from the full native-res page.
 * Injected cropRead keeps this unit-testable and transport-agnostic (same contract as
 * the tile-recover stage). Review-monotonic-UP by construction.
 */
export async function verifySuspectFieldsByZoom(opts: {
  fields: ExtractedDocField[]
  originalBuffer: Buffer
  fieldLabels: Record<string, string>
  cropRead: CropFieldReadFn
  now?: Date
}): Promise<AssessZoomResult> {
  const out = opts.fields.map((f) => ({ ...f }))
  const targets = assessZoomTargets(out, opts.now ?? new Date())
  const diag: AssessZoomResult['diag'] = { targets, zoomed: 0, mismatched_keys: [], agreed: 0 }
  if (targets.length === 0) return { fields: out, diag }

  try {
    const sharp = (await import('sharp')).default
    // Native resolution preserved; NEVER binarize (ADR-026). One page-wide crop, one paid call.
    const crop = await sharp(opts.originalBuffer).normalise().jpeg({ quality: 92 }).toBuffer()
    const wanted = targets.map((k) => ({ key: k, label: opts.fieldLabels[k] ?? k }))
    const got = await opts.cropRead(crop, wanted)
    for (const key of targets) {
      const zoomText = got[key]
      if (!zoomText || !zoomText.trim()) continue // zoom could not read it — no signal either way
      diag.zoomed++
      const f = out.find((x) => x.field === key)
      if (!f) continue
      const original = norm(f.raw_cyrillic) || norm(f.value)
      if (norm(zoomText) === original) {
        diag.agreed++ // diagnostic only — agreement NEVER lowers review (stable-misread safety)
        continue
      }
      diag.mismatched_keys.push(key)
      f.review_required = true
      f.review_reasons = Array.from(new Set([...(f.review_reasons ?? []), 'zoom_mismatch']))
    }
  } catch (e) {
    diag.error = e instanceof Error ? e.message : String(e)
  }
  return { fields: out, diag }
}
