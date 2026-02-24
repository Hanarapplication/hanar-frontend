# Change Plan: Google Places Unclaimed Business Import

## A) Codebase Scan Summary

### Where businesses table is defined/migrated
- **Supabase types**: `app/api/types/supabase.ts` (Row type; no CREATE TABLE in migrations—table exists in Supabase)
- **Migrations**: All existing migrations use `ALTER TABLE businesses`; no base schema in repo

### Where business rows are inserted
- `app/api/admin/create-business/route.ts` – admin creates business + user
- `app/api/register/route.ts` – user registers as business

### Where owner_id is treated as required
- `app/api/types/supabase.ts` – `owner_id: string`
- `app/business/[slug]/page.tsx` – `BusinessType.owner_id: string`
- `app/api/admin/send-login-emails/route.ts` – uses `resolveEmail(data.owner_id)` without null check
- `app/api/admin/send-business-emails/route.ts` – `if (b.owner_id)` before resolveAuthEmails
- `app/api/admin/area-blasts/route.ts` – `business.owner_id` in filter (null-safe: `userId !== null` is true)
- `lib/sendApprovalNotification.ts` – already has `if (!biz?.owner_id) return null`

### Where listing visibility is filtered
- `app/page.tsx` – `.eq('moderation_status','active').eq('is_archived',false).neq('lifecycle_status','archived')`
- `app/businesses/page.tsx` – same
- `app/business/[slug]/page.tsx` – `.in('moderation_status',['active','on_hold']).eq('is_archived',false).neq('lifecycle_status','archived')`
- `app/api/admin/dashboard-counts/route.ts` – `on_hold` count
- `app/admin/approvals/page.tsx` – fetches for approval queue

---

## B) Impacted Files

| File | Change |
|------|--------|
| `supabase/migrations/add_google_places_import.sql` | **NEW** – Add columns, make owner_id nullable |
| `app/api/types/supabase.ts` | owner_id \| null, add google_place_id, google_rating, google_user_ratings_total |
| `types/business.ts` | owner_id optional, add google_place_id |
| `app/business/[slug]/page.tsx` | BusinessType owner_id: string \| null |
| `app/api/admin/send-login-emails/route.ts` | Skip businesses with null owner_id when resolving email |
| `app/api/admin/send-business-emails/route.ts` | Skip businesses with null owner_id (already has guard) |
| `app/businesses/edit/[slug]/page.tsx` | Block edit for unclaimed (owner_id null) and non-owners |
| `lib/importGooglePlacesBusinesses.ts` | **NEW** – Import utility |
| `app/api/admin/import-google-places/route.ts` | **NEW** – Admin API for import |

---

## C) Risk Areas

1. **owner_id null** – Any code path that assumes owner_id exists must be audited. Dashboard/edit/promo/Stripe already filter by `owner_id === auth.uid()`; unclaimed businesses won’t match.
2. **send-login-emails** – Must skip businesses with null owner_id to avoid `resolveEmail(null)`.
3. **real_estate_listings RLS** – Uses `owner_id = auth.uid()`. Unclaimed businesses have no owner; no one can manage listings. Correct.
4. **Business profile** – Page only displays data; no critical path requires owner_id. Type change to optional is sufficient.

---

## D) Quick Manual Test Steps

1. Run migration; verify no errors.
2. Admin create business (existing flow) – should still work.
3. User register as business – should still work.
4. Import 1 unclaimed business via API; verify row has owner_id=null, moderation_status=on_hold.
5. Verify unclaimed business does NOT appear on businesses list (moderation_status filters).
6. Approve unclaimed business; verify it appears on list.
7. Dashboard: verify only owned businesses show.
8. Business profile page: load unclaimed on_hold by slug → should show "not found" (visibility gate).
9. Business edit page: navigate to /businesses/edit/[imported-slug] → redirect + "unclaimed" message.

---

## E) Final Test Checklist (post owner_id audit)

| Step | Action | Expected |
|------|--------|----------|
| 1 | Run migration | Success |
| 2 | Admin create business | Works |
| 3 | User register as business | Works |
| 4 | Import unclaimed via API | imported: 1, owner_id=null |
| 5 | Visit /businesses | Unclaimed not listed |
| 6 | Approve unclaimed in admin | Appears on list |
| 7 | Dashboard (as owner) | Only owned businesses |
| 8 | Visit /business/[imported-slug] (on_hold) | "Not found" |
| 9 | Visit /businesses/edit/[imported-slug] | Redirect + "unclaimed" |
| 10 | Send login emails (all_businesses) | Skips unclaimed |
| 11 | npm run build | Passes |

## F) Pages Validated in Code (not manually)

- `app/business/[slug]/page.tsx` – visibility gate for on_hold + null owner
- `app/businesses/edit/[slug]/page.tsx` – ownership check, redirect unclaimed
- `app/api/admin/send-login-emails/route.ts` – skip null owner_id in loop
