# Security Environment Checklist

This document is a production safety checklist for translation and secret management.

## Production Environment Checklist

- Verify these are set in production:
  - `TRANSLATION_ENABLED=false` (default safe state)
  - `TRANSLATION_DAILY_CHAR_LIMIT=10000` (or a strict value you approve)
  - `ADMIN_TRANSLATION_SECRET=<strong-random-secret>`
- Confirm no placeholder values are used in production (for example, `change-this-secret`).
- Ensure only server-side variables hold Google credentials:
  - `GOOGLE_APPLICATION_CREDENTIALS` and/or `GOOGLE_TRANSLATE_SERVICE_ACCOUNT_JSON`
  - Never expose these as `NEXT_PUBLIC_*`.
- Keep `.env.local`, `.env.production`, and any credentials files out of git.

## Google Translate Safety Checklist

- Keep `TRANSLATION_ENABLED=false` by default.
- Only enable translations temporarily when intentionally needed.
- Use strict daily limit:
  - `TRANSLATION_DAILY_CHAR_LIMIT`
- Require admin secret for manual UI generation:
  - `x-admin-translation-secret` must match `ADMIN_TRANSLATION_SECRET`.
- Keep translation flows cache-first to avoid repeated paid calls.
- Re-disable translation (`TRANSLATION_ENABLED=false`) after manual operations.

## Admin Secret Requirements

- Set `ADMIN_TRANSLATION_SECRET` to a strong secret:
  - at least 32 random characters
  - mix of uppercase, lowercase, numbers, symbols
  - never reuse from another service
- Rotate immediately if leaked.

## Usage Monitoring

- Review translation usage regularly via:
  - `GET /api/admin/translation-usage`
  - Include header: `x-admin-translation-secret: <your-secret>`
- Watch for:
  - unexpected paid calls
  - blocked attempts spikes
  - unusual endpoint activity

## Billing and Quota Guardrails

- Configure Google Cloud Billing Budget alerts for Translation API spend.
- Configure Google Cloud Translation API quotas to cap worst-case usage.
- Set alert notifications for budget and quota events.

## Default Safe Rule

- Keep translation disabled unless actively running a controlled manual translation task.
- Default should remain:
  - `TRANSLATION_ENABLED=false`
