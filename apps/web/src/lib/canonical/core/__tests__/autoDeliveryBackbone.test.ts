/**
 * autoDeliveryBackbone.test.ts — R4..R7 auto-delivery backbone.
 *
 * HARD INVARIANT: with every new/related flag at its DEFAULT (OFF) the pipeline output is
 * byte-identical to before. Each flag turned ON is proven to do exactly its intended thing.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import {
  arbitrateField,
  arbitrateDocument,
  CLEARABLE_SOFT_REASONS,
  HARD_REVIEW_REASONS_NEVER_CLEAR,
} from '../arbitration'
import { docintelToCandidate, canonicalToFieldOut } from '../translationAdapter'
import type { FieldCandidate } from '../types'
import type { ExtractedDocField } from '@/lib/docintel/types'

const cand = (p: Partial<FieldCandidate> & { key: string; value: string; source: FieldCandidate['source'] }): FieldCandidate => ({
  confidence: 0.95,
  provider: 'test',
  ...p,
})

const SAVED = { ...process.env }
beforeEach(() => {
  delete process.env.DICTIONARY_CLEARS_SOFT_REVIEW
})
afterEach(() => {
  process.env = { ...SAVED }
})

describe('R4 — consensus_reliable un-severed end-to-end', () => {
  it('docintelToCandidate carries consensus_reliable from ExtractedDocField', () => {
    const ef: ExtractedDocField = {
      field: 'given_name', kind: 'name', raw_cyrillic: 'Іван', value: 'Ivan',
      confidence: 0.95, review_required: false, source: 'vision', provider: 'gemini',
      consensus_reliable: true,
    }
    expect(docintelToCandidate(ef, 1).consensus_reliable).toBe(true)
  })

  it('arbitrateField threads consensus_reliable onto CanonicalField', () => {
    const f = arbitrateField('given_name', [cand({ key: 'given_name', value: 'Ivan', source: 'ai_vision', consensus_reliable: true })])!
    expect(f.consensus_reliable).toBe(true)
  })

  it('canonicalToFieldOut emits consensus_reliable only when true', () => {
    const yes = arbitrateField('given_name', [cand({ key: 'given_name', value: 'Ivan', source: 'ai_vision', consensus_reliable: true })])!
    const no = arbitrateField('given_name', [cand({ key: 'given_name', value: 'Ivan', source: 'ai_vision' })])!
    expect(canonicalToFieldOut(yes).consensus_reliable).toBe(true)
    // absent (NOT false) when not set → response shape unchanged
    expect('consensus_reliable' in canonicalToFieldOut(no)).toBe(false)
  })

  it('IDENTITY: absent consensus on a candidate → absent on the FieldOut (byte-identical)', () => {
    const f = arbitrateField('family_name', [cand({ key: 'family_name', value: 'Petrenko', source: 'ai_vision' })])!
    const out = canonicalToFieldOut(f)
    expect(out.consensus_reliable).toBeUndefined()
  })
})

describe('R6 — DICTIONARY_CLEARS_SOFT_REVIEW (default OFF → monotonic-up unchanged)', () => {
  // A CRITICAL DOB with NO MRZ anchor gets critical_no_mrz_anchor from the arbiter; the
  // valid-ISO-date D2 accept (provenance date_parse) proposes a clean USCIS value. Flag OFF
  // must KEEP the soft reason (monotonic-up); flag ON may retract it.
  const dobCand = () => cand({ key: 'date_of_birth', value: '1990-05-15', rawCyrillic: '1990-05-15', source: 'ai_vision', confidence: 0.95 })
  // ALSO assert the gazetteer_exact path (place_of_birth is 'high', so it gets no soft reason
  // by itself — we inject one via the reader to prove gazetteer_exact clears critical_no_mrz_anchor).
  const placeCand = () => cand({
    key: 'place_of_birth', value: 'Kyiv', rawCyrillic: 'Київ', source: 'ai_vision', confidence: 0.95,
    reviewRequired: true, reviewReasons: ['critical_no_mrz_anchor'],
  })
  const knowledge = { documentClass: 'ua_birth_certificate', ukrainianDoc: true }

  it('flag OFF: a valid-ISO-date accept does NOT clear critical_no_mrz_anchor', () => {
    const [f] = arbitrateDocument([dobCand()], knowledge)
    expect(f.reviewReasons).toContain('critical_no_mrz_anchor')
    expect(f.reviewRequired).toBe(true)
  })

  it('flag OFF: a gazetteer_exact accept does NOT clear an injected critical_no_mrz_anchor', () => {
    const [f] = arbitrateDocument([placeCand()], knowledge)
    expect(f.knowledgeProvenance).toBe('gazetteer_exact')
    expect(f.reviewReasons).toContain('critical_no_mrz_anchor')
    expect(f.reviewRequired).toBe(true)
  })

  it('flag ON: a valid-ISO-date accept CLEARS critical_no_mrz_anchor', () => {
    process.env.DICTIONARY_CLEARS_SOFT_REVIEW = '1'
    const [f] = arbitrateDocument([dobCand()], knowledge)
    expect(f.knowledgeProvenance).toBe('date_parse')
    expect(f.reviewReasons).not.toContain('critical_no_mrz_anchor')
    expect(f.reviewRequired).toBe(false) // no surviving reason → review lowered
  })

  it('flag ON: a gazetteer_exact accept CLEARS critical_no_mrz_anchor', () => {
    process.env.DICTIONARY_CLEARS_SOFT_REVIEW = '1'
    const [f] = arbitrateDocument([placeCand()], knowledge)
    expect(f.knowledgeProvenance).toBe('gazetteer_exact')
    expect(f.reviewReasons).not.toContain('critical_no_mrz_anchor')
    expect(f.reviewRequired).toBe(false)
  })

  it('flag ON: a HARD reason is NEVER cleared even on a high-evidence accept', () => {
    process.env.DICTIONARY_CLEARS_SOFT_REVIEW = '1'
    const hardCand = cand({
      key: 'date_of_birth', value: '1990-05-15', rawCyrillic: '1990-05-15', source: 'ai_vision',
      reviewRequired: true, reviewReasons: ['fallback_model_used'],
    })
    const [f] = arbitrateDocument([hardCand], knowledge)
    expect(f.reviewReasons).toContain('fallback_model_used')
    expect(f.reviewRequired).toBe(true)
  })

  it('constant sets are disjoint (no reason both clearable and hard)', () => {
    for (const r of CLEARABLE_SOFT_REASONS) expect(HARD_REVIEW_REASONS_NEVER_CLEAR.has(r)).toBe(false)
  })
})
