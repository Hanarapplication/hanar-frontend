import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function createSupabaseAdminClient() {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) return null;
  return createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });
}

export async function GET(request: NextRequest) {
  try {
    const expectedSecret = String(process.env.ADMIN_TRANSLATION_SECRET || '').trim();
    const providedSecret = String(request.headers.get('x-admin-translation-secret') || '').trim();
    if (!expectedSecret || !providedSecret || providedSecret !== expectedSecret) {
      return NextResponse.json({ error: 'Forbidden.' }, { status: 403 });
    }

    const supabaseAdmin = createSupabaseAdminClient();
    if (!supabaseAdmin) {
      return NextResponse.json({ error: 'Server is not configured.' }, { status: 500 });
    }

    const todayStartIso = new Date(new Date().setHours(0, 0, 0, 0)).toISOString();
    const { data, error } = await supabaseAdmin
      .from('translation_usage_logs')
      .select('endpoint_name, character_count, paid_call, blocked')
      .gte('created_at', todayStartIso);

    if (error) {
      console.error('[admin translation usage] read error', error);
      return NextResponse.json({ error: 'Failed to load translation usage.' }, { status: 500 });
    }

    const rows = Array.isArray(data) ? data : [];
    const usageByEndpoint: Record<string, { attempts: number; paidCalls: number; blockedCalls: number; characters: number }> = {};

    rows.forEach((row) => {
      const endpointName = String((row as { endpoint_name?: string }).endpoint_name || 'unknown');
      if (!usageByEndpoint[endpointName]) {
        usageByEndpoint[endpointName] = {
          attempts: 0,
          paidCalls: 0,
          blockedCalls: 0,
          characters: 0,
        };
      }
      usageByEndpoint[endpointName].attempts += 1;
      usageByEndpoint[endpointName].paidCalls += (row as { paid_call?: boolean }).paid_call ? 1 : 0;
      usageByEndpoint[endpointName].blockedCalls += (row as { blocked?: boolean }).blocked ? 1 : 0;
      usageByEndpoint[endpointName].characters += Number((row as { character_count?: number }).character_count || 0);
    });

    const totalAttempts = rows.length;
    const paidCalls = rows.filter((row) => Boolean((row as { paid_call?: boolean }).paid_call)).length;
    const blockedCalls = rows.filter((row) => Boolean((row as { blocked?: boolean }).blocked)).length;
    const totalCharacters = rows.reduce(
      (sum, row) => sum + Number((row as { character_count?: number }).character_count || 0),
      0
    );

    return NextResponse.json({
      date: todayStartIso.slice(0, 10),
      totalAttempts,
      paidCalls,
      blockedCalls,
      totalCharacters,
      usageByEndpoint,
    });
  } catch (error) {
    console.error('[admin translation usage] unexpected error', error);
    return NextResponse.json({ error: 'Server error.' }, { status: 500 });
  }
}
