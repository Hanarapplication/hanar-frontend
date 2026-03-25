import type { SupabaseClient } from '@supabase/supabase-js';
import { DEFAULT_PRIMARY_LANG, buildUserVocabulary, type HomeRankContext } from '@/lib/homeFeedRank';

export async function loadUserContentSignals(admin: SupabaseClient, userId: string) {
  const { data } = await admin
    .from('community_posts')
    .select('language, tags, title, body')
    .eq('user_id', userId)
    .eq('deleted', false)
    .limit(50);

  const languages = new Set<string>();
  const tags = new Set<string>();
  const snippets: { title?: string | null; body?: string | null }[] = [];

  for (const p of data || []) {
    if (p.language) languages.add(String(p.language).toLowerCase());
    if (Array.isArray(p.tags)) {
      p.tags.forEach((t: string) => {
        const x = String(t).toLowerCase().trim();
        if (x) tags.add(x);
      });
    }
    snippets.push({ title: (p as { title?: string }).title, body: (p as { body?: string }).body });
  }

  return {
    languages,
    tags,
    vocab: buildUserVocabulary(snippets),
  };
}

export type RankRequestOptions = {
  userId: string | null;
  primaryLang?: string | null;
  spokenLanguages?: string[];
  deviceLang?: string | null;
};

export async function getHomeRankContext(
  admin: SupabaseClient,
  opts: RankRequestOptions
): Promise<HomeRankContext> {
  const userId = opts.userId?.trim() || null;
  const deviceLang = (opts.deviceLang || '').trim().toLowerCase().slice(0, 8) || '';
  const primaryFromAccount = (opts.primaryLang || '').trim().toLowerCase().slice(0, 8) || '';
  const spoken = Array.isArray(opts.spokenLanguages)
    ? opts.spokenLanguages.map((l) => String(l).toLowerCase().trim().slice(0, 8)).filter(Boolean)
    : [];

  const spokenLangs = new Set(spoken);
  if (deviceLang) spokenLangs.add(deviceLang);

  let userPostLangs = new Set<string>();
  let userTags = new Set<string>();
  let vocabTokens = new Set<string>();

  if (userId) {
    const sig = await loadUserContentSignals(admin, userId);
    userPostLangs = sig.languages;
    userTags = sig.tags;
    vocabTokens = sig.vocab;
  }

  const primaryLang =
    primaryFromAccount ||
    (spoken.length > 0 ? spoken[0] : '') ||
    deviceLang ||
    DEFAULT_PRIMARY_LANG;

  return {
    primaryLang,
    spokenLangs,
    userPostLangs,
    userTags,
    vocabTokens,
  };
}
