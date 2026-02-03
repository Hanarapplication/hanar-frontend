'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

export default function EditItemPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const [form, setForm] = useState<any>(null);
  const [previewImages, setPreviewImages] = useState<string[]>([]);
  const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL || '';

  useEffect(() => {
    // Fetch item from backend
    fetch(`${apiBase}/api/marketplace/${params.id}`)
      .then((res) => res.json())
      .then((data) => {
        setForm(data.item);
        setPreviewImages(data.item?.imageUrls || []);
      });
  }, [params.id]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    if (name.startsWith('contact.')) {
      const key = name.split('.')[1];
      setForm((prev: any) => ({
        ...prev,
        contact: { ...prev.contact, [key]: value },
      }));
    } else {
      setForm((prev: any) => ({ ...prev, [name]: value }));
    }
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const previews = files.map((file) => URL.createObjectURL(file));
    setPreviewImages(previews);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // You can wire this up with PUT /api/marketplace/:id
    console.log('Saving changes...', form);
    alert('Changes saved (simulated)!');
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
          value={form.contact?.whatsapp || ''}
          onChange={handleChange}
          placeholder="WhatsApp Number"
          className="w-full border px-4 py-2 rounded"
        />
        <input
          name="contact.phone"
          value={form.contact?.phone || ''}
          onChange={handleChange}
          placeholder="Phone Number"
          className="w-full border px-4 py-2 rounded"
        />
        <input
          name="contact.email"
          value={form.contact?.email || ''}
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
