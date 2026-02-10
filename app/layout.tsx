// ✅ NO "use client" here
import './globals.css';
import { DarkModeProvider } from '@/context/DarkModeContext';
import { Toaster } from 'react-hot-toast';
import ConditionalAppShell from '@/components/ConditionalAppShell';
import { LanguageProvider } from '@/context/LanguageContext';

export const metadata = {
  title: 'Hanar',
  description: 'Connecting immigrant businesses and marketplaces',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head />
      <body className="dark:bg-gray-900 dark:text-gray-100 transition-colors duration-300">
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
