'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import LiveRefreshLink from '@/components/LiveRefreshLink';

// Mock Data
const featuredBusinesses = [
  { id: 1, name: 'Taste of Beirut', category: 'Restaurant', image: 'https://picsum.photos/id/10/367/267' },
  { id: 2, name: 'Halal Market', category: 'Grocery Store', image: 'https://picsum.photos/id/9/367/267' },
];

const trendingItems = [
  { id: 1, title: 'Persian Rug', price: '$450', image: 'https://www.catalinarug.com/wp-content/uploads/2022/12/381637-600x853.jpg' },
  { id: 2, title: 'Afghan Jewelry', price: '$120', image: 'https://picsum.photos/id/28/367/267' },
];

const topCommunities = [
  { id: 'halal-foodies', name: 'Halal Foodies', description: 'Favorite halal eats.', likeCount: 125, replyCount: 32 },
  { id: 'muslim-entrepreneurs', name: 'Muslim Entrepreneurs', description: 'Business owners community.', likeCount: 87, replyCount: 18 },
];

const adBanners = [
  {
    id: 1,
    image: 'https://img.freepik.com/free-photo/sassy-goodlooking-redhead-female-yellow-sweater-listen-music-white-headphones-touch-earphones_1258-126219.jpg',
    link: 'https://hanar.net',
    alt: 'Advertise with us',
  },
];

// Shuffle and Mix Posts
const mixedFeed = [
  { type: 'community', ...topCommunities[0] },
  { type: 'business', ...featuredBusinesses[0] },
  { type: 'item', ...trendingItems[0] },
  { type: 'ad', ...adBanners[0] },
  { type: 'community', ...topCommunities[1] },
  { type: 'business', ...featuredBusinesses[1] },
  { type: 'item', ...trendingItems[1] },
];

export default function HomeFeedPage() {
  const [feed, setFeed] = useState<any[]>([]);
  const [visibleCount, setVisibleCount] = useState(5);
  const loaderRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setFeed(mixedFeed.map(post => ({
      ...post,
      fakeViews: Math.floor(Math.random() * 100) + 10, // Add fake views
    })));
  }, []);

  useEffect(() => {
    const observer = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting) {
        loadMore();
      }
    }, { threshold: 1.0 });

    if (loaderRef.current) observer.observe(loaderRef.current);
    return () => observer.disconnect();
  }, [loaderRef, feed]);

  const loadMore = () => {
    setVisibleCount((prev) => prev + 5);
  };

  return (
    <div className="min-h-screen bg-gray-100 py-6 px-4 sm:px-6 lg:px-8">
      <div className="space-y-6 max-w-2xl mx-auto">

        {feed.slice(0, visibleCount).map((post, idx) => (
          <div key={idx} className="bg-white rounded-lg shadow-md p-4">

            {post.type === 'business' && (
              <LiveRefreshLink href="/businesses" className="block">
                <img src={post.image} alt={post.name} className="w-full h-48 object-cover rounded-md" />
                <h3 className="text-lg font-semibold mt-2">{post.name}</h3>
                <p className="text-sm text-gray-600">{post.category}</p>
                <div className="text-xs text-gray-400 mt-1">{post.fakeViews} views ❤️</div>
              </LiveRefreshLink>
            )}

            {post.type === 'item' && (
              <LiveRefreshLink href="/marketplace" className="block">
                <img src={post.image} alt={post.title} className="w-full h-48 object-cover rounded-md" />
                <h3 className="text-lg font-semibold mt-2">{post.title}</h3>
                <p className="text-green-600 font-bold">{post.price}</p>
                <div className="text-xs text-gray-400 mt-1">{post.fakeViews} views ❤️</div>
              </LiveRefreshLink>
            )}

            {post.type === 'community' && (
              <Link href={`/communities/${post.id}`} className="block">
                <h3 className="text-lg font-semibold text-teal-700">{post.name}</h3>
                <p className="text-sm text-gray-600 mt-1">{post.description}</p>
                <div className="flex space-x-4 mt-2 text-xs text-gray-500">
                  <span>👍 {post.likeCount}</span>
                  <span>💬 {post.replyCount}</span>
                  <span>{post.fakeViews} views</span>
                </div>
              </Link>
            )}

            {post.type === 'ad' && (
              <a href={post.link} target="_blank" rel="noopener noreferrer" className="block">
                <img src={post.image} alt={post.alt} className="w-full h-48 object-cover rounded-md" />
              </a>
            )}

          </div>
        ))}

        <div ref={loaderRef} className="flex justify-center py-8">
          <span className="text-gray-500 text-sm">Loading more posts...</span>
        </div>

      </div>
    </div>
  );
}
