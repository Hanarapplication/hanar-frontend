'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useKeenSlider } from 'keen-slider/react';
import Footer from '@/components/Footer';
import { supabase } from '@/lib/supabaseClient';
import PostActionsBar from '@/components/PostActionsBar';

const featuredBusinesses = [
  { id: 1, name: 'Taste of Beirut', category: 'Restaurant', image: 'https://picsum.photos/id/10/367/267' },
  { id: 2, name: 'Halal Market', category: 'Grocery Store', image: 'https://picsum.photos/id/9/367/267' },
  { id: 3, name: 'Sahara Salon', category: 'Beauty', image: 'https://picsum.photos/id/12/367/267' },
  { id: 4, name: 'Persian Grill', category: 'Food Truck', image: 'https://picsum.photos/id/14/367/267' },
];

const trendingItems = [
  { id: 1, title: 'Persian Rug', price: '$450', image: 'https://www.catalinarug.com/wp-content/uploads/2022/12/381637-600x853.jpg' },
  { id: 2, title: 'Afghan Jewelry', price: '$120', image: 'https://picsum.photos/id/28/367/267' },
  { id: 3, title: 'Spices Box', price: '$25', image: 'https://picsum.photos/id/29/367/267' },
  { id: 4, title: 'Turkish Tea Set', price: '$40', image: 'https://picsum.photos/id/26/367/267' },
];

const adBanners = [
  {
    id: 1,
    image: 'https://img.freepik.com/free-photo/sassy-goodlooking-redhead-female-yellow-sweater-listen-music-white-headphones-touch-earphones_1258-126219.jpg?t=st=1745033707~exp=1745037307~hmac=d35b64bbfefc1d81e3b4b725052bc1c7a33ffe1c957ad272a62cf34ce3793cbf&w=1060',
    link: 'https://www.hanar.net',
    alt: 'Advertise with us',
  },
  {
    id: 2,
    image: 'https://img.freepik.com/premium-photo/asian-woman-pointing-side_28629-1771.jpg',
    link: 'https://www.hanar.net',
    alt: 'Your Banner Here!',
  },
];

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
};

type Organization = {
  id: string;
  full_name: string;
  username: string;
  logo_url: string | null;
  banner_url: string | null;
  mission: string | null;
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
  | { type: 'ad'; banner: typeof adBanners[number] }
  | { type: 'sliderBusinesses' }
  | { type: 'sliderMarketplace' };

const BusinessSliderCard = () => {
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
        {featuredBusinesses.map((biz) => (
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

const MarketplaceSliderCard = () => {
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
        {trendingItems.map((item) => (
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

const AdCard = ({ banner }: { banner: typeof adBanners[number] }) => (
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
  const [loading, setLoading] = useState(true);
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
    const loadHomeFeed = async () => {
      setLoading(true);
      const [postsRes, businessRes, orgRes] = await Promise.all([
        supabase
          .from('community_posts')
          .select('id, title, body, created_at, author, author_type, username, image, likes_post, community_comments(count)')
          .eq('deleted', false)
          .order('created_at', { ascending: false })
          .limit(12),
        supabase
          .from('businesses')
          .select('id, business_name, category, address, logo_url, slug')
          .eq('business_status', 'approved')
          .order('created_at', { ascending: false })
          .limit(8),
        supabase
          .from('organizations')
          .select('id, full_name, username, logo_url, banner_url, mission')
          .order('created_at', { ascending: false })
          .limit(8),
      ]);

      setCommunityPosts(postsRes.data || []);
      setBusinesses(businessRes.data || []);
      setOrganizations(orgRes.data || []);
      setLoading(false);
    };

    loadHomeFeed();
  }, []);

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
    const businessQueue = [...businesses];
    const organizationQueue = [...organizations];
    let adIndex = 0;
    let count = 0;
    let insertAfter = 3 + Math.floor(Math.random() * 2);

    for (const post of communityPosts) {
      items.push({ type: 'post', post });
      count += 1;

      if (count >= insertAfter) {
        const sliderType = Math.random() > 0.5 ? 'sliderBusinesses' : 'sliderMarketplace';
        items.push({ type: sliderType });

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

        count = 0;
        insertAfter = 3 + Math.floor(Math.random() * 2);
      }
    }

    if (!items.length && !loading) {
      if (adBanners[0]) items.push({ type: 'ad', banner: adBanners[0] });
      items.push({ type: 'sliderBusinesses' });
      items.push({ type: 'sliderMarketplace' });
    }

    return items;
  }, [communityPosts, businesses, organizations, loading]);

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

        {!loading && feedItems.map((item, index) => {
          if (item.type === 'post') {
            const dateLabel = new Date(item.post.created_at).toLocaleDateString();
            const liked = likedPosts.has(item.post.id);
            const commentCount = item.post.community_comments?.[0]?.count || 0;
            const isCommentsOpen = commentsOpen.has(item.post.id);
            const comments = commentsByPost[item.post.id] || [];
            return (
              <article key={`post-${item.post.id}-${index}`} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
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
              <article key={`biz-${item.business.id}-${index}`} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex items-center gap-3">
                  <img
                    src={item.business.logo_url || 'https://images.unsplash.com/photo-1557426272-fc91fdb8f385?w=600&auto=format&fit=crop'}
                    alt={item.business.business_name}
                    loading="lazy"
                    decoding="async"
                    className="h-14 w-14 rounded-lg object-cover"
                  />
                  <div>
                    <Link href={`/business/${item.business.slug}`} className="text-sm font-semibold text-slate-800 hover:underline">
                      {item.business.business_name}
                    </Link>
                    <p className="text-xs text-slate-500">{item.business.category || 'Business'}</p>
                  </div>
                </div>
              </article>
            );
          }

          if (item.type === 'organization') {
            return (
              <article key={`org-${item.organization.id}-${index}`} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
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

          if (item.type === 'sliderBusinesses') {
            return <BusinessSliderCard key={`slider-biz-${index}`} />;
          }

          return <MarketplaceSliderCard key={`slider-market-${index}`} />;
        })}

        {!loading && !feedItems.length && (
          <div className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-500">
            No posts yet. Check back soon.
          </div>
        )}
      </div>
      <Footer />
    </div>
  );
}