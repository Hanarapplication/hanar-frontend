'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useKeenSlider } from 'keen-slider/react';
import Footer from '@/components/Footer';
import { Trash2, Megaphone } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import PostActionsBar from '@/components/PostActionsBar';

type SliderBusiness = { id: string; name: string; category: string; image: string };
type SliderItem = { id: string; title: string; price: string; image: string };
type AdBanner = { id: string; image: string; link: string; alt: string };

type CommunityPost = {
  id: string;
  title: string;
  body: string;
  created_at: string;
  author: string;
  author_type: string | null;
  username: string | null;
  user_id?: string | null;
  image: string | null;
  likes_post: number | null;
  community_comments?: { count: number }[];
};

type Business = {
  id: string;
  business_name: string;
  category: string | null;
  address: any;
  logo_url: string | null;
  slug: string;
  lat?: number | null;
  lon?: number | null;
  created_at?: string | null;
  distance?: number;
};

type Organization = {
  id: string;
  full_name: string;
  username: string;
  logo_url: string | null;
  banner_url: string | null;
  mission: string | null;
};

type MarketplaceItem = {
  id: string;
  title: string;
  price: number | string | null;
  description?: string | null;
  imageUrls?: string[] | string | null;
  condition?: string | null;
  location?: string | null;
  lat?: number | null;
  lon?: number | null;
  created_at?: string | null;
  distance?: number;
  slug?: string | null;
  source?: 'retail' | 'dealership' | 'individual';
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
  text?: string;
  body?: string;
  created_at: string;
  likes?: number;
  likes_comment?: number;
  user_liked?: boolean;
  profiles?: { profile_pic_url: string | null } | null;
};

type FeedItem =
  | { type: 'post'; post: CommunityPost }
  | { type: 'business'; business: Business }
  | { type: 'organization'; organization: Organization }
  | { type: 'item'; item: MarketplaceItem }
  | { type: 'ad'; banner: AdBanner }
  | { type: 'sliderBusinesses' }
  | { type: 'sliderMarketplace' };

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

const sortByCreatedAtDesc = (a?: string | null, b?: string | null) =>
  new Date(b || 0).getTime() - new Date(a || 0).getTime();

/** Fisher-Yates shuffle for mixed feed order */
function shuffleArray<T>(arr: T[]): T[] {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
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
    <section className="rounded-xl border border-slate-200 bg-white shadow-sm p-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-slate-700">Featured Businesses</h2>
        <Link href="/businesses" className="text-xs text-blue-600 hover:underline">View all</Link>
      </div>
      <div ref={sliderRef} className="keen-slider overflow-hidden rounded-lg">
        {items.map((biz) => (
          <div key={biz.id} className="keen-slider__slide bg-white rounded-lg border border-slate-200">
            <img
              src={biz.image}
              alt={biz.name}
              loading="lazy"
              decoding="async"
              className="w-full h-24 object-cover rounded-t-lg"
            />
            <div className="p-2">
              <p className="text-xs font-semibold text-slate-800 truncate">{biz.name}</p>
              <p className="text-[11px] text-slate-500">{biz.category}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
};

const MarketplaceSliderCard = ({ items }: { items: SliderItem[] }) => {
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
    <section className="rounded-xl border border-slate-200 bg-white shadow-sm p-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-slate-700">Trending Items</h2>
        <Link href="/marketplace" className="text-xs text-blue-600 hover:underline">Browse</Link>
      </div>
      <div ref={sliderRef} className="keen-slider overflow-hidden rounded-lg">
        {items.map((item) => (
          <div key={item.id} className="keen-slider__slide bg-white rounded-lg border border-slate-200">
            <img
              src={item.image}
              alt={item.title}
              loading="lazy"
              decoding="async"
              className="w-full h-24 object-cover rounded-t-lg"
            />
            <div className="p-2">
              <p className="text-xs font-semibold text-slate-800 truncate">{item.title}</p>
              <p className="text-[11px] text-emerald-600 font-semibold">{item.price}</p>
            </div>
          </div>
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
      className="rounded-xl border border-slate-200 dark:border-gray-700 bg-white dark:bg-gray-800 overflow-hidden shadow-sm"
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
      className="hanar-feed-business-card rounded-xl border border-emerald-200 dark:border-gray-700 bg-emerald-50/60 dark:bg-gray-800 p-5 shadow-sm dark:shadow-lg dark:shadow-black/20"
    >
      <div className="flex items-center gap-3">
        <Link href={`/business/${business.slug}`} className="shrink-0">
          <img
            src={business.logo_url || 'https://images.unsplash.com/photo-1557426272-fc91fdb8f385?w=600&auto=format&fit=crop'}
            alt={business.business_name}
            loading="lazy"
            decoding="async"
            className="h-14 w-14 rounded-lg object-cover"
          />
        </Link>
        <div>
          <Link href={`/business/${business.slug}`} className="text-sm font-semibold text-slate-800 dark:text-gray-100 hover:underline">
            {business.business_name}
          </Link>
          <p className="text-xs text-slate-500 dark:text-gray-400">{business.category || 'Business'}</p>
          <p className="mt-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
            {getBusinessMessage(business)}
          </p>
          {business.created_at && (
            <p className="mt-1 text-[11px] text-slate-400 dark:text-gray-500">
              Joined {formatDateLabel(business.created_at)}
            </p>
          )}
        </div>
      </div>
    </article>
  );
}

export default function Home() {
  const [communityPosts, setCommunityPosts] = useState<CommunityPost[]>([]);
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [marketplaceItems, setMarketplaceItems] = useState<MarketplaceItem[]>([]);
  const [userCoords, setUserCoords] = useState<{ lat: number; lon: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [visibleCount, setVisibleCount] = useState(8);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const [currentUser, setCurrentUser] = useState<{ id: string; username: string | null }>({ id: '', username: null });
  const [likedPosts, setLikedPosts] = useState<Set<string>>(new Set());
  const [commentInputs, setCommentInputs] = useState<Record<string, string>>({});
  const [commentsByPost, setCommentsByPost] = useState<Record<string, Comment[]>>({});
  const [deletingPost, setDeletingPost] = useState<string | null>(null);
  const [commentsOpen, setCommentsOpen] = useState<Set<string>>(new Set());
  const [commentLoading, setCommentLoading] = useState<Record<string, boolean>>({});
  const [feedBanners, setFeedBanners] = useState<AdBanner[]>([]);

  useEffect(() => {
    const loadUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setCurrentUser({ id: '', username: null });
        setLikedPosts(new Set());
        return;
      }

      const { data: account } = await supabase
        .from('registeredaccounts')
        .select('username')
        .eq('user_id', user.id)
        .single();

      setCurrentUser({ id: user.id, username: account?.username || null });

      // Fetch user's liked post IDs from community_post_likes
      try {
        const res = await fetch(`/api/community/post/liked?userId=${encodeURIComponent(user.id)}`);
        const data = await res.json();
        if (res.ok && Array.isArray(data.likedPostIds)) {
          setLikedPosts(new Set(data.likedPostIds));
        }
      } catch {
        setLikedPosts(new Set());
      }
    };

    loadUser();
  }, []);

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
      const detail = (event as CustomEvent).detail as { lat?: number; lon?: number } | undefined;
      if (detail?.lat && detail?.lon) {
        setUserCoords({ lat: detail.lat, lon: detail.lon });
        localStorage.setItem('userCoords', JSON.stringify({ lat: detail.lat, lon: detail.lon }));
      }
    };

    window.addEventListener('location:updated', handleLocationUpdate as EventListener);
    return () => window.removeEventListener('location:updated', handleLocationUpdate as EventListener);
  }, []);

  useEffect(() => {
    const loadHomeFeed = async () => {
      setLoading(true);
      const [postsRes, businessRes, orgRes, retailRes, dealershipRes, individualRes] = await Promise.all([
        supabase
          .from('community_posts')
          .select('id, title, body, created_at, author, author_type, username, user_id, image, likes_post, community_comments(count)')
          .eq('deleted', false)
          .order('created_at', { ascending: false })
          .limit(12),
        supabase
          .from('businesses')
          .select('id, business_name, category, address, logo_url, slug, lat, lon, created_at')
          .eq('moderation_status', 'active')
          .eq('is_archived', false)
          .neq('lifecycle_status', 'archived')
          .order('created_at', { ascending: false })
          .limit(50),
        supabase
          .from('organizations')
          .select('id, full_name, username, logo_url, banner_url, mission')
          .or('moderation_status.neq.on_hold,moderation_status.is.null')
          .order('created_at', { ascending: false })
          .limit(8),
        supabase
          .from('retail_items')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(50),
        supabase
          .from('dealerships')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(50),
        supabase
          .from('marketplace_items')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(50),
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

      const rawPosts = postsRes.data || [];
      // Enrich with like counts from community_post_likes
      const postIds = rawPosts.map((p: { id: string }) => p.id);
      if (postIds.length > 0) {
        try {
          const countsRes = await fetch(`/api/community/post/counts?postIds=${postIds.join(',')}`);
          const { counts } = await countsRes.json();
          if (counts) {
            rawPosts.forEach((p: { id: string; likes_post?: number }) => {
              p.likes_post = counts[p.id] ?? p.likes_post ?? 0;
            });
          }
        } catch {
          // keep original likes_post
        }
      }
      setCommunityPosts(rawPosts);
      setBusinesses(businessRes.data || []);
      setOrganizations(orgRes.data || []);
      const combinedItems = [...normalizedRetail, ...normalizedDealership, ...normalizedIndividual].sort((a, b) =>
        sortByCreatedAtDesc(a.created_at, b.created_at)
      );
      const itemBusinessIds = Array.from(
        new Set(combinedItems.map((item) => item.business_id).filter(Boolean) as string[])
      );
      let verifiedMap = new Map<string, boolean>();
      if (itemBusinessIds.length > 0) {
        const { data: businessRows } = await supabase
          .from('businesses')
          .select('id, is_verified')
          .in('id', itemBusinessIds);
        verifiedMap = new Map(
          (businessRows || []).map((row: { id: string; is_verified?: boolean | null }) => [
            row.id,
            Boolean(row.is_verified),
          ])
        );
      }
      const itemsWithVerified = combinedItems.map((item) => ({
        ...item,
        business_verified: item.business_id ? verifiedMap.get(item.business_id) || false : false,
      }));
      setMarketplaceItems(itemsWithVerified);
      setLoading(false);
    };

    const loadBanners = async () => {
      try {
        const res = await fetch('/api/feed-banners');
        const data = await res.json().catch(() => ({}));
        if (res.ok && Array.isArray(data.banners)) {
          setFeedBanners(
            data.banners.map((b: { id: string; image: string; link: string; alt?: string }) => ({
              id: b.id,
              image: b.image,
              link: b.link || '#',
              alt: b.alt || 'Banner',
            }))
          );
        }
      } catch {
        setFeedBanners([]);
      }
    };

    loadHomeFeed();
    loadBanners();
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
        name: biz.business_name,
        category: biz.category || '',
        image: biz.logo_url || '/placeholder.jpg',
      })),
    [nearbyBusinesses]
  );

  const trendingItems = useMemo<SliderItem[]>(
    () =>
      nearbyMarketplaceItems.slice(0, 8).map((item) => ({
        id: item.id,
        title: item.title,
        price: formatPrice(item.price),
        image: getFirstImage(item.imageUrls) || '/placeholder.jpg',
      })),
    [nearbyMarketplaceItems]
  );

  const requireLogin = () => {
    if (!currentUser.id) {
      window.location.href = '/login?redirect=/';
      return false;
    }
    return true;
  };

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

    const method = currentlyLiked ? 'DELETE' : 'POST';
    const url =
      method === 'DELETE'
        ? `/api/community/post/like?post_id=${encodeURIComponent(postId)}&user_id=${encodeURIComponent(currentUser.id)}`
        : '/api/community/post/like';

    const res = await fetch(url, {
      method,
      headers: method === 'POST' ? { 'Content-Type': 'application/json' } : undefined,
      body: method === 'POST' ? JSON.stringify({ post_id: postId, user_id: currentUser.id }) : undefined,
    });

    if (!res.ok && res.status !== 409) {
      // Revert on failure
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
    }
  };

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
        setCommentsByPost((prev) => ({ ...prev, [postId]: data.comments || [] }));
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
        author: currentUser.username,
      }),
    });

    const data = await res.json();
    if (!res.ok) return;

    setCommentsByPost((prev) => ({
      ...prev,
      [postId]: [data.comment, ...(prev[postId] || [])],
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

  // Stable feed order: only reshuffle when the set of items changes (e.g. post deleted), not on like/comment
  const feedOrderRef = useRef<number[] | null>(null);
  const feedPoolLengthRef = useRef<number>(0);

  const feedItems = useMemo<FeedItem[]>(() => {
    const pool: FeedItem[] = [];

    for (const post of communityPosts) {
      pool.push({ type: 'post', post });
    }
    for (const business of nearbyBusinesses.slice(0, 12)) {
      pool.push({ type: 'business', business });
    }
    for (const organization of organizations.slice(0, 8)) {
      pool.push({ type: 'organization', organization });
    }
    for (const item of nearbyMarketplaceItems.slice(0, 12)) {
      pool.push({ type: 'item', item });
    }

    if (featuredBusinesses.length && trendingItems.length) {
      pool.push(Math.random() > 0.5 ? { type: 'sliderBusinesses' } : { type: 'sliderMarketplace' });
    } else if (featuredBusinesses.length) {
      pool.push({ type: 'sliderBusinesses' });
    } else if (trendingItems.length) {
      pool.push({ type: 'sliderMarketplace' });
    }

    if (!pool.length && !loading) {
      for (const business of nearbyBusinesses.slice(0, 6)) {
        pool.push({ type: 'business', business });
      }
      for (const item of nearbyMarketplaceItems.slice(0, 6)) {
        pool.push({ type: 'item', item });
      }
      if (featuredBusinesses.length) pool.push({ type: 'sliderBusinesses' });
      if (trendingItems.length) pool.push({ type: 'sliderMarketplace' });
    }

    const needNewOrder =
      feedOrderRef.current === null ||
      feedPoolLengthRef.current !== pool.length;

    if (needNewOrder && pool.length > 0) {
      const indices = pool.map((_, i) => i);
      feedOrderRef.current = shuffleArray(indices);
      feedPoolLengthRef.current = pool.length;
    }

    if (feedOrderRef.current === null || feedOrderRef.current.length === 0) {
      return pool;
    }
    const ordered = feedOrderRef.current
      .filter((i) => i < pool.length)
      .map((i) => pool[i]);

    if (feedBanners.length === 0) return ordered;

    // Random slots: possibly at top, then every 3rd or 4th item (random)
    const slotIndices: number[] = [];
    if (Math.random() < 0.6) slotIndices.push(0);
    let pos = 3 + Math.floor(Math.random() * 2);
    while (pos < ordered.length) {
      slotIndices.push(pos);
      pos += 3 + Math.floor(Math.random() * 2);
    }

    // Shuffle banners so each appears once before any repeats
    const validBanners = feedBanners.filter((b) => !!b.image);
    const shuffledBanners = shuffleArray([...validBanners.keys()]).map((i) => validBanners[i]);
    let bannerIdx = 0;
    const pickBanner = () => {
      if (shuffledBanners.length === 0) return null;
      const b = shuffledBanners[bannerIdx % shuffledBanners.length];
      bannerIdx++;
      return b;
    };

    const result: FeedItem[] = [];
    for (let i = 0; i < ordered.length; i++) {
      if (slotIndices.includes(i)) {
        const banner = pickBanner();
        if (banner) result.push({ type: 'ad', banner });
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
    trendingItems.length,
  ]);

  useEffect(() => {
    const target = bottomRef.current;
    if (!target) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setVisibleCount((prev) => prev + 6);
        }
      },
      { threshold: 0.1 }
    );
    observer.observe(target);
    return () => observer.disconnect();
  }, [feedItems.length, visibleCount]);

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-gray-900">
      <div className="mx-auto max-w-3xl px-4 py-6 space-y-4">
        <div className="rounded-xl border border-slate-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4 shadow-sm">
          <h1 className="text-lg font-semibold text-slate-800 dark:text-gray-100">Hanar Feed</h1>
          <p className="text-sm text-slate-500 dark:text-gray-400">Latest community updates, nearby businesses, and organizations.</p>
        </div>

        {loading && (
          <div className="space-y-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="rounded-xl border border-slate-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-5 shadow-sm space-y-3">
                <div className="flex items-center gap-3">
                  <div className="skeleton h-9 w-9 rounded-full" />
                  <div className="flex-1 space-y-1.5">
                    <div className="skeleton h-3 w-28 rounded" />
                    <div className="skeleton h-2.5 w-16 rounded" />
                  </div>
                </div>
                <div className="skeleton h-3.5 w-3/4 rounded" />
                <div className="skeleton h-3 w-full rounded" />
                <div className="skeleton h-3 w-5/6 rounded" />
                {i % 2 === 0 && <div className="skeleton h-44 w-full rounded-lg" />}
                <div className="flex gap-6 pt-1">
                  <div className="skeleton h-3 w-12 rounded" />
                  <div className="skeleton h-3 w-16 rounded" />
                  <div className="skeleton h-3 w-10 rounded" />
                </div>
              </div>
            ))}
          </div>
        )}

        {!loading && feedItems.slice(0, visibleCount).map((item, index) => {
          if (item.type === 'post') {
            const dateLabel = new Date(item.post.created_at).toLocaleDateString();
            const liked = likedPosts.has(item.post.id);
            const commentCount = item.post.community_comments?.[0]?.count || 0;
            const isCommentsOpen = commentsOpen.has(item.post.id);
            const comments = commentsByPost[item.post.id] || [];
            return (
              <article key={`post-${item.post.id}-${index}`} className="rounded-xl border border-slate-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-5 shadow-sm min-h-[260px] flex flex-col">
                <div className="flex items-center justify-between text-xs text-slate-500 dark:text-gray-400">
                  <span>{item.post.author || 'Community'}</span>
                  <span>{dateLabel}</span>
                </div>
                <Link href={`/community/post/${item.post.id}`}>
                  <h2 className="mt-2 text-lg font-semibold text-slate-800 dark:text-gray-100">{item.post.title}</h2>
                  <p className="mt-2 text-sm text-slate-600 dark:text-gray-300 line-clamp-3">{item.post.body}</p>
                </Link>
                {item.post.image && (
                  <Link href={`/community/post/${item.post.id}`} className="block">
                    <img
                      src={item.post.image}
                      alt={item.post.title}
                      loading="lazy"
                      decoding="async"
                      className="mt-3 h-56 w-full rounded-lg object-cover"
                    />
                  </Link>
                )}
                <PostActionsBar
                  liked={liked}
                  likesCount={item.post.likes_post || 0}
                  commentCount={commentCount}
                  canLike={!!currentUser.id}
                  onLike={() => handleLikePost(item.post.id)}
                  onComment={() => toggleComments(item.post.id)}
                  onShare={() => handleSharePost(item.post.id)}
                />

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
                          <div key={comment.id} className="rounded-lg bg-slate-50 dark:bg-gray-700/80 px-3 py-2 text-sm flex gap-2">
                            <div className="w-8 h-8 rounded-full overflow-hidden bg-slate-200 dark:bg-gray-600 flex-shrink-0">
                              <img
                                src={
                                  comment.profiles?.profile_pic_url
                                    ? `${comment.profiles.profile_pic_url}?t=${Date.now()}`
                                    : '/default-avatar.png'
                                }
                                alt=""
                                className="w-full h-full object-cover"
                                onError={(e) => {
                                  e.currentTarget.src = '/default-avatar.png';
                                }}
                              />
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="text-xs font-semibold text-slate-700 dark:text-gray-200">
                                {comment.username || comment.author || 'User'}
                              </p>
                              <p className="text-sm text-slate-600 dark:text-gray-300">{comment.body ?? comment.text}</p>
                              <div className="flex items-center gap-2 mt-1">
                                {currentUser.id && (
                                  <button
                                    type="button"
                                    onClick={() => handleCommentLike(item.post.id, comment.id)}
                                    className={`text-xs font-medium transition ${
                                      comment.user_liked ? 'text-rose-600 dark:text-rose-400' : 'text-slate-400 dark:text-gray-500 hover:text-rose-500 dark:hover:text-rose-400'
                                    }`}
                                  >
                                    👍 {comment.user_liked ? 'Liked' : 'Like'}
                                  </button>
                                )}
                                <span className="text-xs text-slate-400 dark:text-gray-500">
                                  {comment.likes ?? comment.likes_comment ?? 0} likes
                                </span>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                    <div className="mt-3 flex items-center gap-2">
                      <input
                        value={commentInputs[item.post.id] || ''}
                        onChange={(e) =>
                          setCommentInputs((prev) => ({ ...prev, [item.post.id]: e.target.value }))
                        }
                        placeholder="Write a comment..."
                        className="flex-1 rounded-full border border-slate-200 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:placeholder-gray-400"
                      />
                      <button
                        onClick={() => submitComment(item.post.id)}
                        disabled={!commentInputs[item.post.id]?.trim()}
                        className="rounded-full bg-blue-600 px-4 py-2 text-xs font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-300"
                      >
                        Post
                      </button>
                    </div>
                  </div>
                )}
              </article>
            );
          }

          if (item.type === 'business') {
            return (
              <FeedBusinessCardWithTrack
                key={`biz-${item.business.id}-${index}`}
                business={item.business}
                formatDateLabel={formatDateLabel}
                getBusinessMessage={getBusinessMessage}
              />
            );
          }

          if (item.type === 'organization') {
            return (
              <article key={`org-${item.organization.id}-${index}`} className="rounded-xl border border-slate-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-5 shadow-sm min-h-[260px] flex flex-col">
                <div className="flex items-center gap-3">
                  <img
                    src={item.organization.logo_url || item.organization.banner_url || 'https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?w=600&auto=format&fit=crop'}
                    alt={item.organization.full_name}
                    loading="lazy"
                    decoding="async"
                    className="h-14 w-14 rounded-lg object-cover"
                  />
                  <div>
                    <Link href={`/organization/${item.organization.username}`} className="text-sm font-semibold text-slate-800 dark:text-gray-100 hover:underline">
                      {item.organization.full_name}
                    </Link>
                    <p className="text-xs text-slate-500 dark:text-gray-400 line-clamp-2">{item.organization.mission || 'Organization update'}</p>
                  </div>
                </div>
              </article>
            );
          }

          if (item.type === 'ad' && item.banner?.image) {
            return <AdCardWithTrack key={`ad-${item.banner.id}-${index}`} banner={item.banner} />;
          }
          if (item.type === 'ad') return null;

          if (item.type === 'item') {
            return (
              <article key={`item-${item.item.id}-${index}`} className="rounded-xl border border-slate-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-5 shadow-sm">
                <Link href={`/marketplace/${item.item.slug || item.item.id}`}>
                  <div className="relative w-full bg-gray-100 dark:bg-gray-700">
                    <img
                      src={getFirstImage(item.item.imageUrls) || '/placeholder.jpg'}
                      alt={item.item.title}
                      loading="lazy"
                      decoding="async"
                      className="w-full h-auto max-h-72 object-contain"
                    />
                    {item.item.business_verified && (
                      <span className="absolute top-2 left-2 inline-flex items-center gap-1 rounded-full bg-emerald-600 px-2 py-1 text-[10px] font-semibold text-white shadow">
                        <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-white text-emerald-600 text-[9px] font-bold">
                          H
                        </span>
                        Verified
                      </span>
                    )}
                  </div>
                  <div className="mt-3 space-y-1">
                    <h3 className="text-base font-semibold text-slate-800 dark:text-gray-100 line-clamp-2">{item.item.title}</h3>
                    <p className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">{formatPrice(item.item.price)}</p>
                    {item.item.description && (
                      <p className="text-xs text-slate-600 dark:text-gray-400 line-clamp-2">{item.item.description}</p>
                    )}
                    <p className="text-xs text-slate-500 dark:text-gray-500">{item.item.location || ''}</p>
                  </div>
                </Link>
              </article>
            );
          }

          if (item.type === 'sliderBusinesses') {
            return <BusinessSliderCard key={`slider-biz-${index}`} items={featuredBusinesses} />;
          }

          return <MarketplaceSliderCard key={`slider-market-${index}`} items={trendingItems} />;
        })}

        {!loading && !feedItems.length && (
          <div className="rounded-xl border border-slate-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-6 text-sm text-slate-500 dark:text-gray-400">
            No posts yet. Check back soon.
          </div>
        )}

        {!loading && feedItems.length > visibleCount && (
          <div ref={bottomRef} className="rounded-xl border border-slate-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4 text-xs text-slate-500 dark:text-gray-400 text-center">
            Loading more...
          </div>
        )}
      </div>
      <Footer />
    </div>
  );
}