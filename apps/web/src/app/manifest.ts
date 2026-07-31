import type { MetadataRoute } from 'next';

/**
 * Makes the app installable, which is mostly what gives a phone something to put
 * on its home screen. Next.js links this automatically, so no <link> is needed.
 *
 * The icons come from public/ rather than the app/icon convention, whose URLs are
 * content-hashed and therefore cannot be named here.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Pixoo Controller',
    short_name: 'Pixoo',
    description: 'Manage what a Divoom Pixoo64 displays, and when',
    start_url: '/',
    display: 'standalone',
    // The UI is light only — see the scheme-light pin in layout.tsx.
    background_color: '#ffffff',
    theme_color: '#ffffff',
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
  };
}
