'use client'

import { useWizard } from '@/contexts/WizardContext'

const T = {
  uk: {
    title: 'Перегляньте ваш пакет',
    subtitle: 'Безкоштовний перегляд — подивіться, що входить до пакету. Завантаження після оплати.',
    packetBadge: (i: number) => `Пакет ${i + 1} · I-131 Re-Parole U4U`,
    readyBadge: 'Готово',
    previewTitle: '📋 Безкоштовний перегляд — що ви отримаєте',
    costSummary: (size: number, price: number, filing: string) =>
      `${size} заявник${size === 1 ? '' : 'ів'} · $${price} сервісний внесок · ${filing}`,
    uscisNote: 'Внески USCIS сплачуються окремо та безпосередньо до USCIS. Перевіряйте поточні суми на uscis.gov/feecalculator.',
    confirmBtn: 'Виглядає добре — підтвердити та оплатити →',
    filingLabels: {
      mail: 'Поштою до USCIS',
      online: 'Онлайн через myUSCIS',
      unsure: 'Спосіб подачі не вибрано',
    },
    files: [
      { icon: '📄', name: 'Форма I-131 (редаговний DOCX)', size: '~120 КБ' },
      { icon: '📋', name: 'Форма I-131 (PDF)', size: '~95 КБ' },
      { icon: '✅', name: 'Контрольний список документів', size: '~40 КБ' },
      { icon: '📝', name: 'Покрокова інструкція передачі до USCIS', size: '~60 КБ' },
    ],
  },
  ru: {
    title: 'Просмотрите ваш пакет',
    subtitle: 'Бесплатный просмотр — посмотрите, что входит в пакет. Скачивание после оплаты.',
    packetBadge: (i: number) => `Пакет ${i + 1} · I-131 Re-Parole U4U`,
    readyBadge: 'Готово',
    previewTitle: '📋 Бесплатный просмотр — что вы получите',
    costSummary: (size: number, price: number, filing: string) =>
      `${size} заявитель${size === 1 ? '' : 'ей'} · $${price} сервисный взнос · ${filing}`,
    uscisNote: 'Взносы USCIS оплачиваются отдельно и непосредственно в USCIS. Проверяйте текущие суммы на uscis.gov/feecalculator.',
    confirmBtn: 'Выглядит хорошо — подтвердить и оплатить →',
    filingLabels: {
      mail: 'Почтой в USCIS',
      online: 'Онлайн через myUSCIS',
      unsure: 'Способ подачи не выбран',
    },
    files: [
      { icon: '📄', name: 'Форма I-131 (редактируемый DOCX)', size: '~120 КБ' },
      { icon: '📋', name: 'Форма I-131 (PDF)', size: '~95 КБ' },
      { icon: '✅', name: 'Контрольный список документов', size: '~40 КБ' },
      { icon: '📝', name: 'Пошаговая инструкция передачи в USCIS', size: '~60 КБ' },
    ],
  },
  en: {
    title: 'Review your packet',
    subtitle: 'Free preview — see what\'s in your packet. Download after payment.',
    packetBadge: (i: number) => `Packet ${i + 1} · I-131 Re-Parole U4U`,
    readyBadge: 'Ready',
    previewTitle: '📋 Free Preview — What you get',
    costSummary: (size: number, price: number, filing: string) =>
      `${size} applicant${size !== 1 ? 's' : ''} · $${price} service fee · ${filing}`,
    uscisNote: 'USCIS filing fees are paid separately and directly to USCIS. Verify current amounts at uscis.gov/feecalculator.',
    confirmBtn: 'Looks good — confirm & pay →',
    filingLabels: {
      mail: 'Mail to USCIS lockbox',
      online: 'Online via myUSCIS',
      unsure: 'Filing method not selected',
    },
    files: [
      { icon: '📄', name: 'Form I-131 (editable DOCX)', size: '~120 KB' },
      { icon: '📋', name: 'Form I-131 (PDF)', size: '~95 KB' },
      { icon: '✅', name: 'Document checklist', size: '~40 KB' },
      { icon: '📝', name: 'Field-by-field USCIS transfer guide', size: '~60 KB' },
    ],
  },
  es: {
    title: 'Revise su paquete',
    subtitle: 'Vista previa gratuita — vea qué hay en su paquete. Descarga después del pago.',
    packetBadge: (i: number) => `Paquete ${i + 1} · I-131 Re-Parole U4U`,
    readyBadge: 'Listo',
    previewTitle: '📋 Vista previa gratuita — qué obtendrá',
    costSummary: (size: number, price: number, filing: string) =>
      `${size} solicitante${size !== 1 ? 's' : ''} · $${price} tarifa de servicio · ${filing}`,
    uscisNote: 'Las tarifas de USCIS se pagan por separado y directamente a USCIS. Verifique los montos actuales en uscis.gov/feecalculator.',
    confirmBtn: 'Todo bien — confirmar y pagar →',
    filingLabels: {
      mail: 'Por correo a USCIS',
      online: 'En línea vía myUSCIS',
      unsure: 'Método de presentación no seleccionado',
    },
    files: [
      { icon: '📄', name: 'Formulario I-131 (DOCX editable)', size: '~120 KB' },
      { icon: '📋', name: 'Formulario I-131 (PDF)', size: '~95 KB' },
      { icon: '✅', name: 'Lista de verificación de documentos', size: '~40 KB' },
      { icon: '📝', name: 'Guía de transferencia de datos a USCIS', size: '~60 KB' },
    ],
  },
} as const

export function Screen09() {
  const { state, setStep } = useWizard()
  const { members, filingMethod, packageSize, packagePrice } = state
  const t = T[state.locale] ?? T.en

  const filingLabel =
    filingMethod === 'mail'
      ? t.filingLabels.mail
      : filingMethod === 'online'
        ? t.filingLabels.online
        : t.filingLabels.unsure

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-[22px] font-bold leading-tight mb-2" style={{ color: 'var(--text-1)' }}>
          {t.title}
        </h1>
        <p className="text-[15px]" style={{ color: 'var(--text-2)' }}>
          {t.subtitle}
        </p>
      </div>

      {/* Member summary */}
      <div className="space-y-2">
        {members.map((member, i) => (
          <div
            key={member.id}
            className="rounded-[12px] p-3.5 flex items-center justify-between"
            style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
          >
            <div>
              <p className="text-[14px] font-semibold" style={{ color: 'var(--text-1)' }}>
                {member.alias || `Person ${i + 1}`}
              </p>
              <p className="text-[12px] mt-0.5" style={{ color: 'var(--text-3)' }}>
                {t.packetBadge(i)}
              </p>
            </div>
            <span
              className="text-[11px] font-bold px-2.5 py-1 rounded-full"
              style={{ background: 'var(--success-bg)', color: 'var(--success-text)' }}
            >
              {t.readyBadge}
            </span>
          </div>
        ))}
      </div>

      {/* Free preview */}
      <div>
        <p
          className="text-[11px] font-semibold uppercase tracking-wide mb-2"
          style={{ color: 'var(--text-3)', letterSpacing: '0.6px' }}
        >
          {t.previewTitle}
        </p>
        <div
          className="rounded-[12px] overflow-hidden"
          style={{ border: '1px solid var(--border)' }}
        >
          {t.files.map((file, idx) => (
            <div
              key={file.name}
              className="flex items-center gap-3 px-3.5 py-3"
              style={{
                borderBottom: idx < t.files.length - 1 ? '1px solid var(--border)' : undefined,
              }}
            >
              <span className="text-[18px] flex-shrink-0">{file.icon}</span>
              <span className="flex-1 text-[14px]" style={{ color: 'var(--text-1)' }}>
                {file.name}
              </span>
              <span className="text-[11px]" style={{ color: 'var(--text-3)' }}>
                {file.size}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Cost summary */}
      <div
        className="rounded-[12px] p-3.5"
        style={{ background: 'var(--info-bg)', border: '1px solid var(--info-border)' }}
      >
        <p className="text-[14px] font-semibold" style={{ color: 'var(--info-text)' }}>
          {t.costSummary(packageSize, packagePrice, filingLabel)}
        </p>
        <p className="text-[12px] mt-1" style={{ color: 'var(--info-text)' }}>
          {t.uscisNote}
        </p>
      </div>

      <button
        type="button"
        onClick={() => setStep(10)}
        className="w-full rounded-[10px] text-[15px] font-bold transition-all active:scale-[0.98]"
        style={{
          background: 'var(--btn-action)',
          color: 'var(--btn-action-text)',
          border: 'none',
          padding: '14px',
          minHeight: '52px',
        }}
      >
        {t.confirmBtn}
      </button>
    </div>
  )
}
