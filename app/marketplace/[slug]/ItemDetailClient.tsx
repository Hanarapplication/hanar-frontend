'use client';

import { useEffect, useLayoutEffect, useState, useRef, useCallback } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';

import { FaHeart, FaRegHeart, FaShareAlt, FaExternalLinkAlt, FaPhoneAlt, FaStore, FaEnvelope, FaWhatsapp, FaChevronLeft, FaChevronRight, FaCommentDots, FaEllipsisH } from 'react-icons/fa';
import { supabase } from '@/lib/supabaseClient';
import ReportButton from '@/components/ReportButton';
import { Avatar } from '@/components/Avatar';
import { recordMarketplaceItemView, readMarketplaceBrowseSignals, personalizationScoreForItem } from '@/lib/marketplacePersonalize';
import { useLanguage } from '@/context/LanguageContext';
import { t } from '@/utils/translations';

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
  id?: string | null;
  owner_id?: string | null;
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

const formatPriceWithCurrency = (value: string | number | null | undefined) => {
  if (value == null) return '';
  const raw = String(value).trim();
  if (!raw) return '';
  if (raw.startsWith('$')) return raw;
  if (/^[A-Za-z]{3}\s+/.test(raw)) return raw;
  const numeric = Number(raw.replace(/,/g, ''));
  if (!Number.isNaN(numeric)) return `$${numeric.toLocaleString()}`;
  return `$${raw}`;
};

export default function ItemDetailClient() {
  const { effectiveLang } = useLanguage();
  const params = useParams();
  const slug = String(params?.slug || '');
  const [item, setItem] = useState<MarketplaceItem | null>(null);
  const [business, setBusiness] = useState<BusinessContact | null>(null);
  const [individualSeller, setIndividualSeller] = useState<IndividualSeller | null>(null);
  const [favoriteItems, setFavoriteItems] = useState<FavoriteItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [currentUrl, setCurrentUrl] = useState('');
  const [imageIndex, setImageIndex] = useState(0);
  const [dragOffsetPx, setDragOffsetPx] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [relatedItems, setRelatedItems] = useState<RelatedItem[]>([]);
  const [relatedLoading, setRelatedLoading] = useState(false);
  const [descriptionExpanded, setDescriptionExpanded] = useState(false);
  const [descriptionOverflows, setDescriptionOverflows] = useState(false);
  const descriptionRef = useRef<HTMLParagraphElement>(null);
  const itemMenuRef = useRef<HTMLDivElement>(null);
  const galleryRef = useRef<HTMLDivElement>(null);
  const [itemMenuOpen, setItemMenuOpen] = useState(false);
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
    setDescriptionExpanded(false);
    setItemMenuOpen(false);
    pointerStartRef.current = null;
  }, [item?.id]);

  useEffect(() => {
    if (!itemMenuOpen) return;
    const onDocMouseDown = (e: MouseEvent) => {
      if (itemMenuRef.current && !itemMenuRef.current.contains(e.target as Node)) {
        setItemMenuOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setItemMenuOpen(false);
    };
    document.addEventListener('mousedown', onDocMouseDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDocMouseDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [itemMenuOpen]);

  useLayoutEffect(() => {
    if (!item?.description?.trim()) {
      setDescriptionOverflows(false);
      return;
    }
    if (descriptionExpanded) return;
    const el = descriptionRef.current;
    if (!el) return;
    setDescriptionOverflows(el.scrollHeight - el.clientHeight > 1);
  }, [item?.id, item?.description, descriptionExpanded]);

  const galleryWidth = galleryRef.current?.offsetWidth ?? 0;
  const numImages = item?.images?.length ?? 0;
  const itemPreviewImage = item?.images?.[0] || '';
  const itemPreviewPrice = formatPriceWithCurrency(item?.price);
  const itemPreviewDescription = (item?.description || '').trim();

  const buildMessageHref = (targetType: 'user' | 'business', targetId: string) => {
    const params = new URLSearchParams({
      targetType,
      targetId,
    });
    if (slug) params.set('itemUrl', `/marketplace/${slug}`);
    if (item?.title) params.set('itemTitle', item.title);
    if (itemPreviewImage) params.set('itemImage', itemPreviewImage);
    if (itemPreviewPrice) params.set('itemPrice', itemPreviewPrice);
    if (itemPreviewDescription) params.set('itemDescription', itemPreviewDescription.slice(0, 700));
    return `/messages?${params.toString()}`;
  };

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
        if (
          individualRow.is_on_hold ||
          (individualRow.expires_at && new Date(individualRow.expires_at).getTime() < Date.now())
        ) {
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
          .select('id, owner_id, business_name, phone, whatsapp, email, slug, address')
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
          const browsed = readMarketplaceBrowseSignals();
          const scored = data.items.map((ri, idx) => ({
            ri,
            idx,
            score: personalizationScoreForItem(
              {
                id: ri.id,
                source: ri.source,
                title: ri.title || '',
                category: ri.category || '',
                location: ri.location,
              },
              browsed
            ),
          }));
          scored.sort((a, b) => {
            if (b.score !== a.score) return b.score - a.score;
            return a.idx - b.idx;
          });
          setRelatedItems(scored.map(({ ri }) => ri).slice(0, 12));
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

  // Local personalization signals for marketplace feed + related rail
  useEffect(() => {
    if (!item?.id || !item.source) return;
    recordMarketplaceItemView({
      source: item.source,
      id: item.id,
      title: item.title || '',
      category: item.category || '',
    });
  }, [item?.id, item?.source, item?.title, item?.category]);

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

  /** Used on gallery chip: share sheet when available, otherwise copy link. */
  const handleGalleryShare = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
      handleNativeShare();
    } else {
      copyLinkFallback();
    }
  };
  
  const copyLinkFallback = () => {
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(currentUrl).catch(() => {
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
      if (!successful) {
        alert(t(effectiveLang, 'Could not copy. Try manually selecting the address bar.'));
      }
    } catch (err) {
      alert(t(effectiveLang, 'Copy failed. Try manually selecting the address bar.'));
    }
    document.body.removeChild(textArea);
  };

  if (error) return <div className="text-center py-4 text-[11px] text-red-600">{error}</div>;
  if (!item) return <div className="text-center py-4 text-xs text-slate-500">{t(effectiveLang, 'Loading...')}</div>;

  const sellerProfileHref =
    individualSeller?.username != null && String(individualSeller.username).trim() !== ''
      ? `/profile/${individualSeller.username}`
      : business?.slug
        ? `/business/${business.slug}`
        : null;

  const marketplaceSellerForReport =
    individualSeller?.user_id
      ? {
          kind: 'user' as const,
          id: individualSeller.user_id,
          displayName: individualSeller.username
            ? `@${individualSeller.username}`
            : t(effectiveLang, 'Individual seller'),
        }
      : business?.id
        ? {
            kind: 'business' as const,
            id: business.id,
            displayName: business.business_name || t(effectiveLang, 'Business'),
          }
        : undefined;

  return (
    <div className="max-w-sm mx-auto px-2 pt-2 pb-5 sm:px-3">


      <div className="bg-white shadow-sm rounded-lg overflow-hidden p-1.5 sm:p-2 text-[10px]">
        {/* Item title – above photos */}
        <div className="mb-1.5 flex justify-between items-start gap-1">
          <h1 className="min-w-0 flex-1 text-[13px] sm:text-sm font-bold text-slate-900 dark:text-white tracking-tight leading-snug">
            {item.title}
          </h1>
          <div className="flex shrink-0 items-center gap-0.5 sm:gap-1">
            <button
              type="button"
              onClick={toggleFavorite}
              className="-m-0.5 rounded-full p-1 text-inherit transition hover:bg-slate-100 active:scale-95 dark:hover:bg-slate-700/80"
              aria-label={isFavorited ? t(effectiveLang, 'Remove from favorites') : t(effectiveLang, 'Add to favorites')}
            >
              {isFavorited ? (
                <FaHeart className="h-5 w-5 text-red-500 sm:h-6 sm:w-6" />
              ) : (
                <FaRegHeart className="h-5 w-5 text-gray-400 hover:text-red-500 sm:h-6 sm:w-6" />
              )}
            </button>
            <div className="relative" ref={itemMenuRef}>
              <button
                type="button"
                onClick={() => setItemMenuOpen((o) => !o)}
                className="-m-0.5 flex h-8 w-8 items-center justify-center rounded-full text-slate-500 transition hover:bg-slate-100 active:scale-95 sm:h-9 sm:w-9 dark:text-slate-400 dark:hover:bg-slate-700/80"
                aria-label={t(effectiveLang, 'More options')}
                aria-expanded={itemMenuOpen}
                aria-haspopup="menu"
              >
                <FaEllipsisH className="h-4 w-4 sm:h-5 sm:w-5" />
              </button>
              {/* Keep ReportButton mounted when menu closes so the report dialog can open (do not use {itemMenuOpen && ...} which unmounts the trigger). */}
              <div
                className={`absolute right-0 top-full z-50 mt-1 min-w-[12.5rem] overflow-hidden rounded-lg border border-slate-200 bg-white py-1 text-left shadow-lg dark:border-slate-600 dark:bg-slate-800 ${
                  itemMenuOpen ? '' : 'hidden'
                }`}
                role="menu"
                aria-hidden={!itemMenuOpen}
              >
                {sellerProfileHref && (
                  <Link
                    href={sellerProfileHref}
                    className="block px-3 py-2.5 text-sm text-slate-800 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-700/80"
                    role="menuitem"
                    onClick={() => setItemMenuOpen(false)}
                  >
                    {t(effectiveLang, 'Go to seller profile')}
                  </Link>
                )}
                <div
                  className={
                    sellerProfileHref
                      ? 'border-t border-slate-100 dark:border-slate-600/80'
                      : ''
                  }
                  role="none"
                >
                  <div className="px-1 py-0.5">
                    <ReportButton
                      entityType="item"
                      entityId={item.id}
                      entityTitle={item.title}
                      variant="text"
                      onOpen={() => setItemMenuOpen(false)}
                      marketplaceSeller={marketplaceSellerForReport}
                      className="!w-full !justify-start !rounded-md !px-2 !py-1.5 !text-xs !font-medium hover:!bg-slate-100 hover:!no-underline dark:hover:!bg-slate-700/80"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Image gallery – slide (swipe/drag); below title */}
        {item.images.length > 0 && (
          <div className="mb-1.5 -mx-1.5 sm:-mx-2 overflow-hidden rounded-md">
            <div
              ref={galleryRef}
              className="relative w-full overflow-hidden bg-slate-100 select-none touch-pan-y"
              onPointerDown={handleGalleryPointerDown}
              onPointerMove={handleGalleryPointerMove}
              onPointerUp={handleGalleryPointerUp}
              onPointerLeave={handleGalleryPointerUp}
              onPointerCancel={handleGalleryPointerUp}
            >
              <button
                type="button"
                onClick={handleGalleryShare}
                onPointerDown={(e) => e.stopPropagation()}
                className="absolute left-1 top-1 z-20 flex h-8 w-8 sm:h-9 sm:w-9 items-center justify-center rounded-full bg-gradient-to-br from-sky-500 via-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-500/40 ring-2 ring-white/90 hover:from-sky-600 hover:via-blue-700 hover:to-indigo-700 hover:shadow-xl hover:shadow-blue-500/50 focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-transparent active:scale-95 transition"
                aria-label={t(effectiveLang, 'Share this listing')}
              >
                <FaShareAlt className="h-3 w-3 sm:h-3.5 sm:w-3.5 drop-shadow-sm" />
              </button>
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
                      className="block w-full h-auto max-h-[28vh] sm:max-h-[36vh] object-contain"
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
                    className="absolute left-1 top-1/2 z-10 -translate-y-1/2 flex h-5 w-5 items-center justify-center rounded-full bg-black/50 text-white hover:bg-black/70 focus:outline-none focus:ring-1 focus:ring-white/50 transition"
                    aria-label={t(effectiveLang, 'Previous image')}
                  >
                    <FaChevronLeft className="h-2.5 w-2.5" />
                  </button>
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); goNext(); }}
                    className="absolute right-1 top-1/2 z-10 -translate-y-1/2 flex h-5 w-5 items-center justify-center rounded-full bg-black/50 text-white hover:bg-black/70 focus:outline-none focus:ring-1 focus:ring-white/50 transition"
                    aria-label={t(effectiveLang, 'Next image')}
                  >
                    <FaChevronRight className="h-2.5 w-2.5" />
                  </button>
                  <div className="absolute bottom-1.5 left-0 right-0 z-10 flex justify-center gap-0.5">
                    {item.images.map((_, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={(e) => { e.stopPropagation(); setImageIndex(idx); }}
                        className={`h-1 rounded-full transition-all ${
                          idx === imageIndex ? 'w-3 bg-white' : 'w-1 bg-white/60 hover:bg-white/80'
                        }`}
                        aria-label={`${t(effectiveLang, 'Go to image')} ${idx + 1}`}
                      />
                    ))}
                  </div>
                  <span className="absolute top-1 right-1 z-10 rounded-full bg-black/50 px-1 py-px text-[9px] font-medium text-white leading-tight">
                    {imageIndex + 1} / {item.images.length}
                  </span>
                </>
              )}
            </div>
          </div>
        )}

        {/* Price, tags, description (title is above photos) */}
        <div className="mb-1.5">
            <div className="w-fit max-w-full">
              <span
                className="inline-flex items-center rounded-md bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-600 px-1.5 py-1 sm:px-2 sm:py-1 text-[11px] sm:text-xs font-bold tabular-nums text-white shadow-md ring-1 ring-white/30 dark:from-emerald-600 dark:via-teal-600 dark:to-cyan-700"
              >
                {typeof item.price === 'number' ? `$${Number(item.price).toLocaleString()}` : item.price}
              </span>
            </div>
            {(item.condition || formatDateLabel(item.created_at)) && (
              <div className="mt-0.5 flex flex-wrap items-center gap-1">
                {item.condition && (
                  <span
                    className={`inline-flex items-center px-1.5 py-px rounded-full text-[10px] font-medium ${
                      item.condition === 'New'
                        ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-200'
                        : 'bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-200'
                    }`}
                  >
                    {item.condition}
                  </span>
                )}
                {formatDateLabel(item.created_at) && (
                  <span className="inline-flex items-center rounded-md border border-slate-200/90 bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold tabular-nums text-slate-700 shadow-sm sm:px-2 sm:py-1 dark:border-slate-600 dark:bg-slate-700/80 dark:text-slate-200">
                    {formatDateLabel(item.created_at)}
                  </span>
                )}
              </div>
            )}
            <div className="mt-1 flex flex-wrap items-center gap-1">
              {item.category && (
                <span className="inline-flex items-center px-1.5 py-px rounded text-[10px] font-medium bg-indigo-100 text-indigo-800 dark:bg-indigo-900/50 dark:text-indigo-200">
                  {item.category}
                </span>
              )}
              {item.location && (
                <span className="inline-flex items-center px-1.5 py-px rounded text-[10px] font-medium bg-slate-200 text-slate-700 dark:bg-slate-600/50 dark:text-slate-200">
                  {item.location}
                </span>
              )}
            </div>
            {item.description && (
              <div className="mt-1.5">
                <p
                  ref={descriptionRef}
                  className={`text-slate-600 dark:text-slate-300 leading-relaxed text-[10px] whitespace-pre-wrap ${
                    !descriptionExpanded ? 'line-clamp-2 sm:line-clamp-3' : ''
                  }`}
                >
                  {item.description}
                </p>
                {descriptionOverflows && (
                  <button
                    type="button"
                    onClick={() => setDescriptionExpanded((v) => !v)}
                    className="mt-0.5 text-indigo-600 dark:text-indigo-400 text-[10px] font-medium hover:underline"
                  >
                    {descriptionExpanded ? t(effectiveLang, 'Read less') : t(effectiveLang, 'Read more')}
                  </button>
                )}
              </div>
            )}
        </div>

        {/* Buy online (external link) */}
        {item.external_buy_url && (
          <div className="relative overflow-hidden rounded-md mb-1.5 bg-gradient-to-br from-slate-900 to-slate-800 p-1.5 shadow">
            <div className="relative z-10">
              <p className="text-[9px] font-medium uppercase tracking-wider text-slate-400 mb-1">{t(effectiveLang, 'Also available online')}</p>
              <a
                href={item.external_buy_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 rounded-md bg-white text-slate-900 font-semibold text-[10px] px-2 py-1 shadow-sm hover:bg-slate-50 active:scale-[0.99] transition-all duration-200"
              >
                <span>{t(effectiveLang, 'Buy on external site')}</span>
                <FaExternalLinkAlt className="h-2.5 w-2.5 opacity-70" />
              </a>
              <p className="text-[9px] text-slate-500 mt-1">{t(effectiveLang, 'Opens in a new tab')}</p>
            </div>
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(255,255,255,0.08),transparent)] pointer-events-none" aria-hidden />
          </div>
        )}

        {/* Seller / Business Info */}
        <div className="rounded-md border border-slate-200 bg-white p-1.5 shadow-sm mb-1.5">
          <h2 className="text-[10px] font-semibold text-slate-800 mb-1.5 uppercase tracking-wide">{t(effectiveLang, 'Contact seller')}</h2>
          {individualSeller ? (
            <>
              <div className="flex items-center gap-1 mb-1.5">
                <Link
                  href={individualSeller.username ? `/profile/${individualSeller.username}` : '#'}
                  className={`flex items-center gap-1 ${individualSeller.username ? 'hover:opacity-90' : ''}`}
                >
                  <div className="h-7 w-7 shrink-0 overflow-hidden rounded-full border-2 border-[#c41e56]/90 bg-slate-100 transition hover:opacity-90 dark:border-[#e85085]/65">
                    <Avatar
                      src={individualSeller.profile_pic_url}
                      alt={individualSeller.username ? `@${individualSeller.username}` : t(effectiveLang, 'Seller')}
                      className="h-full w-full rounded-full"
                      unframed
                    />
                  </div>
                  <div>
                    <span className="text-xs font-semibold text-blue-900 dark:text-blue-300 hover:underline">
                      {individualSeller.username ? `@${individualSeller.username}` : t(effectiveLang, 'Individual seller')}
                    </span>
                  </div>
                </Link>
              </div>
              <div className="flex flex-wrap gap-1.5">
                <Link
                  href={buildMessageHref('user', individualSeller.user_id)}
                  className="inline-flex items-center gap-1 rounded-md bg-indigo-600 text-white text-[10px] font-semibold px-2 py-1.5 shadow-sm hover:bg-indigo-700 active:scale-[0.98] transition-all duration-200"
                >
                  <FaCommentDots className="h-2.5 w-2.5 opacity-90" />
                  {t(effectiveLang, 'DM seller')}
                </Link>
                {individualSeller.contact?.phone && (
                  <a
                    href={`tel:${normalizePhone(individualSeller.contact.phone)}`}
                    className="inline-flex items-center gap-1 rounded-md bg-emerald-600 text-white text-[10px] font-medium px-2 py-1 shadow-sm hover:bg-emerald-700 active:scale-[0.98] transition-all duration-200"
                  >
                    <FaPhoneAlt className="h-2.5 w-2.5 opacity-90" />
                    {t(effectiveLang, 'Call')}
                  </a>
                )}
                {individualSeller.contact?.whatsapp && (
                  <a
                    href={`https://wa.me/${normalizePhone(individualSeller.contact.whatsapp)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 rounded-md bg-[#25D366] text-white text-[10px] font-medium px-2 py-1 shadow-sm hover:bg-[#20BD5A] active:scale-[0.98] transition-all duration-200"
                  >
                    <FaWhatsapp className="h-3 w-3" />
                    {t(effectiveLang, 'WhatsApp')}
                  </a>
                )}
                {individualSeller.contact?.email && (
                  <a
                    href={`mailto:${individualSeller.contact.email}`}
                    className="inline-flex items-center gap-1 rounded-md bg-slate-700 text-white text-[10px] font-medium px-2 py-1 shadow-sm hover:bg-slate-800 active:scale-[0.98] transition-all duration-200"
                  >
                    <FaEnvelope className="h-2.5 w-2.5 opacity-90" />
                    {t(effectiveLang, 'Email')}
                  </a>
                )}
              </div>
            </>
          ) : business ? (
            <>
              <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between mb-1.5">
                <Link href={`/business/${business.slug || ''}`} className="flex items-center gap-1 hover:opacity-90">
                  <div className="h-7 w-7 rounded-md overflow-hidden bg-slate-100 border border-slate-200 shrink-0 flex items-center justify-center">
                    <FaStore className="h-3.5 w-3.5 text-slate-500" />
                  </div>
                  <div>
                    <span className="text-xs font-semibold text-slate-800 hover:underline">
                      {business.business_name}
                    </span>
                    <p className="text-[10px] text-slate-500">{t(effectiveLang, 'Verified business')}</p>
                  </div>
                </Link>
                <Link
                  href={`/business/${business.slug || ''}`}
                  className="inline-flex items-center gap-1 rounded-md bg-indigo-600 text-white text-[10px] font-medium px-2 py-1 shadow-sm hover:bg-indigo-700 active:scale-[0.98] transition-all duration-200"
                >
                  <FaStore className="h-2.5 w-2.5 opacity-90" />
                  {t(effectiveLang, 'Visit Business')}
                </Link>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {business.id && (
                  <Link
                    href={buildMessageHref('business', business.id)}
                    className="inline-flex items-center gap-1 rounded-md bg-indigo-600 text-white text-[10px] font-semibold px-2 py-1.5 shadow-sm hover:bg-indigo-700 active:scale-[0.98] transition-all duration-200"
                  >
                    <FaCommentDots className="h-2.5 w-2.5 opacity-90" />
                    {t(effectiveLang, 'DM seller')}
                  </Link>
                )}
                {business.phone && (
                  <a
                    href={`tel:${normalizePhone(business.phone)}`}
                    className="inline-flex items-center gap-1 rounded-md bg-emerald-600 text-white text-[10px] font-medium px-2 py-1 shadow-sm hover:bg-emerald-700 active:scale-[0.98] transition-all duration-200"
                  >
                    <FaPhoneAlt className="h-2.5 w-2.5 opacity-90" />
                    {t(effectiveLang, 'Call')}
                  </a>
                )}
                {business.whatsapp && (
                  <a
                    href={`https://wa.me/${normalizePhone(business.whatsapp)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 rounded-md bg-[#25D366] text-white text-[10px] font-medium px-2 py-1 shadow-sm hover:bg-[#20BD5A] active:scale-[0.98] transition-all duration-200"
                  >
                    <FaWhatsapp className="h-3 w-3" />
                    {t(effectiveLang, 'WhatsApp')}
                  </a>
                )}
              </div>
            </>
          ) : (
            <p className="text-[10px] text-slate-500">{t(effectiveLang, 'Seller details unavailable.')}</p>
          )}
        </div>

        {/* Related items – always show section when item is loaded */}
        {item && (
          <div className="mt-2 mb-1">
            <h2 className="mb-1.5 w-fit max-w-full">
              <span className="inline-flex items-center rounded-md bg-gradient-to-r from-indigo-500 via-violet-500 to-fuchsia-600 px-2 py-1 text-[9px] font-bold uppercase tracking-wide text-white shadow-md ring-1 ring-white/25 sm:px-2.5 sm:py-1 sm:text-[10px] dark:from-indigo-600 dark:via-violet-600 dark:to-fuchsia-700">
                {t(effectiveLang, 'Related items')}
              </span>
            </h2>
            {relatedLoading ? (
              <div className="flex gap-1 overflow-hidden">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div key={i} className="h-20 w-[5.75rem] sm:h-24 sm:w-24 shrink-0 rounded-md bg-slate-100 animate-pulse" />
                ))}
              </div>
            ) : relatedItems.length > 0 ? (
              <div className="relative">
                <div
                  ref={relatedScrollRef}
                  className="flex gap-1 overflow-x-auto overflow-y-hidden pb-1 scroll-smooth snap-x snap-mandatory hide-scrollbar"
                  style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
                >
                  {relatedItems.map((r) => (
                    <Link
                      key={`${r.source}-${r.id}`}
                      href={`/marketplace/${r.slug}`}
                      className="shrink-0 w-[5.75rem] sm:w-24 snap-start rounded-md border border-slate-200 bg-white shadow-sm overflow-hidden hover:shadow-md hover:border-slate-300 transition"
                    >
                      <div className="aspect-square bg-slate-100 relative">
                        <img
                          src={r.image || '/placeholder.jpg'}
                          alt=""
                          className="absolute inset-0 h-full w-full object-contain object-center p-0.5"
                          onError={(e) => { e.currentTarget.src = '/placeholder.jpg'; e.currentTarget.onerror = null; }}
                        />
                      </div>
                      <div className="p-1">
                        <p className="text-[10px] font-medium text-slate-800 leading-tight line-clamp-2" title={r.title}>{r.title}</p>
                        <p className="text-[10px] font-semibold text-emerald-600 tabular-nums mt-0.5">
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
                      onClick={() => relatedScrollRef.current?.scrollBy({ left: -120, behavior: 'smooth' })}
                      className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-0.5 z-10 h-6 w-6 rounded-full bg-white border border-slate-200 shadow flex items-center justify-center text-slate-600 hover:bg-slate-50"
                      aria-label={t(effectiveLang, 'Previous')}
                    >
                      <FaChevronLeft className="h-2.5 w-2.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => relatedScrollRef.current?.scrollBy({ left: 120, behavior: 'smooth' })}
                      className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-0.5 z-10 h-6 w-6 rounded-full bg-white border border-slate-200 shadow flex items-center justify-center text-slate-600 hover:bg-slate-50"
                      aria-label={t(effectiveLang, 'Next')}
                    >
                      <FaChevronRight className="h-2.5 w-2.5" />
                    </button>
                  </>
                )}
              </div>
            ) : (
              <p className="text-[10px] text-slate-500">{t(effectiveLang, 'No related items right now. Check back later or browse the marketplace.')}</p>
            )}
          </div>
        )}

      </div>
    </div>
  );
}
