'use client';

import Link from 'next/link';
import { useRef, useState } from 'react';

const TABS = ['My Businesses', 'My Items', 'My Posts', 'Settings'];

const mockBusinesses = [
  {
    id: 1,
    name: 'Bolani House',
    category: 'Afghan Restaurant',
    image: 'https://source.unsplash.com/100x100/?restaurant',
  },
  {
    id: 2,
    name: 'Halal Market',
    category: 'Grocery Store',
    image: 'https://source.unsplash.com/100x100/?grocery',
  },
  {
    id: 3,
    name: 'Sahara Salon',
    category: 'Beauty & Spa',
    image: 'https://source.unsplash.com/100x100/?salon',
  },
];

export default function DashboardPage() {
  const [activeTab, setActiveTab] = useState('My Businesses');
  const [bio, setBio] = useState('"Helping the community one step at a time."');
  const [tempBio, setTempBio] = useState(bio);
  const [profileImage, setProfileImage] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setProfileImage(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSave = () => {
    setBio(tempBio);
  };

  const triggerImageUpload = () => {
    fileInputRef.current?.click();
  };

  const slugify = (name: string) =>
    name.toLowerCase().replace(/\s+/g, '-').replace(/[^\w-]/g, '');

  const renderContent = () => {
    switch (activeTab) {
      case 'My Businesses':
        return (
          <div className="space-y-4">
            {mockBusinesses.map((biz) => (
              <div
                key={biz.id}
                className="flex items-center justify-between border border-gray-200 p-4 rounded-xl shadow-sm bg-white"
              >
                <div className="flex items-center gap-4">
                  <img
                    src={biz.image}
                    alt={biz.name}
                    className="w-16 h-16 rounded-md object-cover"
                  />
                  <div>
                    <p className="font-semibold text-gray-800">{biz.name}</p>
                    <p className="text-sm text-gray-500">{biz.category}</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Link
                    href={`/business/${slugify(biz.name)}`}
                    className="px-3 py-1 text-sm border rounded-md text-gray-700 border-gray-300 hover:bg-gray-100 transition"
                  >
                    View
                  </Link>
                  <button className="px-3 py-1 text-sm border rounded-md text-[#a93226] border-[#a93226] hover:bg-[#f9eaea] transition">
                    Edit
                  </button>
                  <button className="px-3 py-1 text-sm border rounded-md text-red-600 border-red-400 hover:bg-red-100 transition">
                    Delete
                  </button>
                </div>
              </div>
            ))}

            {/* Add New Business */}
            <div className="pt-4">
              <Link
                href="/add-business"
                className="inline-block px-4 py-2 rounded-md bg-[#a93226] text-white text-sm hover:bg-[#922b21] transition"
              >
                + Add New Business
              </Link>
            </div>
          </div>
        );

      case 'My Items':
        return <div className="text-gray-700">No items posted for sale.</div>;

      case 'My Posts':
        return <div className="text-gray-700">You haven’t made any community posts.</div>;

      case 'Settings':
        return (
          <div className="text-gray-700 space-y-6">
            <div>
              <label className="block font-medium mb-1">Change Bio:</label>
              <textarea
                value={tempBio}
                onChange={(e) => setTempBio(e.target.value)}
                rows={3}
                className="w-full border border-gray-300 p-2 rounded-md focus:outline-none focus:ring-2 focus:ring-pomegranate"
              />
              <button
                onClick={handleSave}
                className="mt-2 px-4 py-2 bg-[#a93226] text-white text-sm rounded-md hover:bg-[#922b21] transition"
              >
                Save Bio
              </button>
            </div>

            <div>
              <label className="block font-medium mb-1">Edit Profile Picture:</label>
              <button
                onClick={triggerImageUpload}
                className="px-4 py-2 bg-gray-100 border border-gray-300 rounded-md text-sm text-gray-700 hover:bg-gray-200 transition"
              >
                Choose New Photo
              </button>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="p-4 max-w-4xl mx-auto">
      {/* 👤 Profile Header Block */}
      <div className="flex items-center justify-between bg-white p-4 rounded-xl shadow-sm border border-gray-200 mb-6 flex-wrap gap-3 sm:flex-nowrap">
        {/* Profile Picture */}
        <button
          onClick={triggerImageUpload}
          className="w-20 h-20 bg-gray-200 overflow-hidden flex items-center justify-center text-gray-600 font-bold text-lg border-2 border-dashed border-gray-400 hover:border-[#a93226] transition"
        >
          {profileImage ? (
            <img src={profileImage} alt="Profile" className="object-cover w-full h-full" />
          ) : (
            'Choose'
          )}
        </button>
        <input
          type="file"
          accept="image/*"
          onChange={handleImageUpload}
          ref={fileInputRef}
          className="hidden"
        />

        {/* Username + Bio */}
        <div className="flex-1 min-w-[150px] sm:ml-4">
          <p className="text-lg font-semibold text-gray-800">Username_here</p>
          <p className="text-sm text-gray-600">Small Business Owner | Toronto 🇨🇦</p>
          <p className="text-sm text-gray-500 mt-1 italic">{bio}</p>
        </div>

        {/* View Public Profile */}
        <Link
          href="/profile/username_here"
          className="text-sm px-4 py-2 rounded-md bg-[#a93226] text-white hover:bg-[#922b21] transition whitespace-nowrap"
        >
          View Profile
        </Link>
      </div>

      {/* 👋 Welcome */}
      <h1 className="text-2xl font-bold mb-4 text-[#a93226]">Welcome to Your Dashboard</h1>

      {/* 🧭 Tabs */}
      <div className="flex flex-wrap gap-2 mb-6">
        {TABS.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 rounded-full text-sm font-medium transition ${
              activeTab === tab
                ? 'bg-[#a93226] text-white shadow'
                : 'bg-gray-200 text-gray-800 hover:bg-gray-300'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* 📦 Tab Content */}
      <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 min-h-[200px]">
        {renderContent()}
      </div>
    </div>
  );
}
