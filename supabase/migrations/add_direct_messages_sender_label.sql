-- Persist sender display label so receiver-side notifications do not depend on cross-table lookups.

ALTER TABLE public.direct_messages
  ADD COLUMN IF NOT EXISTS sender_label text;

-- Backfill existing rows using business/org/profile naming priority.
WITH sender_names AS (
  SELECT
    dm.id,
    COALESCE(
      b.business_name,
      o.full_name,
      ra.full_name,
      o.username,
      p.username,
      ra.username,
      'user_' || left(dm.sender_user_id::text, 8)
    ) AS resolved_name
  FROM public.direct_messages dm
  LEFT JOIN LATERAL (
    SELECT business_name
    FROM public.businesses
    WHERE owner_id = dm.sender_user_id
    ORDER BY created_at DESC NULLS LAST
    LIMIT 1
  ) b ON true
  LEFT JOIN public.organizations o ON o.user_id = dm.sender_user_id
  LEFT JOIN public.registeredaccounts ra ON ra.user_id = dm.sender_user_id
  LEFT JOIN public.profiles p ON p.id = dm.sender_user_id
)
UPDATE public.direct_messages dm
SET sender_label = sender_names.resolved_name
FROM sender_names
WHERE dm.id = sender_names.id
  AND (dm.sender_label IS NULL OR btrim(dm.sender_label) = '');
