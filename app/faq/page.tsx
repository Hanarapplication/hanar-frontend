'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import {
  Search,
  ChevronDown,
  HelpCircle,
  Store,
  ShoppingBag,
  Users,
  Building2,
  Shield,
  Bell,
  Heart,
  Globe,
  ThumbsUp,
} from 'lucide-react';

type FaqItem = { q: string; a: string };

const categories: { key: string; label: string; icon: React.ReactNode; items: FaqItem[] }[] = [
  {
    key: 'getting-started',
    label: 'Getting Started',
    icon: <HelpCircle className="h-4 w-4" />,
    items: [
      {
        q: 'What is Hanar?',
        a: 'Hanar is a community platform that connects immigrant businesses, organizations, and individuals. You can discover local businesses, buy and sell items on the marketplace, join community discussions, and follow organizations — all in one place.',
      },
      {
        q: 'How do I create an account?',
        a: 'Tap "Register" from the login page and choose your account type: Individual, Business, or Organization. Fill in your details and you\'re all set. Business and Organization accounts require admin approval before they go live.',
      },
      {
        q: 'What types of accounts are available?',
        a: 'There are three account types: Individual (for personal use, selling items, and community posts), Business (for listing your business, retail items, car dealership inventory, and promotions), and Organization (for nonprofits, community groups, and mosques to share updates and connect with followers).',
      },
      {
        q: 'Is Hanar free to use?',
        a: 'Yes! Creating an account and browsing is completely free. Businesses can choose from Free, Starter, Growth, or Premium plans depending on the features they need. Individuals and Organizations use Hanar at no cost.',
      },
      {
        q: 'Can I use Hanar outside the United States?',
        a: 'Yes, Hanar is accessible worldwide. However, location-based features like nearby businesses, marketplace distance filters, and area blast notifications work best when you share your location.',
      },
      {
        q: 'How do I change the app language?',
        a: 'Open the side menu and use the language dropdown at the bottom. Hanar supports 40+ languages including Arabic, Farsi, Pashto, Urdu, Turkish, Kurdish, Somali, and many more. Your preference is saved to your account.',
      },
      {
        q: 'Is there a mobile app?',
        a: 'Hanar works as a progressive web app (PWA) you can add to your home screen for an app-like experience. Native iOS and Android apps are coming soon.',
      },
      {
        q: 'How do I enable dark mode?',
        a: 'Go to Settings and toggle the Dark Mode switch. Your preference is saved and applied across all pages instantly.',
      },
    ],
  },
  {
    key: 'businesses',
    label: 'Businesses',
    icon: <Store className="h-4 w-4" />,
    items: [
      {
        q: 'How do I register my business on Hanar?',
        a: 'Business accounts are created through the admin panel. Contact us or reach out to the Hanar team, and we\'ll set up your business profile. Once approved, you\'ll have access to your Business Dashboard.',
      },
      {
        q: 'What business plans are available?',
        a: 'Hanar offers four plans: Free (basic listing), Starter (more gallery images and retail items), Growth (notifications to followers, more items), and Premium (full analytics, area blasts, unlimited items, and a free 3-month trial). You can upgrade or change your plan anytime from your dashboard.',
      },
      {
        q: 'How do I edit my business profile?',
        a: 'From your Business Dashboard, tap the menu and select "Edit Business." You can update your name, logo, address, phone, hours, gallery images, social links, spoken languages, and more.',
      },
      {
        q: 'What is the difference between retail items and car listings?',
        a: 'Retail items are general products your business sells (clothing, electronics, food, etc.). Car listings are specifically for dealerships to list vehicles with make, model, year, and VIN details. Both appear in the marketplace.',
      },
      {
        q: 'How do notifications to followers work?',
        a: 'From your dashboard, use the "Send Notification" section to compose a message. On Starter and above plans, you can notify users who follow your business. Your plan determines how many you can send per day and per week.',
      },
      {
        q: 'What are area blasts?',
        a: 'Area blasts let you send push notifications to all Hanar users within a certain radius of your business location. Available on Growth and Premium plans. The radius and approval requirements depend on your plan.',
      },
      {
        q: 'How do I promote my business with banners?',
        a: 'Go to your Business Dashboard and tap "Promote your business." You can create banner ads that appear in the home feed or community pages. Choose your placement, upload an image, set a link, and select your campaign duration and tier.',
      },
      {
        q: 'How do I view my business analytics?',
        a: 'Tap "Insights" on your Business Dashboard. Premium plan users see full analytics: profile views, retail item views, car listing views, ad banner performance, and notification delivery stats. Other plans see ad banner views if applicable.',
      },
      {
        q: 'What does "Hanar Verified" mean on marketplace items?',
        a: 'Items listed by businesses on Hanar display a "Hanar Verified" badge, indicating they come from a registered and approved business on the platform. This helps buyers trust the seller.',
      },
      {
        q: 'How does business approval work?',
        a: 'After your business is created, it enters an "On Hold" moderation status. The Hanar admin team reviews your listing for accuracy and compliance. Once approved, your business becomes visible to all users. You\'ll be notified of the decision.',
      },
    ],
  },
  {
    key: 'marketplace',
    label: 'Marketplace',
    icon: <ShoppingBag className="h-4 w-4" />,
    items: [
      {
        q: 'How do I sell an item on the marketplace?',
        a: 'If you have an Individual account, go to your Dashboard or tap "Sell Item." Upload photos, enter a title, price, description, condition, and location. Individuals can list 1 item at a time (delete it to post a new one).',
      },
      {
        q: 'Can businesses sell items on the marketplace?',
        a: 'Yes! Businesses can list retail items and car dealership inventory directly from their business editor. The number of items depends on your plan — Premium allows unlimited listings.',
      },
      {
        q: 'How do I search for items?',
        a: 'Use the search bar at the top of the Marketplace page. Hanar supports smart search with synonyms (e.g., searching "car" also finds "vehicle," "auto," "sedan"). You can also filter by price range, distance, and sort by newest, price, or distance.',
      },
      {
        q: 'How does the distance filter work?',
        a: 'If you share your location, marketplace items are sorted by proximity. You can adjust the radius slider to show items within a specific distance. Items without location data appear at the end of results.',
      },
      {
        q: 'How do I favorite an item?',
        a: 'Tap the heart icon on any marketplace listing. Favorited items are saved to your dashboard under "Favorite Items" so you can easily find them later.',
      },
      {
        q: 'How do I delete my listing?',
        a: 'Go to your Dashboard and find your active listing under "Items for Sale." Tap "Delete listing" and confirm. Once deleted, you can post a new item.',
      },
      {
        q: 'What item conditions are available?',
        a: 'When listing an item, you can mark it as New, Like New, Good, Fair, or Used. This helps buyers understand what to expect.',
      },
      {
        q: 'Are recent searches saved?',
        a: 'Yes, your marketplace searches are saved locally and synced to your account when logged in. You\'ll see them as suggestions when you tap the search bar. You can clear individual searches or all of them.',
      },
      {
        q: 'How are marketplace items ranked in search results?',
        a: 'Items from businesses with higher-tier plans (Premium, Growth) appear first, followed by Starter, Free, and individual listings. Within each tier, items are sorted by your chosen sort option (newest, price, distance).',
      },
      {
        q: 'How do I contact a seller?',
        a: 'On the item detail page, you\'ll find the seller\'s contact information including phone number and a link to their business profile (for business items). For individual sellers, you can view their profile.',
      },
    ],
  },
  {
    key: 'community',
    label: 'Community',
    icon: <Users className="h-4 w-4" />,
    items: [
      {
        q: 'How do I create a community post?',
        a: 'Tap "Post to Community" from your Dashboard or the Community page. Write a title and body (with bold, italic, and underline formatting), optionally add an image and tags, then publish. Organizations can post under their org name.',
      },
      {
        q: 'Can I edit or delete my post?',
        a: 'You can delete your own posts from the Community page or your Dashboard. Editing is not currently available — you can delete and repost if needed.',
      },
      {
        q: 'How do likes and comments work?',
        a: 'Tap the heart icon to like a post or comment. You can comment on any post by expanding the comments section. You can also like individual comments and delete your own comments.',
      },
      {
        q: 'How do I report inappropriate content?',
        a: 'On any community post, tap the report button and submit a brief reason. The Hanar moderation team will review the report and take action if the content violates community guidelines.',
      },
      {
        q: 'Can I sort community posts?',
        a: 'Yes, you can sort by "Latest" (newest first) or "Popular" (most liked). You can also filter by language and search by keywords.',
      },
      {
        q: 'Who can post in the community?',
        a: 'Individuals and Organizations can create community posts. Business accounts can comment on and like posts but cannot create new community posts.',
      },
      {
        q: 'How do I share a community post?',
        a: 'Tap the share icon on any post. If your device supports it, the native share sheet will appear so you can share via messaging apps, social media, or copy the link.',
      },
    ],
  },
  {
    key: 'organizations',
    label: 'Organizations',
    icon: <Building2 className="h-4 w-4" />,
    items: [
      {
        q: 'What is an Organization account?',
        a: 'Organization accounts are designed for nonprofits, community groups, mosques, churches, and similar entities. They get a dedicated dashboard, public profile page, community posting as the org, and the ability to send notifications to followers.',
      },
      {
        q: 'How do I set up my organization profile?',
        a: 'From your Organization Dashboard, edit your profile to add a banner image, logo, mission statement, address, phone, WhatsApp, email, and social links (Instagram, Facebook, website). These details appear on your public profile.',
      },
      {
        q: 'How do I send notifications to my followers?',
        a: 'From your Organization Dashboard, tap "Send Notification to Members." Enter a title and message, then send. The notification reaches all users who follow your organization via push notification.',
      },
      {
        q: 'How do people follow my organization?',
        a: 'Users can visit your organization\'s public profile page and tap the "Follow" button. Followers receive your notifications and see your posts more prominently.',
      },
      {
        q: 'Can organizations sell items on the marketplace?',
        a: 'Organization accounts are focused on community engagement and do not have marketplace selling features. If your organization also operates a business, you may want a separate Business account.',
      },
    ],
  },
  {
    key: 'account',
    label: 'Account & Privacy',
    icon: <Shield className="h-4 w-4" />,
    items: [
      {
        q: 'How do I reset my password?',
        a: 'On the login page, tap "Forgot password?" and enter your email. You\'ll receive a reset link to create a new password.',
      },
      {
        q: 'How do I update my profile picture?',
        a: 'Go to your Dashboard and tap the camera icon on your profile photo. Select a new image from your device — it will be compressed and uploaded automatically.',
      },
      {
        q: 'How do I delete my account?',
        a: 'Go to Settings and scroll to the "Delete My Account" section. Select a reason, confirm your decision, and your account will be permanently deleted along with all associated data.',
      },
      {
        q: 'How do I manage my favorites?',
        a: 'From your Dashboard, open the menu to access your Favorite Businesses, Favorite Items, and Following Organizations. You can remove any favorite by tapping the heart or remove button.',
      },
      {
        q: 'How does location sharing work?',
        a: 'When you first visit Hanar, you\'ll be asked to share your location. This powers distance-based features for businesses, marketplace items, and area blast notifications. You can update your location anytime by tapping the location icon in the top navigation bar.',
      },
      {
        q: 'How do push notifications work?',
        a: 'Enable push notifications in Settings. Once enabled, you\'ll receive alerts for business updates you follow, organization announcements, area blasts near you, and other important updates — even when the app is closed.',
      },
      {
        q: 'Can I favorite businesses?',
        a: 'Yes! Visit any business profile and tap the heart icon to add it to your favorites. Access all your favorited businesses from your Dashboard.',
      },
      {
        q: 'Is my data private?',
        a: 'Hanar takes your privacy seriously. Your location data is used only for distance calculations and area-based features. We never share personal data with third parties. You can review our full Privacy Policy for details.',
      },
    ],
  },
  {
    key: 'notifications',
    label: 'Notifications',
    icon: <Bell className="h-4 w-4" />,
    items: [
      {
        q: 'What types of notifications will I receive?',
        a: 'You may receive: business updates from businesses you follow, organization announcements, area blast promotions from nearby businesses, and system notifications. You control what you receive through your notification settings.',
      },
      {
        q: 'How do I turn off notifications?',
        a: 'Go to Settings and toggle off the Push Notifications switch. This stops all push notifications from Hanar. You can re-enable them anytime.',
      },
    ],
  },
];

const allItems = categories.flatMap((cat) =>
  cat.items.map((item) => ({ ...item, category: cat.key }))
);

export default function FaqPage() {
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [openId, setOpenId] = useState<string | null>(null);
  const [helpful, setHelpful] = useState<Record<string, boolean>>({});

  const filtered = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    let list =
      activeCategory === 'all'
        ? allItems
        : allItems.filter((i) => i.category === activeCategory);
    if (q) {
      list = list.filter(
        (i) => i.q.toLowerCase().includes(q) || i.a.toLowerCase().includes(q)
      );
    }
    return list;
  }, [activeCategory, searchQuery]);

  const toggle = (id: string) => setOpenId(openId === id ? null : id);

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-950 pt-4 pb-16">
      {/* Header */}
      <div className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 px-4 py-8 mb-4">
        <div className="max-w-2xl mx-auto text-center">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            Help Center
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Find answers to common questions about Hanar
          </p>

          {/* Search */}
          <div className="mt-5 relative max-w-lg mx-auto">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4.5 w-4.5 text-gray-400 dark:text-gray-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setOpenId(null);
              }}
              placeholder="Search questions..."
              className="w-full rounded-full border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 pl-10 pr-4 py-2.5 text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 dark:focus:ring-blue-900 transition"
            />
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4">
        {/* Category pills */}
        <div className="flex gap-2 overflow-x-auto pb-3 mb-4 scrollbar-hide -mx-4 px-4">
          <button
            onClick={() => {
              setActiveCategory('all');
              setOpenId(null);
            }}
            className={`shrink-0 flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-medium transition ${
              activeCategory === 'all'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-750'
            }`}
          >
            <Globe className="h-3.5 w-3.5" />
            All
          </button>
          {categories.map((cat) => (
            <button
              key={cat.key}
              onClick={() => {
                setActiveCategory(cat.key);
                setOpenId(null);
              }}
              className={`shrink-0 flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-medium transition ${
                activeCategory === cat.key
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-750'
              }`}
            >
              {cat.icon}
              {cat.label}
            </button>
          ))}
        </div>

        {/* Results count */}
        {searchQuery && (
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
            {filtered.length} result{filtered.length !== 1 ? 's' : ''} found
          </p>
        )}

        {/* FAQ cards */}
        <div className="space-y-2">
          {filtered.length === 0 ? (
            <div className="rounded-xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 p-8 text-center">
              <HelpCircle className="h-10 w-10 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
              <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                No matching questions found
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Try a different search term or{' '}
                <Link href="/contact" className="text-blue-600 dark:text-blue-400 hover:underline">
                  contact us
                </Link>{' '}
                for help.
              </p>
            </div>
          ) : (
            filtered.map((item, idx) => {
              const id = `${item.category}-${idx}`;
              const isOpen = openId === id;
              const isHelpful = helpful[id];

              return (
                <div
                  key={id}
                  className={`rounded-xl bg-white dark:bg-gray-900 border transition-all ${
                    isOpen
                      ? 'border-blue-200 dark:border-blue-800 shadow-sm'
                      : 'border-gray-200 dark:border-gray-800 hover:border-gray-300 dark:hover:border-gray-700'
                  }`}
                >
                  <button
                    onClick={() => toggle(id)}
                    className="w-full flex items-start gap-3 px-4 py-3.5 text-left"
                  >
                    <div
                      className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                        isOpen
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400'
                      }`}
                    >
                      Q
                    </div>
                    <span className="flex-1 text-sm font-semibold text-gray-900 dark:text-gray-100 leading-snug">
                      {item.q}
                    </span>
                    <ChevronDown
                      className={`h-4.5 w-4.5 shrink-0 text-gray-400 dark:text-gray-500 transition-transform duration-200 mt-0.5 ${
                        isOpen ? 'rotate-180' : ''
                      }`}
                    />
                  </button>

                  {isOpen && (
                    <div className="px-4 pb-4">
                      <div className="ml-9 border-t border-gray-100 dark:border-gray-800 pt-3">
                        <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed">
                          {item.a}
                        </p>

                        {/* Helpful feedback */}
                        <div className="mt-3 flex items-center gap-3">
                          {isHelpful === undefined ? (
                            <>
                              <span className="text-xs text-gray-400 dark:text-gray-500">
                                Was this helpful?
                              </span>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setHelpful((h) => ({ ...h, [id]: true }));
                                }}
                                className="flex items-center gap-1 rounded-full border border-gray-200 dark:border-gray-700 px-2.5 py-1 text-xs text-gray-500 dark:text-gray-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 hover:text-blue-600 dark:hover:text-blue-400 hover:border-blue-200 dark:hover:border-blue-800 transition"
                              >
                                <ThumbsUp className="h-3 w-3" />
                                Yes
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setHelpful((h) => ({ ...h, [id]: false }));
                                }}
                                className="flex items-center gap-1 rounded-full border border-gray-200 dark:border-gray-700 px-2.5 py-1 text-xs text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 transition"
                              >
                                No
                              </button>
                            </>
                          ) : isHelpful ? (
                            <span className="flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400">
                              <ThumbsUp className="h-3 w-3" />
                              Thanks for your feedback!
                            </span>
                          ) : (
                            <span className="text-xs text-gray-400 dark:text-gray-500">
                              Thanks for letting us know.{' '}
                              <Link
                                href="/contact"
                                className="text-blue-600 dark:text-blue-400 hover:underline"
                              >
                                Contact us
                              </Link>{' '}
                              for more help.
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Still need help */}
        <div className="mt-8 rounded-xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 p-6 text-center">
          <Heart className="h-8 w-8 text-blue-500 mx-auto mb-2" />
          <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
            Still have questions?
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 mb-4">
            Our team is here to help. Reach out and we&apos;ll get back to you as soon as possible.
          </p>
          <Link
            href="/contact"
            className="inline-flex items-center gap-2 rounded-full bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-500 transition"
          >
            Contact Us
          </Link>
        </div>
      </div>
    </div>
  );
}
