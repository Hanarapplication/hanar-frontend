// hanarAiHandler.ts

import { NextResponse } from 'next/server';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Mock functions: Replace these with real database queries
async function searchBusinesses(query: string, location: string) {
  // Search your Business database (example mock)
  return [
    { name: 'Bolani House', address: '123 Elm St, Toronto', link: 'https://hanar.net/business/bolani-house' },
    { name: 'Sultan Bakery', address: '456 King St, Mississauga', link: 'https://hanar.net/business/sultan-bakery' },
    { name: 'Kurdish Grill', address: '789 Queen St, Toronto', link: 'https://hanar.net/business/kurdish-grill' },
  ];
}

async function searchMarketplaceItems(query: string, location: string) {
  // Search your Items database (example mock)
  return [
    { title: 'Toyota Corolla 2015', price: 9500, location: 'Dallas', link: 'https://hanar.net/item/toyota-corolla-2015' },
    { title: 'Honda Civic 2017', price: 10200, location: 'Plano', link: 'https://hanar.net/item/honda-civic-2017' },
    { title: 'Nissan Altima 2016', price: 8800, location: 'Frisco', link: 'https://hanar.net/item/nissan-altima-2016' },
  ];
}

async function searchCommunityPosts(query: string) {
  // Search your Community posts (example mock)
  return [
    { title: 'Where to find halal food in Dallas?', link: 'https://hanar.net/community/post/1001' },
    { title: 'Best cars under $10k for students?', link: 'https://hanar.net/community/post/1002' },
    { title: 'Affordable apartments in Plano?', link: 'https://hanar.net/community/post/1003' },
  ];
}

export async function POST(req: Request) {
  try {
    const { messages, location } = await req.json();

    if (!messages || !Array.isArray(messages)) {
      return NextResponse.json({ error: 'Invalid message format' }, { status: 400 });
    }

    const userMessage = messages[messages.length - 1]?.content.toLowerCase();
    const locationContext = location ? `The user is currently in ${location}.` : '';

    // --- Smart Matching ---
    let suggestionText = '';

    const businesses = await searchBusinesses(userMessage, location);
    if (businesses.length > 0) {
      suggestionText += `Here are some businesses you might like:\n`;
      businesses.slice(0, 3).forEach((biz, idx) => {
        suggestionText += `${idx + 1}. **${biz.name}** – ${biz.address} [View Business](${biz.link})\n`;
      });
    } else {
      const items = await searchMarketplaceItems(userMessage, location);
      if (items.length > 0) {
        suggestionText += `Here are some items matching your search:\n`;
        items.slice(0, 3).forEach((item, idx) => {
          suggestionText += `${idx + 1}. **${item.title}** – $${item.price} (${item.location}) [View Item](${item.link})\n`;
        });
      } else {
        const posts = await searchCommunityPosts(userMessage);
        if (posts.length > 0) {
          suggestionText += `Couldn't find a direct match, but here's what our community discussed:\n`;
          posts.slice(0, 3).forEach((post, idx) => {
            suggestionText += `${idx + 1}. [${post.title}](${post.link})\n`;
          });
        } else {
          suggestionText += `Sorry, no exact match found. 😔\nFeel free to [Post Your Question Here](https://hanar.net/community/new-post)!`;
        }
      }
    }

    // --- Final System Prompt ---
    const systemMessage = {
      role: 'system',
      content: `
You are HanarAI – an assistant for immigrants and Hanar.net users. ${locationContext}

✅ You help with:
- Immigration, visas, work permits, asylum
- Registering businesses, posting items, finding services
- Recommending Hanar-registered businesses and marketplace items
- Suggesting community posts if no direct matches found

RULES:
- If suggestionText is provided, show it FIRST before replying normally.
- Detect user's language automatically and reply in that language if possible.
- Be friendly, clear, short, and use occasional emojis (🍽️, 🏠, 🚗, etc.)

⛔ Do NOT answer questions about tech, politics, religion, math, entertainment.

${suggestionText}
      `.trim(),
    };

    const trimmed = [systemMessage, ...messages].slice(-12);

    const completion = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: trimmed,
      temperature: 0.7,
    });

    const reply = completion.choices[0].message.content;

    if (!reply) {
      return NextResponse.json({ error: 'HanarAI could not generate a reply. Please try again.' }, { status: 500 });
    }

    return NextResponse.json({ reply });

  } catch (error: any) {
    console.error('❌ GPT API Error:', JSON.stringify(error, null, 2));

    if (error?.response?.status === 401 || error?.code === 'invalid_api_key') {
      return NextResponse.json({ error: 'Invalid or missing OpenAI API key.' }, { status: 500 });
    }

    return NextResponse.json({ error: 'HanarAI is having trouble answering right now. Please try again later.' }, { status: 500 });
  }
}
