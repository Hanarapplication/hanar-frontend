import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

function sanitizeName(name: string) {
  return name.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 20);
}

async function generateUniqueUsername(base: string): Promise<string> {
  let username = base;
  let exists = true;

  for (let i = 0; i < 5 && exists; i++) {
    const { data } = await supabase
      .from('registeredaccounts')
      .select('username')
      .eq('username', username)
      .single();

    exists = !!data;
    if (exists) {
      const suffix = Math.floor(Math.random() * 10000);
      username = `${base}${suffix}`;
    }
  }

  return username;
}

export async function POST(req: Request) {
  try {
    const { name, fullName, email, password, role } = await req.json();

    if (!name || !email || !password || !role) {
      return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
    }

    const baseUsername = sanitizeName(name);
    const username = await generateUniqueUsername(baseUsername);

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName },
      },
    });

    if (error || !data.user) {
      return NextResponse.json({ error: error?.message || 'Signup failed' }, { status: 400 });
    }

    const user_id = data.user.id;

    const insert = {
      user_id,
      username,
      email,
      full_name: fullName,
      business: role === 'business',
      organization: role === 'organization',
    };

    const { error: insertError } = await supabase
      .from('registeredaccounts')
      .insert([insert]);

    if (insertError) {
      console.error('Insert error:', insertError);
      return NextResponse.json({ error: 'Failed to save user profile' }, { status: 500 });
    }

    return NextResponse.json({ success: true, username, role }, { status: 200 });

  } catch (err: any) {
    console.error('Unexpected error:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
