-- Translation cache table for posts
-- One cached translation per (post_id, target_language)

create table if not exists public.post_translations (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.community_posts(id) on delete cascade,
  target_language text not null,
  translated_text text not null,
  created_at timestamptz not null default now()
);

-- Prevent duplicate cached translations for the same post/language pair
alter table public.post_translations
  add constraint post_translations_post_id_target_language_key
  unique (post_id, target_language);

create index if not exists idx_post_translations_post_id on public.post_translations(post_id);
create index if not exists idx_post_translations_target_language on public.post_translations(target_language);
