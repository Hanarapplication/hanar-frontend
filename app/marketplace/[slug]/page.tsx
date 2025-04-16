'use client';

import dynamic from 'next/dynamic';

// Dynamically import the detail component and disable SSR to avoid hydration errors
const ItemDetailClient = dynamic(() => import('./ItemDetailClient'), {
  ssr: false,
});

export default function Page() {
  return <ItemDetailClient />;
}
