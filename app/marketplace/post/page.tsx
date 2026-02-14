'use client';

import { useEffect, useState, useRef } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { compressImage } from '@/lib/imageCompression';
import { ArrowLeft } from 'lucide-react';
import AddressAutocomplete, { type AddressResult } from '@/components/AddressAutocomplete';

export default function PostItemPage() {
  const router = useRouter();
  const [userId, setUserId] = useState<string | null>(null);
  const [usedSlots, setUsedSlots] = useState(0);
  const [isBusiness, setIsBusiness] = useState(false);
  const [limitReached, setLimitReached] = useState(false);
  const [packPurchasing, setPackPurchasing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    title: '',
    price: '',
    location: '',
    locationCity: '',
    locationState: '',
    locationZip: '',
    locationLat: null as number | null,
    locationLng: null as number | null,
    category: '',
    condition: 'Used',
    contact: {
      phone: '',
      whatsapp: '',
      email: '',
    },
    make: '',
    model: '',
    year: '',
    mileage: '',
    description: '',
    imageUrls: [] as string[],
    externalBuyUrl: '',
  });

  const isVehicleCategory = [
    'vehicle', 'car', 'motorcycle', 'bike', 'automobile', 'cars',
    'boat', 'tractor', 'airplane', 'helicopter', 'yatch', 'av',
    'truck', 'semi', 'semi truck', '18 wheeler', 'trailer',
    'atv', 'motor bike', 'off road bike'
  ].some((keyword) => form.category.toLowerCase().includes(keyword));

  useEffect(() => {
    const load = async () => {
      const { data: { user }, error } = await supabase.auth.getUser();
      if (error || !user) {
        router.push('/login?redirect=/marketplace/post');
        return;
      }
      setUserId(user.id);

      const { data: { session } } = await supabase.auth.getSession();
      const headers: Record<string, string> = {};
      if (session?.access_token) headers.Authorization = `Bearer ${session.access_token}`;
      const res = await fetch('/api/marketplace/listing-limits', { headers });
      const data = await res.json().catch(() => ({}));

      if (res.ok && data) {
        setIsBusiness(!!data.isBusiness);
        setUsedSlots(data.activeCount ?? 0);
        setLimitReached(!data.canAddMore);
      } else {
        const { data: bizAccount } = await supabase.from('businesses').select('id').eq('owner_id', user.id).maybeSingle();
        setIsBusiness(!!bizAccount?.id);
        if (bizAccount?.id) {
          setUsedSlots(0);
        } else {
          const { count } = await supabase.from('marketplace_items').select('id', { count: 'exact', head: true }).eq('user_id', user.id);
          setUsedSlots(count || 0);
          setLimitReached((count || 0) >= 1);
        }
      }
    };
    load();
  }, [router]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    if (name.startsWith('contact.')) {
      const key = name.split('.')[1];
      setForm((prev) => ({ ...prev, contact: { ...prev.contact, [key]: value } }));
    } else {
      setForm((prev) => ({ ...prev, [name]: value }));
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    const fileList = Array.from(files);
    const limit = isVehicleCategory ? 5 : 2;
    if (fileList.length + form.imageUrls.length > limit) {
      toast.error(`Max ${limit} images allowed.`);
      return;
    }

    setUploading(true);
    const newUrls: string[] = [];
    const newPreviews: string[] = [];

    for (const file of fileList) {
      const resized = await compressImage(file, {
        maxSizeMB: 0.8,
        maxWidthOrHeight: 1400,
        initialQuality: 0.82,
      });
        const safeName = (file.name || 'image').replace(/\s+/g, '-').replace(/[^a-zA-Z0-9.-]/g, '');
        const filename = `individual/${userId || 'anon'}-${Date.now()}-${fileList.indexOf(file)}-${safeName || 'image.png'}`;
      const { error } = await supabase.storage.from('marketplace-images').upload(filename, resized);
      if (error) {
        toast.error('Image upload failed');
        continue;
      }
      const { data } = supabase.storage.from('marketplace-images').getPublicUrl(filename);
      newUrls.push(data.publicUrl);
      newPreviews.push(URL.createObjectURL(resized));
    }

    setForm((prev) => ({ ...prev, imageUrls: [...prev.imageUrls, ...newUrls] }));
    setImagePreviews((prev) => [...prev, ...newPreviews]);
    setUploading(false);
  };

  const removeImage = (index: number) => {
    setForm((prev) => ({
      ...prev,
      imageUrls: prev.imageUrls.filter((_, i) => i !== index),
    }));
    setImagePreviews((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId) return toast.error('Please log in first');
    if (limitReached && !isBusiness) return toast.error('Listing limit reached. Delete one from your dashboard or get the Casual Seller Pack to list more.');

    setSubmitting(true);
    const { imageUrls, locationCity, locationState, locationZip, locationLat, locationLng, externalBuyUrl, ...rest } = form;
    const insertPayload: Record<string, unknown> = {
      ...rest,
      price: parseFloat(form.price),
      image_urls: imageUrls,
    };
    const trimmedUrl = (form.externalBuyUrl || '').trim();
    if (trimmedUrl) insertPayload.external_buy_url = trimmedUrl;
    if (locationCity) insertPayload.location_city = locationCity;
    if (locationState) insertPayload.location_state = locationState;
    if (locationZip) insertPayload.location_zip = locationZip;
    if (locationLat != null) insertPayload.location_lat = locationLat;
    if (locationLng != null) insertPayload.location_lng = locationLng;

    const { data: { session } } = await supabase.auth.getSession();
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (session?.access_token) headers.Authorization = `Bearer ${session.access_token}`;
    const res = await fetch('/api/marketplace/create-item', {
      method: 'POST',
      headers,
      body: JSON.stringify(insertPayload),
    });
    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      toast.error(data?.error || 'Failed to post');
      setSubmitting(false);
    } else {
      toast.success('Item posted!');
      router.push('/marketplace');
    }
  };

  const purchasePack = async () => {
    if (packPurchasing) return;
    setPackPurchasing(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (session?.access_token) headers.Authorization = `Bearer ${session.access_token}`;
      const res = await fetch('/api/stripe/create-checkout-session', {
        method: 'POST',
        headers,
        body: JSON.stringify({ type: 'casual_pack' }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Failed to start checkout');
      if (data?.url) {
        window.location.href = data.url;
      } else {
        throw new Error('No checkout URL returned');
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to start checkout');
      setPackPurchasing(false);
    }
  };

  const isDisabled = uploading || submitting || (limitReached && !isBusiness);

  return (
    <div className="min-h-screen bg-slate-50 py-8">
      <div className="max-w-xl mx-auto px-4 sm:px-6">
        <Link href="/marketplace" className="inline-flex items-center gap-2 text-slate-600 hover:text-indigo-600 text-sm mb-6">
          <ArrowLeft className="h-4 w-4" />
          Back to marketplace
        </Link>
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 sm:p-8">
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 mb-1">Post an Item for Sale</h1>

          <p className="text-sm text-slate-500 mb-6">
            {isBusiness ? 'Unlimited posts' : 'Choose a package below. Free: 1 listing (30 days). Or get the Casual Seller Pack for up to 5 listings.'}
          </p>

          {limitReached && !isBusiness && (
            <div className="mb-6 rounded-2xl border-2 border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 p-4">
              <p className="text-sm font-medium text-amber-800 dark:text-amber-200 mb-3">
                Listing limit reached ({usedSlots} active). Choose a package to list more items:
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-xl border border-slate-200 dark:border-gray-600 bg-white dark:bg-gray-800 p-3">
                  <p className="font-semibold text-slate-900 dark:text-white">Free</p>
                  <p className="text-xs text-slate-600 dark:text-gray-300 mt-0.5">1 listing, expires 30 days after posting.</p>
                  <p className="text-xs text-slate-500 dark:text-gray-400 mt-1">Your current plan.</p>
                </div>
                <div className="rounded-xl border-2 border-emerald-300 dark:border-emerald-600 bg-emerald-50/50 dark:bg-emerald-900/20 p-3">
                  <p className="font-semibold text-slate-900 dark:text-white">Casual Seller Pack</p>
                  <p className="text-xs text-slate-600 dark:text-gray-300 mt-0.5">$19.99 for 40 days. Up to 5 active listings.</p>
                  <button
                    type="button"
                    onClick={purchasePack}
                    disabled={packPurchasing}
                    className="mt-2 w-full rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
                  >
                    {packPurchasing ? 'Activating...' : 'Choose this package – $19.99'}
                  </button>
                </div>
              </div>
              <p className="mt-2 text-xs text-slate-500 dark:text-gray-400">
                Or <Link href="/dashboard" className="text-indigo-600 dark:text-indigo-400 hover:underline">open dashboard</Link> to manage listings and view pricing.
              </p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Title</label>
              <input name="title" placeholder="e.g. iPhone 13 Pro" value={form.title} onChange={handleChange} className="w-full border border-slate-300 rounded-xl px-4 py-2.5 text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200" required />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Price ($)</label>
              <input name="price" type="number" step="0.01" placeholder="0.00" value={form.price} onChange={handleChange} className="w-full border border-slate-300 rounded-xl px-4 py-2.5 text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200" required />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Location</label>
              <AddressAutocomplete
                value={form.location}
                onSelect={(result: AddressResult) => {
                  const locationLabel = [result.city, result.state].filter(Boolean).join(', ') || result.formatted_address;
                  setForm((prev) => ({
                    ...prev,
                    location: locationLabel,
                    locationCity: result.city || '',
                    locationState: result.state || '',
                    locationZip: result.zip || '',
                    locationLat: result.lat ?? null,
                    locationLng: result.lng ?? null,
                  }));
                }}
                onChange={(value) => setForm((prev) => ({ ...prev, location: value }))}
                placeholder="City, State or ZIP (start typing for suggestions)"
                mode="locality"
                inputClassName="w-full border border-slate-300 rounded-xl px-4 py-2.5 text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Category</label>
              <input name="category" placeholder="e.g. Electronics, Vehicle, Furniture" value={form.category} onChange={handleChange} className="w-full border border-slate-300 rounded-xl px-4 py-2.5 text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200" required />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Condition</label>
              <select name="condition" value={form.condition} onChange={handleChange} className="w-full border border-slate-300 rounded-xl px-4 py-2.5 text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200">
                <option value="Used">Used</option>
                <option value="New">New</option>
              </select>
            </div>

            {isVehicleCategory && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <input name="make" placeholder="Make (optional)" value={form.make} onChange={handleChange} className="border border-slate-300 rounded-xl px-4 py-2.5" />
                <input name="model" placeholder="Model (optional)" value={form.model} onChange={handleChange} className="border border-slate-300 rounded-xl px-4 py-2.5" />
                <input name="year" placeholder="Year (optional)" value={form.year} onChange={handleChange} className="border border-slate-300 rounded-xl px-4 py-2.5" />
                <input name="mileage" placeholder="Mileage (optional)" value={form.mileage} onChange={handleChange} className="border border-slate-300 rounded-xl px-4 py-2.5" />
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
              <textarea name="description" placeholder="Describe your item..." value={form.description} onChange={handleChange} rows={3} className="w-full border border-slate-300 rounded-xl px-4 py-2.5 text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200 resize-y" />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Link for online buyers (optional)</label>
              <input
                name="externalBuyUrl"
                type="url"
                placeholder="e.g. https://amazon.com/... or https://ebay.com/..."
                value={form.externalBuyUrl}
                onChange={handleChange}
                className="w-full border border-slate-300 rounded-xl px-4 py-2.5 text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
              />
              <p className="text-xs text-slate-500 mt-1">If you also sell on Amazon, eBay, etc., add the link. Buyers will open it in a new tab.</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Images</label>
              <input type="file" multiple accept="image/*" onChange={handleImageUpload} ref={fileInputRef} disabled={uploading} className="block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-600 hover:file:bg-indigo-100" />
              <p className="text-xs text-slate-500 mt-1">{isVehicleCategory ? 'Up to 5 images for vehicles' : 'Up to 2 images'}</p>
              <div className="flex flex-wrap gap-3 mt-2">
                {imagePreviews.map((src, i) => (
                  <div key={i} className="relative w-20 h-20 rounded-xl overflow-hidden border border-slate-200">
                    <img src={src} className="object-cover w-full h-full" alt="" />
                    <button type="button" onClick={() => removeImage(i)} className="absolute top-1 right-1 w-5 h-5 flex items-center justify-center bg-red-500 text-white text-xs rounded-full hover:bg-red-600">×</button>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-3">
              <label className="block text-sm font-medium text-slate-700">Contact Info</label>
              <input name="contact.phone" type="tel" placeholder="Phone number" value={form.contact.phone} onChange={handleChange} className="w-full border border-slate-300 rounded-xl px-4 py-2.5 text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200" />
              <input name="contact.whatsapp" placeholder="WhatsApp" value={form.contact.whatsapp} onChange={handleChange} className="w-full border border-slate-300 rounded-xl px-4 py-2.5 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200" />
              <input name="contact.email" type="email" placeholder="Email" value={form.contact.email} onChange={handleChange} className="w-full border border-slate-300 rounded-xl px-4 py-2.5 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200" />
            </div>

            <button
              type="submit"
              disabled={isDisabled}
              className="w-full py-3 rounded-xl bg-indigo-600 text-white font-semibold hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed transition"
            >
              {uploading ? 'Uploading...' : submitting ? 'Posting...' : 'Post Item'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
