'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';
import { enUS } from 'date-fns/locale';
import { HeartIcon as SolidHeartIcon, ChatBubbleLeftIcon as SolidChatBubbleLeftIcon } from '@heroicons/react/24/solid';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface Post {
  id: string;
  title: string;
  body: string;
  image?: string;
  author: string;
  language: string;
  created_at: string;
  tags: string[];
  category?: string;
  likes?: number;
  replies?: { author: string; text: string; created_at: string }[];
}

export default function CommunityPage() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [search, setSearch] = useState('');
  const [visibleCount, setVisibleCount] = useState(10);
  const bottomRef = useRef(null);

  useEffect(() => {
    const fetchPosts = async () => {
      const lang = typeof window !== 'undefined' ? navigator.language.slice(0, 2) : 'en';
      const preferredLanguages = [lang, 'en', 'ar', 'fa', 'tr', 'ps', 'ckb', 'ku'];
      const { data, error } = await supabase
        .from('community_posts')
        .select('*')
        .in('language', preferredLanguages)
        .order('created_at', { ascending: false });

      if (error) console.error('Error loading posts:', error);
      else setPosts(data || []);
    };

    fetchPosts();
  }, []);

  const filtered = posts.filter(p => {
    const term = search.toLowerCase();
    return (
      p.title.toLowerCase().includes(term) ||
      p.body.toLowerCase().includes(term) ||
      p.author.toLowerCase().includes(term) ||
      (p.category?.toLowerCase().includes(term) ?? false) ||
      p.tags.some(t => t.toLowerCase().includes(term))
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

  return (
    <div className="min-h-screen py-8" style={{ backgroundColor: '#e0f2f7' }}>
      <div className="container mx-auto space-y-6" style={{ maxWidth: '95%' }}>
        <div className="bg-yellow-100 text-center text-sm text-yellow-800 py-3 shadow-sm rounded-md">
          📢 Promote your business here — <Link href="/advertise" className="underline cursor-pointer hover:text-yellow-900 transition-colors">Advertise</Link>
        </div>

        <div className="sticky top-0 z-30 bg-white shadow-sm rounded-md p-3">
          <input
            className="w-full p-3 border rounded-md bg-gray-50 text-lg focus:ring-blue-500 focus:border-blue-500"
            placeholder="Search posts..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {visiblePosts.map((post) => (
            <Link
              key={post.id}
              href={`/community/${post.id}`}
              className="block bg-white rounded-lg shadow-sm border border-gray-200 hover:shadow-md transition-shadow duration-200"
            >
              <div className="p-4 flex flex-col">
                <div className="mb-2">
                  <div className="flex items-center">
                    <h3 className="text-md font-semibold text-gray-800 truncate">@{post.author}</h3>
                    <span className="ml-auto text-sm text-gray-500">{formatDistanceToNow(new Date(post.created_at), { addSuffix: true, locale: enUS })}</span>
                  </div>
                  <h2 className="text-lg font-semibold text-teal-700 truncate mb-1">{post.title}</h2>
                  <p className="text-md text-gray-700 mb-2" style={{ whiteSpace: 'pre-line' }}>{post.body}</p>
                </div>
                {post.image && (
                  <div className="w-full rounded-md overflow-hidden shadow-sm mt-2" style={{ aspectRatio: '16/9' }}>
                    <img src={post.image} alt={post.title} className="w-full h-full object-cover" />
                  </div>
                )}
                <div className="flex justify-between items-center text-md mt-2">
                  <div className="flex items-center">
                    <SolidHeartIcon className="h-5 w-5 mr-1 text-red-500" />
                    <span>{post.likes || 0}</span>
                    <SolidChatBubbleLeftIcon className="h-5 w-5 ml-2 mr-1 text-yellow-500" />
                    <span>{post.replies?.length || 0}</span>
                  </div>
                  <div className="overflow-hidden whitespace-nowrap text-md">
                    {post.tags.map((tag, index) => (
                      <span key={index} className="inline-block bg-blue-100 text-blue-700 rounded-full px-2 py-0.5 mr-1">
                        #{tag}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>

        <div ref={bottomRef} className="text-center text-gray-500 py-6 text-lg">
          {visiblePosts.length < filtered.length ? 'Loading more posts...' : 'No more posts'}
        </div>
      </div>
    </div>
  );
}
