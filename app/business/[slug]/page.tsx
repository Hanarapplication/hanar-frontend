'use client';

import { useParams } from 'next/navigation';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';
import {
  FaInstagram, FaFacebook, FaTiktok, FaGlobe,
  FaShareAlt, FaArrowLeft, FaArrowRight
} from 'react-icons/fa';

export default function BusinessProfilePage() {
  const { slug } = useParams();
  const [business, setBusiness] = useState<any>(null);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchBusiness = async () => {
      const { data, error } = await supabase
        .from('Businesses')
        .select('*')
        .eq('slug', slug)
        .single();

      if (data) setBusiness(data);
      setLoading(false);
    };

    if (slug) {
      fetchBusiness();
    }
  }, [slug]);

  const nextImage = () => setSelectedIndex((selectedIndex + 1) % (business?.images?.length || 1));
  const prevImage = () => setSelectedIndex((selectedIndex - 1 + (business?.images?.length || 1)) % (business?.images?.length || 1));

  if (loading) return <div className="min-h-screen flex justify-center items-center">Loading...</div>;

  if (!business) return <div className="min-h-screen flex justify-center items-center text-red-500">Business not found.</div>;

  return (
    <div className="p-4 bg-[#fef6f3] rounded-xl max-w-4xl mx-auto shadow-lg">
      {/* Slider Gallery */}
      {business.images?.length > 0 && (
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
      )}

      {/* Name + Category + Tags */}
      <h1 className="text-3xl font-bold text-[#333] mb-1">{business.name}</h1>
      <p className="text-[#777] italic mb-3">{business.category}</p>
      <div className="flex flex-wrap gap-2 mb-4">
        {business.tags?.map((tag: string, i: number) => (
          <span key={i} className="bg-[#ede7f6] text-sm text-[#333] rounded-full px-3 py-1 shadow-sm">#{tag}</span>
        ))}
      </div>

      {/* Description + Info */}
      <div className="bg-white rounded-lg p-4 shadow-md mb-4">
        <p className="mb-2 text-[#444]">{business.description}</p>
        <p className="text-sm text-[#555] mb-2">🕒 {business.hours}</p>

        {/* Embedded Map */}
        {business.address && (
          <div className="mb-2">
            <iframe
              src={`https://www.google.com/maps?q=${encodeURIComponent(business.address)}&output=embed`}
              width="100%"
              height="120"
              className="rounded-md"
              allowFullScreen
              loading="lazy"
              title="map"
            ></iframe>
          </div>
        )}
      </div>

      {/* Contact Info */}
      <div className="bg-white rounded-lg p-4 shadow-md mb-4 space-y-1 text-sm text-[#444]">
        {business.phone && <p>📞 {business.phone}</p>}
        {business.whatsapp && <p>💬 WhatsApp: {business.whatsapp}</p>}
        {business.email && <p>✉️ {business.email}</p>}
        {business.website && <p>🌐 <a href={business.website} className="text-blue-500 underline">Website</a></p>}
      </div>

      {/* Social Links + Share */}
      <div className="flex flex-wrap gap-4 text-sm text-gray-700 mb-6 items-center">
        {business.instagram && <a href={business.instagram} className="flex items-center gap-2 hover:underline"><FaInstagram />Instagram</a>}
        {business.facebook && <a href={business.facebook} className="flex items-center gap-2 hover:underline"><FaFacebook />Facebook</a>}
        {business.tiktok && <a href={business.tiktok} className="flex items-center gap-2 hover:underline"><FaTiktok />TikTok</a>}
        <button
          className="ml-auto bg-[#ede7f6] px-3 py-1 rounded-full text-sm flex items-center gap-1 hover:bg-[#dcd1f2]"
          onClick={() => navigator.share ? navigator.share({ title: business.name, url: window.location.href }) : navigator.clipboard.writeText(window.location.href)}
        >
          <FaShareAlt /> Share
        </button>
      </div>

      {/* Menu if Restaurant */}
      {business.isRestaurant && business.menu && (
        <div className="bg-white rounded-lg p-4 shadow-md mb-6">
          <h2 className="text-xl font-semibold mb-3 text-[#333]">Menu</h2>
          {Object.entries(business.menu).map(([category, items]: [string, any]) => (
            <div key={category} className="mb-4">
              <h3 className="font-bold text-[#444] mb-1">{category}</h3>
              {items.map((item: any, i: number) => (
                <div key={i} className="text-sm text-gray-800 border-b border-gray-100 py-1">
                  <strong>{item.name}</strong> – {item.price}<br />
                  <span className="text-gray-600">{item.description}</span>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}

      {/* Dealership Cars if Dealership */}
      {business.isDealership && business.cars && (
        <div className="bg-white rounded-lg p-4 shadow-md mb-6">
          <h2 className="text-xl font-semibold mb-3 text-[#333]">Available Cars</h2>
          {business.cars.map((car: any, i: number) => (
            <div key={i} className="border-b pb-3 mb-3">
              <h3 className="font-bold">{car.title} ({car.year})</h3>
              <p>Price: {car.price}</p>
              <p>Mileage: {car.mileage}</p>
              <p>Condition: {car.condition}</p>
            </div>
          ))}
        </div>
      )}

      {/* Owner Identity (for community linking) */}
      {business.ownerIdentity && (
        <div className="text-sm text-[#666] italic mb-4">
          Posts by this business in the community: <span className="text-blue-600">{business.ownerIdentity}</span>
        </div>
      )}

      {/* Reviews Placeholder */}
      <div className="bg-white rounded-lg p-4 shadow-md">
        <h2 className="text-lg font-bold text-[#333] mb-1">Reviews</h2>
        <p className="text-gray-500 italic">Coming soon...</p>
      </div>
    </div>
  );
}
