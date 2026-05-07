'use client'
import { useState } from 'react'
import Link from 'next/link'
import { track } from '@/components/analytics/Analytics'

const T = {
  en: {
    badge: 'Free Tool',
    title: 'USCIS Case Status Tracker',
    subtitle: 'Enter your receipt number below to check your immigration case status directly on the official USCIS website.',
    inputLabel: 'Receipt Number',
    inputPlaceholder: 'e.g. EAC2490123456',
    inputHint: 'Format: 3 letters + 10 digits. Found on Form I-797 Notice of Action.',
    checkBtn: 'Check Status on USCIS.gov →',
    checkBtnHint: 'Opens official USCIS portal in new tab',
    whatTitle: 'What receipt numbers look like',
    formCodes: [
      { code: 'EAC', form: 'I-131, I-765 (Vermont SC)', color: 'bg-blue-100 text-blue-800' },
      { code: 'WAC', form: 'I-131, I-765 (California SC)', color: 'bg-purple-100 text-purple-800' },
      { code: 'LIN', form: 'I-485, I-539 (Nebraska SC)', color: 'bg-green-100 text-green-800' },
      { code: 'MSC', form: 'I-131 (NBC)', color: 'bg-orange-100 text-orange-800' },
      { code: 'SRC', form: 'I-765 (Texas SC)', color: 'bg-pink-100 text-pink-800' },
      { code: 'IOE', form: 'Online filings', color: 'bg-gray-100 text-gray-800' },
    ],
    processingTimesTitle: 'Check official processing times',
    processingTimesDesc: 'Processing times change frequently. Always check the official USCIS tool — never rely on third-party estimates.',
    processingTimesBtn: 'Check Processing Times on USCIS.gov →',
    officialBtn: 'Go to USCIS Case Status Portal',
    officialNote: 'Always verify on the official USCIS website',
    alertsTitle: 'Get status update alerts',
    alertsDesc: 'USCIS does not send email alerts. Set a calendar reminder to check every 30 days.',
    calendarBtn: 'Set 30-day reminder',
    faqTitle: 'Common questions',
    faqs: [
      { q: 'Where do I find my receipt number?', a: 'On Form I-797 (Notice of Action) — the 13-character code at the top. Also in your USCIS online account if you filed online.' },
      { q: 'What does "Case Was Received" mean?', a: 'USCIS received your application. Processing has not started yet. This is normal and can last weeks to months.' },
      { q: 'What does "Request for Evidence (RFE)" mean?', a: 'USCIS needs more documents. You typically have 87 days to respond. Consult an attorney if you receive an RFE.' },
      { q: 'My status hasn\'t changed in months — what can I do?', a: 'Check USCIS processing times at uscis.gov/processing-times. If outside the published timeframe, you may submit an e-Request (service request) at uscis.gov/e-request.' },
    ],
    disclaimer: 'Messenginfo is not affiliated with USCIS. This tool simply formats your receipt number for the official USCIS portal. Not legal advice.',
    relatedTitle: 'Related tools',
  },
  uk: {
    badge: 'Безкоштовний інструмент',
    title: 'Перевірка статусу справи USCIS',
    subtitle: 'Введіть номер отримання нижче, щоб перевірити статус вашої імміграційної справи на офіційному сайті USCIS.',
    inputLabel: 'Номер отримання',
    inputPlaceholder: 'напр. EAC2490123456',
    inputHint: 'Формат: 3 літери + 10 цифр. Знаходиться у Form I-797.',
    checkBtn: 'Перевірити статус на USCIS.gov →',
    checkBtnHint: 'Відкриється офіційний портал USCIS в новій вкладці',
    whatTitle: 'Як виглядають номери отримань',
    formCodes: [
      { code: 'EAC', form: 'I-131, I-765 (Vermont SC)', color: 'bg-blue-100 text-blue-800' },
      { code: 'WAC', form: 'I-131, I-765 (California SC)', color: 'bg-purple-100 text-purple-800' },
      { code: 'LIN', form: 'I-485, I-539 (Nebraska SC)', color: 'bg-green-100 text-green-800' },
      { code: 'MSC', form: 'I-131 (NBC)', color: 'bg-orange-100 text-orange-800' },
      { code: 'SRC', form: 'I-765 (Texas SC)', color: 'bg-pink-100 text-pink-800' },
      { code: 'IOE', form: 'Онлайн-подачі', color: 'bg-gray-100 text-gray-800' },
    ],
    processingTimesTitle: 'Офіційні терміни розгляду',
    processingTimesDesc: 'Терміни часто змінюються. Завжди перевіряйте на офіційному інструменті USCIS — ніколи не покладайтесь на сторонні оцінки.',
    processingTimesBtn: 'Перевірити терміни на USCIS.gov →',
    officialBtn: 'Перейти на портал статусу справ USCIS',
    officialNote: 'Завжди перевіряйте на офіційному сайті USCIS',
    alertsTitle: 'Отримувати сповіщення про оновлення статусу',
    alertsDesc: 'USCIS не надсилає email-сповіщення. Встановіть нагадування в календарі кожні 30 днів.',
    calendarBtn: 'Встановити нагадування на 30 днів',
    faqTitle: 'Часті запитання',
    faqs: [
      { q: 'Де знайти номер отримання?', a: 'У Form I-797 (Notice of Action) — 13-символьний код вгорі. Також в особистому кабінеті USCIS, якщо ви подавали онлайн.' },
      { q: 'Що означає "Case Was Received"?', a: 'USCIS отримав вашу заяву. Розгляд ще не розпочався. Це нормально і може тривати тижні або місяці.' },
      { q: 'Що означає "Request for Evidence (RFE)"?', a: 'USCIS потребує додаткових документів. Зазвичай у вас є 87 днів для відповіді. Проконсультуйтесь з адвокатом.' },
      { q: 'Статус не змінювався місяцями — що робити?', a: 'Перевірте терміни розгляду на uscis.gov/processing-times. Якщо поза межами опублікованих термінів, подайте e-Request на uscis.gov/e-request.' },
    ],
    disclaimer: 'Messenginfo не пов\'язаний з USCIS. Цей інструмент лише форматує ваш номер для офіційного порталу USCIS. Не юридична консультація.',
    relatedTitle: 'Пов\'язані інструменти',
  },
  ru: {
    badge: 'Бесплатный инструмент',
    title: 'Проверка статуса дела USCIS',
    subtitle: 'Введите номер получения ниже, чтобы проверить статус вашего иммиграционного дела на официальном сайте USCIS.',
    inputLabel: 'Номер получения',
    inputPlaceholder: 'напр. EAC2490123456',
    inputHint: 'Формат: 3 буквы + 10 цифр. Находится в Form I-797.',
    checkBtn: 'Проверить статус на USCIS.gov →',
    checkBtnHint: 'Откроется официальный портал USCIS в новой вкладке',
    whatTitle: 'Как выглядят номера получений',
    formCodes: [
      { code: 'EAC', form: 'I-131, I-765 (Vermont SC)', color: 'bg-blue-100 text-blue-800' },
      { code: 'WAC', form: 'I-131, I-765 (California SC)', color: 'bg-purple-100 text-purple-800' },
      { code: 'LIN', form: 'I-485, I-539 (Nebraska SC)', color: 'bg-green-100 text-green-800' },
      { code: 'MSC', form: 'I-131 (NBC)', color: 'bg-orange-100 text-orange-800' },
      { code: 'SRC', form: 'I-765 (Texas SC)', color: 'bg-pink-100 text-pink-800' },
      { code: 'IOE', form: 'Онлайн-подачи', color: 'bg-gray-100 text-gray-800' },
    ],
    processingTimesTitle: 'Официальные сроки рассмотрения',
    processingTimesDesc: 'Сроки часто меняются. Всегда проверяйте на официальном инструменте USCIS — не полагайтесь на сторонние оценки.',
    processingTimesBtn: 'Проверить сроки на USCIS.gov →',
    officialBtn: 'Перейти на портал статусов дел USCIS',
    officialNote: 'Всегда проверяйте на официальном сайте USCIS',
    alertsTitle: 'Получать уведомления об обновлении статуса',
    alertsDesc: 'USCIS не отправляет email-уведомления. Установите напоминание в календаре каждые 30 дней.',
    calendarBtn: 'Установить напоминание на 30 дней',
    faqTitle: 'Частые вопросы',
    faqs: [
      { q: 'Где найти номер получения?', a: 'В Form I-797 (Notice of Action) — 13-символьный код вверху. Также в личном кабинете USCIS, если вы подавали онлайн.' },
      { q: 'Что означает "Case Was Received"?', a: 'USCIS получил вашу заявку. Рассмотрение ещё не начато. Это нормально и может длиться недели или месяцы.' },
      { q: 'Что означает "Request for Evidence (RFE)"?', a: 'USCIS требует дополнительных документов. Обычно у вас есть 87 дней для ответа. Проконсультируйтесь с адвокатом.' },
      { q: 'Статус не менялся месяцами — что делать?', a: 'Проверьте сроки рассмотрения на uscis.gov/processing-times. Если вне опубликованных сроков, подайте e-Request на uscis.gov/e-request.' },
    ],
    disclaimer: 'Messenginfo не связан с USCIS. Этот инструмент только форматирует ваш номер для официального портала USCIS. Не юридическая консультация.',
    relatedTitle: 'Связанные инструменты',
  },
  es: {
    badge: 'Herramienta Gratuita',
    title: 'Verificador de Estado de Caso USCIS',
    subtitle: 'Ingrese su número de recibo a continuación para verificar el estado de su caso migratorio directamente en el sitio web oficial de USCIS.',
    inputLabel: 'Número de Recibo',
    inputPlaceholder: 'ej. EAC2490123456',
    inputHint: 'Formato: 3 letras + 10 dígitos. Se encuentra en el Formulario I-797.',
    checkBtn: 'Verificar Estado en USCIS.gov →',
    checkBtnHint: 'Abre el portal oficial de USCIS en una nueva pestaña',
    whatTitle: 'Cómo se ven los números de recibo',
    formCodes: [
      { code: 'EAC', form: 'I-131, I-765 (Vermont SC)', color: 'bg-blue-100 text-blue-800' },
      { code: 'WAC', form: 'I-131, I-765 (California SC)', color: 'bg-purple-100 text-purple-800' },
      { code: 'LIN', form: 'I-485, I-539 (Nebraska SC)', color: 'bg-green-100 text-green-800' },
      { code: 'MSC', form: 'I-131 (NBC)', color: 'bg-orange-100 text-orange-800' },
      { code: 'SRC', form: 'I-765 (Texas SC)', color: 'bg-pink-100 text-pink-800' },
      { code: 'IOE', form: 'Presentaciones en línea', color: 'bg-gray-100 text-gray-800' },
    ],
    processingTimesTitle: 'Tiempos de procesamiento oficiales',
    processingTimesDesc: 'Los tiempos cambian con frecuencia. Siempre verifique en la herramienta oficial de USCIS — nunca confíe en estimaciones de terceros.',
    processingTimesBtn: 'Ver tiempos en USCIS.gov →',
    officialBtn: 'Ir al Portal de Estado de Casos de USCIS',
    officialNote: 'Siempre verifique en el sitio web oficial de USCIS',
    alertsTitle: 'Recibir alertas de actualización de estado',
    alertsDesc: 'USCIS no envía alertas por correo electrónico. Configure un recordatorio en su calendario cada 30 días.',
    calendarBtn: 'Establecer recordatorio de 30 días',
    faqTitle: 'Preguntas frecuentes',
    faqs: [
      { q: '¿Dónde encuentro mi número de recibo?', a: 'En el Formulario I-797 (Aviso de Acción) — el código de 13 caracteres en la parte superior. También en su cuenta en línea de USCIS si presentó en línea.' },
      { q: '¿Qué significa "Case Was Received"?', a: 'USCIS recibió su solicitud. El procesamiento aún no ha comenzado. Esto es normal y puede durar semanas o meses.' },
      { q: '¿Qué significa "Request for Evidence (RFE)"?', a: 'USCIS necesita más documentos. Generalmente tiene 87 días para responder. Consulte a un abogado si recibe un RFE.' },
      { q: 'Mi estado no ha cambiado en meses — ¿qué puedo hacer?', a: 'Verifique los tiempos de procesamiento en uscis.gov/processing-times. Si está fuera del marco de tiempo publicado, puede enviar un e-Request en uscis.gov/e-request.' },
    ],
    disclaimer: 'Messenginfo no está afiliado con USCIS. Esta herramienta simplemente formatea su número de recibo para el portal oficial de USCIS. No es asesoría legal.',
    relatedTitle: 'Herramientas relacionadas',
  },
}

function formatReceiptNumber(raw: string): string {
  return raw.toUpperCase().replace(/[^A-Z0-9]/g, '')
}

function isValidReceiptNumber(n: string): boolean {
  return /^[A-Z]{3}[0-9]{10}$/.test(n)
}

function buildUSCISUrl(receiptNumber: string): string {
  return `https://egov.uscis.gov/casestatus/mycasestatus.do?appReceiptNum=${receiptNumber}&caseStatusSearchBtn=CHECK+STATUS`
}

export function CaseStatusTracker({ locale }: { locale: string }) {
  const t = (T as Record<string, typeof T.en>)[locale] ?? T.en
  const [receipt, setReceipt] = useState('')
  const formatted = formatReceiptNumber(receipt)
  const valid = isValidReceiptNumber(formatted)

  function handleCheck() {
    if (!valid) return
    track('case_status_checked', { locale, prefix: formatted.slice(0, 3) })
    window.open(buildUSCISUrl(formatted), '_blank', 'noopener,noreferrer')
  }

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'WebApplication',
    name: 'USCIS Case Status Tracker',
    url: `https://messenginfo.com/${locale}/services/uscis-case-status`,
    description: 'Check USCIS immigration case status by receipt number',
    applicationCategory: 'GovernmentService',
    featureList: ['Receipt number validation', 'Direct USCIS portal link', 'Processing time reference'],
  }

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <div className="min-h-screen bg-[var(--surface-1)]">
        {/* Hero */}
        <div className="bg-gradient-to-br from-blue-700 to-blue-900 text-white py-14 px-4">
          <div className="max-w-2xl mx-auto text-center">
            <span className="inline-block bg-blue-500/40 border border-blue-400/40 rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide mb-4">
              {t.badge}
            </span>
            <h1 className="text-3xl md:text-4xl font-bold mb-4">{t.title}</h1>
            <p className="text-blue-100 text-[15px] leading-relaxed max-w-lg mx-auto">{t.subtitle}</p>
          </div>
        </div>

        <div className="max-w-2xl mx-auto px-4 py-10 space-y-8">

          {/* Main checker card */}
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-1)] p-6 shadow-sm">
            <label className="block text-[13px] font-semibold text-[var(--text-2)] uppercase tracking-wide mb-2">
              {t.inputLabel}
            </label>
            <div className="flex gap-3 mb-2">
              <input
                type="text"
                value={receipt}
                onChange={(e) => setReceipt(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleCheck() }}
                placeholder={t.inputPlaceholder}
                maxLength={15}
                className="flex-1 rounded-xl border border-[var(--border)] bg-[var(--surface-2)] px-4 py-3 text-[15px] font-mono text-[var(--text-1)] placeholder:text-[var(--text-3)] focus:outline-none focus:ring-2 focus:ring-blue-500 uppercase"
              />
              <button
                type="button"
                onClick={handleCheck}
                disabled={!valid}
                className="rounded-xl bg-blue-600 px-5 py-3 text-[14px] font-bold text-white hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors whitespace-nowrap"
              >
                Check →
              </button>
            </div>
            <p className="text-[12px] text-[var(--text-3)]">{t.inputHint}</p>
            {receipt.length > 0 && !valid && (
              <p className="text-[12px] text-amber-600 mt-1">
                ⚠ {formatted} — {formatted.length < 13 ? `${13 - formatted.length} more characters needed` : 'Invalid format'}
              </p>
            )}
            {valid && (
              <div className="mt-3 flex items-center gap-2">
                <span className="text-[12px] text-green-700 font-semibold">✓ Valid format:</span>
                <span className="font-mono text-[13px] text-green-800 bg-green-100 px-2 py-0.5 rounded">{formatted}</span>
              </div>
            )}

            <button
              type="button"
              onClick={handleCheck}
              disabled={!valid}
              className="mt-4 w-full rounded-xl bg-blue-600 px-5 py-3.5 text-[15px] font-bold text-white hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
            >
              {t.checkBtn}
            </button>
            <p className="text-center text-[11px] text-[var(--text-3)] mt-1">{t.checkBtnHint}</p>
          </div>

          {/* Receipt number codes */}
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-2)] p-5">
            <h2 className="text-[15px] font-bold text-[var(--text-1)] mb-3">{t.whatTitle}</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {t.formCodes.map((item: { code: string; form: string; color: string }) => (
                <div key={item.code} className="flex items-center gap-2 p-2 rounded-lg bg-[var(--surface-1)]">
                  <span className={`text-[12px] font-bold px-2 py-0.5 rounded ${item.color}`}>{item.code}</span>
                  <span className="text-[11px] text-[var(--text-2)]">{item.form}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Processing times — link to official USCIS tool, no hardcoded estimates */}
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
            <h2 className="text-[15px] font-bold text-amber-900 mb-2">⏱ {t.processingTimesTitle}</h2>
            <p className="text-[13px] text-amber-800 mb-4 leading-relaxed">{t.processingTimesDesc}</p>
            <a
              href="https://egov.uscis.gov/processing-times/"
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => track('uscis_processing_times_clicked', { locale })}
              className="inline-flex items-center gap-2 bg-amber-700 text-white px-5 py-2.5 rounded-xl font-bold text-[13px] hover:bg-amber-800 transition-colors"
            >
              {t.processingTimesBtn}
            </a>
          </div>

          {/* Official portal CTA */}
          <div className="rounded-2xl border-2 border-blue-200 bg-blue-50 p-5 text-center">
            <p className="text-[13px] text-blue-700 mb-3">{t.officialNote}</p>
            <a
              href="https://egov.uscis.gov/casestatus/landing.do"
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => track('uscis_portal_clicked', { locale })}
              className="inline-flex items-center gap-2 bg-blue-700 text-white px-6 py-3 rounded-xl font-bold text-[14px] hover:bg-blue-800 transition-colors"
            >
              {t.officialBtn} ↗
            </a>
          </div>

          {/* FAQ */}
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-1)] p-5">
            <h2 className="text-[15px] font-bold text-[var(--text-1)] mb-4">{t.faqTitle}</h2>
            <div className="space-y-4">
              {t.faqs.map((faq: { q: string; a: string }) => (
                <div key={faq.q}>
                  <p className="text-[14px] font-semibold text-[var(--text-1)] mb-1">❓ {faq.q}</p>
                  <p className="text-[13px] text-[var(--text-2)] leading-relaxed">{faq.a}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Related tools */}
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-2)] p-5">
            <h2 className="text-[15px] font-bold text-[var(--text-1)] mb-3">{t.relatedTitle}</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {[
                { href: `/${locale}/services/translate-document`, icon: '📄', label: locale === 'uk' ? 'Переклад документів' : locale === 'ru' ? 'Перевод документов' : locale === 'es' ? 'Traducción de documentos' : 'Document Translation' },
                { href: `/${locale}/services/re-parole-u4u`, icon: '🛡', label: locale === 'uk' ? 'Re-Parole U4U' : 'Re-Parole U4U' },
                { href: `/${locale}/services/ead-work-permit`, icon: '💼', label: locale === 'uk' ? 'EAD Дозвіл на роботу' : locale === 'ru' ? 'EAD Разрешение на работу' : locale === 'es' ? 'Permiso de Trabajo EAD' : 'EAD Work Permit' },
                { href: `/${locale}/services/tps-status`, icon: '🔒', label: 'TPS Ukraine Status' },
              ].map((link) => (
                <Link key={link.href} href={link.href}
                  className="flex items-center gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface-1)] px-4 py-3 text-[14px] font-semibold text-[var(--text-1)] hover:border-blue-400 hover:bg-blue-50 transition-all">
                  <span className="text-xl">{link.icon}</span>{link.label}
                </Link>
              ))}
            </div>
          </div>

          {/* Disclaimer */}
          <p className="text-[11px] text-[var(--text-3)] text-center leading-relaxed pb-4">{t.disclaimer}</p>
        </div>
      </div>
    </>
  )
}
