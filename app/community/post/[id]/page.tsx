'use client';

import { useEffect, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';
import { toast } from 'react-hot-toast';
import Link from 'next/link';
import PostActionsBar from '@/components/PostActionsBar';
import FeedVideoPlayer from '@/components/FeedVideoPlayer';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const identityColors: Record<string, string> = {
  user: 'bg-blue-100 text-blue-800',
};

export default function CommunityPostPage() {
  const rawParams = useParams();
  const id = Array.isArray(rawParams.id) ? rawParams.id[0] : rawParams.id;
  const router = useRouter();

  const [post, setPost] = useState<any>(null);
  const [comments, setComments] = useState<any[]>([]);
  const [newComment, setNewComment] = useState('');
  const [likes, setLikes] = useState(0);
  const [likedByUser, setLikedByUser] = useState(false);
  const [loading, setLoading] = useState(true);
  const [userSession, setUserSession] = useState<any>(null);
  const [username, setUsername] = useState('');
  const [reported, setReported] = useState(false);
  const [commentLikeStates, setCommentLikeStates] = useState<Record<string, boolean>>({});
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [sortMode, setSortMode] = useState<'latest' | 'popular'>('latest');
  const [popupImage, setPopupImage] = useState<string | null>(null);
  const [bannerTop, setBannerTop] = useState<{ id: string; image: string; link: string; alt: string } | null>(null);
  const [bannerBottom, setBannerBottom] = useState<{ id: string; image: string; link: string; alt: string } | null>(null);

  useEffect(() => {
    fetch('/api/user/audience-segment')
      .then((r) => r.json())
      .then((seg) => {
        const params = new URLSearchParams();
        if (seg?.age_group) params.set('age_group', seg.age_group);
        if (seg?.gender) params.set('gender', seg.gender);
        if (seg?.preferred_language) params.append('lang', seg.preferred_language);
        if (Array.isArray(seg?.spoken_languages)) seg.spoken_languages.forEach((l: string) => params.append('lang', l));
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
  }, []);

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
    
      // Fetch comments via API (avoids RLS and client join issues)
      const commentsRes = await fetch(`/api/community/comments?postId=${id}`);
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
        .select('username')
        .eq('user_id', session.user.id)
        .maybeSingle();

      if (!profile?.username) return;
      setUsername(profile.username);

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

  const handleSortChange = (mode: 'latest' | 'popular') => {
    setSortMode(mode);
  };

  const handleCommentSubmit = async () => {
    if (!userSession || !newComment.trim() || !username) {
      return toast.error('Cannot submit comment');
    }

    const res = await fetch('/api/community/comments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        post_id: id,
        user_id: userSession.user.id,
        username,
        author: username,
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
        ? `/api/community/post/like?post_id=${encodeURIComponent(id)}&user_id=${encodeURIComponent(userId)}`
        : '/api/community/post/like';

    const res = await fetch(url, {
      method,
      headers: method === 'POST' ? { 'Content-Type': 'application/json' } : undefined,
      body: method === 'POST' ? JSON.stringify({ post_id: id, user_id: userId }) : undefined,
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
    router.push('/community');
  };

  const handleReport = async () => {
    if (!userSession) return toast.error('Login required');
    await supabase.from('community_reports').insert([{ post_id: id, reporter: userSession.user.id }]);
    setReported(true);
    toast.success('Post reported');
  };
  

  const isPostAuthor = post?.user_id === userSession?.user?.id;
  const commentCount = comments.length;

  if (loading) return <div className="p-6 text-center">Loading...</div>;
  if (!post || post.deleted) return <div className="p-6 text-center text-red-500">Post not found.</div>;

  return (
    <div className="min-h-screen bg-slate-100 py-6">
      <div className="max-w-3xl mx-auto px-4 space-y-4">
        {bannerTop?.image && (() => {
          const href = bannerTop.link || '#';
          const isInternal = href.startsWith('/') || href.includes(window.location.hostname);
          return (
            <div ref={bannerTopRef} className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-sm">
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

        <article className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <div className="flex flex-wrap items-center gap-2">
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
              className="mt-3 max-h-80 overflow-hidden rounded-lg border border-slate-100 cursor-pointer"
              onClick={() => setPopupImage(post.image)}
            >
              <img src={post.image} alt={post.title} className="w-full h-full object-contain" />
            </div>
          )}

          {popupImage && (
            <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center" onClick={() => setPopupImage(null)}>
              <img src={popupImage} alt="popup" className="max-h-[90vh] max-w-[90vw] object-contain rounded-md shadow-lg" />
            </div>
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

          <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3 text-sm">
            {!reported && userSession && (
              <button
                onClick={handleReport}
                className="rounded-full bg-orange-500 px-3 py-1 text-xs font-semibold text-white shadow-sm transition hover:bg-orange-600"
              >
                🚩 Report
              </button>
            )}
            {isPostAuthor && (
              <>
                <button
                  onClick={() => toast('Promote coming soon.')}
                  className="rounded-full bg-indigo-600 px-3 py-1 text-xs font-semibold text-white shadow-sm transition hover:bg-indigo-700"
                >
                  📢 Promote
                </button>
                <button
                  onClick={confirmDeletePost}
                  className="rounded-full bg-red-600 px-3 py-1 text-xs font-semibold text-white shadow-sm transition hover:bg-red-700"
                >
                  🗑️ Delete
                </button>
              </>
            )}
          </div>
        </article>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-slate-700">Comments</h3>
          <div id="comment-box" className="mt-3">
            {!userSession ? (
              <p className="text-xs text-slate-500 italic">Login to comment</p>
            ) : (
              <div className="flex flex-col gap-2">
                <textarea
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  className="w-full border border-slate-200 p-3 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  rows={3}
                  placeholder="Write your comment here..."
                />
                <button
                  onClick={handleCommentSubmit}
                  className="self-end rounded-full bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700"
                >
                  Post Comment
                </button>
              </div>
            )}
          </div>

          <div className="mt-4 flex gap-4 text-xs text-slate-500">
            <span>Sort by:</span>
            <button onClick={() => handleSortChange('latest')} className={sortMode === 'latest' ? 'font-semibold text-blue-600' : ''}>Latest</button>
            <button onClick={() => handleSortChange('popular')} className={sortMode === 'popular' ? 'font-semibold text-blue-600' : ''}>Most Popular</button>
          </div>

          <div className="mt-4 space-y-3">
            {comments.length === 0 && (
              <p className="text-xs text-slate-500">Be the first to comment.</p>
            )}
            {comments.map(c => (
              <div key={c.id} className="rounded-lg border border-slate-100 bg-slate-50 p-3">
                <div className="flex items-center gap-2 text-xs text-slate-500">
                  <div className="w-7 h-7 rounded-full overflow-hidden bg-gray-200 flex-shrink-0">
                    <img
                      src={(c.profiles?.profile_pic_url ? `${c.profiles.profile_pic_url}?t=${Date.now()}` : '/default-avatar.png')}
                      alt="avatar"
                      className="w-full h-full object-cover"
                      onError={(e) => (e.currentTarget.src = '/default-avatar.png')}
                    />
                  </div>
                  <Link href={`/profile/${c.username}`} className="text-indigo-600 hover:underline text-xs">
                    @{c.username}
                  </Link>
                  <span>• {new Date(c.created_at).toLocaleDateString()}</span>
                  {userSession && (
                    <button
                      onClick={() => handleCommentLike(c.id)}
                      className={`ml-auto text-xs ${commentLikeStates[c.id] ? 'text-blue-600 font-semibold' : 'text-gray-500'} hover:underline`}
                    >
                      {commentLikeStates[c.id] ? '💙 Liked' : '👍 Like'} ({c.likes ?? c.likes_comment ?? 0})
                    </button>
                  )}
                  {userSession?.user?.id === c.user_id && (
                    <button onClick={() => handleDeleteComment(c.id)} className="text-xs text-red-500 hover:underline ml-2">
                      Delete
                    </button>
                  )}
                </div>
                <p className="mt-2 text-sm text-slate-700">{c.body ?? c.text}</p>
              </div>
            ))}
          </div>
        </div>

        {bannerBottom?.image && (() => {
          const href = bannerBottom.link || '#';
          const isInternal = href.startsWith('/') || href.includes(window.location.hostname);
          return (
            <div ref={bannerBottomRef} className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-sm">
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
      

      {showDeleteModal && (
        <div className="fixed inset-0 backdrop-blur-sm bg-black/30 flex justify-center items-center">
          <div className="relative bg-white rounded-md shadow-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">Confirm Delete</h3>
            <p className="text-gray-700 mb-4">Are you sure you want to delete this post? This action cannot be undone.</p>
            <div className="flex justify-end gap-4">
              <button onClick={cancelDeletePost} className="px-4 py-2 rounded text-gray-600 bg-gray-200 hover:bg-gray-300">
                Cancel
              </button>
              <button onClick={handleDeletePostConfirm} className="px-4 py-2 rounded text-white bg-red-600 hover:bg-red-700">
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
      </div>
    </div>
  );
}
