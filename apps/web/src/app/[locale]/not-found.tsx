import { useTranslations } from 'next-intl';
import Link from 'next/link';

export default function NotFound() {
  const t = useTranslations('errors');
  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center gap-4 text-center px-4">
      <h1 className="text-6xl font-bold text-muted-foreground">404</h1>
      <p className="text-xl text-foreground">{t('404')}</p>
      <Link href="/" className="text-primary underline underline-offset-4 hover:opacity-80">
        {t('backHome')}
      </Link>
    </div>
  );
}
