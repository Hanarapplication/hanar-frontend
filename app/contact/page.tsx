'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Footer from '@/components/Footer';
import { useLanguage } from '@/context/LanguageContext';
import { t } from '@/utils/translations';
import toast from 'react-hot-toast';

function ContactFormInner() {
  const { effectiveLang } = useLanguage();
  const searchParams = useSearchParams();
  const isClaimMode = searchParams.get('mode') === 'claim';
  const businessId = searchParams.get('businessId') || '';
  const businessName = searchParams.get('businessName') || '';
  const businessSlug = searchParams.get('businessSlug') || '';
  const defaultSubject = searchParams.get('subject') || (isClaimMode ? 'Claim a business' : '');

  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
    subject: defaultSubject,
    message: '',
  });

  useEffect(() => {
    if (!isClaimMode) return;
    setForm((prev) => ({
      ...prev,
      subject: defaultSubject || 'Claim a business',
    }));
  }, [isClaimMode, defaultSubject]);

  const claimMessagePlaceholder =
    'Please describe your relationship to this business and how we can reach you.';

  const inputClass =
    'mt-1 w-full px-4 py-2 border rounded-md focus:ring-2 focus:ring-rose-400 focus:outline-none placeholder:text-gray-400';

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = {
      name: form.name.trim(),
      email: form.email.trim(),
      phone: form.phone.trim(),
      subject: form.subject.trim(),
      message: form.message.trim(),
    };
    if (!trimmed.name || !trimmed.email || !trimmed.subject || !trimmed.message) {
      toast.error(t(effectiveLang, 'Please fill in all required fields.'));
      return;
    }
    if (trimmed.message.length < 20) {
      toast.error('Please enter at least 20 characters in the message.');
      return;
    }
    if (isClaimMode && !trimmed.phone) {
      toast.error('Phone number is required.');
      return;
    }
    if (isClaimMode && trimmed.phone.replace(/\D/g, '').length < 10) {
      toast.error('Enter a valid phone number (at least 10 digits).');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...trimmed,
          businessId: businessId || undefined,
          businessName: businessName || undefined,
          businessSlug: businessSlug || undefined,
          source: isClaimMode ? 'business_claim' : 'contact',
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || t(effectiveLang, 'Failed to send message. Please try again.'));
        return;
      }
      setSent(true);
      setForm({ name: '', email: '', phone: '', subject: isClaimMode ? 'Claim a business' : '', message: '' });
      toast.success(data.message || t(effectiveLang, 'Message successfully sent. We\'ll get back to you shortly.'));
    } catch {
      toast.error(t(effectiveLang, 'Failed to send message. Please try again.'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <div className="min-h-screen bg-gradient-to-br from-rose-100 to-rose-300 px-4 py-10 flex items-center justify-center">
        <div className="bg-white w-full max-w-2xl p-8 rounded-2xl shadow-2xl">
          <h1 className="text-3xl font-bold text-rose-600 text-center mb-2">
            {isClaimMode ? t(effectiveLang, 'Claim a business') : t(effectiveLang, 'Contact Us')}
          </h1>
          {isClaimMode && businessName ? (
            <p className="text-center text-sm text-gray-600 mb-6" data-no-translate>
              Requesting ownership of <strong>{businessName}</strong>
            </p>
          ) : (
            <div className="mb-6" />
          )}

          {isClaimMode ? (
            <p className="mb-5 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              This listing has no email on file. Leave your phone number, email, and a description of your connection to
              the business. Our team will review and contact you before assigning ownership.
            </p>
          ) : null}

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
                className={inputClass}
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
                className={inputClass}
              />
            </div>

            {isClaimMode ? (
              <div>
                <label className="block text-sm font-medium text-gray-700">Phone number</label>
                <input
                  type="tel"
                  name="phone"
                  required
                  value={form.phone}
                  onChange={handleChange}
                  placeholder="+1 555 123 4567"
                  className={inputClass}
                />
              </div>
            ) : null}

            <div>
              <label className="block text-sm font-medium text-gray-700">{t(effectiveLang, 'Subject')}</label>
              <input
                type="text"
                name="subject"
                required
                value={form.subject}
                onChange={handleChange}
                placeholder={t(effectiveLang, 'Subject')}
                readOnly={isClaimMode}
                className={`${inputClass} read-only:bg-gray-50`}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">{t(effectiveLang, 'Message')}</label>
              <textarea
                name="message"
                required
                minLength={20}
                rows={5}
                value={form.message}
                onChange={handleChange}
                placeholder={
                  isClaimMode ? claimMessagePlaceholder : t(effectiveLang, 'Type your message here...')
                }
                className={`${inputClass} resize-none`}
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className={`w-full py-2 rounded-md text-white font-semibold transition-transform duration-300 transform disabled:opacity-60 ${
                sent ? 'scale-95 bg-green-600' : 'bg-rose-600 hover:bg-rose-700'
              }`}
            >
              {loading ? 'Sending…' : sent ? t(effectiveLang, 'Message Sent!') : t(effectiveLang, 'Send Message')}
            </button>
          </form>

          {sent && (
            <p className="text-green-600 text-center mt-4 text-sm">
              {t(effectiveLang, "Message successfully sent. We'll get back to you shortly.")}
            </p>
          )}

          <p className="text-center text-sm text-gray-500 mt-6">
            {t(effectiveLang, 'Or email us directly at')}{' '}
            <a href="mailto:support@hanar.net" className="text-rose-600 hover:underline">
              support@hanar.net
            </a>
          </p>
        </div>
      </div>
      <Footer />
    </>
  );
}

export default function ContactPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center">Loading…</div>}>
      <ContactFormInner />
    </Suspense>
  );
}
