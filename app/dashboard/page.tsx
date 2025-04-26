'use client';

import { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import toast from 'react-hot-toast';

const ITEMS_PER_PAGE = 5;
const TABS = ['My Businesses', 'My Items', 'My Posts', 'Settings'];
const ADMIN_TABS = ['Admin Panel', ...TABS];

export default function DashboardPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const [activeTab, setActiveTab] = useState('My Businesses');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalItems, setTotalItems] = useState(0);

  const [businesses, setBusinesses] = useState<any[]>([]);
  const [items, setItems] = useState<any[]>([]);
  const [posts, setPosts] = useState<any[]>([]);

  const [pendingBusinesses, setPendingBusinesses] = useState<any[]>([]);

  const [username, setUsername] = useState('');
  const [bio, setBio] = useState('');
  const [profilePicFile, setProfilePicFile] = useState<File | null>(null);

  useEffect(() => {
    const checkSession = async () => {
      const { data } = await supabase.auth.getSession();
      const session = data?.session;

      if (session) {
        setUser(session.user);
      }
      setLoading(false);
    };
    checkSession();
  }, []);

  useEffect(() => {
    if (user) {
      fetchProfile();
      fetchMockData();
      if (isAdmin()) fetchPendingBusinesses();
    }
  }, [user]);

  const isAdmin = () => user?.email === 'admin@yourdomain.com';

  const fetchProfile = async () => {
    const { data } = await supabase.from('Profiles').select('*').eq('id', user.id).single();
    if (data) {
      setUsername(data.username || generateUsername(user.email));
      setBio(data.bio || '');
    } else {
      setUsername(generateUsername(user.email));
    }
  };

  const generateUsername = (email: string) => {
    const base = email.split('@')[0];
    const random = Math.floor(1000 + Math.random() * 9000);
    return `${base}${random}`;
  };

  const fetchMockData = () => {
    const mockBusinesses = Array.from({ length: 10 }, (_, i) => ({ id: i + 1, name: `Business ${i+1}`, category: 'Restaurant' }));
    const mockItems = Array.from({ length: 8 }, (_, i) => ({ id: i + 1, name: `Item ${i+1}`, category: 'Electronics' }));
    const mockPosts = Array.from({ length: 15 }, (_, i) => ({ id: i + 1, title: `Post ${i+1}`, body: 'Lorem ipsum dolor sit amet...' }));

    setBusinesses(mockBusinesses);
    setItems(mockItems);
    setPosts(mockPosts);
  };

  const fetchPendingBusinesses = async () => {
    const { data } = await supabase.from('Businesses').select('*').eq('approved', false);
    if (data) setPendingBusinesses(data);
  };

  const approveBusiness = async (id: string) => {
    await supabase.from('Businesses').update({ approved: true }).eq('id', id);
    fetchPendingBusinesses();
  };

  const rejectBusiness = async (id: string) => {
    await supabase.from('Businesses').delete().eq('id', id);
    fetchPendingBusinesses();
  };

  const handleProfileSave = async () => {
    if (!username) {
      toast.error('Username cannot be empty.');
      return;
    }

    const { data: exists } = await supabase.from('Profiles').select('*').eq('username', username).single();
    if (exists && exists.id !== user.id) {
      toast.error('Username already taken.');
      return;
    }

    let profilePicUrl = null;
    if (profilePicFile) {
      const { data, error } = await supabase.storage.from('profile-pictures').upload(`public/${Date.now()}-${profilePicFile.name}`, profilePicFile);
      if (data) {
        profilePicUrl = data.path;
      } else {
        toast.error('Profile picture upload failed.');
      }
    }

    await supabase.from('Profiles').upsert({
      id: user.id,
      username,
      bio,
      profile_picture: profilePicUrl
    });

    toast.success('Profile updated!');
  };

  const handlePageChange = (newPage: number) => setCurrentPage(newPage);

  const getPaginatedItems = (items: any[]) => items.slice((currentPage-1)*ITEMS_PER_PAGE, currentPage*ITEMS_PER_PAGE);

  if (loading) return <div className="flex justify-center items-center min-h-screen">Loading...</div>;
  if (!user) {
    router.push('/login');
    return null;
  }

  return (
    <div className="p-6">
      <h1 className="text-2xl font-semibold mb-4">Dashboard</h1>
      <div className="bg-white shadow rounded-lg">
        <nav className="border-b">
          <ul className="flex space-x-4 px-4">
            {(isAdmin() ? ADMIN_TABS : TABS).map((tab) => (
              <li key={tab}>
                <button
                  onClick={() => setActiveTab(tab)}
                  className={`py-4 px-2 text-sm font-medium ${activeTab === tab ? 'border-b-2 border-indigo-600 text-indigo-600' : 'text-gray-500 hover:text-indigo-600'}`}
                >
                  {tab}
                </button>
              </li>
            ))}
          </ul>
        </nav>
        <div className="p-4">
          {activeTab === 'My Businesses' && (
            <div>
              {getPaginatedItems(businesses).map((b) => (
                <div key={b.id} className="border rounded p-2 mb-2">{b.name}</div>
              ))}
            </div>
          )}
          {activeTab === 'My Items' && (
            <div>
              {getPaginatedItems(items).map((item) => (
                <div key={item.id} className="border rounded p-2 mb-2">{item.name}</div>
              ))}
            </div>
          )}
          {activeTab === 'My Posts' && (
            <div>
              {getPaginatedItems(posts).map((post) => (
                <div key={post.id} className="border rounded p-2 mb-2">{post.title}</div>
              ))}
            </div>
          )}
          {activeTab === 'Settings' && (
            <div className="space-y-4">
              <input type="text" value={username} onChange={(e) => setUsername(e.target.value)} placeholder="Username" className="w-full border p-2 rounded" />
              <textarea value={bio} onChange={(e) => setBio(e.target.value)} placeholder="Bio" className="w-full border p-2 rounded" />
              <label className="block">
                <span className="text-sm">Upload Profile Picture</span>
                <input type="file" className="mt-1 block w-full" onChange={(e) => setProfilePicFile(e.target.files?.[0] || null)} />
              </label>
              <button onClick={handleProfileSave} className="bg-indigo-600 text-white px-4 py-2 rounded">Save Profile</button>
            </div>
          )}
          {activeTab === 'Admin Panel' && isAdmin() && (
            <div className="space-y-4">
              {pendingBusinesses.map((biz) => (
                <div key={biz.id} className="flex justify-between items-center border rounded p-4">
                  <div>
                    <h3 className="font-bold">{biz.business_name}</h3>
                    <p className="text-sm text-gray-500">{biz.category}</p>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => approveBusiness(biz.id)} className="bg-green-500 text-white px-2 py-1 rounded">Approve</button>
                    <button onClick={() => rejectBusiness(biz.id)} className="bg-red-500 text-white px-2 py-1 rounded">Reject</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      <input type="file" ref={fileInputRef} className="hidden" />
    </div>
  );
}
