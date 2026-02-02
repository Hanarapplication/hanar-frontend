'use client';

import LiveRefreshLink from '@/components/LiveRefreshLink';
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
  const { lang } = useLanguage();

  const navItems = [
    { href: '/', icon: <FaHome />, label: t(lang, 'Home') },
    { href: '/community', icon: <FaComments />, label: t(lang, 'Community') },
    { href: '/marketplace', icon: <FaShoppingCart />, label: t(lang, 'Marketplace') },
    { href: '/businesses', icon: <FaStore />, label: t(lang, 'Businesses') },
  ];

  return (
    <nav className="sticky top-0 left-0 right-0 z-40 bg-white border-b border-gray-200 transition-shadow duration-200">
      <div className="flex justify-around items-center py-3 px-4 shadow-sm">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          return (
            <LiveRefreshLink
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center text-gray-600 transition-colors duration-200 focus:outline-none ${
                isActive ? 'text-blue-600' : 'hover:text-blue-500'
              }`}
            >
              <div className={`text-xl ${isActive ? 'text-red-700' : ''}`}>{item.icon}</div>
              <span className={`text-xs font-medium mt-1 ${isActive ? 'text-red-700' : ''}`}>
                {item.label}
              </span>
            </LiveRefreshLink>
          );
        })}
      </div>
    </nav>
  );
}
