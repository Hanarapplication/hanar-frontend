'use client';

import { useBusinessProfileTheme } from '../theme/ThemeProvider';

interface ReviewsSectionProps {
  /** Placeholder for future reviews data */
  businessId?: string;
}

export function ReviewsSection({ businessId }: ReviewsSectionProps) {
  const theme = useBusinessProfileTheme();

  return (
    <div
      className="rounded-xl p-4 sm:p-6"
      style={{
        backgroundColor: theme.cardBg,
        border: `1px solid ${theme.border}`,
        borderRadius: theme.radius,
      }}
    >
      <h2 className="text-xl font-semibold mb-2" style={{ color: theme.text }}>
        Reviews
      </h2>
      <p className="text-sm" style={{ color: theme.mutedText }}>
        Reviews coming soon.
      </p>
    </div>
  );
}
