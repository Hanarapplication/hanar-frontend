'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';

interface Post {
  id: string;
  title: string;
  body: string;
  image?: string;
  username: string;
  language: string;
  date: string;
  tags: string[];
  category: string;
  likes: number;
  replies: number;
}

const mockPosts: Post[] = [{'id': '1', 'title': 'Sample Post 1', 'body': 'This is post #1 about something interesting and informative.', 'image': '', 'username': 'user_1', 'language': 'en', 'date': '2025-04-14', 'tags': ['tag1', 'culture', 'global'], 'category': 'Travel', 'likes': 3, 'replies': 1}, {'id': '2', 'title': 'Sample Post 2', 'body': 'This is post #2 about something interesting and informative.', 'image': '', 'username': 'user_2', 'language': 'en', 'date': '2025-04-13', 'tags': ['tag2', 'culture', 'global'], 'category': 'Culture', 'likes': 6, 'replies': 2}, {'id': '3', 'title': 'Sample Post 3', 'body': 'This is post #3 about something interesting and informative.', 'image': 'https://source.unsplash.com/400x200/?culture,life', 'username': 'user_3', 'language': 'en', 'date': '2025-04-12', 'tags': ['tag3', 'culture', 'global'], 'category': 'Travel', 'likes': 9, 'replies': 3}, {'id': '4', 'title': 'Sample Post 4', 'body': 'This is post #4 about something interesting and informative.', 'image': '', 'username': 'user_4', 'language': 'en', 'date': '2025-04-11', 'tags': ['tag4', 'culture', 'global'], 'category': 'Culture', 'likes': 12, 'replies': 4}, {'id': '5', 'title': 'Sample Post 5', 'body': 'This is post #5 about something interesting and informative.', 'image': '', 'username': 'user_5', 'language': 'en', 'date': '2025-04-10', 'tags': ['tag0', 'culture', 'global'], 'category': 'Travel', 'likes': 15, 'replies': 5}, {'id': '6', 'title': 'Sample Post 6', 'body': 'This is post #6 about something interesting and informative.', 'image': 'https://source.unsplash.com/400x200/?culture,life', 'username': 'user_6', 'language': 'en', 'date': '2025-04-09', 'tags': ['tag1', 'culture', 'global'], 'category': 'Culture', 'likes': 18, 'replies': 6}, {'id': '7', 'title': 'Sample Post 7', 'body': 'This is post #7 about something interesting and informative.', 'image': '', 'username': 'user_7', 'language': 'en', 'date': '2025-04-08', 'tags': ['tag2', 'culture', 'global'], 'category': 'Travel', 'likes': 21, 'replies': 0}, {'id': '8', 'title': 'Sample Post 8', 'body': 'This is post #8 about something interesting and informative.', 'image': '', 'username': 'user_8', 'language': 'en', 'date': '2025-04-07', 'tags': ['tag3', 'culture', 'global'], 'category': 'Culture', 'likes': 24, 'replies': 1}, {'id': '9', 'title': 'Sample Post 9', 'body': 'This is post #9 about something interesting and informative.', 'image': 'https://source.unsplash.com/400x200/?culture,life', 'username': 'user_9', 'language': 'en', 'date': '2025-04-06', 'tags': ['tag4', 'culture', 'global'], 'category': 'Travel', 'likes': 27, 'replies': 2}, {'id': '10', 'title': 'Sample Post 10', 'body': 'This is post #10 about something interesting and informative.', 'image': '', 'username': 'user_10', 'language': 'en', 'date': '2025-04-05', 'tags': ['tag0', 'culture', 'global'], 'category': 'Culture', 'likes': 30, 'replies': 3}, {'id': '11', 'title': 'Sample Post 11', 'body': 'This is post #11 about something interesting and informative.', 'image': '', 'username': 'user_11', 'language': 'en', 'date': '2025-04-04', 'tags': ['tag1', 'culture', 'global'], 'category': 'Travel', 'likes': 33, 'replies': 4}, {'id': '12', 'title': 'Sample Post 12', 'body': 'This is post #12 about something interesting and informative.', 'image': 'https://source.unsplash.com/400x200/?culture,life', 'username': 'user_12', 'language': 'en', 'date': '2025-04-03', 'tags': ['tag2', 'culture', 'global'], 'category': 'Culture', 'likes': 36, 'replies': 5}, {'id': '13', 'title': 'Sample Post 13', 'body': 'This is post #13 about something interesting and informative.', 'image': '', 'username': 'user_13', 'language': 'en', 'date': '2025-04-02', 'tags': ['tag3', 'culture', 'global'], 'category': 'Travel', 'likes': 39, 'replies': 6}, {'id': '14', 'title': 'Sample Post 14', 'body': 'This is post #14 about something interesting and informative.', 'image': '', 'username': 'user_14', 'language': 'en', 'date': '2025-04-01', 'tags': ['tag4', 'culture', 'global'], 'category': 'Culture', 'likes': 2, 'replies': 0}, {'id': '15', 'title': 'Sample Post 15', 'body': 'This is post #15 about something interesting and informative.', 'image': 'https://source.unsplash.com/400x200/?culture,life', 'username': 'user_15', 'language': 'en', 'date': '2025-03-31', 'tags': ['tag0', 'culture', 'global'], 'category': 'Travel', 'likes': 5, 'replies': 1}, {'id': '16', 'title': 'Sample Post 16', 'body': 'This is post #16 about something interesting and informative.', 'image': '', 'username': 'user_16', 'language': 'en', 'date': '2025-03-30', 'tags': ['tag1', 'culture', 'global'], 'category': 'Culture', 'likes': 8, 'replies': 2}, {'id': '17', 'title': 'Sample Post 17', 'body': 'This is post #17 about something interesting and informative.', 'image': '', 'username': 'user_17', 'language': 'en', 'date': '2025-03-29', 'tags': ['tag2', 'culture', 'global'], 'category': 'Travel', 'likes': 11, 'replies': 3}, {'id': '18', 'title': 'Sample Post 18', 'body': 'This is post #18 about something interesting and informative.', 'image': 'https://source.unsplash.com/400x200/?culture,life', 'username': 'user_18', 'language': 'en', 'date': '2025-03-28', 'tags': ['tag3', 'culture', 'global'], 'category': 'Culture', 'likes': 14, 'replies': 4}, {'id': '19', 'title': 'Sample Post 19', 'body': 'This is post #19 about something interesting and informative.', 'image': '', 'username': 'user_19', 'language': 'en', 'date': '2025-03-27', 'tags': ['tag4', 'culture', 'global'], 'category': 'Travel', 'likes': 17, 'replies': 5}, {'id': '20', 'title': 'Sample Post 20', 'body': 'This is post #20 about something interesting and informative.', 'image': '', 'username': 'user_20', 'language': 'en', 'date': '2025-03-26', 'tags': ['tag0', 'culture', 'global'], 'category': 'Culture', 'likes': 20, 'replies': 6}, {'id': '21', 'title': 'Sample Post 21', 'body': 'This is post #21 about something interesting and informative.', 'image': 'https://source.unsplash.com/400x200/?culture,life', 'username': 'user_21', 'language': 'en', 'date': '2025-03-25', 'tags': ['tag1', 'culture', 'global'], 'category': 'Travel', 'likes': 23, 'replies': 0}, {'id': '22', 'title': 'Sample Post 22', 'body': 'This is post #22 about something interesting and informative.', 'image': '', 'username': 'user_22', 'language': 'en', 'date': '2025-03-24', 'tags': ['tag2', 'culture', 'global'], 'category': 'Culture', 'likes': 26, 'replies': 1}, {'id': '23', 'title': 'Sample Post 23', 'body': 'This is post #23 about something interesting and informative.', 'image': '', 'username': 'user_23', 'language': 'en', 'date': '2025-03-23', 'tags': ['tag3', 'culture', 'global'], 'category': 'Travel', 'likes': 29, 'replies': 2}, {'id': '24', 'title': 'Sample Post 24', 'body': 'This is post #24 about something interesting and informative.', 'image': 'https://source.unsplash.com/400x200/?culture,life', 'username': 'user_24', 'language': 'en', 'date': '2025-03-22', 'tags': ['tag4', 'culture', 'global'], 'category': 'Culture', 'likes': 32, 'replies': 3}, {'id': '25', 'title': 'Sample Post 25', 'body': 'This is post #25 about something interesting and informative.', 'image': '', 'username': 'user_25', 'language': 'en', 'date': '2025-03-21', 'tags': ['tag0', 'culture', 'global'], 'category': 'Travel', 'likes': 35, 'replies': 4}, {'id': '26', 'title': 'Sample Post 26', 'body': 'This is post #26 about something and informative.', 'image': '', 'username': 'user_26', 'language': 'en', 'date': '2025-03-20', 'tags': ['tag1', 'culture', 'global'], 'category': 'Culture', 'likes': 38, 'replies': 5}, {'id': '27', 'title': 'Sample Post 27', 'body': 'This is post #27 about something interesting and informative.', 'image': 'https://source.unsplash.com/400x200/?culture,life', 'username': 'user_27', 'language': 'en', 'date': '2025-03-19', 'tags': ['tag2', 'culture', 'global'], 'category': 'Travel', 'likes': 1, 'replies': 6}, {'id': '28', 'title': 'Sample Post 28', 'body': 'This is post #28 about something interesting and informative.', 'image': '', 'username': 'user_28', 'language': 'en', 'date': '2025-03-18', 'tags': ['tag3', 'culture', 'global'], 'category': 'Culture', 'likes': 4, 'replies': 0}, {'id': '29', 'title': 'Sample Post 29', 'body': 'This is post #29 about something interesting and informative.', 'image': '', 'username': 'user_29', 'language': 'en', 'date': '2025-03-17', 'tags': ['tag4', 'culture', 'global'], 'category': 'Travel', 'likes': 7, 'replies': 1}, {'id': '30', 'title': 'Sample Post 30', 'body': 'This is post #30 about something interesting and informative.', 'image': 'https://source.unsplash.com/400x200/?culture,life', 'username': 'user_30', 'language': 'en', 'date': '2025-03-16', 'tags': ['tag0', 'culture', 'global'], 'category': 'Culture', 'likes': 10, 'replies': 2}, {'id': '31', 'title': 'Sample Post 31', 'body': 'This is post #31 about something interesting and informative.', 'image': '', 'username': 'user_31', 'language': 'en', 'date': '2025-03-15', 'tags': ['tag1', 'culture', 'global'], 'category': 'Travel', 'likes': 13, 'replies': 3}, {'id': '32', 'title': 'Sample Post 32', 'body': 'This is post #32 about something interesting and informative.', 'image': '', 'username': 'user_32', 'language': 'en', 'date': '2025-03-14', 'tags': ['tag2', 'culture', 'global'], 'category': 'Culture', 'likes': 16, 'replies': 4}, {'id': '33', 'title': 'Sample Post 33', 'body': 'This is post #33 about something interesting and informative.', 'image': 'https://source.unsplash.com/400x200/?culture,life', 'username': 'user_33', 'language': 'en', 'date': '2025-03-13', 'tags': ['tag3', 'culture', 'global'], 'category': 'Travel', 'likes': 19, 'replies': 5}, {'id': '34', 'title': 'Sample Post 34', 'body': 'This is post #34 about something interesting and informative.', 'image': '', 'username': 'user_34', 'language': 'en', 'date': '2025-03-12', 'tags': ['tag4', 'culture', 'global'], 'category': 'Culture', 'likes': 22, 'replies': 6}, {'id': '35', 'title': 'Sample Post 35', 'body': 'This is post #35 about something interesting and informative.', 'image': '', 'username': 'user_35', 'language': 'en', 'date': '2025-03-11', 'tags': ['tag0', 'culture', 'global'], 'category': 'Travel', 'likes': 25, 'replies': 0}, {'id': '36', 'title': 'Sample Post 36', 'body': 'This is post #36 about something interesting and informative.', 'image': 'https://source.unsplash.com/400x200/?culture,life', 'username': 'user_36', 'language': 'en', 'date': '2025-03-10', 'tags': ['tag1', 'culture', 'global'], 'category': 'Culture', 'likes': 28, 'replies': 1}, {'id': '37', 'title': 'Sample Post 37', 'body': 'This is post #37 about something interesting and informative.', 'image': '', 'username': 'user_37', 'language': 'en', 'date': '2025-03-09', 'tags': ['tag2', 'culture', 'global'], 'category': 'Travel', 'likes': 31, 'replies': 2}, {'id': '38', 'title': 'Sample Post 38', 'body': 'This is post #38 about something interesting and informative.', 'image': '', 'username': 'user_38', 'language': 'en', 'date': '2025-03-08', 'tags': ['tag3', 'culture', 'global'], 'category': 'Culture', 'likes': 34, 'replies': 3}, {'id': '39', 'title': 'Sample Post 39', 'body': 'This is post #39 about something interesting and informative.', 'image': 'https://source.unsplash.com/400x200/?culture,life', 'username': 'user_39', 'language': 'en', 'date': '2025-03-07', 'tags': ['tag4', 'culture', 'global'], 'category': 'Travel', 'likes': 37, 'replies': 4}, {'id': '40', 'title': 'Sample Post 40', 'body': 'This is post #40 about something interesting and informative.', 'image': '', 'username': 'user_40', 'language': 'en', 'date': '2025-03-06', 'tags': ['tag0', 'culture', 'global'], 'category': 'Culture', 'likes': 0, 'replies': 5}, {'id': '41', 'title': 'Sample Post 41', 'body': 'This is post #41 about something interesting and informative.', 'image': '', 'username': 'user_41', 'language': 'en', 'date': '2025-03-05', 'tags': ['tag1', 'culture', 'global'], 'category': 'Travel', 'likes': 3, 'replies': 6}, {'id': '42', 'title': 'Sample Post 42', 'body': 'This is post #42 about something interesting and informative.', 'image': 'https://source.unsplash.com/400x200/?culture,life', 'username': 'user_42', 'language': 'en', 'date': '2025-03-04', 'tags': ['tag2', 'culture', 'global'], 'category': 'Culture', 'likes': 6, 'replies': 0}, {'id': '43', 'title': 'Sample Post 43', 'body': 'This is post #43 about something interesting and informative.', 'image': '', 'username': 'user_43', 'language': 'en', 'date': '2025-03-03', 'tags': ['tag3', 'culture', 'global'], 'category': 'Travel', 'likes': 9, 'replies': 1}, {'id': '44', 'title': 'Sample Post 44', 'body': 'This is post #44 about something interesting and informative.', 'image': '', 'username': 'user_44', 'language': 'en', 'date': '2025-03-02', 'tags': ['tag4', 'culture', 'global'], 'category': 'Culture', 'likes': 12, 'replies': 2}, {'id': '45', 'title': 'Sample Post 45', 'body': 'This is post #45 about something interesting and informative.', 'image': 'https://source.unsplash.com/400x200/?culture,life', 'username': 'user_45', 'language': 'en', 'date': '2025-03-01', 'tags': ['tag0', 'culture', 'global'], 'category': 'Travel', 'likes': 15, 'replies': 3}, {'id': '46', 'title': 'Sample Post 46', 'body': 'This is post #46 about something interesting and informative.', 'image': '', 'username': 'user_46', 'language': 'en', 'date': '2025-02-28', 'tags': ['tag1', 'culture', 'global'], 'category': 'Culture', 'likes': 18, 'replies': 4}, {'id': '47', 'title': 'Sample Post 47', 'body': 'This is post #47 about something interesting and informative.', 'image': '', 'username': 'user_47', 'language': 'en', 'date': '2025-02-27', 'tags': ['tag2', 'culture', 'global'], 'category': 'Travel', 'likes': 21, 'replies': 5}, {'id': '48', 'title': 'Sample Post 48', 'body': 'This is post #48 about something interesting and informative.', 'image': 'https://source.unsplash.com/400x200/?culture,life', 'username': 'user_48', 'language': 'en', 'date': '2025-02-26', 'tags': ['tag3', 'culture', 'global'], 'category': 'Culture', 'likes': 24, 'replies': 6}, {'id': '49', 'title': 'Sample Post 49', 'body': 'This is post #49 about something interesting and informative.', 'image': '', 'username': 'user_49', 'language': 'en', 'date': '2025-02-25', 'tags': ['tag4', 'culture', 'global'], 'category': 'Travel', 'likes': 27, 'replies': 0}, {'id': '50', 'title': 'Sample Post 50', 'body': 'This is post #50 about something interesting and informative.', 'image': '', 'username': 'user_50', 'language': 'en', 'date': '2025-02-24', 'tags': ['tag0', 'culture', 'global'], 'category': 'Culture', 'likes': 30, 'replies': 1}];

export default function CommunityPage() {
  const [search, setSearch] = useState('');
  const [visibleCount, setVisibleCount] = useState(10);
  const bottomRef = useRef(null);

  const filtered = mockPosts
    .filter(p => {
      const term = search.toLowerCase();
      return (
        p.title.toLowerCase().includes(term) ||
        p.body.toLowerCase().includes(term) ||
        p.username.toLowerCase().includes(term) ||
        p.category.toLowerCase().includes(term) ||
        p.tags.some(t => t.toLowerCase().includes(term))
      );
    })
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

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
    
<div className="max-w-3xl mx-auto p-0 pt-16">

  <div className="w-full bg-yellow-100 text-center text-sm text-yellow-800 py-2 shadow-sm rounded-b-md">
    📢 Promote your business here — <span className="underline cursor-pointer">Advertise</span>
  </div>

  <div className="sticky top-20 z-30 bg-white/95 backdrop-blur shadow-sm px-4 py-3 border-b">
    <input
      className="w-full p-3 border rounded-md bg-gray-100 text-sm"
      placeholder="Search posts..."
      value={search}
      onChange={e => setSearch(e.target.value)}
    />
  </div>


      <div className="space-y-4 px-4 pt-4">
        {visiblePosts.map((post) => (
          <Link href={`/community/${post.id}`} key={post.id} className="block bg-white rounded-lg border p-4 shadow-sm hover:shadow-md transition">
            <div className="text-xs text-gray-500 flex justify-between mb-1">
              <span>@{post.username}</span>
              <span>{post.date}</span>
            </div>
            <h2 className="text-lg font-semibold text-blue-700">{post.title}</h2>
            {post.image && <img src={post.image} className="w-full h-36 object-cover rounded my-2" alt="" />}
            <p className="text-sm text-gray-700 line-clamp-2">{post.body}</p>
            <div className="text-xs text-gray-500 mt-2">
              👍 {post.likes} • 💬 {post.replies} replies • 🏷 {post.tags.slice(0, 3).map(t => `#${t}`).join(' ')}
            </div>
          </Link>
        ))}

        <div ref={bottomRef} className="text-center text-gray-400 text-sm py-6">
          {visiblePosts.length < filtered.length ? 'Loading more posts...' : 'No more posts'}
        </div>
      </div>
    </div>
  );
}
