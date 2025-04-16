'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Image from 'next/image';
import { FaPhone, FaWhatsapp, FaEnvelope, FaMapMarkerAlt } from 'react-icons/fa';

const mockBusiness = {
  name: 'Bolani House',
  slug: 'bolani-house',
  description: 'Authentic Afghan street food with a modern twist. Family-owned and proud to serve the community.',
  category: 'Restaurant',
  logo: 'https://source.unsplash.com/100x100/?logo',
  bannerImages: [
    'https://source.unsplash.com/600x400/?afghan-food',
    'https://source.unsplash.com/600x400/?middle-eastern-restaurant',
  ],
  address: '123 Main St, Frisco, TX',
  contact: {
    phone: '+19876543210',
    whatsapp: '+1234567890',
    email: 'info@bolanihouse.com',
  },
  hours: {
    Mon: '10:00 AM - 9:00 PM',
    Tue: '10:00 AM - 9:00 PM',
    Wed: 'Closed',
    Thu: '10:00 AM - 9:00 PM',
    Fri: '10:00 AM - 10:00 PM',
    Sat: '12:00 PM - 10:00 PM',
    Sun: '12:00 PM - 8:00 PM',
  },
  menu: [
    { name: 'Beef Bolani', price: '$8.99' },
    { name: 'Spinach Bolani', price: '$7.49' },
  ],
};

export default function BusinessProfilePage() {
  const { slug } = useParams();
  const router = useRouter();
  const [business, setBusiness] = useState(null);

  useEffect(() => {
    // Simulate fetch by slug
    setBusiness(mockBusiness);
  }, [slug]);

  if (!business) return <div className="p-6">Loading...</div>;

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <Image
          src={business.logo}
          width={60}
          height={60}
          alt="Logo"
          className="rounded-full border"
        />
        <div>
          <h1 className="text-2xl font-bold">{business.name}</h1>
          <p className="text-gray-600 text-sm">{business.category}</p>
        </div>
      </div>

      {/* Banner Images */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
        {business.bannerImages.map((img, i) => (
          <Image
            key={i}
            src={img}
            alt={`Banner ${i + 1}`}
            width={600}
            height={400}
            className="rounded-lg object-cover"
          />
        ))}
      </div>

      {/* About + Contact */}
      <p className="mb-4 text-gray-700">{business.description}</p>

      <div className="space-y-2 mb-6">
        <div className="flex items-center gap-2 text-gray-600">
          <FaMapMarkerAlt /> {business.address}
        </div>
        {business.contact.phone && (
          <div className="flex items-center gap-2 text-blue-600">
            <FaPhone /> <a href={`tel:${business.contact.phone}`}>{business.contact.phone}</a>
          </div>
        )}
        {business.contact.whatsapp && (
          <div className="flex items-center gap-2 text-green-600">
            <FaWhatsapp />
            <a href={`https://wa.me/${business.contact.whatsapp}`} target="_blank">
              {business.contact.whatsapp}
            </a>
          </div>
        )}
        {business.contact.email && (
          <div className="flex items-center gap-2 text-red-500">
            <FaEnvelope />
            <a href={`mailto:${business.contact.email}`}>{business.contact.email}</a>
          </div>
        )}
      </div>

      {/* Hours of Operation */}
      <div className="mb-6">
        <h2 className="text-lg font-semibold mb-2">Hours of Operation</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 text-sm text-gray-700">
          {Object.entries(business.hours).map(([day, hours]) => (
            <div key={day} className="mb-1">
              <span className="font-medium">{day}:</span> {hours}
            </div>
          ))}
        </div>
      </div>

      {/* Menu */}
      {business.menu?.length > 0 && (
        <div className="mb-6">
          <h2 className="text-lg font-semibold mb-2">Menu</h2>
          <ul className="space-y-1">
            {business.menu.map((item, i) => (
              <li key={i} className="flex justify-between text-gray-800 border-b py-1">
                <span>{item.name}</span>
                <span>{item.price}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Back Button */}
      <button
        onClick={() => router.back()}
        className="mt-4 text-sm text-blue-600 hover:underline"
      >
        ← Back to Businesses
      </button>
    </div>
  );
}
