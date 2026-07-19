'use client';

import { Phone, Mail, Globe, Share2 } from 'lucide-react';
import { ContactHrefLink } from '@/components/ContactHrefLink';
import { buildMailtoHref, buildTelHref } from '@/lib/openContactUrl';
import { WhatsAppIcon } from '@/components/icons/WhatsAppIcon';
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
        <ContactHrefLink
          href={buildTelHref(business.phone)}
          ariaLabel="Call"
          className={iconClass + ' bg-green-50 text-green-600 hover:bg-green-500 hover:text-white'}
        >
          <Phone size={20} strokeWidth={2} />
        </ContactHrefLink>
      )}
      {business.whatsapp && (
        <a
          href={`https://wa.me/${business.whatsapp}`}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="WhatsApp"
          className={iconClass}
          style={{
            backgroundColor: `${theme.primary}20`,
            color: theme.primary,
          }}
        >
          <WhatsAppIcon className="h-5 w-5" strokeWidth={2.25} />
        </a>
      )}
      {business.email && (
        <ContactHrefLink
          href={buildMailtoHref(business.email)}
          ariaLabel="Email"
          className={iconClass + ' bg-rose-50 text-rose-600 hover:bg-rose-500 hover:text-white'}
        >
          <Mail size={20} strokeWidth={2} />
        </ContactHrefLink>
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
