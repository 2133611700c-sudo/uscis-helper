import { useTranslations, useLocale } from 'next-intl';
import Link from 'next/link';
import { LanguageSwitcher } from './LanguageSwitcher';

export function Header() {
  const t = useTranslations('header.nav');
  const locale = useLocale();

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border bg-background/95 backdrop-blur-sm">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        <Link href={`/${locale}`} className="flex items-center gap-2">
          <span className="text-xl font-bold text-primary">Messenginfo</span>
        </Link>
        <nav className="hidden md:flex items-center gap-6 text-sm">
          <Link href={`/${locale}`} className="text-muted-foreground hover:text-foreground transition-colors">
            {t('home')}
          </Link>
          <Link href={`/${locale}/privacy`} className="text-muted-foreground hover:text-foreground transition-colors">
            {t('privacy')}
          </Link>
          <Link href={`/${locale}/terms`} className="text-muted-foreground hover:text-foreground transition-colors">
            {t('terms')}
          </Link>
          <Link href={`/${locale}/disclaimer`} className="text-muted-foreground hover:text-foreground transition-colors">
            {t('disclaimer')}
          </Link>
        </nav>
        <LanguageSwitcher />
      </div>
    </header>
  );
}
