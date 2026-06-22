/**
 * selfConsistencyVote.test.ts — R5: self-consistency VOTING.
 * The pure decideVote/applyVoteOutcome helpers. Gated by SELF_CONSISTENCY_VOTE_ENABLED in the
 * reader; here we test the pure logic (majority-pick, minority→review, no-majority→review).
 */
import { describe, it, expect } from 'vitest'
import { decideVote, applyVoteOutcome, isSelfConsistencyVoteEnabled } from '../selfConsistency'
import type { ExtractedDocField } from '../types'

const ef = (field: string, cyr: string): ExtractedDocField => ({
  field, kind: 'name', raw_cyrillic: cyr, value: cyr,
  confidence: 0.95, review_required: false, source: 'vision', provider: 'g',
})

describe('R5 — self-consistency vote flag default OFF', () => {
  it('isSelfConsistencyVoteEnabled is false unless SELF_CONSISTENCY_VOTE_ENABLED=1', () => {
    expect(isSelfConsistencyVoteEnabled({})).toBe(false)
    expect(isSelfConsistencyVoteEnabled({ SELF_CONSISTENCY_VOTE_ENABLED: '0' })).toBe(false)
    expect(isSelfConsistencyVoteEnabled({ SELF_CONSISTENCY_VOTE_ENABLED: '1' })).toBe(true)
  })
})

describe('R5 — decideVote / applyVoteOutcome', () => {
  it('strict majority that the primary read holds → field UNCHANGED', () => {
    const primary = [ef('child_family_name', 'Синтетенко')]
    const reReads = [[ef('child_family_name', 'Синтетенко')], [ef('child_family_name', 'Синтетенко')]]
    const out = applyVoteOutcome(primary, decideVote(primary, reReads))
    const f = out[0]
    expect(f.review_required).toBe(false)
    expect(f.value).toBe('Синтетенко')
    expect(f.review_reasons ?? []).not.toContain('self_consistency_vote_minority')
  })

  it('strict majority that the primary read does NOT hold → keep primary value, force review', () => {
    // primary='A', two re-reads='B' → majority 'B' (2/3), primary disagrees.
    const primary = [ef('child_family_name', 'Aненко')]
    const reReads = [[ef('child_family_name', 'Bненко')], [ef('child_family_name', 'Bненко')]]
    const out = applyVoteOutcome(primary, decideVote(primary, reReads))
    const f = out[0]
    expect(f.value).toBe('Aненко') // value NEVER overwritten with the majority token
    expect(f.review_required).toBe(true)
    expect(f.review_reasons).toContain('self_consistency_vote_minority')
  })

  it('no strict majority (3-way split) → force review', () => {
    const primary = [ef('child_given_name', 'Іван')]
    const reReads = [[ef('child_given_name', 'Іляан')], [ef('child_given_name', 'Іманн')]]
    const out = applyVoteOutcome(primary, decideVote(primary, reReads))
    const f = out[0]
    expect(f.review_required).toBe(true)
    expect(f.review_reasons).toContain('self_consistency_vote_no_majority')
  })

  it('only raises review — a non-identity field is untouched', () => {
    const primary = [ef('issuing_authority', 'X'), ef('child_given_name', 'Іван')]
    const reReads = [[ef('child_given_name', 'Інша')]]
    const out = applyVoteOutcome(primary, decideVote(primary, reReads))
    const auth = out.find((f) => f.field === 'issuing_authority')!
    expect(auth.review_required).toBe(false) // not an identity tuple field → untouched
  })
})
