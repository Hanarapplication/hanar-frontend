'use client';

import { BusinessProfileThemeProvider } from './theme/ThemeProvider';
import { getProfileTemplate } from './templates';
import { PROFILE_TEMPLATES, PROFILE_THEMES } from './theme/tokens';
import type { ProfileTemplateId, ProfileThemeId } from './theme/tokens';
import type { BusinessProfileRendererProps } from './ProfileProps';

export type { BusinessProfileRendererProps };

const DEFAULT_TEMPLATE: ProfileTemplateId = 'brand';
const DEFAULT_THEME: ProfileThemeId = 'classic';

function normalizeTemplate(value: string | null | undefined): ProfileTemplateId {
  const v = (value ?? '').trim().toLowerCase();
  if (PROFILE_TEMPLATES.includes(v as ProfileTemplateId)) return v as ProfileTemplateId;
  return DEFAULT_TEMPLATE;
}

function normalizeTheme(value: string | null | undefined): ProfileThemeId {
  const v = (value ?? '').trim().toLowerCase();
  if (PROFILE_THEMES.includes(v as ProfileThemeId)) return v as ProfileThemeId;
  return DEFAULT_THEME;
}

export interface BusinessProfileRendererConfig {
  template: ProfileTemplateId;
  theme: ProfileThemeId;
  accentColor?: string | null;
}

interface BusinessProfileRendererWrapperProps extends BusinessProfileRendererProps {
  config: BusinessProfileRendererConfig;
}

export function BusinessProfileRenderer({ config, ...props }: BusinessProfileRendererWrapperProps) {
  const templateId = normalizeTemplate(config.template);
  const themeId = normalizeTheme(config.theme);
  const TemplateComponent = getProfileTemplate(templateId);

  return (
    <BusinessProfileThemeProvider
      themeId={themeId}
      accentColor={config.accentColor}
    >
      <div
        className="min-h-screen overflow-x-clip lg:max-w-5xl lg:mx-auto"
        style={{ backgroundColor: 'var(--bp-bg)' }}
      >
        <TemplateComponent {...props} />
      </div>
    </BusinessProfileThemeProvider>
  );
}
