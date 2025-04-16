'use client';

import { useParams } from 'next/navigation';
import { useState } from 'react';
import {
  FaInstagram, FaFacebook, FaTiktok, FaGlobe,
  FaShareAlt, FaArrowLeft, FaArrowRight, FaTimes
} from 'react-icons/fa';

export default function BusinessProfilePage() {
  const { slug } = useParams();
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);

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
          description: 'Stuffed flatbread with potatoes and herbs.',
          image: 'https://source.unsplash.com/400x300/?bolani'
        },
        {
          name: 'Samosa',
          price: '$4.50',
          description: 'Fried pastry with savory filling.',
          image: 'https://source.unsplash.com/400x300/?samosa'
        }
      ],
      Mains: [
        {
          name: 'Mantu',
          price: '$9.49',
          description: 'Beef dumplings topped with yogurt and lentils.',
          image: 'https://source.unsplash.com/400x300/?mantu'
        },
        {
          name: 'Kabob Plate',
          price: '$11.99',
          description: 'Grilled kabobs with rice and naan.',
          image: 'https://source.unsplash.com/400x300/?kabob'
        }
      ],
      Drinks: [
        {
          name: 'Doogh',
          price: '$2.99',
          description: 'Chilled yogurt drink with mint.',
          image: 'https://source.unsplash.com/400x300/?yogurt-drink'
        },
        {
          name: 'Black Tea',
          price: '$1.99',
          description: 'Traditional Afghan chai with cardamom.',
          image: 'https://source.unsplash.com/400x300/?afghan-tea'
        }
      ]
    }
  };

  const toggleCategory = (category: string) => {
    setExpandedCategory(expandedCategory === category ? null : category);
  };

  const nextImage = () => {
    if (selectedIndex !== null) {
      setSelectedIndex((selectedIndex + 1) % business.images.length);
    }
  };

  const prevImage = () => {
    if (selectedIndex !== null) {
      setSelectedIndex((selectedIndex - 1 + business.images.length) % business.images.length);
    }
  };
  return (
    <div className="max-w-4xl mx-auto p-4">
      <div className="bg-white p-6 rounded-xl shadow-lg border space-y-6">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <img src={business.logo} alt="Logo" className="w-16 h-16 rounded object-cover border" />
            <div>
              <h1 className="text-xl font-bold text-[#a93226]">{business.name}</h1>
              <p className="text-sm text-gray-500">{business.category}</p>
              <a href={business.mapUrl} target="_blank" className="text-sm text-blue-600 hover:underline">
                {business.address}
              </a>
            </div>
          </div>
          <button
            onClick={() => {
              if (navigator.share) {
                navigator.share({
                  title: business.name,
                  url: window.location.href,
                }).catch(() => {});
              } else {
                navigator.clipboard.writeText(window.location.href)
                  .then(() => alert('Link copied to clipboard!'))
                  .catch(() => alert('Failed to copy link.'));
              }
            }}
            title="Share"
            className="text-blue-600 hover:text-blue-800 text-2xl"
          >
            <FaShareAlt />
          </button>
        </div>

        {/* About */}
        <div>
          <h2 className="text-lg font-semibold text-gray-800 mb-1">About Us</h2>
          <p className="text-gray-700">{business.description}</p>
        </div>

        {/* Gallery */}
        <div>
          <h2 className="text-lg font-semibold text-gray-800 mb-2">Gallery</h2>
          <div className="grid grid-cols-3 gap-4">
            {business.images.map((img, i) => (
              <img key={i} src={img} onClick={() => setSelectedIndex(i)}
                className="rounded-md cursor-pointer h-28 object-cover w-full border hover:opacity-90" />
            ))}
          </div>

          {selectedIndex !== null && (
            <div className="fixed inset-0 bg-black bg-opacity-80 z-50 flex items-center justify-center">
              <button onClick={() => setSelectedIndex(null)} className="absolute top-4 right-6 text-white text-2xl"><FaTimes /></button>
              <button onClick={prevImage} className="absolute left-6 text-white text-2xl"><FaArrowLeft /></button>
              <img src={business.images[selectedIndex]} className="max-w-full max-h-[90vh] rounded shadow-lg" />
              <button onClick={nextImage} className="absolute right-6 text-white text-2xl"><FaArrowRight /></button>
            </div>
          )}
        </div>

        {/* Menu */}
        {business.isRestaurant && (
          <div>
            <h2 className="text-lg font-bold text-gray-800 mb-3">Menu</h2>
            <div className="border rounded-lg overflow-hidden">
              <button onClick={() => setMenuOpen(!menuOpen)}
                className="w-full px-4 py-3 bg-gray-100 hover:bg-gray-200 font-semibold flex justify-between">
                <span>View Menu</span>
                <span>{menuOpen ? '▲' : '▼'}</span>
              </button>
              {menuOpen && (
                <div className="bg-white px-4 py-2 space-y-2">
                  {Object.entries(business.menu).map(([category, items]) => (
                    <div key={category}>
                      <button onClick={() => toggleCategory(category)}
                        className="w-full text-left font-semibold py-2 text-[#a93226] hover:underline flex justify-between">
                        <span>{category}</span>
                        <span>{expandedCategory === category ? '−' : '+'}</span>
                      </button>
                      {expandedCategory === category && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-2">
                          {items.map((item, idx) => (
                            <div key={idx} className="border rounded-lg shadow-sm flex bg-white">
                              <img src={item.image} alt={item.name} className="w-24 h-24 object-cover flex-shrink-0" />
                              <div className="p-3 flex flex-col justify-between">
                                <div className="flex justify-between">
                                  <h3 className="font-medium text-gray-800">{item.name}</h3>
                                  <span className="text-sm font-semibold text-[#a93226]">{item.price}</span>
                                </div>
                                <p className="text-sm text-gray-600">{item.description}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Contact Info */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 text-sm">
          <div><p className="font-medium">📍 Address</p><a href={business.mapUrl} target="_blank" className="text-blue-600 hover:underline">{business.address}</a></div>
          <div><p className="font-medium">📞 Phone</p><a href={`tel:${business.phone}`} className="text-blue-600 hover:underline">{business.phone}</a></div>
          <div><p className="font-medium">📱 WhatsApp</p><a href={`https://wa.me/${business.whatsapp.replace(/\D/g, '')}`} target="_blank" className="text-green-600 hover:underline">{business.whatsapp}</a></div>
          <div><p className="font-medium">📧 Email</p><a href={`mailto:${business.email}`} className="text-purple-600 hover:underline">{business.email}</a></div>
        </div>

        {/* Social Icons */}
        <div className="flex gap-6 text-3xl mt-6">
          {business.instagram && <a href={business.instagram} target="_blank" className="text-pink-600 hover:scale-110 transition-transform"><FaInstagram /></a>}
          {business.facebook && <a href={business.facebook} target="_blank" className="text-blue-700 hover:scale-110 transition-transform"><FaFacebook /></a>}
          {business.tiktok && <a href={business.tiktok} target="_blank" className="text-black hover:scale-110 transition-transform"><FaTiktok /></a>}
          {business.website && <a href={business.website} target="_blank" className="text-gray-800 hover:scale-110 hover:text-[#a93226] transition-transform"><FaGlobe /></a>}
        </div>

        {/* Footer */}
        <div className="text-sm text-center text-gray-400 pt-6 border-t mt-6">
          &copy; {new Date().getFullYear()} {business.name} — Powered by Hanar
        </div>
      </div>
    </div>
  );
}
