/**
 * /[locale]/services/re-parole-u4u
 *
 * Stage 8E — Re-Parole landing page.
 * 3 entry points for the 3 real user situations:
 *   1. Prepare Re-Parole packet (→ /start)
 *   2. Check case status (→ USCIS egov portal)
 *   3. Translate a document (→ /services/translate-document)
 *
 * Designed for primary user: Ukrainian, 35–80 years old, phone, first time.
 * Price visible without scroll. "You file yourself" prominent.
 * Not legal advice. Not a law firm.
 */

import type { Metadata } from 'next'
import Link from 'next/link'

interface Props {
  params: Promise<{ locale: string }>
}

// ---------------------------------------------------------------------------
// Inline translations — all 4 locales self-contained, no next-intl dependency
// ---------------------------------------------------------------------------

const T = {
  uk: {
    metaTitle: 'Re-Parole U4U для українців — Messenginfo',
    metaDesc: 'Підготуйте пакет Form I-131 для продовження parole. Самостійна подача. Не юридична консультація.',
    badge: 'Для українців U4U',
    title: 'Продовження parole',
    subtitle: 'Якщо термін вашого parole закінчується — ця сторінка для вас.',
    selfFiling: 'Ви самі перевіряєте, підписуєте і подаєте документи до USCIS.',
    notLegal: 'Messenginfo — не юридична фірма. Ми допомагаємо підготувати чернетку — ви подаєте самостійно.',
    priceTitle: 'Вартість',
    priceService: 'Послуга Messenginfo',
    priceServiceDesc: 'Підготовка пакету Form I-131',
    priceFrom: 'від $15',
    priceUSCIS: 'Державне мито USCIS',
    priceUSCISDesc: 'Більшість учасників U4U — $0. Перевірте на',
    priceUSCISLink: 'uscis.gov/feecalculator',
    priceUSCISVal: '$0*',
    entries: [
      {
        key: 'wizard',
        icon: '📋',
        title: 'Підготувати Re-Parole пакет',
        desc: 'Крок за кроком: завантажте документи, отримайте готовий пакет Form I-131 для самостійної подачі.',
        cta: 'Почати →',
        highlight: true,
      },
      {
        key: 'status',
        icon: '🔍',
        title: 'Перевірити статус справи',
        desc: 'Вже подали заявку? Введіть номер квитанції (IOE/WAC/LIN) і дізнайтесь, що означає ваш статус.',
        cta: 'Перевірити статус →',
        highlight: false,
      },
      {
        key: 'translate',
        icon: '📄',
        title: 'Перекласти документ для USCIS',
        desc: 'Документи не англійською? Підготуйте чернетку перекладу для перевірки перед передачею сертифікованому перекладачу.',
        cta: 'Перекласти документ →',
        highlight: false,
      },
      {
        key: 'sources',
        icon: '🔗',
        title: 'Офіційні ресурси USCIS',
        desc: 'I-131, I-94, калькулятор внесків, адреси для пошти, myUSCIS — всі офіційні посилання на одній сторінці.',
        cta: 'Відкрити ресурси →',
        highlight: false,
      },
    ],
    sourceBadge: 'Джерело: USCIS · Form I-131 редакція 01/20/25',
    disclaimer: 'Messenginfo готує документи для самостійної подачі. Вся інформація — лише для довідки. Вся відповідальність за подачу — на заявнику.',
  },
  ru: {
    metaTitle: 'Re-Parole U4U для украинцев — Messenginfo',
    metaDesc: 'Подготовьте пакет Form I-131 для продления parole. Самостоятельная подача. Не юридическая консультация.',
    badge: 'Для украинцев U4U',
    title: 'Продление parole',
    subtitle: 'Если срок вашего parole заканчивается — эта страница для вас.',
    selfFiling: 'Вы сами проверяете, подписываете и подаёте документы в USCIS.',
    notLegal: 'Messenginfo — не юридическая фирма. Мы помогаем подготовить черновик — вы подаёте самостоятельно.',
    priceTitle: 'Стоимость',
    priceService: 'Услуга Messenginfo',
    priceServiceDesc: 'Подготовка пакета Form I-131',
    priceFrom: 'от $15',
    priceUSCIS: 'Государственная пошлина USCIS',
    priceUSCISDesc: 'Большинство участников U4U — $0. Проверьте на',
    priceUSCISLink: 'uscis.gov/feecalculator',
    priceUSCISVal: '$0*',
    entries: [
      {
        key: 'wizard',
        icon: '📋',
        title: 'Подготовить Re-Parole пакет',
        desc: 'Шаг за шагом: загрузите документы, получите готовый пакет Form I-131 для самостоятельной подачи.',
        cta: 'Начать →',
        highlight: true,
      },
      {
        key: 'status',
        icon: '🔍',
        title: 'Проверить статус дела',
        desc: 'Уже подали заявление? Введите номер квитанции (IOE/WAC/LIN) и узнайте, что означает ваш статус.',
        cta: 'Проверить статус →',
        highlight: false,
      },
      {
        key: 'translate',
        icon: '📄',
        title: 'Перевести документ для USCIS',
        desc: 'Документы не на английском? Подготовьте черновик перевода для проверки перед передачей сертифицированному переводчику.',
        cta: 'Перевести документ →',
        highlight: false,
      },
      {
        key: 'sources',
        icon: '🔗',
        title: 'Официальные ресурсы USCIS',
        desc: 'I-131, I-94, калькулятор взносов, адреса для почты, myUSCIS — все официальные ссылки на одной странице.',
        cta: 'Открыть ресурсы →',
        highlight: false,
      },
    ],
    sourceBadge: 'Источник: USCIS · Form I-131 редакция 01/20/25',
    disclaimer: 'Messenginfo готовит документы для самостоятельной подачи. Вся информация — только для справки. Вся ответственность за подачу — на заявителе.',
  },
  en: {
    metaTitle: 'U4U Re-Parole for Ukrainians — Messenginfo',
    metaDesc: 'Prepare your Form I-131 Re-Parole packet. Self-filing. Not legal advice.',
    badge: 'For Ukrainians — U4U',
    title: 'Re-Parole for Ukrainians',
    subtitle: 'If your parole is expiring — this is the right place.',
    selfFiling: 'You review, sign, and file the documents with USCIS yourself.',
    notLegal: 'Messenginfo is not a law firm. We help you prepare a draft — you file on your own.',
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
        key: 'wizard',
        icon: '📋',
        title: 'Prepare Re-Parole packet',
        desc: 'Step by step: upload your documents, get a ready-to-file Form I-131 packet.',
        cta: 'Start →',
        highlight: true,
      },
      {
        key: 'status',
        icon: '🔍',
        title: 'Check case status',
        desc: 'Already filed? Enter your receipt number (IOE/WAC/LIN) and find out what your status means.',
        cta: 'Check status →',
        highlight: false,
      },
      {
        key: 'translate',
        icon: '📄',
        title: 'Translate a document for USCIS',
        desc: 'Documents not in English? Prepare a translation draft to review before sending to a certified translator.',
        cta: 'Translate document →',
        highlight: false,
      },
      {
        key: 'sources',
        icon: '🔗',
        title: 'Official USCIS resources',
        desc: 'I-131, I-94, fee calculator, mailing addresses, myUSCIS — all official links in one place.',
        cta: 'Open resources →',
        highlight: false,
      },
    ],
    sourceBadge: 'Source: USCIS · Form I-131 edition 01/20/25',
    disclaimer: 'Messenginfo prepares documents for self-filing. All information is for guidance only. The applicant is solely responsible for their filing.',
  },
  es: {
    metaTitle: 'Re-Parole U4U para ucranianos — Messenginfo',
    metaDesc: 'Prepare su paquete Form I-131 para Re-Parole. Presentación propia. No es asesoramiento legal.',
    badge: 'Para ucranianos U4U',
    title: 'Re-Parole para ucranianos',
    subtitle: 'Si su parole está por vencer — esta página es para usted.',
    selfFiling: 'Usted revisa, firma y presenta los documentos ante USCIS por su cuenta.',
    notLegal: 'Messenginfo no es un bufete de abogados. Le ayudamos a preparar un borrador — usted presenta por su cuenta.',
    priceTitle: 'Precio',
    priceService: 'Tarifa de servicio Messenginfo',
    priceServiceDesc: 'Preparación del paquete Form I-131',
    priceFrom: 'desde $15',
    priceUSCIS: 'Tarifa gubernamental USCIS',
    priceUSCISDesc: 'La mayoría de solicitantes U4U — $0. Verifique en',
    priceUSCISLink: 'uscis.gov/feecalculator',
    priceUSCISVal: '$0*',
    entries: [
      {
        key: 'wizard',
        icon: '📋',
        title: 'Preparar paquete Re-Parole',
        desc: 'Paso a paso: cargue sus documentos, obtenga un paquete Form I-131 listo para presentar.',
        cta: 'Comenzar →',
        highlight: true,
      },
      {
        key: 'status',
        icon: '🔍',
        title: 'Verificar estado del caso',
        desc: '¿Ya presentó? Ingrese su número de recibo (IOE/WAC/LIN) y descubra qué significa su estado.',
        cta: 'Verificar estado →',
        highlight: false,
      },
      {
        key: 'translate',
        icon: '📄',
        title: 'Traducir documento para USCIS',
        desc: '¿Documentos no están en inglés? Prepare un borrador de traducción para revisar antes de enviarlo a un traductor certificado.',
        cta: 'Traducir documento →',
        highlight: false,
      },
      {
        key: 'sources',
        icon: '🔗',
        title: 'Recursos oficiales de USCIS',
        desc: 'I-131, I-94, calculadora de tarifas, direcciones postales, myUSCIS — todos los enlaces oficiales en una página.',
        cta: 'Abrir recursos →',
        highlight: false,
      },
    ],
    sourceBadge: 'Fuente: USCIS · Formulario I-131 edición 01/20/25',
    disclaimer: 'Messenginfo prepara documentos para presentación propia. Toda la información es solo orientativa. El solicitante es el único responsable de su presentación.',
  },
} as const

type Locale = keyof typeof T

function getHref(entryKey: string, locale: string): string {
  if (entryKey === 'wizard') return `/${locale}/services/re-parole-u4u/start`
  if (entryKey === 'status') return `/${locale}/services/re-parole-u4u/status`
  if (entryKey === 'translate') return `/${locale}/services/translate-document`
  if (entryKey === 'sources') return `/${locale}/services/re-parole-u4u/sources`
  return '#'
}

function isExternal(_entryKey: string): boolean {
  return false
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

  return (
    <main
      style={{
        minHeight: '100dvh',
        background: 'var(--background)',
        padding: '0 0 48px',
      }}
    >
      {/* ── Hero ────────────────────────────────────────────────── */}
      <section
        style={{
          background: 'var(--surface)',
          borderBottom: '1px solid var(--border)',
          padding: '28px 20px 24px',
        }}
      >
        {/* Badge */}
        <div style={{ marginBottom: '12px' }}>
          <span
            style={{
              display: 'inline-block',
              fontSize: '11px',
              fontWeight: 700,
              padding: '3px 10px',
              borderRadius: '99px',
              background: 'var(--info-bg)',
              color: 'var(--info-text)',
            }}
          >
            {t.badge}
          </span>
        </div>

        {/* Title */}
        <h1
          style={{
            fontSize: '26px',
            fontWeight: 800,
            lineHeight: 1.2,
            color: 'var(--text-1)',
            marginBottom: '8px',
          }}
        >
          {t.title}
        </h1>

        {/* Subtitle — why they're here */}
        <p
          style={{
            fontSize: '17px',
            fontWeight: 600,
            color: 'var(--primary)',
            marginBottom: '10px',
            lineHeight: 1.35,
          }}
        >
          {t.subtitle}
        </p>

        {/* Self-filing statement — bold, visible */}
        <div
          style={{
            background: 'var(--success-bg)',
            border: '1.5px solid var(--success)',
            borderRadius: '10px',
            padding: '10px 14px',
            marginBottom: '12px',
          }}
        >
          <p style={{ fontSize: '14px', fontWeight: 700, color: 'var(--success-text)', lineHeight: 1.4 }}>
            ✓ {t.selfFiling}
          </p>
        </div>

        {/* Not legal notice */}
        <p style={{ fontSize: '12px', color: 'var(--text-3)', lineHeight: 1.45 }}>
          {t.notLegal}
        </p>
      </section>

      {/* ── Price block — visible without scroll ────────────────── */}
      <section style={{ padding: '20px 20px 0' }}>
        <div
          style={{
            border: '2px solid var(--primary)',
            borderRadius: '14px',
            background: 'var(--surface)',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              padding: '8px 14px',
              background: 'var(--primary)',
            }}
          >
            <p style={{ fontSize: '11px', fontWeight: 700, color: '#fff', letterSpacing: '0.5px', textTransform: 'uppercase' }}>
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
            <span
              style={{
                fontSize: '18px',
                fontWeight: 800,
                color: 'var(--primary)',
                fontVariantNumeric: 'tabular-nums',
                flexShrink: 0,
                marginLeft: '8px',
              }}
            >
              {t.priceFrom}
            </span>
          </div>

          {/* USCIS fee */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '12px 14px',
            }}
          >
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
            <span
              style={{
                fontSize: '18px',
                fontWeight: 800,
                color: 'var(--success)',
                fontVariantNumeric: 'tabular-nums',
                flexShrink: 0,
                marginLeft: '8px',
              }}
            >
              {t.priceUSCISVal}
            </span>
          </div>
        </div>
      </section>

      {/* ── 3 Entry CTAs ────────────────────────────────────────── */}
      <section style={{ padding: '20px 20px 0' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {t.entries.map((entry) => {
            const href = getHref(entry.key, locale)
            const ext = isExternal(entry.key)

            return (
              <a
                key={entry.key}
                href={href}
                {...(ext ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
                style={{
                  display: 'block',
                  borderRadius: '14px',
                  padding: '16px',
                  textDecoration: 'none',
                  background: entry.highlight ? 'var(--primary)' : 'var(--surface)',
                  border: entry.highlight ? 'none' : '1.5px solid var(--border-strong)',
                  boxShadow: entry.highlight ? '0 2px 12px rgba(37,99,235,0.18)' : 'none',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                  <span style={{ fontSize: '28px', lineHeight: 1, flexShrink: 0 }}>{entry.icon}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p
                      style={{
                        fontSize: '17px',
                        fontWeight: 700,
                        color: entry.highlight ? '#fff' : 'var(--text-1)',
                        marginBottom: '4px',
                        lineHeight: 1.25,
                      }}
                    >
                      {entry.title}
                    </p>
                    <p
                      style={{
                        fontSize: '13px',
                        color: entry.highlight ? 'rgba(255,255,255,0.85)' : 'var(--text-2)',
                        lineHeight: 1.45,
                        marginBottom: '10px',
                      }}
                    >
                      {entry.desc}
                    </p>
                    <span
                      style={{
                        display: 'inline-block',
                        fontSize: '14px',
                        fontWeight: 700,
                        padding: '8px 16px',
                        borderRadius: '8px',
                        background: entry.highlight ? 'rgba(255,255,255,0.15)' : 'var(--primary)',
                        color: '#fff',
                      }}
                    >
                      {entry.cta}
                    </span>
                  </div>
                </div>
              </a>
            )
          })}
        </div>
      </section>

      {/* ── Source + Disclaimer ─────────────────────────────────── */}
      <section style={{ padding: '20px 20px 0' }}>
        <p
          style={{
            fontSize: '11px',
            color: 'var(--text-3)',
            marginBottom: '8px',
          }}
        >
          <a
            href="https://www.uscis.gov/i-131"
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: 'var(--primary)', fontWeight: 600 }}
          >
            {t.sourceBadge}
          </a>
        </p>
        <p style={{ fontSize: '11px', color: 'var(--text-3)', lineHeight: 1.5 }}>
          {t.disclaimer}
        </p>
      </section>
    </main>
  )
}
