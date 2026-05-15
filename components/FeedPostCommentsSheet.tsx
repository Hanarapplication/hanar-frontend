'use client';

import { useCallback, useEffect, useMemo, useReducer, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  getFeedVideoFullscreenPortalTarget,
  subscribeFeedVideoFullscreenPortalTarget,
} from '@/lib/feedVideoFullscreenPortal';
import { ThumbsUp, SendHorizontal, X, Trash2 } from 'lucide-react';
import { Avatar } from '@/components/Avatar';
import { t } from '@/utils/translations';
import { cn } from '@/lib/utils';

export type FeedSheetComment = {
  id: string;
  post_id: string;
  user_id: string;
  username: string | null;
  author: string | null;
  author_type?: string | null;
  text?: string;
  body?: string;
  created_at: string;
  likes?: number;
  likes_comment?: number;
  user_liked?: boolean;
  logo_url?: string | null;
  avatar_url?: string | null;
  profiles?: { profile_pic_url: string | null } | null;
  parent_id?: string | null;
};

export function groupCommentsByRoot(comments: FeedSheetComment[]): {
  root: FeedSheetComment;
  replies: { comment: FeedSheetComment; depth: number }[];
}[] {
  const byParent = new Map<string | null, FeedSheetComment[]>();
  for (const c of comments) {
    const p = c.parent_id ?? null;
    if (!byParent.has(p)) byParent.set(p, []);
    byParent.get(p)!.push(c);
  }

  function walk(parentId: string, depth: number): { comment: FeedSheetComment; depth: number }[] {
    const kids = (byParent.get(parentId) || []).sort(
      (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );
    const out: { comment: FeedSheetComment; depth: number }[] = [];
    for (const k of kids) {
      out.push({ comment: k, depth });
      out.push(...walk(k.id, depth + 1));
    }
    return out;
  }

  const roots = (byParent.get(null) || []).sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );

  return roots.map((root) => ({
    root,
    replies: walk(root.id, 1),
  }));
}

type Props = {
  open: boolean;
  postId: string | null;
  onClose: () => void;
  comments: FeedSheetComment[];
  loading: boolean;
  currentUserId: string;
  commentInput: string;
  onCommentInputChange: (value: string) => void;
  onSubmitComment: () => void;
  onCommentLike: (commentId: string) => void;
  onSubmitReply: (parentCommentId: string, text: string) => Promise<void>;
  /** When set, authors see a delete control on their own comments. */
  onDeleteComment?: (commentId: string) => void;
  effectiveLang: string;
};

export default function FeedPostCommentsSheet({
  open,
  postId,
  onClose,
  comments,
  loading,
  currentUserId,
  commentInput,
  onCommentInputChange,
  onSubmitComment,
  onCommentLike,
  onSubmitReply,
  onDeleteComment,
  effectiveLang,
}: Props) {
  const [, bumpPortalTarget] = useReducer((n: number) => n + 1, 0);

  useEffect(() => {
    if (!open) return;
    return subscribeFeedVideoFullscreenPortalTarget(bumpPortalTarget);
  }, [open]);

  const [replyParentId, setReplyParentId] = useState<string | null>(null);
  const [replyDraft, setReplyDraft] = useState('');
  const [replySending, setReplySending] = useState(false);

  useEffect(() => {
    if (!open) {
      setReplyParentId(null);
      setReplyDraft('');
    }
  }, [open, postId]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const grouped = useMemo(() => groupCommentsByRoot(comments), [comments]);

  const replyingToLabel = useMemo(() => {
    if (!replyParentId) return null;
    for (const { root, replies } of grouped) {
      if (root.id === replyParentId) return root.author || root.username || 'User';
      const hit = replies.find((r) => r.comment.id === replyParentId);
      if (hit) return hit.comment.author || hit.comment.username || 'User';
    }
    const flat = comments.find((c) => c.id === replyParentId);
    return flat ? flat.author || flat.username || 'User' : null;
  }, [grouped, replyParentId, comments]);

  const submitReply = useCallback(async () => {
    if (!postId || !replyParentId || !replyDraft.trim() || replySending) return;
    setReplySending(true);
    try {
      await onSubmitReply(replyParentId, replyDraft);
      setReplyDraft('');
      setReplyParentId(null);
    } finally {
      setReplySending(false);
    }
  }, [postId, replyParentId, replyDraft, replySending, onSubmitReply]);

  if (typeof document === 'undefined') return null;
  if (!open || !postId) return null;

  const portalTarget = getFeedVideoFullscreenPortalTarget() ?? document.body;

  const body = (
    <div className="fixed inset-0 z-[300] flex flex-col justify-end" role="dialog" aria-modal="true" aria-labelledby="feed-comments-sheet-title">
      <button
        type="button"
        className="absolute inset-0 bg-black/55 backdrop-blur-[1px]"
        aria-label={t(effectiveLang, 'Close')}
        onClick={onClose}
      />
      <div
        className={cn(
          'relative flex h-[min(50dvh,50vh)] w-full max-h-[560px] min-h-[260px] flex-col rounded-t-2xl border border-slate-200 bg-white shadow-2xl dark:border-gray-600 dark:bg-gray-800',
          'pb-[max(0.5rem,env(safe-area-inset-bottom,0px))]'
        )}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-center justify-between border-b border-slate-100 px-4 py-3 dark:border-gray-700">
          <h2 id="feed-comments-sheet-title" className="text-lg font-semibold text-slate-900 dark:text-gray-100">
            {t(effectiveLang, 'Comments')}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-800 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-gray-100"
            aria-label={t(effectiveLang, 'Close')}
          >
            <X className="h-5 w-5" strokeWidth={2} />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-2 [-webkit-overflow-scrolling:touch]">
          {loading ? (
            <p className="py-6 text-center text-sm text-slate-500 dark:text-gray-400">{t(effectiveLang, 'Loading comments...')}</p>
          ) : grouped.length === 0 ? (
            <p className="py-6 text-center text-sm text-slate-500 dark:text-gray-400">{t(effectiveLang, 'Be the first to comment.')}</p>
          ) : (
            <ul className="space-y-4 pb-2">
              {grouped.map(({ root, replies }) => (
                <li key={root.id} className="rounded-lg border border-slate-100 bg-slate-50/90 p-3 dark:border-gray-600 dark:bg-gray-700/50">
                  <CommentRow
                    comment={root}
                    currentUserId={currentUserId}
                    effectiveLang={effectiveLang}
                    onLike={() => onCommentLike(root.id)}
                    onDelete={
                      onDeleteComment && currentUserId && root.user_id === currentUserId
                        ? () => onDeleteComment(root.id)
                        : undefined
                    }
                    onReply={() => {
                      setReplyParentId(root.id);
                      setReplyDraft('');
                    }}
                    showReplyButton={!!currentUserId}
                  />
                  {replies.length > 0 && (
                    <ul className="mt-3 space-y-2 border-l-2 border-sky-200/80 pl-3 dark:border-sky-500/40">
                      {replies.map(({ comment: reply, depth }) => (
                        <li
                          key={reply.id}
                          style={{ marginLeft: Math.max(0, depth - 1) * 12 }}
                          className="border-l border-sky-200/60 pl-2 dark:border-sky-500/30"
                        >
                          <CommentRow
                            comment={reply}
                            currentUserId={currentUserId}
                            effectiveLang={effectiveLang}
                            onLike={() => onCommentLike(reply.id)}
                            onDelete={
                              onDeleteComment && currentUserId && reply.user_id === currentUserId
                                ? () => onDeleteComment(reply.id)
                                : undefined
                            }
                            onReply={() => {
                              setReplyParentId(reply.id);
                              setReplyDraft('');
                            }}
                            showReplyButton={!!currentUserId}
                            compact
                          />
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>

        {replyParentId ? (
          <div className="shrink-0 border-t border-slate-100 bg-slate-50/90 px-3 py-2 dark:border-gray-700 dark:bg-gray-900/40">
            {replyingToLabel ? (
              <p className="mb-1.5 text-xs font-medium text-slate-600 dark:text-gray-400">
                {t(effectiveLang, 'Replying to')} <span className="text-slate-900 dark:text-gray-100">{replyingToLabel}</span>
              </p>
            ) : null}
            <ReplyComposer
              effectiveLang={effectiveLang}
              draft={replyDraft}
              onDraftChange={setReplyDraft}
              onSubmit={submitReply}
              sending={replySending}
              onCancel={() => {
                setReplyParentId(null);
                setReplyDraft('');
              }}
            />
          </div>
        ) : null}

        <div className="shrink-0 border-t border-slate-100 px-3 py-2 dark:border-gray-700">
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={commentInput}
              onChange={(e) => onCommentInputChange(e.target.value)}
              placeholder={
                currentUserId ? t(effectiveLang, 'Write a comment...') : t(effectiveLang, 'Log in to write a comment')
              }
              disabled={!currentUserId}
              className="min-w-0 flex-1 rounded-full border border-sky-300 px-4 py-2.5 text-base focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-200/90 disabled:cursor-not-allowed disabled:opacity-60 dark:border-sky-400 dark:bg-gray-700 dark:text-gray-100 dark:focus:border-sky-300 dark:focus:ring-sky-400/45 dark:placeholder-gray-400"
            />
            <button
              type="button"
              onClick={onSubmitComment}
              disabled={!currentUserId || !commentInput.trim()}
              aria-label={t(effectiveLang, 'Post comment')}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-sky-500 text-white shadow-sm transition hover:bg-sky-600 disabled:cursor-not-allowed disabled:bg-sky-200 disabled:text-sky-100/90 dark:bg-sky-600 dark:hover:bg-sky-500 dark:disabled:bg-slate-600 dark:disabled:text-slate-400"
            >
              <SendHorizontal className="h-4 w-4" strokeWidth={2.25} aria-hidden />
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  return createPortal(body, portalTarget);
}

function CommentRow({
  comment,
  currentUserId,
  effectiveLang,
  onLike,
  onDelete,
  onReply,
  showReplyButton,
  compact,
}: {
  comment: FeedSheetComment;
  currentUserId: string;
  effectiveLang: string;
  onLike: () => void;
  onDelete?: () => void;
  onReply: () => void;
  showReplyButton: boolean;
  compact?: boolean;
}) {
  return (
    <div className={cn('flex gap-2', compact && 'text-sm')}>
      <div className="h-8 w-8 shrink-0 overflow-hidden rounded-full">
        <Avatar src={comment.avatar_url || null} alt="" className="h-full w-full rounded-full object-cover" />
      </div>
      <div className="min-w-0 flex-1">
        <p className={cn('font-semibold text-slate-800 dark:text-gray-100', compact ? 'text-xs' : 'text-sm')}>
          {comment.author || comment.username || 'User'}
        </p>
        <p data-no-translate className={cn('leading-relaxed text-slate-600 dark:text-gray-300', compact ? 'text-sm' : 'text-base')}>
          {comment.body ?? comment.text}
        </p>
        <div className="mt-1 flex w-full items-center gap-2">
          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
            {currentUserId ? (
              <button
                type="button"
                onClick={onLike}
                aria-label={comment.user_liked ? t(effectiveLang, 'Unlike comment') : t(effectiveLang, 'Like comment')}
                aria-pressed={!!comment.user_liked}
                className={cn(
                  'inline-flex items-center gap-1 text-sm font-medium transition',
                  comment.user_liked
                    ? 'text-rose-600 dark:text-rose-400'
                    : 'text-slate-400 dark:text-gray-500 hover:text-rose-500 dark:hover:text-rose-400'
                )}
              >
                <ThumbsUp className="h-3.5 w-3.5 shrink-0" strokeWidth={2} aria-hidden />
                <span className="tabular-nums text-slate-500 dark:text-gray-400">{comment.likes ?? comment.likes_comment ?? 0}</span>
              </button>
            ) : (
              <span className="inline-flex items-center gap-1 text-sm text-slate-400 dark:text-gray-500">
                <ThumbsUp className="h-3.5 w-3.5 shrink-0 opacity-70" strokeWidth={2} aria-hidden />
                <span className="tabular-nums">{comment.likes ?? comment.likes_comment ?? 0}</span>
              </span>
            )}
            {showReplyButton && (
              <button
                type="button"
                onClick={onReply}
                className="text-sm font-semibold text-sky-600 hover:underline dark:text-sky-400"
              >
                {t(effectiveLang, 'Reply')}
              </button>
            )}
          </div>
          {onDelete ? (
            <button
              type="button"
              onClick={onDelete}
              className="inline-flex shrink-0 items-center justify-center rounded-full bg-red-100 p-2 text-red-600 transition hover:bg-red-200 dark:bg-red-950/70 dark:text-red-400 dark:hover:bg-red-900/85"
              aria-label={t(effectiveLang, 'Delete comment')}
            >
              <Trash2 className={cn('shrink-0 text-red-600 dark:text-red-400', compact ? 'h-3.5 w-3.5' : 'h-4 w-4')} strokeWidth={2.25} aria-hidden />
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function ReplyComposer({
  effectiveLang,
  draft,
  onDraftChange,
  onSubmit,
  sending,
  onCancel,
}: {
  effectiveLang: string;
  draft: string;
  onDraftChange: (v: string) => void;
  onSubmit: () => void;
  sending: boolean;
  onCancel: () => void;
}) {
  return (
    <div className="flex flex-col gap-2 rounded-lg border border-sky-200/80 bg-white p-2 dark:border-sky-500/35 dark:bg-gray-800">
      <input
        type="text"
        value={draft}
        onChange={(e) => onDraftChange(e.target.value)}
        placeholder={t(effectiveLang, 'Write a reply...')}
        className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
      />
      <div className="flex justify-end gap-2">
        <button type="button" onClick={onCancel} className="rounded-full px-3 py-1 text-sm font-medium text-slate-600 hover:bg-slate-100 dark:text-gray-300 dark:hover:bg-gray-700">
          {t(effectiveLang, 'Cancel')}
        </button>
        <button
          type="button"
          disabled={sending || draft.trim().length < 3}
          onClick={onSubmit}
          className="rounded-full bg-sky-500 px-3 py-1 text-sm font-semibold text-white hover:bg-sky-600 disabled:opacity-50"
        >
          {t(effectiveLang, 'Reply')}
        </button>
      </div>
    </div>
  );
}
