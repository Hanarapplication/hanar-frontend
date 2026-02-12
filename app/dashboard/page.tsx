'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { supabase } from '@/lib/supabaseClient';
import { User, Building2, Heart, ShoppingBag, PenSquare, Camera, Tag, Trash2 } from 'lucide-react';
import { FavoritesSlideMenu } from '@/components/FavoritesSlideMenu';
import { DashboardBurgerMenu } from '@/components/DashboardBurgerMenu';
import { useLanguage } from '@/context/LanguageContext';
import { t } from '@/utils/translations';

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

const normalizeCategory = (value?: string | null) => {
  const normalized = (value || '').trim().toLowerCase();
  if (!normalized) return '';
  if (normalized === 'something_else' || normalized === 'other') return '';
  if (normalized === 'retails') return 'Retail';
  return value || '';
};

export default function DashboardPage() {
  const { effectiveLang } = useLanguage();
  const [favorites, setFavorites] = useState<FavoriteBusiness[]>([]);
  const [favoriteItems, setFavoriteItems] = useState<FavoriteItem[]>([]);
  const [followedOrgs, setFollowedOrgs] = useState<FollowedOrg[]>([]);
  const [profile, setProfile] = useState<{ username: string | null; profile_pic_url: string | null } | null>(null);
  const [loading, setLoading] = useState(true);
  const [followedOrgsLoading, setFollowedOrgsLoading] = useState(true);
  const [profilePicUploading, setProfilePicUploading] = useState(false);
  const [myListing, setMyListing] = useState<MyListing | null>(null);
  const [myListingLoading, setMyListingLoading] = useState(true);
  const [deletingListing, setDeletingListing] = useState(false);
  const [favoritesMenuOpen, setFavoritesMenuOpen] = useState(false);
  const [burgerMenuOpen, setBurgerMenuOpen] = useState(false);
  const router = useRouter();

  const burgerItems = [
    ...(profile?.username ? [{ label: t(effectiveLang, 'View Profile'), href: `/profile/${profile.username}`, icon: <User className="h-5 w-5 shrink-0" />, color: 'bg-indigo-50 dark:bg-indigo-900/30' }] : []),
    { label: t(effectiveLang, 'Post to Community'), href: '/community/post', icon: <PenSquare className="h-5 w-5 shrink-0" />, color: 'bg-blue-50 dark:bg-blue-900/30' },
    { label: t(effectiveLang, 'Sell Item'), href: '/marketplace/post', icon: <Tag className="h-5 w-5 shrink-0" />, color: 'bg-emerald-50 dark:bg-emerald-900/30' },
    { label: t(effectiveLang, 'Following organizations'), onClick: () => setFavoritesMenuOpen(true), icon: <Building2 className="h-5 w-5 shrink-0" />, color: 'bg-sky-50 dark:bg-sky-900/30' },
    { label: t(effectiveLang, 'Favorite businesses'), onClick: () => setFavoritesMenuOpen(true), icon: <Heart className="h-5 w-5 shrink-0" />, color: 'bg-rose-50 dark:bg-rose-900/30' },
    { label: t(effectiveLang, 'Favorite items'), onClick: () => setFavoritesMenuOpen(true), icon: <Heart className="h-5 w-5 shrink-0" />, color: 'bg-pink-50 dark:bg-pink-900/30' },
    { label: t(effectiveLang, 'Delete My Account'), href: '/settings', icon: <Trash2 className="h-5 w-5 shrink-0" />, color: 'bg-red-50 dark:bg-red-900/30' },
  ];

  useEffect(() => {
    const load = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          router.replace('/login');
          return;
        }

        const { data: regProfile, error: profileError } = await supabase
          .from('registeredaccounts')
          .select('business, organization')
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

        const [{ data: favoriteRows, error: favoritesError }, { data: profData }] = await Promise.all([
          supabase.from('business_favorites').select('business_id').eq('user_id', user.id),
          supabase.from('profiles').select('username, profile_pic_url').eq('id', user.id).maybeSingle(),
        ]);

        if (favoritesError) throw favoritesError;
        setProfile(profData ? { username: profData.username, profile_pic_url: profData.profile_pic_url } : null);

        const businessIds = (favoriteRows || []).map((row: { business_id: string }) => row.business_id);

        if (businessIds.length === 0) {
          setFavorites([]);
        } else {
          const { data, error } = await supabase
            .from('businesses')
            .select('id, business_name, slug, category, logo_url, address')
            .in('id', businessIds);
          if (error) throw error;
          setFavorites((data as FavoriteBusiness[]) || []);
        }

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
        toast.error(err?.message || 'Failed to load dashboard');
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [router]);

  useEffect(() => {
    const loadFollowedOrgs = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          setFollowedOrgs([]);
          return;
        }

        const { data: followRows, error: followError } = await supabase
          .from('follows')
          .select('following_id')
          .eq('follower_id', user.id);

        if (followError) throw followError;

        const orgOwnerIds = (followRows || []).map((row: { following_id: string }) => row.following_id);
        if (orgOwnerIds.length === 0) {
          setFollowedOrgs([]);
        } else {
          const { data: orgData, error: orgError } = await supabase
            .from('organizations')
            .select('user_id, full_name, username, logo_url')
            .in('user_id', orgOwnerIds);
          if (orgError) throw orgError;
          setFollowedOrgs((orgData as FollowedOrg[]) || []);
        }
      } catch {
        setFollowedOrgs([]);
      } finally {
        setFollowedOrgsLoading(false);
      }
    };

    loadFollowedOrgs();
  }, []);

  useEffect(() => {
    const loadMyListing = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          setMyListing(null);
          return;
        }
        const { data } = await supabase
          .from('marketplace_items')
          .select('id, title, price, location, image_urls, created_at')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        if (data) {
          const urls = resolveMarketplaceImageUrls((data as any).image_urls ?? (data as any).imageUrls);
          setMyListing({
            id: data.id,
            title: data.title || 'Item',
            price: data.price ?? '',
            location: data.location || '',
            imageUrls: urls,
            created_at: data.created_at,
          });
        } else {
          setMyListing(null);
        }
      } catch {
        setMyListing(null);
      } finally {
        setMyListingLoading(false);
      }
    };
    loadMyListing();
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
      toast.error(t(effectiveLang, 'Failed to remove'));
      return;
    }
    setFavoriteItems((prev) => prev.filter((fav) => fav.key !== itemKey));
    toast.success(t(effectiveLang, 'Removed'));
  };

  const deleteMyListing = async () => {
    if (!myListing || deletingListing) return;
    if (!confirm('Delete this listing? You can add a new item once this is removed.')) return;
    setDeletingListing(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (session?.access_token) headers.Authorization = `Bearer ${session.access_token}`;
      const res = await fetch('/api/marketplace/delete-item', {
        method: 'POST',
        headers,
        body: JSON.stringify({ itemId: myListing.id }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || t(effectiveLang, 'Failed to delete'));
      setMyListing(null);
      toast.success(t(effectiveLang, 'Listing deleted. You can add a new item.'));
    } catch (err: any) {
      toast.error(err?.message || t(effectiveLang, 'Failed to delete'));
    } finally {
      setDeletingListing(false);
    }
  };

  const handleProfilePicChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || profilePicUploading) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user?.id || !profile?.username) return;

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
      setProfile((p) => (p ? { ...p, profile_pic_url: json.url } : null));
      toast.success(t(effectiveLang, 'Profile picture updated'));
    } catch (err: any) {
      toast.error(err?.message || t(effectiveLang, 'Failed to update picture'));
    } finally {
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

  const groupedFavorites = useMemo(() => {
    const groups: Record<string, FavoriteBusiness[]> = {};
    favorites.forEach((biz) => {
      const key = normalizeCategory(biz.category);
      if (!groups[key]) groups[key] = [];
      groups[key].push(biz);
    });
    return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b));
  }, [favorites]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-gray-900 px-4 pt-16 pb-10">
        <div className="max-w-5xl mx-auto space-y-6">
          <div className="rounded-3xl border border-slate-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-lg p-6 sm:p-8">
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
          <div className="rounded-3xl border border-slate-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-lg p-6 sm:p-8 space-y-3">
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
    <div className="min-h-screen bg-slate-50 dark:bg-gray-900 px-4 pt-16 pb-10">
      <DashboardBurgerMenu open={burgerMenuOpen} onOpen={() => setBurgerMenuOpen(true)} onClose={() => setBurgerMenuOpen(false)} items={burgerItems} />
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Profile card */}
        <div className="rounded-3xl border border-slate-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-lg shadow-slate-100/60 dark:shadow-black/20 p-6 sm:p-8">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6">
            <label className="relative block shrink-0 cursor-pointer group">
              <div className="h-20 w-20 rounded-full overflow-hidden border-2 border-slate-200 dark:border-gray-600 bg-slate-100 dark:bg-gray-700 ring-2 ring-transparent group-hover:ring-indigo-200 dark:group-hover:ring-indigo-500 transition">
                {profile?.profile_pic_url ? (
                  <img
                    src={profile.profile_pic_url}
                    alt="Profile"
                    className="h-full w-full object-cover"
                    onError={(e) => {
                      e.currentTarget.src = '/default-avatar.png';
                      e.currentTarget.onerror = null;
                    }}
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-2xl text-slate-400 dark:text-gray-500">
                    <User className="h-10 w-10" />
                  </div>
                )}
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
                {profile?.username ? `@${profile.username}` : t(effectiveLang, 'My Profile')}
              </h1>
              <p className="text-sm text-slate-500 dark:text-gray-400 mt-0.5">
                {t(effectiveLang, 'Individual dashboard')}
              </p>
              <div className="mt-4 flex flex-wrap gap-3">
                {profile?.username && (
                  <Link
                    href={`/profile/${profile.username}`}
                    className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500 transition"
                  >
                    {t(effectiveLang, 'View Profile')}
                  </Link>
                )}
                <Link
                  href="/community/post"
                  className="inline-flex items-center gap-2 rounded-xl border border-slate-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-4 py-2 text-sm font-semibold text-slate-700 dark:text-gray-200 hover:bg-slate-50 dark:hover:bg-gray-600 transition"
                >
                  <PenSquare className="h-4 w-4" />
                  {t(effectiveLang, 'Post to Community')}
                </Link>
                <Link
                  href="/marketplace/post"
                  className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition ${
                    myListing
                      ? 'border border-slate-300 dark:border-gray-600 bg-slate-100 dark:bg-gray-700 text-slate-500 dark:text-gray-400 cursor-not-allowed'
                      : 'border border-emerald-300 dark:border-emerald-600 bg-emerald-50 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/60'
                  }`}
                  onClick={(e) => myListing && e.preventDefault()}
                  title={myListing ? t(effectiveLang, 'Delete your current listing to add a new item (1 per week limit)') : t(effectiveLang, 'Sell an item')}
                >
                  <Tag className="h-4 w-4" />
                  {t(effectiveLang, 'Sell Item')}
                </Link>
                <Link
                  href="/settings"
                  className="inline-flex items-center gap-2 rounded-xl border border-slate-200 dark:border-gray-600 px-4 py-2 text-sm text-slate-600 dark:text-gray-300 hover:bg-slate-50 dark:hover:bg-gray-700 transition"
                >
                  {t(effectiveLang, 'Settings')}
                </Link>
              </div>
            </div>
          </div>
        </div>

        {/* Items for sale - individual: 1 per week */}
        <div className="rounded-3xl border border-slate-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-lg shadow-slate-100/60 dark:shadow-black/20 p-6 sm:p-8">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">{t(effectiveLang, 'Selling')}</p>
              <h2 className="mt-1 text-xl font-bold text-slate-900 dark:text-gray-100">{t(effectiveLang, 'Items for Sale')}</h2>
            </div>
            <span className="text-sm text-slate-500 dark:text-gray-400">
              {myListing ? t(effectiveLang, '1 item (max 1 per week)') : t(effectiveLang, '0 items')}
            </span>
          </div>
          <p className="mt-2 text-sm text-slate-500 dark:text-gray-400">
            {t(effectiveLang, 'Individuals can list 1 item per week. Delete your current listing to add a new one.')}
          </p>
          {myListingLoading ? (
            <div className="mt-6 text-slate-500 dark:text-gray-400">{t(effectiveLang, 'Loading...')}</div>
          ) : myListing ? (
            <div className="mt-6 flex gap-4 rounded-2xl border border-emerald-100 dark:border-gray-600 bg-emerald-50/50 dark:bg-gray-700/80 p-4">
              <Link href={`/marketplace/individual-${myListing.id}`} className="shrink-0 block h-24 w-24 rounded-xl overflow-hidden bg-slate-100 dark:bg-gray-600">
                <img src={myListing.imageUrls[0] || '/placeholder.jpg'} alt={myListing.title} className="h-full w-full object-cover" />
              </Link>
              <div className="min-w-0 flex-1">
                <Link href={`/marketplace/individual-${myListing.id}`} className="font-semibold text-slate-900 dark:text-gray-100 hover:underline">{myListing.title}</Link>
                <p className="text-sm text-emerald-700 dark:text-emerald-400 font-medium">{typeof myListing.price === 'number' ? `$${myListing.price}` : myListing.price}</p>
                <p className="text-xs text-slate-500 dark:text-gray-400">{myListing.location}</p>
                <button
                  type="button"
                  onClick={deleteMyListing}
                  disabled={deletingListing}
                  className="mt-2 text-xs text-red-600 dark:text-red-400 hover:underline disabled:opacity-50"
                >
                  {deletingListing ? t(effectiveLang, 'Deleting...') : t(effectiveLang, 'Delete listing')}
                </button>
              </div>
            </div>
          ) : (
            <div className="mt-6 rounded-2xl border border-dashed border-emerald-200 dark:border-gray-600 p-6 text-center text-slate-500 dark:text-gray-400">
              {t(effectiveLang, 'No items listed. You can add 1 item for sale.')}
              <Link href="/marketplace/post" className="mt-3 block text-emerald-600 dark:text-emerald-400 font-semibold hover:underline">{t(effectiveLang, 'Add item for sale')}</Link>
            </div>
          )}
        </div>

        <FavoritesSlideMenu open={favoritesMenuOpen} onClose={() => setFavoritesMenuOpen(false)} title={t(effectiveLang, 'Favorites')}>
          <div className="space-y-8">
            <div>
              <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-gray-400">{t(effectiveLang, 'Favorite Businesses')}</h3>
              {loading ? (
                <p className="mt-4 text-slate-500">{t(effectiveLang, 'Loading favorites...')}</p>
              ) : favorites.length === 0 ? (
                <p className="mt-4 rounded-2xl border border-dashed border-slate-300 dark:border-gray-600 p-6 text-center text-slate-500">{t(effectiveLang, 'You have no favorite businesses yet. Visit a business page and click the heart to add favorites.')}</p>
              ) : (
                <div className="mt-3 space-y-4">
                  {groupedFavorites.map(([category, items]) => (
                    <div key={category}>
                      {category ? <p className="text-xs font-semibold uppercase text-slate-500 dark:text-gray-400">{category}</p> : null}
                      <div className="mt-2 grid gap-2">
                        {items.map((biz) => (
                          <div key={biz.id} className="relative flex items-center gap-3 rounded-xl border border-slate-200 dark:border-gray-600 bg-white dark:bg-gray-800 p-3">
                            <Link href={`/business/${biz.slug || biz.id}`} onClick={() => setFavoritesMenuOpen(false)} className="flex min-w-0 flex-1 items-center gap-3">
                              <div className="h-10 w-10 shrink-0 rounded-lg overflow-hidden bg-slate-100 dark:bg-gray-700">
                                {biz.logo_url ? (
                                  <img src={biz.logo_url} alt="" className="h-full w-full object-cover" onError={(e) => { e.currentTarget.src = 'https://placehold.co/40x40'; e.currentTarget.onerror = null; }} />
                                ) : (
                                  <div className="flex h-full w-full items-center justify-center"><Building2 className="h-5 w-5 text-slate-500" /></div>
                                )}
                              </div>
                              <div className="min-w-0">
                                <p className="truncate font-semibold text-slate-900 dark:text-white">{biz.business_name || 'Business'}</p>
                                <p className="text-xs text-slate-500 dark:text-gray-400">{biz.address?.city || ''}{biz.address?.state ? `, ${biz.address.state}` : ''}</p>
                              </div>
                            </Link>
                            <button type="button" onClick={() => removeFavorite(biz.id)} className="shrink-0 rounded p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/40 dark:hover:text-red-400" title={t(effectiveLang, 'Remove from favorites')}>
                              <Heart className="h-4 w-4 fill-red-500" />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div>
              <h3 className="text-sm font-semibold uppercase tracking-wide text-indigo-600 dark:text-indigo-400">{t(effectiveLang, 'Following')} – {t(effectiveLang, 'Organizations')}</h3>
              {followedOrgsLoading ? (
                <p className="mt-4 text-slate-500">{t(effectiveLang, 'Loading...')}</p>
              ) : followedOrgs.length === 0 ? (
                <p className="mt-4 rounded-2xl border border-dashed border-indigo-200 dark:border-gray-600 p-6 text-center text-slate-500">{t(effectiveLang, 'No organizations followed yet. Visit an organization page and click Follow.')}</p>
              ) : (
                <div className="mt-3 grid gap-2">
                  {followedOrgs.map((org) => (
                    <Link
                      key={org.user_id}
                      href={org.username ? `/organization/${org.username}` : '#'}
                      onClick={() => setFavoritesMenuOpen(false)}
                      className="flex items-center gap-3 rounded-xl border border-indigo-100 dark:border-gray-600 bg-white dark:bg-gray-800 p-3 hover:border-indigo-200 dark:hover:border-gray-500"
                    >
                      <div className="h-10 w-10 shrink-0 rounded-lg overflow-hidden bg-indigo-50 dark:bg-indigo-900/30">
                        {org.logo_url ? (
                          <img src={org.logo_url} alt="" className="h-full w-full object-cover" onError={(e) => { e.currentTarget.src = 'https://placehold.co/40x40'; e.currentTarget.onerror = null; }} />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center"><Building2 className="h-5 w-5 text-indigo-500" /></div>
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="truncate font-semibold text-slate-900 dark:text-white">{org.full_name || 'Organization'}</p>
                        <p className="text-xs text-slate-500 dark:text-gray-400">{org.username ? `@${org.username}` : ''}</p>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </div>
            <div>
              <h3 className="text-sm font-semibold uppercase tracking-wide text-emerald-600 dark:text-emerald-400">{t(effectiveLang, 'Favorite Items')}</h3>
              {favoriteItems.length === 0 ? (
                <p className="mt-4 rounded-2xl border border-dashed border-emerald-200 dark:border-gray-600 p-6 text-center text-slate-500">{t(effectiveLang, 'You have no favorite items yet. Browse the marketplace and add some.')}</p>
              ) : (
                <div className="mt-3 grid gap-2">
                  {favoriteItems.map((item) => (
                    <div key={item.key} className="rounded-xl border border-emerald-100 dark:border-gray-600 bg-white dark:bg-gray-800 p-3">
                      <Link href={`/marketplace/${item.slug}`} onClick={() => setFavoritesMenuOpen(false)} className="block">
                        <div className="flex gap-3">
                          <div className="h-12 w-12 shrink-0 rounded-lg overflow-hidden bg-slate-100 dark:bg-gray-700">
                            <img src={item.image || '/placeholder.jpg'} alt="" className="h-full w-full object-contain" />
                          </div>
                          <div className="min-w-0">
                            <p className="truncate font-semibold text-slate-900 dark:text-white">{item.title}</p>
                            <p className="text-xs text-slate-500 dark:text-gray-400">{item.location || ''}</p>
                            <p className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">{item.price}</p>
                          </div>
                        </div>
                      </Link>
                      <button type="button" onClick={() => removeFavoriteItem(item.key)} className="mt-2 text-xs text-red-600 dark:text-red-400 hover:underline flex items-center gap-1">
                        <Heart className="h-3 w-3" /> {t(effectiveLang, 'Remove')}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </FavoritesSlideMenu>
      </div>
    </div>
  );
}
