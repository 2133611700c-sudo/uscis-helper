'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type FamilyMember = {
  id: string
  alias: string
  docs: Record<string, { storageKey: string; status: 'pending' | 'uploading' | 'done' | 'error' }>
  fields: Record<string, string>
  manualAnswers: Record<string, string>
}

export type WizardState = {
  sessionId: string
  anonUserId: string
  step: number
  locale: 'ru' | 'uk' | 'en' | 'es'
  theme: 'light' | 'dark'
  serviceSlug: string
  packageSize: number
  packagePrice: number
  members: FamilyMember[]
  filingMethod: 'mail' | 'online' | null
  paymentStatus: 'unpaid' | 'paid' | 'mock_paid'
  downloadUrl: string | null
  transferEmail: string | null
  miaOpen: boolean
  miaMessages: Array<{ role: 'user' | 'assistant'; content: string; ts: number }>
}

// ---------------------------------------------------------------------------
// Pricing
// ---------------------------------------------------------------------------

/** Base prices for 1-6 people. Each additional person beyond 6 adds $10. */
const BASE_PRICES = [15, 25, 35, 45, 55, 65] as const

export function calcPrice(size: number): number {
  if (size <= 0) return 0
  if (size <= 6) return BASE_PRICES[size - 1]
  return BASE_PRICES[5] + (size - 6) * 10
}

// ---------------------------------------------------------------------------
// UUID v4
// ---------------------------------------------------------------------------

function uuidV4(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    const v = c === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}

// ---------------------------------------------------------------------------
// localStorage helpers
// ---------------------------------------------------------------------------

const LS_KEY = 'wizard:re-parole-u4u:state'

type PersistedSlice = {
  sessionId: string
  anonUserId: string
  step: number
  locale: WizardState['locale']
  theme: WizardState['theme']
}

function loadPersisted(): PersistedSlice | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(LS_KEY)
    if (!raw) return null
    return JSON.parse(raw) as PersistedSlice
  } catch {
    return null
  }
}

function savePersisted(slice: PersistedSlice): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(LS_KEY, JSON.stringify(slice))
  } catch {
    // quota exceeded or private mode — silently ignore
  }
}

// ---------------------------------------------------------------------------
// Default member factory
// ---------------------------------------------------------------------------

function makeMember(index: number): FamilyMember {
  return {
    id: uuidV4(),
    alias: `Person ${index + 1}`,
    docs: {},
    fields: {},
    manualAnswers: {},
  }
}

function buildMembers(size: number, existing: FamilyMember[]): FamilyMember[] {
  if (size <= 0) return []
  const next: FamilyMember[] = []
  for (let i = 0; i < size; i++) {
    next.push(existing[i] ?? makeMember(i))
  }
  return next
}

// ---------------------------------------------------------------------------
// Initial state
// ---------------------------------------------------------------------------

function buildInitialState(): WizardState {
  const persisted = loadPersisted()

  const sessionId = persisted?.sessionId ?? uuidV4()
  const anonUserId = persisted?.anonUserId ?? uuidV4()
  const step = persisted?.step ?? 0
  const locale = persisted?.locale ?? 'en'
  const theme = persisted?.theme ?? 'light'
  const packageSize = 1

  return {
    sessionId,
    anonUserId,
    step,
    locale,
    theme,
    serviceSlug: 're-parole-u4u',
    packageSize,
    packagePrice: calcPrice(packageSize),
    members: [makeMember(0)],
    filingMethod: null,
    paymentStatus: 'unpaid',
    downloadUrl: null,
    transferEmail: null,
    miaOpen: false,
    miaMessages: [],
  }
}

// ---------------------------------------------------------------------------
// Context value type
// ---------------------------------------------------------------------------

type WizardContextValue = {
  state: WizardState
  setStep: (step: number) => void
  setLocale: (locale: WizardState['locale']) => void
  setTheme: (theme: WizardState['theme']) => void
  setPackageSize: (size: number) => void
  setFilingMethod: (method: WizardState['filingMethod']) => void
  setMember: (id: string, patch: Partial<FamilyMember>) => void
  setMiaOpen: (open: boolean) => void
  addMiaMessage: (msg: { role: 'user' | 'assistant'; content: string }) => void
  setPaymentStatus: (status: WizardState['paymentStatus']) => void
  setDownloadUrl: (url: string | null) => void
  setTransferEmail: (email: string | null) => void
}

const WizardContext = createContext<WizardContextValue | null>(null)

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

export function WizardProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<WizardState>(buildInitialState)

  // Persist critical slice on every state change
  useEffect(() => {
    savePersisted({
      sessionId: state.sessionId,
      anonUserId: state.anonUserId,
      step: state.step,
      locale: state.locale,
      theme: state.theme,
    })
  }, [state.sessionId, state.anonUserId, state.step, state.locale, state.theme])

  const setStep = useCallback((step: number) => {
    setState((s) => ({ ...s, step }))
  }, [])

  const setLocale = useCallback((locale: WizardState['locale']) => {
    setState((s) => ({ ...s, locale }))
  }, [])

  const setTheme = useCallback((theme: WizardState['theme']) => {
    setState((s) => ({ ...s, theme }))
  }, [])

  const setPackageSize = useCallback((size: number) => {
    setState((s) => ({
      ...s,
      packageSize: size,
      packagePrice: calcPrice(size),
      members: buildMembers(size, s.members),
    }))
  }, [])

  const setFilingMethod = useCallback((method: WizardState['filingMethod']) => {
    setState((s) => ({ ...s, filingMethod: method }))
  }, [])

  const setMember = useCallback((id: string, patch: Partial<FamilyMember>) => {
    setState((s) => ({
      ...s,
      members: s.members.map((m) => (m.id === id ? { ...m, ...patch } : m)),
    }))
  }, [])

  const setMiaOpen = useCallback((open: boolean) => {
    setState((s) => ({ ...s, miaOpen: open }))
  }, [])

  const addMiaMessage = useCallback(
    (msg: { role: 'user' | 'assistant'; content: string }) => {
      setState((s) => ({
        ...s,
        miaMessages: [...s.miaMessages, { ...msg, ts: Date.now() }],
      }))
    },
    [],
  )

  const setPaymentStatus = useCallback((status: WizardState['paymentStatus']) => {
    setState((s) => ({ ...s, paymentStatus: status }))
  }, [])

  const setDownloadUrl = useCallback((url: string | null) => {
    setState((s) => ({ ...s, downloadUrl: url }))
  }, [])

  const setTransferEmail = useCallback((email: string | null) => {
    setState((s) => ({ ...s, transferEmail: email }))
  }, [])

  const value = useMemo<WizardContextValue>(
    () => ({
      state,
      setStep,
      setLocale,
      setTheme,
      setPackageSize,
      setFilingMethod,
      setMember,
      setMiaOpen,
      addMiaMessage,
      setPaymentStatus,
      setDownloadUrl,
      setTransferEmail,
    }),
    [
      state,
      setStep,
      setLocale,
      setTheme,
      setPackageSize,
      setFilingMethod,
      setMember,
      setMiaOpen,
      addMiaMessage,
      setPaymentStatus,
      setDownloadUrl,
      setTransferEmail,
    ],
  )

  return <WizardContext.Provider value={value}>{children}</WizardContext.Provider>
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useWizard(): WizardContextValue {
  const ctx = useContext(WizardContext)
  if (!ctx) {
    throw new Error('useWizard must be used inside <WizardProvider>')
  }
  return ctx
}
