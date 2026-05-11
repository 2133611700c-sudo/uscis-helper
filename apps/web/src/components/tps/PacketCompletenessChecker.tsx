'use client'

/**
 * PacketCompletenessChecker — pre-download summary card for TPS packet.
 *
 * Rendered above the attestation row in GeneratePacketBlock. Shows the
 * user — BEFORE they click Generate — exactly:
 *
 *   1. WHICH forms will be in the ZIP (I-821 always, I-765 conditional on
 *      "I also want a work permit" answer). Includes the page count and
 *      the USCIS edition the field map is pinned against. If the user
 *      accidentally said "no EAD" but actually wants it, this is the
 *      surface where they catch the mistake.
 *
 *   2. WHICH critical fields are still empty. Each missing field is
 *      shown in plain language. While ANY critical field is empty, the
 *      user sees red "обязательное поле" markers and a counter at the
 *      bottom. The Generate button gating is owned by GeneratePacketBlock
 *      (attestation + non-empty critical fields).
 *
 *   3. WHICH critical fields are filled — with a ✓. This is the trust
 *      signal that says "we have everything we need". A 60-year-old
 *      Ukrainian filer who is afraid of "missing a step" sees the list
 *      and confirms they have done their part.
 *
 *   4. WHERE the user must sign on paper after print. We do NOT sign on
 *      their behalf and the screen says so.
 *
 *   5. WHICH USCIS lockbox they will mail to. Phoenix for U4U / Ukraine
 *      TPS today. The actual lockbox link is rendered in the post-download
 *      success block of GeneratePacketBlock — here we just name it so the
 *      user is not surprised after download.
 *
 * Design rule: this component never opens or closes the wizard, never
 * persists anything, never calls the network. Pure presentation over the
 * answers the user has already typed (or OCR has filled).
 */

import type { ReactNode } from 'react'

export type Locale = 'uk' | 'ru' | 'en' | 'es'

/** Subset of personal fields the checker inspects. Keep aligned with
 *  isMinimallyComplete() in lib/tps/answers.ts so what the UI shows
 *  here matches what the server-side validator will accept. */
export interface CheckerFields {
  family_name: string
  given_name: string
  dob: string
  sex: string
  country_of_birth: string
  passport_number: string
  passport_country_of_issuance: string
  passport_expiration_date: string
  us_address_street: string
  us_address_city: string
  us_address_state: string
  us_address_zip: string
  last_entry_date: string
  daytime_phone: string
  email: string
}

export interface PacketCompletenessProps {
  locale: Locale
  fields: CheckerFields
  /** Has the user said yes to "also generate I-765 for work permit"? */
  wantsEad: boolean | null | undefined
  /** Filing path drives I-765 eligibility category copy (a12 vs c19). */
  filingPath: 'initial' | 're_registration' | 'unknown' | 'unselected'
}

interface RowSpec {
  key: keyof CheckerFields
  /** Translated label, e.g. "Фамилия". */
  label: string
}

interface CopyBundle {
  title: string
  formsHeading: string
  i821Line: (pages: number, ed: string) => string
  i765Line: (pages: number, ed: string) => string
  i765NotIncluded: string
  filledHeading: string
  missingHeading: string
  missingFooter: (n: number) => string
  signingHeading: string
  signI821: string
  signI765: string
  signWarning: string
  lockboxHeading: string
  lockboxBody: string
  rowLabels: Record<keyof CheckerFields, string>
}

const COPY: Record<Locale, CopyBundle> = {
  uk: {
    title: 'Що буде у пакеті',
    formsHeading: 'Форми у ZIP-архіві',
    i821Line: (pages, ed) => `I-821 — заява на TPS (${pages} стор., редакція USCIS ${ed})`,
    i765Line: (pages, ed) => `I-765 — заява на дозвіл на роботу (${pages} стор., редакція USCIS ${ed})`,
    i765NotIncluded: 'I-765 не включено (ви не запросили дозвіл на роботу)',
    filledHeading: 'Поля, які ми вже маємо',
    missingHeading: 'Потрібно ще заповнити',
    missingFooter: (n) => `Залишилось обов’язкових полів: ${n}`,
    signingHeading: 'Підписи на папері (після друку)',
    signI821: 'I-821 — Частина 8 на сторінці 10. Чорна або синя ручка.',
    signI765: 'I-765 — Частина 3 на сторінці 4. Чорна або синя ручка.',
    signWarning: 'Ми НЕ підписуємо за вас. Це треба зробити руками після друку.',
    lockboxHeading: 'Куди надсилати',
    lockboxBody: 'USCIS Lockbox у Фініксі (для громадян України за TPS / U4U). Точну адресу для вашого штату подивіться на сторінці USCIS у блоці «Куди надіслати» після генерації пакета.',
    rowLabels: {
      family_name: 'Прізвище', given_name: 'Ім’я', dob: 'Дата народження', sex: 'Стать',
      country_of_birth: 'Країна народження',
      passport_number: 'Номер паспорта', passport_country_of_issuance: 'Країна видачі паспорта',
      passport_expiration_date: 'Паспорт дійсний до',
      us_address_street: 'Адреса в США (вулиця)', us_address_city: 'Місто', us_address_state: 'Штат',
      us_address_zip: 'ZIP-код',
      last_entry_date: 'Дата в’їзду в США',
      daytime_phone: 'Денний телефон', email: 'Email',
    },
  },
  ru: {
    title: 'Что будет в пакете',
    formsHeading: 'Формы в ZIP-архиве',
    i821Line: (pages, ed) => `I-821 — заявление на TPS (${pages} стр., редакция USCIS ${ed})`,
    i765Line: (pages, ed) => `I-765 — заявление на разрешение на работу (${pages} стр., редакция USCIS ${ed})`,
    i765NotIncluded: 'I-765 не включён (вы не запросили разрешение на работу)',
    filledHeading: 'Поля, которые у нас уже есть',
    missingHeading: 'Нужно ещё заполнить',
    missingFooter: (n) => `Осталось обязательных полей: ${n}`,
    signingHeading: 'Подписи на бумаге (после печати)',
    signI821: 'I-821 — Часть 8 на странице 10. Чёрная или синяя ручка.',
    signI765: 'I-765 — Часть 3 на странице 4. Чёрная или синяя ручка.',
    signWarning: 'Мы НЕ подписываем за вас. Это нужно сделать вручную после печати.',
    lockboxHeading: 'Куда отправлять',
    lockboxBody: 'USCIS Lockbox в Финиксе (для граждан Украины по TPS / U4U). Точный адрес для вашего штата вы увидите на странице USCIS в блоке «Куда отправить» после генерации пакета.',
    rowLabels: {
      family_name: 'Фамилия', given_name: 'Имя', dob: 'Дата рождения', sex: 'Пол',
      country_of_birth: 'Страна рождения',
      passport_number: 'Номер паспорта', passport_country_of_issuance: 'Страна выдачи паспорта',
      passport_expiration_date: 'Паспорт действителен до',
      us_address_street: 'Адрес в США (улица)', us_address_city: 'Город', us_address_state: 'Штат',
      us_address_zip: 'ZIP-код',
      last_entry_date: 'Дата въезда в США',
      daytime_phone: 'Дневной телефон', email: 'Email',
    },
  },
  en: {
    title: 'What will be in your packet',
    formsHeading: 'Forms in the ZIP file',
    i821Line: (pages, ed) => `I-821 — TPS Application (${pages} pages, USCIS edition ${ed})`,
    i765Line: (pages, ed) => `I-765 — Application for Employment Authorization (${pages} pages, USCIS edition ${ed})`,
    i765NotIncluded: 'I-765 not included (you did not request a work permit)',
    filledHeading: 'Fields we already have',
    missingHeading: 'Still need from you',
    missingFooter: (n) => `Required fields remaining: ${n}`,
    signingHeading: 'Where you sign on paper (after printing)',
    signI821: 'I-821 — Part 8 on page 10. Black or blue ink.',
    signI765: 'I-765 — Part 3 on page 4. Black or blue ink.',
    signWarning: 'We do NOT sign for you. You must sign by hand after printing.',
    lockboxHeading: 'Where to mail',
    lockboxBody: 'USCIS Lockbox in Phoenix (for Ukrainian nationals filing TPS / U4U). The exact address for your state will appear on the USCIS page in the "Where to send" block after the packet is generated.',
    rowLabels: {
      family_name: 'Family name', given_name: 'Given name', dob: 'Date of birth', sex: 'Sex',
      country_of_birth: 'Country of birth',
      passport_number: 'Passport number', passport_country_of_issuance: 'Passport country of issuance',
      passport_expiration_date: 'Passport expiration',
      us_address_street: 'US address (street)', us_address_city: 'City', us_address_state: 'State',
      us_address_zip: 'ZIP code',
      last_entry_date: 'Date of last entry to the US',
      daytime_phone: 'Daytime phone', email: 'Email',
    },
  },
  es: {
    title: 'Lo que estará en su paquete',
    formsHeading: 'Formularios en el ZIP',
    i821Line: (pages, ed) => `I-821 — Solicitud de TPS (${pages} pág., edición USCIS ${ed})`,
    i765Line: (pages, ed) => `I-765 — Solicitud de permiso de trabajo (${pages} pág., edición USCIS ${ed})`,
    i765NotIncluded: 'I-765 no incluido (no solicitó permiso de trabajo)',
    filledHeading: 'Campos que ya tenemos',
    missingHeading: 'Aún falta completar',
    missingFooter: (n) => `Campos obligatorios pendientes: ${n}`,
    signingHeading: 'Dónde firmar en papel (después de imprimir)',
    signI821: 'I-821 — Parte 8 en la página 10. Tinta negra o azul.',
    signI765: 'I-765 — Parte 3 en la página 4. Tinta negra o azul.',
    signWarning: 'NO firmamos por usted. Debe firmar a mano después de imprimir.',
    lockboxHeading: 'Adónde enviar',
    lockboxBody: 'USCIS Lockbox en Phoenix (para nacionales ucranianos que presentan TPS / U4U). La dirección exacta para su estado aparecerá en la página de USCIS en el bloque "Dónde enviar" después de generar el paquete.',
    rowLabels: {
      family_name: 'Apellido', given_name: 'Nombre', dob: 'Fecha de nacimiento', sex: 'Sexo',
      country_of_birth: 'País de nacimiento',
      passport_number: 'Número de pasaporte', passport_country_of_issuance: 'País de emisión del pasaporte',
      passport_expiration_date: 'Vencimiento del pasaporte',
      us_address_street: 'Dirección en EE. UU. (calle)', us_address_city: 'Ciudad', us_address_state: 'Estado',
      us_address_zip: 'Código ZIP',
      last_entry_date: 'Fecha de última entrada a EE. UU.',
      daytime_phone: 'Teléfono diurno', email: 'Email',
    },
  },
}

// Critical fields list — MUST match isMinimallyComplete() in lib/tps/answers.ts
const CRITICAL_FIELDS: ReadonlyArray<keyof CheckerFields> = [
  'family_name', 'given_name', 'dob', 'sex',
  'country_of_birth',
  'passport_number', 'passport_country_of_issuance', 'passport_expiration_date',
  'us_address_street', 'us_address_city', 'us_address_state', 'us_address_zip',
  'last_entry_date',
  'daytime_phone', 'email',
] as const

// Edition + page counts pinned in the source layer (see
// docs/uscis/forms/tps/forms_manifest.json). The PacketCompletenessChecker
// is a presentation-only component, so we display them here as constants
// — kept in sync with the field maps' header comments.
const I821_EDITION = '01/20/25'
const I821_PAGES = 13
const I765_EDITION = '08/21/25'
const I765_PAGES = 7

function isFilled(value: string | undefined | null): boolean {
  return typeof value === 'string' && value.trim() !== ''
}

export function PacketCompletenessChecker(props: PacketCompletenessProps): ReactNode {
  const c = COPY[props.locale]

  const missing: Array<keyof CheckerFields> = []
  const filled: Array<keyof CheckerFields> = []
  for (const k of CRITICAL_FIELDS) {
    if (isFilled(props.fields[k])) {
      filled.push(k)
    } else {
      missing.push(k)
    }
  }

  const includeI765 = props.wantsEad === true

  // ── Section wrapper ────────────────────────────────────────────────────
  const card: React.CSSProperties = {
    background: 'var(--surface-2)',
    border: '1px solid var(--border)',
    borderRadius: 12,
    padding: '14px 16px',
    marginTop: 18,
  }
  const sectionHeader: React.CSSProperties = {
    fontSize: 12,
    fontWeight: 800,
    textTransform: 'uppercase',
    letterSpacing: '0.4px',
    color: 'var(--text-3)',
    marginTop: 14,
    marginBottom: 6,
  }
  const liBase: React.CSSProperties = {
    fontSize: 13,
    lineHeight: 1.5,
    padding: '4px 0',
    color: 'var(--text-1)',
  }

  return (
    <section
      data-testid="tps-packet-checker"
      style={card}
      aria-label={c.title}
    >
      <h3
        style={{
          fontSize: 16,
          fontWeight: 800,
          color: 'var(--text-1)',
          marginBottom: 4,
        }}
      >
        {c.title}
      </h3>

      {/* Forms in the ZIP */}
      <p style={sectionHeader}>{c.formsHeading}</p>
      <ul style={{ paddingLeft: 18, margin: 0 }} data-testid="checker-forms">
        <li style={liBase} data-testid="checker-form-i821">
          {c.i821Line(I821_PAGES, I821_EDITION)}
        </li>
        {includeI765 ? (
          <li style={liBase} data-testid="checker-form-i765">
            {c.i765Line(I765_PAGES, I765_EDITION)}
          </li>
        ) : (
          <li style={{ ...liBase, color: 'var(--text-3)', fontStyle: 'italic' }} data-testid="checker-form-i765-skipped">
            {c.i765NotIncluded}
          </li>
        )}
      </ul>

      {/* Filled fields */}
      {filled.length > 0 && (
        <>
          <p style={sectionHeader}>{c.filledHeading}</p>
          <ul style={{ paddingLeft: 0, margin: 0, listStyle: 'none' }} data-testid="checker-filled">
            {filled.map((k) => (
              <li
                key={k}
                style={{
                  ...liBase,
                  display: 'flex',
                  gap: 8,
                  alignItems: 'baseline',
                }}
              >
                <span style={{ color: 'var(--success, #16a34a)', fontWeight: 700, flexShrink: 0 }}>✓</span>
                <span>{c.rowLabels[k]}</span>
              </li>
            ))}
          </ul>
        </>
      )}

      {/* Missing critical fields */}
      {missing.length > 0 && (
        <>
          <p style={{ ...sectionHeader, color: 'var(--danger-text, #991b1b)' }}>
            {c.missingHeading}
          </p>
          <ul style={{ paddingLeft: 0, margin: 0, listStyle: 'none' }} data-testid="checker-missing">
            {missing.map((k) => (
              <li
                key={k}
                style={{
                  ...liBase,
                  display: 'flex',
                  gap: 8,
                  alignItems: 'baseline',
                  color: 'var(--danger-text, #991b1b)',
                }}
                data-testid={`checker-missing-${k}`}
              >
                <span style={{ fontWeight: 700, flexShrink: 0 }}>•</span>
                <span>{c.rowLabels[k]}</span>
              </li>
            ))}
          </ul>
          <p
            style={{
              fontSize: 12,
              color: 'var(--danger-text, #991b1b)',
              fontWeight: 700,
              marginTop: 8,
            }}
            data-testid="checker-missing-footer"
          >
            {c.missingFooter(missing.length)}
          </p>
        </>
      )}

      {/* Signing on paper */}
      <p style={sectionHeader}>{c.signingHeading}</p>
      <ul style={{ paddingLeft: 18, margin: 0 }} data-testid="checker-signing">
        <li style={liBase}>{c.signI821}</li>
        {includeI765 && <li style={liBase}>{c.signI765}</li>}
      </ul>
      <p
        style={{
          fontSize: 12,
          color: 'var(--text-3)',
          marginTop: 6,
          fontStyle: 'italic',
        }}
      >
        {c.signWarning}
      </p>

      {/* Lockbox */}
      <p style={sectionHeader}>{c.lockboxHeading}</p>
      <p style={{ ...liBase, marginBottom: 0 }} data-testid="checker-lockbox">
        {c.lockboxBody}
      </p>
    </section>
  )
}
