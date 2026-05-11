'use client'

/**
 * GeneratePacketBlock — final block on ScreenS5 of the TPS wizard.
 *
 * Collects the personal data the wizard hasn't gathered yet (name, DOB,
 * address, passport, phone/email) and hits POST /api/tps/generate-packet
 * to download a ZIP with prefilled I-821 + (optionally) I-765 PDFs.
 *
 * Drop-in component — no Supabase, no localStorage of its own; it reads
 * filing_path and wants_ead from the parent wizard's existing answers.
 *
 * Locked rules (enforced by content-guard CI):
 *  - No claim of USCIS acceptance or filing on the user's behalf.
 *  - No attorney-style guidance — we are not a law firm.
 *  - PDFs come back stamped "DRAFT — REVIEW & SIGN BEFORE MAILING".
 *  - Server route validates required fields and refuses incomplete submissions.
 */

import { useState } from 'react'
import type { TpsExtractedField } from '@/lib/tps/types'
import { PacketCompletenessChecker } from '@/components/tps/PacketCompletenessChecker'

type Locale = 'uk' | 'ru' | 'en' | 'es'

interface Props {
  locale: Locale
  filingPath: 'initial' | 're_registration' | 'unknown' | 'unselected'
  wantsEad: boolean | null | undefined
  /**
   * Optional OCR-extracted fields. When provided, they seed the form's
   * initial state — only filling in fields the user has not already typed
   * (localStorage values win over OCR). This keeps the existing flow for
   * users who chose to type manually while letting the OCR path prefill
   * fresh sessions.
   */
  preExtracted?: TpsExtractedField[]
}

/**
 * Apply OCR-extracted fields onto a PersonalFields object.
 * OCR values fill ONLY empty slots — anything the user has already typed
 * (rehydrated from localStorage) wins. This avoids the "I edited my name
 * and it got overwritten" trap.
 */
function applyPreExtracted(
  base: PersonalFields,
  preExtracted: TpsExtractedField[] | undefined,
): PersonalFields {
  if (!preExtracted || preExtracted.length === 0) return base
  const next = { ...base }
  // Whitelist: only fields that exist on PersonalFields. Fields like
  // ead_category_on_card and ead_expiration_date are deliberately NOT
  // listed — ead_category is driven from filing_path on the server side,
  // and an existing EAD's expiration is not a USCIS-form input on I-821/
  // I-765 (it's reference info for the user, not data we write to a
  // form).
  //
  // I-94 class_of_admission maps to TPSAnswers.status_at_last_entry which
  // lands on I-765 Page 3 Line 23.
  // EAD a_number maps to TPSAnswers.a_number which lands on
  //   I-821 Part 2 Item 7 (Page 02) AND I-765 Part 2 Line 7 (Page 2).
  const fieldMap: Record<string, keyof PersonalFields> = {
    family_name: 'family_name',
    given_name: 'given_name',
    middle_name: 'middle_name',
    dob: 'dob',
    sex: 'sex',
    country_of_birth: 'country_of_birth',
    passport_number: 'passport_number',
    passport_country_of_issuance: 'passport_country_of_issuance',
    passport_expiration_date: 'passport_expiration_date',
    i94_admission_number: 'i94_admission_number',
    last_entry_date: 'last_entry_date',
    a_number: 'a_number',
    i94_class_of_admission: 'status_at_last_entry',
  }
  for (const f of preExtracted) {
    const key = fieldMap[f.field]
    if (!key) continue
    if (next[key] && next[key].toString().trim() !== '') continue // user value wins
    const val = f.normalized_value
    if (val == null || val.toString().trim() === '') continue
    if (key === 'sex') {
      // Coerce to 'M' | 'F' | ''
      const v = val.toString().toUpperCase().charAt(0)
      next.sex = v === 'M' || v === 'F' ? v : ''
    } else {
      // PersonalFields fields are all string; safe cast.
      ;(next as Record<string, string>)[key] = val.toString()
    }
  }
  return next
}

interface PersonalFields {
  family_name: string
  given_name: string
  middle_name: string
  dob: string             // YYYY-MM-DD
  sex: 'M' | 'F' | ''
  country_of_birth: string
  passport_number: string
  passport_country_of_issuance: string
  passport_expiration_date: string  // YYYY-MM-DD
  us_address_street: string
  us_address_city: string
  us_address_state: string
  us_address_zip: string
  i94_admission_number: string
  last_entry_date: string  // YYYY-MM-DD
  daytime_phone: string
  email: string
  /** A-Number (Alien Registration Number) — 9 digits, no 'A' prefix.
   *  Sourced from EAD card OCR; user can edit. Empty when the applicant
   *  doesn't have one yet (most initial TPS filers). */
  a_number: string
  /** Status at last entry, e.g. "Parole", "B-2", "UH". Sourced from
   *  I-94 OCR (Class of Admission field). Auto-defaults to "UH" for U4U
   *  parolees when blank and the user marked TPS-Ukraine path. */
  status_at_last_entry: string
}

const EMPTY: PersonalFields = {
  family_name: '', given_name: '', middle_name: '',
  dob: '', sex: '',
  country_of_birth: 'Ukraine',
  passport_number: '', passport_country_of_issuance: 'Ukraine', passport_expiration_date: '',
  us_address_street: '', us_address_city: '', us_address_state: '', us_address_zip: '',
  i94_admission_number: '', last_entry_date: '',
  daytime_phone: '', email: '',
  a_number: '', status_at_last_entry: '',
}

const STORAGE_KEY = 'wizard:tps-ukraine:personal:v1'

const COPY = {
  uk: {
    toggleOpen: '↓ Заповнити готовий PDF-пакет (чернетка)',
    toggleClose: '✕ Закрити',
    heading: 'Заповнити готові I-821 + I-765 (чернетка)',
    intro: 'Введіть дані, які USCIS просить у формі. Ми згенеруємо PDF із вашими відповідями вже у клітинках. Ви потім роздрукуєте, підпишете і подаєте самі.',
    family: 'Прізвище (Family Name)', given: 'Ім\'я (Given Name)', middle: 'По батькові (Middle Name) — необов\'язково',
    dob: 'Дата народження', sex: 'Стать', male: 'Чоловіча', female: 'Жіноча',
    cob: 'Країна народження',
    passport: 'Номер паспорта', passportCountry: 'Країна видачі паспорта', passportExp: 'Паспорт дійсний до',
    street: 'Адреса в США (вулиця, номер будинку)', city: 'Місто', state: 'Штат (2 літери, напр. CA)', zip: 'ZIP-код',
    i94: 'I-94 admission number (11 цифр)', entry: 'Дата останнього в\'їзду в США',
    phone: 'Денний телефон', email: 'Email',
    generate: 'Згенерувати PDF-пакет (чернетка)',
    attestation: 'Я ознайомився з даними вище. Я розумію, що Messenginfo не подає документи за мене і не є юридичною фірмою.',
    attestRequired: 'Поставте галочку, щоб згенерувати пакет.',
    generating: 'Генерую…',
    successHeader: 'Готово. Що далі?',
    success: 'PDF з вашими даними готові. Тепер уважно перевірте і відправте до USCIS самостійно.',
    download: 'Завантажити ZIP',
    again: 'Згенерувати ще раз',
    errorHeader: 'Не вдалося згенерувати.',
    missing: 'Незаповнені поля:',
    legal: 'Це чернетка. Messenginfo не подає документи в USCIS і не дає юридичних порад. Уважно перевіряйте все перед відправкою.',
    state_placeholder: 'CA',

    nsZip: 'Що всередині ZIP-архіву',
    nsZipI821: 'I-821.pdf — заява на TPS (13 сторінок).',
    nsZipI765: 'I-765.pdf — заява на дозвіл на роботу (7 сторінок), якщо ви її обрали.',
    nsZipReadme: 'README.txt — короткий путівник.',
    nsSign: 'Де поставити підпис',
    nsSignI821: 'I-821 — Частина 8 на сторінці 10. Підпишіть і поставте дату.',
    nsSignI765: 'I-765 — Частина 3 на сторінці 4. Підпишіть і поставте дату.',
    nsSignPenWarning: 'Підпис лише чорною або синьою ручкою на роздрукованому папері.',
    nsPrint: 'Як друкувати',
    nsPrintLines: 'Одностороння печать (single-sided). Без масштабування (100%, без "fit to page"). Папір A4 або US Letter.',
    nsEnvelope: 'Що покласти в конверт',
    nsEnvelopeI821: 'Заповнений і підписаний I-821.',
    nsEnvelopeI765: 'Заповнений і підписаний I-765 (якщо подаєте EAD).',
    nsEnvelopeFee: 'Чек/мані-ордер за держзбір USCIS — або I-912 (якщо просите звільнення).',
    nsEnvelopeEvidence: 'Копії доказів проживання (НЕ оригінали).',
    nsEnvelopePassport: 'Копія сторінки паспорта (НЕ оригінал).',
    nsAddress: 'Куди надіслати',
    nsAddressBody: 'USCIS приймає TPS у спеціальних адресах "Lockbox". Адреса залежить від вашого штату. Точну адресу для I-821 і I-765 завжди перевіряйте на офіційних сторінках USCIS:',
    nsAddressI821Link: 'Адреси для I-821 →',
    nsAddressI765Link: 'Адреси для I-765 →',
    nsOnline: 'Або подайте онлайн',
    nsOnlineBody: 'I-821 та I-765 (категорія TPS) можна подати онлайн через ваш USCIS-акаунт. Це швидше і дозволяє платити карткою. Але онлайн-подання НЕ підтримує I-912 (звільнення від оплати) — у цьому випадку лише папір.',
    nsOnlineLink: 'Зайти в my.uscis.gov →',
    nsSourcesTitle: 'Офіційні джерела USCIS',
    nsSourceTpsPage: 'TPS Ukraine — країнова сторінка USCIS',
    nsSourceI821: 'Форма I-821 (USCIS)',
    nsSourceI765: 'Форма I-765 (USCIS)',
    nsSourceTpsGeneral: 'TPS — загальні вимоги і докази',
  },
  ru: {
    toggleOpen: '↓ Заполнить готовый PDF-пакет (черновик)',
    toggleClose: '✕ Закрыть',
    heading: 'Заполнить готовые I-821 + I-765 (черновик)',
    intro: 'Введите данные, которые USCIS спрашивает в форме. Мы сгенерируем PDF с вашими ответами уже в клетках. Распечатаете, подпишете и подаёте сами.',
    family: 'Фамилия (Family Name)', given: 'Имя (Given Name)', middle: 'Отчество (Middle Name) — необязательно',
    dob: 'Дата рождения', sex: 'Пол', male: 'Мужской', female: 'Женский',
    cob: 'Страна рождения',
    passport: 'Номер паспорта', passportCountry: 'Страна выдачи паспорта', passportExp: 'Паспорт действителен до',
    street: 'Адрес в США (улица, номер дома)', city: 'Город', state: 'Штат (2 буквы, напр. CA)', zip: 'ZIP-код',
    i94: 'I-94 admission number (11 цифр)', entry: 'Дата последнего въезда в США',
    phone: 'Дневной телефон', email: 'Email',
    generate: 'Сгенерировать PDF-пакет (черновик)',
    attestation: 'Я ознакомился с данными выше. Я понимаю, что Messenginfo не подаёт документы за меня и не является юридической фирмой.',
    attestRequired: 'Поставьте галочку, чтобы сгенерировать пакет.',
    generating: 'Генерирую…',
    successHeader: 'Готово. Что дальше?',
    success: 'PDF с вашими данными готовы. Теперь внимательно проверьте и отправьте в USCIS самостоятельно.',
    download: 'Скачать ZIP',
    again: 'Сгенерировать ещё раз',
    errorHeader: 'Не удалось сгенерировать.',
    missing: 'Незаполненные поля:',
    legal: 'Это черновик. Messenginfo не подаёт документы в USCIS и не даёт юридических советов. Внимательно проверяйте всё перед отправкой.',
    state_placeholder: 'CA',

    nsZip: 'Что внутри ZIP-архива',
    nsZipI821: 'I-821.pdf — заявление на TPS (13 страниц).',
    nsZipI765: 'I-765.pdf — заявление на разрешение на работу (7 страниц), если вы его выбрали.',
    nsZipReadme: 'README.txt — короткий путеводитель.',
    nsSign: 'Где поставить подпись',
    nsSignI821: 'I-821 — Часть 8 на странице 10. Подпишите и поставьте дату.',
    nsSignI765: 'I-765 — Часть 3 на странице 4. Подпишите и поставьте дату.',
    nsSignPenWarning: 'Подпись только чёрной или синей ручкой на распечатанной бумаге.',
    nsPrint: 'Как печатать',
    nsPrintLines: 'Односторонняя печать (single-sided). Без масштабирования (100%, без "fit to page"). Бумага A4 или US Letter.',
    nsEnvelope: 'Что положить в конверт',
    nsEnvelopeI821: 'Заполненный и подписанный I-821.',
    nsEnvelopeI765: 'Заполненный и подписанный I-765 (если подаёте на EAD).',
    nsEnvelopeFee: 'Чек/мани-ордер за госпошлину USCIS — или I-912 (если просите освобождение от оплаты).',
    nsEnvelopeEvidence: 'Копии доказательств проживания (НЕ оригиналы).',
    nsEnvelopePassport: 'Копия страницы паспорта (НЕ оригинал).',
    nsAddress: 'Куда отправлять',
    nsAddressBody: 'USCIS принимает TPS по специальным адресам "Lockbox". Адрес зависит от вашего штата. Точный адрес для I-821 и I-765 всегда проверяйте на официальных страницах USCIS:',
    nsAddressI821Link: 'Адреса для I-821 →',
    nsAddressI765Link: 'Адреса для I-765 →',
    nsOnline: 'Или подайте онлайн',
    nsOnlineBody: 'I-821 и I-765 (категория TPS) можно подать онлайн через ваш USCIS-аккаунт. Это быстрее и позволяет платить картой. Но онлайн-подача НЕ поддерживает I-912 (освобождение от оплаты) — в этом случае только бумага.',
    nsOnlineLink: 'Зайти в my.uscis.gov →',
    nsSourcesTitle: 'Официальные источники USCIS',
    nsSourceTpsPage: 'TPS Ukraine — страновая страница USCIS',
    nsSourceI821: 'Форма I-821 (USCIS)',
    nsSourceI765: 'Форма I-765 (USCIS)',
    nsSourceTpsGeneral: 'TPS — общие требования и доказательства',
  },
  en: {
    toggleOpen: '↓ Fill the PDF packet (draft)',
    toggleClose: '✕ Close',
    heading: 'Fill the ready I-821 + I-765 (draft)',
    intro: 'Enter the data USCIS asks for on the form. We generate PDFs with your answers already in the boxes. You then print, sign, and mail them yourself.',
    family: 'Family Name', given: 'Given Name', middle: 'Middle Name — optional',
    dob: 'Date of birth', sex: 'Sex', male: 'Male', female: 'Female',
    cob: 'Country of birth',
    passport: 'Passport number', passportCountry: 'Country that issued passport', passportExp: 'Passport expires',
    street: 'US address (street, house number)', city: 'City', state: 'State (2 letters, e.g. CA)', zip: 'ZIP code',
    i94: 'I-94 admission number (11 digits)', entry: 'Date of your last entry to the US',
    phone: 'Daytime phone', email: 'Email',
    generate: 'Generate PDF packet (draft)',
    attestation: 'I have reviewed the information above. I understand Messenginfo does not file documents on my behalf and is not a law firm.',
    attestRequired: 'Check the box to enable packet generation.',
    generating: 'Generating…',
    successHeader: 'Done. What next?',
    success: 'Your PDFs are ready. Review them carefully and then mail or upload to USCIS yourself.',
    download: 'Download ZIP',
    again: 'Generate again',
    errorHeader: 'Could not generate.',
    missing: 'Missing fields:',
    legal: 'This is a draft. Messenginfo does not file documents with USCIS and does not provide legal advice. Review everything carefully before mailing.',
    state_placeholder: 'CA',

    nsZip: 'What is inside the ZIP',
    nsZipI821: 'I-821.pdf — TPS application (13 pages).',
    nsZipI765: 'I-765.pdf — work permit application (7 pages), if you requested one.',
    nsZipReadme: 'README.txt — short guide.',
    nsSign: 'Where to sign',
    nsSignI821: 'I-821 — Part 8 on page 10. Sign and date.',
    nsSignI765: 'I-765 — Part 3 on page 4. Sign and date.',
    nsSignPenWarning: 'Sign in black or blue ink on the printed paper.',
    nsPrint: 'How to print',
    nsPrintLines: 'Single-sided. No scaling (100%, NOT "fit to page"). A4 or US Letter paper.',
    nsEnvelope: 'What to put in the envelope',
    nsEnvelopeI821: 'Filled and signed I-821.',
    nsEnvelopeI765: 'Filled and signed I-765 (if filing for EAD).',
    nsEnvelopeFee: 'Check or money order for the USCIS fee — or I-912 (if requesting a fee waiver).',
    nsEnvelopeEvidence: 'Copies of residence evidence (NOT originals).',
    nsEnvelopePassport: 'Copy of your passport page (NOT the original).',
    nsAddress: 'Where to mail',
    nsAddressBody: 'USCIS accepts TPS at special "Lockbox" addresses. The address depends on your state. Always check the official USCIS filing-addresses pages for I-821 and I-765:',
    nsAddressI821Link: 'I-821 mailing addresses →',
    nsAddressI765Link: 'I-765 mailing addresses →',
    nsOnline: 'Or file online',
    nsOnlineBody: 'I-821 and I-765 (TPS category) can be filed online through your USCIS account. Online is faster and lets you pay by card. But online filing does NOT support I-912 (fee waiver) — paper only in that case.',
    nsOnlineLink: 'Go to my.uscis.gov →',
    nsSourcesTitle: 'Official USCIS sources',
    nsSourceTpsPage: 'TPS Ukraine — USCIS country page',
    nsSourceI821: 'Form I-821 (USCIS)',
    nsSourceI765: 'Form I-765 (USCIS)',
    nsSourceTpsGeneral: 'TPS — general requirements and evidence',
  },
  es: {
    toggleOpen: '↓ Llenar el paquete PDF (borrador)',
    toggleClose: '✕ Cerrar',
    heading: 'Llenar I-821 + I-765 (borrador)',
    intro: 'Ingrese los datos que USCIS pide en el formulario. Generamos PDFs con sus respuestas ya en las casillas. Usted imprime, firma y envía.',
    family: 'Apellido (Family Name)', given: 'Nombre (Given Name)', middle: 'Segundo nombre — opcional',
    dob: 'Fecha de nacimiento', sex: 'Sexo', male: 'Masculino', female: 'Femenino',
    cob: 'País de nacimiento',
    passport: 'Número de pasaporte', passportCountry: 'País emisor del pasaporte', passportExp: 'Pasaporte vence',
    street: 'Dirección en EE.UU. (calle, número)', city: 'Ciudad', state: 'Estado (2 letras, ej. CA)', zip: 'Código ZIP',
    i94: 'I-94 admission number (11 dígitos)', entry: 'Fecha de su última entrada a EE.UU.',
    phone: 'Teléfono diurno', email: 'Email',
    generate: 'Generar paquete PDF (borrador)',
    attestation: 'He revisado la información anterior. Entiendo que Messenginfo no presenta documentos por mí y no es un bufete de abogados.',
    attestRequired: 'Marque la casilla para habilitar la generación del paquete.',
    generating: 'Generando…',
    successHeader: 'Listo. ¿Qué sigue?',
    success: 'Sus PDFs están listos. Revíselos cuidadosamente y luego envíelos o cárguelos en USCIS usted mismo.',
    download: 'Descargar ZIP',
    again: 'Generar otra vez',
    errorHeader: 'No se pudo generar.',
    missing: 'Campos faltantes:',
    legal: 'Esto es un borrador. Messenginfo no presenta documentos ante USCIS ni brinda asesoría legal. Revise todo cuidadosamente antes de enviar.',
    state_placeholder: 'CA',

    nsZip: 'Qué hay dentro del ZIP',
    nsZipI821: 'I-821.pdf — solicitud de TPS (13 páginas).',
    nsZipI765: 'I-765.pdf — solicitud de permiso de trabajo (7 páginas), si la solicitó.',
    nsZipReadme: 'README.txt — guía corta.',
    nsSign: 'Dónde firmar',
    nsSignI821: 'I-821 — Parte 8 en la página 10. Firme y ponga la fecha.',
    nsSignI765: 'I-765 — Parte 3 en la página 4. Firme y ponga la fecha.',
    nsSignPenWarning: 'Firme solo con bolígrafo azul o negro en el papel impreso.',
    nsPrint: 'Cómo imprimir',
    nsPrintLines: 'Una cara (single-sided). Sin escalado (100%, NO "ajustar a página"). Papel A4 o US Letter.',
    nsEnvelope: 'Qué poner en el sobre',
    nsEnvelopeI821: 'I-821 llenado y firmado.',
    nsEnvelopeI765: 'I-765 llenado y firmado (si solicita EAD).',
    nsEnvelopeFee: 'Cheque o money order por la tarifa de USCIS — o I-912 (si solicita exención de pago).',
    nsEnvelopeEvidence: 'Copias de evidencias de residencia (NO originales).',
    nsEnvelopePassport: 'Copia de la página del pasaporte (NO el original).',
    nsAddress: 'A dónde enviar',
    nsAddressBody: 'USCIS recibe TPS en direcciones "Lockbox" especiales. La dirección depende de su estado. Siempre confirme la dirección oficial de USCIS para I-821 e I-765:',
    nsAddressI821Link: 'Direcciones para I-821 →',
    nsAddressI765Link: 'Direcciones para I-765 →',
    nsOnline: 'O presente en línea',
    nsOnlineBody: 'I-821 e I-765 (categoría TPS) se pueden presentar en línea a través de su cuenta de USCIS. En línea es más rápido y permite pagar con tarjeta. Pero la presentación en línea NO admite I-912 (exención de tarifa) — solo papel en ese caso.',
    nsOnlineLink: 'Ir a my.uscis.gov →',
    nsSourcesTitle: 'Fuentes oficiales de USCIS',
    nsSourceTpsPage: 'TPS Ucrania — página del país de USCIS',
    nsSourceI821: 'Formulario I-821 (USCIS)',
    nsSourceI765: 'Formulario I-765 (USCIS)',
    nsSourceTpsGeneral: 'TPS — requisitos generales y evidencias',
  },
} as const

export default function GeneratePacketBlock({ locale, filingPath, wantsEad, preExtracted }: Props) {
  const c = COPY[locale]
  // Open by default. The block lives at the bottom of the final summary screen
  // and is the actual product — hiding it behind a toggle made senior users
  // miss it during UX testing.
  const [open, setOpen] = useState(true)
  const [fields, setFields] = useState<PersonalFields>(() => {
    let base: PersonalFields = EMPTY
    if (typeof window !== 'undefined') {
      try {
        const raw = window.localStorage.getItem(STORAGE_KEY)
        if (raw) base = { ...EMPTY, ...(JSON.parse(raw) as Partial<PersonalFields>) }
      } catch { /* ignore */ }
    }
    return applyPreExtracted(base, preExtracted)
  })
  const [busy, setBusy] = useState(false)
  // TFR.6 — Attestation gate. Required by the agreed product plan so the
  // user explicitly acknowledges Messenginfo's scope (not a law firm,
  // doesn't file) before downloading a draft packet. Timestamp stored
  // in localStorage so a returning user doesn't have to re-attest within
  // the same session. NO PII captured.
  const [attestedAt, setAttestedAt] = useState<number | null>(() => {
    if (typeof window === 'undefined') return null
    try {
      const raw = window.localStorage.getItem('tps:attest:v1')
      return raw ? parseInt(raw, 10) : null
    } catch { return null }
  })
  const setAttested = (v: boolean) => {
    const ts = v ? Date.now() : null
    setAttestedAt(ts)
    try {
      if (ts) window.localStorage.setItem('tps:attest:v1', String(ts))
      else window.localStorage.removeItem('tps:attest:v1')
    } catch { /* ignore */ }
  }
  const [zipUrl, setZipUrl] = useState<string | null>(null)
  const [missing, setMissing] = useState<string[]>([])
  const [error, setError] = useState<string | null>(null)

  function update<K extends keyof PersonalFields>(k: K, v: PersonalFields[K]) {
    setFields((prev) => {
      const next = { ...prev, [k]: v }
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
      } catch { /* ignore */ }
      return next
    })
  }

  async function generate() {
    setBusy(true)
    setMissing([])
    setError(null)
    setZipUrl(null)

    const path = filingPath === 'initial' || filingPath === 're_registration'
      ? filingPath
      : 'initial'
    const body = {
      family_name: fields.family_name,
      given_name: fields.given_name,
      middle_name: fields.middle_name || undefined,
      dob: fields.dob,
      sex: fields.sex || 'M',
      country_of_birth: fields.country_of_birth,
      country_of_nationality: 'Ukraine',
      passport_number: fields.passport_number,
      passport_country_of_issuance: fields.passport_country_of_issuance,
      passport_expiration_date: fields.passport_expiration_date,
      us_address_street: fields.us_address_street,
      us_address_city: fields.us_address_city,
      us_address_state: fields.us_address_state.toUpperCase(),
      us_address_zip: fields.us_address_zip,
      mailing_same_as_physical: true,
      last_entry_date: fields.last_entry_date,
      i94_admission_number: fields.i94_admission_number || undefined,
      // status_at_last_entry: OCR fills "UH" / "Parole" from I-94 class of
      // admission. If still blank for TPS-Ukraine path, default to "UH"
      // (Uniting for Ukraine), which is the actual class of admission USCIS
      // CBP uses for U4U parolees and the value real applicants must put on
      // I-765 Line 23. Empty string is allowed if the user truly entered on
      // a different basis (B-2, F-1, …) and OCR has not run yet.
      status_at_last_entry: fields.status_at_last_entry
        || (filingPath === 'initial' ? 'UH' : undefined),
      a_number: fields.a_number || undefined,
      filing_path: path,
      wants_ead: wantsEad === true,
      ead_category: wantsEad === true ? (path === 'initial' ? 'a12' : 'c19') : null,
      daytime_phone: fields.daytime_phone,
      email: fields.email,
      has_criminal_concern: false,
      has_prior_tps_denial: false,
      left_us_without_advance_parole: false,
    }

    try {
      const res = await fetch('/api/tps/generate-packet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (res.status === 422) {
        const data = await res.json().catch(() => ({})) as { missing?: string[] }
        setMissing(data.missing ?? [])
        setBusy(false)
        return
      }
      if (!res.ok) {
        const data = await res.json().catch(() => ({})) as { error?: string; detail?: string }
        setError(`${data.error ?? res.statusText}${data.detail ? `: ${data.detail}` : ''}`)
        setBusy(false)
        return
      }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      setZipUrl(url)
      setBusy(false)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
      setBusy(false)
    }
  }

  // ── styling shared with parent wizard (rough match) ──
  const input: React.CSSProperties = {
    width: '100%', height: 44, padding: '0 12px',
    background: 'var(--surface)', color: 'var(--text-1)',
    border: '1px solid var(--border)', borderRadius: 10,
    fontSize: 15, marginBottom: 10,
  }
  const label: React.CSSProperties = {
    display: 'block', fontSize: 12, fontWeight: 700,
    color: 'var(--text-3)', textTransform: 'uppercase',
    letterSpacing: '0.5px', marginBottom: 4, marginTop: 6,
  }
  const primary: React.CSSProperties = {
    display: 'block', width: '100%', height: 52,
    background: 'var(--success)', color: '#fff',
    fontSize: 16, fontWeight: 800, borderRadius: 12,
    border: 'none', cursor: busy ? 'wait' : 'pointer',
    opacity: busy ? 0.6 : 1, marginTop: 14,
  }
  const secondary: React.CSSProperties = {
    display: 'inline-block', padding: '10px 14px',
    background: 'var(--surface-2)', color: 'var(--text-1)',
    fontSize: 13, fontWeight: 600, borderRadius: 10,
    border: '1px solid var(--border)', cursor: 'pointer',
  }

  // Styles for the post-download instructions panel.
  const postSection: React.CSSProperties = {
    padding: '14px 16px',
    marginBottom: 10,
    background: 'var(--surface)',
    border: '1px solid var(--border)',
    borderRadius: 10,
  }
  const postHeading: React.CSSProperties = {
    fontSize: 15,
    fontWeight: 800,
    color: 'var(--text-1)',
    marginBottom: 8,
  }
  const postBody: React.CSSProperties = {
    fontSize: 14,
    lineHeight: 1.5,
    color: 'var(--text-2)',
    marginBottom: 8,
  }
  const postList: React.CSSProperties = {
    fontSize: 14,
    lineHeight: 1.65,
    color: 'var(--text-2)',
    paddingLeft: 20,
    marginBottom: 4,
  }
  const postWarn: React.CSSProperties = {
    fontSize: 13,
    lineHeight: 1.4,
    color: 'var(--warning-text, #92400e)',
    background: 'var(--warning-bg, #fef3c7)',
    padding: '8px 10px',
    borderRadius: 8,
    marginTop: 6,
  }
  const postLink: React.CSSProperties = {
    display: 'block',
    padding: '10px 12px',
    marginTop: 6,
    background: 'var(--surface-2)',
    color: 'var(--primary)',
    fontSize: 14,
    fontWeight: 700,
    borderRadius: 8,
    textDecoration: 'none',
    border: '1px solid var(--border)',
  }

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)}
        style={{
          ...secondary, display: 'block', width: '100%', textAlign: 'center',
          marginTop: 10, padding: '14px 16px',
          background: 'var(--success)', color: '#fff', borderColor: 'transparent',
          fontSize: 14, fontWeight: 800,
        }}
        data-testid="open-generate"
      >
        {c.toggleOpen}
      </button>
    )
  }

  return (
    <div
      style={{
        marginTop: 12, padding: 16,
        background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12,
      }}
      data-testid="generate-packet-block"
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
        <h3 style={{ fontSize: 17, fontWeight: 800, color: 'var(--text-1)' }}>{c.heading}</h3>
        <button type="button" onClick={() => setOpen(false)} style={{ background: 'none', border: 'none', color: 'var(--text-3)', cursor: 'pointer', fontSize: 13 }}>
          {c.toggleClose}
        </button>
      </div>
      <p style={{ fontSize: 13, color: 'var(--text-2)', lineHeight: 1.5, marginBottom: 12 }}>{c.intro}</p>

      {/* Form fields */}
      <label style={label}>{c.family}</label>
      <input style={input} value={fields.family_name} onChange={(e) => update('family_name', e.target.value)} />
      <label style={label}>{c.given}</label>
      <input style={input} value={fields.given_name} onChange={(e) => update('given_name', e.target.value)} />
      <label style={label}>{c.middle}</label>
      <input style={input} value={fields.middle_name} onChange={(e) => update('middle_name', e.target.value)} />

      <label style={label}>{c.dob}</label>
      <input type="date" style={input} value={fields.dob} onChange={(e) => update('dob', e.target.value)} />

      <label style={label}>{c.sex}</label>
      <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
        <button type="button" style={{ ...secondary, flex: 1, background: fields.sex === 'M' ? 'var(--success)' : 'var(--surface-2)', color: fields.sex === 'M' ? '#fff' : 'var(--text-1)' }} onClick={() => update('sex', 'M')}>{c.male}</button>
        <button type="button" style={{ ...secondary, flex: 1, background: fields.sex === 'F' ? 'var(--success)' : 'var(--surface-2)', color: fields.sex === 'F' ? '#fff' : 'var(--text-1)' }} onClick={() => update('sex', 'F')}>{c.female}</button>
      </div>

      <label style={label}>{c.cob}</label>
      <input style={input} value={fields.country_of_birth} onChange={(e) => update('country_of_birth', e.target.value)} />

      <label style={label}>{c.passport}</label>
      <input style={input} value={fields.passport_number} onChange={(e) => update('passport_number', e.target.value)} />
      <label style={label}>{c.passportCountry}</label>
      <input style={input} value={fields.passport_country_of_issuance} onChange={(e) => update('passport_country_of_issuance', e.target.value)} />
      <label style={label}>{c.passportExp}</label>
      <input type="date" style={input} value={fields.passport_expiration_date} onChange={(e) => update('passport_expiration_date', e.target.value)} />

      <label style={label}>{c.street}</label>
      <input style={input} value={fields.us_address_street} onChange={(e) => update('us_address_street', e.target.value)} />
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: 8 }}>
        <div>
          <label style={label}>{c.city}</label>
          <input style={input} value={fields.us_address_city} onChange={(e) => update('us_address_city', e.target.value)} />
        </div>
        <div>
          <label style={label}>{c.state}</label>
          <input style={input} maxLength={2} placeholder={c.state_placeholder} value={fields.us_address_state} onChange={(e) => update('us_address_state', e.target.value.toUpperCase())} />
        </div>
        <div>
          <label style={label}>{c.zip}</label>
          <input style={input} value={fields.us_address_zip} onChange={(e) => update('us_address_zip', e.target.value)} />
        </div>
      </div>

      <label style={label}>{c.i94}</label>
      <input style={input} value={fields.i94_admission_number} onChange={(e) => update('i94_admission_number', e.target.value)} />
      <label style={label}>{c.entry}</label>
      <input type="date" style={input} value={fields.last_entry_date} onChange={(e) => update('last_entry_date', e.target.value)} />

      <label style={label}>{c.phone}</label>
      <input style={input} value={fields.daytime_phone} onChange={(e) => update('daytime_phone', e.target.value)} />
      <label style={label}>{c.email}</label>
      <input type="email" style={input} value={fields.email} onChange={(e) => update('email', e.target.value)} />

      {/* P110.2 — Packet Completeness Checker. Shows forms-to-be-included,
          filled vs. missing critical fields, signing locations and
          lockbox preview BEFORE the user clicks Generate. */}
      <PacketCompletenessChecker
        locale={locale}
        fields={fields}
        wantsEad={wantsEad}
        filingPath={filingPath}
      />

      {/* TFR.6 — Attestation gate. Generate stays disabled until checked. */}
      <label
        data-testid="tps-attestation-row"
        style={{
          display: 'flex',
          gap: 12,
          alignItems: 'flex-start',
          padding: '14px 14px',
          marginTop: 16,
          background: 'var(--surface-2)',
          border: '1px solid var(--border)',
          borderRadius: 10,
          fontSize: 13,
          lineHeight: 1.5,
          cursor: 'pointer',
        }}
      >
        <input
          type="checkbox"
          data-testid="tps-attestation-checkbox"
          checked={attestedAt !== null}
          onChange={(e) => setAttested(e.target.checked)}
          style={{ marginTop: 3, width: 18, height: 18, accentColor: 'var(--success)', flexShrink: 0 }}
        />
        <span style={{ color: 'var(--text-1)' }}>{c.attestation}</span>
      </label>

      <button
        type="button"
        onClick={generate}
        disabled={busy || attestedAt === null}
        aria-disabled={busy || attestedAt === null}
        style={{
          ...primary,
          opacity: busy || attestedAt === null ? 0.45 : 1,
          cursor: busy || attestedAt === null ? 'not-allowed' : 'pointer',
          background: busy || attestedAt === null ? 'var(--surface-2)' : primary.background,
          color: busy || attestedAt === null ? 'var(--text-3)' : primary.color,
          boxShadow: busy || attestedAt === null ? 'none' : primary.boxShadow,
        }}
        data-testid="generate-btn"
      >
        {busy ? c.generating : c.generate}
      </button>
      {attestedAt === null && (
        <p
          data-testid="tps-attestation-hint"
          style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 6, textAlign: 'center' }}
        >
          {c.attestRequired}
        </p>
      )}

      {missing.length > 0 && (
        <div style={{ marginTop: 12, padding: 12, background: 'var(--warning-bg, #fef3c7)', color: 'var(--warning-text, #92400e)', borderRadius: 10, fontSize: 13 }}>
          <strong>{c.missing}</strong>
          <ul style={{ paddingLeft: 18, marginTop: 4 }}>
            {missing.map((m) => <li key={m}>{m}</li>)}
          </ul>
        </div>
      )}
      {error && (
        <div style={{ marginTop: 12, padding: 12, background: 'var(--danger-bg, #fee2e2)', color: 'var(--danger-text, #991b1b)', borderRadius: 10, fontSize: 13 }}>
          <strong>{c.errorHeader}</strong> {error}
        </div>
      )}
      {zipUrl && (
        <div data-testid="post-download" style={{ marginTop: 12 }}>
          {/* Success header + download */}
          <div style={{ padding: 14, background: 'var(--success-bg, #dcfce7)', color: 'var(--success-text, #166534)', borderRadius: 10, fontSize: 14, marginBottom: 12 }}>
            <p style={{ fontWeight: 800, fontSize: 16, marginBottom: 6 }}>{c.successHeader}</p>
            <p style={{ marginBottom: 12, lineHeight: 1.45 }}>{c.success}</p>
            <a
              href={zipUrl}
              download="tps-packet-draft.zip"
              style={{
                display: 'inline-block',
                padding: '12px 18px',
                background: 'var(--success)',
                color: '#fff',
                fontWeight: 800,
                fontSize: 15,
                borderRadius: 10,
                textDecoration: 'none',
                marginRight: 8,
                boxShadow: '0 3px 14px rgba(22,163,74,0.30)',
              }}
              data-testid="download-zip"
            >
              ⬇ {c.download}
            </a>
            <button type="button" onClick={generate} style={{ ...secondary, marginLeft: 4 }}>{c.again}</button>
          </div>

          {/* What's in the ZIP */}
          <section style={postSection}>
            <h4 style={postHeading}>{c.nsZip}</h4>
            <ul style={postList}>
              <li>{c.nsZipI821}</li>
              <li>{c.nsZipI765}</li>
              <li>{c.nsZipReadme}</li>
            </ul>
          </section>

          {/* Where to sign */}
          <section style={postSection}>
            <h4 style={postHeading}>{c.nsSign}</h4>
            <ul style={postList}>
              <li>{c.nsSignI821}</li>
              <li>{c.nsSignI765}</li>
            </ul>
            <p style={postWarn}>{c.nsSignPenWarning}</p>
          </section>

          {/* How to print */}
          <section style={postSection}>
            <h4 style={postHeading}>{c.nsPrint}</h4>
            <p style={postBody}>{c.nsPrintLines}</p>
          </section>

          {/* Envelope checklist */}
          <section style={postSection}>
            <h4 style={postHeading}>{c.nsEnvelope}</h4>
            <ul style={postList}>
              <li>{c.nsEnvelopeI821}</li>
              <li>{c.nsEnvelopeI765}</li>
              <li>{c.nsEnvelopeFee}</li>
              <li>{c.nsEnvelopeEvidence}</li>
              <li>{c.nsEnvelopePassport}</li>
            </ul>
          </section>

          {/* Mailing address (link to USCIS official filing-addresses pages) */}
          <section style={postSection}>
            <h4 style={postHeading}>{c.nsAddress}</h4>
            <p style={postBody}>{c.nsAddressBody}</p>
            <a
              href="https://www.uscis.gov/forms/filing-fees/form-i-821-filing-addresses"
              target="_blank"
              rel="noopener noreferrer"
              style={postLink}
            >
              {c.nsAddressI821Link}
            </a>
            <a
              href="https://www.uscis.gov/forms/filing-fees/form-i-765-filing-addresses"
              target="_blank"
              rel="noopener noreferrer"
              style={postLink}
            >
              {c.nsAddressI765Link}
            </a>
          </section>

          {/* Online filing alternative */}
          <section style={postSection}>
            <h4 style={postHeading}>{c.nsOnline}</h4>
            <p style={postBody}>{c.nsOnlineBody}</p>
            <a
              href="https://my.uscis.gov"
              target="_blank"
              rel="noopener noreferrer"
              style={postLink}
            >
              {c.nsOnlineLink}
            </a>
          </section>

          {/* Official sources */}
          <section style={{ ...postSection, background: 'var(--surface-2)' }}>
            <h4 style={postHeading}>{c.nsSourcesTitle}</h4>
            <a href="https://www.uscis.gov/humanitarian/temporary-protected-status/TPS-Ukraine" target="_blank" rel="noopener noreferrer" style={postLink}>{c.nsSourceTpsPage} ↗</a>
            <a href="https://www.uscis.gov/i-821" target="_blank" rel="noopener noreferrer" style={postLink}>{c.nsSourceI821} ↗</a>
            <a href="https://www.uscis.gov/i-765" target="_blank" rel="noopener noreferrer" style={postLink}>{c.nsSourceI765} ↗</a>
            <a href="https://www.uscis.gov/humanitarian/temporary-protected-status" target="_blank" rel="noopener noreferrer" style={postLink}>{c.nsSourceTpsGeneral} ↗</a>
          </section>
        </div>
      )}

      <p style={{ fontSize: 11, color: 'var(--text-3)', lineHeight: 1.5, marginTop: 14 }}>{c.legal}</p>
    </div>
  )
}
