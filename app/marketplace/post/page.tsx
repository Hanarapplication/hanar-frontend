'use client';

import { useEffect, useState, useRef } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useRouter } from 'next/navigation';
import { compressImage } from '@/lib/imageCompression';

export default function PostItemPage() {
  const router = useRouter();
  const [userId, setUserId] = useState<string | null>(null);
  const [usedSlots, setUsedSlots] = useState(0);
  const [isBusiness, setIsBusiness] = useState(false);
  const [limitReached, setLimitReached] = useState(false);
  const [showPhone, setShowPhone] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [form, setForm] = useState({
    title: '',
    price: '',
    location: '',
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
  });

  const isVehicleCategory = [
    'vehicle', 'car', 'motorcycle', 'bike', 'automobile', 'cars',
    'boat', 'tractor', 'airplane', 'helicopter', 'yatch', 'av',
    'truck', 'semi', 'semi truck', '18 wheeler', 'trailer',
    'atv', 'motor bike', 'off road bike'
  ].some((keyword) => form.category.toLowerCase().includes(keyword));

  useEffect(() => {
    const enforceAuth = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push('/login?redirect=/marketplace/post');
        return;
      }
    };
    enforceAuth();
    const checkPostLimit = async () => {
      const { data: { user }, error } = await supabase.auth.getUser();
      if (error || !user) return;
      setUserId(user.id);

      const firstOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();
      const { count } = await supabase
        .from('marketplace_items')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .gte('created_at', firstOfMonth);

      const { data: profile } = await supabase
        .from('profiles')
        .select('has_business')
        .eq('id', user.id)
        .single();

      setUsedSlots(count || 0);
      setIsBusiness(profile?.has_business || false);
      if ((count || 0) >= 3 && !profile?.has_business) {
        setLimitReached(true);
      }
    };
    checkPostLimit();
  }, []);

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

    const limit = /(vehicle|car|motorcycle|bike|automobile|cars|boat|tractor|airplane|helicopter|yatch|av|truck|semi|semi truck|18 wheeler|trailer|atv|motor bike|off road bike)/i.test(form.category) ? 5 : 2;
    const fileList = Array.from(files);
    if (fileList.length + form.imageUrls.length > limit) {
      alert(`Max ${limit} images allowed.`);
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
      const filename = `${Date.now()}-${file.name}`;
      const { data, error } = await supabase.storage.from('marketplace-images').upload(filename, resized);
      if (error) {
        alert('Upload failed');
        continue;
      }
      const { publicUrl } = supabase.storage.from('marketplace-images').getPublicUrl(filename).data;
      newUrls.push(publicUrl);
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
    if (!userId) return alert('Not logged in');
    if (limitReached && !isBusiness) return alert('Limit reached');

    const { error } = await supabase.from('marketplace_items').insert({
      user_id: userId,
      ...form,
      price: parseFloat(form.price),
    });

    if (error) {
      alert('Failed to post');
    } else {
      alert('Posted!');
      router.push('/marketplace');
    }
  };

  return (
    <div className="max-w-xl mx-auto px-4 py-8 sm:px-6 bg-white rounded-lg shadow-md">
      <h1 className="text-xl sm:text-2xl font-bold mb-4">Post an Item for Sale</h1>

      <p className="text-sm text-gray-600 mb-4">
        {isBusiness ? 'Unlimited posts' : `Used ${usedSlots}/3 this month`}
      </p>

      {limitReached && !isBusiness && (
        <div className="bg-yellow-100 p-3 rounded mb-4 text-sm">
          Limit reached. <a href="/register-business" className="text-blue-600 underline">Upgrade</a> to post more.
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <input name="title" placeholder="Title" value={form.title} onChange={handleChange} className="w-full border px-3 py-2 rounded" required />
        <input name="price" type="number" placeholder="Price" value={form.price} onChange={handleChange} className="w-full border px-3 py-2 rounded" required />
        <input name="location" placeholder="Location" value={form.location} onChange={handleChange} className="w-full border px-3 py-2 rounded" required />
        <input name="category" placeholder="Category" value={form.category} onChange={handleChange} className="w-full border px-3 py-2 rounded" required />

        <select name="condition" value={form.condition} onChange={handleChange} className="w-full border px-3 py-2 rounded">
          <option value="Used">Used</option>
          <option value="New">New</option>
        </select>

        {isVehicleCategory && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <input name="make" placeholder="Make (optional)" value={form.make} onChange={handleChange} className="border px-3 py-2 rounded" />
            <input name="model" placeholder="Model (optional)" value={form.model} onChange={handleChange} className="border px-3 py-2 rounded" />
            <input name="year" placeholder="Year (optional)" value={form.year} onChange={handleChange} className="border px-3 py-2 rounded" />
            <input name="mileage" placeholder="Mileage (optional)" value={form.mileage} onChange={handleChange} className="border px-3 py-2 rounded" />
          </div>
        )}

        <textarea name="description" placeholder="Description (optional)" value={form.description} onChange={handleChange} className="w-full border px-3 py-2 rounded" />

        <div>
          <label className="text-sm font-medium">Upload Images</label>
          <input type="file" multiple accept="image/*" onChange={handleImageUpload} ref={fileInputRef} className="block mt-1" />
          <p className="text-xs text-gray-500">{form.category.toLowerCase() === 'vehicle' ? 'Up to 5 images' : 'Up to 2 images'}</p>
          <div className="flex flex-wrap gap-2 mt-2">
            {imagePreviews.map((src, i) => (
              <div key={i} className="relative w-20 h-20">
                <img src={src} className="object-cover w-full h-full rounded" alt="preview" />
                <button type="button" onClick={() => removeImage(i)} className="absolute top-0 right-0 text-xs bg-red-500 text-white rounded-full px-1">✕</button>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <label className="font-medium">Contact Info</label>
          <div className="flex gap-2 items-center">
            <input name="contact.phone" placeholder="Phone" value={form.contact.phone} onChange={handleChange} type={showPhone ? 'text' : 'password'} className="w-full border px-3 py-2 rounded" />
            {!showPhone && <button type="button" onClick={() => setShowPhone(true)} className="text-blue-600 text-sm">Show</button>}
          </div>
          <input name="contact.whatsapp" placeholder="WhatsApp" value={form.contact.whatsapp} onChange={handleChange} className="w-full border px-3 py-2 rounded" />
          <input name="contact.email" placeholder="Email" value={form.contact.email} onChange={handleChange} className="w-full border px-3 py-2 rounded" />
        </div>

        <button
          type="submit"
          disabled={uploading || (limitReached && !isBusiness)}
          className={`w-full py-3 rounded-md text-white font-semibold transition ${
            uploading || (limitReached && !isBusiness) ? 'bg-gray-400' : 'bg-indigo-600 hover:bg-indigo-700'
          }`}
        >
          {uploading ? 'Uploading...' : 'Post Item'}
        </button>
      </form>
    </div>
  );
}
