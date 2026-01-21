'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import toast from 'react-hot-toast';
import Link from 'next/link';
import { FaUserCircle, FaHeart, FaUsers, FaNewspaper, FaShoppingCart, FaCamera, FaPencilAlt } from 'react-icons/fa';

const SECTIONS = [
  { name: 'Dashboard', icon: FaUserCircle },
  { name: 'Favorites', icon: FaHeart },
  { name: 'Following', icon: FaUsers },
  { name: 'Community Posts', icon: FaNewspaper },
  { name: 'Items for Sale', icon: FaShoppingCart },
];

export default function DashboardPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const usernameInputRef = useRef<HTMLInputElement>(null);

  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeSection, setActiveSection] = useState('Dashboard');
  const [username, setUsername] = useState('');
  const [profilePicUrl, setProfilePicUrl] = useState<string | null>(null);
  const [profilePicFile, setProfilePicFile] = useState<File | null>(null);
  const [isEditingUsername, setIsEditingUsername] = useState(false);
  const [favorites, setFavorites] = useState<any[]>([]);
  const [following, setFollowing] = useState<any[]>([]);
  const [posts, setPosts] = useState<any[]>([]);
  const [sellingItems, setSellingItems] = useState<any[]>([]);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      const session = data.session;
      if (!session?.user) return router.push('/login');
      setUser(session.user);
      fetchProfile(session.user.id);
      fetchSellingItems(session.user.id);
    });
  }, []);

  useEffect(() => {
    if (user) {
      fetchFavorites();
      fetchFollowing();
      fetchCommunityPosts();
    }
  }, [user]);

  const fetchProfile = async (userId: string) => {
    const { data } = await supabase.from('profiles').select('*').eq('id', userId).single();
    if (data) {
      setUsername(data.username || '');
      setProfilePicUrl(data.profile_pic_url ? `${data.profile_pic_url}?t=${Date.now()}` : null);

    }
    setLoading(false);
  };

  const fetchFavorites = async () => {
    const saved = JSON.parse(localStorage.getItem('favoriteBusinesses') || '[]');
    if (!saved.length) return;
    const { data } = await supabase.from('Businesses').select('*').in('slug', saved);
    setFavorites(data || []);
  };

  const fetchFollowing = async () => {
    const { data } = await supabase.from('Follows').select('target_id').eq('follower_id', user.id);
    setFollowing(data || []);
  };

  const fetchCommunityPosts = async () => {
    const { data } = await supabase.from('community_posts').select('*').eq('user_id', user.id).order('created_at', { ascending: false });
    setPosts(data || []);
  };

  const fetchSellingItems = async (userId: string) => {
    const { data } = await supabase.from('items_for_sale').select('*').eq('seller_id', userId).order('created_at', { ascending: false });
    setSellingItems(data || []);
  };

  const handleUsernameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setUsername(e.target.value);
  };

  const handleEditUsername = () => {
    setIsEditingUsername(true);
  };

  const handleSaveUsername = async () => {
    if (!username.trim()) {
      toast.error('Username required');
      return;
    }
    const { data: exists } = await supabase
      .from('profiles')
      .select('id')
      .eq('username', username.trim())
      .neq('id', user.id)
      .maybeSingle();

    if (exists) {
      toast.error('Username already taken');
      return;
    }

    const { error } = await supabase.from('profiles').upsert({ id: user.id, username });
    if (error) {
      toast.error('Failed to update username');
    } else {
      toast.success('Username updated');
      setIsEditingUsername(false);
    }
  };

  const uploadProfilePic = async () => {
    if (!profilePicFile) return toast.error('Select a picture');
  
    const formData = new FormData();
    formData.append('id', user.id);
    formData.append('username', username);
    formData.append('file', profilePicFile);
  
    const res = await fetch('/api/update-profile-pic', {
      method: 'POST',
      body: formData,
    });
  
    const result = await res.json();
  
    if (!res.ok || !result.success) {
      toast.error(result.error || 'Upload failed');
      return;
    }
  
    setProfilePicUrl(`${result.url}?t=${Date.now()}`); // ⏱ bust cache
    setProfilePicFile(null);
    toast.success('Profile picture updated');
  };
  
  
  
  const deletePost = async (postId: string) => {
    await supabase.from('community_posts').delete().eq('id', postId);
    fetchCommunityPosts();
  };

  const deleteSellingItem = async (itemId: string) => {
    await supabase.from('items_for_sale').delete().eq('id', itemId);
    fetchSellingItems(user.id);
  };

  if (loading) return <div className="p-8 text-center">Loading...</div>;

  return (
    <div className="min-h-screen bg-gray-100">
      <div className="container mx-auto py-10 px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Left Sidebar */}
          <aside className="md:col-span-1 bg-white rounded-lg shadow-md p-4 sticky top-6">
            <div className="flex items-center space-x-3 mb-6">
              <div className="relative w-10 h-10 rounded-full overflow-hidden bg-gray-200">
                {profilePicUrl ? (
                  <img src={profilePicUrl} alt="avatar" className="w-full h-full object-cover" />
                ) : (
                  <FaUserCircle className="w-full h-full text-gray-400" />
                )}
                <label htmlFor="profile-pic-upload" className="absolute bottom-0 right-0 bg-gray-300 rounded-full p-1 cursor-pointer">
                  <FaCamera className="text-xs text-gray-600" />
                  <input
                    id="profile-pic-upload"
                    type="file"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0] || null;
                      if (file) {
                        setProfilePicFile(file);
                        const reader = new FileReader();
                        reader.onloadend = () => {
                          setProfilePicUrl(reader.result as string); // 📸 show preview
                        };
                        reader.readAsDataURL(file);
                      }
                    }}
                    
                                        ref={fileInputRef}
                  />
                </label>
              </div>
              <div className="flex items-center space-x-2">
                {isEditingUsername ? (
                  <>
                    <input
                      type="text"
                      ref={usernameInputRef}
                      className="shadow appearance-none border rounded w-full py-1 px-2 text-gray-700 leading-tight focus:outline-none focus:shadow-outline text-sm"
                      value={username}
                      onChange={handleUsernameChange}
                    />
                    <button onClick={handleSaveUsername} className="bg-blue-500 hover:bg-blue-700 text-white text-xs font-bold py-1 px-2 rounded focus:outline-none focus:shadow-outline">
                      Save
                    </button>
                  </>
                ) : (
                  <>
                    <h2 className="text-lg font-semibold text-gray-800">{username || 'User'}</h2>
                    <button onClick={handleEditUsername} className="text-gray-500 hover:text-gray-700 focus:outline-none">
                      <FaPencilAlt className="h-4 w-4" />
                    </button>
                  </>
                )}
              </div>
            </div>
            <nav className="space-y-2">
              {SECTIONS.map((section) => (
                <button
                  key={section.name}
                  onClick={() => setActiveSection(section.name)}
                  className={`flex items-center w-full px-3 py-2 rounded-md text-gray-700 hover:bg-gray-100 focus:outline-none focus:bg-gray-100 transition duration-150 ease-in-out ${
                    activeSection === section.name ? 'bg-blue-50 text-blue-700 font-medium' : ''
                  }`}
                >
                  <section.icon className="mr-3 h-5 w-5" />
                  <span>{section.name}</span>
                </button>
              ))}
            </nav>
            {profilePicFile && (
              <button
                onClick={uploadProfilePic}
                className="mt-4 w-full bg-blue-500 hover:bg-blue-600 text-white font-semibold rounded-md shadow-sm py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
              >
                Upload Photo
              </button>
            )}
          </aside>

          {/* Main Content */}
          <main className="md:col-span-2 space-y-6">
            {activeSection === 'Dashboard' && (
              <div className="bg-white rounded-lg shadow-md p-6">
                <h3 className="text-xl font-semibold text-gray-800 mb-4">Your Dashboard</h3>
                {/* Username input and display moved to the sidebar */}
              </div>
            )}

            {activeSection === 'Favorites' && (
              <div className="bg-white rounded-lg shadow-md p-6">
                <h3 className="text-xl font-semibold text-gray-800 mb-4">Your Favorite Businesses</h3>
                {favorites.length === 0 ? (
                  <p className="text-gray-600">No favorites saved yet.</p>
                ) : (
                  <ul className="space-y-3">
                    {favorites.map((b) => (
                      <li key={b.id} className="bg-gray-50 border border-gray-200 rounded-md p-4">
                        {b.business_name}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            {activeSection === 'Following' && (
              <div className="bg-white rounded-lg shadow-md p-6">
                <h3 className="text-xl font-semibold text-gray-800 mb-4">Following</h3>
                <p className="text-gray-600">You are following <span className="font-medium">{following.length}</span> accounts.</p>
                {following.length > 0 && (
                  <ul className="mt-4 space-y-2">
                    {following.map((follow) => (
                      <li key={follow.target_id} className="bg-gray-50 border border-gray-200 rounded-md p-3">
                        User ID: {follow.target_id} {/* Replace with actual user info if available */}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            {activeSection === 'Community Posts' && (
              <div className="bg-white rounded-lg shadow-md p-6">
                <h3 className="text-xl font-semibold text-gray-800 mb-4">Your Community Posts</h3>
                {posts.length === 0 ? (
                  <p className="text-gray-600">No posts created yet.</p>
                ) : (
                  <ul className="space-y-4">
                    {posts.map((post) => (
                      <li key={post.id} className="border border-gray-200 rounded-md p-4 bg-gray-50">
                        <h4 className="font-semibold text-gray-700">{post.title}</h4>
                        <div className="text-sm text-gray-500 mb-2">{new Date(post.created_at).toLocaleDateString()}</div>
                       <div className="flex gap-3">
  <Link href={`/community/post/${post.id}`} className="text-blue-600 hover:underline text-sm font-medium">View</Link>
  <button onClick={() => deletePost(post.id)} className="text-red-600 hover:underline text-sm font-medium">Delete</button>
</div>

                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            {activeSection === 'Items for Sale' && (
              <div className="bg-white rounded-lg shadow-md p-6">
                <h3 className="text-xl font-semibold text-gray-800 mb-4">Your Items for Sale</h3>
                {sellingItems.length === 0 ? (
                  <p className="text-gray-600">No items listed for sale yet.</p>
                ) : (
                  <ul className="space-y-4">
                    {sellingItems.map((item) => (
                      <li key={item.id} className="border border-gray-200 rounded-md p-4 bg-gray-50">
                        <h4 className="font-semibold text-gray-700">{item.name}</h4>
                        <div className="text-gray-600">${item.price}</div>
                        {item.description && <div className="text-sm text-gray-500">{item.description}</div>}
                        <div className="flex gap-3 mt-2">
                          <Link href={`/items/${item.id}`} className="text-blue-600 hover:underline text-sm font-medium">View</Link>
                          <Link href={`/items/${item.id}/edit`} className="text-yellow-600 hover:underline text-sm font-medium">Edit</Link>
                          <button onClick={() => deleteSellingItem(item.id)} className="text-red-600 hover:underline text-sm font-medium">Delete</button>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
                <Link href="/sell" className="mt-4 inline-block bg-green-500 hover:bg-green-600 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline">
                  List New Item
                </Link>
              </div>
            )}
          </main>
        </div>
      </div>
    </div>
  );
}