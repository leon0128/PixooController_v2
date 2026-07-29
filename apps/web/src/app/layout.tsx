import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
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
            <Link href="/scenes" className="font-semibold tracking-tight">
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
