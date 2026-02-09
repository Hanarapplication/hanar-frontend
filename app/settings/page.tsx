'use client';

import { useState, useEffect } from 'react';
import { useDarkMode } from '@/context/DarkModeContext';
import { supabase } from '@/lib/supabaseClient';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { Camera, User } from 'lucide-react';

export default function SettingsPage() {
  const { darkMode, toggleDarkMode } = useDarkMode();
  const router = useRouter();
  const [language, setLanguage] = useState('en');
  const [notifications, setNotifications] = useState(true);
  const [profile, setProfile] = useState<{ username: string | null; profile_pic_url: string | null } | null>(null);
  const [profilePicUploading, setProfilePicUploading] = useState(false);

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.replace('/login');
        return;
      }
      const [{ data: profData }, { data: regData }] = await Promise.all([
        supabase.from('profiles').select('username, profile_pic_url').eq('id', user.id).maybeSingle(),
        supabase.from('registeredaccounts').select('username').eq('user_id', user.id).maybeSingle(),
      ]);
      const username = profData?.username ?? regData?.username ?? null;
      const profile_pic_url = profData?.profile_pic_url ?? null;
      setProfile(username !== null ? { username, profile_pic_url } : null);
    };
    load();
  }, [router]);

  const handleProfilePicChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || profilePicUploading || !profile?.username) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user?.id) return;

    setProfilePicUploading(true);
    try {
      const formData = new FormData();
      formData.set('id', user.id);
      formData.set('username', profile.username);
      formData.set('file', file);

      const res = await fetch('/api/update-profile-pic', { method: 'POST', body: formData });
      const json = await res.json();

      if (!res.ok) throw new Error(json?.error || 'Upload failed');
      setProfile((p) => (p ? { ...p, profile_pic_url: json.url } : null));
      toast.success('Profile picture updated');
    } catch (err: any) {
      toast.error(err?.message || 'Failed to update picture');
    } finally {
      setProfilePicUploading(false);
    }
  };

  return (
    <div className="max-w-xl mx-auto px-4 py-10">
      <h1 className="text-2xl font-bold text-blue-700 dark:text-blue-300 mb-6">Settings</h1>

      {/* Profile Picture */}
      <div className="mb-8">
        <label className="block font-medium text-gray-700 dark:text-gray-200 mb-2">Profile Picture</label>
        <div className="flex items-center gap-4">
          <label className="relative block shrink-0 cursor-pointer group">
            <div className="h-20 w-20 rounded-full overflow-hidden border-2 border-slate-200 bg-slate-100 flex items-center justify-center">
              {profile?.profile_pic_url ? (
                <img src={profile.profile_pic_url} alt="Profile" className="h-full w-full object-cover" onError={(e) => { e.currentTarget.src = '/default-avatar.png'; e.currentTarget.onerror = null; }} />
              ) : (
                <User className="h-10 w-10 text-slate-400" />
              )}
            </div>
            <span className="absolute bottom-0 right-0 flex h-7 w-7 items-center justify-center rounded-full bg-indigo-600 text-white shadow">
              <Camera className="h-3.5 w-3.5" />
            </span>
            <input type="file" accept="image/*" className="sr-only" onChange={handleProfilePicChange} disabled={profilePicUploading || !profile?.username} />
          </label>
          <div>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Click the avatar to upload a new profile picture. Your picture appears on your profile and community posts.
            </p>
          </div>
        </div>
      </div>

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
