import { WizardProvider } from '@/contexts/WizardContext'
import { WizardShell } from '@/components/wizard/WizardShell'
import { WizardController } from '@/components/wizard/WizardController'

interface WizardPageProps {
  params: Promise<{ slug: string; locale: string }>
}

export default async function WizardPage({ params }: WizardPageProps) {
  const { slug, locale: _locale } = await params
  return (
    <WizardProvider>
      <WizardShell slug={slug}>
        <WizardController />
      </WizardShell>
    </WizardProvider>
  )
}
