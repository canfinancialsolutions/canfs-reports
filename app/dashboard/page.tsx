
/**
 * CAN Financial Solutions — Dashboard (page_2.tsx)
 *
 * Minimal, scoped UI-layer fixes requested:
 * - Header: show real logo image; change subtitle “Protecting Your Tomorrow” to normal weight.
 * - Trends: use AreaChart (daily last 60 days) for the flow of Calls → BOP → Follow-ups, with distinct colors;
 *           BarChart (rolling 12 months) with distinct colors and legend; hide zeros.
 * - All other existing features remain unchanged (UI-only modifications).
 */

"use client";
export const dynamic = "force-dynamic";

import React, { useEffect, useMemo, useRef, useState } from "react";
import * as XLSX from "xlsx";
import {
  addDays,
  addMonths,
  endOfMonth,
  format,
  isValid,
  parseISO,
  startOfMonth,
  subMonths,
  subDays,
} from "date-fns";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  LineChart, // kept imported in case other parts still use it
  Line,
  XAxis,
  YAxis,
  Tooltip,
  BarChart,
  Bar,
  LabelList,
  Legend,
} from "recharts";
import { getSupabase } from "@/lib/supabaseClient";
import { Button, Card } from "@/components/ui";

type Row = Record<string, any>;
type SortKey =
  | "client"
  | "created_at"
  | "BOP_Date"
  | "BOP_Status"
  | "Followup_Date"
  | "status"
  | "CalledOn"
  | "Issued";
type SortDir = "asc" | "desc";

const ALL_PAGE_SIZE = 20;

/** ----- Helpers (unchanged from your previous file) ----- */
function clientName(r: Row) {
  return `${r.first_name ?? ""} ${r.last_name ?? ""}`.trim();
}

function toLocalInput(value: any) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours()
  )}:${pad(d.getMinutes())}`;
}

function fromLocalInput(value: string) {
  if (!value?.trim()) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

function asListItems(value: any): string[] {
  if (value == null) return [];
  if (Array.isArray(value)) return value.map((v) => String(v)).filter(Boolean);
  const s = String(value).trim();
  if (!s) return [];
  if (s.includes(",")) return s.split(",").map((x) => x.trim()).filter(Boolean);
  return [s];
}

function labelFor(key: string) {
  const overrides: Record<string, string> = {
    client_name: "Client Name",
    created_at: "Created Date",
    CalledOn: "Called On",
    BOP_Date: "BOP Date",
    BOP_Status: "BOP Status",
    Followup_Date: "Follow-Up Date",
    FollowUp_Status: "Follow-Up Status",
    status: "Status",
    client_status: "Client Status",
    Comment: "Comment",
    Remark: "Remark",
  };
  if (overrides[key]) return overrides[key];
  const s = key.replace(/_/g, " ").replace(/([a-z])([A-Z])/g, "$1 $2").trim();
  const acronyms = new Set(["BOP", "ID", "API", "URL", "CAN"]);
  return s
    .split(/\s+/)
    .map((w) =>
      acronyms.has(w.toUpperCase())
        ? w.toUpperCase()
        : w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()
    )
    .join(" ");
}

function toggleSort(cur: { key: SortKey; dir: SortDir }, k: SortKey) {
  if (cur.key !== k) return { key: k, dir: "asc" as SortDir };
  return { key: k, dir: cur.dir === "asc" ? ("desc" as SortDir) : ("asc" as SortDir) };
}

function useColumnResizer() {
  const [widths, setWidths] = useState<Record<string, number>>({});
  const resizeRef = useRef<{
    colId: string;
    startX: number;
    startW: number;
    minW: number;
  } | null>(null);

  const startResize = (
    e: React.MouseEvent,
    colId: string,
    curWidth: number,
    minW = 70
  ) => {
    e.preventDefault();
    e.stopPropagation();
    resizeRef.current = { colId, startX: e.clientX, startW: curWidth, minW };
    const onMove = (ev: MouseEvent) => {
      if (!resizeRef.current) return;
      const dx = ev.clientX - resizeRef.current.startX;
      const next = Math.max(resizeRef.current.minW, resizeRef.current.startW + dx);
      setWidths((prev) => ({ ...prev, [resizeRef.current!.colId]: next }));
    };
    const onUp = () => {
      resizeRef.current = null;
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  };

  return { widths, setWidths, startResize };
}

/** ----- Page Component ----- */
export default function Dashboard() {
  const [error, setError] = useState<string | null>(null);

  // Trends state
  const [daily60, setDaily60] = useState<
    { day: string; calls?: number; bops?: number; followups?: number }[]
  >([]);
  const [monthly12, setMonthly12] = useState<
    { month: string; calls?: number; bops?: number; followups?: number }[]
  >([]);
  const [trendLoading, setTrendLoading] = useState(false);
  const [trendsVisible, setTrendsVisible] = useState(false);

  // Upcoming state
  const [rangeStart, setRangeStart] = useState(format(new Date(), "yyyy-MM-dd"));
  const [rangeEnd, setRangeEnd] = useState(format(addDays(new Date(), 30), "yyyy-MM-dd"));
  const [upcoming, setUpcoming] = useState<Row[]>([]);
  const [upcomingLoading, setUpcomingLoading] = useState(false);
  const [sortUpcoming, setSortUpcoming] = useState<{ key: SortKey; dir: SortDir }>({
    key: "BOP_Date",
    dir: "asc",
  });
  const [upcomingVisible, setUpcomingVisible] = useState(false);

  // All Records
  const [q, setQ] = useState("");
  const [records, setRecords] = useState<Row[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [pageJump, setPageJump] = useState("1");
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [sortAll, setSortAll] = useState<{ key: SortKey; dir: SortDir }>({
    key: "created_at",
    dir: "desc",
  });
  const [recordsVisible, setRecordsVisible] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const supabase = getSupabase();
        const { data } = await supabase.auth.getSession();
        if (!data.session) {
          window.location.href = "/";
          return;
        }
        await Promise.all([fetchTrends(), fetchUpcoming(), loadPage(0)]);
      } catch (e: any) {
        setError(e?.message ?? "Failed to initialize");
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    loadPage(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sortAll.key, sortAll.dir]);

  useEffect(() => {
    if (upcoming.length) fetchUpcoming();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sortUpcoming.key, sortUpcoming.dir]);

  // Live search (re-query while typing) for All Records
  useEffect(() => {
    const id = setTimeout(() => {
      loadPage(0);
      setRecordsVisible(true);
    }, 300);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  function applySort(query: any, sort: { key: SortKey; dir: SortDir }) {
    const ascending = sort.dir === "asc";
    if (sort.key === "client")
      return query.order("first_name", { ascending }).order("last_name", { ascending });
    return query.order(sort.key, { ascending });
  }

  async function logout() {
    try {
      const supabase = getSupabase();
      await supabase.auth.signOut();
    } finally {
      window.location.href = "/";
    }
  }

  /** -------- Trends (daily last 60; rolling 12 months) -------- */
  async function fetchTrends() {
    setTrendLoading(true);
    setError(null);
    try {
      const supabase = getSupabase();
      // Daily last 60 days
      const today = new Date();
      const startDaily = subDays(today, 59);
      const [{ data: callsRows, error: callsErr }, { data: bopsRows, error: bopsErr }, { data: fuRows, error: fuErr }] =
        await Promise.all([
          supabase
            .from("client_registrations")
            .select("CalledOn")
            .gte("CalledOn", startDaily.toISOString())
            .order("CalledOn", { ascending: true })
            .limit(50000),
          supabase
            .from("client_registrations")
            .select("BOP_Date")
            .gte("BOP_Date", startDaily.toISOString())
            .order("BOP_Date", { ascending: true })
            .limit(50000),
          supabase
            .from("client_registrations")
            .select("Followup_Date")
            .gte("Followup_Date", startDaily.toISOString())
            .order("Followup_Date", { ascending: true })
            .limit(50000),
        ]);
      if (callsErr) throw callsErr;
      if (bopsErr) throw bopsErr;
      if (fuErr) throw fuErr;

      const days: string[] = [];
      const callsDay = new Map<string, number>();
      const bopsDay = new Map<string, number>();
      const fuDay = new Map<string, number>();
      for (let i = 0; i < 60; i++) {
        const d = addDays(startDaily, i);
        const key = format(d, "yyyy-MM-dd");
        days.push(key);
        callsDay.set(key, 0);
        bopsDay.set(key, 0);
        fuDay.set(key, 0);
      }
      const bumpDay = (dateVal: any, map: Map<string, number>) => {
        if (!dateVal) return;
        const d = parseISO(String(dateVal));
        if (!isValid(d)) return;
        const k = format(d, "yyyy-MM-dd");
        if (map.has(k)) map.set(k, (map.get(k) ?? 0) + 1);
      };
      (callsRows ?? []).forEach((r: any) => bumpDay(r.CalledOn, callsDay));
      (bopsRows ?? []).forEach((r: any) => bumpDay(r.BOP_Date, bopsDay));
      (fuRows ?? []).forEach((r: any) => bumpDay(r.Followup_Date, fuDay));
      const nz = (n: number | undefined) => (n && n !== 0 ? n : undefined);

      setDaily60(
        days.map((day) => ({
          day,
          calls: nz(callsDay.get(day) ?? 0),
          bops: nz(bopsDay.get(day) ?? 0),
          followups: nz(fuDay.get(day) ?? 0),
        }))
      );

      // Rolling 12 months: current month + previous 11
      const startMonth = startOfMonth(subMonths(today, 11));
      const months: string[] = [];
      const callsMonth = new Map<string, number>();
      const bopsMonth = new Map<string, number>();
      const fuMonth = new Map<string, number>();
      for (let i = 0; i < 12; i++) {
        const mDate = addMonths(startMonth, i);
        const key = format(mDate, "yyyy-MM");
        months.push(key);
        callsMonth.set(key, 0);
        bopsMonth.set(key, 0);
        fuMonth.set(key, 0);
      }
      const [{ data: callsY, error: callsYErr }, { data: bopsY, error: bopsYErr }, { data: fuY, error: fuYErr }] =
        await Promise.all([
          supabase
            .from("client_registrations")
            .select("CalledOn")
            .gte("CalledOn", startMonth.toISOString())
            .lt("CalledOn", addMonths(endOfMonth(today), 1).toISOString())
            .order("CalledOn", { ascending: true })
            .limit(200000),
          supabase
            .from("client_registrations")
            .select("BOP_Date")
            .gte("BOP_Date", startMonth.toISOString())
            .lt("BOP_Date", addMonths(endOfMonth(today), 1).toISOString())
            .order("BOP_Date", { ascending: true })
            .limit(200000),
          supabase
            .from("client_registrations")
            .select("Followup_Date")
            .gte("Followup_Date", startMonth.toISOString())
            .lt("Followup_Date", addMonths(endOfMonth(today), 1).toISOString())
            .order("Followup_Date", { ascending: true })
            .limit(200000),
        ]);
      if (callsYErr) throw callsYErr;
      if (bopsYErr) throw bopsYErr;
      if (fuYErr) throw fuYErr;

      const bumpMonth = (dateVal: any, map: Map<string, number>) => {
        if (!dateVal) return;
        const d = parseISO(String(dateVal));
        if (!isValid(d)) return;
        const k = format(d, "yyyy-MM");
        if (map.has(k)) map.set(k, (map.get(k) ?? 0) + 1);
      };
      (callsY ?? []).forEach((r: any) => bumpMonth(r.CalledOn, callsMonth));
      (bopsY ?? []).forEach((r: any) => bumpMonth(r.BOP_Date, bopsMonth));
      (fuY ?? []).forEach((r: any) => bumpMonth(r.Followup_Date, fuMonth));

      setMonthly12(
        months.map((month) => ({
          month,
          calls: nz(callsMonth.get(month) ?? 0),
          bops: nz(bopsMonth.get(month) ?? 0),
          followups: nz(fuMonth.get(month) ?? 0),
        }))
      );
    } catch (e: any) {
      setError(e?.message ?? "Failed to load trends");
    } finally {
      setTrendLoading(false);
    }
  }

  /** -------- Upcoming Meetings (range) -------- */
  async function fetchUpcoming() {
    setUpcomingLoading(true);
    setError(null);
    try {
      const supabase = getSupabase();
      const start = new Date(rangeStart);
      const end = new Date(rangeEnd);
      const startIso = start.toISOString();
      const endIso = new Date(end.getTime() + 24 * 60 * 60 * 1000).toISOString();

      const { data: bopRows, error: bopErr } = await supabase
        .from("client_registrations")
        .select("*")
        .gte("BOP_Date", startIso)
        .lt("BOP_Date", endIso)
        .limit(5000);
      if (bopErr) throw bopErr;

      const { data: fuRows, error: fuErr } = await supabase
        .from("client_registrations")
        .select("*")
        .gte("Followup_Date", startIso)
        .lt("Followup_Date", endIso)
        .limit(5000);
      if (fuErr) throw fuErr;

      const map = new Map<string, any>();
      for (const r of bopRows ?? []) map.set(String((r as any).id), r);
      for (const r of fuRows ?? []) map.set(String((r as any).id), r);
      let merged = Array.from(map.values());

      const asc = sortUpcoming.dir === "asc";
      const key = sortUpcoming.key;
      const getVal = (r: any) => {
        if (key === "client") return `${r.first_name ?? ""} ${r.last_name ?? ""}`.trim();
        return r[key];
      };
      merged.sort((a: any, b: any) => {
        const av = getVal(a);
        const bv = getVal(b);
        if (key === "created_at" || key === "BOP_Date" || key === "Followup_Date" || key === "CalledOn" || key === "Issued") {
          const at = av ? new Date(av).getTime() : 0;
          const bt = bv ? new Date(bv).getTime() : 0;
          return asc ? at - bt : bt - at;
        }
        return asc
          ? String(av ?? "").localeCompare(String(bv ?? ""))
          : String(bv ?? "").localeCompare(String(av ?? ""));
      });

      setUpcoming(merged);
      setUpcomingVisible(true);
    } catch (e: any) {
      setError(e?.message ?? "Failed to load upcoming meetings");
    } finally {
      setUpcomingLoading(false);
    }
  }

  /** -------- All Records -------- */
  async function loadPage(nextPage: number) {
    setError(null);
    setLoading(true);
    try {
      const supabase = getSupabase();
      const search = q.trim();
      let countQuery = supabase
        .from("client_registrations")
        .select("id", { count: "exact", head: true });
      if (search)
        countQuery = countQuery.or(
          `first_name.ilike.%${search}%,last_name.ilike.%${search}%,phone.ilike.%${search}%`
        );
      const { count, error: cErr } = await countQuery;
      if (cErr) throw cErr;
      setTotal(count ?? 0);

      const from = nextPage * ALL_PAGE_SIZE;
      const to = from + ALL_PAGE_SIZE - 1;
      let dataQuery = supabase.from("client_registrations").select("*").range(from, to);
      if (search)
        dataQuery = dataQuery.or(
          `first_name.ilike.%${search}%,last_name.ilike.%${search}%,phone.ilike.%${search}%`
        );
      dataQuery = applySort(dataQuery, sortAll);
      const { data, error } = await dataQuery;
      if (error) throw error;

      setRecords(data ?? []);
      setPage(nextPage);
      setPageJump(String(nextPage + 1));
    } catch (e: any) {
      setError(e?.message ?? "Failed to load records");
    } finally {
      setLoading(false);
    }
  }

  async function updateCell(id: string, key: string, rawValue: string) {
    setSavingId(id);
    setError(null);
    try {
      const supabase = getSupabase();
      const payload: any = {};
      // Only save on blur; don't change DB while typing (existing behavior preserved).
      payload[key] = rawValue?.trim() ? rawValue : null;
      const { error } = await supabase
        .from("client_registrations")
        .update(payload)
        .eq("id", id);
      if (error) throw error;
      const patch = (prev: Row[]) =>
        prev.map((r) => (String(r.id) === String(id) ? { ...r, [key]: payload[key] } : r));
      setRecords(patch);
      setUpcoming(patch);
    } catch (e: any) {
      setError(e?.message ?? "Update failed");
      throw e;
    } finally {
      setSavingId(null);
    }
  }

  const totalPages = Math.max(1, Math.ceil((total ?? 0) / ALL_PAGE_SIZE));
  const canPrev = page > 0;
  const canNext = (page + 1) * ALL_PAGE_SIZE < total;

  const exportUpcomingXlsx = () => {
    const ws = XLSX.utils.json_to_sheet(upcoming);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Upcoming_BOP");
    XLSX.writeFile(wb, `Upcoming_${rangeStart}_to_${rangeEnd}.xlsx`);
  };

  const sortHelp = (
    <div className="text-xs text-slate-600">
      Click headers to sort: <b>Client Name</b>, <b>Created Date</b>, <b>BOP Date</b>,{" "}
      <b>BOP Status</b>, <b>Follow-Up Date</b>, <b>Status</b>.
    </div>
  );

  const extraClientCol = useMemo(
    () => [{ label: "Client Name", sortable: "client" as SortKey, render: (r: Row) => clientName(r) }],
    []
  );

  const allVisible = trendsVisible && upcomingVisible && recordsVisible;

  const toggleAllCards = () => {
    const target = !allVisible;
    setTrendsVisible(target);
    setUpcomingVisible(target);
    setRecordsVisible(target);
  };

  const hideZeroFormatter = (val: any) => {
    const n = Number(val);
    return Number.isFinite(n) && n === 0 ? "" : val;
  };

  /** -------- UI -------- */
  return (
    <div className="min-h-screen">
      <div className="max-w-[1600px] mx-auto p-6 space-y-6">
        {/* Header */}
        <header className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            {/* Logo — ensure it shows */}
            <img src="/can-logo.png" alt="CAN Financial Solutions" className="h-10 w-auto" />
            <div>
              <div className="text-2xl font-bold text-slate-800">CAN Financial Solutions Clients Report</div>
              {/* Subtitle in normal weight */}
              <div className="text-sm text-slate-500">Protecting Your Tomorrow</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="secondary" onClick={toggleAllCards}>
              {allVisible ? "Hide All" : "Show All"}
            </Button>
            <Button variant="secondary" onClick={logout}>
              <span className="inline-flex items-center gap-2">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-4 w-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a2 2 0 002 2h3a2 2 0 002-2v-1m-6-10V5a2 2 0 012-2h3a2 2 0 012 2v1"
                  />
                </svg>
                Logout
              </span>
            </Button>
          </div>
        </header>

        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-red-700">{error}</div>
        )}

        {/* Trends */}
        <Card title="Trends">
          <div className="flex items-center justify-end gap-2 mb-3">
            <Button variant="secondary" onClick={() => setTrendsVisible((v) => !v)}>
              {trendsVisible ? "Hide Results" : "Show Results"}
            </Button>
            <Button variant="secondary" onClick={() => fetchTrends().then(() => setTrendsVisible(true))}>
              Go
            </Button>
            <Button
              variant="secondary"
              onClick={() => {
                fetchTrends().then(() => setTrendsVisible(true));
              }}
            >
              Refresh
            </Button>
          </div>

          {trendsVisible ? (
            <>
              <div className="grid lg:grid-cols-2 gap-6">
                {/* Last 60 days — AreaChart for "flow" */}
                <div>
                  <div className="text-xs font-semibold text-slate-600 mb-2">Last 60 Days (Daily)</div>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={daily60}>
                        <XAxis dataKey="day" tick={{ fontSize: 11 }} />
                        <YAxis allowDecimals={false} />
                        <Tooltip />
                        <defs>
                          <linearGradient id="colorCalls" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#2563eb" stopOpacity={0.35} />
                            <stop offset="95%" stopColor="#2563eb" stopOpacity={0.05} />
                          </linearGradient>
                          <linearGradient id="colorBops" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#f97316" stopOpacity={0.35} />
                            <stop offset="95%" stopColor="#f97316" stopOpacity={0.05} />
                          </linearGradient>
                          <linearGradient id="colorFollowups" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#10b981" stopOpacity={0.35} />
                            <stop offset="95%" stopColor="#10b981" stopOpacity={0.05} />
                          </linearGradient>
                        </defs>
                        <Area type="monotone" dataKey="calls" stroke="#2563eb" fill="url(#colorCalls)" strokeWidth={2}>
                          <LabelList dataKey="calls" position="top" fill="#0f172a" formatter={hideZeroFormatter} />
                        </Area>
                        <Area type="monotone" dataKey="bops" stroke="#f97316" fill="url(#colorBops)" strokeWidth={2}>
                          <LabelList dataKey="bops" position="top" fill="#0f172a" formatter={hideZeroFormatter} />
                        </Area>
                        <Area type="monotone" dataKey="followups" stroke="#10b981" fill="url(#colorFollowups)" strokeWidth={2}>
                          <LabelList dataKey="followups" position="top" fill="#0f172a" formatter={hideZeroFormatter} />
                        </Area>
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Rolling 12 months — colored bars */}
                <div>
                  <div className="text-xs font-semibold text-slate-600 mb-2">Rolling 12 Months</div>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={monthly12}>
                        <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                        <YAxis allowDecimals={false} />
                        <Tooltip />
                        <Legend />
                        <Bar name="Calls" dataKey="calls" fill="#2563eb">
                          <LabelList dataKey="calls" position="top" fill="#0f172a" formatter={hideZeroFormatter} />
                        </Bar>
                        <Bar name="BOP" dataKey="bops" fill="#f97316">
                          <LabelList dataKey="bops" position="top" fill="#0f172a" formatter={hideZeroFormatter} />
                        </Bar>
                        <Bar name="Follow-ups" dataKey="followups" fill="#10b981">
                          <LabelList dataKey="followups" position="top" fill="#0f172a" formatter={hideZeroFormatter} />
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>
              {trendLoading && <div className="mt-2 text-xs text-slate-500">Loading…</div>}
            </>
          ) : (
            <div className="text-sm text-slate-600">Results are hidden.</div>
          )}
        </Card>

        {/* Upcoming Meetings (Editable) */}
        <Card title="Upcoming Meetings (Editable)">
          <div className="grid md:grid-cols-5 gap-3 items-end">
            <label className="block md:col-span-1">
              <div className="text-xs font-semibold text-slate-600 mb-1">Start</div>
              <input
                type="date"
                className="w-32 border border-slate-300 px-2 py-1"
                value={rangeStart}
                onChange={(e) => setRangeStart(e.target.value)}
              />
            </label>

            <label className="block md:col-span-1">
              <div className="text-xs font-semibold text-slate-600 mb-1">End</div>
              <input
                type="date"
                className="w-32 border border-slate-300 px-2 py-1"
                value={rangeEnd}
                onChange={(e) => setRangeEnd(e.target.value)}
              />
            </label>

            <div className="flex gap-2 md:col-span-3">
              <Button variant="secondary" onClick={() => fetchUpcoming()}>
                Go
              </Button>
              <Button
                variant="secondary"
                onClick={() => {
                  const today = new Date();
                  const start = format(today, "yyyy-MM-dd");
                  const end = endOfMonth(addMonths(today, 1));
                  setRangeStart(start);
                  setRangeEnd(format(end, "yyyy-MM-dd"));
                  fetchUpcoming();
                }}
                disabled={upcomingLoading}
              >
                {upcomingLoading ? "Refreshing…" : "Refresh"}
              </Button>
              <Button variant="secondary" onClick={exportUpcomingXlsx} disabled={upcoming.length === 0}>
                Export XLSX
              </Button>
              <Button variant="secondary" onClick={() => setUpcomingVisible((v) => !v)}>
                {upcomingVisible ? "Hide Results" : "Show Results"}
              </Button>
            </div>
          </div>

          <div className="flex items-center justify-between mb-2 mt-3">
            <div className="text-sm text-slate-600">Table supports vertical + horizontal scrolling.</div>
            {sortHelp}
          </div>

          {upcomingVisible && (
            <ExcelTableEditable
              rows={upcoming}
              savingId={savingId}
              onUpdate={updateCell}
              preferredOrder={[
                "status",
                "created_at",
                "first_name",
                "last_name",
                "phone",
                "email",
                "CalledOn",
                "BOP_Date",
                "BOP_Status",
                "Followup_Date",
                "FollowUp_Status",
                "interest_type",
                "business_opportunities",
                "wealth_solutions",
                "referred_by",
                "Comment",
                "Remark",
                "client_status",
              ]}
              extraLeftCols={[
                { label: "Client Name", sortable: "client", render: (r) => clientName(r) },
              ]}
              maxHeightClass="max-h-[420px]"
              sortState={sortUpcoming}
              onSortChange={(k) => setSortUpcoming((cur) => toggleSort(cur, k))}
              stickyLeftCount={1}
            />
          )}
        </Card>

        {/* All Records (Editable) */}
        <Card title="All Records (Editable)">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 mb-2">
            <div className="flex flex-col md:flex-row md:items-center gap-2 w-full">
              <input
                className="w-80 border border-slate-300 px-3 py-2"
                placeholder="Search by first name, last name, or phone"
                value={q}
                onChange={(e) => setQ(e.target.value)}
              />
              <Button variant="secondary" onClick={() => loadPage(0)}>
                Go
              </Button>
              <Button
                variant="secondary"
                onClick={() => {
                  setQ("");
                  loadPage(0);
                  setRecordsVisible(true);
                }}
              >
                Refresh
              </Button>
              <Button variant="secondary" onClick={() => setRecordsVisible((v) => !v)}>
                {recordsVisible ? "Hide Results" : "Show Results"}
              </Button>
            </div>

            <div className="flex items-center gap-2">
              {sortHelp}
              <div className="flex items-center gap-2 border border-slate-300 px-3 py-2 bg-white">
                <span className="text-xs font-semibold text-slate-600">Go to page</span>
                <input
                  type="number"
                  min={1}
                  max={totalPages}
                  className="w-20 border border-slate-300 px-2 py-1 text-sm"
                  value={pageJump}
                  onChange={(e) => setPageJump(e.target.value)}
                />
                <Button
                  variant="secondary"
                  onClick={() => {
                    const n = Number(pageJump);
                    if (!Number.isFinite(n)) return;
                    const p = Math.min(totalPages, Math.max(1, Math.floor(n)));
                    loadPage(p - 1);
                  }}
                  disabled={loading || totalPages <= 1}
                >
                  Go
                </Button>
              </div>
              <Button
                variant="secondary"
                onClick={() => loadPage(Math.max(0, page - 1))}
                disabled={!canPrev || loading}
              >
                Previous
              </Button>
              <Button
                variant="secondary"
                onClick={() => loadPage(page + 1)}
                disabled={!canNext || loading}
              >
                Next
              </Button>
            </div>
          </div>

          <div className="text-sm text-slate-600 mb-2">
            {total.toLocaleString()} records • showing {ALL_PAGE_SIZE} per page
          </div>

          {recordsVisible && (
            <>
              {loading ? (
                <div className="text-slate-600">Loading…</div>
              ) : (
                <ExcelTableEditable
                  rows={records}
                  savingId={savingId}
                  onUpdate={updateCell}
                  extraLeftCols={extraClientCol}
                  maxHeightClass="max-h-[560px]"
                  sortState={sortAll}
                  onSortChange={(k) => setSortAll((cur) => toggleSort(cur, k))}
                  stickyLeftCount={1}
                />
              )}
            </>
          )}
        </Card>
      </div>
    </div>
  );
}

/** -------- Editable table (core logic preserved) -------- */
function ExcelTableEditable({
  rows,
  savingId,
  onUpdate,
  extraLeftCols,
  maxHeightClass,
  sortState,
  onSortChange,
  preferredOrder,
  stickyLeftCount = 1,
}: {
  rows: Row[];
  savingId: string | null;
  onUpdate: (id: string, key: string, value: string) => Promise<void>;
  extraLeftCols: { label: string; render: (r: Row) => string; sortable?: SortKey }[];
  maxHeightClass: string;
  sortState: { key: SortKey; dir: SortDir };
  onSortChange: (key: SortKey) => void;
  preferredOrder?: string[];
  stickyLeftCount?: number;
}) {
  const { widths, startResize } = useColumnResizer();
  const [openCell, setOpenCell] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, string>>({});

  const sortIcon = (k?: SortKey) => {
    if (!k) return null;
    if (sortState.key !== k) return <span className="ml-1 text-slate-400">↕</span>;
    return <span className="ml-1 text-slate-700">{sortState.dir === "asc" ? "↑" : "↓"}</span>;
  };

  const DATE_TIME_KEYS = new Set(["BOP_Date", "CalledOn", "Followup_Date", "Issued", "FollowUp_Date"]);

  const keys = useMemo(() => {
    if (!rows.length) return [] as string[];
    const baseKeys = Object.keys(rows[0]).filter((k) => k !== "id");
    if (!preferredOrder || !preferredOrder.length) return baseKeys;
    const set = new Set(baseKeys);
    const ordered: string[] = [];
    for (const k of preferredOrder) if (set.has(k)) ordered.push(k);
    for (const k of baseKeys) if (!ordered.includes(k)) ordered.push(k);
    return ordered;
  }, [rows, preferredOrder]);

  const columns = useMemo(() => {
    const extra = extraLeftCols.map((c, i) => ({
      id: `extra:${i}`,
      label: c.label,
      sortable: c.sortable,
      kind: "extra" as const,
      defaultW: c.label.toLowerCase().includes("client") ? 180 : 150,
    }));
    const main = keys.map((k) => {
      const label = labelFor(k);
      const isDateTime = DATE_TIME_KEYS.has(k);
      const defaultW =
        k === "created_at"
          ? 120
          : isDateTime
          ? 220
          : k.toLowerCase().includes("email")
          ? 240
          : 160;
      const sortable =
        k === "created_at"
          ? ("created_at" as SortKey)
          : k === "BOP_Date"
          ? ("BOP_Date" as SortKey)
          : k === "BOP_Status"
          ? ("BOP_Status" as SortKey)
          : k === "Followup_Date"
          ? ("Followup_Date" as SortKey)
          : k === "status"
          ? ("status" as SortKey)
          : k === "CalledOn"
          ? ("CalledOn" as SortKey)
          : k === "Issued"
          ? ("Issued" as SortKey)
          : undefined;
      return {
        id: `col:${k}`,
        key: k,
        label,
        sortable,
        kind: "data" as const,
        defaultW,
      };
    });
    return [...extra, ...main];
  }, [extraLeftCols, keys]);

  const getW = (id: string, def: number) => widths[id] ?? def;

  const stickyLeftPx = (colIndex: number) => {
    let left = 0;
    for (let i = 0; i < colIndex; i++) {
      const c = (columns as any)[i];
      left += getW(c.id, c.defaultW ?? 160);
    }
    return left;
  };

  const minWidth = (columns as any).reduce((sum: number, c: any) => sum + getW(c.id, c.defaultW ?? 160), 0);

  const getCellValueForInput = (r: Row, k: string) => {
    const isDateTime = DATE_TIME_KEYS.has(k);
    const val = r[k];
    if (isDateTime) return toLocalInput(val);
    return val ?? "";
  };

  const handleBlur = async (rowId: string, key: string, cellId: string) => {
    const v = drafts[cellId] ?? "";
    try {
      await onUpdate(String(rowId), key, v);
    } finally {
      setDrafts((prev) => {
        const next = { ...prev };
        delete next[cellId];
        return next;
      });
    }
  };

  return (
    <div className={`overflow-auto border border-slate-500 bg-white ${maxHeightClass}`}>
      <table className="w-full table-fixed border-collapse" style={{ minWidth }}>
        <thead className="sticky top-0 bg-slate-100 z-20">
          <tr className="text-left text-xs font-semibold text-slate-700">
            {(columns as any).map((c: any, colIndex: number) => {
              const w = getW(c.id, c.defaultW ?? 160);
              const isSticky = colIndex < stickyLeftCount;
              const isTopLeft = isSticky;
              const style: React.CSSProperties = {
                width: w,
                minWidth: w,
                maxWidth: w,
                position: isSticky ? "sticky" : undefined,
                left: isSticky ? stickyLeftPx(colIndex) : undefined,
                top: 0,
                zIndex: isTopLeft ? 50 : 20,
                background: isSticky ? "#f1f5f9" : undefined,
              };
              const headerLabel = c.label;
              return (
                <th
                  key={c.id}
                  className="border border-slate-500 px-2 py-2 whitespace-nowrap relative"
                  style={style}
                >
                  {c.sortable ? (
                    <button
                      className="inline-flex items-center hover:underline"
                      onClick={() => onSortChange(c.sortable)}
                      type="button"
                    >
                      {headerLabel}
                      {sortIcon(c.sortable)}
                    </button>
                  ) : (
                    headerLabel
                  )}
                  <div
                    className="absolute top-0 right-0 h-full w-2 cursor-col-resize select-none"
                    onMouseDown={(e) => startResize(e, c.id, w)}
                  >
                    <div className="mx-auto h-full w-px bg-slate-300" />
                  </div>
                </th>
              );
            })}
          </tr>
        </thead>

        <tbody>
          {rows.map((r, ridx) => (
            <tr key={String(r.id ?? ridx)} className="hover:bg-slate-50">
              {(columns as any).map((c: any, colIndex: number) => {
                const w = getW(c.id, c.defaultW ?? 160);
                const isSticky = colIndex < stickyLeftCount;
                const style: React.CSSProperties = {
                  width: w,
                  minWidth: w,
                  maxWidth: w,
                  position: isSticky ? "sticky" : undefined,
                  left: isSticky ? stickyLeftPx(colIndex) : undefined,
                  zIndex: isSticky ? 10 : 1,
                  background: isSticky ? "#ffffff" : undefined,
                };

                // EXTRA COLUMNS (non-editable)
                if (c.kind === "extra") {
                  const idx = Number(String(c.id).split(":")[1] ?? "0");
                  const colDef = extraLeftCols[idx];
                  const v = colDef?.render ? colDef.render(r) : "";
                  return (
                    <td
                      key={c.id}
                      className={`border border-slate-300 px-2 py-2 whitespace-nowrap font-semibold text-slate-800`}
                      style={style}
                    >
                      {v}
                    </td>
                  );
                }

                const k = c.key as string;

                // created_at shown as date (not editable)
                if (k === "created_at") {
                  const d = new Date(r.created_at);
                  const v = Number.isNaN(d.getTime()) ? "" : d.toLocaleDateString();
                  return (
                    <td key={c.id} className="border border-slate-300 px-2 py-2 whitespace-nowrap" style={style}>
                      {v}
                    </td>
                  );
                }

                // Read-only list viewer example (unchanged behavior)
                const READONLY_LIST_COLS = new Set(["interest_type", "business_opportunities", "wealth_solutions", "preferred_days"]);
                if (READONLY_LIST_COLS.has(k)) {
                  const cellId = `${r.id}:${k}`;
                  const items = asListItems(r[k]);
                  const display = items.join(", ");
                  return (
                    <td key={c.id} className="border border-slate-300 px-2 py-2 align-top" style={style}>
                      <div className="relative">
                        <button
                          type="button"
                          className="w-full text-left text-slate-800 whitespace-normal break-words"
                          onClick={() => setOpenCell((cur) => (cur === cellId ? null : cellId))}
                        >
                          {display || "—"}
                        </button>
                        {openCell === cellId && (
                          <div className="absolute left-0 top-full mt-1 w-72 max-w-[70vw] bg-white border border-slate-500 shadow-lg z-30">
                            <div className="px-2 py-1 text-xs font-semibold text-slate-700 bg-slate-100 border-b border-slate-300">
                              {labelFor(k)}
                            </div>
                            <ul className="max-h-48 overflow-auto">
                              {(items.length ? items : ["(empty)"]).map((x, i) => (
                                <li key={i} className="px-2 py-1 text-sm border-b border-slate-100">
                                  {x}
                                </li>
                              ))}
                            </ul>
                            <div className="p-2">
                              <Button variant="secondary" onClick={() => setOpenCell(null)}>
                                Close
                              </Button>
                            </div>
                          </div>
                        )}
                      </div>
                    </td>
                  );
                }

                // ---- EDITABLE CELLS ----
                const cellId = `${r.id}:${k}`;
                const isDateTime = DATE_TIME_KEYS.has(k);
                const value =
                  drafts[cellId] !== undefined ? drafts[cellId] : String(getCellValueForInput(r, k));

                return (
                  <td key={c.id} className="border border-slate-300 px-2 py-2" style={style}>
                    <input
                      type={isDateTime ? "datetime-local" : "text"}
                      step={isDateTime ? 60 : undefined}
                      className="w-full bg-transparent border-0 outline-none text-sm"
                      value={value}
                      onChange={(e) =>
                        setDrafts((prev) => ({ ...prev, [cellId]: e.target.value }))
                      }
                      onBlur={() => handleBlur(String(r.id), k, cellId)}
                      disabled={savingId != null && String(savingId) === String(r.id)}
                    />
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
