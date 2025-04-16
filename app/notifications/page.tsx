'use client';

export default function NotificationsPage() {
  return (
    <div className="min-h-screen bg-blue-50 p-4">
      <h1 className="text-2xl font-bold text-blue-700 mb-4">🔔 Notifications</h1>

      <div className="space-y-4">
        <div className="bg-white rounded-xl shadow p-4">
          <p className="text-sm text-gray-700">📬 You received a message from Bolani House.</p>
          <p className="text-xs text-gray-400 mt-1">2 hours ago</p>
        </div>

        <div className="bg-white rounded-xl shadow p-4">
          <p className="text-sm text-gray-700">✅ Your business listing was approved.</p>
          <p className="text-xs text-gray-400 mt-1">Yesterday</p>
        </div>

        <div className="bg-white rounded-xl shadow p-4">
          <p className="text-sm text-gray-700">💡 Someone liked your community answer.</p>
          <p className="text-xs text-gray-400 mt-1">3 days ago</p>
        </div>
      </div>
    </div>
  );
}
