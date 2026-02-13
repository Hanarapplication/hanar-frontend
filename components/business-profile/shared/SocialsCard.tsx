'use client';

import { FaInstagram, FaFacebook, FaTiktok, FaTwitter } from 'react-icons/fa';
import { useBusinessProfileTheme } from '../theme/ThemeProvider';
import type { BusinessProfileData } from '../types';

function ensureExternalUrl(url: string | undefined | null): string {
  if (!url || typeof url !== 'string') return '#';
  const t = url.trim();
  if (!t) return '#';
  if (t.startsWith('http://') || t.startsWith('https://')) return t;
  return `https://${t}`;
}

interface SocialsCardProps {
  business: BusinessProfileData;
}

export function SocialsCard({ business }: SocialsCardProps) {
  const theme = useBusinessProfileTheme();
  const hasSocials = Boolean(
    business.instagram || business.facebook || business.tiktok || business.twitter
  );
  if (!hasSocials) return null;

  const linkClass =
    'inline-flex items-center gap-1.5 h-8 px-3 rounded-lg font-medium text-xs transition-all duration-200 shrink-0';

  return (
    <div
      className="rounded-2xl p-5 sm:p-6"
      style={{
        backgroundColor: theme.cardBg,
        border: `1px solid ${theme.border}`,
        borderRadius: theme.radius,
      }}
    >
      <div className="flex flex-wrap items-center justify-start gap-2">
        {business.instagram && (
          <a
            href={ensureExternalUrl(business.instagram)}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Instagram"
            className={linkClass}
            style={{ backgroundColor: theme.border, color: theme.text }}
          >
            <FaInstagram size={14} /> Instagram
          </a>
        )}
        {business.facebook && (
          <a
            href={ensureExternalUrl(business.facebook)}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Facebook"
            className={linkClass}
            style={{ backgroundColor: theme.border, color: theme.text }}
          >
            <FaFacebook size={14} /> Facebook
          </a>
        )}
        {business.tiktok && (
          <a
            href={ensureExternalUrl(business.tiktok)}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="TikTok"
            className={linkClass}
            style={{ backgroundColor: theme.border, color: theme.text }}
          >
            <FaTiktok size={14} /> TikTok
          </a>
        )}
        {business.twitter && (
          <a
            href={ensureExternalUrl(business.twitter)}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="X"
            className={linkClass}
            style={{ backgroundColor: theme.border, color: theme.text }}
          >
            <FaTwitter size={14} /> X
          </a>
        )}
      </div>
    </div>
  );
}
