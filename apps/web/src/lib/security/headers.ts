/**
 * Security response headers for all page routes.
 * Applied in middleware.ts after i18n processing.
 *
 * CSP notes:
 *  - 'unsafe-inline' + 'unsafe-eval' for scripts: required by Next.js 15 App Router
 *    hydration and Tailwind v4 CSS-in-JS. Tighten with per-request nonces in Wave 2.
 *  - connect-src covers Supabase REST + realtime (wss) + Vercel Analytics vitals.
 *  - frame-ancestors 'none' blocks clickjacking (mirrors X-Frame-Options: DENY).
 *  - upgrade-insecure-requests: redirect HTTP sub-resources to HTTPS automatically.
 */
export function buildSecurityHeaders(): Record<string, string> {
  const csp = [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://va.vercel-scripts.com",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self'",
    "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://vitals.vercel-insights.com",
    "media-src 'none'",
    "object-src 'none'",
    "frame-src 'none'",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "upgrade-insecure-requests",
  ].join('; ')

  return {
    'Content-Security-Policy': csp,
    // Prevent embedding in iframes (belt-and-suspenders with frame-ancestors)
    'X-Frame-Options': 'DENY',
    // Prevent MIME-type sniffing
    'X-Content-Type-Options': 'nosniff',
    // Limit referrer info sent to third-party sites
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    // Disable features we don't use
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
    // Force HTTPS for 2 years, include subdomains
    'Strict-Transport-Security': 'max-age=63072000; includeSubDomains; preload',
    // Don't pre-resolve DNS for external domains
    'X-DNS-Prefetch-Control': 'off',
  }
}
