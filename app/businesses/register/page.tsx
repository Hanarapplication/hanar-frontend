'use client';

import { useState } from 'react';

export default function RegisterBusiness() {
  const [images, setImages] = useState<File[]>([]);
  const [isRestaurant, setIsRestaurant] = useState(false);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const selected = Array.from(e.target.files).slice(0, 3);
      setImages(selected);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-indigo-50 p-6">
      <div className="max-w-3xl mx-auto bg-white shadow-lg rounded-xl p-6 space-y-6">
        <h1 className="text-3xl font-bold text-indigo-700">Register Your Business</h1>

        {/* Business Info */}
        <div className="space-y-3">
          <input type="text" placeholder="Business Name" className="w-full p-2 border rounded" required />
          <textarea placeholder="Business Description" className="w-full p-2 border rounded" required />
          <input type="text" placeholder="Category (e.g. Restaurant, Salon...)" className="w-full p-2 border rounded" required />
        </div>

        {/* Contact Info */}
        <div className="space-y-3">
          <h2 className="text-xl font-semibold">Contact Info</h2>
          <input type="text" placeholder="Phone Number (optional)" className="w-full p-2 border rounded" />
          <input type="email" placeholder="Email (optional)" className="w-full p-2 border rounded" />
          <input type="text" placeholder="WhatsApp Link (optional)" className="w-full p-2 border rounded" />
          <input type="text" placeholder="Website or Social Media (optional)" className="w-full p-2 border rounded" />
        </div>

        {/* Hours */}
        <div className="space-y-2">
          <h2 className="text-xl font-semibold">Hours of Operation</h2>
          <input type="text" placeholder="Monday - Friday: 9am - 5pm (optional)" className="w-full p-2 border rounded" />
        </div>

        {/* Address */}
        <div className="space-y-2">
          <h2 className="text-xl font-semibold">Address</h2>
          <input type="text" placeholder="Street Address" className="w-full p-2 border rounded" required />
          <input type="text" placeholder="City" className="w-full p-2 border rounded" required />
          <input type="text" placeholder="State" className="w-full p-2 border rounded" required />
          <input type="text" placeholder="Zip Code" className="w-full p-2 border rounded" required />
        </div>

        {/* Upload Images */}
        <div className="space-y-2">
          <h2 className="text-xl font-semibold">Upload up to 3 Images</h2>
          <label className="inline-block bg-indigo-600 text-white px-4 py-2 rounded cursor-pointer hover:bg-indigo-700">
            Choose Images
            <input type="file" multiple accept="image/*" onChange={handleImageChange} className="hidden" />
          </label>
          <div className="flex gap-2 mt-2 flex-wrap">
            {images.map((img, i) => (
              <p key={i} className="text-sm text-gray-600">{img.name}</p>
            ))}
          </div>
        </div>

        {/* Restaurant Menu */}
        <div className="space-y-2">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={isRestaurant}
              onChange={() => setIsRestaurant(!isRestaurant)}
            />
            This is a restaurant
          </label>
          {isRestaurant && (
            <div className="space-y-2">
              <h2 className="text-xl font-semibold">Upload Menu (PDF or List)</h2>
              <label className="inline-block bg-indigo-600 text-white px-4 py-2 rounded cursor-pointer hover:bg-indigo-700">
                Upload Menu
                <input type="file" accept=".pdf" className="hidden" />
              </label>
              <textarea placeholder="Or list dishes here..." className="w-full p-2 border rounded" />
            </div>
          )}
        </div>

        {/* Submit */}
        <button className="w-full bg-indigo-600 text-white py-2 rounded hover:bg-indigo-700 transition">
          Submit Business
        </button>
      </div>
    </div>
  );
}
