import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabaseClient';
import { cookies } from 'next/headers';
import { createServerActionClient } from '@supabase/auth-helpers-nextjs';

export async function POST(req: Request) {
  try {
    const supabaseServer = createServerActionClient({ cookies });
    const {
      data: { user },
      error: authError,
    } = await supabaseServer.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    // Parse the JSON body directly, as the client is sending a JSON object,
    // not FormData for all fields, especially after image pre-upload.
    // However, if the client is still using FormData for the main submission,
    // we need to adapt. Given the previous client code, it's likely still FormData.
    // Let's assume FormData is still used for the top-level submission,
    // but the image *files* are no longer directly in it, only their URLs.
    const formData = await req.formData();
    const slug = formData.get('slug') as string;

    if (!slug) {
      return NextResponse.json({ success: false, error: 'Missing slug.' }, { status: 400 });
    }

    // Confirm ownership
    const { data: business, error: fetchError } = await supabase
      .from('businesses') // Correct table name
      .select('owner_id')
      .eq('slug', slug)
      .single();

    if (fetchError || business?.owner_id !== user.id) {
      return NextResponse.json({ success: false, error: 'Forbidden: Not your business' }, { status: 403 });
    }

    const updates: any = {};

    // Directly assign scalar fields from formData
    // Note: Client-side sends 'business_name', 'description', etc. directly.
    const scalarFields = [
      'business_name', 'description', 'category', 'phone', 'email',
      'whatsapp', 'website', 'facebook', 'instagram', 'twitter', 'tiktok',
      'logo_url' // This is now a URL string from client-side upload
    ];
    for (const field of scalarFields) {
      const val = formData.get(field);
      // Ensure we only update if the value is provided and is a string
      if (typeof val === 'string') {
        updates[field] = val;
      }
    }

    // Parse JSON stringified fields
    const jsonFields = ['address', 'hours', 'menu', 'carListings', 'retailItems', 'images']; // 'images' is the main gallery
    for (const field of jsonFields) {
      const val = formData.get(field);
      if (typeof val === 'string') {
        try {
          updates[field] = JSON.parse(val);
        } catch (parseError) {
          console.error(`Error parsing JSON for field ${field}:`, parseError);
          return NextResponse.json({ success: false, error: `Invalid JSON for ${field}` }, { status: 400 });
        }
      } else {
        // Handle cases where a field might be missing or not a string (e.g., if it's null/undefined)
        // For arrays, ensure they default to empty array if not provided or invalid
        if (['menu', 'carListings', 'retailItems', 'images'].includes(field)) {
          updates[field] = [];
        } else {
          updates[field] = null; // Or appropriate default for objects/scalars
        }
      }
    }

    // Note: The client-side handles all file uploads (logo, gallery, item images)
    // and sends their public URLs in the JSON payload.
    // So, we no longer need the server-side upload logic here.
    // The `logo_url` and `images` (for gallery) are directly in `updates` after parsing.
    // The `menu`, `carListings`, `retailItems` arrays already contain image URLs as part of their objects.

    // Update the record in Supabase
    const { error: updateError } = await supabase
      .from('businesses') // Correct table name
      .update(updates)
      .eq('slug', slug);

    if (updateError) {
      console.error('Supabase update error:', updateError);
      return NextResponse.json({ success: false, error: updateError.message }, { status: 500 });
    }

    return NextResponse.json({ success: true }, { status: 200 });

  } catch (err) {
    console.error('Unexpected server error:', err);
    return NextResponse.json({ success: false, error: 'An unexpected server error occurred.' }, { status: 500 });
  }
}
