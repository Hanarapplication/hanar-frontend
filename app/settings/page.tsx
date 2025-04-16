'use client';

import { useState } from 'react';
import { useDarkMode } from '@/context/DarkModeContext';

export default function SettingsPage() {
  const { darkMode, toggleDarkMode } = useDarkMode();

  const [language, setLanguage] = useState('en');
  const [notifications, setNotifications] = useState(true);

  return (
    <div className="max-w-xl mx-auto px-4 py-10">
      <h1 className="text-2xl font-bold text-blue-700 dark:text-blue-300 mb-6">Settings</h1>

      {/* Language */}
      <div className="mb-6">
        <label className="block font-medium text-gray-700 dark:text-gray-200 mb-1">🌐 Language</label>
        <select
          value={language}
          onChange={(e) => setLanguage(e.target.value)}
          className="w-full border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-white p-2 rounded focus:ring-2 focus:ring-blue-400"
        >
          <option value="en">English</option>
          <option value="fa">Farsi (Persian)</option>
          <option value="ar">Arabic</option>
          <option value="tr">Turkish</option>
          <option value="ps">Pashto</option>
        </select>
      </div>

      {/* Dark Mode Toggle */}
      <div className="mb-6 flex items-center justify-between">
        <span className="font-medium text-gray-700 dark:text-gray-200">🌙 Dark Mode</span>
        <label className="inline-flex items-center cursor-pointer">
          <input
            type="checkbox"
            checked={darkMode}
            onChange={toggleDarkMode}
            className="sr-only"
          />
          <div className="w-11 h-6 bg-gray-300 dark:bg-gray-600 rounded-full shadow-inner relative transition">
            <div
              className={`absolute left-1 top-1 w-4 h-4 bg-white rounded-full shadow transform transition-transform ${
                darkMode ? 'translate-x-5' : ''
              }`}
            />
          </div>
        </label>
      </div>

      {/* Notification Toggle */}
      <div className="mb-6 flex items-center justify-between">
        <span className="font-medium text-gray-700 dark:text-gray-200">🔔 Email Notifications</span>
        <label className="inline-flex items-center cursor-pointer">
          <input
            type="checkbox"
            checked={notifications}
            onChange={() => setNotifications(!notifications)}
            className="sr-only"
          />
          <div className="w-11 h-6 bg-gray-300 dark:bg-gray-600 rounded-full shadow-inner relative transition">
            <div
              className={`absolute left-1 top-1 w-4 h-4 bg-white rounded-full shadow transform transition-transform ${
                notifications ? 'translate-x-5' : ''
              }`}
            />
          </div>
        </label>
      </div>

      {/* Placeholder for future save */}
      <div className="mt-10">
        <button
          disabled
          className="w-full bg-gray-300 text-gray-500 px-4 py-2 rounded cursor-not-allowed"
        >
          Saving coming soon...
        </button>
      </div>
    </div>
  );
}
