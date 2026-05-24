import ContactSubmissionsPanel from '@/components/admin/ContactSubmissionsPanel';

export default function AdminInboxContactPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
      <div className="mb-6">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Inbox</p>
        <h1 className="mt-1 text-2xl font-bold text-slate-900 dark:text-white">Contact us</h1>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
          Messages from the site contact form. Review and respond here — no need to rely on email alone.
        </p>
      </div>
      <ContactSubmissionsPanel
        source="contact"
        description="General contact form submissions from /contact. Mark reviewed after you reply, or close when resolved."
      />
    </div>
  );
}
