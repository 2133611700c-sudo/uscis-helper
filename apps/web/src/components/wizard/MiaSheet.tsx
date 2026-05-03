'use client'

import { useEffect, useRef, useState } from 'react'
import { X, Send } from 'lucide-react'
import { useWizard } from '@/contexts/WizardContext'

// ---------------------------------------------------------------------------
// API call to real Mia backend
// ---------------------------------------------------------------------------

interface MiaChatResponse {
  answer: string
  disclaimer: string
}

async function callMiaApi(
  message: string,
  locale: string,
  serviceSlug: string,
): Promise<{ answer: string; disclaimer: string; unavailable?: boolean }> {
  try {
    const res = await fetch('/api/mia/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message, locale, serviceSlug }),
    })

    if (res.status === 503) {
      return {
        answer: '',
        disclaimer: '',
        unavailable: true,
      }
    }

    if (!res.ok) {
      return {
        answer: 'Something went wrong. Please try again.',
        disclaimer: 'Information only. Not legal advice.',
      }
    }

    const data = await res.json() as MiaChatResponse
    return {
      answer: data.answer ?? '',
      disclaimer: data.disclaimer ?? 'Information only. Not legal advice.',
    }
  } catch {
    return {
      answer: '',
      disclaimer: '',
      unavailable: true,
    }
  }
}

// ---------------------------------------------------------------------------
// Chat bubble
// ---------------------------------------------------------------------------

interface BubbleProps {
  role: 'user' | 'assistant'
  content: string
  disclaimer?: string
}

function Bubble({ role, content, disclaimer }: BubbleProps) {
  const isUser = role === 'user'

  // Render simple markdown-style bold (**text**)
  const parts = content.split(/\*\*(.+?)\*\*/g)
  const rendered = parts.map((p, i) =>
    i % 2 === 1 ? <strong key={i}>{p}</strong> : p,
  )

  return (
    <div className={['flex w-full flex-col', isUser ? 'items-end' : 'items-start'].join(' ')}>
      <div className={['flex w-full', isUser ? 'justify-end' : 'justify-start'].join(' ')}>
        {!isUser && (
          <span
            aria-hidden="true"
            className="mr-2 mt-1 flex-shrink-0 w-7 h-7 rounded-full bg-blue-100 flex items-center justify-center text-base select-none"
          >
            🤝
          </span>
        )}
        <div
          className={[
            'max-w-[80%] rounded-2xl px-4 py-2 text-sm leading-relaxed',
            isUser
              ? 'bg-blue-600 text-white rounded-br-sm'
              : 'bg-slate-100 text-slate-800 rounded-bl-sm',
          ].join(' ')}
        >
          {rendered}
        </div>
      </div>
      {disclaimer && !isUser && (
        <p className="mt-1 ml-9 text-[10px] text-slate-400 italic">{disclaimer}</p>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// MiaSheet
// ---------------------------------------------------------------------------

export function MiaSheet() {
  const { state, setMiaOpen, addMiaMessage } = useWizard()
  const { miaOpen, miaMessages, locale, serviceSlug } = state

  const [inputValue, setInputValue] = useState('')
  const [isThinking, setIsThinking] = useState(false)
  const [unavailable, setUnavailable] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Scroll to bottom on new messages or thinking state change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [miaMessages, isThinking])

  // Focus input when sheet opens
  useEffect(() => {
    if (miaOpen) {
      const t = setTimeout(() => inputRef.current?.focus(), 100)
      return () => clearTimeout(t)
    }
  }, [miaOpen])

  async function handleSend() {
    const text = inputValue.trim()
    if (!text || isThinking) return

    setInputValue('')
    setUnavailable(false)
    addMiaMessage({ role: 'user', content: text })

    setIsThinking(true)

    const result = await callMiaApi(text, locale, serviceSlug)

    setIsThinking(false)

    if (result.unavailable) {
      setUnavailable(true)
      return
    }

    if (result.answer) {
      addMiaMessage({ role: 'assistant', content: result.answer })
      // Store disclaimer on the message — we pass it as a separate field via a wrapper
      // Since miaMessages only stores {role, content, ts}, we append disclaimer inline
      // The Bubble component below reads disclaimer from a parallel state
      // For simplicity: append disclaimer as a separate context note via state
      if (result.disclaimer) {
        // Store disclaimer alongside answer in a combined way
        // We use a local disclaimer map keyed by timestamp
        setLastDisclaimer(result.disclaimer)
      }
    }
  }

  const [lastDisclaimer, setLastDisclaimer] = useState<string>('')

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      void handleSend()
    }
  }

  if (!miaOpen) return null

  return (
    <>
      {/* Backdrop */}
      <div
        aria-hidden="true"
        className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm"
        onClick={() => setMiaOpen(false)}
      />

      {/* Sheet / Modal */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Mia assistant"
        className={[
          // Mobile: full-height sheet from bottom
          'fixed inset-x-0 bottom-0 z-50',
          'flex flex-col',
          'bg-white rounded-t-2xl shadow-2xl',
          'h-[92dvh]',
          // Desktop: centered modal
          'sm:inset-auto sm:top-1/2 sm:left-1/2',
          'sm:-translate-x-1/2 sm:-translate-y-1/2',
          'sm:w-[480px] sm:h-[600px] sm:rounded-2xl',
        ].join(' ')}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 flex-shrink-0">
          <div className="flex items-center gap-2">
            <span aria-hidden="true" className="text-xl">🤝</span>
            <span className="font-semibold text-slate-800 text-base">Mia</span>
          </div>
          <button
            type="button"
            aria-label="Close"
            onClick={() => setMiaOpen(false)}
            className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-3 min-h-0">
          {miaMessages.length === 0 && (
            <div className="text-center text-sm text-slate-500 mt-8 space-y-2">
              <p aria-hidden="true" className="text-2xl">👋</p>
              <p className="font-medium text-slate-700">Hi, I&apos;m Mia!</p>
              <p>
                I can answer questions about the Re-Parole U4U process. What would you
                like to know?
              </p>
            </div>
          )}

          {miaMessages.map((msg, idx) => {
            // Show disclaimer only on the last assistant message
            const isLastAssistant =
              msg.role === 'assistant' && idx === miaMessages.length - 1
            return (
              <Bubble
                key={msg.ts}
                role={msg.role}
                content={msg.content}
                disclaimer={isLastAssistant ? lastDisclaimer : undefined}
              />
            )
          })}

          {isThinking && (
            <div className="flex items-center gap-2 text-sm text-slate-500">
              <span
                aria-hidden="true"
                className="flex-shrink-0 w-7 h-7 rounded-full bg-blue-100 flex items-center justify-center text-base"
              >
                🤝
              </span>
              <span className="italic">Mia is thinking…</span>
              <span aria-hidden="true" className="flex gap-1">
                {[0, 1, 2].map((i) => (
                  <span
                    key={i}
                    className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce"
                    style={{ animationDelay: `${i * 150}ms` }}
                  />
                ))}
              </span>
            </div>
          )}

          {unavailable && (
            <div className="rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-800">
              AI assistant is temporarily unavailable. You can still use the service checklist.
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input area */}
        <div className="flex-shrink-0 border-t border-slate-200 px-3 py-3 flex gap-2 items-center">
          <input
            ref={inputRef}
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask a question about Re-Parole U4U…"
            disabled={isThinking}
            className={[
              'flex-1 rounded-xl border border-slate-300 bg-white',
              'px-4 py-2.5 text-sm',
              'placeholder:text-slate-400',
              'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent',
              'disabled:opacity-50',
              'transition-colors',
            ].join(' ')}
          />
          <button
            type="button"
            onClick={() => void handleSend()}
            disabled={!inputValue.trim() || isThinking}
            aria-label="Send"
            className={[
              'flex-shrink-0 flex items-center justify-center',
              'w-10 h-10 rounded-xl',
              'bg-blue-600 text-white',
              'hover:bg-blue-700 active:scale-95',
              'disabled:opacity-40 disabled:cursor-not-allowed',
              'transition-all duration-150',
            ].join(' ')}
          >
            <Send className="w-4 h-4" />
          </button>
        </div>

        {/* Disclaimer */}
        <p className="flex-shrink-0 text-center text-[10px] text-slate-400 pb-2">
          Information only. Not legal advice.
        </p>
      </div>
    </>
  )
}
