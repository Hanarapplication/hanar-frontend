'use client';

import { useEffect, useMemo, useState } from 'react';
import { toast } from 'react-hot-toast';
import { useRouter } from 'next/navigation';

type ModerationStatus = 'active' | 'on_hold' | 'rejected';

interface NoteEntry {
  note: string;
  timestamp: string;
}

interface Organization {
  id: string;
  user_id: string;
  username: string | null;
  full_name: string | null;
  email: string | null;
  mission: string | null;
  moderation_status: ModerationStatus | null;
  admin_note: string | null;
  note_history: NoteEntry[] | null;
  created_at: string;
}

type SentNotification = {
  id: string;
  kind: string;
  title: string;
  body: string;
  created_at: string;
  status?: string;
  data?: { sent_count?: number };
};

interface CommunityPost {
  id: string;
  title: string | null;
  body: string | null;
  created_at: string;
}

export default function AdminOrganizationsPage() {
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [filterStatus, setFilterStatus] = useState<'all' | ModerationStatus>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    fetchOrganizations();
  }, []);

  async function fetchOrganizations() {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/organizations');
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Failed to load');
      setOrganizations(data.organizations || []);
    } catch (err: any) {
      toast.error(err?.message || 'Failed to load organizations');
      setOrganizations([]);
    } finally {
      setLoading(false);
    }
  }

  const filteredOrgs = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    return organizations.filter((o) => {
      const matchStatus = filterStatus === 'all' || (o.moderation_status || 'active') === filterStatus;
      const name = (o.full_name || o.username || '').toLowerCase();
      const matchSearch = term === '' || name.includes(term) || (o.email || '').toLowerCase().includes(term);
      return matchStatus && matchSearch;
    });
  }, [organizations, filterStatus, searchTerm]);

  if (loading) return <div className="min-h-screen flex items-center justify-center">Loading...</div>;

  return (
    <div className="p-4 max-w-6xl mx-auto min-h-screen bg-gray-50">
      <button onClick={() => router.push('/admin/owner')} className="mb-4 text-blue-600 underline">
        ← Back to Owner Dashboard
      </button>

      <h1 className="text-3xl font-bold mb-6">Admin Panel — Manage Organizations</h1>

      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <input
          type="text"
          placeholder="Search organizations..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="border rounded-lg px-4 py-2 flex-1"
        />
        <div className="flex gap-2 flex-wrap">
          {(['all', 'active', 'on_hold', 'rejected'] as const).map((status) => (
            <button
              key={status}
              onClick={() => setFilterStatus(status)}
              className={`px-4 py-2 rounded-lg ${
                filterStatus === status ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-800'
              }`}
            >
              {status === 'all' ? 'All' : status.replace('_', ' ')}
            </button>
          ))}
        </div>
      </div>

      {filteredOrgs.length === 0 ? (
        <div>No organizations match your criteria.</div>
      ) : (
        <div className="space-y-5">
          {filteredOrgs.map((org) => (
            <OrganizationCard
              key={org.id}
              org={org}
              onUpdate={fetchOrganizations}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function OrganizationCard({ org, onUpdate }: { org: Organization; onUpdate: () => void }) {
  const [adminNote, setAdminNote] = useState(org.admin_note || '');
  const [showHistory, setShowHistory] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editForm, setEditForm] = useState({
    full_name: org.full_name || '',
    username: org.username || '',
    email: org.email || '',
    mission: org.mission || '',
  });
  const [sentNotifications, setSentNotifications] = useState<SentNotification[]>([]);
  const [sentLoading, setSentLoading] = useState(false);
  const [sentLoaded, setSentLoaded] = useState(false);
  const [posts, setPosts] = useState<CommunityPost[]>([]);
  const [postsLoading, setPostsLoading] = useState(false);
  const [postsLoaded, setPostsLoaded] = useState(false);
  const [deletingPost, setDeletingPost] = useState<string | null>(null);
  const [deletingNotif, setDeletingNotif] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const status = org.moderation_status || 'active';

  useEffect(() => {
    setAdminNote(org.admin_note || '');
    setEditForm({
      full_name: org.full_name || '',
      username: org.username || '',
      email: org.email || '',
      mission: org.mission || '',
    });
    setSentNotifications([]);
    setSentLoaded(false);
    setPosts([]);
    setPostsLoaded(false);
  }, [org.id, org.admin_note, org.full_name, org.username, org.email, org.mission]);

  const saveUpdates = async (updates: Partial<Organization>, note?: string) => {
    setSaving(true);
    try {
      const body: Record<string, unknown> = { id: org.id, ...updates };
      if (note !== undefined && note.trim() !== '') {
        body.admin_note = note.trim();
        const currentHistory = (org.note_history || []) as NoteEntry[];
        body.note_history = [...currentHistory, { note: note.trim(), timestamp: new Date().toISOString() }];
      }
      const res = await fetch('/api/admin/organizations', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Failed to save');
      toast.success('Saved');
      onUpdate();
    } catch (err: any) {
      toast.error(err?.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const handleSetStatus = async (newStatus: ModerationStatus) => {
    const action = newStatus === 'active' ? 'Reactivate' : newStatus === 'on_hold' ? 'Put on hold' : 'Reject';
    if (!confirm(`${action} this organization?${adminNote.trim() ? '\n\nNote will be saved.' : ''}`)) return;
    await saveUpdates({ moderation_status: newStatus }, adminNote.trim() || undefined);
  };

  const handleDelete = async () => {
    if (!confirm(`Permanently delete "${org.full_name || org.username || 'this org'}"? This cannot be undone.`)) return;
    try {
      const res = await fetch(`/api/admin/organizations?id=${encodeURIComponent(org.id)}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Delete failed');
      toast.success('Organization deleted');
      onUpdate();
    } catch (err: any) {
      toast.error(err?.message || 'Delete failed');
    }
  };

  const loadSentNotifications = async () => {
    setSentLoading(true);
    try {
      const res = await fetch(`/api/admin/notifications?orgUserId=${encodeURIComponent(org.user_id)}`);
      const payload = await res.json();
      if (!res.ok) throw new Error(payload?.error || 'Failed to load');
      setSentNotifications(payload.notifications || []);
      setSentLoaded(true);
    } catch (err: any) {
      toast.error(err?.message || 'Failed to load notifications');
    } finally {
      setSentLoading(false);
    }
  };

  const loadPosts = async () => {
    setPostsLoading(true);
    try {
      const res = await fetch(`/api/community/posts?userId=${encodeURIComponent(org.user_id)}&orgId=${encodeURIComponent(org.id)}`);
      const payload = await res.json();
      if (!res.ok) throw new Error(payload?.error || 'Failed to load');
      setPosts(payload.posts || []);
      setPostsLoaded(true);
    } catch (err: any) {
      toast.error(err?.message || 'Failed to load posts');
    } finally {
      setPostsLoading(false);
    }
  };

  const deleteNotification = async (notifId: string) => {
    if (!confirm('Remove this sent notification log?')) return;
    setDeletingNotif(notifId);
    try {
      const res = await fetch('/api/admin/notifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: notifId, action: 'delete', source: 'notification' }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Failed to delete');
      toast.success('Notification removed');
      setSentNotifications((prev) => prev.filter((n) => n.id !== notifId));
    } catch (err: any) {
      toast.error(err?.message || 'Failed to delete notification');
    } finally {
      setDeletingNotif(null);
    }
  };

  const deletePost = async (postId: string) => {
    if (!confirm('Delete this post? This cannot be undone.')) return;
    setDeletingPost(postId);
    try {
      const res = await fetch('/api/admin/organizations/delete-post', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ postId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Failed to delete');
      toast.success('Post deleted');
      setPosts((prev) => prev.filter((p) => p.id !== postId));
    } catch (err: any) {
      toast.error(err?.message || 'Failed to delete post');
    } finally {
      setDeletingPost(null);
    }
  };

  const handleSaveEdit = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/admin/organizations/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: org.id, ...editForm }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Failed to update');
      toast.success('Organization updated');
      setEditModalOpen(false);
      onUpdate();
    } catch (err: any) {
      toast.error(err?.message || 'Failed to update');
    } finally {
      setSaving(false);
    }
  };

  const history = (org.note_history || []) as NoteEntry[];

  return (
    <div className="bg-white rounded-lg shadow p-5 space-y-5 text-sm border border-gray-200">
      <div className="flex justify-between items-start">
        <div>
          <h2 className="text-lg font-semibold">{org.full_name || org.username || 'Unnamed'}</h2>
          {org.username && (
            <p className="text-gray-600">@{org.username}</p>
          )}
          {org.email && <p className="text-gray-600">✉️ {org.email}</p>}
          {org.mission && <p className="text-gray-600 mt-1 line-clamp-2">{org.mission}</p>}
          <p className="text-xs text-gray-500 mt-1">
            Status: <span className="font-medium">{status}</span>
            {status === 'on_hold' && ' (hidden from public)'}
          </p>
        </div>
        <div className="flex flex-col gap-2 text-right">
          <span className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${
            status === 'active' ? 'bg-green-100 text-green-700' :
            status === 'on_hold' ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'
          }`}>
            {status}
          </span>
          {org.username && (
            <button
              onClick={() => window.open(`/organization/${org.username}`, '_blank')}
              className="inline-flex justify-center rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-600 hover:bg-blue-100"
            >
              View Page
            </button>
          )}
          <button
            onClick={() => { setEditForm({ full_name: org.full_name || '', username: org.username || '', email: org.email || '', mission: org.mission || '' }); setEditModalOpen(true); }}
            className="inline-flex justify-center rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-600 hover:bg-emerald-100"
          >
            Edit
          </button>
        </div>
      </div>

      <div>
        <div className="flex justify-between items-center mb-1.5">
          <label className="text-sm font-medium text-gray-700">Admin Notes</label>
          {history.length > 0 && (
            <button onClick={() => setShowHistory(true)} className="text-sm text-blue-600 hover:underline">
              View history ({history.length})
            </button>
          )}
        </div>
        <textarea
          value={adminNote}
          onChange={(e) => setAdminNote(e.target.value)}
          rows={3}
          className="w-full border border-gray-300 rounded-lg p-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 resize-y"
          placeholder="Admin notes (saved when you take an action)"
        />
      </div>

      <div className="flex flex-wrap gap-2 pt-2">
        {status !== 'active' && (
          <button
            onClick={() => handleSetStatus('active')}
            disabled={saving}
            className="px-5 py-2 rounded-lg bg-green-600 hover:bg-green-700 text-white font-medium disabled:opacity-50"
          >
            Reactivate
          </button>
        )}
        {status !== 'on_hold' && (
          <button
            onClick={() => handleSetStatus('on_hold')}
            disabled={saving}
            className="px-5 py-2 rounded-lg bg-yellow-500 hover:bg-yellow-600 text-white font-medium disabled:opacity-50"
          >
            Put on hold
          </button>
        )}
        {status !== 'rejected' && (
          <button
            onClick={() => handleSetStatus('rejected')}
            disabled={saving}
            className="px-5 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white font-medium disabled:opacity-50"
          >
            Reject
          </button>
        )}
        <button
          onClick={handleDelete}
          className="px-5 py-2 rounded-lg bg-gray-800 hover:bg-gray-900 text-white font-medium ml-auto"
        >
          Delete
        </button>
      </div>

      {/* Sent Notifications */}
      <div className="border-t border-gray-200 pt-4">
        <div className="flex items-center justify-between gap-3 mb-2">
          <p className="text-sm font-semibold text-gray-900">Sent Notifications</p>
          <button
            onClick={loadSentNotifications}
            disabled={sentLoading}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg border ${sentLoading ? 'bg-gray-200 text-gray-500' : 'bg-white text-gray-700'}`}
          >
            {sentLoading ? 'Loading…' : sentLoaded ? 'Refresh' : 'Load'}
          </button>
        </div>
        {sentLoaded && (
          <div className="space-y-2">
            {sentNotifications.length === 0 ? (
              <div className="rounded-lg border border-dashed border-gray-200 p-3 text-xs text-gray-500">None</div>
            ) : (
              sentNotifications.map((item) => (
                <div key={item.id} className="rounded-lg border border-gray-200 bg-gray-50 p-3 text-sm flex justify-between items-start gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-gray-900">{item.title}</p>
                    <p className="text-gray-600 mt-1">{item.body}</p>
                    <p className="text-xs text-gray-500 mt-2">{new Date(item.created_at).toLocaleString()} · Sent to {item.data?.sent_count ?? 1}</p>
                  </div>
                  <button
                    onClick={() => deleteNotification(item.id)}
                    disabled={deletingNotif === item.id}
                    className="shrink-0 px-2 py-1 text-xs font-semibold text-red-600 hover:bg-red-50 rounded disabled:opacity-50"
                  >
                    {deletingNotif === item.id ? '…' : 'Delete'}
                  </button>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {/* Posts */}
      <div className="border-t border-gray-200 pt-4">
        <div className="flex items-center justify-between gap-3 mb-2">
          <p className="text-sm font-semibold text-gray-900">Organization Posts</p>
          <button
            onClick={loadPosts}
            disabled={postsLoading}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg border ${postsLoading ? 'bg-gray-200 text-gray-500' : 'bg-white text-gray-700'}`}
          >
            {postsLoading ? 'Loading…' : postsLoaded ? 'Refresh' : 'Load'}
          </button>
        </div>
        {postsLoaded && (
          <div className="space-y-2">
            {posts.length === 0 ? (
              <div className="rounded-lg border border-dashed border-gray-200 p-3 text-xs text-gray-500">No posts</div>
            ) : (
              posts.map((post) => (
                <div key={post.id} className="rounded-lg border border-gray-200 bg-gray-50 p-3 flex justify-between items-start gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-gray-900 truncate">{post.title || 'Untitled'}</p>
                    <p className="text-gray-600 text-xs mt-1 line-clamp-2">{post.body}</p>
                    <p className="text-xs text-gray-500 mt-2">{new Date(post.created_at).toLocaleString()}</p>
                  </div>
                  <button
                    onClick={() => deletePost(post.id)}
                    disabled={deletingPost === post.id}
                    className="shrink-0 px-2 py-1 text-xs font-semibold text-red-600 hover:bg-red-50 rounded disabled:opacity-50"
                  >
                    {deletingPost === post.id ? '…' : 'Delete'}
                  </button>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {/* Edit Modal */}
      {editModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
            <div className="p-6">
              <h3 className="text-lg font-bold mb-4">Edit Organization</h3>
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1">Full name</label>
                  <input
                    value={editForm.full_name}
                    onChange={(e) => setEditForm((p) => ({ ...p, full_name: e.target.value }))}
                    className="w-full border rounded-lg px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1">Username</label>
                  <input
                    value={editForm.username}
                    onChange={(e) => setEditForm((p) => ({ ...p, username: e.target.value }))}
                    className="w-full border rounded-lg px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1">Email</label>
                  <input
                    type="email"
                    value={editForm.email}
                    onChange={(e) => setEditForm((p) => ({ ...p, email: e.target.value }))}
                    className="w-full border rounded-lg px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1">Mission</label>
                  <textarea
                    value={editForm.mission}
                    onChange={(e) => setEditForm((p) => ({ ...p, mission: e.target.value }))}
                    rows={3}
                    className="w-full border rounded-lg px-3 py-2 text-sm"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2 mt-6">
                <button onClick={() => setEditModalOpen(false)} className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700">
                  Cancel
                </button>
                <button onClick={handleSaveEdit} disabled={saving} className="px-4 py-2 rounded-lg bg-blue-600 text-white disabled:opacity-50">
                  {saving ? 'Saving…' : 'Save'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Note History Modal */}
      {showHistory && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md max-h-[80vh] overflow-y-auto">
            <div className="p-6">
              <h3 className="text-lg font-bold mb-4">Note History</h3>
              <div className="space-y-3">
                {history.map((entry, i) => (
                  <div key={i} className="rounded-lg border border-gray-200 p-3">
                    <p className="text-sm text-gray-800">{entry.note}</p>
                    <p className="text-xs text-gray-500 mt-2">{new Date(entry.timestamp).toLocaleString()}</p>
                  </div>
                ))}
              </div>
              <button onClick={() => setShowHistory(false)} className="mt-4 px-4 py-2 rounded-lg bg-gray-200 text-gray-800">
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
