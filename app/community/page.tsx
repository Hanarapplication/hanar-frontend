'use client';

import { useState, useEffect, useRef, useCallback, Fragment } from 'react';
import { HeartIcon, ChatBubbleLeftIcon, MagnifyingGlassIcon, XMarkIcon, PlusIcon } from '@heroicons/react/24/solid';
import { Trash2, Megaphone, SendHorizontal } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { enUS } from 'date-fns/locale';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { useLanguage } from '@/context/LanguageContext';
import { supabase } from '@/lib/supabaseClient';
import { supportedLanguages } from '@/utils/languages';
import PostActionsBar from '@/components/PostActionsBar';
import FeedVideoPlayer from '@/components/FeedVideoPlayer';
import PullToRefresh from '@/components/PullToRefresh';
import { Avatar } from '@/components/Avatar';
import { t } from '@/utils/translations';

const COMMUNITY_SEARCH_FRAME =
  'border border-blue-900/80 dark:border-blue-700/80 focus:ring-2 focus:ring-blue-800/35 dark:focus:ring-blue-500/35 focus:border-blue-800';

/** Dark blue gradient rule between community post rows */
const COMMUNITY_FEED_BETWEEN_ROW =
  'h-px w-full shrink-0 bg-gradient-to-r from-blue-950 via-blue-800 to-blue-950 dark:from-slate-950 dark:via-blue-800 dark:to-slate-950';

const COMMUNITY_CACHE_PREFIX = 'hanar_community_cache_';
const COMMUNITY_FEED_LANG_KEY = 'hanar_community_feed_lang';
const COMMUNITY_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

const communityCacheKey = (userKey: string, lang: string, sortMode: 'latest' | 'popular') =>
  `${COMMUNITY_CACHE_PREFIX}${userKey}::${lang || 'all'}::${sortMode}`;

type CommunityCache = {
  ts: number;
  posts: Post[];
  banner: { id: string; image: string; link: string; alt: string } | null;
};

function readCommunityCache(storageKey: string): CommunityCache | null {
  try {
    const raw = sessionStorage.getItem(storageKey);
    if (!raw) return null;
    const cache: CommunityCache = JSON.parse(raw);
    if (Date.now() - cache.ts > COMMUNITY_CACHE_TTL) return null;
    return cache;
  } catch {
    return null;
  }
}

function writeCommunityCache(
  storageKey: string,
  posts: Post[],
  banner: { id: string; image: string; link: string; alt: string } | null
) {
  try {
    sessionStorage.setItem(storageKey, JSON.stringify({ ts: Date.now(), posts, banner }));
  } catch {}
}

interface Post {
  id: string;
  title: string;
  body: string;
  author: string;
  author_type?: string | null;
  username?: string | null;
  user_id?: string | null;
  created_at: string;
  image?: string;
  video?: string | null;
  likes_post?: number;
  community_comments?: { count: number }[];
  profile_pic_url?: string | null;
  logo_url?: string | null;
}

type AudienceFeedCache = {
  preferred_language: string | null;
  spoken_languages: string[];
  segmentResponse: Record<string, unknown> | null;
};

const SEARCH_DEBOUNCE_MS = 380;

export default function CommunityFeedPage() {
  const [search, setSearch] = useState('');
  /** Passed to API / pagination so we do not refetch on every keystroke */
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [visiblePosts, setVisiblePosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [sortMode, setSortMode] = useState<'latest' | 'popular'>('latest');
  const [feedLang, setFeedLangState] = useState<string>('');
  const [feedLangReady, setFeedLangReady] = useState(false);
  const requestSeqRef = useRef(0);
  const normalizeFeedLang = useCallback((value: string) => {
    const v = String(value || '').trim().toLowerCase();
    if (!v || v === 'all' || v === 'auto') return '';
    return supportedLanguages.some((l) => l.code === v) ? v : '';
  }, []);
  const setFeedLang = useCallback((value: string) => {
    const next = normalizeFeedLang(value);
    setFeedLangState(next);
    try {
      localStorage.setItem(COMMUNITY_FEED_LANG_KEY, next);
    } catch {}
  }, [normalizeFeedLang]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const stored = localStorage.getItem(COMMUNITY_FEED_LANG_KEY);
      if (stored !== null) setFeedLangState(normalizeFeedLang(stored));
    } catch {}
    setFeedLangReady(true);
  }, [normalizeFeedLang]);

  const bottomRef = useRef<HTMLDivElement | null>(null);
  const { effectiveLang } = useLanguage();
  const [isBusinessUser, setIsBusinessUser] = useState(false);
  const [currentUser, setCurrentUser] = useState<{ id: string; username: string | null; displayName: string | null }>({ id: '', username: null, displayName: null });
  const [likedPosts, setLikedPosts] = useState<Set<string>>(new Set());
  const [commentInputs, setCommentInputs] = useState<Record<string, string>>({});
  const [commentsByPost, setCommentsByPost] = useState<Record<string, any[]>>({});
  const [commentsOpen, setCommentsOpen] = useState<Set<string>>(new Set());
  const [commentLoading, setCommentLoading] = useState<Record<string, boolean>>({});
  const [deletingPost, setDeletingPost] = useState<string | null>(null);
  const [communityBanner, setCommunityBanner] = useState<{ id: string; image: string; link: string; alt: string } | null>(null);
  const hasFetchedRef = useRef(false);
  /** Avoids a second effect that immediately clears posts and refetches on the same mount (double network work). */
  const skipReloadDuplicateMountRef = useRef(true);

  useEffect(() => {
    const id = window.setTimeout(() => setDebouncedSearch(search.trim()), SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(id);
  }, [search]);

  const audienceCacheRef = useRef<AudienceFeedCache | null>(null);
  const audienceFetchRef = useRef<Promise<AudienceFeedCache> | null>(null);

  const getAudienceForFeed = useCallback(async () => {
    if (audienceCacheRef.current) return audienceCacheRef.current;
    if (!audienceFetchRef.current) {
      audienceFetchRef.current = (async (): Promise<AudienceFeedCache> => {
        try {
          const res = await fetch('/api/user/audience-segment');
          const j = await res.json().catch(() => ({}));
          const v: AudienceFeedCache = {
            preferred_language: j.preferred_language ?? null,
            spoken_languages: Array.isArray(j.spoken_languages) ? j.spoken_languages : [],
            segmentResponse: j && typeof j === 'object' ? (j as Record<string, unknown>) : null,
          };
          audienceCacheRef.current = v;
          return v;
        } catch {
          const v: AudienceFeedCache = {
            preferred_language: null,
            spoken_languages: [],
            segmentResponse: null,
          };
          audienceCacheRef.current = v;
          return v;
        } finally {
          audienceFetchRef.current = null;
        }
      })();
    }
    return audienceFetchRef.current!;
  }, []);

  const loadBanner = useCallback(async () => {
    try {
      let lat: number | null = null;
      let lon: number | null = null;
      if (typeof localStorage !== 'undefined') {
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
      const aud = await getAudienceForFeed();
      const seg = aud.segmentResponse ?? {};
      const ageGroup = seg.age_group as string | undefined;
      const gender = seg.gender as string | undefined;
      const prefLang = seg.preferred_language as string | undefined;
      const spoken = seg.spoken_languages as unknown;
      const state = seg.state as string | undefined;
      const params = new URLSearchParams();
      if (ageGroup) params.set('age_group', ageGroup);
      if (gender) params.set('gender', gender);
      if (prefLang) params.append('lang', prefLang);
      if (Array.isArray(spoken)) (spoken as string[]).forEach((l: string) => params.append('lang', l));
      if (state) params.set('state', state);
      if (lat != null && lon != null) {
        params.set('lat', String(lat));
        params.set('lon', String(lon));
      }
      const qs = params.toString();
      const r = await fetch(qs ? `/api/feed-banners?${qs}` : '/api/feed-banners');
      const d = await r.json();
      const list = d.banners || [];
      if (list.length > 0) {
        const pick = list[Math.floor(Math.random() * list.length)];
        if (pick?.image) {
          setCommunityBanner(pick);
          return pick;
        }
      }
    } catch {}
    return null;
  }, [getAudienceForFeed]);

  const sortPosts = (posts: Post[]): Post[] => {
    if (sortMode === 'popular') {
      return [...posts].sort((a, b) => (b.likes_post || 0) - (a.likes_post || 0));
    }
    return posts;
  };

  const loadMorePosts = async (offset = 0) => {
    if (loading || (!hasMore && offset > 0)) return;
    const requestId = ++requestSeqRef.current;
    setLoading(true);
    try {
      const audience = await getAudienceForFeed();
      const deviceLang =
        typeof navigator !== 'undefined' ? (navigator.language?.split('-')[0] || '').toLowerCase() : '';

      const response = await fetch('/api/community/list', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          search: debouncedSearch,
          offset,
          lang: feedLang,
          sortMode,
          userId: currentUser.id || undefined,
          primaryLang: audience.preferred_language,
          spokenLanguages: audience.spoken_languages,
          deviceLang: deviceLang || undefined,
        }),
      });
      const newPosts: Post[] = await response.json();
      if (requestId !== requestSeqRef.current) return;
      const ordered = sortMode === 'popular' ? sortPosts(newPosts) : newPosts;
      if (offset === 0) {
        setVisiblePosts(ordered);
      } else {
        setVisiblePosts((prev) => {
          const unique = [...new Map([...prev, ...ordered].map((p) => [p.id, p])).values()];
          return unique;
        });
      }
      setHasMore(newPosts.length === 10);

      const cacheKey = communityCacheKey(currentUser.id || 'anon', feedLang, sortMode);
      if (offset === 0 && !debouncedSearch) {
        writeCommunityCache(cacheKey, ordered, communityBanner);
      }
    } catch (err) {
      console.error('Error loading posts:', err);
    } finally {
      setLoading(false);
    }
  };

  // Initial load: wait for feed lang to be restored from localStorage, then use cache or fetch
  useEffect(() => {
    if (!feedLangReady || hasFetchedRef.current) return;
    hasFetchedRef.current = true;

    const cacheKey = communityCacheKey(currentUser.id || 'anon', feedLang, sortMode);
    const cache = readCommunityCache(cacheKey);
    if (cache && !debouncedSearch) {
      setVisiblePosts(cache.posts);
      if (cache.banner) setCommunityBanner(cache.banner);
      setHasMore(cache.posts.length >= 10);
      setLoading(false);
    } else {
      loadBanner();
      loadMorePosts(0);
    }
  }, [feedLangReady, feedLang, sortMode, currentUser.id, debouncedSearch]);

  // Reload when debounced search / sort / lang / user changes (not on the same tick as the initial load effect)
  useEffect(() => {
    if (!feedLangReady || !hasFetchedRef.current) return;
    if (skipReloadDuplicateMountRef.current) {
      skipReloadDuplicateMountRef.current = false;
      return;
    }
    requestSeqRef.current += 1;
    setVisiblePosts([]);
    setHasMore(true);
    loadMorePosts(0);
  }, [debouncedSearch, feedLang, sortMode, currentUser.id, feedLangReady]);

  useEffect(() => {
    const observer = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting && !loading && hasMore) {
        loadMorePosts(visiblePosts.length);
      }
    });
    if (bottomRef.current) observer.observe(bottomRef.current);
    return () => {
      if (bottomRef.current) observer.unobserve(bottomRef.current);
    };
  }, [loading, hasMore, visiblePosts.length]);

  useEffect(() => {
    const checkBusinessAccount = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setIsBusinessUser(false);
        return;
      }

      const { data } = await supabase
        .from('businesses')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle();

      setIsBusinessUser(!!data);
    };

    checkBusinessAccount();
  }, []);

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
        setCurrentUser({ id: '', username: null, displayName: null });
        setLikedPosts(new Set());
        return;
      }

      const { data: account } = await supabase
        .from('registeredaccounts')
        .select('username, full_name')
        .eq('user_id', user.id)
        .single();

      setCurrentUser({
        id: user.id,
        username: account?.username || null,
        displayName: account?.full_name?.trim() || null,
      });
      await fetchLikedPosts(user.id);
    };

    loadUser();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user?.id) {
        setCurrentUser((prev) => ({ ...prev, id: session.user.id }));
        fetchLikedPosts(session.user.id);
      } else {
        setCurrentUser({ id: '', username: null, displayName: null });
        setLikedPosts(new Set());
      }
    });
    return () => subscription.unsubscribe();
  }, [fetchLikedPosts]);

  useEffect(() => {
    audienceCacheRef.current = null;
    audienceFetchRef.current = null;
  }, [currentUser.id]);

  const requireLogin = () => {
    if (!currentUser.id) {
      window.location.href = '/login?redirect=/community';
      return false;
    }
    return true;
  };

  const handleLikePost = async (postId: string) => {
    if (!requireLogin()) return;

    const currentlyLiked = likedPosts.has(postId);
    const delta = currentlyLiked ? -1 : 1;

    // Optimistic update: show new count and liked state immediately
    setVisiblePosts((prev) =>
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
      setVisiblePosts((prev) =>
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
        setVisiblePosts((prev) =>
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

    setCommentsByPost((prev) => ({
      ...prev,
      [postId]: [data.comment, ...(prev[postId] || [])],
    }));
    setCommentInputs((prev) => ({ ...prev, [postId]: '' }));
    setVisiblePosts((prev) =>
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
      setVisiblePosts((prev) => prev.filter((p) => p.id !== postId));
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

  const handlePullRefresh = useCallback(async () => {
    audienceCacheRef.current = null;
    audienceFetchRef.current = null;
    try {
      sessionStorage.removeItem(communityCacheKey(currentUser.id || 'anon', feedLang, sortMode));
    } catch {}
    setVisiblePosts([]);
    setHasMore(true);
    const banner = await loadBanner();
    setLoading(true);
    try {
      const audience = await getAudienceForFeed();
      const deviceLang =
        typeof navigator !== 'undefined' ? (navigator.language?.split('-')[0] || '').toLowerCase() : '';
      const response = await fetch('/api/community/list', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          search,
          offset: 0,
          lang: feedLang,
          sortMode,
          userId: currentUser.id || undefined,
          primaryLang: audience.preferred_language,
          spokenLanguages: audience.spoken_languages,
          deviceLang: deviceLang || undefined,
        }),
      });
      const newPosts: Post[] = await response.json();
      const ordered = sortMode === 'popular' ? sortPosts(newPosts) : newPosts;
      setVisiblePosts(ordered);
      setHasMore(newPosts.length === 10);
      writeCommunityCache(
        communityCacheKey(currentUser.id || 'anon', feedLang, sortMode),
        ordered,
        banner || communityBanner
      );
    } catch (err) {
      console.error('Error refreshing posts:', err);
    } finally {
      setLoading(false);
    }
  }, [search, feedLang, sortMode, currentUser.id, communityBanner, getAudienceForFeed, loadBanner]);

  const feedLangOptions: { value: string; label: string; emoji?: string }[] = [
    { value: '', label: t(effectiveLang, 'All languages'), emoji: '🌐' },
    ...supportedLanguages.filter((l) => l.code !== 'auto').map((l) => ({ value: l.code, label: t(effectiveLang, l.name), emoji: l.emoji })),
  ];

  return (
    <PullToRefresh onRefresh={handlePullRefresh}>
    <div className="min-h-screen bg-slate-100 dark:bg-gray-900">
      <div className="w-full pb-6 pt-0">
      <div className="flex flex-wrap items-center gap-2 mb-6 px-4">
        <button
          onClick={() => setSortMode('latest')}
          className={`shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
            sortMode === 'latest' ? 'bg-gradient-to-r from-blue-950 via-blue-800 to-blue-950 text-white shadow-sm' : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
          }`}
        >
          {t(effectiveLang, 'For you')}
        </button>
        <button
          onClick={() => setSortMode('popular')}
          className={`shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
            sortMode === 'popular' ? 'bg-gradient-to-r from-blue-950 via-blue-800 to-blue-950 text-white shadow-sm' : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
          }`}
        >
          {t(effectiveLang, 'Most Popular')}
        </button>
        <select
          value={feedLang}
          onChange={(e) => setFeedLang(e.target.value)}
          className="shrink-0 h-8 min-w-[7rem] rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 text-xs font-medium pl-2 pr-6 py-1 focus:outline-none focus:ring-2 focus:ring-rose-500 focus:border-transparent appearance-none cursor-pointer bg-[length:12px] bg-[right_0.35rem_center] bg-no-repeat"
          style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%236b7280'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'/%3E%3C/svg%3E")` }}
          title={feedLang ? t(effectiveLang, 'Posts in this language first') : t(effectiveLang, 'All languages')}
        >
          {feedLangOptions.map((opt) => (
            <option key={opt.value || 'all'} value={opt.value}>
              {opt.emoji ? `${opt.emoji} ${opt.label}` : opt.label}
            </option>
          ))}
        </select>
      </div>

      <div className="flex items-center mb-6 gap-4 px-4">
        <div className="relative flex-1">
          <input
            type="text"
            placeholder={t(effectiveLang, 'Search posts...')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className={`w-full pl-10 pr-4 py-2 rounded-lg bg-white dark:bg-gray-800 dark:text-gray-100 focus:outline-none ${COMMUNITY_SEARCH_FRAME}`}
          />
          <MagnifyingGlassIcon className="absolute left-3 top-2.5 h-5 w-5 text-gray-400 dark:text-gray-500" />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-3 top-2.5">
              <XMarkIcon className="h-5 w-5 text-gray-400 dark:text-gray-500" />
            </button>
          )}
        </div>
        {!isBusinessUser && (
          <Link
            href="/community/post"
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-950 via-blue-800 to-blue-950 text-white font-bold rounded-lg hover:from-blue-900 hover:via-blue-700 hover:to-blue-900 transition-all"
          >
            <PlusIcon className="h-5 w-5" />
            <span>{t(effectiveLang, 'New Post')}</span>
          </Link>
        )}
      </div>

      {communityBanner?.image && (
        <div className="mb-6 overflow-hidden rounded-none bg-white shadow-sm dark:bg-gray-800">
          <Link href={communityBanner.link || '#'} target="_blank" rel="noopener noreferrer" className="block w-full">
            <div className="relative w-full aspect-[1200/630] bg-slate-100 dark:bg-gray-700">
              <img
                src={communityBanner.image}
                alt={communityBanner.alt || 'Banner'}
                loading="lazy"
                decoding="async"
                className="absolute inset-0 w-full h-full object-cover"
              />
            </div>
          </Link>
        </div>
      )}

      <div>
        {visiblePosts.length === 0 && loading && (
          <>
            {[1, 2, 3].map((i, sIdx) => (
              <Fragment key={i}>
                {sIdx > 0 && <div className={COMMUNITY_FEED_BETWEEN_ROW} aria-hidden />}
                <div className="rounded-none bg-white p-5 space-y-3 dark:bg-gray-800">
                <div className="flex items-center gap-3">
                  <div className="skeleton h-10 w-10 shrink-0 rounded-none" />
                  <div className="flex-1 space-y-1.5">
                    <div className="skeleton h-3 w-24 rounded-none" />
                    <div className="skeleton h-2.5 w-16 rounded-none" />
                  </div>
                </div>
                <div className="skeleton h-4 w-2/3 rounded-none" />
                <div className="skeleton h-3 w-full rounded-none" />
                <div className="skeleton h-3 w-5/6 rounded-none" />
                {i % 2 === 1 && <div className="skeleton aspect-square w-full rounded-none" />}
                <div className="flex gap-6 pt-2">
                  <div className="skeleton h-3 w-14 rounded-none" />
                  <div className="skeleton h-3 w-18 rounded-none" />
                  <div className="skeleton h-3 w-12 rounded-none" />
                </div>
                </div>
              </Fragment>
            ))}
          </>
        )}
        {visiblePosts.map((post, index) => {
          const liked = likedPosts.has(post.id);
          const commentCount = post.community_comments?.[0]?.count || 0;
          const isCommentsOpen = commentsOpen.has(post.id);
          const comments = commentsByPost[post.id] || [];

          return (
            <Fragment key={`${post.id}-${index}`}>
              {index > 0 && <div className={COMMUNITY_FEED_BETWEEN_ROW} aria-hidden />}
            <article
              className="rounded-none bg-white border-0 ring-0 p-6 shadow-sm dark:bg-gray-800"
            >
              {/* Author row */}
              <div className="flex items-center gap-3 mb-3 text-sm text-gray-500 dark:text-gray-400">
                <Avatar
                  src={post.logo_url || post.profile_pic_url}
                  alt=""
                  className="h-9 w-9 shrink-0 rounded-none object-cover"
                />
                {post.author_type === 'organization' && post.username ? (
                  <Link href={`/organization/${post.username}`} className="font-semibold text-blue-900 dark:text-blue-300 hover:underline">
                    {post.author || 'Organization'}
                  </Link>
                ) : post.author_type === 'business' && post.username ? (
                  <Link href={`/business/${post.username}`} className="font-semibold text-blue-900 dark:text-blue-300 hover:underline">
                    {post.author || 'Business'}
                  </Link>
                ) : post.username ? (
                  <Link href={`/profile/${post.username}`} className="font-semibold text-blue-900 dark:text-blue-300 hover:underline">
                    {post.author || 'User'}
                  </Link>
                ) : (
                  <span className="font-semibold text-blue-900 dark:text-blue-300">{post.author}</span>
                )}
                {post.author_type === 'organization' && (
                  <span className="rounded-full bg-indigo-50 dark:bg-indigo-900/50 px-2 py-0.5 text-[11px] font-semibold text-indigo-600 dark:text-indigo-300">
                    Organization
                  </span>
                )}
                <span>•</span>
                <span>
                  {formatDistanceToNow(new Date(post.created_at), {
                    addSuffix: true,
                    locale: enUS,
                  })}
                </span>
              </div>

              {/* Text content */}
              <Link href={`/community/post/${post.id}`}>
                <h2 className="text-xl font-semibold mb-1 text-gray-900 dark:text-gray-100">{post.title}</h2>
                <p className="text-gray-600 dark:text-gray-300 line-clamp-2">{post.body}</p>
              </Link>

              {/* Media: video (inline player) or image (thumbnail) */}
              {post.video ? (
                <div className="mt-3 -mx-6 w-[calc(100%+3rem)] max-w-none">
                  <FeedVideoPlayer src={post.video} square />
                </div>
              ) : post.image ? (
                <Link href={`/community/post/${post.id}`} className="relative mt-3 block aspect-square w-[calc(100%+3rem)] max-w-none -mx-6 overflow-hidden">
                  <img
                    src={post.image}
                    alt="Post"
                    loading="lazy"
                    decoding="async"
                    className="absolute inset-0 h-full w-full object-cover"
                  />
                </Link>
              ) : null}

              <PostActionsBar
                liked={liked}
                likesCount={post.likes_post || 0}
                commentCount={commentCount}
                canLike={!!currentUser.id}
                onLike={() => handleLikePost(post.id)}
                onComment={() => toggleComments(post.id)}
                onShare={() => handleSharePost(post.id)}
                postId={post.id}
                postTitle={post.title}
              />
              <div className="mt-2 flex items-center gap-2 border-t border-slate-100 dark:border-gray-600 pt-2">
                <input
                  value={commentInputs[post.id] || ''}
                  onChange={(e) =>
                    setCommentInputs((prev) => ({ ...prev, [post.id]: e.target.value }))
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
                  onClick={() => submitComment(post.id)}
                  disabled={!currentUser.id || !commentInputs[post.id]?.trim()}
                  aria-label="Post comment"
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-sky-500 text-white shadow-sm transition hover:bg-sky-600 disabled:cursor-not-allowed disabled:bg-sky-200 disabled:text-sky-100/90 dark:bg-sky-600 dark:hover:bg-sky-500 dark:disabled:bg-slate-600 dark:disabled:text-slate-400"
                >
                  <SendHorizontal className="h-4 w-4" strokeWidth={2.25} aria-hidden />
                </button>
              </div>

              {currentUser.id && post.user_id === currentUser.id && (
                <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-slate-100 dark:border-gray-600 pt-3 text-sm">
                  <button
                    onClick={() => handleDeletePost(post.id)}
                    disabled={deletingPost === post.id}
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
                  {commentLoading[post.id] ? (
                    <p className="text-xs text-slate-500 dark:text-gray-400">Loading comments...</p>
                  ) : (
                    <div className="space-y-3">
                      {comments.length === 0 && (
                        <p className="text-xs text-slate-500 dark:text-gray-400">Be the first to comment.</p>
                      )}
                      {comments.map((comment) => (
                        <div key={comment.id} className="rounded-none bg-slate-100 px-3 py-2 text-sm dark:bg-gray-700/80">
                          <p className="text-xs font-semibold text-slate-700 dark:text-gray-200">
                            {comment.author || comment.username || 'User'}
                          </p>
                          <p className="text-sm text-slate-600 dark:text-gray-300">{comment.body ?? comment.text}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </article>
            </Fragment>
          );
        })}
      </div>

      {loading && visiblePosts.length > 0 && (
        <div className="flex justify-center py-4">
          <div className="h-6 w-6 rounded-full border-2 border-slate-300 dark:border-gray-600 border-t-rose-600 dark:border-t-rose-400 animate-spin" />
        </div>
      )}
      <div ref={bottomRef} className="h-10" />
      </div>
    </div>
    </PullToRefresh>
  );
}
