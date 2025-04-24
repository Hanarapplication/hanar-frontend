'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import ImageUploader from '@/components/ImageUploader';
import axios from 'axios';

export default function PostItemPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [form, setForm] = useState({
    title: '',
    price: '',
    location: '',
    zip: '',
    category: '',
    condition: 'Used',
    contact: {
      phone: '',
      whatsapp: '',
      email: '',
    },
    imageUrls: [] as string[],
  });

  useEffect(() => {
    const storedToken = localStorage.getItem('hanarToken');
    if (!storedToken) {
      router.push('/login');
    } else {
      setToken(storedToken);
      setLoading(false);
    }
  }, [router]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;

    if (name.startsWith('contact.')) {
      const key = name.split('.')[1];
      setForm((prev) => ({
        ...prev,
        contact: { ...prev.contact, [key]: value },
      }));
    } else {
      setForm((prev) => ({ ...prev, [name]: value }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validation
    if (!form.title || !form.price || !form.category || !form.location || form.imageUrls.length === 0) {
      alert('Please fill in all required fields and upload at least one image.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await axios.post('http://localhost:5000/api/postomarketplace/create', {
        ...form,
        price: parseFloat(form.price),
      }, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (res.status === 201) {
        const itemId = res.data.item?.id || '';
        alert('🎉 Your item has been posted!');
        router.push(`/marketplace/${itemId}`);
      }
    } catch (err) {
      console.error('❌ Submit error:', err);
      alert('Something went wrong. Try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <div className="p-6 text-center">🔐 Checking login...</div>;

  return (
    <div className="max-w-2xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-4">Post New Marketplace Item</h1>

      <form onSubmit={handleSubmit} className="space-y-4">
        <input name="title" placeholder="Item Title" value={form.title} onChange={handleChange} required className="w-full border px-4 py-2 rounded" />
        <input name="price" placeholder="Price (e.g. 19.99)" value={form.price} onChange={handleChange} required className="w-full border px-4 py-2 rounded" type="number" />
        <input name="location" placeholder="Location (City, State)" value={form.location} onChange={handleChange} required className="w-full border px-4 py-2 rounded" />
        <input name="zip" placeholder="ZIP Code (optional)" value={form.zip} onChange={handleChange} className="w-full border px-4 py-2 rounded" />

        <select name="condition" value={form.condition} onChange={handleChange} className="w-full border px-4 py-2 rounded">
          <option value="Used">Used</option>
          <option value="New">New</option>
        </select>

        <input name="category" placeholder="Category (e.g. Phones, Furniture)" value={form.category} onChange={handleChange} required className="w-full border px-4 py-2 rounded" />

        {/* 👤 Contact Info */}
        <div className="space-y-2">
          <h2 className="font-semibold">Contact Info</h2>
          <input name="contact.phone" placeholder="Phone" value={form.contact.phone} onChange={handleChange} className="w-full border px-4 py-2 rounded" />
          <input name="contact.whatsapp" placeholder="WhatsApp" value={form.contact.whatsapp} onChange={handleChange} className="w-full border px-4 py-2 rounded" />
          <input name="contact.email" placeholder="Email" value={form.contact.email} onChange={handleChange} className="w-full border px-4 py-2 rounded" />
        </div>

        {/* 📷 Uploader */}
        <ImageUploader
          onUploadComplete={(urls: string[]) =>
            setForm((prev) => ({ ...prev, imageUrls: urls }))
          }
        />

        {/* ✅ Submit */}
        <button type="submit" disabled={submitting} className="w-full bg-indigo-600 text-white px-4 py-2 rounded hover:bg-indigo-700">
          {submitting ? 'Posting...' : 'Post Item'}
        </button>
      </form>
    </div>
  );
}
