import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { STRIPE_PRICES, getPromoPriceId } from '@/lib/stripePrices';

const stripeSecret = process.env.STRIPE_SECRET_KEY;
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!stripeSecret) throw new Error('Missing STRIPE_SECRET_KEY');

const stripe = new Stripe(stripeSecret);
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, { auth: { persistSession: false } });

async function getAuthUserId(req: Request): Promise<string | null> {
  const supabaseAuth = createRouteHandlerClient({ cookies });
  const { data: { user } } = await supabaseAuth.auth.getUser();
  if (user?.id) return user.id;
  const authHeader = req.headers.get('authorization') || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
  if (!token) return null;
  const { data } = await supabaseAdmin.auth.getUser(token);
  return data?.user?.id ?? null;
}

function baseUrl(req: Request): string {
  const host = req.headers.get('host') || 'hanar.net';
  const proto = req.headers.get('x-forwarded-proto') || 'https';
  return `${proto}://${host}`;
}

/** POST: create Stripe Checkout Session for business plan, casual pack, or promotion */
export async function POST(req: Request) {
  try {
    const userId = await getAuthUserId(req);
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const type = (body.type as string)?.toLowerCase();
    const base = baseUrl(req);

    if (type === 'business_plan') {
      const plan = (body.plan as string)?.toLowerCase();
      const businessId = (body.businessId as string)?.trim();
      if (!businessId || !['starter', 'growth', 'premium'].includes(plan)) {
        return NextResponse.json({ error: 'Invalid plan or businessId' }, { status: 400 });
      }

      const priceId = STRIPE_PRICES[plan as keyof typeof STRIPE_PRICES];
      if (!priceId || typeof priceId !== 'string') {
        return NextResponse.json({ error: 'Stripe price not configured for this plan' }, { status: 500 });
      }

      const { data: biz } = await supabaseAdmin
        .from('businesses')
        .select('id, owner_id')
        .eq('id', businessId)
        .single();
      if (!biz || biz.owner_id !== userId) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }

      const session = await stripe.checkout.sessions.create({
        mode: 'subscription',
        payment_method_types: ['card'],
        line_items: [{ price: priceId, quantity: 1 }],
        success_url: `${base}/business/plan?success=1&session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${base}/business/plan`,
        client_reference_id: `business_plan:${businessId}:${plan}`,
        metadata: { type: 'business_plan', business_id: businessId, plan },
      });

      return NextResponse.json({ url: session.url });
    }

    if (type === 'casual_pack') {
      const priceId = STRIPE_PRICES.casualPack;
      if (!priceId) return NextResponse.json({ error: 'Stripe price not configured for Casual Seller Pack' }, { status: 500 });

      const { data: biz } = await supabaseAdmin
        .from('businesses')
        .select('id')
        .eq('owner_id', userId)
        .maybeSingle();
      if (biz?.id) {
        return NextResponse.json({ error: 'Business accounts do not use listing packs' }, { status: 400 });
      }

      const session = await stripe.checkout.sessions.create({
        mode: 'subscription',
        payment_method_types: ['card'],
        line_items: [{ price: priceId, quantity: 1 }],
        success_url: `${base}/dashboard?success=1&session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${base}/dashboard`,
        client_reference_id: `casual_pack:${userId}`,
        metadata: { type: 'casual_pack', user_id: userId },
      });

      return NextResponse.json({ url: session.url });
    }

    if (type === 'promotion') {
      const tier = (body.tier as string)?.toLowerCase();
      const durationDays = parseInt(String(body.durationDays || 30), 10);
      const businessId = (body.businessId as string)?.trim();
      const promotionRequestId = (body.promotionRequestId as string)?.trim();
      if (!['basic', 'targeted', 'premium'].includes(tier) || !businessId) {
        return NextResponse.json({ error: 'Invalid promotion params' }, { status: 400 });
      }

      const priceId = getPromoPriceId(tier as 'basic' | 'targeted' | 'premium', durationDays);
      if (!priceId) return NextResponse.json({ error: 'Stripe price not configured for this promotion' }, { status: 500 });

      const { data: biz } = await supabaseAdmin
        .from('businesses')
        .select('id, owner_id')
        .eq('id', businessId)
        .single();
      if (!biz || biz.owner_id !== userId) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }

      const session = await stripe.checkout.sessions.create({
        mode: 'payment',
        payment_method_types: ['card'],
        line_items: [{ price: priceId, quantity: 1 }],
        success_url: `${base}/business-dashboard/promote?success=1&session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${base}/business-dashboard/promote`,
        client_reference_id: promotionRequestId || `promo:${businessId}:${tier}:${durationDays}`,
        metadata: {
          type: 'promotion',
          business_id: businessId,
          tier,
          duration_days: String(durationDays),
          ...(promotionRequestId ? { promotion_request_id: promotionRequestId } : {}),
        },
      });

      return NextResponse.json({ url: session.url });
    }

    return NextResponse.json({ error: 'Invalid type' }, { status: 400 });
  } catch (err: unknown) {
    console.error('[create-checkout-session]', err);
    const message = err instanceof Error ? err.message : 'Server error';
    return NextResponse.json({ error: String(message) }, { status: 500 });
  }
}
