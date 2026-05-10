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

type Locale = 'uk' | 'ru' | 'en' | 'es'

interface Props {
  locale: Locale
  filingPath: 'initial' | 're_registration' | 'unknown'
  wantsEad: boolean | null
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
}

const EMPTY: PersonalFields = {
  family_name: '', given_name: '', middle_name: '',
  dob: '', sex: '',
  country_of_birth: 'Ukraine',
  passport_number: '', passport_country_of_issuance: 'Ukraine', passport_expiration_date: '',
  us_address_street: '', us_address_city: '', us_address_state: '', us_address_zip: '',
  i94_admission_number: '', last_entry_date: '',
  daytime_phone: '', email: '',
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
    generating: 'Генерую…',
    successHeader: 'Готово.',
    success: 'Завантажте ZIP, відкрийте PDF у Adobe, перевірте кожне поле, підпишіть ручкою і відправте USCIS самостійно.',
    download: 'Завантажити ZIP',
    again: 'Згенерувати ще раз',
    errorHeader: 'Не вдалося згенерувати.',
    missing: 'Незаповнені поля:',
    legal: 'Це чернетка. Messenginfo не подає документи в USCIS і не дає юридичних порад. Уважно перевіряйте все перед відправкою.',
    state_placeholder: 'CA',
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
    generating: 'Генерирую…',
    successHeader: 'Готово.',
    success: 'Скачайте ZIP, откройте PDF в Adobe, проверьте каждое поле, подпишите ручкой и отправьте в USCIS сами.',
    download: 'Скачать ZIP',
    again: 'Сгенерировать ещё раз',
    errorHeader: 'Не удалось сгенерировать.',
    missing: 'Незаполненные поля:',
    legal: 'Это черновик. Messenginfo не подаёт документы в USCIS и не даёт юридических советов. Внимательно проверяйте всё перед отправкой.',
    state_placeholder: 'CA',
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
    generating: 'Generating…',
    successHeader: 'Done.',
    success: 'Download the ZIP, open the PDFs in Adobe, review every field, sign in ink, and mail to USCIS yourself.',
    download: 'Download ZIP',
    again: 'Generate again',
    errorHeader: 'Could not generate.',
    missing: 'Missing fields:',
    legal: 'This is a draft. Messenginfo does not file documents with USCIS and does not provide legal advice. Review everything carefully before mailing.',
    state_placeholder: 'CA',
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
    generating: 'Generando…',
    successHeader: 'Listo.',
    success: 'Descargue el ZIP, abra los PDFs en Adobe, revise cada campo, firme con bolígrafo y envíe a USCIS usted mismo.',
    download: 'Descargar ZIP',
    again: 'Generar otra vez',
    errorHeader: 'No se pudo generar.',
    missing: 'Campos faltantes:',
    legal: 'Esto es un borrador. Messenginfo no presenta documentos ante USCIS ni brinda asesoría legal. Revise todo cuidadosamente antes de enviar.',
    state_placeholder: 'CA',
  },
} as const

export default function GeneratePacketBlock({ locale, filingPath, wantsEad }: Props) {
  const c = COPY[locale]
  const [open, setOpen] = useState(false)
  const [fields, setFields] = useState<PersonalFields>(() => {
    if (typeof window === 'undefined') return EMPTY
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY)
      if (raw) return { ...EMPTY, ...(JSON.parse(raw) as Partial<PersonalFields>) }
    } catch { /* ignore */ }
    return EMPTY
  })
  const [busy, setBusy] = useState(false)
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

    const path = filingPath === 'unknown' ? 'initial' : filingPath
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

      <button type="button" onClick={generate} disabled={busy} style={primary} data-testid="generate-btn">
        {busy ? c.generating : c.generate}
      </button>

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
        <div style={{ marginTop: 12, padding: 12, background: 'var(--success-bg, #dcfce7)', color: 'var(--success-text, #166534)', borderRadius: 10, fontSize: 14 }}>
          <p style={{ fontWeight: 700, marginBottom: 4 }}>{c.successHeader}</p>
          <p style={{ marginBottom: 10, lineHeight: 1.4 }}>{c.success}</p>
          <a href={zipUrl} download="tps-packet-draft.zip" style={{ display: 'inline-block', padding: '10px 14px', background: 'var(--success)', color: '#fff', fontWeight: 700, borderRadius: 10, textDecoration: 'none', marginRight: 8 }} data-testid="download-zip">
            {c.download}
          </a>
          <button type="button" onClick={generate} style={{ ...secondary }}>{c.again}</button>
        </div>
      )}

      <p style={{ fontSize: 11, color: 'var(--text-3)', lineHeight: 1.5, marginTop: 14 }}>{c.legal}</p>
    </div>
  )
}
