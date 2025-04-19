'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useState, useEffect } from 'react';

const mockUser = {
  username: 'mehdiToronto',
  bio: '🇨🇦 Small business owner empowering the Afghan community in Toronto.',
  profileImage: 'https://source.unsplash.com/100x100/?person,toronto',
};

const mockPosts = [
  {
    id: 101,
    title: 'Just tried the new Bolani at Bolani House - so delicious! 😋 #AfghanFood #TorontoEats',
    date: 'April 18, 2025',
    author: 'mehdiToronto',
    profileImage: 'https://source.unsplash.com/50x50/?person,1',
    likes: 15,
    comments: 2,
  },
  {
    id: 102,
    title: 'Anyone know a good supplier for organic chickpeas in the GTA?',
    date: 'April 17, 2025',
    author: 'communityFoodie',
    profileImage: 'https://source.unsplash.com/50x50/?person,2',
    likes: 8,
    comments: 5,
  },
  {
    id: 103,
    title: 'Excited to announce our new partnership with local artisans!',
    date: 'April 16, 2025',
    author: 'HalalMarketTO',
    profileImage: 'https://source.unsplash.com/50x50/?shop,3',
    likes: 22,
    comments: 7,
  },
];

const mockBusinesses = [
  {
    id: 1,
    name: 'Bolani House 🥟',
    category: 'Authentic Afghan Cuisine',
    slug: 'bolani-house',
    image: 'https://source.unsplash.com/100x100/?afghan-food',
    rating: 4.8,
  },
  {
    id: 2,
    name: 'Toronto Halal Grocers 🛒',
    category: 'Premium Halal Products',
    slug: 'toronto-halal-grocers',
    image: 'https://source.unsplash.com/100x100/?halal,market',
    rating: 4.5,
  },
];

export default function UserProfilePage() {
  const { username } = useParams();
  const isMyProfile = username === mockUser.username;

  const [showPosts, setShowPosts] = useState(true);
  const [showBusinesses, setShowBusinesses] = useState(true);

  useEffect(() => {
    const savedPrefs = JSON.parse(localStorage.getItem(`visibilityPrefs_${username}`) || '{}');
    if (savedPrefs.showPosts !== undefined) setShowPosts(savedPrefs.showPosts);
    if (savedPrefs.showBusinesses !== undefined) setShowBusinesses(savedPrefs.showBusinesses);
  }, [username]);

  useEffect(() => {
    localStorage.setItem(
      `visibilityPrefs_${username}`,
      JSON.stringify({ showPosts, showBusinesses })
    );
  }, [showPosts, showBusinesses, username]);

  return (
    <div className="bg-blue-100 min-h-screen py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto space-y-8">
        {/* Profile Header */}
        <div className="bg-blue-400 rounded-xl shadow-md p-6">
          <div className="flex items-start gap-4">
            {/* Profile Picture (Circular and Square) */}
            <div className="w-20 h-20 rounded-full overflow-hidden shadow-sm border-2 border-blue-200">
              <img
                src={mockUser.profileImage}
                alt="Profile"
                className="object-cover w-full h-full"
                style={{ aspectRatio: '1 / 1' }}
              />
            </div>
            <div className="relative">
              <div className="bg-white rounded-md p-2 shadow-sm">
                <h1 className="text-xs font-semibold text-gray-900 leading-tight">@{username}</h1>
              </div>
              {/* Bio Bubble */}
              <div className="relative mt-2 bg-white rounded-lg shadow-md p-3 text-sm text-gray-600">
                {mockUser.bio}
                <div className="absolute top-1/2 left-0 transform -translate-y-1/2 -ml-2 w-0 h-0 border-t-5 border-b-5 border-r-8 border-white border-l-transparent"></div>
              </div>
              <div className="mt-2 flex flex-wrap gap-2">
                {isMyProfile && (
                  <>
                    <Link href="/dashboard" className="inline-flex items-center px-3 py-1.5 text-sm font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-full shadow-sm">
                      <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31-.826 4.368.194M12 10.5c-2.907 0-5.536.3-7.694 1.346m-1.296 6.401a3 3 0 11-5.842-.669 3 3 0 015.842.669m2.327-6.443c.62-2.03 3.286-2.03 3.907 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31-.826 4.368.194M12 10.5c2.907 0 5.536.3 7.694 1.346m1.296 6.401a3 3 0 11-5.842-.669 3 3 0 015.842.669"></path></svg>
                      Dashboard
                    </Link>
                    <Link href="/dashboard?page=Settings" className="inline-flex items-center px-3 py-1.5 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-full shadow-sm">
                      <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6V4m0 2a2 2 0 012 2v5m-2-5a2 2 0 01-2 2v5m0-5a2 2 0 012-2v5m-2-5a2 2 0 01-2 2v5m0-5a2 2 0 012-2v5m-2-5a2 2 0 01-2 2v5m0-5v2m0-6v2m0-6v2"></path></svg>
                      Settings
                    </Link>
                  </>
                )}
              </div>
              {isMyProfile && (
                <div className="mt-2 flex gap-3 text-sm">
                  <label className="inline-flex items-center gap-1.5 text-gray-700">
                    <input type="checkbox" className="form-checkbox h-5 w-5 text-indigo-600 rounded shadow-sm focus:ring-indigo-500" checked={showPosts} onChange={() => setShowPosts(p => !p)} />
                    Posts
                  </label>
                  <label className="inline-flex items-center gap-1.5 text-gray-700">
                    <input type="checkbox" className="form-checkbox h-5 w-5 text-indigo-600 rounded shadow-sm focus:ring-indigo-500" checked={showBusinesses} onChange={() => setShowBusinesses(p => !p)} />
                    Businesses
                  </label>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Feed Section */}
        <div className="space-y-6">
          {showPosts && mockPosts.length > 0 && (
            <div className="bg-gray-100 rounded-xl shadow-md overflow-hidden">
              <div className="p-6">
                <h2 className="text-lg font-semibold text-gray-800 mb-4">Community Updates</h2>
                <ul className="space-y-4">
                  {mockPosts.map(post => (
                    <li key={post.id} className="bg-white rounded-md shadow-sm border border-gray-200">
                      <div className="p-4">
                        <div className="flex items-start gap-3 mb-3">
                          <img
                            src={post.profileImage}
                            alt={post.author}
                            className="w-8 h-8 rounded-full object-cover"
                            style={{ aspectRatio: '1 / 1' }}
                          />
                          <div>
                            <p className="text-sm font-semibold text-gray-800">{post.author}</p>
                            <span className="text-xs text-gray-500">{post.date}</span>
                          </div>
                        </div>
                        <Link href={`/community/${post.id}`} className="block hover:bg-gray-100 p-2 -m-2 rounded-md">
                          <p className="text-gray-700 leading-relaxed bg-white rounded-md p-1">{post.title}</p>
                        </Link>
                        <div className="mt-3 flex justify-between items-center text-sm text-gray-500">
                          <button className="flex items-center hover:text-blue-600">
                            <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                            {post.likes} Likes
                          </button>
                          <button className="flex items-center hover:text-gray-700">
                            <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 0 01-2 2h-5l-5 5v-5z"></path></svg>
                            {post.comments} Comments
                          </button>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
                {mockPosts.length === 0 && <p className="text-gray-500 italic">No community updates yet.</p>}
              </div>
            </div>
          )}

          {showBusinesses && mockBusinesses.length > 0 && (
            <div className="bg-gray-100 rounded-xl shadow-md overflow-hidden">
              <div className="p-6">
                <h2 className="text-lg font-semibold text-gray-800 mb-4">Local Businesses</h2>
                <ul className="space-y-4">
                  {mockBusinesses.map(biz => (
                    <li key={biz.id} className="bg-white rounded-md shadow-sm border border-gray-200">
                      <Link href={`/business/${biz.slug}`} className="block p-4 hover:bg-gray-100 rounded-md">
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 rounded-md overflow-hidden shadow-sm">
                            <img
                              src={biz.image}
                              alt={biz.name}
                              className="object-cover w-full h-full"
                              style={{ aspectRatio: '1 / 1' }}
                            />
                          </div>
                          <div>
                            <p className="font-semibold text-indigo-700 bg-white rounded-md p-1">{biz.name}</p>
                            <p className="text-sm text-gray-500 bg-white rounded-md p-1">{biz.category}</p>
                            {biz.rating && (
                              <div className="flex items-center text-sm text-yellow-500 mt-1 bg-white rounded-md p-1">
                                <svg className="w-4 h-4 mr-1 fill-current" viewBox="0 0 20 20"><path d="M10 15l-5.878 3.09 1.175-5.928L.5 8.262l6.064-.707L10 2.5l3.436 5.055 6.064.707-4.797 4.195 1.175 5.928z"/></svg>
                                {biz.rating}
                              </div>
                            )}
                          </div>
                        </div>
                      </Link>
                    </li>
                  ))}
                </ul>
                {mockBusinesses.length === 0 && <p className="text-gray-500 italic">No local businesses listed yet.</p>}
              </div>
            </div>
          )}

          {showPosts && mockPosts.length === 0 && (
            <div className="bg-gray-100 rounded-xl shadow-md overflow-hidden p-6 text-gray-500 italic">
              No community updates to show.
            </div>
          )}
          {showBusinesses && mockBusinesses.length === 0 && (
            <div className="bg-gray-100 rounded-xl shadow-md overflow-hidden p-6 text-gray-500 italic">
              No local businesses listed to show.
            </div>
          )}
          {!showPosts && !showBusinesses && isMyProfile && (
            <div className="bg-gray-100 rounded-xl shadow-md overflow-hidden p-6 text-gray-500 italic">
              Toggle the visibility of your posts and businesses above.
            </div>
          )}
          {!showPosts && !showBusinesses && !isMyProfile && (
            <div className="bg-gray-100 rounded-xl shadow-md overflow-hidden p-6 text-gray-500 italic">
              No public content to show.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
