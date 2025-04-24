import Navbar from '../components/Navbar';
import './globals.css';
import LocationPromptModal from '@/components/LocationPrompt';
import MobileTopNav from '@/components/MobileTopNav';
import { DarkModeProvider } from '@/context/DarkModeContext';
import { Toaster } from 'react-hot-toast';

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
      <body className="dark:bg-gray-900 dark:text-gray-100 transition-colors duration-300">
        <DarkModeProvider>
          <LocationPromptModal />
          <Navbar />
          <MobileTopNav />
          <main>{children}</main>

          {/* ✅ Toast Notifications */}
          <Toaster position="top-center" toastOptions={{ duration: 4000 }} />
        </DarkModeProvider>
      </body>
    </html>
  );
}
