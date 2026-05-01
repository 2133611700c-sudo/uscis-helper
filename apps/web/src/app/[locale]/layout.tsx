import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { NextIntlClientProvider, hasLocale } from 'next-intl';
import { getTranslations } from 'next-intl/server';
import { notFound } from 'next/navigation';
import Script from 'next/script';
import { Analytics } from '@vercel/analytics/next';
import { SpeedInsights } from '@vercel/speed-insights/next';
import { routing } from '@/i18n/routing';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { MobileBottomBar } from '@/components/layout/MobileBottomBar';
import { MiaFloatingWidget } from '@/components/widgets/MiaFloatingWidget';
import '../globals.css';

const inter = Inter({ subsets: ['latin', 'cyrillic'], variable: '--font-inter' });

type Props = {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'metadata' });
  const localeMap: Record<string, string> = {
    en: 'en_US',
    ru: 'ru_RU',
    uk: 'uk_UA',
    es: 'es_ES',
  };

  return {
    title: t('title'),
    description: t('description'),
    keywords: t('keywords'),
    metadataBase: new URL('https://messenginfo.com'),
    icons: {
      icon: [
        { url: '/favicon.ico' },
        { url: '/icon-16x16.png', sizes: '16x16', type: 'image/png' },
        { url: '/icon-32x32.png', sizes: '32x32', type: 'image/png' },
        { url: '/icon-48x48.png', sizes: '48x48', type: 'image/png' },
        { url: '/icon.svg', type: 'image/svg+xml' },
      ],
      shortcut: '/favicon.ico',
      apple: [{ url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' }],
    },
    alternates: {
      canonical: `https://messenginfo.com/${locale}`,
      languages: {
        'en': 'https://messenginfo.com/en',
        'ru': 'https://messenginfo.com/ru',
        'uk': 'https://messenginfo.com/uk',
        'es': 'https://messenginfo.com/es',
        'x-default': 'https://messenginfo.com/en',
      },
    },
    openGraph: {
      title: t('title'),
      description: t('description'),
      url: `https://messenginfo.com/${locale}`,
      siteName: 'Messenginfo',
      locale: localeMap[locale] ?? 'en_US',
      type: 'website',
      images: [{ url: '/og-image.png', width: 1200, height: 630, alt: 'Messenginfo' }],
    },
    twitter: {
      card: 'summary_large_image',
      images: ['/og-image.png'],
    },
    robots: { index: true, follow: true },
  };
}

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

const organizationJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  name: 'Messenginfo',
  url: 'https://messenginfo.com',
  email: 'contact@messenginfo.com',
  areaServed: 'US',
  knowsLanguage: ['en', 'ru', 'uk', 'es'],
};

export default async function LocaleLayout({ children, params }: Props) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();

  const messages = (await import(`../../../messages/${locale}.json`)).default;

  return (
    <html lang={locale} className={inter.variable}>
      <body className="min-h-screen flex flex-col bg-background text-foreground antialiased pb-14 md:pb-0">
        <NextIntlClientProvider locale={locale} messages={messages}>
          <Header />
          <main className="flex-1">{children}</main>
          <Footer />
          <MobileBottomBar />
          <MiaFloatingWidget />
        </NextIntlClientProvider>
        <Analytics />
        <SpeedInsights />
        <Script
          id="org-jsonld"
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationJsonLd) }}
        />
      </body>
    </html>
  );
}
