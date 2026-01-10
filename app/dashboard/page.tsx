
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

type Row = Record<string, any>;

export default function Dashboard() {
  const [error, setError] = useState<string | null>(null);
  const [daily60, setDaily60] = useState<{ day: string; calls?: number; bops?: number; followups?: number }[]>([]);
  const [monthly12, setMonthly12] = useState<{ month: string; calls?: number; bops?: number; followups?: number }[]>([]);
  const [trendLoading, setTrendLoading] = useState(false);
  const [rangeStart, setRangeStart] = useState(format(new Date(), "yyyy-MM-dd"));
  const [rangeEnd, setRangeEnd] = useState(format(addDays(new Date(), 30), "yyyy-MM-dd"));
  const [upcoming, setUpcoming] = useState<Row[]>([]);
  const [upcomingLoading, setUpcomingLoading] = useState(false);
  const [progressRows, setProgressRows] = useState<Row[]>([]);
  const [progressLoading, setProgressLoading] = useState(false);
  const [progressFilter, setProgressFilter] = useState("");
  const [records, setRecords] = useState<Row[]>([]);
  const [newClientsCount, setNewClientsCount] = useState(0);
  const [cycleDays, setCycleDays] = useState(0);

  // Hide all cards by default
  const [recordsVisible, setRecordsVisible] = useState(false);
  const [trendsVisible, setTrendsVisible] = useState(false);
  const [upcomingVisible, setUpcomingVisible] = useState(false);
  const [progressVisible, setProgressVisible] = useState(false);

  // Placeholder functions to avoid build errors
  async function fetchTrends() {
    return Promise.resolve();
  }

  async function fetchProgressSummary() {
    return Promise.resolve();
  }

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

  async function logout() {
    try {
      const supabase = getSupabase();
      await supabase.auth.signOut();
    } finally {
      window.location.href = "/";
    }
  }

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

          {/* Right side with labels and buttons */}
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
            <Button variant="secondary" onClick={logout}>
              <span className="inline-flex items-center gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a2 2 0 002 2h3a2 2 0 002-2v-1m-6-10V5a2 2 0 012-2h3a2 2 0 012 2v1" />
                </svg>
                Logout
              </span>
            </Button>
          </div>
        </header>

        {/* Cards */}
        {error && <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-red-700">{error}</div>}

        {/* Trends Card */}
        {trendsVisible && (
          <Card title="Trends">
            <div className="text-xs font-semibold text-black mb-2">Rolling 12 Months</div>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthly12}>
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                  <YAxis allowDecimals={false} />
                  <Tooltip />
                  <Bar dataKey="calls" fill="#2563eb">
                    <LabelList dataKey="calls" position="top" fill="#0f172a" />
                  </Bar>
                  <Bar dataKey="bops" fill="#f97316">
                    <LabelList dataKey="bops" position="top" fill="#0f172a" />
                  </Bar>
                  <Bar dataKey="followups" fill="#10b981">
                    <LabelList dataKey="followups" position="top" fill="#0f172a" />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>
        )}

        {/* Upcoming Meetings Card */}
        {upcomingVisible && (
          <Card title="Upcoming Meetings (Editable)">
            <div className="text-sm text-black">Upcoming meetings table goes here...</div>
          </Card>
        )}

        {/* Client Progress Summary Card */}
        {progressVisible && (
          <Card title="Client Progress Summary">
            <div className="text-sm text-black">Progress summary table goes here...</div>
          </Card>
        )}

        {/* All Records Card */}
        {recordsVisible && (
          <Card title="All Records (Editable)">
            <div className="text-sm text-black">Editable records table goes here...</div>
          </Card>
        )}
      </div>
    </div>
  );
}
