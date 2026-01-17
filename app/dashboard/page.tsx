/** 
 * CAN Financial Solutions — Dashboard (page_01102026.tsx)
 *
 * UI-only, minimal and scoped changes:
 * - Cards hidden by default; top-right toggle shows “Show All” / “Hide All”.
 * - Existing cards preserved (Trends, Upcoming Meetings, Client Progress, All Records).
 * - New client columns fully wired (labels, DoB date-only, dropdowns, wrap editors):
 *     spouse_name, date_of_birth, children, city, state, immigration_status, work_details
 * - NEW "Business 💼" Card (public.client_business):
 *     • Editable grid (same table UI as All Records)
 *     • Search (client_name, associate_name, policy_number)
 *     • Sorting; default UI sort = issue_date desc then created_at desc
 *     • Pagination same as All Records
 *
 * No backend changes (schema / procs / routes / auth / RLS).
 */


// app/dashboard/page.tsx (SERVER COMPONENT)
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createServerComponentClient } from "@supabase/auth-helpers-nextjs";
import DashboardClient from "./DashboardClient";

export default async function DashboardPage() {
  const supabase = createServerComponentClient({ cookies });
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    redirect("/");
  }

  return <DashboardClient />;
}


