'use client';

import { useState, useEffect, useRef } from 'react';
import { HeartIcon, ChatBubbleLeftIcon, MagnifyingGlassIcon, XMarkIcon, PlusIcon } from '@heroicons/react/24/solid';
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
  const { lang } = useLanguage();
  const [isBusinessUser, setIsBusinessUser] = useState(false);
  const [currentUser, setCurrentUser] = useState<{ id: string; username: string | null }>({ id: '', username: null });
  const [likedPosts, setLikedPosts] = useState<Set<string>>(new Set());
  const [commentInputs, setCommentInputs] = useState<Record<string, string>>({});
  const [commentsByPost, setCommentsByPost] = useState<Record<string, any[]>>({});
  const [commentsOpen, setCommentsOpen] = useState<Set<string>>(new Set());
  const [commentLoading, setCommentLoading] = useState<Record<string, boolean>>({});

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
        body: JSON.stringify({ search, offset: visiblePosts.length, lang, sortMode }),
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
  }, [search, lang, sortMode]);

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
        return;
      }

      const { data: account } = await supabase
        .from('registeredaccounts')
        .select('username')
        .eq('user_id', user.id)
        .single();

      setCurrentUser({ id: user.id, username: account?.username || null });
    };

    const stored = localStorage.getItem('communityFeedLikedPosts');
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

  const requireLogin = () => {
    if (!currentUser.id) {
      window.location.href = '/login?redirect=/community';
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
      setVisiblePosts((prev) =>
        prev.map((post) =>
          post.id === postId
            ? { ...post, likes_post: (post.likes_post || 0) + (res.ok ? 1 : 0) }
            : post
        )
      );
      setLikedPosts((prev) => {
        const next = new Set(prev);
        next.add(postId);
        localStorage.setItem('communityFeedLikedPosts', JSON.stringify(Array.from(next)));
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
      <div className="text-xs text-orange-600 mb-0 mt-0">
        Business accounts can’t post.
      </div>
      <div className="text-sm text-gray-600 mb-1">
        {t(lang, 'Showing posts in')}: <strong>{t(lang, lang)}</strong>
      </div>

      <div className="flex gap-3 mb-6">
        <button
          onClick={() => setSortMode('latest')}
          className={`px-4 py-2 rounded-md text-sm font-medium ${
            sortMode === 'latest' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-800'
          }`}
        >
          {t(lang, 'Latest')}
        </button>
        <button
          onClick={() => setSortMode('popular')}
          className={`px-4 py-2 rounded-md text-sm font-medium ${
            sortMode === 'popular' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-800'
          }`}
        >
          {t(lang, 'Most Popular')}
        </button>
      </div>

      <div className="flex items-center mb-6 gap-4">
        <div className="relative flex-1">
          <input
            type="text"
            placeholder={t(lang, 'Search posts...')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 rounded-lg border border-gray-300 focus:outline-none focus:border-blue-500"
          />
          <MagnifyingGlassIcon className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-3 top-2.5">
              <XMarkIcon className="h-5 w-5 text-gray-400" />
            </button>
          )}
        </div>
        {!isBusinessUser && (
          <Link
            href="/community/post"
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <PlusIcon className="h-5 w-5" />
            <span>{t(lang, 'New Post')}</span>
          </Link>
        )}
      </div>

      <div className="space-y-6">
        {visiblePosts.map((post, index) => {
          const liked = likedPosts.has(post.id);
          const commentCount = post.community_comments?.[0]?.count || 0;
          const isCommentsOpen = commentsOpen.has(post.id);
          const comments = commentsByPost[post.id] || [];

          return (
            <article
              key={`${post.id}-${index}`}
              className="bg-white rounded-lg shadow-sm hover:shadow-md transition-shadow p-6"
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
                      <h2 className="text-xl font-semibold mb-2">{post.title}</h2>
                      <p className="text-gray-600 line-clamp-2">{post.body}</p>
                    </Link>
                    <div className="flex items-center gap-3 mt-4 text-sm text-gray-500">
                      {post.author_type === 'organization' && post.username ? (
                        <Link href={`/organization/${post.username}`} className="text-indigo-600 hover:underline">
                          @{post.username}
                        </Link>
                      ) : post.author_type === 'business' && post.username ? (
                        <Link href={`/business/${post.username}`} className="text-indigo-600 hover:underline">
                          @{post.username}
                        </Link>
                      ) : post.username ? (
                        <Link href={`/profile/${post.username}`} className="text-indigo-600 hover:underline">
                          @{post.username}
                        </Link>
                      ) : (
                        <span>{post.author}</span>
                      )}
                      {post.author_type === 'organization' && (
                        <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-[11px] font-semibold text-indigo-600">
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

              {isCommentsOpen && (
                <div className="mt-4 border-t border-slate-100 pt-4">
                  {commentLoading[post.id] ? (
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
                      value={commentInputs[post.id] || ''}
                      onChange={(e) =>
                        setCommentInputs((prev) => ({ ...prev, [post.id]: e.target.value }))
                      }
                      placeholder="Write a comment..."
                      className="flex-1 rounded-full border border-slate-200 px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
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

      <div ref={bottomRef} className="h-10" />
    </div>
  );
}
