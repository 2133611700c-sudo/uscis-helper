'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { TranslationWizard } from './TranslationWizard'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function TranslationServiceExperience(_props: any) {
  const params = useParams()
  const locale = (params?.locale as string) ?? 'en'

  const [returnUrl, setReturnUrl] = useState<string | null>(null)
  const [fromSource, setFromSource] = useState<string | null>(null)

  // Read ?from= and ?return= params client-side (SSR-safe)
  useEffect(() => {
    const sp = new URLSearchParams(window.location.search)
    const from = sp.get('from')
    const ret = sp.get('return')
    if (from) setFromSource(from)
    if (ret) setReturnUrl(ret)
  }, [])

  return (
    <TranslationWizard
      locale={locale}
      returnUrl={returnUrl}
      fromSource={fromSource}
    />
  )
}
