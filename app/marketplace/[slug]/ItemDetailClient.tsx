'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';

import { FaHeart, FaRegHeart, FaShareAlt, FaExternalLinkAlt, FaPhoneAlt, FaStore, FaEnvelope, FaWhatsapp, FaChevronLeft, FaChevronRight } from 'react-icons/fa';
import { supabase } from '@/lib/supabaseClient';
import ReportButton from '@/components/ReportButton';

type MarketplaceItem = {
  id: string;
  title: string;
  price: string | number;
  category: string;
  location: string;
  images: string[];
  description: string;
  condition: string;
  created_at?: string | null;
  business_id?: string | null;
  user_id?: string | null;
  source: 'retail' | 'dealership' | 'real_estate' | 'individual';
  /** Optional link for online buyers (e.g. Amazon, eBay). Opens in new tab. */
  external_buy_url?: string | null;
};

type BusinessContact = {
  business_name: string;
  phone?: string | null;
  whatsapp?: string | null;
  email?: string | null;
  slug?: string | null;
};

type IndividualSeller = {
  user_id: string;
  username: string | null;
  profile_pic_url: string | null;
  contact?: { phone?: string; whatsapp?: string; email?: string };
};

type FavoriteItem = {
  key: string;
  id: string;
  source: 'retail' | 'dealership' | 'real_estate' | 'individual';
  slug: string;
  title: string;
  price: string | number;
  image: string;
  location?: string;
};

type RelatedItem = {
  id: string;
  title: string;
  price: string | number;
  slug: string;
  image: string;
  source: 'retail' | 'dealership' | 'real_estate' | 'individual';
  category?: string;
  location?: string;
};

const getStorageUrl = (bucket: string, path?: string | null) => {
  if (!path) return '';
  if (path.startsWith('http')) return path;
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  return `${base}/storage/v1/object/public/${bucket}/${path}`;
};

const normalizeImages = (value: unknown, bucket: string): string[] => {
  if (!value) return [];
  if (Array.isArray(value)) {
    return value.map((item) => getStorageUrl(bucket, String(item))).filter(Boolean);
  }
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) {
        return parsed.map((item) => getStorageUrl(bucket, String(item))).filter(Boolean);
      }
      return [getStorageUrl(bucket, value)].filter(Boolean);
    } catch {
      return [getStorageUrl(bucket, value)].filter(Boolean);
    }
  }
  return [];
};

const formatDateLabel = (value?: string | null) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString();
};

const normalizePhone = (value?: string | null) => (value || '').replace(/[^\d+]/g, '');

export default function ItemDetailClient() {
  const params = useParams();
  const slug = String(params?.slug || '');
  const [item, setItem] = useState<MarketplaceItem | null>(null);
  const [business, setBusiness] = useState<BusinessContact | null>(null);
  const [individualSeller, setIndividualSeller] = useState<IndividualSeller | null>(null);
  const [favoriteItems, setFavoriteItems] = useState<FavoriteItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [currentUrl, setCurrentUrl] = useState('');
  const [copied, setCopied] = useState(false);
  const [sharedWithFallback, setSharedWithFallback] = useState(false);
  const [imageIndex, setImageIndex] = useState(0);
  const [dragOffsetPx, setDragOffsetPx] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [relatedItems, setRelatedItems] = useState<RelatedItem[]>([]);
  const [relatedLoading, setRelatedLoading] = useState(false);
  const galleryRef = useRef<HTMLDivElement>(null);
  const relatedScrollRef = useRef<HTMLDivElement>(null);
  const pointerStartRef = useRef<{ x: number; index: number } | null>(null);
  const dragOffsetRef = useRef(0);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setCurrentUrl(window.location.href);
    }
  }, []);

  useEffect(() => {
    setImageIndex(0);
    setDragOffsetPx(0);
    pointerStartRef.current = null;
  }, [item?.id]);

  const galleryWidth = galleryRef.current?.offsetWidth ?? 0;
  const numImages = item?.images?.length ?? 0;
  const goPrev = useCallback(() => {
    if (numImages === 0) return;
    setImageIndex((i) => (i === 0 ? numImages - 1 : i - 1));
  }, [numImages]);
  const goNext = useCallback(() => {
    if (numImages === 0) return;
    setImageIndex((i) => (i === numImages - 1 ? 0 : i + 1));
  }, [numImages]);

  const handleGalleryPointerDown = useCallback((e: React.PointerEvent) => {
    if (numImages <= 1) return;
    pointerStartRef.current = { x: e.clientX, index: imageIndex };
    setIsDragging(true);
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
  }, [numImages, imageIndex]);

  const handleGalleryPointerMove = useCallback((e: React.PointerEvent) => {
    if (!pointerStartRef.current || numImages <= 1) return;
    const w = galleryRef.current?.offsetWidth ?? 0;
    if (w <= 0) return;
    const delta = e.clientX - pointerStartRef.current.x;
    const maxDrag = w * 0.5;
    const clamped = Math.max(-maxDrag, Math.min(maxDrag, delta));
    dragOffsetRef.current = clamped;
    setDragOffsetPx(clamped);
  }, [numImages]);

  const handleGalleryPointerUp = useCallback((e: React.PointerEvent) => {
    const target = e.target as HTMLElement;
    target.releasePointerCapture?.(e.pointerId);
    if (!pointerStartRef.current || numImages <= 1) {
      pointerStartRef.current = null;
      setIsDragging(false);
      setDragOffsetPx(0);
      dragOffsetRef.current = 0;
      return;
    }
    const w = galleryRef.current?.offsetWidth ?? 0;
    const threshold = w * 0.15;
    const offset = dragOffsetRef.current;
    if (offset > threshold) {
      goPrev();
    } else if (offset < -threshold) {
      goNext();
    }
    setDragOffsetPx(0);
    dragOffsetRef.current = 0;
    setIsDragging(false);
    pointerStartRef.current = null;
  }, [numImages, goPrev, goNext]);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setFavoriteItems([]);
        return;
      }
      const { data: favRows } = await supabase
        .from('user_marketplace_favorites')
        .select('item_key, item_snapshot')
        .eq('user_id', user.id)
        .order('created_at', { ascending: true });
      const items = (favRows || []).map((r: { item_key: string; item_snapshot: Record<string, unknown> }) => ({
        key: r.item_key,
        id: (r.item_snapshot?.id as string) ?? '',
        source: (r.item_snapshot?.source as 'retail' | 'dealership' | 'real_estate' | 'individual') ?? 'individual',
        slug: (r.item_snapshot?.slug as string) ?? '',
        title: (r.item_snapshot?.title as string) ?? '',
        price: (r.item_snapshot?.price as string | number) ?? '',
        image: (r.item_snapshot?.image as string) ?? '',
        location: (r.item_snapshot?.location as string) ?? '',
      }));
      setFavoriteItems(items);
    })();
  }, []);

  useEffect(() => {
    if (!slug) return;
    let cancelled = false;

    const loadItem = async () => {
      setError(null);

      const parseIdFromSlug = (prefix: string) =>
        slug.startsWith(prefix) ? slug.replace(prefix, '') : null;

      const individualId = parseIdFromSlug('individual-');
      if (individualId) {
        const { data: individualRow, error: indErr } = await supabase
          .from('marketplace_items')
          .select('*')
          .eq('id', individualId)
          .maybeSingle();

        if (indErr || !individualRow) {
          if (!cancelled) setError('Item not found.');
          return;
        }

        const raw = individualRow.image_urls ?? individualRow.imageUrls;
        const urls = normalizeImages(raw, 'marketplace-images');
        const mappedItem: MarketplaceItem = {
          id: String(individualRow.id),
          title: individualRow.title || 'Listing',
          price: individualRow.price ?? '',
          category: individualRow.category || 'General',
          location: individualRow.location || '',
          description: individualRow.description || '',
          condition: individualRow.condition || '',
          images: urls,
          created_at: individualRow.created_at || null,
          business_id: null,
          user_id: individualRow.user_id || null,
          source: 'individual',
          external_buy_url: (individualRow as { external_buy_url?: string | null }).external_buy_url ?? null,
        };

        if (!cancelled) setItem(mappedItem);
        setBusiness(null);

        const contact = (individualRow as any).contact && typeof (individualRow as any).contact === 'object'
          ? (individualRow as any).contact
          : {
              phone: (individualRow as any).contact_phone ?? null,
              whatsapp: (individualRow as any).contact_whatsapp ?? null,
              email: (individualRow as any).contact_email ?? null,
            };

        if (individualRow.user_id) {
          const [{ data: profData }, { data: regData }] = await Promise.all([
            supabase.from('profiles').select('username, profile_pic_url').eq('id', individualRow.user_id).maybeSingle(),
            supabase.from('registeredaccounts').select('username').eq('user_id', individualRow.user_id).maybeSingle(),
          ]);
          const username = profData?.username ?? regData?.username ?? null;
          let profile_pic_url = profData?.profile_pic_url ?? null;
          if (profile_pic_url && !profile_pic_url.startsWith('http')) {
            profile_pic_url = getStorageUrl('avatars', profile_pic_url);
          }
          if (!cancelled) {
            setIndividualSeller({
              user_id: individualRow.user_id,
              username,
              profile_pic_url,
              contact: (contact?.phone || contact?.whatsapp || contact?.email) ? contact : undefined,
            });
          }
        }
        return;
      }

      const fetchRetailBySlug = async () => supabase
        .from('retail_items')
        .select('*')
        .eq('slug', slug)
        .maybeSingle();

      const fetchDealershipBySlug = async () => supabase
        .from('dealerships')
        .select('*')
        .eq('slug', slug)
        .maybeSingle();

      const retailId = parseIdFromSlug('retail-');
      const dealershipId = parseIdFromSlug('dealership-');
      const realEstateId = parseIdFromSlug('real-estate-');

      const [retailRaw, dealershipRaw, realEstateRaw] = await Promise.all([
        fetchRetailBySlug(),
        fetchDealershipBySlug(),
        realEstateId ? supabase.from('real_estate_listings').select('*').eq('id', realEstateId).maybeSingle() : Promise.resolve({ data: null, error: null }),
      ]);

      let retailRes = { data: retailRaw.error ? null : retailRaw.data };
      let dealershipRes = { data: dealershipRaw.error ? null : dealershipRaw.data };
      let realEstateRes = { data: realEstateRaw.error ? null : realEstateRaw.data };

      if (!retailRes.data && retailId) {
        retailRes = await supabase.from('retail_items').select('*').eq('id', retailId).maybeSingle();
      }
      if (!dealershipRes.data && dealershipId) {
        dealershipRes = await supabase.from('dealerships').select('*').eq('id', dealershipId).maybeSingle();
      }

      const retailItem = retailRes.data;
      const dealershipItem = dealershipRes.data;
      const realEstateItem = realEstateRes.data;
      const source = retailItem ? 'retail' : dealershipItem ? 'dealership' : realEstateItem ? 'real_estate' : null;

      if (!source) {
        if (!cancelled) setError('Item not found.');
        return;
      }

      setIndividualSeller(null);

      const row = retailItem || dealershipItem || realEstateItem;
      let locationFromRow = row.location || row.city || row.address || '';
      if (typeof locationFromRow === 'object') locationFromRow = '';

      const bucket = source === 'retail' ? 'retail-items' : source === 'real_estate' ? 'real-estate-listings' : 'car-listings';
      const mappedItem: MarketplaceItem = {
        id: String(row.id),
        title: row.title || row.name || row.vehicle_name || row.model || 'Listing',
        price: row.price ?? row.amount ?? row.cost ?? '',
        category: row.category || row.type || row.property_type || (source === 'retail' ? 'Retail' : source === 'real_estate' ? 'Real Estate' : 'Dealership'),
        location: locationFromRow,
        description: row.description || row.details || row.notes || '',
        condition: row.condition || row.item_condition || '',
        images: normalizeImages(row.images ?? row.image_url ?? row.image_urls ?? row.photos, bucket),
        created_at: row.created_at || row.createdAt || null,
        business_id: row.business_id || null,
        source,
      };

      if (row.business_id) {
        const { data: businessData } = await supabase
          .from('businesses')
          .select('business_name, phone, whatsapp, email, slug, address')
          .eq('id', row.business_id)
          .maybeSingle();
        if (!cancelled && businessData) {
          setBusiness(businessData);
          let addr: { city?: string; state?: string } | null = null;
          if (businessData.address) {
            if (typeof businessData.address === 'object') addr = businessData.address as { city?: string; state?: string };
            else if (typeof businessData.address === 'string') {
              try { addr = JSON.parse(businessData.address) as { city?: string; state?: string }; } catch { /* ignore */ }
            }
          }
          if (addr && (addr.city || addr.state)) {
            const cityState = [addr.city, addr.state].filter(Boolean).join(', ');
            if (cityState) mappedItem.location = cityState;
          }
        }
      }

      if (!cancelled) {
        setItem(mappedItem);
      }
    };

    loadItem();
    return () => {
      cancelled = true;
    };
  }, [slug]);

  // Related items – from API (service role) so RLS does not block other listings (e.g. Clothing)
  useEffect(() => {
    if (!item?.id) {
      setRelatedItems([]);
      return;
    }
    let cancelled = false;
    setRelatedLoading(true);
    const params = new URLSearchParams({
      excludeId: item.id,
      source: item.source || 'individual',
    });
    const category = (item?.category || '').trim();
    const location = (item?.location || '').trim();
    if (category) params.set('category', category);
    if (location) params.set('location', location);

    fetch(`/api/marketplace/related-items?${params.toString()}`)
      .then((res) => res.json())
      .then((data: { items?: RelatedItem[] }) => {
        if (!cancelled && Array.isArray(data?.items)) {
          setRelatedItems(data.items.slice(0, 12));
        }
      })
      .catch(() => {
        if (!cancelled) setRelatedItems([]);
      })
      .finally(() => {
        if (!cancelled) setRelatedLoading(false);
      });
    return () => { cancelled = true; };
  }, [item?.id, item?.source, item?.category, item?.location]);

  // Track view (internal count; not shown to public)
  useEffect(() => {
    if (!item?.id) return;
    const typeMap = { individual: 'marketplace_item', retail: 'retail_item', dealership: 'dealership', real_estate: 'real_estate' } as const;
    const type = typeMap[item.source];
    if (!type) return;
    fetch('/api/track-view', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type, id: item.id }),
    }).catch(() => {});
  }, [item?.id, item?.source]);

  const getFavoriteKey = (value: MarketplaceItem) => `${value.source}:${value.id}`;
  const isFavorited = item ? favoriteItems.some((fav) => fav.key === getFavoriteKey(item)) : false;

  const toggleFavorite = async () => {
    if (!item) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const key = getFavoriteKey(item);
    const isCurrentlyFav = favoriteItems.some((fav) => fav.key === key);
    if (isCurrentlyFav) {
      const { error } = await supabase
        .from('user_marketplace_favorites')
        .delete()
        .eq('user_id', user.id)
        .eq('item_key', key);
      if (!error) setFavoriteItems((prev) => prev.filter((fav) => fav.key !== key));
    } else {
      const snapshot = {
        id: item.id,
        source: item.source,
        slug: slug || item.id,
        title: item.title,
        price: item.price,
        image: item.images[0] || '/placeholder.jpg',
        location: item.location ?? '',
      };
      const { error } = await supabase.from('user_marketplace_favorites').insert({
        user_id: user.id,
        item_key: key,
        item_snapshot: snapshot,
      });
      if (!error)
        setFavoriteItems((prev) => [...prev, { key, ...snapshot }]);
    }
  };

  const handleNativeShare = () => {
    if (navigator.share) {
      navigator
        .share({
          title: item?.title || '',
          text: 'Check out this item on Hanar!',
          url: currentUrl,
        })
        .then(() => console.log('Shared successfully'))
        .catch((error) => console.error('Error sharing:', error));
    } else {
      alert('Sharing is not supported on your browser.');
    }
  };
  
  const copyLinkFallback = () => {
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(currentUrl)
        .then(() => {
          setCopied(true);
          setSharedWithFallback(true);
          setTimeout(() => {
            setCopied(false);
            setSharedWithFallback(false);
          }, 2000);
        })
        .catch(() => {
          fallbackToTextareaCopy();
        });
    } else {
      fallbackToTextareaCopy();
    }
  };

  const fallbackToTextareaCopy = () => {
    const textArea = document.createElement('textarea');
    textArea.value = currentUrl;
    textArea.style.position = 'fixed';
    textArea.style.opacity = '0';
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    try {
      const successful = document.execCommand('copy');
      if (successful) {
        setCopied(true);
        setSharedWithFallback(true);
        setTimeout(() => {
          setCopied(false);
          setSharedWithFallback(false);
        }, 2000);
      } else {
        alert('Could not copy. Try manually selecting the address bar.');
      }
    } catch (err) {
      alert('Copy failed. Try manually selecting the address bar.');
    }
    document.body.removeChild(textArea);
  };

  if (error) return <div className="text-center py-10 text-sm text-red-600">{error}</div>;
  if (!item) return <div className="text-center py-10">Loading...</div>;

  return (
    <div className="max-w-3xl mx-auto px-4 py-6">


      <div className="bg-white shadow-md rounded-2xl overflow-hidden p-5 sm:p-6">
        {/* Top Info Box */}
        <div className="flex justify-between items-start gap-4 mb-4">
          <div className="min-w-0 flex-1">
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white tracking-tight leading-tight">
              {item.title}
            </h1>
            <p className="mt-2 text-2xl sm:text-3xl font-bold tabular-nums text-emerald-600 dark:text-emerald-400">
              {typeof item.price === 'number' ? `$${Number(item.price).toLocaleString()}` : item.price}
            </p>
            {item.condition && (
              <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
                <span
                  className={`inline-flex items-center px-2.5 py-1 rounded-full font-medium ${
                    item.condition === 'New'
                      ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-200'
                      : 'bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-200'
                  }`}
                >
                  {item.condition}
                </span>
                {formatDateLabel(item.created_at) && (
                  <span className="text-slate-500 dark:text-slate-400">{formatDateLabel(item.created_at)}</span>
                )}
              </div>
            )}
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {item.category && (
                <span className="inline-flex items-center px-3 py-1.5 rounded-lg text-sm font-medium bg-indigo-100 text-indigo-800 dark:bg-indigo-900/50 dark:text-indigo-200">
                  {item.category}
                </span>
              )}
              {item.location && (
                <span className="inline-flex items-center px-3 py-1.5 rounded-lg text-sm font-medium bg-slate-200 text-slate-700 dark:bg-slate-600/50 dark:text-slate-200">
                  {item.location}
                </span>
              )}
            </div>
            {item.description && (
              <p className="mt-4 text-slate-600 dark:text-slate-300 leading-relaxed text-[15px]">
                {item.description}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={toggleFavorite}
            className="text-lg mt-1"
            aria-label={isFavorited ? 'Remove from favorites' : 'Add to favorites'}
          >
            {isFavorited ? (
              <FaHeart className="text-red-500" />
            ) : (
              <FaRegHeart className="text-gray-400 hover:text-red-500" />
            )}
          </button>
        </div>

        {/* Image gallery – slide (swipe/drag left & right); container fits each photo, no blank space */}
        {item.images.length > 0 && (
          <div className="mb-4">
            <div
              ref={galleryRef}
              className="relative w-full overflow-hidden rounded-2xl bg-slate-100 select-none touch-pan-y"
              onPointerDown={handleGalleryPointerDown}
              onPointerMove={handleGalleryPointerMove}
              onPointerUp={handleGalleryPointerUp}
              onPointerLeave={handleGalleryPointerUp}
              onPointerCancel={handleGalleryPointerUp}
            >
              <div
                className="flex"
                style={{
                  width: `${item.images.length * 100}%`,
                  transform: `translateX(calc(-${imageIndex * (100 / item.images.length)}% + ${dragOffsetPx}px))`,
                  transition: isDragging ? 'none' : 'transform 0.25s ease-out',
                }}
              >
                {item.images.map((img, idx) => (
                  <div
                    key={idx}
                    className="flex-shrink-0 bg-slate-100"
                    style={{ width: `${100 / item.images.length}%` }}
                  >
                    <img
                      src={img}
                      alt={`Item image ${idx + 1} of ${item.images.length}`}
                      loading={idx <= 1 ? 'eager' : 'lazy'}
                      decoding="async"
                      className="block w-full h-auto max-h-[85vh] object-contain"
                      draggable={false}
                    />
                  </div>
                ))}
              </div>
              {item.images.length > 1 && (
                <>
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); goPrev(); }}
                    className="absolute left-2 top-1/2 z-10 -translate-y-1/2 flex h-10 w-10 items-center justify-center rounded-full bg-black/50 text-white hover:bg-black/70 focus:outline-none focus:ring-2 focus:ring-white/50 transition"
                    aria-label="Previous image"
                  >
                    <FaChevronLeft className="h-5 w-5" />
                  </button>
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); goNext(); }}
                    className="absolute right-2 top-1/2 z-10 -translate-y-1/2 flex h-10 w-10 items-center justify-center rounded-full bg-black/50 text-white hover:bg-black/70 focus:outline-none focus:ring-2 focus:ring-white/50 transition"
                    aria-label="Next image"
                  >
                    <FaChevronRight className="h-5 w-5" />
                  </button>
                  <div className="absolute bottom-3 left-0 right-0 z-10 flex justify-center gap-1.5">
                    {item.images.map((_, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={(e) => { e.stopPropagation(); setImageIndex(idx); }}
                        className={`h-2 rounded-full transition-all ${
                          idx === imageIndex ? 'w-6 bg-white' : 'w-2 bg-white/60 hover:bg-white/80'
                        }`}
                        aria-label={`Go to image ${idx + 1}`}
                      />
                    ))}
                  </div>
                  <span className="absolute top-2 right-2 z-10 rounded-full bg-black/50 px-2 py-0.5 text-xs font-medium text-white">
                    {imageIndex + 1} / {item.images.length}
                  </span>
                </>
              )}
            </div>
          </div>
        )}

        {/* Buy online (external link) */}
        {item.external_buy_url && (
          <div className="relative overflow-hidden rounded-2xl mb-4 bg-gradient-to-br from-slate-900 to-slate-800 p-5 shadow-lg">
            <div className="relative z-10">
              <p className="text-xs font-medium uppercase tracking-wider text-slate-400 mb-2">Also available online</p>
              <a
                href={item.external_buy_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-3 rounded-xl bg-white text-slate-900 font-semibold text-sm px-5 py-3 shadow-md hover:bg-slate-50 hover:shadow-lg hover:scale-[1.02] active:scale-[0.98] transition-all duration-200"
              >
                <span>Buy on external site</span>
                <FaExternalLinkAlt className="h-4 w-4 opacity-70" />
              </a>
              <p className="text-xs text-slate-500 mt-2.5">Opens in a new tab</p>
            </div>
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(255,255,255,0.08),transparent)] pointer-events-none" aria-hidden />
          </div>
        )}

        {/* Seller / Business Info */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm mb-4">
          <h2 className="font-semibold text-slate-800 mb-3">Contact seller</h2>
          {individualSeller ? (
            <>
              <div className="flex items-center gap-3 mb-4">
                <Link
                  href={individualSeller.username ? `/profile/${individualSeller.username}` : '#'}
                  className={`flex items-center gap-3 ${individualSeller.username ? 'hover:opacity-90' : ''}`}
                >
                  <div className="h-12 w-12 shrink-0 overflow-hidden rounded-full border-2 border-slate-200 bg-slate-100 ring-2 ring-transparent transition hover:ring-slate-300">
                    {individualSeller.profile_pic_url ? (
                      <img
                        src={individualSeller.profile_pic_url}
                        alt={individualSeller.username ? `@${individualSeller.username}` : 'Seller'}
                        className="h-full w-full object-cover"
                        onError={(e) => { e.currentTarget.src = '/default-avatar.png'; e.currentTarget.onerror = null; }}
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-lg text-slate-400">👤</div>
                    )}
                  </div>
                  <div>
                    <span className="font-semibold text-indigo-600 hover:underline">
                      {individualSeller.username ? `@${individualSeller.username}` : 'Individual seller'}
                    </span>
                  </div>
                </Link>
              </div>
              {(individualSeller.contact?.phone || individualSeller.contact?.whatsapp || individualSeller.contact?.email) && (
                <div className="flex flex-wrap gap-3">
                  {individualSeller.contact?.phone && (
                    <a
                      href={`tel:${normalizePhone(individualSeller.contact.phone)}`}
                      className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 text-white text-sm font-medium px-4 py-2.5 shadow-md hover:bg-emerald-700 hover:shadow-lg hover:scale-[1.02] active:scale-[0.98] transition-all duration-200"
                    >
                      <FaPhoneAlt className="h-4 w-4 opacity-90" />
                      Call
                    </a>
                  )}
                  {individualSeller.contact?.whatsapp && (
                    <a
                      href={`https://wa.me/${normalizePhone(individualSeller.contact.whatsapp)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 rounded-xl bg-[#25D366] text-white text-sm font-medium px-4 py-2.5 shadow-md hover:bg-[#20BD5A] hover:shadow-lg hover:scale-[1.02] active:scale-[0.98] transition-all duration-200"
                    >
                      <FaWhatsapp className="h-5 w-5" />
                      WhatsApp
                    </a>
                  )}
                  {individualSeller.contact?.email && (
                    <a
                      href={`mailto:${individualSeller.contact.email}`}
                      className="inline-flex items-center gap-2 rounded-xl bg-slate-700 text-white text-sm font-medium px-4 py-2.5 shadow-md hover:bg-slate-800 hover:shadow-lg hover:scale-[1.02] active:scale-[0.98] transition-all duration-200"
                    >
                      <FaEnvelope className="h-4 w-4 opacity-90" />
                      Email
                    </a>
                  )}
                </div>
              )}
            </>
          ) : business ? (
            <>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-4">
                <Link href={`/business/${business.slug || ''}`} className="flex items-center gap-3 hover:opacity-90">
                  <div className="h-12 w-12 rounded-xl overflow-hidden bg-slate-100 border border-slate-200 shrink-0 flex items-center justify-center">
                    <FaStore className="h-6 w-6 text-slate-500" />
                  </div>
                  <div>
                    <span className="text-sm font-semibold text-slate-800 hover:underline">
                      {business.business_name}
                    </span>
                    <p className="text-xs text-slate-500">Verified business</p>
                  </div>
                </Link>
                <Link
                  href={`/business/${business.slug || ''}`}
                  className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 text-white text-sm font-medium px-4 py-2.5 shadow-md hover:bg-indigo-700 hover:shadow-lg hover:scale-[1.02] active:scale-[0.98] transition-all duration-200"
                >
                  <FaStore className="h-4 w-4 opacity-90" />
                  Visit Business
                </Link>
              </div>
              <div className="flex flex-wrap gap-3">
                {business.phone && (
                  <a
                    href={`tel:${normalizePhone(business.phone)}`}
                    className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 text-white text-sm font-medium px-4 py-2.5 shadow-md hover:bg-emerald-700 hover:shadow-lg hover:scale-[1.02] active:scale-[0.98] transition-all duration-200"
                  >
                    <FaPhoneAlt className="h-4 w-4 opacity-90" />
                    Call
                  </a>
                )}
                {business.whatsapp && (
                  <a
                    href={`https://wa.me/${normalizePhone(business.whatsapp)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 rounded-xl bg-[#25D366] text-white text-sm font-medium px-4 py-2.5 shadow-md hover:bg-[#20BD5A] hover:shadow-lg hover:scale-[1.02] active:scale-[0.98] transition-all duration-200"
                  >
                    <FaWhatsapp className="h-5 w-5" />
                    WhatsApp
                  </a>
                )}
              </div>
            </>
          ) : (
            <p className="text-sm text-slate-500">Seller details unavailable.</p>
          )}
        </div>

        {/* Share Button Box */}
        <div className="bg-gray-50 p-4 rounded-xl mb-4">
          <h2 className="font-semibold text-sm text-gray-700 mb-2">Share</h2>
          <button
            onClick={handleNativeShare}
            className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-full flex items-center gap-2 text-sm mb-2"
          >
            <FaShareAlt /> Share Item
          </button>
          {!navigator.share && (
            <div className="text-sm text-gray-500">
              Sharing not supported —
              <button
                onClick={copyLinkFallback}
                className="underline text-blue-600 ml-1"
              >
                Copy link instead
              </button>
              {copied && (
                <span className="ml-2 text-green-600">
                  {sharedWithFallback ? '✓ Link copied!' : '✓ Copied!'}
                </span>
              )}
            </div>
          )}
        </div>

        {/* Related items – always show section when item is loaded */}
        {item && (
          <div className="mt-8 mb-4">
            <h2 className="font-semibold text-slate-800 mb-3">Related items</h2>
            {relatedLoading ? (
              <div className="flex gap-3 overflow-hidden">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div key={i} className="h-48 w-40 shrink-0 rounded-xl bg-slate-100 animate-pulse" />
                ))}
              </div>
            ) : relatedItems.length > 0 ? (
              <div className="relative">
                <div
                  ref={relatedScrollRef}
                  className="flex gap-4 overflow-x-auto overflow-y-hidden pb-2 scroll-smooth snap-x snap-mandatory hide-scrollbar"
                  style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
                >
                  {relatedItems.map((r) => (
                    <Link
                      key={`${r.source}-${r.id}`}
                      href={`/marketplace/${r.slug}`}
                      className="shrink-0 w-40 snap-start rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden hover:shadow-md hover:border-slate-300 transition"
                    >
                      <div className="aspect-square bg-slate-100 relative">
                        <img
                          src={r.image || '/placeholder.jpg'}
                          alt=""
                          className="absolute inset-0 h-full w-full object-cover"
                          onError={(e) => { e.currentTarget.src = '/placeholder.jpg'; e.currentTarget.onerror = null; }}
                        />
                      </div>
                      <div className="p-2.5">
                        <p className="text-sm font-medium text-slate-800 truncate" title={r.title}>{r.title}</p>
                        <p className="text-sm font-semibold text-emerald-600 tabular-nums">
                          {typeof r.price === 'number' ? `$${Number(r.price).toLocaleString()}` : (r.price ? `$${String(r.price)}` : '—')}
                        </p>
                      </div>
                    </Link>
                  ))}
                </div>
                {relatedItems.length > 4 && (
                  <>
                    <button
                      type="button"
                      onClick={() => relatedScrollRef.current?.scrollBy({ left: -180, behavior: 'smooth' })}
                      className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-1 z-10 h-10 w-10 rounded-full bg-white border border-slate-200 shadow-md flex items-center justify-center text-slate-600 hover:bg-slate-50"
                      aria-label="Previous"
                    >
                      <FaChevronLeft className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => relatedScrollRef.current?.scrollBy({ left: 180, behavior: 'smooth' })}
                      className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-1 z-10 h-10 w-10 rounded-full bg-white border border-slate-200 shadow-md flex items-center justify-center text-slate-600 hover:bg-slate-50"
                      aria-label="Next"
                    >
                      <FaChevronRight className="h-4 w-4" />
                    </button>
                  </>
                )}
              </div>
            ) : (
              <p className="text-sm text-slate-500">No related items right now. Check back later or browse the marketplace.</p>
            )}
          </div>
        )}

        {/* Report */}
        {item && (
          <div className="text-right">
            <ReportButton
              entityType="item"
              entityId={item.id}
              entityTitle={item.title}
              variant="text"
            />
          </div>
        )}
      </div>
    </div>
  );
}
