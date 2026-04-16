'use client';

import { createPortal } from 'react-dom';
import { useEffect, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';
import { toast } from 'react-hot-toast';
import Link from 'next/link';
import { SendHorizontal } from 'lucide-react';
import PostActionsBar from '@/components/PostActionsBar';
import FeedVideoPlayer from '@/components/FeedVideoPlayer';
import { Avatar } from '@/components/Avatar';
import { useLanguage } from '@/context/LanguageContext';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const identityColors: Record<string, string> = {
  user: 'bg-rose-100 text-rose-800',
};

export default function CommunityPostPage() {
  const rawParams = useParams();
  const id = Array.isArray(rawParams.id) ? rawParams.id[0] : rawParams.id;
  const router = useRouter();
  const { effectiveLang } = useLanguage();

  const [post, setPost] = useState<any>(null);
  const [comments, setComments] = useState<any[]>([]);
  const [newComment, setNewComment] = useState('');
  const [likes, setLikes] = useState(0);
  const [likedByUser, setLikedByUser] = useState(false);
  const [loading, setLoading] = useState(true);
  const [userSession, setUserSession] = useState<any>(null);
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState<string | null>(null);
  const [commentLikeStates, setCommentLikeStates] = useState<Record<string, boolean>>({});
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [sortMode, setSortMode] = useState<'latest' | 'popular'>('latest');
  const [popupImage, setPopupImage] = useState<string | null>(null);
  const [bannerTop, setBannerTop] = useState<{ id: string; image: string; link: string; alt: string } | null>(null);
  const [bannerBottom, setBannerBottom] = useState<{ id: string; image: string; link: string; alt: string } | null>(null);
  const [feedRestricted, setFeedRestricted] = useState(false);
  /** Show first 4 comments until user expands (Facebook-style). */
  const [commentsExpanded, setCommentsExpanded] = useState(false);

  useEffect(() => {
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
    fetch('/api/user/audience-segment')
      .then((r) => r.json())
      .then((seg) => {
        const params = new URLSearchParams();
        if (seg?.age_group) params.set('age_group', seg.age_group);
        if (seg?.gender) params.set('gender', seg.gender);
        if (effectiveLang) params.append('lang', effectiveLang);
        if (Array.isArray(seg?.spoken_languages)) seg.spoken_languages.forEach((l: string) => params.append('lang', l));
        if (lat != null && lon != null) {
          params.set('lat', String(lat));
          params.set('lon', String(lon));
        }
        const qs = params.toString();
        return fetch(qs ? `/api/feed-banners?${qs}` : '/api/feed-banners').then((r) => r.json());
      })
      .then((d) => {
        const list: { id: string; image: string; link: string; alt: string }[] = (d?.banners || []).filter((b: { image?: string }) => b.image);
        if (list.length === 0) return;
        const shuffled = [...list].sort(() => Math.random() - 0.5);
        setBannerTop(shuffled[0]);
        if (shuffled.length > 1) setBannerBottom(shuffled[1]);
      })
      .catch(() => {});
  }, [effectiveLang]);

  const bannerTopRef = useRef<HTMLDivElement>(null);
  const bannerTopTracked = useRef(false);
  const bannerBottomRef = useRef<HTMLDivElement>(null);
  const bannerBottomTracked = useRef(false);

  useEffect(() => {
    const el = bannerTopRef.current;
    if (!el || bannerTopTracked.current || !bannerTop?.id) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries[0]?.isIntersecting || bannerTopTracked.current) return;
        bannerTopTracked.current = true;
        fetch('/api/track-view', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type: 'feed_banner', id: bannerTop.id }),
        }).catch(() => {});
      },
      { threshold: 0.25 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [bannerTop?.id]);

  useEffect(() => {
    const el = bannerBottomRef.current;
    if (!el || bannerBottomTracked.current || !bannerBottom?.id) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries[0]?.isIntersecting || bannerBottomTracked.current) return;
        bannerBottomTracked.current = true;
        fetch('/api/track-view', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type: 'feed_banner', id: bannerBottom.id }),
        }).catch(() => {});
      },
      { threshold: 0.25 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [bannerBottom?.id]);

  useEffect(() => {
    setFeedRestricted(false);
    const fetchPostAndComments = async () => {
      const { data: post, error: postError } = await supabase
        .from('community_posts')
        .select('*')
        .eq('id', id)
        .single();
    
      if (postError || !post) {
        toast.error('Post not found');
        setLoading(false);
        return;
      }

      const { data: sessData } = await supabase.auth.getSession();
      const viewerId = sessData.session?.user?.id;
      if (viewerId && post.user_id && viewerId !== post.user_id) {
        const headers: Record<string, string> = {};
        if (sessData.session?.access_token) headers.Authorization = `Bearer ${sessData.session.access_token}`;
        const bs = await fetch(`/api/user/block-status?otherUserId=${encodeURIComponent(post.user_id)}`, {
          credentials: 'include',
          headers,
        });
        const bj = await bs.json().catch(() => ({}));
        if (bj.mutuallyBlocked) {
          setFeedRestricted(true);
          setPost(null);
          setComments([]);
          setLoading(false);
          return;
        }
      }
    
      setPost(post);
      // Fetch like count from community_post_likes (source of truth)
      if (id) {
        try {
          const countsRes = await fetch(`/api/community/post/counts?postIds=${id}`);
          const { counts } = await countsRes.json();
          setLikes(counts?.[id] ?? post.likes_post ?? 0);
        } catch {
          setLikes(post.likes_post || 0);
        }
      } else {
        setLikes(post.likes_post || 0);
      }
    
      const commentParams = new URLSearchParams({ postId: String(id) });
      if (viewerId) commentParams.set('userId', viewerId);
      const commentsRes = await fetch(`/api/community/comments?${commentParams.toString()}`);
      const commentsPayload = await commentsRes.json();

      if (!commentsRes.ok) {
        toast.error('Failed to fetch comments');
        setComments([]);
      } else {
        const list = commentsPayload.comments || [];
        const sorted =
          sortMode === 'popular'
            ? [...list].sort((a, b) => (b.likes ?? 0) - (a.likes ?? 0))
            : list;
        setComments(sorted);
      }
    
    setLoading(false);
    
    };
    

    const getSessionAndProfile = async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      const session = sessionData.session;
      if (!session?.user?.id) return;

      setUserSession(session);

      const { data: profile } = await supabase
        .from('registeredaccounts')
        .select('username, full_name')
        .eq('user_id', session.user.id)
        .maybeSingle();

      if (!profile?.username) return;
      setUsername(profile.username);
      setDisplayName(profile?.full_name?.trim() || null);

      const { data: existingLike } = await supabase
        .from('community_post_likes')
        .select('id')
        .eq('post_id', id)
        .eq('user_id', session.user.id)
        .maybeSingle();

      setLikedByUser(!!existingLike);

      const { data: likedComments } = await supabase
        .from('community_comment_likes')
        .select('comment_id')
        .eq('user_id', session.user.id);

      const initialState: Record<string, boolean> = {};
      likedComments?.forEach(like => {
        initialState[like.comment_id] = true;
      });
      setCommentLikeStates(initialState);
    };

    fetchPostAndComments();
    getSessionAndProfile();
  }, [id, sortMode]);

  useEffect(() => {
    setCommentsExpanded(false);
  }, [sortMode]);

  const handleSortChange = (mode: 'latest' | 'popular') => {
    setSortMode(mode);
  };

  const requireLogin = () => {
    if (!userSession) {
      const redirect = encodeURIComponent(`/community/post/${id}`);
      window.location.href = `/login?redirect=${redirect}`;
      return false;
    }
    return true;
  };

  const handleCommentSubmit = async () => {
    if (!requireLogin()) return;
    if (!newComment.trim() || !username) return;

    const res = await fetch('/api/community/comments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        post_id: id,
        user_id: userSession.user.id,
        username,
        author: displayName || username || 'User',
        text: newComment.trim(),
      }),
    });
    const result = await res.json();
    if (!res.ok) {
      toast.error('Failed to post comment');
      return;
    }
    setNewComment('');
    setComments((prev) => [result.comment, ...prev]);

  };

  const handleCommentLike = async (commentId: string) => {
    const userId = userSession?.user?.id;
    if (!userSession || !username || !userId) return toast.error('Login required');

    const currentlyLiked = commentLikeStates[commentId];
    const method = currentlyLiked ? 'DELETE' : 'POST';
    const delta = currentlyLiked ? -1 : 1;

    setCommentLikeStates((prev) => ({ ...prev, [commentId]: !currentlyLiked }));
    setComments((prev) =>
      prev.map((c) =>
        c.id === commentId ? { ...c, likes: Math.max(0, (c.likes ?? c.likes_comment ?? 0) + delta) } : c
      )
    );

    const url =
      method === 'DELETE'
        ? `/api/community/comments/like?comment_id=${encodeURIComponent(commentId)}&user_id=${encodeURIComponent(userId)}`
        : '/api/community/comments/like';

    const res = await fetch(url, {
      method,
      headers: method === 'POST' ? { 'Content-Type': 'application/json' } : undefined,
      body: method === 'POST' ? JSON.stringify({ comment_id: commentId, user_id: userId }) : undefined,
    });

    if (!res.ok && res.status !== 409) {
      toast.error('Failed to like comment');
      setCommentLikeStates((prev) => ({ ...prev, [commentId]: currentlyLiked }));
      setComments((prev) =>
        prev.map((c) =>
          c.id === commentId ? { ...c, likes: Math.max(0, (c.likes ?? c.likes_comment ?? 0) - delta) } : c
        )
      );
    }
  };

  const handleLike = async () => {
    const userId = userSession?.user?.id;
    if (!id || !userSession || !username || !userId) return toast.error('Login required');

    const currentlyLiked = likedByUser;
    const newLiked = !currentlyLiked;

    // Optimistic update: show new count and liked state immediately
    setLikedByUser(newLiked);
    setLikes((prev) => (newLiked ? prev + 1 : Math.max(0, prev - 1)));

    const method = currentlyLiked ? 'DELETE' : 'POST';
    const url =
      method === 'DELETE'
        ? `/api/community/post/like?post_id=${encodeURIComponent(id)}`
        : '/api/community/post/like';

    const { data: { session } } = await supabase.auth.getSession();
    const headers: Record<string, string> = {};
    if (method === 'POST') headers['Content-Type'] = 'application/json';
    if (session?.access_token) headers['Authorization'] = `Bearer ${session.access_token}`;

    const res = await fetch(url, {
      method,
      headers,
      body: method === 'POST' ? JSON.stringify({ post_id: id }) : undefined,
      credentials: 'include',
    });

    if (!res.ok && res.status !== 409) {
      toast.error('Failed to update like');
      setLikedByUser(currentlyLiked);
      setLikes((prev) => (newLiked ? Math.max(0, prev - 1) : prev + 1));
      return;
    }
    toast.success(newLiked ? 'Liked' : 'Unliked');
  };

  const handleDeleteComment = async (commentId: number) => {
    await supabase.from('community_comments').delete().eq('id', commentId);
    setComments(prev => prev.filter(c => c.id !== commentId));
  };

  const confirmDeletePost = () => setShowDeleteModal(true);
  const cancelDeletePost = () => setShowDeleteModal(false);

  const handleDeletePostConfirm = async () => {
    setShowDeleteModal(false);
    const { error } = await supabase
      .from('community_posts')
      .update({ deleted: true })
      .eq('id', id);

    if (error) {
      toast.error('Failed to delete post');
      console.error('Delete error:', error.message);
      return;
    }

    toast.success('Post deleted');
    router.push('/');
  };

  const isPostAuthor = post?.user_id === userSession?.user?.id;
  const commentCount = comments.length;

  if (loading) return <div className="p-6 text-center">Loading...</div>;
  if (feedRestricted) {
    return (
      <div className="min-h-screen bg-slate-100 py-6">
        <div className="max-w-3xl mx-auto px-4">
          <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-slate-600">
            This post isn&apos;t available. You or the author may have blocked the other.
          </div>
          <Link href="/" className="mt-4 inline-block text-indigo-600 hover:underline text-sm">Back to feed</Link>
        </div>
      </div>
    );
  }
  if (!post || post.deleted) return <div className="p-6 text-center text-red-500">Post not found.</div>;

  const COMMENTS_PREVIEW = 4;
  const visibleComments = commentsExpanded ? comments : comments.slice(0, COMMENTS_PREVIEW);
  const showLoadMoreComments = comments.length > COMMENTS_PREVIEW && !commentsExpanded;

  return (
    <div className="min-h-screen bg-slate-100 py-6 dark:bg-gray-900">
      <div className="w-full space-y-0">
        {bannerTop?.image && (() => {
          const href = bannerTop.link || '#';
          const isInternal = href.startsWith('/') || href.includes(window.location.hostname);
          return (
            <div ref={bannerTopRef} className="overflow-hidden border-b border-slate-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800">
              <Link href={href} {...(isInternal ? {} : { target: '_blank', rel: 'noopener noreferrer' })} className="block w-full">
                <div className="relative w-full aspect-[3/1] max-h-32 bg-slate-100">
                  <img
                    src={bannerTop.image}
                    alt={bannerTop.alt || 'Banner'}
                    loading="lazy"
                    decoding="async"
                    className="absolute inset-0 w-full h-full object-cover"
                  />
                </div>
              </Link>
            </div>
          );
        })()}

        <article className="border-b border-slate-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-800">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <div className="flex flex-wrap items-center gap-2">
              {post.author_type === 'organization' && post.username ? (
                <Link href={`/organization/${post.username}`} className="text-blue-900 dark:text-blue-300 hover:underline">
                  {post.author || 'Organization'}
                </Link>
              ) : post.author_type === 'business' && post.username ? (
                <Link href={`/business/${post.username}`} className="text-blue-900 dark:text-blue-300 hover:underline">
                  {post.author || 'Business'}
                </Link>
              ) : post.username ? (
                <Link href={`/profile/${post.username}`} className="text-blue-900 dark:text-blue-300 hover:underline">
                  {post.author || 'User'}
                </Link>
              ) : (
                <span>{post.author}</span>
              )}
              {post.author_type === 'organization' && (
                <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-[11px] font-semibold text-indigo-600">
                  Organization
                </span>
              )}
            </div>
            <span>{new Date(post.created_at).toLocaleDateString()}</span>
          </div>

          <h1 className="mt-2 text-xl font-semibold text-slate-800">{post.title}</h1>
          <p className="mt-2 whitespace-pre-wrap text-slate-700 text-sm">{post.body}</p>

          {post.video && (
            <div className="mt-3">
              <FeedVideoPlayer src={post.video} />
            </div>
          )}

          {post.image && !post.video && (
            <div
              className="mt-3 overflow-hidden rounded-lg border border-slate-100 cursor-pointer"
              onClick={() => setPopupImage(post.image)}
            >
              <img src={post.image} alt={post.title} className="block w-full h-auto max-h-[85vh] object-contain" />
            </div>
          )}

          {popupImage && typeof document !== 'undefined' && createPortal(
            <div className="fixed inset-0 z-[9999] bg-black/80 flex items-center justify-center p-4" onClick={() => setPopupImage(null)} role="dialog" aria-modal="true" aria-label="Image preview">
              <img src={popupImage} alt="popup" className="max-h-[90vh] max-w-[90vw] object-contain rounded-md shadow-lg" onClick={(e) => e.stopPropagation()} />
            </div>,
            document.body
          )}

          <PostActionsBar
            liked={likedByUser}
            likesCount={likes}
            commentCount={commentCount}
            canLike={!!userSession}
            onLike={handleLike}
            onComment={() => document.getElementById('comment-box')?.scrollIntoView({ behavior: 'smooth', block: 'center' })}
            onShare={() => {
              if (navigator.share) {
                navigator.share({ title: post.title, url: window.location.href });
              } else {
                toast('Sharing not supported on this device');
              }
            }}
            postId={post.id}
            postTitle={post.title}
          />

          <div className="mt-4 border-t border-slate-100 pt-4 dark:border-gray-600">
            <h3 className="text-sm font-semibold text-slate-700 dark:text-gray-200">Comments</h3>
            <div className="mt-3 flex gap-4 text-xs text-slate-500 dark:text-gray-400">
              <span>Sort by:</span>
              <button type="button" onClick={() => handleSortChange('latest')} className={sortMode === 'latest' ? 'font-semibold text-rose-600 dark:text-rose-400' : ''}>
                Latest
              </button>
              <button type="button" onClick={() => handleSortChange('popular')} className={sortMode === 'popular' ? 'font-semibold text-rose-600 dark:text-rose-400' : ''}>
                Most Popular
              </button>
            </div>

            <div className="mt-4">
              {comments.length === 0 && (
                <p className="text-xs text-slate-500 dark:text-gray-400">Be the first to comment.</p>
              )}
              {visibleComments.length > 0 && (
              <div className="-mx-5 flex flex-col divide-y divide-slate-300 bg-white gap-0 dark:divide-slate-600 dark:bg-white">
              {visibleComments.map((c) => (
                <div
                  key={c.id}
                  className="bg-white px-5 py-3"
                >
                  <div className="flex items-center gap-2 text-xs text-slate-500">
                    <div className="h-7 w-7 flex-shrink-0 overflow-hidden rounded-full">
                      <Avatar
                        src={c.profiles?.profile_pic_url ? `${c.profiles.profile_pic_url}?t=${Date.now()}` : null}
                        alt="avatar"
                        className="h-full w-full rounded-full"
                      />
                    </div>
                    {c.username ? (
                      <Link href={`/profile/${c.username}`} className="text-xs text-blue-900 hover:underline dark:text-blue-300">
                        {c.author || c.username || 'User'}
                      </Link>
                    ) : (
                      <span className="text-xs text-slate-700 dark:text-gray-200">{c.author || 'User'}</span>
                    )}
                    <span>• {new Date(c.created_at).toLocaleDateString()}</span>
                    {userSession && (
                      <button
                        type="button"
                        onClick={() => handleCommentLike(c.id)}
                        aria-label={commentLikeStates[c.id] ? 'Unlike comment' : 'Like comment'}
                        aria-pressed={!!commentLikeStates[c.id]}
                        className={`ml-auto inline-flex items-center gap-1 text-xs font-medium ${commentLikeStates[c.id] ? 'text-rose-600' : 'text-gray-500 dark:text-gray-400'} hover:opacity-90`}
                      >
                        <span aria-hidden>{commentLikeStates[c.id] ? '💙' : '👍'}</span>
                        <span className="tabular-nums">{c.likes ?? c.likes_comment ?? 0}</span>
                      </button>
                    )}
                    {!userSession && (
                      <span className="ml-auto inline-flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
                        <span aria-hidden>👍</span>
                        <span className="tabular-nums">{c.likes ?? c.likes_comment ?? 0}</span>
                      </span>
                    )}
                    {userSession?.user?.id === c.user_id && (
                      <button type="button" onClick={() => handleDeleteComment(c.id)} className="ml-2 text-xs text-red-500 hover:underline">
                        Delete
                      </button>
                    )}
                  </div>
                  <p className="mt-2 text-sm text-slate-700 dark:text-gray-200">{c.body ?? c.text}</p>
                </div>
              ))}
              </div>
              )}
            </div>

            {showLoadMoreComments && (
              <button
                type="button"
                onClick={() => setCommentsExpanded(true)}
                className="mt-3 w-full rounded-lg border border-slate-200 bg-slate-50 py-2.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-100 dark:border-gray-600 dark:bg-gray-700/80 dark:text-gray-200 dark:hover:bg-gray-700"
              >
                Load more comments
              </button>
            )}
          </div>

          <div id="comment-box" className="mt-4 border-t border-slate-100 pt-4 dark:border-gray-600">
            {!userSession && <p className="mb-2 text-xs italic text-slate-500 dark:text-gray-400">Log in to comment.</p>}
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                onFocus={() => {
                  if (!userSession) requireLogin();
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleCommentSubmit();
                }}
                placeholder={userSession ? 'Write a comment...' : 'Log in to write a comment'}
                disabled={!userSession}
                className="flex-1 rounded-full border border-sky-300 px-4 py-2 text-sm focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-200/90 disabled:cursor-not-allowed disabled:opacity-60 dark:border-sky-400 dark:bg-gray-700 dark:text-gray-100 dark:focus:border-sky-300 dark:focus:ring-sky-400/45 dark:placeholder-gray-400"
              />
              <button
                type="button"
                onClick={handleCommentSubmit}
                disabled={!userSession || !newComment.trim()}
                aria-label="Post comment"
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-sky-500 text-white shadow-sm transition hover:bg-sky-600 disabled:cursor-not-allowed disabled:bg-sky-200 disabled:text-sky-100/90 dark:bg-sky-600 dark:hover:bg-sky-500 dark:disabled:bg-slate-600 dark:disabled:text-slate-400"
              >
                <SendHorizontal className="h-4 w-4" strokeWidth={2.25} aria-hidden />
              </button>
            </div>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3 text-sm dark:border-gray-600">
            {isPostAuthor && (
              <>
                <button
                  type="button"
                  onClick={() => toast('Promote coming soon.')}
                  className="rounded-full bg-indigo-600 px-3 py-1 text-xs font-semibold text-white shadow-sm transition hover:bg-indigo-700"
                >
                  📢 Promote
                </button>
                <button
                  type="button"
                  onClick={confirmDeletePost}
                  className="rounded-full bg-red-600 px-3 py-1 text-xs font-semibold text-white shadow-sm transition hover:bg-red-700"
                >
                  🗑️ Delete
                </button>
              </>
            )}
          </div>
        </article>

        {bannerBottom?.image && (() => {
          const href = bannerBottom.link || '#';
          const isInternal = href.startsWith('/') || href.includes(window.location.hostname);
          return (
            <div ref={bannerBottomRef} className="overflow-hidden border-b border-slate-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800">
              <Link href={href} {...(isInternal ? {} : { target: '_blank', rel: 'noopener noreferrer' })} className="block w-full">
                <div className="relative w-full aspect-[3/1] max-h-32 bg-slate-100">
                  <img
                    src={bannerBottom.image}
                    alt={bannerBottom.alt || 'Banner'}
                    loading="lazy"
                    decoding="async"
                    className="absolute inset-0 w-full h-full object-cover"
                  />
                </div>
              </Link>
            </div>
          );
        })()}
      

      {showDeleteModal && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-[9999] backdrop-blur-sm bg-black/30 flex justify-center items-center p-4" onClick={cancelDeletePost} role="dialog" aria-modal="true" aria-label="Confirm delete">
          <div className="relative bg-white dark:bg-gray-800 rounded-md shadow-lg p-6 w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-4">Confirm Delete</h3>
            <p className="text-gray-700 dark:text-gray-300 mb-4">Are you sure you want to delete this post? This action cannot be undone.</p>
            <div className="flex justify-end gap-4">
              <button onClick={cancelDeletePost} className="px-4 py-2 rounded text-gray-600 bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-200">
                Cancel
              </button>
              <button onClick={handleDeletePostConfirm} className="px-4 py-2 rounded text-white bg-red-600 hover:bg-red-700">
                Delete
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
      </div>
    </div>
  );
}
