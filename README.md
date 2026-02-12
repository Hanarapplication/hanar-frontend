This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

### Connect to Supabase

1. Copy `.env.example` to `.env.local`:
   ```bash
   cp .env.example .env.local
   ```

2. Add your Supabase credentials to `.env.local`:
   - Go to [Supabase Dashboard](https://supabase.com/dashboard) → your project → **Settings** → **API**
   - Set `NEXT_PUBLIC_SUPABASE_URL` (Project URL)
   - Set `NEXT_PUBLIC_SUPABASE_ANON_KEY` (anon public key)
   - Set `SUPABASE_SERVICE_ROLE_KEY` (service_role key; keep secret)

3. (Optional) Link the project with Supabase CLI:
   ```bash
   npx supabase link --project-ref YOUR_PROJECT_REF
   ```
   Get `YOUR_PROJECT_REF` from the project URL: `https://YOUR_PROJECT_REF.supabase.co`

### Run the app

First, run the development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser.

## Web Push Notifications (PWA + FCM)

The site supports web push via Firebase Cloud Messaging (FCM). In-app (bell) notifications are unchanged and stored in Supabase `notifications`. Push device tokens are stored in Supabase for use by a backend or Edge Function that sends FCM payloads.

### HTTPS

**Push requires HTTPS in production.** Localhost is treated as secure for development.

### Environment variables (client – no secrets)

Set these in `.env.local` (or your deployment env). Do not hardcode secrets.

| Variable | Description |
|----------|-------------|
| `NEXT_PUBLIC_FIREBASE_API_KEY` | Firebase Web API key |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | e.g. `your-project.firebaseapp.com` |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | Firebase project ID |
| `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` | e.g. `your-project.appspot.com` |
| `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` | FCM sender ID (numeric) |
| `NEXT_PUBLIC_FIREBASE_APP_ID` | Firebase web app ID |
| `NEXT_PUBLIC_FIREBASE_VAPID_KEY` | Web push VAPID key (from Firebase Console → Project settings → Cloud Messaging → Web configuration) |

### Supabase table for web push tokens

Run the migration so the `push_tokens` table exists:

```bash
# If using Supabase CLI
supabase db push
```

Or run the SQL in `supabase/migrations/add_push_tokens_table.sql`:

- `push_tokens`: `id` (uuid), `user_id` (uuid, references auth.users), `token` (text, unique), `platform` (text, default `'web'`), `device_info` (jsonb), `created_at`, `updated_at`. RLS allows users to manage only their own rows.

Existing `user_push_tokens` (e.g. for native/app) is unchanged. Admin blast can send to both `user_push_tokens` and `push_tokens`.

### Server-side FCM (admin blast)

To send push from the admin panel (blast), set:

- `FIREBASE_SERVICE_ACCOUNT_JSON`: full JSON string of the Firebase service account key (from Firebase Console → Project settings → Service accounts).

## Learn More

- [Next.js Documentation](https://nextjs.org/docs)
- [Firebase Cloud Messaging for Web](https://firebase.google.com/docs/cloud-messaging/js/client)

## Deploy on Vercel

See [Vercel deployment docs](https://nextjs.org/docs/app/building-your-application/deploying). Use HTTPS in production for push to work.
