import { describe, it, expect } from 'vitest'
import { assembleDocument } from '../assembler'
import type { EngineResult } from '../orchestrator'

const res: EngineResult = {
  doc_type_id: 'ua_marriage_certificate', models: ['gemini','openai'], auto_accepted: 2, needs_human: 1,
  fields: [
    { field:'husband_full_name', cyrillic:'Заставний Андрій Іванович', latin:'Zastavnyi Andrii Ivanovych', can_read:true, review_required:true, source:'KMU-55', candidates:[] },
    { field:'date_of_marriage', cyrillic:'25 лютого 2011', latin:'25 February 2011', can_read:true, review_required:false, source:'date→EN', candidates:[] },
    { field:'series_number', cyrillic:'', latin:'', can_read:false, review_required:true, source:'guard', candidates:[] },
  ],
}

describe('assembleDocument (D6)', () => {
  const d = assembleDocument(res, { signerName: 'Test Signer' })
  it('open name shown as suggestion + CONFIRM', () => {
    expect(d.text).toMatch(/Husband: Zastavnyi Andrii Ivanovych\s+\[CONFIRM\]/)
  })
  it('auto field rendered clean', () => expect(d.text).toMatch(/Date of marriage: 25 February 2011\n/))
  it('unreadable field → blank for human, never guessed', () => {
    expect(d.text).toMatch(/Series \/ No\.: _+/)
    expect(d.unresolved).toContain('series_number')
  })
  it('not ready to certify while anything unresolved', () => expect(d.ready_to_certify).toBe(false))
  it('no forbidden certified/USCIS-accepted claim', () => {
    expect(d.text).not.toMatch(/certified translation|USCIS.?accepted|guaranteed/i)
  })
})
