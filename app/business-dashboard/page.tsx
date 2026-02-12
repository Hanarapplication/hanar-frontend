'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { supabase } from '@/lib/supabaseClient';
import { Edit, Eye, Crown, BarChart3, Megaphone, ChevronDown, ChevronUp, X, Heart, Image, Building2, Bell, Trash2 } from 'lucide-react';
import { FavoritesSlideMenu } from '@/components/FavoritesSlideMenu';
import { DashboardBurgerMenu } from '@/components/DashboardBurgerMenu';

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
  source: 'retail' | 'dealership' | 'individual';
  slug: string;
  title: string;
  price: string | number;
  image: string;
  location?: string;
};

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

type PromotionRequestItem = {
  id: string;
  placement: string;
  image_path: string | null;
  link_type: string;
  link_value: string | null;
  description: string | null;
  tier: string;
  duration_days: number;
  price_cents: number;
  status: 'pending_review' | 'approved' | 'rejected' | 'active' | 'expired';
  created_at: string;
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
  const [followedOrgs, setFollowedOrgs] = useState<FollowedOrganization[]>([]);
  const [followedOrgsLoading, setFollowedOrgsLoading] = useState(true);
  const [favoritesMenuOpen, setFavoritesMenuOpen] = useState(false);
  const [burgerMenuOpen, setBurgerMenuOpen] = useState(false);
  const [notificationTitle, setNotificationTitle] = useState('');
  const [notificationBody, setNotificationBody] = useState('');
  const [sendingNotification, setSendingNotification] = useState(false);
  const [planSettings, setPlanSettings] = useState<PlanSettings | null>(null);
  const [notificationMode, setNotificationMode] = useState<'followers' | 'area_blast'>('followers');
  const [areaBlastRadiusMiles, setAreaBlastRadiusMiles] = useState(3);
  const [notificationHistory, setNotificationHistory] = useState<NotificationHistoryItem[]>([]);
  const [notificationHistoryLoading, setNotificationHistoryLoading] = useState(true);
  const [sendNotificationExpanded, setSendNotificationExpanded] = useState(false);
  const [previousNotificationsExpanded, setPreviousNotificationsExpanded] = useState(false);
  const [promotionRequests, setPromotionRequests] = useState<PromotionRequestItem[]>([]);
  const [promotionRequestsLoading, setPromotionRequestsLoading] = useState(true);
  const [promotionBannersExpanded, setPromotionBannersExpanded] = useState(false);
  const [bannerToRemoveId, setBannerToRemoveId] = useState<string | null>(null);
  const [removingBannerId, setRemovingBannerId] = useState<string | null>(null);
  const [insightsOpen, setInsightsOpen] = useState(false);
  const [insightsData, setInsightsData] = useState<{
    businessViews: number;
    retailItemViews: number;
    dealershipViews: number;
    feedBanners: { id: string; view_count: number }[];
    totalAdBannerViews: number;
    totalItemViews?: number;
    notificationsSent?: number;
    notificationsSentBlast?: number;
    notificationsSentFollower?: number;
    notificationsViewed?: number;
    blastViewed?: number;
    sentByDay?: { date: string; sent: number; blast: number; follower: number }[];
  } | null>(null);
  const [insightsLoading, setInsightsLoading] = useState(false);

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

        // Verify user is a business account before loading business data
        const { data: regProfile } = await supabase
          .from('registeredaccounts')
          .select('business')
          .eq('user_id', userId)
          .maybeSingle();

        if (!regProfile?.business) {
          router.replace('/dashboard');
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

        const { data: favRows } = await supabase
          .from('user_marketplace_favorites')
          .select('item_key, item_snapshot')
          .eq('user_id', user.id)
          .order('created_at', { ascending: true });
        const items = (favRows || []).map((r: { item_key: string; item_snapshot: Record<string, unknown> }) => ({
          key: r.item_key,
          id: (r.item_snapshot?.id as string) ?? '',
          source: (r.item_snapshot?.source as 'retail' | 'dealership' | 'individual') ?? 'individual',
          slug: (r.item_snapshot?.slug as string) ?? '',
          title: (r.item_snapshot?.title as string) ?? '',
          price: (r.item_snapshot?.price as string | number) ?? '',
          image: (r.item_snapshot?.image as string) ?? '',
          location: (r.item_snapshot?.location as string) ?? '',
        }));
        setFavoriteItems(items);
      } catch (err: any) {
        toast.error(err?.message || 'Failed to load favorites');
      } finally {
        setFavoritesLoading(false);
        setFollowedOrgsLoading(false);
      }
    };

    loadFavorites();
  }, []);

  const removeFavoriteItem = async (itemKey: string) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { error } = await supabase
      .from('user_marketplace_favorites')
      .delete()
      .eq('user_id', user.id)
      .eq('item_key', itemKey);
    if (error) {
      toast.error('Failed to remove');
      return;
    }
    setFavoriteItems((prev) => prev.filter((fav) => fav.key !== itemKey));
  };

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

  const loadPromotionRequests = async () => {
    if (!business?.id) {
      setPromotionRequests([]);
      setPromotionRequestsLoading(false);
      return;
    }
    try {
      setPromotionRequestsLoading(true);
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`/api/business/promotion-request?business_id=${encodeURIComponent(business.id)}`, {
        headers: session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {},
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Failed to load banners');
      setPromotionRequests(data.requests || []);
    } catch (err: any) {
      toast.error(err?.message || 'Failed to load banners');
      setPromotionRequests([]);
    } finally {
      setPromotionRequestsLoading(false);
    }
  };

  useEffect(() => {
    if (!business?.id) return;
    loadPromotionRequests();
  }, [business?.id]);

  // Refetch banner list and status whenever the My Banners section is opened
  useEffect(() => {
    if (promotionBannersExpanded && business?.id) {
      loadPromotionRequests();
    }
  }, [promotionBannersExpanded]);

  const removeBanner = async (id: string) => {
    if (!business?.id) return;
    setRemovingBannerId(id);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`/api/business/promotion-request?id=${encodeURIComponent(id)}`, {
        method: 'DELETE',
        headers: session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {},
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Failed to end campaign');
      setBannerToRemoveId(null);
      setPromotionRequests((prev) => prev.filter((r) => r.id !== id));
      toast.success('Campaign ended');
    } catch (err: any) {
      toast.error(err?.message || 'Failed to end campaign');
    } finally {
      setRemovingBannerId(null);
    }
  };

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
      <div className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-slate-50 dark:from-gray-900 dark:via-gray-900 dark:to-gray-900 px-4 pt-16 pb-12">
        <div className="max-w-5xl mx-auto">
          <div className="rounded-3xl border border-slate-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-lg p-6 space-y-6">
            <div className="flex items-start gap-4">
              <div className="skeleton h-14 w-14 rounded-xl" />
              <div className="flex-1 space-y-2">
                <div className="skeleton h-3 w-32 rounded" />
                <div className="skeleton h-6 w-56 rounded" />
                <div className="flex gap-2 mt-2">
                  <div className="skeleton h-6 w-20 rounded-full" />
                  <div className="skeleton h-6 w-24 rounded-full" />
                </div>
              </div>
            </div>
            <div className="flex gap-3">
              <div className="skeleton h-10 w-28 rounded-xl" />
              <div className="skeleton h-10 w-36 rounded-xl" />
              <div className="skeleton h-10 w-44 rounded-xl" />
            </div>
            <div className="skeleton h-24 w-full rounded-2xl" />
            <div className="skeleton h-24 w-full rounded-2xl" />
          </div>
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

  const burgerItems = [
    { label: 'Edit Business', href: `/businesses/edit/${business.slug}`, icon: <Edit className="h-5 w-5 shrink-0" />, color: 'bg-blue-50 dark:bg-blue-900/30' },
    { label: 'View full insights', href: '/business-dashboard/insights', icon: <BarChart3 className="h-5 w-5 shrink-0" />, color: 'bg-indigo-50 dark:bg-indigo-900/30' },
    { label: 'Promote your business', href: '/business-dashboard/promote', icon: <Megaphone className="h-5 w-5 shrink-0" />, color: 'bg-orange-50 dark:bg-orange-900/30' },
    { label: 'Send Notification', onClick: () => { setSendNotificationExpanded(true); setTimeout(() => document.getElementById('send-notification')?.scrollIntoView({ behavior: 'smooth' }), 100); }, icon: <Bell className="h-5 w-5 shrink-0" />, color: 'bg-emerald-50 dark:bg-emerald-900/30' },
    { label: 'My banners', onClick: () => { setPromotionBannersExpanded(true); setTimeout(() => document.getElementById('my-banners')?.scrollIntoView({ behavior: 'smooth' }), 100); }, icon: <Image className="h-5 w-5 shrink-0" />, color: 'bg-violet-50 dark:bg-violet-900/30' },
    { label: 'Following organizations', onClick: () => setFavoritesMenuOpen(true), icon: <Building2 className="h-5 w-5 shrink-0" />, color: 'bg-sky-50 dark:bg-sky-900/30' },
    { label: 'Favorite businesses', onClick: () => setFavoritesMenuOpen(true), icon: <Heart className="h-5 w-5 shrink-0" />, color: 'bg-rose-50 dark:bg-rose-900/30' },
    { label: 'Favorite items', onClick: () => setFavoritesMenuOpen(true), icon: <Heart className="h-5 w-5 shrink-0" />, color: 'bg-pink-50 dark:bg-pink-900/30' },
    { label: business.trial_end && business.plan === 'premium'
        ? `Premium Trial · ${getDaysRemaining(business.trial_end) > 0 ? `${getDaysRemaining(business.trial_end)} days left` : 'Ended'}`
        : business.plan_expires_at && !business.trial_end && business.plan && business.plan !== 'free'
        ? `${String(business.plan).toUpperCase()} Plan · Renews ${formatExpiryDate(business.plan_expires_at)}`
        : 'Upgrade / Change Plan',
      href: '/business/plan', icon: <Crown className="h-5 w-5 shrink-0" />, color: 'bg-amber-50 dark:bg-amber-900/30' },
    { label: 'Delete My Account', href: '/settings', icon: <Trash2 className="h-5 w-5 shrink-0" />, color: 'bg-red-50 dark:bg-red-900/30' },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-slate-50 px-4 pt-16 pb-12">
      <DashboardBurgerMenu open={burgerMenuOpen} onOpen={() => setBurgerMenuOpen(true)} onClose={() => setBurgerMenuOpen(false)} items={burgerItems} />
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
                onClick={async () => {
                  if (!business?.id) return;
                  setInsightsOpen(true);
                  setInsightsData(null);
                  setInsightsLoading(true);
                  try {
                    const { data: { session } } = await supabase.auth.getSession();
                    const res = await fetch(
                      `/api/business/insights?business_id=${encodeURIComponent(business.id)}`,
                      { headers: session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {} }
                    );
                    const data = await res.json().catch(() => ({}));
                    if (res.ok) setInsightsData(data);
                    else toast.error(data?.error || 'Failed to load insights');
                  } catch {
                    toast.error('Failed to load insights');
                  } finally {
                    setInsightsLoading(false);
                  }
                }}
                className="inline-flex items-center gap-2 rounded-xl border border-indigo-200 dark:border-indigo-600 bg-indigo-50 dark:bg-indigo-900/50 px-4 py-2 text-sm font-semibold text-indigo-700 dark:text-gray-100 shadow-sm transition hover:bg-indigo-100 dark:hover:bg-indigo-900/70"
              >
                <BarChart3 className="h-4 w-4" />
                Insights
              </button>
              <button
                onClick={() => router.push(`/business/${business.slug}`)}
                className="inline-flex items-center gap-2 rounded-xl border border-slate-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-4 py-2 text-sm font-semibold text-slate-700 dark:text-gray-200 shadow-sm transition hover:bg-slate-50 dark:hover:bg-gray-700"
              >
                <Eye className="h-4 w-4" />
                View public profile
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

          <div className="border-t border-slate-100 px-6 py-6">
            <div className="space-y-6">
                {planSettings && (
                  <div id="send-notification" className="rounded-2xl border border-slate-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-sm">
                    <button
                      type="button"
                      onClick={() => setSendNotificationExpanded((prev) => !prev)}
                      className="w-full flex flex-wrap items-center justify-between gap-3 p-5 text-left hover:bg-slate-50 dark:hover:bg-gray-700/50 rounded-2xl transition"
                    >
                      <div>
                        <h2 className="text-lg font-semibold text-slate-900 dark:text-gray-100">Send Notification</h2>
                        <p className="mt-1 text-sm text-slate-600 dark:text-gray-200">
                          Choose who receives your message.
                        </p>
                      </div>
                      <span className="flex items-center gap-2">
                        <span className="text-xs font-semibold uppercase tracking-wide text-emerald-600 dark:text-emerald-400">
                          {planSettings.plan?.toString().toUpperCase() || 'PLAN'}
                        </span>
                        {sendNotificationExpanded ? (
                          <ChevronUp className="h-5 w-5 text-slate-500" />
                        ) : (
                          <ChevronDown className="h-5 w-5 text-slate-500" />
                        )}
                      </span>
                    </button>
                    {sendNotificationExpanded && (
                    <div className="px-5 pb-5 pt-0 space-y-4">
                    <div className="flex flex-wrap gap-2 text-xs text-slate-600 dark:text-gray-200">
                      <span className="rounded-full bg-slate-100 dark:bg-gray-700 px-2.5 py-1">
                        Per week: {planSettings.max_follower_notifications_per_week}
                      </span>
                      <span className="rounded-full bg-slate-100 dark:bg-gray-700 px-2.5 py-1">
                        Per day: {planSettings.max_follower_notifications_per_day}
                      </span>
                      <span className="rounded-full bg-slate-100 dark:bg-gray-700 px-2.5 py-1">
                        Min minutes: {planSettings.min_minutes_between_notifications}
                      </span>
                    </div>
                    <div className="mt-4 grid gap-2 sm:grid-cols-2">
                      <label className="flex items-center gap-2 rounded-xl border border-emerald-200 dark:border-gray-600 bg-emerald-50 dark:bg-gray-700 px-3 py-2 text-sm text-emerald-700 dark:text-gray-200 shadow-sm">
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
                      <label className={`flex items-center gap-2 rounded-xl border border-blue-200 dark:border-gray-600 bg-blue-50 dark:bg-gray-700 px-3 py-2 text-sm text-blue-700 dark:text-gray-100 shadow-sm ${!isAreaBlastAvailable ? 'opacity-50' : ''}`}>
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
                      <div className="mt-3 rounded-xl border border-slate-200 dark:border-gray-600 bg-slate-50 dark:bg-gray-700/80 px-4 py-3 text-sm text-slate-600 dark:text-gray-200 space-y-3">
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
                          <span className="text-xs font-semibold text-slate-700 dark:text-gray-200">
                            {areaBlastRadiusMiles} mi
                          </span>
                        </div>
                      </div>
                    )}
                    {notificationMode === 'followers' && !canSendNotifications && (
                      <div className="mt-3 rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/30 px-4 py-3 text-sm text-amber-800 dark:text-amber-200">
                        Upgrade your plan to enable follower notifications.
                      </div>
                    )}
                    {notificationMode === 'area_blast' && areaBlastRequiresApproval && (
                      <div className="mt-3 rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/30 px-4 py-3 text-sm text-amber-800 dark:text-amber-200">
                        Area blasts require admin approval.
                      </div>
                    )}
                    <div className="mt-4 grid gap-3">
                      <div>
                        <label className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-gray-200">
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
                          className="mt-1 w-full rounded-xl border border-slate-200 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-slate-900 dark:text-gray-100 shadow-sm focus:border-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-200 dark:placeholder-gray-400"
                          placeholder="e.g. New menu items just dropped!"
                        />
                      </div>
                      <div>
                        <label className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-gray-200">
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
                          className="mt-1 w-full rounded-xl border border-slate-200 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-slate-900 dark:text-gray-100 shadow-sm focus:border-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-200 dark:placeholder-gray-400"
                          placeholder="Tell followers about a new item, promotion, or update."
                        />
                      </div>
                      <div className="flex items-center justify-between text-xs text-slate-500 dark:text-gray-200">
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
                  </div>
                )}

                <div className="rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800">
                  <button
                    type="button"
                    onClick={() => setPreviousNotificationsExpanded((prev) => !prev)}
                    className="w-full flex items-center justify-between gap-4 p-5 text-left hover:bg-slate-50 dark:hover:bg-gray-700/50 rounded-2xl transition"
                  >
                    <h2 className="text-lg font-semibold text-slate-900 dark:text-gray-100">Previous Notifications</h2>
                    <span className="flex items-center gap-2">
                      <span className="text-sm text-slate-500 dark:text-gray-400">
                        {notificationHistory.length} total
                      </span>
                      {previousNotificationsExpanded ? (
                        <ChevronUp className="h-5 w-5 text-slate-500" />
                      ) : (
                        <ChevronDown className="h-5 w-5 text-slate-500" />
                      )}
                    </span>
                  </button>
                  {previousNotificationsExpanded && (
                    <div className="px-5 pb-5 pt-0">
                      {notificationHistoryLoading ? (
                        <div className="text-slate-500 dark:text-gray-400">Loading history...</div>
                      ) : notificationHistory.length === 0 ? (
                        <div className="rounded-2xl border border-dashed border-slate-300 dark:border-gray-600 p-6 text-center text-slate-500 dark:text-gray-400">
                          No notifications sent yet.
                        </div>
                      ) : (
                        <div className="mt-3 space-y-3">
                          {notificationHistory.map((item) => {
                            const status =
                              item.status === 'pending'
                                ? { label: 'Pending', color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-200' }
                                : item.status === 'approved'
                                ? { label: 'Approved', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-200' }
                                : item.status === 'rejected'
                                ? { label: 'Rejected', color: 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-200' }
                                : { label: 'Sent', color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-200' };
                            const kind = item.kind === 'area_blast' ? 'Area Blast' : 'Notification';
                            return (
                              <div
                                key={item.id}
                                className="rounded-2xl border border-slate-200 dark:border-gray-600 bg-white dark:bg-gray-800 p-4 shadow-sm"
                              >
                                <div className="flex flex-wrap items-center justify-between gap-3">
                                  <div>
                                    <p className="text-sm font-semibold text-slate-900 dark:text-gray-100">{item.title}</p>
                                    <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-indigo-500">
                                      {kind}
                                    </p>
                                  </div>
                                  <div className="flex items-center gap-2 text-xs">
                                    <span className={`rounded-full px-2.5 py-1 font-semibold ${status.color}`}>
                                      {status.label}
                                    </span>
                                    <span className="text-slate-400 dark:text-gray-500">
                                      {new Date(item.created_at).toLocaleString()}
                                    </span>
                                    <button
                                      onClick={() => deleteNotification(item)}
                                      className="rounded-full border border-rose-200 bg-rose-50 dark:border-rose-800 dark:bg-rose-900/30 px-2.5 py-1 text-xs font-semibold text-rose-600 dark:text-rose-200 hover:bg-rose-100 dark:hover:bg-rose-900/50"
                                    >
                                      Delete
                                    </button>
                                  </div>
                                </div>
                                <p className="mt-2 text-sm text-slate-600 dark:text-gray-300">{item.body}</p>
                                <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-500 dark:text-gray-400">
                                  {typeof item.data?.radius_miles === 'number' && (
                                    <span className="rounded-full bg-slate-100 dark:bg-gray-700 px-2.5 py-1">
                                      Radius: {item.data.radius_miles} miles
                                    </span>
                                  )}
                                  {typeof item.data?.sent_count === 'number' && (
                                    <span className="rounded-full bg-slate-100 dark:bg-gray-700 px-2.5 py-1">
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
                  )}
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800">
                  <button
                    type="button"
                    onClick={() => setPromotionBannersExpanded((prev) => !prev)}
                    className="w-full flex items-center justify-between gap-4 p-5 text-left hover:bg-slate-50 dark:hover:bg-gray-700/50 rounded-2xl transition"
                  >
                    <h2 id="my-banners" className="text-lg font-semibold text-slate-900 dark:text-gray-100">My Banners</h2>
                    <span className="flex items-center gap-2">
                      <span className="text-sm text-slate-500 dark:text-gray-400">
                        {promotionRequests.length} total
                      </span>
                      {promotionBannersExpanded ? (
                        <ChevronUp className="h-5 w-5 text-slate-500" />
                      ) : (
                        <ChevronDown className="h-5 w-5 text-slate-500" />
                      )}
                    </span>
                  </button>
                  {promotionBannersExpanded && (
                    <div className="px-5 pb-5 pt-0">
                      {promotionRequestsLoading ? (
                        <div className="text-slate-500 dark:text-gray-400">Loading banners...</div>
                      ) : promotionRequests.length === 0 ? (
                        <div className="rounded-2xl border border-dashed border-slate-300 dark:border-gray-600 p-6 text-center text-slate-500 dark:text-gray-400">
                          No promotion banners yet.{' '}
                          <Link href="/business-dashboard/promote" className="text-indigo-600 dark:text-indigo-400 font-medium hover:underline">
                            Promote your business
                          </Link>
                        </div>
                      ) : (
                        <div className="mt-3 space-y-3">
                          {promotionRequests.map((item) => {
                            const statusConfig =
                              item.status === 'pending_review'
                                ? { label: 'In review', color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-200' }
                                : item.status === 'active'
                                ? { label: 'Active', color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-200' }
                                : item.status === 'approved'
                                ? { label: 'Approved', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-200' }
                                : item.status === 'rejected'
                                ? { label: 'Rejected', color: 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-200' }
                                : { label: 'Expired', color: 'bg-slate-100 text-slate-600 dark:bg-gray-700 dark:text-gray-300' };
                            const placementLabel = item.placement === 'home_feed' ? 'Home feed' : item.placement === 'community' ? 'Community' : 'Universal';
                            const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
                            const imageUrl = item.image_path ? `${supabaseUrl}/storage/v1/object/public/feed-banners/${item.image_path}` : null;
                            return (
                              <div
                                key={item.id}
                                className="rounded-2xl border border-slate-200 dark:border-gray-600 bg-white dark:bg-gray-800 p-4 shadow-sm"
                              >
                                <div className="flex gap-4">
                                  {imageUrl && (
                                    <div className="h-16 w-28 flex-shrink-0 overflow-hidden rounded-xl border border-slate-200 dark:border-gray-600 bg-slate-100 dark:bg-gray-700">
                                      <img src={imageUrl} alt="" className="h-full w-full object-cover" />
                                    </div>
                                  )}
                                  <div className="min-w-0 flex-1">
                                    <div className="flex flex-wrap items-center justify-between gap-2">
                                      <span className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-gray-400">
                                        {placementLabel} · {item.tier}
                                      </span>
                                      <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${statusConfig.color}`}>
                                        {statusConfig.label}
                                      </span>
                                    </div>
                                    <p className="mt-1 text-sm text-slate-600 dark:text-gray-300 line-clamp-2">
                                      {item.description || 'Promotion banner'}
                                    </p>
                                    <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-gray-400">
                                      <span>{item.duration_days} days</span>
                                      <span>{new Date(item.created_at).toLocaleDateString()}</span>
                                      <button
                                        type="button"
                                        onClick={() => setBannerToRemoveId(item.id)}
                                        className="ml-auto rounded-full border border-rose-200 bg-rose-50 px-2.5 py-1 text-xs font-semibold text-rose-600 dark:border-rose-800 dark:bg-rose-900/30 dark:text-rose-200 hover:bg-rose-100 dark:hover:bg-rose-900/50"
                                      >
                                        Remove
                                      </button>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {bannerToRemoveId && (
                  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true" aria-labelledby="confirm-remove-title">
                    <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-5 shadow-xl dark:border-gray-600 dark:bg-gray-800">
                      <h3 id="confirm-remove-title" className="text-lg font-semibold text-slate-900 dark:text-gray-100">
                        End campaign?
                      </h3>
                      <p className="mt-2 text-sm text-slate-600 dark:text-gray-300">
                        Are you sure you want to end this campaign? This will remove the banner from your list and stop it from showing.
                      </p>
                      <div className="mt-5 flex justify-end gap-3">
                        <button
                          type="button"
                          onClick={() => setBannerToRemoveId(null)}
                          disabled={!!removingBannerId}
                          className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          onClick={() => bannerToRemoveId && removeBanner(bannerToRemoveId)}
                          disabled={!!removingBannerId}
                          className="rounded-xl bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-500 disabled:opacity-50"
                        >
                          {removingBannerId === bannerToRemoveId ? 'Ending…' : 'End campaign'}
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {insightsOpen && (
                  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true" aria-labelledby="insights-title">
                    <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl dark:border-gray-600 dark:bg-gray-800">
                      <div className="flex items-center justify-between mb-4">
                        <h2 id="insights-title" className="text-xl font-semibold text-slate-900 dark:text-gray-100 flex items-center gap-2">
                          <BarChart3 className="h-5 w-5" />
                          Analytics
                        </h2>
                        <button
                          type="button"
                          onClick={() => setInsightsOpen(false)}
                          className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-gray-700"
                          aria-label="Close"
                        >
                          <X className="h-5 w-5" />
                        </button>
                      </div>
                      {insightsLoading ? (
                        <p className="text-sm text-slate-500 dark:text-gray-400 py-6">Loading insights…</p>
                      ) : insightsData ? (
                        <div className="space-y-4">
                          {business?.plan === 'premium' ? (
                            <>
                              <div className="grid grid-cols-2 gap-3">
                                <div className="rounded-xl border border-slate-200 dark:border-gray-600 bg-slate-50 dark:bg-gray-700/50 p-4">
                                  <p className="text-xs font-medium uppercase tracking-wider text-slate-500 dark:text-gray-400">Profile views</p>
                                  <p className="mt-1 text-2xl font-bold text-slate-900 dark:text-gray-100">{insightsData.businessViews.toLocaleString()}</p>
                                  <p className="text-xs text-slate-500 dark:text-gray-400 mt-0.5">Home feed, businesses page, profile</p>
                                </div>
                                <div className="rounded-xl border border-slate-200 dark:border-gray-600 bg-slate-50 dark:bg-gray-700/50 p-4">
                                  <p className="text-xs font-medium uppercase tracking-wider text-slate-500 dark:text-gray-400">Retail items</p>
                                  <p className="mt-1 text-2xl font-bold text-slate-900 dark:text-gray-100">{insightsData.retailItemViews.toLocaleString()}</p>
                                  <p className="text-xs text-slate-500 dark:text-gray-400 mt-0.5">views</p>
                                </div>
                                <div className="rounded-xl border border-slate-200 dark:border-gray-600 bg-slate-50 dark:bg-gray-700/50 p-4">
                                  <p className="text-xs font-medium uppercase tracking-wider text-slate-500 dark:text-gray-400">Car listings</p>
                                  <p className="mt-1 text-2xl font-bold text-slate-900 dark:text-gray-100">{insightsData.dealershipViews.toLocaleString()}</p>
                                  <p className="text-xs text-slate-500 dark:text-gray-400 mt-0.5">views</p>
                                </div>
                                <div className="rounded-xl border border-slate-200 dark:border-gray-600 bg-slate-50 dark:bg-gray-700/50 p-4">
                                  <p className="text-xs font-medium uppercase tracking-wider text-slate-500 dark:text-gray-400">Ad banners</p>
                                  <p className="mt-1 text-2xl font-bold text-slate-900 dark:text-gray-100">{insightsData.totalAdBannerViews.toLocaleString()}</p>
                                  <p className="text-xs text-slate-500 dark:text-gray-400 mt-0.5">views</p>
                                </div>
                                {typeof insightsData.notificationsSent === 'number' && (
                                  <div className="col-span-2 rounded-xl border border-slate-200 dark:border-gray-600 bg-slate-50 dark:bg-gray-700/50 p-4">
                                    <p className="text-xs font-medium uppercase tracking-wider text-slate-500 dark:text-gray-400">Notifications sent</p>
                                    <p className="mt-1 text-2xl font-bold text-slate-900 dark:text-gray-100">{insightsData.notificationsSent.toLocaleString()}</p>
                                    <p className="text-xs text-slate-500 dark:text-gray-400 mt-0.5">Blasts + follower deliveries · <Link href="/business-dashboard/insights" className="text-indigo-600 dark:text-indigo-400 underline" onClick={() => setInsightsOpen(false)}>View full insights</Link></p>
                                  </div>
                                )}
                              </div>
                            </>
                          ) : insightsData.feedBanners.length > 0 ? (
                            <div className="rounded-xl border border-slate-200 dark:border-gray-600 bg-slate-50 dark:bg-gray-700/50 p-4">
                              <p className="text-xs font-medium uppercase tracking-wider text-slate-500 dark:text-gray-400">Ad banner views</p>
                              <p className="mt-1 text-2xl font-bold text-slate-900 dark:text-gray-100">{insightsData.totalAdBannerViews.toLocaleString()}</p>
                              <p className="text-xs text-slate-500 dark:text-gray-400 mt-0.5">Total views for your feed banner{insightsData.feedBanners.length > 1 ? 's' : ''}</p>
                            </div>
                          ) : (
                            <div className="rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 p-5 text-center">
                              <p className="text-sm font-medium text-amber-900 dark:text-amber-200">
                                These analytics are only available on the Premium package.
                              </p>
                              <p className="mt-2 text-xs text-amber-800 dark:text-amber-300">
                                Upgrade to Premium to see profile views, item views, and ad performance.
                              </p>
                              <Link
                                href="/business/plan"
                                className="mt-4 inline-flex items-center gap-2 rounded-xl bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-500"
                                onClick={() => setInsightsOpen(false)}
                              >
                                <Crown className="h-4 w-4" />
                                View Premium
                              </Link>
                            </div>
                          )}
                        </div>
                      ) : (
                        <p className="text-sm text-slate-500 dark:text-gray-400 py-4">Could not load insights.</p>
                      )}
                    </div>
                  </div>
                )}

                {uiStatus !== 'approved' && (
                  <div className="rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-900">
                    Your business is currently pending approval. You can still view and edit your business profile and online
                    shop, but it will not be visible to other users until it has been approved.
                  </div>
                )}
              </div>

              <FavoritesSlideMenu open={favoritesMenuOpen} onClose={() => setFavoritesMenuOpen(false)} title="Favorites">
                <div className="space-y-8">
                  <div>
                    <h3 className="text-sm font-semibold uppercase tracking-wide text-indigo-600 dark:text-indigo-400">Following Organizations</h3>
                    {followedOrgsLoading ? (
                      <p className="mt-4 text-slate-500">Loading...</p>
                    ) : followedOrgs.length === 0 ? (
                      <p className="mt-4 rounded-2xl border border-dashed border-indigo-200 dark:border-indigo-800 p-6 text-center text-slate-500">No organizations followed yet.</p>
                    ) : (
                      <div className="mt-3 grid gap-2">
                        {followedOrgs.map((org) => (
                          <button
                            key={org.user_id}
                            onClick={() => { org.username && router.push(`/organization/${org.username}`); setFavoritesMenuOpen(false); }}
                            className="flex items-center gap-3 rounded-xl border border-indigo-100 dark:border-gray-600 bg-white dark:bg-gray-800 p-3 text-left hover:border-indigo-200 dark:hover:border-gray-500"
                          >
                            <div className="h-10 w-10 rounded-lg overflow-hidden bg-indigo-100 dark:bg-indigo-900/50">
                              {org.logo_url ? (
                                <img src={org.logo_url} alt="" className="h-full w-full object-cover" onError={(e) => { e.currentTarget.src = 'https://placehold.co/40x40'; e.currentTarget.onerror = null; }} />
                              ) : (
                                <div className="flex h-full w-full items-center justify-center text-xs text-indigo-600">Org</div>
                              )}
                            </div>
                            <div className="min-w-0">
                              <p className="truncate font-semibold text-slate-900 dark:text-white">{org.full_name || 'Organization'}</p>
                              <p className="text-xs text-slate-500 dark:text-gray-400">{org.username ? `@${org.username}` : ''}</p>
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-gray-400">Favorite Businesses</h3>
                    {favoritesLoading ? (
                      <p className="mt-4 text-slate-500">Loading favorites...</p>
                    ) : favorites.length === 0 ? (
                      <p className="mt-4 rounded-2xl border border-dashed border-slate-300 dark:border-gray-600 p-6 text-center text-slate-500">No favorites yet.</p>
                    ) : (
                      <div className="mt-3 space-y-6">
                        {groupedFavorites.map(([category, items]) => (
                          <div key={category}>
                            {category ? <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-gray-400">{category}</p> : null}
                            <div className="mt-2 grid gap-2">
                              {items.map((biz) => (
                                <button
                                  key={biz.id}
                                  onClick={() => { router.push(`/business/${biz.slug}`); setFavoritesMenuOpen(false); }}
                                  className="flex items-center gap-3 rounded-xl border border-slate-200 dark:border-gray-600 bg-white dark:bg-gray-800 p-3 text-left hover:border-slate-300 dark:hover:border-gray-500"
                                >
                                  <div className="h-10 w-10 rounded-lg overflow-hidden bg-slate-100 dark:bg-gray-700">
                                    {biz.logo_url ? (
                                      <img src={biz.logo_url} alt="" className="h-full w-full object-cover" onError={(e) => { e.currentTarget.src = 'https://placehold.co/40x40'; e.currentTarget.onerror = null; }} />
                                    ) : (
                                      <div className="flex h-full w-full items-center justify-center text-xs text-slate-500">Logo</div>
                                    )}
                                  </div>
                                  <div className="min-w-0">
                                    <p className="truncate font-semibold text-slate-900 dark:text-white">{biz.business_name || 'Business'}</p>
                                    <p className="text-xs text-slate-500 dark:text-gray-400">{biz.address?.city || ''}{biz.address?.state ? `, ${biz.address.state}` : ''}</p>
                                  </div>
                                </button>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold uppercase tracking-wide text-emerald-600 dark:text-emerald-400">Favorite Items</h3>
                    {favoriteItems.length === 0 ? (
                      <p className="mt-4 rounded-2xl border border-dashed border-emerald-200 dark:border-emerald-800 p-6 text-center text-emerald-700 dark:text-emerald-400">No favorite items yet.</p>
                    ) : (
                      <div className="mt-3 grid gap-2">
                        {favoriteItems.map((item) => (
                          <div key={item.key} className="rounded-xl border border-emerald-100 dark:border-emerald-900 bg-white dark:bg-gray-800 p-3">
                            <Link href={`/marketplace/${item.slug}`} onClick={() => setFavoritesMenuOpen(false)} className="flex items-center gap-3">
                              <div className="h-10 w-10 rounded-lg overflow-hidden bg-emerald-100 dark:bg-emerald-900/50">
                                <img src={item.image || '/placeholder.jpg'} alt="" className="h-full w-full object-contain" />
                              </div>
                              <div className="min-w-0">
                                <p className="truncate font-semibold text-emerald-900 dark:text-white">{item.title}</p>
                                <p className="text-xs text-emerald-700 dark:text-emerald-400">{item.location || ''}</p>
                              </div>
                            </Link>
                            <button type="button" onClick={() => removeFavoriteItem(item.key)} className="mt-2 text-xs text-red-600 dark:text-red-400 hover:underline">Remove</button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </FavoritesSlideMenu>
          </div>
        </div>
      </div>
    </div>
  );
}
