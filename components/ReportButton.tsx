'use client';

import { useState, useRef, useEffect, type CSSProperties } from 'react';
import { Flag } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';

type EntityType = 'post' | 'item' | 'business' | 'organization' | 'chat' | 'seller';

export type MarketplaceSellerTarget = {
  kind: 'user' | 'business';
  id: string;
  displayName: string;
};

interface ReportButtonProps {
  entityType: EntityType;
  entityId: string;
  entityTitle?: string;
  /** 'icon' = just flag icon (compact), 'pill' = icon + text pill, 'text' = text link */
  variant?: 'icon' | 'pill' | 'text';
  className?: string;
  /** Applied to the trigger control (e.g. brand gradient on business pages) */
  style?: CSSProperties;
  /** Called when the report flow opens (after auth check; not called on redirect to login). */
  onOpen?: () => void;
  /** On marketplace item pages: also allow reporting the seller (user or business). */
  marketplaceSeller?: MarketplaceSellerTarget;
}

const REASONS = [
  'Spam or misleading',
  'Inappropriate content',
  'Harassment or hate speech',
  'Political or politically motivated',
  'Fraud or scam',
  'Intellectual property violation',
  'False information',
  'Other',
];

export default function ReportButton({
  entityType,
  entityId,
  entityTitle = '',
  variant = 'icon',
  className = '',
  style,
  onOpen,
  marketplaceSeller,
}: ReportButtonProps) {
  const [open, setOpen] = useState(false);
  const [reportSubject, setReportSubject] = useState<'listing' | 'seller'>('listing');
  const [selectedReason, setSelectedReason] = useState('');
  const [details, setDetails] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    if (open && dialogRef.current) {
      dialogRef.current.showModal();
    }
  }, [open]);

  const handleClose = () => {
    dialogRef.current?.close();
    setOpen(false);
    // Reset after close animation
    setTimeout(() => {
      setReportSubject('listing');
      setSelectedReason('');
      setDetails('');
      setError('');
      setSuccess(false);
    }, 200);
  };

  const handleSubmit = async () => {
    if (!selectedReason) {
      setError('Please select a reason.');
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        setError('You must be logged in to report content.');
        setSubmitting(false);
        return;
      }

      let submitEntityType: string = entityType;
      let submitEntityId = entityId;
      let submitEntityTitle = entityTitle || '';
      if (marketplaceSeller && reportSubject === 'seller') {
        if (marketplaceSeller.kind === 'user') {
          submitEntityType = 'seller';
          submitEntityId = marketplaceSeller.id;
          submitEntityTitle = `Seller: ${marketplaceSeller.displayName}`.trim();
        } else {
          submitEntityType = 'business';
          submitEntityId = marketplaceSeller.id;
          submitEntityTitle = `Business: ${marketplaceSeller.displayName}`.trim();
        }
      }

      const res = await fetch('/api/reports', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          entity_type: submitEntityType,
          entity_id: submitEntityId,
          entity_title: submitEntityTitle,
          reason: selectedReason,
          details,
        }),
      });

      const data = await res.json();

      if (res.status === 409) {
        setError('You have already reported this content.');
      } else if (!res.ok) {
        setError(data.error || 'Failed to submit report.');
      } else {
        setSuccess(true);
      }
    } catch {
      setError('An unexpected error occurred.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleButtonClick = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      window.location.href = '/login';
      return;
    }
    // Open dialog first; onOpen (e.g. close parent menu) must not unmount this component before setOpen runs.
    setOpen(true);
    onOpen?.();
  };

  const defaultEntityLabel =
    entityType === 'post' ? 'post' :
    entityType === 'item' ? 'item' :
    entityType === 'business' ? 'business' :
    entityType === 'chat' ? 'conversation' :
    entityType === 'seller' ? 'seller' :
    'organization';

  const dialogTitleWord = (() => {
    if (marketplaceSeller && reportSubject === 'seller') {
      return marketplaceSeller.kind === 'business' ? 'Business' : 'Seller';
    }
    const map: Record<string, string> = {
      post: 'Post',
      item: 'Item',
      business: 'Business',
      organization: 'Organization',
      chat: 'Chat',
      seller: 'Seller',
    };
    return map[entityType] || 'Content';
  })();

  return (
    <>
      {variant === 'icon' && (
        <button
          type="button"
          onClick={handleButtonClick}
          title={`Report this ${defaultEntityLabel}`}
          style={style}
          className={`p-1.5 rounded-full text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 dark:text-gray-500 dark:hover:text-red-400 transition-colors ${className}`}
        >
          <Flag className="h-4 w-4" />
        </button>
      )}

      {variant === 'pill' && (
        <button
          type="button"
          onClick={handleButtonClick}
          style={style}
          className={`flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600 transition hover:bg-red-100 hover:text-red-600 dark:bg-gray-600 dark:text-gray-200 dark:hover:bg-red-900/40 dark:hover:text-red-300 ${className}`}
        >
          <Flag className="h-3.5 w-3.5" />
          Report
        </button>
      )}

      {variant === 'text' && (
        <button
          type="button"
          onClick={handleButtonClick}
          style={style}
          className={`inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-red-500 dark:text-gray-400 dark:hover:text-red-400 transition-colors hover:underline [&_svg]:shrink-0 ${className}`}
        >
          <Flag className="[height:1.2em] [width:1.2em]" aria-hidden />
          <span>Report this {defaultEntityLabel}</span>
        </button>
      )}

      {open && (
        <dialog
          ref={dialogRef}
          onClose={handleClose}
          className="fixed inset-0 z-[100] m-auto w-full max-w-md rounded-xl border border-slate-200 bg-white p-0 shadow-2xl backdrop:bg-black/50 dark:border-gray-700 dark:bg-gray-800"
        >
          <div className="p-6">
            {success ? (
              <div className="text-center py-6">
                <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/40">
                  <svg className="h-6 w-6 text-green-600 dark:text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <h3 className="text-lg font-semibold text-slate-900 dark:text-gray-100">Report Submitted</h3>
                <p className="mt-2 text-sm text-slate-600 dark:text-gray-300">
                  Thank you. Our team will review this report and take appropriate action.
                </p>
                <button
                  type="button"
                  onClick={handleClose}
                  className="mt-5 rounded-lg bg-slate-900 px-5 py-2.5 text-sm font-medium text-white hover:bg-slate-800 dark:bg-gray-600 dark:hover:bg-gray-500 transition"
                >
                  Close
                </button>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-slate-900 dark:text-gray-100">
                    Report {dialogTitleWord}
                  </h3>
                  <button
                    type="button"
                    onClick={handleClose}
                    className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-gray-700 dark:hover:text-gray-200 transition"
                  >
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                {marketplaceSeller && (
                  <div className="mb-4 rounded-lg border border-slate-200 bg-slate-50/80 p-3 dark:border-gray-600 dark:bg-gray-800/50">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-gray-400 mb-2">
                      What are you reporting?
                    </p>
                    <div className="space-y-2">
                      <label
                        className={`flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-2.5 text-sm transition ${
                          reportSubject === 'listing'
                            ? 'border-red-300 bg-red-50 text-red-900 dark:border-red-600 dark:bg-red-900/25 dark:text-red-100'
                            : 'border-slate-200 text-slate-700 hover:border-slate-300 dark:border-gray-600 dark:text-gray-200 dark:hover:border-gray-500'
                        }`}
                      >
                        <input
                          type="radio"
                          name="report-subject"
                          className="sr-only"
                          checked={reportSubject === 'listing'}
                          onChange={() => { setReportSubject('listing'); setSelectedReason(''); }}
                        />
                        <span
                          className={`flex h-4 w-4 items-center justify-center rounded-full border-2 ${
                            reportSubject === 'listing' ? 'border-red-500' : 'border-slate-300 dark:border-gray-500'
                          }`}
                        >
                          {reportSubject === 'listing' ? <span className="h-2 w-2 rounded-full bg-red-500" /> : null}
                        </span>
                        <span>
                          <span className="font-medium">This listing</span>
                          {entityTitle ? <span className="block text-xs text-slate-500 dark:text-gray-400 truncate">“{entityTitle}”</span> : null}
                        </span>
                      </label>
                      <label
                        className={`flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-2.5 text-sm transition ${
                          reportSubject === 'seller'
                            ? 'border-red-300 bg-red-50 text-red-900 dark:border-red-600 dark:bg-red-900/25 dark:text-red-100'
                            : 'border-slate-200 text-slate-700 hover:border-slate-300 dark:border-gray-600 dark:text-gray-200 dark:hover:border-gray-500'
                        }`}
                      >
                        <input
                          type="radio"
                          name="report-subject"
                          className="sr-only"
                          checked={reportSubject === 'seller'}
                          onChange={() => { setReportSubject('seller'); setSelectedReason(''); }}
                        />
                        <span
                          className={`flex h-4 w-4 items-center justify-center rounded-full border-2 ${
                            reportSubject === 'seller' ? 'border-red-500' : 'border-slate-300 dark:border-gray-500'
                          }`}
                        >
                          {reportSubject === 'seller' ? <span className="h-2 w-2 rounded-full bg-red-500" /> : null}
                        </span>
                        <span>
                          <span className="font-medium">
                            {marketplaceSeller.kind === 'business' ? 'This business / seller' : 'This seller'}
                          </span>
                          <span className="block text-xs text-slate-500 dark:text-gray-400">{marketplaceSeller.displayName}</span>
                        </span>
                      </label>
                    </div>
                  </div>
                )}

                {!marketplaceSeller && entityTitle && (
                  <p className="mb-4 text-sm text-slate-500 dark:text-gray-400 truncate">
                    Reporting: <span className="font-medium text-slate-700 dark:text-gray-200">{entityTitle}</span>
                  </p>
                )}

                <label className="block text-sm font-medium text-slate-700 dark:text-gray-200 mb-2">
                  {marketplaceSeller ? 'Reason' : 'Reason for reporting'}
                </label>
                <div className="space-y-2 mb-4">
                  {REASONS.map((reason) => (
                    <label
                      key={reason}
                      className={`flex items-center gap-3 rounded-lg border px-3 py-2.5 text-sm cursor-pointer transition ${
                        selectedReason === reason
                          ? 'border-red-300 bg-red-50 text-red-800 dark:border-red-600 dark:bg-red-900/30 dark:text-red-200'
                          : 'border-slate-200 text-slate-700 hover:border-slate-300 hover:bg-slate-50 dark:border-gray-600 dark:text-gray-300 dark:hover:border-gray-500 dark:hover:bg-gray-700/50'
                      }`}
                    >
                      <input
                        type="radio"
                        name="report-reason"
                        value={reason}
                        checked={selectedReason === reason}
                        onChange={() => setSelectedReason(reason)}
                        className="sr-only"
                      />
                      <span
                        className={`flex h-4 w-4 items-center justify-center rounded-full border-2 ${
                          selectedReason === reason
                            ? 'border-red-500 dark:border-red-400'
                            : 'border-slate-300 dark:border-gray-500'
                        }`}
                      >
                        {selectedReason === reason && (
                          <span className="h-2 w-2 rounded-full bg-red-500 dark:bg-red-400" />
                        )}
                      </span>
                      {reason}
                    </label>
                  ))}
                </div>

                <label className="block text-sm font-medium text-slate-700 dark:text-gray-200 mb-1.5">
                  Additional details <span className="text-slate-400 dark:text-gray-500 font-normal">(optional)</span>
                </label>
                <textarea
                  value={details}
                  onChange={(e) => setDetails(e.target.value)}
                  placeholder="Provide more context about this report..."
                  rows={3}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 placeholder-slate-400 focus:border-red-300 focus:outline-none focus:ring-2 focus:ring-red-200 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 dark:placeholder-gray-500 dark:focus:border-red-500 dark:focus:ring-red-800"
                />

                {error && (
                  <p className="mt-3 text-sm text-red-600 dark:text-red-400">{error}</p>
                )}

                <div className="mt-5 flex items-center justify-end gap-3">
                  <button
                    type="button"
                    onClick={handleClose}
                    className="rounded-lg px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 dark:text-gray-300 dark:hover:bg-gray-700 transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleSubmit}
                    disabled={submitting || !selectedReason}
                    className="rounded-lg bg-red-600 px-5 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition dark:bg-red-700 dark:hover:bg-red-600"
                  >
                    {submitting ? 'Submitting...' : 'Submit Report'}
                  </button>
                </div>
              </>
            )}
          </div>
        </dialog>
      )}
    </>
  );
}
