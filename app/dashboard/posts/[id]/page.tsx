'use client';

import { useParams } from 'next/navigation';
import { useState, useEffect, useRef, ChangeEvent } from 'react';

export default function EditPostPage() {
  const { id } = useParams();
  const imageInputRef = useRef<HTMLInputElement>(null);
  const primaryColor = 'teal';
  const [showConfirmation, setShowConfirmation] = useState(false);

  const [form, setForm] = useState<{
    title: string;
    body: string;
    image: string;
    tags: string[];
    language: string;
  }>({
    title: '',
    body: '',
    image: '',
    tags: [],
    language: 'en',
  });

  const [tagInput, setTagInput] = useState('');

  useEffect(() => {
    setForm({
      title: 'Discover Gourmet Halal Groceries in Frisco',
      body: 'Seeking recommendations for upscale halal grocery stores in the Frisco area. Any refined suggestions?',
      image: 'https://source.unsplash.com/600x400/?gourmet,halal,market',
      tags: ['gourmet', 'halal', 'frisco', 'specialty'],
      language: 'en',
    });
  }, [id]);

  const handleChange = (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleImageChange = (e: ChangeEvent<HTMLInputElement>) => {
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

  const triggerImageUpload = () => imageInputRef.current?.click();

  const addTag = () => {
    if (tagInput.trim() && !form.tags.includes(tagInput.trim())) {
      setForm((prev) => ({ ...prev, tags: [...prev.tags, tagInput.trim()] }));
      setTagInput('');
    }
  };

  const removeTag = (tag: string) => {
    setForm((prev) => ({ ...prev, tags: prev.tags.filter((t) => t !== tag) }));
  };

  const handleDeleteClick = () => setShowConfirmation(true);
  const handleConfirmDelete = () => {
    console.log('Post deleted!');
    setShowConfirmation(false);
  };
  const handleCancelDelete = () => setShowConfirmation(false);

  return (
    <div className="max-w-3xl mx-auto p-8 bg-gray-50 rounded-xl shadow-lg relative overflow-hidden">
      <div className={`${showConfirmation ? 'blur-md pointer-events-none' : ''} transition-filter duration-300`}>
        <h1 className={`text-3xl font-extrabold text-${primaryColor}-700 mb-8 tracking-tight`}>
          Edit Community Post
        </h1>

        <div className="space-y-6">
          {/* Title Input */}
          <div className="bg-gray-100 rounded-lg shadow-sm border border-gray-200 p-6 space-y-4">
            <div>
              <label htmlFor="title" className="block text-lg font-semibold text-gray-800 mb-2">Title</label>
              <input
                type="text"
                id="title"
                name="title"
                value={form.title}
                onChange={handleChange}
                placeholder="Enter a captivating title"
                className={`block w-full rounded-md border-gray-300 shadow-inner focus:border-${primaryColor}-500 focus:ring-${primaryColor}-500 sm:text-sm py-3 px-4 bg-white`}
              />
            </div>

            <div>
              <label htmlFor="body" className="block text-lg font-semibold text-gray-800 mb-2">Content</label>
              <textarea
                id="body"
                name="body"
                value={form.body}
                onChange={handleChange}
                rows={5}
                className={`block w-full rounded-md border-gray-300 shadow-inner focus:border-${primaryColor}-500 focus:ring-${primaryColor}-500 sm:text-sm py-3 px-4 bg-white`}
              />
            </div>

            <div>
              <label className="block text-lg font-semibold text-gray-800 mb-2">Image</label>
              <div className="flex items-center space-x-4">
                <button
                  type="button"
                  className={`inline-flex items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 focus:ring-2 focus:ring-${primaryColor}-500`}
                  onClick={triggerImageUpload}
                >
                  Choose Image
                </button>
                {form.image && (
                  <div className="relative w-24 h-24 overflow-hidden rounded-md shadow-md">
                    <img src={form.image} alt="Selected Image" className="object-cover w-full h-full" />
                  </div>
                )}
                <input type="file" onChange={handleImageChange} ref={imageInputRef} className="hidden" />
              </div>
            </div>
          </div>

          {/* Tags Input */}
          <div className="bg-gray-100 rounded-lg shadow-sm border border-gray-200 p-6">
            <label className="block text-lg font-semibold text-gray-800 mb-2">Tags</label>
            <div className="flex rounded-md shadow-sm">
              <input
                type="text"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addTag()}
                className={`block w-full rounded-md border-gray-300 shadow-inner focus:border-${primaryColor}-500 focus:ring-${primaryColor}-500 sm:text-sm py-3 px-4 bg-white`}
              />
              <button
                onClick={addTag}
                className="relative -ml-px inline-flex items-center space-x-2 rounded-r-md border border-gray-300 bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 focus:ring-2 focus:ring-blue-500"
              >
                Add
              </button>
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              {form.tags.map((tag) => (
                <span key={tag} className={`inline-flex items-center rounded-full bg-${primaryColor}-100 text-${primaryColor}-700 px-3 py-1 text-sm font-medium`}>
                  #{tag}
                  <button
                    onClick={() => removeTag(tag)}
                    className={`ml-2 text-${primaryColor}-500 hover:text-${primaryColor}-700`}
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          </div>

          {/* Language Dropdown */}
          <div className="bg-gray-100 rounded-lg shadow-sm border border-gray-200 p-6">
            <label htmlFor="language" className="block text-lg font-semibold text-gray-800 mb-2">Language</label>
            <select
              id="language"
              name="language"
              value={form.language}
              onChange={handleChange}
              className={`block w-full rounded-md border-gray-300 shadow-inner focus:border-${primaryColor}-500 focus:ring-${primaryColor}-500 sm:text-sm py-3 px-4 bg-white`}
            >
              <option value="en">🇺🇸 English</option>
              <option value="fa">🇮🇷 فارسی</option>
              <option value="ar">🇸🇦 Arabic</option>
              <option value="tr">🇹🇷 Turkish</option>
              <option value="ps">🇦🇫 Pashto</option>
            </select>
          </div>

          {/* Action Buttons */}
          <div className="flex justify-between items-center">
            <button
              className="rounded-md bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700"
              onClick={handleDeleteClick}
            >
              Delete This Post
            </button>
            <button
              className="rounded-md bg-blue-600 px-6 py-3 text-lg font-semibold text-white hover:bg-blue-700"
            >
              Save Changes
            </button>
          </div>
        </div>
      </div>

      {/* Delete Confirmation */}
      {showConfirmation && (
        <div className="fixed top-0 left-0 w-full h-full flex justify-center items-center bg-black/30 z-50">
          <div className="bg-white p-6 rounded-xl shadow-lg space-y-4">
            <p className="text-lg font-semibold text-gray-800">Are you sure you want to delete this post?</p>
            <div className="flex justify-end gap-4">
              <button
                onClick={handleCancelDelete}
                className="px-4 py-2 rounded-md text-gray-700 bg-gray-200 hover:bg-gray-300"
              >
                No
              </button>
              <button
                onClick={handleConfirmDelete}
                className="px-4 py-2 rounded-md text-white bg-red-600 hover:bg-red-700"
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
