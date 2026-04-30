import { useTranslations, useLocale } from 'next-intl';
import Link from 'next/link';

export function Footer() {
  const t = useTranslations('footer');
  const tLinks = useTranslations('footer.links');
  const locale = useLocale();
  const year = new Date().getFullYear();

  return (
    <footer className="border-t border-border bg-muted/30">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="md:col-span-2">
            <p className="text-lg font-semibold text-primary mb-2">Messenginfo</p>
            <p className="text-sm text-muted-foreground mb-4">{t('tagline')}</p>
            <p className="text-xs text-muted-foreground max-w-md">{t('shortDisclaimer')}</p>
          </div>
          <div>
            <p className="text-sm font-medium mb-3">{t('contact')}</p>
            <nav className="flex flex-col gap-2 text-sm">
              <Link href={`/${locale}/privacy`} className="text-muted-foreground hover:text-foreground transition-colors">
                {tLinks('privacy')}
              </Link>
              <Link href={`/${locale}/terms`} className="text-muted-foreground hover:text-foreground transition-colors">
                {tLinks('terms')}
              </Link>
              <Link href={`/${locale}/disclaimer`} className="text-muted-foreground hover:text-foreground transition-colors">
                {tLinks('disclaimer')}
              </Link>
              <a href="mailto:contact@messenginfo.com" className="text-muted-foreground hover:text-foreground transition-colors">
                contact@messenginfo.com
              </a>
            </nav>
          </div>
        </div>
        <div className="mt-8 pt-6 border-t border-border">
          <p className="text-xs text-muted-foreground text-center">
            {t('rights', { year })}
          </p>
        </div>
      </div>
    </footer>
  );
}
