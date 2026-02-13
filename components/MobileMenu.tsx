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
  FaSignInAlt,
} from 'react-icons/fa';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import { useLanguage } from '@/context/LanguageContext';
import { supportedLanguages } from '@/utils/languages';
import { t } from '@/utils/translations';

export default function MobileMenu({
  isOpen,
  setIsOpen,
}: {
  isOpen: boolean;
  setIsOpen: (value: boolean) => void;
}) {
  const [loggedIn, setLoggedIn] = useState(false);
  const [userRole, setUserRole] = useState<'individual' | 'business' | 'organization' | null>(null);
  const { lang, setLang, effectiveLang } = useLanguage();
  const router = useRouter();

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const storedUserType = localStorage.getItem('userType');
      if (storedUserType === 'business' || storedUserType === 'organization' || storedUserType === 'individual') {
        setUserRole(storedUserType);
      }
    }

    const checkSession = async () => {
      const { data } = await supabase.auth.getSession();
      const user = data?.session?.user;
      setLoggedIn(!!user);

      if (user) {
        const { data: profile } = await supabase
          .from('registeredaccounts')
          .select('business, organization')
          .eq('user_id', user.id)
          .maybeSingle();

        let nextRole: 'business' | 'organization' | 'individual' = 'individual';
        if (profile?.business) nextRole = 'business';
        else if (profile?.organization) nextRole = 'organization';
        setUserRole(nextRole);
        if (typeof window !== 'undefined') {
          localStorage.setItem('userType', nextRole);
        }
      }
    };

    checkSession();
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    // Clear user type from localStorage
    if (typeof window !== 'undefined') {
      localStorage.removeItem('userType');
    }
    setIsOpen(false);
    router.push('/login');
  };

  return (
    <>
      {/* Overlay */}
      <div
        className={`fixed inset-0 z-50 bg-black/40 backdrop-blur-sm transition-opacity duration-200 ${
          isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        onClick={() => setIsOpen(false)}
      />

      {/* Drawer Panel */}
      <aside
        className={`fixed top-0 right-0 h-full w-64 bg-white dark:bg-gray-900 shadow-2xl z-50 transform transition-transform duration-250 ease-out ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-800">
          <span className="font-semibold text-lg text-gray-800 dark:text-gray-100">{t(effectiveLang, 'menu')}</span>
          <button onClick={() => setIsOpen(false)} className="focus:outline-none" aria-label="Close Menu">
            <FaTimes className="text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 transition" />
          </button>
        </div>

        <nav className="flex flex-col px-4 py-4 text-sm text-gray-700 space-y-3">
          <Link
            href="/"
            onClick={() => setIsOpen(false)}
            className="flex items-center gap-2 hover:bg-gray-100 rounded-md p-2 transition-colors duration-200 focus:outline-none"
          >
            <FaHome className="text-gray-500" />
            <span>{t(effectiveLang, 'Home')}</span>
          </Link>

          <Link
            href={
              userRole === 'business'
                ? '/business-dashboard'
                : userRole === 'organization'
                ? '/organization/dashboard'
                : '/dashboard'
            }
            onClick={(e) => {
              setIsOpen(false);
              if (!loggedIn) {
                e.preventDefault();
                router.push('/login');
              }
            }}
            className="flex items-center gap-2 hover:bg-gray-100 rounded-md p-2 transition-colors duration-200 focus:outline-none"
          >
            <FaThLarge className="text-gray-500" />
            <span>{t(effectiveLang, 'dashboard')}</span>
          </Link>

          <Link
            href="/faq"
            onClick={() => setIsOpen(false)}
            className="flex items-center gap-2 hover:bg-gray-100 rounded-md p-2 transition-colors duration-200 focus:outline-none"
          >
            <FaQuestionCircle className="text-gray-500" />
            <span>{t(effectiveLang, 'faq')}</span>
          </Link>

          <Link
            href="/contact"
            onClick={() => setIsOpen(false)}
            className="flex items-center gap-2 hover:bg-gray-100 rounded-md p-2 transition-colors duration-200 focus:outline-none"
          >
            <FaPhone className="text-gray-500" />
            <span>{t(effectiveLang, 'contact')}</span>
          </Link>

          <Link
            href="/settings"
            onClick={() => setIsOpen(false)}
            className="flex items-center gap-2 hover:bg-gray-100 rounded-md p-2 transition-colors duration-200 focus:outline-none"
          >
            <FaCog className="text-gray-500" />
            <span>{t(effectiveLang, 'settings')}</span>
          </Link>

          <div className="flex items-center gap-2">
            <FaLanguage className="text-gray-500" />
            <select
              value={lang}
              onChange={(e) => setLang(e.target.value)}
              className="border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none w-full"
            >
              {supportedLanguages.map(({ code, name, emoji }) => (
                <option key={code} value={code}>
                  {emoji} {name}
                </option>
              ))}
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
                <span>{t(effectiveLang, 'logout')}</span>
              </>
            ) : (
              <>
                <FaSignInAlt className="text-gray-500" />
                <span>{t(effectiveLang, 'login')}</span>
              </>
            )}
          </button>
        </nav>
      </aside>
    </>
  );
}
