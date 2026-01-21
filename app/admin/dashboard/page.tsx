'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';

export default function AdminDashboard() {
  const [adminRole, setAdminRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  const fullAccessRoles = ['owner', 'ceo', 'topmanager'];
  const limitedTools = {
    reviewer: ['/admin/approvals'],
    moderator: ['/admin/community'],
    support: ['/admin/support'],
    editor: ['/admin/content'],
    readonly: ['/admin/viewer'],
    manager: ['/admin/overview'],
  };

useEffect(() => {
  const checkAdmin = async () => {
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      router.push('/admin/login');
      return;
    }

    const { data, error } = await supabase
      .from('adminaccounts')
      .select('role')
      .eq('email', user.user_metadata.email)
      .single();

    if (error || !data) {
      router.push('/unauthorized');
      return;
    }

    setAdminRole(data.role);
  };

  checkAdmin();
}, []);



  if (loading || !adminRole) {
    return <div className="text-center mt-10">Loading dashboard...</div>;
  }

  const navItems = [
    { label: 'Business Approvals', path: '/admin/approvals' },
    { label: 'Marketplace Listings', path: '/admin/marketplace' },
    { label: 'Community Posts', path: '/admin/community' },
    { label: 'Support Tickets', path: '/admin/support' },
    { label: 'Reports', path: '/admin/reports' },
    { label: 'Site Settings', path: '/admin/settings' },
  ];

  const isFullAccess = fullAccessRoles.includes(adminRole);

  const visibleItems = isFullAccess
    ? navItems
    : navItems.filter(item =>
        (limitedTools[adminRole as keyof typeof limitedTools] || []).includes(item.path)
      );

  return (
    <div className="min-h-screen flex bg-white">
      {/* Sidebar */}
      <aside className="w-64 border-r px-4 py-6 space-y-4 shadow-sm">
        <h1 className="text-2xl font-bold text-blue-600 mb-6">Admin Panel</h1>

        {visibleItems.map(item => (
          <button
            key={item.path}
            onClick={() => router.push(item.path)}
            className="block w-full text-left px-4 py-2 rounded-md hover:bg-blue-100 text-gray-700"
          >
            {item.label}
          </button>
        ))}

        <hr className="my-4" />

        <button
          onClick={async () => {
            await supabase.auth.signOut();
            router.push('/admin/login');
          }}
          className="text-red-600 px-4 py-2 rounded-md hover:bg-red-100"
        >
          Logout
        </button>
      </aside>

      {/* Main */}
      <main className="flex-1 p-8">
        <h2 className="text-3xl font-semibold text-gray-800">Welcome, {adminRole}</h2>
        <p className="mt-2 text-gray-600">
          Use the sidebar to manage your admin tasks.
        </p>
      </main>
    </div>
  );
}
