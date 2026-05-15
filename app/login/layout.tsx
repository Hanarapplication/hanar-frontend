import { Suspense } from 'react';

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-[#f0f2f5] px-4">
          <div className="text-gray-500">Loading…</div>
        </div>
      }
    >
      {children}
    </Suspense>
  );
}
