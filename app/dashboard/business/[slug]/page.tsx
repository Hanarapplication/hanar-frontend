'use client';

import { useParams } from 'next/navigation';
import { useState, useRef } from 'react';
import { FaUpload, FaTrash } from 'react-icons/fa';

export default function EditBusinessPage() {
  const { slug } = useParams();
  const fileInputRef = useRef<HTMLInputElement>(null);

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
    images: [],
    isRestaurant: true,
    menu: {
      Appetizers: [{ name: 'Bolani', price: '$6.99', description: 'Stuffed Afghan flatbread' }],
    },
    instagram: '',
    facebook: '',
    tiktok: '',
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleLogoChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      setForm((prev) => ({ ...prev, logo: file }));
    }
  };

  const handleImageChange = (e) => {
    const files = Array.from(e.target.files || []);
    setForm((prev) => ({ ...prev, images: files }));
  };

  const addCategory = () => {
    const newKey = prompt('Enter new category name:');
    if (newKey && !form.menu[newKey]) {
      setForm((prev) => ({ ...prev, menu: { ...prev.menu, [newKey]: [] } }));
    }
  };

  const addItem = (cat) => {
    setForm((prev) => ({
      ...prev,
      menu: {
        ...prev.menu,
        [cat]: [...(prev.menu[cat] || []), { name: '', price: '', description: '' }],
      },
    }));
  };

  const handleMenuChange = (cat, i, field, value) => {
    setForm((prev) => ({
      ...prev,
      menu: {
        ...prev.menu,
        [cat]: prev.menu[cat].map((item, index) =>
          index === i ? { ...item, [field]: value } : item
        ),
      },
    }));
  };

  const removeItem = (cat, i) => {
    setForm((prev) => ({
      ...prev,
      menu: {
        ...prev.menu,
        [cat]: prev.menu[cat].filter((_, index) => index !== i),
      },
    }));
  };

  const removeCategory = (cat) => {
    const { [cat]: removedCategory, ...restOfMenu } = form.menu;
    setForm((prev) => ({ ...prev, menu: restOfMenu }));
  };

  return (
    <div className="max-w-3xl mx-auto p-6">
      <div className="bg-white rounded-lg shadow-md border border-gray-200 p-6">
        <h1 className="text-2xl font-semibold text-indigo-700 mb-6">Edit Business: {form.name}</h1>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3 mb-6">
          <div className="p-4 border rounded-md bg-indigo-50">
            <h3 className="font-semibold text-gray-700 mb-2">Basic Information</h3>
            <div className="space-y-2">
              <div>
                <label htmlFor="name" className="block text-gray-700 text-sm font-medium mb-1">Business Name</label>
                <input type="text" id="name" name="name" value={form.name} onChange={handleChange} className="shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 rounded-md bg-white" />
              </div>
              <div>
                <label htmlFor="category" className="block text-gray-700 text-sm font-medium mb-1">Category</label>
                <input type="text" id="category" name="category" value={form.category} onChange={handleChange} className="shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 rounded-md bg-white" />
              </div>
              <div>
                <label htmlFor="address" className="block text-gray-700 text-sm font-medium mb-1">Address</label>
                <input type="text" id="address" name="address" value={form.address} onChange={handleChange} className="shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 rounded-md bg-white" />
              </div>
              <div>
                <label htmlFor="hours" className="block text-gray-700 text-sm font-medium mb-1">Hours</label>
                <input type="text" id="hours" name="hours" value={form.hours} onChange={handleChange} className="shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 rounded-md bg-white" />
              </div>
              <div>
                <label htmlFor="description" className="block text-gray-700 text-sm font-medium mb-1">Description</label>
                <textarea id="description" name="description" value={form.description} onChange={handleChange} rows={3} className="shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 rounded-md bg-white" />
              </div>
            </div>
          </div>

          <div className="p-4 border rounded-md bg-indigo-50">
            <h3 className="font-semibold text-gray-700 mb-2">Contact Information</h3>
            <div className="space-y-2">
              <div>
                <label htmlFor="phone" className="block text-gray-700 text-sm font-medium mb-1">Phone</label>
                <input type="tel" id="phone" name="phone" value={form.phone} onChange={handleChange} className="shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 rounded-md bg-white" />
              </div>
              <div>
                <label htmlFor="whatsapp" className="block text-gray-700 text-sm font-medium mb-1">WhatsApp</label>
                <input type="text" id="whatsapp" name="whatsapp" value={form.whatsapp} onChange={handleChange} className="shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 rounded-md bg-white" />
              </div>
              <div>
                <label htmlFor="email" className="block text-gray-700 text-sm font-medium mb-1">Email</label>
                <input type="email" id="email" name="email" value={form.email} onChange={handleChange} className="shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 rounded-md bg-white" />
              </div>
            </div>
          </div>

          <div className="p-4 border rounded-md bg-indigo-50">
            <h3 className="font-semibold text-gray-700 mb-2">Logo</h3>
            <div>
              <label htmlFor="logo" className="block text-gray-700 text-sm font-medium mb-1">Upload Logo</label>
              <div className="relative rounded-md shadow-sm">
                <label htmlFor="logo-upload" className="cursor-pointer bg-indigo-100 hover:bg-indigo-200 text-indigo-700 font-semibold py-2 px-4 rounded-md focus:outline-none focus:shadow-outline inline-flex items-center">
                  <FaUpload className="mr-2" /> Choose File
                </label>
                <input id="logo-upload" type="file" name="logo" accept="image/*" onChange={handleLogoChange} className="sr-only" />
              </div>
              {form.logo && typeof form.logo !== 'string' && (
                <p className="text-sm text-gray-500 mt-1">Selected: {form.logo.name}</p>
              )}
            </div>
          </div>

          <div className="p-4 border rounded-md md:col-span-2 lg:col-span-3 bg-indigo-50">
            <h3 className="font-semibold text-gray-700 mb-2">Images</h3>
            <div>
              <label htmlFor="images" className="block text-gray-700 text-sm font-medium mb-1">Upload Images</label>
              <div className="relative rounded-md shadow-sm">
                <label htmlFor="images-upload" className="cursor-pointer bg-indigo-100 hover:bg-indigo-200 text-indigo-700 font-semibold py-2 px-4 rounded-md focus:outline-none focus:shadow-outline inline-flex items-center">
                  <FaUpload className="mr-2" /> Choose Files
                </label>
                <input
                  id="images-upload"
                  type="file"
                  name="images"
                  accept="image/*"
                  multiple
                  onChange={handleImageChange}
                  ref={fileInputRef}
                  className="sr-only"
                />
              </div>
              {form.images.length > 0 && (
                <div className="mt-2">
                  <p className="text-sm text-gray-500">Selected Files:</p>
                  <ul className="list-disc pl-5">
                    {form.images.map((file) => (
                      <li key={file.name} className="text-sm text-gray-600">{file.name}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>

          <div className="p-4 border rounded-md md:col-span-1 bg-indigo-50">
            <h3 className="font-semibold text-gray-700 mb-2">Social Links</h3>
            <div className="space-y-2">
              <div>
                <label htmlFor="instagram" className="block text-gray-700 text-sm font-medium mb-1">Instagram</label>
                <input type="url" id="instagram" name="instagram" value={form.instagram} onChange={handleChange} className="shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 rounded-md bg-white" />
              </div>
              <div>
                <label htmlFor="facebook" className="block text-gray-700 text-sm font-medium mb-1">Facebook</label>
                <input type="url" id="facebook" name="facebook" value={form.facebook} onChange={handleChange} className="shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 rounded-md bg-white" />
              </div>
              <div>
                <label htmlFor="tiktok" className="block text-gray-700 text-sm font-medium mb-1">TikTok</label>
                <input type="url" id="tiktok" name="tiktok" value={form.tiktok} onChange={handleChange} className="shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 rounded-md bg-white" />
              </div>
            </div>
          </div>
        </div>

        {form.isRestaurant && (
          <div className="mt-6 p-4 border rounded-md bg-indigo-50">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold text-gray-700">Menu Builder</h2>
              <button onClick={addCategory} className="bg-indigo-500 hover:bg-indigo-700 text-white font-semibold py-2 px-4 rounded focus:outline-none focus:shadow-outline text-sm transition duration-150">+ Add Category</button>
            </div>
            <div className="space-y-4">
              {Object.entries(form.menu).map(([cat, items]) => (
                <div key={cat} className="border rounded-lg p-4 shadow-sm bg-indigo-100">
                  <div className="flex justify-between items-center mb-3">
                    <h3 className="font-semibold text-lg text-gray-800">{cat}</h3>
                    <button onClick={() => removeCategory(cat)} className="text-red-600 hover:text-red-800 text-sm focus:outline-none transition duration-150">Remove Category</button>
                  </div>
                  <div className="space-y-3">
                    {items.map((item, i) => (
                      <div key={`${cat}-${i}`} className="grid grid-cols-1 md:grid-cols-3 gap-3 items-start">
                        <div>
                          <label htmlFor={`${cat}-${i}-name`} className="block text-gray-700 text-sm font-medium mb-1">Item Name</label>
                          <input
                            type="text"
                            id={`${cat}-${i}-name`}
                            placeholder="Item Name"
                            value={item.name}
                            onChange={(e) => handleMenuChange(cat, i, 'name', e.target.value)}
                            className="shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 rounded-md bg-white"
                          />
                        </div>
                        <div>
                          <label htmlFor={`${cat}-${i}-price`} className="block text-gray-700 text-sm font-medium mb-1">Price</label>
                          <input
                            type="text"
                            id={`${cat}-${i}-price`}
                            placeholder="Price"
                            value={item.price}
                            onChange={(e) => handleMenuChange(cat, i, 'price', e.target.value)}
                            className="shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 rounded-md bg-white"
                          />
                        </div>
                        <div className="flex gap-3 items-center">
                          <div className="flex-1">
                            <label htmlFor={`${cat}-${i}-description`} className="block text-gray-700 text-sm font-medium mb-1">Description</label>
                            <textarea
                              id={`${cat}-${i}-description`}
                              placeholder="Description"
                              value={item.description}
                              onChange={(e) => handleMenuChange(cat, i, 'description', e.target.value)}
                              className="shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 rounded-md bg-white"
                            />
                          </div>
                          <button onClick={() => removeItem(cat, i)} className="text-red-600 hover:text-red-800 focus:outline-none transition duration-150">
                            <FaTrash size={20} />
                          </button>
                        </div>
                      </div>
                    ))}
                    <button onClick={() => addItem(cat)} className="bg-green-500 hover:bg-green-700 text-white font-semibold py-2 px-4 rounded focus:outline-none focus:shadow-outline text-sm transition duration-150">+ Add Item</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="mt-6">
          <button className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-3 px-6 rounded-md focus:outline-none focus:shadow-outline transition duration-150">Save Changes</button>
        </div>
      </div>
    </div>
  );
}