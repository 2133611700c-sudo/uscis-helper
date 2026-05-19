/**
 * /[locale]/services/tps-ukraine
 *
 * TPS Ukraine main landing — redirects directly to the prototype-style wizard
 * at /start so the cleanly-designed flow is the first thing the user sees.
 *
 * The legacy info landing (FAQ, official sources, regulatory context) lives
 * at /[locale]/services/tps-ukraine/info — link to it from the wizard footer
 * when needed.
 */
import { redirect } from 'next/navigation'

interface Props {
  params: Promise<{ locale: string }>
}

export default async function TpsUkraineRedirect({ params }: Props) {
  const { locale } = await params
  redirect(`/${locale}/services/tps-ukraine/start`)
}
