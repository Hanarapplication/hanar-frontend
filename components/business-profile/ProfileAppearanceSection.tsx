'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Layout, Palette, Lock, Crown } from 'lucide-react';
import { PROFILE_TEMPLATES, PROFILE_THEMES, getThemeTokens } from './theme/tokens';
import type { ProfileTemplateId, ProfileThemeId } from './theme/tokens';
import { cn } from '@/lib/utils';

const TEMPLATE_LABELS: Record<ProfileTemplateId, string> = {
  brand: 'Brand',
  sell: 'Sell',
  prestige: 'Prestige',
  service: 'Service',
  simple: 'Simple',
};

const THEME_LABELS: Record<ProfileThemeId, string> = {
  classic: 'Classic',
  midnight: 'Midnight',
  sunset: 'Sunset',
  mint: 'Mint',
  rose: 'Rose',
  slate: 'Slate',
};

interface ProfileAppearanceSectionProps {
  isPremium: boolean;
  profileTemplate: string | null;
  theme: string | null;
  accentColor: string | null;
  onSave: (data: { profile_template?: string; theme?: string; accent_color?: string | null }) => Promise<void>;
  businessId: string;
}

export function ProfileAppearanceSection({
  isPremium,
  profileTemplate,
  theme,
  accentColor,
  onSave,
  businessId,
}: ProfileAppearanceSectionProps) {
  const [saving, setSaving] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<ProfileTemplateId>(
    (PROFILE_TEMPLATES.includes((profileTemplate ?? '') as ProfileTemplateId) ? profileTemplate : 'brand') as ProfileTemplateId
  );
  const [selectedTheme, setSelectedTheme] = useState<ProfileThemeId>(
    (PROFILE_THEMES.includes((theme ?? '') as ProfileThemeId) ? theme : 'classic') as ProfileThemeId
  );

  const handleTemplateSelect = async (id: ProfileTemplateId) => {
    if (!isPremium) return;
    setSelectedTemplate(id);
    setSaving(true);
    try {
      await onSave({ profile_template: id });
    } finally {
      setSaving(false);
    }
  };

  const handleThemeSelect = async (id: ProfileThemeId) => {
    if (!isPremium) return;
    setSelectedTheme(id);
    setSaving(true);
    try {
      await onSave({ theme: id });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800/50 p-4 sm:p-5 shadow-sm">
      <div className="flex items-center justify-between gap-2 mb-3">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
          <Palette className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
          Profile appearance
        </h3>
        {!isPremium && (
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-200 text-xs font-medium px-2 py-0.5">
            <Lock className="h-3 w-3" /> Premium
          </span>
        )}
      </div>

      {!isPremium && (
        <>
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
            Unlock template and theme options with Premium to customize your public profile.
          </p>
          <Link
            href="/business/plan"
            className="inline-flex items-center gap-2 rounded-lg bg-amber-500 hover:bg-amber-600 text-white text-sm font-medium px-3 py-2"
          >
            <Crown className="h-4 w-4" /> Upgrade to Premium
          </Link>
        </>
      )}

      <div className={cn(!isPremium && 'pointer-events-none opacity-60')}>
        <p className="text-xs font-medium text-gray-600 dark:text-gray-400 mt-4 mb-2 flex items-center gap-1">
          <Layout className="h-4 w-4" /> Template
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
          {PROFILE_TEMPLATES.map((id) => (
            <button
              key={id}
              type="button"
              onClick={() => handleTemplateSelect(id)}
              disabled={!isPremium || saving}
              className={cn(
                'rounded-lg border-2 p-3 text-center text-xs font-medium transition-colors',
                selectedTemplate === id
                  ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-200'
                  : 'border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:border-gray-300'
              )}
            >
              {TEMPLATE_LABELS[id]}
            </button>
          ))}
        </div>

        <p className="text-xs font-medium text-gray-600 dark:text-gray-400 mt-4 mb-2">Theme</p>
        <div className="flex flex-wrap gap-2">
          {PROFILE_THEMES.map((id) => {
            const tokens = getThemeTokens(id);
            return (
              <button
                key={id}
                type="button"
                onClick={() => handleThemeSelect(id)}
                disabled={!isPremium || saving}
                title={THEME_LABELS[id]}
                className={cn(
                  'w-10 h-10 rounded-lg border-2 transition-all',
                  selectedTheme === id ? 'border-indigo-500 ring-2 ring-indigo-200 dark:ring-indigo-800 scale-105' : 'border-gray-200 dark:border-gray-600'
                )}
                style={{ backgroundColor: tokens.primary }}
              />
            );
          })}
        </div>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
          {THEME_LABELS[selectedTheme]}
        </p>
      </div>
    </div>
  );
}
