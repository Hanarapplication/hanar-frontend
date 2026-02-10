'use client';

export default function AdminContactPage() {
  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold text-slate-900">Contact us to review</h1>
      <p className="mt-1 text-slate-600">
        Review contact form submissions from the site.
      </p>
      <p className="mt-6 text-slate-500 text-sm">
        If you have a <code className="bg-slate-100 px-1 rounded">contact_submissions</code> table, the dashboard will show the count here. Set up the table and list submissions on this page as needed.
      </p>
    </div>
  );
}
