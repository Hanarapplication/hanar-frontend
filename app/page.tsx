'use client';

import { useCallback, useEffect, useMemo, useRef, useState, Fragment, Suspense } from 'react';
import Link from 'next/link';
import { useKeenSlider } from 'keen-slider/react';
import Footer from '@/components/Footer';
import { Trash2, Megaphone, SendHorizontal, X, Search, ThumbsUp } from 'lucide-react';
import toast from 'react-hot-toast';
import { supabase } from '@/lib/supabaseClient';
import PostActionsBar from '@/components/PostActionsBar';
import FeedVideoPlayer from '@/components/FeedVideoPlayer';
import PullToRefresh from '@/components/PullToRefresh';
import { Avatar } from '@/components/Avatar';
import PostTranslateToggle from '@/components/PostTranslateToggle';
import CreateCommunityPostClient from '@/app/community/post/CreateCommunityPostClient';
import { useLanguage } from '@/context/LanguageContext';
import { supportedLanguages } from '@/utils/languages';
import { t } from '@/utils/translations';

type SliderBusiness = {
  id: string;
  slug: string;
  name: string;
  category: string;
  image: string;
  plan?: string | null;
};
type AdBanner = { id: string; image: string; link: string; alt: string };

/** Neutral rule between feed / skeleton rows */
const HOME_FEED_BETWEEN_ROW =
  'h-px w-full shrink-0 bg-slate-200 dark:bg-gray-700';

type CommunityPost = {
  id: string;
  title: string;
  body: string;
  language?: string | null;
  created_at: string;
  author: string;
  author_type: string | null;
  username: string | null;
  user_id?: string | null;
  org_id?: string | null;
  image: string | null;
  video?: string | null;
  likes_post: number | null;
  community_comments?: { count: number }[];
  profile_pic_url?: string | null;
  logo_url?: string | null;
  /** Set when ranked by /api/community/home-feed-posts (0–100); used for mixed-feed ordering */
  home_rank_score?: number;
};

type Business = {
  id: string;
  business_name: string;
  category: string | null;
  subcategory?: string | null;
  address: any;
  logo_url: string | null;
  slug: string;
  lat?: number | null;
  lon?: number | null;
  created_at?: string | null;
  distance?: number;
  plan?: string | null;
};

type Organization = {
  id: string;
  full_name: string;
  username: string;
  logo_url: string | null;
  banner_url: string | null;
  mission: string | null;
  created_at?: string | null;
};

type MarketplaceItem = {
  id: string;
  title: string;
  price: number | string | null;
  description?: string | null;
  imageUrls?: string[] | string | null;
  condition?: string | null;
  category?: string | null;
  location?: string | null;
  lat?: number | null;
  lon?: number | null;
  created_at?: string | null;
  distance?: number;
  slug?: string | null;
  source?: 'retail' | 'dealership' | 'real_estate' | 'individual';
  business_id?: string | null;
  user_id?: string | null;
  business_verified?: boolean;
};

type Comment = {
  id: string;
  post_id: string;
  user_id: string;
  username: string | null;
  author: string | null;
  author_type?: string | null;
  text?: string;
  body?: string;
  created_at: string;
  likes?: number;
  likes_comment?: number;
  user_liked?: boolean;
  logo_url?: string | null;
  avatar_url?: string | null;
  profiles?: { profile_pic_url: string | null } | null;
};

type FeedItem =
  | { type: 'post'; post: CommunityPost }
  | { type: 'business'; business: Business }
  | { type: 'organization'; organization: Organization }
  | { type: 'marketplaceCategorySlider'; categoryLabel: string; items: MarketplaceItem[] }
  | { type: 'ad'; banner: AdBanner }
  | { type: 'sliderBusinesses' };

const getDistanceMiles = (lat1: number, lon1: number, lat2: number, lon2: number) => {
  const R = 3958.8;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

const getExpandedRadius = (distances: number[], initial: number, next: number, step = 50) => {
  if (!distances.length) return Infinity;
  if (distances.some((d) => d <= initial)) return initial;
  const maxDistance = Math.max(...distances);
  let radius = next;
  while (radius < maxDistance && !distances.some((d) => d <= radius)) {
    radius += step;
  }
  if (!distances.some((d) => d <= radius)) return Infinity;
  return radius;
};

const formatPrice = (value: number | string | null | undefined) => {
  if (value === null || value === undefined) return '';
  const numeric = typeof value === 'string' ? Number(value) : value;
  if (Number.isNaN(numeric)) return String(value);
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(numeric);
};

const getFirstImage = (value?: string[] | string | null) => {
  if (Array.isArray(value)) return value[0] || '';
  return value || '';
};

const getStorageUrl = (bucket: string, path?: string | null) => {
  if (!path) return '';
  if (path.startsWith('http')) return path;
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  return `${base}/storage/v1/object/public/${bucket}/${path}`;
};

const normalizeAvatarUrl = (value?: string | null, buckets: string[] = []) => {
  if (!value) return null;
  const trimmed = String(value).trim();
  if (!trimmed) return null;
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    return trimmed;
  }
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  if (trimmed.startsWith('/storage/v1/object/public/')) {
    return base ? `${base}${trimmed}` : trimmed;
  }
  if (trimmed.startsWith('storage/v1/object/public/')) {
    return base ? `${base}/${trimmed}` : `/${trimmed}`;
  }
  if (trimmed.startsWith('/')) {
    return trimmed;
  }
  for (const bucket of buckets) {
    const normalizedPath = trimmed.startsWith(`${bucket}/`) ? trimmed.slice(bucket.length + 1) : trimmed;
    const normalized = getStorageUrl(bucket, normalizedPath);
    if (normalized) return normalized;
  }
  return trimmed;
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

const normalizeSearchText = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const editDistanceAtMost = (a: string, b: string, limit = 2): number => {
  if (a === b) return 0;
  const aLen = a.length;
  const bLen = b.length;
  if (Math.abs(aLen - bLen) > limit) return limit + 1;
  const prev = new Array(bLen + 1);
  const curr = new Array(bLen + 1);
  for (let j = 0; j <= bLen; j++) prev[j] = j;
  for (let i = 1; i <= aLen; i++) {
    curr[0] = i;
    let rowMin = curr[0];
    for (let j = 1; j <= bLen; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost);
      if (curr[j] < rowMin) rowMin = curr[j];
    }
    if (rowMin > limit) return limit + 1;
    for (let j = 0; j <= bLen; j++) prev[j] = curr[j];
  }
  return prev[bLen];
};

const fuzzyTokenMatch = (term: string, token: string) => {
  if (!term || !token) return false;
  if (token.includes(term) || term.includes(token)) return true;
  const maxDistance = term.length <= 4 ? 1 : 2;
  return editDistanceAtMost(term, token, maxDistance) <= maxDistance;
};

const sortByCreatedAtDesc = (a?: string | null, b?: string | null) =>
  new Date(b || 0).getTime() - new Date(a || 0).getTime();

function feedItemStableKey(item: FeedItem): string {
  switch (item.type) {
    case 'post':
      return `p:${item.post.id}`;
    case 'business':
      return `b:${item.business.id}`;
    case 'organization':
      return `o:${item.organization.id}`;
    case 'marketplaceCategorySlider':
      return `mc:${item.categoryLabel}`;
    case 'ad':
      return `a:${item.banner.id}`;
    case 'sliderBusinesses':
      return 'sb';
    default:
      return 'x';
  }
}

/** Shuffle cards from the home pool; sprinkle some of the newest items into early positions. */
function shuffleHomeFeedWithFreshSprinkle(pool: { item: FeedItem; date: number }[]): FeedItem[] {
  if (pool.length === 0) return [];
  const arr = [...pool];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  const byNewest = [...pool].sort((a, b) => b.date - a.date);
  const topN = Math.min(12, Math.max(4, Math.ceil(pool.length * 0.05)));
  const latestEntries = byNewest.slice(0, topN);
  const latestKeys = new Set(latestEntries.map((e) => feedItemStableKey(e.item)));
  const without = arr.filter((e) => !latestKeys.has(feedItemStableKey(e.item)));
  const out: FeedItem[] = without.map((e) => e.item);
  for (const entry of latestEntries) {
    const cap = Math.min(out.length + 1, Math.max(12, Math.floor(out.length * 0.3) + 1));
    const pos = Math.floor(Math.random() * cap);
    out.splice(pos, 0, entry.item);
  }
  return out;
}

/** After every N post cards, insert one shuffled non-post card so language order from the API is preserved. */
const HOME_LANG_ORDER_POSTS_PER_MISC = 5;

function mergePostsInApiOrderWithShuffledMisc(
  posts: CommunityPost[],
  miscDated: { item: FeedItem; date: number }[]
): FeedItem[] {
  const postItems: FeedItem[] = posts.map((post) => ({ type: 'post' as const, post }));
  if (miscDated.length === 0) return postItems;
  const miscShuffled = shuffleHomeFeedWithFreshSprinkle(miscDated);
  const merged: FeedItem[] = [];
  let pi = 0;
  let mi = 0;
  while (pi < postItems.length || mi < miscShuffled.length) {
    if (pi >= postItems.length) {
      while (mi < miscShuffled.length) merged.push(miscShuffled[mi++]);
      break;
    }
    for (let i = 0; i < HOME_LANG_ORDER_POSTS_PER_MISC && pi < postItems.length; i++) {
      merged.push(postItems[pi++]);
    }
    if (mi < miscShuffled.length) merged.push(miscShuffled[mi++]);
  }
  return merged;
}

const BusinessSliderCard = ({ items }: { items: SliderBusiness[] }) => {
  if (!items.length) return null;
  const [sliderRef, slider] = useKeenSlider({
    loop: true,
    slides: { perView: 3, spacing: 8 },
    breakpoints: {
      '(max-width: 768px)': {
        slides: { perView: 2.2, spacing: 6 },
      },
    },
  });

  useEffect(() => {
    const interval = setInterval(() => {
      slider.current?.next();
    }, 3500);
    return () => clearInterval(interval);
  }, [slider]);

  return (
    <section className="rounded-none bg-white shadow-sm p-4 dark:bg-gray-800">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-slate-700">Featured Businesses</h2>
        <Link href="/businesses" className="text-xs text-rose-600 hover:underline">View all</Link>
      </div>
      <div ref={sliderRef} className="keen-slider overflow-hidden rounded-none">
        {items.map((biz) => (
          <Link
            key={biz.id}
            href={`/business/${biz.slug}`}
            data-keen-slider-clickable
            className="keen-slider__slide block rounded-none bg-white no-underline overflow-hidden shadow-sm dark:bg-gray-800"
          >
            <div className="relative">
              <img
                src={biz.image}
                alt={biz.name}
                loading="lazy"
                decoding="async"
                className="aspect-square h-auto w-full object-cover"
              />
              {(biz.plan || '').toLowerCase() === 'premium' && (
                <span className="absolute bottom-1 left-1 inline-flex items-center gap-0.5 rounded-md bg-amber-500/90 backdrop-blur-sm px-1 py-[1px] text-[8px] font-bold text-white shadow-sm">
                  <svg className="h-2 w-2" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10.868 2.884c-.321-.772-1.415-.772-1.736 0l-1.83 4.401-4.753.39c-.833.068-1.171 1.107-.536 1.651l3.62 3.102-1.106 4.637c-.194.813.691 1.456 1.405 1.02L10 15.591l4.069 2.494c.714.437 1.598-.207 1.404-1.02l-1.106-4.637 3.62-3.102c.635-.544.297-1.583-.536-1.65l-4.752-.391-1.831-4.401z" clipRule="evenodd" /></svg>
                  Premium
                </span>
              )}
            </div>
            <div className="p-2">
              <p className="text-xs font-semibold text-slate-800 truncate">{biz.name}</p>
              <p className="text-[11px] text-slate-500">{biz.category}</p>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
};

const MARKETPLACE_CATEGORY_SLIDER_MAX = 20;

const MarketplaceCategorySliderCard = ({
  categoryLabel,
  items,
}: {
  categoryLabel: string;
  items: MarketplaceItem[];
}) => {
  const slides = items.slice(0, MARKETPLACE_CATEGORY_SLIDER_MAX);
  if (!slides.length) return null;
  const [sliderRef, slider] = useKeenSlider({
    loop: slides.length > 2,
    slides: { perView: 3, spacing: 8 },
    breakpoints: {
      '(max-width: 768px)': {
        slides: { perView: 2.2, spacing: 6 },
      },
    },
  });

  useEffect(() => {
    const interval = setInterval(() => {
      slider.current?.next();
    }, 3500);
    return () => clearInterval(interval);
  }, [slider]);

  return (
    <section className="rounded-none bg-white shadow-sm p-4 dark:bg-gray-800">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="min-w-0 truncate text-sm font-semibold text-slate-700 dark:text-gray-200">{categoryLabel}</h2>
        <Link href="/marketplace" className="shrink-0 text-xs text-rose-600 hover:underline dark:text-rose-400">
          Browse
        </Link>
      </div>
      <div ref={sliderRef} className="keen-slider overflow-hidden rounded-none">
        {slides.map((item) => (
          <Link
            key={item.id}
            href={`/marketplace/${item.slug || item.id}`}
            data-keen-slider-clickable
            className="keen-slider__slide block rounded-none bg-white no-underline overflow-hidden shadow-sm dark:bg-gray-800"
          >
            <div className="relative">
              <img
                src={getFirstImage(item.imageUrls) || '/placeholder.jpg'}
                alt={item.title}
                loading="lazy"
                decoding="async"
                className="aspect-square h-auto w-full object-cover"
              />
              {item.business_id &&
                (item.business_verified ? (
                  <span className="absolute bottom-1 left-1 inline-flex items-center gap-0.5 rounded-md bg-emerald-500/90 px-1 py-[1px] text-[8px] font-bold text-white shadow-sm backdrop-blur-sm">
                    <svg className="h-2 w-2" fill="currentColor" viewBox="0 0 20 20">
                      <path
                        fillRule="evenodd"
                        d="M16.403 12.652a3 3 0 010-5.304 3 3 0 00-3.75-3.751 3 3 0 00-5.305 0 3 3 0 00-3.751 3.75 3 3 0 000 5.305 3 3 0 003.75 3.751 3 3 0 005.305 0 3 3 0 003.751-3.75zm-5.11-1.36a.75.75 0 10-1.085-1.035l-2.165 2.27-.584-.614a.75.75 0 10-1.085 1.035l1.126 1.182a.75.75 0 001.085 0l2.708-2.839z"
                        clipRule="evenodd"
                      />
                    </svg>
                    Verified
                  </span>
                ) : (
                  <span className="absolute bottom-1 left-1 inline-flex items-center gap-0.5 rounded-md bg-indigo-500/90 px-1 py-[1px] text-[8px] font-bold text-white shadow-sm backdrop-blur-sm">
                    <svg className="h-2 w-2" fill="currentColor" viewBox="0 0 20 20">
                      <path
                        fillRule="evenodd"
                        d="M4 4a2 2 0 012-2h8a2 2 0 012 2v12a1 1 0 01-1.581.814L10 13.197l-4.419 3.617A1 1 0 014 16V4z"
                        clipRule="evenodd"
                      />
                    </svg>
                    Business
                  </span>
                ))}
            </div>
            <div className="p-2">
              <p className="truncate text-xs font-semibold text-slate-800 dark:text-gray-100">{item.title}</p>
              <p className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">{formatPrice(item.price)}</p>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
};

function AdCardWithTrack({ banner }: { banner: AdBanner }) {
  const ref = useRef<HTMLElement>(null);
  const tracked = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el || tracked.current) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries[0]?.isIntersecting || tracked.current) return;
        tracked.current = true;
        fetch('/api/track-view', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type: 'feed_banner', id: banner.id }),
        }).catch(() => {});
      },
      { threshold: 0.25 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [banner.id]);

  return (
    <section
      ref={ref}
      className="rounded-none overflow-hidden bg-white shadow-sm dark:bg-gray-800"
    >
      <Link href={banner.link} {...(banner.link.startsWith('/') || (typeof window !== 'undefined' && banner.link.includes(window.location.hostname)) ? {} : { target: '_blank', rel: 'noopener noreferrer' })} className="block w-full">
        <div className="relative w-full aspect-[1200/630] bg-slate-100 dark:bg-gray-700">
          <img
            src={banner.image}
            alt={banner.alt}
            loading="lazy"
            decoding="async"
            className="absolute inset-0 w-full h-full object-cover"
          />
        </div>
      </Link>
    </section>
  );
}

function FeedBusinessCardWithTrack({
  business,
  formatDateLabel,
  getBusinessMessage,
}: {
  business: Business;
  formatDateLabel: (value?: string | null) => string;
  getBusinessMessage: (b: Business) => string;
}) {
  const ref = useRef<HTMLElement>(null);
  const tracked = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el || tracked.current || !business.id) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries[0]?.isIntersecting || tracked.current) return;
        tracked.current = true;
        fetch('/api/track-view', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type: 'business', id: business.id }),
        }).catch(() => {});
      },
      { threshold: 0.25 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [business.id]);

  return (
    <article
      ref={ref}
      className="hanar-feed-business-card overflow-hidden rounded-none border border-slate-200 bg-white p-0 shadow-sm dark:border-slate-700 dark:bg-white"
    >
      <div className="flex items-stretch">
        <div className="flex shrink-0 items-center border-r border-slate-100 bg-white p-4 dark:border-slate-200">
          <Link href={`/business/${business.slug}`} className="shrink-0">
            <img
              src={business.logo_url || 'https://images.unsplash.com/photo-1557426272-fc91fdb8f385?w=600&auto=format&fit=crop'}
              alt={business.business_name}
              loading="lazy"
              decoding="async"
              className="h-14 w-14 rounded-none border border-slate-200 object-cover dark:border-slate-300"
            />
          </Link>
        </div>
        <div className="min-w-0 flex-1 bg-white px-4 py-4">
          <div className="flex flex-wrap items-center gap-1.5">
            <Link
              href={`/business/${business.slug}`}
              className="text-sm font-semibold text-slate-900 transition-colors hover:text-blue-800 hover:underline dark:text-slate-900"
            >
              {business.business_name}
            </Link>
            {(business.plan || '').toLowerCase() === 'premium' && (
              <span className="inline-flex items-center gap-0.5 rounded-md bg-amber-500/90 px-1.5 py-[2px] text-[9px] font-bold text-white">
                <svg className="h-2.5 w-2.5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10.868 2.884c-.321-.772-1.415-.772-1.736 0l-1.83 4.401-4.753.39c-.833.068-1.171 1.107-.536 1.651l3.62 3.102-1.106 4.637c-.194.813.691 1.456 1.405 1.02L10 15.591l4.069 2.494c.714.437 1.598-.207 1.404-1.02l-1.106-4.637 3.62-3.102c.635-.544.297-1.583-.536-1.65l-4.752-.391-1.831-4.401z" clipRule="evenodd" /></svg>
                Premium
              </span>
            )}
          </div>
          <p className="text-xs italic text-slate-600 dark:text-slate-600">{business.subcategory || business.category || 'Business'}</p>
          <p className="mt-1 text-xs font-semibold text-emerald-700 dark:text-emerald-700">
            {getBusinessMessage(business)}
          </p>
          {business.created_at && (
            <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-500">Joined {formatDateLabel(business.created_at)}</p>
          )}
        </div>
      </div>
    </article>
  );
}

const FEED_CACHE_KEY = 'hanar_feed_cache';
const FEED_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/** Same key as community feed so language preference stays in sync. */
const HOME_POST_FEED_LANG_KEY = 'hanar_community_feed_lang';

type HomeFeedTab = 'for_you' | 'popular' | 'news';

type FeedCache = {
  ts: number;
  /** Post language filter (home / community dropdown). */
  postFeedLang: string;
  homeFeedTab: HomeFeedTab;
  communityPosts: CommunityPost[];
  businesses: Business[];
  organizations: Organization[];
  marketplaceItems: MarketplaceItem[];
  feedBanners: AdBanner[];
};

function readFeedCache(expectedPostFeedLang: string, expectedTab: HomeFeedTab): FeedCache | null {
  try {
    const raw = sessionStorage.getItem(FEED_CACHE_KEY);
    if (!raw) return null;
    const cache = JSON.parse(raw) as FeedCache;
    if (Date.now() - cache.ts > FEED_CACHE_TTL) return null;
    if (cache.postFeedLang !== expectedPostFeedLang) return null;
    if (!cache.homeFeedTab || cache.homeFeedTab !== expectedTab) return null;
    return cache;
  } catch {
    return null;
  }
}

function writeFeedCache(data: Omit<FeedCache, 'ts'>) {
  try {
    sessionStorage.setItem(FEED_CACHE_KEY, JSON.stringify({ ...data, ts: Date.now() }));
  } catch {
    // storage full or unavailable
  }
}

export default function Home() {
  const { effectiveLang } = useLanguage();

  const [homeFeedTab, setHomeFeedTab] = useState<HomeFeedTab>('for_you');
  const [postFeedLang, setPostFeedLangState] = useState('');
  const [postFeedLangReady, setPostFeedLangReady] = useState(false);
  const postFeedLangRef = useRef('');
  const homeFeedTabRef = useRef<HomeFeedTab>('for_you');
  postFeedLangRef.current = postFeedLang;
  homeFeedTabRef.current = homeFeedTab;

  const normalizePostFeedLang = useCallback((value: string) => {
    const v = String(value || '').trim().toLowerCase();
    if (!v || v === 'all' || v === 'auto') return '';
    return supportedLanguages.some((l) => l.code === v) ? v : '';
  }, []);

  const setPostFeedLang = useCallback(
    (value: string) => {
      const next = normalizePostFeedLang(value);
      setPostFeedLangState(next);
      try {
        localStorage.setItem(HOME_POST_FEED_LANG_KEY, next);
      } catch {
        /* ignore */
      }
    },
    [normalizePostFeedLang]
  );

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const stored = localStorage.getItem(HOME_POST_FEED_LANG_KEY);
      if (stored !== null) setPostFeedLangState(normalizePostFeedLang(stored));
    } catch {
      /* ignore */
    }
    setPostFeedLangReady(true);
  }, [normalizePostFeedLang]);

  const [communityPosts, setCommunityPosts] = useState<CommunityPost[]>([]);
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [marketplaceItems, setMarketplaceItems] = useState<MarketplaceItem[]>([]);
  const [userCoords, setUserCoords] = useState<{ lat: number; lon: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [visibleCount, setVisibleCount] = useState(12);
  const [feedSearchQuery, setFeedSearchQuery] = useState('');
  const [feedSearchOpen, setFeedSearchOpen] = useState(false);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const [currentUser, setCurrentUser] = useState<{ id: string; username: string | null; displayName: string | null; avatarUrl: string | null }>({ id: '', username: null, displayName: null, avatarUrl: null });
  const [composerExpanded, setComposerExpanded] = useState(false);
  const [likedPosts, setLikedPosts] = useState<Set<string>>(new Set());
  const [commentInputs, setCommentInputs] = useState<Record<string, string>>({});
  const [commentsByPost, setCommentsByPost] = useState<Record<string, Comment[]>>({});
  const [deletingPost, setDeletingPost] = useState<string | null>(null);
  const [commentsOpen, setCommentsOpen] = useState<Set<string>>(new Set());
  const [commentLoading, setCommentLoading] = useState<Record<string, boolean>>({});
  const [feedBanners, setFeedBanners] = useState<AdBanner[]>([]);
  const [hasNewContent, setHasNewContent] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const latestPostDateRef = useRef<string | null>(null);

  const fetchLikedPosts = useCallback(async (userId: string) => {
    try {
      const res = await fetch(`/api/community/post/liked?userId=${encodeURIComponent(userId)}`, { credentials: 'include' });
      const data = await res.json();
      if (res.ok && Array.isArray(data.likedPostIds)) {
        setLikedPosts(new Set(data.likedPostIds));
      }
    } catch {
      setLikedPosts(new Set());
    }
  }, []);

  useEffect(() => {
    const loadUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setCurrentUser({ id: '', username: null, displayName: null, avatarUrl: null });
        setLikedPosts(new Set());
        return;
      }

      const [{ data: account }, { data: profile }, { data: org }, { data: business }] = await Promise.all([
        supabase
          .from('registeredaccounts')
          .select('username, full_name')
          .eq('user_id', user.id)
          .single(),
        supabase
          .from('profiles')
          .select('profile_pic_url')
          .eq('id', user.id)
          .maybeSingle(),
        supabase
          .from('organizations')
          .select('logo_url')
          .eq('user_id', user.id)
          .maybeSingle(),
        supabase
          .from('businesses')
          .select('logo_url')
          .eq('owner_id', user.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle(),
      ]);

      setCurrentUser({
        id: user.id,
        username: account?.username || null,
        displayName: account?.full_name?.trim() || null,
        avatarUrl:
          normalizeAvatarUrl(profile?.profile_pic_url, ['avatars']) ||
          normalizeAvatarUrl(org?.logo_url, ['organizations', 'organization-uploads']) ||
          normalizeAvatarUrl(business?.logo_url, ['business-uploads']) ||
          null,
      });
      await fetchLikedPosts(user.id);
    };

    loadUser();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user?.id) {
        setCurrentUser({ id: session.user.id, username: null, displayName: null, avatarUrl: null });
        fetchLikedPosts(session.user.id);
      } else {
        setCurrentUser({ id: '', username: null, displayName: null, avatarUrl: null });
        setLikedPosts(new Set());
      }
    });
    return () => subscription.unsubscribe();
  }, [fetchLikedPosts]);

  useEffect(() => {
    if (!currentUser.id) return;
    let cancelled = false;
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token || cancelled) return;
      try {
        const res = await fetch('/api/user/blocks', {
          headers: { Authorization: `Bearer ${session.access_token}` },
          credentials: 'include',
        });
        const data = await res.json().catch(() => ({}));
        if (cancelled) return;
        const blocked = new Set((data.mutualBlockedUserIds || []) as string[]);
        setCommunityPosts((prev) => prev.filter((p) => !p.user_id || !blocked.has(p.user_id)));
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [currentUser.id]);

  useEffect(() => {
    const stored = localStorage.getItem('userCoords');
    if (stored) {
      try {
        setUserCoords(JSON.parse(stored));
      } catch {
        setUserCoords(null);
      }
    }

    const handleLocationUpdate = (event: Event) => {
      const detail = (event as CustomEvent).detail as { lat?: number; lon?: number; label?: string } | undefined;
      if (detail?.lat && detail?.lon) {
        setUserCoords({ lat: detail.lat, lon: detail.lon });
        localStorage.setItem('userCoords', JSON.stringify({ lat: detail.lat, lon: detail.lon }));
      }
      if (detail?.label) {
        try {
          localStorage.setItem('userLocationLabel', detail.label);
        } catch {
          /* ignore */
        }
      }
    };

    window.addEventListener('location:updated', handleLocationUpdate as EventListener);
    return () => window.removeEventListener('location:updated', handleLocationUpdate as EventListener);
  }, []);

  const loadHomeFeed = async () => {
    const feedLangRaw = postFeedLangRef.current.trim().toLowerCase();
    const feedLangForRequest = feedLangRaw && supportedLanguages.some((l) => l.code === feedLangRaw) ? feedLangRaw : '';
    const tab = homeFeedTabRef.current;
    const [audienceJson, businessRes, orgRes, retailRes, dealershipRes, realEstateRes, individualRes] = await Promise.all([
      fetch('/api/user/audience-segment')
        .then((r) => r.json().catch(() => ({})))
        .catch(() => ({})),
      supabase
        .from('businesses')
        .select('id, business_name, category, subcategory, address, logo_url, slug, lat, lon, created_at, plan')
        .eq('moderation_status', 'active')
        .eq('is_archived', false)
        .neq('lifecycle_status', 'archived')
        .order('created_at', { ascending: false })
        .limit(200),
      supabase
        .from('organizations')
        .select('id, full_name, username, logo_url, banner_url, mission, created_at')
        .or('moderation_status.neq.on_hold,moderation_status.is.null')
        .order('created_at', { ascending: false })
        .limit(100),
      supabase
        .from('retail_items')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(120),
      supabase
        .from('dealerships')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(120),
      supabase
        .from('real_estate_listings')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(120),
      supabase
        .from('marketplace_items')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(120),
    ]);

    const normalizedRetail = (retailRes.data || []).map((row: any) => ({
      id: String(row.id),
      title: row.title || row.name || row.item_name || 'Retail item',
      price: row.price ?? row.amount ?? row.cost ?? '',
      description: row.description || row.details || null,
      imageUrls: normalizeImages(row.images ?? row.image_url ?? row.image_urls ?? row.photos, 'retail-items'),
      condition: row.condition || row.item_condition || null,
      location: row.location || row.city || row.address || '',
      lat: row.lat ?? row.latitude ?? null,
      lon: row.lon ?? row.longitude ?? null,
      created_at: row.created_at || row.createdAt || null,
      slug: row.slug || row.item_slug || row.listing_slug || `retail-${row.id}`,
      source: 'retail' as const,
      business_id: row.business_id || null,
    }));

    const normalizedDealership = (dealershipRes.data || []).map((row: any) => ({
      id: String(row.id),
      title: row.title || row.name || row.vehicle_name || row.model || 'Dealership listing',
      price: row.price ?? row.amount ?? row.cost ?? '',
      description: row.description || row.details || row.notes || null,
      imageUrls: normalizeImages(row.images ?? row.image_url ?? row.image_urls ?? row.photos, 'car-listings'),
      condition: row.condition || row.item_condition || null,
      location: row.location || row.city || row.address || '',
      lat: row.lat ?? row.latitude ?? null,
      lon: row.lon ?? row.longitude ?? null,
      created_at: row.created_at || row.createdAt || null,
      slug: row.slug || row.item_slug || row.listing_slug || `dealership-${row.id}`,
      source: 'dealership' as const,
      business_id: row.business_id || null,
    }));

    const normalizedRealEstate = (realEstateRes.data || []).map((row: any) => ({
      id: String(row.id),
      title: row.title || 'Real estate listing',
      price: row.price ?? '',
      description: row.description || row.details || null,
      imageUrls: normalizeImages(row.images ?? row.image_url ?? row.image_urls ?? row.photos, 'real-estate-listings'),
      condition: row.property_type || null,
      location: row.address || row.city || '',
      lat: null,
      lon: null,
      created_at: row.created_at || row.createdAt || null,
      slug: `real-estate-${row.id}`,
      source: 'real_estate' as const,
      business_id: row.business_id || null,
    }));

    const normalizedIndividual = (individualRes.data || []).map((row: any) => {
      const raw = row.image_urls ?? row.imageUrls;
      const urls = normalizeImages(raw, 'marketplace-images');
      return {
        id: String(row.id),
        title: row.title || 'Listing',
        price: row.price ?? '',
        description: row.description || null,
        imageUrls: urls,
        condition: row.condition || null,
        location: row.location || '',
        lat: null,
        lon: null,
        created_at: row.created_at || null,
        slug: `individual-${row.id}`,
        source: 'individual' as const,
        business_id: null,
        user_id: row.user_id || null,
      };
    });

    const { data: homeSession } = await supabase.auth.getSession();
    const deviceLang =
      typeof navigator !== 'undefined' ? (navigator.language?.split('-')[0] || '').toLowerCase() : '';

    let rawPosts: CommunityPost[] = [];
    try {
      const rankedRes = await fetch('/api/community/home-feed-posts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(homeSession?.session?.access_token
            ? { Authorization: `Bearer ${homeSession.session.access_token}` }
            : {}),
        },
        credentials: 'include',
        body: JSON.stringify({
          userId: homeSession?.session?.user?.id,
          explore: true,
          limit: 48,
          candidateLimit: 320,
          primaryLang: null,
          spokenLanguages: Array.isArray(audienceJson?.spoken_languages) ? audienceJson.spoken_languages : [],
          deviceLang: deviceLang || null,
          feedLang: feedLangForRequest || null,
          feedSort: tab === 'popular' ? 'popular' : 'for_you',
          tag: tab === 'news' ? 'news' : null,
        }),
      });
      const rankedPayload = await rankedRes.json().catch(() => ({}));
      if (rankedRes.ok && Array.isArray(rankedPayload.posts) && rankedPayload.posts.length > 0) {
        rawPosts = rankedPayload.posts as CommunityPost[];
      }
    } catch {
      /* fallback query below */
    }

    if (rawPosts.length === 0) {
      const fb = await supabase
        .from('community_posts')
        .select(
          'id, title, body, created_at, author, author_type, username, user_id, org_id, image, video, likes_post, community_comments(count)'
        )
        .eq('deleted', false)
        .or('visibility.eq.community,visibility.is.null')
        .order('created_at', { ascending: false })
        .limit(48);
      rawPosts = (fb.data || []) as CommunityPost[];
    }

    const postIds = rawPosts.map((p: { id: string }) => p.id);
    const skipLikeRefetch =
      rawPosts.length > 0 && rawPosts.some((p) => p.home_rank_score !== undefined && p.home_rank_score !== null);

    if (postIds.length > 0 && !skipLikeRefetch) {
      try {
        const countsRes = await fetch(`/api/community/post/counts?postIds=${postIds.join(',')}`);
        const { counts } = await countsRes.json();
        if (counts) {
          rawPosts.forEach((p) => {
            p.likes_post = counts[p.id] ?? p.likes_post ?? 0;
          });
        }
      } catch {
        // keep original likes_post
      }
    }

    // Enrich with profile pics, org logos, and business logos.
    const userIds = [...new Set((rawPosts as { user_id?: string | null }[]).map((p) => p.user_id).filter(Boolean))] as string[];
    const orgIds = [...new Set((rawPosts as { org_id?: string | null }[]).map((p) => p.org_id).filter(Boolean))] as string[];
    const [profilesRes, orgsRes, businessesRes] = await Promise.all([
      userIds.length > 0 ? supabase.from('profiles').select('id, profile_pic_url').in('id', userIds) : Promise.resolve({ data: [] }),
      orgIds.length > 0 ? supabase.from('organizations').select('id, logo_url').in('id', orgIds) : Promise.resolve({ data: [] }),
      userIds.length > 0
        ? supabase
            .from('businesses')
            .select('owner_id, logo_url, created_at')
            .in('owner_id', userIds)
            .order('created_at', { ascending: false })
        : Promise.resolve({ data: [] }),
    ]);
    const profileMap = new Map(
      (profilesRes.data || []).map((p: { id: string; profile_pic_url: string | null }) => [
        p.id,
        normalizeAvatarUrl(p.profile_pic_url, ['avatars']),
      ])
    );
    const orgMap = new Map(
      (orgsRes.data || []).map((o: { id: string; logo_url: string | null }) => [
        o.id,
        normalizeAvatarUrl(o.logo_url, ['organizations', 'organization-uploads']),
      ])
    );
    const businessMap = new Map<string, string | null>();
    for (const row of (businessesRes.data || []) as Array<{ owner_id: string; logo_url: string | null }>) {
      if (!businessMap.has(row.owner_id)) {
        businessMap.set(row.owner_id, normalizeAvatarUrl(row.logo_url, ['business-uploads']));
      }
    }
    rawPosts.forEach((p: { user_id?: string | null; org_id?: string | null; author_type?: string | null; logo_url?: string | null; profile_pic_url?: string | null } & Record<string, unknown>) => {
      const normalizedExistingProfile = normalizeAvatarUrl(p.profile_pic_url, [
        'avatars',
        'business-uploads',
        'organizations',
        'organization-uploads',
      ]);
      const normalizedExistingLogo = normalizeAvatarUrl(p.logo_url, [
        'business-uploads',
        'organizations',
        'organization-uploads',
      ]);
      if (p.author_type === 'organization' && p.org_id) {
        (p as Record<string, unknown>).logo_url = orgMap.get(p.org_id) ?? normalizedExistingLogo ?? null;
      } else if (p.author_type === 'business' && p.user_id) {
        (p as Record<string, unknown>).logo_url = businessMap.get(p.user_id) ?? normalizedExistingLogo ?? null;
        (p as Record<string, unknown>).profile_pic_url = profileMap.get(p.user_id) ?? normalizedExistingProfile ?? null;
      } else if (p.user_id) {
        (p as Record<string, unknown>).profile_pic_url =
          profileMap.get(p.user_id) ??
          normalizedExistingProfile ??
          businessMap.get(p.user_id) ??
          null;
      } else {
        (p as Record<string, unknown>).profile_pic_url = normalizedExistingProfile ?? null;
        (p as Record<string, unknown>).logo_url = normalizedExistingLogo ?? null;
      }
    });

    if (homeSession?.session?.access_token && homeSession.session.user?.id) {
      try {
        const br = await fetch('/api/user/blocks', {
          headers: { Authorization: `Bearer ${homeSession.session.access_token}` },
          credentials: 'include',
        });
        const bd = await br.json().catch(() => ({}));
        const blocked = new Set((bd.mutualBlockedUserIds || []) as string[]);
        rawPosts = rawPosts.filter((p: { user_id?: string | null }) => !p.user_id || !blocked.has(p.user_id));
      } catch {
        // keep posts if block fetch fails
      }
    }

    const combinedItems = [...normalizedRetail, ...normalizedDealership, ...normalizedRealEstate, ...normalizedIndividual].sort((a, b) =>
      sortByCreatedAtDesc(a.created_at, b.created_at)
    );
    const itemBusinessIds = Array.from(
      new Set(combinedItems.map((item) => item.business_id).filter(Boolean) as string[])
    );
    let verifiedMap = new Map<string, boolean>();
    let businessLocationMap = new Map<string, string>();
    if (itemBusinessIds.length > 0) {
      const { data: businessRows } = await supabase
        .from('businesses')
        .select('id, is_verified, address')
        .in('id', itemBusinessIds);
      verifiedMap = new Map(
        (businessRows || []).map((row: { id: string; is_verified?: boolean | null }) => [
          row.id,
          Boolean(row.is_verified),
        ])
      );
      businessLocationMap = new Map(
        (businessRows || [])
          .map((row: { id: string; address?: { city?: string; state?: string } | string | null }) => {
            let addr: { city?: string; state?: string } | null = null;
            if (row.address) {
              if (typeof row.address === 'object') addr = row.address;
              else if (typeof row.address === 'string') {
                try { addr = JSON.parse(row.address) as { city?: string; state?: string }; } catch { /* ignore */ }
              }
            }
            const city = addr?.city || '';
            const state = addr?.state || '';
            const loc = [city, state].filter(Boolean).join(', ');
            return [row.id, loc] as [string, string];
          })
          .filter(([, loc]) => loc.length > 0)
      );
    }
    const itemsWithVerified = combinedItems.map((item) => {
      const businessLocation = item.business_id ? businessLocationMap.get(item.business_id) : null;
      const location = businessLocation && businessLocation.length > 0 ? businessLocation : (item.location || '');
      return {
        ...item,
        location: location || item.location || '',
        business_verified: item.business_id ? verifiedMap.get(item.business_id) || false : false,
      };
    });

    return { rawPosts, businesses: businessRes.data || [], organizations: orgRes.data || [], marketplaceItems: itemsWithVerified };
  };

  const loadBanners = async (coords?: { lat: number; lon: number } | null): Promise<AdBanner[]> => {
    try {
      let lat: number | null = coords?.lat ?? null;
      let lon: number | null = coords?.lon ?? null;
      if ((lat == null || lon == null) && typeof localStorage !== 'undefined') {
        try {
          const stored = localStorage.getItem('userCoords');
          if (stored) {
            const parsed = JSON.parse(stored) as { lat?: number; lon?: number };
            if (typeof parsed?.lat === 'number' && typeof parsed?.lon === 'number') {
              lat = parsed.lat;
              lon = parsed.lon;
            }
          }
        } catch {
          // ignore
        }
      }
      const segmentRes = await fetch('/api/user/audience-segment');
      const segment = await segmentRes.json().catch(() => ({}));
      const params = new URLSearchParams();
      if (segment.age_group) params.set('age_group', segment.age_group);
      if (segment.gender) params.set('gender', segment.gender);
      if (effectiveLang) params.append('lang', effectiveLang);
      if (Array.isArray(segment.spoken_languages)) segment.spoken_languages.forEach((l: string) => params.append('lang', l));
      if (segment.state) params.set('state', segment.state);
      if (lat != null && lon != null) {
        params.set('lat', String(lat));
        params.set('lon', String(lon));
      }
      const qs = params.toString();
      const url = qs ? `/api/feed-banners?${qs}` : '/api/feed-banners';
      const res = await fetch(url);
      const data = await res.json().catch(() => ({}));
      if (res.ok && Array.isArray(data.banners)) {
        return data.banners.map((b: { id: string; image: string; link: string; alt?: string }) => ({
          id: b.id,
          image: b.image,
          link: b.link || '#',
          alt: b.alt || 'Banner',
        }));
      }
    } catch {
      // ignore
    }
    return [];
  };

  const applyFeedData = (
    data: { rawPosts: CommunityPost[]; businesses: Business[]; organizations: Organization[]; marketplaceItems: MarketplaceItem[] },
    banners: AdBanner[],
    cachePostFeedLang: string,
    cacheHomeFeedTab: HomeFeedTab
  ) => {
    setCommunityPosts(data.rawPosts);
    setBusinesses(data.businesses);
    setOrganizations(data.organizations);
    setMarketplaceItems(data.marketplaceItems);
    setFeedBanners(banners);
    if (data.rawPosts.length > 0) {
      const newest = data.rawPosts.reduce((a, p) => {
        const t = new Date(p.created_at || 0).getTime();
        return t > a.t ? { t, iso: p.created_at } : a;
      }, { t: 0, iso: data.rawPosts[0].created_at });
      latestPostDateRef.current = newest.iso;
    }
    writeFeedCache({
      postFeedLang: cachePostFeedLang,
      homeFeedTab: cacheHomeFeedTab,
      communityPosts: data.rawPosts,
      businesses: data.businesses,
      organizations: data.organizations,
      marketplaceItems: data.marketplaceItems,
      feedBanners: banners,
    });
  };

  const refreshFeed = async () => {
    const cacheLang = postFeedLangRef.current;
    const cacheTab = homeFeedTabRef.current;
    setRefreshing(true);
    setHasNewContent(false);
    try {
      const [data, banners] = await Promise.all([loadHomeFeed(), loadBanners()]);
      applyFeedData(data, banners, cacheLang, cacheTab);
      setVisibleCount(12);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } finally {
      setRefreshing(false);
    }
  };

  // Load feed when post language (dropdown) or tab changes; cache keyed by both.
  useEffect(() => {
    if (!postFeedLangReady) return;
    let cancelled = false;

    const init = async () => {
      setVisibleCount(12);
      const cache = readFeedCache(postFeedLang, homeFeedTab);
      if (cache) {
        setCommunityPosts(cache.communityPosts);
        setBusinesses(cache.businesses);
        setOrganizations(cache.organizations);
        setMarketplaceItems(cache.marketplaceItems);
        setFeedBanners(cache.feedBanners);
        if (cache.communityPosts.length > 0) {
          const newest = cache.communityPosts.reduce(
            (a, p) => {
              const t = new Date(p.created_at || 0).getTime();
              return t > a.t ? { t, iso: p.created_at } : a;
            },
            { t: 0, iso: cache.communityPosts[0].created_at }
          );
          latestPostDateRef.current = newest.iso;
        }
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        const [data, banners] = await Promise.all([loadHomeFeed(), loadBanners()]);
        if (cancelled) return;
        applyFeedData(data, banners, postFeedLang, homeFeedTab);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void init();
    return () => {
      cancelled = true;
    };
  }, [postFeedLang, homeFeedTab, postFeedLangReady]);

  // When user location becomes available, refetch banners so city-targeted ones (20 mi radius) appear
  useEffect(() => {
    if (!userCoords) return;
    loadBanners(userCoords).then((banners) => setFeedBanners(banners));
  }, [userCoords?.lat, userCoords?.lon]);

  // Background check for new content every 30 seconds
  useEffect(() => {
    const interval = setInterval(async () => {
      if (!latestPostDateRef.current) return;
      try {
        const { count } = await supabase
          .from('community_posts')
          .select('*', { count: 'exact', head: true })
          .eq('deleted', false)
          .or('visibility.eq.community,visibility.is.null')
          .gt('created_at', latestPostDateRef.current);
        if (count && count > 0) {
          setHasNewContent(true);
        }
      } catch {
        // ignore
      }
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  const sortedBusinesses = useMemo(
    () => [...businesses].sort((a, b) => sortByCreatedAtDesc(a.created_at, b.created_at)),
    [businesses]
  );

  const businessesWithDistance = useMemo(() => {
    if (!userCoords) return sortedBusinesses;
    return sortedBusinesses.map((biz) => {
      if (biz.lat == null || biz.lon == null) return biz;
      return {
        ...biz,
        distance: getDistanceMiles(userCoords.lat, userCoords.lon, biz.lat, biz.lon),
      };
    });
  }, [sortedBusinesses, userCoords]);

  const businessDistances = useMemo(
    () => businessesWithDistance.map((biz) => biz.distance).filter((d): d is number => typeof d === 'number'),
    [businessesWithDistance]
  );

  const businessRadius = useMemo(() => {
    if (!userCoords || businessDistances.length === 0) return Infinity;
    return getExpandedRadius(businessDistances, 50, 100);
  }, [userCoords, businessDistances]);

  const nearbyBusinesses = useMemo(() => {
    if (!userCoords || businessDistances.length === 0) return businessesWithDistance;
    if (businessRadius === Infinity) {
      return businessesWithDistance.filter((biz) => typeof biz.distance === 'number' || biz.distance === undefined);
    }
    return businessesWithDistance.filter(
      (biz) => (typeof biz.distance === 'number' && biz.distance <= businessRadius) || biz.distance === undefined
    );
  }, [businessDistances.length, businessRadius, businessesWithDistance, userCoords]);

  const getBusinessMessage = (biz: Business) => {
    if (typeof biz.distance === 'number') {
      return `Now serving your area • ${Math.round(biz.distance)} miles away`;
    }
    return `${biz.business_name} just joined Hanar`;
  };

const formatDateLabel = (value?: string | null) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString();
};

  const sortedMarketplaceItems = useMemo(
    () => [...marketplaceItems].sort((a, b) => sortByCreatedAtDesc(a.created_at, b.created_at)),
    [marketplaceItems]
  );

  const marketplaceWithDistance = useMemo(() => {
    if (!userCoords) return sortedMarketplaceItems;
    return sortedMarketplaceItems.map((item) => {
      if (item.lat == null || item.lon == null) return item;
      return {
        ...item,
        distance: getDistanceMiles(userCoords.lat, userCoords.lon, item.lat, item.lon),
      };
    });
  }, [sortedMarketplaceItems, userCoords]);

  const marketplaceDistances = useMemo(
    () => marketplaceWithDistance.map((item) => item.distance).filter((d): d is number => typeof d === 'number'),
    [marketplaceWithDistance]
  );

  const marketplaceRadius = useMemo(() => {
    if (!userCoords || marketplaceDistances.length === 0) return Infinity;
    return getExpandedRadius(marketplaceDistances, 40, 100);
  }, [userCoords, marketplaceDistances]);

  const nearbyMarketplaceItems = useMemo(() => {
    if (!userCoords || marketplaceDistances.length === 0) return marketplaceWithDistance;
    if (marketplaceRadius === Infinity) {
      return marketplaceWithDistance.filter((item) => typeof item.distance === 'number');
    }
    return marketplaceWithDistance.filter(
      (item) => typeof item.distance === 'number' && item.distance <= marketplaceRadius
    );
  }, [marketplaceDistances.length, marketplaceRadius, marketplaceWithDistance, userCoords]);

  const featuredBusinesses = useMemo<SliderBusiness[]>(
    () =>
      nearbyBusinesses.slice(0, 8).map((biz) => ({
        id: biz.id,
        slug: biz.slug,
        name: biz.business_name,
        category: biz.subcategory || biz.category || '',
        image: biz.logo_url || '/placeholder.jpg',
        plan: biz.plan,
      })),
    [nearbyBusinesses]
  );

  const marketplaceCategoryFeedBuckets = useMemo(() => {
    const groups = new Map<string, MarketplaceItem[]>();
    for (const item of nearbyMarketplaceItems) {
      const label =
        item.category && String(item.category).trim() ? String(item.category).trim() : 'Latest on MarketPlace';
      const list = groups.get(label) ?? [];
      list.push(item);
      groups.set(label, list);
    }
    return Array.from(groups.entries())
      .map(([categoryLabel, raw]) => {
        const items = [...raw].sort((a, b) => sortByCreatedAtDesc(a.created_at, b.created_at));
        const date = items.reduce(
          (max, i) => Math.max(max, new Date(i.created_at || 0).getTime()),
          0
        );
        return { categoryLabel, items, date };
      })
      .sort((a, b) => b.date - a.date);
  }, [nearbyMarketplaceItems]);

  const requireLogin = () => {
    if (!currentUser.id) {
      window.location.href = '/login?redirect=/';
      return false;
    }
    return true;
  };

  useEffect(() => {
    if (!composerExpanded) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setComposerExpanded(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [composerExpanded]);

  const handleLikePost = async (postId: string) => {
    if (!requireLogin()) return;

    const currentlyLiked = likedPosts.has(postId);
    const delta = currentlyLiked ? -1 : 1;

    // Optimistic update: show new count and liked state immediately
    setCommunityPosts((prev) =>
      prev.map((post) =>
        post.id === postId
          ? { ...post, likes_post: Math.max(0, (post.likes_post || 0) + delta) }
          : post
      )
    );
    setLikedPosts((prev) => {
      const next = new Set(prev);
      if (currentlyLiked) next.delete(postId);
      else next.add(postId);
      return next;
    });

    const revert = () => {
      setCommunityPosts((prev) =>
        prev.map((post) =>
          post.id === postId
            ? { ...post, likes_post: Math.max(0, (post.likes_post || 0) - delta) }
            : post
        )
      );
      setLikedPosts((prev) => {
        const next = new Set(prev);
        if (currentlyLiked) next.add(postId);
        else next.delete(postId);
        return next;
      });
    };

    const method = currentlyLiked ? 'DELETE' : 'POST';
    const url =
      method === 'DELETE'
        ? `/api/community/post/like?post_id=${encodeURIComponent(postId)}`
        : '/api/community/post/like';

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const headers: Record<string, string> = {};
      if (method === 'POST') headers['Content-Type'] = 'application/json';
      if (session?.access_token) headers['Authorization'] = `Bearer ${session.access_token}`;

      const res = await fetch(url, {
        method,
        headers,
        body: method === 'POST' ? JSON.stringify({ post_id: postId }) : undefined,
        credentials: 'include',
      });

      if (!res.ok && res.status !== 409) {
        revert();
        const err = await res.json().catch(() => ({}));
        toast.error(err?.error || 'Could not save like. Please try again.');
        return;
      }

      // Sync with server response for accurate count
      const data = await res.json().catch(() => ({}));
      if (typeof data.likes === 'number') {
        setCommunityPosts((prev) =>
          prev.map((post) =>
            post.id === postId ? { ...post, likes_post: data.likes } : post
          )
        );
      }
    } catch (err) {
      revert();
      toast.error('Could not save like. Please check your connection and try again.');
    }
  };

  const enrichCommentsWithAvatars = useCallback(async (comments: Comment[]) => {
    if (!comments.length) return comments;
    const userIds = Array.from(new Set(comments.map((c) => c.user_id).filter(Boolean)));
    const normalizedWithoutLookup = comments.map((comment) => {
      const isBusinessAuthor = String(comment.author_type || '').toLowerCase() === 'business';
      const isOrgAuthor = String(comment.author_type || '').toLowerCase() === 'organization';
      const normalizedCommentAvatar = normalizeAvatarUrl(
        comment.avatar_url,
        isBusinessAuthor
          ? ['business-uploads', 'organizations', 'organization-uploads', 'avatars']
          : isOrgAuthor
            ? ['organizations', 'organization-uploads', 'avatars', 'business-uploads']
            : ['avatars', 'business-uploads', 'organizations', 'organization-uploads']
      );
      const normalizedCommentLogo = normalizeAvatarUrl(
        comment.logo_url,
        isBusinessAuthor
          ? ['business-uploads', 'organizations', 'organization-uploads']
          : ['organizations', 'organization-uploads', 'business-uploads']
      );
      const normalizedProfileAvatar = normalizeAvatarUrl(comment.profiles?.profile_pic_url, ['avatars']);
      return {
        ...comment,
        avatar_url: normalizedCommentAvatar || normalizedCommentLogo || normalizedProfileAvatar || null,
      };
    });
    if (!userIds.length) return normalizedWithoutLookup;

    const [profilesRes, orgsRes, businessesRes] = await Promise.all([
      supabase.from('profiles').select('id, profile_pic_url').in('id', userIds),
      supabase.from('organizations').select('user_id, logo_url').in('user_id', userIds),
      supabase
        .from('businesses')
        .select('owner_id, logo_url, created_at')
        .in('owner_id', userIds)
        .order('created_at', { ascending: false }),
    ]);

    const profileMap = new Map(
      (profilesRes.data || []).map((p: { id: string; profile_pic_url: string | null }) => [
        p.id,
        normalizeAvatarUrl(p.profile_pic_url, ['avatars']),
      ])
    );
    const orgMap = new Map(
      (orgsRes.data || []).map((o: { user_id: string; logo_url: string | null }) => [
        o.user_id,
        normalizeAvatarUrl(o.logo_url, ['organizations', 'organization-uploads']),
      ])
    );
    const businessMap = new Map<string, string | null>();
    for (const row of (businessesRes.data || []) as Array<{ owner_id: string; logo_url: string | null }>) {
      if (!businessMap.has(row.owner_id)) {
        businessMap.set(row.owner_id, normalizeAvatarUrl(row.logo_url, ['business-uploads']));
      }
    }

    return normalizedWithoutLookup.map((comment) => {
      const isBusinessAuthor = String(comment.author_type || '').toLowerCase() === 'business';
      const isOrgAuthor = String(comment.author_type || '').toLowerCase() === 'organization';
      const normalizedCommentAvatar = normalizeAvatarUrl(
        comment.avatar_url,
        isBusinessAuthor
          ? ['business-uploads', 'organizations', 'organization-uploads', 'avatars']
          : isOrgAuthor
            ? ['organizations', 'organization-uploads', 'avatars', 'business-uploads']
            : ['avatars', 'business-uploads', 'organizations', 'organization-uploads']
      );
      const normalizedCommentLogo = normalizeAvatarUrl(
        comment.logo_url,
        isBusinessAuthor
          ? ['business-uploads', 'organizations', 'organization-uploads']
          : ['organizations', 'organization-uploads', 'business-uploads']
      );

      return {
        ...comment,
        avatar_url:
          normalizedCommentAvatar ||
          normalizedCommentLogo ||
          normalizeAvatarUrl(comment.profiles?.profile_pic_url, ['avatars']) ||
          (isBusinessAuthor
            ? businessMap.get(comment.user_id) || orgMap.get(comment.user_id) || profileMap.get(comment.user_id)
            : isOrgAuthor
              ? orgMap.get(comment.user_id) || profileMap.get(comment.user_id) || businessMap.get(comment.user_id)
              : profileMap.get(comment.user_id) || orgMap.get(comment.user_id) || businessMap.get(comment.user_id)) ||
          null,
      };
    });
  }, []);

  const toggleComments = async (postId: string) => {
    setCommentsOpen((prev) => {
      const next = new Set(prev);
      if (next.has(postId)) {
        next.delete(postId);
      } else {
        next.add(postId);
      }
      return next;
    });

    if (!commentsByPost[postId] && !commentLoading[postId]) {
      setCommentLoading((prev) => ({ ...prev, [postId]: true }));
      try {
        const params = new URLSearchParams({ postId });
        if (currentUser.id) params.set('userId', currentUser.id);
        const res = await fetch(`/api/community/comments?${params.toString()}`);
        const data = await res.json();
        const enrichedComments = await enrichCommentsWithAvatars((data.comments || []) as Comment[]);
        setCommentsByPost((prev) => ({ ...prev, [postId]: enrichedComments }));
      } finally {
        setCommentLoading((prev) => ({ ...prev, [postId]: false }));
      }
    }
  };

  const handleCommentLike = async (postId: string, commentId: string) => {
    if (!currentUser.id) {
      window.location.href = '/login?redirect=/';
      return;
    }
    const comments = commentsByPost[postId] || [];
    const comment = comments.find((c) => c.id === commentId);
    if (!comment) return;
    const currentlyLiked = comment.user_liked ?? false;
    const delta = currentlyLiked ? -1 : 1;

    setCommentsByPost((prev) => ({
      ...prev,
      [postId]: (prev[postId] || []).map((c) =>
        c.id === commentId
          ? {
              ...c,
              user_liked: !currentlyLiked,
              likes: Math.max(0, (c.likes ?? c.likes_comment ?? 0) + delta),
              likes_comment: Math.max(0, (c.likes ?? c.likes_comment ?? 0) + delta),
            }
          : c
      ),
    }));

    const method = currentlyLiked ? 'DELETE' : 'POST';
    const url =
      method === 'DELETE'
        ? `/api/community/comments/like?comment_id=${encodeURIComponent(commentId)}&user_id=${encodeURIComponent(currentUser.id)}`
        : '/api/community/comments/like';

    const res = await fetch(url, {
      method,
      headers: method === 'POST' ? { 'Content-Type': 'application/json' } : undefined,
      body: method === 'POST' ? JSON.stringify({ comment_id: commentId, user_id: currentUser.id }) : undefined,
    });

    if (!res.ok && res.status !== 409) {
      setCommentsByPost((prev) => ({
        ...prev,
        [postId]: (prev[postId] || []).map((c) =>
          c.id === commentId
            ? {
                ...c,
                user_liked: currentlyLiked,
                likes: Math.max(0, (c.likes ?? 0) - delta),
                likes_comment: Math.max(0, (c.likes_comment ?? 0) - delta),
              }
            : c
        ),
      }));
    }
  };

  const submitComment = async (postId: string) => {
    if (!requireLogin()) return;
    const text = commentInputs[postId]?.trim();
    if (!text) return;

    const res = await fetch('/api/community/comments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        post_id: postId,
        text,
        user_id: currentUser.id,
        username: currentUser.username,
        author: currentUser.displayName || currentUser.username || 'User',
      }),
    });

    const data = await res.json();
    if (!res.ok) return;
    const insertedComment = (data.comment || {}) as Comment;
    const normalizedInsertedAvatar =
      insertedComment.author_type === 'business'
        ? normalizeAvatarUrl(insertedComment.logo_url || insertedComment.avatar_url, [
            'business-uploads',
            'organizations',
            'organization-uploads',
            'avatars',
          ])
        : normalizeAvatarUrl(insertedComment.avatar_url || insertedComment.logo_url, [
            'avatars',
            'business-uploads',
            'organizations',
            'organization-uploads',
          ]);
    const commentForState: Comment = {
      ...insertedComment,
      avatar_url: normalizedInsertedAvatar || null,
    };
    const [hydratedInsertedComment] = await enrichCommentsWithAvatars([commentForState]);

    setCommentsByPost((prev) => ({
      ...prev,
      [postId]: [hydratedInsertedComment || commentForState, ...(prev[postId] || [])],
    }));
    setCommentInputs((prev) => ({ ...prev, [postId]: '' }));
    setCommunityPosts((prev) =>
      prev.map((post) => {
        if (post.id !== postId) return post;
        const currentCount = post.community_comments?.[0]?.count || 0;
        return { ...post, community_comments: [{ count: currentCount + 1 }] };
      })
    );
  };

  const handleDeletePost = async (postId: string) => {
    if (!requireLogin()) return;
    if (!confirm('Are you sure you want to delete this post? This cannot be undone.')) return;
    setDeletingPost(postId);
    try {
      const { error } = await supabase
        .from('community_posts')
        .update({ deleted: true })
        .eq('id', postId)
        .eq('user_id', currentUser.id);

      if (error) throw error;
      setCommunityPosts((prev) => prev.filter((p) => p.id !== postId));
    } catch (err) {
      console.error('Delete error:', err);
      alert('Failed to delete post');
    } finally {
      setDeletingPost(null);
    }
  };

  const handlePromotePost = () => {
    alert('Promote coming soon.');
  };

  const handleSharePost = async (postId: string) => {
    const url = `${window.location.origin}/community/post/${postId}`;
    const shareData = {
      title: 'Hanar Community',
      text: 'Check out this post on Hanar.',
      url,
    };

    if (navigator.share) {
      try {
        await navigator.share(shareData);
        return;
      } catch {
        // fall through to clipboard
      }
    }

    try {
      await navigator.clipboard.writeText(url);
      alert('Link copied to clipboard');
    } catch {
      window.prompt('Copy this link:', url);
    }
  };

  /** First banner is reserved for the hero slot above the feed; rest are inlined below. */
  const heroFeedBanner = useMemo(
    () => feedBanners.find((b) => !!b.image) ?? null,
    [feedBanners]
  );

  // Mixed feed: random order with some newest cards sprinkled in; sliders + ads layered after.
  const feedItems = useMemo<FeedItem[]>(() => {
    const mixDiscovery = homeFeedTab !== 'news';
    const postLangKey = postFeedLang.trim().toLowerCase();
    const preservePostLanguageOrder =
      Boolean(postLangKey) && supportedLanguages.some((l) => l.code === postLangKey && l.code !== 'auto');

    let ordered: FeedItem[] = [];

    if (preservePostLanguageOrder && mixDiscovery) {
      const miscDated: { item: FeedItem; date: number }[] = [];
      for (const business of nearbyBusinesses) {
        miscDated.push({
          item: { type: 'business', business },
          date: new Date(business.created_at || 0).getTime(),
        });
      }
      for (const organization of organizations) {
        miscDated.push({
          item: { type: 'organization', organization },
          date: new Date(organization.created_at || 0).getTime(),
        });
      }
      for (const bucket of marketplaceCategoryFeedBuckets) {
        if (!bucket.items.length) continue;
        miscDated.push({
          item: {
            type: 'marketplaceCategorySlider',
            categoryLabel: bucket.categoryLabel,
            items: bucket.items,
          },
          date: bucket.date,
        });
      }
      ordered =
        communityPosts.length > 0 || miscDated.length > 0
          ? mergePostsInApiOrderWithShuffledMisc(communityPosts, miscDated)
          : [];
    } else if (preservePostLanguageOrder && !mixDiscovery) {
      ordered = communityPosts.map((post) => ({ type: 'post' as const, post }));
    } else {
      const datedPool: { item: FeedItem; date: number }[] = [];
      for (const post of communityPosts) {
        const created = new Date(post.created_at || 0).getTime();
        datedPool.push({ item: { type: 'post', post }, date: created });
      }
      if (mixDiscovery) {
        for (const business of nearbyBusinesses) {
          datedPool.push({ item: { type: 'business', business }, date: new Date(business.created_at || 0).getTime() });
        }
        for (const organization of organizations) {
          datedPool.push({ item: { type: 'organization', organization }, date: new Date(organization.created_at || 0).getTime() });
        }
        for (const bucket of marketplaceCategoryFeedBuckets) {
          if (!bucket.items.length) continue;
          datedPool.push({
            item: {
              type: 'marketplaceCategorySlider',
              categoryLabel: bucket.categoryLabel,
              items: bucket.items,
            },
            date: bucket.date,
          });
        }
      }
      ordered = datedPool.length > 0 ? shuffleHomeFeedWithFreshSprinkle(datedPool) : [];
    }

    if (!ordered.length && !loading && mixDiscovery) {
      for (const business of nearbyBusinesses) {
        ordered.push({ type: 'business', business });
      }
      for (const bucket of marketplaceCategoryFeedBuckets) {
        if (!bucket.items.length) continue;
        ordered.push({
          type: 'marketplaceCategorySlider',
          categoryLabel: bucket.categoryLabel,
          items: bucket.items,
        });
      }
    }

    // Insert featured-business slider after initial post-heavy zone
    const hasBizSlider = mixDiscovery && featuredBusinesses.length > 0;
    if (hasBizSlider && ordered.length > 6) {
      ordered.splice(Math.min(6, ordered.length), 0, { type: 'sliderBusinesses' });
    } else if (hasBizSlider) {
      ordered.push({ type: 'sliderBusinesses' });
    }

    // Intersperse ad banners less frequently (hero slot uses first banner)
    const validBanners = feedBanners.filter((b) => !!b.image);
    const inlineBanners = validBanners.length > 1 ? validBanners.slice(1) : [];
    if (inlineBanners.length === 0) return ordered;

    let bannerIdx = 0;
    const result: FeedItem[] = [];
    for (let i = 0; i < ordered.length; i++) {
      if (i > 0 && i % 8 === 7 && bannerIdx < inlineBanners.length * 2) {
        result.push({ type: 'ad', banner: inlineBanners[bannerIdx % inlineBanners.length] });
        bannerIdx++;
      }
      result.push(ordered[i]);
    }
    return result;
  }, [
    communityPosts,
    featuredBusinesses.length,
    feedBanners,
    loading,
    nearbyBusinesses,
    nearbyMarketplaceItems,
    organizations,
    marketplaceCategoryFeedBuckets,
    homeFeedTab,
    postFeedLang,
  ]);

  const filteredFeedItems = useMemo(() => {
    const normalizedQuery = normalizeSearchText(feedSearchQuery);
    if (!normalizedQuery) return feedItems;
    const terms = normalizedQuery.split(' ').filter(Boolean);
    if (!terms.length) return feedItems;

    const matchesTerms = (text: string) => {
      const normalizedText = normalizeSearchText(text);
      if (!normalizedText) return false;
      if (normalizedText.includes(normalizedQuery)) return true;
      const tokens = normalizedText.split(' ').filter(Boolean);
      return terms.every((term) => tokens.some((token) => fuzzyTokenMatch(term, token)));
    };

    return feedItems.filter(
      (item) =>
        item.type === 'post' &&
        matchesTerms(`${item.post.title} ${item.post.body} ${item.post.author || ''}`)
    );
  }, [feedItems, feedSearchQuery]);

  useEffect(() => {
    setVisibleCount(12);
  }, [feedSearchQuery]);

  useEffect(() => {
    if (feedSearchQuery.trim()) setFeedSearchOpen(true);
  }, [feedSearchQuery]);

  useEffect(() => {
    const target = bottomRef.current;
    if (!target) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setVisibleCount((prev) => prev + 12);
        }
      },
      { threshold: 0.1 }
    );
    observer.observe(target);
    return () => observer.disconnect();
  }, [filteredFeedItems.length, visibleCount]);

  const handlePullRefresh = useCallback(async () => {
    await refreshFeed();
  }, [refreshFeed]);

  const homeFeedLangSelectOptions = useMemo(
    () => [
      { value: '', label: t(effectiveLang, 'All languages'), emoji: '🌐' },
      ...supportedLanguages
        .filter((l) => l.code !== 'auto')
        .map((l) => ({ value: l.code, label: t(effectiveLang, l.name), emoji: l.emoji })),
    ],
    [effectiveLang]
  );

  return (
    <>
    <PullToRefresh onRefresh={handlePullRefresh}>
    <div className="min-h-screen bg-slate-100 dark:bg-gray-900">
      <div className="mx-auto max-w-[66rem] pb-6 pt-0">
        {heroFeedBanner && (
          <div className="border-b border-black dark:border-gray-500">
            <AdCardWithTrack banner={heroFeedBanner} />
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2 border-b border-black dark:border-gray-500 bg-white px-3 py-2.5 pr-24 shadow-sm dark:bg-gray-800 sm:px-4 sm:pr-28">
          <Link
            href="/"
            className="shrink-0 rounded-lg bg-gray-100 px-3 py-1.5 text-xs font-medium text-gray-700 transition-all hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
          >
            {t(effectiveLang, 'Community')}
          </Link>
          <button
            type="button"
            onClick={() => setHomeFeedTab('for_you')}
            className={`shrink-0 rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${
              homeFeedTab === 'for_you'
                ? 'bg-blue-100 text-blue-800'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600'
            }`}
          >
            {t(effectiveLang, 'For you')}
          </button>
          <button
            type="button"
            onClick={() => setHomeFeedTab('popular')}
            className={`shrink-0 rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${
              homeFeedTab === 'popular'
                ? 'bg-blue-100 text-blue-800'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600'
            }`}
          >
            {t(effectiveLang, 'Most Popular')}
          </button>
          <button
            type="button"
            onClick={() => setHomeFeedTab('news')}
            className={`shrink-0 rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${
              homeFeedTab === 'news'
                ? 'bg-blue-100 text-blue-800'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600'
            }`}
          >
            {t(effectiveLang, 'News')}
          </button>
          <button
            type="button"
            onClick={() => setFeedSearchOpen((v) => !v)}
            className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition ${
              feedSearchOpen ? 'bg-slate-800 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
            aria-expanded={feedSearchOpen}
            aria-controls="home-feed-search"
          >
            <Search className="h-3.5 w-3.5" />
            Search
          </button>
          <select
            id="home-feed-language-filter"
            value={postFeedLang}
            onChange={(e) => setPostFeedLang(e.target.value)}
            className="h-8 min-w-[8.5rem] shrink-0 cursor-pointer appearance-none rounded-lg border border-gray-200 bg-[length:12px] bg-[right_0.35rem_center] bg-no-repeat py-1 pl-2 pr-6 text-xs font-medium text-gray-800 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-rose-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200"
            style={{
              backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%236b7280'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'/%3E%3C/svg%3E")`,
            }}
            title={
              postFeedLang ? t(effectiveLang, 'Posts in this language first') : t(effectiveLang, 'All languages')
            }
            aria-label={t(effectiveLang, 'All languages')}
          >
            {homeFeedLangSelectOptions.map((opt) => (
              <option key={opt.value || 'all'} value={opt.value}>
                {opt.emoji ? `${opt.emoji} ${opt.label}` : opt.label}
              </option>
            ))}
          </select>
          {feedSearchOpen && (
          <div id="home-feed-search" className="w-full pt-1">
            <label className="relative block">
              <Search
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#4a0a14]"
                aria-hidden
              />
              <input
                type="search"
                value={feedSearchQuery}
                onChange={(e) => setFeedSearchQuery(e.target.value)}
                placeholder="Search words, phrases, or similar terms..."
                className="h-10 w-full rounded-full border-2 border-[#4a0a14]/55 bg-white pl-9 pr-3 text-sm font-medium text-slate-900 placeholder:text-slate-500 shadow-sm shadow-[#4a0a14]/15 focus:border-[#0b2a66] focus:outline-none focus:ring-2 focus:ring-[#0b2a66]/25"
                aria-label="Search feed"
              />
            </label>
          </div>
          )}
        </div>

        <div className="bg-slate-100 dark:bg-slate-100">
          <div
            className={`overflow-hidden px-0 transition-[max-height,opacity,transform] duration-300 ease-out ${
              composerExpanded ? 'pointer-events-none' : 'pointer-events-auto'
            }`}
            style={{
              maxHeight: composerExpanded ? '0px' : '110px',
              opacity: composerExpanded ? 0 : 1,
              transform: composerExpanded ? 'translateY(-8px)' : 'translateY(0)',
            }}
            aria-hidden={composerExpanded}
          >
            <div className="py-2 sm:py-2.5">
              <button
                type="button"
                onClick={() => {
                  if (!requireLogin()) return;
                  setComposerExpanded(true);
                }}
                className="group relative flex w-full min-h-[2.75rem] items-center gap-2.5 rounded-none bg-transparent py-2.5 pl-3.5 pr-3.5 text-left transition-colors duration-200 hover:bg-transparent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-200"
                aria-label="Ask — write a post"
              >
                <span className="shrink-0 select-none">
                  <Avatar
                    src={currentUser.avatarUrl}
                    alt={currentUser.displayName || currentUser.username || 'User'}
                    className="h-8 w-8 rounded-md"
                  />
                </span>
                <div className="pointer-events-none min-w-0 flex-1 rounded-xl bg-white px-3 py-2">
                  <span className="block truncate text-sm text-slate-500">Ask the community...</span>
                </div>
              </button>
            </div>
          </div>

          <div
            className={`overflow-hidden transition-[max-height,opacity,transform] duration-300 ease-out ${
              composerExpanded ? 'pointer-events-auto' : 'pointer-events-none'
            }`}
            style={{
              maxHeight: composerExpanded ? 'min(85dvh,940px)' : '0px',
              opacity: composerExpanded ? 1 : 0,
              transform: composerExpanded ? 'translateY(0)' : 'translateY(-8px)',
            }}
            role="region"
            aria-labelledby="home-compose-post-title"
            aria-hidden={!composerExpanded}
          >
            <div className="flex items-center justify-between gap-2 bg-transparent px-3 py-1.5">
              <span
                id="home-compose-post-title"
                className="text-sm font-bold tracking-wide text-slate-700"
              >
                Ask
              </span>
              <button
                type="button"
                onClick={() => setComposerExpanded(false)}
                className="rounded-full p-1.5 text-slate-600 transition hover:bg-slate-100 hover:text-slate-900"
                aria-label="Close composer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="max-h-[min(85dvh,880px)] overflow-y-auto overscroll-contain bg-white px-1 pb-2 sm:px-2 sm:pb-2 dark:bg-white">
              <Suspense
                fallback={
                  <div className="flex justify-center py-12 text-sm text-slate-500 dark:text-gray-400">
                    Loading...
                  </div>
                }
              >
                <CreateCommunityPostClient
                  embed="inline"
                  onCloseRequest={() => setComposerExpanded(false)}
                  onPublished={() => {
                    void refreshFeed();
                    setComposerExpanded(false);
                  }}
                />
              </Suspense>
            </div>
          </div>
        </div>

        {/* New content banner */}
        {hasNewContent && !refreshing && (
          <div className="border-b border-black dark:border-gray-500">
            <button
              type="button"
              onClick={refreshFeed}
              className="w-full rounded-xl border border-rose-200 dark:border-rose-800 bg-rose-50 dark:bg-rose-900/30 px-4 py-3 text-sm font-semibold text-rose-700 dark:text-rose-300 hover:bg-rose-100 dark:hover:bg-rose-900/50 transition-colors shadow-sm flex items-center justify-center gap-2"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 10l7-7m0 0l7 7m-7-7v18" />
              </svg>
              New posts available — tap to refresh
            </button>
          </div>
        )}

        {loading && (
          <div>
            {[1, 2, 3, 4].map((i, sIdx) => (
              <Fragment key={i}>
                {sIdx > 0 && <div className={HOME_FEED_BETWEEN_ROW} aria-hidden />}
                <div className="rounded-none border-0 bg-white p-4 shadow-sm ring-0 space-y-3.5 dark:bg-gray-800 sm:p-5">
                <div className="flex items-center gap-3">
                  <div className="skeleton h-9 w-9 shrink-0 rounded-none" />
                  <div className="flex-1 space-y-1.5">
                    <div className="skeleton h-3 w-28 rounded-none" />
                    <div className="skeleton h-2.5 w-16 rounded-none" />
                  </div>
                </div>
                <div className="skeleton h-3.5 w-3/4 rounded-none" />
                <div className="skeleton h-3 w-full rounded-none" />
                <div className="skeleton h-3 w-5/6 rounded-none" />
                {i % 2 === 0 && <div className="skeleton aspect-square w-full rounded-none" />}
                <div className="flex gap-6 pt-1">
                  <div className="skeleton h-3 w-12 rounded-none" />
                  <div className="skeleton h-3 w-16 rounded-none" />
                  <div className="skeleton h-3 w-10 rounded-none" />
                </div>
                </div>
              </Fragment>
            ))}
          </div>
        )}

        {!loading && filteredFeedItems.length > 0 && (
          <div>
        {filteredFeedItems.slice(0, visibleCount).map((item, index) => {
          if (item.type === 'post') {
            const dateLabel = new Date(item.post.created_at).toLocaleDateString();
            const liked = likedPosts.has(item.post.id);
            const commentCount = item.post.community_comments?.[0]?.count || 0;
            const isCommentsOpen = commentsOpen.has(item.post.id);
            const comments = commentsByPost[item.post.id] || [];
            return (
              <Fragment key={`post-${item.post.id}-${index}`}>
                {index > 0 && <div className={HOME_FEED_BETWEEN_ROW} aria-hidden />}
                <article className="rounded-none border-0 bg-white p-4 shadow-sm ring-0 dark:bg-gray-800 sm:p-5">
                <div className="flex items-center justify-between gap-2 text-xs text-slate-500 dark:text-gray-400">
                  <div className="flex items-center gap-2 min-w-0">
                    <Avatar
                      src={item.post.logo_url || item.post.profile_pic_url}
                      alt=""
                      className="h-8 w-8 shrink-0 rounded-none object-cover"
                    />
                    {item.post.author_type === 'organization' && item.post.username ? (
                      <Link href={`/organization/${item.post.username}`} className="font-semibold text-blue-900 dark:text-blue-300 hover:underline truncate">
                        {item.post.author || 'Organization'}
                      </Link>
                    ) : item.post.author_type === 'business' && item.post.username ? (
                      <Link href={`/business/${item.post.username}`} className="font-semibold text-blue-900 dark:text-blue-300 hover:underline truncate">
                        {item.post.author || 'Business'}
                      </Link>
                    ) : item.post.username ? (
                      <Link href={`/profile/${item.post.username}`} className="font-semibold text-blue-900 dark:text-blue-300 hover:underline truncate">
                        {item.post.author || 'User'}
                      </Link>
                    ) : (
                      <span className="font-semibold truncate text-blue-900 dark:text-blue-300">{item.post.author || 'Community'}</span>
                    )}
                  </div>
                  <span className="flex-shrink-0">{dateLabel}</span>
                </div>
                <Link href={`/community/post/${item.post.id}`} data-no-translate>
                  <h2 className="mt-2 text-[1.02rem] font-semibold leading-6 text-slate-800 dark:text-gray-100">{item.post.title}</h2>
                  <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-gray-300 line-clamp-3">{item.post.body}</p>
                </Link>
                <PostTranslateToggle
                  text={`${item.post.title}\n\n${item.post.body || ''}`}
                  postId={item.post.id}
                  sourceLang={item.post.language || null}
                  className="mt-2"
                />
                {item.post.video ? (
                  <div className="mt-3 w-[calc(100%+2.5rem)] max-w-none -mx-5">
                    <FeedVideoPlayer src={item.post.video} square />
                  </div>
                ) : item.post.image ? (
                  <Link href={`/community/post/${item.post.id}`} className="relative mt-3 block aspect-square w-[calc(100%+2.5rem)] max-w-none -mx-5 overflow-hidden">
                    <img
                      src={item.post.image}
                      alt={item.post.title}
                      loading="lazy"
                      decoding="async"
                      className="absolute inset-0 h-full w-full object-cover"
                    />
                  </Link>
                ) : null}
                <PostActionsBar
                  liked={liked}
                  likesCount={item.post.likes_post || 0}
                  commentCount={commentCount}
                  canLike={!!currentUser.id}
                  onLike={() => handleLikePost(item.post.id)}
                  onComment={() => toggleComments(item.post.id)}
                  onShare={() => handleSharePost(item.post.id)}
                  postId={item.post.id}
                  postTitle={item.post.title}
                />
                <div className="mt-2 flex items-center gap-2 border-t border-slate-100 dark:border-gray-600 pt-2">
                  <input
                    value={commentInputs[item.post.id] || ''}
                    onChange={(e) =>
                      setCommentInputs((prev) => ({ ...prev, [item.post.id]: e.target.value }))
                    }
                    onFocus={() => {
                      if (!currentUser.id) requireLogin();
                    }}
                    placeholder={currentUser.id ? 'Write a comment...' : 'Log in to write a comment'}
                    disabled={!currentUser.id}
                    className="flex-1 rounded-full border border-sky-300 px-4 py-2 text-sm focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-200/90 disabled:cursor-not-allowed disabled:opacity-60 dark:border-sky-400 dark:bg-gray-700 dark:text-gray-100 dark:focus:border-sky-300 dark:focus:ring-sky-400/45 dark:placeholder-gray-400"
                  />
                  <button
                    type="button"
                    onClick={() => submitComment(item.post.id)}
                    disabled={!currentUser.id || !commentInputs[item.post.id]?.trim()}
                    aria-label="Post comment"
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-sky-500 text-white shadow-sm transition hover:bg-sky-600 disabled:cursor-not-allowed disabled:bg-sky-200 disabled:text-sky-100/90 dark:bg-sky-600 dark:hover:bg-sky-500 dark:disabled:bg-slate-600 dark:disabled:text-slate-400"
                  >
                    <SendHorizontal className="h-4 w-4" strokeWidth={2.25} aria-hidden />
                  </button>
                </div>

                {currentUser.id && item.post.user_id === currentUser.id && (
                  <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-slate-100 dark:border-gray-600 pt-3 text-sm">
                    <button
                      onClick={() => handleDeletePost(item.post.id)}
                      disabled={deletingPost === item.post.id}
                      className="flex items-center gap-1.5 rounded-full bg-red-100 dark:bg-red-900/40 px-3 py-1.5 text-xs font-semibold text-red-600 dark:text-red-300 transition hover:bg-red-200 dark:hover:bg-red-900/60 disabled:opacity-50"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      Delete
                    </button>
                    <button
                      onClick={handlePromotePost}
                      className="flex items-center gap-1.5 rounded-full bg-indigo-100 dark:bg-indigo-900/40 px-3 py-1.5 text-xs font-semibold text-indigo-600 dark:text-indigo-300 transition hover:bg-indigo-200 dark:hover:bg-indigo-900/60"
                    >
                      <Megaphone className="h-3.5 w-3.5" />
                      Promote
                    </button>
                  </div>
                )}

                {isCommentsOpen && (
                  <div className="mt-4 border-t border-slate-100 dark:border-gray-600 pt-4">
                    {commentLoading[item.post.id] ? (
                      <p className="text-xs text-slate-500 dark:text-gray-400">Loading comments...</p>
                    ) : (
                      <div className="space-y-3">
                        {comments.length === 0 && (
                          <p className="text-xs text-slate-500 dark:text-gray-400">Be the first to comment.</p>
                        )}
                        {comments.map((comment) => (
                          <div key={comment.id} className="rounded-none bg-slate-100 px-3 py-2 text-sm flex gap-2 dark:bg-gray-700/80">
                            <div className="w-8 h-8 rounded-full overflow-hidden flex-shrink-0">
                              <Avatar
                                src={comment.avatar_url || null}
                                alt=""
                                className="w-full h-full rounded-full"
                              />
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="text-xs font-semibold text-slate-700 dark:text-gray-200">
                                {comment.author || comment.username || 'User'}
                              </p>
                              <div data-no-translate>
                                <p className="text-sm leading-6 text-slate-600 dark:text-gray-300">{comment.body ?? comment.text}</p>
                              </div>
                              <PostTranslateToggle text={String(comment.body ?? comment.text ?? '')} className="mt-1" />
                              <div className="flex items-center gap-2 mt-1">
                                {currentUser.id && (
                                  <button
                                    type="button"
                                    onClick={() => handleCommentLike(item.post.id, comment.id)}
                                    aria-label={comment.user_liked ? 'Unlike comment' : 'Like comment'}
                                    aria-pressed={!!comment.user_liked}
                                    className={`inline-flex items-center gap-1 text-xs font-medium transition ${
                                      comment.user_liked ? 'text-rose-600 dark:text-rose-400' : 'text-slate-400 dark:text-gray-500 hover:text-rose-500 dark:hover:text-rose-400'
                                    }`}
                                  >
                                    <ThumbsUp className="h-3.5 w-3.5 shrink-0" strokeWidth={2} aria-hidden />
                                    <span className="tabular-nums text-slate-500 dark:text-gray-400">
                                      {comment.likes ?? comment.likes_comment ?? 0}
                                    </span>
                                  </button>
                                )}
                                {!currentUser.id && (
                                  <span className="inline-flex items-center gap-1 text-xs text-slate-400 dark:text-gray-500">
                                    <ThumbsUp className="h-3.5 w-3.5 shrink-0 opacity-70" strokeWidth={2} aria-hidden />
                                    <span className="tabular-nums">{comment.likes ?? comment.likes_comment ?? 0}</span>
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </article>
              </Fragment>
            );
          }

          if (item.type === 'business') {
            return (
              <Fragment key={`biz-${item.business.id}-${index}`}>
                {index > 0 && <div className={HOME_FEED_BETWEEN_ROW} aria-hidden />}
                <FeedBusinessCardWithTrack
                  business={item.business}
                  formatDateLabel={formatDateLabel}
                  getBusinessMessage={getBusinessMessage}
                />
              </Fragment>
            );
          }

          if (item.type === 'organization') {
            return (
              <Fragment key={`org-${item.organization.id}-${index}`}>
                {index > 0 && <div className={HOME_FEED_BETWEEN_ROW} aria-hidden />}
                <article className="rounded-none border-0 bg-white p-4 shadow-sm ring-0 dark:bg-gray-800 sm:p-5">
                <div className="flex items-center gap-3">
                  <img
                    src={item.organization.logo_url || item.organization.banner_url || 'https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?w=600&auto=format&fit=crop'}
                    alt={item.organization.full_name}
                    loading="lazy"
                    decoding="async"
                    className="h-14 w-14 rounded-none object-cover border border-[#c41e56]/85 dark:border-[#e85085]/65"
                  />
                  <div>
                    <Link href={`/organization/${item.organization.username}`} className="text-sm font-semibold text-slate-800 dark:text-gray-100 hover:underline">
                      {item.organization.full_name}
                    </Link>
                    <p className="text-xs leading-5 text-slate-500 dark:text-gray-400 line-clamp-2">{item.organization.mission || 'Organization update'}</p>
                  </div>
                </div>
              </article>
              </Fragment>
            );
          }

          if (item.type === 'ad' && item.banner?.image) {
            return (
              <Fragment key={`ad-${item.banner.id}-${index}`}>
                {index > 0 && <div className={HOME_FEED_BETWEEN_ROW} aria-hidden />}
                <AdCardWithTrack banner={item.banner} />
              </Fragment>
            );
          }
          if (item.type === 'ad') return null;

          if (item.type === 'marketplaceCategorySlider') {
            return (
              <Fragment key={`mc-${item.categoryLabel}-${index}`}>
                {index > 0 && <div className={HOME_FEED_BETWEEN_ROW} aria-hidden />}
                <MarketplaceCategorySliderCard
                  categoryLabel={item.categoryLabel}
                  items={item.items}
                />
              </Fragment>
            );
          }

          if (item.type === 'sliderBusinesses') {
            return (
              <Fragment key={`slider-biz-${index}`}>
                {index > 0 && <div className={HOME_FEED_BETWEEN_ROW} aria-hidden />}
                <BusinessSliderCard items={featuredBusinesses} />
              </Fragment>
            );
          }

          return null;
        })}
          </div>
        )}

        {!loading && !filteredFeedItems.length && (
          <div className="rounded-none border border-slate-200 bg-white p-6 text-sm text-slate-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400">
            {feedSearchQuery.trim() ? 'No results for your search yet.' : 'No posts yet. Check back soon.'}
          </div>
        )}

        {!loading && filteredFeedItems.length > visibleCount && (
          <div
            ref={bottomRef}
            className="rounded-none border border-slate-200 border-t border-t-black bg-white p-4 text-center text-xs text-slate-500 dark:border-t-gray-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400"
          >
            Loading more...
          </div>
        )}
      </div>
      <Footer />
    </div>
    </PullToRefresh>
    </>
  );
}