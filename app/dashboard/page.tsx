
// app/dashboard/page.tsx
import { redirect } from 'next/navigation'
import DashboardClient from './DashboardClient'
import { createServerSupabase } from '/lib/supabase/server'

export default async function DashboardPage() {
  const supabase = await createServerSupabase()

  // Verify the user (server-side). This actually validates the token.
  const { data: { user }, error } = await supabase.auth.getUser()
  if (!user) redirect('/')

  return <DashboardClient />
}
