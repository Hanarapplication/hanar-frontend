'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { FaWhatsapp, FaPhone, FaEnvelope, FaChevronLeft, FaChevronRight } from 'react-icons/fa';
import Image from 'next/image';
import { useKeenSlider } from 'keen-slider/react';
import 'keen-slider/keen-slider.min.css';

const mockItem = {
  id: 1,
  title: 'Used iPhone 12 - Excellent Condition',
  price: '$400',
  description: 'This iPhone 12 is in perfect working order, minor scratches on the edges. Battery health 90%.',
  category: 'Phones/Gadgets',
  location: 'Frisco, TX',
  images: [
    'https://source.unsplash.com/600x400/?iphone',
    'https://source.unsplash.com/600x400/?smartphone',
    'https://source.unsplash.com/600x400/?mobile',
  ],
  contact: {
    whatsapp: '+1234567890',
    phone: '+19876543210',
    email: 'seller@example.com',
  },
  ownerId: 123, // mock owner ID
};

const mockUserId = 123; // assume user is logged in as owner

export default function ItemDetailPage() {
  const router = useRouter();
  const [item, setItem] = useState(null);
  const [currentSlide, setCurrentSlide] = useState(0);

  const [sliderRef, instanceRef] = useKeenSlider({
    loop: true,
    slideChanged(s) {
      setCurrentSlide(s.track.details.rel);
    },
  });

  useEffect(() => {
    setItem(mockItem);
  }, []);

  if (!item) return <div className="p-6">Loading...</div>;

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <button
        onClick={() => router.back()}
        className="text-blue-600 hover:underline mb-4"
      >
        ← Back to Marketplace
      </button>

      <div className="bg-white shadow-lg rounded-xl overflow-hidden">
        {/* Carousel */}
        <div className="relative">
          <div ref={sliderRef} className="keen-slider h-64 w-full">
            {item.images.map((img, index) => (
              <div key={index} className="keen-slider__slide relative h-64">
                <Image
                  src={img}
                  alt={`Image ${index + 1}`}
                  fill
                  className="object-cover"
                  priority={index === 0}
                  loading={index === 0 ? 'eager' : 'lazy'}
                />
              </div>
            ))}
          </div>

          {/* Arrows */}
          <button
            onClick={() => instanceRef.current?.prev()}
            className="absolute top-1/2 left-2 -translate-y-1/2 bg-white bg-opacity-70 rounded-full p-2 shadow hover:bg-opacity-100"
          >
            <FaChevronLeft />
          </button>
          <button
            onClick={() => instanceRef.current?.next()}
            className="absolute top-1/2 right-2 -translate-y-1/2 bg-white bg-opacity-70 rounded-full p-2 shadow hover:bg-opacity-100"
          >
            <FaChevronRight />
          </button>

          {/* Dots */}
          <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-2">
            {item.images.map((_, idx) => (
              <div
                key={idx}
                className={`w-2 h-2 rounded-full ${
                  currentSlide === idx ? 'bg-blue-600' : 'bg-gray-300'
                }`}
              />
            ))}
          </div>
        </div>

        {/* Info Section */}
        <div className="p-6">
          <div className="flex justify-between items-start">
            <h1 className="text-2xl font-bold">{item.title}</h1>
            {mockUserId === item.ownerId && (
              <button
                onClick={() => router.push(`/marketplace/edit/${item.id}`)}
                className="text-sm text-blue-600 hover:underline"
              >
                ✏️ Edit
              </button>
            )}
          </div>
          <p className="text-xl text-green-600 font-semibold mb-2">{item.price}</p>
          <p className="text-gray-700 mb-4">{item.description}</p>

          <div className="flex flex-wrap gap-4 text-sm text-gray-500 mb-6">
            <span className="bg-gray-100 px-2 py-1 rounded">Category: {item.category}</span>
            <span className="bg-gray-100 px-2 py-1 rounded">Location: {item.location}</span>
          </div>

          {/* Contact Section */}
          <div className="border-t pt-4">
            <h2 className="text-lg font-semibold mb-2">Contact Seller</h2>
            <div className="flex flex-col gap-3">
              {item.contact.whatsapp && (
                <a
                  href={`https://wa.me/${item.contact.whatsapp}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-green-600 flex items-center gap-2 hover:underline"
                >
                  <FaWhatsapp /> WhatsApp
                </a>
              )}
              {item.contact.phone && (
                <a href={`tel:${item.contact.phone}`} className="text-blue-600 flex items-center gap-2 hover:underline">
                  <FaPhone /> Call
                </a>
              )}
              {item.contact.email && (
                <a href={`mailto:${item.contact.email}`} className="text-red-500 flex items-center gap-2 hover:underline">
                  <FaEnvelope /> Email
                </a>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
