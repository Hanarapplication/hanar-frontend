'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

const mockItem = {
  id: 1,
  title: 'Used iPhone 12 - Excellent Condition',
  price: '400',
  description: 'This iPhone 12 is in perfect working order, minor scratches on the edges.',
  category: 'Phones/Gadgets',
  location: 'Frisco, TX',
  contact: {
    whatsapp: '+1234567890',
    phone: '+19876543210',
    email: 'seller@example.com',
  },
  images: [
    'https://source.unsplash.com/600x400/?iphone',
    'https://source.unsplash.com/600x400/?smartphone',
  ],
};

export default function EditItemPage({ params }) {
  const router = useRouter();
  const [form, setForm] = useState(null);
  const [previewImages, setPreviewImages] = useState([]);

  useEffect(() => {
    setForm(mockItem);
    setPreviewImages(mockItem.images || []);
  }, []);

  const handleChange = (e) => {
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

  const handleImageChange = (e) => {
    const files = Array.from(e.target.files);
    const previews = files.map((file) => URL.createObjectURL(file));
    setPreviewImages(previews);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    console.log('Submitted form:', form);
    alert('Changes saved!');
    router.push(`/marketplace/${form.id}`);
  };

  if (!form) return <div className="p-6">Loading item...</div>;

  return (
    <div className="max-w-2xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-4">Edit Item</h1>

      <form onSubmit={handleSubmit} className="space-y-4">
        <input
          name="title"
          value={form.title}
          onChange={handleChange}
          placeholder="Item Title"
          className="w-full border px-4 py-2 rounded"
        />
        <input
          name="price"
          value={form.price}
          onChange={handleChange}
          placeholder="Price"
          className="w-full border px-4 py-2 rounded"
        />
        <textarea
          name="description"
          value={form.description}
          onChange={handleChange}
          placeholder="Description"
          rows={4}
          className="w-full border px-4 py-2 rounded"
        />

        <input
          name="category"
          value={form.category}
          onChange={handleChange}
          placeholder="Category"
          className="w-full border px-4 py-2 rounded"
        />
        <input
          name="location"
          value={form.location}
          onChange={handleChange}
          placeholder="Location"
          className="w-full border px-4 py-2 rounded"
        />

        <h2 className="font-semibold mt-4">Contact Info</h2>
        <input
          name="contact.whatsapp"
          value={form.contact.whatsapp}
          onChange={handleChange}
          placeholder="WhatsApp Number"
          className="w-full border px-4 py-2 rounded"
        />
        <input
          name="contact.phone"
          value={form.contact.phone}
          onChange={handleChange}
          placeholder="Phone Number"
          className="w-full border px-4 py-2 rounded"
        />
        <input
          name="contact.email"
          value={form.contact.email}
          onChange={handleChange}
          placeholder="Email"
          className="w-full border px-4 py-2 rounded"
        />

        <div>
          <label className="block mb-1 font-medium">Replace Images</label>
          <input
            type="file"
            multiple
            accept="image/*"
            onChange={handleImageChange}
            className="w-full border px-4 py-2 rounded"
          />
          <div className="flex gap-3 mt-3 flex-wrap">
            {previewImages.map((src, i) => (
              <img
                key={i}
                src={src}
                alt={`preview-${i}`}
                className="w-24 h-24 object-cover rounded shadow"
              />
            ))}
          </div>
        </div>

        <button
          type="submit"
          className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
        >
          Save Changes
        </button>
      </form>
    </div>
  );
}
