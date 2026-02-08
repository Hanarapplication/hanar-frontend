'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';
import { toast } from 'react-hot-toast';
import Link from 'next/link';
import PostActionsBar from '@/components/PostActionsBar';

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
      setLikes(post.likes_post || 0);
    
      const commentsQuery = supabase
      .from('community_comments')
      .select(`
        *,
        profiles (
          profile_pic_url
        )
      `)
      .eq('post_id', id);
    
    if (sortMode === 'popular') {
      commentsQuery.order('likes_comment', { ascending: false });
    } else {
      commentsQuery.order('created_at', { ascending: false });
    }
    
    // ✅ Use the query you already built
    const { data: commentsData, error: commentError } = await commentsQuery;
    
    if (commentError) {
      toast.error('Failed to fetch comments');
    } else {
      setComments(commentsData || []);
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

    const comment = {
      post_id: id,
      user_id: userSession.user.id,
      username,
      author: username,
      identity: 'user',
      text: newComment.trim(),
      created_at: new Date().toISOString(),
      parent_id: null,
      likes_comment: 0,
    };

    const { data, error } = await supabase
  .from('community_comments')
  .insert([comment])
  .select()
  .single();

if (error) {
  toast.error('Failed to post comment');
} else {
  setNewComment('');
  setComments((prev) => [data, ...prev]); // Add new comment to top
}

  };

  const handleCommentLike = async (commentId: string) => {
    if (!userSession || !username) return toast.error('Login required');

    const { data, error } = await supabase.rpc('toggle_comment_like', {
      cid: commentId,
      uid: userSession.user.id,
    });

    if (error) {
      toast.error('Failed to like comment');
      return;
    }

    const [result] = data;
    setCommentLikeStates(prev => ({ ...prev, [commentId]: result.liked }));
    setComments(prev =>
      prev.map(c =>
        c.id === commentId ? { ...c, likes_comment: result.likes_comment } : c
      )
    );
  };

  const handleLike = async () => {
    if (!userSession || !username) return toast.error('Login required');

    const { data, error } = await supabase.rpc('toggle_post_like', {
      pid: id,
      uid: userSession.user.id,
    });

    if (error) {
      toast.error(`Failed to update like: ${error.message}`);
      return;
    }

    const [result] = data;
    setLikedByUser(result.liked);
    setLikes(result.likes_post);
    toast.success(result.liked ? 'Liked' : 'Unliked');
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

          {post.image && (
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
              <button
                onClick={confirmDeletePost}
                className="rounded-full bg-red-600 px-3 py-1 text-xs font-semibold text-white shadow-sm transition hover:bg-red-700"
              >
                🗑️ Delete
              </button>
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
                      {commentLikeStates[c.id] ? '💙 Liked' : '👍 Like'} ({c.likes_comment || 0})
                    </button>
                  )}
                  {userSession?.user?.id === c.user_id && (
                    <button onClick={() => handleDeleteComment(c.id)} className="text-xs text-red-500 hover:underline ml-2">
                      Delete
                    </button>
                  )}
                </div>
                <p className="mt-2 text-sm text-slate-700">{c.text}</p>
              </div>
            ))}
          </div>
        </div>
      

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
