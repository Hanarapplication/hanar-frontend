'use client';

import Link from 'next/link';
import { useRef, useState, useEffect, ChangeEvent } from 'react';
const TABS = ['My Businesses', 'My Items', 'My Posts', 'Settings'];
const ITEMS_PER_PAGE = 5;

const mockBusinesses = Array.from({ length: 23 }, (_, i) => ({
  id: i + 1,
  name: `Business ${i + 1}`,
  category: ['Restaurant', 'Grocery Store', 'Salon'][i % 3],
  image: `https://source.unsplash.com/100x100/?business,${i}`,
}));

const mockItems = Array.from({ length: 17 }, (_, i) => ({
  id: i + 1,
  name: `Item ${i + 1}`,
  category: ['Electronics', 'Clothing', 'Books'][i % 3],
  image: `https://source.unsplash.com/100x100/?item,product,${i}`,
}));

const mockPosts = Array.from({ length: 31 }, (_, i) => ({
  id: i + 1,
  author: `@User_${i % 5 + 1}`,
  title: `Question about ${['local events', 'best practices', 'new regulations'][i % 3]} in Frisco`,
  body: 'Lorem ipsum dolor sit amet...',
}));

export default function DashboardPage() {
  const [activeTab, setActiveTab] = useState('My Businesses');
  const [bio, setBio] = useState('"Helping the community one step at a time."');
  const [tempBio, setTempBio] = useState(bio);
  const [profileImage, setProfileImage] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [showPosts, setShowPosts] = useState(true);
  const [showBusinesses, setShowBusinesses] = useState(true);

  useEffect(() => {
    const savedPrefs = JSON.parse(localStorage.getItem("visibilityPrefs_mehdiToronto") || '{}');
    if (savedPrefs.showPosts !== undefined) setShowPosts(savedPrefs.showPosts);
    if (savedPrefs.showBusinesses !== undefined) setShowBusinesses(savedPrefs.showBusinesses);
  }, []);

  useEffect(() => {
    localStorage.setItem("visibilityPrefs_mehdiToronto", JSON.stringify({ showPosts, showBusinesses }));
  }, [showPosts, showBusinesses]);

  useEffect(() => {
    setCurrentPage(1);
  }, [activeTab]);

  useEffect(() => {
    switch (activeTab) {
      case 'My Businesses':
        setTotalItems(mockBusinesses.length);
        break;
      case 'My Items':
        setTotalItems(mockItems.length);
        break;
      case 'My Posts':
        setTotalItems(mockPosts.length);
        break;
      case 'Settings':
      default:
        setTotalItems(0);
        break;
    }
  }, [activeTab]);

  const handleApplyChanges = () => setBio(tempBio);
  const triggerImageUpload = () => fileInputRef.current?.click();
  const slugify = (name: string) => name.toLowerCase().replace(/\s+/g, '-').replace(/[^\w-]/g, '');
  const handlePageChange = (newPage: number) => setCurrentPage(newPage);

  const getPaginatedItems = (items: any[]) => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return items.slice(start, start + ITEMS_PER_PAGE);
  };

  const renderPagination = (total: number) => {
    const pageCount = Math.ceil(total / ITEMS_PER_PAGE);
    if (pageCount <= 1) return null;
    const pages = Array.from({ length: pageCount }, (_, i) => i + 1);
    return (
      <div className="flex justify-center mt-4">
        {currentPage > 1 && (
          <button onClick={() => handlePageChange(currentPage - 1)} className="px-3 py-1 rounded bg-gray-200 text-gray-700 mr-2">Previous</button>
        )}
        {pages.map((p) => (
          <button key={p} onClick={() => handlePageChange(p)} className={`px-3 py-1 rounded ${currentPage === p ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-700'} mx-1`}>
            {p}
          </button>
        ))}
        {currentPage < pageCount && (
          <button onClick={() => handlePageChange(currentPage + 1)} className="px-3 py-1 rounded bg-gray-200 text-gray-700 ml-2">Next</button>
        )}
      </div>
    );
  };

  const renderContent = () => {
    switch (activeTab) {
      case 'My Businesses':
        return showBusinesses ? (
          <div className="space-y-4">
            {getPaginatedItems(mockBusinesses).map((biz) => (
              <div key={biz.id} className="flex flex-col sm:flex-row justify-between border p-4 rounded-lg shadow bg-indigo-50">
                <div className="flex items-center gap-4 mb-2 sm:mb-0">
                  <img src={biz.image} alt={biz.name} className="w-16 h-16 rounded-md object-cover" />
                  <div>
                    <p className="font-semibold text-gray-800">{biz.name}</p>
                    <p className="text-sm text-gray-500 italic">{biz.category}</p>
                  </div>
                </div>
                <div className="flex gap-2 flex-wrap">
                  <Link href={`/business/${slugify(biz.name)}`} className="text-sm px-3 py-1 rounded border border-indigo-300 text-indigo-600 hover:bg-indigo-100">View</Link>
                  <Link href={`/dashboard/business/${slugify(biz.name)}`} className="text-sm px-3 py-1 rounded border border-teal-300 text-teal-600 hover:bg-teal-100">Edit</Link>
                  <button className="text-sm px-3 py-1 rounded border border-red-300 text-red-600 hover:bg-red-100">Delete</button>
                </div>
              </div>
            ))}
            {renderPagination(totalItems)}
            <div className="pt-4">
              <Link href="/add-business" className="inline-block px-4 py-2 bg-indigo-600 text-white text-sm rounded hover:bg-indigo-700">+ Add New Business</Link>
            </div>
          </div>
        ) : null;
      case 'My Items':
        return (
          <div className="space-y-4">
            {getPaginatedItems(mockItems).map((item) => (
              <div key={item.id} className="flex justify-between border p-4 rounded-lg shadow bg-indigo-50">
                <div className="flex items-center gap-4">
                  <img src={item.image} alt={item.name} className="w-16 h-16 rounded-md object-cover" />
                  <div>
                    <p className="font-semibold text-gray-800">{item.name}</p>
                    <p className="text-sm text-gray-500 italic">{item.category}</p>
                  </div>
                </div>
                <div className="flex gap-2 flex-wrap">
                  <Link href={`/marketplace/${item.id}`} className="text-sm px-3 py-1 rounded border border-indigo-300 text-indigo-600 hover:bg-indigo-100">View</Link>
                  <Link href={`/dashboard/items/${item.id}`} className="text-sm px-3 py-1 rounded border border-teal-300 text-teal-600 hover:bg-teal-100">Edit</Link>
                  <button className="text-sm px-3 py-1 rounded border border-red-300 text-red-600 hover:bg-red-100">Delete</button>
                </div>
              </div>
            ))}
            {renderPagination(totalItems)}
          </div>
        );
      case 'My Posts':
        return showPosts ? (
          <div className="space-y-4">
            {getPaginatedItems(mockPosts).map((post) => (
              <div key={post.id} className="flex flex-col border p-4 rounded-lg shadow bg-indigo-50">
                <p className="text-sm text-gray-500 italic">Posted as {post.author}</p>
                <p className="font-semibold text-gray-800 mt-1">{post.title}</p>
                <div className="flex justify-end gap-2 mt-3">
                  <Link href={`/community/${post.id}`} className="text-sm px-3 py-1 rounded border border-indigo-300 text-indigo-600 hover:bg-indigo-100">View</Link>
                  <Link href={`/dashboard/posts/${post.id}`} className="text-sm px-3 py-1 rounded border border-teal-300 text-teal-600 hover:bg-teal-100">Edit</Link>
                  <button className="text-sm px-3 py-1 rounded border border-red-300 text-red-600 hover:bg-red-100">Delete</button>
                </div>
              </div>
            ))}
            {renderPagination(totalItems)}
          </div>
        ) : null;
      case 'Settings':
        return (
          <div className="text-gray-700 space-y-6">
            <div>
              <label className="block font-medium mb-1 text-gray-700">Change Bio:</label>
              <textarea value={tempBio} onChange={(e) => setTempBio(e.target.value)} rows={3} className="w-full border border-gray-300 p-2 rounded-md" />
            </div>
            <div>
              <label className="block font-medium mb-1 text-gray-700">Edit Profile Picture:</label>
              <button onClick={triggerImageUpload} className="px-4 py-2 bg-gray-100 border border-gray-300 rounded-md">Choose New Photo</button>
            </div>
            <div className="space-y-2 mt-4">
              <p className="font-medium text-gray-800">🔒 Profile Visibility</p>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={showPosts} onChange={() => setShowPosts(p => !p)} />
                Show My Community Posts
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={showBusinesses} onChange={() => setShowBusinesses(p => !p)} />
                Show My Business Listings
              </label>
            </div>
            <div className="mt-4">
              <button onClick={handleApplyChanges} className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700">Apply Changes</button>
            </div>
          </div>
        );
      default:
        return null;
    }
  };

  function handleImageUpload(event: ChangeEvent<HTMLInputElement>): void {
    throw new Error('Function not implemented.');
  }

  return (
    <div className="p-4 max-w-4xl mx-auto">
      <div className="flex items-center justify-between bg-white p-4 rounded-lg shadow border mb-6 flex-wrap gap-3 sm:flex-nowrap">
        <button onClick={triggerImageUpload} className="w-20 h-20 bg-gray-200 flex items-center justify-center text-gray-600 font-bold text-lg border-2 border-dashed rounded-full hover:border-indigo-500">
          {profileImage ? <img src={profileImage} alt="Profile" className="object-cover w-full h-full rounded-full" /> : 'Choose'}
        </button>
        <input type="file" accept="image/*" onChange={handleImageUpload} ref={fileInputRef} className="hidden" />
        <div className="flex-1 sm:ml-4">
          <p className="text-lg font-semibold text-gray-800">Username_here</p>
          <p className="text-sm text-gray-500">Small Business Owner | Toronto 🇨🇦</p>
          <p className="text-sm text-gray-500 mt-1 italic">{bio}</p>
        </div>
        <Link href="/profile/Username_here" className="text-sm px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700">View Profile</Link>
      </div>

      <h1 className="text-2xl font-bold mb-4 text-indigo-600">Welcome to Your Dashboard</h1>
      <div className="flex flex-wrap gap-2 mb-6">
        {TABS.map((tab) => (
          <button key={tab} onClick={() => { setActiveTab(tab); setCurrentPage(1); }} className={`px-4 py-2 rounded-full text-sm font-medium ${activeTab === tab ? 'bg-indigo-600 text-white shadow' : 'bg-gray-200 text-gray-800 hover:bg-gray-300'}`}>
            {tab}
          </button>
        ))}
      </div>
      <div className="bg-white p-4 rounded-lg shadow border min-h-[200px]">
        {renderContent()}
      </div>
    </div>
  );
}
