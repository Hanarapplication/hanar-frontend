// ✅ NO "use client" here
import type { Metadata, Viewport } from 'next';
import './globals.css';
import { DarkModeProvider } from '@/context/DarkModeContext';
import { Toaster } from 'react-hot-toast';
import ConditionalAppShell from '@/components/ConditionalAppShell';
import PwaRegistration from '@/components/PwaRegistration';
import { LanguageProvider } from '@/context/LanguageContext';
import FcmTokenHandler from '@/components/FcmTokenHandler';

/** Golden yellow from brand mark — matches favicon / PWA chrome. */
const BRAND_THEME = '#e8c547';

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? 'https://hanar.net'),
  title: 'Hanar',
  description: 'Connecting immigrant businesses and marketplaces',
  manifest: '/manifest.json',
  icons: {
    icon: [
      { url: '/icons/favicon-16x16.png', sizes: '16x16', type: 'image/png' },
      { url: '/icons/favicon-32x32.png', sizes: '32x32', type: 'image/png' },
      { url: '/hanar.logo.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: '/icons/apple-touch-icon.png',
    shortcut: '/hanar.logo.png',
  },
  appleWebApp: {
    title: 'Hanar',
    capable: true,
    statusBarStyle: 'default',
  },
  openGraph: {
    type: 'website',
    title: 'Hanar',
    description: 'Connecting immigrant businesses and marketplaces',
    images: [{ url: '/hanar.logo.png', width: 512, height: 512, alt: 'Hanar' }],
  },
  twitter: {
    card: 'summary',
    title: 'Hanar',
    description: 'Connecting immigrant businesses and marketplaces',
    images: ['/hanar.logo.png'],
  },
};

/** `viewportFit: cover` is required for `env(safe-area-inset-*)` on notched iOS and many mobile browsers. */
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
  themeColor: BRAND_THEME,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){var d=document.documentElement,v=localStorage.getItem('hanar-dark-mode');d.classList.toggle('dark',v==='true');})();`,
          }}
        />
      </head>
      <body className="bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 transition-colors duration-300">
        <FcmTokenHandler />
        <PwaRegistration />
        <LanguageProvider>
          <DarkModeProvider>
            <ConditionalAppShell>{children}</ConditionalAppShell>
            <Toaster
              position="top-center"
              toastOptions={{
                duration: 4000,
                className:
                  'rounded-2xl border border-indigo-200 bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-500 text-white shadow-2xl',
                style: { padding: '12px 16px' },
                iconTheme: {
                  primary: '#ffffff',
                  secondary: '#4f46e5',
                },
              }}
            />
          </DarkModeProvider>
        </LanguageProvider>
      </body>
    </html>
  );
}
