// ✅ HanarAIWidget.tsx (temporarily disabled)
// Keeps the file/imports stable, but renders nothing.

'use client';

import { useState, useEffect, useRef } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Image from 'next/image';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

// Toggle this back to true when you're ready to re-enable HanarAI.
const ENABLE_HANAR_AI_WIDGET = false;

export default function HanarAIWidget() {
  // ✅ Hard-disable (invisible) for now
  if (!ENABLE_HANAR_AI_WIDGET) return null;

  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([
    {
      from: 'ai',
      text: `Hi! I'm HanarAI – here to help with immigrant life, local services, food, housing, education, and more. 💼🍲🏡\n\n🗣️ You can ask me in your language – Arabic, Farsi, Kurdish, Turkish, Urdu, French, or any other!`,
    },
  ]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [lockoutUntil, setLockoutUntil] = useState<number | null>(null);
  const [location, setLocation] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const userMessages = messages.filter((m) => m.from === 'user');

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(async (pos) => {
        const { latitude, longitude } = pos.coords;
        try {
          const res = await fetch(
            `/api/geocode/reverse?lat=${encodeURIComponent(latitude)}&lon=${encodeURIComponent(longitude)}`
          );
          const data = await res.json();
          const city =
            data.address?.city ||
            data.address?.town ||
            data.address?.village ||
            data.address?.county ||
            'your area';
          setLocation(city);
        } catch {
          setLocation('your area');
        }
      });
    }
  }, []);

  const handleSend = () => {
    if (!input.trim()) return;
    if (lockoutUntil && Date.now() < lockoutUntil) return;
    const userMessage = input.trim();
    setMessages((prev) => [...prev, { from: 'user', text: userMessage }]);
    setInput('');
    sendToGPT(userMessage);
  };

  const sendToGPT = async (userMessage: string) => {
    setIsTyping(true);

    const systemPrompt = {
      role: 'system',
      content: `
You are HanarAI – an assistant for immigrants. Answer ONLY questions related to:
- Immigration, visas, housing, education, food, businesses, community services
- Do NOT answer questions about tech, celebrities, math, politics, religion, etc.
- Detect the user's language and reply in that language.
If the user asks unrelated topics, reply:
"I'm here to help with immigrant life and local services. Try asking me about that!"
      `.trim(),
    };

    const fullMessages = [
      systemPrompt,
      ...messages.map((m) => ({
        role: m.from === 'user' ? 'user' : 'assistant',
        content: m.text,
      })),
      { role: 'user', content: userMessage },
    ];

    const trimmed = fullMessages.slice(-11);

    try {
      const res = await fetch('/api/hanar-ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: trimmed, location }),
      });
      const data = await res.json();
      if (data.reply) {
        setMessages((prev) => [...prev, { from: 'ai', text: data.reply }]);

        if (userMessages.length + 1 >= 5 && !lockoutUntil) {
          const tenMinutes = 10 * 60 * 1000;
          setLockoutUntil(Date.now() + tenMinutes);

          setMessages((prev) => [
            ...prev,
            {
              from: 'ai',
              text: `⏳ You've reached the limit of 5 questions for now. Please ask your question in the Hanar Community.`,
            },
          ]);
        }
      } else {
        setMessages((prev) => [
          ...prev,
          { from: 'ai', text: 'Sorry, I didn’t quite get that. Try again?' },
        ]);
      }
    } catch (err) {
      console.error(err);
      setMessages((prev) => [
        ...prev,
        { from: 'ai', text: 'Sorry, I’m having trouble right now.' },
      ]);
    } finally {
      setIsTyping(false);
    }
  };

  const handleAskCommunity = () => {
    const lastUserMessage = userMessages.slice(-1)[0]?.text || '';
    router.push(`/community/post?question=${encodeURIComponent(lastUserMessage)}`);
  };

  const isLockedOut = lockoutUntil && Date.now() < lockoutUntil;

  return (
    <>
      <div
        className="fixed bottom-6 right-6 z-50 bg-transparent cursor-pointer transition transform hover:scale-105"
        onClick={() => setOpen(!open)}
      >
        <Image
          src="/hanar.logo.png"
          alt="HanarAI"
          width={50}
          height={50}
          className="rounded-full shadow-xl"
        />
      </div>

      {open && (
        <div className="fixed bottom-20 right-6 z-50 w-80 h-96 bg-white rounded-2xl shadow-2xl flex flex-col border border-gray-200">
          <div className="flex items-center justify-between p-3 font-bold bg-pink-100 rounded-t-2xl border-b border-gray-300">
            <span>HanarAI 💬</span>
            <button
              onClick={() => setOpen(false)}
              className="text-gray-600 hover:text-red-500 text-lg font-bold"
            >
              ×
            </button>
          </div>

          <div className="flex-1 p-3 overflow-y-auto text-sm space-y-2">
            {messages.map((msg, i) => (
              <div
                key={i}
                className={`p-2 rounded-lg whitespace-pre-wrap ${
                  msg.from === 'user' ? 'bg-teal-100 text-right' : 'bg-gray-100 text-left'
                }`}
              >
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {msg.text}
                </ReactMarkdown>
              </div>
            ))}
            {isTyping && (
              <div className="text-gray-400 italic text-sm">HanarAI is typing...</div>
            )}
            <div ref={scrollRef} />

            {isLockedOut && (
              <div className="pt-2 text-center">
                <button
                  onClick={handleAskCommunity}
                  className="mt-4 bg-blue-600 text-white px-4 py-2 rounded-xl hover:bg-blue-700 text-sm"
                >
                  🤝 Ask the Hanar Community
                </button>
              </div>
            )}
          </div>

          {!isLockedOut && (
            <div className="flex p-2 border-t border-gray-300 gap-2">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                className="flex-1 p-2 text-sm border rounded-lg"
                placeholder="Ask me anything..."
              />
              <button
                onClick={handleSend}
                className="bg-teal-500 hover:bg-teal-600 text-white px-3 py-1 rounded-lg text-sm"
              >
                Send
              </button>
            </div>
          )}
        </div>
      )}
    </>
  );
}
