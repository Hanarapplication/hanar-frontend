import { supabase } from '@/lib/supabaseClient';

/** True when the current session is a Hanar admin (adminaccounts + /api/check-admin). */
export async function checkHanarAdminClient(): Promise<boolean> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;
    if (!token) return false;

    const res = await fetch('/api/check-admin', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({}),
    });

    if (!res.ok) return false;
    const result = await res.json().catch(() => ({}));
    return Boolean(result?.allowed);
  } catch {
    return false;
  }
}
