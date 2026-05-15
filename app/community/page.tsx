'use client';

import { useState, useEffect, useRef, useCallback, useMemo, Fragment } from 'react';
import { HeartIcon, ChatBubbleLeftIcon, MagnifyingGlassIcon, XMarkIcon, PlusIcon } from '@heroicons/react/24/solid';
import { Trash2, Megaphone, SendHorizontal } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { enUS } from 'date-fns/locale';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { useLanguage } from '@/context/LanguageContext';
import { supabase } from '@/lib/supabaseClient';
import { supportedLanguages } from '@/utils/languages';
import {
  feedLangsCacheKey,
  normalizeFeedLangsList,
  parseStoredFeedLangs,
  serializeFeedLangsForStorage,
} from '@/lib/communityPostFeedLangs';
import PostActionsBar from '@/components/PostActionsBar';
import FeedVideoPlayer from '@/components/FeedVideoPlayer';
import PullToRefresh from '@/components/PullToRefresh';
import { Avatar } from '@/components/Avatar';
import { t } from '@/utils/translations';
import { coerceLikeCount } from '@/lib/coerceLikeCount';
import { postIdEquals } from '@/lib/postIdEquals';

const COMMUNITY_SEARCH_FRAME =
  'border border-blue-800/65 dark:border-emerald-700/60 focus:ring-2 focus:ring-blue-500/35 dark:focus:ring-emerald-500/30 focus:border-blue-700';

/** Hanar blue → green gradient rule between community post rows */
const COMMUNITY_FEED_BETWEEN_ROW =
  'h-px w-full shrink-0 bg-gradient-to-r from-blue-700 via-emerald-600 to-blue-800 dark:from-blue-950 dark:via-emerald-700 dark:to-blue-900';

/** Outer frame for feed cards (matches app nav gradient) */
const COMMUNITY_CARD_FRAME =
  'bg-gradient-to-r from-blue-700 via-blue-800 to-emerald-600 p-[2px] shadow-sm dark:from-blue-950 dark:via-blue-900 dark:to-emerald-700';

const COMMUNITY_CACHE_PREFIX = 'hanar_community_cache_';
const COMMUNITY_FEED_LANG_KEY = 'hanar_community_feed_lang';
const COMMUNITY_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

const communityCacheKey = (userKey: string, langKey: string, sortMode: 'latest' | 'popular') =>
  `${COMMUNITY_CACHE_PREFIX}${userKey}::${langKey}::${sortMode}`;

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
  language?: string | null;
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

function CommunityFeedPage() {
  const [search, setSearch] = useState('');
  /** Passed to API / pagination so we do not refetch on every keystroke */
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [visiblePosts, setVisiblePosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [sortMode, setSortMode] = useState<'latest' | 'popular'>('latest');
  const [feedLangs, setFeedLangsState] = useState<string[]>([]);
  const [feedLangReady, setFeedLangReady] = useState(false);
  const requestSeqRef = useRef(0);
  const setFeedLangs = useCallback((next: string[] | ((prev: string[]) => string[])) => {
    setFeedLangsState((prev) => {
      const resolved = typeof next === 'function' ? (next as (p: string[]) => string[])(prev) : next;
      const cleaned = normalizeFeedLangsList(resolved);
      try {
        localStorage.setItem(COMMUNITY_FEED_LANG_KEY, serializeFeedLangsForStorage(cleaned));
      } catch {}
      return cleaned;
    });
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const stored = localStorage.getItem(COMMUNITY_FEED_LANG_KEY);
      if (stored !== null) setFeedLangsState(parseStoredFeedLangs(stored));
    } catch {}
    setFeedLangReady(true);
  }, []);

  const bottomRef = useRef<HTMLDivElement | null>(null);
  const { effectiveLang } = useLanguage();
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
      const spoken = seg.spoken_languages as unknown;
      const state = seg.state as string | undefined;
      const params = new URLSearchParams();
      if (ageGroup) params.set('age_group', ageGroup);
      if (gender) params.set('gender', gender);
      if (effectiveLang) params.append('lang', effectiveLang);
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
  }, [getAudienceForFeed, effectiveLang]);

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
          langs: normalizeFeedLangsList(feedLangs),
          sortMode,
          userId: currentUser.id || undefined,
          primaryLang: null,
          spokenLanguages: audience.spoken_languages,
          deviceLang: deviceLang || undefined,
        }),
      });
      const newPosts: Post[] = await response.json();
      if (requestId !== requestSeqRef.current) return;
      const ordered = (sortMode === 'popular' ? sortPosts(newPosts) : newPosts).map((p) => ({
        ...p,
        id: String(p.id),
      }));
      if (offset === 0) {
        setVisiblePosts(ordered);
      } else {
        setVisiblePosts((prev) => {
          const unique = [...new Map([...prev, ...ordered].map((p) => [String(p.id), p])).values()];
          return unique;
        });
      }
      setHasMore(newPosts.length === 10);

      const cacheKey = communityCacheKey(currentUser.id || 'anon', feedLangsCacheKey(feedLangs), sortMode);
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

    const cacheKey = communityCacheKey(currentUser.id || 'anon', feedLangsCacheKey(feedLangs), sortMode);
    const cache = readCommunityCache(cacheKey);
    if (cache && !debouncedSearch) {
      setVisiblePosts(cache.posts.map((p) => ({ ...p, id: String(p.id) })));
      if (cache.banner) setCommunityBanner(cache.banner);
      setHasMore(cache.posts.length >= 10);
      setLoading(false);
    } else {
      loadBanner();
      loadMorePosts(0);
    }
  }, [feedLangReady, feedLangs, sortMode, currentUser.id, debouncedSearch]);

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
  }, [debouncedSearch, feedLangs, sortMode, currentUser.id, feedLangReady]);

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

  const fetchLikedPosts = useCallback(async (userId: string) => {
    try {
      const res = await fetch(`/api/community/post/liked?userId=${encodeURIComponent(userId)}`, { credentials: 'include' });
      const data = await res.json();
      if (res.ok && Array.isArray(data.likedPostIds)) {
        setLikedPosts(new Set(data.likedPostIds.map((x: unknown) => String(x))));
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
      window.location.href = '/login?redirect=/';
      return false;
    }
    return true;
  };

  const handleLikePost = async (postId: string) => {
    if (!requireLogin()) return;

    const key = String(postId);
    const currentlyLiked = likedPosts.has(key);
    const delta = currentlyLiked ? -1 : 1;

    // Optimistic update: show new count and liked state immediately
    setVisiblePosts((prev) =>
      prev.map((post) =>
        postIdEquals(post.id, key)
          ? { ...post, likes_post: Math.max(0, coerceLikeCount(post.likes_post) + delta) }
          : post
      )
    );
    setLikedPosts((prev) => {
      const next = new Set(prev);
      if (currentlyLiked) next.delete(key);
      else next.add(key);
      return next;
    });

    const revert = () => {
      setVisiblePosts((prev) =>
        prev.map((post) =>
          postIdEquals(post.id, key)
            ? { ...post, likes_post: Math.max(0, coerceLikeCount(post.likes_post) - delta) }
            : post
        )
      );
      setLikedPosts((prev) => {
        const next = new Set(prev);
        if (currentlyLiked) next.add(key);
        else next.delete(key);
        return next;
      });
    };

    const method = currentlyLiked ? 'DELETE' : 'POST';
    const url =
      method === 'DELETE'
        ? `/api/community/post/like?post_id=${encodeURIComponent(key)}`
        : '/api/community/post/like';

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const headers: Record<string, string> = {};
      if (method === 'POST') headers['Content-Type'] = 'application/json';
      if (session?.access_token) headers['Authorization'] = `Bearer ${session.access_token}`;

      const res = await fetch(url, {
        method,
        headers,
        body: method === 'POST' ? JSON.stringify({ post_id: key }) : undefined,
        credentials: 'include',
      });

      if (!res.ok && res.status !== 409) {
        revert();
        const err = await res.json().catch(() => ({}));
        toast.error(err?.error || 'Could not save like. Please try again.');
        return;
      }

      // Sync with server response for accurate count (POST / DELETE / 409)
      const data = (await res.json().catch(() => ({}))) as { likes?: unknown };
      if (data.likes !== undefined && data.likes !== null) {
        const likes = coerceLikeCount(data.likes);
        setVisiblePosts((prev) =>
          prev.map((post) =>
            postIdEquals(post.id, key) ? { ...post, likes_post: likes } : post
          )
        );
      }
      if (res.status === 409 && method === 'POST') {
        setLikedPosts((prev) => new Set(prev).add(key));
      }
      if (res.ok && method === 'DELETE') {
        setLikedPosts((prev) => {
          const next = new Set(prev);
          next.delete(key);
          return next;
        });
      }
    } catch (err) {
      revert();
      toast.error('Could not save like. Please check your connection and try again.');
    }
  };

  const toggleComments = async (postId: string) => {
    const key = String(postId);
    setCommentsOpen((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });

    if (!commentsByPost[key] && !commentLoading[key]) {
      setCommentLoading((prev) => ({ ...prev, [key]: true }));
      try {
        const params = new URLSearchParams({ postId: key });
        if (currentUser.id) params.set('userId', currentUser.id);
        const res = await fetch(`/api/community/comments?${params.toString()}`);
        const data = await res.json();
        setCommentsByPost((prev) => ({ ...prev, [key]: data.comments || [] }));
      } finally {
        setCommentLoading((prev) => ({ ...prev, [key]: false }));
      }
    }
  };

  const submitComment = async (postId: string) => {
    if (!requireLogin()) return;
    const key = String(postId);
    const text = commentInputs[key]?.trim();
    if (!text) return;

    const res = await fetch('/api/community/comments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        post_id: key,
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
      [key]: [data.comment, ...(prev[key] || [])],
    }));
    setCommentInputs((prev) => ({ ...prev, [key]: '' }));
    setVisiblePosts((prev) =>
      prev.map((post) => {
        if (!postIdEquals(post.id, key)) return post;
        const currentCount = post.community_comments?.[0]?.count || 0;
        return { ...post, community_comments: [{ count: currentCount + 1 }] };
      })
    );
  };

  const handleDeletePost = async (postId: string) => {
    if (!requireLogin()) return;
    if (!confirm('Are you sure you want to delete this post? This cannot be undone.')) return;
    const key = String(postId);
    setDeletingPost(key);
    try {
      const { error } = await supabase
        .from('community_posts')
        .update({ deleted: true })
        .eq('id', key)
        .eq('user_id', currentUser.id);

      if (error) throw error;
      setVisiblePosts((prev) => prev.filter((p) => !postIdEquals(p.id, key)));
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
      sessionStorage.removeItem(communityCacheKey(currentUser.id || 'anon', feedLangsCacheKey(feedLangs), sortMode));
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
          langs: normalizeFeedLangsList(feedLangs),
          sortMode,
          userId: currentUser.id || undefined,
          primaryLang: null,
          spokenLanguages: audience.spoken_languages,
          deviceLang: deviceLang || undefined,
        }),
      });
      const newPosts: Post[] = await response.json();
      const ordered = sortMode === 'popular' ? sortPosts(newPosts) : newPosts;
      setVisiblePosts(ordered);
      setHasMore(newPosts.length === 10);
      writeCommunityCache(
        communityCacheKey(currentUser.id || 'anon', feedLangsCacheKey(feedLangs), sortMode),
        ordered,
        banner || communityBanner
      );
    } catch (err) {
      console.error('Error refreshing posts:', err);
    } finally {
      setLoading(false);
    }
  }, [search, feedLangs, sortMode, currentUser.id, communityBanner, getAudienceForFeed, loadBanner]);

  const feedLangSummary = useMemo(() => {
    if (feedLangs.length === 0) return t(effectiveLang, 'All languages');
    const labels = feedLangs.map((code) => {
      const entry = supportedLanguages.find((l) => l.code === code);
      return entry ? `${entry.emoji ? `${entry.emoji} ` : ''}${t(effectiveLang, entry.name)}` : code;
    });
    if (labels.join(', ').length <= 36) return labels.join(', ');
    return `${labels.slice(0, 2).join(', ')} +${feedLangs.length - 2}`;
  }, [feedLangs, effectiveLang]);

  return (
    <PullToRefresh onRefresh={handlePullRefresh}>
    <div className="min-h-screen bg-slate-100 dark:bg-gray-900">
      <div className="w-full pb-6 pt-0">
      <div className="flex flex-wrap items-center gap-2 mb-6 px-4">
        <button
          onClick={() => setSortMode('latest')}
          className={`shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
            sortMode === 'latest' ? 'bg-gradient-to-r from-blue-700 via-blue-800 to-emerald-600 text-white shadow-sm dark:from-blue-950 dark:via-blue-900 dark:to-emerald-700' : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
          }`}
        >
          {t(effectiveLang, 'For you')}
        </button>
        <button
          onClick={() => setSortMode('popular')}
          className={`shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
            sortMode === 'popular' ? 'bg-gradient-to-r from-blue-700 via-blue-800 to-emerald-600 text-white shadow-sm dark:from-blue-950 dark:via-blue-900 dark:to-emerald-700' : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
          }`}
        >
          {t(effectiveLang, 'Most Popular')}
        </button>
        <details className="group relative shrink-0 min-w-[9rem] rounded-lg border border-gray-200 bg-white dark:border-gray-600 dark:bg-gray-800">
          <summary className="flex h-8 cursor-pointer list-none items-center rounded-lg px-2 py-1 text-xs font-medium text-gray-800 dark:text-gray-200 [&::-webkit-details-marker]:hidden">
            <span className="truncate pr-1">{feedLangSummary}</span>
            <span className="ml-auto text-slate-500" aria-hidden>
              <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </span>
          </summary>
          <div className="absolute left-0 top-full z-50 mt-1 max-h-64 min-w-[14rem] overflow-y-auto rounded-lg border border-gray-200 bg-white py-1.5 text-xs shadow-lg dark:border-gray-600 dark:bg-gray-800">
            <label className="flex cursor-pointer items-center gap-2 px-2.5 py-1.5 hover:bg-slate-50 dark:hover:bg-gray-700">
              <input
                type="checkbox"
                checked={feedLangs.length === 0}
                onChange={() => setFeedLangs([])}
                className="rounded border-slate-300"
              />
              <span>🌐 {t(effectiveLang, 'All languages')}</span>
            </label>
            <div className="my-1 border-t border-slate-100 dark:border-gray-700" />
            {supportedLanguages
              .filter((l) => l.code !== 'auto')
              .map((l) => (
                <label
                  key={l.code}
                  className="flex cursor-pointer items-center gap-2 px-2.5 py-1.5 hover:bg-slate-50 dark:hover:bg-gray-700"
                >
                  <input
                    type="checkbox"
                    checked={feedLangs.includes(l.code)}
                    onChange={() =>
                      setFeedLangs((prev) => {
                        const s = new Set(prev);
                        if (s.has(l.code)) s.delete(l.code);
                        else s.add(l.code);
                        return [...s];
                      })
                    }
                    className="rounded border-slate-300"
                  />
                  <span>
                    {l.emoji} {t(effectiveLang, l.name)}
                  </span>
                </label>
              ))}
          </div>
        </details>
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
        <Link
          href="/community/post"
          className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-700 via-blue-800 to-emerald-600 text-white font-bold rounded-lg hover:from-blue-600 hover:via-blue-700 hover:to-emerald-500 transition-all dark:from-blue-950 dark:via-blue-900 dark:to-emerald-700 dark:hover:from-blue-900 dark:hover:via-blue-800 dark:hover:to-emerald-600"
        >
          <PlusIcon className="h-5 w-5" />
          <span>{t(effectiveLang, 'New Post')}</span>
        </Link>
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
                <div className={COMMUNITY_CARD_FRAME}>
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
                </div>
              </Fragment>
            ))}
          </>
        )}
        {visiblePosts.map((post, index) => {
          const pid = String(post.id);
          const liked = likedPosts.has(pid);
          const commentCount = post.community_comments?.[0]?.count || 0;
          const isCommentsOpen = commentsOpen.has(pid);
          const comments = commentsByPost[pid] || [];

          return (
            <Fragment key={`${post.id}-${index}`}>
              {index > 0 && <div className={COMMUNITY_FEED_BETWEEN_ROW} aria-hidden />}
            <div className={COMMUNITY_CARD_FRAME}>
            <article
              className="rounded-none bg-white border-0 ring-0 p-6 dark:bg-gray-800"
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
              <Link href={`/community/post/${post.id}`} data-no-translate>
                <p className="whitespace-pre-wrap text-gray-600 dark:text-gray-300 line-clamp-4">
                  {post.body || post.title}
                </p>
              </Link>

              {/* Media: video (inline player) or image (thumbnail) */}
              {post.video ? (
                <div className="mt-3 -mx-6 w-[calc(100%+3rem)] max-w-none">
                  <FeedVideoPlayer
                    src={post.video}
                    fullscreenActions={
                      <PostActionsBar
                        liked={liked}
                        likesCount={coerceLikeCount(post.likes_post)}
                        commentCount={commentCount}
                        canLike={!!currentUser.id}
                        onLike={() => handleLikePost(pid)}
                        onComment={() => toggleComments(pid)}
                        onShare={() => handleSharePost(pid)}
                        postId={pid}
                        postTitle={post.title}
                        className="mt-0 justify-center"
                        tone="darkVideo"
                      />
                    }
                  />
                </div>
              ) : post.image ? (
                <Link href={`/community/post/${post.id}`} className="relative mt-3 block w-[calc(100%+3rem)] max-w-none -mx-6 overflow-hidden">
                  <img
                    src={post.image}
                    alt="Post"
                    loading="lazy"
                    decoding="async"
                    className="mx-auto block h-auto max-h-[85vh] w-auto max-w-full object-contain"
                  />
                </Link>
              ) : null}

              <PostActionsBar
                liked={liked}
                likesCount={coerceLikeCount(post.likes_post)}
                commentCount={commentCount}
                canLike={!!currentUser.id}
                onLike={() => handleLikePost(pid)}
                onComment={() => toggleComments(pid)}
                onShare={() => handleSharePost(pid)}
                postId={pid}
                postTitle={post.title}
              />
              <div className="mt-2 flex items-center gap-2 border-t border-slate-100 dark:border-gray-600 pt-2">
                <input
                  value={commentInputs[pid] || ''}
                  onChange={(e) =>
                    setCommentInputs((prev) => ({ ...prev, [pid]: e.target.value }))
                  }
                  onFocus={() => {
                    if (!currentUser.id) requireLogin();
                  }}
                  placeholder={currentUser.id ? 'Write a comment...' : 'Log in to write a comment'}
                  disabled={!currentUser.id}
                  className="flex-1 rounded-full border border-blue-300 px-4 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-blue-500/25 disabled:cursor-not-allowed disabled:opacity-60 dark:border-blue-500/50 dark:bg-gray-700 dark:text-gray-100 dark:focus:border-emerald-400 dark:focus:ring-emerald-500/25 dark:placeholder-gray-400"
                />
                <button
                  type="button"
                  onClick={() => submitComment(pid)}
                  disabled={!currentUser.id || !commentInputs[pid]?.trim()}
                  aria-label="Post comment"
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-blue-600 to-emerald-600 text-white shadow-sm transition hover:from-blue-500 hover:to-emerald-500 disabled:cursor-not-allowed disabled:opacity-40 dark:hover:from-blue-500 dark:hover:to-emerald-500"
                >
                  <SendHorizontal className="h-4 w-4" strokeWidth={2.25} aria-hidden />
                </button>
              </div>

              {currentUser.id && post.user_id === currentUser.id && (
                <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-slate-100 dark:border-gray-600 pt-3 text-sm">
                  <button
                    onClick={() => handleDeletePost(pid)}
                    disabled={deletingPost === pid}
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
                  {commentLoading[pid] ? (
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
                          <div data-no-translate>
                            <p className="text-sm text-slate-600 dark:text-gray-300">{comment.body ?? comment.text}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </article>
            </div>
            </Fragment>
          );
        })}
      </div>

      {loading && visiblePosts.length > 0 && (
        <div className="flex justify-center py-4">
          <div className="h-6 w-6 rounded-full border-2 border-slate-300 dark:border-gray-600 border-t-blue-600 dark:border-t-emerald-500 animate-spin" />
        </div>
      )}
      <div ref={bottomRef} className="h-10" />
      </div>
    </div>
    </PullToRefresh>
  );
}

export default CommunityFeedPage;
