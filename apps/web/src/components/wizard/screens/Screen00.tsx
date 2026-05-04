'use client'

import { useWizard } from '@/contexts/WizardContext'

// ---------------------------------------------------------------------------
// Inline translations — avoids any next-intl dependency inside the wizard
// ---------------------------------------------------------------------------

const T = {
  uk: {
    welcomeBack: 'Ласкаво просимо назад!',
    welcomeBackDesc: 'У вас є незавершена заявка. Продовжити з того місця?',
    continueBtn: (step: number) => `Продовжити (крок ${step})`,
    startOver: 'Почати знову',
    sourceBadge: 'Джерело: USCIS',
    title: 'Продовження паролю для',
    subtitle: 'Ми допомагаємо підготувати чернетку Form I-131. Завантажте документи — ми формуємо пакет. Ви самі перевіряєте, підписуєте і подаєте до USCIS.',
    payTitle: 'Що ви платите',
    messenginfoFee: 'Сервісна плата Messenginfo',
    messenginfoFeeDesc: 'Підготовка форми + завантаження пакету',
    uscisFee: 'Державне мито USCIS',
    uscisFeeDesc: 'Сплачується напряму в USCIS при подачі',
    uscisNote: '* Більшість учасників U4U не платять державне мито. Перевірте на uscis.gov перед подачею.',
    whatYouGet: 'Що ви отримаєте',
    gets: [
      'Заповнена форма I-131 (DOCX + PDF)',
      'Готовий пакет документів для USCIS',
      'Контрольний список документів',
      'Зручне перенесення даних поле за полем',
      'Усі документи — завантажити або отримати на email',
    ],
    disclaimer: 'Messenginfo готує документи для самостійної подачі. Вся інформація — лише для довідки. Ви подаєте самі на my.uscis.gov або поштою.',
    receiptTitle: 'Вже є номер квитанції?',
    receiptDesc: 'Якщо у вас є справа в USCIS — спочатку перевірте її статус.',
    receiptBtn: 'Перевірити статус на USCIS ↗',
    receiptNote: 'Номер квитанції — 13 символів: 3 букви (IOE/WAC/LIN/SRC/NBC/MSC) + 10 цифр. Знаходиться в повідомленні від USCIS. Відкриває офіційний сайт USCIS — ми не зберігаємо ваш номер.',
    startBtn: 'Почати →',
  },
  ru: {
    welcomeBack: 'Добро пожаловать назад!',
    welcomeBackDesc: 'У вас есть незавершённая заявка. Продолжить с того места?',
    continueBtn: (step: number) => `Продолжить (шаг ${step})`,
    startOver: 'Начать заново',
    sourceBadge: 'Источник: USCIS',
    title: 'Продление пароля для',
    subtitle: 'Мы помогаем подготовить черновик Form I-131. Загрузите документы — мы формируем пакет. Вы сами проверяете, подписываете и подаёте в USCIS.',
    payTitle: 'Что вы платите',
    messenginfoFee: 'Сервисная плата Messenginfo',
    messenginfoFeeDesc: 'Подготовка формы + скачивание пакета',
    uscisFee: 'Государственная пошлина USCIS',
    uscisFeeDesc: 'Оплачивается напрямую в USCIS при подаче',
    uscisNote: '* Большинство участников U4U не платят государственную пошлину. Проверьте на uscis.gov перед подачей.',
    whatYouGet: 'Что вы получите',
    gets: [
      'Заполненная форма I-131 (DOCX + PDF)',
      'Готовый пакет документов для USCIS',
      'Контрольный список документов',
      'Удобный перенос данных поле за полем',
      'Все документы — скачать или получить на email',
    ],
    disclaimer: 'Messenginfo готовит документы для самостоятельной подачи. Вся информация — только для справки. Вы подаёте сами на my.uscis.gov или по почте.',
    receiptTitle: 'Уже есть номер квитанции?',
    receiptDesc: 'Если у вас есть дело в USCIS — сначала проверьте его статус.',
    receiptBtn: 'Проверить статус на USCIS ↗',
    receiptNote: 'Номер квитанции — 13 символов: 3 буквы (IOE/WAC/LIN/SRC/NBC/MSC) + 10 цифр. Находится в уведомлении от USCIS. Открывает официальный сайт USCIS — мы не храним ваш номер.',
    startBtn: 'Начать →',
  },
  en: {
    welcomeBack: 'Welcome back!',
    welcomeBackDesc: 'You have an unfinished application. Continue where you left off?',
    continueBtn: (step: number) => `Continue (Step ${step})`,
    startOver: 'Start over',
    sourceBadge: 'Source: USCIS',
    title: 'Re-Parole for',
    subtitle: 'We help you prepare a Form I-131 draft. Upload your documents — we build the packet. You review, sign, and file with USCIS yourself.',
    payTitle: 'What You Pay',
    messenginfoFee: 'Messenginfo service fee',
    messenginfoFeeDesc: 'Form preparation + packet download',
    uscisFee: 'USCIS government fee',
    uscisFeeDesc: 'Paid directly to USCIS when you file',
    uscisNote: '* Most U4U Re-Parole applicants pay no USCIS fee. Verify at uscis.gov before filing.',
    whatYouGet: 'What you get',
    gets: [
      'Completed I-131 (editable DOCX + PDF)',
      'Ready-to-submit document packet for USCIS',
      'Document checklist',
      'Easy field-by-field transfer to your filing device',
      'All documents — download or receive via email',
    ],
    disclaimer: 'Messenginfo prepares documents for self-filing. All information is for guidance only. You file yourself at my.uscis.gov or by mail.',
    receiptTitle: 'Already have a Receipt Number?',
    receiptDesc: 'If you have a pending USCIS case — check its status first.',
    receiptBtn: 'Check status on USCIS ↗',
    receiptNote: 'Receipt number — 13 chars: 3 letters (IOE/WAC/LIN/SRC/NBC/MSC) + 10 digits. Found in your USCIS notice. Opens the official USCIS site — we don\'t store your number.',
    startBtn: 'Start →',
  },
  es: {
    welcomeBack: '¡Bienvenido de nuevo!',
    welcomeBackDesc: 'Tiene una solicitud sin terminar. ¿Continuar donde lo dejó?',
    continueBtn: (step: number) => `Continuar (Paso ${step})`,
    startOver: 'Comenzar de nuevo',
    sourceBadge: 'Fuente: USCIS',
    title: 'Re-Parole para',
    subtitle: 'Le ayudamos a preparar un borrador del Formulario I-131. Cargue sus documentos — preparamos el paquete. Usted revisa, firma y presenta ante USCIS.',
    payTitle: 'Lo que paga',
    messenginfoFee: 'Tarifa de servicio Messenginfo',
    messenginfoFeeDesc: 'Preparación del formulario + descarga del paquete',
    uscisFee: 'Tarifa gubernamental de USCIS',
    uscisFeeDesc: 'Pagada directamente a USCIS al presentar',
    uscisNote: '* La mayoría de los solicitantes U4U no pagan tarifa de USCIS. Verifique en uscis.gov antes de presentar.',
    whatYouGet: 'Lo que obtiene',
    gets: [
      'Formulario I-131 completo (DOCX + PDF editable)',
      'Paquete de documentos listo para enviar a USCIS',
      'Lista de verificación de documentos',
      'Transferencia campo por campo a su dispositivo de presentación',
      'Todos los documentos — descargar o recibir por correo electrónico',
    ],
    disclaimer: 'Messenginfo prepara documentos para presentación propia. Toda la información es solo orientativa. Usted presenta por sí mismo en my.uscis.gov o por correo.',
    receiptTitle: '¿Ya tiene un número de recibo?',
    receiptDesc: 'Si tiene un caso pendiente en USCIS — verifique su estado primero.',
    receiptBtn: 'Verificar estado en USCIS ↗',
    receiptNote: 'Número de recibo — 13 caracteres: 3 letras (IOE/WAC/LIN/SRC/NBC/MSC) + 10 dígitos. Está en su notificación de USCIS. Abre el sitio oficial de USCIS — no almacenamos su número.',
    startBtn: 'Comenzar →',
  },
} as const

export function Screen00() {
  const { state, setStep } = useWizard()
  const isReturning = Boolean(state.sessionId) && state.step > 0
  const t = T[state.locale] ?? T.en

  return (
    <div className="space-y-4">

      {/* Welcome-back card (returning users) */}
      {isReturning && (
        <div
          className="rounded-[12px] p-4"
          style={{
            background: 'var(--info-bg)',
            border: '1.5px solid var(--info-border)',
          }}
        >
          <h3 className="text-[16px] font-semibold mb-1.5" style={{ color: 'var(--info-text)' }}>
            {t.welcomeBack}
          </h3>
          <p className="text-[13px] mb-3" style={{ color: 'var(--info-text)' }}>
            {t.welcomeBackDesc}
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setStep(state.step)}
              className="flex-1 rounded-[8px] text-[14px] font-semibold transition-all active:scale-95"
              style={{
                background: 'var(--primary)',
                color: '#fff',
                border: 'none',
                padding: '10px',
                minHeight: '44px',
              }}
            >
              {t.continueBtn(state.step + 1)}
            </button>
            <button
              type="button"
              onClick={() => setStep(1)}
              className="rounded-[8px] text-[13px] font-medium transition-all active:scale-95"
              style={{
                background: 'var(--surface)',
                border: '1px solid var(--border-strong)',
                color: 'var(--text-1)',
                padding: '10px 14px',
                minHeight: '44px',
              }}
            >
              {t.startOver}
            </button>
          </div>
        </div>
      )}

      {/* Badges */}
      <div className="flex gap-2 flex-wrap">
        <span
          className="text-[12px] font-semibold px-2.5 py-1 rounded-full"
          style={{ background: 'var(--info-bg)', color: 'var(--info-text)' }}
        >
          Form I-131
        </span>
        <span
          className="text-[12px] font-semibold px-2.5 py-1 rounded-full"
          style={{ background: 'var(--surface-2)', color: 'var(--text-2)', border: '1px solid var(--border)' }}
        >
          Edition 01/20/25
        </span>
        <span
          className="text-[12px] font-semibold px-2.5 py-1 rounded-full"
          style={{ background: 'var(--success-bg)', color: 'var(--success-text)' }}
        >
          {t.sourceBadge}
        </span>
      </div>

      {/* Title */}
      <div>
        <h1 className="text-[22px] font-bold leading-tight mb-2" style={{ color: 'var(--text-1)' }}>
          {t.title}{' '}
          <span style={{ color: 'var(--primary)' }}>U4U</span>
        </h1>
        <p className="text-[15px] leading-relaxed" style={{ color: 'var(--text-2)' }}>
          {t.subtitle}
        </p>
      </div>

      {/* Fee block — transparent split */}
      <div
        className="rounded-[12px] p-3.5 space-y-2.5"
        style={{
          background: 'var(--surface)',
          border: '2px solid var(--primary)',
        }}
      >
        <p
          className="text-[11px] font-semibold uppercase tracking-wide"
          style={{ color: 'var(--text-3)', letterSpacing: '0.6px' }}
        >
          {t.payTitle}
        </p>
        {/* Row 1: Messenginfo */}
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="text-[13px] font-semibold" style={{ color: 'var(--text-1)' }}>{t.messenginfoFee}</p>
            <p className="text-[11px]" style={{ color: 'var(--text-3)' }}>{t.messenginfoFeeDesc}</p>
          </div>
          <span className="text-[16px] font-bold flex-shrink-0" style={{ color: 'var(--primary)', fontVariantNumeric: 'tabular-nums' }}>
            from $15
          </span>
        </div>
        {/* Divider */}
        <div style={{ borderTop: '1px solid var(--border)' }} />
        {/* Row 2: USCIS */}
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="text-[13px] font-semibold" style={{ color: 'var(--text-1)' }}>{t.uscisFee}</p>
            <p className="text-[11px]" style={{ color: 'var(--text-3)' }}>{t.uscisFeeDesc}</p>
          </div>
          <span className="text-[16px] font-bold flex-shrink-0" style={{ color: 'var(--success)', fontVariantNumeric: 'tabular-nums' }}>
            $0*
          </span>
        </div>
        <p className="text-[10px]" style={{ color: 'var(--text-3)' }}>
          {t.uscisNote}
        </p>
      </div>

      {/* What you get */}
      <div
        className="rounded-[12px] p-3.5"
        style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
      >
        <p
          className="text-[11px] font-semibold uppercase tracking-wide mb-3"
          style={{ color: 'var(--text-3)', letterSpacing: '0.6px' }}
        >
          {t.whatYouGet}
        </p>
        {t.gets.map((item) => (
          <div key={item} className="flex gap-2.5 py-1.5 text-[14px]" style={{ color: 'var(--text-1)' }}>
            <span className="font-bold w-[18px] flex-shrink-0" style={{ color: 'var(--success)' }}>✓</span>
            <span>{item}</span>
          </div>
        ))}
      </div>

      {/* Disclaimer */}
      <div
        className="rounded-[12px] p-3.5 text-[13px] leading-relaxed"
        style={{ background: 'var(--surface-2)', color: 'var(--text-2)', border: '1px solid var(--border)' }}
      >
        <strong style={{ color: 'var(--text-1)' }}>Messenginfo</strong> {t.disclaimer}
      </div>

      {/* Citation */}
      <p className="text-[11px]" style={{ color: 'var(--text-3)', paddingTop: '8px', borderTop: '1px solid var(--border)' }}>
        <a href="https://www.uscis.gov/i-131" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--primary)', fontWeight: 600 }}>
          USCIS · Form I-131
        </a>
        {' · '}
        <a href="https://www.uscis.gov/forms/forms-updates" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--primary)', fontWeight: 600 }}>
          Forms Updates
        </a>
        <br />
        Edition 01/20/25
      </p>

      {/* Receipt number check */}
      <div
        className="rounded-[12px] p-3.5"
        style={{ background: 'var(--info-bg)', border: '1px solid var(--info-border)' }}
      >
        <p className="text-[14px] font-semibold mb-1.5" style={{ color: 'var(--info-text)' }}>
          {t.receiptTitle}
        </p>
        <p className="text-[13px] mb-3" style={{ color: 'var(--info-text)' }}>
          {t.receiptDesc}
        </p>
        <a
          href="https://egov.uscis.gov/casestatus/landing.do"
          target="_blank"
          rel="noopener noreferrer"
          className="block w-full text-center rounded-[8px] text-[14px] font-semibold no-underline transition-all active:scale-95 mb-2"
          style={{
            background: 'var(--primary)',
            color: '#fff',
            padding: '11px',
            minHeight: '44px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {t.receiptBtn}
        </a>
        <p className="text-[11px] mt-2" style={{ color: 'var(--text-3)' }}>
          {t.receiptNote}
        </p>
      </div>

      {/* CTA */}
      <button
        type="button"
        onClick={() => setStep(1)}
        className="w-full rounded-[10px] text-[16px] font-bold transition-all active:scale-[0.98]"
        style={{
          background: 'var(--btn-action)',
          color: 'var(--btn-action-text)',
          border: 'none',
          padding: '16px',
          minHeight: '56px',
        }}
      >
        {t.startBtn}
      </button>
    </div>
  )
}
