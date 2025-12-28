"use client";

export const dynamic = "force-dynamic";

import React, { useEffect, useMemo, useRef, useState } from "react";
import * as XLSX from "xlsx";
import {
  addDays,
  addYears,
  endOfWeek,
  format,
  isValid,
  parseISO,
  startOfWeek,
  startOfYear,
  subWeeks,
} from "date-fns";
import {
  ResponsiveContainer,
  LineChart,
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
  | "client_name"
  | "last_call_date"
  | "call_attempts"
  | "last_bop_date"
  | "bop_attempts"
  | "last_followup_date"
  | "followup_attempts";
type SortDir = "asc" | "desc";

const PAGE_SIZE_ALL = 20;
const PAGE_SIZE_PROGRESS = 20;

const READONLY_LIST_COLS = new Set([
  "interest_type",
  "business_opportunities",
  "wealth_solutions",
  "preferred_days",
]);

const LABEL_OVERRIDES: Record<string, string> = {
  client_name: "Client Name",
  first_name: "First Name",
  last_name: "Last Name",
  phone: "Phone",
  email: "Email",
  last_call_date: "Last Call On",
  call_attempts: "No of Calls",
  last_bop_date: "Last BOP Call On",
  bop_attempts: "No of BOP Calls",
  last_followup_date: "Last FollowUp On",
  followup_attempts: "No of FollowUp Calls",
  created_at: "Created Date",
  interest_type: "Interest Type",
  business_opportunities: "Business Opportunities",
  wealth_solutions: "Wealth Solutions",
  preferred_days: "Preferred Days",
  preferred_time: "Preferred Time",
  referred_by: "Referred By",
  CalledOn: "Called On",
  BOP_Date: "BOP Date",
  BOP_Status: "BOP Status",
  Followup_Date: "Follow-Up Date",
  FollowUp_Status: "Follow-Up Status",
};

function labelFor(key: string) {
  if (LABEL_OVERRIDES[key]) return LABEL_OVERRIDES[key];
  const s = key
    .replace(/_/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .trim();
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

function clientName(r: Row) {
  return `${r.first_name || ""} ${r.last_name || ""}`.trim();
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

function toggleSort(cur: { key: SortKey; dir: SortDir }, k: SortKey) {
  if (cur.key !== k) return { key: k, dir: "asc" as SortDir };
  return { key: k, dir: cur.dir === "asc" ? ("desc" as SortDir) : ("asc" as SortDir) };
}

function ciIncludes(hay: any, needle: string) {
  const h = String(hay ?? "").toLowerCase();
  const n = String(needle ?? "").toLowerCase().trim();
  if (!n) return true;
  return h.includes(n);
}

export default function Dashboard() {
  const [error, setError] = useState<string | null>(null);

  // Trends
  const [weekly, setWeekly] = useState<{ weekEnd: string; prospects: number; bops: number }[]>([]);
  const [monthly, setMonthly] = useState<{ month: string; prospects: number; bops: number }[]>([]);
  const [trendLoading, setTrendLoading] = useState(false);

  // Upcoming
  const [rangeStart, setRangeStart] = useState(format(new Date(), "yyyy-MM-dd"));
  const [rangeEnd, setRangeEnd] = useState(format(addDays(new Date(), 30), "yyyy-MM-dd"));
  const [upcoming, setUpcoming] = useState<Row[]>([]);
  const [upcomingLoading, setUpcomingLoading] = useState(false);
  const [sortUpcoming, setSortUpcoming] = useState<{ key: SortKey; dir: SortDir }>({
    key: "BOP_Date",
    dir: "asc",
  });
  const [upcomingVisible, setUpcomingVisible] = useState(false);

  // Client Progress Summary
  const [progressRows, setProgressRows] = useState<Row[]>([]);
  const [progressLoading, setProgressLoading] = useState(false);
  const [progressFilter, setProgressFilter] = useState("");
  const [progressSort, setProgressSort] = useState<{ key: SortKey; dir: SortDir }>({
    key: "client_name",
    dir: "asc",
  });
  const [progressPage, setProgressPage] = useState(0);
  const [progressVisible, setProgressVisible] = useState(true);

  // Search + All Records
  const [q, setQ] = useState("");
  const [filterClient, setFilterClient] = useState("");
  const [filterInterestType, setFilterInterestType] = useState("");
  const [filterBusinessOpp, setFilterBusinessOpp] = useState("");
  const [filterWealthSolutions, setFilterWealthSolutions] = useState("");
  const [filterBopStatus, setFilterBopStatus] = useState("");
  const [filterFollowUpStatus, setFilterFollowUpStatus] = useState("");

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
        setError(e?.message || "Failed to initialize");
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
    if (upcoming.length) fetchUpcoming(); // re-sort in place when sort changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sortUpcoming.key, sortUpcoming.dir]);

  function applySort(query: any, sort: { key: SortKey; dir: SortDir }) {
    const ascending = sort.dir === "asc";
    if (sort.key === "client") return query.order("first_name", { ascending }).order("last_name", { ascending });
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

  async function fetchTrends() {
    setTrendLoading(true);
    setError(null);
    try {
      const supabase = getSupabase();
      const start = startOfWeek(subWeeks(new Date(), 4), { weekStartsOn: 1 });

      const { data: createdRows, error: createdErr } = await supabase
        .from("client_registrations")
        .select("created_at, BOP_Date")
        .gte("created_at", start.toISOString())
        .order("created_at", { ascending: true })
        .limit(100000);

      if (createdErr) throw createdErr;

      const weekEnds: string[] = [];
      const weekCount = new Map<string, number>();
      const bopWeekCount = new Map<string, number>();
      for (let i = 4; i >= 0; i--) {
        const wkStart = startOfWeek(subWeeks(new Date(), i), { weekStartsOn: 1 });
        const wkEnd = endOfWeek(wkStart, { weekStartsOn: 1 });
        const key = format(wkEnd, "yyyy-MM-dd");
        weekEnds.push(key);
        weekCount.set(key, 0);
        bopWeekCount.set(key, 0);
      }

      for (const r of createdRows || []) {
        const created = parseISO(String((r as any).created_at));
        if (isValid(created)) {
          const wkEnd = endOfWeek(created, { weekStartsOn: 1 });
          const key = format(wkEnd, "yyyy-MM-dd");
          if (weekCount.has(key)) weekCount.set(key, (weekCount.get(key) || 0) + 1);
        }

        const bopRaw = (r as any).BOP_Date;
        if (bopRaw) {
          const bop = parseISO(String(bopRaw));
          if (isValid(bop)) {
            const wkEnd2 = endOfWeek(bop, { weekStartsOn: 1 });
            const key2 = format(wkEnd2, "yyyy-MM-dd");
            if (bopWeekCount.has(key2)) bopWeekCount.set(key2, (bopWeekCount.get(key2) || 0) + 1);
          }
        }
      }

      setWeekly(
        weekEnds.map((weekEnd) => ({
          weekEnd,
          prospects: weekCount.get(weekEnd) || 0,
          bops: bopWeekCount.get(weekEnd) || 0,
        }))
      );

      const yearStart = startOfYear(new Date());
      const nextYear = addYears(yearStart, 1);

      const { data: yearRows, error: yearErr } = await supabase
        .from("client_registrations")
        .select("created_at, BOP_Date")
        .gte("created_at", yearStart.toISOString())
        .lt("created_at", nextYear.toISOString())
        .order("created_at", { ascending: true })
        .limit(200000);

      if (yearErr) throw yearErr;

      const y = yearStart.getFullYear();
      const monthCount = new Map<string, number>();
      const bopMonthCount = new Map<string, number>();
      for (let m = 1; m <= 12; m++) {
        const k = `${y}-${String(m).padStart(2, "0")}`;
        monthCount.set(k, 0);
        bopMonthCount.set(k, 0);
      }

      for (const r of yearRows || []) {
        const created = parseISO(String((r as any).created_at));
        if (isValid(created)) {
          const key = format(created, "yyyy-MM");
          if (monthCount.has(key)) monthCount.set(key, (monthCount.get(key) || 0) + 1);
        }

        const bopRaw = (r as any).BOP_Date;
        if (bopRaw) {
          const bop = parseISO(String(bopRaw));
          if (isValid(bop)) {
            const key2 = format(bop, "yyyy-MM");
            if (bopMonthCount.has(key2)) bopMonthCount.set(key2, (bopMonthCount.get(key2) || 0) + 1);
          }
        }
      }

      setMonthly(
        Array.from(monthCount.keys()).map((month) => ({
          month,
          prospects: monthCount.get(month) || 0,
          bops: bopMonthCount.get(month) || 0,
        }))
      );
    } catch (e: any) {
      setError(e?.message || "Failed to load trends");
    } finally {
      setTrendLoading(false);
    }
  }

  async function fetchUpcoming() {
    setUpcomingLoading(true);
    setError(null);
    try {
      const supabase = getSupabase();
      const start = new Date(rangeStart);
      const end = new Date(rangeEnd);
      const startIso = start.toISOString();
      const endIso = new Date(end.getTime() + 24 * 60 * 60 * 1000).toISOString();

      let query = supabase
        .from("client_registrations")
        .select("*")
        .gte("BOP_Date", startIso)
        .lt("BOP_Date", endIso)
        .limit(5000);

      query = applySort(query, sortUpcoming);

      const { data, error } = await query;
      if (error) throw error;

      setUpcoming(data || []);
      setUpcomingVisible(true); // show after loading
    } catch (e: any) {
      setError(e?.message || "Failed to load upcoming meetings");
    } finally {
      setUpcomingLoading(false);
    }
  }

  async function fetchProgressSummary() {
    setProgressLoading(true);
    setError(null);
    try {
      const supabase = getSupabase();
      const { data, error } = await supabase
        .from("v_client_progress_summary")
        .select(
          "clientid, first_name, last_name, phone, email, last_call_date, call_attempts, last_bop_date, bop_attempts, last_followup_date, followup_attempts"
        )
        .order("clientid", { ascending: false })
        .limit(5000);

      if (error) throw error;

      const rows = (data || []).map((r: any) => ({
        clientid: r.clientid,
        client_name: `${r.first_name || ""} ${r.last_name || ""}`.trim(),
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

      setProgressRows(rows);
      setProgressPage(0);
    } catch (e: any) {
      setError(e?.message || "Failed to load Client Progress Summary");
    } finally {
      setProgressLoading(false);
    }
  }

  async function loadPage(nextPage: number) {
    setError(null);
    setLoading(true);
    try {
      const supabase = getSupabase();

      const search = q.trim();
      const fc = filterClient.trim();
      const fi = filterInterestType.trim();
      const fb = filterBopStatus.trim();

      let countQuery = supabase.from("client_registrations").select("id", { count: "exact", head: true });

      if (search)
        countQuery = countQuery.or(
          `first_name.ilike.%${search}%,last_name.ilike.%${search}%,phone.ilike.%${search}%`
        );
      if (fc) countQuery = countQuery.or(`first_name.ilike.%${fc}%,last_name.ilike.%${fc}%`);
      if (fi) countQuery = countQuery.ilike("interest_type", fi);
      if (fb) countQuery = countQuery.ilike("BOP_Status", fb);

      const { count, error: cErr } = await countQuery;
      if (cErr) throw cErr;
      setTotal(count ?? 0);

      const from = nextPage * PAGE_SIZE_ALL;
      const to = from + PAGE_SIZE_ALL - 1;

      let dataQuery = supabase.from("client_registrations").select("*").range(from, to);

      if (search)
        dataQuery = dataQuery.or(
          `first_name.ilike.%${search}%,last_name.ilike.%${search}%,phone.ilike.%${search}%`
        );
      if (fc) dataQuery = dataQuery.or(`first_name.ilike.%${fc}%,last_name.ilike.%${fc}%`);
      if (fi) dataQuery = dataQuery.ilike("interest_type", fi);
      if (fb) dataQuery = dataQuery.ilike("BOP_Status", fb);

      dataQuery = applySort(dataQuery, sortAll);

      const { data, error } = await dataQuery;
      if (error) throw error;

      const raw = (data || []) as any[];

      // client-side contains filters (case-insensitive)
      const fbo = filterBusinessOpp.trim();
      const fws = filterWealthSolutions.trim();
      const ffu = filterFollowUpStatus.trim();

      const clientSideFiltered = raw.filter((row) => {
        const opp = Array.isArray(row.business_opportunities)
          ? row.business_opportunities.join(",")
          : String(row.business_opportunities || "");
        const ws = Array.isArray(row.wealth_solutions) ? row.wealth_solutions.join(",") : String(row.wealth_solutions || "");
        const fu = String(row.FollowUp_Status ?? row.Followup_Status ?? "");

        const okOpp = !fbo || ciIncludes(opp, fbo);
        const okWs = !fws || ciIncludes(ws, fws);
        const okFu = !ffu || ciIncludes(fu, ffu);
        return okOpp && okWs && okFu;
      });

      setRecords(clientSideFiltered);
      setPage(nextPage);
      setPageJump(String(nextPage + 1));
    } catch (e: any) {
      setError(e?.message || "Failed to load records");
    } finally {
      setLoading(false);
    }
  }

  const totalPages = Math.max(1, Math.ceil((total || 0) / PAGE_SIZE_ALL));
  const canPrev = page > 0;
  const canNext = page + 1 < totalPages;

  const exportUpcomingXlsx = () => {
    const ws = XLSX.utils.json_to_sheet(upcoming);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Upcoming_BOP");
    XLSX.writeFile(wb, `Upcoming_BOP_${rangeStart}_to_${rangeEnd}.xlsx`);
  };

  const updateCell = async (id: string, key: string, rawValue: string) => {
    setSavingId(id);
    setError(null);
    try {
      const supabase = getSupabase();
      const payload: any = {};
      const isDateTime = key === "BOP_Date" || key === "CalledOn" || key === "Followup_Date" || key === "Issued";
      payload[key] = isDateTime ? fromLocalInput(rawValue) : rawValue?.trim() ? rawValue : null;

      const { error } = await supabase.from("client_registrations").update(payload).eq("id", id);
      if (error) throw error;

      // Patch UI immediately after successful save
      const patch = (prev: Row[]) =>
        prev.map((r) => (String(r.id) === String(id) ? { ...r, [key]: payload[key] } : r));
      setRecords(patch);
      setUpcoming(patch);
    } catch (e: any) {
      setError(e?.message || "Update failed");
    } finally {
      setSavingId(null);
    }
  };

  const sortHelp = (
    <div className="text-xs text-slate-600">
      Click headers to sort: <b>Client Name</b>, <b>Created Date</b>, <b>BOP Date</b>, <b>BOP Status</b>,{" "}
      <b>Follow-Up Date</b>, <b>Status</b>.
    </div>
  );

  const extraClientCol = useMemo(
    () => [{ label: "Client Name", sortable: "client" as SortKey, render: (r: Row) => clientName(r) }],
    []
  );

  // ----- Progress: filter + sort + paginate (client-side) -----
  const progressFilteredSorted = useMemo(() => {
    const f = progressFilter.trim().toLowerCase();
    const filtered = !f
      ? progressRows
      : progressRows.filter((r) => String(r.client_name ?? "").toLowerCase().includes(f));

    const { key, dir } = progressSort;
    const asc = dir === "asc" ? 1 : -1;

    const valNum = (x: any) => {
      const n = Number(x);
      return Number.isFinite(n) ? n : -1;
    };

    const valDate = (x: any) => {
      if (!x) return -1;
      const d = new Date(x).getTime();
      return Number.isFinite(d) ? d : -1;
    };

    const sorted = [...filtered].sort((a, b) => {
      if (key === "client_name") return String(a.client_name ?? "").localeCompare(String(b.client_name ?? "")) * asc;
      if (key === "call_attempts") return (valNum(a.call_attempts) - valNum(b.call_attempts)) * asc;
      if (key === "bop_attempts") return (valNum(a.bop_attempts) - valNum(b.bop_attempts)) * asc;
      if (key === "followup_attempts") return (valNum(a.followup_attempts) - valNum(b.followup_attempts)) * asc;
      if (key === "last_call_date") return (valDate(a.last_call_date) - valDate(b.last_call_date)) * asc;
      if (key === "last_bop_date") return (valDate(a.last_bop_date) - valDate(b.last_bop_date)) * asc;
      if (key === "last_followup_date") return (valDate(a.last_followup_date) - valDate(b.last_followup_date)) * asc;
      return 0;
    });

    return sorted;
  }, [progressRows, progressFilter, progressSort]);

  const progressTotalPages = Math.max(1, Math.ceil(progressFilteredSorted.length / PAGE_SIZE_PROGRESS));
  const progressCanPrev = progressPage > 0;
  const progressCanNext = progressPage + 1 < progressTotalPages;

  const progressPageRows = useMemo(() => {
    const from = progressPage * PAGE_SIZE_PROGRESS;
    const to = from + PAGE_SIZE_PROGRESS;
    return progressFilteredSorted.slice(from, to);
  }, [progressFilteredSorted, progressPage]);

  return (
    <div className="min-h-screen">
      <div className="max-w-[1600px] mx-auto p-6 space-y-6">
        <header className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <img src="/can-logo.png" className="h-10 w-auto" alt="CAN Financial Solutions" />
            <div>
              <div className="text-2xl font-bold text-slate-800">CAN Financial Solutions Clients Report</div>
              <div className="text-sm text-slate-500">Excel-style tables, editable follow-ups, and trends</div>
            </div>
          </div>

          <Button variant="secondary" onClick={logout}>
            Logout
          </Button>
        </header>

        {error && <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-red-700">{error}</div>}

        {/* Trends */}
        <Card title="Trends">
          <div className="flex items-center justify-end mb-3">
            <Button variant="secondary" onClick={fetchTrends}>
              Refresh
            </Button>
          </div>

          <div className="grid lg:grid-cols-2 gap-6">
            <div>
              <div className="text-xs font-semibold text-slate-600 mb-2">
                Weekly = No of Prespect vs BOP (last 5 weeks incl current)
              </div>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={weekly}
                    margin={{ top: 26, right: 16, left: 0, bottom: 8 }}
                  >
                    <XAxis dataKey="weekEnd" tick={{ fontSize: 11 }} />
                    <YAxis allowDecimals={false} width={36} />
                    <Tooltip />
                    <Legend />
                    <Line type="monotone" dataKey="prospects" stroke="#2563eb" dot>
                      <LabelList dataKey="prospects" position="top" offset={10} />
                    </Line>
                    <Line type="monotone" dataKey="bops" stroke="#f97316" dot>
                      <LabelList dataKey="bops" position="top" offset={10} />
                    </Line>
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div>
              <div className="text-xs font-semibold text-slate-600 mb-2">Monthly (Current Year)</div>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={monthly}
                    margin={{ top: 26, right: 16, left: 0, bottom: 8 }}
                    barCategoryGap={8}
                  >
                    <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                    <YAxis allowDecimals={false} width={36} />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="prospects" fill="#16a34a">
                      <LabelList dataKey="prospects" position="top" offset={10} />
                    </Bar>
                    <Bar dataKey="bops" fill="#9333ea">
                      <LabelList dataKey="bops" position="top" offset={10} />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {trendLoading && <div className="mt-2 text-xs text-slate-500">Loading…</div>}
        </Card>

        {/* Upcoming range */}
        <Card title="Upcoming BOP Date Range">
          <div className="grid md:grid-cols-5 gap-3 items-end">
            <label className="block md:col-span-2">
              <div className="text-xs font-semibold text-slate-600 mb-1">Start</div>
              <input
                type="date"
                className="w-full border border-slate-300 px-3 py-2"
                value={rangeStart}
                onChange={(e) => setRangeStart(e.target.value)}
              />
            </label>
            <label className="block md:col-span-2">
              <div className="text-xs font-semibold text-slate-600 mb-1">End</div>
              <input
                type="date"
                className="w-full border border-slate-300 px-3 py-2"
                value={rangeEnd}
                onChange={(e) => setRangeEnd(e.target.value)}
              />
            </label>
            <div className="flex gap-2 md:col-span-1">
              <Button onClick={fetchUpcoming} disabled={upcomingLoading}>
                {upcomingLoading ? "Loading…" : "Load"}
              </Button>
              <Button variant="secondary" onClick={exportUpcomingXlsx} disabled={upcoming.length === 0}>
                Export XLSX
              </Button>
            </div>
          </div>

          <div className="mt-3">
            <Button
              variant="secondary"
              onClick={() => setUpcomingVisible((v) => !v)}
              disabled={upcoming.length === 0}
            >
              {upcomingVisible ? "Hide Upcoming Table" : "Show Upcoming Table"}
            </Button>
            <span className="ml-3 text-xs text-slate-500">
              After you press Load, you can show/hide the Upcoming table.
            </span>
          </div>
        </Card>

        {/* Upcoming table */}
        {upcomingVisible && upcoming.length > 0 && (
          <Card title="Upcoming BOP Meetings (Editable)">
            <div className="flex items-center justify-between mb-2">
              <div className="text-sm text-slate-600">Table supports vertical + horizontal scrolling.</div>
              {sortHelp}
            </div>

            <ExcelTable
              rows={upcoming}
              savingId={savingId}
              onUpdate={updateCell}
              preferredOrder={["BOP_Date", "created_at", "BOP_Status", "Followup_Date", "status"]}
              extraLeftCols={[
                { label: "Client Name", sortable: "client", render: (r) => clientName(r) },
              ]}
              maxHeightClass="max-h-[420px]"
              sortState={sortUpcoming}
              onSortChange={(k) => setSortUpcoming((cur) => toggleSort(cur, k))}
              stickyLeftCount={1}
            />
          </Card>
        )}

        {/* Client Progress Summary */}
        <Card title="Client Progress Summary">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 mb-3">
            <div className="flex flex-col md:flex-row gap-2 md:items-center">
              <input
                className="w-full md:w-[420px] border border-slate-300 px-4 py-3"
                placeholder="Filter by client name..."
                value={progressFilter}
                onChange={(e) => {
                  setProgressFilter(e.target.value);
                  setProgressPage(0);
                }}
              />
              <Button variant="secondary" onClick={fetchProgressSummary} disabled={progressLoading}>
                {progressLoading ? "Loading…" : "Refresh"}
              </Button>

              <Button
                variant="secondary"
                onClick={() => setProgressVisible((v) => !v)}
                disabled={progressRows.length === 0}
              >
                {progressVisible ? "Hide Table" : "Show Table"}
              </Button>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="secondary"
                onClick={() => setProgressPage((p) => Math.max(0, p - 1))}
                disabled={!progressCanPrev || !progressVisible}
              >
                Previous
              </Button>
              <Button
                variant="secondary"
                onClick={() => setProgressPage((p) => Math.min(progressTotalPages - 1, p + 1))}
                disabled={!progressCanNext || !progressVisible}
              >
                Next
              </Button>
            </div>
          </div>

          {progressVisible && (
            <ExcelTable
              rows={progressPageRows}
              savingId={null}
              onUpdate={() => {}}
              extraLeftCols={[{ label: "Client Name", sortable: "client_name" as SortKey, render: (r) => String(r.client_name || "") }]}
              maxHeightClass="max-h-[520px]"
              sortState={progressSort}
              onSortChange={(k) => setProgressSort((cur) => toggleSort(cur, k))}
              preferredOrder={[
                "first_name",
                "last_name",
                "phone",
                "email",
                "last_call_date",
                "call_attempts",
                "last_bop_date",
                "bop_attempts",
                "last_followup_date",
                "followup_attempts",
              ]}
              stickyLeftCount={1}
              readOnlyAll
              customSortables={{
                client_name: "client_name",
                last_call_date: "last_call_date",
                call_attempts: "call_attempts",
                last_bop_date: "last_bop_date",
                bop_attempts: "bop_attempts",
                last_followup_date: "last_followup_date",
                followup_attempts: "followup_attempts",
              }}
              onHeaderSort={(k) => setProgressSort((cur) => toggleSort(cur, k))}
            />
          )}
        </Card>

        {/* Search */}
        <Card title="Search">
          <div className="flex flex-col md:flex-row gap-2 md:items-center">
            <input
              className="w-full border border-slate-300 px-4 py-3"
              placeholder="Search by first name, last name, or phone"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
            <Button onClick={() => loadPage(0)}>Go</Button>
            <div className="text-sm text-slate-600 md:ml-auto">
              {total.toLocaleString()} records • showing {PAGE_SIZE_ALL} per page
            </div>
          </div>

          <div className="mt-3 grid md:grid-cols-3 lg:grid-cols-6 gap-2">
            <div>
              <div className="text-xs font-semibold text-slate-600 mb-1">Client Name</div>
              <input
                className="w-full border border-slate-300 px-3 py-2 text-sm"
                value={filterClient}
                onChange={(e) => setFilterClient(e.target.value)}
                placeholder="Contains…"
              />
            </div>
            <div>
              <div className="text-xs font-semibold text-slate-600 mb-1">Interest Type</div>
              <input
                className="w-full border border-slate-300 px-3 py-2 text-sm"
                value={filterInterestType}
                onChange={(e) => setFilterInterestType(e.target.value)}
                placeholder="Contains…"
              />
            </div>
            <div>
              <div className="text-xs font-semibold text-slate-600 mb-1">Business Opportunities</div>
              <input
                className="w-full border border-slate-300 px-3 py-2 text-sm"
                value={filterBusinessOpp}
                onChange={(e) => setFilterBusinessOpp(e.target.value)}
                placeholder="Contains…"
              />
            </div>
            <div>
              <div className="text-xs font-semibold text-slate-600 mb-1">Wealth Solutions</div>
              <input
                className="w-full border border-slate-300 px-3 py-2 text-sm"
                value={filterWealthSolutions}
                onChange={(e) => setFilterWealthSolutions(e.target.value)}
                placeholder="Contains…"
              />
            </div>
            <div>
              <div className="text-xs font-semibold text-slate-600 mb-1">BOP Status</div>
              <input
                className="w-full border border-slate-300 px-3 py-2 text-sm"
                value={filterBopStatus}
                onChange={(e) => setFilterBopStatus(e.target.value)}
                placeholder="Contains…"
              />
            </div>
            <div>
              <div className="text-xs font-semibold text-slate-600 mb-1">Follow-Up Status</div>
              <input
                className="w-full border border-slate-300 px-3 py-2 text-sm"
                value={filterFollowUpStatus}
                onChange={(e) => setFilterFollowUpStatus(e.target.value)}
                placeholder="Contains…"
              />
            </div>
          </div>
        </Card>

        {/* All Records */}
        <Card title="All Records (Editable)">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 mb-2">
            <div className="text-sm text-slate-600">
              Page <b>{page + 1}</b> of <b>{totalPages}</b>
            </div>

            <div className="flex flex-wrap items-center gap-2">
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
              <Button variant="secondary" onClick={() => loadPage(page + 1)} disabled={!canNext || loading}>
                Next
              </Button>
            </div>
          </div>

          {loading ? (
            <div className="text-slate-600">Loading…</div>
          ) : (
            <ExcelTable
              rows={records}
              savingId={savingId}
              onUpdate={updateCell}
              extraLeftCols={extraClientCol}
              maxHeightClass="max-h-[640px]"
              sortState={sortAll}
              onSortChange={(k) => setSortAll((cur) => toggleSort(cur, k))}
              stickyLeftCount={1}
            />
          )}
        </Card>
      </div>
    </div>
  );
}

type ColumnDef = {
  id: string;
  label: string;
  sortable?: SortKey;
  render: (r: Row) => React.ReactNode;
  kind?: "text" | "datetime" | "readonly";
};

function ExcelTable({
  rows,
  savingId,
  onUpdate,
  extraLeftCols,
  maxHeightClass,
  sortState,
  onSortChange,
  preferredOrder,
  stickyLeftCount = 0,
  readOnlyAll = false,
  customSortables,
  onHeaderSort,
}: {
  rows: Row[];
  savingId: string | null;
  onUpdate: (id: string, key: string, value: string) => void;
  extraLeftCols: { label: string; render: (r: Row) => string; sortable?: SortKey }[];
  maxHeightClass: string;
  sortState: { key: SortKey; dir: SortDir };
  onSortChange: (key: SortKey) => void;
  preferredOrder?: string[];
  stickyLeftCount?: number;
  readOnlyAll?: boolean;
  customSortables?: Record<string, SortKey>;
  onHeaderSort?: (k: SortKey) => void;
}) {
  const [openCell, setOpenCell] = useState<string | null>(null);

  // cell edit buffer (fixes datetime field not showing selected value)
  const [draft, setDraft] = useState<Record<string, string>>({}); // cellId -> value string

  const sortIcon = (k?: SortKey) => {
    if (!k) return null;
    if (sortState.key !== k) return <span className="ml-1 text-slate-400">↕</span>;
    return <span className="ml-1 text-slate-700">{sortState.dir === "asc" ? "↑" : "↓"}</span>;
  };

  const baseKeys = useMemo(() => {
    if (!rows.length) return [] as string[];
    return Object.keys(rows[0]).filter((k) => k !== "id" && k !== "clientid" && k !== "client_name");
  }, [rows]);

  const keys = useMemo(() => {
    if (!preferredOrder || !preferredOrder.length) return baseKeys;
    const set = new Set(baseKeys);
    const ordered: string[] = [];
    for (const k of preferredOrder) if (set.has(k)) ordered.push(k);
    for (const k of baseKeys) if (!ordered.includes(k)) ordered.push(k);
    return ordered;
  }, [baseKeys, preferredOrder]);

  const cols: ColumnDef[] = useMemo(() => {
    const left: ColumnDef[] = extraLeftCols.map((c, idx) => ({
      id: `__left_${idx}`,
      label: c.label,
      sortable: c.sortable,
      render: (r) => c.render(r),
      kind: "readonly",
    }));

    const mid: ColumnDef[] = keys.map((k) => {
      const isDateTime = k === "BOP_Date" || k === "CalledOn" || k === "Followup_Date" || k === "Issued";
      const isCreatedOnly = k === "created_at";
      const isReadOnlyList = READONLY_LIST_COLS.has(k);

      return {
        id: k,
        label: labelFor(k),
        sortable:
          customSortables?.[k] ??
          (k === "created_at"
            ? ("created_at" as SortKey)
            : k === "BOP_Date"
            ? ("BOP_Date" as SortKey)
            : k === "BOP_Status"
            ? ("BOP_Status" as SortKey)
            : k === "Followup_Date"
            ? ("Followup_Date" as SortKey)
            : k === "status"
            ? ("status" as SortKey)
            : undefined),
        kind: readOnlyAll || isCreatedOnly || isReadOnlyList ? "readonly" : isDateTime ? "datetime" : "text",
        render: (r: Row) => {
          if (isCreatedOnly) {
            const d = new Date(r.created_at);
            return Number.isNaN(d.getTime()) ? "" : d.toLocaleDateString();
          }

          if (isReadOnlyList) {
            const items = asListItems(r[k]);
            const display = items.join(", ");
            const cellId = `${String(r.id)}:${k}`;
            return (
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
                      {(items.length ? items : ["(empty)"]).map((x, idx) => (
                        <li key={idx} className="px-2 py-1 text-sm border-b border-slate-100">
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
            );
          }

          if (readOnlyAll) {
            const v = r[k];
            if (v == null) return "";
            return String(v);
          }

          const cellId = `${String(r.id)}:${k}`;
          const isDate = isDateTime;

          const current = draft[cellId] ?? (isDate ? toLocalInput(r[k]) : String(r[k] ?? ""));

          return (
            <input
              type={isDate ? "datetime-local" : "text"}
              className="w-full bg-transparent border-0 outline-none text-sm"
              value={current}
              onChange={(e) => {
                const v = e.target.value;
                setDraft((d) => ({ ...d, [cellId]: v }));
              }}
              onBlur={(e) => {
                const v = e.target.value;
                // keep draft so it stays visible even before server patch comes back
                onUpdate(String(r.id), k, v);
              }}
            />
          );
        },
      };
    });

    return [...left, ...mid];
  }, [extraLeftCols, keys, openCell, draft, readOnlyAll, customSortables, onUpdate]);

  // Resizable columns
  const defaultWidths = useMemo(() => cols.map((c) => (c.id.startsWith("__left_") ? 240 : 170)), [cols]);
  const [colWidths, setColWidths] = useState<number[]>(defaultWidths);

  useEffect(() => {
    // keep width array aligned if cols change
    setColWidths((prev) => {
      if (prev.length === cols.length) return prev;
      const next = cols.map((_, i) => prev[i] ?? defaultWidths[i] ?? 170);
      return next;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cols.length]);

  const dragRef = useRef<{
    idx: number;
    startX: number;
    startW: number;
  } | null>(null);

  useEffect(() => {
    function onMove(e: MouseEvent) {
      if (!dragRef.current) return;
      const { idx, startX, startW } = dragRef.current;
      const dx = e.clientX - startX;
      const w = Math.max(80, Math.min(520, startW + dx));
      setColWidths((prev) => {
        const next = [...prev];
        next[idx] = w;
        return next;
      });
    }
    function onUp() {
      dragRef.current = null;
    }
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, []);

  // Sticky-left offsets based on widths
  const stickyOffsets = useMemo(() => {
    const offs: number[] = [];
    let acc = 0;
    for (let i = 0; i < cols.length; i++) {
      offs[i] = acc;
      acc += colWidths[i] ?? 0;
    }
    return offs;
  }, [cols.length, colWidths]);

  const handleHeaderClick = (k?: SortKey) => {
    if (!k) return;
    if (onHeaderSort) return onHeaderSort(k);
    onSortChange(k);
  };

  return (
    <div className={`overflow-auto border border-slate-500 bg-white ${maxHeightClass}`}>
      <table className="min-w-[1200px] w-full border-collapse table-fixed">
        <thead className="sticky top-0 bg-slate-100 z-20">
          <tr className="text-left text-xs font-semibold text-slate-700">
            {cols.map((c, idx) => {
              const isSticky = idx < stickyLeftCount;
              const left = stickyOffsets[idx] ?? 0;

              const sortable = c.sortable;
              const z = isSticky ? 40 : 20;

              return (
                <th
                  key={c.id}
                  className="border border-slate-500 px-2 py-2 whitespace-nowrap relative"
                  style={{
                    width: colWidths[idx],
                    minWidth: colWidths[idx],
                    maxWidth: colWidths[idx],
                    position: isSticky ? "sticky" : "static",
                    left: isSticky ? left : undefined,
                    zIndex: z,
                    background: "rgb(241 245 249)", // slate-100
                  }}
                >
                  {sortable ? (
                    <button
                      className="inline-flex items-center hover:underline"
                      onClick={() => handleHeaderClick(sortable)}
                      type="button"
                    >
                      {c.label}
                      {sortIcon(sortable)}
                    </button>
                  ) : (
                    c.label
                  )}

                  {/* resize handle */}
                  <div
                    onMouseDown={(e) => {
                      e.preventDefault();
                      dragRef.current = { idx, startX: e.clientX, startW: colWidths[idx] ?? 170 };
                    }}
                    className="absolute top-0 right-0 h-full w-2 cursor-col-resize"
                    style={{ userSelect: "none" }}
                  />
                </th>
              );
            })}
          </tr>
        </thead>

        <tbody>
          {rows.map((r, rowIdx) => (
            <tr key={String(r.id ?? r.clientid ?? rowIdx)} className="hover:bg-slate-50">
              {cols.map((c, idx) => {
                const isSticky = idx < stickyLeftCount;
                const left = stickyOffsets[idx] ?? 0;
                const z = isSticky ? 30 : 10;

                return (
                  <td
                    key={c.id}
                    className="border border-slate-300 px-2 py-2 align-top"
                    style={{
                      width: colWidths[idx],
                      minWidth: colWidths[idx],
                      maxWidth: colWidths[idx],
                      position: isSticky ? "sticky" : "static",
                      left: isSticky ? left : undefined,
                      zIndex: z,
                      background: isSticky ? "white" : undefined,
                    }}
                  >
                    {c.id.startsWith("__left_") ? (
                      <div className="font-semibold text-slate-800">{c.render(r)}</div>
                    ) : c.kind === "readonly" ? (
                      <div className="text-slate-800 whitespace-normal break-words">{c.render(r)}</div>
                    ) : (
                      <div className="text-slate-800">{c.render(r)}</div>
                    )}

                    {savingId && String(r.id) === String(savingId) && c.id === "BOP_Date" ? (
                      <div className="text-[10px] text-slate-400 mt-1">Saving…</div>
                    ) : null}
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
