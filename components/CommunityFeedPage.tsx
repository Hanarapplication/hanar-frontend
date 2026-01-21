'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';
import { enUS } from 'date-fns/locale';
import {
  HeartIcon as SolidHeartIcon,
  ChatBubbleLeftIcon as SolidChatBubbleLeftIcon,
  PlusIcon,
  MagnifyingGlassIcon,
} from '@heroicons/react/24/solid';
import { useLanguage } from '@/context/LanguageContext';
import { motion, AnimatePresence } from 'framer-motion';
import { createClient } from '@supabase/supabase-js';
import { useRouter } from 'next/navigation';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const CommunityFeedPage = () => {
  const [posts, setPosts] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [visibleCount, setVisibleCount] = useState(10);
  const [undoBuffer, setUndoBuffer] = useState<any[]>([]);
  const bottomRef = useRef(null);
  const { lang } = useLanguage();
  const router = useRouter();

  const fetchPosts = async () => {
    const { data, error } = await supabase
      .from('community_posts')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching posts:', error.message);
      return;
    }

    const filtered = data.filter(post => !post.is_deleted);
    setPosts(filtered);
  };

  useEffect(() => {
    fetchPosts();
  }, [lang]);

  useEffect(() => {
    const channel = supabase
      .channel('public:community_replies')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'community_replies' },
        payload => {
          const reply = payload.new;
          setPosts(prev =>
            prev.map(p =>
              p.id === reply.post_id
                ? { ...p, replies: [...(p.replies || []), reply] }
                : p
            )
          );
        }
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'community_replies' },
        payload => {
          const reply = payload.old;
          setPosts(prev =>
            prev.map(p =>
              p.id === reply.post_id
                ? {
                    ...p,
                    replies:
                      p.replies?.filter((r: any) => r.id !== reply.id) || [],
                  }
                : p
            )
          );
          setUndoBuffer(buf => [...buf, { type: 'reply', data: reply }]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const filtered = posts.filter(post => {
    const term = search.toLowerCase();
    return (
      post.title.toLowerCase().includes(term) ||
      post.body.toLowerCase().includes(term) ||
      post.author.toLowerCase().includes(term) ||
      post.identity?.toLowerCase().includes(term)
    );
  });

  const visiblePosts = filtered.slice(0, visibleCount);

  useEffect(() => {
    const observer = new IntersectionObserver(
      entries => {
        if (entries[0].isIntersecting) {
          setVisibleCount(prev => Math.min(prev + 10, filtered.length));
        }
      },
      { threshold: 1 }
    );
    if (bottomRef.current) observer.observe(bottomRef.current);
    return () => observer.disconnect();
  }, [filtered]);

  const handleUndo = async (item: any) => {
    if (item.type === 'reply') {
      await supabase.from('community_replies').insert(item.data);
    }
    setUndoBuffer(buf => buf.filter(b => b !== item));
  };

  return (
    <div className="container mx-auto px-4 py-6 space-y-6">
      <div className="flex justify-between items-center sticky top-0 bg-white z-40 p-4 shadow-md border-b rounded-b-lg">
        <div className="flex items-center gap-3 w-full">
          <div className="relative w-full max-w-xs">
            <MagnifyingGlassIcon className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search posts or users..."
              className="pl-10 pr-3 py-2 w-full rounded-full text-sm border bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
          </div>
          <button
onClick={async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      router.push('/community/post');
    } else {
      router.push('/login?redirect=/community/post');
    }
  }}
              className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-full p-2"
            title="Add New Post"
          >
            <PlusIcon className="h-5 w-5" />
          </button>
        </div>
      </div>

      {undoBuffer.length > 0 && (
        <div className="bg-yellow-50 border border-yellow-300 p-3 rounded flex items-center gap-4">
          <span className="text-sm font-medium text-yellow-800">Item deleted</span>
          <button
            onClick={() => handleUndo(undoBuffer[0])}
            className="text-sm text-blue-600 hover:underline"
          >
            Undo
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <AnimatePresence>
          {visiblePosts.map(post => (
            <motion.div
              key={post.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3 }}
            >
              <Link href={`/community/${post.id}`}>
                <div className="bg-white p-5 rounded-lg border shadow-md hover:shadow-lg transition-shadow">
                  <h2 className="font-semibold text-lg text-gray-900 line-clamp-1">{post.title}</h2>
                  <p className="text-gray-700 text-sm mt-1 line-clamp-3">{post.body}</p>
                  {post.image && (
                    <img
                      src={post.image}
                      alt={post.title}
                      className="mt-2 w-full h-40 object-cover rounded-md"
                    />
                  )}
                  <div className="mt-3">
                    <div className="flex justify-between text-xs text-gray-500">
                      <span>@{post.author}</span>
                      <span>{formatDistanceToNow(new Date(post.created_at), {
                        addSuffix: true,
                        locale: enUS,
                      })}</span>
                    </div>
                    <div className="mt-2 flex gap-4 text-xs">
                      <span className="flex items-center gap-1 text-red-500">
                        <SolidHeartIcon className="w-4 h-4" />
                        {post.likes || 0}
                      </span>
                      <span className="flex items-center gap-1 text-yellow-500">
                        <SolidChatBubbleLeftIcon className="w-4 h-4" />
                        {post.replies?.length || 0}
                      </span>
                    </div>
                  </div>
                </div>
              </Link>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      <div ref={bottomRef} className="text-center py-8 text-sm text-gray-500">
        {visiblePosts.length < filtered.length
          ? 'Loading more posts...'
          : 'You reached the end 🎉'}
      </div>
    </div>
  );
};

export default CommunityFeedPage;
