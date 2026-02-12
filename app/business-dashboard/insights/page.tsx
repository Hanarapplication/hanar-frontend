'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabaseClient';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import { BarChart3, Crown, ArrowLeft, Eye, Megaphone, Bell, Image, ShoppingBag } from 'lucide-react';
import toast from 'react-hot-toast';

type Plan = 'free' | 'starter' | 'growth' | 'premium';

function normalizePlan(value: string | null | undefined): Plan | null {
  const v = (value ?? '').trim().toLowerCase();
  if (v === 'free' || v === 'starter' || v === 'growth' || v === 'premium') return v as Plan;
  return null;
}

type InsightsData = {
  businessViews: number;
  retailItemViews: number;
  dealershipViews: number;
  totalItemViews: number;
  feedBanners: { id: string; view_count: number }[];
  totalAdBannerViews: number;
  notificationsSent: number;
  notificationsSentBlast: number;
  notificationsSentFollower: number;
  totalBlastRecipients: number;
  notificationsViewed: number;
  blastViewed: number;
  sentByDay: { date: string; sent: number; blast: number; follower: number }[];
  plan: string | null;
};

const CHART_COLORS = ['#6366f1', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#06b6d4'];

export default function BusinessInsightsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [business, setBusiness] = useState<{
    id: string;
    business_name: string;
    slug: string;
    plan: Plan | null;
  } | null>(null);
  const [insights, setInsights] = useState<InsightsData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      try {
        setLoading(true);
        setError(null);

        const { data: sessionRes, error: sessionErr } = await supabase.auth.getSession();
        if (sessionErr) throw sessionErr;

        const userId = sessionRes.session?.user?.id;
        if (!userId) {
          router.replace('/login');
          return;
        }

        const { data: bizData, error: bizError } = await supabase
          .from('businesses')
          .select('id, business_name, slug, plan')
          .eq('owner_id', userId)
          .maybeSingle();

        if (bizError) throw bizError;
        if (!bizData?.id || !bizData.slug) {
          router.replace('/business-dashboard');
          return;
        }

        if (mounted) {
          setBusiness({
            id: String(bizData.id),
            business_name: bizData.business_name ?? 'Your Business',
            slug: String(bizData.slug),
            plan: normalizePlan(bizData.plan),
          });
        }

        const session = sessionRes.session;
        const businessId = typeof bizData.id === 'string' ? bizData.id : String(bizData.id);
        const res = await fetch(
          `/api/business/insights?business_id=${encodeURIComponent(businessId)}`,
          {
            credentials: 'include',
            headers: session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {},
          }
        );
        const insightsJson = await res.json().catch(() => ({}));

        if (!res.ok) {
          throw new Error(insightsJson?.error || 'Failed to load insights');
        }

        if (mounted) setInsights(insightsJson as InsightsData);
      } catch (err: any) {
        if (mounted) {
          setError(err?.message || 'Failed to load insights');
          toast.error(err?.message || 'Failed to load insights');
        }
      } finally {
        if (mounted) setLoading(false);
      }
    };

    load();
  }, [router]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-gray-900 flex items-center justify-center">
        <p className="text-slate-600 dark:text-gray-400">Loading insights…</p>
      </div>
    );
  }

  if (error || !business || !insights) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-gray-900 flex items-center justify-center p-4">
        <div className="rounded-2xl border border-slate-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-8 text-center max-w-md">
          <p className="text-slate-600 dark:text-gray-400 mb-4">{error || 'Could not load insights.'}</p>
          <Link
            href="/business-dashboard"
            className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-white hover:bg-indigo-500"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to dashboard
          </Link>
        </div>
      </div>
    );
  }

  const isPremium = business.plan === 'premium';

  const overviewBars = [
    {
      name: 'Profile views',
      value: insights.businessViews,
      desc: 'From home feed, businesses page, profile',
      fill: CHART_COLORS[0],
    },
    { name: 'Retail item views', value: insights.retailItemViews, fill: CHART_COLORS[1] },
    { name: 'Car listing views', value: insights.dealershipViews, fill: CHART_COLORS[2] },
    { name: 'Ad banner views', value: insights.totalAdBannerViews, fill: CHART_COLORS[3] },
    { name: 'Notifications sent', value: insights.notificationsSent, fill: CHART_COLORS[4] },
    { name: 'Notifications viewed', value: insights.notificationsViewed, fill: CHART_COLORS[5] },
  ].filter((r) => isPremium || (r.name === 'Ad banner views' && r.value > 0));

  const viewBreakdownPie = [
    { name: 'Profile', value: insights.businessViews, color: CHART_COLORS[0] },
    { name: 'Retail items', value: insights.retailItemViews, color: CHART_COLORS[1] },
    { name: 'Car listings', value: insights.dealershipViews, color: CHART_COLORS[2] },
    { name: 'Ad banners', value: insights.totalAdBannerViews, color: CHART_COLORS[3] },
  ].filter((s) => s.value > 0);

  const hasNotificationData = insights.sentByDay.length > 0;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-gray-900">
      <div className="mx-auto max-w-6xl px-4 py-8">
        <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link
              href="/business-dashboard"
              className="rounded-lg p-2 text-slate-600 hover:bg-slate-200 dark:text-gray-400 dark:hover:bg-gray-700"
              aria-label="Back to dashboard"
            >
              <ArrowLeft className="h-5 w-5" />
            </Link>
            <div className="flex items-center gap-2">
              <BarChart3 className="h-8 w-8 text-indigo-600 dark:text-indigo-400" />
              <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Insights</h1>
            </div>
          </div>
          {!isPremium && (
            <Link
              href="/business/plan"
              className="inline-flex items-center gap-2 rounded-xl bg-amber-500 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-600"
            >
              <Crown className="h-4 w-4" />
              Upgrade to Premium for full analytics
            </Link>
          )}
        </div>

        {!isPremium && (
          <div className="mb-6 rounded-2xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 p-4 text-amber-900 dark:text-amber-200">
            <p className="text-sm font-medium">
              Premium analytics include: profile views (home feed, businesses page, profile), item views, ad banner performance, and notification stats with charts.
            </p>
          </div>
        )}

        {/* Summary cards */}
        <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {isPremium && (
            <>
              <div className="rounded-2xl border border-slate-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-5 shadow-sm">
                <div className="flex items-center gap-2 text-slate-500 dark:text-gray-400">
                  <Eye className="h-5 w-5" />
                  <span className="text-xs font-medium uppercase tracking-wider">Profile views</span>
                </div>
                <p className="mt-2 text-3xl font-bold text-slate-900 dark:text-white">
                  {insights.businessViews.toLocaleString()}
                </p>
                <p className="mt-0.5 text-xs text-slate-500 dark:text-gray-400">
                  Home feed, businesses page, profile
                </p>
              </div>
              <div className="rounded-2xl border border-slate-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-5 shadow-sm">
                <div className="flex items-center gap-2 text-slate-500 dark:text-gray-400">
                  <ShoppingBag className="h-5 w-5" />
                  <span className="text-xs font-medium uppercase tracking-wider">Item views</span>
                </div>
                <p className="mt-2 text-3xl font-bold text-slate-900 dark:text-white">
                  {insights.totalItemViews.toLocaleString()}
                </p>
                <p className="mt-0.5 text-xs text-slate-500 dark:text-gray-400">
                  Retail + car listings
                </p>
              </div>
            </>
          )}
          <div className="rounded-2xl border border-slate-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-5 shadow-sm">
            <div className="flex items-center gap-2 text-slate-500 dark:text-gray-400">
              <Image className="h-5 w-5" />
              <span className="text-xs font-medium uppercase tracking-wider">Ad banner views</span>
            </div>
            <p className="mt-2 text-3xl font-bold text-slate-900 dark:text-white">
              {insights.totalAdBannerViews.toLocaleString()}
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-5 shadow-sm">
            <div className="flex items-center gap-2 text-slate-500 dark:text-gray-400">
              <Megaphone className="h-5 w-5" />
              <span className="text-xs font-medium uppercase tracking-wider">Notifications</span>
            </div>
            <p className="mt-2 text-3xl font-bold text-slate-900 dark:text-white">
              Sent: {insights.notificationsSent.toLocaleString()}
            </p>
            <p className="mt-0.5 text-xs text-slate-500 dark:text-gray-400">
              Blasts: {insights.notificationsSentBlast} · Follower: {insights.notificationsSentFollower}
            </p>
            {insights.notificationsViewed > 0 && (
              <p className="mt-0.5 text-xs text-slate-500 dark:text-gray-400">
                Viewed: {insights.notificationsViewed.toLocaleString()}
              </p>
            )}
          </div>
        </div>

        {/* Chart: Overview bars (premium or ad-only) */}
        {overviewBars.length > 0 && (
          <section className="mb-8 rounded-2xl border border-slate-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-6 shadow-sm">
            <h2 className="mb-4 text-lg font-semibold text-slate-900 dark:text-white">Overview</h2>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={overviewBars} margin={{ top: 12, right: 12, left: 0, bottom: 60 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-slate-200 dark:stroke-gray-600" />
                  <XAxis
                    dataKey="name"
                    tick={{ fontSize: 12, fill: 'currentColor' }}
                    className="text-slate-600 dark:text-gray-400"
                    angle={-25}
                    textAnchor="end"
                    height={60}
                  />
                  <YAxis
                    tick={{ fontSize: 12, fill: 'currentColor' }}
                    className="text-slate-600 dark:text-gray-400"
                    tickFormatter={(v) => (v >= 1000 ? `${(v / 1000).toFixed(1)}k` : String(v))}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'var(--tooltip-bg, #fff)',
                      border: '1px solid #e2e8f0',
                      borderRadius: '8px',
                    }}
                    formatter={(value: number) => [value.toLocaleString(), 'Count']}
                    labelFormatter={(label) => label}
                  />
                  <Bar dataKey="value" name="Count" radius={[4, 4, 0, 0]}>
                    {overviewBars.map((entry, index) => (
                      <Cell key={index} fill={entry.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </section>
        )}

        {/* Chart: View breakdown pie (premium only, when we have views) */}
        {isPremium && viewBreakdownPie.length > 0 && (
          <section className="mb-8 rounded-2xl border border-slate-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-6 shadow-sm">
            <h2 className="mb-4 text-lg font-semibold text-slate-900 dark:text-white">View breakdown</h2>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={viewBreakdownPie}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={100}
                    label={({ name, value }) => `${name}: ${value.toLocaleString()}`}
                  >
                    {viewBreakdownPie.map((entry, index) => (
                      <Cell key={index} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value: number) => value.toLocaleString()} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </section>
        )}

        {/* Chart: Notifications sent over time */}
        {hasNotificationData && (
          <section className="mb-8 rounded-2xl border border-slate-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-6 shadow-sm">
            <h2 className="mb-4 text-lg font-semibold text-slate-900 dark:text-white">Notifications sent over time</h2>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={insights.sentByDay} margin={{ top: 12, right: 12, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-slate-200 dark:stroke-gray-600" />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 11, fill: 'currentColor' }}
                    className="text-slate-600 dark:text-gray-400"
                  />
                  <YAxis
                    tick={{ fontSize: 12, fill: 'currentColor' }}
                    className="text-slate-600 dark:text-gray-400"
                    allowDecimals={false}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'var(--tooltip-bg, #fff)',
                      border: '1px solid #e2e8f0',
                      borderRadius: '8px',
                    }}
                    formatter={(value: number) => [value, '']}
                    labelFormatter={(label) => `Date: ${label}`}
                  />
                  <Legend />
                  <Area
                    type="monotone"
                    dataKey="blast"
                    name="Blast notifications"
                    stackId="1"
                    stroke="#8b5cf6"
                    fill="#8b5cf6"
                    fillOpacity={0.6}
                  />
                  <Area
                    type="monotone"
                    dataKey="follower"
                    name="Follower notifications"
                    stackId="1"
                    stroke="#10b981"
                    fill="#10b981"
                    fillOpacity={0.6}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </section>
        )}

        {/* Ad banners per-banner (if any) */}
        {insights.feedBanners.length > 0 && (
          <section className="rounded-2xl border border-slate-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-6 shadow-sm">
            <h2 className="mb-4 text-lg font-semibold text-slate-900 dark:text-white">Ad banner performance</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-gray-600 text-left text-slate-500 dark:text-gray-400">
                    <th className="pb-2 pr-4 font-medium">Banner</th>
                    <th className="pb-2 font-medium">Views</th>
                  </tr>
                </thead>
                <tbody>
                  {insights.feedBanners.map((b, i) => (
                    <tr key={b.id} className="border-b border-slate-100 dark:border-gray-700">
                      <td className="py-2 pr-4 text-slate-700 dark:text-gray-300">Banner {i + 1}</td>
                      <td className="py-2 font-medium text-slate-900 dark:text-white">
                        {b.view_count.toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        <div className="mt-8">
          <Link
            href="/business-dashboard"
            className="inline-flex items-center gap-2 rounded-xl border border-slate-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-4 py-2 text-slate-700 dark:text-gray-200 hover:bg-slate-50 dark:hover:bg-gray-700"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
