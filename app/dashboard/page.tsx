"use client";

export const dynamic = "force-dynamic";

import React, { useEffect, useMemo, useState } from "react";
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

// For All Records + Upcoming tables
type SortKey =
  | "client"
  | "created_at"
  | "BOP_Date"
  | "BOP_Status"
  | "Followup_Date"
  | "status";

// For progress table
type ProgressSortKey =
  | "client_name"
  | "last_call_date"
  | "call_attempts"
  | "last_bop_date"
  | "bop_attempts"
  | "last_followup_date"
  | "followup_attempts";

const PAGE_SIZE = 50;

// Not editable, open as a list popup on click
const READONLY_LIST_COLS = new Set([
  "interest_type",
  "business_opportunities",
  "wealth_solutions",
  "preferred_days",
]);

const LABEL_OVERRIDES: Record<string, string> = {
  client_name: "Client Name",
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

  // progress
  last_call_date: "Last Call On",
  call_attempts: "No of Calls",
  last_bop_date: "Last BOP Call On",
  bop_attempts: "No of BOP Calls",
  last_followup_date: "Last FollowUp On",
  followup_attempts: "No of FollowUp Calls",
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

function toggleSort(cur: { key: SortKey; dir: SortDir }, k: SortKey) {
  if (cur.key !== k) return { key: k, dir: "asc" as SortDir };
  return { key: k, dir: cur.dir === "asc" ? ("desc" as SortDir) : ("asc" as SortDir) };
}

function toggleProgressSort(
  cur: { key: ProgressSortKey; dir: SortDir },
  k: ProgressSortKey
) {
  if (cur.key !== k) return { key: k, dir: "asc" as SortDir };
  return { key: k, dir: cur.dir === "asc" ? ("desc" as SortDir) : ("asc" as SortDir) };
}

function normalizeLower(s: any) {
  return String(s ?? "").trim().toLowerCase();
}

function parseDateSafe(v: any): number {
  if (!v) return 0;
  const d = new Date(String(v));
  const t = d.getTime();
  return Number.isNaN(t) ? 0 : t;
}

export default function Dashboard() {
  const [error, setError] = useState<string | null>(null);

  // Trends
  const [weekly, setWeekly] = useState<
    { weekEnd: string; prospects: number; bops: number }[]
  >([]);
  const [monthly, setMonthly] = useState<
    { month: string; prospects: number; bops: number }[]
  >([]);
  const [trendLoading, setTrendLoading] = useState(false);

  // Upcoming BOP
  const [rangeStart, setRangeStart] = useState(format(new Date(), "yyyy-MM-dd"));
  const [rangeEnd, setRangeEnd] = useState(format(addDays(new Date(), 30), "yyyy-MM-dd"));
  const [upcoming, setUpcoming] = useState<Row[]>([]);
  const [upcomingLoading, setUpcomingLoading] = useState(false);
  const [upcomingVisible, setUpcomingVisible] = useState(false);
  const [sortUpcoming, setSortUpcoming] = useState<{ key: SortKey; dir: SortDir }>({
    key: "BOP_Date",
    dir: "asc",
  });

  // Client Progress Summary
  const [progressRows, setProgressRows] = useState<Row[]>([]);
  const [progressLoading, setProgressLoading] = useState(false);
  const [progressFilter, setProgressFilter] = useState("");
  const [progressSort, setProgressSort] = useState<{
    key: ProgressSortKey;
    dir: SortDir;
  }>({ key: "client_name", dir: "asc" });

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

  // ---- auth init ----
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

  // sort refresh for All Records
  useEffect(() => {
    loadPage(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sortAll.key, sortAll.dir]);

  // ---- helpers ----
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

  // ---- trends ----
  async function fetchTrends() {
    setTrendLoading(true);
    setError(null);
    try {
      const supabase = getSupabase();
      // last 5 weeks incl current (i=4..0)
      const start = startOfWeek(subWeeks(new Date(), 4), { weekStartsOn: 1 });

      const { data: rows, error: err } = await supabase
        .from("client_registrations")
        .select("created_at, BOP_Date")
        .gte("created_at", start.toISOString())
        .order("created_at", { ascending: true })
        .limit(200000);

      if (err) throw err;

      const weekEnds: string[] = [];
      const prospectsMap = new Map<string, number>();
      const bopsMap = new Map<string, number>();

      for (let i = 4; i >= 0; i--) {
        const wkStart = startOfWeek(subWeeks(new Date(), i), { weekStartsOn: 1 });
        const wkEnd = endOfWeek(wkStart, { weekStartsOn: 1 });
        const key = format(wkEnd, "yyyy-MM-dd");
        weekEnds.push(key);
        prospectsMap.set(key, 0);
        bopsMap.set(key, 0);
      }

      for (const r of rows || []) {
        // prospects by created_at week end
        const created = parseISO(String((r as any).created_at));
        if (isValid(created)) {
          const wkEnd = endOfWeek(created, { weekStartsOn: 1 });
          const key = format(wkEnd, "yyyy-MM-dd");
          if (prospectsMap.has(key)) prospectsMap.set(key, (prospectsMap.get(key) || 0) + 1);
        }

        // bops by BOP_Date week end
        const bopRaw = (r as any).BOP_Date;
        if (bopRaw) {
          const bop = parseISO(String(bopRaw));
          if (isValid(bop)) {
            const wkEnd2 = endOfWeek(bop, { weekStartsOn: 1 });
            const key2 = format(wkEnd2, "yyyy-MM-dd");
            if (bopsMap.has(key2)) bopsMap.set(key2, (bopsMap.get(key2) || 0) + 1);
          }
        }
      }

      setWeekly(
        weekEnds.map((weekEnd) => ({
          weekEnd,
          prospects: prospectsMap.get(weekEnd) || 0,
          bops: bopsMap.get(weekEnd) || 0,
        }))
      );

      // monthly current year (created_at vs bop_date)
      const yearStart = startOfYear(new Date());
      const nextYear = addYears(yearStart, 1);

      const { data: yearRows, error: yearErr } = await supabase
        .from("client_registrations")
        .select("created_at, BOP_Date")
        .gte("created_at", yearStart.toISOString())
        .lt("created_at", nextYear.toISOString())
        .order("created_at", { ascending: true })
        .limit(500000);

      if (yearErr) throw yearErr;

      const y = yearStart.getFullYear();
      const monthProspects = new Map<string, number>();
      const monthBops = new Map<string, number>();
      for (let m = 1; m <= 12; m++) {
        const k = `${y}-${String(m).padStart(2, "0")}`;
        monthProspects.set(k, 0);
        monthBops.set(k, 0);
      }

      for (const r of yearRows || []) {
        const created = parseISO(String((r as any).created_at));
        if (isValid(created)) {
          const key = format(created, "yyyy-MM");
          if (monthProspects.has(key)) monthProspects.set(key, (monthProspects.get(key) || 0) + 1);
        }

        const bopRaw = (r as any).BOP_Date;
        if (bopRaw) {
          const bop = parseISO(String(bopRaw));
          if (isValid(bop)) {
            const key2 = format(bop, "yyyy-MM");
            if (monthBops.has(key2)) monthBops.set(key2, (monthBops.get(key2) || 0) + 1);
          }
        }
      }

      const months = Array.from(monthProspects.keys());
      setMonthly(
        months.map((month) => ({
          month,
          prospects: monthProspects.get(month) || 0,
          bops: monthBops.get(month) || 0,
        }))
      );
    } catch (e: any) {
      setError(e?.message || "Failed to load trends");
    } finally {
      setTrendLoading(false);
    }
  }

  // ---- upcoming ----
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

  const exportUpcomingXlsx = () => {
    const ws = XLSX.utils.json_to_sheet(upcoming);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Upcoming_BOP");
    XLSX.writeFile(wb, `Upcoming_BOP_${rangeStart}_to_${rangeEnd}.xlsx`);
  };

  // ---- progress ----
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
    } catch (e: any) {
      setError(e?.message || "Failed to load Client Progress Summary");
    } finally {
      setProgressLoading(false);
    }
  }

  const progressView = useMemo(() => {
    const f = normalizeLower(progressFilter);
    let rows = [...progressRows];

    if (f) {
      rows = rows.filter((r) => normalizeLower(r.client_name).includes(f));
    }

    const dirMul = progressSort.dir === "asc" ? 1 : -1;

    rows.sort((a, b) => {
      const k = progressSort.key;

      if (k === "client_name") {
        return normalizeLower(a.client_name).localeCompare(normalizeLower(b.client_name)) * dirMul;
      }

      // numeric counts
      if (k === "call_attempts" || k === "bop_attempts" || k === "followup_attempts") {
        const av = Number(a[k] ?? 0);
        const bv = Number(b[k] ?? 0);
        return (av - bv) * dirMul;
      }

      // date sorts
      const at = parseDateSafe(a[k]);
      const bt = parseDateSafe(b[k]);
      return (at - bt) * dirMul;
    });

    return rows;
  }, [progressRows, progressFilter, progressSort]);

  // ---- all records ----
  async function loadPage(nextPage: number) {
    setError(null);
    setLoading(true);
    try {
      const supabase = getSupabase();

      // Case-insensitive search filters
      const search = q.trim();
      const fc = filterClient.trim();
      const fi = filterInterestType.trim();
      const fb = filterBopStatus.trim();

      let countQuery = supabase
        .from("client_registrations")
        .select("id", { count: "exact", head: true });

      if (search) {
        countQuery = countQuery.or(
          `first_name.ilike.%${search}%,last_name.ilike.%${search}%,phone.ilike.%${search}%`
        );
      }
      if (fc) {
        countQuery = countQuery.or(
          `first_name.ilike.%${fc}%,last_name.ilike.%${fc}%`
        );
      }
      if (fi) countQuery = countQuery.ilike("interest_type", `%${fi}%`);
      if (fb) countQuery = countQuery.ilike("BOP_Status", `%${fb}%`);

      const { count, error: cErr } = await countQuery;
      if (cErr) throw cErr;
      setTotal(count ?? 0);

      const from = nextPage * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;

      let dataQuery = supabase
        .from("client_registrations")
        .select("*")
        .range(from, to);

      if (search) {
        dataQuery = dataQuery.or(
          `first_name.ilike.%${search}%,last_name.ilike.%${search}%,phone.ilike.%${search}%`
        );
      }
      if (fc) {
        dataQuery = dataQuery.or(
          `first_name.ilike.%${fc}%,last_name.ilike.%${fc}%`
        );
      }
      if (fi) dataQuery = dataQuery.ilike("interest_type", `%${fi}%`);
      if (fb) dataQuery = dataQuery.ilike("BOP_Status", `%${fb}%`);

      dataQuery = applySort(dataQuery, sortAll);

      const { data, error } = await dataQuery;
      if (error) throw error;

      const raw = (data || []) as any[];

      // Additional “contains” filters, case-insensitive, supports arrays or comma strings
      const fbo = normalizeLower(filterBusinessOpp);
      const fws = normalizeLower(filterWealthSolutions);
      const ffu = normalizeLower(filterFollowUpStatus);

      const clientSideFiltered = raw.filter((row) => {
        const opp = Array.isArray(row.business_opportunities)
          ? row.business_opportunities.join(",")
          : String(row.business_opportunities || "");
        const ws = Array.isArray(row.wealth_solutions)
          ? row.wealth_solutions.join(",")
          : String(row.wealth_solutions || "");
        const fu = String(row.FollowUp_Status ?? row.Followup_Status ?? "");

        const okOpp = !fbo || normalizeLower(opp).includes(fbo);
        const okWs = !fws || normalizeLower(ws).includes(fws);
        const okFu = !ffu || normalizeLower(fu).includes(ffu);
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

  const updateCell = async (id: string, key: string, rawValue: string) => {
    setSavingId(id);
    setError(null);
    try {
      const supabase = getSupabase();
      const payload: any = {};

      const isDateTime =
        key === "BOP_Date" || key === "CalledOn" || key === "Followup_Date" || key === "Issued";

      payload[key] = isDateTime ? fromLocalInput(rawValue) : rawValue?.trim() ? rawValue : null;

      const { error } = await supabase.from("client_registrations").update(payload).eq("id", id);
      if (error) throw error;

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

  const extraClientCol = useMemo(
    () => [{ label: "Client Name", sortable: "client" as SortKey, render: (r: Row) => clientName(r) }],
    []
  );

  const sortHelp = (
    <div className="text-xs text-slate-600">
      Click headers to sort: <b>Client Name</b>, <b>Created Date</b>, <b>BOP Date</b>,{" "}
      <b>BOP Status</b>, <b>Follow-Up Date</b>, <b>Status</b>.
    </div>
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

        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-red-700">{error}</div>
        )}

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
                Weekly — No of Prospect vs BOP (last 5 weeks incl current)
              </div>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={weekly} margin={{ top: 20, right: 10, bottom: 0, left: 0 }}>
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
              <div className="text-xs font-semibold text-slate-600 mb-2">Monthly (Current Year) — Prospect vs BOP</div>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={monthly} margin={{ top: 20, right: 10, bottom: 0, left: 0 }}>
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

          {trendLoading && <div className="mt-2 text-xs text-slate-500">Loading…</div>}
        </Card>

        {/* Upcoming BOP Date Range */}
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
              {/* show/hide upcoming table */}
              <span title="Show/Hide Upcoming table">
                <Button
                  variant="secondary"
                  onClick={() => setUpcomingVisible((v) => !v)}
                  disabled={!upcoming.length && !upcomingVisible}
                >
                  {upcomingVisible ? "Hide" : "Show"}
                </Button>
              </span>
            </div>
          </div>
        </Card>

        {/* Upcoming Table */}
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
              extraLeftCols={[
                { label: "Client Name", sortable: "client", render: (r) => clientName(r) },
              ]}
              maxHeightClass="max-h-[420px]"
              sortState={sortUpcoming}
              onSortChange={(k) => setSortUpcoming((cur) => toggleSort(cur, k))}
              // show first columns as: Client Name + BOP Date + Created Date, rest same
              preferredOrder={["BOP_Date", "created_at", "BOP_Status", "Followup_Date", "status"]}
              // make Client Name sticky in this table
              stickyClientName
            />
          </Card>
        )}

        {/* Client Progress Summary */}
        <Card title="Client Progress Summary">
          <div className="flex flex-col md:flex-row gap-2 md:items-center justify-between mb-3">
            <div className="flex gap-2 items-center">
              <input
                className="w-80 max-w-full border border-slate-300 px-3 py-2"
                placeholder="Filter by client name…"
                value={progressFilter}
                onChange={(e) => setProgressFilter(e.target.value)}
              />
              <Button variant="secondary" onClick={fetchProgressSummary} disabled={progressLoading}>
                {progressLoading ? "Loading…" : "Refresh"}
              </Button>
            </div>

            <div className="text-xs text-slate-600">Click headers to sort.</div>
          </div>

          <div className="overflow-auto border border-slate-500 bg-white max-h-[420px]">
            <table className="min-w-[1400px] w-full border-collapse">
              <thead className="sticky top-0 bg-slate-100 z-20">
                <tr className="text-left text-xs font-semibold text-slate-700">
                  {[
                    { k: "client_name", label: "Client Name" },
                    { k: "first_name", label: "First Name" },
                    { k: "last_name", label: "Last Name" },
                    { k: "phone", label: "Phone" },
                    { k: "email", label: "Email" },
                    { k: "last_call_date", label: "Last Call On" },
                    { k: "call_attempts", label: "No of Calls" },
                    { k: "last_bop_date", label: "Last BOP Call On" },
                    { k: "bop_attempts", label: "No of BOP Calls" },
                    { k: "last_followup_date", label: "Last FollowUp On" },
                    { k: "followup_attempts", label: "No of FollowUp Calls" },
                  ].map((c, idx) => {
                    const sortable =
                      c.k === "client_name" ||
                      c.k === "last_call_date" ||
                      c.k === "call_attempts" ||
                      c.k === "last_bop_date" ||
                      c.k === "bop_attempts" ||
                      c.k === "last_followup_date" ||
                      c.k === "followup_attempts";

                    const isSticky = idx === 0; // client name sticky
                    return (
                      <th
                        key={c.k}
                        className={`border border-slate-500 px-2 py-2 whitespace-nowrap ${
                          isSticky ? "sticky left-0 z-30 bg-slate-100" : ""
                        }`}
                      >
                        {sortable ? (
                          <button
                            type="button"
                            className="inline-flex items-center hover:underline"
                            onClick={() =>
                              setProgressSort((cur) => toggleProgressSort(cur, c.k as ProgressSortKey))
                            }
                          >
                            <div style={{ resize: "horizontal", overflow: "auto" }}>{c.label}</div>
                            <span className="ml-1 text-slate-400">↕</span>
                          </button>
                        ) : (
                          <div style={{ resize: "horizontal", overflow: "auto" }}>{c.label}</div>
                        )}
                      </th>
                    );
                  })}
                </tr>
              </thead>

              <tbody>
                {progressView.map((r, i) => (
                  <tr key={`${r.clientid}-${i}`} className="hover:bg-slate-50">
                    <td className="border border-slate-300 px-2 py-2 whitespace-nowrap font-semibold sticky left-0 z-10 bg-white">
                      {r.client_name}
                    </td>
                    <td className="border border-slate-300 px-2 py-2">{r.first_name || ""}</td>
                    <td className="border border-slate-300 px-2 py-2">{r.last_name || ""}</td>
                    <td className="border border-slate-300 px-2 py-2">{r.phone || ""}</td>
                    <td className="border border-slate-300 px-2 py-2">{r.email || ""}</td>
                    <td className="border border-slate-300 px-2 py-2">{r.last_call_date ? new Date(r.last_call_date).toLocaleString() : ""}</td>
                    <td className="border border-slate-300 px-2 py-2">{r.call_attempts ?? ""}</td>
                    <td className="border border-slate-300 px-2 py-2">{r.last_bop_date ? new Date(r.last_bop_date).toLocaleString() : ""}</td>
                    <td className="border border-slate-300 px-2 py-2">{r.bop_attempts ?? ""}</td>
                    <td className="border border-slate-300 px-2 py-2">{r.last_followup_date ? new Date(r.last_followup_date).toLocaleString() : ""}</td>
                    <td className="border border-slate-300 px-2 py-2">{r.followup_attempts ?? ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
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
              {total.toLocaleString()} records • showing {PAGE_SIZE} per page
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

          <div className="mt-2 text-xs text-slate-600">
            Tip: Enter filters and click <b>Go</b>. Search is case-insensitive.
          </div>
        </Card>

        {/* All Records */}
        <Card title="All Records (Editable) — Pagination (50 per page)">
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
              <Button
                variant="secondary"
                onClick={() => loadPage(page + 1)}
                disabled={!canNext || loading}
              >
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
              maxHeightClass="max-h-[560px]"
              sortState={sortAll}
              onSortChange={(k) => setSortAll((cur) => toggleSort(cur, k))}
              stickyClientName
            />
          )}
        </Card>
      </div>
    </div>
  );
}

/** Excel-like table with:
 * - sticky header
 * - sticky Client Name column (first column)
 * - list popup for readonly list-cols
 * - editable inputs for others
 * - header label “resize” support (simple browser resize handle)
 */
function ExcelTable({
  rows,
  savingId,
  onUpdate,
  extraLeftCols,
  maxHeightClass,
  sortState,
  onSortChange,
  preferredOrder,
  stickyClientName,
}: {
  rows: Row[];
  savingId: string | null;
  onUpdate: (id: string, key: string, value: string) => void;
  extraLeftCols: { label: string; render: (r: Row) => string; sortable?: SortKey }[];
  maxHeightClass: string;
  sortState: { key: SortKey; dir: SortDir };
  onSortChange: (key: SortKey) => void;
  preferredOrder?: string[];
  stickyClientName?: boolean;
}) {
  const [openCell, setOpenCell] = useState<string | null>(null);

  const sortIcon = (k?: SortKey) => {
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
    for (const k of preferredOrder) if (set.has(k)) ordered.push(k);
    for (const k of baseKeys) if (!ordered.includes(k)) ordered.push(k);
    return ordered;
  }, [rows, preferredOrder]);

  return (
    <div className={`overflow-auto border border-slate-500 bg-white ${maxHeightClass}`}>
      <table className="min-w-[2200px] w-full border-collapse">
        <thead className="sticky top-0 bg-slate-100 z-20">
          <tr className="text-left text-xs font-semibold text-slate-700">
            {extraLeftCols.map((c, idx) => {
              const sticky = stickyClientName && idx === 0;
              return (
                <th
                  key={c.label}
                  className={`border border-slate-500 px-2 py-2 whitespace-nowrap ${
                    sticky ? "sticky left-0 z-30 bg-slate-100" : ""
                  }`}
                  style={sticky ? { minWidth: 160 } : undefined}
                >
                  {c.sortable ? (
                    <button
                      className="inline-flex items-center hover:underline"
                      onClick={() => onSortChange(c.sortable!)}
                      type="button"
                    >
                      <div style={{ resize: "horizontal", overflow: "auto" }}>{c.label}</div>
                      {sortIcon(c.sortable)}
                    </button>
                  ) : (
                    <div style={{ resize: "horizontal", overflow: "auto" }}>{c.label}</div>
                  )}
                </th>
              );
            })}

            {keys.map((k) => {
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
                  : undefined;

              return (
                <th key={k} className="border border-slate-500 px-2 py-2 whitespace-nowrap">
                  {sortable ? (
                    <button
                      className="inline-flex items-center hover:underline"
                      onClick={() => onSortChange(sortable)}
                      type="button"
                    >
                      <div style={{ resize: "horizontal", overflow: "auto" }}>{labelFor(k)}</div>
                      {sortIcon(sortable)}
                    </button>
                  ) : (
                    <div style={{ resize: "horizontal", overflow: "auto" }}>{labelFor(k)}</div>
                  )}
                </th>
              );
            })}
          </tr>
        </thead>

        <tbody>
          {rows.map((r) => (
            <tr key={String(r.id)} className="hover:bg-slate-50">
              {extraLeftCols.map((c, idx) => {
                const sticky = stickyClientName && idx === 0;
                return (
                  <td
                    key={c.label}
                    className={`border border-slate-300 px-2 py-2 whitespace-nowrap font-semibold text-slate-800 ${
                      sticky ? "sticky left-0 z-10 bg-white" : ""
                    }`}
                    style={sticky ? { minWidth: 160 } : undefined}
                  >
                    {c.render(r)}
                  </td>
                );
              })}

              {keys.map((k) => {
                const cellId = `${r.id}:${k}`;
                const val = r[k];

                if (k === "created_at") {
                  const d = new Date(r.created_at);
                  return (
                    <td key={k} className="border border-slate-300 px-2 py-2 whitespace-nowrap">
                      {Number.isNaN(d.getTime()) ? "" : d.toLocaleDateString()}
                    </td>
                  );
                }

                // Read-only list popup
                if (READONLY_LIST_COLS.has(k)) {
                  const items = asListItems(val);
                  const display = items.join(", ");
                  return (
                    <td key={k} className="border border-slate-300 px-2 py-2 align-top">
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
                            <div className="px-2 py-1 text-xs font-semibold text-slate-700 bg-slate-100 border-b border-slate-300 flex items-center justify-between">
                              <span>{labelFor(k)}</span>
                              <button
                                type="button"
                                className="text-slate-600 hover:underline"
                                onClick={() => setOpenCell(null)}
                              >
                                Close
                              </button>
                            </div>
                            <ul className="max-h-48 overflow-auto">
                              {(items.length ? items : ["(empty)"]).map((x, idx) => (
                                <li key={idx} className="px-2 py-1 text-sm border-b border-slate-100">
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

                const isDateTime =
                  k === "BOP_Date" || k === "CalledOn" || k === "Followup_Date" || k === "Issued";
                const defaultValue = isDateTime ? toLocalInput(val) : (val ?? "");

                return (
                  <td key={k} className="border border-slate-300 px-2 py-2">
                    <input
                      type={isDateTime ? "datetime-local" : "text"}
                      className="w-full bg-transparent border-0 outline-none text-sm"
                      defaultValue={defaultValue}
                      disabled={savingId === String(r.id)}
                      onBlur={(e) => onUpdate(String(r.id), k, e.target.value)}
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
