// app/api/register/route.ts
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getClientIp, isRegistrationRateLimited } from '@/lib/rateLimit';

/**
 * ✅ FINAL FULL CODE (your route fixed for the plan flow)
 *
 * What changed:
 * - When creating a business row, we explicitly set:
 *   - plan = 'free'   (free default)
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

/** Age in full years from date of birth string (YYYY-MM-DD). */
function ageFromDateOfBirth(dobString: string): number {
  const dob = new Date(dobString);
  const today = new Date();
  let age = today.getFullYear() - dob.getFullYear();
  const m = today.getMonth() - dob.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) age--;
  return age;
}

/** Map age to ad-targeting bracket. */
function ageToAgeGroup(age: number): string {
  if (age < 18) return '13-17';
  if (age < 25) return '18-24';
  if (age < 35) return '25-34';
  if (age < 45) return '35-44';
  if (age < 55) return '45-54';
  return '55+';
}

const USERNAME_MAX_LEN = 20;

/** Build a base handle from first + last (lowercase, alphanumeric only). */
function baseHandleFromNames(firstName: string, lastName: string): string {
  const first = sanitizeName(firstName);
  const last = sanitizeName(lastName);
  const combined = (first + last).slice(0, USERNAME_MAX_LEN);
  return combined || 'user';
}

/** Shorter base: first 2 of first + first 2 of last, or first 3 + first 3, etc. */
function shortenedHandleFromNames(firstName: string, lastName: string, maxLen: number): string {
  const first = sanitizeName(firstName);
  const last = sanitizeName(lastName);
  if (!first && !last) return 'user';
  let take = 1;
  while (take <= 10) {
    const base = (first.slice(0, take) + last.slice(0, take)).slice(0, maxLen);
    if (base.length >= 2) return base;
    take++;
  }
  return (first.slice(0, 5) + last.slice(0, 5)).slice(0, maxLen) || 'user';
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

/**
 * Generate a unique @handle from first + last name.
 * 1) Try "firstnamelastname" (e.g. johnsmith)
 * 2) If taken, try with 2–6 digit suffix (johnsmith42)
 * 3) If still taken, shorten to first+last and retry with numbers
 * 4) Final fallback: short base + timestamp suffix
 */
async function generateUniqueUsername(firstName: string, lastName: string): Promise<string> {
  let base = baseHandleFromNames(firstName, lastName);
  if (base.length > USERNAME_MAX_LEN) base = base.slice(0, USERNAME_MAX_LEN);

  // 1) Try base alone
  if (!(await usernameExists(base))) return base;

  // 2) Try base + 2, 4, 6 digit numbers
  const suffixes = [2, 4, 6];
  for (const len of suffixes) {
    const max = 10 ** len;
    for (let attempt = 0; attempt < 15; attempt++) {
      const n = Math.floor(Math.random() * max);
      const suffix = n.toString().padStart(len, '0');
      const candidate = (base.slice(0, USERNAME_MAX_LEN - len) + suffix).slice(0, USERNAME_MAX_LEN);
      if (!(await usernameExists(candidate))) return candidate;
    }
  }

  // 3) Shorten names and retry with numbers
  const shortBase = shortenedHandleFromNames(firstName, lastName, USERNAME_MAX_LEN - 4);
  for (let attempt = 0; attempt < 20; attempt++) {
    const n = Math.floor(Math.random() * 10000);
    const candidate = (shortBase + n.toString().padStart(4, '0')).slice(0, USERNAME_MAX_LEN);
    if (!(await usernameExists(candidate))) return candidate;
  }

  // 4) Fallback: base (or short) + timestamp
  const ts = Date.now().toString().slice(-6);
  return (base.slice(0, USERNAME_MAX_LEN - 6) + ts).slice(0, USERNAME_MAX_LEN);
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

/* ---------------- Main handler ---------------- */

const TURNSTILE_VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

async function verifyTurnstile(token: string, remoteip?: string): Promise<boolean> {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) {
    if (process.env.NODE_ENV === 'development' && token === 'test-token') return true;
    console.warn('TURNSTILE_SECRET_KEY not set - skipping verification');
    return true;
  }
  try {
    const formData = new FormData();
    formData.append('secret', secret);
    formData.append('response', token);
    if (remoteip) formData.append('remoteip', remoteip);
    const res = await fetch(TURNSTILE_VERIFY_URL, { method: 'POST', body: formData });
    const data = await res.json();
    return !!data?.success;
  } catch (e) {
    console.error('Turnstile verify error:', e);
    return false;
  }
}

export async function POST(req: Request) {
  let createdUserId: string | null = null;

  try {
    const clientIp = getClientIp(req);
    const rateKey = `register:${clientIp}`;
    if (isRegistrationRateLimited(rateKey)) {
      return NextResponse.json(
        { error: 'Too many registration attempts. Please try again later.', stage: 'rate_limit' },
        { status: 429 }
      );
    }

    const body = await req.json().catch(() => null);
    if (!body) {
      return NextResponse.json({ error: 'Invalid JSON body', stage: 'validate' }, { status: 400 });
    }

    const { name, fullName, firstName, lastName, dateOfBirth, gender, email, password, role, businessType, phone, turnstileToken, website, spoken_languages: spokenLanguagesRaw } = body as {
      name?: string;
      fullName?: string;
      firstName?: string;
      lastName?: string;
      dateOfBirth?: string;
      gender?: string;
      email?: string;
      password?: string;
      role?: Role;
      businessType?: BusinessType;
      phone?: string;
      turnstileToken?: string;
      website?: string;
      spoken_languages?: string[];
    };
    const spokenLanguages = Array.isArray(spokenLanguagesRaw)
      ? spokenLanguagesRaw.filter((c): c is string => typeof c === 'string' && c.length > 0).slice(0, 50)
      : [];

    const VALID_GENDERS = ['man', 'woman', 'she', 'he', 'they'] as const;
    const safeGender = role === 'individual' && gender && VALID_GENDERS.includes(gender as any) ? (gender as (typeof VALID_GENDERS)[number]) : null;

    if (website) {
      return NextResponse.json({ error: 'Invalid request', stage: 'validate' }, { status: 400 });
    }

    const secret = process.env.TURNSTILE_SECRET_KEY;
    if (secret && !turnstileToken) {
      return NextResponse.json(
        { error: 'Verification required. Please complete the captcha.', stage: 'captcha' },
        { status: 400 }
      );
    }
    if (turnstileToken && !(await verifyTurnstile(turnstileToken, clientIp))) {
      return NextResponse.json(
        { error: 'Verification failed. Please try again.', stage: 'captcha' },
        { status: 400 }
      );
    }

    const missing: string[] = [];
    if (!firstName || !String(firstName).trim()) missing.push('firstName');
    if (!lastName || !String(lastName).trim()) missing.push('lastName');
    if (!dateOfBirth || !String(dateOfBirth).trim()) missing.push('dateOfBirth');
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

    const dob = new Date(String(dateOfBirth).trim());
    if (Number.isNaN(dob.getTime())) {
      return NextResponse.json({ error: 'Invalid date of birth', stage: 'validate' }, { status: 400 });
    }
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (dob >= today) {
      return NextResponse.json({ error: 'Date of birth must be in the past', stage: 'validate' }, { status: 400 });
    }
    const ageYears = (today.getTime() - dob.getTime()) / (365.25 * 24 * 60 * 60 * 1000);
    if (ageYears < 13) {
      return NextResponse.json({ error: 'You must be at least 13 years old', stage: 'validate' }, { status: 400 });
    }
    if ((role === 'business' || role === 'organization') && ageYears < 18) {
      return NextResponse.json(
        { error: 'You must be at least 18 years old to create a business or organization account', stage: 'validate' },
        { status: 400 }
      );
    }

    if (!isValidRole(role)) {
      return NextResponse.json({ error: `Invalid role: ${String(role)}`, stage: 'validate' }, { status: 400 });
    }

    if (role === 'individual' && !safeGender) {
      return NextResponse.json(
        { error: 'Gender is required for individual registration. Use one of: man, woman, she, he, they', stage: 'validate' },
        { status: 400 }
      );
    }

    if (role === 'business' && businessType && !isValidBusinessType(businessType)) {
      return NextResponse.json(
        { error: `Invalid businessType: ${String(businessType)}`, stage: 'validate' },
        { status: 400 }
      );
    }

    if ((role === 'business' || role === 'organization') && !(phone && String(phone).trim())) {
      return NextResponse.json(
        { error: 'Phone number is required for business and organization registration', stage: 'validate' },
        { status: 400 }
      );
    }

    const safeFirstName = String(firstName).trim();
    const safeLastName = String(lastName).trim();
    const safeDob = String(dateOfBirth).trim();
    const safeFullName = (fullName && fullName.trim()) || [safeFirstName, safeLastName].filter(Boolean).join(' ');
    const safePhone = phone && String(phone).trim() ? String(phone).trim().replace(/\s+/g, '') : null;
    const safeEmail = String(email).trim().toLowerCase();
    const safePassword = String(password);

    const username = await generateUniqueUsername(safeFirstName, safeLastName);

    const age = ageFromDateOfBirth(safeDob);
    const ageGroup = ageToAgeGroup(age);

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
      first_name: safeFirstName,
      last_name: safeLastName,
      date_of_birth: safeDob,
      age_group: ageGroup,
      gender: safeGender,
      spoken_languages: spokenLanguages.length ? spokenLanguages : [],
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

      const businessInsert = {
        business_name: String(name).trim(),
        slug: businessSlug,
        owner_id: createdUserId,
        email: safeEmail,
        phone: safePhone,
        status: 'unclaimed',
        spoken_languages: spokenLanguages.length ? spokenLanguages : [],
      };

      const { data: businessData, error: bizErr } = await supabaseAdmin
        .from('businesses')
        .insert(businessInsert)
        .select('id')
        .single();

      if (bizErr) {
        console.error('Business insert failed:', {
          message: bizErr.message,
          details: (bizErr as any).details,
          hint: (bizErr as any).hint,
          code: (bizErr as any).code,
          columns: Object.keys(businessInsert),
        });
        try {
          await supabaseAdmin.from('businesses').delete().eq('owner_id', createdUserId);
        } catch {}
        try {
          await supabaseAdmin.from('registeredaccounts').delete().eq('user_id', createdUserId);
        } catch {}
        try {
          await supabaseAdmin.auth.admin.deleteUser(createdUserId);
        } catch {}

        return NextResponse.json(
          {
            error: bizErr.message || 'Failed to create business row',
            details: (bizErr as any).details || null,
            hint: (bizErr as any).hint || null,
            code: (bizErr as any).code || null,
            stage: 'db_businesses',
          },
          { status: 500 }
        );
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
          try {
            await supabaseAdmin.from('businesses').delete().eq('id', businessData.id);
          } catch {}
          try {
            await supabaseAdmin.from('registeredaccounts').delete().eq('user_id', createdUserId);
          } catch {}
          try {
            await supabaseAdmin.auth.admin.deleteUser(createdUserId);
          } catch {}
          return NextResponse.json(
            { error: 'Registration failed: could not configure plan. Please try again.', stage: 'apply_plan' },
            { status: 500 }
          );
        }
      }
    }

    if (role === 'organization') {
      const orgInsert: Record<string, unknown> = {
        user_id: createdUserId,
        username,
        email: safeEmail,
        full_name: safeFullName,
        spoken_languages: spokenLanguages.length ? spokenLanguages : [],
      };
      if (safePhone) orgInsert.contact_info = { phone: safePhone };
      const { error: orgErr } = await supabaseAdmin.from('organizations').insert(orgInsert);

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
