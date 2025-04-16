
'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';

interface Post {
    id: any;
    title: string;
    image: string;
    body: string;
    category: string;
    tags: string[];
    username: string;
    language: string;
    date: string;
    likes: number;
    dislikes: number;
}

const getPostById = (id: any): Post => ({
    id,
    title: 'How can I find Halal groceries in Texas?',
    image: 'https://source.unsplash.com/600x400/?halal,market',
    body: 'I just moved here and I’m struggling to find a proper halal grocery store. Any suggestions?',
    category: 'Grocery',
    tags: ['halal', 'texas', 'groceries'],
    username: 'sara_texas',
    language: 'en',
    date: '2025-04-10',
    likes: 12,
    dislikes: 1,
});

const mockReplies = [
  {
    id: 1,
    user: 'AliHuston',
    text: 'Check out Al Medina Market! They’re pretty good.',
    likes: 4,
    dislikes: 0,
    date: '2025-04-10',
  },
  {
    id: 2,
    user: 'Anonymous',
    text: 'There’s one on Main St near the mosque.',
    likes: 2,
    dislikes: 0,
    date: '2025-04-10',
  },
];

export default function SinglePostPage() {
  const { postId } = useParams();
  type Post = {
    id: any;
    title: string;
    image: string;
    body: string;
    category: string;
    tags: string[];
    username: string;
    language: string;
    date: string;
    likes: number;
    dislikes: number;
  };
  
  const [post, setPost] = useState<Post | null>(null);
  const [replies, setReplies] = useState(mockReplies);
  const [newReply, setNewReply] = useState('');
  const [identity, setIdentity] = useState('user');
  const [editMode, setEditMode] = useState<number | null>(null);
  const [editedText, setEditedText] = useState('');

  useEffect(() => {
    const data = getPostById(postId);
    setPost(data);
  }, [postId]);

  const handleReplySubmit = () => {
    if (!newReply.trim()) return;
    const reply = {
      id: Date.now(),
      user: identity === 'anonymous' ? 'Anonymous' : 'You',
      text: newReply,
      likes: 0,
      dislikes: 0,
      date: new Date().toISOString().split('T')[0],
    };
    setReplies([reply, ...replies]);
    setNewReply('');
  };

const handleVote = (id: number, type: 'likes' | 'dislikes'): void => {
    const updated = replies.map((r) =>
      r.id === id ? { ...r, [type]: r[type] + 1 } : r
    );
    setReplies(updated);
  };

const handleEdit = (id: number): void => {
    const reply: Reply | undefined = replies.find((r) => r.id === id);
    if (reply) {
        setEditMode(id);
        setEditedText(reply.text);
    }
};

interface Reply {
    id: number;
    user: string;
    text: string;
    likes: number;
    dislikes: number;
    date: string;
}

const handleSaveEdit = (id: number): void => {
    if (!editedText.trim()) return;
    const updated: Reply[] = replies.map((r: Reply) =>
      r.id === id ? { ...r, text: editedText + ' (edited)' } : r
    );
    setReplies(updated);
    setEditMode(null);
    setEditedText('');
  };

const handleDelete = (id: number): void => {
    const updated: Reply[] = replies.filter((r: Reply) => r.id !== id);
    setReplies(updated);
};

  if (!post) return <div className="p-6">Loading...</div>;

  return (
    <div className="max-w-2xl mx-auto bg-white p-6 rounded-xl shadow-md space-y-4">
      <div className="flex items-center space-x-3">
        <div className="w-10 h-10 bg-gray-300 rounded-full" />
        <div className="text-sm text-gray-600">
          <span className="font-semibold">@{post.username}</span> • {post.date}
        </div>
      </div>
      <h1 className="text-xl font-bold text-gray-800">{post.title}</h1>
      {post.image && <img src={post.image} alt="Post" className="rounded-md border" />}
      <p className="text-gray-700">{post.body}</p>
      <div className="flex gap-4 text-sm text-gray-600">
        <button onClick={() => alert('Liked!')} className="hover:text-blue-600">👍 {post.likes}</button>
        <button onClick={() => alert('Disliked!')} className="hover:text-red-600">👎 {post.dislikes}</button>
      </div>

      <hr />

      <div>
        <textarea
          className="w-full p-3 border border-gray-300 rounded-md mb-2"
          placeholder="Write a reply..."
          value={newReply}
          onChange={(e) => setNewReply(e.target.value)}
        />
        <div className="flex justify-between items-center text-sm">
          <select
            value={identity}
            onChange={(e) => setIdentity(e.target.value)}
            className="border p-1 rounded-md"
          >
            <option value="user">Your Username</option>
            <option value="business">Your Business</option>
            <option value="anonymous">Anonymous</option>
          </select>
          <button
            onClick={handleReplySubmit}
            className="bg-blue-600 text-white px-4 py-1 rounded hover:bg-blue-700"
          >
            Reply
          </button>
        </div>
      </div>

      {replies.map((reply) => (
        <div key={reply.id} className="bg-gray-50 p-3 rounded-md shadow-sm border text-sm space-y-2">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 bg-gray-300 rounded-full" />
            <span className="text-gray-700 font-medium">@{reply.user}</span>
            <span className="text-gray-400 text-xs">• {reply.date}</span>
          </div>
          {editMode === reply.id ? (
            <>
              <textarea
                className="w-full p-2 border rounded-md"
                value={editedText}
                onChange={(e) => setEditedText(e.target.value)}
              />
              <div className="flex gap-2">
                <button onClick={() => handleSaveEdit(reply.id)} className="bg-green-500 text-white px-3 py-1 rounded">Save</button>
                <button onClick={() => setEditMode(null)} className="bg-gray-300 px-3 py-1 rounded">Cancel</button>
              </div>
            </>
          ) : (
            <>
              <p className="text-gray-800">{reply.text}</p>
              <div className="flex gap-4 text-sm text-gray-600">
                <button onClick={() => handleVote(reply.id, 'likes')} className="hover:text-blue-600">👍 {reply.likes}</button>
                <button onClick={() => handleVote(reply.id, 'dislikes')} className="hover:text-red-600">👎 {reply.dislikes}</button>
                {reply.user === 'You' && (
                  <>
                    <button onClick={() => handleEdit(reply.id)} className="text-blue-500">✏️ Edit</button>
                    <button onClick={() => handleDelete(reply.id)} className="text-red-500">🗑️ Delete</button>
                  </>
                )}
              </div>
            </>
          )}
        </div>
      ))}
    </div>
  );
}
