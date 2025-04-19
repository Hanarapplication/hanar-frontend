'use client';

import { useParams } from 'next/navigation';
import { useState } from 'react';
import {
  FaInstagram, FaFacebook, FaTiktok, FaGlobe,
  FaShareAlt, FaArrowLeft, FaArrowRight, FaTimes
} from 'react-icons/fa';

export default function BusinessProfilePage() {
  const { slug } = useParams();
  const [selectedIndex, setSelectedIndex] = useState(0);

  const business = {
    name: 'Bolani House',
    category: 'Afghan Restaurant',
    address: '123 Kabul St, Toronto, ON',
    mapUrl: 'https://www.google.com/maps?q=123+Kabul+St,+Toronto,+ON',
    hours: '10:00 AM - 10:00 PM',
    description: 'Authentic Afghan food made fresh.',
    whatsapp: '+1 555-1234',
    phone: '+1 416-789-1234',
    email: 'info@bolanihouse.ca',
    website: 'https://bolanihouse.com',
    instagram: 'https://instagram.com/bolanihouse',
    facebook: 'https://facebook.com/bolanihouse',
    tiktok: 'https://tiktok.com/@bolanihouse',
    logo: 'https://source.unsplash.com/100x100/?logo',
    images: [
      'https://source.unsplash.com/400x300/?afghan-food',
      'https://source.unsplash.com/400x300/?kabob',
      'https://source.unsplash.com/400x300/?middle-eastern-restaurant'
    ],
    isRestaurant: true,
    menu: {
      Appetizers: [
        {
          name: 'Bolani',
          price: '$6.99',
          description: 'Stuffed flatbread with potatoes and leeks.'
        },
        {
          name: 'Mantoo',
          price: '$8.99',
          description: 'Steamed dumplings filled with spiced ground beef and onions.'
        }
      ]
    },
    tags: ['halal', 'family-friendly', 'delivery'],
    reviews: [],
    ownerIdentity: '@BolaniHouse'
  };

  const nextImage = () => setSelectedIndex((selectedIndex + 1) % business.images.length);
  const prevImage = () => setSelectedIndex((selectedIndex - 1 + business.images.length) % business.images.length);

  return (
    <div className="p-4 bg-[#fef6f3] rounded-xl max-w-4xl mx-auto shadow-lg">
      {/* Slider Gallery */}
      <div className="relative mb-6 rounded-lg overflow-hidden h-60">
        <img
          src={business.images[selectedIndex]}
          alt={`Slide ${selectedIndex + 1}`}
          className="w-full h-full object-cover rounded-lg"
        />
        <button onClick={prevImage} className="absolute top-1/2 left-2 transform -translate-y-1/2 bg-white rounded-full shadow p-1">
          <FaArrowLeft />
        </button>
        <button onClick={nextImage} className="absolute top-1/2 right-2 transform -translate-y-1/2 bg-white rounded-full shadow p-1">
          <FaArrowRight />
        </button>
      </div>

      {/* Name + Category + Tags */}
      <h1 className="text-3xl font-bold text-[#333] mb-1">{business.name}</h1>
      <p className="text-[#777] italic mb-3">{business.category}</p>
      <div className="flex flex-wrap gap-2 mb-4">
        {business.tags.map((tag, i) => (
          <span key={i} className="bg-[#ede7f6] text-sm text-[#333] rounded-full px-3 py-1 shadow-sm">#{tag}</span>
        ))}
      </div>

      {/* Description + Info */}
      <div className="bg-white rounded-lg p-4 shadow-md mb-4">
        <p className="mb-2 text-[#444]">{business.description}</p>
        <p className="text-sm text-[#555] mb-2">🕒 {business.hours}</p>

        {/* Embedded Map */}
        <div className="mb-2">
          <iframe
            src={business.mapUrl + '&output=embed'}
            width="100%"
            height="120"
            className="rounded-md"
            allowFullScreen
            loading="lazy"
            title="map"
          ></iframe>
        </div>
      </div>

      {/* Contact Info */}
      <div className="bg-white rounded-lg p-4 shadow-md mb-4 space-y-1 text-sm text-[#444]">
        <p>📞 {business.phone}</p>
        <p>💬 WhatsApp: {business.whatsapp}</p>
        <p>✉️ {business.email}</p>
        <p>🌐 <a href={business.website} className="text-blue-500 underline">Website</a></p>
      </div>

      {/* Social Links + Share */}
      <div className="flex flex-wrap gap-4 text-sm text-gray-700 mb-6 items-center">
        <a href={business.instagram} className="flex items-center gap-2 hover:underline"><FaInstagram />Instagram</a>
        <a href={business.facebook} className="flex items-center gap-2 hover:underline"><FaFacebook />Facebook</a>
        <a href={business.tiktok} className="flex items-center gap-2 hover:underline"><FaTiktok />TikTok</a>
        <button
          className="ml-auto bg-[#ede7f6] px-3 py-1 rounded-full text-sm flex items-center gap-1 hover:bg-[#dcd1f2]"
          onClick={() => navigator.share ? navigator.share({ title: business.name, url: window.location.href }) : navigator.clipboard.writeText(window.location.href)}
        >
          <FaShareAlt /> Share
        </button>
      </div>

      {/* Menu if Restaurant */}
      {business.isRestaurant && (
        <div className="bg-white rounded-lg p-4 shadow-md mb-6">
          <h2 className="text-xl font-semibold mb-3 text-[#333]">Menu</h2>
          {Object.entries(business.menu).map(([category, items]) => (
            <div key={category} className="mb-4">
              <h3 className="font-bold text-[#444] mb-1">{category}</h3>
              {(items as any[]).map((item, i) => (
                <div key={i} className="text-sm text-gray-800 border-b border-gray-100 py-1">
                  <strong>{item.name}</strong> – {item.price}<br />
                  <span className="text-gray-600">{item.description}</span>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}

      {/* Owner Identity (for community linking) */}
      <div className="text-sm text-[#666] italic mb-4">
        Posts by this business in the community: <span className="text-blue-600">{business.ownerIdentity}</span>
      </div>

      {/* Reviews Placeholder */}
      <div className="bg-white rounded-lg p-4 shadow-md">
        <h2 className="text-lg font-bold text-[#333] mb-1">Reviews</h2>
        <p className="text-gray-500 italic">Coming soon...</p>
      </div>
    </div>
  );
}
