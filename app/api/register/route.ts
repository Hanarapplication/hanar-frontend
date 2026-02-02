// app/api/register/route.ts
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

/**
 * ✅ FINAL FULL CODE (your route fixed for the plan flow)
 *
 * What changed:
 * - When creating a business row, we explicitly set:
 *   - plan = 'basic'   (free default)
 *   - plan_selected_at = null  (NOT selected yet → forces user to confirm on /business/plan)
 *
 * This matches the new logic:
 * - plan can be auto-assigned
 * - but user must confirm by setting plan_selected_at
 */

type Role = 'individual' | 'business' | 'organization';
type BusinessType = 'retail' | 'restaurant' | 'dealership' | 'other';

function isValidRole(role: any): role is Role {
  return role === 'individual' || role === 'business' || role === 'organization';
}

function isValidBusinessType(t: any): t is BusinessType {
  return t === 'retail' || t === 'restaurant' || t === 'dealership' || t === 'other';
}

function sanitizeName(name: string) {
  return (name || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]/g, '')
    .slice(0, 20);
}

function slugify(input: string) {
  return (input || '')
    .toLowerCase()
    .trim()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 50);
}

export const runtime = 'nodejs';

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL) throw new Error('Missing SUPABASE_URL / NEXT_PUBLIC_SUPABASE_URL');
if (!SERVICE_ROLE_KEY) throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY');

const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

/* ---------------- Username generation ---------------- */

async function usernameExists(username: string): Promise<boolean> {
  const { data, error } = await supabaseAdmin
    .from('registeredaccounts')
    .select('username')
    .eq('username', username)
    .maybeSingle();

  if (error) return true; // safe
  return !!data;
}

async function generateUniqueUsername(baseRaw: string): Promise<string> {
  const base = sanitizeName(baseRaw) || 'user';
  let candidate = base;

  for (let i = 0; i < 25; i++) {
    if (!(await usernameExists(candidate))) return candidate;
    const suffix = Math.floor(Math.random() * 10000);
    candidate = `${base}${suffix}`.slice(0, 20);
  }

  return `${base}${Date.now().toString().slice(-4)}`.slice(0, 20);
}

/* ---------------- Business slug generation ---------------- */

async function businessSlugExists(slug: string): Promise<boolean> {
  const { data, error } = await supabaseAdmin
    .from('businesses')
    .select('slug')
    .eq('slug', slug)
    .maybeSingle();

  if (error) return true; // safe
  return !!data;
}

async function generateUniqueBusinessSlug(businessName: string): Promise<string> {
  const base = slugify(businessName) || 'business';
  let candidate = base;

  for (let i = 0; i < 25; i++) {
    if (!(await businessSlugExists(candidate))) return candidate;
    const suffix = Math.floor(Math.random() * 10000);
    candidate = `${base}-${suffix}`.slice(0, 50);
  }

  return `${base}-${Date.now().toString().slice(-4)}`.slice(0, 50);
}

function getBusinessFlags(businessType?: BusinessType) {
  return {
    isretail: businessType === 'retail',
    isrestaurant: businessType === 'restaurant',
    isdealership: businessType === 'dealership',
  };
}

/* ---------------- Main handler ---------------- */

export async function POST(req: Request) {
  let createdUserId: string | null = null;

  try {
    const body = await req.json().catch(() => null);
    if (!body) {
      return NextResponse.json({ error: 'Invalid JSON body', stage: 'validate' }, { status: 400 });
    }

    const { name, fullName, email, password, role, businessType } = body as {
      name?: string;
      fullName?: string;
      email?: string;
      password?: string;
      role?: Role;
      businessType?: BusinessType;
    };

    const missing: string[] = [];
    if (!name) missing.push('name');
    if (!email) missing.push('email');
    if (!password) missing.push('password');
    if (!role) missing.push('role');

    if (missing.length) {
      return NextResponse.json(
        { error: `Missing fields: ${missing.join(', ')}`, stage: 'validate' },
        { status: 400 }
      );
    }

    if (!isValidRole(role)) {
      return NextResponse.json({ error: `Invalid role: ${String(role)}`, stage: 'validate' }, { status: 400 });
    }

    if (role === 'business' && businessType && !isValidBusinessType(businessType)) {
      return NextResponse.json(
        { error: `Invalid businessType: ${String(businessType)}`, stage: 'validate' },
        { status: 400 }
      );
    }

    const safeFullName = (fullName && fullName.trim()) || String(name).trim();
    const safeEmail = String(email).trim().toLowerCase();
    const safePassword = String(password);

    const username = await generateUniqueUsername(String(name));

    // 1) Create auth user (Admin API)
    const { data: created, error: createErr } = await supabaseAdmin.auth.admin.createUser({
      email: safeEmail,
      password: safePassword,
      email_confirm: true,
      user_metadata: {
        full_name: safeFullName,
        role,
        ...(role === 'business' && businessType ? { businessType } : {}),
      },
    });

    if (createErr) {
      const msg = (createErr.message || '').toLowerCase();
      const isDup =
        msg.includes('already') || msg.includes('registered') || msg.includes('exists') || msg.includes('email');

      return NextResponse.json(
        { error: isDup ? 'An account with this email already exists' : createErr.message, stage: 'auth' },
        { status: isDup ? 409 : 400 }
      );
    }

    createdUserId = created.user.id;

    // 2) Insert into registeredaccounts
    const { error: regErr } = await supabaseAdmin.from('registeredaccounts').insert({
      user_id: createdUserId,
      username,
      email: safeEmail,
      full_name: safeFullName,
      business: role === 'business',
      organization: role === 'organization',
    });

    if (regErr) {
      try {
        await supabaseAdmin.from('registeredaccounts').delete().eq('user_id', createdUserId);
      } catch {}
      try {
        await supabaseAdmin.auth.admin.deleteUser(createdUserId);
      } catch {}

      return NextResponse.json(
        { error: regErr.message || 'Failed to save registered account', stage: 'db_registeredaccounts' },
        { status: 500 }
      );
    }

    // 3) Role-specific tables
    let businessSlug: string | null = null;

    if (role === 'individual') {
      const { error: profErr } = await supabaseAdmin.from('profiles').insert({
        id: createdUserId,
        username,
      });

      if (profErr) {
        try {
          await supabaseAdmin.from('profiles').delete().eq('id', createdUserId);
        } catch {}
        try {
          await supabaseAdmin.from('registeredaccounts').delete().eq('user_id', createdUserId);
        } catch {}
        try {
          await supabaseAdmin.auth.admin.deleteUser(createdUserId);
        } catch {}

        return NextResponse.json({ error: profErr.message || 'Failed to create profile', stage: 'db_profiles' }, { status: 500 });
      }
    }

    if (role === 'business') {
      businessSlug = await generateUniqueBusinessSlug(String(name));
      const flags = getBusinessFlags(businessType);

      // Free plan defaults (from business_plans table)
      // These must be set during INSERT to satisfy check constraints
      const freePlanDefaults = {
        max_gallery_images: 1,
        max_menu_items: 0,
        max_retail_items: 0,
        max_car_listings: 0,
        allow_social_links: false,
        allow_whatsapp: false,
        allow_promoted: false,
        allow_reviews: false,
        allow_qr: false,
      };

      const { data: businessData, error: bizErr } = await supabaseAdmin.from('businesses').insert({
        business_name: String(name).trim(),
        slug: businessSlug,
        owner_id: createdUserId,
        email: safeEmail,

        // Your existing status fields
        status: 'pending',
        business_status: 'pending',

        // ✅ Plan flow fix:
        // basic can be default, but NOT "chosen" until user confirms on /business/plan
        plan: 'free',
        plan_selected_at: null,

        // ✅ Free plan limits - set during INSERT to satisfy check constraints
        ...freePlanDefaults,

        // business type flags (columns must exist)
        ...flags,
      }).select('id').single();

      if (bizErr) {
        try {
          await supabaseAdmin.from('businesses').delete().eq('owner_id', createdUserId);
        } catch {}
        try {
          await supabaseAdmin.from('registeredaccounts').delete().eq('user_id', createdUserId);
        } catch {}
        try {
          await supabaseAdmin.auth.admin.deleteUser(createdUserId);
        } catch {}

        return NextResponse.json({ error: bizErr.message || 'Failed to create business row', stage: 'db_businesses' }, { status: 500 });
      }

      // ✅ Apply free plan limits after business creation to satisfy check constraints
      if (businessData?.id) {
        const { error: planErr } = await supabaseAdmin.rpc('apply_business_plan', {
          p_business_id: businessData.id,
          p_plan: 'free',
          p_years: 1,
        });

        if (planErr) {
          console.error('Failed to apply free plan limits:', planErr);
          // Don't fail registration if plan application fails, but log it
          // The user can still select a plan later
        }
      }
    }

    if (role === 'organization') {
      const { error: orgErr } = await supabaseAdmin.from('organizations').insert({
        user_id: createdUserId,
        username,
        email: safeEmail,
        full_name: safeFullName,
      });

      if (orgErr) {
        try {
          await supabaseAdmin.from('organizations').delete().eq('user_id', createdUserId);
        } catch {}
        try {
          await supabaseAdmin.from('registeredaccounts').delete().eq('user_id', createdUserId);
        } catch {}
        try {
          await supabaseAdmin.auth.admin.deleteUser(createdUserId);
        } catch {}

        return NextResponse.json({ error: orgErr.message || 'Failed to create organization row', stage: 'db_organizations' }, { status: 500 });
      }
    }

    return NextResponse.json({ success: true, username, role, slug: businessSlug }, { status: 200 });
  } catch (err: any) {
    console.error('Unexpected error:', err);

    // Last-resort cleanup
    if (createdUserId) {
      try {
        await supabaseAdmin.from('profiles').delete().eq('id', createdUserId);
      } catch {}
      try {
        await supabaseAdmin.from('businesses').delete().eq('owner_id', createdUserId);
      } catch {}
      try {
        await supabaseAdmin.from('organizations').delete().eq('user_id', createdUserId);
      } catch {}
      try {
        await supabaseAdmin.from('registeredaccounts').delete().eq('user_id', createdUserId);
      } catch {}
      try {
        await supabaseAdmin.auth.admin.deleteUser(createdUserId);
      } catch {}
    }

    return NextResponse.json({ error: 'Internal Server Error', stage: 'server' }, { status: 500 });
  }
}
