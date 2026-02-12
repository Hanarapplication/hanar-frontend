import { NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SERVICE_ROLE_KEY) throw new Error('Missing Supabase env');

const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false } });

async function getAuthUserId(req: Request): Promise<string | null> {
  try {
    const cookieStore = await cookies();
    const supabaseAuth = createRouteHandlerClient({
      cookies: () => Promise.resolve(cookieStore),
    });
    const { data: { user } } = await supabaseAuth.auth.getUser();
    if (user?.id) return String(user.id).toLowerCase();
  } catch {
    // Cookie-based auth failed, try Bearer token
  }
  const authHeader = req.headers.get('authorization') || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
  if (!token) return null;
  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !data?.user?.id) return null;
  return String(data.user.id).toLowerCase();
}

/** GET: insights (view counts) for the authenticated business owner. */
export async function GET(req: Request) {
  try {
    const userId = await getAuthUserId(req);
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const businessId = searchParams.get('business_id');
    if (!businessId) return NextResponse.json({ error: 'business_id required' }, { status: 400 });

    const { data: biz, error: bizError } = await supabaseAdmin
      .from('businesses')
      .select('id, owner_id, view_count, plan')
      .eq('id', businessId)
      .single();

    const ownerId = biz?.owner_id != null ? String(biz.owner_id).toLowerCase() : '';
    if (bizError || !biz || ownerId !== userId) {
      return NextResponse.json({ error: 'Forbidden or not found' }, { status: 403 });
    }

    const businessViews = Number(biz.view_count) || 0;

    const [retailRes, dealershipRes, promoRes, blastRes, followerRes] = (
      await Promise.allSettled([
        supabaseAdmin.from('retail_items').select('view_count').eq('business_id', businessId),
        supabaseAdmin.from('dealerships').select('view_count').eq('business_id', businessId),
        supabaseAdmin
          .from('business_promotion_requests')
          .select('feed_banner_id')
          .eq('business_id', businessId)
          .not('feed_banner_id', 'is', null),
        supabaseAdmin
          .from('area_blast_outbox')
          .select('id, created_at, data')
          .eq('business_id', businessId)
          .order('created_at', { ascending: false }),
        supabaseAdmin
          .from('notifications')
          .select('id, created_at')
          .eq('type', 'business_update')
          .contains('data', { business_id: businessId }),
      ])
    ).map((p) => (p.status === 'fulfilled' ? p.value : { data: [], error: { message: 'query failed' } }));

    const retailItemViews = (retailRes.data || []).reduce((sum, r) => sum + (Number((r as any).view_count) || 0), 0);
    const dealershipViews = (dealershipRes.data || []).reduce((sum, d) => sum + (Number((d as any).view_count) || 0), 0);
    const totalItemViews = retailItemViews + dealershipViews;

    const bannerIds = (promoRes.data || [])
      .map((r: { feed_banner_id?: string | null }) => r.feed_banner_id)
      .filter(Boolean) as string[];

    let feedBanners: { id: string; view_count: number }[] = [];
    if (bannerIds.length > 0) {
      const { data: banners } = await supabaseAdmin
        .from('feed_banners')
        .select('id, view_count')
        .in('id', bannerIds);
      feedBanners = (banners || []).map((b: any) => ({
        id: b.id,
        view_count: Number(b.view_count) || 0,
      }));
    }
    const totalAdBannerViews = feedBanners.reduce((s, b) => s + b.view_count, 0);

    // Notification stats: sent count and by day for charts
    const blastRows = (blastRes.data || []) as { id: string; created_at: string; data?: { sent_count?: number } }[];
    const followerRows = (followerRes.data || []) as { id: string; created_at: string }[];
    const notificationsSentBlast = blastRows.length;
    const notificationsSentFollower = followerRows.length;
    const notificationsSent = notificationsSentBlast + notificationsSentFollower;
    const totalBlastRecipients = blastRows.reduce((s, r) => s + (Number(r.data?.sent_count) || 0), 0);

    const dayMap: Record<string, { sent: number; blast: number; follower: number }> = {};
    const addDay = (dateStr: string, blast = 0, follower = 0) => {
      if (!dayMap[dateStr]) dayMap[dateStr] = { sent: 0, blast: 0, follower: 0 };
      dayMap[dateStr].sent += blast + follower;
      dayMap[dateStr].blast += blast;
      dayMap[dateStr].follower += follower;
    };
    blastRows.forEach((r) => {
      const d = new Date(r.created_at);
      const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      addDay(dateStr, 1, 0);
    });
    followerRows.forEach((r) => {
      const d = new Date(r.created_at);
      const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      addDay(dateStr, 0, 1);
    });
    const sentByDay = Object.entries(dayMap)
      .map(([date, v]) => ({ date, ...v }))
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(-30);

    return NextResponse.json({
      businessViews,
      retailItemViews,
      dealershipViews,
      totalItemViews,
      feedBanners,
      totalAdBannerViews,
      notificationsSent,
      notificationsSentBlast,
      notificationsSentFollower,
      totalBlastRecipients,
      notificationsViewed: 0,
      blastViewed: 0,
      sentByDay,
      plan: (biz as any).plan || null,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unexpected error';
    console.error('[business/insights]', err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
