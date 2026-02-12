'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';

import { FaHeart, FaRegHeart, FaShareAlt } from 'react-icons/fa';
import { FaPhoneAlt, FaStore } from 'react-icons/fa';
import { supabase } from '@/lib/supabaseClient';

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
  source: 'retail' | 'dealership' | 'individual';
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
  source: 'retail' | 'dealership' | 'individual';
  slug: string;
  title: string;
  price: string | number;
  image: string;
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

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setCurrentUrl(window.location.href);
    }
  }, []);

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
        source: (r.item_snapshot?.source as 'retail' | 'dealership' | 'individual') ?? 'individual',
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

      const retailRaw = await fetchRetailBySlug();
      const dealershipRaw = await fetchDealershipBySlug();

      let retailRes = { data: retailRaw.error ? null : retailRaw.data };
      let dealershipRes = { data: dealershipRaw.error ? null : dealershipRaw.data };

      if (!retailRes.data && retailId) {
        retailRes = await supabase.from('retail_items').select('*').eq('id', retailId).maybeSingle();
      }
      if (!dealershipRes.data && dealershipId) {
        dealershipRes = await supabase.from('dealerships').select('*').eq('id', dealershipId).maybeSingle();
      }

      const retailItem = retailRes.data;
      const dealershipItem = dealershipRes.data;
      const source = retailItem ? 'retail' : dealershipItem ? 'dealership' : null;

      if (!source) {
        if (!cancelled) setError('Item not found.');
        return;
      }

      setIndividualSeller(null);

      const row = retailItem || dealershipItem;
      const mappedItem: MarketplaceItem = {
        id: String(row.id),
        title: row.title || row.name || row.vehicle_name || row.model || 'Listing',
        price: row.price ?? row.amount ?? row.cost ?? '',
        category: row.category || row.type || (source === 'retail' ? 'Retail' : 'Dealership'),
        location: row.location || row.city || row.address || '',
        description: row.description || row.details || row.notes || '',
        condition: row.condition || row.item_condition || '',
        images: normalizeImages(row.images ?? row.image_url ?? row.image_urls ?? row.photos, source === 'retail' ? 'retail-items' : 'car-listings'),
        created_at: row.created_at || row.createdAt || null,
        business_id: row.business_id || null,
        source,
      };

      if (!cancelled) {
        setItem(mappedItem);
      }

      if (row.business_id) {
        const { data: businessData } = await supabase
          .from('businesses')
          .select('business_name, phone, whatsapp, email, slug')
          .eq('id', row.business_id)
          .maybeSingle();
        if (!cancelled && businessData) {
          setBusiness(businessData);
        }
      }
    };

    loadItem();
    return () => {
      cancelled = true;
    };
  }, [slug]);

  // Track view (internal count; not shown to public)
  useEffect(() => {
    if (!item?.id) return;
    const typeMap = { individual: 'marketplace_item', retail: 'retail_item', dealership: 'dealership' } as const;
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


      <div className="bg-white shadow-md rounded-2xl overflow-hidden p-4">
        {/* Top Info Box */}
        <div className="flex justify-between items-start mb-4">
          <div>
            <h1 className="text-xl font-bold">{item.title}</h1>
            <p className="text-green-600 font-semibold text-lg">{item.price}</p>
            {item.condition && (
              <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                <span
                  className={`px-2.5 py-1 rounded-full ${
                    item.condition === 'New'
                      ? 'bg-green-100 text-green-700'
                      : 'bg-yellow-100 text-yellow-700'
                  }`}
                >
                  {item.condition}
                </span>
                {formatDateLabel(item.created_at) && (
                  <span>{formatDateLabel(item.created_at)}</span>
                )}
              </div>
            )}
            <p className="text-sm text-gray-500">
              {item.category} • {item.location}
            </p>
            {item.description && (
              <p className="mt-2 text-sm text-slate-600">{item.description}</p>
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

        {/* Images */}
        {item.images.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-4">
            {item.images.map((img, idx) => (
              <img
                key={idx}
                src={img}
                alt={`Item image ${idx + 1}`}
                loading="lazy"
                decoding="async"
                className="rounded-lg object-contain w-full h-auto bg-gray-50"
              />
            ))}
          </div>
        )}

        {/* Seller / Business Info */}
        <div className="bg-gray-50 p-4 rounded-xl mb-4">
          <h2 className="font-semibold text-sm text-gray-700 mb-2">Seller</h2>
          {individualSeller ? (
            <>
              <div className="flex items-center gap-3 mb-3">
                <Link
                  href={individualSeller.username ? `/profile/${individualSeller.username}` : '#'}
                  className={`flex items-center gap-3 ${individualSeller.username ? 'hover:opacity-90' : ''}`}
                >
                  <div className="h-12 w-12 shrink-0 overflow-hidden rounded-full border-2 border-slate-200 bg-slate-100">
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
                <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                  {individualSeller.contact?.phone && (
                    <a
                      href={`tel:${normalizePhone(individualSeller.contact.phone)}`}
                      className="text-xs bg-emerald-600 text-white px-3 py-2 rounded-md hover:bg-emerald-700 w-full sm:w-auto text-center"
                    >
                      <span className="inline-flex items-center gap-1">
                        <FaPhoneAlt className="text-[11px]" />
                        Call
                      </span>
                    </a>
                  )}
                  {individualSeller.contact?.whatsapp && (
                    <a
                      href={`https://wa.me/${normalizePhone(individualSeller.contact.whatsapp)}`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs bg-green-600 text-white px-3 py-2 rounded-md hover:bg-green-700 w-full sm:w-auto text-center"
                    >
                      WhatsApp
                    </a>
                  )}
                  {individualSeller.contact?.email && (
                    <a
                      href={`mailto:${individualSeller.contact.email}`}
                      className="text-xs bg-blue-600 text-white px-3 py-2 rounded-md hover:bg-blue-700 w-full sm:w-auto text-center"
                    >
                      Email
                    </a>
                  )}
                </div>
              )}
            </>
          ) : business ? (
            <>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-3">
                <Link href={`/business/${business.slug || ''}`} className="flex items-center gap-3 hover:opacity-90">
                  <div className="h-10 w-10 rounded-full overflow-hidden bg-slate-200 shrink-0">
                    <FaStore className="h-5 w-5 m-auto mt-2.5 text-slate-500" />
                  </div>
                  <div>
                    <span className="text-sm font-semibold text-blue-700 hover:underline">
                      {business.business_name}
                    </span>
                    <p className="text-xs text-gray-500">Verified business</p>
                  </div>
                </Link>
                <Link
                  href={`/business/${business.slug || ''}`}
                  className="text-xs bg-blue-600 text-white px-3 py-2 rounded-md hover:bg-blue-700 w-full sm:w-auto text-center"
                >
                  <span className="inline-flex items-center gap-1">
                    <FaStore className="text-[11px]" />
                    Visit Business
                  </span>
                </Link>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                {business.phone && (
                  <a
                    href={`tel:${normalizePhone(business.phone)}`}
                    className="text-xs bg-emerald-600 text-white px-3 py-2 rounded-md hover:bg-emerald-700 w-full sm:w-auto text-center"
                  >
                    <span className="inline-flex items-center gap-1">
                      <FaPhoneAlt className="text-[11px]" />
                      Contact Seller
                    </span>
                  </a>
                )}
                {business.whatsapp && (
                  <a
                    href={`https://wa.me/${normalizePhone(business.whatsapp)}`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs bg-green-600 text-white px-3 py-2 rounded-md hover:bg-green-700 w-full sm:w-auto text-center"
                  >
                    WhatsApp
                  </a>
                )}
              </div>
            </>
          ) : (
            <p className="text-sm text-gray-500">Seller details unavailable.</p>
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

        {/* Report */}
        <div className="text-right">
          <button
            onClick={() => alert('Report submitted. Our team will review this item shortly.')}
            className="text-sm text-red-500 hover:underline"
          >
            🚩 Report this item
          </button>
        </div>
      </div>
    </div>
  );
}
