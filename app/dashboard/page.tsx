'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { supabase } from '@/lib/supabaseClient';

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

const normalizeCategory = (value?: string | null) => {
  const normalized = (value || '').trim().toLowerCase();
  if (!normalized) return '';
  if (normalized === 'something_else' || normalized === 'other') return '';
  if (normalized === 'retails') return 'Retail';
  return value || '';
};

export default function DashboardPage() {
  const [favorites, setFavorites] = useState<FavoriteBusiness[]>([]);
  const [favoriteItems, setFavoriteItems] = useState<FavoriteItem[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const load = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          router.replace('/login');
          return;
        }

        const { data: profile, error: profileError } = await supabase
          .from('registeredaccounts')
          .select('organization')
          .eq('user_id', user.id)
          .maybeSingle();
        if (profileError) throw profileError;
        if (profile?.organization === true) {
          router.replace('/organization/dashboard');
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
      } catch (err: any) {
        toast.error(err?.message || 'Failed to load favorites');
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [router]);

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
    <div className="min-h-screen bg-slate-50 px-4 py-10">
      <div className="max-w-5xl mx-auto">
        <div className="rounded-3xl border border-slate-200 bg-white shadow-lg shadow-slate-100/60 p-6 sm:p-8">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Dashboard</p>
              <h1 className="mt-1 text-2xl font-bold text-slate-900 sm:text-3xl">Favorites</h1>
            </div>
            <div className="text-sm text-slate-500">
              {favorites.length} business{favorites.length === 1 ? '' : 'es'}
            </div>
          </div>

          {loading ? (
            <div className="mt-8 text-slate-500">Loading favorites...</div>
          ) : favorites.length === 0 ? (
            <div className="mt-8 rounded-2xl border border-dashed border-slate-300 p-6 text-center text-slate-500">
              You have no favorite businesses yet.
            </div>
          ) : (
            <div className="mt-8 space-y-8">
              {groupedFavorites.map(([category, items]) => (
                <div key={category}>
                  {category ? (
                    <h2 className="text-lg font-semibold text-slate-900">{category}</h2>
                  ) : null}
                  <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {items.map((biz) => (
                      <Link
                        key={biz.id}
                        href={`/business/${biz.slug}`}
                        className="group rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md"
                      >
                        <div className="flex items-center gap-3">
                          <div className="h-12 w-12 rounded-xl overflow-hidden border border-slate-200 bg-slate-100">
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
                        </div>
                      </Link>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="mt-10 border-t border-slate-100 pt-8">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Marketplace</p>
                <h2 className="mt-1 text-xl font-semibold text-slate-900">Favorite Items</h2>
              </div>
              <div className="text-sm text-slate-500">
                {favoriteItems.length} item{favoriteItems.length === 1 ? '' : 's'}
              </div>
            </div>

            {favoriteItems.length === 0 ? (
              <div className="mt-6 rounded-2xl border border-dashed border-slate-300 p-6 text-center text-slate-500">
                You have no favorite items yet.
              </div>
            ) : (
              <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {favoriteItems.map((item) => (
                  <div
                    key={item.key}
                    className="group rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md"
                  >
                    <Link href={`/marketplace/${item.slug}`} className="block">
                      <div className="h-32 w-full overflow-hidden rounded-xl bg-slate-100">
                        <img
                          src={item.image || '/placeholder.jpg'}
                          alt={item.title}
                          className="h-full w-full object-contain"
                          loading="lazy"
                          decoding="async"
                        />
                      </div>
                      <div className="mt-3">
                        <p className="truncate font-semibold text-slate-900">{item.title}</p>
                        <p className="text-xs text-slate-500">{item.location || ''}</p>
                        <p className="text-sm font-semibold text-emerald-600">{item.price}</p>
                      </div>
                    </Link>
                    <button
                      type="button"
                      onClick={() => {
                        const next = favoriteItems.filter((fav) => fav.key !== item.key);
                        setFavoriteItems(next);
                        localStorage.setItem(FAVORITE_ITEMS_KEY, JSON.stringify(next));
                      }}
                      className="mt-3 text-xs text-red-600 hover:underline"
                    >
                      Remove
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
