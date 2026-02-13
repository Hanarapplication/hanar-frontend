'use client';

import { Phone, Mail, Globe, Share2 } from 'lucide-react';
import { SiWhatsapp } from 'react-icons/si';
import ReportButton from '@/components/ReportButton';
import { useBusinessProfileTheme } from '../theme/ThemeProvider';
import type { BusinessProfileData } from '../types';

function ensureExternalUrl(url: string | undefined | null): string {
  if (!url || typeof url !== 'string') return '#';
  const t = url.trim();
  if (!t) return '#';
  if (t.startsWith('http://') || t.startsWith('https://')) return t;
  return `https://${t}`;
}

interface ActionIconRowProps {
  business: BusinessProfileData;
  onShare: () => void;
}

export function ActionIconRow({ business, onShare }: ActionIconRowProps) {
  const theme = useBusinessProfileTheme();

  const iconClass = 'flex items-center justify-center h-10 w-10 rounded-none transition-colors duration-200 flex-shrink-0';

  return (
    <div
      className="flex flex-wrap items-center justify-center gap-2 px-4 py-3 border-t"
      style={{
        backgroundColor: theme.cardBg,
        borderColor: theme.border,
      }}
    >
      {business.phone && (
        <a
          href={`tel:${business.phone}`}
          aria-label="Call"
          className={iconClass + ' bg-green-50 text-green-600 hover:bg-green-500 hover:text-white'}
        >
          <Phone size={20} strokeWidth={2} />
        </a>
      )}
      {business.whatsapp && (
        <a
          href={`https://wa.me/${business.whatsapp}`}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="WhatsApp"
          className={iconClass + ' bg-[#E8F5E9] text-[#25D366] hover:bg-[#25D366] hover:text-white'}
        >
          <SiWhatsapp size={22} />
        </a>
      )}
      {business.email && (
        <a
          href={`mailto:${business.email}`}
          aria-label="Email"
          className={iconClass + ' bg-rose-50 text-rose-600 hover:bg-rose-500 hover:text-white'}
        >
          <Mail size={20} strokeWidth={2} />
        </a>
      )}
      {business.website && (
        <a
          href={ensureExternalUrl(business.website)}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Website"
          className={iconClass}
          style={{
            backgroundColor: `${theme.primary}20`,
            color: theme.primary,
          }}
        >
          <Globe size={20} strokeWidth={2} />
        </a>
      )}
      <button
        type="button"
        onClick={onShare}
        aria-label="Share"
        className={iconClass}
        style={{
          backgroundColor: `${theme.primary}20`,
          color: theme.primary,
        }}
      >
        <Share2 size={20} strokeWidth={2} />
      </button>
      <ReportButton
        entityType="business"
        entityId={business.id}
        entityTitle={business.business_name}
        variant="icon"
        className={iconClass + ' bg-slate-100 text-slate-500 hover:bg-red-100 hover:text-red-500'}
      />
    </div>
  );
}
