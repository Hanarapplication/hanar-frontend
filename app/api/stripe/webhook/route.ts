import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

const stripeSecret = process.env.STRIPE_SECRET_KEY;
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const stripe = stripeSecret ? new Stripe(stripeSecret) : null;
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, { auth: { persistSession: false } });

const PACK_DAYS = 40;

export async function POST(req: Request) {
  if (!stripeSecret || !webhookSecret || !stripe) {
    return NextResponse.json({ error: 'Webhook not configured' }, { status: 500 });
  }
  const body = await req.text();
  const sig = req.headers.get('stripe-signature');
  if (!sig) return NextResponse.json({ error: 'Missing signature' }, { status: 400 });

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, webhookSecret);
  } catch (err) {
    console.error('[stripe-webhook] Signature verification failed:', err);
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  try {
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as Stripe.Checkout.Session;
      const meta = session.metadata || {};
      const type = meta.type as string;

      if (type === 'business_plan') {
        const businessId = meta.business_id as string;
        const plan = meta.plan as string;
        if (!businessId || !plan) {
          console.error('[stripe-webhook] Missing business_id or plan');
          return NextResponse.json({ ok: true });
        }

        const { error: rpcErr } = await supabaseAdmin.rpc('apply_business_plan', {
          p_business_id: businessId,
          p_plan: plan,
          p_years: 1,
        });
        if (rpcErr) {
          console.error('[stripe-webhook] apply_business_plan failed:', rpcErr);
          return NextResponse.json({ ok: true });
        }

        const nowIso = new Date().toISOString();
        const isPremiumTrial = plan === 'premium' && session.subscription;
        const trialEnd = isPremiumTrial
          ? new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString()
          : null;

        await supabaseAdmin
          .from('businesses')
          .update({
            plan,
            plan_selected_at: nowIso,
            ...(isPremiumTrial ? { trial_start: nowIso, trial_end: trialEnd } : {}),
          })
          .eq('id', businessId);
      } else if (type === 'casual_pack') {
        const userId = meta.user_id as string;
        if (!userId) {
          console.error('[stripe-webhook] Missing user_id for casual_pack');
          return NextResponse.json({ ok: true });
        }

        const { data: existing } = await supabaseAdmin
          .from('individual_listing_packs')
          .select('pack_expires_at')
          .eq('user_id', userId)
          .maybeSingle();

        const now = new Date();
        const baseExpiry =
          existing?.pack_expires_at && new Date(existing.pack_expires_at) > now
            ? new Date(existing.pack_expires_at)
            : now;
        const newExpires = new Date(baseExpiry);
        newExpires.setDate(newExpires.getDate() + PACK_DAYS);

        await supabaseAdmin
          .from('individual_listing_packs')
          .upsert(
            {
              user_id: userId,
              pack_expires_at: newExpires.toISOString(),
              updated_at: now.toISOString(),
            },
            { onConflict: 'user_id' }
          );
      } else if (type === 'promotion') {
        const requestId = (meta.promotion_request_id ?? meta.promotionRequestId) as string | undefined;
        if (requestId) {
          const { data: updated, error: upErr } = await supabaseAdmin
            .from('business_promotion_requests')
            .update({ status: 'pending_review', updated_at: new Date().toISOString() })
            .eq('id', requestId)
            .eq('status', 'pending_payment')
            .select('id');
          if (upErr) console.error('[stripe-webhook] business promotion status update failed:', upErr);
          else console.log('[stripe-webhook] promotion updated to pending_review:', requestId, 'rows:', updated?.length ?? 0);
        } else {
          console.warn('[stripe-webhook] promotion event but no promotion_request_id in metadata:', JSON.stringify(meta));
        }
      } else if (type === 'org_promotion') {
        const requestId = (meta.org_promotion_request_id ?? meta.orgPromotionRequestId) as string | undefined;
        if (requestId) {
          await supabaseAdmin
            .from('organization_promotion_requests')
            .update({ status: 'pending_review', updated_at: new Date().toISOString() })
            .eq('id', requestId)
            .eq('status', 'pending_payment');
        }
      }
    }

    return NextResponse.json({ received: true });
  } catch (err) {
    console.error('[stripe-webhook]', err);
    return NextResponse.json({ error: 'Webhook handler failed' }, { status: 500 });
  }
}
