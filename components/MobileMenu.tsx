'use client';

import Link from 'next/link';
import {
  FaTimes,
  FaQuestionCircle,
  FaPhone,
  FaLanguage,
  FaThLarge,
  FaHome,
  FaCog,
  FaSignOutAlt,
  FaSignInAlt
} from 'react-icons/fa';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import { useLanguage } from '@/context/LanguageContext'; // NEW

export default function MobileMenu({
  isOpen,
  setIsOpen,
}: {
  isOpen: boolean;
  setIsOpen: (value: boolean) => void;
}) {
  const [loggedIn, setLoggedIn] = useState(false);
  const { lang, setLang } = useLanguage(); // NEW
  const router = useRouter();

  useEffect(() => {
    const checkSession = async () => {
      const { data } = await supabase.auth.getSession();
      setLoggedIn(!!data?.session);
    };
    checkSession();
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setIsOpen(false);
    router.push('/login');
  };

  return (
    <>
      {/* Overlay */}
      <div
        className={`fixed inset-0 z-50 bg-black/50 transition-opacity ${
          isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        onClick={() => setIsOpen(false)}
      />

      {/* Drawer Panel */}
      <aside
        className={`fixed top-0 right-0 h-full w-64 bg-white shadow-lg z-50 transform transition-transform duration-300 ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <span className="font-semibold text-lg text-gray-800">Menu</span>
          <button
            onClick={() => setIsOpen(false)}
            className="focus:outline-none"
            aria-label="Close Menu"
          >
            <FaTimes className="text-gray-600 hover:text-gray-800 transition" />
          </button>
        </div>

        <nav className="flex flex-col px-4 py-4 text-sm text-gray-700 space-y-3">
          <Link
            href="/"
            onClick={() => setIsOpen(false)}
            className="flex items-center gap-2 hover:bg-gray-100 rounded-md p-2 transition-colors duration-200 focus:outline-none"
          >
            <FaHome className="text-gray-500" />
            <span>Home</span>
          </Link>

          <Link
            href="/dashboard"
            onClick={() => setIsOpen(false)}
            className="flex items-center gap-2 hover:bg-gray-100 rounded-md p-2 transition-colors duration-200 focus:outline-none"
          >
            <FaThLarge className="text-gray-500" />
            <span>Dashboard</span>
          </Link>

          <Link
            href="/faq"
            onClick={() => setIsOpen(false)}
            className="flex items-center gap-2 hover:bg-gray-100 rounded-md p-2 transition-colors duration-200 focus:outline-none"
          >
            <FaQuestionCircle className="text-gray-500" />
            <span>FAQ / Help</span>
          </Link>

          <Link
            href="/contact"
            onClick={() => setIsOpen(false)}
            className="flex items-center gap-2 hover:bg-gray-100 rounded-md p-2 transition-colors duration-200 focus:outline-none"
          >
            <FaPhone className="text-gray-500" />
            <span>Contact Us</span>
          </Link>

          <Link
            href="/settings"
            onClick={() => setIsOpen(false)}
            className="flex items-center gap-2 hover:bg-gray-100 rounded-md p-2 transition-colors duration-200 focus:outline-none"
          >
            <FaCog className="text-gray-500" />
            <span>Settings</span>
          </Link>

          <div className="flex items-center gap-2">
            <FaLanguage className="text-gray-500" />
            <select value={lang} onChange={(e) => setLang(e.target.value)}>
  <option value="en">🇺🇸 English</option>
  <option value="ar">🇸🇦 Arabic</option>
  <option value="fa">🇮🇷 Farsi</option>
  <option value="zh">🇨🇳 Chinese</option>
  <option value="es">🇪🇸 Spanish</option>
  <option value="ru">🇷🇺 Russian</option>
  <option value="tr">🇹🇷 Turkish</option>
  <option value="ps">🇦🇫 Pashto</option>
  <option value="ko">🇰🇷 Korean</option>
  <option value="fr">🇫🇷 French</option>
  <option value="de">🇩🇪 German</option>
  <option value="auto">🌍 Auto</option>
</select>

          </div>

          <button
            onClick={() => {
              setIsOpen(false);
              if (loggedIn) handleLogout();
              else router.push('/login');
            }}
            className="flex items-center gap-2 hover:bg-gray-100 rounded-md p-2 transition-colors duration-200 focus:outline-none mt-2"
          >
            {loggedIn ? (
              <>
                <FaSignOutAlt className="text-gray-500" />
                <span>Log Out</span>
              </>
            ) : (
              <>
                <FaSignInAlt className="text-gray-500" />
                <span>Log In</span>
              </>
            )}
          </button>
        </nav>
      </aside>
    </>
  );
}
