'use client';

import { ReactNode } from 'react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  children: ReactNode;
}

export default function Modal({ isOpen, onClose, children }: ModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-10 backdrop-blur-sm backdrop-brightness-75 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-lg mx-4 relative">
        <button
          onClick={onClose}
          className="absolute top-3 right-4 text-gray-400 hover:text-gray-600 text-3xl font-bold"
        >
          ×
        </button>
        {children}
      </div>
    </div>
  );
}
