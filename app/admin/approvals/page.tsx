
'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { toast } from 'react-hot-toast';
import { useRouter } from 'next/navigation';

// Types
interface Business {
  id: number;
  business_name: string;
  slug: string;
  phone?: string;
  email?: string;
  whatsapp?: string;
  business_status: string;
  verified_info?: {
    infoCorrect: boolean;
    addressCorrect: boolean;
    phoneCorrect: boolean;
    paymentCorrect: boolean;
  };
  admin_note?: string;
}

export default function AdminApprovalsPage() {
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [filterStatus, setFilterStatus] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    fetchBusinesses();
  }, []);

  async function fetchBusinesses() {
    setLoading(true);
    const { data, error } = await supabase.from('businesses').select('*');

    if (error) {
      console.error(error);
      toast.error('Failed to load businesses');
    } else {
      setBusinesses(data || []);
    }
    setLoading(false);
  }

  async function updateBusiness(id: number, updates: Partial<Business>) {
    const { error } = await supabase.from('businesses').update(updates).eq('id', id);

    if (error) {
      console.error(error);
      toast.error('Update failed');
    } else {
      toast.success('Business updated');
      fetchBusinesses();
    }
  }

  async function deleteBusiness(id: number) {
    if (!confirm('Are you sure you want to permanently delete this business?')) return;

    const { error } = await supabase.from('businesses').delete().eq('id', id);

    if (error) {
      console.error(error);
      toast.error('Delete failed');
    } else {
      toast.success('Business deleted');
      fetchBusinesses();
    }
  }

  const filteredBusinesses = businesses.filter((b) => {
    const matchStatus = filterStatus === 'all' || b.business_status === filterStatus;
    const matchSearch = b.business_name.toLowerCase().includes(searchTerm.toLowerCase());
    return matchStatus && matchSearch;
  });

  if (loading) return <div className="min-h-screen flex justify-center items-center">Loading...</div>;

  return (
    <div className="p-4 max-w-6xl mx-auto">
      <button
        onClick={() => router.push('/admin/owner')}
        className="mb-4 text-sm text-blue-600 underline"
      >
        ← Back to Owner Dashboard
      </button>

      <h1 className="text-3xl font-bold mb-6">🛡️ Admin Panel — Manage Businesses</h1>

      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <input
          type="text"
          placeholder="Search businesses..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="border rounded-lg px-4 py-2 flex-1"
        />
        <div className="flex gap-2 flex-wrap">
          {['all', 'pending', 'approved', 'hold', 'archived'].map((status) => (
            <button
              key={status}
              onClick={() => setFilterStatus(status)}
              className={`px-4 py-2 rounded-lg ${filterStatus === status ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-800'}`}
            >
              {status.charAt(0).toUpperCase() + status.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {filteredBusinesses.length === 0 ? (
        <div>No businesses match your criteria.</div>
      ) : (
        <div className="space-y-4">
          {filteredBusinesses.map((biz) => (
            <BusinessCard
              key={biz.id}
              biz={biz}
              updateBusiness={updateBusiness}
              deleteBusiness={deleteBusiness}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function BusinessCard({
  biz,
  updateBusiness,
  deleteBusiness,
}: {
  biz: Business;
  updateBusiness: any;
  deleteBusiness: any;
}) {
  const [verified, setVerified] = useState({
    infoCorrect: biz.verified_info?.infoCorrect || false,
    addressCorrect: biz.verified_info?.addressCorrect || false,
    phoneCorrect: biz.verified_info?.phoneCorrect || false,
    paymentCorrect: biz.verified_info?.paymentCorrect || false,
  });

  const [adminNote, setAdminNote] = useState(biz.admin_note || '');
  const canApprove = Object.values(verified).every(Boolean);

  return (
    <div className="bg-white rounded-lg shadow p-4 space-y-3 text-sm">
      <div className="flex justify-between items-start">
        <div>
          <h2 className="text-base font-semibold">{biz.business_name}</h2>
          {biz.phone && <p className="text-gray-600">📞 {biz.phone}</p>}
          {biz.email && <p className="text-gray-600">✉️ {biz.email}</p>}
        </div>
        <div className="text-right">
          <StatusBadge status={biz.business_status} />
          <button
            onClick={() => window.open(`/business/${biz.slug}`, '_blank')}
            className="text-blue-600 underline text-xs block mt-1"
          >
            View Page
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-2 gap-2">
        <Checkbox label="Business Info Correct" checked={verified.infoCorrect} onChange={(v) => setVerified((prev) => ({ ...prev, infoCorrect: v }))} />
        <Checkbox label="Address Correct" checked={verified.addressCorrect} onChange={(v) => setVerified((prev) => ({ ...prev, addressCorrect: v }))} />
        <Checkbox label="Phone Number Correct" checked={verified.phoneCorrect} onChange={(v) => setVerified((prev) => ({ ...prev, phoneCorrect: v }))} />
        <Checkbox label="Payment Completed" checked={verified.paymentCorrect} onChange={(v) => setVerified((prev) => ({ ...prev, paymentCorrect: v }))} />
      </div>

      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">Admin Notes</label>
        <textarea
          value={adminNote}
          onChange={(e) => setAdminNote(e.target.value)}
          rows={2}
          className="w-full border rounded-lg p-2 text-sm"
          placeholder="e.g. Waiting for payment confirmation"
        />
      </div>

      <div className="flex flex-wrap gap-2 pt-2">
        <button
          onClick={() => updateBusiness(biz.id, { business_status: 'approved', verified_info: verified, admin_note: adminNote, status: 'active' })}
          disabled={!canApprove}
          className={`px-3 py-1 rounded ${canApprove ? 'bg-green-600 hover:bg-green-700 text-white' : 'bg-gray-300 text-gray-500 cursor-not-allowed'}`}
        >
          Approve ✅
        </button>
        <button
          onClick={() => updateBusiness(biz.id, { business_status: 'rejected', verified_info: verified, admin_note: adminNote })}
          className="px-3 py-1 rounded bg-red-500 hover:bg-red-600 text-white"
        >
          Reject ❌
        </button>
        <button
          onClick={() => updateBusiness(biz.id, { business_status: 'hold', verified_info: verified, admin_note: adminNote })}
          className="px-3 py-1 rounded bg-yellow-500 hover:bg-yellow-600 text-white"
        >
          Hold ⏸️
        </button>
        <button
          onClick={() => updateBusiness(biz.id, { business_status: 'archived', verified_info: verified, admin_note: adminNote })}
          className="px-3 py-1 rounded bg-blue-500 hover:bg-blue-600 text-white"
        >
          Archive 📦
        </button>
        <button
          onClick={() => deleteBusiness(biz.id)}
          className="px-3 py-1 rounded bg-black hover:bg-gray-800 text-white"
        >
          Delete 🗑️
        </button>
      </div>
    </div>
  );
}

function Checkbox({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-center space-x-2">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span>{label}</span>
    </label>
  );
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    approved: 'bg-green-600',
    pending: 'bg-yellow-500',
    hold: 'bg-orange-600',
    archived: 'bg-gray-500',
    rejected: 'bg-red-600',
    deleted: 'bg-black',
    unknown: 'bg-gray-300',
  };
  const label = status.charAt(0).toUpperCase() + status.slice(1);
  const color = colors[status] || colors['unknown'];
  return <span className={`text-xs px-2 py-1 rounded-full text-white ${color}`}>{label}</span>;
}
