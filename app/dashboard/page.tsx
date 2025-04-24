'use client';

import Link from 'next/link';
import { useRef, useState, useEffect, ChangeEvent } from 'react';
import { useRouter } from 'next/navigation';

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
  const router = useRouter();
  const [loading, setLoading] = useState(true);

  const [showPosts, setShowPosts] = useState(true);
  const [showBusinesses, setShowBusinesses] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('hanarToken');
    if (!token) {
      router.push('/login');
      return;
    }

    fetch('http://localhost:5000/api/me', {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then((res) => {
        if (!res.ok) throw new Error();
        return res.json();
      })
      .then(() => setLoading(false))
      .catch(() => {
        localStorage.removeItem('hanarToken');
        router.push('/login');
      });
  }, [router]);

  useEffect(() => {
    const savedPrefs = JSON.parse(localStorage.getItem("visibilityPrefs_mehdiToronto") || '{}');
    if (savedPrefs.showPosts !== undefined) setShowPosts(savedPrefs.showPosts);
    if (savedPrefs.showBusinesses !== undefined) setShowBusinesses(savedPrefs.showBusinesses);
  }, []);

  useEffect(() => {
    localStorage.setItem("visibilityPrefs_mehdiToronto", JSON.stringify({ showPosts, showBusinesses }));
  }, [showPosts, showBusinesses]);

  useEffect(() => setCurrentPage(1), [activeTab]);

  useEffect(() => {
    switch (activeTab) {
      case 'My Businesses': setTotalItems(mockBusinesses.length); break;
      case 'My Items': setTotalItems(mockItems.length); break;
      case 'My Posts': setTotalItems(mockPosts.length); break;
      default: setTotalItems(0);
    }
  }, [activeTab]);

  const handleApplyChanges = () => setBio(tempBio);
  const triggerImageUpload = () => fileInputRef.current?.click();
  const slugify = (name: string) => name.toLowerCase().replace(/\s+/g, '-').replace(/[^\w-]/g, '');
  const handlePageChange = (newPage: number) => setCurrentPage(newPage);
  const getPaginatedItems = (items: any[]) => items.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  const renderPagination = (total: number) => {
    const pageCount = Math.ceil(total / ITEMS_PER_PAGE);
    if (pageCount <= 1) return null;
    return (
      <div className="flex justify-center mt-4">
        {Array.from({ length: pageCount }, (_, i) => i + 1).map((p) => (
          <button key={p} onClick={() => handlePageChange(p)} className={`px-3 py-1 mx-1 rounded ${currentPage === p ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-700'}`}>
            {p}
          </button>
        ))}
      </div>
    );
  };

  const renderContent = () => {
    switch (activeTab) {
      case 'My Businesses':
        return showBusinesses ? (
          <>
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
          </>
        ) : null;

      case 'My Items':
        return (
          <>
            {getPaginatedItems(mockItems).map((item) => (
              <div key={item.id} className="flex justify-between border p-4 rounded-lg shadow bg-indigo-50">
                <div className="flex items-center gap-4">
                  <img src={item.image} alt={item.name} className="w-16 h-16 rounded-md object-cover" />
                  <div>
                    <p className="font-semibold text-gray-800">{item.name}</p>
                    <p className="text-sm text-gray-500 italic">{item.category}</p>
                  </div>
                </div>
              </div>
            ))}
            {renderPagination(totalItems)}
            <div className="pt-4">
              <Link href="/marketplace/new" className="inline-block px-4 py-2 bg-green-600 text-white text-sm rounded hover:bg-green-700">
                + Add New Item
              </Link>
            </div>
          </>
        );

      case 'My Posts':
        return showPosts ? getPaginatedItems(mockPosts).map((post) => (
          <div key={post.id} className="flex flex-col border p-4 rounded-lg shadow bg-indigo-50">
            <p className="text-sm text-gray-500 italic">Posted as {post.author}</p>
            <p className="font-semibold text-gray-800 mt-1">{post.title}</p>
          </div>
        )) : null;

      case 'Settings':
        return (
          <div className="text-gray-700 space-y-6">
            <textarea value={tempBio} onChange={(e) => setTempBio(e.target.value)} rows={3} className="w-full border border-gray-300 p-2 rounded-md" />
            <button onClick={triggerImageUpload} className="px-4 py-2 bg-gray-100 border border-gray-300 rounded-md">Choose New Photo</button>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={showPosts} onChange={() => setShowPosts(p => !p)} />
              Show My Community Posts
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={showBusinesses} onChange={() => setShowBusinesses(p => !p)} />
              Show My Business Listings
            </label>
            <button onClick={handleApplyChanges} className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700">Apply Changes</button>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="p-6">
      <h1 className="text-2xl font-semibold text-gray-900 mb-4">My Dashboard</h1>
      <div className="bg-white shadow rounded-lg overflow-hidden">
        <nav className="border-b">
          <ul className="flex space-x-4 px-4">
            {TABS.map((tab) => (
              <li key={tab} className="-mb-px">
                <button
                  onClick={() => setActiveTab(tab)}
                  className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm ${activeTab === tab ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500 hover:text-indigo-600 hover:border-indigo-300'}`}
                >
                  {tab}
                </button>
              </li>
            ))}
          </ul>
        </nav>
        <div className="p-4">
          {loading ? <p>Loading...</p> : renderContent()}
        </div>
      </div>
      <input type="file" ref={fileInputRef} className="hidden" />
    </div>
  );
}