import { createClient } from '@supabase/supabase-js';

export type TranslationUsageEntry = {
  endpointName: string;
  userId?: string | null;
  ipAddress?: string | null;
  sourceLanguage?: string | null;
  targetLanguage?: string | null;
  characterCount?: number;
  textPreview?: string | null;
  cacheHit?: boolean;
  reason?: string | null;
  paidCall?: boolean;
  blocked?: boolean;
};

function createSupabaseAdminClient() {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) return null;
  return createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });
}

export async function logTranslationUsage(entry: TranslationUsageEntry): Promise<void> {
  try {
    const supabaseAdmin = createSupabaseAdminClient();
    if (!supabaseAdmin) return;
    const preview = String(entry.textPreview || '').slice(0, 80);
    const { error } = await supabaseAdmin.from('translation_usage_logs').insert({
      endpoint_name: entry.endpointName,
      user_id: entry.userId || null,
      ip_address: entry.ipAddress || null,
      source_language: entry.sourceLanguage || null,
      target_language: entry.targetLanguage || null,
      character_count: Math.max(0, Number(entry.characterCount || 0)),
      text_preview: preview || null,
      cache_hit: !!entry.cacheHit,
      reason: entry.reason || null,
      paid_call: !!entry.paidCall,
      blocked: !!entry.blocked,
    });
    if (error) {
      console.error('[translation-usage] insert error', error);
    }
  } catch (error) {
    console.error('[translation-usage] unexpected error', error);
  }
}
