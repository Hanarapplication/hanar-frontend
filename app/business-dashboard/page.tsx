'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useRouter } from 'next/navigation';

// Define a type for the business object fetched from Supabase
interface UserBusiness {
  slug: string;
  business_name: string;
  business_status: 'pending' | 'approved' | 'rejected'; // Assuming these are your possible statuses
  status: 'active' | 'inactive'; // Assuming 'active' or 'inactive'
}

export default function BusinessDashboard() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null); // State to hold the authenticated user object
  const [loading, setLoading] = useState(true); // Loading state for initial data fetch
  const [business, setBusiness] = useState<UserBusiness | null>(null); // State to hold the user's business

  useEffect(() => {
    const fetchUserAndBusiness = async () => {
      setLoading(true); // Start loading

      // 1. Fetch authenticated user
      const { data: userData, error: userError } = await supabase.auth.getUser();

      if (userError || !userData?.user) {
        console.error('User not authenticated:', userError);
        router.push('/login'); // Redirect to login if no user is found
        return;
      }

      const currentUser = userData.user;
      setUser(currentUser); // Set the user in state

      // 2. Fetch the user's business(es)
      // We need to fetch all statuses to determine if a business is pending or approved
      const { data: bizData, error: bizError } = await supabase
        .from('businesses')
        // Select all necessary fields to determine status and for editing
        .select('slug, business_name, business_status, status')
        .eq('owner_id', currentUser.id) // Filter by the current user's ID
        .maybeSingle(); // Use maybeSingle to get null if no record, or a single record

      if (bizError) {
        console.error('Error fetching business data:', bizError);
        // Optionally, set an error message to display on the dashboard
      } else if (bizData) {
        setBusiness(bizData as UserBusiness); // Cast and set the business data
      } else {
        setBusiness(null); // No business found for this user
      }

      setLoading(false); // End loading
    };

    fetchUserAndBusiness();

    // Set up a listener for auth state changes (e.g., user logs out)
    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) {
        // If session is null, user has logged out, redirect to login
        router.push('/login');
      }
    });

    // Cleanup the auth listener on component unmount
    return () => {
      authListener?.subscription.unsubscribe();
    };
  }, [router]); // Dependency array includes router to avoid lint warnings

  if (loading) {
    return (
      <div className="min-h-screen flex justify-center items-center bg-gray-100 dark:bg-gray-900 text-gray-500 dark:text-gray-400">
        <div className="animate-spin rounded-full h-12 w-12 border-t-4 border-b-4 border-indigo-500 dark:border-indigo-400 text-indigo-500 dark:text-indigo-400" />
        <p className="ml-4">Loading your dashboard...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-900 font-inter text-gray-800 dark:text-gray-200">
      <header className="bg-white dark:bg-gray-800 shadow px-6 py-4 flex flex-col sm:flex-row justify-between items-center">
        <h1 className="text-xl sm:text-2xl font-bold text-indigo-700 dark:text-indigo-400 mb-2 sm:mb-0">Business Dashboard</h1>
        {user && (
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Welcome, <span className="font-semibold">{user.user_metadata?.full_name || user.email || 'Business Owner'}</span>
          </p>
        )}
      </header>

      <main className="p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Business Management Section */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 sm:p-6">
          <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-3">Your Business Profile</h2>

          {!business ? (
            // Case 1: No business found for this user
            <>
              <p className="text-gray-600 dark:text-gray-300 mb-4">It looks like you haven't registered a business yet.</p>
              <button
                onClick={() => router.push('/businesses/add-business')} // {/* Assuming /businesses/register is your add business page */}
                className="mt-4 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md block w-full transition-colors duration-200"
              >
                + Add Your Business
              </button>
            </>
          ) : business.business_status === 'pending' ? (
            // Case 2: Business exists but is pending approval
            <>
              <p className="text-yellow-700 dark:text-yellow-400 font-medium mb-4">
                Your business "<span className="font-bold">{business.business_name}</span>" is currently pending approval.
                We'll notify you once it's reviewed by an admin.
              </p>
              <p className="text-gray-600 dark:text-gray-300 text-sm">
                You cannot edit your business until it has been approved.
              </p>
            </>
          ) : business.business_status === 'approved' && business.status === 'active' ? (
            // Case 3: Business exists and is approved and active
            <>
              <p className="text-green-700 dark:text-green-400 font-medium mb-4">
                Your business "<span className="font-bold">{business.business_name}</span>" is live!
              </p>
              <button
                onClick={() => router.push(`/businesses/edit/${business.slug}`)} //{/* Link to edit page */}
                className="mt-4 bg-yellow-500 hover:bg-yellow-600 text-white px-4 py-2 rounded-md block w-full transition-colors duration-200"
              >
                ✏️ Edit Your Business
              </button>
              {/* You can add more buttons here for managing menu, car listings, etc. */}
              {/* Example: */}
              {/* <button
                onClick={() => router.push(`/businesses/${business.slug}/manage-menu`)}
                className="mt-2 bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded block w-full"
              >
                Manage Menu
              </button> */}
            </>
          ) : (
            // Case 4: Business exists but is rejected or inactive (e.g., 'rejected', 'inactive')
            // You might want to handle 'rejected' differently, perhaps allowing re-submission
            <>
              <p className="text-red-700 dark:text-red-400 font-medium mb-4">
                Your business "<span className="font-bold">{business.business_name}</span>" is currently {business.business_status}.
                Please contact support for more information.
              </p>
              {/* Optionally, provide an option to contact support or re-submit if rejected */}
            </>
          )}
        </div>

        {/* Post Promotions */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 sm:p-6">
          <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-3">Promotions</h2>
          <p className="text-gray-600 dark:text-gray-300 mb-4">Boost your posts or run limited-time specials to attract more customers.</p>
          <button
            className="mt-4 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-md transition-colors duration-200"
            disabled={!business || business.business_status !== 'approved'} // Disable if no approved business
          >
            Boost a Post
          </button>
        </div>

        {/* Followers / Notifications */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 sm:p-6">
          <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-3">Followers & Reach</h2>
          <p className="text-gray-600 dark:text-gray-300 mb-4">View your followers, analyze engagement, and send announcements.</p>
          <button
            className="mt-4 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-md transition-colors duration-200"
            disabled={!business || business.business_status !== 'approved'} // Disable if no approved business
          >
            Notify Followers
          </button>
        </div>
      </main>
    </div>
  );
}
