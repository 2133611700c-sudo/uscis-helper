import createNextIntlPlugin from 'next-intl/plugin';
import { withSentryConfig } from '@sentry/nextjs';

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['@uscis-helper/db', '@uscis-helper/shared'],
};

const intlConfig = withNextIntl(nextConfig);

// Sentry wraps the intl config — only activates when SENTRY_DSN is set
export default withSentryConfig(intlConfig, {
  // Source maps are uploaded to Sentry during CI/CD builds only
  // Set SENTRY_AUTH_TOKEN in Vercel env vars for this to work
  silent: true,
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,

  // Reduce bundle size — tree-shake Sentry logger
  disableLogger: true,

  // Tunnel Sentry requests through /monitoring to avoid ad-blockers
  tunnelRoute: '/monitoring',

  // Hide source maps from users (keep them server-side for debugging)
  hideSourceMaps: true,

  // Automatically instrument Next.js data fetchers
  autoInstrumentServerFunctions: true,
  autoInstrumentMiddleware: true,
  autoInstrumentAppDirectory: true,
});
