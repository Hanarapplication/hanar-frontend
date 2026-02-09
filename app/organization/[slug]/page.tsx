'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabaseClient';
import {
  Building,
  Globe,
  Mail,
  MapPin,
  Phone,
  Instagram,
  Facebook,
  Calendar,
  Image as ImageIcon,
  Heart,
  MessageCircle,
  Share2,
  Trash2,
} from 'lucide-react';

type OrgProfile = {
  id: string;
  user_id: string;
  username: string;
  email: string;
  full_name: string;
  banner_url?: string | null;
  logo_url?: string | null;
  mission?: string | null;
  address?: string | null;
  socials?: {
    website?: string;
    facebook?: string;
    instagram?: string;
  } | null;
  contact_info?: {
    phone?: string;
    whatsapp?: string;
    email?: string;
  } | null;
  created_at?: string;
  updated_at?: string;
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
  author_type: string;
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

  // IMPORTANT:
  // If your /api/community/comments is not returning this yet,
  // it will be undefined and we’ll fallback to user profile route.
  author_type?: 'user' | 'organization' | 'business' | 'anonymous' | string;
};

const Spinner = ({ size = 28 }: { size?: number }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    xmlns="http://www.w3.org/2000/svg"
    className="animate-spin text-indigo-600"
  >
    <path
      d="M12,1A11,11,0,1,0,23,12,11,11,0,0,0,12,1Zm0,19a8,8,0,1,1,8-8A8,8,0,0,1,12,20Z"
      opacity=".25"
      fill="currentColor"
    />
    <path
      d="M10.72,19.9a8,8,0,0,1-6.5-9.79A7.77,7.77,0,0,1,10.4,4.16a8,8,0,0,1,9.49,6.52A1.54,1.54,0,0,0,21.38,12h.13a1.37,1.37,0,0,0,1.38-1.54,11,11,0,1,0-12.7,12.39A1.5,1.5,0,0,0,12,21.34h0A1.47,1.47,0,0,0,10.72,19.9Z"
      fill="currentColor"
    />
  </svg>
);

// Change this if your user profile route is different
const userProfileHref = (username: string) => `/profile/${username}`;

// Organization profile route (your current page is likely this)
const orgProfileHref = (username: string) => `/organization/${username}`;

// Decide where a handle should go
function getHandleHref(username: string, authorType?: string) {
  const t = (authorType || '').toLowerCase();
  if (t === 'organization') return orgProfileHref(username);
  // You can add business logic later:
  // if (t === 'business') return `/business/${username}`;
  return userProfileHref(username);
}

export default function OrganizationProfilePage() {
  const params = useParams();
  const slug = typeof params?.slug === 'string' ? params.slug : '';
  const router = useRouter();

  const [profile, setProfile] = useState<OrgProfile | null>(null);
  const [loading, setLoading] = useState(true);
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
  const [notFound, setNotFound] = useState(false);
  const [deletingPost, setDeletingPost] = useState<string | null>(null);

  useEffect(() => {
    const loadProfile = async () => {
      if (!slug) return;
      setLoading(true);
      setNotFound(false);

      const { data, error } = await supabase
        .from('organizations')
        .select('*')
        .eq('username', slug)
        .single();

      if (error || !data) {
        setProfile(null);
        setNotFound(true);
      } else if (data.moderation_status === 'on_hold') {
        setProfile(null);
        setNotFound(true);
      } else {
        setProfile(data);
      }

      setLoading(false);
    };

    loadProfile();
  }, [slug]);

  useEffect(() => {
    const loadCurrentUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setCurrentUser(null);
        return;
      }
      const { data: profileData } = await supabase
        .from('registeredaccounts')
        .select('username')
        .eq('user_id', user.id)
        .single();

      setCurrentUser({ id: user.id, username: profileData?.username || null });
    };

    loadCurrentUser();
  }, []);

  useEffect(() => {
    const checkFollow = async () => {
      if (!currentUser?.id || !profile?.user_id) return;
      if (currentUser.id === profile.user_id) return;

      const { data } = await supabase
        .from('follows')
        .select('*')
        .eq('follower_id', currentUser.id)
        .eq('following_id', profile.user_id)
        .maybeSingle();

      setIsFollowing(!!data);
    };

    checkFollow();
  }, [currentUser?.id, profile?.user_id]);

  useEffect(() => {
    const loadPosts = async () => {
      if (!profile?.user_id) return;
      setPostsLoading(true);

      const params = new URLSearchParams({
        userId: profile.user_id,
      });
      if (profile.id) params.set('orgId', profile.id);

      const res = await fetch(`/api/community/posts?${params.toString()}`);
      const result = await res.json();

      if (res.ok) {
        setPosts(result.posts || []);
        setCommentCounts(result.commentCounts || {});
      }

      setPostsLoading(false);
    };

    loadPosts();
  }, [profile?.user_id, profile?.id]);

  const handleShare = async (postId: string, title: string) => {
    const url = `${window.location.origin}/community/post/${postId}`;
    try {
      if (navigator.share) {
        await navigator.share({ title, url });
      } else if (navigator.clipboard) {
        await navigator.clipboard.writeText(url);
      }
    } catch (error) {
      console.error('Error sharing post:', error);
    }
  };

  const handleToggleFollow = async () => {
    if (!currentUser) {
      router.push('/login');
      return;
    }
    if (!profile?.user_id || currentUser.id === profile.user_id) return;

    setFollowLoading(true);
    try {
      if (isFollowing) {
        await fetch('/api/unfollow', {
          method: 'POST',
          body: JSON.stringify({ follower_id: currentUser.id, following_id: profile.user_id }),
        });
        setIsFollowing(false);
      } else {
        await fetch('/api/follow', {
          method: 'POST',
          body: JSON.stringify({ follower_id: currentUser.id, following_id: profile.user_id }),
        });
        setIsFollowing(true);
      }
    } finally {
      setFollowLoading(false);
    }
  };

  const toggleComments = async (postId: string) => {
    setExpandedPosts(prev => {
      const next = new Set(prev);
      if (next.has(postId)) next.delete(postId);
      else next.add(postId);
      return next;
    });

    if (commentsByPost[postId] || commentsLoading[postId]) return;

    setCommentsLoading(prev => ({ ...prev, [postId]: true }));
    try {
      const res = await fetch(`/api/community/comments?postId=${postId}`);
      const result = await res.json();
      if (res.ok) {
        setCommentsByPost(prev => ({ ...prev, [postId]: result.comments || [] }));
      }
    } finally {
      setCommentsLoading(prev => ({ ...prev, [postId]: false }));
    }
  };

  const handleDeletePost = async (postId: string) => {
    if (!profile?.user_id || currentUser?.id !== profile.user_id) return;
    if (!confirm('Are you sure you want to delete this post? This cannot be undone.')) return;
    setDeletingPost(postId);
    try {
      const { error } = await supabase
        .from('community_posts')
        .update({ deleted: true })
        .eq('id', postId)
        .eq('user_id', profile.user_id);

      if (error) throw error;
      setPosts((prev) => prev.filter((p) => p.id !== postId));
    } catch (err) {
      console.error('Delete error:', err);
      alert('Failed to delete post');
    } finally {
      setDeletingPost(null);
    }
  };

  const handleAddComment = async (postId: string) => {
    if (!currentUser || !commentInput[postId]?.trim()) return;
    setPostingComment(prev => ({ ...prev, [postId]: true }));

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
        setCommentsByPost(prev => ({
          ...prev,
          [postId]: [result.comment, ...(prev[postId] || [])],
        }));
        setCommentCounts(prev => ({
          ...prev,
          [postId]: (prev[postId] || 0) + 1,
        }));
        setCommentInput(prev => ({ ...prev, [postId]: '' }));
      }
    } finally {
      setPostingComment(prev => ({ ...prev, [postId]: false }));
    }
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
          <Building className="mx-auto mb-4 h-12 w-12 text-red-500" />
          <h1 className="text-2xl font-bold">Organization Not Found</h1>
          <p className="mt-2 text-slate-500">We couldn’t find an organization with that username.</p>
        </div>
      </div>
    );
  }

  const hasSocials = Boolean(profile.socials?.website || profile.socials?.instagram || profile.socials?.facebook);

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="relative">
        <div className="h-48 w-full bg-slate-200 sm:h-64">
          <img
            src={profile.banner_url || 'https://placehold.co/1200x400/e2e8f0/e2e8f0'}
            alt="Organization Banner"
            className="h-full w-full object-cover"
            onError={(e) => {
              e.currentTarget.src = 'https://placehold.co/1200x400/e2e8f0/e2e8f0?text=Banner+Error';
            }}
          />
        </div>

        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <div className="relative -mt-12 flex items-end gap-4">
            <div className="h-24 w-24 overflow-hidden rounded-lg border-4 border-slate-50 bg-slate-200 shadow-md sm:h-28 sm:w-28">
              <img
                src={profile.logo_url || 'https://placehold.co/150/e2e8f0/e2e8f0'}
                alt="Organization Logo"
                className="h-full w-full object-contain object-center"
                onError={(e) => {
                  e.currentTarget.src = 'https://placehold.co/150/e2e8f0/e2e8f0?text=Logo+Error';
                }}
              />
            </div>

            <div className="pb-2">
              <h1 className="mt-16 text-2xl font-bold text-slate-800 sm:text-3xl">{profile.full_name}</h1>

              <div className="mt-2 flex flex-wrap items-center gap-3">
                <Link href={`/organization/${profile.username}`} className="text-sm text-indigo-600 hover:underline">
                  @{profile.username}
                </Link>

                <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-[11px] font-semibold text-indigo-600">
                  Organization
                </span>

                {currentUser?.id !== profile.user_id && (
                  <button
                    type="button"
                    onClick={handleToggleFollow}
                    disabled={followLoading}
                    className={`rounded-full px-4 py-1.5 text-xs font-semibold shadow-sm ${
                      isFollowing
                        ? 'bg-slate-200 text-slate-700 hover:bg-slate-300'
                        : 'bg-indigo-600 text-white hover:bg-indigo-700'
                    }`}
                  >
                    {followLoading ? '...' : isFollowing ? 'Following' : 'Follow'}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      <main className="mx-auto max-w-6xl px-4 pb-16 pt-8 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
          <div className="space-y-6 lg:col-span-1">
            <div className="rounded-xl bg-white p-6 shadow-sm">
              <h2 className="mb-3 text-lg font-semibold text-slate-800">About</h2>
              <p className="text-sm text-slate-600">{profile.mission || 'No mission statement provided yet.'}</p>
            </div>

            <div className="rounded-xl bg-white p-6 shadow-sm">
              <h2 className="mb-3 text-lg font-semibold text-slate-800">Contact</h2>
              <div className="space-y-3 text-sm text-slate-600">
                <div className="flex items-center gap-2">
                  <Mail className="h-4 w-4 text-slate-400" />
                  <span>{profile.contact_info?.email || profile.email || 'Not provided'}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Phone className="h-4 w-4 text-slate-400" />
                  <span>{profile.contact_info?.phone || 'Not provided'}</span>
                </div>
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-slate-400" />
                  <span>{profile.address || 'Not provided'}</span>
                </div>
              </div>
            </div>

            {hasSocials && (
              <div className="rounded-xl bg-white p-6 shadow-sm">
                <h2 className="mb-3 text-lg font-semibold text-slate-800">Socials</h2>
                <div className="space-y-3 text-sm text-slate-600">
                  {profile.socials?.website && (
                    <div className="flex items-center gap-2">
                      <Globe className="h-4 w-4 text-slate-400" />
                      <span>{profile.socials.website}</span>
                    </div>
                  )}
                  {profile.socials?.instagram && (
                    <div className="flex items-center gap-2">
                      <Instagram className="h-4 w-4 text-slate-400" />
                      <span>{profile.socials.instagram}</span>
                    </div>
                  )}
                  {profile.socials?.facebook && (
                    <div className="flex items-center gap-2">
                      <Facebook className="h-4 w-4 text-slate-400" />
                      <span>{profile.socials.facebook}</span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="space-y-6 lg:col-span-2">
            <div className="rounded-xl bg-white p-6 shadow-sm">
              <h2 className="text-lg font-semibold text-slate-800">Announcements</h2>

              {postsLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Spinner />
                </div>
              ) : posts.length === 0 ? (
                <div className="py-12 text-center text-sm text-slate-500">
                  <ImageIcon className="mx-auto mb-3 h-8 w-8 text-slate-400" />
                  No posts yet.
                </div>
              ) : (
                <div className="mt-4 space-y-4">
                  {posts.map((post) => (
                    <div key={post.id} className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                      {post.image && (
                        <div className="mb-3 h-48 overflow-hidden rounded-lg bg-slate-200">
                          <img
                            src={post.image}
                            alt={post.title}
                            className="h-full w-full object-cover"
                            onError={(e) => {
                              e.currentTarget.src = 'https://placehold.co/800x450/e2e8f0/e2e8f0?text=Image+Error';
                            }}
                          />
                        </div>
                      )}

                      <h3 className="text-base font-semibold text-slate-800">{post.title}</h3>
                      <p className="mt-1 text-sm text-slate-600">{post.body}</p>

                      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-500">
                        <div className="flex items-center gap-2">
                          <Calendar className="h-3.5 w-3.5" />
                          <span>{new Date(post.created_at).toLocaleDateString()}</span>
                        </div>

                        <div className="flex items-center gap-4">
                          <div className="flex items-center gap-1">
                            <Heart className="h-4 w-4" />
                            <span>{post.likes_post || 0}</span>
                          </div>

                          <button
                            type="button"
                            onClick={() => toggleComments(post.id)}
                            className="flex items-center gap-1 text-slate-500 hover:text-slate-700"
                          >
                            <MessageCircle className="h-4 w-4" />
                            <span>{commentCounts[post.id] || 0}</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => handleShare(post.id, post.title)}
                            className="flex items-center gap-1 text-slate-500 hover:text-slate-700"
                          >
                            <Share2 className="h-4 w-4" />
                            <span>Share</span>
                          </button>

                          {currentUser?.id === profile.user_id && (
                            <button
                              type="button"
                              onClick={() => handleDeletePost(post.id)}
                              disabled={deletingPost === post.id}
                              className="flex items-center gap-1 text-red-600 hover:text-red-700 disabled:opacity-50"
                            >
                              <Trash2 className="h-4 w-4" />
                              <span>Delete</span>
                            </button>
                          )}
                        </div>
                      </div>

                      {expandedPosts.has(post.id) && (
                        <div className="mt-4 border-t border-slate-200 pt-4">
                          {currentUser ? (
                            <div className="mb-4 flex items-center gap-2">
                              <input
                                type="text"
                                value={commentInput[post.id] || ''}
                                onChange={(e) =>
                                  setCommentInput((prev) => ({ ...prev, [post.id]: e.target.value }))
                                }
                                placeholder="Write a comment..."
                                className="flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                              />
                              <button
                                type="button"
                                onClick={() => handleAddComment(post.id)}
                                disabled={postingComment[post.id] || !commentInput[post.id]?.trim()}
                                className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-indigo-700 disabled:opacity-60"
                              >
                                {postingComment[post.id] ? 'Posting...' : 'Post'}
                              </button>
                            </div>
                          ) : (
                            <div className="mb-4 text-xs text-slate-500">Log in to comment.</div>
                          )}

                          {commentsLoading[post.id] ? (
                            <div className="text-xs text-slate-500">Loading comments...</div>
                          ) : (commentsByPost[post.id] || []).length === 0 ? (
                            <div className="text-xs text-slate-500">No comments yet.</div>
                          ) : (
                            <div className="space-y-3">
                              {(commentsByPost[post.id] || []).map((comment) => {
                                const href = comment.username
                                  ? getHandleHref(comment.username, comment.author_type)
                                  : null;

                                return (
                                  <div key={comment.id} className="rounded-md bg-white p-3 text-sm text-slate-700">
                                    <div className="flex items-center justify-between text-xs text-slate-500">
                                      {comment.username && href ? (
                                        <Link href={href} className="text-indigo-600 hover:underline">
                                          @{comment.username}
                                        </Link>
                                      ) : (
                                        <span>{comment.author}</span>
                                      )}

                                      <span>{new Date(comment.created_at).toLocaleDateString()}</span>
                                    </div>

                                    <p className="mt-1">{comment.body ?? comment.text}</p>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
