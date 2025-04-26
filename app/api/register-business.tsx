import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabaseClient';

export async function POST(req: Request) {
  const formData = await req.formData();

  try {
    // Extract normal fields
    const business_name = formData.get('business_name') as string;
    const description = formData.get('description') as string;
    const category = formData.get('category') as string;
    const phone = formData.get('phone') as string;
    const email = formData.get('email') as string;
    const whatsapp = formData.get('whatsapp') as string;
    const website = formData.get('website') as string;
    const hours = formData.get('hours') as string;
    const address = {
      street: formData.get('address_street') as string,
      city: formData.get('address_city') as string,
      state: formData.get('address_state') as string,
      zip: formData.get('address_zip') as string,
    };
    const isRestaurant = formData.get('isRestaurant') === 'true';
    const isDealership = formData.get('isDealership') === 'true';

    // Handle uploaded business images
    const imagesFiles = formData.getAll('images') as File[];

    const businessImageUrls: string[] = [];

    for (const file of imagesFiles) {
      const { data, error } = await supabase.storage.from('business-images').upload(`business/${Date.now()}-${file.name}`, file);
      if (error) {
        console.error('Error uploading business image:', error);
      } else {
        businessImageUrls.push(data.path);
      }
    }

    // Handle cars if dealership
    const cars = [];

    if (isDealership) {
      let index = 0;
      while (formData.get(`cars[${index}][title]`)) {
        const title = formData.get(`cars[${index}][title]`) as string;
        const description = formData.get(`cars[${index}][description]`) as string;
        const price = formData.get(`cars[${index}][price]`) as string;
        const year = formData.get(`cars[${index}][year]`) as string;
        const mileage = formData.get(`cars[${index}][mileage]`) as string;
        const condition = formData.get(`cars[${index}][condition]`) as string;

        const carImagesFiles = formData.getAll(`cars[${index}][images]`) as File[];
        const carImageUrls: string[] = [];

        for (const file of carImagesFiles) {
          const { data, error } = await supabase.storage.from('business-images').upload(`cars/${Date.now()}-${file.name}`, file);
          if (error) {
            console.error('Error uploading car image:', error);
          } else {
            carImageUrls.push(data.path);
          }
        }

        cars.push({
          title,
          description,
          price,
          year,
          mileage,
          condition,
          images: carImageUrls
        });

        index++;
      }
    }

    // Insert into Supabase database
    const { data: business, error: insertError } = await supabase.from('Businesses').insert({
      business_name,
      description,
      category,
      phone,
      email,
      whatsapp,
      website,
      hours,
      address,
      images: businessImageUrls,
      isRestaurant,
      isDealership,
      cars
    }).single();

    if (insertError) {
      console.error('Insert error:', insertError);
      return NextResponse.json({ success: false, error: insertError.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, business }, { status: 200 });

  } catch (error) {
    console.error('Unexpected error:', error);
    return NextResponse.json({ success: false, error: 'Unexpected server error.' }, { status: 500 });
  }
}
