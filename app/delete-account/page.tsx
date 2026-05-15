import type { Metadata } from 'next';
import Link from 'next/link';
import LegalPageFrame from '@/components/legal/LegalPageFrame';

/** Public page — no login required (Google Play / transparency). */
export const metadata: Metadata = {
  title: 'Delete Your Hanar Account | Hanar',
  description:
    'How to delete your Hanar account from the app or by email, what data is removed, and what may be retained for security and compliance.',
};

export default function DeleteAccountPage() {
  return (
    <LegalPageFrame
      title="Delete Your Hanar Account"
      subtitle="Last updated for Google Play and account-deletion transparency requirements."
      showDisclaimer={false}
    >
      <section className="mb-2" aria-labelledby="how-in-app">
        <h2 id="how-in-app" className="text-xl sm:text-2xl font-semibold text-gray-900 dark:text-white pt-2">
          Delete your account in the Hanar app
        </h2>
        <p className="mb-4">
          You can delete your Hanar account at any time from inside the app while signed in:
        </p>
        <ol className="list-decimal list-inside space-y-2 mb-4 pl-1">
          <li>Log in to Hanar.</li>
          <li>Go to Settings.</li>
          <li>Select Delete Account.</li>
          <li>Confirm deletion when prompted.</li>
        </ol>
        <p>
          <Link
            href="/settings"
            className="font-medium text-rose-700 underline underline-offset-2 hover:text-rose-800 dark:text-rose-400 dark:hover:text-rose-300"
          >
            Open Settings
          </Link>{' '}
          (you will be asked to sign in if you are not already logged in.)
        </p>
      </section>

      <section aria-labelledby="how-email">
        <h2 id="how-email" className="text-xl sm:text-2xl font-semibold text-gray-900 dark:text-white pt-2">
          Request deletion by email
        </h2>
        <p className="mb-4">
          If you cannot use the in-app flow, you may request account deletion by emailing{' '}
          <a
            href="mailto:support@hanar.net?subject=Delete%20My%20Hanar%20Account"
            className="font-medium text-rose-700 underline underline-offset-2 hover:text-rose-800 dark:text-rose-400 dark:hover:text-rose-300 break-all"
          >
            support@hanar.net
          </a>
          .
        </p>
        <ul className="list-disc list-outside space-y-2 pl-5">
          <li>
            Use the subject line: <span className="font-semibold">Delete My Hanar Account</span>
          </li>
          <li>
            Include the <span className="font-semibold">email address linked to your Hanar account</span> so we can
            verify ownership and process your request.
          </li>
        </ul>
      </section>

      <section aria-labelledby="data-deleted">
        <h2 id="data-deleted" className="text-xl sm:text-2xl font-semibold text-gray-900 dark:text-white pt-2">
          What we delete
        </h2>
        <p className="mb-3">
          When your account is deleted, we aim to remove personal data associated with your account, including:
        </p>
        <ul className="list-disc list-outside space-y-2 pl-5">
          <li>Account profile</li>
          <li>Name</li>
          <li>Email</li>
          <li>Phone number</li>
          <li>Messages</li>
          <li>Marketplace listings</li>
          <li>Business listings owned by the account</li>
          <li>Uploaded photos</li>
          <li>Community posts and comments where technically and legally possible</li>
        </ul>
      </section>

      <section aria-labelledby="data-retained">
        <h2 id="data-retained" className="text-xl sm:text-2xl font-semibold text-gray-900 dark:text-white pt-2">
          What may be retained
        </h2>
        <p className="mb-3">Some information may be kept where required or permitted by law, including:</p>
        <ul className="list-disc list-outside space-y-2 pl-5">
          <li>Fraud, security, or moderation records</li>
          <li>Anonymized logs or backups for a limited retention period</li>
        </ul>
      </section>

      <section aria-labelledby="timing">
        <h2 id="timing" className="text-xl sm:text-2xl font-semibold text-gray-900 dark:text-white pt-2">
          Processing and retention timelines
        </h2>
        <ul className="list-disc list-outside space-y-2 pl-5">
          <li>
            Deletion requests are processed within <span className="font-semibold">30 days</span>.
          </li>
          <li>
            Backups, logs, or similar systems may retain related data for up to{' '}
            <span className="font-semibold">90 days</span> before being fully removed or anonymized.
          </li>
        </ul>
      </section>

      <section
        className="rounded-xl border border-gray-200 bg-gray-50/90 p-4 sm:p-5 dark:border-[#3e4042] dark:bg-[#242526]"
        aria-labelledby="related"
      >
        <h2 id="related" className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
          Related
        </h2>
        <ul className="space-y-2">
          <li>
            <Link
              href="/privacy"
              className="font-medium text-rose-700 underline underline-offset-2 dark:text-rose-400"
            >
              Privacy Policy
            </Link>
          </li>
          <li>
            <Link href="/terms" className="font-medium text-rose-700 underline underline-offset-2 dark:text-rose-400">
              Terms of Service
            </Link>
          </li>
          <li>
            <Link
              href="/settings"
              className="font-medium text-rose-700 underline underline-offset-2 dark:text-rose-400"
            >
              Settings (account &amp; delete account)
            </Link>
          </li>
        </ul>
      </section>
    </LegalPageFrame>
  );
}
