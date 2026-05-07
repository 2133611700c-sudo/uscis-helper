'use server'

import { createAdminSupabaseClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'

const LANG_LABELS: Record<string, string> = {
  ru: 'Russian',
  uk: 'Ukrainian',
  'uk-soviet': 'Ukrainian (Soviet era)',
}

export async function sendTranslation(formData: FormData) {
  const id             = formData.get('id')             as string
  const recipientEmail = formData.get('recipientEmail') as string
  const docType        = formData.get('docType')        as string
  const sourceLang     = formData.get('sourceLang')     as string

  if (!id || !recipientEmail || !docType) {
    throw new Error('Missing required fields')
  }

  // Collect translated_fields from form (keys prefixed with "tf_")
  const translatedFields: Record<string, string> = {}
  for (const [key, value] of formData.entries()) {
    if (key.startsWith('tf_') && typeof value === 'string' && value.trim()) {
      translatedFields[key.slice(3)] = value.trim()
    }
  }

  if (Object.keys(translatedFields).length === 0) {
    throw new Error('No translated fields provided')
  }

  const originalLanguage = LANG_LABELS[sourceLang] ?? 'Ukrainian'

  // 1. Send translation email to client
  const emailRes = await fetch(`${process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'}/api/translation/email`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email:       recipientEmail.trim().toLowerCase(),
      prodId:      docType,
      fieldValues: translatedFields,
      srcLang:     originalLanguage,
      docLabel:    docType.replace(/_/g, ' '),
    }),
  })

  if (!emailRes.ok) {
    const body = await emailRes.json().catch(() => ({}))
    throw new Error(`Email send failed: ${(body as { error?: string }).error ?? emailRes.status}`)
  }

  // 2. Update queue row: status=completed, reviewed_at=now(), store translated_fields
  const supabase = createAdminSupabaseClient()
  const { error } = await supabase
    .from('manual_review_queue')
    .update({
      status:            'completed',
      reviewed_at:       new Date().toISOString(),
      reviewed_by:       'admin',
      translated_fields: translatedFields,
    })
    .eq('id', id)

  if (error) {
    throw new Error(`Supabase update failed: ${error.message}`)
  }

  redirect('/admin/manual-review')
}

export async function markInReview(id: string) {
  const supabase = createAdminSupabaseClient()
  await supabase
    .from('manual_review_queue')
    .update({ status: 'in_review' })
    .eq('id', id)
}
