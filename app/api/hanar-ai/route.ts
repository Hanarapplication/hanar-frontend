import { NextResponse } from 'next/server';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(req: Request) {
  try {
    const { messages, location } = await req.json();

    if (!messages || !Array.isArray(messages)) {
      return NextResponse.json(
        { error: 'Invalid message format' },
        { status: 400 }
      );
    }

    // 🌍 Add location to system message if available
    const locationContext = location ? `The user is currently in ${location}.` : '';
    const systemMessage = {
      role: 'system',
      content: `
You are HanarAI – an assistant for immigrants. ${locationContext}

✅ You only help with:
- Immigration, visas, green cards, work permits, asylum
- Hanar platform help: register businesses, post/browse items
- Finding immigrant-owned businesses or services
- Cultural food recipes
- Renting homes or finding roommates
- Education abroad (student visas, schools)
- Travel & tourism for newcomers

🌍 Detect and reply in the user's language.

⛔ Do NOT answer:
- Tech, programming, politics, religion, math, or entertainment

If someone asks off-topic, reply:
"I'm here to help with immigrant life, local services, and businesses. Try asking me about that!"
      `.trim(),
    };

    const trimmed = [systemMessage, ...messages].slice(-12); // max 12 messages incl. system

    const completion = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: trimmed,
      temperature: 0.7,
    });

    const reply = completion.choices[0].message.content;

    if (!reply) {
      return NextResponse.json(
        { error: 'HanarAI could not generate a reply. Please try again.' },
        { status: 500 }
      );
    }

    return NextResponse.json({ reply });
  } catch (error: any) {
    console.error('❌ GPT API Error:', JSON.stringify(error, null, 2));

    if (error?.response?.status === 401 || error?.code === 'invalid_api_key') {
      return NextResponse.json(
        { error: 'Invalid or missing OpenAI API key.' },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { error: 'HanarAI is having trouble answering right now. Please try again later.' },
      { status: 500 }
    );
  }
}
