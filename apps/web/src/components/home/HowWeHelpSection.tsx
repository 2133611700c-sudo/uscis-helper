import { useTranslations } from 'next-intl'
import { Library, FolderCheck, CheckCircle } from 'lucide-react'
import { Section } from '@/components/ui/Section'

const icons = [Library, FolderCheck, CheckCircle]

export function HowWeHelpSection() {
  const t = useTranslations('howWeHelp')
  const items = t.raw('items') as Array<{ title: string; description: string }>

  return (
    <Section className="bg-slate-50">
      <div className="text-center mb-10">
        <h2 className="text-2xl md:text-3xl font-bold text-ink-900">{t('title')}</h2>
        <p className="mt-3 text-ink-600 text-base">{t('subtitle')}</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {items.map((item, i) => {
          const Icon = icons[i]
          return (
            <div key={i} className="flex flex-col items-center text-center gap-4">
              <div className="w-14 h-14 rounded-full bg-brand-100 flex items-center justify-center">
                <Icon className="w-7 h-7 text-brand-600" />
              </div>
              <div>
                <h3 className="font-semibold text-ink-900 text-base">{item.title}</h3>
                <p className="mt-2 text-sm text-ink-600 leading-relaxed">{item.description}</p>
              </div>
            </div>
          )
        })}
      </div>
    </Section>
  )
}
