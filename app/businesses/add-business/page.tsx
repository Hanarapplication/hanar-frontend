'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabaseClient'; // Ensure this path is correct

// This function simulates geocoding. In a real application, you would use a
// proper geocoding API (e.g., Google Geocoding API).
async function getLatLonFromAddress(address: string): Promise<{ lat: number; lon: number } | null> {
  console.log("Attempting to get lat/lon for address:", address);
  // Simulate an asynchronous API call delay
  await new Promise(resolve => setTimeout(resolve, 500));
  // Return a dummy location for demonstration purposes.
  // Replace with actual geocoding API call in a production environment.
  return { lat: 34.052235, lon: -118.243683 }; // Example: Los Angeles coordinates
}

export default function RegisterBusinessPage() {
  const [form, setForm] = useState({
    business_type: '',
    business_name: '',
    description: '',
    phone: '',
    email: '',
    whatsapp: '',
    website: '',
    address: { street: '', city: '', state: '', zip: '' },
    facebook: '',
    instagram: '',
    twitter: '',
    tiktok: '',
    logo: null as File | null,
    images: [] as File[],
  });

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  // Handles changes for all input fields, including nested address fields and file inputs.
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type, files } = e.target as HTMLInputElement; // Type assertion for files

    if (type === 'file') {
      if (name === 'logo') {
        setForm(prev => ({ ...prev, logo: files?.[0] || null }));
        console.log('Logo file selected:', files?.[0]?.name);
      } else if (name === 'images') {
        // Allows multiple image selection for the gallery
        const selectedFiles = Array.from(files || []);
        setForm(prev => ({ ...prev, images: selectedFiles }));
        console.log('Gallery files selected:', selectedFiles.map(f => f.name));
      }
    } else if (name.startsWith('address.')) {
      // Handles nested address object updates
      const key = name.split('.')[1];
      setForm(prev => ({ ...prev, address: { ...prev.address, [key]: value } }));
    } else {
      // Handles top-level form fields
      setForm(prev => ({ ...prev, [name]: value }));
    }
  };

  // Handles the form submission logic, including image uploads and database insertion.
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); // Prevent default form submission behavior
    setSubmitting(true); // Set submitting state to true
    setError(''); // Clear any previous errors
    setSuccess(false); // Clear any previous success messages

    // --- NEW: Get the authenticated user's ID ---
    const { data: { user }, error: userAuthError } = await supabase.auth.getUser();
    if (userAuthError || !user) {
      setError('You must be logged in to register a business. Please log in and try again.');
      console.error('Authentication Error:', userAuthError);
      setSubmitting(false);
      return;
    }
    console.log('Authenticated user ID:', user.id);
    // --- END NEW ---

    // Construct full address string for geocoding
    const addressString = `${form.address.street}, ${form.address.city}, ${form.address.state} ${form.address.zip}`;
    const location = await getLatLonFromAddress(addressString); // Get latitude and longitude

    if (!location) {
      setError('Could not get coordinates from address. Please check the address.');
      setSubmitting(false);
      return;
    }

    const uploadedImageUrls: string[] = []; // Array to store full public URLs of uploaded images

    // Prepare files for upload: logo (if present) and gallery images
    const filesToUpload = [form.logo, ...form.images].filter(Boolean) as File[];

    console.log('Files prepared for upload:', filesToUpload.map(f => f.name));
    if (filesToUpload.length === 0) {
        console.warn('No files selected for upload. Proceeding without image uploads.');
    }

    // Loop through each file, upload to Supabase Storage, and get its public URL
    for (const file of filesToUpload) {
      // Define a unique path for each file in the 'business-uploads' bucket
      const path = `business/${Date.now()}-${file.name}`;
      console.log(`Attempting to upload file: ${file.name} to path: ${path}`);
      
      // Upload the file to Supabase Storage
      const { data, error: uploadError } = await supabase.storage
        .from('business-uploads') // Ensure this bucket exists and has public write/read policies
        .upload(path, file);

      if (uploadError) {
        setError(`Failed to upload image ${file.name}: ${uploadError.message}`);
        console.error(`Supabase Upload Error for ${file.name}:`, uploadError);
        setSubmitting(false);
        return;
      }

      console.log(`Successfully uploaded ${file.name}. Data received:`, data);

      // Get the public URL for the uploaded file
      const { data: publicUrlData } = supabase.storage
        .from('business-uploads')
        .getPublicUrl(path);

      if (publicUrlData && publicUrlData.publicUrl) {
        uploadedImageUrls.push(publicUrlData.publicUrl); // Store the full public URL
        console.log(`Public URL for ${file.name}:`, publicUrlData.publicUrl);
      } else {
        setError(`Failed to get public URL for uploaded image ${file.name}.`);
        console.error(`Supabase getPublicUrl Error for ${file.name}:`, publicUrlData);
        setSubmitting(false);
        return;
      }
    }

    // Determine which URL is the logo URL (the first one if logo was uploaded)
    const logoUrl = form.logo ? uploadedImageUrls[0] : undefined;
    // The remaining URLs are for the gallery images
    const galleryImageUrls = form.logo ? uploadedImageUrls.slice(1) : uploadedImageUrls;

    console.log('Final logo URL to store:', logoUrl);
    console.log('Final gallery image URLs to store:', galleryImageUrls);

    // Generate a slug from the business name for a friendly URL
    const slug = form.business_name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');

    // Free plan defaults (from business_plans table)
    // These must be set during INSERT to satisfy check constraints
    const freePlanDefaults = {
      max_gallery_images: 1,
      max_menu_items: 0,
      max_retail_items: 0,
      max_car_listings: 0,
      allow_social_links: false,
      allow_whatsapp: false,
      allow_promoted: false,
      allow_reviews: false,
      allow_qr: false,
    };

    // Insert business data into the 'businesses' table
    const { data: businessData, error: dbError } = await supabase.from('businesses').insert({
      business_name: form.business_name,
      description: form.description,
      category: form.business_type,
      phone: form.phone,
      email: form.email,
      whatsapp: form.whatsapp,
      website: form.website,
      facebook: form.facebook,
      instagram: form.instagram,
      twitter: form.twitter,
      tiktok: form.tiktok,
      address: form.address,
      lat: location.lat,
      lon: location.lon,
      slug,
      isrestaurant: form.business_type === 'restaurant',
      isdealership: form.business_type === 'car_dealership',
      isretail: ['retails', 'something_else'].includes(form.business_type),
      logo_url: logoUrl, // Store the full public URL for the logo
      images: galleryImageUrls, // Store full public URLs for gallery images
      status: 'inactive', // Default status for new submissions
      business_status: 'pending', // Default business status for new submissions
      owner_id: user.id, // --- NEW: Store the owner's ID ---
      plan: 'free', // Set default plan
      plan_selected_at: null, // Not selected until user confirms
      // ✅ Free plan limits - set during INSERT to satisfy check constraints
      ...freePlanDefaults,
    }).select('id').single();

    if (dbError) {
      setError(`Database error: ${dbError.message}`);
      console.error('Supabase DB Insert Error:', dbError);
    } else {
      // ✅ Apply free plan limits after business creation to satisfy check constraints
      if (businessData?.id) {
        const { error: planErr } = await supabase.rpc('apply_business_plan', {
          p_business_id: businessData.id,
          p_plan: 'free',
          p_years: 1,
        });

        if (planErr) {
          console.error('Failed to apply free plan limits:', planErr);
          // Don't fail registration if plan application fails, but log it
          // The user can still select a plan later
        }
      }
      setSuccess(true); // Indicate successful submission
      console.log('Business data successfully inserted into DB.');
      // Reset form fields after successful submission
      setForm({
        business_type: '',
        business_name: '',
        description: '',
        phone: '',
        email: '',
        whatsapp: '',
        website: '',
        address: { street: '', city: '', state: '', zip: '' },
        facebook: '',
        instagram: '',
        twitter: '',
        tiktok: '',
        logo: null,
        images: [],
      });
    }

    setSubmitting(false); // Reset submitting state
  };

  return (
    <div className="p-6 max-w-2xl mx-auto bg-gray-50 dark:bg-gray-900 rounded-xl shadow-lg my-8 font-inter text-gray-800 dark:text-gray-200">
      <h1 className="text-3xl font-bold text-center mb-6 text-indigo-700 dark:text-indigo-400">Register Your Business</h1>

      {error && <div className="bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300 p-3 rounded-md mb-4">{error}</div>}
      {success && <div className="bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300 p-3 rounded-md mb-4">✅ Business registered successfully! Waiting for approval.</div>}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="business_type" className="block text-sm font-medium mb-1">Business Type</label>
          <select
            id="business_type"
            name="business_type"
            value={form.business_type}
            onChange={handleChange}
            className="w-full border border-gray-300 dark:border-gray-700 p-2 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            required
          >
            <option value="">Select...</option>
            <option value="restaurant">Restaurant</option>
            <option value="car_dealership">Car Dealership</option>
            <option value="retails">Retail</option>
            <option value="something_else">Other</option>
          </select>
        </div>

        <div>
          <label htmlFor="business_name" className="block text-sm font-medium mb-1">Business Name</label>
          <input
            id="business_name"
            name="business_name"
            placeholder="e.g., Delicious Eats Cafe"
            value={form.business_name}
            onChange={handleChange}
            className="w-full border border-gray-300 dark:border-gray-700 p-2 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            required
          />
        </div>

        <div>
          <label htmlFor="description" className="block text-sm font-medium mb-1">Description</label>
          <textarea
            id="description"
            name="description"
            placeholder="Tell us about your business..."
            value={form.description}
            onChange={handleChange}
            rows={4}
            className="w-full border border-gray-300 dark:border-gray-700 p-2 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label htmlFor="phone" className="block text-sm font-medium mb-1">Phone</label>
            <input
              id="phone"
              name="phone"
              type="tel"
              placeholder="e.g., +1234567890"
              value={form.phone}
              onChange={handleChange}
              className="w-full border border-gray-300 dark:border-gray-700 p-2 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              required
            />
          </div>
          <div>
            <label htmlFor="email" className="block text-sm font-medium mb-1">Email</label>
            <input
              id="email"
              name="email"
              type="email"
              placeholder="e.g., info@example.com"
              value={form.email}
              onChange={handleChange}
              className="w-full border border-gray-300 dark:border-gray-700 p-2 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              required
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label htmlFor="whatsapp" className="block text-sm font-medium mb-1">WhatsApp (Optional)</label>
            <input
              id="whatsapp"
              name="whatsapp"
              type="tel"
              placeholder="e.g., +1234567890"
              value={form.whatsapp}
              onChange={handleChange}
              className="w-full border border-gray-300 dark:border-gray-700 p-2 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            />
          </div>
          <div>
            <label htmlFor="website" className="block text-sm font-medium mb-1">Website (Optional)</label>
            <input
              id="website"
              name="website"
              type="url"
              placeholder="e.g., https://www.example.com"
              value={form.website}
              onChange={handleChange}
              className="w-full border border-gray-300 dark:border-gray-700 p-2 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            />
          </div>
        </div>

        <div className="space-y-2">
          <h3 className="text-lg font-semibold mb-2">Social Media Links (Optional)</h3>
          <input name="facebook" placeholder="Facebook URL" value={form.facebook} onChange={handleChange} className="w-full border border-gray-300 dark:border-gray-700 p-2 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500" />
          <input name="instagram" placeholder="Instagram URL" value={form.instagram} onChange={handleChange} className="w-full border border-gray-300 dark:border-gray-700 p-2 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500" />
          <input name="twitter" placeholder="Twitter URL" value={form.twitter} onChange={handleChange} className="w-full border border-gray-300 dark:border-gray-700 p-2 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500" />
          <input name="tiktok" placeholder="TikTok URL" value={form.tiktok} onChange={handleChange} className="w-full border border-gray-300 dark:border-gray-700 p-2 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500" />
        </div>

        <div className="space-y-2">
          <h3 className="text-lg font-semibold mb-2">Business Address</h3>
          <input name="address.street" placeholder="Street Address" value={form.address.street} onChange={handleChange} className="w-full border border-gray-300 dark:border-gray-700 p-2 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500" required />
          <input name="address.city" placeholder="City" value={form.address.city} onChange={handleChange} className="w-full border border-gray-300 dark:border-gray-700 p-2 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500" required />
          <input name="address.state" placeholder="State" value={form.address.state} onChange={handleChange} className="w-full border border-gray-300 dark:border-gray-700 p-2 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500" required />
          <input name="address.zip" placeholder="ZIP Code" value={form.address.zip} onChange={handleChange} className="w-full border border-gray-300 dark:border-gray-700 p-2 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500" required />
        </div>

        <div>
          <label htmlFor="logo" className="block text-sm font-medium mb-1">Logo (1 image)</label>
          <input
            id="logo"
            name="logo"
            type="file"
            accept="image/*"
            onChange={handleChange}
            className="w-full text-gray-900 dark:text-gray-100 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100"
          />
        </div>

        <div>
          <label htmlFor="images" className="block text-sm font-medium mb-1">Gallery Images (max 5)</label>
          <input
            id="images"
            name="images"
            type="file"
            accept="image/*"
            multiple
            onChange={handleChange}
            className="w-full text-gray-900 dark:text-gray-100 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100"
          />
        </div>

        <button
          type="submit"
          disabled={submitting}
          className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-4 rounded-md transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {submitting ? 'Submitting...' : 'Register Business'}
        </button>
      </form>
    </div>
  );
}
