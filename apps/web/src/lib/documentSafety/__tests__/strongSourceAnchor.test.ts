/**
 * strongSourceAnchor.test.ts — R7: the real anchor model.
 * flagOff → always false (today, MRZ-only handled elsewhere). flagOn → any hard signal anchors.
 */
import { describe, it, expect } from 'vitest'
import { computeStrongSourceAnchor } from '../strongSourceAnchor'

describe('R7 — computeStrongSourceAnchor', () => {
  it('flag OFF → false for every signal (byte-identical to today)', () => {
    expect(computeStrongSourceAnchor({ key: 'given_name', source: 'mrz', mrzCheckValid: true }, false)).toBe(false)
    expect(computeStrongSourceAnchor({ key: 'given_name', consensus_reliable: true }, false)).toBe(false)
    expect(computeStrongSourceAnchor({ key: 'place_of_birth', knowledgeProvenance: 'gazetteer_exact' }, false)).toBe(false)
    expect(computeStrongSourceAnchor({ key: 'date_of_birth' }, false)).toBe(false)
  })

  it('flag ON: MRZ-valid anchors', () => {
    expect(computeStrongSourceAnchor({ key: 'passport_number', source: 'mrz', mrzCheckValid: true }, true)).toBe(true)
    // MRZ present but check FAILED → not anchored.
    expect(computeStrongSourceAnchor({ key: 'passport_number', source: 'mrz', mrzCheckValid: false }, true)).toBe(false)
  })

  it('flag ON: consensus_reliable anchors', () => {
    expect(computeStrongSourceAnchor({ key: 'given_name', consensus_reliable: true }, true)).toBe(true)
    expect(computeStrongSourceAnchor({ key: 'given_name', consensus_reliable: false }, true)).toBe(false)
  })

  it('flag ON: dictionary-EXACT (gazetteer_exact / authority_dict) anchors; fuzzy does NOT', () => {
    expect(computeStrongSourceAnchor({ key: 'place_of_birth', knowledgeProvenance: 'gazetteer_exact' }, true)).toBe(true)
    expect(computeStrongSourceAnchor({ key: 'issuing_authority', knowledgeProvenance: 'authority_dict' }, true)).toBe(true)
    expect(computeStrongSourceAnchor({ key: 'place_of_birth', knowledgeProvenance: 'gazetteer_fuzzy' }, true)).toBe(false)
  })

  it('flag ON: a date that passed guards anchors; a date with a conflict does NOT', () => {
    expect(computeStrongSourceAnchor({ key: 'date_of_birth' }, true)).toBe(true)
    expect(computeStrongSourceAnchor({ key: 'issue_date', reviewReasons: [] }, true)).toBe(true)
    expect(computeStrongSourceAnchor({ key: 'date_of_birth', reviewReasons: ['date_role_conflict'] }, true)).toBe(false)
    expect(computeStrongSourceAnchor({ key: 'expiration_date', reviewReasons: ['date_ensemble_disagreement'] }, true)).toBe(false)
  })

  it('flag ON: an unanchored non-date critical (no signal) stays false', () => {
    expect(computeStrongSourceAnchor({ key: 'family_name', source: 'ai_vision', confidence: 0.95 } as never, true)).toBe(false)
  })

  // SAFETY (real-doc 2026-06-22): a handwritten DOB read STABLY-WRONG (cursive 25→26 on
  // every pass) auto-delivered a wrong date. A handwritten DATE must NEVER self-anchor.
  describe('handwritten-date safety — never self-anchored', () => {
    it('a HANDWRITTEN date does NOT anchor on consensus (stable misread risk)', () => {
      expect(computeStrongSourceAnchor({ key: 'date_of_birth', consensus_reliable: true, handwritten: true }, true)).toBe(false)
      expect(computeStrongSourceAnchor({ key: 'dob', consensus_reliable: true, handwritten: true }, true)).toBe(false)
    })
    it('a HANDWRITTEN date does NOT anchor on "passed internal guards"', () => {
      expect(computeStrongSourceAnchor({ key: 'date_of_birth', handwritten: true, reviewReasons: [] }, true)).toBe(false)
    })
    it('a PRINTED date still anchors (consensus or passed guards)', () => {
      expect(computeStrongSourceAnchor({ key: 'date_of_birth', consensus_reliable: true, handwritten: false }, true)).toBe(true)
      expect(computeStrongSourceAnchor({ key: 'issue_date', handwritten: false, reviewReasons: [] }, true)).toBe(true)
    })
    it('a HANDWRITTEN NAME still anchors on consensus (cursive names read reliably)', () => {
      expect(computeStrongSourceAnchor({ key: 'family_name', consensus_reliable: true, handwritten: true }, true)).toBe(true)
    })
    it('a HANDWRITTEN date with MRZ/dictionary external check STILL anchors', () => {
      expect(computeStrongSourceAnchor({ key: 'date_of_birth', source: 'mrz', mrzCheckValid: true, handwritten: true }, true)).toBe(true)
    })
  })
})
