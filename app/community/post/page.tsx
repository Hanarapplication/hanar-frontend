'use client';

import { useState } from 'react';

export default function CreateCommunityPostPage() {
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [language, setLanguage] = useState('en');
  const [category, setCategory] = useState('general');
  const [image, setImage] = useState<File | null>(null);
  const [postAs, setPostAs] = useState('personal');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Later: Send data to backend
    alert('Post submitted!');
  };

  return (
    <div className="max-w-2xl mx-auto p-6 mt-10 bg-white rounded shadow-md">
      <h1 className="text-2xl font-bold mb-6 text-center">Create Community Post</h1>
      <form onSubmit={handleSubmit} className="space-y-4">

        {/* Title */}
        <input
          type="text"
          placeholder="Title or Question"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="w-full border border-gray-300 rounded px-4 py-2"
          required
        />

        {/* Body */}
        <textarea
          placeholder="Write your post here..."
          value={body}
          onChange={(e) => setBody(e.target.value)}
          className="w-full border border-gray-300 rounded px-4 py-2 h-28 resize-none"
        />

        {/* Category */}
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="w-full border border-gray-300 rounded px-4 py-2"
        >
          <option value="general">General</option>
          <option value="immigration">Immigration</option>
          <option value="business">Business</option>
          <option value="events">Local Events</option>
          <option value="food">Food & Restaurants</option>
          <option value="housing">Housing</option>
          <option value="culture">Culture</option>
        </select>

        {/* Language */}
        <select
          value={language}
          onChange={(e) => setLanguage(e.target.value)}
          className="w-full border border-gray-300 rounded px-4 py-2"
        >
          <option value="en">English</option>
          <option value="fa">Farsi</option>
          <option value="ar">Arabic</option>
          <option value="ku">Kurdish</option>
          <option value="tr">Turkish</option>
        </select>

        {/* Optional Image Upload */}
        <input
          type="file"
          accept="image/*"
          onChange={(e) => setImage(e.target.files?.[0] || null)}
          className="w-full"
        />

        {/* Post As */}
        <div className="flex gap-4">
          <label className="flex items-center gap-2">
            <input
              type="radio"
              name="postAs"
              value="personal"
              checked={postAs === 'personal'}
              onChange={() => setPostAs('personal')}
            />
            Personal
          </label>
          <label className="flex items-center gap-2">
            <input
              type="radio"
              name="postAs"
              value="business"
              onChange={() => setPostAs('business')}
            />
            Business
          </label>
          <label className="flex items-center gap-2">
            <input
              type="radio"
              name="postAs"
              value="anonymous"
              onChange={() => setPostAs('anonymous')}
            />
            Anonymous
          </label>
        </div>

        {/* Submit */}
        <button
          type="submit"
          className="w-full bg-indigo-600 text-white py-2 rounded hover:bg-indigo-700 transition"
        >
          Post to Community
        </button>
      </form>
    </div>
  );
}
