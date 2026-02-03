'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import LiveRefreshLink from '@/components/LiveRefreshLink';
import { useKeenSlider } from 'keen-slider/react';
import Footer from '@/components/Footer';

const featuredBusinesses = [
  { id: 1, name: 'Taste of Beirut', category: 'Restaurant', image: 'https://picsum.photos/id/10/367/267' },
  { id: 2, name: 'Halal Market', category: 'Grocery Store', image: 'https://picsum.photos/id/9/367/267' },
  { id: 3, name: 'Sahara Salon', category: 'Beauty', image: 'https://picsum.photos/id/12/367/267' },
  { id: 4, name: 'Persian Grill', category: 'Food Truck', image: 'https://picsum.photos/id/14/367/267' },
];

const trendingItems = [
  { id: 1, title: 'Persian Rug', price: '$450', image: 'https://www.catalinarug.com/wp-content/uploads/2022/12/381637-600x853.jpg' },
  { id: 2, title: 'Afghan Jewelry', price: '$120', image: 'https://picsum.photos/id/28/367/267' },
  { id: 3, title: 'Spices Box', price: '$25', image: 'https://picsum.photos/id/29/367/267' },
  { id: 4, title: 'Turkish Tea Set', price: '$40', image: 'https://picsum.photos/id/26/367/267' },
];

const initialTopCommunities = [
  { id: 'halal-foodies', name: 'Halal Foodies', description: 'Share your favorite halal eats and discover new restaurants! Talk about recipes, reviews, and all things halal food-related in your area and around the world.', likeCount: 125, replyCount: 32 },
  { id: 'muslim-entrepreneurs', name: 'Muslim Entrepreneurs', description: 'A supportive community for Muslim business owners, startups, and side hustle enthusiasts. Share your challenges, successes, and network with like-minded individuals.', likeCount: 87, replyCount: 18 },
  { id: 'immigrants-in-tech', name: 'Immigrants in Tech', description: 'Connecting immigrants working in the tech industry. Discuss career advice, immigration processes, and share your experiences navigating the tech world as an immigrant.', likeCount: 150, replyCount: 45 },
  { id: 'islamic-art-culture', name: 'Islamic Art & Culture', description: 'A space to appreciate and discuss the rich history and contemporary expressions of Islamic art, architecture, calligraphy, music, and other cultural forms.', likeCount: 92, replyCount: 25 },
  { id: 'new-muslims-support', name: 'New Muslims Support', description: 'A welcoming and supportive community for individuals who have recently embraced Islam. Ask questions, share your journey, and connect with others on a similar path.', likeCount: 68, replyCount: 15 },
  { id: 'middle-eastern-cuisine', name: 'Middle Eastern Cuisine', description: 'Explore the diverse and delicious world of Middle Eastern cooking. Share recipes, cooking tips, and discuss your favorite dishes from various countries in the region.', likeCount: 110, replyCount: 38 },
  { id: 'islamic-finance-101', name: 'Islamic Finance 101', description: 'Learn the basics of Islamic finance and ethical investing. Ask questions about halal banking, investments, and other financial practices in accordance with Islamic principles.', likeCount: 76, replyCount: 22 },
  { id: 'muslim-travelers', name: 'Muslim Travelers', description: 'Share your travel experiences, tips for finding halal food and prayer spaces, and connect with other Muslims who love to explore the world.', likeCount: 138, replyCount: 40 },
  { id: 'parenting-muslim-way', name: 'Parenting the Muslim Way', description: 'A community for Muslim parents to share advice, discuss challenges, and support each other in raising children with strong Islamic values in today\'s world.', likeCount: 105, replyCount: 30 },
  { id: 'local-masjid-events', name: 'Local Masjid Events', description: 'Share information about events, lectures, classes, and activities happening at your local mosques and Islamic centers. Help keep the community informed and connected.', likeCount: 54, replyCount: 12 },
  // Add more communities for scrolling
  { id: 'community-11', name: 'Another Community 1', description: 'Description for community 11. More details here...', likeCount: 20, replyCount: 5 },
  { id: 'community-12', name: 'Another Community 2', description: 'Description for community 12. Even more info...', likeCount: 30, replyCount: 8 },
  { id: 'community-13', name: 'Another Community 3', description: 'Description for community 13. Lots to talk about...', likeCount: 40, replyCount: 10 },
  { id: 'community-14', name: 'Another Community 4', description: 'Description for community 14. Join the discussion!', likeCount: 50, replyCount: 12 },
  { id: 'community-15', name: 'Another Community 5', description: 'Description for community 15. Your thoughts welcome...', likeCount: 60, replyCount: 15 },
];

const adBanners = [
  {
    id: 1,
    image: 'https://img.freepik.com/free-photo/sassy-goodlooking-redhead-female-yellow-sweater-listen-music-white-headphones-touch-earphones_1258-126219.jpg?t=st=1745033707~exp=1745037307~hmac=d35b64bbfefc1d81e3b4b725052bc1c7a33ffe1c957ad272a62cf34ce3793cbf&w=1060',
    link: 'hanar.net',
    alt: 'Advertise with us',
  },
  {
    id: 2,
    image: 'https://img.freepik.com/premium-photo/asian-woman-pointing-side_28629-1771.jpg',
    link: 'www.hanar.net',
    alt: 'Your Banner Here!',
  },
];

export default function Home() {
  const [topCommunities, setTopCommunities] = useState(initialTopCommunities.slice(0, 10));
  const [loadingMore, setLoadingMore] = useState(false);
  const [allCommunitiesLoaded, setAllCommunitiesLoaded] = useState(false);
  const communitySectionRef = useRef<HTMLDivElement>(null);
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
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !loadingMore && !allCommunitiesLoaded) {
          loadMoreCommunities();
        }
      },
      {
        root: null, // viewport
        rootMargin: '0px',
        threshold: 0.1, // trigger when 10% of the element is visible
      }
    );

    if (communitySectionRef.current) {
      observer.observe(communitySectionRef.current.lastChild as Element);
    }

    return () => observer.disconnect();
  }, [loadingMore, allCommunitiesLoaded, topCommunities]);

  const loadMoreCommunities = () => {
    if (loadingMore || allCommunitiesLoaded) return;

    setLoadingMore(true);
    setTimeout(() => {
      const nextBatch = initialTopCommunities.slice(topCommunities.length, topCommunities.length + 5);
      setTopCommunities((prev) => [...prev, ...nextBatch]);
      setLoadingMore(false);

      if (topCommunities.length + nextBatch.length === initialTopCommunities.length) {
        setAllCommunitiesLoaded(true);
      }
    }, 500); // Simulate loading delay
  };

  useEffect(() => {
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
      clearInterval(businessInterval);
      clearInterval(marketInterval);
    };
  }, [businessSlider, marketSlider]);

  return (
    <div className="min-h-screen bg-gray-100 py-8 space-y-8">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        {/* Featured Businesses */}
        <section className="bg-white rounded-lg shadow-md p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold text-gray-800">Featured Businesses</h2>
            <LiveRefreshLink href="/businesses" className="inline-flex items-center bg-[#A93226] hover:bg-[#922B21] text-white text-sm font-medium rounded-full px-3 py-2 transition-colors shadow-sm">
              View All <svg className="ml-2 -mr-1 h-4 w-4" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"><path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" /></svg>
            </LiveRefreshLink>
          </div>
          <div className="relative">
            <button onClick={() => businessSlider.current?.prev()} className="absolute left-0 top-1/2 transform -translate-y-1/2 bg-white bg-opacity-75 hover:bg-opacity-90 text-indigo-500 rounded-full shadow-md p-2 -ml-2 z-10">
              <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"><path fillRule="evenodd" d="M9.707 16.707a1 1 0 01-1.414-1.414L12.586 10 8.293 5.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" /></svg>
            </button>
            <div ref={businessSliderRef} className="keen-slider overflow-hidden rounded-lg">
              {featuredBusinesses.map((biz) => (
                <div key={biz.id} className="keen-slider__slide bg-white rounded-lg shadow-sm border border-gray-200">
                  <img src={biz.image} alt={biz.name} className="w-full h-24 object-cover rounded-t-lg" />
                  <div className="p-3">
                    <h3 className="text-sm font-semibold text-indigo-700 truncate">{biz.name}</h3>
                    <p className="text-xs text-gray-600">{biz.category}</p>
                  </div>
                </div>
              ))}
            </div>
            <button onClick={() => businessSlider.current?.next()} className="absolute right-0 top-1/2 transform -translate-y-1/2 bg-white bg-opacity-75 hover:bg-opacity-90 text-indigo-500 rounded-full shadow-md p-2 -mr-2 z-10">
              <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"><path fillRule="evenodd" d="M10.293 3.293a1 1 0 011.414 1.414L7.414 10l4.293 4.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4z" clipRule="evenodd" /></svg>
            </button>
          </div>
        </section>

        {/* Ad Banner */}
        <section className="bg-white rounded-lg shadow-md p-4">
          {adBanner.link ? (
            <Link href={adBanner.link} target="_blank" rel="noopener noreferrer" className="block">
              <img src={adBanner.image} alt={adBanner.alt} className="w-full h-auto object-cover rounded-md" />
            </Link>
          ) : (
            <img src={adBanner.image} alt={adBanner.alt} className="w-full h-auto object-cover rounded-md" />
          )}
        </section>

        {/* Marketplace Items */}
        <section className="bg-white rounded-lg shadow-md p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold text-gray-800">Trending Items</h2>
            <LiveRefreshLink href="/marketplace" className="inline-flex items-center bg-[#A93226] hover:bg-[#922B21] text-white text-sm font-medium rounded-full px-3 py-2 transition-colors shadow-sm">
              Browse Marketplace <svg className="ml-2 -mr-1 h-4 w-4" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"><path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" /></svg>
            </LiveRefreshLink>
          </div>
          <div className="relative">
            <button onClick={() => marketSlider.current?.prev()} className="absolute left-0 top-1/2 transform -translate-y-1/2 bg-white bg-opacity-75 hover:bg-opacity-90 text-purple-500 rounded-full shadow-md p-2 -ml-2 z-10">
              <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"><path fillRule="evenodd" d="M9.707 16.707a1 1 0 01-1.414-1.414L12.586 10 8.293 5.707a1 1 0
              011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" /></svg>
            </button>
            <div ref={marketSliderRef} className="keen-slider overflow-hidden rounded-lg">
              {trendingItems.map((item) => (
                <div key={item.id} className="keen-slider__slide bg-white rounded-lg shadow-sm border border-gray-200">
                  <img src={item.image} alt={item.title} className="w-full h-24 object-cover rounded-t-lg" />
                  <div className="p-3">
                    <h3 className="text-sm font-semibold text-purple-700 truncate">{item.title}</h3>
                    <p className="text-xs font-bold text-green-600">{item.price}</p>
                  </div>
                </div>
              ))}
            </div>
            <button onClick={() => marketSlider.current?.next()} className="absolute right-0 top-1/2 transform -translate-y-1/2 bg-white bg-opacity-75 hover:bg-opacity-90 text-purple-500 rounded-full shadow-md p-2 -mr-2 z-10">
              <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"><path fillRule="evenodd" d="M10.293 3.293a1 1 0 011.414 1.414L7.414 10l4.293 4.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4z" clipRule="evenodd" /></svg>
            </button>
          </div>
        </section>
continu
        {/* Top Communities */}
        <section className="bg-white rounded-lg shadow-md p-6" ref={communitySectionRef}>
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold text-gray-800">Top Communities</h2>
            <Link href="/communities" className="inline-flex items-center bg-teal-500 hover:bg-teal-600 text-white text-sm font-medium rounded-full px-3 py-2 transition-colors">
              View All <svg className="ml-2 -mr-1 h-4 w-4" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"><path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" /></svg>
            </Link>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {topCommunities.map((community) => (
              <Link key={community.id} href={`/communities/${community.id}`} className="block rounded-lg shadow-sm border border-gray-200 hover:shadow-md transition-shadow duration-200">
                <div className="p-3">
                  <h3 className="text-sm font-semibold text-teal-700 truncate">{community.name}</h3>
                  <p className="text-xs text-gray-600 line-clamp-2">{community.description}</p>
                  <div className="flex items-center mt-2 text-xs text-gray-500">
                    <span className="mr-2">❤️ {community.likeCount}</span>
                    <span>💬 {community.replyCount}</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
          {loadingMore && (
            <div className="flex justify-center py-2">
              <span className="text-gray-500 text-sm">Loading more communities...</span>
            </div>
          )}
          {allCommunitiesLoaded && (
            <div className="flex justify-center py-2">
              <span className="text-gray-500 text-sm">All communities loaded.</span>
            </div>
          )}
        </section>
      </div>
      <Footer />
    </div>
  );
}