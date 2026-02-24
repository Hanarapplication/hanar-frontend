# owner_id Audit Report

## 1) Search Results: All owner_id Usages

| File | Line(s) | Usage | Classification |
|------|---------|-------|----------------|
| app/api/types/supabase.ts | 23 | `owner_id: string \| null` | Type def – OK |
| types/business.ts | 10 | `owner_id?: string \| null` | Type def – OK |
| app/business/[slug]/page.tsx | 62, 627, 633, 635 | Type; visibility checks | Display/read – OK |
| app/businesses/edit/[slug]/page.tsx | 672 | `ownerId` check before edit | Owner-only – OK |
| app/api/admin/send-login-emails/route.ts | 124–153 | Skip null, resolveEmail | Admin – Fixed |
| app/api/admin/send-business-emails/route.ts | 163, 175 | `if (b.owner_id)` guard | Admin – OK |
| app/api/admin/send-notifications/route.ts | 206–209 | `.not('owner_id','is',null)`, `if (b.owner_id)` | Admin – OK |
| app/api/admin/users/search/route.ts | 69–77 | `.not('owner_id','is',null)`, `if (b.owner_id)` | Admin – OK |
| app/api/admin/area-blasts/route.ts | 153, 212 | Select; filter recipients | Background – OK (null-safe) |
| app/api/stripe/create-checkout-session/route.ts | 58, 61, 85, 123, 126 | Ownership check | Owner-only – OK |
| app/api/update-business/route.ts | 35, 39 | `owner_id !== user.id` | Owner-only – OK |
| app/api/notifications/delete-broadcast/route.ts | 45, 51 | `owner_id !== user.id` | Owner-only – OK |
| app/api/notifications/business-broadcast/route.ts | 80, 87, 273, 285 | Ownership; filter | Owner-only – OK |
| app/api/business/insights/route.ts | 43, 47 | `biz?.owner_id != null ? ...` | Display – OK (null-safe) |
| app/api/business/promotion-request/route.ts | 17, 20 | `data?.owner_id ?? null` | Owner-only – OK |
| app/api/promotion-request/route.ts | 30–31 | `data?.owner_id === userId` | Owner-only – OK |
| lib/sendApprovalNotification.ts | 37–92 | `if (!biz?.owner_id) return null` | Background – OK |
| app/promote/page.tsx | 107 | `.eq('owner_id', userId)` | Owner-only – OK |
| app/business-dashboard/page.tsx | 252 | `.eq('owner_id', userId)` | Owner-only – OK |
| app/business/plan/page.tsx | 106 | `.eq('owner_id', userId)` | Owner-only – OK |
| components/Navbar.tsx | 250 | `.eq('owner_id', user.id)` | Owner-only – OK |
| app/profile/[username]/page.tsx | 121 | `.eq('owner_id', user.id)` | Owner-only – OK |
| app/marketplace/post/page.tsx | 75 | `.eq('owner_id', user.id)` | Owner-only – OK |
| app/dashboard/account/page.tsx | 56 | `.eq('owner_id', authUser.id)` | Owner-only – OK |
| app/community/post/CreateCommunityPostClient.tsx | 88 | `.eq('owner_id', user.id)` | Owner-only – OK |
| app/api/community/post/route.ts | 39 | `.eq('owner_id', user_id)` | Owner-only – OK |
| app/api/marketplace/create-item/route.ts | 51 | `.eq('owner_id', user.id)` | Owner-only – OK |
| app/api/marketplace/listing-limits/route.ts | 50 | `.eq('owner_id', user.id)` | Owner-only – OK |
| app/api/marketplace/casual-seller-pack/route.ts | 48 | `.eq('owner_id', user.id)` | Owner-only – OK |
| app/business-dashboard/insights/page.tsx | 84 | `.eq('owner_id', userId)` | Owner-only – OK |
| app/api/business/profile-appearance/route.ts | 40 | `.eq('owner_id', userId)` | Owner-only – OK |
| app/api/business/profile-theme/route.ts | 40 | `.eq('owner_id', userId)` | Owner-only – OK |
| app/api/follow/route.ts | 11 | `.eq('owner_id', userId)` | Owner-only – OK |
| app/api/unfollow/route.ts | 11 | `.eq('owner_id', userId)` | Owner-only – OK |
| app/api/account/delete/route.ts | 78 | `.delete().eq('owner_id', userId)` | Owner-only – OK |
| app/notifications/page.tsx | 125 | `.eq('owner_id', user.id)` | Owner-only – OK |
| app/api/register/route.ts | 425, 447, 531 | Insert; delete on rollback | Owner-only – OK |
| app/api/admin/create-business/route.ts | 200 | Insert with owner_id | Owner-only – OK |
| lib/importGooglePlacesBusinesses.ts | 201 | `owner_id: null` insert | Import – OK |
| supabase/migrations/add_real_estate_listings_table.sql | 27–51 | RLS policies | DB – OK (unclaimed = no access) |

## 2) Classification Summary

- **Owner-only (keep strict)**: All dashboard, edit, promote, Stripe, notifications, and follow/unfollow flows. When `owner_id` is null, comparisons fail correctly → 403.
- **Display/read-only**: Business profile, insights. Already use optional chaining or null checks.
- **Background/admin**: send-login-emails, send-business-emails, send-notifications, users/search, area-blasts. All either exclude null or guard before use.

## 3) Fixes Applied

- **app/api/admin/send-login-emails/route.ts**: Individual business: return 400 if `owner_id` is null. Loop: skip businesses with `owner_id` null.
- **app/business/[slug]/page.tsx**: Hide unclaimed on_hold businesses from non-owners.
- **app/businesses/edit/[slug]/page.tsx**: Block edit when `owner_id` is null or user is not owner.

## 4) No owner_id! or Unsafe Casts Found

Grep for `owner_id!` and `as string` casts on owner_id returned no matches.

## 5) Build & Lint Validation

- **npm run build**: ✅ Passed (Next.js 15.5.9, includes type checking and linting)
- **npm run lint**: ⚠️ Triggers ESLint setup prompt (deprecated in Next 16); build already runs lint step

## 6) Additional Fix Applied

- **app/api/admin/send-login-emails/route.ts**: Extracted `ownerId` to local variable for cleaner type narrowing when pushing to recipients.
