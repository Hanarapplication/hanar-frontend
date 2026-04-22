'use client';

import { createPortal } from 'react-dom';
import { Suspense, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { supabase } from '@/lib/supabaseClient';
import { Edit, Eye, Crown, BarChart3, Megaphone, ChevronDown, ChevronUp, X, Image, Bell, Trash2, Download, FileText, Palette } from 'lucide-react';
import { DashboardBurgerMenu } from '@/components/DashboardBurgerMenu';
import { isAppIOS, withAppParam } from '@/utils/isAppIOS';

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
  subcategory?: string | null;
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
  status: 'pending_payment' | 'pending_review' | 'approved' | 'rejected' | 'active' | 'expired';
  created_at: string;
};

type BusinessCommunityPost = {
  id: string;
  title: string;
  body: string;
  image?: string | null;
  video?: string | null;
  created_at: string;
  likes_post?: number | null;
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

function sanitizeHexColor(value: string | null | undefined, fallback: string): string {
  const v = (value || '').trim();
  const normalized = v.startsWith('#') ? v : v ? `#${v}` : '';
  return /^#[0-9a-fA-F]{6}$/i.test(normalized) ? `#${normalized.slice(1).toLowerCase()}` : fallback;
}

const DEFAULT_SLUG_PRIMARY = '#0c1f3c';
const DEFAULT_SLUG_SECONDARY = '#6b1515';
const DEFAULT_RETAIL_SEARCH_ACCENT = '#0f766e';

function hexToHsl(hex: string): { h: number; s: number; l: number } {
  const safe = sanitizeHexColor(hex, '#000000').slice(1);
  const r = parseInt(safe.slice(0, 2), 16) / 255;
  const g = parseInt(safe.slice(2, 4), 16) / 255;
  const b = parseInt(safe.slice(4, 6), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  let h = 0;
  const l = (max + min) / 2;
  const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
  if (d !== 0) {
    switch (max) {
      case r:
        h = 60 * (((g - b) / d) % 6);
        break;
      case g:
        h = 60 * ((b - r) / d + 2);
        break;
      default:
        h = 60 * ((r - g) / d + 4);
    }
  }
  if (h < 0) h += 360;
  return { h: Math.round(h), s: Math.round(s * 100), l: Math.round(l * 100) };
}

function hslToHex(h: number, s: number, l: number): string {
  const sat = Math.max(0, Math.min(100, s)) / 100;
  const light = Math.max(0, Math.min(100, l)) / 100;
  const c = (1 - Math.abs(2 * light - 1)) * sat;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = light - c / 2;
  let r = 0;
  let g = 0;
  let b = 0;
  if (h >= 0 && h < 60) [r, g, b] = [c, x, 0];
  else if (h < 120) [r, g, b] = [x, c, 0];
  else if (h < 180) [r, g, b] = [0, c, x];
  else if (h < 240) [r, g, b] = [0, x, c];
  else if (h < 300) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  const toHex = (v: number) => Math.round((v + m) * 255).toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

function buildBrandBackground(primary: string, secondary: string, useGradient: boolean): string {
  return useGradient ? `linear-gradient(90deg, ${primary}, ${secondary})` : primary;
}

function BusinessDashboardContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const appIOS = isAppIOS(searchParams?.toString() ?? null);
  const [loading, setLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState('');

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
    profile_template?: string | null;
    theme?: string | null;
    accent_color?: string | null;
    slug_primary_color?: string | null;
    slug_secondary_color?: string | null;
    slug_use_gradient?: boolean | null;
    slug_retail_search_accent_color?: string | null;
    slug_view_detail_button_color?: string | null;
    slug_sidebar_menu_button_color?: string | null;
  } | null>(null);
  const [favorites, setFavorites] = useState<FavoriteBusiness[]>([]);
  const [favoritesLoading, setFavoritesLoading] = useState(true);
  const [favoriteItems, setFavoriteItems] = useState<FavoriteItem[]>([]);
  const [followedOrgs, setFollowedOrgs] = useState<FollowedOrganization[]>([]);
  const [followedOrgsLoading, setFollowedOrgsLoading] = useState(true);
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
  const [pageColorsOpen, setPageColorsOpen] = useState(false);
  const [savingPageColors, setSavingPageColors] = useState(false);
  const [slugPrimaryColorInput, setSlugPrimaryColorInput] = useState(DEFAULT_SLUG_PRIMARY);
  const [slugSecondaryColorInput, setSlugSecondaryColorInput] = useState(DEFAULT_SLUG_SECONDARY);
  const [slugPrimaryHue, setSlugPrimaryHue] = useState(hexToHsl(DEFAULT_SLUG_PRIMARY).h);
  const [slugSecondaryHue, setSlugSecondaryHue] = useState(hexToHsl(DEFAULT_SLUG_SECONDARY).h);
  const [slugUseGradientInput, setSlugUseGradientInput] = useState(true);
  const [retailSearchAccentInput, setRetailSearchAccentInput] = useState(DEFAULT_RETAIL_SEARCH_ACCENT);
  const [viewDetailButtonColorInput, setViewDetailButtonColorInput] = useState('');
  const [sidebarMenuButtonColorInput, setSidebarMenuButtonColorInput] = useState('');
  const [myPostsExpanded, setMyPostsExpanded] = useState(false);
  const [businessPosts, setBusinessPosts] = useState<BusinessCommunityPost[]>([]);
  const [businessPostCommentCounts, setBusinessPostCommentCounts] = useState<Record<string, number>>({});
  const [businessPostsLoading, setBusinessPostsLoading] = useState(false);
  const [deletingBusinessPostId, setDeletingBusinessPostId] = useState<string | null>(null);
  const [bannerToRemoveId, setBannerToRemoveId] = useState<string | null>(null);
  const [removingBannerId, setRemovingBannerId] = useState<string | null>(null);
  const [notificationToDelete, setNotificationToDelete] = useState<NotificationHistoryItem | null>(null);
  const [deletingNotificationId, setDeletingNotificationId] = useState<string | null>(null);
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
      const key = normalizeCategory(biz.subcategory || biz.category);
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

        let sessionRes = await supabase.auth.getSession();
        if (sessionRes.error) throw sessionRes.error;

        let userId = sessionRes.data.session?.user?.id;
        if (!userId) {
          await new Promise((r) => setTimeout(r, 200));
          sessionRes = await supabase.auth.getSession();
          userId = sessionRes.data.session?.user?.id;
        }
        if (!userId) {
          router.replace('/login');
          return;
        }
        if (mounted) setCurrentUserId(userId);

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
          .select(
            'id, business_name, slug, moderation_status, lifecycle_status, is_archived, plan, plan_selected_at, trial_end, plan_expires_at, logo_url, lat, lon, profile_template, theme, accent_color, slug_primary_color, slug_secondary_color, slug_use_gradient, slug_retail_search_accent_color, slug_view_detail_button_color, slug_sidebar_menu_button_color'
          )
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
            profile_template: data.profile_template ? String(data.profile_template) : null,
            theme: data.theme ? String(data.theme) : null,
            accent_color: data.accent_color ? String(data.accent_color) : null,
            slug_primary_color: data.slug_primary_color ? String(data.slug_primary_color) : null,
            slug_secondary_color: data.slug_secondary_color ? String(data.slug_secondary_color) : null,
            slug_use_gradient: typeof data.slug_use_gradient === 'boolean' ? data.slug_use_gradient : null,
            slug_retail_search_accent_color: data.slug_retail_search_accent_color ? String(data.slug_retail_search_accent_color) : null,
            slug_view_detail_button_color: data.slug_view_detail_button_color ? String(data.slug_view_detail_button_color) : null,
            slug_sidebar_menu_button_color: data.slug_sidebar_menu_button_color
              ? String(data.slug_sidebar_menu_button_color)
              : null,
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
            router.replace(appIOS ? withAppParam('/dashboard/account', true) : '/business/plan');
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
  }, [router, appIOS]);

  useEffect(() => {
    if (!planSettings) return;
    const maxRadius = Math.max(0, planSettings.max_blast_radius_miles || 0);
    if (maxRadius > 0 && areaBlastRadiusMiles > maxRadius) {
      setAreaBlastRadiusMiles(maxRadius);
    }
  }, [planSettings, areaBlastRadiusMiles]);

  useEffect(() => {
    if (!business) return;
    setSlugPrimaryColorInput(sanitizeHexColor(business.slug_primary_color, DEFAULT_SLUG_PRIMARY));
    setSlugSecondaryColorInput(sanitizeHexColor(business.slug_secondary_color, DEFAULT_SLUG_SECONDARY));
    setSlugUseGradientInput(business.slug_use_gradient !== false);
    setRetailSearchAccentInput(sanitizeHexColor(business.slug_retail_search_accent_color, DEFAULT_RETAIL_SEARCH_ACCENT));
    setViewDetailButtonColorInput(
      business.slug_view_detail_button_color ? sanitizeHexColor(business.slug_view_detail_button_color, DEFAULT_SLUG_PRIMARY) : ''
    );
    setSidebarMenuButtonColorInput(
      business.slug_sidebar_menu_button_color ? sanitizeHexColor(business.slug_sidebar_menu_button_color, DEFAULT_SLUG_PRIMARY) : ''
    );
  }, [
    business?.id,
    business?.slug_primary_color,
    business?.slug_secondary_color,
    business?.slug_use_gradient,
    business?.slug_retail_search_accent_color,
    business?.slug_view_detail_button_color,
    business?.slug_sidebar_menu_button_color,
  ]);

  useEffect(() => {
    setSlugPrimaryHue(hexToHsl(sanitizeHexColor(slugPrimaryColorInput, DEFAULT_SLUG_PRIMARY)).h);
  }, [slugPrimaryColorInput]);

  useEffect(() => {
    setSlugSecondaryHue(hexToHsl(sanitizeHexColor(slugSecondaryColorInput, DEFAULT_SLUG_SECONDARY)).h);
  }, [slugSecondaryColorInput]);

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
          .select('id, business_name, slug, category, subcategory, logo_url, address')
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
      const res = await fetch(`/api/promotion-request?source=business&business_id=${encodeURIComponent(business.id)}`, {
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

  const loadBusinessPosts = async () => {
    if (!business?.slug) {
      setBusinessPosts([]);
      setBusinessPostCommentCounts({});
      setBusinessPostsLoading(false);
      return;
    }
    try {
      setBusinessPostsLoading(true);
      const params = new URLSearchParams({ businessSlug: business.slug });
      if (currentUserId) params.set('viewerUserId', currentUserId);
      const res = await fetch(`/api/community/posts?${params.toString()}`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Failed to load posts');
      setBusinessPosts((data.posts || []) as BusinessCommunityPost[]);
      setBusinessPostCommentCounts((data.commentCounts || {}) as Record<string, number>);
    } catch (err: any) {
      toast.error(err?.message || 'Failed to load posts');
      setBusinessPosts([]);
      setBusinessPostCommentCounts({});
    } finally {
      setBusinessPostsLoading(false);
    }
  };

  const deleteBusinessPost = async (postId: string) => {
    if (!postId || deletingBusinessPostId) return;
    const confirmed = window.confirm('Delete this post? This cannot be undone.');
    if (!confirmed) return;
    setDeletingBusinessPostId(postId);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch('/api/community/post/delete', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
        },
        body: JSON.stringify({ post_id: postId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Failed to delete post');
      setBusinessPosts((prev) => prev.filter((post) => post.id !== postId));
      setBusinessPostCommentCounts((prev) => {
        const next = { ...prev };
        delete next[postId];
        return next;
      });
      toast.success('Post deleted');
    } catch (err: any) {
      toast.error(err?.message || 'Failed to delete post');
    } finally {
      setDeletingBusinessPostId(null);
    }
  };

  const savePageColors = async () => {
    if (!business?.id) return;
    const primary = sanitizeHexColor(slugPrimaryColorInput, DEFAULT_SLUG_PRIMARY);
    const secondary = sanitizeHexColor(slugSecondaryColorInput, DEFAULT_SLUG_SECONDARY);
    const retailSearch = sanitizeHexColor(retailSearchAccentInput, DEFAULT_RETAIL_SEARCH_ACCENT);
    const viewDetailTrim = viewDetailButtonColorInput.trim();
    const sidebarTrim = sidebarMenuButtonColorInput.trim();
    const viewDetailSaved = viewDetailTrim ? sanitizeHexColor(viewDetailTrim, primary) : null;
    const sidebarSaved = sidebarTrim ? sanitizeHexColor(sidebarTrim, primary) : null;
    try {
      setSavingPageColors(true);
      const { error } = await supabase
        .from('businesses')
        .update({
          slug_primary_color: primary,
          slug_secondary_color: secondary,
          slug_use_gradient: slugUseGradientInput,
          slug_retail_search_accent_color: retailSearch,
          slug_view_detail_button_color: viewDetailSaved,
          slug_sidebar_menu_button_color: sidebarSaved,
        })
        .eq('id', business.id);
      if (error) throw error;
      setBusiness((prev) =>
        prev
          ? {
              ...prev,
              slug_primary_color: primary,
              slug_secondary_color: secondary,
              slug_use_gradient: slugUseGradientInput,
              slug_retail_search_accent_color: retailSearch,
              slug_view_detail_button_color: viewDetailSaved,
              slug_sidebar_menu_button_color: sidebarSaved,
            }
          : prev
      );
      toast.success('Business page colors updated');
    } catch (err: any) {
      toast.error(err?.message || 'Failed to save page colors');
    } finally {
      setSavingPageColors(false);
    }
  };

  const handlePrimaryHueChange = (hue: number) => {
    const { s, l } = hexToHsl(sanitizeHexColor(slugPrimaryColorInput, DEFAULT_SLUG_PRIMARY));
    setSlugPrimaryHue(hue);
    setSlugPrimaryColorInput(hslToHex(hue, Math.max(45, s), Math.max(30, l)));
  };

  const handleSecondaryHueChange = (hue: number) => {
    const { s, l } = hexToHsl(sanitizeHexColor(slugSecondaryColorInput, DEFAULT_SLUG_SECONDARY));
    setSlugSecondaryHue(hue);
    setSlugSecondaryColorInput(hslToHex(hue, Math.max(45, s), Math.max(30, l)));
  };

  const resetPageColorsToDefault = () => {
    setSlugPrimaryColorInput(DEFAULT_SLUG_PRIMARY);
    setSlugSecondaryColorInput(DEFAULT_SLUG_SECONDARY);
    setSlugUseGradientInput(true);
    setRetailSearchAccentInput(DEFAULT_RETAIL_SEARCH_ACCENT);
    setViewDetailButtonColorInput('');
    setSidebarMenuButtonColorInput('');
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

  useEffect(() => {
    if (!business?.slug) return;
    // Preload once so the "My Posts" count is accurate even before expanding,
    // then refresh whenever the section is opened.
    if (!myPostsExpanded && businessPosts.length > 0) return;
    loadBusinessPosts();
  }, [business?.slug, currentUserId, myPostsExpanded, businessPosts.length]);

  // After successful promotion payment redirect from Stripe: show toast, open My Banners, and refetch after delay so webhook-updated status appears
  useEffect(() => {
    const success = searchParams?.get('success');
    if (success !== '1') return;
    toast.success('Payment successful. Your promotion is in review.');
    setPromotionBannersExpanded(true);
    router.replace('/business-dashboard', { scroll: false });
    // Webhook may not have run yet; refetch after a short delay so "In review" appears instead of "Payment pending"
    const t = setTimeout(() => loadPromotionRequests(), 2500);
    return () => clearTimeout(t);
  }, [searchParams, router]);

  const removeBanner = async (id: string) => {
    if (!business?.id) return;
    setRemovingBannerId(id);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`/api/promotion-request?source=business&id=${encodeURIComponent(id)}`, {
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
    setDeletingNotificationId(item.id);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch('/api/notifications/delete-broadcast', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
        },
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
      setNotificationToDelete(null);
      toast.success('Notification removed');
    } catch (err: any) {
      toast.error(err?.message || 'Failed to delete notification');
    } finally {
      setDeletingNotificationId(null);
    }
  };

  const confirmDeleteNotification = () => {
    if (notificationToDelete) deleteNotification(notificationToDelete);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-slate-50 dark:from-gray-900 dark:via-gray-900 dark:to-gray-900 px-4 pt-14 pb-12">
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
  const handleDownloadBusinessQr = async () => {
    if (!business?.slug) return;
    try {
      const targetUrl =
        typeof window !== 'undefined'
          ? `${window.location.origin}/business/${business.slug}?open_app=1`
          : `https://hanar.net/business/${business.slug}?open_app=1`;
      const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=1024x1024&data=${encodeURIComponent(targetUrl)}`;
      const res = await fetch(qrUrl);
      if (!res.ok) throw new Error('Failed to generate QR');
      const blob = await res.blob();
      const objectUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = objectUrl;
      a.download = `hanar-${business.slug}-qr.png`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(objectUrl);
      toast.success('QR downloaded');
    } catch {
      toast.error('Could not download QR right now');
    }
  };

  const burgerItems = [
    { label: 'Edit Business', href: `/businesses/edit/${business.slug}`, icon: <Edit className="h-5 w-5 shrink-0" />, color: 'bg-rose-50 dark:bg-rose-900/30' },
    { label: 'View full insights', href: '/business-dashboard/insights', icon: <BarChart3 className="h-5 w-5 shrink-0" />, color: 'bg-indigo-50 dark:bg-indigo-900/30' },
    { label: 'Promote your business', href: '/promote', icon: <Megaphone className="h-5 w-5 shrink-0" />, color: 'bg-orange-50 dark:bg-orange-900/30' },
    { label: 'Download Business QR', onClick: handleDownloadBusinessQr, icon: <Download className="h-5 w-5 shrink-0" />, color: 'bg-sky-50 dark:bg-sky-900/30' },
    { label: 'Send Notification', onClick: () => { setSendNotificationExpanded(true); setTimeout(() => document.getElementById('send-notification')?.scrollIntoView({ behavior: 'smooth' }), 100); }, icon: <Bell className="h-5 w-5 shrink-0" />, color: 'bg-emerald-50 dark:bg-emerald-900/30' },
    { label: 'Business page colors', onClick: () => setPageColorsOpen(true), icon: <Palette className="h-5 w-5 shrink-0" />, color: 'bg-cyan-50 dark:bg-cyan-900/30' },
    { label: 'My posts', onClick: () => { setMyPostsExpanded(true); setTimeout(() => document.getElementById('my-posts')?.scrollIntoView({ behavior: 'smooth' }), 100); }, icon: <FileText className="h-5 w-5 shrink-0" />, color: 'bg-blue-50 dark:bg-blue-900/30' },
    { label: 'My banners', onClick: () => { setPromotionBannersExpanded(true); setTimeout(() => document.getElementById('my-banners')?.scrollIntoView({ behavior: 'smooth' }), 100); }, icon: <Image className="h-5 w-5 shrink-0" />, color: 'bg-violet-50 dark:bg-violet-900/30' },
    { label: business.trial_end && business.plan === 'premium'
        ? `Premium Trial · ${getDaysRemaining(business.trial_end) > 0 ? `${getDaysRemaining(business.trial_end)} days left` : 'Ended'}`
        : business.plan_expires_at && !business.trial_end && business.plan && business.plan !== 'free'
        ? `${String(business.plan).toUpperCase()} Plan · Renews ${formatExpiryDate(business.plan_expires_at)}`
        : 'Manage Plan',
      href: appIOS ? withAppParam('/dashboard/account', true) : '/business/plan', icon: <Crown className="h-5 w-5 shrink-0" />, color: 'bg-amber-50 dark:bg-amber-900/30' },
    { label: 'Delete My Account', href: '/settings', icon: <Trash2 className="h-5 w-5 shrink-0" />, color: 'bg-red-50 dark:bg-red-900/30' },
  ];
  const pagePreviewBackground = buildBrandBackground(
    sanitizeHexColor(slugPrimaryColorInput, DEFAULT_SLUG_PRIMARY),
    sanitizeHexColor(slugSecondaryColorInput, DEFAULT_SLUG_SECONDARY),
    slugUseGradientInput
  );
  const retailSearchPreview = sanitizeHexColor(retailSearchAccentInput, DEFAULT_RETAIL_SEARCH_ACCENT);
  const viewDetailPreviewBackground = viewDetailButtonColorInput.trim()
    ? sanitizeHexColor(viewDetailButtonColorInput, DEFAULT_SLUG_PRIMARY)
    : pagePreviewBackground;
  const sidebarMenuPreviewBackground = sidebarMenuButtonColorInput.trim()
    ? sanitizeHexColor(sidebarMenuButtonColorInput, DEFAULT_SLUG_PRIMARY)
    : pagePreviewBackground;

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-slate-50 px-4 pt-14 pb-12">
      <DashboardBurgerMenu open={burgerMenuOpen} onOpen={() => setBurgerMenuOpen(true)} onClose={() => setBurgerMenuOpen(false)} items={burgerItems} />
      <div className="max-w-5xl mx-auto">
        <div className="rounded-3xl border-2 border-rose-300 bg-white shadow-lg shadow-slate-100/60">
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
                onClick={() => router.push(appIOS ? withAppParam('/dashboard/account', true) : '/business/plan')}
                className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-rose-600 px-5 py-2.5 text-sm font-semibold text-white shadow-md shadow-indigo-200 transition hover:from-indigo-500 hover:to-rose-500"
              >
                <Crown className="h-4 w-4" />
                Manage Plan
              </button>
            </div>
          </div>

          <div className="border-t border-slate-100 px-6 py-6">
            <div className="space-y-6">
                <div className="grid grid-cols-2 gap-3">
                {planSettings && (
                  <div id="send-notification" className={`rounded-2xl border border-slate-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-sm ${sendNotificationExpanded ? 'col-span-2' : ''}`}>
                    <button
                      type="button"
                      onClick={() => setSendNotificationExpanded((prev) => !prev)}
                      className="w-full flex items-center justify-between gap-2 p-3 text-left hover:bg-slate-50 dark:hover:bg-gray-700/50 rounded-2xl transition"
                    >
                      <div className="flex min-w-0 items-center gap-2">
                        <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
                          <Bell className="h-4 w-4" />
                        </span>
                        <div className="min-w-0">
                          <h2 className="text-xs font-bold leading-tight text-slate-900 dark:text-gray-100">Send Notification</h2>
                        </div>
                      </div>
                      <span className="flex shrink-0 items-center gap-1.5">
                        <span className="hidden text-[10px] font-semibold uppercase tracking-wide text-emerald-600 dark:text-emerald-400 sm:inline">
                          {planSettings.plan?.toString().toUpperCase() || 'PLAN'}
                        </span>
                        {sendNotificationExpanded ? (
                          <ChevronUp className="h-4 w-4 text-slate-500" />
                        ) : (
                          <ChevronDown className="h-4 w-4 text-slate-500" />
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
                      <label className={`flex items-center gap-2 rounded-xl border border-rose-200 dark:border-gray-600 bg-rose-50 dark:bg-gray-700 px-3 py-2 text-sm text-rose-700 dark:text-gray-100 shadow-sm ${!isAreaBlastAvailable ? 'opacity-50' : ''}`}>
                        <input
                          type="radio"
                          name="notificationMode"
                          value="area_blast"
                          checked={notificationMode === 'area_blast'}
                          onChange={() => setNotificationMode('area_blast')}
                          disabled={!isAreaBlastAvailable}
                          className="accent-rose-600"
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

                <div className={`relative rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800 ${myPostsExpanded ? 'col-span-2' : ''}`}>
                  <span className="absolute right-2 top-2 z-10 inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-semibold leading-none text-white">
                    {businessPosts.length > 99 ? '99+' : businessPosts.length}
                  </span>
                  <button
                    type="button"
                    onClick={() => setMyPostsExpanded((prev) => !prev)}
                    className="w-full flex items-center justify-between gap-2 p-3 text-left hover:bg-slate-50 dark:hover:bg-gray-700/50 rounded-2xl transition"
                  >
                    <div className="flex min-w-0 items-center gap-2">
                      <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">
                        <FileText className="h-4 w-4" />
                      </span>
                      <h2 id="my-posts" className="text-xs font-bold leading-tight text-slate-900 dark:text-gray-100">My Posts</h2>
                    </div>
                    <span className="flex shrink-0 items-center gap-1.5">
                      {myPostsExpanded ? (
                        <ChevronUp className="h-4 w-4 text-slate-500" />
                      ) : (
                        <ChevronDown className="h-4 w-4 text-slate-500" />
                      )}
                    </span>
                  </button>
                  {myPostsExpanded && (
                    <div className="px-5 pb-5 pt-0">
                      {businessPostsLoading ? (
                        <div className="text-slate-500 dark:text-gray-400">Loading posts...</div>
                      ) : businessPosts.length === 0 ? (
                        <div className="rounded-2xl border border-dashed border-slate-300 dark:border-gray-600 p-6 text-center text-slate-500 dark:text-gray-400">
                          No posts yet.
                        </div>
                      ) : (
                        <div className="mt-3 space-y-3">
                          {businessPosts.map((post) => (
                            <div
                              key={post.id}
                              className="rounded-2xl border border-slate-200 dark:border-gray-600 bg-white dark:bg-gray-800 p-4 shadow-sm"
                            >
                              <div className="flex flex-wrap items-start justify-between gap-3">
                                <div className="min-w-0 flex-1">
                                  <p className="text-sm font-semibold text-slate-900 dark:text-gray-100 line-clamp-2">
                                    {post.title || 'Untitled post'}
                                  </p>
                                  <p className="mt-1 text-sm text-slate-600 dark:text-gray-300 line-clamp-3">
                                    {post.body || 'No post body'}
                                  </p>
                                  {post.video ? (
                                    <div className="mt-3 overflow-hidden rounded-xl border border-slate-200 dark:border-gray-600 bg-black">
                                      <video
                                        src={post.video}
                                        controls
                                        preload="metadata"
                                        className="h-auto max-h-64 w-full"
                                      />
                                    </div>
                                  ) : post.image ? (
                                    <div className="mt-3 overflow-hidden rounded-xl border border-slate-200 dark:border-gray-600 bg-slate-100 dark:bg-gray-700">
                                      <img
                                        src={post.image}
                                        alt={post.title || 'Post image'}
                                        className="h-auto max-h-64 w-full object-cover"
                                      />
                                    </div>
                                  ) : null}
                                  <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-gray-400">
                                    <span>{new Date(post.created_at).toLocaleString()}</span>
                                    <span>Likes: {post.likes_post ?? 0}</span>
                                    <span>Comments: {businessPostCommentCounts[post.id] ?? 0}</span>
                                  </div>
                                </div>
                                <div className="flex items-center gap-2">
                                  <Link
                                    href={`/community/post/${post.id}`}
                                    className="rounded-full border border-slate-200 dark:border-gray-600 bg-slate-50 dark:bg-gray-700 px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-gray-200 hover:bg-slate-100 dark:hover:bg-gray-600"
                                  >
                                    View
                                  </Link>
                                  <button
                                    type="button"
                                    onClick={() => deleteBusinessPost(post.id)}
                                    disabled={deletingBusinessPostId === post.id}
                                    className="rounded-full border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-600 hover:bg-rose-100 dark:border-rose-800 dark:bg-rose-900/30 dark:text-rose-200 dark:hover:bg-rose-900/50 disabled:opacity-50"
                                  >
                                    {deletingBusinessPostId === post.id ? 'Deleting...' : 'Delete'}
                                  </button>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div className={`relative rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800 ${previousNotificationsExpanded ? 'col-span-2' : ''}`}>
                  <span className="absolute right-2 top-2 z-10 inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-semibold leading-none text-white">
                    {notificationHistory.length > 99 ? '99+' : notificationHistory.length}
                  </span>
                  <button
                    type="button"
                    onClick={() => setPreviousNotificationsExpanded((prev) => !prev)}
                    className="w-full flex items-center justify-between gap-2 p-3 text-left hover:bg-slate-50 dark:hover:bg-gray-700/50 rounded-2xl transition"
                  >
                    <div className="flex min-w-0 items-center gap-2">
                      <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
                        <Bell className="h-4 w-4" />
                      </span>
                      <h2 className="text-xs font-bold leading-tight text-slate-900 dark:text-gray-100">Previous Notifications</h2>
                    </div>
                    <span className="flex shrink-0 items-center gap-1.5">
                      {previousNotificationsExpanded ? (
                        <ChevronUp className="h-4 w-4 text-slate-500" />
                      ) : (
                        <ChevronDown className="h-4 w-4 text-slate-500" />
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
                                ? { label: 'Approved', color: 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-200' }
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
                                      onClick={() => setNotificationToDelete(item)}
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

                <div className={`relative rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800 ${promotionBannersExpanded ? 'col-span-2' : ''}`}>
                  <span className="absolute right-2 top-2 z-10 inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-semibold leading-none text-white">
                    {promotionRequests.length > 99 ? '99+' : promotionRequests.length}
                  </span>
                  <button
                    type="button"
                    onClick={() => setPromotionBannersExpanded((prev) => !prev)}
                    className="w-full flex items-center justify-between gap-2 p-3 text-left hover:bg-slate-50 dark:hover:bg-gray-700/50 rounded-2xl transition"
                  >
                    <div className="flex min-w-0 items-center gap-2">
                      <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300">
                        <Image className="h-4 w-4" />
                      </span>
                      <h2 id="my-banners" className="text-xs font-bold leading-tight text-slate-900 dark:text-gray-100">My Banners</h2>
                    </div>
                    <span className="flex shrink-0 items-center gap-1.5">
                      {promotionBannersExpanded ? (
                        <ChevronUp className="h-4 w-4 text-slate-500" />
                      ) : (
                        <ChevronDown className="h-4 w-4 text-slate-500" />
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
                          <Link href="/promote" className="text-indigo-600 dark:text-indigo-400 font-medium hover:underline">
                            Promote your business
                          </Link>
                        </div>
                      ) : (
                        <div className="mt-3 space-y-3">
                          {promotionRequests.map((item) => {
                            const statusConfig =
                              item.status === 'pending_payment'
                                ? { label: 'Payment pending', color: 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-200' }
                                : item.status === 'pending_review'
                                ? { label: 'In review', color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-200' }
                                : item.status === 'active'
                                ? { label: 'Active', color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-200' }
                                : item.status === 'approved'
                                ? { label: 'Approved', color: 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-200' }
                                : item.status === 'rejected'
                                ? { label: 'Rejected', color: 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-200' }
                                : item.status === 'expired'
                                ? { label: 'Expired', color: 'bg-slate-100 text-slate-600 dark:bg-gray-700 dark:text-gray-300' }
                                : { label: 'In review', color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-200' };
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
                </div>

                {notificationToDelete && typeof document !== 'undefined' && createPortal(
                  <div
                    className="fixed inset-0 z-[9999] flex items-center justify-center overflow-y-auto bg-black/50 p-4 backdrop-blur-sm"
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="confirm-unsend-title"
                    onClick={() => setNotificationToDelete(null)}
                  >
                    <div
                      className="my-8 w-full max-w-sm shrink-0 rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-gray-600 dark:bg-gray-800"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-rose-100 dark:bg-rose-900/40">
                          <Trash2 className="h-5 w-5 text-rose-600 dark:text-rose-300" />
                        </div>
                        <h3 id="confirm-unsend-title" className="text-lg font-semibold text-slate-900 dark:text-gray-100">
                          Unsend this notification?
                        </h3>
                      </div>
                      <p className="mt-3 text-sm text-slate-600 dark:text-gray-300">
                        This will remove it for recipients. This action cannot be undone.
                      </p>
                      <div className="mt-6 flex justify-end gap-3">
                        <button
                          type="button"
                          onClick={() => setNotificationToDelete(null)}
                          disabled={!!deletingNotificationId}
                          className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          onClick={confirmDeleteNotification}
                          disabled={!!deletingNotificationId}
                          className="rounded-xl bg-rose-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-rose-500 disabled:opacity-50"
                        >
                          {deletingNotificationId ? 'Removing…' : 'Unsend'}
                        </button>
                      </div>
                    </div>
                  </div>,
                  document.body
                )}

                {bannerToRemoveId && typeof document !== 'undefined' && createPortal(
                  <div
                    className="fixed inset-0 z-[9999] flex items-center justify-center overflow-y-auto bg-black/50 p-4 backdrop-blur-sm"
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="confirm-remove-title"
                    onClick={() => setBannerToRemoveId(null)}
                  >
                    <div
                      className="my-8 w-full max-w-sm shrink-0 rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-gray-600 dark:bg-gray-800"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/40">
                          <Megaphone className="h-5 w-5 text-amber-600 dark:text-amber-300" />
                        </div>
                        <h3 id="confirm-remove-title" className="text-lg font-semibold text-slate-900 dark:text-gray-100">
                          End campaign?
                        </h3>
                      </div>
                      <p className="mt-3 text-sm text-slate-600 dark:text-gray-300">
                        Are you sure you want to end this campaign? This will remove the banner from your list and stop it from showing.
                      </p>
                      <div className="mt-6 flex justify-end gap-3">
                        <button
                          type="button"
                          onClick={() => setBannerToRemoveId(null)}
                          disabled={!!removingBannerId}
                          className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          onClick={() => bannerToRemoveId && removeBanner(bannerToRemoveId)}
                          disabled={!!removingBannerId}
                          className="rounded-xl bg-rose-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-rose-500 disabled:opacity-50"
                        >
                          {removingBannerId === bannerToRemoveId ? 'Ending…' : 'End campaign'}
                        </button>
                      </div>
                    </div>
                  </div>,
                  document.body
                )}

                {insightsOpen && typeof document !== 'undefined' && createPortal(
                  <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true" aria-labelledby="insights-title" onClick={() => setInsightsOpen(false)}>
                    <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl dark:border-gray-600 dark:bg-gray-800 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
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
                                href={appIOS ? withAppParam('/dashboard/account', true) : '/business/plan'}
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
                  </div>,
                  document.body
                )}

                {pageColorsOpen && typeof document !== 'undefined' && createPortal(
                  <div
                    className="fixed inset-0 z-[9999] flex items-center justify-center overflow-y-auto bg-black/50 p-4 backdrop-blur-sm"
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="business-page-colors-title"
                    onClick={() => setPageColorsOpen(false)}
                  >
                    <div
                      className="my-8 w-full max-w-2xl shrink-0 rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl dark:border-gray-600 dark:bg-gray-800"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <h3 id="business-page-colors-title" className="text-lg font-semibold text-slate-900 dark:text-gray-100">Business Page Colors</h3>
                          <p className="mt-1 text-sm text-slate-600 dark:text-gray-300">
                            Set your brand colors below, then optionally override the retail header/search strip, “View details” buttons, and burger menu actions.
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => setPageColorsOpen(false)}
                          className="rounded-full p-1 text-slate-500 transition hover:bg-slate-100 hover:text-slate-700 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-gray-200"
                          aria-label="Close page colors"
                        >
                          <X className="h-5 w-5" />
                        </button>
                      </div>

                      <div className="mt-4 grid gap-4 sm:grid-cols-2">
                        <label className="block">
                          <span className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-gray-400">Primary color</span>
                          <div className="mt-1.5 flex items-center gap-2">
                            <input
                              type="color"
                              value={sanitizeHexColor(slugPrimaryColorInput, DEFAULT_SLUG_PRIMARY)}
                              onChange={(e) => setSlugPrimaryColorInput(e.target.value)}
                              className="h-10 w-14 cursor-pointer rounded border border-slate-300 bg-white p-1"
                            />
                            <input
                              type="text"
                              value={slugPrimaryColorInput}
                              onChange={(e) => setSlugPrimaryColorInput(e.target.value)}
                              className="h-10 flex-1 rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-700 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-200 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
                              placeholder={DEFAULT_SLUG_PRIMARY}
                            />
                          </div>
                          <div className="mt-2">
                            <input
                              type="range"
                              min={0}
                              max={360}
                              value={slugPrimaryHue}
                              onChange={(e) => handlePrimaryHueChange(Number(e.target.value))}
                              className="color-spectrum h-3 w-full appearance-none rounded-full"
                              style={{ background: 'linear-gradient(to right, #ff0000, #ffff00, #00ff00, #00ffff, #0000ff, #ff00ff, #ff0000)' }}
                              aria-label="Primary color spectrum"
                            />
                          </div>
                        </label>

                        <label className="block">
                          <span className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-gray-400">Secondary color</span>
                          <div className="mt-1.5 flex items-center gap-2">
                            <input
                              type="color"
                              value={sanitizeHexColor(slugSecondaryColorInput, DEFAULT_SLUG_SECONDARY)}
                              onChange={(e) => setSlugSecondaryColorInput(e.target.value)}
                              className="h-10 w-14 cursor-pointer rounded border border-slate-300 bg-white p-1"
                            />
                            <input
                              type="text"
                              value={slugSecondaryColorInput}
                              onChange={(e) => setSlugSecondaryColorInput(e.target.value)}
                              className="h-10 flex-1 rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-700 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-200 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
                              placeholder={DEFAULT_SLUG_SECONDARY}
                            />
                          </div>
                          <div className="mt-2">
                            <input
                              type="range"
                              min={0}
                              max={360}
                              value={slugSecondaryHue}
                              onChange={(e) => handleSecondaryHueChange(Number(e.target.value))}
                              className="color-spectrum h-3 w-full appearance-none rounded-full"
                              style={{ background: 'linear-gradient(to right, #ff0000, #ffff00, #00ff00, #00ffff, #0000ff, #ff00ff, #ff0000)' }}
                              aria-label="Secondary color spectrum"
                            />
                          </div>
                        </label>
                      </div>

                      <label className="mt-4 inline-flex items-center gap-2 text-sm text-slate-700 dark:text-gray-200">
                        <input
                          type="checkbox"
                          checked={slugUseGradientInput}
                          onChange={(e) => setSlugUseGradientInput(e.target.checked)}
                          className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                        />
                        Use gradient blend between primary and secondary colors
                      </label>

                      <div className="mt-6 space-y-4 border-t border-slate-200 pt-4 dark:border-gray-600">
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-gray-400">Retail header & search</p>
                          <p className="mt-1 text-sm text-slate-600 dark:text-gray-300">
                            Applies to both retail layouts: Basel-style strip and the Bagisto shop (header search, hero accents, directions, load-more spinner, category highlights).
                          </p>
                        </div>
                        <label className="block">
                          <span className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-gray-400">Header & search accent</span>
                          <div className="mt-1.5 flex items-center gap-2">
                            <input
                              type="color"
                              value={retailSearchPreview}
                              onChange={(e) => setRetailSearchAccentInput(e.target.value)}
                              className="h-10 w-14 cursor-pointer rounded border border-slate-300 bg-white p-1"
                            />
                            <input
                              type="text"
                              value={retailSearchAccentInput}
                              onChange={(e) => setRetailSearchAccentInput(e.target.value)}
                              className="h-10 flex-1 rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-700 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-200 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
                              placeholder={DEFAULT_RETAIL_SEARCH_ACCENT}
                            />
                          </div>
                        </label>

                        <div>
                          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-gray-400">Button overrides</p>
                          <p className="mt-1 text-sm text-slate-600 dark:text-gray-300">
                            Leave blank to use the brand colors above. Set a solid color only for “View details” (and similar) or burger menu actions when you want them different from the header strip.
                          </p>
                        </div>
                        <div className="grid gap-4 sm:grid-cols-2">
                          <label className="block">
                            <span className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-gray-400">View details &amp; CTAs</span>
                            <div className="mt-1.5 flex items-center gap-2">
                              <input
                                type="color"
                                value={sanitizeHexColor(
                                  viewDetailButtonColorInput || slugPrimaryColorInput,
                                  DEFAULT_SLUG_PRIMARY
                                )}
                                onChange={(e) => setViewDetailButtonColorInput(e.target.value)}
                                className="h-10 w-14 cursor-pointer rounded border border-slate-300 bg-white p-1"
                              />
                              <input
                                type="text"
                                value={viewDetailButtonColorInput}
                                onChange={(e) => setViewDetailButtonColorInput(e.target.value)}
                                className="h-10 flex-1 rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-700 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-200 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
                                placeholder="Default (brand colors)"
                              />
                            </div>
                          </label>
                          <label className="block">
                            <span className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-gray-400">Burger menu actions</span>
                            <div className="mt-1.5 flex items-center gap-2">
                              <input
                                type="color"
                                value={sanitizeHexColor(
                                  sidebarMenuButtonColorInput || slugPrimaryColorInput,
                                  DEFAULT_SLUG_PRIMARY
                                )}
                                onChange={(e) => setSidebarMenuButtonColorInput(e.target.value)}
                                className="h-10 w-14 cursor-pointer rounded border border-slate-300 bg-white p-1"
                              />
                              <input
                                type="text"
                                value={sidebarMenuButtonColorInput}
                                onChange={(e) => setSidebarMenuButtonColorInput(e.target.value)}
                                className="h-10 flex-1 rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-700 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-200 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
                                placeholder="Default (brand colors)"
                              />
                            </div>
                          </label>
                        </div>
                      </div>

                      <div className="mt-5 rounded-xl border border-slate-200 dark:border-gray-600 overflow-hidden">
                        <div className="px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-gray-400 bg-slate-50 dark:bg-gray-700/60">
                          Preview
                        </div>
                        <div className="bg-white dark:bg-gray-900 p-3 space-y-3">
                          <div
                            className="rounded-lg px-3 py-2 text-white text-sm font-semibold"
                            style={{ background: pagePreviewBackground }}
                          >
                            Brand header / strips (primary &amp; secondary)
                          </div>
                          <div
                            className="rounded-lg px-3 py-2 text-white text-sm font-semibold"
                            style={{ backgroundColor: retailSearchPreview }}
                          >
                            Retail header &amp; search accent (Basel-style)
                          </div>
                          <div
                            className="flex items-center gap-2 rounded border bg-white px-2 py-1.5 dark:bg-gray-800"
                            style={{ borderColor: retailSearchPreview }}
                          >
                            <span className="min-w-0 flex-1 truncate text-xs text-zinc-500 dark:text-zinc-400">Search products…</span>
                            <span
                              className="shrink-0 rounded px-2 py-1 text-[10px] font-semibold text-white"
                              style={{ backgroundColor: retailSearchPreview }}
                            >
                              Search
                            </span>
                          </div>
                          <div
                            className="rounded-lg px-3 py-2 text-white text-sm font-semibold"
                            style={{ background: pagePreviewBackground }}
                          >
                            Contact / info strip preview
                          </div>
                          <div className="flex flex-wrap items-center gap-2">
                            <div
                              className="inline-flex h-9 min-w-[2.25rem] items-center justify-center rounded-full px-2.5 text-[10px] font-semibold text-white shadow-sm"
                              style={{ background: pagePreviewBackground }}
                              title="Share button (restaurant Connect row)"
                            >
                              Share
                            </div>
                          </div>
                          <div className="flex flex-wrap items-center gap-2">
                            <button
                              type="button"
                              className="rounded-md px-3 py-1.5 text-xs font-semibold text-white"
                              style={{ background: viewDetailPreviewBackground }}
                            >
                              View details
                            </button>
                            <span
                              className="rounded-md px-3 py-1.5 text-xs font-semibold text-white"
                              style={{ background: sidebarMenuPreviewBackground }}
                            >
                              Burger menu action
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="mt-4 flex flex-wrap items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={resetPageColorsToDefault}
                          disabled={savingPageColors}
                          className="inline-flex items-center rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:opacity-60 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600"
                        >
                          Default
                        </button>
                        <button
                          type="button"
                          onClick={savePageColors}
                          disabled={savingPageColors}
                          className="inline-flex items-center rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-500 disabled:opacity-60"
                        >
                          {savingPageColors ? 'Saving...' : 'Apply to business page'}
                        </button>
                      </div>
                      <style jsx>{`
                        .color-spectrum::-webkit-slider-thumb {
                          -webkit-appearance: none;
                          appearance: none;
                          width: 18px;
                          height: 18px;
                          border-radius: 9999px;
                          background: #ffffff;
                          border: 2px solid rgba(15, 23, 42, 0.45);
                          box-shadow: 0 1px 2px rgba(0, 0, 0, 0.25);
                          cursor: pointer;
                        }
                        .color-spectrum::-moz-range-thumb {
                          width: 18px;
                          height: 18px;
                          border-radius: 9999px;
                          background: #ffffff;
                          border: 2px solid rgba(15, 23, 42, 0.45);
                          box-shadow: 0 1px 2px rgba(0, 0, 0, 0.25);
                          cursor: pointer;
                        }
                      `}</style>
                    </div>
                  </div>,
                  document.body
                )}

                {uiStatus !== 'approved' && (
                  <div className="rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-900">
                    Your business is currently pending approval. You can still view and edit your business profile and online
                    shop, but it will not be visible to other users until it has been approved.
                  </div>
                )}
              </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function BusinessDashboardPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">Loading...</div>}>
      <BusinessDashboardContent />
    </Suspense>
  );
}
