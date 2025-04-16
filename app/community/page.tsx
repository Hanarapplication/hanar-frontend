'use client';

import { useEffect, useState } from 'react';

const mockPosts = [
  {
    id: 1,
    question: 'How can I find Middle Eastern grocery stores near me?',
    category: 'Grocery',
    user: 'sara_nyc',
  },
  {
    id: 2,
    question: 'What’s the best way to promote my small business?',
    category: 'Business Tips',
    user: 'mohamed_tx',
  },
  {
    id: 3,
    question: 'Where can I get halal meat in Chicago?',
    category: 'Food & Halal',
    user: 'zainab_chi',
  },
  {
    id: 4,
    question: 'How to get business licenses as an immigrant?',
    category: 'Legal',
    user: 'farid_ca',
  },
];

export default function CommunityPage() {
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    setLoaded(true);
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-rose-50 via-amber-50 to-indigo-50 p-6">
      <h1 className="text-3xl font-bold text-slate-700 mb-6">Community</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {mockPosts.map((post, i) => (
          <div
            key={post.id}
            className={`bg-white p-4 rounded-xl shadow-sm border border-slate-100 transition duration-500 transform ${
              loaded ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-3'
            }`}
            style={{ transitionDelay: `${i * 100}ms` }}
          >
            <div className="flex justify-between items-center mb-2">
              <span className="text-xs text-slate-400">@{post.user}</span>
              <span className="bg-indigo-100 text-indigo-600 text-xs font-semibold px-2 py-1 rounded-md">
                {post.category}
              </span>
            </div>
            <p className="text-sm font-medium text-slate-800 leading-snug">
              {post.question}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
