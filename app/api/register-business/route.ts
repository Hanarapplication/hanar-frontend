import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabaseClient';

export async function POST(req: Request) {
  try {
    const formData = await req.formData();

    const business = {
      business_name: formData.get('business_name') as string,
      slug: formData.get('slug') as string,
      description: formData.get('description') as string,
      category: formData.get('category') as string,
      phone: formData.get('phone') as string,
      email: formData.get('email') as string,
      whatsapp: formData.get('whatsapp') as string,
      website: formData.get('website') as string,
      hours: formData.get('hours') as string,
      address: {
        street: formData.get('address_street') as string,
        city: formData.get('address_city') as string,
        state: formData.get('address_state') as string,
        zip: formData.get('address_zip') as string,
      },
      isRestaurant: formData.get('isRestaurant') === 'true',
      isDealership: formData.get('isDealership') === 'true',
      // You can expand for cars and images if needed
    };

    const { error } = await supabase.from('Businesses').insert([business]);

    if (error) {
      console.error(error);
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true }, { status: 200 });

  } catch (error) {
    console.error('Unexpected error:', error);
    return NextResponse.json({ success: false, error: 'Unexpected server error' }, { status: 500 });
  }
}
