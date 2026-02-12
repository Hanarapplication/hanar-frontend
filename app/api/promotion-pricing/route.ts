import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SERVICE_ROLE_KEY) throw new Error('Missing Supabase env');
const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false } });

/** Public: get promotion pricing matrix (tier × duration) */
export async function GET() {
  try {
    const { data, error } = await supabase
      .from('promotion_pricing')
      .select('tier, duration_days, price_cents, label, sort_order')
      .order('tier')
      .order('sort_order');

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const byTier: Record<string, { duration_days: number; price_cents: number; label: string }[]> = {};
    for (const row of data || []) {
      if (!byTier[row.tier]) byTier[row.tier] = [];
      byTier[row.tier].push({
        duration_days: row.duration_days,
        price_cents: row.price_cents,
        label: row.label || `${row.duration_days} days`,
      });
    }
    return NextResponse.json({ pricing: byTier, rows: data || [] });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unexpected error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
