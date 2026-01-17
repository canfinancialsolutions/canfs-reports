
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
