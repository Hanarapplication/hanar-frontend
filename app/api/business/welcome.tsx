// api route for registering accounts as a business

'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';

export default function BusinessOnboardPage() {
  const router = useRouter();
  const [username, setUsername] = useState('');

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUsername(data.user?.user_metadata?.full_name || 'there');
    });
  }, []);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-white p-6">
      <h1 className="text-3xl font-bold text-gray-800 mb-4">Welcome, {username} 👋</h1>
      <p className="text-gray-600 text-center max-w-md mb-6">
        You're almost ready to share your business with the world. Let’s finish setting up your business profile so customers can find you on Hanar.
      </p>
      <button
        onClick={() => router.push('/business-dashboard')}
        className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg text-lg font-semibold"
      >
        Start Business Setup →
      </button>
    </div>
  );
}
