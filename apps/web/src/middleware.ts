import createMiddleware from 'next-intl/middleware';
import { routing } from './i18n/routing';

export default createMiddleware(routing);

export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|favicon\\.ico|favicon\\.png|icon\\.svg|apple-touch-icon\\.png|icons/|og/|sitemap\\.xml|robots\\.txt|manifest\\.webmanifest).*)',
  ],
};
