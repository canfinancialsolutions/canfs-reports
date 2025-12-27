"use client";

export const dynamic = "force-dynamic";

import { useEffect, useMemo, useState } from "react";
import * as XLSX from "xlsx";
import { addDays, addYears, endOfWeek, format, isValid, parseISO, startOfYear, subMonths } from "date-fns";
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, BarChart, Bar } from "recharts";
import { getSupabase } from "@/lib/supabaseClient";
import { Button, Card, Pill } from "@/components/ui";

type Row = {
  id: string;
  created_at: string;

  status: string | null;
  interest_type: string | null;

  business_opportunities: string[] | null;
  wealth_solutions: string[] | null;

  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  email: string | null;
  profession: string | null;

  preferred_days: string[] | null;
  preferred_time: string | null;
  referred_by: string | null;

  CalledOn: string | null;
  BOP_Date: string | null;
  BOP_Status: string | null;

  Followup_Date: string | null;
  FollowUp_Status: string | null;

  Product: string | null;
  Issued: string | null;

  Comment: string | null;
  Remark: string | null;
};

type ColType = "text" | "datetime" | "array";

type SortKey = "client" | "created_at" | "BOP_Date" | "BOP_Status" | "Followup_Date" | "status";
type SortDir = "asc" | "desc";

const PAGE_SIZE = 100;

const LABEL_OVERRIDES: Record<string, string> = {
  created_at: "Created Date",
  interest_type: "Interest Type",
  business_opportunities: "Business Opportunities",
  wealth_solutions: "Wealth Solutions",
  first_name: "First Name",
  last_name: "Last Name",
  preferred_days: "Preferred Days",
  preferred_time: "Preferred Time",
  referred_by: "Referred By",
  CalledOn: "Called On",
  BOP_Date: "BOP Date",
  BOP_Status: "BOP Status",
  Followup_Date: "Follow-Up Date",
  FollowUp_Status: "Follow-Up Status",
  Product: "Product",
  Issued: "Issued",
};

function toTitleCaseLabel(key: string) {
  if (LABEL_OVERRIDES[key]) return LABEL_OVERRIDES[key];

  const withSpaces = key.replace(/_/g, " ").replace(/([a-z])([A-Z])/g, "$1 $2").trim();
  const acronyms = new Set(["BOP", "ID", "API", "URL", "CAN"]);
  return withSpaces
    .split(/\s+/)
    .map((w) => {
      const up = w.toUpperCase();
      if (acronyms.has(up)) return up;
      return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
    })
    .join(" ");
}

function toLocalInput(value: string | null) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(
    d.getMinutes()
  )}`;
}
function fromLocalInput(value: string) {
  if (!value?.trim()) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}
function arrayToText(v: string[] | null) {
  if (!v || v.length === 0) return "";
  return v.join(", ");
}
function textToArray(v: string) {
  const items = v.split(",").map((x) => x.trim()).filter(Boolean);
  return items.length ? items : null;
}
function fmtDateTime(value: string | null) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString();
}
function clientName(r: Row) {
  return `${r.first_name || ""} ${r.last_name || ""}`.trim();
}

const COLUMNS: { key: keyof Row; type: ColType; sortable?: SortKey }[] = [
  { key: "created_at", type: "text", sortable: "created_at" },
  { key: "status", type: "text", sortable: "status" },
  { key: "interest_type", type: "text" },

  { key: "business_opportunities", type: "array" },
  { key: "wealth_solutions", type: "array" },

  { key: "first_name", type: "text" },
  { key: "last_name", type: "text" },
  { key: "phone", type: "text" },
  { key: "email", type: "text" },
  { key: "profession", type: "text" },

  { key: "preferred_days", type: "array" },
  { key: "preferred_time", type: "text" },
  { key: "referred_by", type: "text" },

  { key: "CalledOn", type: "datetime" },
  { key: "BOP_Date", type: "datetime", sortable: "BOP_Date" },
  { key: "BOP_Status", type: "text", sortable: "BOP_Status" },

  { key: "Followup_Date", type: "datetime", sortable: "Followup_Date" },
  { key: "FollowUp_Status", type: "text" },

  { key: "Product", type: "text" },
  { key: "Issued", type: "datetime" },

  { key: "Comment", type: "text" },
  { key: "Remark", type: "text" },
];

function toggleSort(current: { key: SortKey; dir: SortDir }, nextKey: SortKey) {
  if (current.key !== nextKey) return { key: nextKey, dir: "asc" as SortDir };
  return { key: nextKey, dir: current.dir === "asc" ? ("desc" as SortDir) : ("asc" as SortDir) };
}

export default function Dashboard() {
  const [records, setRecords] = useState<Row[]>([]);
  const [totalCount, setTotalCount] = useState<number | null>(null);
  const [page, setPage] = useState(0);
  const [pageJump, setPageJump] = useState<string>("1");

  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [sortAll, setSortAll] = useState<{ key: SortKey; dir: SortDir }>({ key: "created_at", dir: "desc" });
  const [sortUpcoming, setSortUpcoming] = useState<{ key: SortKey; dir: SortDir }>({ key: "BOP_Date", dir: "asc" });
  const [sortLatest, setSortLatest] = useState<{ key: SortKey; dir: SortDir }>({ key: "created_at", dir: "desc" });

  // Latest 500
  const [latestRows, setLatestRows] = useState<Row[]>([]);
  const [latestLoading, setLatestLoading] = useState(false);

  // Upcoming report
  const [rangeStart, setRangeStart] = useState(format(new Date(), "yyyy-MM-dd"));
  const [rangeEnd, setRangeEnd] = useState(format(addDays(new Date(), 30), "yyyy-MM-dd"));
  const [upcomingRows, setUpcomingRows] = useState<Row[]>([]);
  const [upcomingLoading, setUpcomingLoading] = useState(false);

  // Trends
  const [weeklyTrend, setWeeklyTrend] = useState<{ weekEnd: string; count: number }[]>([]);
  const [monthlyTrend, setMonthlyTrend] = useState<{ month: string; count: number }[]>([]);
  const [trendLoading, setTrendLoading] = useState(false);

  // Auth guard + initial loads
  useEffect(() => {
    (async () => {
      try {
        const supabase = getSupabase();
        const { data } = await supabase.auth.getSession();
        if (!data.session) {
          window.location.href = "/";
          return;
        }
        await Promise.all([loadPage(0), fetchLatest500(), fetchUpcoming(rangeStart, rangeEnd), fetchTrends()]);
      } catch (e: any) {
        setError(e?.message || "Failed to initialize");
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Refresh upcoming when date range / sort changes
  useEffect(() => {
    fetchUpcoming(rangeStart, rangeEnd);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rangeStart, rangeEnd, sortUpcoming.key, sortUpcoming.dir]);

  // Reload All Records when sort changes
  useEffect(() => {
    loadPage(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sortAll.key, sortAll.dir]);

  // Reload latest 500 on sort change
  useEffect(() => {
    fetchLatest500();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sortLatest.key, sortLatest.dir]);

  function applySort(query: any, sort: { key: SortKey; dir: SortDir }) {
    const ascending = sort.dir === "asc";
    if (sort.key === "client") return query.order("first_name", { ascending }).order("last_name", { ascending });
    return query.order(sort.key, { ascending });
  }

  async function fetchLatest500() {
    setLatestLoading(true);
    setError(null);
    try {
      const supabase = getSupabase();
      let query = supabase
        .from("client_registrations")
        .select(
          "id,created_at,status,interest_type,business_opportunities,wealth_solutions,first_name,last_name,phone,email,profession,preferred_days,preferred_time,referred_by,CalledOn,BOP_Date,BOP_Status,Followup_Date,FollowUp_Status,Product,Issued,Comment,Remark"
        )
        .limit(500);

      query = applySort(query, sortLatest);

      const { data, error } = await query;
      if (error) throw error;
      setLatestRows((data || []) as Row[]);
    } catch (e: any) {
      setError(e?.message || "Failed to load latest 500");
    } finally {
      setLatestLoading(false);
    }
  }

  async function loadPage(nextPage: number) {
    setError(null);
    setLoading(true);
    try {
      const supabase = getSupabase();
      const search = q.trim();

      // Count (no ordering)
      let countQuery = supabase.from("client_registrations").select("id", { count: "exact", head: true });
      if (search) {
        countQuery = countQuery.or(`first_name.ilike.%${search}%,last_name.ilike.%${search}%,phone.ilike.%${search}%`);
      }
      const { count, error: countErr } = await countQuery;
      if (countErr) throw countErr;
      setTotalCount(count ?? 0);

      // Data
      const from = nextPage * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;

      let dataQuery = supabase
        .from("client_registrations")
        .select(
          "id,created_at,status,interest_type,business_opportunities,wealth_solutions,first_name,last_name,phone,email,profession,preferred_days,preferred_time,referred_by,CalledOn,BOP_Date,BOP_Status,Followup_Date,FollowUp_Status,Product,Issued,Comment,Remark"
        )
        .range(from, to);

      if (search) {
        dataQuery = dataQuery.or(
          `first_name.ilike.%${search}%,last_name.ilike.%${search}%,phone.ilike.%${search}%`
        );
      }

      dataQuery = applySort(dataQuery, sortAll);

      const { data, error: dataErr } = await dataQuery;
      if (dataErr) throw dataErr;

      setRecords((data || []) as Row[]);
      setPage(nextPage);
      setPageJump(String(nextPage + 1));
    } catch (e: any) {
      setError(e?.message || "Failed to load records");
    } finally {
      setLoading(false);
    }
  }

  async function fetchUpcoming(startDate: string, endDate: string) {
    setUpcomingLoading(true);
    setError(null);
    try {
      const supabase = getSupabase();
      const start = new Date(startDate);
      const end = new Date(endDate);
      const startIso = start.toISOString();
      const endIso = new Date(end.getTime() + 24 * 60 * 60 * 1000).toISOString();

      let query = supabase
        .from("client_registrations")
        .select(
          "id,created_at,status,interest_type,business_opportunities,wealth_solutions,first_name,last_name,phone,email,profession,preferred_days,preferred_time,referred_by,CalledOn,BOP_Date,BOP_Status,Followup_Date,FollowUp_Status,Product,Issued,Comment,Remark"
        )
        .gte("BOP_Date", startIso)
        .lt("BOP_Date", endIso)
        .limit(2000);

      query = applySort(query, sortUpcoming);

      const { data, error } = await query;
      if (error) throw error;
      setUpcomingRows((data || []) as Row[]);
    } catch (e: any) {
      setError(e?.message || "Failed to load upcoming report");
    } finally {
      setUpcomingLoading(false);
    }
  }

  async function fetchTrends() {
    setTrendLoading(true);
    setError(null);
    try {
      const supabase = getSupabase();

      // Weekly line chart (last 2 months) - group by week END date
      const twoMonthsAgo = subMonths(new Date(), 2);
      const { data: weeklyDates, error: weeklyErr } = await supabase
        .from("client_registrations")
        .select("BOP_Date")
        .gte("BOP_Date", twoMonthsAgo.toISOString())
        .not("BOP_Date", "is", null)
        .order("BOP_Date", { ascending: true })
        .limit(10000);

      if (weeklyErr) throw weeklyErr;

      const weekMap = new Map<string, number>();
      for (const r of weeklyDates || []) {
        const dt = parseISO(String((r as any).BOP_Date));
        if (!isValid(dt)) continue;
        const wkEnd = endOfWeek(dt, { weekStartsOn: 1 });
        const key = format(wkEnd, "yyyy-MM-dd");
        weekMap.set(key, (weekMap.get(key) || 0) + 1);
      }
      setWeeklyTrend(Array.from(weekMap.entries()).sort((a, b) => a[0].localeCompare(b[0])).map(([weekEnd, count]) => ({ weekEnd, count })));

      // Monthly bar chart (current year)
      const yearStart = startOfYear(new Date());
      const nextYear = addYears(yearStart, 1);

      const { data: monthlyDates, error: monthlyErr } = await supabase
        .from("client_registrations")
        .select("BOP_Date")
        .gte("BOP_Date", yearStart.toISOString())
        .lt("BOP_Date", nextYear.toISOString())
        .not("BOP_Date", "is", null)
        .order("BOP_Date", { ascending: true })
        .limit(20000);

      if (monthlyErr) throw monthlyErr;

      const monthMap = new Map<string, number>();
      for (const r of monthlyDates || []) {
        const dt = parseISO(String((r as any).BOP_Date));
        if (!isValid(dt)) continue;
        const key = format(dt, "yyyy-MM");
        monthMap.set(key, (monthMap.get(key) || 0) + 1);
      }

      const y = yearStart.getFullYear();
      const months: { month: string; count: number }[] = [];
      for (let m = 1; m <= 12; m++) {
        const key = `${y}-${String(m).padStart(2, "0")}`;
        months.push({ month: key, count: monthMap.get(key) || 0 });
      }
      setMonthlyTrend(months);
    } catch (e: any) {
      setError(e?.message || "Failed to load trends");
    } finally {
      setTrendLoading(false);
    }
  }

  const totalPages = totalCount != null ? Math.max(1, Math.ceil(totalCount / PAGE_SIZE)) : 1;
  const canPrev = page > 0;
  const canNext = totalCount != null ? (page + 1) * PAGE_SIZE < totalCount : records.length === PAGE_SIZE;

  const exportXlsx = () => {
    const exportRows = upcomingRows.map((r) => ({
      "Created Date": r.created_at,
      Status: r.status,
      "Interest Type": r.interest_type,
      "Business Opportunities": arrayToText(r.business_opportunities),
      "Wealth Solutions": arrayToText(r.wealth_solutions),
      "First Name": r.first_name,
      "Last Name": r.last_name,
      Phone: r.phone,
      Email: r.email,
      Profession: r.profession,
      "Preferred Days": arrayToText(r.preferred_days),
      "Preferred Time": r.preferred_time,
      "Referred By": r.referred_by,
      "Called On": r.CalledOn,
      "BOP Date": r.BOP_Date,
      "BOP Status": r.BOP_Status,
      "Follow-Up Date": r.Followup_Date,
      "Follow-Up Status": r.FollowUp_Status,
      Product: r.Product,
      Issued: r.Issued,
      Comment: r.Comment,
      Remark: r.Remark,
    }));

    const ws = XLSX.utils.json_to_sheet(exportRows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Upcoming_BOP");
    XLSX.writeFile(wb, `Upcoming_BOP_${rangeStart}_to_${rangeEnd}.xlsx`);
  };

  const updateCell = async (id: string, key: keyof Row, type: ColType, rawValue: string) => {
    setSavingId(id);
    setError(null);
    try {
      const supabase = getSupabase();
      const payload: any = {};

      if (type === "datetime") payload[key] = fromLocalInput(rawValue);
      else if (type === "array") payload[key] = textToArray(rawValue);
      else payload[key] = rawValue?.trim() ? rawValue : null;

      const { error } = await supabase.from("client_registrations").update(payload).eq("id", id);
      if (error) throw error;

      const patch = (prev: Row[]) => prev.map((r) => (r.id === id ? ({ ...r, [key]: payload[key] } as Row) : r));
      setRecords(patch);
      setUpcomingRows(patch);
      setLatestRows(patch);
    } catch (e: any) {
      setError(e?.message || "Update failed");
    } finally {
      setSavingId(null);
    }
  };

  const signOut = async () => {
    try {
      const supabase = getSupabase();
      await supabase.auth.signOut();
    } finally {
      window.location.href = "/";
    }
  };

  const SortHelp = () => (
    <div className="text-xs text-slate-500">
      Click headers to sort: <span className="font-semibold">Client Name</span>, <span className="font-semibold">Created Date</span>,{" "}
      <span className="font-semibold">BOP Date</span>, <span className="font-semibold">BOP Status</span>,{" "}
      <span className="font-semibold">Follow-Up Date</span>, <span className="font-semibold">Status</span>.
    </div>
  );

  const extraCols = useMemo(
    () => [{ label: "Client Name", sortable: "client" as SortKey, render: (r: Row) => clientName(r) }],
    []
  );

  const upcomingExtraCols = useMemo(
    () => [
      { label: "Client Name", sortable: "client" as SortKey, render: (r: Row) => clientName(r) },
      { label: "Phone", render: (r: Row) => r.phone || "" },
      { label: "Email", render: (r: Row) => r.email || "" },
    ],
    []
  );

  return (
    <div className="min-h-screen">
      <div className="max-w-[1600px] mx-auto p-6 space-y-6">
        <header className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-center gap-3">
            <img src="/CANLogo.jpeg" className="h-10 w-auto" alt="CAN Financial Solutions" />
            <div>
              <div className="text-2xl font-bold text-slate-800">CAN Financial Solutions Clients Report</div>
              <div className="text-sm text-slate-500">Search, edit follow-ups, upcoming BOP meetings, export & trends</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Pill>{upcomingRows.length} upcoming</Pill>
            <Button variant="secondary" onClick={signOut}>
              Sign out
            </Button>
          </div>
        </header>

        {error && <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-red-700">{error}</div>}

        <div className="grid lg:grid-cols-3 gap-4">
          <Card title="Search">
            <div className="flex gap-2">
              <input
                className="w-full rounded-xl border border-slate-200 px-4 py-3"
                placeholder="Search by first name, last name, or phone"
                value={q}
                onChange={(e) => setQ(e.target.value)}
              />
              <Button onClick={() => loadPage(0)}>Go</Button>
            </div>
            <div className="mt-3 flex items-center justify-between text-sm text-slate-600">
              <span>{totalCount == null ? "—" : totalCount.toLocaleString()} records</span>
              <span className="text-xs text-slate-500">Showing {PAGE_SIZE} per page</span>
            </div>
          </Card>

          <Card title="Upcoming BOP Date Range">
            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <div className="text-xs font-semibold text-slate-600 mb-1">Start</div>
                <input type="date" className="w-full rounded-xl border border-slate-200 px-3 py-2" value={rangeStart} onChange={(e) => setRangeStart(e.target.value)} />
              </label>
              <label className="block">
                <div className="text-xs font-semibold text-slate-600 mb-1">End</div>
                <input type="date" className="w-full rounded-xl border border-slate-200 px-3 py-2" value={rangeEnd} onChange={(e) => setRangeEnd(e.target.value)} />
              </label>
            </div>
            <div className="mt-3 flex items-center justify-between">
              <div className="text-sm text-slate-600">
                Upcoming: <span className="font-semibold text-slate-800">{upcomingLoading ? "…" : upcomingRows.length}</span>
              </div>
              <Button variant="secondary" onClick={exportXlsx} disabled={upcomingRows.length === 0}>
                Export XLSX
              </Button>
            </div>
          </Card>

          <Card title="Trends">
            <div className="flex items-center justify-between mb-2">
              <div className="text-xs font-semibold text-slate-600">Weekly (Last 2 Months) — week end date</div>
              <Button variant="secondary" onClick={fetchTrends}>Refresh</Button>
            </div>

            <div className="h-40">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={weeklyTrend}>
                  <XAxis dataKey="weekEnd" tick={{ fontSize: 11 }} />
                  <YAxis allowDecimals={false} />
                  <Tooltip />
                  <Line type="monotone" dataKey="count" dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>

            <div className="mt-4 text-xs font-semibold text-slate-600">Monthly (Current Year)</div>
            <div className="h-40">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthlyTrend}>
                  <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                  <YAxis allowDecimals={false} />
                  <Tooltip />
                  <Bar dataKey="count" />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {trendLoading && <div className="mt-2 text-xs text-slate-500">Loading trends…</div>}
          </Card>
        </div>

        <Card title="Latest 500 Records (Editable)">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2 mb-3">
            <div className="text-sm text-slate-600">Scroll vertically & horizontally.</div>
            <SortHelp />
          </div>
          {latestLoading ? (
            <div className="text-slate-600">Loading latest 500…</div>
          ) : (
            <Table
              rows={latestRows}
              savingId={savingId}
              onUpdate={updateCell}
              extraLeftCols={extraCols}
              maxHeightClass="max-h-[420px]"
              sortState={sortLatest}
              onSortChange={(k) => setSortLatest((cur) => toggleSort(cur, k))}
            />
          )}
        </Card>

        <Card title="Upcoming BOP Meetings (Editable)">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2 mb-3">
            <div className="text-sm text-slate-600">Scroll vertically & horizontally.</div>
            <SortHelp />
          </div>

          <Table
            rows={upcomingRows}
            savingId={savingId}
            onUpdate={updateCell}
            extraLeftCols={upcomingExtraCols}
            maxHeightClass="max-h-[420px]"
            sortState={sortUpcoming}
            onSortChange={(k) => setSortUpcoming((cur) => toggleSort(cur, k))}
          />

          {upcomingRows.length === 0 && <div className="text-slate-600 pt-4">{upcomingLoading ? "Loading…" : "No upcoming records."}</div>}
        </Card>

        <Card title="All Records (Editable) — Pagination (100 per page)">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 mb-3">
            <div className="text-sm text-slate-600">
              Page <span className="font-semibold text-slate-800">{page + 1}</span> of{" "}
              <span className="font-semibold text-slate-800">{totalPages}</span>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <SortHelp />
              <div className="flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 bg-white">
                <span className="text-xs font-semibold text-slate-600">Go to page</span>
                <input
                  type="number"
                  min={1}
                  max={totalPages}
                  className="w-20 rounded-lg border border-slate-200 px-2 py-1 text-sm"
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
            </div>
          </div>

          <Pager
            canPrev={canPrev}
            canNext={canNext}
            loading={loading}
            onPrev={() => loadPage(Math.max(0, page - 1))}
            onNext={() => loadPage(page + 1)}
          />

          {loading ? (
            <div className="text-slate-600">Loading…</div>
          ) : (
            <Table
              rows={records}
              savingId={savingId}
              onUpdate={updateCell}
              extraLeftCols={extraCols}
              maxHeightClass="max-h-[520px]"
              sortState={sortAll}
              onSortChange={(k) => setSortAll((cur) => toggleSort(cur, k))}
            />
          )}

          <div className="mt-3">
            <Pager
              canPrev={canPrev}
              canNext={canNext}
              loading={loading}
              onPrev={() => loadPage(Math.max(0, page - 1))}
              onNext={() => loadPage(page + 1)}
            />
          </div>
        </Card>
      </div>
    </div>
  );
}

function Pager({
  canPrev,
  canNext,
  loading,
  onPrev,
  onNext,
}: {
  canPrev: boolean;
  canNext: boolean;
  loading: boolean;
  onPrev: () => void;
  onNext: () => void;
}) {
  return (
    <div className="flex items-center justify-end gap-2">
      <Button variant="secondary" onClick={onPrev} disabled={!canPrev || loading}>
        Previous
      </Button>
      <Button variant="secondary" onClick={onNext} disabled={!canNext || loading}>
        Next
      </Button>
    </div>
  );
}

function Table({
  rows,
  savingId,
  onUpdate,
  extraLeftCols,
  maxHeightClass,
  sortState,
  onSortChange,
}: {
  rows: Row[];
  savingId: string | null;
  onUpdate: (id: string, key: keyof Row, type: ColType, value: string) => void;
  extraLeftCols: { label: string; render: (r: Row) => string; sortable?: SortKey }[];
  maxHeightClass: string;
  sortState: { key: SortKey; dir: SortDir };
  onSortChange: (key: SortKey) => void;
}) {
  const sortIcon = (k?: SortKey) => {
    if (!k) return null;
    if (sortState.key !== k) return <span className="ml-1 text-slate-300">↕</span>;
    return <span className="ml-1 text-slate-700">{sortState.dir === "asc" ? "↑" : "↓"}</span>;
  };

  return (
    <div className={`overflow-auto rounded-xl border border-slate-200 bg-white ${maxHeightClass}`}>
      <table className="min-w-[2400px] w-full border-separate border-spacing-0">
        <thead className="sticky top-0 bg-slate-50 z-10">
          <tr className="text-left text-xs uppercase tracking-wide text-slate-500">
            {extraLeftCols.map((c) => (
              <Th key={c.label}>
                {c.sortable ? (
                  <button className="inline-flex items-center hover:text-slate-800" onClick={() => onSortChange(c.sortable!)} type="button">
                    {c.label}
                    {sortIcon(c.sortable)}
                  </button>
                ) : (
                  c.label
                )}
              </Th>
            ))}
            {COLUMNS.map((c) => (
              <Th key={String(c.key)}>
                {c.sortable ? (
                  <button className="inline-flex items-center hover:text-slate-800" onClick={() => onSortChange(c.sortable!)} type="button">
                    {toTitleCaseLabel(String(c.key))}
                    {sortIcon(c.sortable)}
                  </button>
                ) : (
                  toTitleCaseLabel(String(c.key))
                )}
              </Th>
            ))}
            <Th>Save</Th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="hover:bg-slate-50">
              {extraLeftCols.map((c) => (
                <Td key={c.label} className="font-semibold text-slate-800 whitespace-nowrap">
                  {c.render(r)}
                </Td>
              ))}

              {COLUMNS.map((c) => {
                if (c.key === "created_at") {
                  return <Td key="created_at">{new Date(r.created_at).toLocaleDateString()}</Td>;
                }

                const value = r[c.key] as any;
                const inputValue =
                  c.type === "datetime" ? toLocalInput(value) : c.type === "array" ? arrayToText(value) : value ?? "";

                return (
                  <Td key={String(c.key)}>
                    <input
                      type={c.type === "datetime" ? "datetime-local" : "text"}
                      className="w-full rounded-lg border border-slate-200 px-2 py-2 text-sm"
                      defaultValue={inputValue}
                      placeholder={toTitleCaseLabel(String(c.key))}
                      onBlur={(e) => onUpdate(r.id, c.key, c.type, e.target.value)}
                    />
                    {c.type === "datetime" && value ? <div className="mt-1 text-[11px] text-slate-500">{fmtDateTime(value)}</div> : null}
                  </Td>
                );
              })}

              <Td>{savingId === r.id ? <span className="text-xs text-teal-700 font-semibold">Saving…</span> : <span className="text-xs text-slate-400"> </span>}</Td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return <th className="border-b border-slate-200 px-3 py-3 whitespace-nowrap">{children}</th>;
}
function Td({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <td className={`border-b border-slate-100 px-3 py-3 align-top ${className}`}>{children}</td>;
}
