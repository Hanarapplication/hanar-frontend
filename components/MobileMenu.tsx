'use client';

import Link from 'next/link';
import {
  FaTimes,
  FaQuestionCircle,
  FaPhone,
  FaLanguage,
  FaThLarge, // ✅ Add this for Dashboard icon
  FaHome,
  FaCog,
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
      <aside
        className={`fixed top-0 right-0 h-full w-64 bg-white shadow-lg z-50 transform transition-transform duration-300 ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {/* Header */}
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

        {/* Menu Links */}
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

          <button className="flex items-center gap-2 hover:bg-gray-100 rounded-md p-2 transition-colors duration-200 focus:outline-none">
            <FaLanguage className="text-gray-500" />
            <span>Change Language</span>
          </button>
        </nav>
      </aside>
    </>
  );
}