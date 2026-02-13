'use client';

import { FaDirections } from 'react-icons/fa';
import { useBusinessProfileTheme } from '../theme/ThemeProvider';
import type { BusinessAddress } from '../types';

interface DirectionsButtonProps {
  address: BusinessAddress;
  getMapUrl: (address: BusinessAddress) => string;
}

export function DirectionsButton({ address, getMapUrl }: DirectionsButtonProps) {
  const theme = useBusinessProfileTheme();

  if (!address?.street) return null;

  const mapUrl = getMapUrl(address);

  return (
    <div className="flex items-center justify-start mb-3">
      <a
        href={mapUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-2 font-bold py-2 px-3 rounded text-sm whitespace-nowrap transition-opacity hover:opacity-90"
        style={{
          backgroundColor: theme.primary,
          color: theme.primaryText,
        }}
      >
        <FaDirections size={16} />
        <span>Get Directions</span>
      </a>
    </div>
  );
}
