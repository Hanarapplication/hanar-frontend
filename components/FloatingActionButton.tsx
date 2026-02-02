'use client';

import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FaStore,
  FaShoppingCart,
  FaComments,
  FaHome,
} from 'react-icons/fa';

export default function FloatingActionButton() {
  const [open, setOpen] = useState(false);
  const fabRef = useRef<HTMLDivElement>(null);

  const navOptions = [
    { label: 'Home', icon: <FaHome />, color: 'bg-gray-700', link: '/' },
    { label: 'Businesses', icon: <FaStore />, color: 'bg-gray-700', link: '/businesses' },
    { label: 'Marketplace', icon: <FaShoppingCart />, color: 'bg-gray-700', link: '/marketplace' },
    { label: 'Community', icon: <FaComments />, color: 'bg-gray-700', link: '/community' },
  ];

  const handleNav = (url: string) => {
    setOpen(false);
    window.location.href = url;
  };

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (fabRef.current && !fabRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const handleScroll = () => open && setOpen(false);
    document.addEventListener('click', handleClickOutside);
    window.addEventListener('scroll', handleScroll);
    return () => {
      document.removeEventListener('click', handleClickOutside);
      window.removeEventListener('scroll', handleScroll);
    };
  }, [open]);

  return (
    <div
      ref={fabRef}
      className="fixed bottom-4 left-5 z-60"
    >
      {/* Optional Glow */}
      {open && (
        <div className="absolute w-40 h-40 bg-pink-200 opacity-20 blur-xl animate-pulse -z-10 rounded-full" />
      )}

      {/* Arc-style Buttons */}
      <AnimatePresence>
        {open && (
          <div className="relative">
            {navOptions.map((btn, index) => {
              const total = navOptions.length;
              const angleStart = -70;  // shifted down
              const angleEnd = 45;     // expanded wider
              const step = (angleEnd - angleStart) / (total - 1);
              const angle = angleStart + step * index;

              const radius = 110; // pulled outward for spacing
              const x = radius * Math.cos((angle * Math.PI) / 190);
              const y = radius * Math.sin((angle * Math.PI) / 190);

              return (
                <motion.button
                  key={index}
                  onClick={() => handleNav(btn.link)}
                  initial={{ opacity: 0, x: 0, y: 0, scale: 0.10 }}
                  animate={{ opacity: 1, x, y, scale: 1 }}
                  exit={{ opacity: 0, x: 0, y: 0, scale: 0.5 }}
                  transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                  style={{ backgroundColor: '#A93226' }} // 🍷 Lighter Pomegranate Red
                  className={`${btn.color} text-white px-4 py-2 rounded-full absolute shadow-md text-sm flex items-center gap-2`}
                >
                  {btn.icon}
                  <span>{btn.label}</span>
                </motion.button>
              );
            })}
          </div>
        )}
      </AnimatePresence>

      {/* Main FAB Button - Bigger */}
      <button
        onClick={() => setOpen(!open)}
        className="transition hover:scale-105 relative drop-shadow-2xl"
      >
        <img
          src="/hanar-logo.png"
          alt="Menu"
          className="w-24 h-24 object-contain"
        />
      </button>
    </div>
  );
}
