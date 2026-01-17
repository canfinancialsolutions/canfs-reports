

// app/page.tsx  (Server Component; no "use client")
import { redirect } from 'next/navigation';

export default function Page() {
  redirect('/dashboard');
}
