import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { sendHanarEmail } from '@/lib/email/sendHanarEmail';

/**
 * Vercel Cron / scheduled job entrypoint for Hanar expiration reminder emails.
 *
 * Security: requires header `Authorization: Bearer ${CRON_SECRET}`.
 * Uses Supabase service role + centralized sendHanarEmail (Resend + email_logs).
 */

export const dynamic = 'force-dynamic';

const MS_PER_DAY = 86400000;

function getEnv(name) {
  const v = process.env[name];
  return v && String(v).trim() ? String(v).trim() : '';
}

/**
 * Paid plan end takes precedence over trial end when present.
 * @param {{ plan_expires_at?: string | null; trial_end?: string | null }} row
 * @returns {Date | null}
 */
function effectiveBusinessExpiration(row) {
  const plan = row.plan_expires_at;
  if (plan != null && String(plan).trim() !== '') {
    const d = new Date(plan);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  const trial = row.trial_end;
  if (trial != null && String(trial).trim() !== '') {
    const d = new Date(trial);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  return null;
}

/**
 * @param {Date} exp
 * @param {Date} now
 * @returns {'expired' | 'reminder_3' | 'reminder_7' | null}
 */
function classifyReminderWindow(exp, now) {
  const daysUntil = (exp.getTime() - now.getTime()) / MS_PER_DAY;
  if (daysUntil < 0) return 'expired';
  if (daysUntil <= 3) return 'reminder_3';
  if (daysUntil <= 7) return 'reminder_7';
  return null;
}

/**
 * @param {'business' | 'marketplace'} entity
 * @param {'expired' | 'reminder_3' | 'reminder_7'} windowKind
 */
function expirationTemplateTag(entity, windowKind) {
  const prefix = entity === 'business' ? 'expiration_business' : 'expiration_marketplace';
  if (windowKind === 'expired') return `${prefix}_expired`;
  if (windowKind === 'reminder_3') return `${prefix}_3`;
  return `${prefix}_7`;
}

/**
 * @param {'business' | 'marketplace'} entity
 * @param {'expired' | 'reminder_3' | 'reminder_7'} windowKind
 */
function expirationEmailTags(entity, windowKind) {
  const template = expirationTemplateTag(entity, windowKind);
  return [{ name: 'template', value: template }];
}

async function resolveBusinessRecipientEmail(supabaseAdmin, row) {
  const direct = row.email != null && String(row.email).trim() !== '' ? String(row.email).trim() : '';
  if (direct) return direct;
  if (!row.owner_id) return null;
  const { data, error } = await supabaseAdmin.auth.admin.getUserById(row.owner_id);
  if (error || !data?.user?.email) return null;
  return String(data.user.email).trim();
}

async function resolveAuthUserEmail(supabaseAdmin, userId) {
  if (!userId) return null;
  const { data, error } = await supabaseAdmin.auth.admin.getUserById(userId);
  if (error || !data?.user?.email) return null;
  return String(data.user.email).trim();
}

function verifyCronSecret(request) {
  const expected = getEnv('CRON_SECRET');
  if (!expected) return false;
  const auth = request.headers.get('authorization') || '';
  const m = auth.match(/^Bearer\s+(.+)$/i);
  return Boolean(m && m[1] === expected);
}

/**
 * Safe skip-reason keys (no PII): missing_email | missing_expiration |
 * not_in_reminder_window | already_sent | missing_owner_id
 * @returns {Record<string, number>}
 */
function emptySkipReasonBucket() {
  return {
    missing_email: 0,
    missing_expiration: 0,
    not_in_reminder_window: 0,
    already_sent: 0,
    missing_owner_id: 0,
  };
}

/**
 * Increment skip counters for debugging. Each skipped row should call this once
 * with a single reason (first matching condition wins — no duplicate counts per row).
 * @param {{ skipped: number; skipReasons: { businesses: Record<string, number>; marketplace_items: Record<string, number> } }} summary
 * @param {'businesses' | 'marketplace_items'} entity
 * @param {'missing_email' | 'missing_expiration' | 'not_in_reminder_window' | 'already_sent' | 'missing_owner_id'} reason
 */
function recordSkip(summary, entity, reason) {
  summary.skipped += 1;
  summary.skipReasons[entity][reason] += 1;
}

/**
 * @param {{ to: string; subject: string; html: string; tags: { name: string; value: string }[]; logUserId?: string | null }} args
 * @returns {Promise<{ success: boolean; error?: string }>}
 */
async function sendExpirationEmail(args) {
  const result = await sendHanarEmail({
    to: args.to,
    subject: args.subject,
    html: args.html,
    tags: args.tags,
    ...(args.logUserId ? { logUserId: args.logUserId } : {}),
  });
  if (result.success) return { success: true };
  return { success: false, error: result.error || 'sendHanarEmail failed' };
}

export async function GET(request) {
  return handleCron(request);
}

export async function POST(request) {
  return handleCron(request);
}

async function handleCron(request) {
  const summary = {
    businessesChecked: 0,
    marketplaceItemsChecked: 0,
    emailsSent: 0,
    skipped: 0,
    /** Counts of why rows were skipped (no emails, tokens, or auth payloads). */
    skipReasons: {
      businesses: emptySkipReasonBucket(),
      marketplace_items: emptySkipReasonBucket(),
    },
    errors: [],
  };

  if (!verifyCronSecret(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabaseUrl = getEnv('NEXT_PUBLIC_SUPABASE_URL') || getEnv('SUPABASE_URL');
  const serviceKey = getEnv('SUPABASE_SERVICE_ROLE_KEY');
  const resendKey = getEnv('RESEND_API_KEY');

  if (!supabaseUrl || !serviceKey) {
    return NextResponse.json(
      { error: 'Missing NEXT_PUBLIC_SUPABASE_URL (or SUPABASE_URL) or SUPABASE_SERVICE_ROLE_KEY' },
      { status: 500 }
    );
  }
  if (!resendKey) {
    return NextResponse.json({ error: 'Missing RESEND_API_KEY' }, { status: 500 });
  }

  const supabaseAdmin = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const now = new Date();

  // --- Businesses ---
  const { data: businesses, error: bizErr } = await supabaseAdmin
    .from('businesses')
    .select(
      'id, business_name, email, owner_id, plan_expires_at, trial_end, reminder_7_sent, reminder_3_sent, expired_email_sent'
    )
    .not('owner_id', 'is', null);

  if (bizErr) {
    summary.errors.push({ scope: 'businesses', stage: 'select', message: bizErr.message });
  } else {
    for (const row of businesses || []) {
      summary.businessesChecked += 1;
      try {
        // Defensive: query already excludes null owner_id; still counted for observability if data drifts.
        if (!row.owner_id) {
          recordSkip(summary, 'businesses', 'missing_owner_id');
          continue;
        }

        const exp = effectiveBusinessExpiration(row);
        if (!exp) {
          recordSkip(summary, 'businesses', 'missing_expiration');
          continue;
        }

        const windowKind = classifyReminderWindow(exp, now);
        /** @type {'reminder_7_sent' | 'reminder_3_sent' | 'expired_email_sent' | null} */
        let flagToSet = null;
        /** @type {string | null} */
        let subject = null;
        /** @type {string | null} */
        let html = null;

        if (windowKind === 'expired') {
          if (row.expired_email_sent) {
            recordSkip(summary, 'businesses', 'already_sent');
            continue;
          }
          flagToSet = 'expired_email_sent';
          const name = row.business_name || 'your business';
          subject = `Hanar: plan or trial expired — ${name}`;
          html = `<p>Your Hanar business plan or trial for <strong>${escapeHtml(name)}</strong> has expired.</p><p>Sign in to Hanar to renew and keep your features active.</p>`;
        } else if (windowKind === 'reminder_3') {
          if (row.reminder_3_sent) {
            recordSkip(summary, 'businesses', 'already_sent');
            continue;
          }
          flagToSet = 'reminder_3_sent';
          const name = row.business_name || 'your business';
          subject = `Hanar: 3 days left — ${name}`;
          html = `<p>Your Hanar plan or trial for <strong>${escapeHtml(name)}</strong> ends in 3 days (${escapeHtml(exp.toISOString())}).</p><p>Renew soon to avoid interruption.</p>`;
        } else if (windowKind === 'reminder_7') {
          if (row.reminder_7_sent) {
            recordSkip(summary, 'businesses', 'already_sent');
            continue;
          }
          flagToSet = 'reminder_7_sent';
          const name = row.business_name || 'your business';
          subject = `Hanar: 7 days left — ${name}`;
          html = `<p>Your Hanar plan or trial for <strong>${escapeHtml(name)}</strong> ends in 7 days (${escapeHtml(exp.toISOString())}).</p><p>You can renew from your Hanar dashboard.</p>`;
        } else {
          // Outside reminder windows and not expired → nothing to do
          recordSkip(summary, 'businesses', 'not_in_reminder_window');
          continue;
        }

        const to = await resolveBusinessRecipientEmail(supabaseAdmin, row);
        if (!to) {
          recordSkip(summary, 'businesses', 'missing_email');
          continue;
        }

        const sendResult = await sendExpirationEmail({
          to,
          subject,
          html,
          tags: expirationEmailTags('business', windowKind),
          logUserId: row.owner_id,
        });
        if (!sendResult.success) {
          summary.errors.push({
            scope: 'business',
            id: row.id,
            stage: 'send',
            message: sendResult.error || 'send failed',
          });
          continue;
        }

        const { error: upErr } = await supabaseAdmin.from('businesses').update({ [flagToSet]: true }).eq('id', row.id);
        if (upErr) {
          summary.errors.push({ scope: 'business', id: row.id, stage: 'update', message: upErr.message });
          continue;
        }
        summary.emailsSent += 1;
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        summary.errors.push({ scope: 'business', id: row.id, stage: 'send', message: msg });
      }
    }
  }

  // --- Marketplace items (explicit expires_at only) ---
  const { data: items, error: itemErr } = await supabaseAdmin
    .from('marketplace_items')
    .select('id, title, user_id, expires_at, reminder_7_sent, reminder_3_sent, expired_email_sent')
    .not('expires_at', 'is', null)
    .is('archived_at', null);

  if (itemErr) {
    summary.errors.push({ scope: 'marketplace_items', stage: 'select', message: itemErr.message });
  } else {
    for (const row of items || []) {
      summary.marketplaceItemsChecked += 1;
      try {
        if (!row.user_id) {
          recordSkip(summary, 'marketplace_items', 'missing_owner_id');
          continue;
        }

        const exp = new Date(row.expires_at);
        if (Number.isNaN(exp.getTime())) {
          recordSkip(summary, 'marketplace_items', 'missing_expiration');
          continue;
        }

        const windowKind = classifyReminderWindow(exp, now);
        /** @type {'reminder_7_sent' | 'reminder_3_sent' | 'expired_email_sent' | null} */
        let flagToSet = null;
        let subject = /** @type {string | null} */ (null);
        let html = /** @type {string | null} */ (null);

        if (windowKind === 'expired') {
          if (row.expired_email_sent) {
            recordSkip(summary, 'marketplace_items', 'already_sent');
            continue;
          }
          flagToSet = 'expired_email_sent';
          const t = row.title || 'Your listing';
          subject = `Hanar: marketplace listing expired — ${t}`;
          html = `<p>Your Hanar marketplace listing <strong>${escapeHtml(t)}</strong> has expired.</p><p>You can create a new listing from the marketplace any time.</p>`;
        } else if (windowKind === 'reminder_3') {
          if (row.reminder_3_sent) {
            recordSkip(summary, 'marketplace_items', 'already_sent');
            continue;
          }
          flagToSet = 'reminder_3_sent';
          const t = row.title || 'Your listing';
          subject = `Hanar: listing expires in 3 days — ${t}`;
          html = `<p>Your listing <strong>${escapeHtml(t)}</strong> expires in 3 days (${escapeHtml(exp.toISOString())}).</p><p>Renew or edit it from Hanar if you want it to stay visible.</p>`;
        } else if (windowKind === 'reminder_7') {
          if (row.reminder_7_sent) {
            recordSkip(summary, 'marketplace_items', 'already_sent');
            continue;
          }
          flagToSet = 'reminder_7_sent';
          const t = row.title || 'Your listing';
          subject = `Hanar: listing expires in 7 days — ${t}`;
          html = `<p>Your listing <strong>${escapeHtml(t)}</strong> expires in 7 days (${escapeHtml(exp.toISOString())}).</p><p>Visit Hanar to extend or update your listing.</p>`;
        } else {
          recordSkip(summary, 'marketplace_items', 'not_in_reminder_window');
          continue;
        }

        const to = await resolveAuthUserEmail(supabaseAdmin, row.user_id);
        if (!to) {
          recordSkip(summary, 'marketplace_items', 'missing_email');
          continue;
        }

        const sendResult = await sendExpirationEmail({
          to,
          subject,
          html,
          tags: expirationEmailTags('marketplace', windowKind),
          logUserId: row.user_id,
        });
        if (!sendResult.success) {
          summary.errors.push({
            scope: 'marketplace_item',
            id: row.id,
            stage: 'send',
            message: sendResult.error || 'send failed',
          });
          continue;
        }

        const { error: upErr } = await supabaseAdmin.from('marketplace_items').update({ [flagToSet]: true }).eq('id', row.id);
        if (upErr) {
          summary.errors.push({ scope: 'marketplace_item', id: row.id, stage: 'update', message: upErr.message });
          continue;
        }
        summary.emailsSent += 1;
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        summary.errors.push({ scope: 'marketplace_item', id: row.id, stage: 'send', message: msg });
      }
    }
  }

  return NextResponse.json(summary);
}

/** @param {string} s */
function escapeHtml(s) {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
