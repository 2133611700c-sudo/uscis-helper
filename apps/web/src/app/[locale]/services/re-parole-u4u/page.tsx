/**
 * /[locale]/services/re-parole-u4u
 *
 * Stage 9A — UX Polish: CTA prominence, disclaimer reduction, mobile-first.
 * Primary user: Ukrainian, 35–80, phone, first time, may struggle with reading.
 * Rule: ONE big CTA first, legal notice small + below CTA, no double disclaimers.
 */

import type { Metadata } from 'next'
import Link from 'next/link'

interface Props {
    params: Promise<{ locale: string }>
}

type Locale = 'uk' | 'ru' | 'en' | 'es'

const T: Record<Locale, {
    metaTitle: string; metaDesc: string; badge: string; title: string; subtitle: string
    ctaMain: string; ctaMainDesc: string; notLegal: string
    priceTitle: string; priceService: string; priceServiceDesc: string; priceFrom: string
    priceUSCIS: string; priceUSCISDesc: string; priceUSCISLink: string; priceUSCISVal: string
    statusTitle: string; statusDesc: string; statusCta: string
    translateTitle: string; translateDesc: string; translateCta: string
    sourcesTitle: string; sourcesDesc: string; sourcesCta: string
    sourceBadge: string; disclaimer: string
}> = {
    uk: {
          metaTitle: 'Re-Parole U4U для українців — Messenginfo',
          metaDesc: 'Підготуйте пакет Form I-131 для продовження parole. Самостійна подача.',
          badge: 'Для українців U4U',
          title: 'Продовження parole',
          subtitle: 'Якщо термін вашого parole закінчується — ця сторінка для вас.',
          ctaMain: '📋 Підготувати пакет документів',
          ctaMainDesc: 'Крок за кроком — завантажте документи, отримайте готовий пакет I-131',
          notLegal: 'Не юридична фірма · Ви самі подаєте до USCIS',
          priceTitle: 'Вартість',
          priceService: 'Послуга Messenginfo',
          priceServiceDesc: 'Підготовка пакету Form I-131',
          priceFrom: 'від $15',
          priceUSCIS: 'Держмито USCIS',
          priceUSCISDesc: 'Більшість U4U — $0. Перевірте на',
          priceUSCISLink: 'uscis.gov/feecalculator',
          priceUSCISVal: '$0*',
          statusTitle: '🔍 Перевірити статус справи',
          statusDesc: 'Вже подали заявку? Введіть номер квитанції (IOE/WAC/LIN).',
          statusCta: 'Перевірити статус →',
          translateTitle: '📄 Перекласти документ',
          translateDesc: 'Документи не англійською? Підготуйте чернетку перекладу.',
          translateCta: 'Перекласти документ →',
          sourcesTitle: '🔗 Офіційні ресурси USCIS',
          sourcesDesc: 'I-131, I-94, калькулятор внесків, myUSCIS — всі офіційні посилання.',
          sourcesCta: 'Відкрити ресурси →',
          sourceBadge: 'Джерело: USCIS · Form I-131 редакція 01/20/25',
          disclaimer: 'Messenginfo готує документи для самостійної подачі. Вся інформація — лише для довідки. Вся відповідальність за подачу — на заявнику.',
    },
    ru: {
          metaTitle: 'Re-Parole U4U для украинцев — Messenginfo',
          metaDesc: 'Подготовьте пакет Form I-131 для продления parole. Самостоятельная подача.',
          badge: 'Для украинцев U4U',
          title: 'Продление parole',
          subtitle: 'Если срок вашего parole заканчивается — эта страница для вас.',
          ctaMain: '📋 Подготовить пакет документов',
          ctaMainDesc: 'Шаг за шагом — загрузите документы, получите готовый пакет I-131',
          notLegal: 'Не юридическая фирма · Вы сами подаёте в USCIS',
          priceTitle: 'Стоимость',
          priceService: 'Услуга Messenginfo',
          priceServiceDesc: 'Подготовка пакета Form I-131',
          priceFrom: 'от $15',
          priceUSCIS: 'Госпошлина USCIS',
          priceUSCISDesc: 'Большинство U4U — $0. Проверьте на',
          priceUSCISLink: 'uscis.gov/feecalculator',
          priceUSCISVal: '$0*',
          statusTitle: '🔍 Проверить статус дела',
          statusDesc: 'Уже подали заявление? Введите номер квитанции (IOE/WAC/LIN).',
          statusCta: 'Проверить статус →',
          translateTitle: '📄 Перевести документ',
          translateDesc: 'Документы не на английском? Подготовьте черновик перевода.',
          translateCta: 'Перевести документ →',
          sourcesTitle: '🔗 Официальные ресурсы USCIS',
          sourcesDesc: 'I-131, I-94, калькулятор взносов, myUSCIS — все официальные ссылки.',
          sourcesCta: 'Открыть ресурсы →',
          sourceBadge: 'Источник: USCIS · Form I-131 редакция 01/20/25',
          disclaimer: 'Messenginfo готовит документы для самостоятельной подачи. Вся информация — только для справки. Вся ответственность за подачу — на заявителе.',
    },
    en: {
          metaTitle: 'U4U Re-Parole for Ukrainians — Messenginfo',
          metaDesc: 'Prepare your Form I-131 packet for Re-Parole. Self-filing. Not legal advice.',
          badge: 'For Ukrainians — U4U',
          title: 'Re-Parole for Ukrainians',
          subtitle: 'If your parole is expiring — this is the right place.',
          ctaMain: '📋 Prepare My Documents',
          ctaMainDesc: 'Step by step — upload your documents, get a ready-to-file I-131 packet',
          notLegal: 'Not a law firm · You file yourself with USCIS',
          priceTitle: 'Pricing',
          priceService: 'Messenginfo service fee',
          priceServiceDesc: 'Form I-131 packet preparation',
          priceFrom: 'from $15',
          priceUSCIS: 'USCIS government fee',
          priceUSCISDesc: 'Most U4U applicants — $0. Verify at',
          priceUSCISLink: 'uscis.gov/feecalculator',
          priceUSCISVal: '$0*',
          statusTitle: '🔍 Check Case Status',
          statusDesc: 'Already filed? Enter your receipt number (IOE/WAC/LIN).',
          statusCta: 'Check status →',
          translateTitle: '📄 Translate a Document',
          translateDesc: 'Documents not in English? Prepare a translation draft.',
          translateCta: 'Translate document →',
          sourcesTitle: '🔗 Official USCIS Resources',
          sourcesDesc: 'I-131, I-94, fee calculator, myUSCIS — all official links.',
          sourcesCta: 'Open resources →',
          sourceBadge: 'Source: USCIS · Form I-131 edition 01/20/25',
          disclaimer: 'Messenginfo prepares documents for self-filing. All information is for guidance only. The applicant is solely responsible for their filing.',
    },
    es: {
          metaTitle: 'Re-Parole U4U para ucranianos — Messenginfo',
          metaDesc: 'Prepare su paquete Form I-131 para Re-Parole. Presentación propia.',
          badge: 'Para ucranianos U4U',
          title: 'Re-Parole para ucranianos',
          subtitle: 'Si su parole está por vencer — esta página es para usted.',
          ctaMain: '📋 Preparar mis documentos',
          ctaMainDesc: 'Paso a paso — suba sus documentos, obtenga el paquete I-131 listo',
          notLegal: 'No es un bufete · Usted mismo presenta ante USCIS',
          priceTitle: 'Precio',
          priceService: 'Servicio Messenginfo',
          priceServiceDesc: 'Preparación del paquete Form I-131',
          priceFrom: 'desde $15',
          priceUSCIS: 'Tarifa USCIS',
          priceUSCISDesc: 'La mayoría U4U — $0. Verifique en',
          priceUSCISLink: 'uscis.gov/feecalculator',
          priceUSCISVal: '$0*',
          statusTitle: '🔍 Verificar estado del caso',
          statusDesc: '¿Ya presentó? Ingrese su número de recibo (IOE/WAC/LIN).',
          statusCta: 'Verificar estado →',
          translateTitle: '📄 Traducir documento',
          translateDesc: '¿Documentos no en inglés? Prepare un borrador de traducción.',
          translateCta: 'Traducir documento →',
          sourcesTitle: '🔗 Recursos oficiales USCIS',
          sourcesDesc: 'I-131, I-94, calculadora de tarifas, myUSCIS — todos los enlaces.',
          sourcesCta: 'Abrir recursos →',
          sourceBadge: 'Fuente: USCIS · Form I-131 edición 01/20/25',
          disclaimer: 'Messenginfo prepara documentos para presentación propia. Toda la información es solo orientativa. El solicitante es el único responsable de su presentación.',
    },
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
        <main style={{ maxWidth: '480px', margin: '0 auto', paddingBottom: '40px' }}>

          {/* ── Hero ─────────────────────────────────────────────────── */}
                <section style={{ padding: '24px 20px 16px' }}>
                          <span style={{
                    display: 'inline-block',
                    fontSize: '11px',
                    fontWeight: 700,
                    letterSpacing: '0.06em',
                    textTransform: 'uppercase',
                    color: 'var(--primary)',
                    background: 'var(--primary-bg)',
                    borderRadius: '6px',
                    padding: '3px 8px',
                    marginBottom: '10px',
        }}>
                            {t.badge}
                          </span>span>

                          <h1 style={{
                    fontSize: '28px',
                    fontWeight: 800,
                    lineHeight: 1.15,
                    color: 'var(--text-1)',
                    marginBottom: '6px',
        }}>
                            {t.title}
                          </h1>h1>

                          <p style={{
                    fontSize: '16px',
                    fontWeight: 600,
                    color: 'var(--primary)',
                    marginBottom: '0',
                    lineHeight: 1.35,
        }}>
                            {t.subtitle}
                          </p>p>
                </section>section>

          {/* ── PRIMARY CTA — full width, unmissable ─────────────────── */}
                <section style={{ padding: '0 20px 20px' }}>
                          <Link
                                      href={`/${locale}/services/re-parole-u4u/start`}
                                      style={{
                                                    display: 'block',
                                                    width: '100%',
                                                    padding: '18px 20px',
                                                    borderRadius: '14px',
                                                    background: 'var(--primary)',
                                                    color: '#fff',
                                                    textDecoration: 'none',
                                                    textAlign: 'center',
                                                    boxShadow: '0 4px 18px rgba(37,99,235,0.30)',
                                      }}
                                    >
                                    <p style={{ fontSize: '19px', fontWeight: 800, margin: 0, lineHeight: 1.2 }}>
                                      {t.ctaMain}
                                    </p>p>
                                    <p style={{ fontSize: '13px', fontWeight: 400, margin: '4px 0 0', opacity: 0.88, lineHeight: 1.35 }}>
                                      {t.ctaMainDesc}
                                    </p>p>
                          </Link>Link>
                
                  {/* Legal notice — small, below CTA, not before it */}
                        <p style={{
                    fontSize: '11px',
                    color: 'var(--text-3)',
                    textAlign: 'center',
                    marginTop: '8px',
                    lineHeight: 1.4,
        }}>
                          {t.notLegal}
                        </p>p>
                </section>section>
        
          {/* ── Price block ──────────────────────────────────────────── */}
              <section style={{ padding: '0 20px 20px' }}>
                      <div style={{
                    border: '1.5px solid var(--border)',
                    borderRadius: '14px',
                    background: 'var(--surface)',
                    overflow: 'hidden',
        }}>
                                <div style={{
                      padding: '6px 14px',
                      background: 'var(--primary)',
        }}>
                                            <p style={{ fontSize: '10px', fontWeight: 700, color: 'rgba(255,255,255,0.8)', letterSpacing: '0.08em', textTransform: 'uppercase', margin: 0 }}>
                                              {t.priceTitle}
                                            </p>p>
                                </div>div>
                      
                        {/* Service fee row */}
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 14px', borderBottom: '1px solid var(--border)' }}>
                                            <div>
                                                          <p style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-1)', margin: 0 }}>{t.priceService}</p>p>
                                                          <p style={{ fontSize: '11px', color: 'var(--text-3)', margin: '2px 0 0' }}>{t.priceServiceDesc}</p>p>
                                            </div>div>
                                            <span style={{ fontSize: '20px', fontWeight: 800, color: 'var(--primary)', flexShrink: 0, marginLeft: '8px' }}>
                                              {t.priceFrom}
                                            </span>span>
                                </div>div>
                      
                        {/* USCIS fee row */}
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 14px' }}>
                                            <div>
                                                          <p style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-1)', margin: 0 }}>{t.priceUSCIS}</p>p>
                                                          <p style={{ fontSize: '11px', color: 'var(--text-3)', margin: '2px 0 0' }}>
                                                            {t.priceUSCISDesc}{' '}
                                                                          <a href="https://www.uscis.gov/feecalculator" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--primary)', fontWeight: 600 }}>
                                                                            {t.priceUSCISLink}
                                                                          </a>a>
                                                          </p>p>
                                            </div>div>
                                            <span style={{ fontSize: '20px', fontWeight: 800, color: 'var(--success)', flexShrink: 0, marginLeft: '8px' }}>
                                              {t.priceUSCISVal}
                                            </span>span>
                                </div>div>
                      </div>div>
              </section>section>
        
          {/* ── Secondary CTAs ───────────────────────────────────────── */}
              <section style={{ padding: '0 20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              
                {/* Status check */}
                      <Link href={`/${locale}/services/re-parole-u4u/status`} style={{
                    display: 'block', padding: '16px', borderRadius: '14px',
                    background: 'var(--surface)', border: '1.5px solid var(--border-strong)',
                    textDecoration: 'none',
        }}>
                                <p style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-1)', margin: '0 0 4px' }}>{t.statusTitle}</p>p>
                                <p style={{ fontSize: '13px', color: 'var(--text-2)', margin: '0 0 10px', lineHeight: 1.4 }}>{t.statusDesc}</p>p>
                                <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--primary)' }}>{t.statusCta}</span>span>
                      </Link>Link>
              
                {/* Translate */}
                      <Link href={`/${locale}/services/translate-document`} style={{
                    display: 'block', padding: '16px', borderRadius: '14px',
                    background: 'var(--surface)', border: '1.5px solid var(--border-strong)',
                    textDecoration: 'none',
        }}>
                                <p style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-1)', margin: '0 0 4px' }}>{t.translateTitle}</p>p>
                                <p style={{ fontSize: '13px', color: 'var(--text-2)', margin: '0 0 10px', lineHeight: 1.4 }}>{t.translateDesc}</p>p>
                                <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--primary)' }}>{t.translateCta}</span>span>
                      </Link>Link>
              
                {/* Sources */}
                      <Link href={`/${locale}/services/re-parole-u4u/sources`} style={{
                    display: 'block', padding: '16px', borderRadius: '14px',
                    background: 'var(--surface)', border: '1.5px solid var(--border-strong)',
                    textDecoration: 'none',
        }}>
                                <p style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-1)', margin: '0 0 4px' }}>{t.sourcesTitle}</p>p>
                                <p style={{ fontSize: '13px', color: 'var(--text-2)', margin: '0 0 10px', lineHeight: 1.4 }}>{t.sourcesDesc}</p>p>
                                <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--primary)' }}>{t.sourcesCta}</span>span>
                      </Link>Link>
              </section>section>
        
          {/* ── Source + Disclaimer ──────────────────────────────────── */}
              <section style={{ padding: '20px 20px 0' }}>
                      <p style={{ fontSize: '11px', color: 'var(--text-3)', lineHeight: 1.5 }}>
                                <a href="https://www.uscis.gov/i-131" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--primary)', fontWeight: 600 }}>
                                  {t.sourceBadge}
                                </a>a>
                        {' · '}{t.disclaimer}
                      </p>p>
              </section>section>
        </main>main>
      )
}</Link>
