/**
 * /[locale]/services/re-parole-u4u
 *
 * Stage 8I — Landing page UX overhaul.
 * - Big CTA button immediately after subtitle (above the fold)
 * - Disclaimers collapsed to 1 line BELOW CTA — not above it
 * - priceFrom uses var(--text-1) for dark-mode contrast
 * - Wizard entry CTA: full-width, var(--success) — visible on blue bg
 * - Footer collapsed to 1 line
 */

import type { Metadata } from 'next'

interface Props {
  params: Promise<{ locale: string }>
}

const T = {
  uk: {
    metaTitle: 'Re-Parole U4U для українців — Messenginfo',
    metaDesc: 'Підготуйте пакет Form I-131 для продовження parole. Самостійна подача. Не юридична консультація.',
    badge: 'Для українців U4U',
    title: 'Продовження parole',
    subtitle: 'Термін вашого parole закінчується? Ми допоможемо підготувати пакет документів.',
    ctaMain: 'Почати Re-Parole пакет →',
    legalOne: 'Не юридична фірма · Ви подаєте самостійно до USCIS · Тільки для довідки',
    priceTitle: 'Вартість',
    priceService: 'Послуга Messenginfo',
    priceServiceDesc: 'Підготовка пакету Form I-131',
    priceFrom: 'від $15',
    priceUSCIS: 'Держмито USCIS',
    priceUSCISDesc: 'Більшість U4U — $0. Перевірте на',
    priceUSCISLink: 'uscis.gov/feecalculator',
    priceUSCISVal: '$0*',
    entries: [
      {
        key: 'status',
        icon: '🔍',
        title: 'Перевірити статус справи',
        desc: 'Вже подали? Введіть номер квитанції (IOE/WAC/LIN) і дізнайтесь, що означає ваш статус.',
        cta: 'Перевірити статус →',
      },
      {
        key: 'translate',
        icon: '📄',
        title: 'Перекласти документ для USCIS',
        desc: 'Документи не англійською? Підготуйте чернетку перекладу.',
        cta: 'Перекласти →',
      },
      {
        key: 'sources',
        icon: '🔗',
        title: 'Офіційні ресурси USCIS',
        desc: 'I-131, I-94, калькулятор внесків, адреси для пошти, myUSCIS — всі офіційні посилання.',
        cta: 'Відкрити ресурси →',
      },
    ],
    footer: 'Form I-131 редакція 01/20/25 · uscis.gov/i-131 · Messenginfo не подає документи від вашого імені',
  },
  ru: {
    metaTitle: 'Re-Parole U4U для украинцев — Messenginfo',
    metaDesc: 'Подготовьте пакет Form I-131 для продления parole. Самостоятельная подача. Не юридическая консультация.',
    badge: 'Для украинцев U4U',
    title: 'Продление parole',
    subtitle: 'Срок вашего parole заканчивается? Мы поможем подготовить пакет документов.',
    ctaMain: 'Начать Re-Parole пакет →',
    legalOne: 'Не юридическая фирма · Вы подаёте самостоятельно в USCIS · Только для справки',
    priceTitle: 'Стоимость',
    priceService: 'Услуга Messenginfo',
    priceServiceDesc: 'Подготовка пакета Form I-131',
    priceFrom: 'от $15',
    priceUSCIS: 'Госпошлина USCIS',
    priceUSCISDesc: 'Большинство U4U — $0. Проверьте на',
    priceUSCISLink: 'uscis.gov/feecalculator',
    priceUSCISVal: '$0*',
    entries: [
      {
        key: 'status',
        icon: '🔍',
        title: 'Проверить статус дела',
        desc: 'Уже подали? Введите номер квитанции (IOE/WAC/LIN) и узнайте, что означает ваш статус.',
        cta: 'Проверить статус →',
      },
      {
        key: 'translate',
        icon: '📄',
        title: 'Перевести документ для USCIS',
        desc: 'Документы не на английском? Подготовьте черновик перевода.',
        cta: 'Перевести →',
      },
      {
        key: 'sources',
        icon: '🔗',
        title: 'Официальные ресурсы USCIS',
        desc: 'I-131, I-94, калькулятор взносов, адреса для почты, myUSCIS — все официальные ссылки.',
        cta: 'Открыть ресурсы →',
      },
    ],
    footer: 'Form I-131 редакция 01/20/25 · uscis.gov/i-131 · Messenginfo не подаёт документы от вашего имени',
  },
  en: {
    metaTitle: 'U4U Re-Parole for Ukrainians — Messenginfo',
    metaDesc: 'Prepare your Form I-131 Re-Parole packet. Self-filing. Not legal advice.',
    badge: 'For Ukrainians — U4U',
    title: 'Re-Parole for Ukrainians',
    subtitle: 'Is your parole expiring? We help you prepare the document packet.',
    ctaMain: 'Start Re-Parole packet →',
    legalOne: 'Not a law firm · You file with USCIS yourself · For guidance only',
    priceTitle: 'Pricing',
    priceService: 'Messenginfo service fee',
    priceServiceDesc: 'Form I-131 packet preparation',
    priceFrom: 'from $15',
    priceUSCIS: 'USCIS government fee',
    priceUSCISDesc: 'Most U4U applicants — $0. Verify at',
    priceUSCISLink: 'uscis.gov/feecalculator',
    priceUSCISVal: '$0*',
    entries: [
      {
        key: 'status',
        icon: '🔍',
        title: 'Check case status',
        desc: 'Already filed? Enter your receipt number (IOE/WAC/LIN) and find out what your status means.',
        cta: 'Check status →',
      },
      {
        key: 'translate',
        icon: '📄',
        title: 'Translate a document for USCIS',
        desc: 'Documents not in English? Prepare a translation draft.',
        cta: 'Translate →',
      },
      {
        key: 'sources',
        icon: '🔗',
        title: 'Official USCIS resources',
        desc: 'I-131, I-94, fee calculator, mailing addresses, myUSCIS — all official links in one place.',
        cta: 'Open resources →',
      },
    ],
    footer: 'Form I-131 edition 01/20/25 · uscis.gov/i-131 · Messenginfo does not file on your behalf',
  },
  es: {
    metaTitle: 'Re-Parole U4U para ucranianos — Messenginfo',
    metaDesc: 'Prepare su paquete Form I-131 para Re-Parole. Presentación propia. No es asesoramiento legal.',
    badge: 'Para ucranianos U4U',
    title: 'Re-Parole para ucranianos',
    subtitle: '¿Su parole está por vencer? Le ayudamos a preparar el paquete de documentos.',
    ctaMain: 'Comenzar paquete Re-Parole →',
    legalOne: 'No es bufete · Usted presenta ante USCIS · Solo orientativo',
    priceTitle: 'Precio',
    priceService: 'Tarifa de servicio Messenginfo',
    priceServiceDesc: 'Preparación del paquete Form I-131',
    priceFrom: 'desde $15',
    priceUSCIS: 'Tarifa gubernamental USCIS',
    priceUSCISDesc: 'La mayoría de U4U — $0. Verifique en',
    priceUSCISLink: 'uscis.gov/feecalculator',
    priceUSCISVal: '$0*',
    entries: [
      {
        key: 'status',
        icon: '🔍',
        title: 'Verificar estado del caso',
        desc: '¿Ya presentó? Ingrese su número de recibo (IOE/WAC/LIN).',
        cta: 'Verificar estado →',
      },
      {
        key: 'translate',
        icon: '📄',
        title: 'Traducir documento para USCIS',
        desc: '¿Documentos no están en inglés? Prepare un borrador de traducción.',
        cta: 'Traducir →',
      },
      {
        key: 'sources',
        icon: '🔗',
        title: 'Recursos oficiales de USCIS',
        desc: 'I-131, I-94, calculadora de tarifas, direcciones postales, myUSCIS.',
        cta: 'Abrir recursos →',
      },
    ],
    footer: 'Form I-131 edición 01/20/25 · uscis.gov/i-131 · Messenginfo no presenta en su nombre',
  },
} as const

type Locale = keyof typeof T

function getHref(entryKey: string, locale: string): string {
  if (entryKey === 'status') return `/${locale}/services/re-parole-u4u/status`
  if (entryKey === 'translate') return `/${locale}/services/translate-document`
  if (entryKey === 'sources') return `/${locale}/services/re-parole-u4u/sources`
  return '#'
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params
  const t = T[(locale as Locale)] ?? T.en
  return {
    title: t.metaTitle,
    description: t.metaDesc,
    metadataBase: new URL('https://messenginfo.com'),
    alternates: {
      canonical: `https://messenginfo.com/${locale}/services/re-parole-u4u`,
      languages: Object.fromEntries(
        (['uk', 'ru', 'en', 'es'] as Locale[]).map((l) => [
          l,
          `https://messenginfo.com/${l}/services/re-parole-u4u`,
        ]),
      ),
    },
  }
}

export default async function ReParoleLandingPage({ params }: Props) {
  const { locale } = await params
  const t = T[(locale as Locale)] ?? T.en
  const wizardHref = `/${locale}/services/re-parole-u4u/start`

  return (
    <main style={{ minHeight: '100dvh', background: 'var(--background)', padding: '0 0 48px' }}>

      {/* ── Hero: title + subtitle + BIG CTA + 1-line disclaimer ── */}
      <section
        style={{
          background: 'var(--surface)',
          borderBottom: '1px solid var(--border)',
          padding: '24px 20px 20px',
        }}
      >
        {/* Badge */}
        <span
          style={{
            display: 'inline-block',
            fontSize: '11px',
            fontWeight: 700,
            padding: '3px 10px',
            borderRadius: '99px',
            background: 'var(--info-bg)',
            color: 'var(--info-text)',
            marginBottom: '10px',
          }}
        >
          {t.badge}
        </span>

        {/* Title */}
        <h1
          style={{
            fontSize: '26px',
            fontWeight: 800,
            lineHeight: 1.2,
            color: 'var(--text-1)',
            marginBottom: '6px',
          }}
        >
          {t.title}
        </h1>

        {/* Subtitle */}
        <p
          style={{
            fontSize: '16px',
            fontWeight: 500,
            color: 'var(--primary)',
            marginBottom: '18px',
            lineHeight: 1.4,
          }}
        >
          {t.subtitle}
        </p>

        {/* ★ PRIMARY CTA — full width, 56px, bright green ★ */}
        <a
          href={wizardHref}
          style={{
            display: 'block',
            width: '100%',
            padding: '0',
            height: '56px',
            lineHeight: '56px',
            textAlign: 'center',
            borderRadius: '14px',
            fontSize: '17px',
            fontWeight: 800,
            color: '#fff',
            background: 'var(--success)',
            textDecoration: 'none',
            boxShadow: '0 3px 14px rgba(22,163,74,0.30)',
            letterSpacing: '0.01em',
            marginBottom: '10px',
          }}
        >
          {t.ctaMain}
        </a>

        {/* Single-line combined disclaimer — BELOW CTA */}
        <p
          style={{
            fontSize: '11px',
            color: 'var(--text-3)',
            textAlign: 'center',
            lineHeight: 1.4,
          }}
        >
          {t.legalOne}
        </p>
      </section>

      {/* ── Price block ─────────────────────────────────────────── */}
      <section style={{ padding: '16px 20px 0' }}>
        <div
          style={{
            border: '1.5px solid var(--border-strong)',
            borderRadius: '14px',
            background: 'var(--surface)',
            overflow: 'hidden',
          }}
        >
          <div style={{ padding: '8px 14px', background: 'var(--surface-2)', borderBottom: '1px solid var(--border)' }}>
            <p style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-3)', letterSpacing: '0.5px', textTransform: 'uppercase' }}>
              {t.priceTitle}
            </p>
          </div>

          {/* Messenginfo fee */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '12px 14px',
              borderBottom: '1px solid var(--border)',
            }}
          >
            <div>
              <p style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-1)' }}>{t.priceService}</p>
              <p style={{ fontSize: '11px', color: 'var(--text-3)' }}>{t.priceServiceDesc}</p>
            </div>
            {/* Use text-1 not primary — dark mode safe */}
            <span style={{ fontSize: '20px', fontWeight: 800, color: 'var(--text-1)', fontVariantNumeric: 'tabular-nums', flexShrink: 0, marginLeft: '8px' }}>
              {t.priceFrom}
            </span>
          </div>

          {/* USCIS fee */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px' }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-1)' }}>{t.priceUSCIS}</p>
              <p style={{ fontSize: '11px', color: 'var(--text-3)' }}>
                {t.priceUSCISDesc}{' '}
                <a
                  href="https://www.uscis.gov/feecalculator"
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color: 'var(--primary)', fontWeight: 600 }}
                >
                  {t.priceUSCISLink}
                </a>
              </p>
            </div>
            <span style={{ fontSize: '20px', fontWeight: 800, color: 'var(--success)', fontVariantNumeric: 'tabular-nums', flexShrink: 0, marginLeft: '8px' }}>
              {t.priceUSCISVal}
            </span>
          </div>
        </div>
      </section>

      {/* ── Secondary entry cards (status / translate / sources) ── */}
      <section style={{ padding: '16px 20px 0' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {t.entries.map((entry) => (
            <a
              key={entry.key}
              href={getHref(entry.key, locale)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                borderRadius: '12px',
                padding: '14px 16px',
                textDecoration: 'none',
                background: 'var(--surface)',
                border: '1px solid var(--border)',
              }}
            >
              <span style={{ fontSize: '24px', lineHeight: 1, flexShrink: 0 }}>{entry.icon}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-1)', marginBottom: '2px' }}>
                  {entry.title}
                </p>
                <p style={{ fontSize: '12px', color: 'var(--text-3)', lineHeight: 1.4 }}>
                  {entry.desc}
                </p>
              </div>
              <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--primary)', flexShrink: 0 }}>
                {entry.cta}
              </span>
            </a>
          ))}
        </div>
      </section>

      {/* ── Footer — 1 compact line ──────────────────────────────── */}
      <section style={{ padding: '16px 20px 0' }}>
        <p style={{ fontSize: '11px', color: 'var(--text-3)', lineHeight: 1.5 }}>
          <a
            href="https://www.uscis.gov/i-131"
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: 'var(--text-3)' }}
          >
            {t.footer}
          </a>
        </p>
      </section>
    </main>
  )
}
