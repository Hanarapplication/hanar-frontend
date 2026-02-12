'use client';

import { useState, useEffect, useRef } from 'react';
import { HeartIcon, ChatBubbleLeftIcon, MagnifyingGlassIcon, XMarkIcon, PlusIcon } from '@heroicons/react/24/solid';
import { Trash2, Megaphone } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { enUS } from 'date-fns/locale';
import Link from 'next/link';
import { useLanguage } from '@/context/LanguageContext';
import { supabase } from '@/lib/supabaseClient';
import PostActionsBar from '@/components/PostActionsBar';
import { t } from '@/utils/translations';

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
  likes_post?: number;
  community_comments?: { count: number }[];
}

export default function CommunityFeedPage() {
  const [search, setSearch] = useState('');
  const [visiblePosts, setVisiblePosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [sortMode, setSortMode] = useState<'latest' | 'popular'>('latest');
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const { lang, effectiveLang } = useLanguage();
  const [isBusinessUser, setIsBusinessUser] = useState(false);
  const [currentUser, setCurrentUser] = useState<{ id: string; username: string | null }>({ id: '', username: null });
  const [likedPosts, setLikedPosts] = useState<Set<string>>(new Set());
  const [commentInputs, setCommentInputs] = useState<Record<string, string>>({});
  const [commentsByPost, setCommentsByPost] = useState<Record<string, any[]>>({});
  const [commentsOpen, setCommentsOpen] = useState<Set<string>>(new Set());
  const [commentLoading, setCommentLoading] = useState<Record<string, boolean>>({});
  const [deletingPost, setDeletingPost] = useState<string | null>(null);
  const [communityBanner, setCommunityBanner] = useState<{ id: string; image: string; link: string; alt: string } | null>(null);

  useEffect(() => {
    fetch('/api/feed-banners')
      .then((r) => r.json())
      .then((d) => {
        const list = d.banners || [];
        if (list.length > 0) {
          const pick = list[Math.floor(Math.random() * list.length)];
          if (pick?.image) setCommunityBanner(pick);
        }
      })
      .catch(() => {});
  }, []);

  const sortPosts = (posts: Post[]): Post[] => {
    if (sortMode === 'popular') {
      return [...posts].sort((a, b) => (b.likes_post || 0) - (a.likes_post || 0));
    } else {
      return [...posts].sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
    }
  };

  const loadMorePosts = async () => {
    if (loading || !hasMore) return;
    setLoading(true);
    try {
      const response = await fetch('/api/community/list', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          search,
          offset: visiblePosts.length,
          lang,
          sortMode,
          userId: currentUser.id || undefined,
        }),
      });
      const newPosts: Post[] = await response.json();
      const sorted = sortPosts(newPosts);
      const unique = [...new Map([...visiblePosts, ...sorted].map(p => [p.id, p])).values()];
      setVisiblePosts(unique);
      setHasMore(newPosts.length === 10);
    } catch (err) {
      console.error('Error loading posts:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setVisiblePosts([]);
    setHasMore(true);
    loadMorePosts();
  }, [search, lang, sortMode, currentUser.id]);

  useEffect(() => {
    const observer = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting && !loading && hasMore) {
        loadMorePosts();
      }
    });
    if (bottomRef.current) observer.observe(bottomRef.current);
    return () => {
      if (bottomRef.current) observer.unobserve(bottomRef.current);
    };
  }, [loading, hasMore]);

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

  return (
    <div className="container mx-auto px-4 pt-0 pb-8">
      <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">
        {t(effectiveLang, 'Showing posts in')}: <strong className="dark:text-gray-200">{t(effectiveLang, lang)}</strong>
      </div>

      <div className="flex gap-3 mb-6">
        <button
          onClick={() => setSortMode('latest')}
          className={`px-4 py-2 rounded-md text-sm font-medium ${
            sortMode === 'latest' ? 'bg-blue-600 text-white' : 'bg-gray-200 dark:bg-gray-600 dark:text-gray-200 text-gray-800'
          }`}
        >
          {t(effectiveLang, 'Latest')}
        </button>
        <button
          onClick={() => setSortMode('popular')}
          className={`px-4 py-2 rounded-md text-sm font-medium ${
            sortMode === 'popular' ? 'bg-blue-600 text-white' : 'bg-gray-200 dark:bg-gray-600 dark:text-gray-200 text-gray-800'
          }`}
        >
          {t(effectiveLang, 'Most Popular')}
        </button>
      </div>

      <div className="flex items-center mb-6 gap-4">
        <div className="relative flex-1">
          <input
            type="text"
            placeholder={t(effectiveLang, 'Search posts...')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 focus:outline-none focus:border-blue-500 dark:focus:border-blue-400"
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
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <PlusIcon className="h-5 w-5" />
            <span>{t(effectiveLang, 'New Post')}</span>
          </Link>
        )}
      </div>

      {communityBanner?.image && (
        <div className="mb-6 rounded-xl border border-slate-200 dark:border-gray-700 bg-white dark:bg-gray-800 overflow-hidden shadow-sm">
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

      <div className="space-y-6">
        {visiblePosts.length === 0 && loading && (
          <>
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5 space-y-3">
                <div className="flex items-center gap-3">
                  <div className="skeleton h-10 w-10 rounded-full" />
                  <div className="flex-1 space-y-1.5">
                    <div className="skeleton h-3 w-24 rounded" />
                    <div className="skeleton h-2.5 w-16 rounded" />
                  </div>
                </div>
                <div className="skeleton h-4 w-2/3 rounded" />
                <div className="skeleton h-3 w-full rounded" />
                <div className="skeleton h-3 w-5/6 rounded" />
                {i % 2 === 1 && <div className="skeleton h-48 w-full rounded-lg" />}
                <div className="flex gap-6 pt-2">
                  <div className="skeleton h-3 w-14 rounded" />
                  <div className="skeleton h-3 w-18 rounded" />
                  <div className="skeleton h-3 w-12 rounded" />
                </div>
              </div>
            ))}
          </>
        )}
        {visiblePosts.map((post, index) => {
          const liked = likedPosts.has(post.id);
          const commentCount = post.community_comments?.[0]?.count || 0;
          const isCommentsOpen = commentsOpen.has(post.id);
          const comments = commentsByPost[post.id] || [];

          return (
            <article
              key={`${post.id}-${index}`}
              className="bg-white dark:bg-gray-800 rounded-lg shadow-sm hover:shadow-md dark:shadow-lg dark:shadow-black/20 dark:border dark:border-gray-700 transition-shadow p-6"
            >
              <div className="flex flex-col sm:flex-row gap-4 h-full">
                {post.image && (
                  <Link href={`/community/post/${post.id}`} className="block">
                    <img
                      src={post.image}
                      alt="Post"
                      loading="lazy"
                      decoding="async"
                      className="max-w-[120px] max-h-[120px] w-full sm:w-auto object-cover rounded-md"
                    />
                  </Link>
                )}
                <div className="flex-1 flex flex-col justify-between">
                  <div>
                    <Link href={`/community/post/${post.id}`}>
                      <h2 className="text-xl font-semibold mb-2 text-gray-900 dark:text-gray-100">{post.title}</h2>
                      <p className="text-gray-600 dark:text-gray-300 line-clamp-2">{post.body}</p>
                    </Link>
                    <div className="flex items-center gap-3 mt-4 text-sm text-gray-500 dark:text-gray-400">
                      {post.author_type === 'organization' && post.username ? (
                        <Link href={`/organization/${post.username}`} className="text-indigo-600 dark:text-indigo-400 hover:underline">
                          @{post.username}
                        </Link>
                      ) : post.author_type === 'business' && post.username ? (
                        <Link href={`/business/${post.username}`} className="text-indigo-600 dark:text-indigo-400 hover:underline">
                          @{post.username}
                        </Link>
                      ) : post.username ? (
                        <Link href={`/profile/${post.username}`} className="text-indigo-600 dark:text-indigo-400 hover:underline">
                          @{post.username}
                        </Link>
                      ) : (
                        <span>{post.author}</span>
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
                  </div>
                </div>
              </div>

              <PostActionsBar
                liked={liked}
                likesCount={post.likes_post || 0}
                commentCount={commentCount}
                canLike={!!currentUser.id}
                onLike={() => handleLikePost(post.id)}
                onComment={() => toggleComments(post.id)}
                onShare={() => handleSharePost(post.id)}
              />

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
                        <div key={comment.id} className="rounded-lg bg-slate-50 dark:bg-gray-700/80 px-3 py-2 text-sm">
                          <p className="text-xs font-semibold text-slate-700 dark:text-gray-200">
                            {comment.username || comment.author || 'User'}
                          </p>
                          <p className="text-sm text-slate-600 dark:text-gray-300">{comment.body ?? comment.text}</p>
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="mt-3 flex items-center gap-2">
                    <input
                      value={commentInputs[post.id] || ''}
                      onChange={(e) =>
                        setCommentInputs((prev) => ({ ...prev, [post.id]: e.target.value }))
                      }
                      placeholder="Write a comment..."
                      className="flex-1 rounded-full border border-slate-200 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:placeholder-gray-400"
                    />
                    <button
                      onClick={() => submitComment(post.id)}
                      disabled={!commentInputs[post.id]?.trim()}
                      className="rounded-full bg-blue-600 px-4 py-2 text-xs font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-300"
                    >
                      Post
                    </button>
                  </div>
                </div>
              )}
            </article>
          );
        })}
      </div>

      {loading && visiblePosts.length > 0 && (
        <div className="flex justify-center py-4">
          <div className="h-6 w-6 rounded-full border-2 border-slate-300 dark:border-gray-600 border-t-blue-600 dark:border-t-blue-400 animate-spin" />
        </div>
      )}
      <div ref={bottomRef} className="h-10" />
    </div>
  );
}
