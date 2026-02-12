import ReportButton from '@/components/ReportButton';

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
}: Props) {
  return (
    <div className="mt-4 flex flex-col gap-2 text-sm sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-3 order-2 sm:order-1">
        <button
          onClick={onLike}
          disabled={!canLike || !onLike}
          className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
            liked ? 'bg-rose-100 text-rose-600 dark:bg-rose-900/50 dark:text-rose-300' : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-gray-600 dark:text-gray-200 dark:hover:bg-gray-500'
          } ${!canLike || !onLike ? 'cursor-not-allowed opacity-60' : ''}`}
        >
          👍 Like
        </button>
        <button
          onClick={onComment}
          disabled={!onComment}
          className={`rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600 transition hover:bg-slate-200 dark:bg-gray-600 dark:text-gray-200 dark:hover:bg-gray-500 ${
            !onComment ? 'cursor-not-allowed opacity-60' : ''
          }`}
        >
          💬 Comment
        </button>
        <button
          onClick={onShare}
          disabled={!onShare}
          className={`rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600 transition hover:bg-slate-200 dark:bg-gray-600 dark:text-gray-200 dark:hover:bg-gray-500 ${
            !onShare ? 'cursor-not-allowed opacity-60' : ''
          }`}
        >
          🔗 Share
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
      <div className="text-xs text-slate-500 dark:text-gray-400 order-1 sm:order-2">
        <span className="font-semibold text-slate-600 dark:text-gray-200">{likesCount}</span> likes
        <span className="mx-2 text-slate-300 dark:text-gray-500">•</span>
        <span className="font-semibold text-slate-600 dark:text-gray-200">{commentCount}</span> comments
      </div>
    </div>
  );
}
