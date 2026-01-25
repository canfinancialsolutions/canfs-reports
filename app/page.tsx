// app/page.tsx
'use client';

import { useEffect } from 'react';

export default function HomeRedirect() {
  useEffect(() => {
    window.location.href = '/auth';
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <p className="text-sm text-slate-600">
        Redirecting to login...
      </p>
    </div>
  );
}
