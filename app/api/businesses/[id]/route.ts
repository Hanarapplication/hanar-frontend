import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabaseClient';

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const { data: business, error } = await supabase
      .from('businesses')
      .select('*')
      .eq('id', params.id)
      .single();

    if (error) {
      console.error('Error fetching business:', error);
      return NextResponse.json({ error: 'Failed to fetch business data' }, { status: 500 });
    }

    if (!business) {
      return NextResponse.json({ error: 'Business not found' }, { status: 404 });
    }

    return NextResponse.json(business);
  } catch (error) {
    console.error('Unexpected error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 