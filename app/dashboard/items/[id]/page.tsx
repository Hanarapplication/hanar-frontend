'use client';

import { useParams } from 'next/navigation';
import { useEffect, useState, useRef } from 'react';

export default function EditItemPage() {
  const { id } = useParams();
  const primaryColor = 'teal';
  const imageInputRef = useRef<HTMLInputElement>(null); // Single ref for multiple images
  const maxImages = 6;
  const [form, setForm] = useState({
    title: '',
    category: '',
    description: '',
    price: '',
    currency: 'USD',
    images: [], // Array to store multiple file objects or data URLs
    whatsapp: '',
    phone: '',
    email: '',
    language: 'en',
  });

  useEffect(() => {
    // Mock load example with multiple images
    setForm((prev) => ({
      ...prev,
      title: 'Set of Antique Teacups',
      category: 'Collectibles',
      description: 'Beautiful set of six antique teacups with saucers.',
      price: '250',
      currency: 'USD',
      images: [
        'https://source.unsplash.com/200x150/?teacup,antique',
        'https://source.unsplash.com/200x150/?teacup,floral',
      ],
    }));
  }, [id]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleImageChange = (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length > 0) {
      const newImages = [];
      for (let i = 0; i < Math.min(files.length, maxImages - form.images.length); i++) {
        const file = files[i];
        newImages.push(file);
        const reader = new FileReader();
        reader.onloadend = () => {
          setForm((prev) => ({
            ...prev,
            images: [
              ...prev.images.slice(0, prev.images.findIndex(img => img === file)),
              reader.result,
              ...prev.images.slice(prev.images.findIndex(img => img === file) + 1),
            ],
          }));
        };
        reader.readAsDataURL(file);
      }
      setForm((prev) => ({ ...prev, images: [...prev.images, ...newImages] }));
    }
  };

  const triggerImageUpload = () => {
    imageInputRef.current?.click();
  };

  const removeImage = (index) => {
    setForm((prev) => ({
      ...prev,
      images: prev.images.filter((_, i) => i !== index),
    }));
  };

  return (
    <div className="max-w-3xl mx-auto p-8 bg-gray-50 rounded-xl shadow-lg">
      <h1 className={`text-3xl font-extrabold text-${primaryColor}-700 mb-8 tracking-tight`}>
        Edit Marketplace Item
      </h1>

      <div className="space-y-6">
        <div className="bg-gray-100 rounded-lg shadow-sm border border-gray-200 p-6 space-y-4">
          {/* Title, Category, Description */}
          <div>
            <label htmlFor="title" className="block text-lg font-semibold text-gray-800 mb-2">
              Title
            </label>
            <input
              type="text"
              name="title"
              value={form.title}
              onChange={handleChange}
              placeholder="Item Title"
              className="mt-1 block w-full rounded-md border-gray-300 shadow-inner focus:border-${primaryColor}-500 focus:ring-${primaryColor}-500 sm:text-sm py-3 px-4 bg-white"
            />
          </div>
          <div>
            <label htmlFor="category" className="block text-lg font-semibold text-gray-800 mb-2">
              Category
            </label>
            <input
              type="text"
              name="category"
              value={form.category}
              onChange={handleChange}
              placeholder="Category"
              className="mt-1 block w-full rounded-md border-gray-300 shadow-inner focus:border-${primaryColor}-500 focus:ring-${primaryColor}-500 sm:text-sm py-3 px-4 bg-white"
            />
          </div>
          <div>
            <label htmlFor="description" className="block text-lg font-semibold text-gray-800 mb-2">
              Description
            </label>
            <textarea
              name="description"
              value={form.description}
              onChange={handleChange}
              rows={4}
              placeholder="Description"
              className="mt-1 block w-full rounded-md border-gray-300 shadow-inner focus:border-${primaryColor}-500 focus:ring-${primaryColor}-500 sm:text-sm py-3 px-4 bg-white"
            />
          </div>
          <div className="flex gap-4">
            <div className="w-1/2">
              <label htmlFor="price" className="block text-lg font-semibold text-gray-800 mb-2">
                Price
              </label>
              <input
                type="text"
                name="price"
                value={form.price}
                onChange={handleChange}
                placeholder="Price"
                className="mt-1 block w-full rounded-md border-gray-300 shadow-inner focus:border-${primaryColor}-500 focus:ring-${primaryColor}-500 sm:text-sm py-3 px-4 bg-white"
              />
            </div>
            <div className="w-auto">
              <label htmlFor="currency" className="block text-lg font-semibold text-gray-800 mb-2">
                Currency
              </label>
              <select
                name="currency"
                value={form.currency}
                onChange={handleChange}
                className="mt-1 block w-28 rounded-md border-gray-300 shadow-inner focus:border-${primaryColor}-500 focus:ring-${primaryColor}-500 sm:text-sm py-3 px-4 bg-white"
              >
                <option value="USD">USD</option>
                <option value="CAD">CAD</option>
                <option value="EUR">EUR</option>
                <option value="AFN">AFN</option>
              </select>
            </div>
          </div>
        </div>

        <div className="bg-gray-100 rounded-lg shadow-sm border border-gray-200 p-6 space-y-4">
          <label className="block text-lg font-semibold text-gray-800 mb-2">
            Images (Up to {maxImages})
          </label>
          <div className="mt-1 flex items-center space-x-4">
            <button
              type="button"
              className={`inline-flex items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-${primaryColor}-500 focus:ring-offset-2 transition duration-150`}
              onClick={triggerImageUpload}
              disabled={form.images.length >= maxImages}
            >
              Choose Images
            </button>
            {form.images.length >= maxImages && (
              <span className="text-sm text-gray-500">Maximum {maxImages} images selected.</span>
            )}
            <input
              type="file"
              accept="image/*"
              multiple
              className="sr-only"
              onChange={handleImageChange}
              ref={imageInputRef}
            />
          </div>
          <div className="mt-2 grid grid-cols-2 gap-4 sm:grid-cols-3">
            {form.images.map((image, index) => (
              <div key={index} className="relative">
                <div className="relative w-full h-32 overflow-hidden rounded-md shadow-sm">
                  <img
                    src={typeof image === 'string' ? image : URL.createObjectURL(image)}
                    alt={`Image ${index + 1}`}
                    className="object-cover w-full h-full"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => removeImage(index)}
                  className="absolute top-1 right-1 bg-gray-200 rounded-full w-6 h-6 flex items-center justify-center text-gray-600 hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-${primaryColor}-500 transition duration-150"
                >
                  <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                    <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Contact Information and Language */}
        <div className="bg-gray-100 rounded-lg shadow-sm border border-gray-200 p-6 space-y-4">
          <label className="block text-lg font-semibold text-gray-800 mb-2">
            Contact Information
          </label>
          <div>
            <label htmlFor="whatsapp" className="block text-sm font-medium text-gray-700">
              WhatsApp Number
            </label>
            <input
              type="text"
              name="whatsapp"
              value={form.whatsapp}
              onChange={handleChange}
              placeholder="WhatsApp Number"
              className="mt-1 block w-full rounded-md border-gray-300 shadow-inner focus:border-${primaryColor}-500 focus:ring-${primaryColor}-500 sm:text-sm py-3 px-4 bg-white"
            />
          </div>
          <div>
            <label htmlFor="phone" className="block text-sm font-medium text-gray-700">
              Phone Number
            </label>
            <input
              type="text"
              name="phone"
              value={form.phone}
              onChange={handleChange}
              placeholder="Phone Number"
              className="mt-1 block w-full rounded-md border-gray-300 shadow-inner focus:border-${primaryColor}-500 focus:ring-${primaryColor}-500 sm:text-sm py-3 px-4 bg-white"
            />
          </div>
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700">
              Email
            </label>
            <input
              type="email"
              name="email"
              value={form.email}
              onChange={handleChange}
              placeholder="Email"
              className="mt-1 block w-full rounded-md border-gray-300 shadow-inner focus:border-${primaryColor}-500 focus:ring-${primaryColor}-500 sm:text-sm py-3 px-4 bg-white"
            />
          </div>
        </div>

        <div className="bg-gray-100 rounded-lg shadow-sm border border-gray-200 p-6">
          <label htmlFor="language" className="block text-lg font-semibold text-gray-800 mb-2">
            Language
          </label>
          <select
            name="language"
            value={form.language}
            onChange={handleChange}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-inner focus:border-${primaryColor}-500 focus:ring-${primaryColor}-500 sm:text-sm py-3 px-4 bg-white"
          >
            <option value="en">🇺🇸 English</option>
            <option value="fa">🇮🇷 فارسی</option>
            <option value="ar">🇸🇦 Arabic</option>
            <option value="tr">🇹🇷 Turkish</option>
            <option value="ps">🇦🇫 Pashto</option>
          </select>
        </div>

        <div className="flex justify-between items-center">
          <button
            className={`inline-flex items-center justify-center rounded-md border border-transparent bg-red-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 transition duration-150 ease-in-out`}
          >
            Delete This Item
          </button>
          <button
            className={`inline-flex items-center justify-center rounded-md border border-transparent bg-blue-600 px-6 py-3 text-lg font-semibold text-white shadow-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition duration-150 ease-in-out`}
          >
            Save Changes
          </button>
        </div>
      </div>
    </div>
  );
}