'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { supabase } from '@/lib/supabaseClient';
import { User, Building2, Heart, ShoppingBag, PenSquare, Camera, Tag } from 'lucide-react';
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

const FAVORITE_ITEMS_KEY = 'favoriteMarketplaceItems';

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
  const [followingOrgsCollapsed, setFollowingOrgsCollapsed] = useState(false);
  const router = useRouter();

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

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-gray-900 px-4 py-10">
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

        {/* Favorite businesses */}
        <div className="rounded-3xl border border-slate-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-lg shadow-slate-100/60 dark:shadow-black/20 p-6 sm:p-8">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-gray-200">{t(effectiveLang, 'Favorite Businesses')}</p>
              <h2 className="mt-1 text-xl font-bold text-slate-900 dark:text-gray-100">{t(effectiveLang, 'Businesses You Love')}</h2>
            </div>
            <span className="text-sm text-slate-500 dark:text-gray-200">{favorites.length} business{favorites.length === 1 ? '' : 'es'}</span>
          </div>

          {loading ? (
            <div className="mt-8 text-slate-500 dark:text-gray-200">{t(effectiveLang, 'Loading favorites...')}</div>
          ) : favorites.length === 0 ? (
            <div className="mt-8 rounded-2xl border border-dashed border-slate-300 dark:border-gray-600 p-6 text-center text-slate-500 dark:text-gray-200">
              {t(effectiveLang, 'You have no favorite businesses yet. Visit a business page and click the heart to add favorites.')}
            </div>
          ) : (
            <div className="mt-8 space-y-8">
              {groupedFavorites.map(([category, items]) => (
                <div key={category}>
                  {category ? <h3 className="text-lg font-semibold text-slate-900 dark:text-gray-100">{category}</h3> : null}
                  <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {items.map((biz) => (
                      <div
                        key={biz.id}
                        className="group relative rounded-2xl border border-slate-200 dark:border-gray-600 bg-white dark:bg-gray-700/80 p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-slate-300 dark:hover:border-gray-500 hover:shadow-md"
                      >
                        <Link href={`/business/${biz.slug || biz.id}`} className="flex items-center gap-3">
                          <div className="h-12 w-12 rounded-xl overflow-hidden border border-slate-200 dark:border-gray-600 bg-slate-100 dark:bg-gray-600 shrink-0">
                            {biz.logo_url ? (
                              <img
                                src={biz.logo_url}
                                alt={biz.business_name || 'Business'}
                                className="h-full w-full object-cover"
                                onError={(e) => {
                                  e.currentTarget.src = 'https://placehold.co/48x48/94a3b8/ffffff?text=Logo';
                                  e.currentTarget.onerror = null;
                                }}
                              />
                            ) : (
                              <div className="flex h-full w-full items-center justify-center text-xs font-semibold text-slate-500 dark:text-gray-400">
                                <Building2 className="h-6 w-6" />
                              </div>
                            )}
                          </div>
                          <div className="min-w-0">
                            <p className="truncate font-semibold text-slate-900 dark:text-gray-100">{biz.business_name || 'Business'}</p>
                            <p className="text-xs text-slate-500 dark:text-gray-200">
                              {biz.address?.city || ''}{biz.address?.state ? `, ${biz.address.state}` : ''}
                            </p>
                          </div>
                        </Link>
                        <button
                          type="button"
                          onClick={() => removeFavorite(biz.id)}
                          className="absolute top-3 right-3 rounded-lg p-1.5 text-slate-400 dark:text-gray-500 hover:bg-red-50 dark:hover:bg-red-900/40 hover:text-red-600 dark:hover:text-red-400 transition"
                          title={t(effectiveLang, 'Remove from favorites')}
                        >
                          <Heart className="h-4 w-4 fill-red-500 dark:fill-red-400" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Following organizations – header and empty state use light text in dark mode via globals */}
          <div className="dashboard-following-orgs mt-10 border-t border-slate-100 dark:border-gray-600 pt-8">
            <div className="following-orgs-header flex items-center justify-between gap-4 text-slate-900 dark:text-white">
              <div>
                <p className="following-orgs-light text-xs font-semibold uppercase tracking-wider dark:text-white">{t(effectiveLang, 'Following')}</p>
                <h3 className="following-orgs-light mt-1 text-lg font-semibold dark:text-white">{t(effectiveLang, 'Organizations')}</h3>
              </div>
              <div className="flex items-center gap-3">
                <span className="following-orgs-light text-sm dark:text-white">{followedOrgs.length} {t(effectiveLang, 'total')}</span>
                {(followedOrgs.length > 0 || followedOrgsLoading) && (
                  <button
                    type="button"
                    onClick={() => setFollowingOrgsCollapsed((c) => !c)}
                    className="following-orgs-light text-xs font-medium underline hover:no-underline focus:outline-none dark:text-white"
                  >
                    {followingOrgsCollapsed ? t(effectiveLang, 'Show') : t(effectiveLang, 'Hide')}
                  </button>
                )}
              </div>
            </div>
            {followedOrgsLoading ? (
              <div className="following-orgs-header following-orgs-light mt-4 text-sm text-slate-600 dark:text-white">{t(effectiveLang, 'Loading...')}</div>
            ) : followedOrgs.length === 0 ? (
              <div className="following-orgs-empty mt-6 rounded-2xl border border-dashed border-indigo-200 dark:border-gray-600 p-6 text-center text-slate-600 dark:text-white">
                <span className="following-orgs-light text-sm">{t(effectiveLang, 'No organizations followed yet. Visit an organization page and click Follow.')}</span>
              </div>
            ) : !followingOrgsCollapsed ? (
              <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {followedOrgs.map((org) => (
                  <Link
                    key={org.user_id}
                    href={org.username ? `/organization/${org.username}` : '#'}
                    className="following-orgs-card flex items-center gap-3 rounded-2xl border border-indigo-100 dark:border-gray-400 bg-white dark:bg-gray-100 p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-indigo-200 dark:hover:border-gray-400 dark:hover:shadow-md"
                  >
                    <div className="h-12 w-12 rounded-xl overflow-hidden border border-indigo-100 dark:border-gray-300 bg-indigo-50 dark:bg-indigo-100 shrink-0">
                      {org.logo_url ? (
                        <img src={org.logo_url} alt={org.full_name || 'Org'} className="h-full w-full object-cover" onError={(e) => { e.currentTarget.src = 'https://placehold.co/48x48/94a3b8/ffffff?text=Org'; e.currentTarget.onerror = null; }} />
                      ) : (
                        <div className="following-orgs-light flex h-full w-full items-center justify-center"><Building2 className="h-6 w-6" /></div>
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="following-orgs-light truncate font-semibold">{org.full_name || 'Organization'}</p>
                      <p className="following-orgs-light text-xs">{org.username ? `@${org.username}` : ''}</p>
                    </div>
                  </Link>
                ))}
              </div>
            ) : null}
          </div>

          {/* Favorite items */}
          <div className="mt-10 border-t border-slate-100 dark:border-gray-600 pt-8">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-emerald-600 dark:text-gray-200">{t(effectiveLang, 'Marketplace')}</p>
                <h3 className="mt-1 text-lg font-semibold text-slate-900 dark:text-gray-100">{t(effectiveLang, 'Favorite Items')}</h3>
              </div>
              <span className="text-sm text-slate-500 dark:text-gray-200">{favoriteItems.length} item{favoriteItems.length === 1 ? '' : 's'}</span>
            </div>
            {favoriteItems.length === 0 ? (
              <div className="mt-6 rounded-2xl border border-dashed border-slate-300 dark:border-gray-600 p-6 text-center text-slate-500 dark:text-gray-200">
                {t(effectiveLang, 'You have no favorite items yet. Browse the marketplace and add some.')}
              </div>
            ) : (
              <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {favoriteItems.map((item) => (
                  <div
                    key={item.key}
                    className="group rounded-2xl border border-slate-200 dark:border-gray-600 bg-white dark:bg-gray-700/80 p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-slate-300 dark:hover:border-gray-500 hover:shadow-md"
                  >
                    <Link href={`/marketplace/${item.slug}`} className="block">
                      <div className="h-32 w-full overflow-hidden rounded-xl bg-slate-100 dark:bg-gray-600">
                        <img src={item.image || '/placeholder.jpg'} alt={item.title} className="h-full w-full object-contain" loading="lazy" decoding="async" />
                      </div>
                      <div className="mt-3">
                        <p className="truncate font-semibold text-slate-900 dark:text-gray-100">{item.title}</p>
                        <p className="text-xs text-slate-500 dark:text-gray-200">{item.location || ''}</p>
                        <p className="text-sm font-semibold text-emerald-600 dark:text-emerald-300">{item.price}</p>
                      </div>
                    </Link>
                    <button
                      type="button"
                      onClick={() => {
                        const next = favoriteItems.filter((fav) => fav.key !== item.key);
                        setFavoriteItems(next);
                        localStorage.setItem(FAVORITE_ITEMS_KEY, JSON.stringify(next));
                      }}
                      className="mt-3 text-xs text-red-600 dark:text-red-400 hover:underline flex items-center gap-1"
                    >
                      <Heart className="h-3 w-3" /> {t(effectiveLang, 'Remove')}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
