// app/auth/page.tsx
'use client';

import { useState } from 'react';
import { setSession } from '../lib/auth-client'; // adjust path if lib is in /lib

const DESTINATIONS = [
  { value: 'dashboard', label: 'Dashboard', path: '/dashboard' },
  { value: 'fna', label: 'Financial Need Analysis', path: '/fna' },
  { value: 'prospect', label: 'Prospect List', path: '/prospect' },
];

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [destination, setDestination] = useState<string>('dashboard');
  const [error, setError] = useState<string | null>(null);

  const signIn = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!email || !password) {
      setError('Please enter email and password');
      return;
    }

    // mark session as logged in
    setSession();

    const dest = DESTINATIONS.find((d) => d.value === destination);
    const redirectTo = dest?.path ?? '/dashboard';
    window.location.href = redirectTo;
  };

  // …keep the rest of your JSX as in file:306…
}
