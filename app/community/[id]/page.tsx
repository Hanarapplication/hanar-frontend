'use client';

import { useEffect, useState, useRef } from 'react';
import { useParams } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const currentUser = {
  username: 'mehdiToronto',
  hasBusiness: true,
  defaultBusinessName: 'Bolani House',
};

const identityColors: Record<string, string> = {
  user: 'bg-blue-100 text-blue-800',
  business: 'bg-green-100 text-green-800',
  anonymous: 'bg-gray-200 text-gray-700',
};

export default function CommunityPostPage() {
  const { id } = useParams();
  const [post, setPost] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [newReply, setNewReply] = useState('');
  const [replies, setReplies] = useState<any[]>([]);
  const [likes, setLikes] = useState(0);
  const [replyTo, setReplyTo] = useState<number | null>(null);
  const [identity, setIdentity] = useState('user');
  const bottomRef = useRef(null);

  useEffect(() => {
    const fetchPost = async () => {
      if (!id) return;

      const { data, error } = await supabase
        .from('community_posts')
        .select('*')
        .eq('id', id)
        .single();
        setPost(data);
        setPost(data);
console.log("✅ FULL POST WITH REPLIES:", data);
console.log("🧵 Incoming Replies:", data.replies);
setReplies(data.replies || []);

if (data.replies?.length) {
  console.log("🔍 First Reply Object:", data.replies[0]);
}


        if (error) {
          console.error('Error fetching post:', error);
        } else {
          setPost(data);
          console.log("📦 Supabase post data:", data);
          setReplies(data.replies || []);
          setLikes(data.likes || 0);
        }
        
      setLoading(false);
    };

    fetchPost();
  }, [id]);

  const handleReplySubmit = () => {
    if (!newReply.trim()) return;
    const author = identity === 'anonymous'
      ? 'Anonymous'
      : identity === 'business'
      ? currentUser.defaultBusinessName
      : currentUser.username;

    const newEntry = {
      id: Date.now(),
      author,
      text: newReply,
      created_at: new Date().toISOString(),
      parentId: replyTo,
      identity,
      likes: 0,
      dislikes: 0,
    };

    setReplies(prev => [newEntry, ...prev]);
    setNewReply('');
    setReplyTo(null);
  };

  const renderReplies = (parentId: number | null = null) => {
    return replies
      .filter(reply => reply.parentId === parentId)
      .map(reply => (
        <div key={reply.id} className="mt-4 ml-4 border-l-2 pl-4 border-gray-200">
          <div className="bg-white border border-gray-200 p-3 rounded-xl shadow-sm space-y-2">
            <div className="flex items-center gap-2 text-sm">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-semibold ${identity === 'anonymous' ? 'bg-gray-400' : 'bg-gradient-to-tr from-blue-400 to-purple-400'}`}>
                {reply.author.substring(0, 1).toUpperCase()}
              </div>
              <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${identityColors[reply.identity]}`}>
                {reply.identity}
              </span>
              <span className="text-gray-600 font-medium">@{reply.author}</span>
              <span className="text-gray-400 text-xs">• {new Date(reply.created_at).toLocaleDateString()}</span>
            </div>
            <p className="text-gray-700 text-sm">{reply.text}</p>
            <div className="flex gap-3 text-xs text-gray-600 mt-1 items-center">
              <button
                onClick={() => setReplyTo(reply.id)}
                className="text-blue-500 hover:underline"
              >
                ↪ Reply
              </button>
            </div>
          </div>
          {renderReplies(reply.id)}
        </div>
      ));
  };

  if (loading) return <div className="p-6 text-center">Loading...</div>;
  if (!post) return <div className="p-6 text-center text-red-500">Post not found.</div>;

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-6 bg-white rounded-xl shadow">
      <div className="space-y-1">
        <h1 className="text-2xl font-bold text-gray-900">{post.title}</h1>
        <p className="text-sm text-gray-500">@{post.author} • {new Date(post.created_at).toLocaleDateString()}</p>
      </div>

      {post.image && (
        <img
          src={post.image}
          alt={post.title}
          className="rounded-lg w-full object-cover aspect-video border"
        />
      )}

      <p className="whitespace-pre-wrap text-gray-800 text-md">{post.body}</p>

      <div className="flex justify-between items-center text-sm text-gray-600 border-t pt-4">
        <button
          onClick={() => setLikes(prev => prev + 1)}
          className="flex items-center gap-2 hover:text-blue-600"
        >
          👍 Like <span>{likes}</span>
        </button>
        <button
          onClick={() => alert('Favoriting coming soon!')}
          className="text-pink-600 hover:underline"
        >
          ❤️ Favorite
        </button>
      </div>

      <div className="flex flex-wrap gap-2">
        {post.tags?.map((tag: string, idx: number) => (
          <span
            key={idx}
            className="bg-blue-100 text-blue-800 px-2 py-1 rounded-full text-xs"
          >
            #{tag}
          </span>
        ))}
      </div>

      <div className="pt-4 border-t space-y-2">
        <h3 className="font-semibold text-gray-800">Leave a Reply</h3>
        {replyTo !== null && (
          <div className="text-xs text-blue-600 italic">
            Replying to @{replies.find(r => r.id === replyTo)?.author} —
            <button onClick={() => setReplyTo(null)} className="ml-2 text-red-500 underline">Cancel</button>
          </div>
        )}

        <select
          value={identity}
          onChange={(e) => setIdentity(e.target.value)}
          className="border p-1 rounded text-sm"
        >
          <option value="user">@{currentUser.username} (User)</option>
          {currentUser.hasBusiness && (
            <option value="business">@{currentUser.defaultBusinessName} (Business)</option>
          )}
          <option value="anonymous">Anonymous</option>
        </select>

        <textarea
          value={newReply}
          onChange={(e) => setNewReply(e.target.value)}
          className="w-full border p-2 rounded text-sm mt-1"
          rows={3}
          placeholder="Write your reply here..."
        />
        <button
          onClick={handleReplySubmit}
          className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
        >
          Post Reply
        </button>
      </div>

      {replies.length > 0 && (
        <div className="mt-6 border-t pt-4">
          <h3 className="font-semibold text-gray-700 mb-3">Replies</h3>
          {renderReplies()}
        </div>
      )}
    </div>
  );
}
