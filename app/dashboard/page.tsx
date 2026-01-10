
"use client";
export const dynamic = "force-dynamic";
import React, { useEffect, useMemo, useRef, useState } from "react";
import * as XLSX from "xlsx";
import {
  addDays,
  addMonths,
  format,
  isValid,
  parseISO,
  startOfMonth,
  subMonths,
  subDays,
  endOfMonth,
} from "date-fns";
import {
  ResponsiveContainer,
  XAxis,
  YAxis,
  Tooltip,
  BarChart,
  Bar,
  LabelList,
} from "recharts";
import { getSupabase } from "@/lib/supabaseClient";
import { Button, Card } from "@/components/ui";

export default function Dashboard() {
  const [error, setError] = useState<string | null>(null);
  const [daily60, setDaily60] = useState<{ day: string; calls?: number; bops?: number; followups?: number }[]>([]);
  const [monthly12, setMonthly12] = useState<{ month: string; calls?: number; bops?: number; followups?: number }[]>([]);
  const [trendLoading, setTrendLoading] = useState(false);
  const [rangeStart, setRangeStart] = useState(format(new Date(), "yyyy-MM-dd"));
  const [rangeEnd, setRangeEnd] = useState(format(addDays(new Date(), 30), "yyyy-MM-dd"));
  const [upcoming, setUpcoming] = useState<any[]>([]);
  const [upcomingLoading, setUpcomingLoading] = useState(false);
  const [progressRows, setProgressRows] = useState<any[]>([]);
  const [progressLoading, setProgressLoading] = useState(false);
  const [progressFilter, setProgressFilter] = useState("");
  const [records, setRecords] = useState<any[]>([]);
  const [newClientsCount, setNewClientsCount] = useState(0);
  const [cycleDays, setCycleDays] = useState(0);

  const [recordsVisible, setRecordsVisible] = useState(false);
  const [trendsVisible, setTrendsVisible] = useState(false);
  const [upcomingVisible, setUpcomingVisible] = useState(false);
  const [progressVisible, setProgressVisible] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const supabase = getSupabase();
        const { data } = await supabase.auth.getSession();
        if (!data.session) {
          window.location.href = "/";
          return;
        }
        await Promise.all([fetchTrends(), fetchProgressSummary(), loadPage(0)]);
      } catch (e: any) {
        setError(e?.message ?? "Failed to initialize");
      } finally {
        setTrendLoading(false);
      }
    })();
  }, []);

  async function loadPage(nextPage: number) {
    try {
      const supabase = getSupabase();
      const { data } = await supabase.from("client_registrations").select("*");
      setRecords(data ?? []);
      setNewClientsCount((data ?? []).filter(r => r.status === "New Client").length);
      const latestIssued = (data ?? []).reduce((max, r) => {
        const d = r.Issued ? new Date(r.Issued).getTime() : 0;
        return d > max ? d : max;
      }, 0);
      setCycleDays(latestIssued ? Math.floor((Date.now() - latestIssued) / (1000 * 60 * 60 * 24)) : 0);
    } catch (e: any) {
      setError(e?.message ?? "Failed to load records");
    }
  }

  const allVisible = trendsVisible && upcomingVisible && progressVisible && recordsVisible;
  const toggleAllCards = () => {
    const target = !allVisible;
    setTrendsVisible(target);
    setUpcomingVisible(target);
    setProgressVisible(target);
    setRecordsVisible(target);
  };

  return (
    <div className="min-h-screen">
      <div className="max-w-[1600px] mx-auto p-6 space-y-6">
        <header className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <img src="/can-logo.png" className="h-8 w-auto" alt="CAN Logo" />
            <div>
              <div className="text-2xl font-bold text-black">CAN Financial Solutions Clients Report</div>
              <div className="text-sm text-black">Protecting Your Tomorrow</div>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex gap-2 mr-4">
              <div className="px-3 py-1 border border-slate-300 rounded bg-white text-black text-sm font-semibold">
                New Clients - {newClientsCount}
              </div>
              <div className="px-3 py-1 border border-slate-300 rounded bg-white text-black text-sm font-semibold">
                Cycle Days - {cycleDays}
              </div>
            </div>
            <Button variant="secondary" onClick={toggleAllCards}>
              {allVisible ? "Hide All" : "Show All"}
            </Button>
            <Button variant="secondary" onClick={() => { /* logout logic */ }}>
              <span className="inline-flex items-center gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a2 2 0 002 2h3a2 2 0 002-2v-1m-6-10V5a2 2 0 012-2h3a2 2 0 012 2v1" />
                </svg>
                Logout
              </span>
            </Button>
          </div>
        </header>
        {/* Cards go here */}
      </div>
    </div>
  );
}
``
