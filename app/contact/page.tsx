'use client';

import { useState } from 'react';
import emailjs from 'emailjs-com'; // must be installed via npm
import Footer from '@/components/Footer';
import { useLanguage } from '@/context/LanguageContext';
import { t } from '@/utils/translations';

export default function ContactPage() {
  const { effectiveLang } = useLanguage();
  const [sent, setSent] = useState(false);
  const [form, setForm] = useState({
    name: '',
    email: '',
    subject: '',
    message: '',
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    emailjs.send(
      'your_service_id', // replace with your EmailJS service ID
      'your_template_id', // replace with your EmailJS template ID
      {
        from_name: form.name,
        from_email: form.email,
        subject: form.subject,
        message: form.message,
      },
      'your_user_id' // replace with your EmailJS public user key
    )
    .then(() => {
      setSent(true);
      setForm({ name: '', email: '', subject: '', message: '' });
      setTimeout(() => setSent(false), 4000);
    })
    .catch((err) => {
      console.error('Error sending email:', err);
      alert(t(effectiveLang, 'Failed to send message. Please try again.'));
    });
  };

  return (
    <>
      <div className="min-h-screen bg-gradient-to-br from-blue-100 to-blue-300 px-4 py-10 flex items-center justify-center">
        <div className="bg-white w-full max-w-2xl p-8 rounded-2xl shadow-2xl">
          <h1 className="text-3xl font-bold text-blue-600 text-center mb-6">
            {t(effectiveLang, 'Contact Us')}
          </h1>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-gray-700">{t(effectiveLang, 'Name')}</label>
              <input
                type="text"
                name="name"
                required
                value={form.name}
                onChange={handleChange}
                placeholder={t(effectiveLang, 'Your Name')}
                className="mt-1 w-full px-4 py-2 border rounded-md focus:ring-2 focus:ring-blue-400 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">{t(effectiveLang, 'Email')}</label>
              <input
                type="email"
                name="email"
                required
                value={form.email}
                onChange={handleChange}
                placeholder={t(effectiveLang, 'you@example.com')}
                className="mt-1 w-full px-4 py-2 border rounded-md focus:ring-2 focus:ring-blue-400 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">{t(effectiveLang, 'Subject')}</label>
              <input
                type="text"
                name="subject"
                required
                value={form.subject}
                onChange={handleChange}
                placeholder={t(effectiveLang, 'Subject')}
                className="mt-1 w-full px-4 py-2 border rounded-md focus:ring-2 focus:ring-blue-400 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">{t(effectiveLang, 'Message')}</label>
              <textarea
                name="message"
                required
                rows={5}
                value={form.message}
                onChange={handleChange}
                placeholder={t(effectiveLang, 'Type your message here...')}
                className="mt-1 w-full px-4 py-2 border rounded-md focus:ring-2 focus:ring-blue-400 focus:outline-none resize-none"
              ></textarea>
            </div>

            <button
              type="submit"
              className={`w-full py-2 rounded-md text-white font-semibold transition-transform duration-300 transform ${
                sent ? 'scale-95 bg-green-600' : 'bg-blue-600 hover:bg-blue-700'
              }`}
            >
              {sent ? t(effectiveLang, 'Message Sent!') : t(effectiveLang, 'Send Message')}
            </button>
          </form>

          {sent && (
            <p className="text-green-600 text-center mt-4 text-sm">
              {t(effectiveLang, "Message successfully sent. We'll get back to you shortly.")}
            </p>
          )}

          <p className="text-center text-sm text-gray-500 mt-6">
            {t(effectiveLang, 'Or email us directly at')}{' '}
            <a href="mailto:support@hanar.net" className="text-blue-600 hover:underline">
              support@hanar.net
            </a>
          </p>
        </div>
      </div>

      {/* ✅ Desktop-only Footer */}
      <Footer />
    </>
  );
}
