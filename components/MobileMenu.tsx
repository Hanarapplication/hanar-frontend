'use client';

import Link from 'next/link';
import {
  FaTimes,
  FaSignInAlt,
  FaUserPlus,
  FaQuestionCircle,
  FaPhone,
  FaLanguage,
  FaMoon,
} from 'react-icons/fa';

export default function MobileMenu({
  isOpen,
  setIsOpen,
}: {
  isOpen: boolean;
  setIsOpen: (value: boolean) => void;
}) {
  return (
    <>
      {/* Overlay */}
      <div
        className={`fixed inset-0 z-50 bg-black/50 transition-opacity ${
          isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        onClick={() => setIsOpen(false)}
      />

      {/* Drawer Panel (right side) */}
      <div
        className={`fixed top-0 right-0 h-full w-64 bg-white shadow-lg z-50 transform transition-transform duration-300 ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <span className="font-bold text-lg">Menu</span>
          <button onClick={() => setIsOpen(false)}>
            <FaTimes className="text-black-600" />
          </button>
        </div>

        {/* Menu Links */}
        <div className="flex flex-col px-4 py-3 text-sm text-gray-800 space-y-4">
          <Link href="/login" onClick={() => setIsOpen(false)} className="flex items-center gap-2">
            <FaSignInAlt /> Login
          </Link>
          <Link href="/register" onClick={() => setIsOpen(false)} className="flex items-center gap-2">
            <FaUserPlus /> Register
          </Link>
          <Link href="/faq" onClick={() => setIsOpen(false)} className="flex items-center gap-2">
            <FaQuestionCircle /> FAQ / Help
          </Link>
          <Link href="/contact" onClick={() => setIsOpen(false)} className="flex items-center gap-2">
            <FaPhone /> Contact Us
          </Link>
          <Link href="/settings" onClick={() => setIsOpen(false)} className="flex items-center gap-2">
            <span className="text-lg">⚙️</span> Settings
          </Link>
          <button className="flex items-center gap-2">
            <FaLanguage /> Change Language
          </button>
          <button className="flex items-center gap-2">
            <FaMoon /> Dark Mode
          </button>
        </div>
      </div>
    </>
  );
}
