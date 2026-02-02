'use client';

import { useState, useEffect, useRef } from 'react';
import { HeartIcon, ChatBubbleLeftIcon, MagnifyingGlassIcon, XMarkIcon, PlusIcon } from '@heroicons/react/24/solid';
import { formatDistanceToNow } from 'date-fns';
import { enUS } from 'date-fns/locale';
import Link from 'next/link';
import { useLanguage } from '@/context/LanguageContext';
import { t } from '@/utils/translations';

interface Post {
  id: string;
  title: string;
  body: string;
  author: string;
  author_type?: string | null;
  username?: string | null;
  created_at: string;
  image?: string;
  likes_post?: number;
  community_comments?: { count: number }[];
}

export default function CommunityFeedPage() {
  const [search, setSearch] = useState('');
  const [visiblePosts, setVisiblePosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [sortMode, setSortMode] = useState<'latest' | 'popular'>('latest');
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const { lang } = useLanguage();

  const sortPosts = (posts: Post[]): Post[] => {
    if (sortMode === 'popular') {
      return [...posts].sort((a, b) => (b.likes_post || 0) - (a.likes_post || 0));
    } else {
      return [...posts].sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
    }
  };

  const loadMorePosts = async () => {
    if (loading || !hasMore) return;
    setLoading(true);
    try {
      const response = await fetch('/api/community/list', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ search, offset: visiblePosts.length, lang, sortMode }),
      });
      const newPosts: Post[] = await response.json();
      const sorted = sortPosts(newPosts);
      const unique = [...new Map([...visiblePosts, ...sorted].map(p => [p.id, p])).values()];
      setVisiblePosts(unique);
      setHasMore(newPosts.length === 10);
    } catch (err) {
      console.error('Error loading posts:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setVisiblePosts([]);
    setHasMore(true);
    loadMorePosts();
  }, [search, lang, sortMode]);

  useEffect(() => {
    const observer = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting && !loading && hasMore) {
        loadMorePosts();
      }
    });
    if (bottomRef.current) observer.observe(bottomRef.current);
    return () => {
      if (bottomRef.current) observer.unobserve(bottomRef.current);
    };
  }, [loading, hasMore]);

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="text-sm text-gray-600 mb-2">
        {t(lang, 'Showing posts in')}: <strong>{t(lang, lang)}</strong>
      </div>

      <div className="flex gap-3 mb-6">
        <button
          onClick={() => setSortMode('latest')}
          className={`px-4 py-2 rounded-md text-sm font-medium ${
            sortMode === 'latest' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-800'
          }`}
        >
          {t(lang, 'Latest')}
        </button>
        <button
          onClick={() => setSortMode('popular')}
          className={`px-4 py-2 rounded-md text-sm font-medium ${
            sortMode === 'popular' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-800'
          }`}
        >
          {t(lang, 'Most Popular')}
        </button>
      </div>

      <div className="flex items-center mb-6 gap-4">
        <div className="relative flex-1">
          <input
            type="text"
            placeholder={t(lang, 'Search posts...')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 rounded-lg border border-gray-300 focus:outline-none focus:border-blue-500"
          />
          <MagnifyingGlassIcon className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-3 top-2.5">
              <XMarkIcon className="h-5 w-5 text-gray-400" />
            </button>
          )}
        </div>
        <Link
          href="/community/post"
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <PlusIcon className="h-5 w-5" />
          <span>{t(lang, 'New Post')}</span>
        </Link>
      </div>

      <div className="space-y-6">
        {visiblePosts.map((post, index) => (
          <Link
            key={`${post.id}-${index}`}
            href={`/community/post/${post.id}`}
            className="block bg-white rounded-lg shadow-sm hover:shadow-md transition-shadow p-6"
          >
            <div className="flex flex-col sm:flex-row gap-4 h-full">
              {post.image && (
                <img
                  src={post.image}
                  alt="Post"
                  className="max-w-[120px] max-h-[120px] w-full sm:w-auto object-cover rounded-md"
                />
              )}
              <div className="flex-1 flex flex-col justify-between">
                <div>
                  <h2 className="text-xl font-semibold mb-2">{post.title}</h2>
                  <p className="text-gray-600 line-clamp-2">{post.body}</p>
                  <div className="flex items-center gap-3 mt-4 text-sm text-gray-500">
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
                    <span>•</span>
                    <span>
                      {formatDistanceToNow(new Date(post.created_at), {
                        addSuffix: true,
                        locale: enUS,
                      })}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-6 mt-4 text-sm text-gray-600">
                  <div className="flex items-center gap-1">
                    <HeartIcon className="h-5 w-5 text-red-500" />
                    <span>{post.likes_post || 0}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <ChatBubbleLeftIcon className="h-5 w-5 text-blue-500" />
                    <span>{post.community_comments?.[0]?.count || 0}</span>
                    </div>
                </div>
              </div>
            </div>
          </Link>
        ))}
      </div>

      <div ref={bottomRef} className="h-10" />
    </div>
  );
}
