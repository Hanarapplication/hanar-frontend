'use client';

import { useParams } from 'next/navigation';
import { MarketplaceIndividualListingForm } from '@/components/MarketplaceIndividualListingForm';

export default function EditMarketplaceItemPage() {
  const params = useParams();
  const id = String(params?.id || '').trim();
  if (!id) {
    return <div className="p-6 text-center text-slate-600">Invalid listing.</div>;
  }
  return <MarketplaceIndividualListingForm editItemId={id} />;
}
