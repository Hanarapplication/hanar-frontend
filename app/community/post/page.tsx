import { Suspense } from 'react';
import CreateCommunityPostClient from './CreateCommunityPostClient';

export default function CreateCommunityPostPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-slate-500">Loading...</div>
      </div>
    }>
      <CreateCommunityPostClient />
    </Suspense>
  );
}
