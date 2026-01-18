
// lib/supabase/client.ts
import { createClient } from '@supabase/supabase-js'

export function createBrowserSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,      // must be set in Vercel → Project → Settings → Environment Variables
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!  // also set there (client vars must be NEXT_PUBLIC_*)
  )
}
