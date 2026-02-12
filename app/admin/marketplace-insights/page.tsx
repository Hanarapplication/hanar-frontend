'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { BarChart3, ArrowLeft } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';

const RADIUS_OPTIONS: { value: string; label: string }[] = [
  { value: 'unlimited', label: 'Unlimited (all searches)' },
  { value: '5', label: '5 miles' },
  { value: '10', label: '10 miles' },
  { value: '25', label: '25 miles' },
  { value: '50', label: '50 miles' },
  { value: '100', label: '100 miles' },
];

type TopSearch = { term: string; count: number };

export default function AdminMarketplaceInsightsPage() {
  const [radius, setRadius] = useState('unlimited');
  const [topSearches, setTopSearches] = useState<TopSearch[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchInsights = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      const res = await fetch(
        `/api/admin/marketplace-insights?radius=${encodeURIComponent(radius)}`,
        { headers: token ? { Authorization: `Bearer ${token}` } : {} }
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Failed to load');
      setTopSearches(data.topSearches || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load insights');
      setTopSearches([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInsights();
  }, [radius]);

  return (
    <div className="max-w-2xl">
      <Link
        href="/admin/dashboard"
        className="mb-6 inline-flex items-center gap-2 text-slate-600 hover:text-slate-900"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Dashboard
      </Link>

      <div className="flex items-center gap-3 mb-6">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-100 text-indigo-600">
          <BarChart3 className="h-6 w-6" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-slate-900">Marketplace Insights</h1>
          <p className="text-sm text-slate-500">Top 10 searches by count, filter by radius</p>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm p-6">
        <label className="block text-sm font-medium text-slate-700 mb-2">Mile radius</label>
        <select
          value={radius}
          onChange={(e) => setRadius(e.target.value)}
          className="w-full max-w-xs rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
        >
          {RADIUS_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>

        {loading ? (
          <div className="mt-6 flex justify-center py-8">
            <div className="h-8 w-8 border-2 border-slate-300 border-t-indigo-600 rounded-full animate-spin" />
          </div>
        ) : error ? (
          <p className="mt-6 text-sm text-red-600">{error}</p>
        ) : topSearches.length === 0 ? (
          <p className="mt-6 text-sm text-slate-500">No search data for this radius yet.</p>
        ) : (
          <div className="mt-6 overflow-hidden rounded-xl border border-slate-200">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-slate-600">#</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-slate-600">Search term</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase text-slate-600">Count</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 bg-white">
                {topSearches.map((row, i) => (
                  <tr key={row.term}>
                    <td className="px-4 py-3 text-sm text-slate-500">{i + 1}</td>
                    <td className="px-4 py-3 text-sm font-medium text-slate-900">{row.term || '—'}</td>
                    <td className="px-4 py-3 text-sm text-slate-700 text-right">{row.count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
