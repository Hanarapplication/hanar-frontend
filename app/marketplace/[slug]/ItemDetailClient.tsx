'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import LiveRefreshLink from '@/components/LiveRefreshLink';
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
  source: 'retail' | 'dealership';
};

type BusinessContact = {
  business_name: string;
  phone?: string | null;
  whatsapp?: string | null;
  email?: string | null;
  slug?: string | null;
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

  useEffect(() => {
    if (!slug) return;
    let cancelled = false;

    const loadItem = async () => {
      setError(null);

      const parseIdFromSlug = (prefix: string) =>
        slug.startsWith(prefix) ? slug.replace(prefix, '') : null;

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

  const getFavoriteKey = (value: MarketplaceItem) => `${value.source}:${value.id}`;
  const isFavorited = item ? favoriteItems.some((fav) => fav.key === getFavoriteKey(item)) : false;

  const toggleFavorite = () => {
    if (!item) return;
    const key = getFavoriteKey(item);
    setFavoriteItems((prev) => {
      let next: FavoriteItem[];
      if (prev.some((fav) => fav.key === key)) {
        next = prev.filter((fav) => fav.key !== key);
      } else {
        next = [
          ...prev,
          {
            key,
            id: item.id,
            source: item.source,
            slug: slug || item.id,
            title: item.title,
            price: item.price,
            image: item.images[0] || '/placeholder.jpg',
            location: item.location,
          },
        ];
      }
      localStorage.setItem(FAVORITE_ITEMS_KEY, JSON.stringify(next));
      return next;
    });
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
          {business ? (
            <>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-3">
                <div>
                  <Link href={`/business/${business.slug || ''}`} className="text-sm font-semibold text-blue-700 hover:underline">
                    {business.business_name}
                  </Link>
                  <p className="text-xs text-gray-500">Verified business</p>
                </div>
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
