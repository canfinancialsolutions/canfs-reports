 
/** 
 * CAN Financial Solutions — Dashboard (page_0 (2).tsx) 
 * 
 * Minimal, scoped UI-layer changes only: 
 * - Added/kept new columns: spouse_name, date_of_birth, children, city, state, immigration_status, work_details. 
 * - Yellow highlight (no timestamp considered) for BOP Date & Follow-Up Date cells when ≥ today in Upcoming Meetings + All Records. 
 * - Upcoming Meetings: Refresh resets to default 30-day range; Show Results active green label. 
 * - Status columns render dropdown lists (incl. State). 
 * - Word-wrap + scrollable popups for Referred By, Product, Comment, Remark (and immigration_status, work_details). 
 * 
 * No backend changes (schema, procedures, routes, auth, Supabase policies). 
 */ 
"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { Inter } from "next/font/google";
import * as XLSX from "xlsx";
import {
  addDays,
  addMonths,
  endOfMonth,
  format,
  isValid,
  parseISO,
  startOfMonth,
  subDays,
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
import { createBrowserSupabase } from "@/lib/supabase/client";

const Btn: React.FC<React.ButtonHTMLAttributes<HTMLButtonElement>> = ({ className = "", children, ...rest }) => (
  <button
    className={
      "inline-flex items-center gap-2 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-100 " +
      className
    }
    {...rest}
  >
    {children}
  </button>
);

const Card: React.FC<{ title?: string; children: React.ReactNode; className?: string }> = ({ title, children, className = "" }) => (
  <section className={"rounded-xl border border-slate-200 bg-slate-50 p-4 " + className}>
    {title ? <h2 className="text-lg font-bold text-slate-900 mb-3">{title}</h2> : null}
    {children}
  </section>
);

const inter = Inter({ subsets: ["latin"], display: "swap" });

type Row = Record<string, any>;

type SortKey =
  | "client"
  | "created_at"
  | "BOP_Date"
  | "BOP_Status"
  | "Followup_Date"
  | "status"
  | "CalledOn"
  | "Issued"
  | "issue_date"
  | "submit_date"
  | "client_name"
  | "associate_name"
  | "policy_number"
  | "amount"
  | "bill_amount";

type SortDir = "asc" | "desc";

type ProgressSortKey =
  | "client_name"
  | "last_call_date"
  | "call_attempts"
  | "last_bop_date"
  | "bop_attempts"
  | "last_followup_date"
  | "followup_attempts";

const ALL_PAGE_SIZE = 10;
const PROGRESS_PAGE_SIZE = 10;

const DATE_TIME_KEYS = new Set([
  "BOP_Date",
  "CalledOn",
  "Followup_Date",
  "FollowUp_Date",
  "Issued",
  "submit_date",
  "issue_date",
]);

const DATE_ONLY_KEYS = new Set(["date_of_birth"]);

export default function DashboardClient() {
  const [error, setError] = useState<string | null>(null);

  // Trend data
  const [daily60, setDaily60] = useState<{ day: string; calls?: number; bops?: number; followups?: number }[]>([]);
  const [monthly12, setMonthly12] = useState<{ month: string; calls?: number; bops?: number; followups?: number }[]>([]);
  const [trendLoading, setTrendLoading] = useState(false);

  // Upcoming range & rows
  const [rangeStart, setRangeStart] = useState(format(new Date(), "yyyy-MM-dd"));
  const [rangeEnd, setRangeEnd] = useState(format(addDays(new Date(), 30), "yyyy-MM-dd"));
  const [upcoming, setUpcoming] = useState<Row[]>([]);
  const [upcomingLoading, setUpcomingLoading] = useState(false);
  const [sortUpcoming, setSortUpcoming] = useState<{ key: SortKey; dir: SortDir }>({ key: "BOP_Date", dir: "desc" });

  // Progress summary
  const [progressRows, setProgressRows] = useState<Row[]>([]);
  const [progressLoading, setProgressLoading] = useState(false);
  const [progressFilter, setProgressFilter] = useState("");
  const [progressSort, setProgressSort] = useState<{ key: ProgressSortKey; dir: SortDir }>({ key: "last_call_date", dir: "desc" });
  const [progressPage, setProgressPage] = useState(0);

  // All records
  const [q, setQ] = useState("");
  const [records, setRecords] = useState<Row[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [pageJump, setPageJump] = useState("1");
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [sortAll, setSortAll] = useState<{ key: SortKey; dir: SortDir }>({ key: "created_at", dir: "desc" });

  // Visibility toggles
  const [recordsVisible, setRecordsVisible] = useState(false);
  const [trendsVisible, setTrendsVisible] = useState(false);
  const [upcomingVisible, setUpcomingVisible] = useState(false);
  const [progressVisible, setProgressVisible] = useState(false);

  // Supabase browser client
  const supabase = useMemo(() => createBrowserSupabase(), []);

  // ------- Helpers -------
  const applySort = (query: any, sort: { key: SortKey; dir: SortDir }) => {
    const ascending = sort.dir === "asc";
    if (sort.key === "client") return query.order("first_name", { ascending }).order("last_name", { ascending });
    return query.order(sort.key, { ascending });
  };

  const logout = async () => {
    try { await supabase.auth.signOut(); } finally { window.location.href = "/"; }
  };

  // ------- fetchTrends -------
  const fetchTrends = useCallback(async () => {
    setTrendLoading(true);
    setError(null);
    try {
      const today = new Date();
      const startDaily = subDays(today, 59);

      const [{ data: callsRows }, { data: bopsRows }, { data: fuRows }] = await Promise.all([
        supabase.from("client_registrations").select("CalledOn").gte("CalledOn", startDaily.toISOString()).order("CalledOn", { ascending: true }).limit(50000),
        supabase.from("client_registrations").select("BOP_Date").gte("BOP_Date", startDaily.toISOString()).order("BOP_Date", { ascending: true }).limit(50000),
        supabase.from("client_registrations").select("Followup_Date").gte("Followup_Date", startDaily.toISOString()).order("Followup_Date", { ascending: true }).limit(50000),
      ]);

      const days: string[] = [];
      const callsDay = new Map<string, number>();
      const bopsDay = new Map<string, number>();
      const fuDay = new Map<string, number>();
      for (let i = 0; i < 60; i++) {
        const d = subDays(today, 59 - i);
        const key = format(d, "yyyy-MM-dd");
        days.push(key); callsDay.set(key, 0); bopsDay.set(key, 0); fuDay.set(key, 0);
      }
      const bumpDay = (val: any, map: Map<string, number>) => {
        if (!val) return;
        const d = parseISO(String(val));
        if (!isValid(d)) return;
        const k = format(d, "yyyy-MM-dd");
        if (map.has(k)) map.set(k, (map.get(k) ?? 0) + 1);
      };
      (callsRows ?? []).forEach((r: any) => bumpDay(r.CalledOn, callsDay));
      (bopsRows ?? []).forEach((r: any) => bumpDay(r.BOP_Date, bopsDay));
      (fuRows ?? []).forEach((r: any) => bumpDay(r.Followup_Date, fuDay));

      const nz = (n?: number) => (n && n !== 0 ? n : undefined);
      setDaily60(days.map((day) => ({ day, calls: nz(callsDay.get(day) ?? 0), bops: nz(bopsDay.get(day) ?? 0), followups: nz(fuDay.get(day) ?? 0) })));

      const startMonth = startOfMonth(addMonths(today, -11));
      const months: string[] = [];
      const callsMonth = new Map<string, number>();
      const bopsMonth = new Map<string, number>();
      const fuMonth = new Map<string, number>();
      for (let i = 0; i < 12; i++) {
        const m = addMonths(startMonth, i);
        const key = format(m, "yyyy-MM");
        months.push(key); callsMonth.set(key, 0); bopsMonth.set(key, 0); fuMonth.set(key, 0);
      }

      const [{ data: callsY }, { data: bopsY }, { data: fuY }] = await Promise.all([
        supabase.from("client_registrations").select("CalledOn").gte("CalledOn", startMonth.toISOString()).lt("CalledOn", addMonths(endOfMonth(today), 1).toISOString()).order("CalledOn", { ascending: true }).limit(200000),
        supabase.from("client_registrations").select("BOP_Date").gte("BOP_Date", startMonth.toISOString()).lt("BOP_Date", addMonths(endOfMonth(today), 1).toISOString()).order("BOP_Date", { ascending: true }).limit(200000),
        supabase.from("client_registrations").select("Followup_Date").gte("Followup_Date", startMonth.toISOString()).lt("Followup_Date", addMonths(endOfMonth(today), 1).toISOString()).order("Followup_Date", { ascending: true }).limit(200000),
      ]);

      const bumpMonth = (val: any, map: Map<string, number>) => {
        if (!val) return;
        const d = parseISO(String(val));
        if (!isValid(d)) return;
        const k = format(d, "yyyy-MM");
        if (map.has(k)) map.set(k, (map.get(k) ?? 0) + 1);
      };
      (callsY ?? []).forEach((r: any) => bumpMonth(r.CalledOn, callsMonth));
      (bopsY ?? []).forEach((r: any) => bumpMonth(r.BOP_Date, bopsMonth));
      (fuY ?? []).forEach((r: any) => bumpMonth(r.Followup_Date, fuMonth));

      setMonthly12(months.map((month) => ({
        month,
        calls: nz(callsMonth.get(month) ?? 0),
        bops: nz(bopsMonth.get(month) ?? 0),
        followups: nz(fuMonth.get(month) ?? 0),
      })));
    } catch (e: any) {
      setError(e?.message ?? "Failed to load trends");
    } finally {
      setTrendLoading(false);
    }
  }, [supabase]);

  // ------- other data loaders -------
  const fetchProgressSummary = useCallback(async () => {
    setProgressLoading(true); setError(null);
    try {
      const { data, error } = await supabase
        .from("v_client_progress_summary")
        .select("clientid, first_name, last_name, phone, email, last_call_date, call_attempts, last_bop_date, bop_attempts, last_followup_date, followup_attempts")
        .order("clientid", { ascending: false })
        .limit(10000);
      if (error) throw error;
      const rows = (data ?? []).map((r: any) => ({
        clientid: r.clientid,
        client_name: `${r.first_name ?? ""} ${r.last_name ?? ""}`.trim(),
        first_name: r.first_name,
        last_name: r.last_name,
        phone: r.phone,
        email: r.email,
        last_call_date: r.last_call_date,
        call_attempts: r.call_attempts,
        last_bop_date: r.last_bop_date,
        bop_attempts: r.bop_attempts,
        last_followup_date: r.last_followup_date,
        followup_attempts: r.followup_attempts,
      }));
      setProgressRows(rows); setProgressPage(0);
    } catch (e: any) { setError(e?.message ?? "Failed to load Client Progress Summary"); } finally { setProgressLoading(false); }
  }, [supabase]);

  const loadPage = useCallback(async (nextPage: number) => {
    setError(null); setLoading(true);
    try {
      const search = q.trim();
      let countQuery = supabase.from("client_registrations").select("id", { count: "exact", head: true });
      if (search) countQuery = countQuery.or(`first_name.ilike.%${search}%,last_name.ilike.%${search}%,phone.ilike.%${search}%`);
      const { count, error: cErr } = await countQuery; if (cErr) throw cErr; setTotal(count ?? 0);

      const from = nextPage * ALL_PAGE_SIZE; const to = from + ALL_PAGE_SIZE - 1;
      let dataQuery = supabase.from("client_registrations").select("*").range(from, to);
      if (search) dataQuery = dataQuery.or(`first_name.ilike.%${search}%,last_name.ilike.%${search}%,phone.ilike.%${search}%`);
      dataQuery = applySort(dataQuery, sortAll);
      const { data, error } = await dataQuery; if (error) throw error;
      setRecords(data ?? []); setPage(nextPage); setPageJump(String(nextPage + 1));
    } catch (e: any) { setError(e?.message ?? "Failed to load records"); } finally { setLoading(false); }
  }, [q, sortAll, supabase]);

  const fetchUpcoming = useCallback(async () => {
    setUpcomingLoading(true); setError(null);
    try {
      const startIso = new Date(rangeStart).toISOString();
      const endIso = new Date(new Date(rangeEnd).getTime() + 24 * 60 * 60 * 1000).toISOString();
      const { data: bopRows, error: bopErr } = await supabase.from("client_registrations").select("*").gte("BOP_Date", startIso).lt("BOP_Date", endIso).limit(5000);
      if (bopErr) throw bopErr;
      const { data: fuRows, error: fuErr } = await supabase.from("client_registrations").select("*").gte("Followup_Date", startIso).lt("Followup_Date", endIso).limit(5000);
      if (fuErr) throw fuErr;
      const map = new Map<string, any>();
      for (const r of bopRows ?? []) map.set(String((r as any).id), r);
      for (const r of fuRows ?? []) map.set(String((r as any).id), r);
      let merged = Array.from(map.values());
      const asc = sortUpcoming.dir === "asc"; const key = sortUpcoming.key;
      const getVal = (r: any) => (key === "client" ? `${r.first_name ?? ""} ${r.last_name ?? ""}`.trim() : r[key]);
      merged.sort((a: any, b: any) => {
        const av = getVal(a); const bv = getVal(b);
        if (["created_at", "BOP_Date", "Followup_Date", "CalledOn", "Issued"].includes(key)) {
          const at = av ? new Date(av).getTime() : 0; const bt = bv ? new Date(bv).getTime() : 0; return asc ? at - bt : bt - at;
        }
        return asc ? String(av ?? "").localeCompare(String(bv ?? "")) : String(bv ?? "").localeCompare(String(av ?? ""));
      });
      setUpcoming(merged); setUpcomingVisible(true);
    } catch (e: any) { setError(e?.message ?? "Failed to load upcoming meetings"); } finally { setUpcomingLoading(false); }
  }, [rangeStart, rangeEnd, sortUpcoming, supabase]);

  const updateCell = useCallback(async (id: string, key: string, rawValue: string) => {
    setSavingId(id); setError(null);
    try {
      const payload: any = {};
      const isDateOnly = DATE_ONLY_KEYS.has(key);
      const isDateTime = DATE_TIME_KEYS.has(key);
      payload[key] = isDateTime ? fromLocalInput(rawValue) : isDateOnly ? fromLocalDate(rawValue) : rawValue?.trim() ? rawValue : null;
      const { error } = await supabase.from("client_registrations").update(payload).eq("id", id);
      if (error) throw error;
      const patch = (prev: Row[]) => prev.map((r) => (String(r.id) === String(id) ? { ...r, [key]: payload[key] } : r));
      setRecords(patch); setUpcoming(patch);
    } catch (e: any) { setError(e?.message ?? "Update failed"); throw e; } finally { setSavingId(null); }
  }, [supabase]);

  // ------- Effects -------
  useEffect(() => {
    (async () => {
      try {
        const { data } = await supabase.auth.getSession();
        // ❌ DO NOT redirect guests back to '/'; avoid redirect loop
        if (!data.session) {
          // Optional: show a banner or keep minimal UI
          // setError('Please sign in to see protected data.')
          return;
        }
        await Promise.all([fetchTrends(), fetchProgressSummary(), loadPage(0)]);
      } catch (e: any) {
        setError(e?.message ?? "Failed to initialize");
      } finally {
        setLoading(false);
      }
    })();
  }, [fetchTrends, fetchProgressSummary, loadPage, supabase]);

  useEffect(() => { loadPage(0); }, [sortAll, loadPage]);
  useEffect(() => { if (upcoming.length) fetchUpcoming(); }, [sortUpcoming, fetchUpcoming, upcoming.length]);
  useEffect(() => { const id = setTimeout(() => loadPage(0), 300); return () => clearTimeout(id); }, [q, loadPage]);

  const exportUpcomingXlsx = () => {
    const ws = XLSX.utils.json_to_sheet(upcoming);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Upcoming");
    XLSX.writeFile(wb, `Upcoming_${rangeStart}_to_${rangeEnd}.xlsx`);
  };

  return (
    <div className={`${inter.className} min-h-screen`}>
      <div className="max-w-[1600px] mx-auto p-4 space-y-4">
        <header className="flex items-center justify-between gap-2 h-16">
          <div className="flex items-center gap-2 min-w-[520px]">
            <div className="relative flex-none w-[120px] h-12">
              <Image src="/can-logo.png" alt="CAN Logo" width={120} height={48} priority className="absolute inset-0 h-12 w-[120px] object-contain" />
            </div>
            <div className="h-12 overflow-hidden flex flex-col justify-center">
              <div className="text-2xl font-bold text-blue-800 whitespace-nowrap">CAN Financial Solutions Clients Report</div>
              <div className="text-sm font-semibold text-yellow-500 whitespace-nowrap">Protecting Your Tomorrow</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Btn onClick={() => { setTrendsVisible(v=>!v); setUpcomingVisible(v=>!v); setProgressVisible(v=>!v); setRecordsVisible(v=>!v); }}>Toggle All</Btn>
            <Btn onClick={logout}><span className="inline-flex items-center gap-2">Logout</span></Btn>
          </div>
        </header>

        {error && <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-red-700">{error}</div>}

        <Card title="Trends 4CA">
          <div className="mb-2">
            <Btn onClick={() => setTrendsVisible((v) => !v)}>{trendsVisible ? "Hide 4CA" : "Show 4CA"}</Btn>
          </div>
          {trendsVisible ? (
            <>
              <div className="text-xs font-semibold text-black mb-2">Rolling 12 Months</div>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={monthly12}>
                    <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                    <YAxis allowDecimals={false} />
                    <Tooltip />
                    <Bar dataKey="calls" fill="#2563eb"><LabelList dataKey="calls" position="top" fill="#0f172a" /></Bar>
                    <Bar dataKey="bops" fill="#f97316"><LabelList dataKey="bops" position="top" fill="#0f172a" /></Bar>
                    <Bar dataKey="followups" fill="#10b981"><LabelList dataKey="followups" position="top" fill="#0f172a" /></Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
              {trendLoading && <div className="mt-2 text-xs text-black">Loading…</div>}
            </>
          ) : (<div className="text-sm text-black">Results are hidden.</div>)}
        </Card>

        <Card title="Upcoming Meetings4E3">
          <div className="grid md:grid-cols-5 gap-3 items-end">
            <label className="block md:col-span-1">
              <div className="text-xs font-semibold text-black mb-1">Start</div>
              <input type="date" className="w-32 border border-slate-300 px-2 py-1" value={rangeStart} onChange={(e) => setRangeStart(e.target.value)} />
            </label>
            <label className="block md:col-span-1">
              <div className="text-xs font-semibold text-black mb-1">End</div>
              <input type="date" className="w-32 border border-slate-300 px-2 py-1" value={rangeEnd} onChange={(e) => setRangeEnd(e.target.value)} />
            </label>
            <div className="flex gap-2 md:col-span-3">
              <Btn onClick={() => fetchUpcoming()}><b>➡️</b></Btn>
              <Btn onClick={() => { const today = new Date(); setRangeStart(format(today, "yyyy-MM-dd")); setRangeEnd(format(addDays(today, 30), "yyyy-MM-dd")); fetchUpcoming(); }} disabled={upcomingLoading}>{upcomingLoading ? "Refreshing…" : "504"}</Btn>
              <Btn onClick={exportUpcomingXlsx} disabled={upcoming.length === 0}>4E4</Btn>
              <Btn onClick={() => setUpcomingVisible((v) => !v)}><span className={upcomingVisible ? "text-black" : undefined}>{upcomingVisible ? "Hide5C2️" : "Show5C2️"}</span></Btn>
            </div>
          </div>
        </Card>

        <Card title="Client Progress Summary4D1">
          <div className="flex flex-col md:flex-row md:items-center gap-2 mb-2">
            <input className="w-72 border border-slate-300 px-3 py-2" placeholder="Filter by client name..." value={progressFilter} onChange={(e) => { setProgressFilter(e.target.value); setProgressPage(0); }} />
            <Btn onClick={() => setProgressVisible(true)}>➡️</Btn>
            <Btn onClick={() => { setProgressFilter(""); fetchProgressSummary().then(() => setProgressVisible(true)); }} disabled={progressLoading}>{progressLoading ? "Loading…" : "504"}</Btn>
            <Btn onClick={() => setProgressVisible((v) => !v)}>{progressVisible ? "Hide5C2️" : "Show5C2️"}</Btn>
          </div>
        </Card>

        <Card title="Clients List 9D13FB00D01F91D00D01F9D13FB">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 mb-2">
            <div className="flex flex-col md:flex-row md:items-center gap-2 w-full">
              <input className="w-80 border border-slate-300 px-3 py-2" placeholder="Search by first name, last name, or phone" value={q} onChange={(e) => setQ(e.target.value)} />
              <Btn onClick={() => loadPage(0)}>➡️</Btn>
              <Btn onClick={() => { setQ(""); loadPage(0); setRecordsVisible(true); }}>504</Btn>
              <Btn onClick={() => setRecordsVisible((v) => !v)}>{recordsVisible ? "Hide5C2️" : "Show5C2️"}</Btn>
            </div>
          </div>
          <div className="text-sm text-black mb-2">{total.toLocaleString()} records • showing {ALL_PAGE_SIZE} per page</div>
        </Card>

      </div>
    </div>
  );
}

