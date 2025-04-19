'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';
import { enUS } from 'date-fns/locale';
import { HeartIcon as SolidHeartIcon, ChatBubbleLeftIcon as SolidChatBubbleLeftIcon } from '@heroicons/react/24/solid';

interface Post {
  id: string;
  title: string;
  body: string;
  image?: string;
  username: string;
  language: string;
  date: string;
  tags: string[];
  category: string;
  likes: number;
  replies: number;
}

const mockPosts: Post[] = [
  { id: '1', title: 'Exploring Ancient Ruins', body: 'Just back from an incredible trip to explore some truly breathtaking ancient ruins. The history and the architecture were simply awe-inspiring. I spent days wandering through these ancient sites, imagining the lives of the people who once lived there. The intricate carvings and the sheer scale of the structures were mesmerizing. I took so many photos, and I can\'t wait to share them all with you. If you ever get the chance to visit these places, I highly recommend it. It\'s an experience you won\'t forget!', image: 'https://source.unsplash.com/400x200/?ancient,ruins', username: 'wanderlust_1', language: 'en', date: '2025-04-18', tags: ['travel', 'history', 'adventure'], category: 'Travel', likes: 15, replies: 4 },
  { id: '2', title: 'Delicious Vegan Recipe', body: 'Sharing my go-to vegan pasta recipe that is not only incredibly delicious but also super easy to make. Perfect for a quick weeknight meal. The creamy sauce is made from cashews, nutritional yeast, and a blend of herbs and spices. Toss it with your favorite pasta and some fresh vegetables for a satisfying and healthy dish. You won\'t believe it\'s vegan!', image: 'https://source.unsplash.com/400x200/?vegan,food', username: 'plantbased_gal', language: 'en', date: '2025-04-17', tags: ['vegan', 'recipe', 'foodie'], category: 'Food', likes: 22, replies: 7 },
  { id: '3', title: 'Coding Challenge Solution', body: 'Finally solved that tricky algorithm challenge I\'ve been stuck on for days! Feeling so relieved and wanted to share my approach with the community. The key was to use dynamic programming and break down the problem into smaller, overlapping subproblems. Here\'s the code snippet and a brief explanation of the logic...', image: '', username: 'code_master', language: 'en', date: '2025-04-16', tags: ['coding', 'javascript', 'algorithms'], category: 'Technology', likes: 18, replies: 5 },
  { id: '4', title: 'DIY Home Decor Ideas', body: 'Looking for some budget-friendly home decor inspiration? I\'ve been experimenting with a few DIY projects that have really transformed my living space. From repurposing old furniture to creating unique wall art, there are so many ways to add a personal touch to your home without breaking the bank. I\'ll be sharing step-by-step tutorials for some of my favorite projects soon!', image: 'https://source.unsplash.com/400x200/?diy,homedecor', username: 'crafty_mama', language: 'en', date: '2025-04-15', tags: ['diy', 'homedecor', 'crafts'], category: 'Lifestyle', likes: 28, replies: 9 },
  { id: '5', title: 'Must-Read Book Recommendations', body: 'Just finished an amazing novel that I couldn\'t put down! It had such compelling characters and a plot that kept me hooked until the very last page. The author\'s writing style was beautiful and evocative, and the themes explored in the book resonated deeply with me. I highly recommend adding this one to your reading list. Let me know if you\'ve read it too!', image: '', username: 'bookworm_88', language: 'en', date: '2025-04-14', tags: ['books', 'reading', 'fiction'], category: 'Literature', likes: 35, replies: 12 },
  { id: '6', title: 'Tips for Learning a New Language', body: 'Sharing my best strategies and resources for language acquisition. Learning a new language can be challenging but also incredibly rewarding. Consistency is key, and finding enjoyable ways to practice makes a huge difference. I\'ll be talking about my favorite apps, websites, and techniques that have helped me learn multiple languages over the years.', image: '', username: 'polyglot_pro', language: 'en', date: '2025-04-13', tags: ['language', 'learning', 'travel'], category: 'Education', likes: 20, replies: 6 },
  { id: '7', title: 'My Photography Journey', body: 'A look back at how I got started with photography and some of the key milestones along the way. It\'s been an incredible journey of learning and discovery. I remember getting my first DSLR camera and feeling completely overwhelmed, but with practice and a lot of experimentation, I started to develop my own style. I\'ll be sharing some of my early photos and the stories behind them.', image: 'https://source.unsplash.com/400x200/?photography', username: 'camera_guy', language: 'en', date: '2025-04-12', tags: ['photography', 'art', 'visuals'], category: 'Photography', likes: 42, replies: 15 },
  { id: '8', title: 'Best Hiking Trails Near Me', body: 'Exploring some scenic hiking trails this weekend and wanted to share a few of my favorite spots that offer stunning views and a great workout. Whether you\'re a beginner or an experienced hiker, there\'s a trail out there for everyone. I\'ll be including details about the difficulty level, the length, and some of the highlights of each trail.', image: 'https://source.unsplash.com/400x200/?hiking,nature', username: 'trail_seeker', language: 'en', date: '2025-04-11', tags: ['hiking', 'nature', 'outdoors'], category: 'Travel', likes: 31, replies: 10 },
  { id: '9', title: 'Quick and Easy Workout Routine', body: 'Sharing a simple yet effective home workout routine that you can do in under 30 minutes. Perfect for busy days when you still want to get some exercise in. This routine focuses on full-body movements and requires no equipment. I\'ll be demonstrating each exercise and providing modifications for different fitness levels.', image: '', username: 'fitness_junkie', language: 'en', date: '2025-04-10', tags: ['fitness', 'workout', 'health'], category: 'Fitness', likes: 26, replies: 8 },
  { id: '10', title: 'Thoughts on the Latest Tech Gadget', body: 'My in-depth review of the newest smartphone on the market. I\'ll be covering everything from the camera quality to the battery life and performance. I\'ve been testing this device for the past week, and I have some strong opinions about it. Is it worth the hype? Let\'s find out!', image: 'https://source.unsplash.com/400x200/?technology,gadget', username: 'tech_guru', language: 'en', date: '2025-04-09', tags: ['technology', 'gadgets', 'reviews'], category: 'Technology', likes: 38, replies: 13 },
  { id: '11', title: 'Comfort Food Classics', body: 'Sometimes you just need some classic comfort food to lift your spirits. Today I\'m sharing my recipe for the ultimate mac and cheese. This isn\'t your average mac and cheese; it\'s creamy, cheesy, and oh-so-satisfying. I\'ll be sharing all my secret ingredients for the perfect flavor and texture.', image: 'https://source.unsplash.com/400x200/?comfort,food', username: 'cozy_cook', language: 'en', date: '2025-04-08', tags: ['food', 'comfortfood', 'cooking'], category: 'Food', likes: 29, replies: 9 },
  { id: '12', title: 'Exploring Local Art Scene', body: 'Spent the day checking out some amazing local art galleries and studios. There\'s so much talent in our city, and I wanted to share some of the highlights. I was particularly impressed by the diverse range of styles and mediums on display. Supporting local artists is so important, and I encourage you to explore the art scene in your own community.', image: 'https://source.unsplash.com/400x200/?art,gallery', username: 'art_lover', language: 'en', date: '2025-04-07', tags: ['art', 'culture', 'local'], category: 'Lifestyle', likes: 17, replies: 5 },
  { id: '13', title: 'Sustainable Living Tips', body: 'Sharing some simple yet impactful ways to live more sustainably and reduce our environmental footprint. Every little bit counts when it comes to protecting our planet. I\'ll be discussing things like reducing waste, conserving energy, and making more conscious consumer choices. Let\'s all do our part to create a greener future.', image: '', username: 'eco_warrior', language: 'en', date: '2025-04-06', tags: ['sustainability', 'environment', 'eco'], category: 'Environment', likes: 33, replies: 11 },
  { id: '14', title: 'Learning to Play the Guitar', body: 'Just started my journey of learning to play the guitar! It\'s been challenging but also incredibly rewarding to see progress, even in small steps. I\'m currently focusing on learning basic chords and strumming patterns. If there are any experienced guitar players out there with tips for beginners, I\'d love to hear them!', image: '', username: 'music_newbie', language: 'en', date: '2025-04-05', tags: ['music', 'guitar', 'learning'], category: 'Hobbies', likes: 24, replies: 7 },
  { id: '15', title: 'Travel Photography Essentials', body: 'My go-to gear and tips for capturing amazing travel photos. Having the right equipment can make a big difference in the quality of your travel memories. I\'ll be talking about my favorite lenses, camera settings, and some essential accessories that I always bring on my trips. Plus, a few tips for capturing those perfect moments.', image: 'https://source.unsplash.com/400x200/?travel,photography', username: 'travel_lens', language: 'en', date: '2025-04-04', tags: ['travel', 'photography', 'gear'], category: 'Photography', likes: 40, replies: 14 },
  { id: '16', title: 'Exploring Urban Green Spaces', body: 'Found a hidden gem of a park right in the middle of the city! It\'s amazing to find these pockets of nature amidst the urban landscape. This park has beautiful walking trails, a serene pond, and plenty of shady spots to relax. It\'s the perfect escape from the hustle and bustle of city life.', image: 'https://source.unsplash.com/400x200/?urban,park', username: 'city_explorer', language: 'en', date: '2025-04-03', tags: ['urban', 'nature', 'citylife'], category: 'Travel', likes: 21, replies: 6 },
  { id: '17', title: 'Healthy Breakfast Ideas', body: 'Starting the day right with some nutritious and delicious breakfast options. Here are a few of my favorite healthy breakfast recipes to fuel your morning. From smoothie bowls to overnight oats and avocado toast variations, there\'s something for everyone. A good breakfast sets the tone for a productive day!', image: '', username: 'health_nut', language: 'en', date: '2025-04-02', tags: ['health', 'breakfast', 'nutrition'], category: 'Food', likes: 27, replies: 9 },
  { id: '18', title: 'Building a Personal Website', body: 'Documenting my journey of building a personal portfolio website from scratch. It\'s been a great learning experience in web development. I\'ve been diving into React, Tailwind CSS, and learning about deployment. I\'ll be sharing updates on my progress and some of the challenges I\'ve encountered along the way. Stay tuned for the final result!', image: '', username: 'web_dev_life', language: 'en', date: '2025-04-01', tags: ['webdev', 'portfolio', 'coding'], category: 'Technology', likes: 36, replies: 12 },
  { id: '19', title: 'Creative Writing Prompts', body: 'Stuck on your next writing project? Here are some creative writing prompts to spark your imagination and get those ideas flowing. Whether you enjoy fiction, poetry, or creative non-fiction, these prompts are designed to help you overcome writer\'s block and explore new possibilities. Happy writing!', image: '', username: 'word_artist', language: 'en', date: '2025-03-31', tags: ['writing', 'creative', 'prompts'], category: 'Literature', likes: 19, replies: 5 },
  { id: '20', title: 'Gardening Tips for Beginners', body: 'Just started my first garden and learning so much along the way! Here are some essential tips for anyone who\'s just beginning their gardening adventure. From choosing the right plants to understanding soil and watering techniques, these basics will set you up for success. Get ready to get your hands dirty!', image: 'https://source.unsplash.com/400x200/?garden', username: 'green_thumb_wannabe', language: 'en', date: '2025-03-30', tags: ['gardening', 'plants', 'hobbies'], category: 'Hobbies', likes: 25, replies: 8 },
];

export default function CommunityPage() {
  const [search, setSearch] = useState('');
  const [visibleCount, setVisibleCount] = useState(10);
  const bottomRef = useRef(null);

  let filtered = mockPosts
    .filter(p => {
      const term = search.toLowerCase();
      return (
        p.title.toLowerCase().includes(term) ||
        p.body.toLowerCase().includes(term) ||
        p.username.toLowerCase().includes(term) ||
        p.category.toLowerCase().includes(term) ||
        p.tags.some(t => t.toLowerCase().includes(term))
      );
    })
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const visiblePosts = filtered.slice(0, visibleCount);

  useEffect(() => {
    const observer = new IntersectionObserver(
      entries => {
        if (entries[0].isIntersecting) {
          setVisibleCount(prev => Math.min(prev + 10, filtered.length));
        }
      },
      { threshold: 1 }
    );
    if (bottomRef.current) observer.observe(bottomRef.current);
    return () => observer.disconnect();
  }, [filtered]);

  return (
    <div className="min-h-screen py-8" style={{ backgroundColor: '#e0f2f7' }}>
      <div className="container mx-auto space-y-6" style={{ maxWidth: '95%' }}>
        {/* Promotion Banner */}
        <div className="bg-yellow-100 text-center text-sm text-yellow-800 py-3 shadow-sm rounded-md">
          📢 Promote your business here — <Link href="/advertise" className="underline cursor-pointer hover:text-yellow-900 transition-colors">Advertise</Link>
        </div>

        {/* Search Bar */}
        <div className="sticky top-0 z-30 bg-white shadow-sm rounded-md p-3">
          <input
            className="w-full p-3 border rounded-md bg-gray-50 text-lg focus:ring-blue-500 focus:border-blue-500"
            placeholder="Search posts..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>

        {/* Post List */}
        <div className="grid grid-cols-1 sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {visiblePosts.map((post) => (
            <Link key={post.id} href={`/community/${post.id}`} className="block bg-white rounded-lg shadow-sm border border-gray-200 hover:shadow-md transition-shadow duration-200">
              <div className="p-4 flex flex-col">
                <div className="mb-2">
                  <div className="flex items-center">
                    <h3 className="text-md font-semibold text-gray-800 truncate">@{post.username}</h3>
                    <span className="ml-auto text-sm text-gray-500">{formatDistanceToNow(new Date(post.date), { addSuffix: true, locale: enUS })}</span>
                  </div>
                  <h2 className="text-lg font-semibold text-teal-700 truncate mb-1">{post.title}</h2>
                  <p className="text-md text-gray-700 mb-2" style={{ whiteSpace: 'pre-line' }}>{post.body}</p>
                </div>
                {post.image && (
                  <div className="w-full rounded-md overflow-hidden shadow-sm mt-2" style={{ aspectRatio: '16/9' }}>
                    <img src={post.image} alt={post.title} className="w-full h-full object-fit: cover;" />
                  </div>
                )}
                <div className="flex justify-between items-center text-md mt-2">
                  <div className="flex items-center">
                    <SolidHeartIcon className="h-5 w-5 mr-1 text-red-500" />
                    <span>{post.likes}</span>
                    <SolidChatBubbleLeftIcon className="h-5 w-5 ml-2 mr-1 text-yellow-500" />
                    <span>{post.replies}</span>
                  </div>
                  <div className="overflow-hidden whitespace-nowrap text-md">
                    {post.tags.map((tag, index) => (
                      <span key={index} className="inline-block bg-blue-100 text-blue-700 rounded-full px-2 py-0.5 mr-1">
                        #{tag}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>

        {/* Loading Indicator */}
        <div ref={bottomRef} className="text-center text-gray-500 py-6 text-lg">
          {visiblePosts.length < filtered.length ? 'Loading more posts...' : 'No more posts'}
        </div>
      </div>
    </div>
  );
}