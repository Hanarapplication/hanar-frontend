import ReportButton from '@/components/ReportButton';
import { cn } from '@/lib/utils';
import { ThumbsUp } from 'lucide-react';

type Props = {
  liked: boolean;
  likesCount: number;
  commentCount: number;
  onLike?: () => void;
  onComment?: () => void;
  onShare?: () => void;
  canLike?: boolean;
  postId?: string;
  postTitle?: string;
  /** Extra classes on the action row (e.g. mt-auto to pin to card bottom). */
  className?: string;
  /** High-contrast pills for dark overlays (e.g. fullscreen video dock). */
  tone?: 'default' | 'darkVideo';
};

export default function PostActionsBar({
  liked,
  likesCount,
  commentCount,
  onLike,
  onComment,
  onShare,
  canLike = true,
  postId,
  postTitle,
  className = '',
  tone = 'default',
}: Props) {
  const onDark = tone === 'darkVideo';

  const likeClasses = onDark
    ? liked
      ? 'border border-sky-200/80 bg-sky-500 text-white shadow-sm hover:bg-sky-400'
      : 'border border-white/55 bg-white/20 text-white shadow-sm hover:bg-white/30'
    : liked
      ? 'bg-blue-200 text-blue-900 dark:bg-blue-900/55 dark:text-blue-200'
      : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-gray-600 dark:text-gray-200 dark:hover:bg-gray-500';

  const commentShareClasses = onDark
    ? 'border border-white/55 bg-white/20 text-white shadow-sm hover:bg-white/30'
    : 'bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-gray-600 dark:text-gray-100 dark:hover:bg-gray-500';

  const reportPillClass = onDark
    ? '!border-white/55 !bg-white/20 !text-white shadow-sm hover:!bg-rose-500/35 hover:!text-white'
    : '';

  return (
    <div className={cn('mt-2 flex flex-wrap items-center gap-2 text-base', className)}>
      <button
        type="button"
        onClick={onLike}
        disabled={!canLike || !onLike}
        aria-label={liked ? 'Unlike' : 'Like'}
        aria-pressed={liked}
        className={cn(
          'inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-sm font-semibold transition touch-manipulation',
          likeClasses,
          !canLike || !onLike ? 'cursor-not-allowed opacity-60' : ''
        )}
      >
        <ThumbsUp className="pointer-events-none h-3.5 w-3.5 shrink-0" strokeWidth={2} aria-hidden />
        <span className={cn('pointer-events-none tabular-nums font-semibold', onDark && 'text-white')}>{likesCount}</span>
      </button>
      <button
        type="button"
        onClick={onComment}
        disabled={!onComment}
        aria-label="Comments"
        className={cn(
          'inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-semibold transition touch-manipulation',
          commentShareClasses,
          !onComment ? 'cursor-not-allowed opacity-60' : ''
        )}
      >
        <span aria-hidden className="pointer-events-none text-base">
          💬
        </span>
        <span className={cn('pointer-events-none tabular-nums font-semibold', onDark && 'text-white')}>{commentCount}</span>
      </button>
      <button
        type="button"
        onClick={onShare}
        disabled={!onShare}
        aria-label="Share"
        className={cn(
          'inline-flex items-center justify-center rounded-full px-2.5 py-1 text-sm font-semibold transition touch-manipulation',
          commentShareClasses,
          !onShare ? 'cursor-not-allowed opacity-60' : ''
        )}
      >
        <span aria-hidden className="pointer-events-none">
          🔗
        </span>
      </button>
      {postId && (
        <ReportButton
          entityType="post"
          entityId={postId}
          entityTitle={postTitle}
          variant="pill"
          className={reportPillClass || undefined}
        />
      )}
    </div>
  );
}
