'use client';

import { useState } from 'react';
import toast from 'react-hot-toast';

const COMMUNITY_CACHE_KEY = 'hanar_community_cache';

const SEED_FILES = [
  'public/data/community_seed.json — profiles (100) + optional base posts',
  'public/data/community_seed_immigrant_posts.json — array of posts with title, body, authorIndex, language, tags, comments, likeCount',
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
        toast.error(data?.error || data?.details || 'Seed failed');
        return;
      }
      try {
        sessionStorage.removeItem(COMMUNITY_CACHE_KEY);
      } catch {}
      const parts = [data.message];
      if (data.skipped > 0) parts.push(`${data.skipped} duplicates skipped`);
      toast.success(parts.join('. '));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Seed failed');
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
        toast.error(data?.error || data?.details || 'Delete failed');
        return;
      }
      try {
        sessionStorage.removeItem(COMMUNITY_CACHE_KEY);
      } catch {}
      toast.success(data.message || 'All community seeds deleted.');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Delete failed');
    } finally {
      setDeleteLoading(false);
    }
  };

  return (
    <div className="max-w-xl">
      <h1 className="text-xl font-bold text-slate-900 mb-1">Seed Community</h1>
      <p className="text-sm text-slate-600 mb-4">
        Seed creates 100 Auth users and profiles from the JSON files, then inserts posts, comments, and likes. <strong>Duplicate posts</strong> (same author + title + body) are skipped so you can re-run without creating duplicates.
      </p>
      <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 mb-4">
        <p className="text-sm font-medium text-slate-700 mb-1">Seed data files (edit these, then run Seed from files)</p>
        <ul className="text-sm text-slate-600 list-disc list-inside space-y-0.5">
          {SEED_FILES.map((f, i) => (
            <li key={i} className="font-mono text-xs break-all">{f}</li>
          ))}
        </ul>
        <p className="text-xs text-slate-500 mt-1">See <code className="bg-white px-1 rounded">public/data/SEED_STRUCTURE_FOR_GENERATION.md</code> for the exact JSON shape (authorIndex 0–99, language, tags, comments).</p>
      </div>
      <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-6">
        <strong>Can take 3–5 minutes</strong> (100 users + 60 posts + comments + likes). Don’t close or refresh the tab until you see the success message.
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
      <div className="rounded-lg border border-slate-200 bg-white p-3">
        <p className="text-sm font-medium text-slate-700 mb-1">Or paste posts JSON</p>
        <p className="text-xs text-slate-500 mb-2">Paste a JSON array of post objects (same shape as in the immigrant posts file). Uses existing seed profiles (authorIndex 0–99).</p>
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
