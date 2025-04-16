'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { FaHeart, FaShareAlt } from 'react-icons/fa';

const mockItem = {
  title: 'Honda Civic 2020',
  price: '$13,500',
  category: 'Cars & Vehicles',
  location: 'Los Angeles, CA',
  images: [
    'https://source.unsplash.com/600x400/?car',
    'https://source.unsplash.com/600x400/?interior,car',
    'https://source.unsplash.com/600x400/?dashboard',
  ],
  description: 'Well-maintained 2020 Honda Civic with 85k miles. No accident. New tires, fresh oil change.',
  datePosted: 'April 10, 2025',
  condition: 'Used',
  seller: 'Ali_Dealer91',
  views: 142,
  contact: {
    whatsapp: '+1 310-555-1234',
    phone: '+1 310-555-5678',
    email: 'ali@example.com',
  },
};

export default function ItemDetailClient() {
  const [item, setItem] = useState<typeof mockItem | null>(null);
  const [currentUrl, setCurrentUrl] = useState('');
  const [copied, setCopied] = useState(false);
  const [sharedWithFallback, setSharedWithFallback] = useState(false);

  useEffect(() => {
    type ItemType = typeof mockItem;
const [item, setItem] = useState<ItemType | null>(null);

  }, []);

  const handleNativeShare = () => {
    if (navigator.share) {
      navigator
        .share({
          title: item?.title || '',
          text: 'Check out this item on Hanar!',
          url: currentUrl,
        })
        .then(() => console.log('Shared successfully'))
        .catch((error) => console.error('Error sharing:', error));
    } else {
      alert('Sharing is not supported on your browser.');
    }
  };
  
  const copyLinkFallback = () => {
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(currentUrl)
        .then(() => {
          setCopied(true);
          setSharedWithFallback(true);
          setTimeout(() => {
            setCopied(false);
            setSharedWithFallback(false);
          }, 2000);
        })
        .catch(() => {
          fallbackToTextareaCopy();
        });
    } else {
      fallbackToTextareaCopy();
    }
  };

  const fallbackToTextareaCopy = () => {
    const textArea = document.createElement('textarea');
    textArea.value = currentUrl;
    textArea.style.position = 'fixed';
    textArea.style.opacity = '0';
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    try {
      const successful = document.execCommand('copy');
      if (successful) {
        setCopied(true);
        setSharedWithFallback(true);
        setTimeout(() => {
          setCopied(false);
          setSharedWithFallback(false);
        }, 2000);
      } else {
        alert('Could not copy. Try manually selecting the address bar.');
      }
    } catch (err) {
      alert('Copy failed. Try manually selecting the address bar.');
    }
    document.body.removeChild(textArea);
  };

  if (!item) return <div className="text-center py-10">Loading...</div>;

  return (
    <div className="max-w-3xl mx-auto px-4 py-6">
      <Link href="/marketplace" className="text-blue-500 underline block mb-4">
        ← Back to Marketplace
      </Link>

      <div className="bg-white shadow-md rounded-2xl overflow-hidden p-4">
        {/* Top Info Box */}
        <div className="flex justify-between items-start mb-4">
          <div>
            <h1 className="text-xl font-bold">{item.title}</h1>
            <p className="text-green-600 font-semibold text-lg">{item.price}</p>
            <p className="text-sm text-gray-500">
              {item.category} • {item.location}
            </p>
          </div>
          <FaHeart className="text-gray-400 hover:text-red-500 text-lg cursor-pointer mt-1" />
        </div>

        {/* Images */}
        <div className="grid grid-cols-2 gap-2 mb-4">
          {item.images.map((img, idx) => (
            <Image
              key={idx}
              src={img}
              alt={`Item image ${idx + 1}`}
              width={300}
              height={200}
              className="rounded-lg object-cover w-full h-auto"
            />
          ))}
        </div>

        {/* Condition & Views */}
        <div className="flex flex-wrap justify-between items-center text-sm text-gray-500 mb-4">
          <span
            className={`px-3 py-1 rounded-full ${
              item.condition === 'New'
                ? 'bg-green-100 text-green-700'
                : 'bg-yellow-100 text-yellow-700'
            }`}
          >
            {item.condition}
          </span>
          <span>{item.datePosted} • {item.views} views</span>
        </div>

        {/* Description Box */}
        <div className="bg-gray-50 p-4 rounded-xl mb-4">
          <h2 className="font-semibold text-sm text-gray-700 mb-1">Description</h2>
          <p className="text-gray-800 text-sm">{item.description}</p>
        </div>

        {/* Contact Info Box */}
        <div className="bg-gray-50 p-4 rounded-xl mb-4">
          <h2 className="font-semibold text-sm text-gray-700 mb-2">Contact Me</h2>
          <ul className="text-sm text-gray-800 space-y-1">
            <li>
              📞 Phone: <a href={`tel:${item.contact.phone}`} className="text-blue-500">{item.contact.phone}</a>
            </li>
            <li>
              💬 WhatsApp: <a href={`https://wa.me/${item.contact.whatsapp.replace(/\D/g, '')}`} className="text-green-600" target="_blank">Chat</a>
            </li>
            <li>
              📧 Email: <a href={`mailto:${item.contact.email}`} className="text-blue-500">{item.contact.email}</a>
            </li>
          </ul>
        </div>

        {/* Share Button Box */}
        <div className="bg-gray-50 p-4 rounded-xl mb-4">
          <h2 className="font-semibold text-sm text-gray-700 mb-2">Share</h2>
          <button
            onClick={handleNativeShare}
            className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-full flex items-center gap-2 text-sm mb-2"
          >
            <FaShareAlt /> Share Item
          </button>
          {!navigator.share && (
            <div className="text-sm text-gray-500">
              Sharing not supported —
              <button
                onClick={copyLinkFallback}
                className="underline text-blue-600 ml-1"
              >
                Copy link instead
              </button>
              {copied && (
                <span className="ml-2 text-green-600">
                  {sharedWithFallback ? '✓ Link copied!' : '✓ Copied!'}
                </span>
              )}
            </div>
          )}
        </div>

        {/* Report */}
        <div className="text-right">
          <button
            onClick={() => alert('Report submitted. Our team will review this item shortly.')}
            className="text-sm text-red-500 hover:underline"
          >
            🚩 Report this item
          </button>
        </div>
      </div>
    </div>
  );
}
