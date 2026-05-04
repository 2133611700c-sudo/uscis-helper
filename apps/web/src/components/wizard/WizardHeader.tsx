'use client'

import { LanguageSwitcher } from './LanguageSwitcher'
import { ThemeToggle } from './ThemeToggle'
import { useWizard } from '@/contexts/WizardContext'

const TOTAL_STEPS = 12

const STEP_LABELS: Record<string, Record<number, string>> = {
  uk: {
    0: 'Вступ', 1: 'Перевірка', 2: 'Пакет', 3: 'Сім\'я', 4: 'Документи',
    5: 'Розпізнавання', 6: 'Підтвердження', 7: 'Відомості', 8: 'Спосіб подачі',
    9: 'Перегляд', 10: 'Оплата', 11: 'Завантаження', 12: 'Передача',
  },
  ru: {
    0: 'Введение', 1: 'Проверка', 2: 'Пакет', 3: 'Семья', 4: 'Документы',
    5: 'Распознавание', 6: 'Подтверждение', 7: 'Сведения', 8: 'Способ подачи',
    9: 'Просмотр', 10: 'Оплата', 11: 'Загрузка', 12: 'Передача',
  },
  en: {
    0: 'Welcome', 1: 'Eligibility', 2: 'Package', 3: 'Family', 4: 'Documents',
    5: 'Recognition', 6: 'Checklist', 7: 'Evidence', 8: 'Filing Method',
    9: 'Preview', 10: 'Payment', 11: 'Download', 12: 'Transfer',
  },
  es: {
    0: 'Bienvenido', 1: 'Elegibilidad', 2: 'Paquete', 3: 'Familia', 4: 'Documentos',
    5: 'Reconocimiento', 6: 'Confirmación', 7: 'Evidencia', 8: 'Método de presentación',
    9: 'Vista previa', 10: 'Pago', 11: 'Descarga', 12: 'Transferencia',
  },
}

const STEP_PROGRESS = {
  uk: (s: number, t: number) => `Крок ${s} з ${t}`,
  ru: (s: number, t: number) => `Шаг ${s} из ${t}`,
  en: (s: number, t: number) => `Step ${s} of ${t}`,
  es: (s: number, t: number) => `Paso ${s} de ${t}`,
} as const

const SYNC_LABELS = {
  uk: { saving: 'Зберігаємо…', saved: '✓ Збережено', error: 'Помилка збереження' },
  ru: { saving: 'Сохраняем…', saved: '✓ Сохранено', error: 'Ошибка сохранения' },
  en: { saving: 'Saving…', saved: '✓ Saved', error: 'Could not save' },
  es: { saving: 'Guardando…', saved: '✓ Guardado', error: 'Error al guardar' },
} as const

function SyncIndicator() {
  const { syncStatus, state } = useWizard()
  const labels = SYNC_LABELS[state.locale] ?? SYNC_LABELS.en

  if (syncStatus === 'idle') return null

  const label =
    syncStatus === 'saving' ? labels.saving
    : syncStatus === 'saved' ? labels.saved
    : labels.error

  const color =
    syncStatus === 'saving' ? 'var(--text-3)'
    : syncStatus === 'saved' ? 'var(--success)'
    : 'var(--warning-text)'

  return (
    <span
      className="text-[11px] font-medium flex items-center gap-1"
      style={{ color }}
    >
      <span
        className="w-[5px] h-[5px] rounded-full inline-block"
        style={{ background: color, animation: syncStatus === 'saving' ? 'pulse 1s infinite' : undefined }}
      />
      {label}
    </span>
  )
}

function ProgressDots({ step }: { step: number }) {
  return (
    <div className="flex items-center gap-1">
      {Array.from({ length: TOTAL_STEPS + 1 }).map((_, i) => {
        const isDone = i < step
        const isActive = i === step
        return (
          <span
            key={i}
            style={{
              width: isActive ? '18px' : '6px',
              height: '6px',
              borderRadius: isActive ? '3px' : '50%',
              background: isActive ? 'var(--primary)' : isDone ? 'var(--primary)' : 'var(--border-strong)',
              opacity: isDone && !isActive ? 0.5 : 1,
              transition: 'all 0.2s',
              flexShrink: 0,
              display: 'inline-block',
            }}
          />
        )
      })}
    </div>
  )
}

/**
 * Sticky header — 2 rows matching prototype:
 *   Row 1: progress dots | lang + theme
 *   Row 2: step label    | sync status
 */
export function WizardHeader() {
  const { state } = useWizard()
  const labels = STEP_LABELS[state.locale] ?? STEP_LABELS.en
  const stepLabel = labels[state.step] ?? `${state.step + 1}`
  const progressFn = STEP_PROGRESS[state.locale] ?? STEP_PROGRESS.en

  return (
    <header
      className="sticky top-0 z-50 px-4 py-2.5 flex flex-col gap-1.5"
      style={{
        background: 'var(--surface)',
        borderBottom: '1px solid var(--border)',
      }}
    >
      {/* Row 1: progress + lang/theme */}
      <div className="flex items-center justify-between gap-2">
        <ProgressDots step={state.step} />
        <div className="flex items-center gap-2 flex-shrink-0">
          <LanguageSwitcher />
          <ThemeToggle />
        </div>
      </div>

      {/* Row 2: step label + sync status */}
      <div className="flex items-center justify-between gap-2">
        <span
          className="text-[12px] font-semibold"
          style={{ color: 'var(--text-2)', fontVariantNumeric: 'tabular-nums' }}
        >
          {progressFn(state.step + 1, TOTAL_STEPS + 1)} · {stepLabel}
        </span>
        <SyncIndicator />
      </div>
    </header>
  )
}
