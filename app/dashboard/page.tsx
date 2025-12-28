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
type SortDir = "asc" | "desc";

type SortKeyAll =
  | "client"
  | "created_at"
  | "BOP_Date"
  | "BOP_Status"
  | "Followup_Date"
  | "status";

type SortKeyProgress =
  | "client_name"
  | "last_call_date"
  | "call_attempts"
  | "last_bop_date"
  | "bop_attempts"
  | "last_followup_date"
  | "followup_attempts";

const PAGE_SIZE = 20;

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

function clientName(r: Row) {
  return `${r.first_name || ""} ${r.last_name || ""}`.trim();
}

function toLocalInput(value: string | null) {
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
  if (Array.isArray(value))
    return value.map((v) => String(v)).filter(Boolean);
  const s = String(value).trim();
  if (!s) return [];
  if (s.includes(",")) return s.split(",").map((x) => x.trim()).filter(Boolean);
  return [s];
}

function toggleSort<T extends string>(cur: { key: T; dir: SortDir }, k: T) {
  if (cur.key !== k) return { key: k, dir: "asc" as SortDir };
  return { key: k, dir: cur.dir === "asc" ? ("desc" as SortDir) : ("asc" as SortDir) };
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
  const [upcomingVisible, setUpcomingVisible] = useState(false);
  const [sortUpcoming, setSortUpcoming] = useState<{ key: SortKeyAll; dir: SortDir }>({
    key: "BOP_Date",
    dir: "asc",
  });

  // Client Progress Summary (server data)
  const [progressRows, setProgressRows] = useState<Row[]>([]);
  const [progressLoading, setProgressLoading] = useState(false);
  const [progressFilter, setProgressFilter] = useState("");
  const [progressSort, setProgressSort] = useState<{ key: SortKeyProgress; dir: SortDir }>({
    key: "client_name",
    dir: "asc",
  });
  const [progressPage, setProgressPage] = useState(0);

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
  const [sortAll, setSortAll] = useState<{ key: SortKeyAll; dir: SortDir }>({
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
    if (upcomingVisible && upcoming.length) fetchUpcoming();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sortUpcoming.key, sortUpcoming.dir]);

  function applySort(query: any, sort: { key: SortKeyAll; dir: SortDir }) {
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
        .limit(200000);

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
        .limit(400000);

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
      setUpcomingVisible(true); // show after load
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
        .limit(20000);

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

      // Count
      let countQuery = supabase.from("client_registrations").select("id", { count: "exact", head: true });

      if (search) {
        countQuery = countQuery.or(
          `first_name.ilike.%${search}%,last_name.ilike.%${search}%,phone.ilike.%${search}%`
        );
      }
      if (fc) {
        countQuery = countQuery.or(`first_name.ilike.%${fc}%,last_name.ilike.%${fc}%`);
      }
      if (fi) countQuery = countQuery.ilike("interest_type", `%${fi}%`);
      if (fb) countQuery = countQuery.ilike("BOP_Status", `%${fb}%`);

      const { count, error: cErr } = await countQuery;
      if (cErr) throw cErr;
      setTotal(count ?? 0);

      const from = nextPage * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;

      // Data
      let dataQuery = supabase.from("client_registrations").select("*").range(from, to);

      if (search) {
        dataQuery = dataQuery.or(
          `first_name.ilike.%${search}%,last_name.ilike.%${search}%,phone.ilike.%${search}%`
        );
      }
      if (fc) {
        dataQuery = dataQuery.or(`first_name.ilike.%${fc}%,last_name.ilike.%${fc}%`);
      }
      if (fi) dataQuery = dataQuery.ilike("interest_type", `%${fi}%`);
      if (fb) dataQuery = dataQuery.ilike("BOP_Status", `%${fb}%`);

      dataQuery = applySort(dataQuery, sortAll);

      const { data, error } = await dataQuery;
      if (error) throw error;

      // client-side contains filters (arrays / mixed fields) - case-insensitive
      const raw = (data || []) as any[];
      const fbo = filterBusinessOpp.trim().toLowerCase();
      const fws = filterWealthSolutions.trim().toLowerCase();
      const ffu = filterFollowUpStatus.trim().toLowerCase();

      const clientSideFiltered = raw.filter((row) => {
        const opp = Array.isArray(row.business_opportunities)
          ? row.business_opportunities.join(",")
          : String(row.business_opportunities || "");
        const ws = Array.isArray(row.wealth_solutions)
          ? row.wealth_solutions.join(",")
          : String(row.wealth_solutions || "");

        const fu = String(row.FollowUp_Status ?? row.Followup_Status ?? "").toLowerCase();

        const okOpp = !fbo || opp.toLowerCase().includes(fbo);
        const okWs = !fws || ws.toLowerCase().includes(fws);
        const okFu = !ffu || fu.includes(ffu);
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

  const totalPages = Math.max(1, Math.ceil((total || 0) / PAGE_SIZE));
  const canPrev = page > 0;
  const canNext = (page + 1) * PAGE_SIZE < total;

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

      const patch = (prev: Row[]) => prev.map((r) => (String(r.id) === String(id) ? { ...r, [key]: payload[key] } : r));
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
      Click headers to sort: <b>Client Name</b>, <b>Created Date</b>, <b>BOP Date</b>, <b>BOP Status</b>, <b>Follow-Up Date</b>, <b>Status</b>.
    </div>
  );

  const extraClientCol = useMemo(
    () => [{ label: "Client Name", sortable: "client" as SortKeyAll, render: (r: Row) => clientName(r) }],
    []
  );

  // Progress: filter (case-insensitive) + sort + paginate
  const progressFilteredSorted = useMemo(() => {
    const f = progressFilter.trim().toLowerCase();
    const filtered = !f
      ? progressRows
      : progressRows.filter((r) => String(r.client_name || "").toLowerCase().includes(f));

    const dirMul = progressSort.dir === "asc" ? 1 : -1;
    const key = progressSort.key;

    const asNum = (v: any) => (v == null || v === "" ? -Infinity : Number(v));
    const asTime = (v: any) => {
      if (!v) return -Infinity;
      const d = new Date(v);
      const t = d.getTime();
      return Number.isNaN(t) ? -Infinity : t;
    };

    const sorted = [...filtered].sort((a, b) => {
      if (key === "client_name") {
        return String(a.client_name || "").localeCompare(String(b.client_name || "")) * dirMul;
      }
      if (key === "call_attempts" || key === "bop_attempts" || key === "followup_attempts") {
        return (asNum(a[key]) - asNum(b[key])) * dirMul;
      }
      // date keys
      return (asTime(a[key]) - asTime(b[key])) * dirMul;
    });

    return sorted;
  }, [progressRows, progressFilter, progressSort]);

  const progressTotalPages = Math.max(1, Math.ceil(progressFilteredSorted.length / PAGE_SIZE));
  const progressPageClamped = Math.min(progressPage, progressTotalPages - 1);
  const progressSlice = progressFilteredSorted.slice(
    progressPageClamped * PAGE_SIZE,
    progressPageClamped * PAGE_SIZE + PAGE_SIZE
  );

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
          <div className="flex items-center justify-end mb-2">
            <Button variant="secondary" onClick={fetchTrends} disabled={trendLoading}>
              {trendLoading ? "Loading…" : "Refresh"}
            </Button>
          </div>

          <div className="grid lg:grid-cols-2 gap-6">
            <div>
              <div className="text-sm font-semibold text-slate-700 mb-2">
                Weekly = No of Prospect vs BOP (last 5 weeks incl current)
              </div>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={weekly}
                    margin={{ top: 28, right: 18, left: 0, bottom: 12 }}
                  >
                    <XAxis dataKey="weekEnd" tick={{ fontSize: 11 }} />
                    <YAxis allowDecimals={false} />
                    <Tooltip />
                    <Legend />
                    <Line type="monotone" dataKey="prospects" stroke="#2563eb" dot>
                      <LabelList dataKey="prospects" position="top" />
                    </Line>
                    <Line type="monotone" dataKey="bops" stroke="#f97316" dot>
                      <LabelList dataKey="bops" position="top" />
                    </Line>
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div>
              <div className="text-sm font-semibold text-slate-700 mb-2">Monthly (Current Year)</div>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={monthly}
                    margin={{ top: 28, right: 18, left: 0, bottom: 12 }}
                    barCategoryGap="20%"
                  >
                    <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                    <YAxis allowDecimals={false} />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="prospects" fill="#16a34a">
                      <LabelList dataKey="prospects" position="top" />
                    </Bar>
                    <Bar dataKey="bops" fill="#9333ea">
                      <LabelList dataKey="bops" position="top" />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </Card>

        {/* Upcoming Range */}
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

          <div className="mt-3 flex items-center gap-2">
            <Button
              variant="secondary"
              onClick={() => setUpcomingVisible((v) => !v)}
              disabled={upcoming.length === 0}
            >
              {upcomingVisible ? "Hide Upcoming Table" : "Show Upcoming Table"}
            </Button>
            <div className="text-xs text-slate-500">
              After you press <b>Load</b>, you can show/hide the Upcoming table.
            </div>
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
              stickyLeftCount={2} // Client Name + BOP Date (keeps visible)
              stickyTopHeader
              savingId={savingId}
              onUpdate={updateCell}
              preferredOrder={[
                "BOP_Date",
                "created_at",
                "BOP_Status",
                "Followup_Date",
                "status",
              ]}
              extraLeftCols={[
                { label: "Client Name", sortable: "client", render: (r) => clientName(r) },
                {
                  label: "BOP Date",
                  sortable: "BOP_Date",
                  render: (r) => {
                    const v = r.BOP_Date;
                    if (!v) return "";
                    const d = new Date(v);
                    return Number.isNaN(d.getTime()) ? "" : d.toLocaleString();
                  },
                  keyOverride: "BOP_Date",
                },
              ]}
              maxHeightClass="max-h-[420px]"
              sortState={sortUpcoming}
              onSortChange={(k) => setSortUpcoming((cur) => toggleSort(cur, k))}
            />
          </Card>
        )}

        {/* Client Progress Summary */}
        <Card title="Client Progress Summary">
          <div className="flex flex-col md:flex-row md:items-center gap-2 mb-3">
            <input
              className="w-full md:max-w-lg border border-slate-300 px-4 py-3"
              placeholder="Filter by client name…"
              value={progressFilter}
              onChange={(e) => {
                setProgressFilter(e.target.value);
                setProgressPage(0);
              }}
            />
            <Button variant="secondary" onClick={fetchProgressSummary} disabled={progressLoading}>
              {progressLoading ? "Loading…" : "Refresh"}
            </Button>

            <div className="md:ml-auto flex items-center gap-2">
              <Button
                variant="secondary"
                onClick={() => setProgressPage((p) => Math.max(0, p - 1))}
                disabled={progressPageClamped <= 0}
              >
                Previous
              </Button>
              <Button
                variant="secondary"
                onClick={() => setProgressPage((p) => Math.min(progressTotalPages - 1, p + 1))}
                disabled={progressPageClamped >= progressTotalPages - 1}
              >
                Next
              </Button>
            </div>
          </div>

          <div className="text-xs text-slate-600 mb-2">Click headers to sort.</div>

          <ProgressTable
            rows={progressSlice}
            stickyLeft
            sortState={progressSort}
            onSortChange={(k) => setProgressSort((cur) => toggleSort(cur, k))}
          />
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
              stickyLeftCount={1} // Client Name fixed
              stickyTopHeader
              savingId={savingId}
              onUpdate={updateCell}
              extraLeftCols={extraClientCol}
              maxHeightClass="max-h-[560px]"
              sortState={sortAll}
              onSortChange={(k) => setSortAll((cur) => toggleSort(cur, k))}
            />
          )}
        </Card>
      </div>
    </div>
  );
}

function ProgressTable({
  rows,
  stickyLeft,
  sortState,
  onSortChange,
}: {
  rows: Row[];
  stickyLeft: boolean;
  sortState: { key: SortKeyProgress; dir: SortDir };
  onSortChange: (key: SortKeyProgress) => void;
}) {
  const cols: { key: string; sortKey?: SortKeyProgress }[] = [
    { key: "client_name", sortKey: "client_name" },
    { key: "first_name" },
    { key: "last_name" },
    { key: "phone" },
    { key: "email" },
    { key: "last_call_date", sortKey: "last_call_date" },
    { key: "call_attempts", sortKey: "call_attempts" },
    { key: "last_bop_date", sortKey: "last_bop_date" },
    { key: "bop_attempts", sortKey: "bop_attempts" },
    { key: "last_followup_date", sortKey: "last_followup_date" },
    { key: "followup_attempts", sortKey: "followup_attempts" },
  ];

  const sortIcon = (k?: SortKeyProgress) => {
    if (!k) return null;
    if (sortState.key !== k) return <span className="ml-1 text-slate-400">↕</span>;
    return <span className="ml-1 text-slate-700">{sortState.dir === "asc" ? "↑" : "↓"}</span>;
  };

  return (
    <div className="overflow-auto border border-slate-500 bg-white max-h-[520px]">
      <table className="min-w-[1400px] w-full border-collapse">
        <thead className="sticky top-0 bg-slate-100 z-10">
          <tr className="text-left text-xs font-semibold text-slate-700">
            {cols.map((c, idx) => {
              const isSticky = stickyLeft && idx === 0;
              return (
                <th
                  key={c.key}
                  className={[
                    "border border-slate-500 px-2 py-2 whitespace-nowrap bg-slate-100",
                    isSticky ? "sticky left-0 z-20" : "",
                  ].join(" ")}
                  style={isSticky ? { minWidth: 160 } : undefined}
                >
                  {c.sortKey ? (
                    <button
                      className="inline-flex items-center hover:underline"
                      onClick={() => onSortChange(c.sortKey!)}
                      type="button"
                    >
                      {labelFor(c.key)}
                      {sortIcon(c.sortKey)}
                    </button>
                  ) : (
                    labelFor(c.key)
                  )}
                </th>
              );
            })}
          </tr>
        </thead>

        <tbody>
          {rows.map((r, i) => (
            <tr key={`${r.clientid ?? i}`} className="hover:bg-slate-50">
              {cols.map((c, idx) => {
                const v = r[c.key];
                const isSticky = stickyLeft && idx === 0;
                const isDate =
                  c.key === "last_call_date" || c.key === "last_bop_date" || c.key === "last_followup_date";

                let display = v ?? "";
                if (isDate && v) {
                  const d = new Date(v);
                  display = Number.isNaN(d.getTime()) ? "" : d.toLocaleString();
                }

                return (
                  <td
                    key={c.key}
                    className={[
                      "border border-slate-300 px-2 py-2 whitespace-nowrap",
                      isSticky ? "sticky left-0 z-10 bg-white font-semibold text-slate-800" : "",
                    ].join(" ")}
                    style={isSticky ? { minWidth: 160 } : undefined}
                  >
                    {String(display)}
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

function ExcelTable({
  rows,
  savingId,
  onUpdate,
  extraLeftCols,
  maxHeightClass,
  sortState,
  onSortChange,
  preferredOrder,
  stickyLeftCount,
  stickyTopHeader,
}: {
  rows: Row[];
  savingId: string | null;
  onUpdate: (id: string, key: string, value: string) => void;
  extraLeftCols: { label: string; render: (r: Row) => string; sortable?: SortKeyAll; keyOverride?: string }[];
  maxHeightClass: string;
  sortState: { key: SortKeyAll; dir: SortDir };
  onSortChange: (key: SortKeyAll) => void;
  preferredOrder?: string[];
  stickyLeftCount?: number; // number of left columns (including extraLeftCols) to stick
  stickyTopHeader?: boolean;
}) {
  const [openCell, setOpenCell] = useState<string | null>(null);

  // ✅ Fix date saving: use controlled draft values
  const [draft, setDraft] = useState<Record<string, string>>({});

  const sortIcon = (k?: SortKeyAll) => {
    if (!k) return null;
    if (sortState.key !== k) return <span className="ml-1 text-slate-400">↕</span>;
    return <span className="ml-1 text-slate-700">{sortState.dir === "asc" ? "↑" : "↓"}</span>;
  };

  const keys = useMemo(() => {
    if (!rows.length) return [] as string[];
    const baseKeys = Object.keys(rows[0]).filter((k) => k !== "id");

    if (!preferredOrder || !preferredOrder.length) return baseKeys;

    const set = new Set(baseKeys);
    const ordered: string[] = [];
    for (const k of preferredOrder) {
      if (set.has(k)) ordered.push(k);
    }
    for (const k of baseKeys) {
      if (!ordered.includes(k)) ordered.push(k);
    }
    return ordered;
  }, [rows, preferredOrder]);

  // Column resizing (simple, stable)
  const allColCount = extraLeftCols.length + keys.length;
  const defaultWidths = useMemo(() => {
    const arr: number[] = [];
    for (let i = 0; i < allColCount; i++) {
      if (i === 0) arr.push(180); // Client Name
      else if (i === 1 && extraLeftCols.length > 1) arr.push(210); // BOP Date
      else arr.push(170);
    }
    return arr;
  }, [allColCount, extraLeftCols.length]);

  const [colWidths, setColWidths] = useState<number[]>(defaultWidths);

  useEffect(() => {
    setColWidths(defaultWidths);
  }, [defaultWidths]);

  const dragging = useRef<{ idx: number; startX: number; startW: number } | null>(null);

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!dragging.current) return;
      const { idx, startX, startW } = dragging.current;
      const delta = e.clientX - startX;
      const next = Math.max(90, Math.min(600, startW + delta));
      setColWidths((w) => {
        const copy = [...w];
        copy[idx] = next;
        return copy;
      });
    };
    const onUp = () => {
      dragging.current = null;
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, []);

  const stickyCount = Math.max(0, stickyLeftCount || 0);

  const leftOffset = (colIdx: number) => {
    let x = 0;
    for (let i = 0; i < colIdx; i++) x += colWidths[i] || 0;
    return x;
  };

  const thClass = "border border-slate-500 px-2 py-2 whitespace-nowrap bg-slate-100";
  const tdClass = "border border-slate-300 px-2 py-2 align-top";

  const sortableForKey = (k: string): SortKeyAll | undefined => {
    if (k === "created_at") return "created_at";
    if (k === "BOP_Date") return "BOP_Date";
    if (k === "BOP_Status") return "BOP_Status";
    if (k === "Followup_Date") return "Followup_Date";
    if (k === "status") return "status";
    return undefined;
    };

  const headerStickyClass = stickyTopHeader ? "sticky top-0 z-10" : "";

  return (
    <div className={`overflow-auto border border-slate-500 bg-white ${maxHeightClass}`}>
      <table className="w-full border-collapse" style={{ minWidth: 1400 }}>
        <thead className={`${headerStickyClass} bg-slate-100`}>
          <tr className="text-left text-xs font-semibold text-slate-700">
            {extraLeftCols.map((c, idx) => {
              const isSticky = idx < stickyCount;
              const w = colWidths[idx] || 170;

              return (
                <th
                  key={c.label}
                  className={`${thClass} ${isSticky ? "sticky z-30" : ""}`}
                  style={{
                    width: w,
                    minWidth: w,
                    maxWidth: w,
                    left: isSticky ? leftOffset(idx) : undefined,
                  }}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="truncate">
                      {c.sortable ? (
                        <button
                          className="inline-flex items-center hover:underline"
                          onClick={() => onSortChange(c.sortable!)}
                          type="button"
                        >
                          {c.label}
                          {sortIcon(c.sortable)}
                        </button>
                      ) : (
                        c.label
                      )}
                    </div>

                    <div
                      onMouseDown={(e) => {
                        e.preventDefault();
                        dragging.current = { idx, startX: e.clientX, startW: w };
                      }}
                      className="w-[6px] cursor-col-resize select-none opacity-60 hover:opacity-100"
                      style={{ height: 18 }}
                    />
                  </div>
                </th>
              );
            })}

            {keys.map((k, i) => {
              const colIdx = extraLeftCols.length + i;
              const isSticky = colIdx < stickyCount;
              const w = colWidths[colIdx] || 170;

              const sortable = sortableForKey(k);

              return (
                <th
                  key={k}
                  className={`${thClass} ${isSticky ? "sticky z-30" : ""}`}
                  style={{
                    width: w,
                    minWidth: w,
                    maxWidth: w,
                    left: isSticky ? leftOffset(colIdx) : undefined,
                  }}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="truncate">
                      {sortable ? (
                        <button
                          className="inline-flex items-center hover:underline"
                          onClick={() => onSortChange(sortable)}
                          type="button"
                        >
                          {labelFor(k)}
                          {sortIcon(sortable)}
                        </button>
                      ) : (
                        labelFor(k)
                      )}
                    </div>

                    <div
                      onMouseDown={(e) => {
                        e.preventDefault();
                        dragging.current = { idx: colIdx, startX: e.clientX, startW: w };
                      }}
                      className="w-[6px] cursor-col-resize select-none opacity-60 hover:opacity-100"
                      style={{ height: 18 }}
                    />
                  </div>
                </th>
              );
            })}
          </tr>
        </thead>

        <tbody>
          {rows.map((r) => (
            <tr key={String(r.id)} className="hover:bg-slate-50">
              {extraLeftCols.map((c, idx) => {
                const isSticky = idx < stickyCount;
                const w = colWidths[idx] || 170;
                return (
                  <td
                    key={c.label}
                    className={`${tdClass} ${isSticky ? "sticky z-20 bg-white font-semibold text-slate-800" : "font-semibold text-slate-800"}`}
                    style={{
                      width: w,
                      minWidth: w,
                      maxWidth: w,
                      left: isSticky ? leftOffset(idx) : undefined,
                    }}
                  >
                    {c.render(r)}
                  </td>
                );
              })}

              {keys.map((k, i) => {
                const colIdx = extraLeftCols.length + i;
                const isSticky = colIdx < stickyCount;
                const w = colWidths[colIdx] || 170;

                const cellId = `${r.id}:${k}`;
                const val = r[k];

                if (k === "created_at") {
                  const d = new Date(r.created_at);
                  return (
                    <td
                      key={k}
                      className={`${tdClass} ${isSticky ? "sticky z-20 bg-white" : ""}`}
                      style={{
                        width: w,
                        minWidth: w,
                        maxWidth: w,
                        left: isSticky ? leftOffset(colIdx) : undefined,
                      }}
                    >
                      {Number.isNaN(d.getTime()) ? "" : d.toLocaleDateString()}
                    </td>
                  );
                }

                if (READONLY_LIST_COLS.has(k)) {
                  const items = asListItems(val);
                  const display = items.join(", ");
                  return (
                    <td
                      key={k}
                      className={`${tdClass} ${isSticky ? "sticky z-20 bg-white" : ""}`}
                      style={{
                        width: w,
                        minWidth: w,
                        maxWidth: w,
                        left: isSticky ? leftOffset(colIdx) : undefined,
                      }}
                    >
                      <div className="relative">
                        <button
                          type="button"
                          className="w-full text-left text-slate-800 whitespace-normal break-words"
                          onClick={() => setOpenCell((cur) => (cur === cellId ? null : cellId))}
                        >
                          {display || "—"}
                        </button>

                        {openCell === cellId && (
                          <div className="absolute left-0 top-full mt-1 w-72 max-w-[70vw] bg-white border border-slate-500 shadow-lg z-40">
                            <div className="px-2 py-1 text-xs font-semibold text-slate-700 bg-slate-100 border-b border-slate-300 flex items-center justify-between">
                              <span>{labelFor(k)}</span>
                              <button
                                type="button"
                                className="text-xs px-2 py-1 border border-slate-300 bg-white"
                                onClick={() => setOpenCell(null)}
                              >
                                Close
                              </button>
                            </div>
                            <ul className="max-h-48 overflow-auto">
                              {(items.length ? items : ["(empty)"]).map((x, idx2) => (
                                <li key={idx2} className="px-2 py-1 text-sm border-b border-slate-100">
                                  {x}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    </td>
                  );
                }

                const isDateTime = k === "BOP_Date" || k === "CalledOn" || k === "Followup_Date" || k === "Issued";
                const rowId = String(r.id);
                const draftKey = `${rowId}:${k}`;

                const value =
                  draft[draftKey] !== undefined
                    ? draft[draftKey]
                    : isDateTime
                    ? toLocalInput(val ?? null)
                    : String(val ?? "");

                return (
                  <td
                    key={k}
                    className={`${tdClass} ${isSticky ? "sticky z-20 bg-white" : ""}`}
                    style={{
                      width: w,
                      minWidth: w,
                      maxWidth: w,
                      left: isSticky ? leftOffset(colIdx) : undefined,
                    }}
                  >
                    <input
                      type={isDateTime ? "datetime-local" : "text"}
                      className="w-full bg-transparent border-0 outline-none text-sm"
                      value={value}
                      onChange={(e) => setDraft((d) => ({ ...d, [draftKey]: e.target.value }))}
                      onBlur={(e) => {
                        onUpdate(rowId, k, e.target.value);

                        // clear draft after blur so refresh shows db value
                        setDraft((d) => {
                          const copy = { ...d };
                          delete copy[draftKey];
                          return copy;
                        });
                      }}
                      disabled={savingId === rowId}
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
