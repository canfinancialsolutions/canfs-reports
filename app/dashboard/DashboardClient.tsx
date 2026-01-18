// app/dashboard/page.tsx
// Client-only fallback: we skip SSR auth and render the client dashboard.
// (DashboardClient should redirect to "/" if no session.)
import DashboardClient from './DashboardClient'

export default function DashboardPage() {
  return <DashboardClient />
}
