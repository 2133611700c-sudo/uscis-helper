/**
 * presence-isPresent.test.ts — audit #21/#14: word-aware presence confirmation.
 * The old 10-char-prefix check produced false positives; the new check matches
 * only whole words.
 */
import { describe, it, expect } from 'vitest'
import { isPresent } from '../presence'

const ocr = (s: string) => s.toLocaleLowerCase('uk').replace(/['ʼ`‘’]/g, '').replace(/[^a-zа-яіїєґ0-9]+/giu, ' ').trim()

describe('#21 — word-aware isPresent', () => {
  const page = ocr("REDACTED_NAME Сергій Сергійович 25 червня 1986 смт Тростянець Вінницька область Централізовано видано")

  it('confirms a value that appears as a whole word', () => {
    expect(isPresent('Тростянець', page)).toBe(true)
    expect(isPresent('Сергій', page)).toBe(true)
  })
  it('confirms a multi-word value when every word is present', () => {
    expect(isPresent("REDACTED_NAME Сергій Сергійович", page)).toBe(true)
  })
  it('does NOT confirm a prefix of a longer word (куроп ⊄ куропятник)', () => {
    expect(isPresent('REDACTED', page)).toBe(false)
  })
  it('does NOT confirm a substring of a longer word (Центр ⊄ Централізовано)', () => {
    expect(isPresent('Центр', page)).toBe(false)
  })
  it('does NOT confirm a value absent from the page', () => {
    expect(isPresent('Москва', page)).toBe(false)
  })
  it('empty value is not present', () => {
    expect(isPresent('', page)).toBe(false)
  })
})
