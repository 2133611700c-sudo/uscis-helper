import type { MetadataRoute } from 'next';

const BASE_URL = 'https://messenginfo.com';
const LOCALES = ['en', 'ru', 'uk'] as const;
const PAGES = ['', '/privacy', '/terms', '/disclaimer'] as const;

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();
  const entries: MetadataRoute.Sitemap = [];

  for (const locale of LOCALES) {
    for (const page of PAGES) {
      const url = `${BASE_URL}/${locale}${page}`;
      entries.push({
        url,
        lastModified,
        changeFrequency: page === '' ? 'weekly' : 'monthly',
        priority: page === '' ? 1.0 : 0.7,
        alternates: {
          languages: Object.fromEntries(
            LOCALES.map((l) => [l, `${BASE_URL}/${l}${page}`]),
          ),
        },
      });
    }
  }

  return entries;
}
