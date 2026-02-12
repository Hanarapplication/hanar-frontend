'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  FaHome,
  FaStore,
  FaComments,
  FaShoppingCart,
} from 'react-icons/fa';
import { useLanguage } from '@/context/LanguageContext';
import { t } from '@/utils/translations';

export default function MobileTopNav() {
  const pathname = usePathname();
  const { effectiveLang } = useLanguage();

  const navItems = [
    { href: '/', icon: <FaHome />, label: t(effectiveLang, 'Home') },
    { href: '/community', icon: <FaComments />, label: t(effectiveLang, 'Community') },
    { href: '/marketplace', icon: <FaShoppingCart />, label: t(effectiveLang, 'Marketplace') },
    { href: '/businesses', icon: <FaStore />, label: t(effectiveLang, 'Businesses') },
  ];

  return (
    <nav className="sticky top-0 left-0 right-0 z-40 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 transition-shadow duration-200">
      <div className="flex justify-around items-center py-2 px-4">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`relative flex flex-col items-center py-1.5 px-3 rounded-lg transition-all duration-200 focus:outline-none ${
                isActive
                  ? 'text-blue-600 dark:text-blue-400'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800'
              }`}
            >
              <div className={`text-lg transition-transform duration-150 ${isActive ? 'scale-110' : ''}`}>{item.icon}</div>
              <span className={`text-[10px] font-semibold mt-0.5 ${isActive ? '' : 'font-medium'}`}>
                {item.label}
              </span>
              {isActive && (
                <span className="absolute -bottom-2 left-1/2 -translate-x-1/2 h-0.5 w-6 rounded-full bg-blue-600 dark:bg-blue-400" />
              )}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
