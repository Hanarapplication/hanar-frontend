'use client';

import { useDarkMode } from '@/context/DarkModeContext';
import { useRouter } from 'next/navigation';
import { useLanguage } from '@/context/LanguageContext';
import { t } from '@/utils/translations';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import PushNotificationToggle from '@/components/PushNotificationToggle';
import toast from 'react-hot-toast';
import { AlertTriangle, X } from 'lucide-react';

const DELETE_REASONS = [
  { value: 'want_break', labelKey: 'I want a break' },
  { value: 'not_useful', labelKey: 'Not useful for me' },
  { value: 'too_much_spam', labelKey: 'Too many emails / spam' },
  { value: 'privacy', labelKey: 'Privacy concerns' },
  { value: 'other', labelKey: 'Other' },
];

export default function SettingsPage() {
  const { darkMode, toggleDarkMode } = useDarkMode();
  const { effectiveLang } = useLanguage();
  const router = useRouter();
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deleteStep, setDeleteStep] = useState<'warning' | 'reason' | 'confirm'>('warning');
  const [deleteReason, setDeleteReason] = useState('');
  const [deleteOtherText, setDeleteOtherText] = useState('');
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    const check = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) router.replace('/login');
    };
    check();
  }, [router]);

  const openDeleteModal = () => {
    setDeleteModalOpen(true);
    setDeleteStep('warning');
    setDeleteReason('');
    setDeleteOtherText('');
    setDeleteConfirmText('');
  };

  const closeDeleteModal = () => {
    if (!deleting) {
      setDeleteModalOpen(false);
      setDeleteStep('warning');
      setDeleteReason('');
      setDeleteOtherText('');
      setDeleteConfirmText('');
    }
  };

  const handleDeleteAccount = async () => {
    if (deleteStep === 'warning') {
      setDeleteStep('reason');
      return;
    }
    if (deleteStep === 'reason') {
      if (!deleteReason) {
        toast.error(t(effectiveLang, 'Please select a reason.'));
        return;
      }
      setDeleteStep('confirm');
      return;
    }
    // confirm step
    const confirmKeyword = 'DELETE';
    if (deleteConfirmText.trim() !== confirmKeyword) {
      toast.error(t(effectiveLang, 'Please type DELETE to confirm.'));
      return;
    }

    setDeleting(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch('/api/account/delete', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
        },
        body: JSON.stringify({
          reason: deleteReason,
          otherText: deleteReason === 'other' ? deleteOtherText : undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        toast.error(data?.error || t(effectiveLang, 'Failed to delete account.'));
        setDeleting(false);
        return;
      }

      await supabase.auth.signOut();
      if (typeof window !== 'undefined') {
        localStorage.removeItem('userType');
      }
      toast.success(t(effectiveLang, 'Your account has been deleted.'));
      closeDeleteModal();
      router.replace('/');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t(effectiveLang, 'Something went wrong.'));
      setDeleting(false);
    }
  };

  return (
    <div className="max-w-xl mx-auto px-4 py-10">
      <h1 className="text-2xl font-bold text-blue-700 dark:text-blue-300 mb-6">{t(effectiveLang, 'Settings')}</h1>

      {/* Dark Mode Toggle */}
      <div className="mb-6 flex items-center justify-between">
        <span className="font-medium text-gray-700 dark:text-gray-200">🌙 {t(effectiveLang, 'Dark mode')}</span>
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

      {/* Push Notifications */}
      <div className="mb-6">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-gray-100 mb-3">Notifications</h2>
        <PushNotificationToggle />
      </div>

      {/* Delete My Account */}
      <div className="mt-10 pt-8 border-t border-slate-200 dark:border-gray-600">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-gray-100 mb-2">
          {t(effectiveLang, 'Delete My Account')}
        </h2>
        <p className="text-sm text-slate-600 dark:text-gray-400 mb-4">
          {t(effectiveLang, 'Permanently delete your account and all associated data. This cannot be undone.')}
        </p>
        <button
          type="button"
          onClick={openDeleteModal}
          className="inline-flex items-center gap-2 rounded-lg border border-red-300 dark:border-red-700 bg-red-50 dark:bg-red-900/20 px-4 py-2 text-sm font-medium text-red-700 dark:text-red-300 hover:bg-red-100 dark:hover:bg-red-900/40 transition"
        >
          <AlertTriangle className="h-4 w-4" />
          {t(effectiveLang, 'Delete My Account')}
        </button>
      </div>

      {/* Delete account modal */}
      {deleteModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={closeDeleteModal}>
          <div
            className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-gray-700">
              <h3 className="text-lg font-semibold text-slate-900 dark:text-gray-100">
                {t(effectiveLang, 'Delete My Account')}
              </h3>
              <button
                type="button"
                onClick={closeDeleteModal}
                disabled={deleting}
                className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-gray-700"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-4 space-y-4">
              {deleteStep === 'warning' && (
                <>
                  <div className="flex gap-3 p-3 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
                    <AlertTriangle className="h-6 w-6 shrink-0 text-amber-600 dark:text-amber-400" />
                    <div className="text-sm text-amber-800 dark:text-amber-200">
                      <p className="font-medium">{t(effectiveLang, 'This action cannot be undone.')}</p>
                      <p className="mt-1">
                        {t(effectiveLang, 'All your data, profile, and content will be permanently removed.')}
                      </p>
                    </div>
                  </div>
                  <p className="text-sm text-slate-600 dark:text-gray-400">
                    {t(effectiveLang, 'Are you sure you want to continue?')}
                  </p>
                </>
              )}

              {deleteStep === 'reason' && (
                <>
                  <p className="text-sm font-medium text-slate-700 dark:text-gray-300">
                    {t(effectiveLang, 'Why do you want to delete your account?')}
                  </p>
                  <div className="space-y-2">
                    {DELETE_REASONS.map((r) => (
                      <label
                        key={r.value}
                        className="flex items-center gap-3 p-3 rounded-xl border border-slate-200 dark:border-gray-600 hover:bg-slate-50 dark:hover:bg-gray-700/50 cursor-pointer"
                      >
                        <input
                          type="radio"
                          name="deleteReason"
                          value={r.value}
                          checked={deleteReason === r.value}
                          onChange={() => setDeleteReason(r.value)}
                          className="rounded-full border-slate-300"
                        />
                        <span className="text-sm text-slate-700 dark:text-gray-300">{t(effectiveLang, r.labelKey)}</span>
                      </label>
                    ))}
                  </div>
                  {deleteReason === 'other' && (
                    <textarea
                      placeholder={t(effectiveLang, 'Optional: tell us more...')}
                      value={deleteOtherText}
                      onChange={(e) => setDeleteOtherText(e.target.value)}
                      className="w-full mt-2 px-3 py-2 rounded-lg border border-slate-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-slate-900 dark:text-gray-100 text-sm placeholder:text-slate-400"
                      rows={3}
                      maxLength={500}
                    />
                  )}
                </>
              )}

              {deleteStep === 'confirm' && (
                <>
                  <p className="text-sm text-slate-600 dark:text-gray-400">
                    {t(effectiveLang, 'To confirm, type DELETE below and then click the button.')}
                  </p>
                  <input
                    type="text"
                    value={deleteConfirmText}
                    onChange={(e) => setDeleteConfirmText(e.target.value)}
                    placeholder="DELETE"
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-slate-900 dark:text-gray-100 placeholder:text-slate-400"
                  />
                </>
              )}
            </div>

            <div className="flex gap-3 p-4 border-t border-slate-200 dark:border-gray-700">
              {deleteStep === 'warning' && (
                <>
                  <button
                    type="button"
                    onClick={closeDeleteModal}
                    className="flex-1 py-2 rounded-xl border border-slate-300 dark:border-gray-600 text-slate-700 dark:text-gray-300 font-medium"
                  >
                    {t(effectiveLang, 'Cancel')}
                  </button>
                  <button
                    type="button"
                    onClick={handleDeleteAccount}
                    className="flex-1 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-medium"
                  >
                    {t(effectiveLang, 'Continue')}
                  </button>
                </>
              )}
              {deleteStep === 'reason' && (
                <>
                  <button
                    type="button"
                    onClick={() => setDeleteStep('warning')}
                    className="flex-1 py-2 rounded-xl border border-slate-300 dark:border-gray-600 text-slate-700 dark:text-gray-300 font-medium"
                  >
                    {t(effectiveLang, 'Back')}
                  </button>
                  <button
                    type="button"
                    onClick={handleDeleteAccount}
                    className="flex-1 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-medium"
                  >
                    {t(effectiveLang, 'Continue')}
                  </button>
                </>
              )}
              {deleteStep === 'confirm' && (
                <>
                  <button
                    type="button"
                    onClick={() => setDeleteStep('reason')}
                    disabled={deleting}
                    className="flex-1 py-2 rounded-xl border border-slate-300 dark:border-gray-600 text-slate-700 dark:text-gray-300 font-medium"
                  >
                    {t(effectiveLang, 'Back')}
                  </button>
                  <button
                    type="button"
                    onClick={handleDeleteAccount}
                    disabled={deleting || deleteConfirmText.trim() !== 'DELETE'}
                    className="flex-1 py-2 rounded-xl bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white font-medium"
                  >
                    {deleting ? t(effectiveLang, 'Deleting...') : t(effectiveLang, 'Delete my account')}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
