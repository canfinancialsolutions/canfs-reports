\
"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
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

const PAGE_SIZE = 100;

const COLUMNS: { key: keyof Row; label: string; type: ColType }[] = [
  { key: "created_at", label: "CREATED", type: "text" },
  { key: "status", label: "STATUS", type: "text" },
  { key: "interest_type", label: "INTEREST_TYPE", type: "text" },
  { key: "business_opportunities", label: "BUSINESS_OPPORTUNITIES", type: "array" },
  { key: "wealth_solutions", label: "WEALTH_SOLUTIONS", type: "array" },
  { key: "first_name", label: "FIRST_NAME", type: "text" },
  { key: "last_name", label: "LAST_NAME", type: "text" },
  { key: "phone", label: "PHONE", type: "text" },
  { key: "email", label: "EMAIL", type: "text" },
  { key: "profession", label: "PROFESSION", type: "text" },
  { key: "preferred_days", label: "PREFERRED_DAYS", type: "array" },
  { key: "preferred_time", label: "PREFERRED_TIME", type: "text" },
  { key: "referred_by", label: "REFERRED_BY", type: "text" },
  { key: "CalledOn", label: "CALLED_ON", type: "datetime" },
  { key: "BOP_Date", label: "BOP_DATE", type: "datetime" },
  { key: "BOP_Status", label: "BOP_STATUS", type: "text" },
  { key: "Followup_Date", label: "FOLLOWUP_DATE", type: "datetime" },
  { key: "FollowUp_Status", label: "FOLLOWUP_STATUS", type: "text" },
  { key: "Product", label: "PRODUCT", type: "text" },
  { key: "Issued", label: "ISSUED", type: "datetime" },
  { key: "Comment", label: "COMMENT", type: "text" },
  { key: "Remark", label: "REMARK", type: "text" },
];

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

export default function Dashboard() {
  const [records, setRecords] = useState<Row[]>([]);
  const [totalCount, setTotalCount] = useState<number | null>(null);
  const [page, setPage] = useState(0);

  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Upcoming report
  const [rangeStart, setRangeStart] = useState(format(new Date(), "yyyy-MM-dd"));
  const [rangeEnd, setRangeEnd] = useState(format(addDays(new Date(), 30), "yyyy-MM-dd"));
  const [upcomingRows, setUpcomingRows] = useState<Row[]>([]);
  const [upcomingLoading, setUpcomingLoading] = useState(false);

  // Trends
  const [weeklyTrend, setWeeklyTrend] = useState<{ weekEnd: string; count: number }[]>([]);
  const [monthlyTrend, setMonthlyTrend] = useState<{ month: string; count: number }[]>([]);
  const [trendLoading, setTrendLoading] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const supabase = getSupabase();
        const { data } = await supabase.auth.getSession();
        if (!data.session) {
          window.location.href = "/";
          return;
        }
        await Promise.all([loadPage(0), fetchUpcoming(rangeStart, rangeEnd), fetchTrends()]);
      } catch (e: any) {
        setError(e?.message || "Failed to initialize");
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    fetchUpcoming(rangeStart, rangeEnd);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rangeStart, rangeEnd]);

  async function loadPage(nextPage: number) {
    setError(null);
    setLoading(true);
    try {
      const supabase = getSupabase();
      const search = q.trim();

      let countQuery = supabase.from("client_registrations").select("id", { count: "exact", head: true });
      if (search) {
        countQuery = countQuery.or(`first_name.ilike.%${search}%,last_name.ilike.%${search}%,phone.ilike.%${search}%`);
      }
      const { count, error: countErr } = await countQuery;
      if (countErr) throw countErr;
      setTotalCount(count ?? 0);

      const from = nextPage * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;

      let dataQuery = supabase
        .from("client_registrations")
        .select(
          "id,created_at,status,interest_type,business_opportunities,wealth_solutions,first_name,last_name,phone,email,profession,preferred_days,preferred_time,referred_by,CalledOn,BOP_Date,BOP_Status,Followup_Date,FollowUp_Status,Product,Issued,Comment,Remark"
        )
        .order("created_at", { ascending: false })
        .range(from, to);

      if (search) {
        dataQuery = dataQuery.or(`first_name.ilike.%${search}%,last_name.ilike.%${search}%,phone.ilike.%${search}%`);
      }

      const { data, error: dataErr } = await dataQuery;
      if (dataErr) throw dataErr;

      setRecords((data || []) as Row[]);
      setPage(nextPage);
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

      const { data, error } = await supabase
        .from("client_registrations")
        .select(
          "id,created_at,status,interest_type,business_opportunities,wealth_solutions,first_name,last_name,phone,email,profession,preferred_days,preferred_time,referred_by,CalledOn,BOP_Date,BOP_Status,Followup_Date,FollowUp_Status,Product,Issued,Comment,Remark"
        )
        .gte("BOP_Date", startIso)
        .lt("BOP_Date", endIso)
        .order("BOP_Date", { ascending: true })
        .limit(2000);

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

      setWeeklyTrend(
        Array.from(weekMap.entries())
          .sort((a, b) => a[0].localeCompare(b[0]))
          .map(([weekEnd, count]) => ({ weekEnd, count }))
      );

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

  const canPrev = page > 0;
  const canNext =
    totalCount != null ? (page + 1) * PAGE_SIZE < totalCount : records.length === PAGE_SIZE;

  const exportXlsx = () => {
    const exportRows = upcomingRows.map((r) => ({
      created_at: r.created_at,
      status: r.status,
      interest_type: r.interest_type,
      business_opportunities: arrayToText(r.business_opportunities),
      wealth_solutions: arrayToText(r.wealth_solutions),
      first_name: r.first_name,
      last_name: r.last_name,
      phone: r.phone,
      email: r.email,
      profession: r.profession,
      preferred_days: arrayToText(r.preferred_days),
      preferred_time: r.preferred_time,
      referred_by: r.referred_by,
      CalledOn: r.CalledOn,
      BOP_Date: r.BOP_Date,
      BOP_Status: r.BOP_Status,
      Followup_Date: r.Followup_Date,
      FollowUp_Status: r.FollowUp_Status,
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

      setRecords((prev) => prev.map((r) => (r.id === id ? ({ ...r, [key]: payload[key] } as Row) : r)));
      setUpcomingRows((prev) => prev.map((r) => (r.id === id ? ({ ...r, [key]: payload[key] } as Row) : r)));
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

  return (
    <div className="min-h-screen">
      <div className="max-w-[1600px] mx-auto p-6 space-y-6">
        <header className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-center gap-3">
            <img src="/can-logo.svg" className="h-10" alt="CAN Financial Solutions" />
            <div>
              <div className="text-2xl font-bold text-slate-800">Client Reports</div>
              <div className="text-sm text-slate-500">Search, edit follow-ups, export & trends</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Pill>{upcomingRows.length} upcoming</Pill>
            <Button variant="secondary" onClick={signOut}>Sign out</Button>
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
              <Button variant="secondary" onClick={exportXlsx} disabled={upcomingRows.length === 0}>Export XLSX</Button>
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

        <Card title="Upcoming BOP Meetings (Editable)">
          <div className="text-sm text-slate-600 mb-3">Scroll vertically & horizontally.</div>
          <Table
            rows={upcomingRows}
            savingId={savingId}
            onUpdate={updateCell}
            extraLeftCols={[
              { label: "CLIENT", render: (r) => `${r.first_name || ""} ${r.last_name || ""}`.trim() },
              { label: "PHONE", render: (r) => r.phone || "" },
              { label: "EMAIL", render: (r) => r.email || "" },
            ]}
            maxHeightClass="max-h-[420px]"
          />
          {upcomingRows.length === 0 && <div className="text-slate-600 pt-4">{upcomingLoading ? "Loading…" : "No upcoming records."}</div>}
        </Card>

        <Card title="All Records (Editable) — Pagination (100 per page)">
          <div className="flex items-center justify-between mb-3">
            <div className="text-sm text-slate-600">
              Page <span className="font-semibold text-slate-800">{page + 1}</span>
              {totalCount != null ? (
                <> of <span className="font-semibold text-slate-800">{Math.max(1, Math.ceil(totalCount / PAGE_SIZE))}</span></>
              ) : null}
            </div>
            <div className="flex gap-2">
              <Button variant="secondary" onClick={() => loadPage(Math.max(0, page - 1))} disabled={!canPrev || loading}>Previous</Button>
              <Button variant="secondary" onClick={() => loadPage(page + 1)} disabled={!canNext || loading}>Next</Button>
            </div>
          </div>

          {loading ? <div className="text-slate-600">Loading…</div> : (
            <Table rows={records} savingId={savingId} onUpdate={updateCell} extraLeftCols={[]} maxHeightClass="max-h-[520px]" />
          )}
        </Card>
      </div>
    </div>
  );
}

function Table({
  rows,
  savingId,
  onUpdate,
  extraLeftCols,
  maxHeightClass,
}: {
  rows: Row[];
  savingId: string | null;
  onUpdate: (id: string, key: keyof Row, type: ColType, value: string) => void;
  extraLeftCols: { label: string; render: (r: Row) => string }[];
  maxHeightClass: string;
}) {
  return (
    <div className={`overflow-auto rounded-xl border border-slate-200 bg-white ${maxHeightClass}`}>
      <table className="min-w-[2200px] w-full border-separate border-spacing-0">
        <thead className="sticky top-0 bg-slate-50 z-10">
          <tr className="text-left text-xs uppercase tracking-wide text-slate-500">
            {extraLeftCols.map((c) => <Th key={c.label}>{c.label}</Th>)}
            {COLUMNS.map((c) => <Th key={String(c.key)}>{c.label}</Th>)}
            <Th>SAVE</Th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="hover:bg-slate-50">
              {extraLeftCols.map((c) => (
                <Td key={c.label} className="font-semibold text-slate-800 whitespace-nowrap">{c.render(r)}</Td>
              ))}

              {COLUMNS.map((c) => {
                if (c.key === "created_at") {
                  return <Td key="created_at">{new Date(r.created_at).toLocaleDateString()}</Td>;
                }

                const value = r[c.key] as any;
                const inputValue =
                  c.type === "datetime" ? toLocalInput(value) :
                  c.type === "array" ? arrayToText(value) :
                  value ?? "";

                return (
                  <Td key={String(c.key)}>
                    <input
                      type={c.type === "datetime" ? "datetime-local" : "text"}
                      className="w-full rounded-lg border border-slate-200 px-2 py-2 text-sm"
                      defaultValue={inputValue}
                      placeholder={c.label}
                      onBlur={(e) => onUpdate(r.id, c.key, c.type, e.target.value)}
                    />
                    {c.type === "datetime" && value ? (
                      <div className="mt-1 text-[11px] text-slate-500">{fmtDateTime(value)}</div>
                    ) : null}
                  </Td>
                );
              })}

              <Td>
                {savingId === r.id ? (
                  <span className="text-xs text-teal-700 font-semibold">Saving…</span>
                ) : (
                  <span className="text-xs text-slate-400"> </span>
                )}
              </Td>
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
