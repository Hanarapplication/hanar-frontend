'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Cookies from 'js-cookie';

export default function OwnerAdminPage() {
  const [role, setRole] = useState('');
  const [isAuthorized, setIsAuthorized] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const storedRole = Cookies.get('adminRole');
    setRole(storedRole || '');

    if (storedRole === 'owner') {
      setIsAuthorized(true);
    } else {
      router.push('/unauthorized');
    }
  }, []);

  if (!isAuthorized) return null;

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <h1 className="text-3xl font-bold mb-6">Owner Admin Panel</h1>
      <p className="mb-8 text-gray-600">Full access to Hanar platform features</p>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">

        {/* Business Approval */}
   <button
  onClick={() => router.push('/admin/approvals')}
  className="bg-green-600 text-white px-4 py-3 rounded-lg shadow hover:bg-green-700 transition"
>
  ✅ Approve New Businesses
</button>

        {/* Ad Requests */}
        <button className="bg-yellow-600 text-white px-4 py-3 rounded-lg shadow hover:bg-yellow-700 transition">
          📢 Manage Ad Requests
        </button>

        {/* Banner Management */}
        <button className="bg-blue-600 text-white px-4 py-3 rounded-lg shadow hover:bg-blue-700 transition">
          🖼️ Manage Homepage Banners
        </button>

        {/* Review Business Notifications */}
        <button
          onClick={() => router.push('/admin/notification-requests')}
          className="bg-purple-600 text-white px-4 py-3 rounded-lg shadow hover:bg-purple-700 transition"
        >
          🔔 Review Business Notification Requests
        </button>

        {/* Manage Organizations */}
        <button
          onClick={() => router.push('/admin/organizations')}
          className="bg-teal-600 text-white px-4 py-3 rounded-lg shadow hover:bg-teal-700 transition"
        >
          🏛️ Manage Organizations
        </button>

        {/* Create Business / Organization */}
        <button
          onClick={() => router.push('/admin/create')}
          className="bg-teal-600 text-white px-4 py-3 rounded-lg shadow hover:bg-teal-700 transition"
        >
          🏢 Create Business or Organization
        </button>

        {/* Email Businesses */}
        <button
          onClick={() => router.push('/admin/send-emails')}
          className="bg-orange-500 text-white px-4 py-3 rounded-lg shadow hover:bg-orange-600 transition"
        >
          📧 Email Businesses
        </button>

        {/* Send Local Notification */}
        <button className="bg-orange-600 text-white px-4 py-3 rounded-lg shadow hover:bg-orange-700 transition">
          📍 Send Local Notifications to Users
        </button>

        {/* Send Global Notification */}
        <button className="bg-pink-600 text-white px-4 py-3 rounded-lg shadow hover:bg-pink-700 transition">
          🌍 Send International Notifications
        </button>

        {/* Review Community Posts */}
        <button className="bg-indigo-600 text-white px-4 py-3 rounded-lg shadow hover:bg-indigo-700 transition">
          📝 Review New Community Posts
        </button>

        {/* Review Reported Content */}
        <button className="bg-red-600 text-white px-4 py-3 rounded-lg shadow hover:bg-red-700 transition">
          🚨 Review Reported Posts or Comments
        </button>

        {/* Future Features Placeholder */}
        <button className="bg-gray-600 text-white px-4 py-3 rounded-lg shadow hover:bg-gray-700 transition">
          🛠️ Coming Soon...
        </button>
      </div>
    </div>
  );
}
