'use client';

import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useRouter } from 'next/navigation';

export default function PublicProfilePage() {
  const { username } = useParams();
  const router = useRouter();
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isFollowing, setIsFollowing] = useState(false);
  const [currentUser, setCurrentUser] = useState<any>(null);

  useEffect(() => {
    const fetchUser = async () => {
      const { data } = await supabase.auth.getSession();
      setCurrentUser(data?.session?.user || null);
    };
    fetchUser();
  }, []);

  useEffect(() => {
    const fetchProfile = async () => {
      const { data } = await supabase.from('Profiles').select('*').eq('username', username).single();
      if (data) setProfile(data);
      setLoading(false);
    };

    if (username) {
      fetchProfile();
    }
  }, [username]);

  useEffect(() => {
    if (profile && currentUser) {
      checkIfFollowing();
    }
  }, [profile, currentUser]);

  const checkIfFollowing = async () => {
    const { data } = await supabase
      .from('Follows')
      .select('*')
      .eq('follower_id', currentUser.id)
      .eq('following_id', profile.id)
      .single();

    if (data) setIsFollowing(true);
  };

  const handleFollow = async () => {
    if (!currentUser) return;
    await fetch('/api/follow', {
      method: 'POST',
      body: JSON.stringify({ follower_id: currentUser.id, following_id: profile.id }),
    });
    setIsFollowing(true);
  };

  const handleUnfollow = async () => {
    if (!currentUser) return;
    await fetch('/api/unfollow', {
      method: 'POST',
      body: JSON.stringify({ follower_id: currentUser.id, following_id: profile.id }),
    });
    setIsFollowing(false);
  };

  if (loading) return <div className="min-h-screen flex justify-center items-center">Loading...</div>;

  if (!profile) return <div className="min-h-screen flex justify-center items-center text-red-500">User not found.</div>;

  return (
    <div className="min-h-screen p-8 flex flex-col items-center">
      <img
        src={profile.profile_picture ? `https://your-supabase-url-here.storage.supabase.co/storage/v1/object/public/${profile.profile_picture}` : '/default-avatar.png'}
        alt="Profile Picture"
        className="w-24 h-24 rounded-full object-cover mb-4"
      />
      <h1 className="text-2xl font-bold">@{profile.username}</h1>
      <p className="text-gray-600 mt-2">{profile.bio || 'No bio yet.'}</p>
      {currentUser && currentUser.id !== profile.id && (
        <button
          onClick={isFollowing ? handleUnfollow : handleFollow}
          className={`mt-4 px-4 py-2 rounded ${isFollowing ? 'bg-red-500' : 'bg-blue-600'} text-white`}
        >
          {isFollowing ? 'Unfollow' : 'Follow'}
        </button>
      )}
    </div>
  );
}