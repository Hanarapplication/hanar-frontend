// ✅ NO "use client" here
import './globals.css';
import { DarkModeProvider } from '@/context/DarkModeContext';
import { Toaster } from 'react-hot-toast';
import ConditionalAppShell from '@/components/ConditionalAppShell';
import PwaRegistration from '@/components/PwaRegistration';
import { LanguageProvider } from '@/context/LanguageContext';
import FcmTokenHandler from '@/components/FcmTokenHandler';

export const metadata = {
  title: 'Hanar',
  description: 'Connecting immigrant businesses and marketplaces',
  manifest: '/manifest.json',
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: '#4f46e5',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#4f46e5" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="Hanar" />
        <link rel="apple-touch-icon" href="/hanar.logo.png" />
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
