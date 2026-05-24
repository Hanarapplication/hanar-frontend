'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { supabase } from '@/lib/supabaseClient';
import { X, Upload, ShieldCheck, Loader2, Mail, MessageSquare } from 'lucide-react';
import { isValidBusinessEmail, normalizeBusinessEmail } from '@/lib/businessClaimEmail';

type ClaimStatus = 'pending' | 'approved' | 'rejected';

type Props = {
  open: boolean;
  onClose: () => void;
  businessId: string;
  businessName: string;
  businessSlug: string;
  listingEmail?: string | null;
  onSubmitted?: () => void;
};

type Step = 'intro' | 'code' | 'form' | 'done';

export default function BusinessClaimModal({
  open,
  onClose,
  businessId,
  businessName,
  businessSlug,
  listingEmail,
  onSubmitted,
}: Props) {
  const router = useRouter();
  const normalizedListingEmail = useMemo(
    () => normalizeBusinessEmail(listingEmail),
    [listingEmail]
  );
  const hasListingEmail = isValidBusinessEmail(normalizedListingEmail);

  const [step, setStep] = useState<Step>('intro');
  const [authChecked, setAuthChecked] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [claimName, setClaimName] = useState('');
  const [claimPhone, setClaimPhone] = useState('');
  const [claimEmail, setClaimEmail] = useState('');
  const [proofText, setProofText] = useState('');
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [emailVerified, setEmailVerified] = useState(false);
  const [codeSent, setCodeSent] = useState(false);

  const resetForm = useCallback(() => {
    setStep('intro');
    setCode('');
    setClaimName('');
    setClaimPhone('');
    setClaimEmail('');
    setProofText('');
    setProofFile(null);
    setEmailVerified(false);
    setCodeSent(false);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!open) {
      resetForm();
      return;
    }

    let cancelled = false;
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (cancelled) return;
      setAuthChecked(true);
      if (!user) {
        setUserId(null);
        return;
      }
      setUserId(user.id);
      const metaName =
        (user.user_metadata?.full_name as string | undefined) ||
        (user.user_metadata?.name as string | undefined) ||
        '';
      if (metaName) setClaimName(metaName);
      if (user.email) setClaimEmail(user.email);
    })();

    return () => {
      cancelled = true;
    };
  }, [open, resetForm]);

  if (!open) return null;

  const requireLogin = () => {
    const redirect = encodeURIComponent(typeof window !== 'undefined' ? window.location.pathname : '/');
    router.push(`/login?redirect=${redirect}`);
  };

  const contactClaimUrl = `/contact?subject=${encodeURIComponent('Claim a business')}&mode=claim&businessId=${encodeURIComponent(businessId)}&businessName=${encodeURIComponent(businessName)}&businessSlug=${encodeURIComponent(businessSlug)}`;

  const contactClaimAlternative = (
    <>
      <div className="relative flex items-center py-1">
        <div className="flex-grow border-t border-slate-200 dark:border-slate-700" />
        <span className="mx-3 shrink-0 text-xs font-semibold uppercase tracking-wide text-slate-400">or</span>
        <div className="flex-grow border-t border-slate-200 dark:border-slate-700" />
      </div>
      <div className="rounded-lg border border-slate-200 bg-white px-4 py-3 dark:border-slate-700 dark:bg-slate-900/40">
        <p className="text-sm font-medium text-slate-800 dark:text-slate-100">Claim via Contact us</p>
        <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">
          Don&apos;t have access to the listing email? Submit a request and our team will contact you to verify
          ownership manually.
        </p>
        <Link
          href={contactClaimUrl}
          onClick={onClose}
          className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg border border-slate-300 bg-slate-50 px-4 py-2.5 text-sm font-semibold text-slate-800 transition hover:bg-slate-100 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700"
        >
          <MessageSquare size={16} />
          Contact us to claim
        </Link>
      </div>
    </>
  );

  const fieldClass =
    'w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 dark:border-slate-600 dark:bg-gray-800 dark:text-white dark:placeholder:text-slate-500';

  async function getAuthHeaders(): Promise<Record<string, string>> {
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;
    return token ? { Authorization: `Bearer ${token}` } : {};
  }

  async function handleSendEmailCode() {
    if (!userId) {
      requireLogin();
      return;
    }
    setLoading(true);
    try {
      const headers = await getAuthHeaders();
      const res = await fetch('/api/business/claim/send-email-code', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', ...headers },
        body: JSON.stringify({ businessId }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (data.useContact) {
          toast.error('No email on file — use Contact us instead.');
          onClose();
          router.push(contactClaimUrl);
          return;
        }
        toast.error(data.error || 'Failed to send code');
        return;
      }
      setCodeSent(true);
      setStep('code');
      toast.success(data.message || 'Verification code sent');
      if (data.devCode) {
        toast(`Dev code: ${data.devCode}`, { icon: '🔑' });
      }
    } catch {
      toast.error('Failed to send verification email');
    } finally {
      setLoading(false);
    }
  }

  async function handleVerifyCode() {
    if (!userId) {
      requireLogin();
      return;
    }
    setLoading(true);
    try {
      const headers = await getAuthHeaders();
      const res = await fetch('/api/business/claim/verify-email-code', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', ...headers },
        body: JSON.stringify({ businessId, code }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || 'Invalid code');
        return;
      }
      setEmailVerified(true);
      setStep('form');
      toast.success('Email verified');
    } catch {
      toast.error('Verification failed');
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!userId) {
      requireLogin();
      return;
    }
    if (!emailVerified) {
      toast.error('Verify the listing email first');
      setStep('intro');
      return;
    }

    if (!claimName.trim() || !claimEmail.trim() || !claimPhone.trim() || !proofText.trim()) {
      toast.error('Please fill in all required fields.');
      return;
    }
    if (claimPhone.trim().replace(/\D/g, '').length < 10) {
      toast.error('Enter a valid phone number (at least 10 digits).');
      return;
    }
    if (proofText.trim().length < 20) {
      toast.error('Please enter at least 20 characters describing your relationship to this business.');
      return;
    }

    setLoading(true);
    try {
      const headers = await getAuthHeaders();
      const formData = new FormData();
      formData.set('businessId', businessId);
      formData.set('claimName', claimName.trim());
      formData.set('claimPhone', claimPhone.trim());
      formData.set('claimEmail', claimEmail.trim());
      formData.set('proofText', proofText.trim());
      if (proofFile) formData.set('proofFile', proofFile);

      const res = await fetch('/api/business/claim', {
        method: 'POST',
        credentials: 'include',
        headers,
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || 'Failed to submit claim');
        return;
      }
      setStep('done');
      toast.success(data.message || 'Claim submitted');
      onSubmitted?.();
    } catch {
      toast.error('Failed to submit claim');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-start justify-center bg-black/60 p-4 pt-[max(1rem,env(safe-area-inset-top))] backdrop-blur-sm sm:p-6"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Claim business"
    >
      <div
        className="relative w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl dark:border-slate-700 dark:bg-gray-900 sm:p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute right-3 top-3 rounded-full p-1.5 text-slate-500 hover:bg-slate-100 dark:hover:bg-gray-800"
          aria-label="Close"
        >
          <X size={18} />
        </button>

        <div className="mb-4 pr-8">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Claim this business</h2>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
            Request ownership of <span className="font-medium" data-no-translate>{businessName}</span>.
            {hasListingEmail
              ? ' Verify via the listing email below, or contact us and we will follow up manually.'
              : ' This listing has no email on file — contact us and we will follow up manually.'}
          </p>
        </div>

        {!authChecked ? (
          <div className="flex items-center justify-center py-10 text-slate-500">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : !userId ? (
          <div className="space-y-4">
            <p className="text-sm text-slate-600 dark:text-slate-300">Sign in to claim a business.</p>
            <button
              type="button"
              onClick={requireLogin}
              className="w-full rounded-lg bg-gradient-to-r from-[#0c1f3c] to-[#6b1515] px-4 py-2.5 text-sm font-semibold text-white hover:brightness-110"
            >
              Sign in
            </button>
          </div>
        ) : !hasListingEmail ? (
          <div className="space-y-4">
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              <p className="font-medium">No business email on file</p>
              <p className="mt-1 text-amber-800/90">
                Use our contact form with subject &quot;Claim a business&quot;. Include your phone, email, and why you
                own or manage this business. Our team will review and assign ownership after contacting you.
              </p>
            </div>
            <Link
              href={contactClaimUrl}
              onClick={onClose}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-[#0c1f3c] to-[#6b1515] px-4 py-2.5 text-sm font-semibold text-white hover:brightness-110"
            >
              <MessageSquare size={16} />
              Contact us to claim
            </Link>
          </div>
        ) : step === 'done' ? (
          <div className="space-y-4 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
              <ShieldCheck size={24} />
            </div>
            <p className="text-sm text-slate-700 dark:text-slate-200">
              Your claim was submitted and is pending admin review.
            </p>
            <button
              type="button"
              onClick={onClose}
              className="w-full rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-200"
            >
              Close
            </button>
          </div>
        ) : step === 'intro' || step === 'code' ? (
          <div className="space-y-4">
            <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-700 dark:bg-slate-800/60">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Listing email on file</p>
              <p className="mt-1 flex items-center gap-2 text-sm font-medium text-slate-900 dark:text-white">
                <Mail size={16} className="shrink-0 text-slate-500" />
                {normalizedListingEmail}
              </p>
              <p className="mt-2 text-xs text-slate-600 dark:text-slate-300">
                We will send a 6-digit code to this inbox. You must have access to this email to continue.
              </p>
            </div>

            {step === 'code' ? (
              <div>
                <label htmlFor="claim-email-code" className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-200">
                  Verification code
                </label>
                <input
                  id="claim-email-code"
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  required
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="6-digit code"
                  className={`${fieldClass} tracking-widest`}
                />
              </div>
            ) : null}

            <div className="flex gap-2">
              {step === 'code' ? (
                <>
                  <button
                    type="button"
                    onClick={() => setStep('intro')}
                    className="flex-1 rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-200"
                  >
                    Back
                  </button>
                  <button
                    type="button"
                    disabled={loading || code.length !== 6}
                    onClick={handleVerifyCode}
                    className="flex-1 rounded-lg bg-gradient-to-r from-[#0c1f3c] to-[#6b1515] px-4 py-2.5 text-sm font-semibold text-white hover:brightness-110 disabled:opacity-60"
                  >
                    {loading ? 'Verifying…' : 'Verify code'}
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  disabled={loading}
                  onClick={handleSendEmailCode}
                  className="w-full rounded-lg bg-gradient-to-r from-[#0c1f3c] to-[#6b1515] px-4 py-2.5 text-sm font-semibold text-white hover:brightness-110 disabled:opacity-60"
                >
                  {loading ? 'Sending…' : codeSent ? 'Resend code' : 'Send verification code'}
                </button>
              )}
            </div>

            {contactClaimAlternative}
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
              Listing email verified: {normalizedListingEmail}
            </div>

            <div>
              <label htmlFor="claim-name" className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-200">
                Full name
              </label>
              <input
                id="claim-name"
                required
                value={claimName}
                onChange={(e) => setClaimName(e.target.value)}
                placeholder="Your full name"
                className={fieldClass}
              />
            </div>

            <div>
              <label htmlFor="claim-user-email" className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-200">
                Your email
              </label>
              <input
                id="claim-user-email"
                type="email"
                required
                value={claimEmail}
                onChange={(e) => setClaimEmail(e.target.value)}
                placeholder="you@example.com"
                className={fieldClass}
              />
            </div>

            <div>
              <label htmlFor="claim-phone" className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-200">
                Phone
              </label>
              <input
                id="claim-phone"
                type="tel"
                required
                minLength={10}
                value={claimPhone}
                onChange={(e) => setClaimPhone(e.target.value)}
                placeholder="+1 555 123 4567"
                className={fieldClass}
              />
            </div>

            <div>
              <label htmlFor="claim-proof" className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-200">
                Why do you own or manage this business?
              </label>
              <textarea
                id="claim-proof"
                required
                minLength={20}
                rows={4}
                value={proofText}
                onChange={(e) => setProofText(e.target.value)}
                placeholder="Please describe your relationship to this business and how we can reach you."
                className={fieldClass}
              />
            </div>

            <div>
              <label htmlFor="claim-file" className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-200">
                Proof document <span className="font-normal text-slate-400">(optional)</span>
              </label>
              <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-dashed border-slate-300 px-3 py-3 text-sm text-slate-600 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-gray-800">
                <Upload size={16} />
                {proofFile ? proofFile.name : 'Upload image or PDF (max 10 MB)'}
                <input
                  id="claim-file"
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif,application/pdf"
                  className="sr-only"
                  onChange={(e) => setProofFile(e.target.files?.[0] ?? null)}
                />
              </label>
            </div>

            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={() => setStep('code')}
                className="flex-1 rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-200"
              >
                Back
              </button>
              <button
                type="submit"
                disabled={loading}
                className="flex-1 rounded-lg bg-gradient-to-r from-[#0c1f3c] to-[#6b1515] px-4 py-2.5 text-sm font-semibold text-white hover:brightness-110 disabled:opacity-60"
              >
                {loading ? 'Submitting…' : 'Submit claim'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

export type UserClaimInfo = {
  id: string;
  status: ClaimStatus;
  created_at: string;
} | null;
