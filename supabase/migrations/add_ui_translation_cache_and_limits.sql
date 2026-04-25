create table if not exists public.ui_translation_cache (
  id uuid primary key default gen_random_uuid(),
  source_language text not null,
  target_language text not null,
  source_text text not null,
  source_hash text not null,
  translated_text text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists ui_translation_cache_unique_idx
  on public.ui_translation_cache (source_language, target_language, source_hash);

create index if not exists ui_translation_cache_target_idx
  on public.ui_translation_cache (target_language);

create table if not exists public.ui_translation_usage_daily (
  usage_date date not null,
  subject_key text not null,
  chars_used bigint not null default 0,
  request_count integer not null default 0,
  updated_at timestamptz not null default now(),
  primary key (usage_date, subject_key)
);
