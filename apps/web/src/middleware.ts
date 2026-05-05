import createMiddleware from 'next-intl/middleware'
import { type NextRequest, NextResponse } from 'next/server'
import { routing } from './i18n/routing'
import { buildSecurityHeaders } from '@/lib/security/headers'
import { isMaliciousBot } from '@/lib/security/bot'

const intlMiddleware = createMiddleware(routing)

export default async function middleware(req: NextRequest): Promise<NextResponse> {
  // ── 1. Bot detection ──────────────────────────────────────────────────────
  // Only runs for page routes — API routes are excluded by the matcher below.
  // Blocks known scraping tools, vuln scanners, and blank-UA requests.
  if (isMaliciousBot(req)) {
    console.warn('[security/bot] blocked:', req.headers.get('user-agent') ?? '(empty)', req.nextUrl.pathname)
    return new NextResponse('Forbidden', { status: 403 })
  }

  // ── 2. i18n routing ───────────────────────────────────────────────────────
  const response = await Promise.resolve(intlMiddleware(req))

  // ── 3. Security headers ───────────────────────────────────────────────────
  // Attach to every page response (CSP, HSTS, X-Frame-Options, etc.)
  const secHeaders = buildSecurityHeaders()
  for (const [key, value] of Object.entries(secHeaders)) {
    response.headers.set(key, value)
  }

  return response
}

export const config = {
  matcher: [
    // Exclude: API routes, Next.js internals, static files, images, icons, manifests
    '/((?!api|_next/static|_next/image|favicon\\.ico|favicon\\.png|icon\\.svg|apple-touch-icon\\.png|icons/|og/|sitemap\\.xml|robots\\.txt|manifest\\.webmanifest|.*\\.png|.*\\.jpg|.*\\.jpeg|.*\\.webp|.*\\.gif|.*\\.svg).*)',
  ],
}
