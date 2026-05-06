/**
 * Stage 13B: Translation sample preview
 *
 * Shows cold visitors EXACTLY what their translated document will look like
 * before they start filling any fields. No competitor offers this.
 *
 * Static component — no props, no state, pure HTML/CSS.
 */

export function TranslationSamplePreview({ locale }: { locale: string }) {
  const text = {
    uk: {
      heading: 'Ось як виглядає готовий переклад',
      sub: 'Паспорт України · Зразок документа',
      badge: 'ЗРАЗОК',
      fieldCol: 'Поле оригіналу',
      valueCol: 'Значення (оригінал)',
      transCol: 'Переклад (English)',
      cert: 'Блок сертифікації перекладача',
      certBody: 'I, [Your Name], hereby certify that I am competent to translate from Ukrainian into English, and that the foregoing is a complete and accurate translation of the attached document.',
      cta: 'Перекласти свій документ безкоштовно →',
    },
    ru: {
      heading: 'Вот как выглядит готовый перевод',
      sub: 'Паспорт Украины · Образец документа',
      badge: 'ОБРАЗЕЦ',
      fieldCol: 'Поле оригинала',
      valueCol: 'Значение (оригинал)',
      transCol: 'Перевод (English)',
      cert: 'Блок сертификации переводчика',
      certBody: 'I, [Your Name], hereby certify that I am competent to translate from Ukrainian into English, and that the foregoing is a complete and accurate translation of the attached document.',
      cta: 'Перевести документ бесплатно →',
    },
    es: {
      heading: 'Así luce la traducción terminada',
      sub: 'Pasaporte Ucraniano · Documento de muestra',
      badge: 'MUESTRA',
      fieldCol: 'Campo original',
      valueCol: 'Valor (original)',
      transCol: 'Traducción (English)',
      cert: 'Bloque de certificación',
      certBody: 'I, [Your Name], hereby certify that I am competent to translate from Ukrainian into English, and that the foregoing is a complete and accurate translation of the attached document.',
      cta: 'Traducir su documento gratis →',
    },
    en: {
      heading: 'This is what your translation looks like',
      sub: 'Ukrainian Passport · Sample document',
      badge: 'SAMPLE',
      fieldCol: 'Original field',
      valueCol: 'Value (original)',
      transCol: 'Translation (English)',
      cert: 'Translator certification block',
      certBody: 'I, [Your Name], hereby certify that I am competent to translate from Ukrainian into English, and that the foregoing is a complete and accurate translation of the attached document.',
      cta: 'Translate your document free →',
    },
  }

  const t = text[locale as keyof typeof text] ?? text.en

  const rows = [
    { field: 'Прізвище / Last Name',       orig: 'ШЕВЧЕНКО',             trans: 'SHEVCHENKO' },
    { field: "Ім'я / Given Name",           orig: 'ТАРАС ГРИГОРОВИЧ',    trans: 'TARAS HRYHOROVYCH' },
    { field: 'Дата народження / DOB',       orig: '09.03.1814',           trans: 'March 9, 1814' },
    { field: 'Місце народження / POB',      orig: 'с. Моринці, Україна', trans: 'Moryntsi village, Ukraine' },
    { field: 'Стать / Sex',                 orig: 'М',                    trans: 'Male / M' },
    { field: 'Громадянство / Nationality',  orig: 'Українець',            trans: 'Ukrainian' },
    { field: 'Номер паспорта / Doc No.',    orig: 'FN123456',             trans: 'FN123456' },
    { field: 'Дата видачі / Issue Date',    orig: '20.05.2020',           trans: 'May 20, 2020' },
    { field: 'Термін дії / Expiry Date',    orig: '20.05.2030',           trans: 'May 20, 2030' },
    { field: 'Орган видачі / Issued by',    orig: 'ДМСУ 1234, Київ',      trans: 'State Migration Service No.1234, Kyiv' },
  ]

  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-1)] overflow-hidden shadow-sm">
      {/* Header */}
      <div className="bg-blue-600 px-5 py-4 flex items-center justify-between">
        <div>
          <p className="text-[11px] font-bold text-blue-200 uppercase tracking-widest mb-0.5">{t.badge}</p>
          <p className="text-[15px] font-bold text-white">{t.heading}</p>
          <p className="text-[12px] text-blue-200 mt-0.5">{t.sub}</p>
        </div>
        <div className="w-12 h-14 rounded-lg bg-blue-500 border border-blue-400 flex items-center justify-center">
          <svg viewBox="0 0 24 30" width="24" height="30" fill="none">
            <rect x="1" y="1" width="22" height="28" rx="2" fill="rgba(255,255,255,.15)" stroke="rgba(255,255,255,.7)" strokeWidth="1.2"/>
            <circle cx="12" cy="10" r="4" stroke="rgba(255,255,255,.9)" strokeWidth="1.2" fill="rgba(255,255,255,.15)"/>
            <path d="M4 19c0-4 3.6-7 8-7s8 3 8 7" stroke="rgba(255,255,255,.8)" strokeWidth="1.2" strokeLinecap="round" fill="none"/>
            <rect x="2" y="22" width="20" height="1.2" rx=".6" fill="rgba(255,255,255,.5)"/>
            <rect x="2" y="24.5" width="20" height="1.2" rx=".6" fill="rgba(255,255,255,.4)"/>
          </svg>
        </div>
      </div>

      {/* Translation table */}
      <div className="overflow-x-auto">
        <table className="w-full text-[12px]">
          <thead>
            <tr className="bg-[var(--surface-2)] border-b border-[var(--border)]">
              <th className="text-left px-4 py-2 font-bold text-[var(--text-2)] w-[38%]">{t.fieldCol}</th>
              <th className="text-left px-4 py-2 font-bold text-[var(--text-2)] w-[28%]">{t.valueCol}</th>
              <th className="text-left px-4 py-2 font-bold text-blue-600 w-[34%]">{t.transCol}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={i} className={`border-b border-[var(--border)] ${i % 2 === 0 ? 'bg-[var(--surface-1)]' : 'bg-[var(--surface-2)]'}`}>
                <td className="px-4 py-2 text-[var(--text-2)] font-medium">{row.field}</td>
                <td className="px-4 py-2 text-[var(--text-1)] font-mono">{row.orig}</td>
                <td className="px-4 py-2 text-blue-700 font-semibold">{row.trans}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Certification block stub */}
      <div className="border-t border-dashed border-blue-300 bg-blue-50 px-5 py-3">
        <p className="text-[11px] font-bold text-blue-700 uppercase tracking-wider mb-1">📋 {t.cert}</p>
        <p className="text-[11px] text-blue-800 leading-relaxed italic">{t.certBody}</p>
        <div className="mt-2 flex items-center gap-4">
          <div className="h-px flex-1 border-b border-dashed border-blue-400" />
          <p className="text-[10px] text-blue-500">Signature · Date · Address</p>
          <div className="h-px flex-1 border-b border-dashed border-blue-400" />
        </div>
      </div>
    </div>
  )
}
