import { NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';

/**
 * GET /api/user/audience-segment
 * Returns the current user's audience segment for ad targeting (e.g. age_group).
 * Use this when requesting or rendering targeted ads in the app.
 */
export async function GET() {
  try {
    const supabase = createRouteHandlerClient({ cookies });
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ age_group: null, gender: null, preferred_language: null, spoken_languages: [], segment: null }, { status: 200 });
    }

    const { data: account, error } = await supabase
      .from('registeredaccounts')
      .select('age_group, gender, preferred_language, spoken_languages')
      .eq('user_id', user.id)
      .maybeSingle();

    if (error) {
      return NextResponse.json({ age_group: null, gender: null, preferred_language: null, spoken_languages: null, segment: null }, { status: 200 });
    }

    const ageGroup = account?.age_group ?? null;
    const gender = account?.gender ?? null;
    const preferred_language = account?.preferred_language ?? null;
    const spoken_languages = Array.isArray(account?.spoken_languages) ? account.spoken_languages : null;
    const segment = (ageGroup || gender || preferred_language || (spoken_languages && spoken_languages.length > 0))
      ? { age_group: ageGroup, gender, preferred_language: preferred_language === 'auto' ? null : preferred_language, spoken_languages } : null;

    return NextResponse.json({
      age_group: ageGroup,
      gender,
      preferred_language: preferred_language === 'auto' ? null : preferred_language,
      spoken_languages: spoken_languages || [],
      segment,
    });
  } catch {
    return NextResponse.json({ age_group: null, gender: null, preferred_language: null, spoken_languages: null, segment: null }, { status: 200 });
  }
}
