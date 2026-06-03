/**
 * Unit tests for Birth Certificate extraction module.
 *
 * Hard rules tested:
 *   - review_required=true ALWAYS
 *   - Parent name must NEVER become child_family_name
 *   - role_grounding_verified=false when structure unclear
 *   - wrong_person_risk=true when child/parent blocks ambiguous
 *   - No immigration fields in output
 *   - child_* fields only populated from child block
 */

import { describe, it, expect } from 'vitest'
import { extractBirthCertificate, runBirthCertificateModule } from '../birthCertificate'

// Typical Ukrainian birth certificate OCR text with clear structure
const TYPICAL_BIRTH_CERT_OCR = `СВІДОЦТВО ПРО НАРОДЖЕННЯ
Прізвище: REDACTED_NAME
Ім'я: Сергій
По батькові: Сергійович
Дата народження: 25 червня 1986 р.
Місце народження: Тростянець
Батько: REDACTED_NAME Микола Іванович
Мати: REDACTED_NAME Ніна Петрівна
Актовий запис № 42
Орган реєстрації: Тростянецький РАЦС
Дата видачі: 01 вересня 1986 р.`

// OCR text with ambiguous structure — no clear "Батько"/"Мати" separator
const AMBIGUOUS_OCR = `СВІДОЦТВО ПРО НАРОДЖЕННЯ
REDACTED_NAME
1986
Тростянець
Вінницька
Петренко Іван Миколайович`  // could be child or parent — ambiguous

// OCR with parent name that should NOT bleed into child block
const PARENT_CONTAMINATION_RISK_OCR = `СВІДОЦТВО ПРО НАРОДЖЕННЯ
Прізвище: REDACTED_NAME
Ім'я: Сергій
Дата народження: 25 червня 1986 р.
Батько: Петренко Микола
Мати: Іваненко Ніна
Актовий запис № 42`

describe('extractBirthCertificate — review_required', () => {
  it('review_required is always true', () => {
    const result = extractBirthCertificate(TYPICAL_BIRTH_CERT_OCR)
    expect(result.review_required).toBe(true)
  })

  it('review_required is true even for perfect OCR with clear structure', () => {
    // Hard-case class: review cannot be waived
    const result = extractBirthCertificate(TYPICAL_BIRTH_CERT_OCR)
    expect(result.review_required).toBe(true)
  })

  it('all module fields have review_required=true', () => {
    const result = runBirthCertificateModule(
      { raw_text: TYPICAL_BIRTH_CERT_OCR, lines: TYPICAL_BIRTH_CERT_OCR.split('\n').filter(Boolean).map(t => ({ text: t })) },
      { document_id: 'test' }
    )
    for (const field of result.fields) {
      expect(field.review_required).toBe(true)
    }
  })

  it('module manual_review_required is always true', () => {
    const result = runBirthCertificateModule(
      { raw_text: TYPICAL_BIRTH_CERT_OCR, lines: TYPICAL_BIRTH_CERT_OCR.split('\n').filter(Boolean).map(t => ({ text: t })) },
      { document_id: 'test' }
    )
    expect(result.manual_review_required).toBe(true)
  })
})

describe('extractBirthCertificate — role grounding', () => {
  it('role_grounding_verified=true when Батько/Мати headers present', () => {
    const result = extractBirthCertificate(TYPICAL_BIRTH_CERT_OCR)
    expect(result.role_grounding_verified).toBe(true)
  })

  it('role_grounding_verified=false when structure unclear', () => {
    const result = extractBirthCertificate(AMBIGUOUS_OCR)
    expect(result.role_grounding_verified).toBe(false)
  })

  it('wrong_person_risk=true when child/parent blocks ambiguous', () => {
    const result = extractBirthCertificate(AMBIGUOUS_OCR)
    expect(result.wrong_person_risk).toBe(true)
  })

  it('wrong_person_risk=false when structure is clear', () => {
    const result = extractBirthCertificate(TYPICAL_BIRTH_CERT_OCR)
    expect(result.wrong_person_risk).toBe(false)
  })
})

describe('extractBirthCertificate — parent name must not become child_family_name', () => {
  it('parent name (Петренко) does not become child_family_name', () => {
    const result = extractBirthCertificate(PARENT_CONTAMINATION_RISK_OCR)
    // Child family name should be "REDACTED_NAME", not "Петренко"
    if (result.child_family_name !== null) {
      expect(result.child_family_name).not.toBe('Петренко Микола')
      expect(result.child_family_name).not.toContain('Петренко')
    }
  })

  it('father_name is populated from parent block separately', () => {
    const result = extractBirthCertificate(PARENT_CONTAMINATION_RISK_OCR)
    // Father name should be in father_name, not child_family_name
    expect(result.father_name).not.toBeNull()
  })

  it('child_family_name and father_name are different values', () => {
    const result = extractBirthCertificate(PARENT_CONTAMINATION_RISK_OCR)
    if (result.child_family_name !== null && result.father_name !== null) {
      expect(result.child_family_name).not.toBe(result.father_name)
    }
  })

  it('generic family_name field is NOT emitted (must use child_family_name)', () => {
    const result = runBirthCertificateModule(
      { raw_text: TYPICAL_BIRTH_CERT_OCR, lines: TYPICAL_BIRTH_CERT_OCR.split('\n').filter(Boolean).map(t => ({ text: t })) },
      { document_id: 'test' }
    )
    const fieldNames = result.fields.map(f => f.field)
    // These unroled fields must NOT appear — only child_family_name / child_given_name
    expect(fieldNames).not.toContain('family_name')
    expect(fieldNames).not.toContain('given_name')
  })
})

describe('extractBirthCertificate — immigration fields forbidden', () => {
  it('does not populate I-94, A-number, or EAD fields', () => {
    const result = runBirthCertificateModule(
      { raw_text: TYPICAL_BIRTH_CERT_OCR, lines: TYPICAL_BIRTH_CERT_OCR.split('\n').filter(Boolean).map(t => ({ text: t })) },
      { document_id: 'test' }
    )
    const fieldNames = result.fields.map(f => f.field)
    expect(fieldNames).not.toContain('a_number')
    expect(fieldNames).not.toContain('i94_admission_number')
    expect(fieldNames).not.toContain('ead_category_on_card')
    expect(fieldNames).not.toContain('passport_number')
    expect(fieldNames).not.toContain('us_address_street')
  })
})

describe('extractBirthCertificate — field extraction', () => {
  it('extracts child_family_name from Прізвище label', () => {
    const result = extractBirthCertificate(TYPICAL_BIRTH_CERT_OCR)
    expect(result.child_family_name).toBe("REDACTED_NAME")
  })

  it('extracts child_given_name from Ім\'я label', () => {
    const result = extractBirthCertificate(TYPICAL_BIRTH_CERT_OCR)
    expect(result.child_given_name).toBe('Сергій')
  })

  it('extracts child_date_of_birth with Ukrainian month parsing', () => {
    const result = extractBirthCertificate(TYPICAL_BIRTH_CERT_OCR)
    expect(result.child_date_of_birth).toBe('1986-06-25')
  })

  it('extracts father_name from Батько block', () => {
    const result = extractBirthCertificate(TYPICAL_BIRTH_CERT_OCR)
    expect(result.father_name).not.toBeNull()
  })

  it('extracts mother_name from Мати block', () => {
    const result = extractBirthCertificate(TYPICAL_BIRTH_CERT_OCR)
    expect(result.mother_name).not.toBeNull()
  })

  it('extracts act_record_number', () => {
    const result = extractBirthCertificate(TYPICAL_BIRTH_CERT_OCR)
    expect(result.act_record_number).toBe('42')
  })
})

describe('runBirthCertificateModule — match detection', () => {
  it('matches typical birth certificate OCR', () => {
    const result = runBirthCertificateModule(
      { raw_text: TYPICAL_BIRTH_CERT_OCR, lines: TYPICAL_BIRTH_CERT_OCR.split('\n').filter(Boolean).map(t => ({ text: t })) },
      { document_id: 'test' }
    )
    expect(result.matched).toBe(true)
  })

  it('does not match unrelated document (passport text)', () => {
    const passportText = 'PASSPORT\nFAMILY NAME: KOVALENKO\nGIVEN NAME: IVAN'
    const result = runBirthCertificateModule(
      { raw_text: passportText, lines: passportText.split('\n').filter(Boolean).map(t => ({ text: t })) },
      { document_id: 'test' }
    )
    expect(result.matched).toBe(false)
  })
})
