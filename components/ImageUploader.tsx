// components/ImageUploader.tsx
'use client';

import { useState } from 'react';

interface Props {
  onUploadComplete: (urls: string[]) => void;
}

export default function ImageUploader({ onUploadComplete }: Props) {
  const [selectedImages, setSelectedImages] = useState<File[]>([]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files ? Array.from(e.target.files) : [];
    setSelectedImages(files);

    // Simulate upload and return URLs
    const urls = files.map((file) => URL.createObjectURL(file));
    onUploadComplete(urls);
  };

  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-gray-700">Upload Images</label>
      <input
        type="file"
        multiple
        accept="image/*"
        onChange={handleChange}
        className="w-full border px-3 py-2 rounded"
      />
      <div className="flex flex-wrap gap-2">
        {selectedImages.map((file, idx) => (
          <img
            key={idx}
            src={URL.createObjectURL(file)}
            alt="preview"
            className="w-20 h-20 object-cover rounded shadow"
          />
        ))}
      </div>
    </div>
  );
}
