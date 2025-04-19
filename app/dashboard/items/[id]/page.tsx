'use client';

import { useParams } from 'next/navigation';
import { useEffect, useState, useRef } from 'react';


// Define a more specific type for the form state, especially for images
interface FormState {
  title: string;
  category: string;
  description: string;
  price: string;
  currency: string;
  images: (File | string)[]; // Can be File objects or data URLs
  whatsapp: string;
  phone: string;
  email: string;
  language: string;
}

export default function EditItemPage() {
  const { id } = useParams();
  const primaryColor = 'teal';
  const imageInputRef = useRef<HTMLInputElement>(null);
  const maxImages = 6;
  const [form, setForm] = useState<FormState>({
    title: '',
    category: '',
    description: '',
    price: '',
    currency: 'USD',
    images: [],
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

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length > 0) {
      const newFiles = files.slice(0, Math.min(files.length, maxImages - form.images.length));

      Promise.all(
        newFiles.map(
          (file) =>
            new Promise<string>((resolve) => {
              const reader = new FileReader();
              reader.onloadend = () => {
                if (typeof reader.result === 'string') {
                  resolve(reader.result);
                }
              };
              reader.readAsDataURL(file);
            })
        )
      ).then((newImageUrls) => {
        setForm((prev) => ({
          ...prev,
          images: [...prev.images, ...newImageUrls],
        }));
      });
    }
  };

  const triggerImageUpload = () => {
    imageInputRef.current?.click();
  };

  const removeImage = (index: number) => {
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

      {/* ... rest of your JSX ... */}
    </div>
  );
}