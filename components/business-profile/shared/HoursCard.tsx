'use client';

import { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { useBusinessProfileTheme } from '../theme/ThemeProvider';
import type { BusinessProfileData } from '../types';

function parseHours(hours: BusinessProfileData['hours']): Record<string, string> | null {
  if (!hours) return null;
  if (typeof hours === 'object' && hours !== null) return hours as Record<string, string>;
  if (typeof hours === 'string') {
    try {
      const p = JSON.parse(hours);
      return p && typeof p === 'object' ? p : null;
    } catch {
      return null;
    }
  }
  return null;
}

interface HoursCardProps {
  business: BusinessProfileData;
}

export function HoursCard({ business }: HoursCardProps) {
  const theme = useBusinessProfileTheme();
  const [showAll, setShowAll] = useState(false);

  const normalized = parseHours(business.hours);
  const fallbackText =
    typeof business.hours === 'string' && !normalized ? business.hours : null;
  const todayKey = new Date().toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
  const todayHours = normalized?.[todayKey] ?? fallbackText ?? 'Closed';
  const entries = normalized ? Object.entries(normalized) : [];
  const hasHours = entries.length > 0 || Boolean(fallbackText);

  if (!hasHours) return null;

  return (
    <div
      className="rounded-xl shadow-md overflow-hidden"
      style={{
        backgroundColor: theme.cardBg,
        boxShadow: theme.shadow,
        borderRadius: theme.radius,
      }}
    >
      <div className="p-4 sm:p-6">
        <div
          className="flex items-center justify-between gap-3 rounded-none px-3 py-2"
          style={{ backgroundColor: theme.border }}
        >
          <div className="flex items-center gap-2 text-xs font-medium" style={{ color: theme.text }}>
            <span className="h-2 w-2 rounded-full bg-emerald-500 shrink-0" />
            Today: <span className="font-semibold">{todayHours}</span>
          </div>
          <button
            type="button"
            onClick={() => setShowAll((p) => !p)}
            aria-label={showAll ? 'Hide hours' : 'View all hours'}
            className="p-1.5 rounded-none flex items-center justify-center transition-colors"
            style={{
              backgroundColor: theme.primary,
              color: theme.primaryText,
            }}
          >
            {showAll ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
          </button>
        </div>
        {showAll && (
          <div
            className="mt-3 rounded-lg overflow-hidden border divide-y"
            style={{
              backgroundColor: theme.background,
              borderColor: theme.border,
            }}
          >
            {normalized ? (
              entries.map(([day, hours]) => {
                const isToday = day.toLowerCase() === todayKey;
                return (
                  <div
                    key={day}
                    className="flex items-center justify-between px-3 py-2 text-sm"
                    style={{
                      color: theme.text,
                      ...(isToday ? { backgroundColor: `${theme.primary}15` } : {}),
                    }}
                  >
                    <span className="capitalize font-medium">{day}</span>
                    <span className={isToday ? 'font-semibold' : ''} style={{ color: theme.mutedText }}>
                      {hours || 'Closed'}
                    </span>
                  </div>
                );
              })
            ) : fallbackText ? (
              <div className="px-3 py-2 text-sm" style={{ color: theme.mutedText }}>
                {fallbackText}
              </div>
            ) : (
              <div className="px-3 py-2 text-sm italic" style={{ color: theme.mutedText }}>
                Hours not provided
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
