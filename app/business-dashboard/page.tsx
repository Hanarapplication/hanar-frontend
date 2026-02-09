'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { supabase } from '@/lib/supabaseClient';
import { Edit, Eye, Crown, BarChart3 } from 'lucide-react';

type BusinessStatus = 'pending' | 'approved' | 'rejected' | 'hold' | 'archived';
type ModerationStatus = 'on_hold' | 'active' | 'rejected';
type LifecycleStatus = 'unclaimed' | 'trial' | 'active' | 'expired' | 'archived';
type Plan = 'free' | 'starter' | 'growth' | 'premium';

function normalizePlan(value: string | null | undefined): Plan | null {
  const v = (value ?? '').trim().toLowerCase();
  if (v === 'free' || v === 'starter' || v === 'growth' || v === 'premium') return v as Plan;
  return null;
}

type FavoriteBusiness = {
  id: string;
  business_name: string | null;
  slug: string | null;
  category: string | null;
  logo_url?: string | null;
  address?: {
    city?: string;
    state?: string;
  } | null;
};

type FavoriteItem = {
  key: string;
  id: string;
  source: 'retail' | 'dealership';
  slug: string;
  title: string;
  price: string | number;
  image: string;
  location?: string;
};

const FAVORITE_ITEMS_KEY = 'favoriteMarketplaceItems';

type FollowedOrganization = {
  user_id: string;
  full_name: string | null;
  username: string | null;
  logo_url?: string | null;
  address?: string | null;
};

type PlanSettings = {
  plan: string;
  follower_notifications_enabled: boolean;
  max_follower_notifications_per_week: number;
  max_follower_notifications_per_day: number;
  min_minutes_between_notifications: number;
  max_area_blasts_per_month: number;
  area_blast_requires_admin_approval: boolean;
  max_blast_radius_miles: number;
};

type NotificationHistoryItem = {
  id: string;
  kind: 'follower_update' | 'area_blast';
  title: string;
  body: string;
  created_at: string;
  status: 'pending' | 'approved' | 'sent' | 'rejected';
  data?: {
    radius_miles?: number;
    sent_count?: number;
  };
};

function getUiStatus(biz: {
  moderation_status: ModerationStatus;
  lifecycle_status: LifecycleStatus;
  is_archived: boolean;
}): BusinessStatus {
  if (biz.is_archived === true || biz.lifecycle_status === 'archived') return 'archived';
  if (biz.moderation_status === 'rejected') return 'rejected';
  if (biz.moderation_status === 'active') return 'approved';
  if (biz.moderation_status === 'on_hold') return 'hold';
  return 'pending';
}

function normalizeCategory(value?: string | null) {
  const normalized = (value || '').trim().toLowerCase();
  if (!normalized) return '';
  if (normalized === 'something_else' || normalized === 'other') return '';
  if (normalized === 'retails') return 'Retail';
  return value || '';
}

function getDaysRemaining(isoDate: string): number {
  const end = new Date(isoDate).getTime();
  const now = Date.now();
  return Math.max(0, Math.ceil((end - now) / (24 * 60 * 60 * 1000)));
}

function formatExpiryDate(isoDate: string): string {
  return new Date(isoDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function BusinessDashboardPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);

  const [business, setBusiness] = useState<{
    id: string;
    business_name: string;
    slug: string;
    moderation_status: ModerationStatus;
    lifecycle_status: LifecycleStatus;
    is_archived: boolean;
    plan: Plan | null;
    plan_selected_at: string | null;
    trial_end: string | null;
    plan_expires_at: string | null;
    logo_url?: string | null;
    lat?: number | null;
    lon?: number | null;
  } | null>(null);
  const [favorites, setFavorites] = useState<FavoriteBusiness[]>([]);
  const [favoritesLoading, setFavoritesLoading] = useState(true);
  const [favoriteItems, setFavoriteItems] = useState<FavoriteItem[]>([]);
  const [favoriteItemsOpen, setFavoriteItemsOpen] = useState(false);
  const [followedOrgs, setFollowedOrgs] = useState<FollowedOrganization[]>([]);
  const [followedOrgsLoading, setFollowedOrgsLoading] = useState(true);
  const [favoritesOpen, setFavoritesOpen] = useState(false);
  const [followedOrgsOpen, setFollowedOrgsOpen] = useState(false);
  const [notificationTitle, setNotificationTitle] = useState('');
  const [notificationBody, setNotificationBody] = useState('');
  const [sendingNotification, setSendingNotification] = useState(false);
  const [planSettings, setPlanSettings] = useState<PlanSettings | null>(null);
  const [notificationMode, setNotificationMode] = useState<'followers' | 'area_blast'>('followers');
  const [areaBlastRadiusMiles, setAreaBlastRadiusMiles] = useState(3);
  const [notificationHistory, setNotificationHistory] = useState<NotificationHistoryItem[]>([]);
  const [notificationHistoryLoading, setNotificationHistoryLoading] = useState(true);

  const planConfirmed = useMemo(
    () => Boolean(business?.plan_selected_at),
    [business?.plan_selected_at]
  );
  const canSendNotifications = Boolean(
    planConfirmed && planSettings?.follower_notifications_enabled
  );
  const isAreaBlastAvailable = Boolean(
    planConfirmed && planSettings?.max_area_blasts_per_month && planSettings.max_area_blasts_per_month > 0
  );
  const areaBlastRequiresApproval = Boolean(planSettings?.area_blast_requires_admin_approval);
  const canRequestAreaBlast = Boolean(
    isAreaBlastAvailable && (planSettings?.max_blast_radius_miles || 0) >= areaBlastRadiusMiles
  );
  const canSendAreaBlast = Boolean(
    isAreaBlastAvailable &&
      (planSettings?.max_blast_radius_miles || 0) >= areaBlastRadiusMiles &&
      !areaBlastRequiresApproval
  );

  const groupedFavorites = useMemo(() => {
    const groups: Record<string, FavoriteBusiness[]> = {};
    favorites.forEach((biz) => {
      const key = normalizeCategory(biz.category);
      if (!groups[key]) groups[key] = [];
      groups[key].push(biz);
    });
    return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b));
  }, [favorites]);

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      try {
        setLoading(true);

        const { data: sessionRes, error: sessionErr } = await supabase.auth.getSession();
        if (sessionErr) throw sessionErr;

        const userId = sessionRes.session?.user?.id;
        if (!userId) {
          router.replace('/login');
          return;
        }

        const { data, error } = await supabase
          .from('businesses')
          .select('id, business_name, slug, moderation_status, lifecycle_status, is_archived, plan, plan_selected_at, trial_end, plan_expires_at, logo_url, lat, lon')
          .eq('owner_id', userId)
          .maybeSingle();

        if (error) throw error;

        if (!data?.id || !data.slug) {
          setBusiness(null);
          setLoading(false);
          return;
        }

        if (mounted) {
          setBusiness({
            id: String(data.id),
            business_name: data.business_name ?? 'Your Business',
            slug: String(data.slug),
            moderation_status: data.moderation_status as ModerationStatus,
            lifecycle_status: data.lifecycle_status as LifecycleStatus,
            is_archived: Boolean(data.is_archived),
            plan: normalizePlan(data.plan),
            plan_selected_at: data.plan_selected_at ? String(data.plan_selected_at) : null,
            trial_end: data.trial_end ? String(data.trial_end) : null,
            plan_expires_at: data.plan_expires_at ? String(data.plan_expires_at) : null,
            logo_url: data.logo_url ?? null,
            lat: typeof data.lat === 'number' ? data.lat : null,
            lon: typeof data.lon === 'number' ? data.lon : null,
          });
        }

        const normalizedPlan = normalizePlan(data.plan);
        if (normalizedPlan) {
          const { data: planData, error: planError } = await supabase
            .from('business_plans')
            .select('plan, follower_notifications_enabled, max_follower_notifications_per_week, max_follower_notifications_per_day, min_minutes_between_notifications, max_area_blasts_per_month, area_blast_requires_admin_approval, max_blast_radius_miles')
            .eq('plan', normalizedPlan)
            .maybeSingle();

          if (planError) throw planError;
          if (mounted) setPlanSettings(planData as PlanSettings);
        }

        // ✅ Require plan confirmation once
        const hasPlan = Boolean(data.plan_selected_at);
        if (!hasPlan) {
          if (data.plan) {
            // Backfill plan_selected_at for existing businesses that already chose a plan
            const nowIso = new Date().toISOString();
            await supabase
              .from('businesses')
              .update({ plan_selected_at: nowIso })
              .eq('id', data.id);
          } else {
            toast('Please choose a plan to continue.');
            router.replace('/business/plan');
            return;
          }
        }
      } catch (err: any) {
        toast.error(err?.message || 'Failed to load dashboard');
        router.replace('/login');
      } finally {
        if (mounted) setLoading(false);
      }
    };

    load();
    return () => {
      mounted = false;
    };
  }, [router]);

  useEffect(() => {
    if (!planSettings) return;
    const maxRadius = Math.max(0, planSettings.max_blast_radius_miles || 0);
    if (maxRadius > 0 && areaBlastRadiusMiles > maxRadius) {
      setAreaBlastRadiusMiles(maxRadius);
    }
  }, [planSettings, areaBlastRadiusMiles]);

  useEffect(() => {
    const loadFavorites = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          setFavorites([]);
          setFollowedOrgs([]);
          return;
        }

        const { data: favoriteRows, error: favoritesError } = await supabase
          .from('business_favorites')
          .select('business_id')
          .eq('user_id', user.id);

        if (favoritesError) throw favoritesError;
        const businessIds = (favoriteRows || []).map((row: { business_id: string }) => row.business_id);

        if (businessIds.length === 0) {
          setFavorites([]);
          return;
        }

        const { data, error } = await supabase
          .from('businesses')
          .select('id, business_name, slug, category, logo_url, address')
          .in('id', businessIds);

        if (error) throw error;
        setFavorites((data as FavoriteBusiness[]) || []);

        const { data: followRows, error: followError } = await supabase
          .from('follows')
          .select('following_id')
          .eq('follower_id', user.id);

        if (followError) throw followError;

        const orgOwnerIds = (followRows || []).map((row: { following_id: string }) => row.following_id);

        if (orgOwnerIds.length === 0) {
          setFollowedOrgs([]);
          return;
        }

        const { data: orgData, error: orgError } = await supabase
          .from('organizations')
          .select('user_id, full_name, username, logo_url, address')
          .in('user_id', orgOwnerIds);

        if (orgError) throw orgError;

        setFollowedOrgs((orgData as FollowedOrganization[]) || []);
      } catch (err: any) {
        toast.error(err?.message || 'Failed to load favorites');
      } finally {
        setFavoritesLoading(false);
        setFollowedOrgsLoading(false);
      }
    };

    loadFavorites();
  }, []);

  useEffect(() => {
    const stored = localStorage.getItem(FAVORITE_ITEMS_KEY);
    if (!stored) {
      setFavoriteItems([]);
      return;
    }
    try {
      setFavoriteItems(JSON.parse(stored) as FavoriteItem[]);
    } catch {
      setFavoriteItems([]);
    }
  }, []);

  const loadNotificationHistory = async () => {
    try {
      setNotificationHistoryLoading(true);
      if (!business?.id) {
        setNotificationHistory([]);
        return;
      }
      const [outboxRes] = await Promise.all([
        supabase
          .from('area_blast_outbox')
          .select('id, title, body, created_at, status, data, radius_miles')
          .eq('business_id', business.id)
          .order('created_at', { ascending: false })
          .limit(25),
      ]);

      if (outboxRes.error) throw outboxRes.error;

      const outboxRows = (outboxRes.data || []).map((row: any) => ({
        id: row.id,
        kind: 'area_blast' as const,
        title: row.title,
        body: row.body,
        created_at: row.created_at,
        status: row.status,
        data: {
          ...(row.data || {}),
          radius_miles: row.data?.radius_miles ?? row.radius_miles ?? undefined,
          sent_count: row.data?.sent_count ?? undefined,
        },
      }));

      const merged = [...outboxRows].sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
      setNotificationHistory(merged.slice(0, 25));
    } catch (err: any) {
      toast.error(err?.message || 'Failed to load notification history');
    } finally {
      setNotificationHistoryLoading(false);
    }
  };

  useEffect(() => {
    if (!business?.id) return;
    loadNotificationHistory();
  }, [business?.id]);

  const sendNotification = async () => {
    if (!business) return;
    if (notificationMode === 'followers' && !canSendNotifications) {
      toast.error('Follower notifications are not enabled for your plan.');
      return;
    }
    if (notificationMode === 'area_blast') {
      if (!planSettings?.max_area_blasts_per_month || planSettings.max_area_blasts_per_month <= 0) {
        toast.error('Area blasts are not available on your plan.');
        return;
      }
      if ((planSettings.max_blast_radius_miles || 0) < areaBlastRadiusMiles) {
        toast.error('Your plan does not allow this radius.');
        return;
      }
    }
    const title = notificationTitle.trim();
    const body = notificationBody.trim();
    if (!title || !body) {
      toast.error('Title and message are required.');
      return;
    }
    if (title.length > 140 || body.length > 1000) {
      toast.error('Message is too long.');
      return;
    }

    try {
      setSendingNotification(true);
      const { data: { session } } = await supabase.auth.getSession();
      const accessToken = session?.access_token || '';
      const res = await fetch('/api/notifications/business-broadcast', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        },
        body: JSON.stringify({
          businessId: business.id,
          title,
          body,
          url: `/business/${business.slug}`,
          type: notificationMode === 'area_blast' ? 'area_blast' : 'business_update',
          radiusMiles: notificationMode === 'area_blast' ? areaBlastRadiusMiles : undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error || 'Failed to send notification');
      }

      if (data?.pending) {
        toast.success('Area blast submitted for approval.');
      } else {
        const sentCount = Number(data.sent || 0);
        if (sentCount === 0) {
          toast('Notification saved, but no recipients matched yet.');
        } else {
          toast.success(`Notification sent to ${sentCount} followers.`);
        }
      }
      setNotificationTitle('');
      setNotificationBody('');
      loadNotificationHistory();
    } catch (err: any) {
      toast.error(err?.message || 'Failed to send notification');
    } finally {
      setSendingNotification(false);
    }
  };

  const deleteNotification = async (item: NotificationHistoryItem) => {
    if (!business) return;
    if (!confirm('Unsend this notification? This will remove it for recipients.')) return;
    try {
      const res = await fetch('/api/notifications/delete-broadcast', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          businessId: business.id,
          kind: item.kind,
          title: item.title,
          body: item.body,
          createdAt: item.created_at,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Failed to delete notification');
      setNotificationHistory((prev) => prev.filter((n) => n.id !== item.id));
      toast.success('Notification removed');
    } catch (err: any) {
      toast.error(err?.message || 'Failed to delete notification');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="rounded-2xl border border-slate-200 bg-white px-6 py-4 text-slate-600 shadow-sm animate-pulse">
          Loading dashboard…
        </div>
      </div>
    );
  }

  if (!business) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-8 max-w-md text-center shadow-sm">
          <p className="text-lg font-semibold text-slate-800">No business linked</p>
          <p className="mt-2 text-slate-600">
            Your account does not have a business linked yet. Business accounts are typically created by an administrator.
          </p>
          <p className="mt-4 text-sm text-slate-500">
            Please contact support or ask your admin to create your business via the admin panel.
          </p>
          <Link
            href="/contact"
            className="mt-6 inline-block rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500"
          >
            Contact support
          </Link>
        </div>
      </div>
    );
  }

  const uiStatus = getUiStatus(business);
  const statusColor =
    uiStatus === 'approved'
      ? 'text-white bg-emerald-600 border-emerald-600'
      : uiStatus === 'pending'
      ? 'text-white bg-amber-500 border-amber-500'
      : uiStatus === 'rejected'
      ? 'text-white bg-rose-600 border-rose-600'
      : 'text-white bg-slate-500 border-slate-500';
  const canViewPublicProfile = true;

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-slate-50 px-4 py-12">
      <div className="max-w-5xl mx-auto">
        <div className="rounded-3xl border-2 border-blue-300 bg-white shadow-lg shadow-slate-100/60">
          {/* Header */}
          <div className="flex flex-col gap-6 border-b border-slate-100 px-6 py-6 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-4">
              <div className="h-14 w-14 overflow-hidden rounded-xl border border-slate-200 bg-slate-100 shadow-sm">
                {business.logo_url ? (
                  <img
                    src={`${business.logo_url}?t=${Date.now()}`}
                    alt={`${business.business_name} logo`}
                    className="h-full w-full object-cover"
                    onError={(e) => {
                      e.currentTarget.src = 'https://placehold.co/56x56/94a3b8/ffffff?text=Logo';
                      e.currentTarget.onerror = null;
                    }}
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-xs font-semibold text-slate-500">
                    Logo
                  </div>
                )}
              </div>
              <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Business Dashboard</p>
              <h1 className="mt-1 text-2xl font-bold text-slate-900 sm:text-3xl">{business.business_name}</h1>
              <div className="mt-3 flex flex-wrap items-center gap-3 text-sm">
                <span className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold ${statusColor}`}>
                  {uiStatus.toUpperCase()}
                </span>
                <span
                  className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold ${
                    business.trial_end && business.plan === 'premium'
                      ? 'text-amber-900 bg-amber-200 border-amber-400'
                      : planConfirmed && business.plan === 'growth'
                      ? 'text-white bg-orange-500 border-orange-500'
                      : 'border-slate-200 bg-slate-50 text-slate-700'
                  }`}
                >
                  {planConfirmed && business.plan
                    ? business.trial_end && business.plan === 'premium'
                      ? 'PREMIUM FREE TRIAL'
                      : `${business.plan.toUpperCase()} PLAN`
                    : 'PLAN NOT CONFIRMED'}
                </span>
              </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <button
                onClick={() => toast('Insights coming soon.')}
                className="inline-flex items-center gap-2 rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-2 text-sm font-semibold text-indigo-700 shadow-sm transition hover:bg-indigo-100"
              >
                <BarChart3 className="h-4 w-4" />
                Insights
              </button>
              <button
                onClick={() => router.push('/business/plan')}
                className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-md shadow-indigo-200 transition hover:from-indigo-500 hover:to-blue-500"
              >
                <Crown className="h-4 w-4" />
                Upgrade / Change Plan
              </button>
            </div>
          </div>

          {/* Trial / Plan expiry banner */}
          {business.trial_end && business.plan === 'premium' && (
            <div className="mx-6 mb-4 rounded-2xl border-2 border-amber-300 bg-gradient-to-r from-amber-50 to-orange-50 px-5 py-4 shadow-sm">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h3 className="text-base font-bold text-amber-900">Premium Free Trial</h3>
                  <p className="mt-1 text-sm text-amber-800">
                    {getDaysRemaining(business.trial_end) > 0
                      ? `${getDaysRemaining(business.trial_end)} days remaining`
                      : 'Your trial has ended'}
                  </p>
                  <p className="mt-2 text-sm text-amber-900/90">
                    Want to keep your business on Premium and unlock all features? Subscribe now to continue enjoying premium benefits.
                  </p>
                </div>
                <Link
                  href="/business/plan"
                  className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-amber-600 px-5 py-2.5 text-sm font-semibold text-white shadow-md transition hover:bg-amber-500"
                >
                  <Crown className="h-4 w-4" />
                  Subscribe to Premium
                </Link>
              </div>
            </div>
          )}
          {business.plan_expires_at && !business.trial_end && business.plan && business.plan !== 'free' && (
            <div className="mx-6 mb-4 rounded-2xl border border-slate-200 bg-slate-50 px-5 py-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h3 className="text-base font-semibold text-slate-900">Plan renewal</h3>
                  <p className="mt-1 text-sm text-slate-600">
                    Your {String(business.plan).toUpperCase()} plan renews on {formatExpiryDate(business.plan_expires_at)}
                  </p>
                </div>
                <Link
                  href="/business/plan"
                  className="inline-flex shrink-0 items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                >
                  Manage Plan
                </Link>
              </div>
            </div>
          )}

          {/* Free / Starter / Growth: 3-month premium trial promo */}
          {['free', 'starter', 'growth'].includes(business.plan || '') && !business.trial_end && (
            <div className="mx-6 mb-4 rounded-2xl border-2 border-amber-300 bg-gradient-to-r from-amber-50 to-orange-50 px-5 py-4 shadow-sm">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h3 className="text-base font-bold text-amber-900">3 months free on Premium</h3>
                  <p className="mt-1 text-sm text-amber-800">
                    Upgrade to Premium and get 3 months free trial. Unlock all features for your business.
                  </p>
                </div>
                <Link
                  href="/business/plan"
                  className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-amber-600 px-5 py-2.5 text-sm font-semibold text-white shadow-md transition hover:bg-amber-500"
                >
                  <Crown className="h-4 w-4" />
                  Try Premium Free
                </Link>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="grid gap-4 px-6 py-6 md:grid-cols-2">
            <button
              onClick={() => router.push(`/businesses/edit/${business.slug}`)}
              className="group flex items-center justify-between rounded-2xl border border-emerald-200 bg-emerald-600 px-5 py-5 text-left text-white shadow-sm transition hover:-translate-y-0.5 hover:bg-emerald-500"
            >
              <div>
                <p className="text-sm font-semibold">Edit Business</p>
                <p className="mt-1 text-xs text-white/90">Update details, photos, and listings</p>
              </div>
              <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-white/15">
                <Edit className="h-4 w-4" />
              </span>
            </button>

            <button
              onClick={() => router.push(`/business/${business.slug}`)}
              className="group flex items-center justify-between rounded-2xl border border-blue-200 bg-blue-600 px-5 py-5 text-left text-white shadow-sm transition hover:-translate-y-0.5 hover:bg-blue-500"
            >
              <div>
                <p className="text-sm font-semibold">View Public Profile</p>
                <p className="mt-1 text-xs text-white/90">Preview what customers see</p>
              </div>
              <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-white/15 text-white">
                <Eye className="h-4 w-4" />
              </span>
            </button>
          </div>

          <div className="border-t border-slate-100 px-6 py-6">
            <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
              <div className="space-y-6">
                {planSettings && (
                  <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <h2 className="text-lg font-semibold text-slate-900">Send Notification</h2>
                        <p className="mt-1 text-sm text-slate-600">
                          Choose who receives your message.
                        </p>
                      </div>
                      <span className="text-xs font-semibold uppercase tracking-wide text-emerald-600">
                        {planSettings.plan?.toString().toUpperCase() || 'PLAN'}
                      </span>
                    </div>
                    <div className="mt-4 flex flex-wrap gap-2 text-xs text-slate-600">
                      <span className="rounded-full bg-slate-100 px-2.5 py-1">
                        Per week: {planSettings.max_follower_notifications_per_week}
                      </span>
                      <span className="rounded-full bg-slate-100 px-2.5 py-1">
                        Per day: {planSettings.max_follower_notifications_per_day}
                      </span>
                      <span className="rounded-full bg-slate-100 px-2.5 py-1">
                        Min minutes: {planSettings.min_minutes_between_notifications}
                      </span>
                    </div>
                    <div className="mt-4 grid gap-2 sm:grid-cols-2">
                      <label className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700 shadow-sm">
                        <input
                          type="radio"
                          name="notificationMode"
                          value="followers"
                          checked={notificationMode === 'followers'}
                          onChange={() => setNotificationMode('followers')}
                          className="accent-emerald-600"
                        />
                        Notify followers
                      </label>
                      <label className={`flex items-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-700 shadow-sm ${!isAreaBlastAvailable ? 'opacity-50' : ''}`}>
                        <input
                          type="radio"
                          name="notificationMode"
                          value="area_blast"
                          checked={notificationMode === 'area_blast'}
                          onChange={() => setNotificationMode('area_blast')}
                          disabled={!isAreaBlastAvailable}
                          className="accent-blue-600"
                        />
                        Area blast ({areaBlastRadiusMiles} miles)
                      </label>
                    </div>
                    {notificationMode === 'area_blast' && (
                      <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600 space-y-3">
                        <div>
                          Sends to users who have shared location near your business. Max radius: {planSettings.max_blast_radius_miles} miles.
                        </div>
                        <div className="flex items-center gap-3">
                          <input
                            type="range"
                            min={1}
                            max={Math.max(1, planSettings.max_blast_radius_miles || 1)}
                            value={areaBlastRadiusMiles}
                            onChange={(e) => setAreaBlastRadiusMiles(Number(e.target.value))}
                            className="w-full accent-indigo-600"
                            disabled={!isAreaBlastAvailable}
                          />
                          <span className="text-xs font-semibold text-slate-700">
                            {areaBlastRadiusMiles} mi
                          </span>
                        </div>
                      </div>
                    )}
                    {notificationMode === 'followers' && !canSendNotifications && (
                      <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                        Upgrade your plan to enable follower notifications.
                      </div>
                    )}
                    {notificationMode === 'area_blast' && areaBlastRequiresApproval && (
                      <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                        Area blasts require admin approval.
                      </div>
                    )}
                    <div className="mt-4 grid gap-3">
                      <div>
                        <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                          Title
                        </label>
                        <input
                          value={notificationTitle}
                          onChange={(e) => setNotificationTitle(e.target.value)}
                          maxLength={140}
                          disabled={
                            sendingNotification ||
                            (notificationMode === 'followers' && !canSendNotifications) ||
                            (notificationMode === 'area_blast' && !canRequestAreaBlast)
                          }
                          className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                          placeholder="e.g. New menu items just dropped!"
                        />
                      </div>
                      <div>
                        <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                          Message
                        </label>
                        <textarea
                          value={notificationBody}
                          onChange={(e) => setNotificationBody(e.target.value)}
                          maxLength={1000}
                          rows={4}
                          disabled={
                            sendingNotification ||
                            (notificationMode === 'followers' && !canSendNotifications) ||
                            (notificationMode === 'area_blast' && !canRequestAreaBlast)
                          }
                          className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                          placeholder="Tell followers about a new item, promotion, or update."
                        />
                      </div>
                      <div className="flex items-center justify-between text-xs text-slate-500">
                        <span>{notificationTitle.length}/140</span>
                        <span>{notificationBody.length}/1000</span>
                      </div>
                      <div>
                        <button
                          onClick={sendNotification}
                          disabled={
                            sendingNotification ||
                            (notificationMode === 'followers' && !canSendNotifications) ||
                            (notificationMode === 'area_blast' && !canRequestAreaBlast)
                          }
                          className={`inline-flex items-center justify-center rounded-xl px-4 py-2 text-sm font-semibold text-white shadow-sm transition ${
                            sendingNotification ||
                            (notificationMode === 'followers' && !canSendNotifications) ||
                            (notificationMode === 'area_blast' && !canRequestAreaBlast)
                              ? 'bg-slate-400'
                              : 'bg-indigo-600 hover:bg-indigo-500'
                          }`}
                        >
                          {sendingNotification
                            ? 'Sending…'
                            : notificationMode === 'area_blast' && areaBlastRequiresApproval
                            ? 'Request Approval'
                            : 'Send Notification'}
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="flex items-center justify-between gap-4">
                    <h2 className="text-lg font-semibold text-slate-900">Previous Notifications</h2>
                    <span className="text-sm text-slate-500">
                      {notificationHistory.length} total
                    </span>
                  </div>
                  {notificationHistoryLoading ? (
                    <div className="mt-4 text-slate-500">Loading history...</div>
                  ) : notificationHistory.length === 0 ? (
                    <div className="mt-4 rounded-2xl border border-dashed border-slate-300 p-6 text-center text-slate-500">
                      No notifications sent yet.
                    </div>
                  ) : (
                    <div className="mt-5 space-y-3">
                      {notificationHistory.map((item) => {
                        const status =
                          item.status === 'pending'
                            ? { label: 'Pending', color: 'bg-amber-100 text-amber-700' }
                            : item.status === 'approved'
                            ? { label: 'Approved', color: 'bg-blue-100 text-blue-700' }
                            : item.status === 'rejected'
                            ? { label: 'Rejected', color: 'bg-rose-100 text-rose-700' }
                            : { label: 'Sent', color: 'bg-emerald-100 text-emerald-700' };
                        const kind = item.kind === 'area_blast' ? 'Area Blast' : 'Notification';
                        return (
                          <div
                            key={item.id}
                            className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
                          >
                            <div className="flex flex-wrap items-center justify-between gap-3">
                              <div>
                                <p className="text-sm font-semibold text-slate-900">{item.title}</p>
                                <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-indigo-500">
                                  {kind}
                                </p>
                              </div>
                              <div className="flex items-center gap-2 text-xs">
                                <span className={`rounded-full px-2.5 py-1 font-semibold ${status.color}`}>
                                  {status.label}
                                </span>
                                <span className="text-slate-400">
                                  {new Date(item.created_at).toLocaleString()}
                                </span>
                                <button
                                  onClick={() => deleteNotification(item)}
                                  className="rounded-full border border-rose-200 bg-rose-50 px-2.5 py-1 text-xs font-semibold text-rose-600 hover:bg-rose-100"
                                >
                                  Delete
                                </button>
                              </div>
                            </div>
                            <p className="mt-2 text-sm text-slate-600">{item.body}</p>
                            <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-500">
                              {typeof item.data?.radius_miles === 'number' && (
                                <span className="rounded-full bg-slate-100 px-2.5 py-1">
                                  Radius: {item.data.radius_miles} miles
                                </span>
                              )}
                              {typeof item.data?.sent_count === 'number' && (
                                <span className="rounded-full bg-slate-100 px-2.5 py-1">
                                  Sent: {item.data.sent_count}
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {uiStatus !== 'approved' && (
                  <div className="rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-900">
                    Your business is currently pending approval. You can still view and edit your business profile and online
                    shop, but it will not be visible to other users until it has been approved.
                  </div>
                )}
              </div>

              <aside className="lg:sticky lg:top-24 h-fit space-y-6">
                <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                  <button
                    type="button"
                    onClick={() => setFavoritesOpen((prev) => !prev)}
                    className="flex w-full items-center justify-between gap-4 text-left"
                  >
                    <div>
                      <h2 className="text-lg font-semibold text-slate-900">Favorite Businesses</h2>
                      <span className="text-sm text-slate-500">{favorites.length} total</span>
                    </div>
                    <span className="text-sm text-slate-500">{favoritesOpen ? 'Hide' : 'Show'}</span>
                  </button>

                  {favoritesOpen && (
                    <>
                      {favoritesLoading ? (
                        <div className="mt-4 text-slate-500">Loading favorites...</div>
                      ) : favorites.length === 0 ? (
                        <div className="mt-4 rounded-2xl border border-dashed border-slate-300 p-6 text-center text-slate-500">
                          No favorites yet.
                        </div>
                      ) : (
                        <div className="mt-5 space-y-6">
                          {groupedFavorites.map(([category, items]) => (
                            <div key={category}>
                              {category ? (
                                <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
                                  {category}
                                </h3>
                              ) : null}
                              <div className="mt-3 grid gap-3">
                                {items.map((biz) => (
                                  <button
                                    key={biz.id}
                                    onClick={() => router.push(`/business/${biz.slug}`)}
                                    className="group flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-3 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md"
                                  >
                                    <div className="h-11 w-11 rounded-xl overflow-hidden border border-slate-200 bg-slate-100">
                                      {biz.logo_url ? (
                                        <img
                                          src={biz.logo_url}
                                          alt={biz.business_name || 'Business'}
                                          className="h-full w-full object-cover"
                                          onError={(e) => {
                                            e.currentTarget.src = 'https://placehold.co/44x44/94a3b8/ffffff?text=Logo';
                                            e.currentTarget.onerror = null;
                                          }}
                                        />
                                      ) : (
                                        <div className="flex h-full w-full items-center justify-center text-xs font-semibold text-slate-500">
                                          Logo
                                        </div>
                                      )}
                                    </div>
                                    <div className="min-w-0">
                                      <p className="truncate font-semibold text-slate-900">
                                        {biz.business_name || 'Business'}
                                      </p>
                                      <p className="text-xs text-slate-500">
                                        {biz.address?.city || ''}{biz.address?.state ? `, ${biz.address.state}` : ''}
                                      </p>
                                    </div>
                                  </button>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </>
                  )}
                </div>

                <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 shadow-sm">
                  <button
                    type="button"
                    onClick={() => setFavoriteItemsOpen((prev) => !prev)}
                    className="flex w-full items-center justify-between gap-4 text-left"
                  >
                    <div>
                      <h2 className="text-lg font-semibold text-emerald-900">Favorite Items</h2>
                      <span className="text-sm text-emerald-700">{favoriteItems.length} total</span>
                    </div>
                    <span className="text-sm text-emerald-700">{favoriteItemsOpen ? 'Hide' : 'Show'}</span>
                  </button>

                  {favoriteItemsOpen && (
                    <>
                      {favoriteItems.length === 0 ? (
                        <div className="mt-4 rounded-2xl border border-dashed border-emerald-200 p-6 text-center text-emerald-700">
                          No favorite items yet.
                        </div>
                      ) : (
                        <div className="mt-5 grid gap-3">
                          {favoriteItems.map((item) => (
                            <div
                              key={item.key}
                              className="group rounded-2xl border border-emerald-100 bg-white p-3 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-emerald-200 hover:shadow-md"
                            >
                              <Link href={`/marketplace/${item.slug}`} className="flex items-center gap-3">
                                <div className="h-11 w-11 rounded-xl overflow-hidden border border-emerald-100 bg-emerald-100">
                                  <img
                                    src={item.image || '/placeholder.jpg'}
                                    alt={item.title}
                                    className="h-full w-full object-contain"
                                    loading="lazy"
                                    decoding="async"
                                  />
                                </div>
                                <div className="min-w-0">
                                  <p className="truncate font-semibold text-emerald-900">
                                    {item.title}
                                  </p>
                                  <p className="text-xs text-emerald-700">
                                    {item.location || ''}
                                  </p>
                                </div>
                              </Link>
                              <button
                                type="button"
                                onClick={() => {
                                  const next = favoriteItems.filter((fav) => fav.key !== item.key);
                                  setFavoriteItems(next);
                                  localStorage.setItem(FAVORITE_ITEMS_KEY, JSON.stringify(next));
                                }}
                                className="mt-2 text-xs text-red-600 hover:underline"
                              >
                                Remove
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </>
                  )}
                </div>

                <div className="rounded-2xl border border-indigo-200 bg-indigo-50 p-5 shadow-sm">
                  <button
                    type="button"
                    onClick={() => setFollowedOrgsOpen((prev) => !prev)}
                    className="flex w-full items-center justify-between gap-4 text-left"
                  >
                    <div>
                      <h2 className="text-lg font-semibold text-indigo-900">Following Organizations</h2>
                      <span className="text-sm text-indigo-700">{followedOrgs.length} total</span>
                    </div>
                    <span className="text-sm text-indigo-700">{followedOrgsOpen ? 'Hide' : 'Show'}</span>
                  </button>

                  {followedOrgsOpen && (
                    <>
                      {followedOrgsLoading ? (
                        <div className="mt-4 text-indigo-700">Loading organizations...</div>
                      ) : followedOrgs.length === 0 ? (
                        <div className="mt-4 rounded-2xl border border-dashed border-indigo-200 p-6 text-center text-indigo-700">
                          No organizations followed yet.
                        </div>
                      ) : (
                        <div className="mt-5 grid gap-3">
                          {followedOrgs.map((org) => (
                            <button
                              key={org.user_id}
                              onClick={() => org.username && router.push(`/organization/${org.username}`)}
                              className="group flex items-center gap-3 rounded-2xl border border-indigo-100 bg-white p-3 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-indigo-200 hover:shadow-md"
                            >
                              <div className="h-11 w-11 rounded-xl overflow-hidden border border-indigo-100 bg-indigo-100">
                                {org.logo_url ? (
                                  <img
                                    src={org.logo_url}
                                    alt={org.full_name || 'Organization'}
                                    className="h-full w-full object-cover"
                                    onError={(e) => {
                                      e.currentTarget.src = 'https://placehold.co/44x44/94a3b8/ffffff?text=Org';
                                      e.currentTarget.onerror = null;
                                    }}
                                  />
                                ) : (
                                  <div className="flex h-full w-full items-center justify-center text-xs font-semibold text-indigo-700">
                                    Org
                                  </div>
                                )}
                              </div>
                              <div className="min-w-0">
                                <p className="truncate font-semibold text-indigo-900">
                                  {org.full_name || 'Organization'}
                                </p>
                                <p className="text-xs text-indigo-700">
                                  {org.username ? `@${org.username}` : ''}
                                </p>
                              </div>
                              <span className="ml-auto rounded-full bg-indigo-100 px-2 py-0.5 text-[11px] font-semibold text-indigo-700">
                                Organization
                              </span>
                            </button>
                          ))}
                        </div>
                      )}
                    </>
                  )}
                </div>
              </aside>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
