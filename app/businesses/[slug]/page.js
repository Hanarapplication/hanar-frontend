'use client';

import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { FaWhatsapp, FaEnvelope, FaInstagram } from 'react-icons/fa';
import dynamic from 'next/dynamic';

const QRCode = dynamic(() => import('qrcode.react').then((mod) => mod.QRCode), {
  ssr: false,
});

const mockBusiness = {
  name: 'Bolani House',
  slug: 'bolani-house',
  description: 'Authentic Afghan street food with a modern twist.',
  category: 'Restaurant',
  address: '123 Main St, Frisco, TX',
  logo: 'https://via.placeholder.com/80x80.png?text=Logo',
  banner: 'https://via.placeholder.com/800x200.png?text=Business+Banner',
  contact: {
    whatsapp: '+1234567890',
    phone: '+19876543210',
    email: 'info@bolanihouse.com',
    instagram: 'bolanihouse',
  },
  hours: {
    Mon: '07:00 AM - 09:00 PM',
    Tue: '07:00 AM - 09:00 PM',
    Wed: '07:00 AM - 09:00 PM',
    Thu: '07:00 AM - 09:00 PM',
    Fri: '07:00 AM - 09:00 PM',
    Sat: '07:00 AM - 09:00 PM',
    Sun: 'Closed',
  },
  menu: [
    {
      name: 'Beef Bolani',
      price: '$8.99',
      description: 'Crispy flatbread with seasoned beef',
      preview: 'https://via.placeholder.com/100x100.png?text=Beef',
    },
    {
      name: 'Spinach Bolani',
      price: '$7.99',
      description: 'Vegetarian favorite with herbs',
      preview: 'https://via.placeholder.com/100x100.png?text=Spinach',
    },
  ],
  listings: [],
};

export default function BusinessProfilePage() {
  const { slug } = useParams();
  const [business, setBusiness] = useState(null);

  useEffect(() => {
    setBusiness(mockBusiness); // Replace with real fetch in future
  }, [slug]);

  if (!business) return <div className="p-6">Loading...</div>;

  const isRestaurant = business.category.toLowerCase().includes('restaurant');
  const isLister = ['car', 'dealership', 'vendor', 'store'].some((w) =>
    business.category.toLowerCase().includes(w)
  );

  const profileUrl = `https://hanar.net/businesses/${business.slug}`;

  return (
    <div className="max-w-3xl mx-auto p-4 text-sm">
      <img src={business.banner} className="w-full h-48 object-cover rounded mb-4" alt="Banner" />
      <div className="flex items-center gap-4 mb-4">
        <img src={business.logo} className="w-20 h-20 rounded-full border" alt="Logo" />
        <div>
          <h1 className="text-3xl font-bold">{business.name}</h1>
          <p className="text-gray-600">{business.description}</p>
        </div>
      </div>

      <div className="bg-gray-50 p-3 rounded mb-4 space-y-1">
        <p><strong>📍 Address:</strong> {business.address}</p>
        <p><strong>📞 Phone:</strong> {business.contact.phone}</p>
        <p><strong>📧 Email:</strong> {business.contact.email}</p>
        <p><strong>💬 WhatsApp:</strong> {business.contact.whatsapp}</p>
        <div className="flex items-center gap-4 text-lg mt-2">
          {business.contact.whatsapp && (
            <a href={`https://wa.me/${business.contact.whatsapp.replace(/\D/g, '')}`}><FaWhatsapp /></a>
          )}
          {business.contact.email && (
            <a href={`mailto:${business.contact.email}`}><FaEnvelope /></a>
          )}
          {business.contact.instagram && (
            <a href={`https://instagram.com/${business.contact.instagram}`}><FaInstagram /></a>
          )}
        </div>
      </div>

      <div className="bg-gray-50 p-3 rounded mb-4">
        <h2 className="font-semibold mb-2">Hours of Operation</h2>
        <ul>
          {Object.entries(business.hours).map(([day, hours]) => (
            <li key={day}><strong>{day}:</strong> {hours}</li>
          ))}
        </ul>
      </div>

      {isRestaurant && (
        <div className="mb-4">
          <h2 className="text-xl font-semibold mb-2">Menu</h2>
          {business.menu.map((item, i) => (
            <div key={i} className="flex gap-4 border p-3 mb-2 rounded bg-white shadow-sm">
              {item.preview && <img src={item.preview} className="w-20 h-20 object-cover rounded" alt={item.name} />}
              <div>
                <h3 className="font-semibold">
                  {item.name} - <span className="text-blue-600">{item.price}</span>
                </h3>
                <p className="text-gray-600">{item.description}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {isLister && (
        <div>
          <h2 className="text-xl font-semibold mb-2">Listings</h2>
          {business.listings.map((item, i) => (
            <div key={i} className="border p-3 mb-2 rounded bg-white shadow-sm">
              <h3 className="font-semibold">
                {item.title} - <span className="text-blue-600">{item.price}</span>
              </h3>
              <p className="text-gray-600">{item.description}</p>
            </div>
          ))}
        </div>
      )}

      <div className="mt-6 text-center">
        <h2 className="text-sm text-gray-600 mb-1">📱 Share this profile</h2>
        <QRCode value={profileUrl} size={100} />
        <p className="text-xs mt-2">{profileUrl}</p>
      </div>
    </div>
  );
}
