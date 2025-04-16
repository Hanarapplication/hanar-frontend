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
    <nav className="sticky top-14 left-0 right-0 z-40 bg-gradient-to-r from-blue-400 to-blue-500 sm:hidden transition-all">
      <div className="flex justify-around items-center py-2 px-2">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center text-xs transition-transform duration-150 ease-out active:scale-110 ${
                isActive ? 'text-white scale-110' : 'text-white/80 hover:text-white'
              }`}
            >
              <div className="text-xl">{item.icon}</div>
              <span className="text-[11px] font-semibold mt-1">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
