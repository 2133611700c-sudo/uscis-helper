import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Messenginfo',
    short_name: 'Messenginfo',
    description: 'Immigration information, made human.',
    start_url: '/',
    display: 'standalone',
    background_color: '#ffffff',
    theme_color: '#4f46e5',
    icons: [],
  };
}
