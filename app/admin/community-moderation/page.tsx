'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import { format } from 'date-fns';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function AdminCommunityModerationPage() {
  const [posts, setPosts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refresh, setRefresh] = useState(false);

  useEffect(() => {
    const fetchPosts = async () => {
      const { data, error } = await supabase
        .from('community_posts')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) console.error(error);
      else setPosts(data);

      setLoading(false);
    };

    fetchPosts();
  }, [refresh]);

  const handleDeletePost = async (id: string) => {
    if (!confirm('Are you sure you want to permanently delete this post?')) return;

    const { error } = await supabase.from('community_posts').delete().eq('id', id);
    if (error) return alert('Failed to delete post');
    setRefresh(prev => !prev);
  };

  const handleDeleteReply = async (replyId: number) => {
    if (!confirm('Are you sure you want to delete this reply?')) return;
    const { error } = await supabase.from('community_replies').delete().eq('id', replyId);
    if (error) return alert('Failed to delete reply');
    setRefresh(prev => !prev);
  };

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">🛡️ Community Moderation Panel</h1>
      {loading ? (
        <p>Loading posts...</p>
      ) : (
        posts.map(post => (
          <div key={post.id} className="bg-white rounded shadow p-4 mb-6">
            <div className="flex justify-between">
              <div>
                <h2 className="text-lg font-semibold">{post.title}</h2>
                <p className="text-sm text-gray-600">@{post.author} — {format(new Date(post.created_at), 'PPpp')}</p>
              </div>
              <button
                onClick={() => handleDeletePost(post.id)}
                className="text-red-600 hover:underline"
              >
                Delete Post
              </button>
            </div>
            <p className="text-sm mt-2 text-gray-800 whitespace-pre-wrap">{post.body}</p>

            {post.replies?.length > 0 && (
              <div className="mt-4 pl-4 border-l">
                <h3 className="text-sm font-medium text-gray-700">Replies:</h3>
                {post.replies.map((reply: any) => (
                  <div key={reply.id} className="text-sm text-gray-700 mt-2">
                    <div className="flex justify-between">
                      <span>@{reply.author}: {reply.text}</span>
                      <button
                        onClick={() => handleDeleteReply(reply.id)}
                        className="text-xs text-red-500 hover:underline"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))
      )}
    </div>
  );
}
