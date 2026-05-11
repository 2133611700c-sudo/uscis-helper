'use client'

/**
 * DocumentUploadScreen — the new wizard step that takes uploaded photos
 * of passport / I-94 / EAD and POSTs them to /api/tps/ocr/extract.
 *
 * Per docs/ux/SELF_REVIEW_PATTERN.md and Sergii's "address vs evidence"
 * rule:
 *   - We OCR ONLY identity documents (passport / I-94 / EAD card).
 *   - We do NOT OCR all residence-evidence documents here. That stays
 *     a category-checklist step further in the wizard.
 *
 * Each row in the UI is one document slot. The user can:
 *   - take a photo / pick a file
 *   - retry / replace
 *   - skip entirely (we then fall back to manual data entry later)
 *
 * On success, the parent receives a merged map of TpsExtractedField[]
 * keyed by canonical field name (e.g. family_name, passport_number).
 * If two documents disagree on a field, both extracted values are
 * surfaced separately so the review screen can show the mismatch.
 */

import { useCallback, useRef, useState } from 'react'
import type { TpsExtractedField, TpsDocType, TpsModuleResult } from '@/lib/tps/types'

export type Locale = 'uk' | 'ru' | 'en' | 'es'

type SlotState =
  | { kind: 'empty' }
  | { kind: 'uploading'; fileName: string }
  | { kind: 'ok'; fileName: string; extractedCount: number; manualReview: boolean; fields: TpsExtractedField[]; documentId: string }
  | { kind: 'error'; fileName: string; message: string }

interface DocumentSlot {
  doc_type: TpsDocType
  required: boolean
  state: SlotState
}

interface Props {
  locale: Locale

  /** Fired when all required slots are either filled or explicitly
   *  skipped. Receives the flat list of fields extracted across slots. */
  onComplete: (results: {
    fields: TpsExtractedField[]
    documents: Array<{
      document_id: string
      doc_type: TpsDocType
      filename: string
      manual_review: boolean
    }>
    anyManualReview: boolean
  }) => void

  /** Optional back navigation. */
  onBack?: () => void

  /** Optional "skip OCR, type manually" escape hatch. */
  onSkipAll?: () => void
}

const COPY = {
  uk: {
    title: 'Завантажте документи',
    subtitle: 'Ми прочитаємо ваші документи і пiдставимо дані у форму. Ви потім перевірите кожне поле.',
    privacy: 'Файли видаляються з нашого сервера після формування пакета. Ми не передаємо їх третім особам.',
    slotPassport: 'Закордонний паспорт',
    slotPassportHint: 'Фото сторінки з фотографією. Розворот має бути добре освітлений, без бликів.',
    slotI94: 'I-94 (запис в’їзду в США)',
    slotI94Hint: 'Скриншот або роздруківка з i94.cbp.dhs.gov.',
    slotEad: 'Картка EAD (якщо у вас вже є дозвіл на роботу)',
    slotEadHint: 'Фото обох сторін картки.',
    optional: 'необов’язково',
    btnUpload: 'Вибрати файл',
    btnReplace: 'Замінити',
    btnRetry: 'Повторити',
    uploading: 'Читаємо…',
    okFields: (n: number) => `Прочитано ${n} ${n === 1 ? 'поле' : n < 5 ? 'поля' : 'полів'}`,
    manualReviewBadge: 'потрібна перевірка',
    errorBadge: 'не вдалося прочитати',
    btnNext: 'Далі →',
    btnBack: '← Назад',
    btnSkipAll: 'Я введу дані руками',
    blockMissing: 'Завантажте паспорт або натисніть «Я введу дані руками».',
  },
  ru: {
    title: 'Загрузите документы',
    subtitle: 'Мы прочитаем ваши документы и подставим данные в форму. Вы потом проверите каждое поле.',
    privacy: 'Файлы удаляются с нашего сервера после формирования пакета. Мы не передаём их третьим лицам.',
    slotPassport: 'Загранпаспорт',
    slotPassportHint: 'Фото страницы с фотографией. Разворот должен быть хорошо освещён, без бликов.',
    slotI94: 'I-94 (запись о въезде в США)',
    slotI94Hint: 'Скриншот или распечатка с i94.cbp.dhs.gov.',
    slotEad: 'Карточка EAD (если у вас уже есть разрешение на работу)',
    slotEadHint: 'Фото обеих сторон карточки.',
    optional: 'необязательно',
    btnUpload: 'Выбрать файл',
    btnReplace: 'Заменить',
    btnRetry: 'Повторить',
    uploading: 'Читаем…',
    okFields: (n: number) => `Прочитано ${n} ${n === 1 ? 'поле' : n < 5 ? 'поля' : 'полей'}`,
    manualReviewBadge: 'нужна проверка',
    errorBadge: 'не удалось прочитать',
    btnNext: 'Дальше →',
    btnBack: '← Назад',
    btnSkipAll: 'Я введу данные руками',
    blockMissing: 'Загрузите паспорт или нажмите «Я введу данные руками».',
  },
  en: {
    title: 'Upload your documents',
    subtitle: 'We will read your documents and prefill the form. You will review every field after.',
    privacy: 'Files are deleted from our server after the packet is generated. We do not share them with third parties.',
    slotPassport: 'International passport',
    slotPassportHint: 'Photo of the biographic page. Well lit, no glare.',
    slotI94: 'I-94 (US entry record)',
    slotI94Hint: 'Screenshot or printout from i94.cbp.dhs.gov.',
    slotEad: 'EAD card (if you already have a work permit)',
    slotEadHint: 'Photo of both sides.',
    optional: 'optional',
    btnUpload: 'Choose file',
    btnReplace: 'Replace',
    btnRetry: 'Retry',
    uploading: 'Reading…',
    okFields: (n: number) => `${n} field${n === 1 ? '' : 's'} read`,
    manualReviewBadge: 'needs review',
    errorBadge: 'could not read',
    btnNext: 'Next →',
    btnBack: '← Back',
    btnSkipAll: 'I will type the data myself',
    blockMissing: 'Upload your passport or press "I will type the data myself".',
  },
  es: {
    title: 'Suba sus documentos',
    subtitle: 'Leeremos sus documentos y prellenaremos el formulario. Usted revisará cada campo después.',
    privacy: 'Los archivos se eliminan de nuestro servidor después de generar el paquete. No los compartimos con terceros.',
    slotPassport: 'Pasaporte internacional',
    slotPassportHint: 'Foto de la página biográfica. Bien iluminada, sin reflejos.',
    slotI94: 'I-94 (registro de entrada a EE.UU.)',
    slotI94Hint: 'Captura o impresión de i94.cbp.dhs.gov.',
    slotEad: 'Tarjeta EAD (si ya tiene permiso de trabajo)',
    slotEadHint: 'Foto de ambos lados.',
    optional: 'opcional',
    btnUpload: 'Elegir archivo',
    btnReplace: 'Reemplazar',
    btnRetry: 'Reintentar',
    uploading: 'Leyendo…',
    okFields: (n: number) => `${n} campo${n === 1 ? '' : 's'} leído${n === 1 ? '' : 's'}`,
    manualReviewBadge: 'necesita revisión',
    errorBadge: 'no se pudo leer',
    btnNext: 'Siguiente →',
    btnBack: '← Atrás',
    btnSkipAll: 'Ingresaré los datos a mano',
    blockMissing: 'Suba su pasaporte o presione "Ingresaré los datos a mano".',
  },
} as const

/**
 * Localized error messages for the image-quality gate. Maps server-side
 * preprocess error codes ('too_small' / 'too_blurry' / 'corrupt_image' /
 * 'unsupported_file_type') to a sentence we can show the user. Designed
 * for the 60+ smartphone user — plain language, no jargon, ends with
 * a concrete next step.
 */
function qualityMessageFor(
  code: 'too_small' | 'too_blurry' | 'corrupt_image' | 'unsupported_file_type',
  locale: Locale,
): string {
  const MSG: Record<typeof code, Record<Locale, string>> = {
    too_small: {
      uk: 'Фото замале. Зробіть знімок ближче й чіткіше і завантажте ще раз.',
      ru: 'Фото слишком маленькое. Сделайте снимок ближе и чётче и загрузите снова.',
      en: 'The photo is too small. Take a closer, sharper picture and upload again.',
      es: 'La foto es demasiado pequeña. Tome una foto más cercana y nítida e intente de nuevo.',
    },
    too_blurry: {
      uk: 'Фото нечітке. Сфотографуйте при гарному світлі без рук і завантажте ще раз.',
      ru: 'Фото размытое. Сфотографируйте при хорошем свете и без рук, потом загрузите снова.',
      en: 'The photo is blurry. Try again in good light, holding the phone steady.',
      es: 'La foto está borrosa. Vuelva a intentarlo con buena luz y sin mover el teléfono.',
    },
    corrupt_image: {
      uk: 'Не вдалося прочитати файл. Спробуйте інший знімок (JPEG або PNG).',
      ru: 'Не получилось прочитать файл. Попробуйте другой снимок (JPEG или PNG).',
      en: 'We could not read the file. Try another picture (JPEG or PNG).',
      es: 'No pudimos leer el archivo. Pruebe con otra foto (JPEG o PNG).',
    },
    unsupported_file_type: {
      uk: 'Цей тип файлу ще не підтримується. Зробіть фото документа і завантажте JPEG або PNG.',
      ru: 'Этот тип файла пока не поддерживается. Сфотографируйте документ и загрузите JPEG или PNG.',
      en: 'This file type is not supported yet. Take a photo of the document and upload as JPEG or PNG.',
      es: 'Este tipo de archivo aún no es compatible. Tome una foto del documento y súbala como JPEG o PNG.',
    },
  }
  return MSG[code]?.[locale] ?? MSG[code]?.en ?? 'Could not read the image.'
}

export function DocumentUploadScreen({ locale, onComplete, onBack, onSkipAll }: Props) {
  const c = COPY[locale]
  const [slots, setSlots] = useState<DocumentSlot[]>([
    { doc_type: 'passport', required: true, state: { kind: 'empty' } },
    { doc_type: 'i94',      required: false, state: { kind: 'empty' } },
    { doc_type: 'ead',      required: false, state: { kind: 'empty' } },
  ])

  const slotMeta = (t: TpsDocType) => {
    if (t === 'passport') return { title: c.slotPassport, hint: c.slotPassportHint }
    if (t === 'i94')      return { title: c.slotI94,      hint: c.slotI94Hint }
    if (t === 'ead')      return { title: c.slotEad,      hint: c.slotEadHint }
    return { title: t, hint: '' }
  }

  const updateSlot = useCallback((doc_type: TpsDocType, next: SlotState) => {
    setSlots((prev) => prev.map((s) => (s.doc_type === doc_type ? { ...s, state: next } : s)))
  }, [])

  const handleFile = useCallback(
    async (doc_type: TpsDocType, file: File) => {
      updateSlot(doc_type, { kind: 'uploading', fileName: file.name })
      try {
        const fd = new FormData()
        fd.append('file', file)
        fd.append('doc_type_hint', doc_type)
        const res = await fetch('/api/tps/ocr/extract', { method: 'POST', body: fd })
        const data = (await res.json()) as {
          ok?: boolean
          error?: string
          quality_error?: {
            code: 'too_small' | 'too_blurry' | 'corrupt_image' | 'unsupported_file_type'
            message: string
          }
          module?: TpsModuleResult
          document_id?: string
        }
        if (!res.ok || !data.ok) {
          // Image-quality gate failures (422) deserve a localized,
          // human-readable message — not a "HTTP 422" mystery. Map the
          // server `code` to the user's locale.
          let msg = data.error ?? `HTTP ${res.status}`
          if (data.quality_error) {
            msg = qualityMessageFor(data.quality_error.code, locale)
          }
          updateSlot(doc_type, { kind: 'error', fileName: file.name, message: msg })
          return
        }
        // Use `mod` instead of `module` — Next.js lint forbids reassigning
        // the CommonJS `module` global (no-assign-module-variable).
        const mod = data.module
        if (!mod || !mod.matched) {
          updateSlot(doc_type, {
            kind: 'error',
            fileName: file.name,
            message: mod?.warnings?.[0] ?? 'No fields detected',
          })
          return
        }
        updateSlot(doc_type, {
          kind: 'ok',
          fileName: file.name,
          extractedCount: mod.fields.length,
          manualReview: mod.manual_review_required,
          fields: mod.fields,
          documentId: data.document_id ?? `doc_${Date.now()}`,
        })
      } catch (e) {
        updateSlot(doc_type, {
          kind: 'error',
          fileName: file.name,
          message: e instanceof Error ? e.message : String(e),
        })
      }
    },
    [updateSlot, locale],
  )

  // Required slot = passport. Block forward navigation until it is ok.
  const passport = slots.find((s) => s.doc_type === 'passport')!
  const canProceed = passport.state.kind === 'ok'

  const handleNext = useCallback(() => {
    const okSlots = slots.filter((s): s is DocumentSlot & { state: Extract<SlotState, { kind: 'ok' }> } => s.state.kind === 'ok')
    const fields = okSlots.flatMap((s) => s.state.fields)
    const documents = okSlots.map((s) => ({
      document_id: s.state.documentId,
      doc_type: s.doc_type,
      filename: s.state.fileName,
      manual_review: s.state.manualReview,
    }))
    const anyManualReview = okSlots.some((s) => s.state.manualReview)
    onComplete({ fields, documents, anyManualReview })
  }, [slots, onComplete])

  return (
    <section
      data-testid="tps-doc-upload"
      style={{
        padding: '18px 20px 24px',
        maxWidth: 640,
        margin: '0 auto',
      }}
    >
      <h2 style={{ fontSize: 24, fontWeight: 800, color: 'var(--text-1)', marginBottom: 8 }}>{c.title}</h2>
      <p style={{ fontSize: 14, color: 'var(--text-2)', lineHeight: 1.55, marginBottom: 14 }}>{c.subtitle}</p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16 }}>
        {slots.map((slot) => {
          const meta = slotMeta(slot.doc_type)
          return <SlotRow key={slot.doc_type} c={c} meta={meta} slot={slot} onFile={(f) => void handleFile(slot.doc_type, f)} />
        })}
      </div>

      <p
        style={{
          fontSize: 11,
          color: 'var(--text-3)',
          lineHeight: 1.5,
          padding: '10px 12px',
          background: 'var(--surface-2)',
          borderRadius: 8,
          marginBottom: 18,
        }}
      >
        🔒 {c.privacy}
      </p>

      <div style={{ display: 'flex', gap: 10 }}>
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            style={{
              flex: 1,
              padding: '14px 16px',
              fontSize: 15,
              fontWeight: 700,
              borderRadius: 12,
              border: '1px solid var(--border)',
              background: 'var(--surface-2)',
              color: 'var(--text-1)',
              cursor: 'pointer',
            }}
          >
            {c.btnBack}
          </button>
        )}
        <button
          type="button"
          disabled={!canProceed}
          aria-disabled={!canProceed}
          onClick={canProceed ? handleNext : undefined}
          style={{
            flex: onBack ? 2 : 1,
            padding: '14px 18px',
            fontSize: 16,
            fontWeight: 800,
            borderRadius: 12,
            border: 'none',
            background: canProceed ? 'var(--success)' : 'var(--surface-2)',
            color: canProceed ? '#fff' : 'var(--text-3)',
            cursor: canProceed ? 'pointer' : 'not-allowed',
            opacity: canProceed ? 1 : 0.55,
            boxShadow: canProceed ? '0 3px 14px rgba(22,163,74,0.30)' : 'none',
          }}
        >
          {c.btnNext}
        </button>
      </div>

      {!canProceed && (
        <p style={{ fontSize: 12, color: 'var(--text-3)', textAlign: 'center', marginTop: 8 }}>{c.blockMissing}</p>
      )}

      {onSkipAll && (
        <button
          type="button"
          onClick={onSkipAll}
          style={{
            display: 'block',
            margin: '14px auto 0',
            padding: '8px 12px',
            background: 'transparent',
            border: 'none',
            color: 'var(--text-3)',
            fontSize: 13,
            textDecoration: 'underline',
            cursor: 'pointer',
          }}
        >
          {c.btnSkipAll}
        </button>
      )}
    </section>
  )
}

/* ── Internal: single slot row ─────────────────────────────────────────── */

function SlotRow({
  c,
  meta,
  slot,
  onFile,
}: {
  // Union of every locale's COPY shape — TypeScript can't keep literal
  // types stable across locales, so widen to the structural shape.
  c: (typeof COPY)[Locale]
  meta: { title: string; hint: string }
  slot: DocumentSlot
  onFile: (f: File) => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const onChoose = () => inputRef.current?.click()
  const onChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (f) onFile(f)
  }

  let badge: { text: string; color: string; bg: string } | null = null
  let action: string = c.btnUpload
  if (slot.state.kind === 'uploading') action = c.uploading
  if (slot.state.kind === 'error') {
    action = c.btnRetry
    badge = { text: c.errorBadge, color: 'var(--danger-text, #991b1b)', bg: 'var(--danger-bg, #fee2e2)' }
  }
  if (slot.state.kind === 'ok') {
    action = c.btnReplace
    badge = slot.state.manualReview
      ? { text: c.manualReviewBadge, color: 'var(--warning-text, #92400e)', bg: 'var(--warning-bg, #fef3c7)' }
      : { text: c.okFields(slot.state.extractedCount), color: 'var(--success-text, #166534)', bg: 'var(--success-bg, #dcfce7)' }
  }

  return (
    <div
      data-testid={`upload-slot-${slot.doc_type}`}
      style={{
        padding: '14px',
        border: '1px solid var(--border)',
        background: 'var(--surface)',
        borderRadius: 12,
      }}
    >
      <p style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-1)', marginBottom: 4 }}>
        {meta.title}
        {!slot.required && (
          <span style={{ fontSize: 11, color: 'var(--text-3)', fontWeight: 600, marginLeft: 8 }}>
            ({c.optional})
          </span>
        )}
      </p>
      <p style={{ fontSize: 12, color: 'var(--text-3)', marginBottom: 10, lineHeight: 1.4 }}>{meta.hint}</p>

      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <button
          type="button"
          disabled={slot.state.kind === 'uploading'}
          onClick={onChoose}
          style={{
            padding: '10px 14px',
            background: 'var(--surface-2)',
            color: 'var(--text-1)',
            border: '1px solid var(--border)',
            borderRadius: 10,
            fontSize: 14,
            fontWeight: 700,
            cursor: slot.state.kind === 'uploading' ? 'wait' : 'pointer',
            opacity: slot.state.kind === 'uploading' ? 0.6 : 1,
          }}
        >
          {action}
        </button>
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={onChange}
          style={{ display: 'none' }}
        />
        {badge && (
          <span
            style={{
              padding: '6px 10px',
              fontSize: 12,
              fontWeight: 700,
              color: badge.color,
              background: badge.bg,
              borderRadius: 999,
            }}
          >
            {badge.text}
          </span>
        )}
      </div>

      {slot.state.kind === 'error' && (
        <p style={{ fontSize: 12, color: 'var(--danger-text, #991b1b)', marginTop: 6 }}>
          {slot.state.message}
        </p>
      )}
    </div>
  )
}
