# Google Places Import — Full Deliverables

## 1) SQL Migration

**File:** `supabase/migrations/add_google_places_import.sql`

```sql
-- Google Places import support for unclaimed businesses.
-- - owner_id becomes nullable (only for imported/unclaimed businesses)
-- - google_place_id for deduplication
-- - google_rating, google_user_ratings_total (optional display)

-- Add new columns
ALTER TABLE public.businesses
  ADD COLUMN IF NOT EXISTS google_place_id text,
  ADD COLUMN IF NOT EXISTS google_rating numeric(2,1),
  ADD COLUMN IF NOT EXISTS google_user_ratings_total integer;

-- Unique constraint for dedupe (allow multiple NULLs)
CREATE UNIQUE INDEX IF NOT EXISTS businesses_google_place_id_key
  ON public.businesses (google_place_id)
  WHERE google_place_id IS NOT NULL;

COMMENT ON COLUMN public.businesses.google_place_id IS 'Google Places place_id; used to dedupe imports.';
COMMENT ON COLUMN public.businesses.google_rating IS 'Google Places rating (1-5). Display only.';
COMMENT ON COLUMN public.businesses.google_user_ratings_total IS 'Google Places user_ratings_total. Display only.';

-- Make owner_id nullable (existing rows keep their owner_id)
ALTER TABLE public.businesses
  ALTER COLUMN owner_id DROP NOT NULL;

COMMENT ON COLUMN public.businesses.owner_id IS 'UUID of registered user who owns the business. NULL for unclaimed imported businesses.';
```

**Indexes/constraints applied:**
- `businesses_google_place_id_key` — UNIQUE partial index on `google_place_id` WHERE `google_place_id IS NOT NULL` (allows multiple NULLs, enforces uniqueness for non-null values)

---

## 2) Admin Import Endpoint

**Location:** `app/api/admin/import-google-businesses/route.ts`

- POST only
- Admin-protected (same pattern as other admin routes)
- Body: `{ places: [...] }` — array of Google Text Search results

**Existing admin approvals:** `/admin/approvals` — uses Supabase client to set `moderation_status = 'active'` and `status = 'active'` when approving.

**New API:** `POST /api/admin/businesses/[id]/approve` — programmatic approval.

---

## 3) Shared Helpers

**File:** `utils/googlePlacesImport.ts`

- `googleTypesToHanarCategory(types: string[]): { category: string; subcategory: string }`
- `parseFormattedAddress(formatted_address: string): { street, city, state, zip, country } | null`

---

## 4) Example curl — Import

```bash
curl -X POST "https://your-domain.com/api/admin/import-google-businesses" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ADMIN_JWT" \
  -H "Cookie: sb-access-token=...; sb-refresh-token=..." \
  -d '{
    "places": [
      {
        "place_id": "ChIJN1t_tDeuEmsRUsoyG83frY4",
        "name": "Example Restaurant",
        "formatted_address": "123 Main St, San Francisco, CA 94102, USA",
        "geometry": {
          "location": {
            "lat": 37.7749,
            "lng": -122.4194
          }
        },
        "types": ["restaurant", "food", "point_of_interest"],
        "rating": 4.5,
        "user_ratings_total": 120
      }
    ]
  }'
```

**Response:**
```json
{
  "success": true,
  "imported": 1,
  "updated": 0,
  "skipped": 0,
  "errors": []
}
```

---

## 5) Example curl — Approve

```bash
curl -X POST "https://your-domain.com/api/admin/businesses/BUSINESS_UUID/approve" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ADMIN_JWT" \
  -H "Cookie: sb-access-token=...; sb-refresh-token=..."
```

**Response:**
```json
{
  "success": true,
  "business_id": "BUSINESS_UUID",
  "moderation_status": "active"
}
```

---

## 6) Manual Test Checklist

| # | Action | Expected |
|---|--------|----------|
| 1 | Run migration | No errors |
| 2 | Import 1 place via POST /api/admin/import-google-businesses | `imported: 1`, row has `owner_id=null`, `moderation_status=on_hold` |
| 3 | Import same place again | `skipped: 1` (or `updated: 1` if previously unclaimed) |
| 4 | Visit /businesses | Imported business not listed (on_hold) |
| 5 | Visit /business/[slug] for imported slug | "Not found" (visibility gate) |
| 6 | Approve via POST /api/admin/businesses/[id]/approve | `success: true` |
| 7 | Visit /businesses | Business now visible |
| 8 | Visit /business/[slug] | Business profile loads |
| 9 | Approve via Admin UI /admin/approvals | Same effect as API |

---

## 7) Full File Listing

Files created/updated:

| File | Purpose |
|------|---------|
| `supabase/migrations/add_google_places_import.sql` | Migration |
| `utils/googlePlacesImport.ts` | Helpers: googleTypesToHanarCategory, parseFormattedAddress |
| `lib/importGooglePlacesBusinesses.ts` | Import logic (upsert, skip claimed) |
| `app/api/admin/import-google-businesses/route.ts` | POST import endpoint |
| `app/api/admin/businesses/[id]/approve/route.ts` | POST approve endpoint |

Removed: `app/api/admin/import-google-places/route.ts` (replaced by import-google-businesses)
