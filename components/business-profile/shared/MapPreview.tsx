'use client';

import dynamic from 'next/dynamic';
import type { BusinessAddress } from '../types';

const BusinessMap = dynamic(() => import('@/components/BusinessMap'), { ssr: false });

interface MapPreviewProps {
  address: BusinessAddress;
}

export function MapPreview({ address }: MapPreviewProps) {
  if (!address?.street || !address?.city || !address?.state) return null;

  return (
    <div className="w-full pt-4">
      <BusinessMap
        address={{
          street: address.street ?? '',
          city: address.city ?? '',
          state: address.state ?? '',
          zip: address.zip ?? '',
        }}
      />
    </div>
  );
}
