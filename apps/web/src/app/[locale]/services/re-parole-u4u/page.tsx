/**
 * /[locale]/services/re-parole-u4u
 *
 * Re-Parole main landing — redirects directly to the prototype-style
 * wizard at /start so the cleanly-designed flow is the first thing
 * the user sees (matches what we did for /services/tps-ukraine).
 *
 * The legacy info landing (4 trust cards, How it works, FAQ,
 * regulatory context) lives at /[locale]/services/re-parole-u4u/info
 * — link to it from the wizard footer when needed.
 */
import { redirect } from 'next/navigation'

interface Props {
  params: Promise<{ locale: string }>
}

export default async function ReParoleRedirect({ params }: Props) {
  const { locale } = await params
  redirect(`/${locale}/services/re-parole-u4u/start`)
}
