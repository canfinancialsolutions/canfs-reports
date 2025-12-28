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
type SortKey = "client" | "created_at" | "BOP_Date" | "BOP_Status" | "Followup_Date" | "status";
type SortDir = "asc" | "desc";

const PAGE_SIZE = 50;

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

  last_call_date: "Last Call On",
  call_attempts: "No of Calls",
  last_bop_date: "Last BOP Call On",
  bop_attempts: "No of BOP Calls",
  last_followup_date: "Last FollowUp On",
  followup_attempts: "No of FollowUp Calls",
};

function labelFor(key: string) {
  if (LABEL_OVERRIDES[key]) return LABEL_OVERRIDES[key];
  const s = key.replace(/_/g, " ").replace(/([a-z])([A-Z])/g, "$1 $2").trim();
  const acronyms = new Set(["BOP", "ID", "API", "URL", "CAN"]);
  return s
    .split(/\s+/)
    .map((w) => (acronyms.has(w.toUpperCase()) ? w.toUpperCase() : w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()))
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
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
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

function safeDateLabel(v: any) {
  if (!v) return "";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString();
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
  const [sortUpcoming, setSortUpcoming] = useState<{ key: SortKey; dir: SortDir }>({ key: "BOP_Date", dir: "asc" });

  // Client Progress Summary
  const [progressRows, setProgressRows] = useState<Row[]>([]);
  const [progressLoading, setProgressLoading] = useState(false);
  const [progressFilter, setProgressFilter] = useState("");
  const [progressSort, setProgressSort] = useState<{
    key:
      | "client_name"
      | "last_call_date"
      | "call_attempts"
      | "last_bop_date"
      | "bop_attempts"
      | "last_followup_date"
      | "followup_attempts";
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
  const [sortAll, setSortAll] = useState<{ key: SortKey; dir: SortDir }>({ key: "created_at", dir: "desc" });

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
    if (upcoming.length) fetchUpcoming();
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

      // last 5 weeks incl current
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
        })),
      );

      // current year monthly
      const yearStart = startOfYear(new Date());
      const nextYear = addYears(yearStart, 1);

      const { data: yearRows, error: yearErr } = await supabase
        .from("client_registrations")
        .select("created_at, BOP_Date")
        .gte("created_at", yearStart.toISOString())
        .lt("created_at", nextYear.toISOString())
        .order("created_at", { ascending: true })
        .limit(300000);

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
        })),
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
          "clientid, first_name, last_name, phone, email, last_call_date, call_attempts, last_bop_date, bop_attempts, last_followup_date, followup_attempts",
        )
        .order("clientid", { ascending: false })
        .limit(10000);

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

      // Case-insensitive (ilike) already
      if (search) countQuery = countQuery.or(`first_name.ilike.%${search}%,last_name.ilike.%${search}%,phone.ilike.%${search}%`);
      if (fc) countQuery = countQuery.or(`first_name.ilike.%${fc}%,last_name.ilike.%${fc}%`);
      if (fi) countQuery = countQuery.ilike("interest_type", `%${fi}%`);
      if (fb) countQuery = countQuery.ilike("BOP_Status", `%${fb}%`);

      const { count, error: cErr } = await countQuery;
      if (cErr) throw cErr;
      setTotal(count ?? 0);

      const from = nextPage * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;

      let dataQuery = supabase.from("client_registrations").select("*").range(from, to);

      if (search) dataQuery = dataQuery.or(`first_name.ilike.%${search}%,last_name.ilike.%${search}%,phone.ilike.%${search}%`);
      if (fc) dataQuery = dataQuery.or(`first_name.ilike.%${fc}%,last_name.ilike.%${fc}%`);
      if (fi) dataQuery = dataQuery.ilike("interest_type", `%${fi}%`);
      if (fb) dataQuery = dataQuery.ilike("BOP_Status", `%${fb}%`);

      dataQuery = applySort(dataQuery, sortAll);

      const { data, error } = await dataQuery;
      if (error) throw error;

      // Additional filters for array/text columns (client-side, case-insensitive)
      const raw = (data || []) as any[];
      const fbo = filterBusinessOpp.trim().toLowerCase();
      const fws = filterWealthSolutions.trim().toLowerCase();
      const ffu = filterFollowUpStatus.trim().toLowerCase();

      const clientSideFiltered = raw.filter((row) => {
        const opp = Array.isArray(row.business_opportunities) ? row.business_opportunities.join(",") : String(row.business_opportunities || "");
        const ws = Array.isArray(row.wealth_solutions) ? row.wealth_solutions.join(",") : String(row.wealth_solutions || "");
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
    () => [{ label: "Client Name", sortable: "client" as SortKey, render: (r: Row) => clientName(r) }],
    [],
  );

  // Progress Summary sorting/filter (client-side)
  const progressView = useMemo(() => {
    const f = progressFilter.trim().toLowerCase();
    let rows = [...progressRows];
    if (f) rows = rows.filter((r) => String(r.client_name || "").toLowerCase().includes(f));

    const dirMul = progressSort.dir === "asc" ? 1 : -1;
    rows.sort((a, b) => {
      const k = progressSort.key;
      const av = a[k];
      const bv = b[k];

      // numeric columns
      if (k === "call_attempts" || k === "bop_attempts" || k === "followup_attempts") {
        const an = Number(av ?? 0);
        const bn = Number(bv ?? 0);
        return (an - bn) * dirMul;
      }

      // date columns
      if (k === "last_call_date" || k === "last_bop_date" || k === "last_followup_date") {
        const ad = av ? new Date(av).getTime() : 0;
        const bd = bv ? new Date(bv).getTime() : 0;
        return (ad - bd) * dirMul;
      }

      // default string
      return String(av ?? "")
        .localeCompare(String(bv ?? ""), undefined, { sensitivity: "base" }) * dirMul;
    });

    return rows;
  }, [progressRows, progressFilter, progressSort]);

  const onToggleProgressSort = (key: typeof progressSort.key) => {
    setProgressSort((cur) => (cur.key === key ? { key, dir: cur.dir === "asc" ? "desc" : "asc" } : { key, dir: "asc" }));
  };

  return (
    <div className="min-h-screen">
      <div className="max-w-[1600px] mx-auto p-6 space-y-6">
        <header className="flex items-center gap-3">
          <img src="/can-logo.png" className="h-10 w-auto" alt="CAN Financial Solutions" />
          <div className="flex-1">
            <div className="text-2xl font-bold text-slate-800">CAN Financial Solutions Clients Report</div>
            <div className="text-sm text-slate-500">Excel-style tables, editable follow-ups, and trends</div>
          </div>
          <Button variant="secondary" onClick={logout}>
            Logout
          </Button>
        </header>

        {error && <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-red-700">{error}</div>}

        {/* Trends */}
        <Card title="Trends">
          <div className="flex items-center justify-between mb-3">
            <div className="text-xs font-semibold text-slate-600">Weekly & Monthly (Prospects vs BOP)</div>
            <Button variant="secondary" onClick={fetchTrends}>
              Refresh
            </Button>
          </div>

          <div className="grid lg:grid-cols-2 gap-6">
            <div>
              <div className="text-xs font-semibold text-slate-600 mb-2">Weekly — No of Prospect vs BOP (last 5 weeks incl current)</div>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={weekly}
                    margin={{ top: 18, right: 20, left: 0, bottom: 0 }}
                  >
                    <XAxis
                      dataKey="weekEnd"
                      tick={{ fontSize: 11 }}
                      tickFormatter={(v) => {
                        // show as MM-dd
                        if (!v) return "";
                        const d = new Date(v);
                        if (Number.isNaN(d.getTime())) return String(v);
                        return format(d, "MM-dd");
                      }}
                    />
                    <YAxis allowDecimals={false} />
                    <Tooltip />
                    <Legend />
                    <Line type="monotone" dataKey="prospects" name="Prospects" stroke="#2563eb" dot>
                      <LabelList dataKey="prospects" position="top" style={{ fontSize: 12 }} />
                    </Line>
                    <Line type="monotone" dataKey="bops" name="BOP" stroke="#f97316" dot>
                      <LabelList dataKey="bops" position="top" style={{ fontSize: 12 }} />
                    </Line>
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div>
              <div className="text-xs font-semibold text-slate-600 mb-2">Monthly (Current Year) — Prospects vs BOP</div>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={monthly}
                    margin={{ top: 18, right: 20, left: 0, bottom: 0 }}
                  >
                    <XAxis
                      dataKey="month"
                      tick={{ fontSize: 11 }}
                      tickFormatter={(v) => {
                        // show month only
                        if (!v) return "";
                        const s = String(v);
                        const mm = s.split("-")[1] || s;
                        return mm;
                      }}
                    />
                    <YAxis allowDecimals={false} />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="prospects" name="Prospects" fill="#16a34a">
                      <LabelList dataKey="prospects" position="top" style={{ fontSize: 12 }} />
                    </Bar>
                    <Bar dataKey="bops" name="BOP" fill="#9333ea">
                      <LabelList dataKey="bops" position="top" style={{ fontSize: 12 }} />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {trendLoading && <div className="mt-2 text-xs text-slate-500">Loading…</div>}
        </Card>

        {/* Upcoming BOP range */}
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
        </Card>

        {/* Upcoming table */}
        {upcoming.length > 0 && (
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
              preferredOrder={["BOP_Date", "created_at", "BOP_Status", "Followup_Date", "status"]}
              stickyFirstCol // Client Name frozen
            />
          </Card>
        )}

        {/* Client Progress Summary */}
        <Card title="Client Progress Summary">
          <div className="flex flex-col md:flex-row gap-2 md:items-center mb-3">
            <input
              className="w-full md:w-[420px] border border-slate-300 px-4 py-3"
              placeholder="Filter by client name…"
              value={progressFilter}
              onChange={(e) => setProgressFilter(e.target.value)}
            />
            <Button variant="secondary" onClick={fetchProgressSummary} disabled={progressLoading}>
              {progressLoading ? "Loading…" : "Refresh"}
            </Button>

            <div className="text-xs text-slate-600 md:ml-auto">Click headers to sort.</div>
          </div>

          <div className="overflow-auto border border-slate-500 bg-white max-h-[460px]">
            <table className="min-w-[1300px] w-full border-collapse">
              <thead className="sticky top-0 bg-slate-100 z-10">
                <tr className="text-left text-xs font-semibold text-slate-700">
                  <th className="border border-slate-500 px-2 py-2 whitespace-nowrap sticky left-0 bg-slate-100 z-20">
                    <button className="inline-flex items-center hover:underline" type="button" onClick={() => onToggleProgressSort("client_name")}>
                      Client Name
                    </button>
                  </th>
                  <th className="border border-slate-500 px-2 py-2 whitespace-nowrap">First Name</th>
                  <th className="border border-slate-500 px-2 py-2 whitespace-nowrap">Last Name</th>
                  <th className="border border-slate-500 px-2 py-2 whitespace-nowrap">Phone</th>
                  <th className="border border-slate-500 px-2 py-2 whitespace-nowrap">Email</th>

                  <th className="border border-slate-500 px-2 py-2 whitespace-nowrap">
                    <button className="inline-flex items-center hover:underline" type="button" onClick={() => onToggleProgressSort("last_call_date")}>
                      Last Call On
                    </button>
                  </th>
                  <th className="border border-slate-500 px-2 py-2 whitespace-nowrap">
                    <button className="inline-flex items-center hover:underline" type="button" onClick={() => onToggleProgressSort("call_attempts")}>
                      No of Calls
                    </button>
                  </th>
                  <th className="border border-slate-500 px-2 py-2 whitespace-nowrap">
                    <button className="inline-flex items-center hover:underline" type="button" onClick={() => onToggleProgressSort("last_bop_date")}>
                      Last BOP Call On
                    </button>
                  </th>
                  <th className="border border-slate-500 px-2 py-2 whitespace-nowrap">
                    <button className="inline-flex items-center hover:underline" type="button" onClick={() => onToggleProgressSort("bop_attempts")}>
                      No of BOP Calls
                    </button>
                  </th>
                  <th className="border border-slate-500 px-2 py-2 whitespace-nowrap">
                    <button className="inline-flex items-center hover:underline" type="button" onClick={() => onToggleProgressSort("last_followup_date")}>
                      Last FollowUp On
                    </button>
                  </th>
                  <th className="border border-slate-500 px-2 py-2 whitespace-nowrap">
                    <button className="inline-flex items-center hover:underline" type="button" onClick={() => onToggleProgressSort("followup_attempts")}>
                      No of FollowUp Calls
                    </button>
                  </th>
                </tr>
              </thead>

              <tbody>
                {progressView.map((r, idx) => (
                  <tr key={String(r.clientid ?? idx)} className="hover:bg-slate-50">
                    <td className="border border-slate-300 px-2 py-2 whitespace-nowrap font-semibold text-slate-800 sticky left-0 bg-white z-10">
                      {String(r.client_name || "")}
                    </td>
                    <td className="border border-slate-300 px-2 py-2 whitespace-nowrap">{String(r.first_name || "")}</td>
                    <td className="border border-slate-300 px-2 py-2 whitespace-nowrap">{String(r.last_name || "")}</td>
                    <td className="border border-slate-300 px-2 py-2 whitespace-nowrap">{String(r.phone || "")}</td>
                    <td className="border border-slate-300 px-2 py-2 whitespace-nowrap">{String(r.email || "")}</td>
                    <td className="border border-slate-300 px-2 py-2 whitespace-nowrap">{safeDateLabel(r.last_call_date)}</td>
                    <td className="border border-slate-300 px-2 py-2 whitespace-nowrap">{String(r.call_attempts ?? "")}</td>
                    <td className="border border-slate-300 px-2 py-2 whitespace-nowrap">{safeDateLabel(r.last_bop_date)}</td>
                    <td className="border border-slate-300 px-2 py-2 whitespace-nowrap">{String(r.bop_attempts ?? "")}</td>
                    <td className="border border-slate-300 px-2 py-2 whitespace-nowrap">{safeDateLabel(r.last_followup_date)}</td>
                    <td className="border border-slate-300 px-2 py-2 whitespace-nowrap">{String(r.followup_attempts ?? "")}</td>
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
            Tip: Enter filters and click <b>Go</b> to apply. Search/filters are not case sensitive.
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
              <Button variant="secondary" onClick={() => loadPage(Math.max(0, page - 1))} disabled={!canPrev || loading}>
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
              maxHeightClass="max-h-[560px]"
              sortState={sortAll}
              onSortChange={(k) => setSortAll((cur) => toggleSort(cur, k))}
              stickyFirstCol // Client Name frozen
              resizableColumns // enable column resizing for this table
            />
          )}
        </Card>
      </div>
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
  stickyFirstCol,
  resizableColumns,
}: {
  rows: Row[];
  savingId: string | null;
  onUpdate: (id: string, key: string, value: string) => void;
  extraLeftCols: { label: string; render: (r: Row) => string; sortable?: SortKey }[];
  maxHeightClass: string;
  sortState: { key: SortKey; dir: SortDir };
  onSortChange: (key: SortKey) => void;
  preferredOrder?: string[];
  stickyFirstCol?: boolean;
  resizableColumns?: boolean;
}) {
  const [openCell, setOpenCell] = useState<string | null>(null);
  const popoverRef = useRef<HTMLDivElement | null>(null);

  // Close popup when clicking outside
  useEffect(() => {
    function onDocDown(e: MouseEvent) {
      if (!openCell) return;
      const t = e.target as HTMLElement | null;
      if (!t) return;
      if (popoverRef.current && popoverRef.current.contains(t)) return;
      setOpenCell(null);
    }
    document.addEventListener("mousedown", onDocDown);
    return () => document.removeEventListener("mousedown", onDocDown);
  }, [openCell]);

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

  // Column widths (resizable)
  // index includes extraLeftCols first, then keys
  const [colW, setColW] = useState<Record<number, number>>({});
  const dragRef = useRef<{
    idx: number;
    startX: number;
    startW: number;
  } | null>(null);

  const onStartResize = (idx: number, e: React.MouseEvent) => {
    if (!resizableColumns) return;
    e.preventDefault();
    e.stopPropagation();
    const startW = colW[idx] ?? 160;
    dragRef.current = { idx, startX: e.clientX, startW };
    const onMove = (ev: MouseEvent) => {
      const d = dragRef.current;
      if (!d) return;
      const next = Math.max(80, Math.min(600, d.startW + (ev.clientX - d.startX)));
      setColW((p) => ({ ...p, [d.idx]: next }));
    };
    const onUp = () => {
      dragRef.current = null;
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  };

  const thStyle = (idx: number): React.CSSProperties | undefined => {
    if (!resizableColumns) return undefined;
    const w = colW[idx];
    if (!w) return undefined;
    return { width: w, minWidth: w, maxWidth: w };
  };

  const stickyStyle = (isSticky: boolean): React.CSSProperties | undefined => {
    if (!isSticky) return undefined;
    return { position: "sticky", left: 0, zIndex: 20 };
  };

  const tdStickyStyle = (isSticky: boolean): React.CSSProperties | undefined => {
    if (!isSticky) return undefined;
    return { position: "sticky", left: 0, zIndex: 10, background: "white" };
  };

  return (
    <div className={`overflow-auto border border-slate-500 bg-white ${maxHeightClass}`}>
      <table className="min-w-[2600px] w-full border-collapse">
        <thead className="sticky top-0 bg-slate-100 z-10">
          <tr className="text-left text-xs font-semibold text-slate-700">
            {extraLeftCols.map((c, i) => {
              const isSticky = Boolean(stickyFirstCol && i === 0);
              return (
                <th
                  key={c.label}
                  className={`border border-slate-500 px-2 py-2 whitespace-nowrap ${isSticky ? "bg-slate-100" : ""}`}
                  style={{ ...thStyle(i), ...stickyStyle(isSticky) }}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      {c.sortable ? (
                        <button className="inline-flex items-center hover:underline" onClick={() => onSortChange(c.sortable!)} type="button">
                          {c.label}
                          {sortIcon(c.sortable)}
                        </button>
                      ) : (
                        c.label
                      )}
                    </div>

                    {resizableColumns && (
                      <div
                        onMouseDown={(e) => onStartResize(i, e)}
                        className="w-2 h-5 cursor-col-resize opacity-60 hover:opacity-100"
                        title="Drag to resize"
                      />
                    )}
                  </div>
                </th>
              );
            })}

            {keys.map((k, j) => {
              const idx = extraLeftCols.length + j;

              const sortable =
                k === "created_at"
                  ? "created_at"
                  : k === "BOP_Date"
                    ? "BOP_Date"
                    : k === "BOP_Status"
                      ? "BOP_Status"
                      : k === "Followup_Date"
                        ? "Followup_Date"
                        : k === "status"
                          ? "status"
                          : undefined;

              return (
                <th key={k} className="border border-slate-500 px-2 py-2 whitespace-nowrap" style={thStyle(idx)}>
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      {sortable ? (
                        <button className="inline-flex items-center hover:underline" onClick={() => onSortChange(sortable as SortKey)} type="button">
                          {labelFor(k)}
                          {sortIcon(sortable as SortKey)}
                        </button>
                      ) : (
                        labelFor(k)
                      )}
                    </div>

                    {resizableColumns && (
                      <div
                        onMouseDown={(e) => onStartResize(idx, e)}
                        className="w-2 h-5 cursor-col-resize opacity-60 hover:opacity-100"
                        title="Drag to resize"
                      />
                    )}
                  </div>
                </th>
              );
            })}
          </tr>
        </thead>

        <tbody>
          {rows.map((r) => (
            <tr key={String(r.id)} className="hover:bg-slate-50">
              {extraLeftCols.map((c, i) => {
                const isSticky = Boolean(stickyFirstCol && i === 0);
                return (
                  <td
                    key={c.label}
                    className="border border-slate-300 px-2 py-2 whitespace-nowrap font-semibold text-slate-800"
                    style={tdStickyStyle(isSticky)}
                  >
                    {c.render(r)}
                  </td>
                );
              })}

              {keys.map((k) => {
                const cellId = `${r.id}:${k}`;
                const val = r[k];

                if (k === "created_at") {
                  return (
                    <td key={k} className="border border-slate-300 px-2 py-2 whitespace-nowrap">
                      {safeDateLabel(r.created_at)}
                    </td>
                  );
                }

                if (READONLY_LIST_COLS.has(k)) {
                  const items = asListItems(val);
                  const display = items.join(", ");
                  return (
                    <td key={k} className="border border-slate-300 px-2 py-2 align-top">
                      <div className="relative" ref={openCell === cellId ? popoverRef : undefined}>
                        <button
                          type="button"
                          className="w-full text-left text-slate-800 whitespace-normal break-words"
                          onClick={() => setOpenCell((cur) => (cur === cellId ? null : cellId))}
                        >
                          {display || "—"}
                        </button>

                        {openCell === cellId && (
                          <div className="absolute left-0 top-full mt-1 w-72 max-w-[70vw] bg-white border border-slate-500 shadow-lg z-20">
                            <div className="px-2 py-1 text-xs font-semibold text-slate-700 bg-slate-100 border-b border-slate-300 flex items-center justify-between">
                              <span>{labelFor(k)}</span>
                              <button className="text-slate-600 hover:underline" type="button" onClick={() => setOpenCell(null)}>
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

                const isDateTime = k === "BOP_Date" || k === "CalledOn" || k === "Followup_Date" || k === "Issued";
                const defaultValue = isDateTime ? toLocalInput(val) : val ?? "";

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
