'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useKeenSlider } from 'keen-slider/react';
import Footer from '@/components/Footer';

const featuredBusinesses = [
  { id: 1, name: 'Taste of Beirut', category: 'Restaurant', image: 'https://source.unsplash.com/400x300/?restaurant,beirut' },
  { id: 2, name: 'Halal Market', category: 'Grocery Store', image: 'https://source.unsplash.com/400x300/?market,shop' },
  { id: 3, name: 'Sahara Salon', category: 'Beauty', image: 'https://source.unsplash.com/400x300/?salon,hair' },
  { id: 4, name: 'Persian Grill', category: 'Food Truck', image: 'https://source.unsplash.com/400x300/?foodtruck' },
];

const trendingItems = [
  { id: 1, title: 'Persian Rug', price: '$450', image: 'https://source.unsplash.com/400x300/?rug' },
  { id: 2, title: 'Afghan Jewelry', price: '$120', image: 'https://source.unsplash.com/400x300/?jewelry' },
  { id: 3, title: 'Spices Box', price: '$25', image: 'https://source.unsplash.com/400x300/?spices' },
  { id: 4, title: 'Turkish Tea Set', price: '$40', image: 'https://source.unsplash.com/400x300/?tea' },
];

const communityPosts = [
  { id: 1, question: 'How to promote my small business in the US?', user: 'fatima_boston', category: 'Business Tips' },
  { id: 2, question: 'Where can I find halal food in LA?', user: 'ahmed_la', category: 'Food & Halal' },
  { id: 3, question: 'How to register an LLC as an immigrant?', user: 'maria_nyc', category: 'Legal Help' },
];

const adBanners = [
  {
    id: 1,
    image: 'https://source.unsplash.com/1200x200/?ad,business',
    link: 'https://example.com',
    alt: 'Advertise with us',
  },
  {
    id: 2,
    image: 'https://source.unsplash.com/1200x200/?promotion,deal',
    link: '',
    alt: 'Your Banner Here!',
  },
];

export default function Home() {
  const [randomPostIndex, setRandomPostIndex] = useState(0);
  const communitySliderRef = useRef(null);
  const [adBanner, setAdBanner] = useState(adBanners[0]);

  const [businessSliderRef, businessSlider] = useKeenSlider({
    loop: true,
    slides: { perView: 3, spacing: 8 },
    breakpoints: {
      '(max-width: 768px)': {
        slides: { perView: 3, spacing: 6 },
      },
    },
  });

  const [marketSliderRef, marketSlider] = useKeenSlider({
    loop: true,
    slides: { perView: 3, spacing: 8 },
    breakpoints: {
      '(max-width: 768px)': {
        slides: { perView: 3, spacing: 6 },
      },
    },
  });

  useEffect(() => {
    const communityInterval = setInterval(() => {
      setRandomPostIndex((prev) => (prev + 1) % communityPosts.length);
    }, 3000);

    const businessInterval = setInterval(() => {
      if (businessSlider.current) {
        businessSlider.current.next();
      }
    }, 3000);

    const marketInterval = setInterval(() => {
      if (marketSlider.current) {
        marketSlider.current.next();
      }
    }, 3000);

    // Pick a random banner on load
    const randomBanner = adBanners[Math.floor(Math.random() * adBanners.length)];
    setAdBanner(randomBanner);

    return () => {
      clearInterval(communityInterval);
      clearInterval(businessInterval);
      clearInterval(marketInterval);
    };
  }, [businessSlider, marketSlider]);

  const randomPost = communityPosts[randomPostIndex];

  return (
    <div className="min-h-screen bg-[#f8fbff] px-2 py-4 space-y-6">
      {/* Featured Businesses */}
      <section>
        <div className="flex justify-between items-center mb-2 px-2">
          <h2 className="text-xl font-bold text-gray-800">Featured Businesses</h2>
          <Link href="/businesses" className="text-sm bg-indigo-600 text-white px-3 py-1 rounded-full hover:bg-indigo-700 transition">View All</Link>
        </div>
        <div className="relative">
          <button onClick={() => businessSlider.current?.prev()} className="absolute left-0 top-1/2 transform -translate-y-1/2 bg-indigo-600 text-white px-2 py-1 rounded-full z-10">‹</button>
          <div ref={businessSliderRef} className="keen-slider">
            {featuredBusinesses.map((biz) => (
              <div key={biz.id} className="keen-slider__slide min-w-[100px] bg-gradient-to-br from-slate-100 to-slate-200 rounded-lg shadow-md border border-slate-300 overflow-hidden">
                <img src={biz.image} alt={biz.name} className="w-full h-24 object-cover" />
                <div className="p-1">
                  <h3 className="text-xs font-semibold text-indigo-800 truncate">{biz.name}</h3>
                  <p className="text-[10px] text-slate-600">{biz.category}</p>
                </div>
              </div>
            ))}
          </div>
          <button onClick={() => businessSlider.current?.next()} className="absolute right-0 top-1/2 transform -translate-y-1/2 bg-indigo-600 text-white px-2 py-1 rounded-full z-10">›</button>
        </div>
      </section>

      {/* Ad Banner */}
      <section className="px-2 mb-2">
        {adBanner.link ? (
          <a href={adBanner.link} target="_blank" rel="noopener noreferrer">
            <img src={adBanner.image} alt={adBanner.alt} className="w-full h-18 object-cover rounded-xl shadow-md border border-gray-300" />
          </a>
        ) : (
          <img src={adBanner.image} alt={adBanner.alt} className="w-full rounded-xl shadow-md border border-gray-300" />
        )}
      </section>

      {/* Marketplace Items */}
      <section className="mt-2">
        <div className="flex justify-between items-center mb-2 px-2">
          <h2 className="text-xl font-bold text-gray-800">Trending Items</h2>
          <Link href="/marketplace" className="text-sm bg-purple-600 text-white px-3 py-1 rounded-full hover:bg-purple-700 transition">Browse Marketplace</Link>
        </div>
        <div className="relative">
          <button onClick={() => marketSlider.current?.prev()} className="absolute left-0 top-1/2 transform -translate-y-1/2 bg-purple-600 text-white px-2 py-1 rounded-full z-10">‹</button>
          <div ref={marketSliderRef} className="keen-slider">
            {trendingItems.map((item) => (
              <div key={item.id} className="keen-slider__slide min-w-[100px] bg-gradient-to-br from-slate-100 to-slate-200 rounded-lg shadow-md border border-slate-300 overflow-hidden">
                <img src={item.image} alt={item.title} className="w-full h-24 object-cover" />
                <div className="p-1">
                  <h3 className="text-xs font-semibold text-purple-800 truncate">{item.title}</h3>
                  <p className="text-[10px] text-green-700 font-bold">{item.price}</p>
                </div>
              </div>
            ))}
          </div>
          <button onClick={() => marketSlider.current?.next()} className="absolute right-0 top-1/2 transform -translate-y-1/2 bg-purple-600 text-white px-2 py-1 rounded-full z-10">›</button>
        </div>
      </section>

      {/* Community Post */}
      <section className="px-2">
        <div className="flex justify-between items-center mb-2">
          <h2 className="text-xl font-bold text-gray-800">Top Community Question</h2>
          <Link href="/community" className="text-sm bg-rose-600 text-white px-3 py-1 rounded-full hover:bg-rose-700 transition">Explore Community</Link>
        </div>
        <div className="relative">
          <button
            onClick={() =>
              setRandomPostIndex((prev) =>
                prev === 0 ? communityPosts.length - 1 : prev - 1
              )
            }
            className="absolute -left-3 top-1/2 transform -translate-y-1/2 w-10 h-10 bg-rose-600 text-white flex items-center justify-center rounded-full z-10"
          >‹</button>
          <div className="bg-gradient-to-br from-slate-100 to-slate-200 rounded-xl shadow-md p-3 border border-slate-300 max-w-[90%] mx-auto">
            <div className="flex justify-between items-center mb-1">
              <span className="text-xs text-slate-500">@{randomPost.user}</span>
              <span className="bg-indigo-100 text-indigo-700 text-xs font-semibold px-2 py-1 rounded-md">
                {randomPost.category}
              </span>
            </div>
            <p className="text-sm font-medium text-slate-800 leading-snug">{randomPost.question}</p>
          </div>
          <button
            onClick={() =>
              setRandomPostIndex((prev) => (prev + 1) % communityPosts.length)
            }
            className="absolute -right-3 top-1/2 transform -translate-y-1/2 w-10 h-10 bg-rose-600 text-white flex items-center justify-center rounded-full z-10"
          >›</button>
        </div>
      </section>
    </div>
  );
}
