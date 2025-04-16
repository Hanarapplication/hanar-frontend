'use client';

import { useState } from 'react';
import Link from 'next/link';

const faqData = {
  General: [
    {
      question: 'How do I change the site language?',
      answer: 'Use the language selector at the top of the page to switch to your preferred language.',
    },
    {
      question: 'Is there a mobile app?',
      answer: 'A WebView app is coming soon to iOS and Android. Stay tuned!',
    },
    {
      question: 'Can I use Hanar outside the U.S.?',
      answer: 'Yes, Hanar is available worldwide. Location-based features may vary by region.',
    },
  ],
  Business: [
    {
      question: 'How do I register my business on Hanar?',
      answer: 'Click on Register > Businesses. Fill out your business information and submit your listing.',
    },
    {
      question: 'Is it free to list my business?',
      answer: 'Basic listings are free. You can upgrade to a premium plan for more visibility and features.',
    },
    {
      question: 'How can I edit or delete my post?',
      answer: 'Log in, go to your dashboard, find your post, and click Edit or Delete.',
    },
  ],
  Marketplace: [
    {
      question: 'How can I add items to the marketplace?',
      answer: 'Log in to your account and click on Marketplace > Add Item. Fill out the product info and images.',
    },
    {
      question: 'What is the 50-mile radius feature?',
      answer: 'Hanar shows businesses within 50 miles of your location by default to improve relevance.',
    },
    {
      question: 'How do I report an inappropriate listing?',
      answer: 'Click on the Report button below the listing and submit a short reason.',
    },
  ],
  Community: [
    {
      question: 'Can I chat with a business owner?',
      answer: 'Yes! On a business profile, use the chat icon to start messaging directly.',
    },
  ],
};

export default function HelpPage() {
  const [activeTab, setActiveTab] = useState<keyof typeof faqData>('General');
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  const toggle = (index: number): void => {
    setOpenIndex(openIndex === index ? null : index);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-blue-100 p-4 md:p-8 relative">
      <h1 className="text-3xl font-bold mb-6 text-center text-[#a93226]">Help Center / FAQs</h1>

      {/* Tabs */}
      <div className="flex justify-center mb-6 flex-wrap gap-2">
        {Object.keys(faqData).map((tab) => (
          <button
            key={tab}
            onClick={() => {
              setActiveTab(tab as keyof typeof faqData);
              setOpenIndex(null);
            }}
            className={`px-4 py-1 rounded-full font-medium text-sm transition border ${
              activeTab === tab
                ? 'bg-[#a93226] text-white border-[#a93226]'
                : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-100'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Questions */}
      <div className="max-w-3xl mx-auto space-y-4">
        {faqData[activeTab].map((faq, index) => (
          <div
            key={index}
            className="bg-white rounded-xl shadow-md px-5 py-4 transition border border-gray-200 hover:shadow-lg"
          >
            <button
              onClick={() => toggle(index)}
              className="w-full flex justify-between items-center text-left text-lg font-medium text-indigo-800"
            >
              <span>{faq.question}</span>
              <span className="text-xl">{openIndex === index ? '−' : '+'}</span>
            </button>
            {openIndex === index && (
              <p className="mt-3 text-sm text-gray-700 leading-relaxed">{faq.answer}</p>
            )}
          </div>
        ))}
      </div>

      {/* Contact Us */}
      <div className="mt-10 text-center">
        <p className="text-sm text-gray-600 mb-2">Still need help?</p>
        <Link
          href="/contact"
          className="inline-block bg-blue-600 text-white px-5 py-2 rounded-md hover:bg-blue-700 transition"
        >
          Contact Us
        </Link>
      </div>

      {/* HanarAI Bubble */}
      <div className="fixed bottom-5 right-4 sm:right-8 z-50">
      <button
  onClick={() => alert('HanarAI coming soon!')}
  className="flex items-center gap-2 bg-blue-600 text-white px-3 py-2 rounded-full shadow-md hover:shadow-lg hover:bg-blue-700 transition"
>
  <img src="hanar-logo.png" alt="Hanar logo" className="w-6 h-6 rounded-full" />
  <span className="text-sm font-medium">Ask HanarAI</span>
</button>

      </div>
    </div>
  );
}
