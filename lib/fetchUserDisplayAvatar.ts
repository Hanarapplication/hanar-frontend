import { normalizeAvatarUrl } from '@/lib/avatarUrl';
import { supabase } from '@/lib/supabaseClient';

/** Profile / org / business image for map pins and chrome (matches home feed + Navbar). */
export async function fetchUserDisplayAvatarUrl(userId: string): Promise<string | null> {
  const [{ data: profile }, { data: org }, { data: business }] = await Promise.all([
    supabase
      .from('profiles')
      .select('profile_pic_url, avatar_url')
      .eq('id', userId)
      .maybeSingle(),
    supabase.from('organizations').select('logo_url').eq('user_id', userId).maybeSingle(),
    supabase
      .from('businesses')
      .select('logo_url')
      .eq('owner_id', userId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  return (
    normalizeAvatarUrl(profile?.profile_pic_url, ['avatars']) ||
    normalizeAvatarUrl(profile?.avatar_url, ['avatars']) ||
    normalizeAvatarUrl(org?.logo_url, ['organizations', 'organization-uploads']) ||
    normalizeAvatarUrl(business?.logo_url, ['business-uploads']) ||
    null
  );
}
