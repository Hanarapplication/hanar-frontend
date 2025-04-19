'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  FaHome,
  FaStore,
  FaComments,
  FaShoppingCart,
} from 'react-icons/fa';

export default function MobileTopNav() {
  const pathname = usePathname();

  const navItems = [
    { href: '/', icon: <FaHome />, label: 'Home' },
    { href: '/community', icon: <FaComments />, label: 'Community' },
    { href: '/marketplace', icon: <FaShoppingCart />, label: 'Marketplace' },
    { href: '/businesses', icon: <FaStore />, label: 'Businesses' },
  ];

  return (
    <nav className="sticky top-0 left-0 right-0 z-40 bg-white border-b border-gray-200 sm:hidden transition-shadow duration-200">
      <div className="flex justify-around items-center py-3 px-4 shadow-sm">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center text-gray-600 transition-colors duration-200 focus:outline-none ${
                isActive ? 'text-blue-600' : 'hover:text-blue-500'
              }`}
            >
              <div className={`text-xl ${isActive ? 'text-blue-600' : ''}`}>{item.icon}</div>
              <span className={`text-xs font-medium mt-1 ${isActive ? 'text-blue-600' : ''}`}>{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}