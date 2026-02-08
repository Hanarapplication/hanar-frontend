'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useKeenSlider } from 'keen-slider/react';
import Footer from '@/components/Footer';
import { supabase } from '@/lib/supabaseClient';
import PostActionsBar from '@/components/PostActionsBar';

type SliderBusiness = { id: string; name: string; category: string; image: string };
type SliderItem = { id: string; title: string; price: string; image: string };
type AdBanner = { id: string; image: string; link: string; alt: string };

const adBanners: AdBanner[] = [];

type CommunityPost = {
  id: string;
  title: string;
  body: string;
  created_at: string;
  author: string;
  author_type: string | null;
  username: string | null;
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
  source?: 'retail' | 'dealership';
  business_id?: string | null;
  business_verified?: boolean;
};

type Comment = {
  id: string;
  post_id: string;
  user_id: string;
  username: string | null;
  author: string | null;
  text: string;
  created_at: string;
  likes_comment: number;
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

const AdCard = ({ banner }: { banner: AdBanner }) => (
  <section className="rounded-xl border border-dashed border-amber-200 bg-amber-50/60 p-4 text-center">
    <Link href={banner.link} target="_blank" rel="noopener noreferrer">
      <img
        src={banner.image}
        alt={banner.alt}
        loading="lazy"
        decoding="async"
        className="w-full h-40 object-cover rounded-lg"
      />
    </Link>
    <p className="mt-2 text-xs text-amber-700">Advertise here • Reach the Hanar community</p>
  </section>
);

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
  const [commentsOpen, setCommentsOpen] = useState<Set<string>>(new Set());
  const [commentLoading, setCommentLoading] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const loadUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setCurrentUser({ id: '', username: null });
        return;
      }

      const { data: account } = await supabase
        .from('registeredaccounts')
        .select('username')
        .eq('user_id', user.id)
        .single();

      setCurrentUser({ id: user.id, username: account?.username || null });
    };

    const stored = localStorage.getItem('homeFeedLikedPosts');
    if (stored) {
      try {
        const parsed = JSON.parse(stored) as string[];
        setLikedPosts(new Set(parsed));
      } catch {
        setLikedPosts(new Set());
      }
    }

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
      const [postsRes, businessRes, orgRes, retailRes, dealershipRes] = await Promise.all([
        supabase
          .from('community_posts')
          .select('id, title, body, created_at, author, author_type, username, image, likes_post, community_comments(count)')
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

      setCommunityPosts(postsRes.data || []);
      setBusinesses(businessRes.data || []);
      setOrganizations(orgRes.data || []);
      const combinedItems = [...normalizedRetail, ...normalizedDealership].sort((a, b) =>
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

    loadHomeFeed();
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
    if (likedPosts.has(postId)) return;

    const res = await fetch('/api/community/post/like', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ post_id: postId, user_id: currentUser.id }),
    });

    if (res.ok || res.status === 409) {
      setCommunityPosts((prev) =>
        prev.map((post) =>
          post.id === postId
            ? { ...post, likes_post: (post.likes_post || 0) + (res.ok ? 1 : 0) }
            : post
        )
      );
      setLikedPosts((prev) => {
        const next = new Set(prev);
        next.add(postId);
        localStorage.setItem('homeFeedLikedPosts', JSON.stringify(Array.from(next)));
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
        const res = await fetch(`/api/community/comments?postId=${postId}`);
        const data = await res.json();
        setCommentsByPost((prev) => ({ ...prev, [postId]: data.comments || [] }));
      } finally {
        setCommentLoading((prev) => ({ ...prev, [postId]: false }));
      }
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

  const feedItems = useMemo<FeedItem[]>(() => {
    const items: FeedItem[] = [];
    const businessQueue = [...nearbyBusinesses];
    const organizationQueue = [...organizations];
    const itemQueue = [...nearbyMarketplaceItems];
    let adIndex = 0;
    let count = 0;
    let insertAfter = 3 + Math.floor(Math.random() * 2);

    for (const post of communityPosts) {
      items.push({ type: 'post', post });
      count += 1;

      if (count >= insertAfter) {
        if (featuredBusinesses.length && trendingItems.length) {
          const sliderType = Math.random() > 0.5 ? 'sliderBusinesses' : 'sliderMarketplace';
          items.push({ type: sliderType });
        } else if (featuredBusinesses.length) {
          items.push({ type: 'sliderBusinesses' });
        } else if (trendingItems.length) {
          items.push({ type: 'sliderMarketplace' });
        }

        if (adBanners.length) {
          items.push({ type: 'ad', banner: adBanners[adIndex % adBanners.length] });
          adIndex += 1;
        }

        if (businessQueue.length) {
          items.push({ type: 'business', business: businessQueue.shift()! });
        }

        if (organizationQueue.length) {
          items.push({ type: 'organization', organization: organizationQueue.shift()! });
        }

        if (itemQueue.length) {
          items.push({ type: 'item', item: itemQueue.shift()! });
        }

        count = 0;
        insertAfter = 3 + Math.floor(Math.random() * 2);
      }
    }

    if (businessQueue.length) {
      const remaining = businessQueue.slice(0, 6);
      items.push(...remaining.map((business) => ({ type: 'business' as const, business })));
    }

    if (itemQueue.length) {
      const remainingItems = itemQueue.slice(0, 6);
      items.push(...remainingItems.map((item) => ({ type: 'item' as const, item })));
    }

    if (!items.length && !loading) {
      if (adBanners[0]) items.push({ type: 'ad', banner: adBanners[0] });
      if (businessQueue.length) {
        items.push(
          ...businessQueue.slice(0, 6).map((business) => ({ type: 'business' as const, business }))
        );
      }
      if (itemQueue.length) {
        items.push(
          ...itemQueue.slice(0, 6).map((item) => ({ type: 'item' as const, item }))
        );
      }
      if (featuredBusinesses.length) items.push({ type: 'sliderBusinesses' });
      if (trendingItems.length) items.push({ type: 'sliderMarketplace' });
    }

    return items;
  }, [
    communityPosts,
    featuredBusinesses.length,
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
    <div className="min-h-screen bg-slate-100">
      <div className="mx-auto max-w-3xl px-4 py-6 space-y-4">
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <h1 className="text-lg font-semibold text-slate-800">Hanar Feed</h1>
          <p className="text-sm text-slate-500">Latest community updates, nearby businesses, and organizations.</p>
        </div>

        {loading && (
          <div className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-500">
            Loading your feed...
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
              <article key={`post-${item.post.id}-${index}`} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm min-h-[260px] flex flex-col">
                <div className="flex items-center justify-between text-xs text-slate-500">
                  <span>{item.post.author || 'Community'}</span>
                  <span>{dateLabel}</span>
                </div>
                <Link href={`/community/post/${item.post.id}`}>
                  <h2 className="mt-2 text-lg font-semibold text-slate-800">{item.post.title}</h2>
                  <p className="mt-2 text-sm text-slate-600 line-clamp-3">{item.post.body}</p>
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

                {isCommentsOpen && (
                  <div className="mt-4 border-t border-slate-100 pt-4">
                    {commentLoading[item.post.id] ? (
                      <p className="text-xs text-slate-500">Loading comments...</p>
                    ) : (
                      <div className="space-y-3">
                        {comments.length === 0 && (
                          <p className="text-xs text-slate-500">Be the first to comment.</p>
                        )}
                        {comments.map((comment) => (
                          <div key={comment.id} className="rounded-lg bg-slate-50 px-3 py-2 text-sm">
                            <p className="text-xs font-semibold text-slate-700">
                              {comment.username || comment.author || 'User'}
                            </p>
                            <p className="text-sm text-slate-600">{comment.text}</p>
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
                        className="flex-1 rounded-full border border-slate-200 px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
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
              <article key={`biz-${item.business.id}-${index}`} className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-5 shadow-sm">
                <div className="flex items-center gap-3">
                  <Link href={`/business/${item.business.slug}`} className="shrink-0">
                    <img
                      src={item.business.logo_url || 'https://images.unsplash.com/photo-1557426272-fc91fdb8f385?w=600&auto=format&fit=crop'}
                      alt={item.business.business_name}
                      loading="lazy"
                      decoding="async"
                      className="h-14 w-14 rounded-lg object-cover"
                    />
                  </Link>
                  <div>
                    <Link href={`/business/${item.business.slug}`} className="text-sm font-semibold text-slate-800 hover:underline">
                      {item.business.business_name}
                    </Link>
                    <p className="text-xs text-slate-500">{item.business.category || 'Business'}</p>
                    <p className="mt-1 text-xs font-semibold text-emerald-600">
                      {getBusinessMessage(item.business)}
                    </p>
                    {item.business.created_at && (
                      <p className="mt-1 text-[11px] text-slate-400">
                        Joined {formatDateLabel(item.business.created_at)}
                      </p>
                    )}
                  </div>
                </div>
              </article>
            );
          }

          if (item.type === 'organization') {
            return (
              <article key={`org-${item.organization.id}-${index}`} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm min-h-[260px] flex flex-col">
                <div className="flex items-center gap-3">
                  <img
                    src={item.organization.logo_url || item.organization.banner_url || 'https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?w=600&auto=format&fit=crop'}
                    alt={item.organization.full_name}
                    loading="lazy"
                    decoding="async"
                    className="h-14 w-14 rounded-lg object-cover"
                  />
                  <div>
                    <Link href={`/organization/${item.organization.username}`} className="text-sm font-semibold text-slate-800 hover:underline">
                      {item.organization.full_name}
                    </Link>
                    <p className="text-xs text-slate-500 line-clamp-2">{item.organization.mission || 'Organization update'}</p>
                  </div>
                </div>
              </article>
            );
          }

          if (item.type === 'ad') {
            return <AdCard key={`ad-${item.banner.id}-${index}`} banner={item.banner} />;
          }

          if (item.type === 'item') {
            return (
              <article key={`item-${item.item.id}-${index}`} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                <Link href={`/marketplace/${item.item.slug || item.item.id}`}>
                  <div className="relative w-full bg-gray-100">
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
                    <h3 className="text-base font-semibold text-slate-800 line-clamp-2">{item.item.title}</h3>
                    <p className="text-sm font-semibold text-emerald-600">{formatPrice(item.item.price)}</p>
                    {item.item.description && (
                      <p className="text-xs text-slate-600 line-clamp-2">{item.item.description}</p>
                    )}
                    <p className="text-xs text-slate-500">{item.item.location || ''}</p>
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
          <div className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-500">
            No posts yet. Check back soon.
          </div>
        )}

        {!loading && feedItems.length > visibleCount && (
          <div ref={bottomRef} className="rounded-xl border border-slate-200 bg-white p-4 text-xs text-slate-500 text-center">
            Loading more...
          </div>
        )}
      </div>
      <Footer />
    </div>
  );
}