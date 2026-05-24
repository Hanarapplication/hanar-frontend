import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { verifyAdminAccount } from '@/lib/admin/verifyAdminAccount';
import { REPORT_ENTITY_TYPES, type ReportEntityType } from '@/lib/admin/reportTypes';

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) throw new Error('Missing Supabase env');

const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

/** GET: pending unread counts for admin inbox sidebar. */
export async function GET(req: Request) {
  try {
    const admin = await verifyAdminAccount(req, supabaseAdmin);
    if (!admin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const [claimsResult, businessClaimContactResult, contactUsResult, reportsResult] = await Promise.all([
      supabaseAdmin
        .from('business_claims')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'pending'),
      supabaseAdmin
        .from('contact_submissions')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'pending')
        .eq('source', 'business_claim'),
      supabaseAdmin
        .from('contact_submissions')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'pending')
        .eq('source', 'contact'),
      supabaseAdmin.from('reports').select('entity_type, status'),
    ]);

    if (claimsResult.error) {
      return NextResponse.json({ error: claimsResult.error.message }, { status: 500 });
    }
    if (businessClaimContactResult.error) {
      return NextResponse.json({ error: businessClaimContactResult.error.message }, { status: 500 });
    }
    if (contactUsResult.error) {
      return NextResponse.json({ error: contactUsResult.error.message }, { status: 500 });
    }
    if (reportsResult.error) {
      return NextResponse.json({ error: reportsResult.error.message }, { status: 500 });
    }

    const pendingEmailClaims = claimsResult.count ?? 0;
    const pendingContactForm = businessClaimContactResult.count ?? 0;
    const contactUs = contactUsResult.count ?? 0;
    const businessClaims = pendingEmailClaims + pendingContactForm;

    const reportsByType = Object.fromEntries(
      REPORT_ENTITY_TYPES.map((type) => [type, 0])
    ) as Record<ReportEntityType, number>;

    const reportsByTypeTotal = Object.fromEntries(
      REPORT_ENTITY_TYPES.map((type) => [type, 0])
    ) as Record<ReportEntityType, number>;

    for (const row of reportsResult.data || []) {
      const type = row.entity_type as ReportEntityType;
      if (!(type in reportsByTypeTotal)) continue;
      reportsByTypeTotal[type] += 1;
      if (row.status === 'unread') {
        reportsByType[type] += 1;
      }
    }

    const reports = Object.values(reportsByType).reduce((sum, n) => sum + n, 0);
    const reportsTotal = Object.values(reportsByTypeTotal).reduce((sum, n) => sum + n, 0);
    const inbox = businessClaims + contactUs + reports;

    return NextResponse.json({
      pendingEmailClaims,
      pendingContactForm,
      contactUs,
      businessClaims,
      reports,
      reportsTotal,
      reportsByType,
      reportsByTypeTotal,
      inbox,
    });
  } catch (err) {
    console.error('admin inbox counts GET:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
