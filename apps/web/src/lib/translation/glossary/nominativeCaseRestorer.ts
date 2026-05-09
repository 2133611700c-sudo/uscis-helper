/**
 * Nominative Case Restorer — Messenginfo v5.0
 * Restores Ukrainian names from oblique/genitive case to nominative
 * before ICAO transliteration. Critical for passport booklets where
 * names appear in dative form: "Петренку Івану" → "Petrenko Ivan"
 */

// Common oblique → nominative suffix mappings (Ukrainian)
// Sorted longest first to avoid partial matches
const SUFFIX_MAP: Array<[string, string]> = [
  // Feminine
  ['овій', 'ова'], ['євій', 'єва'],
  ['овою', 'ова'], ['євою', 'єва'],
  ['івні', 'івна'], ['євні', 'євна'],
  ['овні', 'овна'],
  // Masculine dative
  ['ченку', 'ченко'], ['енку', 'енко'], ['анку', 'анко'],
  ['ькові', 'ьків'], ['ькові', 'ько'],
  ['ькові', 'ьком'],
  // Common dative endings
  ['ові', ''],     // Іванов → Іванові → strip
  ['єві', ''],
  ['еві', ''],
  // Genitive
  ['енка', 'енко'], ['ченка', 'ченко'],
  ['ія', 'ій'],
  ['ого', 'ий'], ['ього', 'ій'],
  ['ої', 'а'],
  // Instrumental
  ['ою', 'а'], ['ею', 'я'],
]

// Known -ко surname rule: dative = -ку, nominative = -ко
const KO_DATIVE = /^(.+?)ку$/i

// Ukrainian transliteration table (KMU 2010)
const UK_TO_LATIN: Record<string, string> = {
  'а':'a','б':'b','в':'v','г':'h','ґ':'g','д':'d','е':'e','є':'ie',
  'ж':'zh','з':'z','и':'y','і':'i','ї':'i','й':'i','к':'k','л':'l',
  'м':'m','н':'n','о':'o','п':'p','р':'r','с':'s','т':'t','у':'u',
  'ф':'f','х':'kh','ц':'ts','ч':'ch','ш':'sh','щ':'shch','ь':'',
  'ю':'iu','я':'ia',
  'А':'A','Б':'B','В':'V','Г':'H','Ґ':'G','Д':'D','Е':'E','Є':'Ie',
  'Ж':'Zh','З':'Z','И':'Y','І':'I','Ї':'I','Й':'I','К':'K','Л':'L',
  'М':'M','Н':'N','О':'O','П':'P','Р':'R','С':'S','Т':'T','У':'U',
  'Ф':'F','Х':'Kh','Ц':'Ts','Ч':'Ch','Ш':'Sh','Щ':'Shch','Ь':'',
  'Ю':'Iu','Я':'Ia',
}

export function restoreNominative(name: string): string {
  if (!name || !name.trim()) return name
  const words = name.trim().split(/\s+/)
  return words.map(restoreWord).join(' ')
}

function restoreWord(word: string): string {
  // Try -ко dative pattern first
  const koMatch = word.match(KO_DATIVE)
  if (koMatch) return koMatch[1] + 'ко'

  const lower = word.toLowerCase()
  for (const [suffix, replacement] of SUFFIX_MAP) {
    if (lower.endsWith(suffix)) {
      const stem = word.slice(0, word.length - suffix.length)
      return stem + replacement
    }
  }
  return word
}

export function transliterateKMU2010(ukrainianText: string): string {
  let result = ''
  for (let i = 0; i < ukrainianText.length; i++) {
    const ch = ukrainianText[i]
    // Special: Є, Ї, Й, Ю, Я at start of word → ie, i, i, iu, ia
    // (already handled by the table for capitals; lowercase needs word-start check)
    const prev = i > 0 ? ukrainianText[i - 1] : ''
    const isWordStart = !prev || /\s/.test(prev)
    if ((ch === 'є' || ch === 'ю' || ch === 'я') && isWordStart) {
      result += ch === 'є' ? 'ie' : ch === 'ю' ? 'iu' : 'ia'
      continue
    }
    result += UK_TO_LATIN[ch] ?? ch
  }
  return result
}

export function transliterateName(ukrainianName: string, controllingLatinSpelling?: string): string {
  if (controllingLatinSpelling && controllingLatinSpelling.trim()) {
    return controllingLatinSpelling.trim()
  }
  const nominative = restoreNominative(ukrainianName)
  return transliterateKMU2010(nominative)
}
