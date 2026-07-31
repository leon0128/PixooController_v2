import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import Image from 'next/image';
import Link from 'next/link';
import { Toaster } from '@/components/ui/sonner';
import { MainNav } from '@/components/main-nav';
import './globals.css';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: 'Pixoo Controller',
  description: 'Manage what a Divoom Pixoo64 displays, and when',
  // app/favicon.ico answers the browser's fixed /favicon.ico request and carries
  // 16, 32 and 48 px frames. These are what a tab or a bookmark picks up on a
  // high-DPI screen, where a 32 px icon is drawn at 64 and comes out soft.
  icons: {
    icon: [
      { url: '/icon-32.png', sizes: '32x32', type: 'image/png' },
      { url: '/icon-192.png', sizes: '192x192', type: 'image/png' },
    ],
    apple: { url: '/icon-180.png', sizes: '180x180', type: 'image/png' },
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    // scheme-light: no dark theme is implemented, and without pinning the canvas
    // the translucent page background composites over the browser's dark default.
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} bg-background scheme-light h-full antialiased`}
    >
      <body className="bg-muted/30 flex min-h-full flex-col">
        <header className="bg-background sticky top-0 z-10 border-b">
          <div className="mx-auto flex h-14 w-full max-w-5xl items-center gap-6 px-4">
            <Link
              href="/scenes"
              className="flex items-center gap-2 font-semibold tracking-tight"
            >
              {/* Decorative: the name is right beside it, so announcing the icon
                  too would only repeat it. */}
              <Image src="/icon-192.png" alt="" width={26} height={26} priority />
              Pixoo Controller
            </Link>
            <MainNav />
          </div>
        </header>
        <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8">{children}</main>
        <Toaster position="top-center" />
      </body>
    </html>
  );
}
