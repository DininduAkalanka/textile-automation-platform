import type { MetadataRoute } from 'next';

/** Web app manifest: the shop's name, colours and icons for browsers and phones. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Nandana Textile',
    short_name: 'Nandana',
    description:
      'Sarees, apparel, fabrics and school, corporate and healthcare uniforms, with island-wide delivery across Sri Lanka.',
    start_url: '/',
    display: 'standalone',
    background_color: '#ffffff',
    theme_color: '#CC0000',
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
  };
}
