'use client';

import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';

export default function EditBusinessPage() {
  const { slug } = useParams();

  const [form, setForm] = useState({
    name: 'Bolani House',
    category: 'Afghan Restaurant',
    address: '123 Kabul St, Toronto, ON',
    hours: '10:00 AM - 10:00 PM',
    description: 'Authentic Afghan food made fresh.',
    whatsapp: '',
    phone: '',
    email: '',
    logo: '',
    images: ['', '', ''],
    isRestaurant: true,
    menu: 'Bolani, Mantu, Kabob...',
    instagram: '',
    facebook: '',
    tiktok: '',
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  return (
    <div className="max-w-3xl mx-auto p-4">
      <h1 className="text-2xl font-bold text-[#a93226] mb-6">Edit Business: {form.name}</h1>

      {/* Logo Upload */}
      <div className="mb-4">
        <label className="block font-medium mb-1">Business Logo</label>
        <input type="file" className="block" />
      </div>

      {/* Basic Info */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block font-medium mb-1">Business Name</label>
          <input
            type="text"
            name="name"
            value={form.name}
            onChange={handleChange}
            className="w-full border border-gray-300 p-2 rounded"
          />
        </div>

        <div>
          <label className="block font-medium mb-1">Category</label>
          <input
            type="text"
            name="category"
            value={form.category}
            onChange={handleChange}
            className="w-full border border-gray-300 p-2 rounded"
          />
        </div>

        <div className="sm:col-span-2">
          <label className="block font-medium mb-1">Address</label>
          <input
            type="text"
            name="address"
            value={form.address}
            onChange={handleChange}
            className="w-full border border-gray-300 p-2 rounded"
          />
        </div>

        <div className="sm:col-span-2">
          <label className="block font-medium mb-1">Hours of Operation</label>
          <input
            type="text"
            name="hours"
            value={form.hours}
            onChange={handleChange}
            className="w-full border border-gray-300 p-2 rounded"
          />
        </div>

        <div className="sm:col-span-2">
          <label className="block font-medium mb-1">About / Description</label>
          <textarea
            name="description"
            value={form.description}
            onChange={handleChange}
            rows={4}
            className="w-full border border-gray-300 p-2 rounded"
          ></textarea>
        </div>
      </div>

      {/* Contact Info */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-6">
        <div>
          <label className="block font-medium mb-1">WhatsApp</label>
          <input
            type="text"
            name="whatsapp"
            value={form.whatsapp}
            onChange={handleChange}
            className="w-full border border-gray-300 p-2 rounded"
          />
        </div>
        <div>
          <label className="block font-medium mb-1">Phone</label>
          <input
            type="text"
            name="phone"
            value={form.phone}
            onChange={handleChange}
            className="w-full border border-gray-300 p-2 rounded"
          />
        </div>
        <div>
          <label className="block font-medium mb-1">Email</label>
          <input
            type="email"
            name="email"
            value={form.email}
            onChange={handleChange}
            className="w-full border border-gray-300 p-2 rounded"
          />
        </div>
      </div>

      {/* Social Media */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-6">
        <div>
          <label className="block font-medium mb-1">Instagram</label>
          <input
            type="text"
            name="instagram"
            value={form.instagram}
            onChange={handleChange}
            className="w-full border border-gray-300 p-2 rounded"
          />
        </div>
        <div>
          <label className="block font-medium mb-1">Facebook</label>
          <input
            type="text"
            name="facebook"
            value={form.facebook}
            onChange={handleChange}
            className="w-full border border-gray-300 p-2 rounded"
          />
        </div>
        <div>
          <label className="block font-medium mb-1">TikTok</label>
          <input
            type="text"
            name="tiktok"
            value={form.tiktok}
            onChange={handleChange}
            className="w-full border border-gray-300 p-2 rounded"
          />
        </div>
      </div>

      {/* Extra Images */}
      <div className="mt-6">
        <label className="block font-medium mb-2">Business Images (max 3)</label>
        <input type="file" multiple className="block" />
      </div>

      {/* Menu Field for Restaurants */}
      {form.isRestaurant && (
        <div className="mt-6">
          <label className="block font-medium mb-1">Menu</label>
          <textarea
            name="menu"
            value={form.menu}
            onChange={handleChange}
            rows={3}
            className="w-full border border-gray-300 p-2 rounded"
          ></textarea>
        </div>
      )}

      {/* Save Button */}
      <div className="mt-8">
        <button className="bg-[#a93226] text-white px-6 py-2 rounded hover:bg-[#922b21] transition">
          Save Changes
        </button>
      </div>
    </div>
  );
}
