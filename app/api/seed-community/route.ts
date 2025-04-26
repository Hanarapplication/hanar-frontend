import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import postsData from '@/public/data/hanar_community_seed_posts.json';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST() {
  try {
    const { posts } = postsData;
    const { data, error } = await supabase
    .from('community_posts')
    .insert(posts)
    .select();
  
  console.log('🔥 Error details:', error);
  console.log('🧪 First post sample:', posts[0]);
  

    if (error) {
      console.error('❌ Supabase error:', error.message);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    console.log('✅ Inserted:', data.length);
    return NextResponse.json({ message: `✅ ${data.length} posts inserted.` });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
