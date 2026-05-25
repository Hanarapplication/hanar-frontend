'use client';

import { useState } from 'react';
import toast from 'react-hot-toast';

const COMMUNITY_CACHE_KEY = 'hanar_community_cache';
const HOME_FEED_CACHE_KEY = 'hanar_feed_cache';

function clearFeedCaches() {
  try {
    sessionStorage.removeItem(COMMUNITY_CACHE_KEY);
    sessionStorage.removeItem(HOME_FEED_CACHE_KEY);
    for (let i = sessionStorage.length - 1; i >= 0; i -= 1) {
      const key = sessionStorage.key(i);
      if (key?.startsWith('hanar_community_cache_')) sessionStorage.removeItem(key);
    }
  } catch {}
}

/** Stays visible until the user clicks × (or the toast). */
function seedToast(message: string, type: 'success' | 'error') {
  toast.custom(
    (t) => (
      <div
        className={`${
          t.visible ? 'animate-enter' : 'animate-leave'
        } pointer-events-auto flex max-w-md items-start gap-3 rounded-2xl border px-4 py-3 shadow-2xl ${
          type === 'error'
            ? 'border-red-200 bg-red-50 text-red-900'
            : 'border-emerald-200 bg-emerald-50 text-emerald-900'
        }`}
      >
        <p className="flex-1 text-sm font-medium leading-snug">{message}</p>
        <button
          type="button"
          aria-label="Dismiss"
          onClick={() => toast.dismiss(t.id)}
          className="shrink-0 rounded-lg p-1 text-lg leading-none opacity-60 hover:opacity-100"
        >
          ×
        </button>
      </div>
    ),
    { duration: Infinity }
  );
}

const SEED_FILES = [
  'public/data/community_seed.json — profiles (200) + optional base posts',
  'public/data/community_seed_immigrant_posts.json — array of posts with title, body, authorIndex, language, tags, comments, likeCount',
  'public/data/community_seed_all_languages_questions.json — 41 question posts (one per app language)',
  'public/data/community_seed_all_languages_questions_batch2.json — batch 2 (41 posts)',
  'public/data/community_seed_all_languages_questions_batch3.json — batch 3 (41 posts, 4 comments each)',
  'public/data/community_seed_all_languages_questions_batch4.json — batch 4 (41 posts, 4 comments each)',
  'public/data/community_seed_all_languages_questions_batch5.json — batch 5: Texas welcoming cities (41 posts)',
  'public/data/community_seed_all_languages_questions_batch6.json — batch 6: first job in Texas (41 posts)',
  'public/data/seed_author_indices_by_language.json — authorIndex lookup by language code',
  'public/data/AI_GENERATION_PROMPT.md — copy-paste brief for ChatGPT / other AI to generate new batches',
];

export default function AdminSeedCommunityPage() {
  const [loading, setLoading] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [pastedJson, setPastedJson] = useState('');
  const [pasteError, setPasteError] = useState<string | null>(null);

  const runSeed = async (postsPayload: { posts?: unknown[] } | null) => {
    setLoading(true);
    try {
      const res = await fetch('/api/seed-community-full', {
        method: 'POST',
        ...(postsPayload
          ? { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(postsPayload) }
          : {}),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const msg = [data?.error, data?.details].filter(Boolean).join(' — ') || `Seed failed (${res.status})`;
        seedToast(msg, 'error');
        return;
      }
      try {
        clearFeedCaches();
      } catch {}
      const parts = [data.message];
      if (data.skipped > 0) parts.push(`${data.skipped} duplicates skipped`);
      seedToast(parts.join('. '), 'success');
    } catch (e) {
      seedToast(e instanceof Error ? e.message : 'Seed failed', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleSeedFromFiles = async () => {
    if (!confirm('Create/update seed users and add posts from the JSON files. Duplicate posts (same author + title + body) are skipped. Continue?')) return;
    await runSeed(null);
  };

  const handleSeedFromPaste = async () => {
    setPasteError(null);
    let parsed: unknown[];
    try {
      const raw = pastedJson.trim();
      if (!raw) {
        setPasteError('Paste a JSON array of posts.');
        return;
      }
      parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) {
        setPasteError('Must be a JSON array of post objects.');
        return;
      }
    } catch {
      setPasteError('Invalid JSON.');
      return;
    }
    if (!confirm(`Seed ${parsed.length} post(s) from pasted JSON? Duplicates (same author + title + body) will be skipped. Continue?`)) return;
    await runSeed({ posts: parsed });
  };

  const handleDeleteSeeds = async () => {
    if (!confirm('Delete all community seed posts, comments, and likes? Seed users (profiles) will remain so you can fix seed data and re-seed.')) return;
    setDeleteLoading(true);
    try {
      const res = await fetch('/api/seed-community-full', { method: 'DELETE' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        seedToast(data?.error || data?.details || 'Delete failed', 'error');
        return;
      }
      try {
        clearFeedCaches();
      } catch {}
      seedToast(data.message || 'All community seeds deleted.', 'success');
    } catch (e) {
      seedToast(e instanceof Error ? e.message : 'Delete failed', 'error');
    } finally {
      setDeleteLoading(false);
    }
  };

  return (
    <div className="max-w-xl">
      <h1 className="text-xl font-bold text-slate-900 mb-1">Seed Community</h1>
      <p className="text-sm text-slate-600 mb-4">
        Seed creates 200 Auth users and profiles from the JSON files, then inserts posts, comments, and likes. <strong>Duplicate posts</strong> (same author + title + body) are skipped so you can re-run without creating duplicates.
      </p>
      <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 mb-4">
        <p className="text-sm font-medium text-slate-700 mb-1">Seed data files (edit these, then run Seed from files)</p>
        <ul className="text-sm text-slate-600 list-disc list-inside space-y-0.5">
          {SEED_FILES.map((f, i) => (
            <li key={i} className="font-mono text-xs break-all">{f}</li>
          ))}
        </ul>
        <p className="text-xs text-slate-500 mt-1">See <code className="bg-white px-1 rounded">public/data/SEED_STRUCTURE_FOR_GENERATION.md</code> for the exact JSON shape (authorIndex 0–199, language, tags, comments). Quick index map: <code className="bg-white px-1 rounded">public/data/seed_author_indices_by_language.json</code>.</p>
      </div>
      <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-6">
        <strong>Can take 6–10 minutes</strong> (200 users + posts + comments + likes). Don’t close or refresh the tab until you see the success message.
      </p>
      <p className="text-sm text-slate-600 mb-6">
        After seeding, <strong>go to Community</strong> to see posts. If Community is already open in another tab, <strong>refresh that tab</strong> (F5 or pull-to-refresh on mobile) so the feed reloads.
      </p>
      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={handleSeedFromFiles}
          disabled={loading || deleteLoading}
          className="rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? 'Seeding…' : 'Seed from files'}
        </button>
        <button
          type="button"
          onClick={handleDeleteSeeds}
          disabled={loading || deleteLoading}
          className="rounded-xl border border-red-300 bg-white px-5 py-2.5 text-sm font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {deleteLoading ? 'Deleting…' : 'Delete all community seeds'}
        </button>
      </div>
      <p className="text-sm text-slate-600 mt-3 mb-4">
        <strong>Clean up bad seed runs:</strong> use Delete all community seeds — it removes every post, comment, and like from <code className="text-xs bg-slate-100 px-1 rounded">seed_*</code> users (all batches at once). Real member posts are not touched. Then hard-refresh Home and Community (F5).
      </p>
      <div className="rounded-lg border border-slate-200 bg-white p-3">
        <p className="text-sm font-medium text-slate-700 mb-1">Or paste posts JSON</p>
        <p className="text-xs text-slate-500 mb-2">Paste a JSON array of post objects (same shape as in the immigrant posts file). Uses existing seed profiles (authorIndex 0–199). Run <strong>Seed from files</strong> first if you need seed_101–seed_200. Paste mode is fast (~1 min); it only creates missing authors referenced in your JSON.</p>
        <textarea
          value={pastedJson}
          onChange={(e) => { setPastedJson(e.target.value); setPasteError(null); }}
          placeholder='[{"title":"...","body":"...","authorIndex":0,"language":"en","tags":[],"comments":[],"likeCount":0}]'
          className="w-full h-24 rounded border border-slate-300 px-2 py-1.5 font-mono text-xs"
        />
        {pasteError && <p className="text-sm text-red-600 mt-1">{pasteError}</p>}
        <button
          type="button"
          onClick={handleSeedFromPaste}
          disabled={loading || deleteLoading}
          className="mt-2 rounded-lg bg-slate-700 px-4 py-2 text-sm font-medium text-white hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Seed from pasted JSON
        </button>
      </div>
      <p className="text-sm text-slate-600 mt-4">
        After seeding, <strong>go to Community</strong> and refresh (F5) if the feed was already open.
      </p>
    </div>
  );
}
