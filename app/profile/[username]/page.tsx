'use client';

import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import Link from 'next/link';

export default function ProfilePage() {
  const params = useParams();
  const usernameParam = typeof params?.username === 'string' ? params.username : '';
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
      if (!usernameParam) return;
      setLoading(true);
      const handle = String(usernameParam).replace(/^@/, '');

      try {
        const res = await fetch(`/api/handles/resolve?handle=${encodeURIComponent(handle)}`);
        const result = await res.json();

        if (res.ok && result?.type === 'organization') {
          router.replace(`/organization/${handle}`);
          return;
        }

        if (res.ok && result?.type === 'business') {
          router.replace(`/business/${handle}`);
          return;
        }

        const { data } = await supabase.from('Profiles').select('*').eq('username', handle).single();
        if (data) setProfile(data);
      } catch (error) {
        console.error('Handle resolution failed:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, [usernameParam, router]);

  useEffect(() => {
    if (profile && currentUser) {
      checkIfFollowing();
    }
  }, [profile, currentUser]);

  const checkIfFollowing = async () => {
    const { data } = await supabase
      .from('follows')
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
      <h1 className="text-2xl font-bold">
        <Link href={`/profile/${profile.username}`} className="text-indigo-600 hover:underline">
          @{profile.username}
        </Link>
      </h1>
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
