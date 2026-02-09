'use client';

import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import Link from 'next/link';
import { User, MessageCircle, Heart, Share2, Trash2 } from 'lucide-react';

type ProfileListing = {
  id: string;
  title: string;
  price: string | number;
  location: string;
  imageUrls: string[];
};

type Post = {
  id: string;
  title: string;
  body: string;
  image: string | null;
  user_id: string;
  created_at: string;
  likes_post: number;
  deleted: boolean;
  author_type: string | null;
  username?: string;
  tags?: string[];
};

type Comment = {
  id: string;
  post_id: string;
  user_id: string;
  username: string;
  author: string;
  text?: string;
  body?: string;
  created_at: string;
  likes_comment?: number;
  author_type?: string;
};

const userProfileHref = (username: string) => `/profile/${username}`;

const resolveMarketplaceImageUrls = (raw: unknown): string[] => {
  let arr: string[] = [];
  if (Array.isArray(raw)) arr = raw;
  else if (typeof raw === 'string') { try { const p = JSON.parse(raw); arr = Array.isArray(p) ? p : []; } catch {} }
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  return arr.map((u) => (u && String(u).startsWith('http') ? u : `${base}/storage/v1/object/public/marketplace-images/${u || ''}`)).filter(Boolean);
};
const orgProfileHref = (username: string) => `/organization/${username}`;

function getHandleHref(username: string, authorType?: string) {
  const t = (authorType || '').toLowerCase();
  if (t === 'organization') return orgProfileHref(username);
  return userProfileHref(username);
}

const Spinner = ({ size = 28 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" className="animate-spin text-indigo-600">
    <path d="M12,1A11,11,0,1,0,23,12,11,11,0,0,0,12,1Zm0,19a8,8,0,1,1,8-8A8,8,0,0,1,12,20Z" opacity=".25" fill="currentColor" />
    <path d="M10.72,19.9a8,8,0,0,1-6.5-9.79A7.77,7.77,0,0,1,10.4,4.16a8,8,0,0,1,9.49,6.52A1.54,1.54,0,0,0,21.38,12h.13a1.37,1.37,0,0,0,1.38-1.54,11,11,0,1,0-12.7,12.39A1.5,1.5,0,0,0,12,21.34h0A1.47,1.47,0,0,0,10.72,19.9Z" fill="currentColor" />
  </svg>
);

export default function ProfilePage() {
  const params = useParams();
  const usernameParam = typeof params?.username === 'string' ? params.username : '';
  const router = useRouter();
  const [profile, setProfile] = useState<{ id: string; username: string; profile_pic_url?: string | null; bio?: string | null } | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [postsLoading, setPostsLoading] = useState(true);
  const [commentCounts, setCommentCounts] = useState<Record<string, number>>({});
  const [expandedPosts, setExpandedPosts] = useState<Set<string>>(new Set());
  const [commentsByPost, setCommentsByPost] = useState<Record<string, Comment[]>>({});
  const [commentsLoading, setCommentsLoading] = useState<Record<string, boolean>>({});
  const [commentInput, setCommentInput] = useState<Record<string, string>>({});
  const [postingComment, setPostingComment] = useState<Record<string, boolean>>({});
  const [currentUser, setCurrentUser] = useState<{ id: string; username: string | null } | null>(null);
  const [isFollowing, setIsFollowing] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [deletingPost, setDeletingPost] = useState<string | null>(null);
  const [listings, setListings] = useState<ProfileListing[]>([]);
  const [listingsLoading, setListingsLoading] = useState(true);

  useEffect(() => {
    const loadCurrentUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setCurrentUser(null);
        return;
      }
      const { data } = await supabase.from('registeredaccounts').select('username').eq('user_id', user.id).single();
      setCurrentUser({ id: user.id, username: data?.username || null });
    };
    loadCurrentUser();
  }, []);

  useEffect(() => {
    const fetchProfile = async () => {
      if (!usernameParam) return;
      setLoading(true);
      setNotFound(false);
      const handle = String(usernameParam).replace(/^@/, '').toLowerCase();

      try {
        const res = await fetch(`/api/handles/resolve?handle=${encodeURIComponent(handle)}`);
        const result = await res.json();

        if (res.ok && result?.type === 'organization') {
          router.replace(`/organization/${handle}`);
          return;
        }
        if (res.ok && result?.type === 'business') {
          router.replace(`/business/${handle}`);
          return;
        }

        const { data, error } = await supabase
          .from('profiles')
          .select('id, username, profile_pic_url')
          .eq('username', handle)
          .maybeSingle();

        if (error) throw error;
        if (data) {
          setProfile({ id: data.id, username: data.username, profile_pic_url: data.profile_pic_url, bio: (data as any).bio ?? null });
        } else {
          const { data: regData } = await supabase
            .from('registeredaccounts')
            .select('user_id')
            .eq('username', handle)
            .maybeSingle();
          if (regData) {
            const { data: profData } = await supabase
              .from('profiles')
              .select('id, username, profile_pic_url')
              .eq('id', regData.user_id)
              .maybeSingle();
            if (profData) {
              setProfile({ id: profData.id, username: profData.username || handle, profile_pic_url: profData.profile_pic_url, bio: (profData as any).bio ?? null });
            } else {
              setProfile({ id: regData.user_id, username: handle, profile_pic_url: null, bio: null });
            }
          } else {
            setNotFound(true);
          }
        }
      } catch {
        setNotFound(true);
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, [usernameParam, router]);

  useEffect(() => {
    const checkFollow = async () => {
      if (!currentUser?.id || !profile?.id) return;
      if (currentUser.id === profile.id) return;

      const { data } = await supabase
        .from('follows')
        .select('*')
        .eq('follower_id', currentUser.id)
        .eq('following_id', profile.id)
        .maybeSingle();

      setIsFollowing(!!data);
    };

    checkFollow();
  }, [currentUser?.id, profile?.id]);

  useEffect(() => {
    const loadPosts = async () => {
      if (!profile?.id) return;
      setPostsLoading(true);

      const res = await fetch(`/api/community/posts?userId=${profile.id}&individualOnly=true`);
      const result = await res.json();

      if (res.ok) {
        setPosts(result.posts || []);
        setCommentCounts(result.commentCounts || {});
      }

      setPostsLoading(false);
    };

    loadPosts();
  }, [profile?.id]);

  useEffect(() => {
    const loadListings = async () => {
      if (!profile?.id) return;
      setListingsLoading(true);
      try {
        const { data } = await supabase
          .from('marketplace_items')
          .select('id, title, price, location, image_urls')
          .eq('user_id', profile.id)
          .order('created_at', { ascending: false });
        if (data) {
          const items: ProfileListing[] = (data || []).map((row: any) => ({
            id: row.id,
            title: row.title || 'Item',
            price: row.price ?? '',
            location: row.location || '',
            imageUrls: resolveMarketplaceImageUrls(row.image_urls ?? row.imageUrls),
          }));
          setListings(items);
        } else setListings([]);
      } catch {
        setListings([]);
      } finally {
        setListingsLoading(false);
      }
    };
    loadListings();
  }, [profile?.id]);

  const handleToggleFollow = async () => {
    if (!currentUser) {
      router.push('/login');
      return;
    }
    if (!profile?.id || currentUser.id === profile.id) return;

    setFollowLoading(true);
    try {
      if (isFollowing) {
        await fetch('/api/unfollow', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ follower_id: currentUser.id, following_id: profile.id }),
        });
        setIsFollowing(false);
      } else {
        await fetch('/api/follow', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ follower_id: currentUser.id, following_id: profile.id }),
        });
        setIsFollowing(true);
      }
    } finally {
      setFollowLoading(false);
    }
  };

  const toggleComments = async (postId: string) => {
    setExpandedPosts((prev) => {
      const next = new Set(prev);
      if (next.has(postId)) next.delete(postId);
      else next.add(postId);
      return next;
    });

    if (commentsByPost[postId] || commentsLoading[postId]) return;

    setCommentsLoading((prev) => ({ ...prev, [postId]: true }));
    try {
      const res = await fetch(`/api/community/comments?postId=${postId}`);
      const result = await res.json();
      if (res.ok) {
        setCommentsByPost((prev) => ({ ...prev, [postId]: result.comments || [] }));
      }
    } finally {
      setCommentsLoading((prev) => ({ ...prev, [postId]: false }));
    }
  };

  const handleDeletePost = async (postId: string) => {
    if (!profile?.id || currentUser?.id !== profile.id) return;
    if (!confirm('Are you sure you want to delete this post? This cannot be undone.')) return;
    setDeletingPost(postId);
    try {
      const { error } = await supabase
        .from('community_posts')
        .update({ deleted: true })
        .eq('id', postId)
        .eq('user_id', profile.id);

      if (error) throw error;
      setPosts((prev) => prev.filter((p) => p.id !== postId));
    } catch {
      alert('Failed to delete post');
    } finally {
      setDeletingPost(null);
    }
  };

  const handleAddComment = async (postId: string) => {
    if (!currentUser || !commentInput[postId]?.trim()) return;
    setPostingComment((prev) => ({ ...prev, [postId]: true }));

    try {
      const res = await fetch('/api/community/comments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          post_id: postId,
          text: commentInput[postId].trim(),
          user_id: currentUser.id,
          username: currentUser.username,
          author: currentUser.username || 'User',
        }),
      });
      const result = await res.json();
      if (res.ok && result.comment) {
        setCommentsByPost((prev) => ({
          ...prev,
          [postId]: [result.comment, ...(prev[postId] || [])],
        }));
        setCommentCounts((prev) => ({ ...prev, [postId]: (prev[postId] || 0) + 1 }));
        setCommentInput((prev) => ({ ...prev, [postId]: '' }));
      }
    } finally {
      setPostingComment((prev) => ({ ...prev, [postId]: false }));
    }
  };

  const handleShare = async (postId: string, title: string) => {
    const url = `${window.location.origin}/community/post/${postId}`;
    try {
      if (navigator.share) {
        await navigator.share({ title, url });
      } else if (navigator.clipboard) {
        await navigator.clipboard.writeText(url);
      }
    } catch {}
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <Spinner size={44} />
      </div>
    );
  }

  if (notFound || !profile) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 text-slate-700">
        <div className="text-center">
          <User className="mx-auto mb-4 h-12 w-12 text-slate-400" />
          <h1 className="text-2xl font-bold">Profile Not Found</h1>
          <p className="mt-2 text-slate-500">We couldn&apos;t find a user with that username.</p>
          <Link href="/" className="mt-4 inline-block text-indigo-600 hover:underline">Go home</Link>
        </div>
      </div>
    );
  }

  const profilePicUrl = profile.profile_pic_url || null;

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
        <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
          <div className="flex flex-col items-center text-center sm:flex-row sm:items-start sm:text-left gap-6">
            <div className="h-24 w-24 shrink-0 overflow-hidden rounded-full border-4 border-slate-100 bg-slate-100 shadow-md">
              {profilePicUrl ? (
                <img
                  src={profilePicUrl}
                  alt={`@${profile.username}`}
                  className="h-full w-full object-cover"
                  onError={(e) => {
                    e.currentTarget.src = '/default-avatar.png';
                    e.currentTarget.onerror = null;
                  }}
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-3xl text-slate-400">
                  <User className="h-12 w-12" />
                </div>
              )}
            </div>

            <div className="flex-1 min-w-0">
              <h1 className="text-2xl font-bold text-slate-900">@{profile.username}</h1>
              {profile.bio && <p className="mt-2 text-slate-600">{profile.bio}</p>}
              <div className="mt-4 flex flex-wrap items-center justify-center sm:justify-start gap-3">
                {currentUser?.id !== profile.id && (
                  <button
                    type="button"
                    onClick={handleToggleFollow}
                    disabled={followLoading}
                    className={`rounded-full px-4 py-1.5 text-xs font-semibold shadow-sm ${
                      isFollowing ? 'bg-slate-200 text-slate-700 hover:bg-slate-300' : 'bg-indigo-600 text-white hover:bg-indigo-700'
                    }`}
                  >
                    {followLoading ? '...' : isFollowing ? 'Following' : 'Follow'}
                  </button>
                )}
                {currentUser?.id === profile.id && (
                  <>
                    <Link
                      href="/dashboard"
                      className="rounded-full border border-slate-300 bg-white px-4 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                    >
                      Edit Profile
                    </Link>
                    <Link
                      href="/marketplace/post"
                      className="rounded-full border border-emerald-300 bg-emerald-50 px-4 py-1.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-100"
                    >
                      Sell Item
                    </Link>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>

        {listings.length > 0 && (
          <div className="mt-8">
            <h2 className="text-lg font-semibold text-slate-900 mb-4">Items for Sale</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              {listings.map((listing) => (
                <Link
                  key={listing.id}
                  href={`/marketplace/individual-${listing.id}`}
                  className="flex gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm hover:border-slate-300 transition"
                >
                  <div className="h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-slate-100">
                    <img src={listing.imageUrls[0] || '/placeholder.jpg'} alt={listing.title} className="h-full w-full object-cover" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold text-slate-900 truncate">{listing.title}</p>
                    <p className="text-sm text-emerald-600 font-medium">{typeof listing.price === 'number' ? `$${listing.price}` : listing.price}</p>
                    <p className="text-xs text-slate-500">{listing.location}</p>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}

        <div className="mt-8">
          <h2 className="text-lg font-semibold text-slate-900 mb-4">Posts</h2>

          {postsLoading ? (
            <div className="flex justify-center py-12">
              <Spinner size={32} />
            </div>
          ) : posts.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center text-slate-500">
              No posts yet.
              {currentUser?.id === profile.id && (
                <Link href="/community/post" className="mt-4 block text-indigo-600 hover:underline">
                  Create your first post
                </Link>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              {posts.map((post) => (
                <article
                  key={post.id}
                  className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
                >
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-semibold text-slate-900">{post.title}</h3>
                    {currentUser?.id === profile.id && (
                      <button
                        type="button"
                        onClick={() => handleDeletePost(post.id)}
                        disabled={deletingPost === post.id}
                        className="rounded p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                  {post.image && (
                    <div className="mt-3 overflow-hidden rounded-xl">
                      <img src={post.image} alt="" className="max-h-64 w-full object-contain" />
                    </div>
                  )}
                  <p className="mt-2 text-sm text-slate-600 whitespace-pre-wrap">{post.body}</p>
                  {post.tags && post.tags.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {post.tags.map((tag) => (
                        <span key={tag} className="rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
                          #{tag}
                        </span>
                      ))}
                    </div>
                  )}
                  <div className="mt-4 flex items-center gap-4 text-sm text-slate-500">
                    <span className="flex items-center gap-1">
                      <Heart className="h-4 w-4" />
                      {post.likes_post}
                    </span>
                    <button
                      type="button"
                      onClick={() => toggleComments(post.id)}
                      className="flex items-center gap-1 hover:text-indigo-600"
                    >
                      <MessageCircle className="h-4 w-4" />
                      {commentCounts[post.id] ?? 0} comments
                    </button>
                    <button
                      type="button"
                      onClick={() => handleShare(post.id, post.title)}
                      className="flex items-center gap-1 hover:text-indigo-600"
                    >
                      <Share2 className="h-4 w-4" />
                      Share
                    </button>
                    <Link
                      href={`/community/post/${post.id}`}
                      className="text-indigo-600 hover:underline"
                    >
                      View post
                    </Link>
                  </div>

                  {expandedPosts.has(post.id) && (
                    <div className="mt-4 border-t border-slate-100 pt-4">
                      {commentsLoading[post.id] ? (
                        <div className="py-4 text-center">
                          <Spinner size={24} />
                        </div>
                      ) : (
                        <>
                          <div className="space-y-3">
                            {(commentsByPost[post.id] || []).map((c) => (
                              <div key={c.id} className="flex gap-2 text-sm">
                                <Link
                                  href={getHandleHref(c.username, c.author_type)}
                                  className="font-medium text-indigo-600 hover:underline shrink-0"
                                >
                                  @{c.username}
                                </Link>
                                <span className="text-slate-600">{c.body ?? c.text}</span>
                              </div>
                            ))}
                          </div>
                          {currentUser && (
                            <div className="mt-4 flex gap-2">
                              <input
                                type="text"
                                value={commentInput[post.id] || ''}
                                onChange={(e) => setCommentInput((prev) => ({ ...prev, [post.id]: e.target.value }))}
                                placeholder="Add a comment..."
                                className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm"
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') handleAddComment(post.id);
                                }}
                              />
                              <button
                                type="button"
                                onClick={() => handleAddComment(post.id)}
                                disabled={postingComment[post.id] || !commentInput[post.id]?.trim()}
                                className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                              >
                                Post
                              </button>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  )}
                </article>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
