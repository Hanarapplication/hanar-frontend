/**
 * Supabase helper: upsert FCM token into push_tokens for web push.
 * Table: push_tokens (id, user_id, token, platform, device_info, created_at, updated_at).
 */
import { supabase } from '@/lib/supabaseClient';

export type PushTokenUpsert = {
  user_id: string;
  token: string;
  platform?: string;
  device_info?: Record<string, unknown> | null;
};

export async function upsertPushToken(
  userId: string,
  token: string,
  options?: { platform?: string; device_info?: Record<string, unknown> | null }
): Promise<{ ok: boolean; error?: string }> {
  const platform = options?.platform ?? 'web';
  const device_info = options?.device_info ?? null;
  const updated_at = new Date().toISOString();

  const { error } = await supabase.from('push_tokens').upsert(
    {
      user_id: userId,
      token,
      platform,
      device_info,
      updated_at,
    },
    { onConflict: 'token' }
  );

  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function removePushToken(token: string): Promise<{ ok: boolean; error?: string }> {
  const { error } = await supabase.from('push_tokens').delete().eq('token', token);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
