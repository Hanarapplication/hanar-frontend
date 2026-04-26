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
}: Props) {
  return (
    <div className={cn('mt-2 flex flex-wrap items-center gap-2 text-sm', className)}>
      <button
        type="button"
        onClick={onLike}
        disabled={!canLike || !onLike}
        aria-label={liked ? 'Unlike' : 'Like'}
        aria-pressed={liked}
        className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold transition ${
          liked ? 'bg-blue-200 text-blue-900 dark:bg-blue-900/55 dark:text-blue-200' : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-gray-600 dark:text-gray-200 dark:hover:bg-gray-500'
        } ${
          !canLike || !onLike ? 'cursor-not-allowed opacity-60' : ''
        }`}
      >
        <ThumbsUp className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
        <span className="tabular-nums font-semibold">{likesCount}</span>
      </button>
      <button
        type="button"
        onClick={onComment}
        disabled={!onComment}
        aria-label="Comments"
        className={`inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-200 dark:bg-gray-600 dark:text-gray-100 dark:hover:bg-gray-500 ${
          !onComment ? 'cursor-not-allowed opacity-60' : ''
        }`}
      >
        <span aria-hidden className="text-sm">💬</span>
        <span className="tabular-nums font-semibold">{commentCount}</span>
      </button>
      <button
        type="button"
        onClick={onShare}
        disabled={!onShare}
        aria-label="Share"
        className={`inline-flex items-center justify-center rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600 transition hover:bg-slate-200 dark:bg-gray-600 dark:text-gray-200 dark:hover:bg-gray-500 ${
          !onShare ? 'cursor-not-allowed opacity-60' : ''
        }`}
      >
        <span aria-hidden>🔗</span>
      </button>
      {postId && (
        <ReportButton
          entityType="post"
          entityId={postId}
          entityTitle={postTitle}
          variant="pill"
        />
      )}
    </div>
  );
}
