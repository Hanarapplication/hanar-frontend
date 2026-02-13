'use client';

import { useBusinessProfileTheme } from '../theme/ThemeProvider';
import type { BusinessAddress } from '../types';

interface AddressCardProps {
  address: BusinessAddress;
  getMapUrl: (address: BusinessAddress) => string;
}

export function AddressCard({ address, getMapUrl }: AddressCardProps) {
  const theme = useBusinessProfileTheme();

  if (!address?.street) return null;

  const line = [address.street, address.city, address.state, address.zip].filter(Boolean).join(', ');

  return (
    <div
      className="mb-4 w-fit px-3 py-2.5 rounded-lg text-sm"
      style={{
        backgroundColor: theme.border,
        color: theme.text,
      }}
    >
      <a
        href={getMapUrl(address)}
        target="_blank"
        rel="noopener noreferrer"
        className="hover:underline"
        style={{ color: theme.text }}
      >
        {line}
      </a>
    </div>
  );
}
