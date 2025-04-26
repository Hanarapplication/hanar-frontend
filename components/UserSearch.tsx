'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';

export default function UserSearch() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const router = useRouter();

  const handleSearch = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setQuery(value);

    if (value.length >= 2) {
      const { data, error } = await supabase
        .from('Profiles')
        .select('username')
        .ilike('username', `%${value}%`);

      if (data) setResults(data);
    } else {
      setResults([]);
    }
  };

  const goToProfile = (username: string) => {
    router.push(`/@${username}`);
  };

  return (
    <div className="relative w-full max-w-md">
      <input
        type="text"
        value={query}
        onChange={handleSearch}
        placeholder="Search users..."
        className="w-full border p-2 rounded"
      />
      {results.length > 0 && (
        <div className="absolute w-full bg-white shadow-lg rounded mt-1 max-h-60 overflow-y-auto">
          {results.map((user) => (
            <div
              key={user.username}
              onClick={() => goToProfile(user.username)}
              className="p-2 hover:bg-gray-100 cursor-pointer"
            >
              @{user.username}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}