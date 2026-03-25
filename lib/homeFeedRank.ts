/** Light “For You”–style ranking for home community posts (language, engagement, topic overlap, recency). */

export const DEFAULT_PRIMARY_LANG = 'en';

export function tokenizeForOverlap(text: string, minLen = 3): Set<string> {
  const s = String(text)
    .toLowerCase()
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .replace(/[^a-z0-9\u00c0-\u024f]+/gi, ' ');
  const words = s.split(/\s+/).filter((w) => w.length >= minLen);
  return new Set(words);
}

export function buildUserVocabulary(
  snippets: Array<{ title?: string | null; body?: string | null }>,
  maxTokens = 220
): Set<string> {
  const freq = new Map<string, number>();
  for (const sn of snippets) {
    const t = tokenizeForOverlap(`${sn.title || ''} ${sn.body || ''}`);
    for (const w of t) freq.set(w, (freq.get(w) || 0) + 1);
  }
  const sorted = [...freq.entries()].sort((a, b) => b[1] - a[1]).slice(0, maxTokens);
  return new Set(sorted.map(([w]) => w));
}

export type HomeRankContext = {
  primaryLang: string;
  spokenLangs: Set<string>;
  userPostLangs: Set<string>;
  userTags: Set<string>;
  vocabTokens: Set<string>;
};

export function hoursSince(iso: string): number {
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return 999;
  return Math.max(0, (Date.now() - t) / 3600000);
}

export function scoreHomePost(
  post: {
    created_at: string;
    language?: string | null;
    tags?: string[] | null;
    title?: string | null;
    body?: string | null;
    likeCount: number;
    commentCount: number;
  },
  ctx: HomeRankContext
): number {
  const h = Math.max(0.25, hoursSince(post.created_at));
  let s = 0;

  // Recency: strong for new posts, smooth decay (not strict chronological only)
  s += 16 / Math.pow(h + 1.2, 0.52);

  // Engagement — log-scaled so big hits help without drowning everything else
  s += Math.log1p(post.likeCount) * 1.2 + Math.log1p(post.commentCount) * 1.05;

  const pl = String(post.language || DEFAULT_PRIMARY_LANG).toLowerCase();
  if (ctx.primaryLang && pl === ctx.primaryLang.toLowerCase()) s += 8;
  for (const L of ctx.spokenLangs) {
    if (pl === L) {
      s += 4.5;
      break;
    }
  }
  if (ctx.userPostLangs.has(pl)) s += 4;

  const tags = Array.isArray(post.tags) ? post.tags : [];
  for (const t of tags) {
    const x = String(t).toLowerCase().trim();
    if (x && ctx.userTags.has(x)) s += 3;
  }

  const words = tokenizeForOverlap(`${post.title || ''} ${post.body || ''}`);
  let overlap = 0;
  for (const w of words) {
    if (ctx.vocabTokens.has(w)) overlap++;
  }
  s += Math.min(12, overlap * 0.45);

  return s;
}

export function scoresToRank0to100(scores: number[]): number[] {
  if (scores.length === 0) return [];
  const min = Math.min(...scores);
  const max = Math.max(...scores);
  const span = max - min || 1;
  return scores.map((x) => Math.round(((x - min) / span) * 100));
}
