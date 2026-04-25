create table if not exists public.translation_usage_logs (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  endpoint_name text not null,
  user_id text null,
  ip_address text null,
  source_language text null,
  target_language text null,
  character_count integer not null default 0,
  text_preview text null,
  cache_hit boolean not null default false,
  reason text null,
  paid_call boolean not null default false,
  blocked boolean not null default false
);

create index if not exists idx_translation_usage_logs_created_at
  on public.translation_usage_logs (created_at desc);

create index if not exists idx_translation_usage_logs_endpoint
  on public.translation_usage_logs (endpoint_name);
