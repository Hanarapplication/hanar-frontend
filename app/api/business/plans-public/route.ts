import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/** Public list of business plans with all limits and features for display in package modal. */
export async function GET() {
  try {
    const { data: rows, error } = await supabaseAdmin
      .from('business_plans')
      .select(
        'plan, price_yearly, max_gallery_images, max_menu_items, max_retail_items, max_car_listings, max_real_estate_listings, ' +
        'allow_social_links, allow_whatsapp, allow_promoted, allow_reviews, allow_qr, ' +
        'follower_notifications_enabled, max_follower_notifications_per_week, max_follower_notifications_per_day, ' +
        'min_minutes_between_notifications, max_area_blasts_per_month, area_blast_requires_admin_approval, max_blast_radius_miles'
      )
      .order('price_yearly', { ascending: true });

    if (error) {
      console.error('[plans-public]', error.message);
      return NextResponse.json({ error: 'Failed to load plans' }, { status: 500 });
    }

    const plans = (rows || []).map((row: unknown) => {
      const r = row as Record<string, unknown>;
      const plan = String(r.plan || '').toLowerCase();
      const price = r.price_yearly != null ? String(r.price_yearly) : '0';

      const maxGallery = r.max_gallery_images != null ? Number(r.max_gallery_images) : 0;
      const maxMenu = r.max_menu_items != null ? Number(r.max_menu_items) : 0;
      const maxRetail = r.max_retail_items != null ? Number(r.max_retail_items) : 0;
      // Car and real estate: free 0, starter 5, growth 10, premium 999 (from DB; floor starter at 5)
      let maxCarListings = r.max_car_listings != null ? Number(r.max_car_listings) : 0;
      if (plan === 'starter' && maxCarListings < 5) maxCarListings = 5;
      let maxRealEstateListings = r.max_real_estate_listings != null ? Number(r.max_real_estate_listings) : maxCarListings;
      if (plan === 'starter' && maxRealEstateListings < 5) maxRealEstateListings = 5;
      const limits: { label: string; value: string | number }[] = [
        { label: 'Gallery images', value: maxGallery >= 9999 ? 'Unlimited' : maxGallery },
        { label: 'Menu items', value: maxMenu >= 9999 ? 'Unlimited' : maxMenu },
        { label: 'Retail items', value: maxRetail >= 9999 ? 'Unlimited' : maxRetail },
        { label: 'Dealership listings', value: maxCarListings >= 9999 ? 'Unlimited' : maxCarListings },
        { label: 'Real estate listings', value: maxRealEstateListings >= 9999 ? 'Unlimited' : maxRealEstateListings },
        { label: 'Follower notifications / week', value: Number(r.max_follower_notifications_per_week ?? 0) },
        { label: 'Follower notifications / day', value: Number(r.max_follower_notifications_per_day ?? 0) },
        { label: 'Min minutes between notifications', value: Number(r.min_minutes_between_notifications ?? 0) },
        { label: 'Area blasts / month', value: Number(r.max_area_blasts_per_month ?? 0) },
        { label: 'Max blast radius (miles)', value: Number(r.max_blast_radius_miles ?? 0) },
        { label: 'Area blast approval', value: r.area_blast_requires_admin_approval ? 'Required' : 'Not required' },
      ];

      const hasCustomWebsite = plan !== 'free';
      const hasBusinessAnalytics = plan === 'growth' || plan === 'premium';
      const hasAdvertisingPromotion = plan === 'premium';

      const features: { label: string; enabled: boolean }[] = [
        { label: 'Social media links', enabled: !!r.allow_social_links },
        { label: 'WhatsApp', enabled: !!r.allow_whatsapp },
        { label: 'Promoted listing', enabled: !!r.allow_promoted },
        { label: 'Reviews', enabled: !!r.allow_reviews },
        { label: 'QR code', enabled: !!r.allow_qr },
        { label: 'Custom website link', enabled: hasCustomWebsite },
        { label: 'Follower notifications', enabled: !!r.follower_notifications_enabled },
        { label: 'Business analytics', enabled: hasBusinessAnalytics },
        { label: 'Advertising & promotion', enabled: hasAdvertisingPromotion },
      ];

      return {
        plan: plan || 'free',
        name: (plan || 'free').charAt(0).toUpperCase() + (plan || 'free').slice(1),
        price_yearly: price,
        limits,
        features,
      };
    });

    return NextResponse.json({ plans });
  } catch (err) {
    console.error('[plans-public]', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
