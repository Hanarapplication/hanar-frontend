'use client';

import { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { supabase } from '@/lib/supabaseClient';
import {
  Calendar,
  Heart,
  MessageCircle,
  Share2,
  Trash2,
} from 'lucide-react';
import ReportButton from '@/components/ReportButton';

export type BusinessCommunityPostRow = {
  id: string;
  title: string;
  body: string;
  image?: string | null;
  video?: string | null;
  created_at: string;
  likes_post?: number | null;
  user_id: string;
};

type CommentRow = {
  id: string;
  post_id: string;
  user_id: string;
  username: string;
  author: string;
  text?: string;
  body?: string;
  created_at: string;
  author_type?: string;
};

function commentAuthorHref(username: string, authorType?: string) {
  const t = (authorType || '').toLowerCase();
  if (t === 'organization') return `/organization/${username}`;
  if (t === 'business') return `/business/${username}`;
  return `/profile/${username}`;
}

type Props = {
  open: boolean;
  onClose: () => void;
  businessSlug: string;
  businessName: string;
  businessOwnerId: string | null;
  posts: BusinessCommunityPostRow[];
  commentCounts: Record<string, number>;
  onPostsChange: (posts: BusinessCommunityPostRow[]) => void;
  onCommentCountsChange: (counts: Record<string, number>) => void;
};

export default function BusinessCommunityPostsModal({
  open,
  onClose,
  businessSlug,
  businessName,
  businessOwnerId,
  posts,
  commentCounts,
  onPostsChange,
  onCommentCountsChange,
}: Props) {
  const router = useRouter();
  const [expandedPosts, setExpandedPosts] = useState<Set<string>>(new Set());
  const [commentsByPost, setCommentsByPost] = useState<Record<string, CommentRow[]>>({});
  const [commentsLoading, setCommentsLoading] = useState<Record<string, boolean>>({});
  const [commentInput, setCommentInput] = useState<Record<string, string>>({});
  const [postingComment, setPostingComment] = useState<Record<string, boolean>>({});
  const [currentUser, setCurrentUser] = useState<{
    id: string;
    username: string | null;
  } | null>(null);
  const [deletingPost, setDeletingPost] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    const loadUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (cancelled) return;
      if (!user) {
        setCurrentUser(null);
        return;
      }
      setCurrentUser({ id: user.id, username: null });
      const { data: profileData } = await supabase
        .from('registeredaccounts')
        .select('username')
        .eq('user_id', user.id)
        .maybeSingle();
      if (!cancelled) {
        setCurrentUser({ id: user.id, username: profileData?.username ?? null });
      }
    };
    loadUser();
    return () => {
      cancelled = true;
    };
  }, [open]);

  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = 'unset';
      };
    }
    setExpandedPosts(new Set());
    setCommentsByPost({});
    setCommentInput({});
    setCommentsLoading({});
  }, [open]);

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
      const params = new URLSearchParams({ postId });
      if (currentUser?.id) params.set('userId', currentUser.id);
      const res = await fetch(`/api/community/comments?${params.toString()}`);
      const result = await res.json();
      if (res.ok) {
        setCommentsByPost((prev) => ({ ...prev, [postId]: result.comments || [] }));
      }
    } finally {
      setCommentsLoading((prev) => ({ ...prev, [postId]: false }));
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
        onCommentCountsChange({
          ...commentCounts,
          [postId]: (commentCounts[postId] || 0) + 1,
        });
        setCommentInput((prev) => ({ ...prev, [postId]: '' }));
      }
    } finally {
      setPostingComment((prev) => ({ ...prev, [postId]: false }));
    }
  };

  const handleDeletePost = async (postId: string) => {
    if (!businessOwnerId || currentUser?.id !== businessOwnerId) return;
    if (!confirm('Delete this post? This cannot be undone.')) return;
    setDeletingPost(postId);
    try {
      const res = await fetch('/api/community/post/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ post_id: postId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(typeof data?.error === 'string' ? data.error : 'Failed to delete post');
      }
      toast.success('Announcement removed');
      onPostsChange(posts.filter((p) => p.id !== postId));
      onCommentCountsChange(
        Object.fromEntries(Object.entries(commentCounts).filter(([k]) => k !== postId))
      );
    } catch (err) {
      console.error(err);
      alert(err instanceof Error ? err.message : 'Failed to delete post');
    } finally {
      setDeletingPost(null);
    }
  };

  const handleSharePost = useCallback(async (postId: string, title: string) => {
    const url = `${typeof window !== 'undefined' ? window.location.origin : ''}/community/post/${postId}`;
    try {
      if (navigator.share) {
        await navigator.share({ title, url });
      } else if (navigator.clipboard) {
        await navigator.clipboard.writeText(url);
      }
    } catch (e) {
      console.error(e);
    }
  }, []);

  if (!open || typeof document === 'undefined') return null;

  const content = (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={`Community posts from ${businessName}`}
    >
      <div
        className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl dark:border-slate-700 dark:bg-gray-900"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-white/20 bg-gradient-to-r from-blue-700 via-blue-800 to-emerald-600 px-4 py-3 dark:from-blue-950 dark:via-blue-900 dark:to-emerald-700">
          <div>
            <h2 className="text-lg font-semibold text-white">Community updates</h2>
            <p className="text-xs text-blue-100/90" data-no-translate>
              {businessName} · @{businessSlug}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-white/90 transition hover:bg-white/15 hover:text-white"
            aria-label="Close"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
          {posts.length === 0 ? (
            <p className="py-8 text-center text-sm text-slate-500">No community posts yet.</p>
          ) : (
            <div className="space-y-4">
              {posts.map((post) => (
                <div
                  key={post.id}
                  className="rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-slate-600 dark:bg-slate-800/50"
                >
                  {post.image && (
                    <div className="mb-3 h-44 overflow-hidden rounded-lg bg-slate-200 dark:bg-slate-700 sm:h-48">
                      <img
                        src={post.image}
                        alt=""
                        className="h-full w-full object-cover"
                        onError={(e) => {
                          e.currentTarget.src = 'https://placehold.co/800x450/e2e8f0/e2e8f0?text=Image';
                        }}
                      />
                    </div>
                  )}

                  <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">{post.title}</h3>
                  <p className="mt-1 whitespace-pre-wrap text-sm text-slate-600 dark:text-slate-300">{post.body}</p>

                  <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-500 dark:text-slate-400">
                    <div className="flex items-center gap-2">
                      <Calendar className="h-3.5 w-3.5 shrink-0" />
                      <span>{new Date(post.created_at).toLocaleDateString()}</span>
                    </div>

                    <div className="flex flex-wrap items-center gap-3">
                      <div className="flex items-center gap-1">
                        <Heart className="h-4 w-4" />
                        <span>{post.likes_post ?? 0}</span>
                      </div>

                      <button
                        type="button"
                        onClick={() => toggleComments(post.id)}
                        className="flex items-center gap-1 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                      >
                        <MessageCircle className="h-4 w-4" />
                        <span>{commentCounts[post.id] ?? 0}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleSharePost(post.id, post.title)}
                        className="flex items-center gap-1 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                      >
                        <Share2 className="h-4 w-4" />
                        Share
                      </button>

                      <Link
                        href={`/community/post/${post.id}`}
                        className="text-indigo-600 hover:underline dark:text-indigo-400"
                        onClick={onClose}
                      >
                        Open
                      </Link>

                      {currentUser?.id === businessOwnerId && (
                        <button
                          type="button"
                          onClick={() => handleDeletePost(post.id)}
                          disabled={deletingPost === post.id}
                          className="flex items-center gap-1 text-red-600 hover:text-red-700 disabled:opacity-50"
                        >
                          <Trash2 className="h-4 w-4" />
                          Delete
                        </button>
                      )}
                      <ReportButton
                        entityType="post"
                        entityId={post.id}
                        entityTitle={post.title}
                        variant="icon"
                      />
                    </div>
                  </div>

                  {expandedPosts.has(post.id) && (
                    <div className="mt-4 border-t border-slate-200 pt-4 dark:border-slate-600">
                      {currentUser ? (
                        <div className="mb-4 flex items-center gap-2">
                          <input
                            type="text"
                            value={commentInput[post.id] || ''}
                            onChange={(e) =>
                              setCommentInput((prev) => ({ ...prev, [post.id]: e.target.value }))
                            }
                            placeholder="Write a comment..."
                            className="flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
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
                        <div className="mb-4 text-xs text-slate-500">
                          <button
                            type="button"
                            className="font-medium text-indigo-600 hover:underline dark:text-indigo-400"
                            onClick={() => {
                              onClose();
                              router.push('/login');
                            }}
                          >
                            Log in
                          </button>{' '}
                          to comment.
                        </div>
                      )}

                      {commentsLoading[post.id] ? (
                        <div className="text-xs text-slate-500">Loading comments...</div>
                      ) : (commentsByPost[post.id] || []).length === 0 ? (
                        <div className="text-xs text-slate-500">No comments yet.</div>
                      ) : (
                        <div className="space-y-3">
                          {(commentsByPost[post.id] || []).map((comment) => {
                            const href = comment.username
                              ? commentAuthorHref(comment.username, comment.author_type)
                              : null;

                            return (
                              <div key={comment.id} className="rounded-md bg-white p-3 text-sm text-slate-700 dark:bg-slate-900 dark:text-slate-200">
                                <div className="flex items-center justify-between text-xs text-slate-500">
                                  {comment.username && href ? (
                                    <Link href={href} className="text-indigo-700 hover:underline dark:text-indigo-300">
                                      {comment.author || comment.username || 'User'}
                                    </Link>
                                  ) : (
                                    <span>{comment.author || comment.username || 'User'}</span>
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
  );

  return createPortal(content, document.body);
}
