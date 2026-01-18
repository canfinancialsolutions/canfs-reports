
"use client";
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { createBrowserSupabase } from '@/lib/supabase/client'

export default function Home() {
  const supabase = createBrowserSupabase()
  const [checking, setChecking] = useState(true)

  useEffect(() => {
    (async () => {
      try {
        const { data } = await supabase.auth.getSession()
        // ✅ Only redirect if already signed in
        if (data.session) {
          window.location.replace('/dashboard')
          return
        }
      } finally {
        setChecking(false)
      }
    })()
  }, []) // eslint-disable-line

  return (
    <main className="min-h-screen p-6">
      <h1 className="text-2xl font-bold">CAN Financial Solutions Clients Report</h1>
      <p className="mt-2 text-slate-700">
        Welcome! {checking ? 'Checking session…' : 'You can enter the dashboard below.'}
      </p>
      <div className="mt-4">
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-2 rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-100"
        >
          Go to Dashboard
        </Link>
      </div>
    </main>
  )
}
