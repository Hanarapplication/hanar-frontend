'use client';

import { useParams } from 'next/navigation';
import { useState, useEffect, useRef } from 'react';

export default function EditPostPage() {
  const { id } = useParams();
  const imageInputRef = useRef<HTMLInputElement>(null);
  const primaryColor = 'teal'; // Keeping the sophisticated teal as the accent
  const [showConfirmation, setShowConfirmation] = useState(false);

  const [form, setForm] = useState({
    title: '',
    body: '',
    image: '',
    tags: [],
    language: 'en',
  });
  const [tagInput, setTagInput] = useState('');

  useEffect(() => {
    // Fetch post by ID later
    setForm({
      title: 'Discover Gourmet Halal Groceries in Frisco',
      body: 'Seeking recommendations for upscale halal grocery stores in the Frisco area. Any refined suggestions?',
      image: 'https://source.unsplash.com/600x400/?gourmet,halal,market',
      tags: ['gourmet', 'halal', 'frisco', 'specialty'],
      language: 'en',
    });
  }, [id]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleImageChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setForm((prev) => ({ ...prev, image: reader.result as string }));
      };
      reader.readAsDataURL(file);
    } else {
      setForm((prev) => ({ ...prev, image: '' }));
    }
  };

  const triggerImageUpload = () => {
    imageInputRef.current?.click();
  };

  const addTag = () => {
    if (tagInput.trim() && !form.tags.includes(tagInput.trim())) {
      setForm((prev) => ({ ...prev, tags: [...prev.tags, tagInput.trim()] }));
      setTagInput('');
    }
  };

  const removeTag = (tag) => {
    setForm((prev) => ({ ...prev, tags: prev.tags.filter(t => t !== tag) }));
  };

  const handleDeleteClick = () => {
    setShowConfirmation(true);
  };

  const handleConfirmDelete = () => {
    // In a real application, implement the actual delete post logic here
    console.log('Post deleted!');
    setShowConfirmation(false);
    // You might want to redirect the user after successful deletion
  };

  const handleCancelDelete = () => {
    setShowConfirmation(false);
  };

  return (
    <div className="max-w-3xl mx-auto p-8 bg-gray-50 rounded-xl shadow-lg relative overflow-hidden"> {/* Added overflow-hidden */}
      <div className={`${showConfirmation ? 'blur-md pointer-events-none' : ''} transition-filter duration-300`}>
        <h1 className={`text-3xl font-extrabold text-${primaryColor}-700 mb-8 tracking-tight`}>
          Edit Community Post
        </h1>

        <div className="space-y-6">
          <div className="bg-gray-100 rounded-lg shadow-sm border border-gray-200 p-6 space-y-4">
            {/* Title, Content, Image */}
            <div>
              <label htmlFor="title" className="block text-lg font-semibold text-gray-800 mb-2">
                Title
              </label>
              <input
                type="text"
                id="title"
                name="title"
                value={form.title}
                onChange={handleChange}
                placeholder="Enter a captivating title"
                className="mt-1 block w-full rounded-md border-gray-300 shadow-inner focus:border-${primaryColor}-500 focus:ring-${primaryColor}-500 sm:text-sm py-3 px-4 bg-white"
              />
            </div>
            <div>
              <label htmlFor="body" className="block text-lg font-semibold text-gray-800 mb-2">
                Content
              </label>
              <textarea
                id="body"
                name="body"
                value={form.body}
                onChange={handleChange}
                rows={5}
                placeholder="Share your refined thoughts and experiences"
                className="mt-1 block w-full rounded-md border-gray-300 shadow-inner focus:border-${primaryColor}-500 focus:ring-${primaryColor}-500 sm:text-sm py-3 px-4 bg-white"
              />
            </div>
            <div>
              <label htmlFor="image" className="block text-lg font-semibold text-gray-800 mb-2">
                Image
              </label>
              <div className="mt-1 flex items-center space-x-4">
                <button
                  type="button"
                  className={`inline-flex items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-${primaryColor}-500 focus:ring-offset-2 transition duration-150`}
                  onClick={triggerImageUpload}
                >
                  Choose Image
                </button>
                {form.image && typeof form.image === 'string' && (
                  <div className="relative w-24 h-24 overflow-hidden rounded-md shadow-md">
                    <img src={form.image} alt="Selected Image" className="object-cover w-full h-full" />
                  </div>
                )}
                <input
                  type="file"
                  id="image"
                  name="image"
                  accept="image/*"
                  onChange={handleImageChange}
                  className="sr-only"
                  ref={imageInputRef}
                />
              </div>
            </div>
          </div>

          {/* Tags */}
          <div className="bg-gray-100 rounded-lg shadow-sm border border-gray-200 p-6">
            <label className="block text-lg font-semibold text-gray-800 mb-2">
              Tags
            </label>
            <div className="mt-1 flex rounded-md shadow-sm">
              <input
                type="text"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addTag()}
                placeholder="Add a refined tag and press Enter"
                className="block w-full rounded-md border-gray-300 shadow-inner focus:border-${primaryColor}-500 focus:ring-${primaryColor}-500 sm:text-sm py-3 px-4 bg-white"
              />
              <button
                onClick={addTag}
                className={`relative -ml-px inline-flex items-center space-x-2 rounded-r-md border border-gray-300 bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition duration-150`}
              >
                <span>Add</span>
              </button>
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              {form.tags.map((tag) => (
                <span key={tag} className={`inline-flex items-center rounded-full bg-${primaryColor}-100 text-${primaryColor}-700 px-3 py-1 text-sm font-medium shadow-sm`}>
                  #{tag}
                  <button
                    type="button"
                    onClick={() => removeTag(tag)}
                    className="ml-2 rounded-full focus:outline-none focus:ring-2 focus:ring-${primaryColor}-500 text-${primaryColor}-400 hover:text-${primaryColor}-500 transition duration-150"
                  >
                    <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                      <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                    </svg>
                  </button>
                </span>
              ))}
            </div>
          </div>

          {/* Language */}
          <div className="bg-gray-100 rounded-lg shadow-sm border border-gray-200 p-6">
            <label htmlFor="language" className="block text-lg font-semibold text-gray-800 mb-2">
              Language
            </label>
            <select
              id="language"
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

          {/* Actions */}
          <div className="flex justify-between items-center">
            <button
              className={`inline-flex items-center justify-center rounded-md border border-transparent bg-red-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 transition duration-150 ease-in-out`}
              onClick={handleDeleteClick}
            >
              Delete This Post
            </button>
            <button
              className={`inline-flex items-center justify-center rounded-md border border-transparent bg-blue-600 px-6 py-3 text-lg font-semibold text-white shadow-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition duration-150 ease-in-out`}
            >
              Save Changes
            </button>
          </div>
        </div>
      </div>

      {/* Confirmation Dialog */}
      {showConfirmation && (
        <div className="fixed top-0 left-0 w-full h-full flex justify-center items-center bg-transparent">
          <div className="bg-white rounded-md p-6 shadow-lg z-10">
            <p className="text-lg font-semibold text-gray-800 mb-4">Are you sure you want to delete this post?</p>
            <div className="flex justify-end space-x-4">
              <button
                className="px-4 py-2 rounded-md text-gray-700 bg-gray-200 hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-400 transition duration-150"
                onClick={handleCancelDelete}
              >
                No
              </button>
              <button
                className="px-4 py-2 rounded-md text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 transition duration-150"
                onClick={handleConfirmDelete}
              >
                Yes, Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}