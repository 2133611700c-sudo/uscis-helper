/**
 * /[locale]/services/re-parole-u4u/checkout/success
 * Stage 8I — Localized success page + back button
 */

interface Props {
  params: Promise<{ locale: string }>
}

const T = {
  uk: {
    title: '✅ Оплата отримана',
    body: 'Дякуємо. Ваш пакет готується і буде надісланий на email найближчим часом.',
    note: 'Якщо не отримаєте лист протягом 30 хвилин — напишіть на support@messenginfo.com',
    back: '← Повернутись на головну',
  },
  ru: {
    title: '✅ Оплата получена',
    body: 'Спасибо. Ваш пакет готовится и будет отправлен на email в ближайшее время.',
    note: 'Если не получите письмо в течение 30 минут — напишите на support@messenginfo.com',
    back: '← Вернуться на главную',
  },
  en: {
    title: '✅ Payment received',
    body: 'Thank you. Your packet is being prepared and will be emailed to you shortly.',
    note: 'If you don\'t receive the email within 30 minutes, contact support@messenginfo.com',
    back: '← Return to home',
  },
  es: {
    title: '✅ Pago recibido',
    body: 'Gracias. Su paquete está siendo preparado y le será enviado por correo electrónico en breve.',
    note: 'Si no recibe el correo en 30 minutos, contacte support@messenginfo.com',
    back: '← Volver al inicio',
  },
} as const

type Locale = keyof typeof T

export default async function CheckoutSuccessPage({ params }: Props) {
  const { locale } = (await params) as { locale: Locale }
  const t = T[locale] ?? T.en

  return (
    <main
      style={{
        minHeight: '100dvh',
        background: 'var(--background)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '32px 20px',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '480px',
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: '16px',
          padding: '28px 24px',
          textAlign: 'center',
        }}
      >
        <h1 style={{ fontSize: '22px', fontWeight: 800, color: 'var(--text-1)', marginBottom: '12px' }}>
          {t.title}
        </h1>
        <p style={{ fontSize: '15px', color: 'var(--text-2)', lineHeight: 1.5, marginBottom: '12px' }}>
          {t.body}
        </p>
        <p style={{ fontSize: '12px', color: 'var(--text-3)', lineHeight: 1.5, marginBottom: '24px' }}>
          {t.note}
        </p>
        <a
          href={`/${locale}/services/re-parole-u4u`}
          style={{
            display: 'block',
            width: '100%',
            height: '48px',
            lineHeight: '48px',
            textAlign: 'center',
            borderRadius: '10px',
            fontSize: '15px',
            fontWeight: 700,
            color: 'var(--primary)',
            background: 'var(--surface-2)',
            border: '1px solid var(--border)',
            textDecoration: 'none',
          }}
        >
          {t.back}
        </a>
      </div>
    </main>
  )
}
