'use client'

/**
 * TranslateWizard — Ukrainian document translation flow for USCIS-style submission.
 *
 * Faithful port of the owner-provided prototype (navy + gold premium design,
 * 7-screen flow, doc-type-FIRST, processing-with-real-OCR, preview-BEFORE-pay
 * per v5 §21, side-by-side translation, watermarked certificate preview).
 *
 * Backend kept identical to the previous wizard so deployed routes still work:
 *   /api/translation/vision-extract  — REAL docintel.readDocument (Gemini + KMU-55)
 *   /api/stripe/checkout            — real Stripe checkout (basic plan = $14.99)
 *   /api/translation/generate-pdf   — Stripe-verified PDF generation (payment gate)
 *
 * CSS is fully scoped under `.tw-root` so the prototype's body/header/h1 rules
 * never bleed into the rest of the site.
 */

import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, useSearchParams } from 'next/navigation'

// ─── Types ────────────────────────────────────────────────────────────────────
type Screen = 1 | 2 | 3 | 4 | 5 | 6 | 7
type DocTypeChoice =
  | 'passport_internal'
  | 'passport_foreign'
  | 'birth'
  | 'marriage'
  | 'id_card'
  | 'other'
type Locale = 'en' | 'uk' | 'ru' | 'es'

interface DocTypeMeta {
  id: DocTypeChoice
  icon: string
  popular?: boolean
  /** Whether docintel has a validated module — drives auto-vs-manual routing. */
  auto: boolean
  /** docintel registry id (lib/docintel/documentRegistry.ts). */
  registryId: string | null
}

const DOC_TYPES: DocTypeMeta[] = [
  { id: 'passport_internal', icon: '🇺🇦', popular: true, auto: true,  registryId: 'ua_internal_passport_booklet' },
  { id: 'passport_foreign',  icon: '✈️',                  auto: true,  registryId: 'ua_international_passport' },
  { id: 'birth',             icon: '👶',                  auto: false, registryId: 'ua_birth_certificate' },
  { id: 'marriage',          icon: '💍',                  auto: false, registryId: 'ua_marriage_certificate' },
  { id: 'id_card',           icon: '💳',                  auto: true,  registryId: 'ua_id_card' },
  { id: 'other',             icon: '📄',                  auto: false, registryId: null },
]

interface ExtractedField {
  field: string
  value: string | null
  raw_cyrillic: string | null
  confidence: number
  kind: string
}

interface DraftState {
  screen: Screen
  selectedDocType: DocTypeChoice | null
  extractedFields: ExtractedField[]
  // file is intentionally NOT persisted (cannot serialize a Blob)
}

const DRAFT_KEY = 'tw:v2:draft'

// ─── i18n (RU primary — prototype's language; EN/UK/ES kept short and accurate) ──
const T = {
  ru: {
    badge: '🔒 Безопасно',
    legal: 'Мы не являемся адвокатами. Услуга — информационная помощь по 8 CFR §103.2(b)(3).',
    back: '← Назад',
    next: 'Далее →',
    // Screen 1 — Welcome
    s1_title_1: 'Перевод', s1_title_2: 'документов',
    s1_subtitle: 'Загрузите фото документа — мы переведём на английский и оформим официальный сертификат для USCIS',
    s1_card_time_t: '5–10 минут', s1_card_time_s: 'Для паспорта Украины',
    s1_card_format_t: 'Официальный формат USCIS', s1_card_format_s: 'Сертификация по 8 CFR §103.2(b)(3)',
    s1_card_seefirst_t: 'Сначала видите — потом платите', s1_card_seefirst_s: 'Оплата только после проверки перевода',
    s1_cta: 'Начать перевод →',
    s1_secure: 'Ваши документы в безопасности.',
    s1_secure_s: 'Мы не храним оригиналы после обработки. Всё зашифровано.',
    // Screen 2 — Doc type
    s2_title_1: 'Какой документ', s2_title_2: 'нужно перевести?',
    s2_subtitle: 'Выберите один документ',
    s2_popular: 'Самый частый',
    s2_manual_note: 'Этот тип документа обработает наш специалист. Срок: 1–2 рабочих дня. Цена та же — $14.99.',
    doc: {
      passport_internal: { name: 'Паспорт Украины', hint: 'Внутренний, книжка' },
      passport_foreign:  { name: 'Загранпаспорт',   hint: 'Биометрический' },
      birth:             { name: 'Свидетельство о рождении', hint: '' },
      marriage:          { name: 'О браке / разводе', hint: '' },
      id_card:           { name: 'ID-карта',         hint: 'Пластиковая карта' },
      other:             { name: 'Другой документ',  hint: 'Водительские права и др.' },
    },
    // Screen 3 — Upload
    s3_title_1: 'Загрузите', s3_title_2: 'документ',
    s3_subtitle: 'Сфотографируйте или загрузите файл. Нужны все страницы с данными.',
    s3_drop_main: 'Нажмите чтобы загрузить',
    s3_drop_sub: 'Принимаем: JPG, PNG\nМакс. размер: 10 МБ',
    s3_camera: '📷 Сфотографировать',
    s3_file: '📂 Выбрать файл',
    s3_tip_t: 'Советы для хорошего фото:',
    s3_tip_b: 'снимайте при дневном свете, держите телефон ровно, все буквы должны быть чёткими.',
    s3_cta: 'Распознать документ →',
    // Screen 4 — Processing
    s4_title_1: 'AI читает', s4_title_2: 'ваш документ...',
    s4_subtitle: 'Пожалуйста, подождите. Это займёт несколько секунд.',
    s4_steps: [
      'Проверяем качество изображения',
      'Распознаём текст (OCR)',
      'Определяем поля документа',
      'Переводим на английский',
      'Формируем сертификат',
    ],
    // Screen 5 — Preview
    s5_title: 'Перевод готов!',
    s5_subtitle: 'Проверьте данные. Если всё верно — оплатите и скачайте PDF.',
    s5_col_orig: '🇺🇦 Оригинал',
    s5_col_trans: '🇺🇸 Перевод',
    s5_mismatch: 'Данные не совпадают?',
    s5_reupload: 'Загрузить другое фото',
    s5_sample_badge: '📄 ОБРАЗЕЦ ПЕРЕВОДА',
    s5_cert_intro: 'I, the undersigned, hereby certify that I am competent in Ukrainian and English languages, and that the above is a true and accurate translation of the Ukrainian document.',
    s5_cta: 'Оплатить и получить PDF — $14.99 →',
    s5_payment_note: 'Оплата через Stripe. Безопасно. После оплаты вы сразу скачаете PDF.',
    s5_no_fields: 'Извлечённых полей нет — мы переведём документ вручную после оплаты (1–2 рабочих дня).',
    s5_extraction_error: 'Не удалось распознать автоматически. После оплаты документ обработает наш специалист.',
    // Screen 6 — Payment
    s6_title: 'Оплата',
    s6_subtitle: 'Один платёж — получите официальный PDF-перевод с сертификатом',
    s6_price_sub: 'Единый тариф, без скрытых платежей',
    s6_features: [
      'Официальный PDF-перевод с сертификатом',
      'Сертификация по 8 CFR §103.2(b)(3) — для подачи в USCIS',
      'Цифровая подпись прямо в браузере',
      'PDF отправим на email (и можно скачать сразу)',
      'Бесплатные исправления в течение 7 дней',
    ],
    s6_cta: '💳 Оплатить $14.99',
    s6_cta_loading: '⏳ Переход к Stripe…',
    s6_stripe: 'Оплата через Stripe — мировой лидер платёжных систем. Ваша карта в безопасности. Мы не видим и не храним данные карты.',
    s6_terms: 'Нажимая «Оплатить», вы соглашаетесь с условиями использования. Возврат в течение 7 дней если результат неверный.',
    // Screen 7 — Success
    s7_title: 'Готово!',
    s7_subtitle: 'Ваш официальный перевод оформлен и готов к подаче в USCIS',
    s7_pdf_title: '📄 Ваш перевод',
    s7_pdf_sub: 'Файл также отправлен на ваш email',
    s7_download: '⬇️ Скачать PDF',
    s7_downloading: '⏳ Готовим PDF…',
    s7_downloaded: '✅ PDF скачан!',
    s7_sig_title: '✏️ Подпишите документ',
    s7_sig_sub: 'Нарисуйте подпись переводчика (ваша подпись как заявителя)',
    s7_sig_clear: 'Очистить',
    s7_sig_save: 'Подтвердить подпись ✓',
    s7_sig_saved: '✅ Подпись сохранена',
    s7_next_title: '📋 Что делать дальше?',
    s7_next_steps: [
      'Распечатайте PDF (цветной принтер не нужен)',
      'Вложите в пакет документов для USCIS',
      'Если нужна помощь — свяжитесь с нами',
    ],
    s7_restart: '← Перевести ещё один документ',
    progress: ['Тип', 'Фото', 'Анализ', 'Проверка', 'Оплата', 'Готово'] as string[],
  },
}

// Other locales: thin overrides; if a key is missing, falls back to RU.
const T_OVERRIDES: Partial<Record<Locale, Partial<typeof T.ru>>> = {
  en: {
    badge: '🔒 Secure',
    legal: 'We are not attorneys. Service is informational assistance per 8 CFR §103.2(b)(3).',
    back: '← Back',
    next: 'Next →',
    s1_title_1: 'Document', s1_title_2: 'translation',
    s1_subtitle: 'Upload a photo — we translate to English and issue an official USCIS-style certification.',
    s1_card_time_t: '5–10 minutes', s1_card_time_s: 'For a Ukrainian passport',
    s1_card_format_t: 'USCIS-style format', s1_card_format_s: 'Certification per 8 CFR §103.2(b)(3)',
    s1_card_seefirst_t: 'See first, then pay', s1_card_seefirst_s: 'Payment only after you verify the translation',
    s1_cta: 'Start translation →',
    s1_secure: 'Your documents are safe.',
    s1_secure_s: 'We do not retain originals after processing. Everything is encrypted.',
    s2_title_1: 'Which document', s2_title_2: 'do you need translated?',
    s2_subtitle: 'Pick one document',
    s2_popular: 'Most common',
    s2_manual_note: 'This document type will be processed by our specialist. Turnaround: 1–2 business days. Same price: $14.99.',
    doc: {
      passport_internal: { name: 'Ukrainian Passport', hint: 'Internal, booklet' },
      passport_foreign:  { name: 'International Passport', hint: 'Biometric' },
      birth:             { name: 'Birth Certificate', hint: '' },
      marriage:          { name: 'Marriage / Divorce', hint: '' },
      id_card:           { name: 'ID Card', hint: 'Plastic card' },
      other:             { name: 'Other Document', hint: "Driver's license, etc." },
    },
    s3_title_1: 'Upload', s3_title_2: 'your document',
    s3_subtitle: 'Take a photo or upload a file. Include every page with data.',
    s3_drop_main: 'Tap to upload',
    s3_drop_sub: 'Accepts: JPG, PNG\nMax size: 10 MB',
    s3_camera: '📷 Take a photo',
    s3_file: '📂 Choose file',
    s3_tip_t: 'Tips for a good photo:',
    s3_tip_b: 'shoot in daylight, hold the phone level, every letter must be sharp.',
    s3_cta: 'Recognize document →',
    s4_title_1: 'AI is reading', s4_title_2: 'your document…',
    s4_subtitle: 'Please wait. This takes a few seconds.',
    s4_steps: [
      'Checking image quality',
      'Recognising text (OCR)',
      'Identifying document fields',
      'Translating to English',
      'Building certificate',
    ],
    s5_title: 'Translation ready!',
    s5_subtitle: 'Review the data. If everything is correct, pay and download the PDF.',
    s5_col_orig: '🇺🇦 Original',
    s5_col_trans: '🇺🇸 Translation',
    s5_mismatch: 'Data does not match?',
    s5_reupload: 'Upload a different photo',
    s5_sample_badge: '📄 SAMPLE TRANSLATION',
    s5_cta: 'Pay and get PDF — $14.99 →',
    s5_payment_note: 'Payment via Stripe. Secure. PDF available immediately after payment.',
    s5_no_fields: 'No fields extracted — we will translate manually after payment (1–2 business days).',
    s5_extraction_error: 'Could not auto-recognize. Our specialist will process the document after payment.',
    s6_title: 'Payment',
    s6_subtitle: 'One payment — receive an official translated PDF with certification',
    s6_price_sub: 'Single tariff, no hidden fees',
    s6_features: [
      'Official PDF translation with certification',
      'Certification per 8 CFR §103.2(b)(3) — formatted for USCIS submission',
      'Digital signature right in your browser',
      'PDF sent to your email (and downloadable immediately)',
      'Free corrections within 7 days',
    ],
    s6_cta: '💳 Pay $14.99',
    s6_cta_loading: '⏳ Redirecting to Stripe…',
    s6_stripe: 'Payment via Stripe — global leader in payment systems. Your card is safe. We never see or store card data.',
    s6_terms: 'By clicking «Pay» you agree to the terms. Refund within 7 days if the result is incorrect.',
    s7_title: 'Done!',
    s7_subtitle: 'Your official translation is prepared and ready to file with USCIS',
    s7_pdf_title: '📄 Your translation',
    s7_pdf_sub: 'The file was also sent to your email',
    s7_download: '⬇️ Download PDF',
    s7_downloading: '⏳ Preparing PDF…',
    s7_downloaded: '✅ PDF downloaded!',
    s7_sig_title: '✏️ Sign the document',
    s7_sig_sub: 'Draw the translator signature (your signature as the applicant)',
    s7_sig_clear: 'Clear',
    s7_sig_save: 'Confirm signature ✓',
    s7_sig_saved: '✅ Signature saved',
    s7_next_title: '📋 What next?',
    s7_next_steps: [
      'Print the PDF (color printer not required)',
      'Add it to your USCIS document package',
      'Need help — contact us',
    ],
    s7_restart: '← Translate another document',
    progress: ['Type', 'Photo', 'Analyse', 'Review', 'Pay', 'Done'],
  },
}

function getT(locale: Locale) {
  const base = T.ru
  const ov = T_OVERRIDES[locale] ?? {}
  return { ...base, ...ov, doc: { ...base.doc, ...(ov as any).doc } } as typeof T.ru
}

// ─── Sample translation data — used ONLY when extractedFields is empty
// (manual-review document types, or auto-extract failure on free-tier). It is
// labeled as «ОБРАЗЕЦ» in the cert preview so the user is never misled. ──
const SAMPLE_ROWS: Record<DocTypeChoice, Array<{ ukr: string; val_ukr: string; val_eng: string }>> = {
  passport_internal: [
    { ukr: 'Прізвище', val_ukr: 'ПРИКЛАД', val_eng: 'SAMPLE' },
    { ukr: "Ім'я",      val_ukr: '—',       val_eng: '—' },
    { ukr: 'По батькові', val_ukr: '—',     val_eng: '—' },
    { ukr: 'Дата народження', val_ukr: '—', val_eng: '—' },
    { ukr: 'Місце народження', val_ukr: '—', val_eng: '—' },
  ],
  passport_foreign:  [{ ukr: 'Surname', val_ukr: '—', val_eng: '—' }],
  birth:             [{ ukr: 'Прізвище', val_ukr: '—', val_eng: '—' }],
  marriage:          [{ ukr: 'Подружжя', val_ukr: '—', val_eng: '—' }],
  id_card:           [{ ukr: 'Прізвище', val_ukr: '—', val_eng: '—' }],
  other:             [{ ukr: 'Документ', val_ukr: '—', val_eng: '—' }],
}

const CERT_TITLES_EN: Record<DocTypeChoice, string> = {
  passport_internal: 'TRANSLATION OF UKRAINIAN INTERNAL PASSPORT',
  passport_foreign:  'TRANSLATION OF UKRAINIAN INTERNATIONAL PASSPORT',
  birth:             'TRANSLATION OF UKRAINIAN BIRTH CERTIFICATE',
  marriage:          'TRANSLATION OF UKRAINIAN MARRIAGE CERTIFICATE',
  id_card:           'TRANSLATION OF UKRAINIAN IDENTITY CARD',
  other:             'TRANSLATION OF UKRAINIAN DOCUMENT',
}

// Map docintel field ids to Ukrainian labels on the booklet identity page.
const UKR_LABEL_BY_FIELD: Record<string, string> = {
  family_name: 'Прізвище',
  given_name: "Ім'я",
  middle_name: 'По батькові',
  dob: 'Дата народження',
  city_of_birth: 'Місце народження',
  province_of_birth: 'Область',
}

function fmtScreenStep(screen: Screen): number {
  // Map screen index to 0-based progress step (welcome has no progress).
  return { 1: -1, 2: 0, 3: 1, 4: 2, 5: 3, 6: 4, 7: 5 }[screen]
}

// ─── CSS — TPS design system (scoped under .tw-root) ──────────────────────────
// Same tokens TPSWizardV2 reads (`var(--accent)`, `var(--surface-1)`, Inter
// font, 14px radius, 48px button tap targets, light theme). Prototype's flow +
// structure preserved; only the visual language is now TPS-identical so users
// who came from TPS recognize the wizard instantly.
const WIZARD_CSS = `
.tw-root {
  font-family: var(--font-inter), 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
  background: var(--background, #faf9f7);
  color: var(--text-1, #1a1714);
  min-height: 100vh;
  font-size: 17px;
  line-height: 1.6;
  -webkit-font-smoothing: antialiased;

  /* TPS-aligned brand tokens (the same globals TPSWizardV2 reads) */
  --acc: var(--accent, #10a37f);
  --acc-h: var(--accent-hover, #0e8f70);
  --acc-l: var(--accent-light, #e6f4ed);

  /* Legacy var names from the prototype, re-aliased so all existing JSX
     inline styles (color:'var(--gold)', etc.) automatically render TPS green. */
  --gold: var(--accent, #10a37f);
  --gold-light: var(--accent-hover, #0e8f70);
  --green: var(--accent, #10a37f);
  --green-light: var(--accent-hover, #0e8f70);
  --blue: #2563eb;
  --red: var(--error-border, #d33);
  --navy: var(--text-1, #1a1714);
  --navy2: var(--surface-1, #fff);
  --navy3: var(--surface-2, #f3f4f6);
  --text: var(--text-1, #1a1714);
  --text-muted: var(--text-3, #6b7280);
  --border: var(--border, #e5e7eb);
  --card: var(--surface-1, #fff);

  --warn-bg: var(--warning-bg, #fff3cd);
  --warn-bd: var(--warning-border, #ffc107);
  --warn-tx: var(--warning-text, #856404);

  --info-bg: var(--info-bg, #eff6ff);
  --info-bd: var(--info-border, #a8c7fa);
  --info-tx: var(--info-text, #1d4ed8);

  --radius: 14px;
  --shadow: 0 1px 4px rgba(0,0,0,.05);
}
.tw-root *, .tw-root *::before, .tw-root *::after { box-sizing: border-box; }

/* Header — TPS card-on-light */
.tw-header {
  background: var(--card);
  border-bottom: 1px solid var(--border);
  padding: 14px 20px;
  display: flex; align-items: center; gap: 12px;
  position: sticky; top: 0; z-index: 100;
}
.tw-logo { font-size: 20px; color: var(--acc); font-weight: 800; }
.tw-logo span { color: var(--text); }
.tw-header-badge {
  margin-left: auto; background: var(--acc-l);
  border: 1px solid var(--acc); color: var(--acc);
  padding: 4px 12px; border-radius: 20px; font-size: 13px; font-weight: 700;
}

/* Progress bar — minimal dots + lines on light bg */
.tw-progress-bar { background: var(--background, #faf9f7); padding: 14px 20px; border-bottom: 1px solid var(--border); }
.tw-progress-steps { display: flex; align-items: flex-start; max-width: 760px; margin: 0 auto; gap: 0; }
.tw-step-wrap { display: flex; flex-direction: column; align-items: center; flex: 0 0 auto; }
.tw-step-dot {
  width: 32px; height: 32px; border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  font-weight: 800; font-size: 14px;
  background: var(--card); color: var(--text-muted);
  border: 2px solid var(--border);
  transition: all 0.3s;
}
.tw-step-dot.done { background: var(--acc); color: #fff; border-color: var(--acc); }
.tw-step-dot.active { background: var(--acc); color: #fff; border-color: var(--acc); box-shadow: 0 0 0 4px var(--acc-l); }
.tw-step-dot.pending { background: var(--card); color: var(--text-muted); border-color: var(--border); }
.tw-step-line { flex: 1; height: 2px; background: var(--border); margin: 16px -1px 0; align-self: flex-start; transition: background 0.3s; }
.tw-step-line.done { background: var(--acc); }
.tw-step-label { font-size: 11px; color: var(--text-muted); text-align: center; margin-top: 4px; font-weight: 700; letter-spacing: 0.5px; text-transform: uppercase; }
.tw-step-label.active-label { color: var(--acc); }

.tw-main { max-width: 760px; margin: 0 auto; padding: 24px 16px 60px; }
.tw-screen { display: none; }
.tw-screen.tw-active { display: block; animation: tw-fadeUp 0.3s ease; }
@keyframes tw-fadeUp { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }

/* Typography — Inter, TPS hierarchy: 28 / 20 / 17 */
.tw-h1 { font-family: inherit; font-size: 28px; font-weight: 800; line-height: 1.2; margin: 0 0 8px; color: var(--text); }
.tw-h2 { font-family: inherit; font-size: 20px; font-weight: 800; margin: 0 0 10px; color: var(--text); }
.tw-subtitle { color: var(--text-muted); font-size: 17px; margin-bottom: 24px; line-height: 1.55; }
.tw-gold { color: var(--acc); }

/* Card — TPS-identical: white, light border, subtle shadow */
.tw-card {
  background: var(--card);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 16px;
  margin-bottom: 12px;
  box-shadow: var(--shadow);
}

/* Doc-type tiles — TPS-style: white card, 2.5px border, green active */
.tw-doc-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-top: 16px; margin-bottom: 16px; }
.tw-doc-tile {
  background: var(--card);
  border: 2.5px solid var(--border);
  border-radius: var(--radius);
  padding: 16px 12px; text-align: center; cursor: pointer; transition: all 0.15s;
  display: flex; flex-direction: column; align-items: center; gap: 8px;
  min-height: 130px; justify-content: center;
  color: var(--text); font-family: inherit;
  box-shadow: var(--shadow);
}
.tw-doc-tile:hover { border-color: var(--acc); }
.tw-doc-tile.tw-selected { border-color: var(--acc); background: var(--acc-l); }
.tw-doc-tile.popular { border-color: var(--acc); }
.tw-doc-icon { font-size: 36px; }
.tw-doc-name { font-weight: 800; font-size: 15px; line-height: 1.3; color: var(--text); }
.tw-doc-hint { font-size: 13px; color: var(--text-muted); }
.tw-popular-badge { background: var(--acc); color: #fff; font-size: 11px; font-weight: 800; padding: 2px 10px; border-radius: 12px; text-transform: uppercase; letter-spacing: 0.5px; }

/* Upload zone — TPS UploadDrop: 2.5px dashed, white bg, hover green */
.tw-upload-zone {
  border: 2.5px dashed var(--border);
  border-radius: var(--radius);
  padding: 28px 20px; text-align: center; cursor: pointer; transition: all 0.15s;
  background: var(--card); margin-bottom: 12px; display: block;
}
.tw-upload-zone:hover, .tw-upload-zone.tw-dragging { border-color: var(--acc); background: var(--acc-l); }
.tw-upload-icon { font-size: 44px; margin-bottom: 10px; }
.tw-upload-main { font-size: 17px; font-weight: 800; margin-bottom: 4px; color: var(--text); }
.tw-upload-sub { color: var(--text-muted); font-size: 14px; white-space: pre-line; }

.tw-upload-btns { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
.tw-btn-upload {
  padding: 12px 10px; border-radius: 10px;
  font-size: 15px; font-weight: 700;
  cursor: pointer; border: 1.5px solid var(--border);
  background: var(--card); color: var(--text);
  display: flex; align-items: center; justify-content: center;
  gap: 6px; transition: all 0.15s; min-height: 48px; font-family: inherit;
}
.tw-btn-upload:hover { border-color: var(--acc); color: var(--acc); }
.tw-btn-camera { background: var(--card); color: var(--text); }
.tw-btn-camera:hover { border-color: var(--acc); color: var(--acc); }
.tw-btn-file { background: var(--card); color: var(--text); }
.tw-btn-file:hover { border-color: var(--acc); color: var(--acc); }

.tw-preview-img { width: 100%; border-radius: 12px; border: 1px solid var(--border); margin-bottom: 12px; max-height: 280px; object-fit: cover; display: block; }

/* Primary button — TPS navBtn(forward): green, 18px, 800 weight, 48px tap */
.tw-btn-primary {
  display: block; width: 100%;
  background: var(--acc); color: #fff;
  border: none; border-radius: var(--radius);
  padding: 16px; min-height: 48px;
  font-size: 18px; font-weight: 800; cursor: pointer;
  transition: all 0.15s; text-align: center;
  font-family: inherit;
}
.tw-btn-primary:hover:not(:disabled) { background: var(--acc-h); }
.tw-btn-primary:disabled { opacity: 0.4; cursor: not-allowed; }
.tw-btn-primary:focus-visible { outline: 3px solid var(--acc); outline-offset: 2px; }

/* Secondary — outlined, gray text on white */
.tw-btn-secondary {
  display: block; width: 100%;
  background: var(--card); color: var(--text-muted);
  border: 1.5px solid var(--border); border-radius: var(--radius);
  padding: 14px; min-height: 48px;
  font-size: 17px; font-weight: 700; cursor: pointer;
  transition: all 0.15s; text-align: center; margin-top: 10px;
  font-family: inherit;
}
.tw-btn-secondary:hover { border-color: var(--acc); color: var(--acc); }

/* Green variant — same as primary in TPS land (no separate green) */
.tw-btn-green { background: var(--acc); color: #fff; }
.tw-btn-green:hover:not(:disabled) { background: var(--acc-h); }

/* Back link — small grey, hover green */
.tw-back-btn {
  background: none; border: none; color: var(--text-muted);
  font-size: 14px; cursor: pointer; padding: 6px 0; margin-bottom: 12px;
  display: inline-flex; align-items: center; gap: 4px; font-family: inherit;
  transition: color 0.15s; min-height: 32px; font-weight: 700;
}
.tw-back-btn:hover { color: var(--acc); }

/* Processing — green spinner on light bg */
.tw-processing { text-align: center; padding: 16px 0; }
.tw-ai-spinner {
  width: 64px; height: 64px;
  border: 4px solid var(--border);
  border-top: 4px solid var(--acc);
  border-radius: 50%; animation: tw-spin 1s linear infinite;
  margin: 0 auto 20px;
}
@keyframes tw-spin { to { transform: rotate(360deg); } }
.tw-proc-steps { text-align: left; margin-top: 20px; }
.tw-proc-step {
  display: flex; align-items: center; gap: 12px;
  padding: 12px 0; border-bottom: 1px solid var(--border);
  font-size: 16px; opacity: 0.45; transition: opacity 0.4s;
  color: var(--text);
}
.tw-proc-step:last-child { border-bottom: none; }
.tw-proc-step.tw-active, .tw-proc-step.tw-done { opacity: 1; }
.tw-proc-icon { font-size: 22px; flex-shrink: 0; width: 28px; text-align: center; }
.tw-proc-spinner {
  width: 18px; height: 18px;
  border: 2px solid var(--border);
  border-top: 2px solid var(--acc);
  border-radius: 50%; animation: tw-spin 0.8s linear infinite;
  flex-shrink: 0; margin-left: 5px;
}

/* Translation table — TPS-style review row layout, light cards */
.tw-trans-header { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 10px; }
.tw-trans-col-label {
  font-size: 12px; font-weight: 800; letter-spacing: 0.8px; text-transform: uppercase;
  padding: 8px 14px; border-radius: 10px; text-align: center;
}
.tw-col-orig { background: var(--info-bg); color: var(--info-tx); border: 1px solid var(--info-bd); }
.tw-col-trans { background: var(--acc-l); color: var(--acc); border: 1px solid var(--acc); }
.tw-trans-row { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 8px; animation: tw-fadeUp 0.3s ease forwards; opacity: 0; }
.tw-trans-cell {
  background: var(--card);
  border: 1px solid var(--border);
  border-radius: 10px; padding: 12px 14px;
}
.tw-trans-cell.translated { background: var(--acc-l); border-color: var(--acc); }
.tw-trans-label { font-size: 12px; color: var(--text-muted); font-weight: 700; margin-bottom: 3px; text-transform: uppercase; letter-spacing: 0.5px; }
.tw-trans-value { font-size: 16px; font-weight: 700; color: var(--text); word-break: break-word; }
.tw-trans-cell.translated .tw-trans-value { color: var(--acc); }

/* Cert preview — KEEP white (paper document mockup, theme-independent) */
.tw-cert-preview {
  background: #fff; color: #1a1a2e;
  border-radius: 14px; padding: 20px;
  margin: 20px 0; font-size: 14px; line-height: 1.6;
  border: 2px solid var(--acc); position: relative; overflow: hidden;
}
.tw-cert-badge {
  position: absolute; top: -12px; left: 16px;
  background: var(--acc); color: #fff;
  font-size: 11px; font-weight: 800; padding: 3px 10px; border-radius: 12px; letter-spacing: 0.5px;
}
.tw-cert-title { font-weight: 900; font-size: 15px; text-align: center; margin-bottom: 10px; color: #1a1a2e; }
.tw-cert-field { display: flex; justify-content: space-between; padding: 5px 0; border-bottom: 1px solid #e5e7eb; gap: 12px; }
.tw-cert-key { color: #6b7280; font-size: 13px; }
.tw-cert-val { font-weight: 700; font-size: 13px; text-align: right; color: #1a1a2e; }
.tw-cert-cert { margin-top: 12px; font-size: 12px; color: #4b5563; line-height: 1.5; }
.tw-watermark {
  position: absolute; top: 50%; left: 50%;
  transform: translate(-50%, -50%) rotate(-30deg);
  font-size: 28px; font-weight: 900;
  color: rgba(16,163,127,0.08);
  white-space: nowrap; pointer-events: none; letter-spacing: 4px;
}

/* Price tag — light green */
.tw-price-tag {
  text-align: center; padding: 24px 16px;
  background: var(--acc-l);
  border: 2px solid var(--acc);
  border-radius: var(--radius); margin-bottom: 16px;
}
.tw-price-amount { font-size: 48px; color: var(--acc); font-weight: 800; line-height: 1; font-family: inherit; }
.tw-price-sub { color: var(--text-muted); font-size: 15px; margin-top: 6px; }

.tw-features-list { margin: 16px 0; }
.tw-feature-item {
  display: flex; align-items: center; gap: 12px;
  padding: 10px 0; font-size: 16px;
  border-bottom: 1px solid var(--border);
  color: var(--text);
}
.tw-feature-item:last-child { border-bottom: none; }
.tw-feature-icon { font-size: 20px; flex-shrink: 0; }

.tw-trust-badges { display: flex; gap: 8px; flex-wrap: wrap; margin: 12px 0; }
.tw-trust-badge {
  background: var(--acc-l); border: 1px solid var(--acc);
  color: var(--acc); padding: 6px 12px; border-radius: 20px;
  font-size: 12px; font-weight: 700;
  display: flex; align-items: center; gap: 4px;
}

.tw-success-icon {
  width: 88px; height: 88px;
  background: var(--acc-l);
  border: 3px solid var(--acc);
  border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  font-size: 44px; margin: 0 auto 20px;
  animation: tw-pop 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275);
}
@keyframes tw-pop { from { transform: scale(0.5); opacity: 0; } to { transform: scale(1); opacity: 1; } }

.tw-reassurance {
  background: var(--info-bg);
  border: 1px solid var(--info-bd);
  border-radius: 12px; padding: 14px;
  margin-top: 12px;
  display: flex; gap: 10px; align-items: flex-start;
}
.tw-reassurance-icon { font-size: 20px; flex-shrink: 0; margin-top: 2px; }
.tw-reassurance-text { font-size: 14px; color: var(--info-tx); line-height: 1.5; }
.tw-reassurance-text strong { color: var(--info-tx); }

.tw-legal-note { font-size: 13px; color: var(--text-muted); text-align: center; padding: 14px 0; line-height: 1.6; }

.tw-confirm-edit {
  background: var(--warn-bg);
  border: 1px solid var(--warn-bd);
  border-radius: 10px; padding: 10px 14px;
  font-size: 14px; color: var(--warn-tx);
  margin-top: 10px;
  display: flex; gap: 10px; align-items: center; flex-wrap: wrap;
}
.tw-edit-btn {
  background: var(--card); border: 1px solid var(--border);
  color: var(--text); border-radius: 8px;
  padding: 6px 12px; font-size: 13px; cursor: pointer;
  font-family: inherit; transition: all 0.15s; min-height: 36px; font-weight: 700;
}
.tw-edit-btn:hover { border-color: var(--acc); color: var(--acc); }

.tw-sig-canvas {
  width: 100%; height: 120px;
  background: #fff;
  border-radius: 10px; cursor: crosshair;
  border: 1.5px solid var(--border);
  touch-action: none; display: block;
}
.tw-sig-row { display: flex; gap: 10px; margin-top: 10px; }
.tw-sig-row .tw-btn-primary, .tw-sig-row .tw-btn-secondary { margin: 0; padding: 14px; font-size: 16px; min-height: 48px; }

@media (max-width: 480px) {
  .tw-doc-grid { gap: 8px; }
  .tw-doc-tile { padding: 14px 10px; min-height: 110px; }
  .tw-doc-icon { font-size: 32px; }
  .tw-doc-name { font-size: 14px; }
}
`

// ─── Component ────────────────────────────────────────────────────────────────
export function TranslateWizard() {
  const params = useParams() as { locale?: string } | null
  const searchParams = useSearchParams()
  const locale = ((params?.locale as Locale) ?? 'ru') as Locale
  const t = getT(locale)

  const [screen, setScreen] = useState<Screen>(1)
  const [selectedDocType, setSelectedDocType] = useState<DocTypeChoice | null>(null)
  const [uploadedFile, setUploadedFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [extractedFields, setExtractedFields] = useState<ExtractedField[]>([])
  const [extractionError, setExtractionError] = useState<string | null>(null)
  const [paymentLoading, setPaymentLoading] = useState(false)
  const [pdfLoading, setPdfLoading] = useState(false)
  const [pdfDownloaded, setPdfDownloaded] = useState(false)
  const [sigSaved, setSigSaved] = useState(false)
  const [procStep, setProcStep] = useState(0) // 0-5 — which step is currently active
  const [stripeCheckoutId, setStripeCheckoutId] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null
    try { return sessionStorage.getItem('tw:cs') } catch { return null }
  })

  // Restore draft after Stripe round-trip.
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(DRAFT_KEY)
      if (!raw) return
      const draft = JSON.parse(raw) as DraftState
      // Only restore if we're returning to the same flow (e.g. after Stripe).
      if (['review', 'payment', 'success'].includes(String(draft.screen))) return
      // We restore selectedDocType + extractedFields so the success-screen PDF
      // call still has them. Screen is set by the ?paid=1 handler below.
      if (draft.selectedDocType) setSelectedDocType(draft.selectedDocType)
      if (Array.isArray(draft.extractedFields)) setExtractedFields(draft.extractedFields)
    } catch { /* ignore */ }
  }, [])

  // Stripe return: ?paid=1&plan=basic&cs=cs_X → advance to screen 7.
  useEffect(() => {
    const paid = searchParams?.get('paid')
    const cs = searchParams?.get('cs')
    if (paid === '1') {
      if (cs && /^(cs_|py_)/.test(cs)) {
        setStripeCheckoutId(cs)
        try { sessionStorage.setItem('tw:cs', cs) } catch { /* */ }
      }
      setScreen(7)
      if (typeof window !== 'undefined') {
        const url = new URL(window.location.href)
        url.searchParams.delete('paid'); url.searchParams.delete('plan'); url.searchParams.delete('cs')
        window.history.replaceState({}, '', url.toString())
      }
    }
  }, [searchParams])

  const goTo = useCallback((n: Screen) => {
    setScreen(n)
    if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [])

  const saveDraft = useCallback(() => {
    try {
      const draft: DraftState = { screen, selectedDocType, extractedFields }
      sessionStorage.setItem(DRAFT_KEY, JSON.stringify(draft))
    } catch { /* */ }
  }, [screen, selectedDocType, extractedFields])

  // ── File handling ──
  const handleFile = useCallback((file: File | null | undefined) => {
    if (!file) return
    setUploadedFile(file)
    setExtractionError(null)
    setExtractedFields([])
    if (file.type.startsWith('image/')) {
      const reader = new FileReader()
      reader.onload = (e) => setPreviewUrl(e.target?.result as string)
      reader.readAsDataURL(file)
    } else {
      setPreviewUrl(null)
    }
  }, [])

  // ── Processing: REAL /api/translation/vision-extract while animating steps ──
  const startProcessing = useCallback(async () => {
    if (!uploadedFile || !selectedDocType) return
    setProcStep(1)
    goTo(4)
    setExtractionError(null)
    setExtractedFields([])

    // Tick the visible steps while the network call is in flight.
    const tickers = [
      setTimeout(() => setProcStep(2), 700),
      setTimeout(() => setProcStep(3), 1500),
      setTimeout(() => setProcStep(4), 2300),
      setTimeout(() => setProcStep(5), 3100),
    ]
    const meta = DOC_TYPES.find((d) => d.id === selectedDocType)
    const registryId = meta?.registryId

    try {
      if (!meta?.auto || !registryId) {
        // Manual-review path: skip the API call. We still advance to review with
        // empty fields — the review screen shows an honest "manual review" notice.
        await new Promise((r) => setTimeout(r, 3800))
        tickers.forEach(clearTimeout)
        setProcStep(5)
        goTo(5)
        return
      }
      const form = new FormData()
      form.append('file', uploadedFile)
      form.append('docTypeId', registryId)
      const res = await fetch('/api/translation/vision-extract', { method: 'POST', body: form })
      tickers.forEach(clearTimeout)
      setProcStep(5)
      const json = await res.json().catch(() => ({} as { ok?: boolean; fields?: ExtractedField[]; error?: string }))
      if (!res.ok || !json?.ok) {
        setExtractionError(json?.error ?? `HTTP ${res.status}`)
        goTo(5)
        return
      }
      const fields = Array.isArray(json.fields) ? (json.fields as ExtractedField[]).filter((f) => f.value) : []
      setExtractedFields(fields)
      goTo(5)
    } catch (e: unknown) {
      tickers.forEach(clearTimeout)
      setExtractionError(e instanceof Error ? e.message : 'Network error')
      setProcStep(5)
      goTo(5)
    }
  }, [uploadedFile, selectedDocType, goTo])

  // ── Real Stripe checkout (replaces prototype's simulatePayment) ──
  const handlePayment = useCallback(async () => {
    if (paymentLoading) return
    setPaymentLoading(true)
    // Persist draft so we can rebuild state after the Stripe round-trip.
    saveDraft()
    try {
      const res = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ product: 'translation', plan: 'basic', locale }),
      })
      const data = await res.json()
      if (data?.url) {
        window.location.href = data.url
      } else {
        console.error('Stripe checkout error:', data?.error)
        alert('Payment could not be initiated. Please try again.')
        setPaymentLoading(false)
      }
    } catch (err) {
      console.error('Payment fetch failed:', err)
      alert('Network error. Please try again.')
      setPaymentLoading(false)
    }
  }, [paymentLoading, saveDraft, locale])

  // ── Signature canvas ──
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null)
  const drawingRef = useRef(false)
  const lastRef = useRef<{ x: number; y: number } | null>(null)
  const hasDrawnRef = useRef(false)

  useEffect(() => {
    if (screen !== 7) return
    const c = canvasRef.current
    if (!c) return
    const ctx = c.getContext('2d')
    if (!ctx) return
    ctxRef.current = ctx
    ctx.strokeStyle = '#1a2d52'
    ctx.lineWidth = 2.5
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    const getPos = (e: MouseEvent | TouchEvent) => {
      const rect = c.getBoundingClientRect()
      const sx = c.width / rect.width
      const sy = c.height / rect.height
      const touch = (e as TouchEvent).touches?.[0]
      if (touch) return { x: (touch.clientX - rect.left) * sx, y: (touch.clientY - rect.top) * sy }
      const me = e as MouseEvent
      return { x: (me.clientX - rect.left) * sx, y: (me.clientY - rect.top) * sy }
    }
    const start = (e: MouseEvent | TouchEvent) => {
      if ('touches' in e) e.preventDefault()
      drawingRef.current = true
      lastRef.current = getPos(e)
    }
    const move = (e: MouseEvent | TouchEvent) => {
      if (!drawingRef.current) return
      if ('touches' in e) e.preventDefault()
      const p = getPos(e)
      ctx.beginPath()
      if (lastRef.current) ctx.moveTo(lastRef.current.x, lastRef.current.y)
      ctx.lineTo(p.x, p.y)
      ctx.stroke()
      lastRef.current = p
      hasDrawnRef.current = true
    }
    const end = () => { drawingRef.current = false }
    c.addEventListener('mousedown', start)
    c.addEventListener('mousemove', move)
    c.addEventListener('mouseup', end)
    c.addEventListener('mouseleave', end)
    c.addEventListener('touchstart', start, { passive: false })
    c.addEventListener('touchmove', move, { passive: false })
    c.addEventListener('touchend', end)
    return () => {
      c.removeEventListener('mousedown', start)
      c.removeEventListener('mousemove', move)
      c.removeEventListener('mouseup', end)
      c.removeEventListener('mouseleave', end)
      c.removeEventListener('touchstart', start)
      c.removeEventListener('touchmove', move)
      c.removeEventListener('touchend', end)
    }
  }, [screen])

  const clearSig = useCallback(() => {
    const c = canvasRef.current
    if (!c) return
    const ctx = c.getContext('2d')
    ctx?.clearRect(0, 0, c.width, c.height)
    hasDrawnRef.current = false
    setSigSaved(false)
  }, [])

  // ── Real PDF generation (replaces simulateDownload) ──
  const handleDownloadPdf = useCallback(async () => {
    if (pdfLoading) return
    setPdfLoading(true)
    try {
      const c = canvasRef.current
      const sigDataUrl = (hasDrawnRef.current && c) ? c.toDataURL('image/png') : null
      const profileName = (() => {
        const fam = extractedFields.find((f) => f.field === 'family_name')?.value ?? ''
        const giv = extractedFields.find((f) => f.field === 'given_name')?.value ?? ''
        return [giv, fam].filter(Boolean).join(' ').toUpperCase() || 'APPLICANT'
      })()
      const fieldsForPdf = extractedFields.map((f) => ({
        field: f.field,
        raw_value: f.raw_cyrillic ?? '',
        normalized_value: f.value ?? '',
        source_label: f.raw_cyrillic ?? '',
        source_zone: 'identity_page',
        language_layer: 'cyrillic',
        confidence: f.confidence,
        review_required: true,
        passes: ['gemini_vision_read'],
        ocr_ids: [],
      }))
      const res = await fetch('/api/translation/generate-pdf', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(stripeCheckoutId ? { 'X-Payment-Token': stripeCheckoutId } : {}),
        },
        body: JSON.stringify({
          profile: { name: profileName, email: '', phone: '', addr: '' },
          selectedPlan: 'basic',
          spanishCopy: false,
          locale,
          signatureDataUrl: sigDataUrl,
          signatureMethod: sigDataUrl ? 'drawn_on_screen' : 'manual_wet_signature',
          signedAt: new Date().toISOString(),
          certificationTextVersion: 'self_cert_8cfr_v1',
          session_id: stripeCheckoutId,
          doc_type: DOC_TYPES.find((d) => d.id === selectedDocType)?.registryId ?? 'other',
          scope_title: CERT_TITLES_EN[selectedDocType ?? 'other'],
          fields: fieldsForPdf,
        }),
      })
      if (res.ok) {
        const blob = await res.blob()
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `translation-${Date.now()}.pdf`
        document.body.appendChild(a)
        a.click()
        a.remove()
        URL.revokeObjectURL(url)
        setPdfDownloaded(true)
      } else {
        const data = await res.json().catch(() => ({} as { error?: string }))
        alert(data?.error ?? `PDF download failed (HTTP ${res.status})`)
      }
    } catch (err) {
      console.error('[TranslateWizard download]', err)
      alert('Network error. Please try again.')
    } finally {
      setPdfLoading(false)
    }
  }, [pdfLoading, extractedFields, stripeCheckoutId, locale, selectedDocType])

  const resetAll = useCallback(() => {
    setSelectedDocType(null)
    setUploadedFile(null)
    setPreviewUrl(null)
    setExtractedFields([])
    setExtractionError(null)
    setPdfDownloaded(false)
    setSigSaved(false)
    try { sessionStorage.removeItem(DRAFT_KEY) } catch { /* */ }
  }, [])

  // ── Translation table rows: REAL fields if present, else honest sample ──
  const translationRows = (() => {
    if (extractedFields.length > 0) {
      return extractedFields
        .filter((f) => UKR_LABEL_BY_FIELD[f.field])
        .map((f) => ({
          ukr: UKR_LABEL_BY_FIELD[f.field],
          val_ukr: f.raw_cyrillic ?? '—',
          val_eng: f.value ?? '—',
        }))
    }
    return [] // empty → review screen renders the manual-review notice
  })()
  const certRowsForPreview = translationRows.length > 0 ? translationRows : SAMPLE_ROWS[selectedDocType ?? 'other']
  const certTitle = CERT_TITLES_EN[selectedDocType ?? 'other']
  const certDateLine = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })

  // ── Progress bar ──
  const stepIndex = fmtScreenStep(screen)
  const showProgress = screen !== 1

  return (
    <div className="tw-root">
      <style>{WIZARD_CSS}</style>

      <header className="tw-header">
        <div className="tw-logo">Messeng<span>info</span></div>
        <div className="tw-header-badge">{t.badge}</div>
      </header>

      {showProgress && (
        <div className="tw-progress-bar">
          <div className="tw-progress-steps">
            {t.progress.map((lbl, i) => (
              <div key={lbl} style={{ display: 'contents' }}>
                <div className="tw-step-wrap">
                  <div className={`tw-step-dot ${i < stepIndex ? 'done' : i === stepIndex ? 'active' : 'pending'}`}>
                    {i < stepIndex ? '✓' : i + 1}
                  </div>
                  <div className={`tw-step-label ${i === stepIndex ? 'active-label' : ''}`}>{lbl}</div>
                </div>
                {i < t.progress.length - 1 && <div className={`tw-step-line ${i < stepIndex ? 'done' : ''}`} />}
              </div>
            ))}
          </div>
        </div>
      )}

      <main className="tw-main">
        {/* SCREEN 1 — Welcome */}
        <div className={`tw-screen ${screen === 1 ? 'tw-active' : ''}`}>
          <div style={{ textAlign: 'center', padding: '20px 0 10px' }}>
            <div style={{ fontSize: 64, marginBottom: 16 }}>📋</div>
            <h1 className="tw-h1">{t.s1_title_1}<br /><span className="tw-gold">{t.s1_title_2}</span></h1>
            <p className="tw-subtitle">{t.s1_subtitle}</p>
          </div>
          <div className="tw-card" style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '18px 20px' }}>
            <span style={{ fontSize: 28 }}>⚡</span>
            <div>
              <div style={{ fontWeight: 800, fontSize: 17 }}>{t.s1_card_time_t}</div>
              <div style={{ fontSize: 15, color: 'var(--text-muted)' }}>{t.s1_card_time_s}</div>
            </div>
          </div>
          <div className="tw-card" style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '18px 20px', marginTop: -8 }}>
            <span style={{ fontSize: 28 }}>✅</span>
            <div>
              <div style={{ fontWeight: 800, fontSize: 17 }}>{t.s1_card_format_t}</div>
              <div style={{ fontSize: 15, color: 'var(--text-muted)' }}>{t.s1_card_format_s}</div>
            </div>
          </div>
          <div className="tw-card" style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '18px 20px', marginTop: -8 }}>
            <span style={{ fontSize: 28 }}>👁</span>
            <div>
              <div style={{ fontWeight: 800, fontSize: 17 }}>{t.s1_card_seefirst_t}</div>
              <div style={{ fontSize: 15, color: 'var(--text-muted)' }}>{t.s1_card_seefirst_s}</div>
            </div>
          </div>
          <div style={{ marginTop: 24 }}>
            <button className="tw-btn-primary" onClick={() => goTo(2)}>{t.s1_cta}</button>
          </div>
          <div className="tw-reassurance" style={{ marginTop: 20 }}>
            <div className="tw-reassurance-icon">🔐</div>
            <div className="tw-reassurance-text"><strong>{t.s1_secure}</strong> {t.s1_secure_s}</div>
          </div>
          <p className="tw-legal-note">{t.legal}</p>
        </div>

        {/* SCREEN 2 — Doc type */}
        <div className={`tw-screen ${screen === 2 ? 'tw-active' : ''}`}>
          <button type="button" className="tw-back-btn" onClick={() => goTo(1)}>{t.back}</button>
          <h2 className="tw-h2">{t.s2_title_1}<br />{t.s2_title_2}</h2>
          <p className="tw-subtitle">{t.s2_subtitle}</p>
          <div className="tw-doc-grid">
            {DOC_TYPES.map((d) => (
              <button
                key={d.id}
                type="button"
                className={`tw-doc-tile ${d.popular ? 'popular' : ''} ${selectedDocType === d.id ? 'tw-selected' : ''}`}
                onClick={() => setSelectedDocType(d.id)}
              >
                {d.popular && <span className="tw-popular-badge">{t.s2_popular}</span>}
                <div className="tw-doc-icon">{d.icon}</div>
                <div className="tw-doc-name">{t.doc[d.id].name}</div>
                {t.doc[d.id].hint && <div className="tw-doc-hint">{t.doc[d.id].hint}</div>}
              </button>
            ))}
          </div>
          {selectedDocType && !DOC_TYPES.find((d) => d.id === selectedDocType)?.auto && (
            <div className="tw-reassurance" style={{ marginTop: 16 }}>
              <div className="tw-reassurance-icon">👨‍💼</div>
              <div className="tw-reassurance-text">{t.s2_manual_note}</div>
            </div>
          )}
          <div style={{ marginTop: 20 }}>
            <button className="tw-btn-primary" disabled={!selectedDocType} onClick={() => goTo(3)}>{t.next}</button>
          </div>
        </div>

        {/* SCREEN 3 — Upload */}
        <div className={`tw-screen ${screen === 3 ? 'tw-active' : ''}`}>
          <button type="button" className="tw-back-btn" onClick={() => goTo(2)}>{t.back}</button>
          <h2 className="tw-h2">{t.s3_title_1}<br />{t.s3_title_2}</h2>
          <p className="tw-subtitle">{t.s3_subtitle}</p>
          {previewUrl && <img className="tw-preview-img" src={previewUrl} alt="" />}
          {!previewUrl && (
            <label className="tw-upload-zone">
              <div className="tw-upload-icon">📸</div>
              <div className="tw-upload-main">{t.s3_drop_main}</div>
              <div className="tw-upload-sub">{t.s3_drop_sub}</div>
              <input
                type="file"
                accept="image/*"
                style={{ display: 'none' }}
                onChange={(e) => handleFile(e.target.files?.[0])}
              />
            </label>
          )}
          <div className="tw-upload-btns">
            <label className="tw-btn-upload tw-btn-camera">
              {t.s3_camera}
              <input
                type="file"
                accept="image/*"
                capture="environment"
                style={{ display: 'none' }}
                onChange={(e) => handleFile(e.target.files?.[0])}
              />
            </label>
            <label className="tw-btn-upload tw-btn-file">
              {t.s3_file}
              <input
                type="file"
                accept="image/*"
                style={{ display: 'none' }}
                onChange={(e) => handleFile(e.target.files?.[0])}
              />
            </label>
          </div>
          <div className="tw-reassurance" style={{ marginTop: 16 }}>
            <div className="tw-reassurance-icon">💡</div>
            <div className="tw-reassurance-text"><strong>{t.s3_tip_t}</strong> {t.s3_tip_b}</div>
          </div>
          <div style={{ marginTop: 20 }}>
            <button className="tw-btn-primary" disabled={!uploadedFile} onClick={startProcessing}>{t.s3_cta}</button>
          </div>
        </div>

        {/* SCREEN 4 — Processing */}
        <div className={`tw-screen ${screen === 4 ? 'tw-active' : ''}`}>
          <div className="tw-processing">
            <div className="tw-ai-spinner" />
            <h2 className="tw-h2">{t.s4_title_1}<br />{t.s4_title_2}</h2>
            <p className="tw-subtitle">{t.s4_subtitle}</p>
          </div>
          <div className="tw-card tw-proc-steps">
            {t.s4_steps.map((label, i) => {
              const idx = i + 1
              const isDone = procStep > idx
              const isActive = procStep === idx
              return (
                <div key={label} className={`tw-proc-step ${isDone ? 'tw-done' : ''} ${isActive ? 'tw-active' : ''}`}>
                  {isActive ? <div className="tw-proc-spinner" /> : <span className="tw-proc-icon">{isDone ? '✅' : '○'}</span>}
                  <div>{label}</div>
                </div>
              )
            })}
          </div>
        </div>

        {/* SCREEN 5 — Translation preview (BEFORE payment, v5 §21) */}
        <div className={`tw-screen ${screen === 5 ? 'tw-active' : ''}`}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
            <span style={{ fontSize: 28 }}>✅</span>
            <h2 className="tw-h2" style={{ margin: 0 }}>{t.s5_title}</h2>
          </div>
          <p className="tw-subtitle">{t.s5_subtitle}</p>

          {translationRows.length > 0 ? (
            <>
              <div className="tw-trans-header">
                <div className="tw-trans-col-label tw-col-orig">{t.s5_col_orig}</div>
                <div className="tw-trans-col-label tw-col-trans">{t.s5_col_trans}</div>
              </div>
              <div>
                {translationRows.map((row, i) => (
                  <div key={`${row.ukr}-${i}`} className="tw-trans-row" style={{ animationDelay: `${i * 0.08}s` }}>
                    <div className="tw-trans-cell">
                      <div className="tw-trans-label">{row.ukr}</div>
                      <div className="tw-trans-value">{row.val_ukr}</div>
                    </div>
                    <div className="tw-trans-cell translated">
                      <div className="tw-trans-label">English</div>
                      <div className="tw-trans-value">{row.val_eng}</div>
                    </div>
                  </div>
                ))}
              </div>
              <div className="tw-confirm-edit">
                <span>⚠️</span>
                <div style={{ flex: 1 }}>{t.s5_mismatch}</div>
                <button type="button" className="tw-edit-btn" onClick={() => goTo(3)}>{t.s5_reupload}</button>
              </div>
            </>
          ) : (
            <div className="tw-reassurance" style={{ background: 'rgba(201,168,76,0.08)', borderColor: 'rgba(201,168,76,0.3)' }}>
              <div className="tw-reassurance-icon">👨‍💼</div>
              <div className="tw-reassurance-text" style={{ color: 'var(--gold-light)' }}>
                {extractionError ? t.s5_extraction_error : t.s5_no_fields}
              </div>
            </div>
          )}

          {/* Cert preview with watermark */}
          <div className="tw-cert-preview">
            <span className="tw-cert-badge">{t.s5_sample_badge}</span>
            <div className="tw-watermark">{t.s5_sample_badge.replace(/^📄\s*/, '')}</div>
            <div className="tw-cert-title">{certTitle}</div>
            <div>
              {certRowsForPreview.map((row, i) => (
                <div key={`cf-${i}`} className="tw-cert-field">
                  <span className="tw-cert-key">{row.ukr}:</span>
                  <span className="tw-cert-val">{row.val_eng}</span>
                </div>
              ))}
            </div>
            <div className="tw-cert-cert">
              <strong>CERTIFICATION:</strong> {t.s5_cert_intro}
              <br /><br />
              <strong>Messenginfo.com</strong> | Translation Service | Date: {certDateLine}
            </div>
          </div>

          <div style={{ marginTop: 24 }}>
            <button className="tw-btn-primary" onClick={() => goTo(6)}>{t.s5_cta}</button>
            <div className="tw-legal-note" style={{ marginTop: 12 }}>{t.s5_payment_note}</div>
          </div>
        </div>

        {/* SCREEN 6 — Payment */}
        <div className={`tw-screen ${screen === 6 ? 'tw-active' : ''}`}>
          <button type="button" className="tw-back-btn" onClick={() => goTo(5)}>{t.back}</button>
          <h2 className="tw-h2">{t.s6_title}</h2>
          <p className="tw-subtitle">{t.s6_subtitle}</p>
          <div className="tw-price-tag">
            <div className="tw-price-amount">$14.99</div>
            <div className="tw-price-sub">{t.s6_price_sub}</div>
          </div>
          <div className="tw-features-list">
            {t.s6_features.map((f, i) => (
              <div key={i} className="tw-feature-item">
                <span className="tw-feature-icon">{['📄', '⚖️', '✏️', '📧', '🔄'][i]}</span>
                <div>{f}</div>
              </div>
            ))}
          </div>
          <div className="tw-trust-badges">
            <div className="tw-trust-badge">🔒 Stripe</div>
            <div className="tw-trust-badge">🛡️ SSL</div>
            <div className="tw-trust-badge">↩️ 7d refund</div>
          </div>
          <button
            type="button"
            className="tw-btn-primary tw-btn-green"
            onClick={handlePayment}
            disabled={paymentLoading}
            style={{ fontSize: 21, padding: 22 }}
          >
            {paymentLoading ? t.s6_cta_loading : t.s6_cta}
          </button>
          <div className="tw-reassurance" style={{ marginTop: 16 }}>
            <div className="tw-reassurance-icon">🔒</div>
            <div className="tw-reassurance-text">{t.s6_stripe}</div>
          </div>
          <p className="tw-legal-note">{t.s6_terms}</p>
        </div>

        {/* SCREEN 7 — Success */}
        <div className={`tw-screen ${screen === 7 ? 'tw-active' : ''}`}>
          <div style={{ textAlign: 'center', padding: '20px 0' }}>
            <div className="tw-success-icon">✅</div>
            <h1 className="tw-h1">{t.s7_title}</h1>
            <p className="tw-subtitle">{t.s7_subtitle}</p>
          </div>
          <div className="tw-card" style={{ background: 'rgba(16,185,129,0.08)', borderColor: 'rgba(16,185,129,0.3)' }}>
            <div style={{ fontWeight: 800, fontSize: 18, marginBottom: 12, color: 'var(--green-light)' }}>{t.s7_pdf_title}</div>
            <div style={{ fontSize: 15, color: 'var(--text-muted)', marginBottom: 16 }}>{t.s7_pdf_sub}</div>
            <button
              type="button"
              className="tw-btn-primary tw-btn-green"
              onClick={handleDownloadPdf}
              disabled={pdfLoading}
              style={{ marginBottom: 0 }}
            >
              {pdfLoading ? t.s7_downloading : pdfDownloaded ? t.s7_downloaded : t.s7_download}
            </button>
          </div>
          <div className="tw-card">
            <div style={{ fontWeight: 800, fontSize: 17, marginBottom: 14 }}>{t.s7_sig_title}</div>
            <p style={{ fontSize: 15, color: 'var(--text-muted)', marginBottom: 16 }}>{t.s7_sig_sub}</p>
            <canvas ref={canvasRef} className="tw-sig-canvas" width={560} height={120} />
            <div className="tw-sig-row">
              <button type="button" onClick={clearSig} className="tw-btn-secondary" style={{ flex: 1 }}>
                {t.s7_sig_clear}
              </button>
              <button
                type="button"
                onClick={() => setSigSaved(true)}
                className="tw-btn-primary"
                style={{ flex: 2, background: sigSaved ? 'var(--green)' : 'var(--gold)', color: sigSaved ? '#fff' : 'var(--navy)' }}
              >
                {sigSaved ? t.s7_sig_saved : t.s7_sig_save}
              </button>
            </div>
          </div>
          <div className="tw-card">
            <div style={{ fontWeight: 800, fontSize: 17, marginBottom: 14 }}>{t.s7_next_title}</div>
            {t.s7_next_steps.map((step, i) => (
              <div key={i} className="tw-feature-item" style={{ fontSize: 16 }}>
                <span className="tw-feature-icon">{['1️⃣', '2️⃣', '3️⃣'][i]}</span>
                <div>{step}</div>
              </div>
            ))}
          </div>
          <button
            type="button"
            className="tw-btn-primary"
            onClick={() => { resetAll(); goTo(1) }}
            style={{ background: 'var(--navy3)', color: 'var(--text)', boxShadow: 'none' }}
          >
            {t.s7_restart}
          </button>
        </div>
      </main>
    </div>
  )
}
