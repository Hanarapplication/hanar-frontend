'use client';

import Link from 'next/link';
import { createPortal } from 'react-dom';
import { Suspense, useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import toast from 'react-hot-toast';
import { supabase } from '@/lib/supabaseClient';
import { User, Building2, ShoppingBag, PenSquare, Camera, Tag, Ban, CircleHelp, Phone, Settings, LogOut, Languages } from 'lucide-react';
import { getNativeLanguageName, supportedLanguages } from '@/utils/languages';
import { Avatar } from '@/components/Avatar';
import { withAvatarCacheBust } from '@/lib/avatarUrl';
import DashboardFavoritesSection from '@/components/DashboardFavoritesSection';
import { SHOW_MARKETPLACE_LISTING_PACKAGING } from '@/lib/dashboardFeatureFlags';
import { useLanguage } from '@/context/LanguageContext';
import { t } from '@/utils/translations';

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

type MyListing = {
  id: string;
  title: string;
  price: string | number;
  location: string;
  imageUrls: string[];
  created_at: string | null;
};

type FollowedOrg = {
  user_id: string;
  full_name: string | null;
  username: string | null;
  logo_url?: string | null;
};

const resolveMarketplaceImageUrls = (raw: unknown): string[] => {
  let arr: string[] = [];
  if (Array.isArray(raw)) arr = raw;
  else if (typeof raw === 'string') { try { const p = JSON.parse(raw); arr = Array.isArray(p) ? p : []; } catch {} }
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  return arr.map((u) => (u && String(u).startsWith('http') ? u : `${base}/storage/v1/object/public/marketplace-images/${u || ''}`)).filter(Boolean);
};

const FREE_LISTING_DAYS = 30;

/** Returns human-readable expiry for a listing (free tier: 30 days from created_at). */
function getListingExpiryDays(createdAt: string | null): number | null {
  if (!createdAt) return null;
  const created = new Date(createdAt);
  if (Number.isNaN(created.getTime())) return null;
  const expiry = new Date(created);
  expiry.setDate(expiry.getDate() + FREE_LISTING_DAYS);
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  expiry.setHours(0, 0, 0, 0);
  const diffMs = expiry.getTime() - now.getTime();
  return Math.ceil(diffMs / (24 * 60 * 60 * 1000));
}

function DashboardContent() {
  const { effectiveLang, lang, setLang } = useLanguage();
  const [favorites, setFavorites] = useState<FavoriteBusiness[]>([]);
  const [favoriteItems, setFavoriteItems] = useState<FavoriteItem[]>([]);
  const [followedOrgs, setFollowedOrgs] = useState<FollowedOrg[]>([]);
  const [profile, setProfile] = useState<{ username: string | null; displayName: string | null; profile_pic_url: string | null } | null>(null);
  const [loading, setLoading] = useState(true);
  const [followedOrgsLoading, setFollowedOrgsLoading] = useState(true);
  const [profilePicUploading, setProfilePicUploading] = useState(false);
  const [profilePicPreview, setProfilePicPreview] = useState<string | null>(null);
  const [myListings, setMyListings] = useState<MyListing[]>([]);
  const [myListingLoading, setMyListingLoading] = useState(true);
  const [deletingListing, setDeletingListing] = useState<string | null>(null);
  const [listingLimits, setListingLimits] = useState<{
    activeCount: number;
    maxAllowed: number;
    hasPack: boolean;
    packExpiresAt: string | null;
    canAddMore: boolean;
    isBusiness: boolean;
  } | null>(null);
  const [listingLimitsLoading, setListingLimitsLoading] = useState(true);
  const [packModalOpen, setPackModalOpen] = useState(false);
  const [packPurchasing, setPackPurchasing] = useState(false);
  const [businessPlans, setBusinessPlans] = useState<{
    plan: string;
    name: string;
    price_yearly: string;
    limits: { label: string; value: string | number }[];
    features: { label: string; enabled: boolean }[];
  }[]>([]);
  const [businessPlansLoading, setBusinessPlansLoading] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [profileEditOpen, setProfileEditOpen] = useState(false);
  const [editUsername, setEditUsername] = useState('');
  const [editDisplayName, setEditDisplayName] = useState('');
  const [profileSaving, setProfileSaving] = useState(false);
  const [usernameStatus, setUsernameStatus] = useState<'idle' | 'checking' | 'available' | 'taken' | 'invalid'>('idle');
  const [displayNameStatus, setDisplayNameStatus] = useState<'idle' | 'checking' | 'available' | 'taken' | 'invalid'>('idle');
  const usernameCheckRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const displayNameCheckRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (!SHOW_MARKETPLACE_LISTING_PACKAGING) return;
    if (searchParams?.get('success') === '1') {
      toast.success(t(effectiveLang, 'Casual Seller Pack active. You can list up to 5 items.'));
      router.replace('/dashboard');
    }
  }, [searchParams, router, effectiveLang]);

  const handleHeaderLogout = async () => {
    await supabase.auth.signOut();
    if (typeof window !== 'undefined') {
      localStorage.removeItem('userType');
    }
    router.push('/login');
  };

  useEffect(() => {
    const load = async () => {
      try {
        // Use getSession() so we don't redirect while session is still restoring (getUser() can briefly return null)
        let { data: { session } } = await supabase.auth.getSession();
        let user = session?.user;
        if (!user) {
          // Brief wait for session restore from storage before sending users to login
          await new Promise((r) => setTimeout(r, 100));
          const retry = await supabase.auth.getSession();
          session = retry.data.session;
          user = session?.user;
        }
        if (!user) {
          router.replace('/login');
          return;
        }

        const { data: regProfile, error: profileError } = await supabase
          .from('registeredaccounts')
          .select('business, organization, username, full_name')
          .eq('user_id', user.id)
          .maybeSingle();
        if (profileError) throw profileError;

        if (regProfile?.business === true) {
          router.replace('/business-dashboard');
          return;
        }
        if (regProfile?.organization === true) {
          router.replace('/organization/dashboard');
          return;
        }

        setCurrentUserId(user.id);

        const [
          { data: favoriteRows, error: favoritesError },
          { data: profData },
          { data: favRows },
        ] = await Promise.all([
          supabase.from('business_favorites').select('business_id').eq('user_id', user.id),
          supabase.from('profiles').select('username, profile_pic_url').eq('id', user.id).maybeSingle(),
          supabase
            .from('user_marketplace_favorites')
            .select('item_key, item_snapshot')
            .eq('user_id', user.id)
            .order('created_at', { ascending: true }),
        ]);

        if (favoritesError) throw favoritesError;
        const uname = profData?.username ?? regProfile?.username ?? null;
        const displayName = regProfile?.full_name?.trim() || null;
        setProfile(profData || regProfile ? { username: uname, displayName, profile_pic_url: profData?.profile_pic_url ?? null } : null);

        const businessIds = (favoriteRows || []).map((row: { business_id: string }) => row.business_id);

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
        setLoading(false);

        if (businessIds.length === 0) {
          setFavorites([]);
        } else {
          supabase
            .from('businesses')
            .select('id, business_name, slug, category, subcategory, logo_url, address')
            .in('id', businessIds)
            .then(({ data, error }) => {
              if (!error && data) setFavorites(data as FavoriteBusiness[]);
              else setFavorites([]);
            });
        }
      } catch (err: any) {
        toast.error(err?.message || 'Failed to load dashboard');
        setLoading(false);
      }
    };

    load();
  }, [router]);

  useEffect(() => {
    if (!currentUserId) return;
    let cancelled = false;
    (async () => {
      try {
        const { data: followRows, error: followError } = await supabase
          .from('follows')
          .select('following_id')
          .eq('follower_id', currentUserId);
        if (cancelled) return;
        if (followError) throw followError;
        const orgOwnerIds = (followRows || []).map((row: { following_id: string }) => row.following_id);
        if (orgOwnerIds.length === 0) {
          setFollowedOrgs([]);
        } else {
          const { data: orgData, error: orgError } = await supabase
            .from('organizations')
            .select('user_id, full_name, username, logo_url')
            .in('user_id', orgOwnerIds);
          if (cancelled) return;
          if (orgError) throw orgError;
          setFollowedOrgs((orgData as FollowedOrg[]) || []);
        }
      } catch {
        if (!cancelled) setFollowedOrgs([]);
      } finally {
        if (!cancelled) setFollowedOrgsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [currentUserId]);

  useEffect(() => {
    if (!currentUserId) return;
    let cancelled = false;
    setMyListingLoading(true);
    (async () => {
      try {
        const { data, error } = await supabase
          .from('marketplace_items')
          .select('id, title, price, location, image_urls, created_at')
          .eq('user_id', currentUserId)
          .is('archived_at', null)
          .order('created_at', { ascending: false })
          .limit(5);
        if (cancelled) return;
        if (error) {
          setMyListings([]);
          return;
        }
        const items = (data || []) as { id: string; title: string; price: string | number; location: string; image_urls?: unknown; created_at: string | null }[];
        setMyListings(
          items.map((row) => ({
            id: row.id,
            title: row.title || 'Item',
            price: row.price ?? '',
            location: row.location || '',
            imageUrls: resolveMarketplaceImageUrls(row.image_urls),
            created_at: row.created_at,
          }))
        );
      } catch {
        if (!cancelled) setMyListings([]);
      } finally {
        if (!cancelled) setMyListingLoading(false);
      }
    })();

    setListingLimitsLoading(true);
    supabase.auth.getSession().then(({ data: { session } }) => {
      const headers: Record<string, string> = {};
      if (session?.access_token) headers.Authorization = `Bearer ${session.access_token}`;
      return fetch('/api/marketplace/listing-limits', { headers });
    }).then((res) => res.json().catch(() => ({}))).then((data) => {
      if (cancelled) return;
      if (data && !data.error) {
        setListingLimits({
          activeCount: data.activeCount ?? 0,
          maxAllowed: data.maxAllowed ?? 1,
          hasPack: !!data.hasPack,
          packExpiresAt: data.packExpiresAt ?? null,
          canAddMore: !!data.canAddMore,
          isBusiness: !!data.isBusiness,
        });
      } else {
        setListingLimits(null);
      }
    }).finally(() => {
      if (!cancelled) setListingLimitsLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [currentUserId]);

  const removeFavoriteItem = async (itemKey: string) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { error } = await supabase
      .from('user_marketplace_favorites')
      .delete()
      .eq('user_id', user.id)
      .eq('item_key', itemKey);
    if (error) {
      toast.error(t(effectiveLang, 'Failed to remove'));
      return;
    }
    setFavoriteItems((prev) => prev.filter((fav) => fav.key !== itemKey));
    toast.success(t(effectiveLang, 'Removed'));
  };

  const deleteMyListing = async (itemId: string) => {
    if (deletingListing) return;
    if (!confirm(t(effectiveLang, 'Delete this listing? You can add a new item once this is removed.'))) return;
    setDeletingListing(itemId);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (session?.access_token) headers.Authorization = `Bearer ${session.access_token}`;
      const res = await fetch('/api/marketplace/delete-item', {
        method: 'POST',
        headers,
        body: JSON.stringify({ itemId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || t(effectiveLang, 'Failed to delete'));
      setMyListings((prev) => prev.filter((l) => l.id !== itemId));
      setListingLimits((prev) => prev ? { ...prev, activeCount: Math.max(0, (prev.activeCount ?? 1) - 1), canAddMore: true } : null);
      toast.success(t(effectiveLang, 'Listing deleted. You can add a new item.'));
    } catch (err: any) {
      toast.error(err?.message || t(effectiveLang, 'Failed to delete'));
    } finally {
      setDeletingListing(null);
    }
  };

  useEffect(() => {
    if (!packModalOpen) return;
    if (businessPlans.length > 0) return;
    setBusinessPlansLoading(true);
    fetch('/api/business/plans-public')
      .then((res) => res.json().catch(() => ({})))
      .then((data) => {
        if (data.plans && Array.isArray(data.plans)) setBusinessPlans(data.plans);
        else setBusinessPlans([]);
      })
      .finally(() => setBusinessPlansLoading(false));
  }, [packModalOpen]);

  const purchasePack = async () => {
    if (packPurchasing) return;
    setPackPurchasing(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (session?.access_token) headers.Authorization = `Bearer ${session.access_token}`;
      const res = await fetch('/api/stripe/create-checkout-session', {
        method: 'POST',
        headers,
        body: JSON.stringify({ type: 'casual_pack' }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || t(effectiveLang, 'Failed to start checkout'));
      if (data?.url) {
        window.location.href = data.url;
      } else {
        throw new Error('No checkout URL returned');
      }
    } catch (err: any) {
      toast.error(err?.message || t(effectiveLang, 'Failed to start checkout'));
      setPackPurchasing(false);
    }
  };

  useEffect(() => {
    if (profileEditOpen && profile) {
      setEditUsername(profile.username || '');
      setEditDisplayName(profile.displayName || '');
      setUsernameStatus('idle');
      setDisplayNameStatus('idle');
    }
  }, [profileEditOpen, profile?.username, profile?.displayName]);

  useEffect(() => {
    if (!profileEditOpen) return;
    const raw = editUsername.trim().toLowerCase().replace(/^@/, '');
    if (raw.length < 3) {
      setUsernameStatus(raw.length === 0 ? 'idle' : 'invalid');
      return;
    }
    if (!/^[a-z0-9_.]+$/.test(raw)) {
      setUsernameStatus('invalid');
      return;
    }
    if (raw === (profile?.username || '').toLowerCase()) {
      setUsernameStatus('idle');
      return;
    }
    if (usernameCheckRef.current) clearTimeout(usernameCheckRef.current);
    setUsernameStatus('checking');
    usernameCheckRef.current = setTimeout(async () => {
      try {
        const res = await fetch('/api/account/check-username', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username: raw, excludeUserId: currentUserId }),
        });
        const data = await res.json();
        setUsernameStatus(data.available ? 'available' : 'taken');
      } catch {
        setUsernameStatus('idle');
      }
      usernameCheckRef.current = null;
    }, 400);
    return () => {
      if (usernameCheckRef.current) clearTimeout(usernameCheckRef.current);
    };
  }, [editUsername, profileEditOpen, profile?.username, currentUserId]);

  useEffect(() => {
    if (!profileEditOpen) return;
    const raw = editDisplayName.trim();
    if (raw.length === 0) {
      setDisplayNameStatus('idle');
      return;
    }
    if (raw === (profile?.displayName || '')) {
      setDisplayNameStatus('idle');
      return;
    }
    if (displayNameCheckRef.current) clearTimeout(displayNameCheckRef.current);
    setDisplayNameStatus('checking');
    displayNameCheckRef.current = setTimeout(async () => {
      try {
        const res = await fetch('/api/account/check-display-name', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ displayName: raw, excludeUserId: currentUserId }),
        });
        const data = await res.json();
        setDisplayNameStatus(data.available ? 'available' : 'taken');
      } catch {
        setDisplayNameStatus('idle');
      }
      displayNameCheckRef.current = null;
    }, 400);
    return () => {
      if (displayNameCheckRef.current) clearTimeout(displayNameCheckRef.current);
    };
  }, [editDisplayName, profileEditOpen, profile?.displayName, currentUserId]);

  const handleSaveProfile = async () => {
    if (!currentUserId) return;
    const rawUsername = editUsername.trim().toLowerCase().replace(/^@/, '');
    const rawDisplay = editDisplayName.trim();
    if (rawUsername.length < 3) {
      toast.error(t(effectiveLang, 'Username must be at least 3 characters'));
      return;
    }
    if (usernameStatus === 'taken' || usernameStatus === 'invalid') {
      toast.error(t(effectiveLang, 'Please fix the username'));
      return;
    }
    if (displayNameStatus === 'taken') {
      toast.error(t(effectiveLang, 'Display name is already in use'));
      return;
    }
    setProfileSaving(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch('/api/account/update-profile', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
        },
        body: JSON.stringify({
          username: rawUsername,
          displayName: rawDisplay || undefined,
        }),
        credentials: 'include',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Update failed');
      setProfile((p) => (p ? { ...p, username: rawUsername || p.username, displayName: rawDisplay || null } : null));
      setProfileEditOpen(false);
      toast.success(t(effectiveLang, 'Profile updated'));
    } catch (err: any) {
      toast.error(err?.message || t(effectiveLang, 'Failed to update profile'));
    } finally {
      setProfileSaving(false);
    }
  };

  const handleProfilePicChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || profilePicUploading) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user?.id || !profile?.username) return;

    const localPreview = URL.createObjectURL(file);
    setProfilePicPreview(localPreview);
    setProfilePicUploading(true);
    try {
      const formData = new FormData();
      formData.set('id', user.id);
      formData.set('username', profile.username);
      formData.set('file', file);

      const res = await fetch('/api/update-profile-pic', {
        method: 'POST',
        body: formData,
      });
      const json = await res.json();

      if (!res.ok) throw new Error(json?.error || 'Upload failed');
      const nextUrl = withAvatarCacheBust(json.url, Date.now());
      setProfile((p) => (p ? { ...p, profile_pic_url: nextUrl } : null));
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('hanar:profile-pic-updated', { detail: { url: nextUrl, userId: user.id } }));
      }
      toast.success(t(effectiveLang, 'Profile picture updated'));
    } catch (err: any) {
      toast.error(err?.message || t(effectiveLang, 'Failed to update picture'));
    } finally {
      URL.revokeObjectURL(localPreview);
      setProfilePicPreview(null);
      setProfilePicUploading(false);
    }
  };

  const removeFavorite = async (businessId: string) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { error } = await supabase
      .from('business_favorites')
      .delete()
      .eq('user_id', user.id)
      .eq('business_id', businessId);
    if (error) {
      toast.error(t(effectiveLang, 'Failed to remove favorite'));
      return;
    }
    setFavorites((prev) => prev.filter((b) => b.id !== businessId));
    toast.success(t(effectiveLang, 'Removed from favorites'));
  };

  if (loading) {
    return (
      <div className="flex min-h-screen w-full flex-col bg-[#f0f2f5] pb-10 dark:bg-gray-900">
        <div className="w-full space-y-4 px-4 sm:px-5">
          <div className="w-full bg-white px-4 pt-0 pb-5 dark:bg-gray-800 sm:px-5 sm:pb-6">
            <div className="flex items-center gap-6">
              <div className="skeleton h-20 w-20 rounded-full" />
              <div className="flex-1 space-y-2">
                <div className="skeleton h-5 w-40 rounded" />
                <div className="skeleton h-3 w-24 rounded" />
                <div className="flex gap-3 mt-3">
                  <div className="skeleton h-9 w-28 rounded-xl" />
                  <div className="skeleton h-9 w-36 rounded-xl" />
                  <div className="skeleton h-9 w-24 rounded-xl" />
                </div>
              </div>
            </div>
          </div>
          <div className="w-full space-y-3 bg-white p-5 dark:bg-gray-800 sm:p-6">
            <div className="skeleton h-3 w-16 rounded" />
            <div className="skeleton h-5 w-32 rounded" />
            <div className="skeleton h-3 w-64 rounded" />
            <div className="skeleton h-20 w-full rounded-2xl mt-3" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen w-full flex-col bg-[#f0f2f5] pb-10 dark:bg-gray-900">
      <div className="w-full flex-1 space-y-0">
        {/* Profile card */}
        <div className="w-full bg-white px-4 pt-0 pb-5 dark:bg-gray-800 sm:px-5 sm:pb-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6">
            <label className="relative block shrink-0 cursor-pointer group">
              <div className="h-20 w-20 rounded-full overflow-hidden border-2 border-[#c41e56]/90 bg-slate-100 ring-2 ring-transparent transition group-hover:ring-indigo-200 dark:border-[#e85085]/65 dark:bg-gray-700 dark:group-hover:ring-indigo-500">
                <Avatar
                  src={profilePicPreview || profile?.profile_pic_url}
                  alt="Profile"
                  className="h-full w-full rounded-full"
                  unframed
                />
              </div>
              <span className="absolute bottom-0 right-0 flex h-8 w-8 items-center justify-center rounded-full bg-indigo-600 text-white shadow-md">
                <Camera className="h-4 w-4" />
              </span>
              <input
                type="file"
                accept="image/*"
                className="sr-only"
                onChange={handleProfilePicChange}
                disabled={profilePicUploading || !profile?.username}
              />
            </label>
            <div className="min-w-0 flex-1">
              <h1 className="text-xl font-bold text-slate-900 dark:text-gray-100">
                {profile?.displayName || (profile?.username ? `@${profile.username}` : t(effectiveLang, 'My Profile'))}
              </h1>
              <p className="text-sm text-slate-500 dark:text-gray-400 mt-0.5">
                {profile?.username ? `@${profile.username}` : t(effectiveLang, 'Individual dashboard')}
              </p>

              {profileEditOpen ? (
                <div className="mt-4 space-y-3 p-4 rounded-xl border border-slate-200 dark:border-gray-600 bg-slate-50 dark:bg-gray-700/50">
                  <p className="text-sm font-medium text-slate-700 dark:text-gray-200">{t(effectiveLang, 'Edit username & display name')}</p>
                  <div>
                    <label className="block text-xs font-medium text-slate-500 dark:text-gray-400 mb-1">{t(effectiveLang, 'Username')} (@handle)</label>
                    <div className="flex gap-2 items-center">
                      <input
                        type="text"
                        value={editUsername}
                        onChange={(e) => setEditUsername(e.target.value)}
                        placeholder={t(effectiveLang, 'username')}
                        className="flex-1 rounded-lg border border-slate-200 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 dark:focus:ring-indigo-400"
                      />
                      {usernameStatus === 'available' && <span className="text-xs text-emerald-600 dark:text-emerald-400">✓ {t(effectiveLang, 'Available')}</span>}
                      {usernameStatus === 'taken' && <span className="text-xs text-red-600 dark:text-red-400">✗ {t(effectiveLang, 'Taken')}</span>}
                      {usernameStatus === 'invalid' && <span className="text-xs text-amber-600 dark:text-amber-400">!</span>}
                      {usernameStatus === 'checking' && <span className="text-xs text-slate-400 animate-pulse">...</span>}
                    </div>
                    <p className="text-[11px] text-slate-400 mt-0.5">{t(effectiveLang, 'Letters, numbers, underscores, periods. 3–30 chars.')}</p>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-500 dark:text-gray-400 mb-1">{t(effectiveLang, 'Display name')}</label>
                    <div className="flex gap-2 items-center">
                      <input
                        type="text"
                        value={editDisplayName}
                        onChange={(e) => setEditDisplayName(e.target.value)}
                        placeholder={t(effectiveLang, 'Name shown to others')}
                        className="flex-1 rounded-lg border border-slate-200 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 dark:focus:ring-indigo-400"
                      />
                      {displayNameStatus === 'available' && <span className="text-xs text-emerald-600 dark:text-emerald-400">✓ {t(effectiveLang, 'Available')}</span>}
                      {displayNameStatus === 'taken' && <span className="text-xs text-red-600 dark:text-red-400">✗ {t(effectiveLang, 'Taken')}</span>}
                      {displayNameStatus === 'checking' && <span className="text-xs text-slate-400 animate-pulse">...</span>}
                    </div>
                    <p className="text-[11px] text-slate-400 mt-0.5">{t(effectiveLang, 'Must be unique. Shown in feeds and comments.')}</p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={handleSaveProfile}
                      disabled={profileSaving || usernameStatus === 'taken' || usernameStatus === 'invalid' || usernameStatus === 'checking' || displayNameStatus === 'taken' || displayNameStatus === 'checking'}
                      className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {profileSaving ? t(effectiveLang, 'Saving...') : t(effectiveLang, 'Save')}
                    </button>
                    <button
                      type="button"
                      onClick={() => setProfileEditOpen(false)}
                      className="rounded-lg border border-slate-200 dark:border-gray-600 px-4 py-2 text-sm font-medium text-slate-600 dark:text-gray-300 hover:bg-slate-100 dark:hover:bg-gray-700"
                    >
                      {t(effectiveLang, 'Cancel')}
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setProfileEditOpen(true)}
                  className="mt-2 inline-flex items-center gap-2 rounded-lg border border-slate-200 dark:border-gray-600 px-3 py-1.5 text-sm text-slate-600 dark:text-gray-300 hover:bg-slate-100 dark:hover:bg-gray-700"
                >
                  <PenSquare className="h-4 w-4" />
                  {t(effectiveLang, 'Edit username & display name')}
                </button>
              )}

              {profile?.username && (
                <div className="mt-4">
                  <Link
                    href={`/profile/${profile.username}`}
                    className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-500"
                  >
                    <User className="h-4 w-4 shrink-0" aria-hidden />
                    {t(effectiveLang, 'View Profile')}
                  </Link>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Quick actions */}
        <section className="w-full overflow-hidden bg-white dark:bg-gray-800">
          <div className="bg-white px-4 py-3 sm:px-5 dark:bg-gray-800">
            <h2 className="text-[17px] font-bold leading-tight text-[#050505] dark:text-gray-100">{t(effectiveLang, 'Quick actions')}</h2>
            <p className="mt-1 text-[13px] leading-snug text-[#65676B] dark:text-gray-400">
              {t(effectiveLang, 'Marketplace, help, and account tools in one place.')}
            </p>
          </div>
          <div className="space-y-4 bg-[#f0f2f5] p-3 dark:bg-gray-950/40">
            <div>
              <h3 className="mb-2 px-0.5 text-[15px] font-semibold text-[#050505] dark:text-gray-100">{t(effectiveLang, 'Marketplace')}</h3>
              <Link
                href="/marketplace/post"
                className={`flex min-h-[5.25rem] flex-col items-start gap-2 rounded-xl bg-white p-3 text-left shadow-none transition-colors sm:flex-row sm:items-center sm:gap-4 ${
                  listingLimits != null && !listingLimits.isBusiness && !listingLimits.canAddMore
                    ? 'cursor-not-allowed opacity-70 hover:bg-white dark:hover:bg-gray-800'
                    : 'hover:bg-[#f2f3f5] active:bg-[#e4e6eb] dark:hover:bg-gray-700 dark:active:bg-gray-600'
                }`}
                onClick={(e) => listingLimits != null && !listingLimits.isBusiness && !listingLimits.canAddMore && e.preventDefault()}
                title={
                  listingLimits != null && !listingLimits.isBusiness && !listingLimits.canAddMore
                    ? SHOW_MARKETPLACE_LISTING_PACKAGING
                      ? t(effectiveLang, 'Listing limit reached. Delete one or get the Casual Seller Pack.')
                      : t(effectiveLang, 'Listing limit reached. Delete one to post a new item.')
                    : t(effectiveLang, 'Sell an item')
                }
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#f0f2f5] text-[#65676B] dark:bg-gray-700 dark:text-gray-300">
                  <Tag className="h-6 w-6" aria-hidden />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[15px] font-semibold text-[#050505] dark:text-gray-100">{t(effectiveLang, 'Sell Item')}</span>
                  <span className="mt-1 block text-[13px] leading-snug text-[#65676B] dark:text-gray-400">{t(effectiveLang, 'List something on the marketplace')}</span>
                </span>
              </Link>
            </div>

            <DashboardFavoritesSection
              embedded
              loading={loading}
              favoriteItems={favoriteItems}
              favoriteBusinesses={favorites}
              onRemoveItem={removeFavoriteItem}
              onRemoveBusiness={removeFavorite}
            />

            <div>
              <h3 className="mb-2 px-0.5 text-[15px] font-semibold text-[#050505] dark:text-gray-100">{t(effectiveLang, 'Account & help')}</h3>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                <Link
                  href="/dashboard/blocked"
                  className="flex min-h-[5.25rem] flex-col items-start gap-2 rounded-xl bg-white p-3 text-left shadow-none transition-colors hover:bg-[#f2f3f5] dark:bg-gray-800 dark:hover:bg-gray-700"
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#f0f2f5] text-[#65676B] dark:bg-gray-700 dark:text-gray-300">
                    <Ban className="h-6 w-6" aria-hidden />
                  </span>
                  <span className="text-[15px] font-semibold leading-snug text-[#050505] dark:text-gray-100">{t(effectiveLang, 'Blocked accounts')}</span>
                </Link>
                <Link
                  href="/faq"
                  className="flex min-h-[5.25rem] flex-col items-start gap-2 rounded-xl bg-white p-3 text-left shadow-none transition-colors hover:bg-[#f2f3f5] dark:bg-gray-800 dark:hover:bg-gray-700"
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#f0f2f5] text-[#65676B] dark:bg-gray-700 dark:text-gray-300">
                    <CircleHelp className="h-6 w-6" aria-hidden />
                  </span>
                  <span className="text-[15px] font-semibold leading-snug text-[#050505] dark:text-gray-100">{t(effectiveLang, 'FAQ / Help')}</span>
                </Link>
                <Link
                  href="/contact"
                  className="flex min-h-[5.25rem] flex-col items-start gap-2 rounded-xl bg-white p-3 text-left shadow-none transition-colors hover:bg-[#f2f3f5] dark:bg-gray-800 dark:hover:bg-gray-700"
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#f0f2f5] text-[#65676B] dark:bg-gray-700 dark:text-gray-300">
                    <Phone className="h-6 w-6" aria-hidden />
                  </span>
                  <span className="text-[15px] font-semibold leading-snug text-[#050505] dark:text-gray-100">{t(effectiveLang, 'Contact Us')}</span>
                </Link>
                <Link
                  href="/settings"
                  className="flex min-h-[5.25rem] flex-col items-start gap-2 rounded-xl bg-white p-3 text-left shadow-none transition-colors hover:bg-[#f2f3f5] dark:bg-gray-800 dark:hover:bg-gray-700"
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#f0f2f5] text-[#65676B] dark:bg-gray-700 dark:text-gray-300">
                    <Settings className="h-6 w-6" aria-hidden />
                  </span>
                  <span className="text-[15px] font-semibold leading-snug text-[#050505] dark:text-gray-100">{t(effectiveLang, 'Settings')}</span>
                </Link>
              </div>
            </div>

            <div className="bg-white p-4 dark:bg-gray-800">
              <label className="mb-2 flex items-center gap-2 text-[13px] font-semibold text-[#050505] dark:text-gray-200">
                <Languages className="h-4 w-4 text-[#65676B] dark:text-gray-400" aria-hidden />
                {t(effectiveLang, 'Language')}
              </label>
              <div className="relative">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-[#65676B]">🌐</span>
                <select
                  value={lang}
                  onChange={(e) => setLang(e.target.value)}
                  className="w-full cursor-pointer appearance-none rounded-lg border-0 bg-[#f0f2f5] py-2.5 pl-9 pr-10 text-[15px] font-medium text-[#050505] ring-0 transition focus:border-0 focus:outline-none focus:ring-2 focus:ring-[#1877f2]/35 dark:bg-gray-900 dark:text-gray-100 dark:focus:ring-[#1877f2]/40"
                  style={{
                    backgroundImage:
                      'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' fill=\'none\' viewBox=\'0 0 24 24\' stroke=\'%2365676B\'%3E%3Cpath stroke-linecap=\'round\' stroke-linejoin=\'round\' stroke-width=\'2\' d=\'M19 9l-7 7-7-7\'%3E%3C/path%3E%3C/svg%3E")',
                    backgroundRepeat: 'no-repeat',
                    backgroundPosition: 'right 0.85rem center',
                    backgroundSize: '0.85rem',
                  }}
                >
                  {supportedLanguages.map(({ code, name, emoji }) => (
                    <option key={code} value={code}>
                      {emoji} {getNativeLanguageName(code, name)}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <button
              type="button"
              onClick={handleHeaderLogout}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-white py-3 text-[15px] font-semibold text-red-700 shadow-none transition-colors hover:bg-red-50 dark:bg-gray-800 dark:text-red-300 dark:hover:bg-red-950/40"
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#f0f2f5] text-[#65676B] dark:bg-gray-700 [&_svg]:h-5 [&_svg]:w-5">
                <LogOut className="shrink-0" aria-hidden />
              </span>
              {t(effectiveLang, 'Log Out')}
            </button>
          </div>
        </section>

        {/* Items for sale */}
        <div className="w-full bg-white px-4 py-6 dark:bg-gray-800 sm:px-5 sm:py-8">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">{t(effectiveLang, 'Selling')}</p>
              <h2 className="mt-1 text-xl font-bold text-slate-900 dark:text-gray-100">{t(effectiveLang, 'Items for Sale')}</h2>
            </div>
            {SHOW_MARKETPLACE_LISTING_PACKAGING && (
            <span className="text-sm text-slate-500 dark:text-gray-400">
              {listingLimitsLoading || myListingLoading
                ? t(effectiveLang, 'Loading...')
                : listingLimits?.isBusiness
                  ? `${myListings.length} ${t(effectiveLang, 'items')}`
                  : `${listingLimits?.activeCount ?? 0} / ${listingLimits?.maxAllowed ?? 1} ${t(effectiveLang, 'listings')}`}
            </span>
            )}
          </div>
          {SHOW_MARKETPLACE_LISTING_PACKAGING && (
          <>
          <p className="mt-2 text-sm text-slate-500 dark:text-gray-400">
            {listingLimits?.isBusiness
              ? t(effectiveLang, 'Unlimited listings for businesses.')
              : listingLimits?.hasPack
                ? t(effectiveLang, 'Casual Seller Pack: up to 5 listings.')
                : t(effectiveLang, 'Free: 1 listing (expires 30 days). Buy Casual Seller Pack for up to 5 listings.')}
          </p>
          {!listingLimits?.isBusiness && (
            <div className="mt-3">
              <button
                type="button"
                onClick={() => setPackModalOpen(true)}
                className="inline-flex items-center gap-2 rounded-xl border border-emerald-300 dark:border-emerald-600 bg-emerald-50 dark:bg-emerald-900/30 px-4 py-2 text-sm font-semibold text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/50"
              >
                <ShoppingBag className="h-4 w-4" />
                {t(effectiveLang, 'View pricing & choose package')}
              </button>
              {listingLimits?.packExpiresAt && (
                <span className="ml-2 text-xs text-slate-500 dark:text-gray-400">
                  {t(effectiveLang, 'Pack expires')} {new Date(listingLimits.packExpiresAt).toLocaleDateString()}
                </span>
              )}
            </div>
          )}
          </>
          )}
          {myListingLoading ? (
            <div className="mt-6 text-slate-500 dark:text-gray-400">{t(effectiveLang, 'Loading...')}</div>
          ) : myListings.length > 0 ? (
            <div className="mt-6 space-y-4">
              {myListings.map((listing) => (
                <div key={listing.id} className="flex gap-4 rounded-2xl bg-emerald-50/50 p-4 dark:bg-gray-700/80">
                  <Link href={`/marketplace/individual-${listing.id}`} className="shrink-0 block h-24 w-24 rounded-xl overflow-hidden bg-slate-100 dark:bg-gray-600">
                    <img src={listing.imageUrls[0] || '/placeholder.jpg'} alt={listing.title} className="h-full w-full object-cover" />
                  </Link>
                  <div className="min-w-0 flex-1">
                    <Link href={`/marketplace/individual-${listing.id}`} className="font-semibold text-slate-900 dark:text-gray-100 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors text-[15px] tracking-tight">{listing.title}</Link>
                    <p className="text-lg font-bold tabular-nums text-emerald-600 dark:text-emerald-400 mt-0.5">{typeof listing.price === 'number' ? `$${Number(listing.price).toLocaleString()}` : listing.price}</p>
                    {listing.location && (
                      <span className="inline-flex items-center px-2 py-0.5 text-[11px] font-medium rounded-lg bg-slate-200 text-slate-700 dark:bg-slate-600/50 dark:text-slate-200 mt-1 w-fit">
                        {listing.location}
                      </span>
                    )}
                    {(() => {
                      const days = getListingExpiryDays(listing.created_at);
                      if (days === null) return null;
                      const label = days > 0
                        ? t(effectiveLang, 'Expires in') + ` ${days} ` + t(effectiveLang, 'days')
                        : days === 0
                          ? t(effectiveLang, 'Expires today')
                          : t(effectiveLang, 'Expired');
                      return (
                        <p className={`text-xs mt-0.5 ${days < 0 ? 'text-red-600 dark:text-red-400' : 'text-amber-600 dark:text-amber-400'}`}>
                          {label}
                        </p>
                      );
                    })()}
                    <div className="mt-2 flex flex-wrap items-center gap-3">
                      <Link
                        href={`/marketplace/edit/${listing.id}`}
                        className="text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:underline"
                      >
                        {t(effectiveLang, 'Edit')}
                      </Link>
                      <button
                        type="button"
                        onClick={() => deleteMyListing(listing.id)}
                        disabled={deletingListing === listing.id}
                        className="text-xs text-red-600 dark:text-red-400 hover:underline disabled:opacity-50"
                      >
                        {deletingListing === listing.id ? t(effectiveLang, 'Deleting...') : t(effectiveLang, 'Delete listing')}
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="mt-6 rounded-2xl bg-emerald-50/40 p-6 text-center text-slate-500 dark:bg-gray-800/50 dark:text-gray-400">
              {t(effectiveLang, 'No items listed.')}
              <Link href="/marketplace/post" className="mt-3 block text-emerald-600 dark:text-emerald-400 font-semibold hover:underline">{t(effectiveLang, 'Add item for sale')}</Link>
            </div>
          )}
        </div>

        {/* Modal: Listing packages – portal so always in view */}
        {SHOW_MARKETPLACE_LISTING_PACKAGING && packModalOpen && typeof document !== 'undefined' && createPortal(
          <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 p-4" onClick={() => !packPurchasing && setPackModalOpen(false)} role="dialog" aria-modal="true" aria-label={t(effectiveLang, 'Listing packages')}>
            <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-xl w-full max-w-md p-4 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">{t(effectiveLang, 'Listing packages')}</h3>
              <p className="mt-1 text-sm text-slate-500 dark:text-gray-400">{t(effectiveLang, 'Choose a plan to list more items for sale.')}</p>

              <div className="mt-6 space-y-4">
                {/* Free tier */}
                <div className={`rounded-2xl border-2 p-4 ${listingLimits?.hasPack ? 'border-slate-200 dark:border-gray-600 bg-slate-50/50 dark:bg-gray-800/50' : 'border-emerald-200 dark:border-emerald-700 bg-emerald-50/50 dark:bg-emerald-900/20'}`}>
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <p className="font-semibold text-slate-900 dark:text-white">{t(effectiveLang, 'Free')}</p>
                      <p className="text-sm text-slate-600 dark:text-gray-300 mt-0.5">
                        {t(effectiveLang, '1 active listing')}, {t(effectiveLang, 'expires 30 days after posting')}.
                      </p>
                    </div>
                    {!listingLimits?.hasPack && (
                      <span className="shrink-0 rounded-full bg-emerald-100 dark:bg-emerald-800/50 px-2.5 py-0.5 text-xs font-medium text-emerald-700 dark:text-emerald-300">{t(effectiveLang, 'Current')}</span>
                    )}
                  </div>
                </div>

                {/* Casual Seller Pack */}
                <div className="rounded-2xl border-2 border-emerald-300 dark:border-emerald-600 bg-emerald-50/50 dark:bg-emerald-900/20 p-4">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div>
                      <p className="font-semibold text-slate-900 dark:text-white">{t(effectiveLang, 'Casual Seller Pack')}</p>
                      <p className="text-sm text-slate-600 dark:text-gray-300 mt-0.5">
                        $19.99 {t(effectiveLang, 'for 40 days')}. {t(effectiveLang, 'Up to 5 active listings')}. {t(effectiveLang, 'Renewal extends by 40 days')}.
                      </p>
                    </div>
                    {listingLimits?.hasPack && (
                      <span className="shrink-0 rounded-full bg-emerald-100 dark:bg-emerald-800/50 px-2.5 py-0.5 text-xs font-medium text-emerald-700 dark:text-emerald-300">{t(effectiveLang, 'Active')}</span>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={purchasePack}
                    disabled={packPurchasing}
                    className="mt-3 w-full rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
                  >
                    {packPurchasing ? t(effectiveLang, 'Activating...') : listingLimits?.hasPack ? t(effectiveLang, 'Renew – $19.99') : t(effectiveLang, 'Choose this package – $19.99')}
                  </button>
                </div>
              </div>

              {/* Create a business account – business packages */}
              <div className="mt-8 pt-6">
                <div className="flex items-center gap-2 mb-2">
                  <Building2 className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
                  <h4 className="font-semibold text-slate-900 dark:text-white">{t(effectiveLang, 'Create a business account')}</h4>
                </div>
                <p className="text-sm text-slate-500 dark:text-gray-400 mb-4">
                  {t(effectiveLang, 'Get a business profile with plans and services we provide. Unlimited marketplace listings, gallery, retail, and more.')}
                </p>
                {businessPlansLoading ? (
                  <p className="text-sm text-slate-500 dark:text-gray-400">{t(effectiveLang, 'Loading plans...')}</p>
                ) : businessPlans.length > 0 ? (
                  <div className="space-y-4">
                    {businessPlans.map((bp) => (
                      <div key={bp.plan} className="rounded-xl border border-slate-200 dark:border-gray-600 bg-slate-50/50 dark:bg-gray-800/50 p-3">
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          <span className="font-medium text-slate-900 dark:text-white">{bp.name}</span>
                          <span className="text-sm font-semibold text-indigo-600 dark:text-indigo-400">
                            {bp.price_yearly === '0' ? t(effectiveLang, 'Free') : `$${bp.price_yearly}/year`}
                          </span>
                        </div>
                        {bp.limits && bp.limits.length > 0 && (
                          <div className="mt-2">
                            <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:text-gray-400 mb-1">{t(effectiveLang, 'Limits')}</p>
                            <ul className="space-y-0.5 text-xs text-slate-600 dark:text-gray-300">
                              {bp.limits.map((lim, i) => (
                                <li key={i}><span className="font-medium text-slate-700 dark:text-gray-200">{lim.label}:</span> {String(lim.value)}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                        {bp.features && bp.features.length > 0 && (
                          <div className="mt-2">
                            <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:text-gray-400 mb-1">{t(effectiveLang, 'Features')}</p>
                            <ul className="space-y-0.5 text-xs text-slate-600 dark:text-gray-300">
                              {bp.features.map((f, i) => (
                                <li key={i} className={f.enabled ? '' : 'opacity-60'}>
                                  {f.enabled ? '✓' : '—'} {f.label}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    ))}
                    <Link
                      href="/register"
                      onClick={() => setPackModalOpen(false)}
                      className="mt-3 flex items-center justify-center gap-2 w-full rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700"
                    >
                      <Building2 className="h-4 w-4" />
                      {t(effectiveLang, 'Create business account')}
                    </Link>
                  </div>
                ) : (
                  <Link
                    href="/register"
                    onClick={() => setPackModalOpen(false)}
                    className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700"
                  >
                    <Building2 className="h-4 w-4" />
                    {t(effectiveLang, 'Create business account')}
                  </Link>
                )}
              </div>

              <div className="mt-4 flex justify-end">
                <button type="button" onClick={() => !packPurchasing && setPackModalOpen(false)} className="rounded-xl border border-slate-300 dark:border-gray-600 px-4 py-2 text-sm font-semibold text-slate-700 dark:text-gray-200">
                  {t(effectiveLang, 'Close')}
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const { effectiveLang } = useLanguage();
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">{t(effectiveLang, 'Loading...')}</div>}>
      <DashboardContent />
    </Suspense>
  );
}
