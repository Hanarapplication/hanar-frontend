import Navbar from '../components/Navbar';
import './globals.css';
import LocationPromptModal from '@/components/LocationPrompt';
import MobileTopNav from '@/components/MobileTopNav';
import { DarkModeProvider } from '@/context/DarkModeContext';

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
      <body className="bg-white text-gray-800 dark:bg-gray-900 dark:text-gray-100 transition-colors duration-300">
        <DarkModeProvider>
          {/* 📍 Location prompt */}
          <LocationPromptModal />

          {/* 🧭 Top navbar */}
          <Navbar />

          {/* 📱 Mobile navigation bar just under Navbar */}
          <MobileTopNav />

          {/* 📄 Page content */}
          <main>{children}</main>
        </DarkModeProvider>
      </body>
    </html>
  );
}
