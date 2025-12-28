"use client";

export const dynamic = "force-dynamic";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
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

const DATE_TIME_KEYS = new Set(["BOP_Date", "CalledOn", "Followup_Date", "Issued"]);

const LABEL_OVERRIDES: Record<string, string> = {
  client_name: "Client Name",
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

function toggleSort<T extends string>(
  cur: { key: T; dir: SortDir },
  k: T
): { key: T; dir: SortDir } {
  if (cur.key !== k) return { key: k, dir: "asc" };
  return { key: k, dir: cur.dir === "asc" ? "desc" : "asc" };
}

function safeNumber(val: any) {
  const n = Number(val);
  return Number.isFinite(n) ? n : 0;
}

function asLower(s: string) {
  return (s ?? "").toString().toLowerCase();
}

function formatDisplayDate(value: any) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString();
}

function cellDisplay(val: any) {
  if (val == null) return "";
  if (typeof val === "number" && val === 0) return "";
  return String(val);
}

/** ---------- Column resizing helper ---------- */
type ColDef = { key: string; label: string; sortable?: string; stickyLeft?: boolean };

function useColumnWidths(colKeys: string[], defaultWidth = 160) {
  const [widths, setWidths] = useState<Record<string, number>>(() => {
    const obj: Record<string, number> = {};
    for (const k of colKeys) obj[k] = defaultWidth;
    return obj;
  });

  useEffect(() => {
    setWidths((prev) => {
      const next = { ...prev };
      for (const k of colKeys) if (!next[k]) next[k] = defaultWidth;
      return next;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [colKeys.join("|")]);

  const startResize = useCallback(
    (key: string, startX: number) => {
      const startW = widths[key] ?? defaultWidth;
      const onMove = (e: MouseEvent) => {
        const dx = e.clientX - startX;
        const next = Math.max(80, Math.min(700, startW + dx));
        setWidths((p) => ({ ...p, [key]: next }));
      };
      const onUp = () => {
        window.removeEventListener("mousemove", onMove);
        window.removeEventListener("mouseup", onUp);
      };
      window.addEventListener("mousemove", onMove);
      window.addEventListener("mouseup", onUp);
    },
    [widths, defaultWidth]
  );

  return { widths, startResize };
}

function computeStickyLeftOffsets(cols: ColDef[], widths: Record<string, number>) {
  const left: Record<string, number> = {};
  let acc = 0;
  for (const c of cols) {
    if (c.stickyLeft) {
      left[c.key] = acc;
      acc += widths[c.key] ?? 160;
    }
  }
  return left;
}

/** ---------- Editable cell that actually shows saved date immediately ---------- */
function EditableCell({
  rowId,
  colKey,
  value,
  saving,
  onCommit,
}: {
  rowId: string;
  colKey: string;
  value: any;
  saving: boolean;
  onCommit: (rowId: string, colKey: string, rawValue: string) => Promise<void>;
}) {
  const isDateTime = DATE_TIME_KEYS.has(colKey);

  // Controlled input so it never “loses” the selected date on blur.
  const [local, setLocal] = useState<string>(() =>
    isDateTime ? toLocalInput(value) : (value ?? "")
  );

  useEffect(() => {
    setLocal(isDateTime ? toLocalInput(value) : (value ?? ""));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rowId, colKey, value]);

  return (
    <input
      type={isDateTime ? "datetime-local" : "text"}
      className="w-full bg-transparent border-0 outline-none text-sm"
      value={local}
      disabled={saving}
      onChange={(e) => setLocal(e.target.value)}
      onBlur={async () => {
        await onCommit(rowId, colKey, local);
      }}
    />
  );
}

/** ---------- Dashboard Page ---------- */
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
  const [sortUpcoming, setSortUpcoming] = useState<{ key: SortKeyAll; dir: SortDir }>({
    key: "BOP_Date",
    dir: "asc",
  });
  const [upcomingVisible, setUpcomingVisible] = useState(false);
  const [upcomingLoadedOnce, setUpcomingLoadedOnce] = useState(false);

  // Client Progress Summary
  const [progressRows, setProgressRows] = useState<Row[]>([]);
  const [progressLoading, setProgressLoading] = useState(false);
  const [progressFilter, setProgressFilter] = useState("");
  const [progressSort, setProgressSort] = useState<{ key: SortKeyProgress; dir: SortDir }>({
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
    if (upcomingLoadedOnce) fetchUpcoming();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sortUpcoming.key, sortUpcoming.dir]);

  function applySortAll(query: any, sort: { key: SortKeyAll; dir: SortDir }) {
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

      query = applySortAll(query, sortUpcoming);
      const { data, error } = await query;
      if (error) throw error;

      setUpcoming(data || []);
      setUpcomingLoadedOnce(true);
      // Do NOT auto-show; user wants it hidden until they click show.
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

      // Make filters case-insensitive on the client where needed.
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
      if (fi) countQuery = countQuery.ilike("interest_type", `%${fi}%`);
      if (fb) countQuery = countQuery.ilike("BOP_Status", `%${fb}%`);
      const { count, error: cErr } = await countQuery;
      if (cErr) throw cErr;
      setTotal(count ?? 0);

      const from = nextPage * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;

      let dataQuery = supabase.from("client_registrations").select("*").range(from, to);
      if (search)
        dataQuery = dataQuery.or(
          `first_name.ilike.%${search}%,last_name.ilike.%${search}%,phone.ilike.%${search}%`
        );
      if (fc) dataQuery = dataQuery.or(`first_name.ilike.%${fc}%,last_name.ilike.%${fc}%`);
      if (fi) dataQuery = dataQuery.ilike("interest_type", `%${fi}%`);
      if (fb) dataQuery = dataQuery.ilike("BOP_Status", `%${fb}%`);
      dataQuery = applySortAll(dataQuery, sortAll);

      const { data, error } = await dataQuery;
      if (error) throw error;

      const raw = (data || []) as any[];
      const fbo = asLower(filterBusinessOpp.trim());
      const fws = asLower(filterWealthSolutions.trim());
      const ffu = asLower(filterFollowUpStatus.trim());

      const clientSideFiltered = raw.filter((row) => {
        const opp = Array.isArray(row.business_opportunities)
          ? row.business_opportunities.join(",")
          : String(row.business_opportunities || "");
        const ws = Array.isArray(row.wealth_solutions) ? row.wealth_solutions.join(",") : String(row.wealth_solutions || "");
        const fu = asLower(String(row.FollowUp_Status ?? row.Followup_Status ?? ""));

        const okOpp = !fbo || asLower(opp).includes(fbo);
        const okWs = !fws || asLower(ws).includes(fws);
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

      const isDateTime = DATE_TIME_KEYS.has(key);
      payload[key] = isDateTime ? fromLocalInput(rawValue) : rawValue?.trim() ? rawValue : null;

      const { error } = await supabase.from("client_registrations").update(payload).eq("id", id);
      if (error) throw error;

      // Patch local state so the date immediately remains visible
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
      Click headers to sort: <b>Client Name</b>, <b>Created Date</b>, <b>BOP Date</b>, <b>BOP Status</b>, <b>Follow-Up Date</b>, <b>Status</b>.
    </div>
  );

  const extraClientCol = useMemo(
    () => [
      {
        label: "Client Name",
        key: "__client_name__",
        stickyLeft: true,
        sortable: "client" as SortKeyAll,
        render: (r: Row) => clientName(r),
      },
    ],
    []
  );

  /** ----- Progress filtered/sorted/paged ----- */
  const progressFiltered = useMemo(() => {
    const f = asLower(progressFilter.trim());
    if (!f) return progressRows;
    return progressRows.filter((r) => asLower(String(r.client_name || "")).includes(f));
  }, [progressRows, progressFilter]);

  const progressSorted = useMemo(() => {
    const rows = [...progressFiltered];
    const asc = progressSort.dir === "asc";
    const key = progressSort.key;

    const cmp = (a: any, b: any) => {
      if (key === "client_name") {
        const av = asLower(String(a.client_name || ""));
        const bv = asLower(String(b.client_name || ""));
        return av.localeCompare(bv);
      }
      if (key.endsWith("_attempts")) {
        const av = safeNumber(a[key]);
        const bv = safeNumber(b[key]);
        return av === bv ? 0 : av < bv ? -1 : 1;
      }
      // dates
      const ad = a[key] ? new Date(a[key]).getTime() : 0;
      const bd = b[key] ? new Date(b[key]).getTime() : 0;
      return ad === bd ? 0 : ad < bd ? -1 : 1;
    };

    rows.sort((a, b) => (asc ? cmp(a, b) : -cmp(a, b)));
    return rows;
  }, [progressFiltered, progressSort]);

  const progressTotalPages = Math.max(1, Math.ceil(progressSorted.length / PAGE_SIZE));
  const progressCanPrev = progressPage > 0;
  const progressCanNext = (progressPage + 1) * PAGE_SIZE < progressSorted.length;

  const progressPageRows = useMemo(() => {
    const start = progressPage * PAGE_SIZE;
    return progressSorted.slice(start, start + PAGE_SIZE);
  }, [progressSorted, progressPage]);

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

          <div className="flex items-center gap-2">
            <Button variant="secondary" onClick={logout}>Logout</Button>
          </div>
        </header>

        {error && <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-red-700">{error}</div>}

        {/* Trends */}
        <Card title="Trends">
          <div className="flex items-center justify-end mb-3">
            <Button variant="secondary" onClick={fetchTrends}>Refresh</Button>
          </div>

          <div className="grid lg:grid-cols-2 gap-6">
            <div>
              <div className="text-xs font-semibold text-slate-600 mb-2">Weekly (Last 5 Weeks)</div>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={weekly} margin={{ top: 18, right: 12, bottom: 0, left: 0 }}>
                    <XAxis dataKey="weekEnd" tick={{ fontSize: 11 }} />
                    <YAxis allowDecimals={false} />
                    <Tooltip />
                    <Line type="monotone" dataKey="prospects" dot>
                      <LabelList dataKey="prospects" position="top" />
                    </Line>
                    <Line type="monotone" dataKey="bops" dot>
                      <LabelList dataKey="bops" position="top" />
                    </Line>
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div>
              <div className="text-xs font-semibold text-slate-600 mb-2">Monthly (Current Year)</div>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={monthly} margin={{ top: 18, right: 12, bottom: 0, left: 0 }}>
                    <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                    <YAxis allowDecimals={false} />
                    <Tooltip />
                    <Bar dataKey="prospects">
                      <LabelList dataKey="prospects" position="top" />
                    </Bar>
                    <Bar dataKey="bops">
                      <LabelList dataKey="bops" position="top" />
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

          <div className="mt-3 flex items-center gap-2">
            <Button
              variant="secondary"
              onClick={() => setUpcomingVisible((v) => !v)}
              disabled={!upcomingLoadedOnce}
            >
              {upcomingVisible ? "Hide Upcoming Table" : "Show Upcoming Table"}
            </Button>
            <div className="text-xs text-slate-600">
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
              savingId={savingId}
              onUpdate={updateCell}
              preferredOrder={["BOP_Date", "created_at", "BOP_Status", "Followup_Date", "status"]}
              extraLeftCols={[
                { label: "Client Name", key: "__client_name__", stickyLeft: true, sortable: "client", render: (r) => clientName(r) },
              ]}
              maxHeightClass="max-h-[420px]"
              sortState={sortUpcoming}
              onSortChange={(k) => setSortUpcoming((cur) => toggleSort(cur, k))}
            />
          </Card>
        )}

        {/* Client Progress Summary */}
        <Card title="Client Progress Summary">
          <div className="flex flex-col md:flex-row md:items-center gap-2">
            <input
              className="w-full md:max-w-[420px] border border-slate-300 px-4 py-3"
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
            <Button variant="secondary" onClick={() => setProgressVisible((v) => !v)}>
              {progressVisible ? "Hide Table" : "Show Table"}
            </Button>

            <div className="md:ml-auto flex items-center gap-2">
              <Button variant="secondary" onClick={() => setProgressPage((p) => Math.max(0, p - 1))} disabled={!progressCanPrev}>
                Previous
              </Button>
              <Button variant="secondary" onClick={() => setProgressPage((p) => p + 1)} disabled={!progressCanNext}>
                Next
              </Button>
            </div>
          </div>

          {progressVisible && (
            <>
              <div className="mt-2 text-xs text-slate-600">Click headers to sort.</div>
              <ProgressTable
                rows={progressPageRows}
                sortState={progressSort}
                onSortChange={(k) => setProgressSort((cur) => toggleSort(cur, k))}
                maxHeightClass="max-h-[520px]"
              />
              <div className="mt-2 text-xs text-slate-500">
                Page <b>{progressPage + 1}</b> of <b>{progressTotalPages}</b>
              </div>
            </>
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
            Tip: Enter filters and click <b>Go</b> to apply.
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
              extraLeftCols={[
                { label: "Client Name", key: "__client_name__", stickyLeft: true, sortable: "client", render: (r) => clientName(r) },
              ]}
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

/** ---------- Progress summary table (read-only) ---------- */
function ProgressTable({
  rows,
  maxHeightClass,
  sortState,
  onSortChange,
}: {
  rows: Row[];
  maxHeightClass: string;
  sortState: { key: SortKeyProgress; dir: SortDir };
  onSortChange: (key: SortKeyProgress) => void;
}) {
  const cols: ColDef[] = [
    { key: "client_name", label: "Client Name", sortable: "client_name", stickyLeft: true },
    { key: "first_name", label: "First Name" },
    { key: "last_name", label: "Last Name" },
    { key: "phone", label: "Phone" },
    { key: "email", label: "Email" },
    { key: "last_call_date", label: "Last Call On", sortable: "last_call_date" },
    { key: "call_attempts", label: "No of Calls", sortable: "call_attempts" },
    { key: "last_bop_date", label: "Last BOP Call On", sortable: "last_bop_date" },
    { key: "bop_attempts", label: "No of BOP Calls", sortable: "bop_attempts" },
    { key: "last_followup_date", label: "Last FollowUp On", sortable: "last_followup_date" },
    { key: "followup_attempts", label: "No of FollowUp Calls", sortable: "followup_attempts" },
  ];

  const colKeys = cols.map((c) => c.key);
  const { widths, startResize } = useColumnWidths(colKeys, 180);
  const stickyLeft = useMemo(() => computeStickyLeftOffsets(cols, widths), [cols, widths]);

  const sortIcon = (k?: SortKeyProgress) => {
    if (!k) return null;
    if (sortState.key !== k) return <span className="ml-1 text-slate-400">↕</span>;
    return <span className="ml-1 text-slate-700">{sortState.dir === "asc" ? "↑" : "↓"}</span>;
  };

  return (
    <div className={`overflow-auto border border-slate-500 bg-white ${maxHeightClass}`}>
      <table className="w-full border-collapse" style={{ tableLayout: "fixed", minWidth: 1300 }}>
        <thead className="sticky top-0 bg-slate-100 z-20">
          <tr className="text-left text-xs font-semibold text-slate-700">
            {cols.map((c) => {
              const isSticky = !!c.stickyLeft;
              const left = isSticky ? stickyLeft[c.key] : undefined;
              const z = isSticky ? 40 : 30; // keep top-left cell above all
              return (
                <th
                  key={c.key}
                  className="border border-slate-500 px-2 py-2 whitespace-nowrap relative"
                  style={{
                    width: widths[c.key],
                    position: isSticky ? "sticky" : "static",
                    left,
                    top: 0,
                    zIndex: z,
                    background: "#f1f5f9",
                  }}
                >
                  {c.sortable ? (
                    <button
                      className="inline-flex items-center hover:underline"
                      onClick={() => onSortChange(c.sortable as SortKeyProgress)}
                      type="button"
                    >
                      {c.label}
                      {sortIcon(c.sortable as SortKeyProgress)}
                    </button>
                  ) : (
                    c.label
                  )}

                  {/* resizer */}
                  <div
                    onMouseDown={(e) => startResize(c.key, e.clientX)}
                    className="absolute top-0 right-0 h-full w-2 cursor-col-resize"
                    style={{ background: "transparent" }}
                  />
                </th>
              );
            })}
          </tr>
        </thead>

        <tbody>
          {rows.map((r, idx) => (
            <tr key={`${r.clientid ?? idx}`} className="hover:bg-slate-50">
              {cols.map((c) => {
                const isSticky = !!c.stickyLeft;
                const left = isSticky ? stickyLeft[c.key] : undefined;
                const z = isSticky ? 10 : 1;

                const val = r[c.key];

                // Hide zeros in this report
                const rendered =
                  c.key.endsWith("_attempts") ? (safeNumber(val) === 0 ? "" : String(val)) : c.key.endsWith("_date") ? formatDisplayDate(val) : cellDisplay(val);

                return (
                  <td
                    key={c.key}
                    className={`border border-slate-300 px-2 py-2 ${c.key === "client_name" ? "font-semibold text-slate-800" : ""}`}
                    style={{
                      width: widths[c.key],
                      position: isSticky ? "sticky" : "static",
                      left,
                      zIndex: z,
                      background: isSticky ? "white" : "transparent",
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    {rendered}
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

/** ---------- Excel-like table (editable) ---------- */
function ExcelTable({
  rows,
  savingId,
  onUpdate,
  extraLeftCols,
  maxHeightClass,
  sortState,
  onSortChange,
  preferredOrder,
}: {
  rows: Row[];
  savingId: string | null;
  onUpdate: (id: string, key: string, value: string) => Promise<void>;
  extraLeftCols: { label: string; key: string; render: (r: Row) => string; sortable?: SortKeyAll; stickyLeft?: boolean }[];
  maxHeightClass: string;
  sortState: { key: SortKeyAll; dir: SortDir };
  onSortChange: (key: SortKeyAll) => void;
  preferredOrder?: string[];
}) {
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
    for (const k of preferredOrder) if (set.has(k)) ordered.push(k);
    for (const k of baseKeys) if (!ordered.includes(k)) ordered.push(k);
    return ordered;
  }, [rows, preferredOrder]);

  // Build columns list (left cols + data keys)
  const cols: ColDef[] = useMemo(() => {
    const left = extraLeftCols.map((c) => ({
      key: c.key,
      label: c.label,
      sortable: c.sortable,
      stickyLeft: true,
    }));

    const dataCols = keys.map((k) => {
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

      return {
        key: k,
        label: labelFor(k),
        sortable,
        stickyLeft: false,
      } as ColDef;
    });

    return [...left, ...dataCols];
  }, [extraLeftCols, keys]);

  const colKeys = cols.map((c) => c.key);
  const { widths, startResize } = useColumnWidths(colKeys, 180);
  const stickyLeft = useMemo(() => computeStickyLeftOffsets(cols, widths), [cols, widths]);

  const commit = useCallback(
    async (rowId: string, colKey: string, rawValue: string) => {
      // map synthetic left col key to real columns
      if (colKey === "__client_name__") return;
      await onUpdate(rowId, colKey, rawValue);
    },
    [onUpdate]
  );

  return (
    <div className={`overflow-auto border border-slate-500 bg-white ${maxHeightClass}`}>
      <table className="w-full border-collapse" style={{ tableLayout: "fixed", minWidth: 1600 }}>
        <thead className="sticky top-0 bg-slate-100 z-20">
          <tr className="text-left text-xs font-semibold text-slate-700">
            {cols.map((c) => {
              const isSticky = !!c.stickyLeft;
              const left = isSticky ? stickyLeft[c.key] : undefined;
              const z = isSticky ? 40 : 30; // ensure top-left stays above
              return (
                <th
                  key={c.key}
                  className="border border-slate-500 px-2 py-2 whitespace-nowrap relative"
                  style={{
                    width: widths[c.key],
                    position: isSticky ? "sticky" : "static",
                    left,
                    top: 0,
                    zIndex: z,
                    background: "#f1f5f9",
                  }}
                >
                  {c.sortable ? (
                    <button
                      className="inline-flex items-center hover:underline"
                      onClick={() => onSortChange(c.sortable as SortKeyAll)}
                      type="button"
                    >
                      {c.label}
                      {sortIcon(c.sortable as SortKeyAll)}
                    </button>
                  ) : (
                    c.label
                  )}

                  {/* resizer */}
                  <div
                    onMouseDown={(e) => startResize(c.key, e.clientX)}
                    className="absolute top-0 right-0 h-full w-2 cursor-col-resize"
                    style={{ background: "transparent" }}
                  />
                </th>
              );
            })}
          </tr>
        </thead>

        <tbody>
          {rows.map((r) => (
            <tr key={String(r.id)} className="hover:bg-slate-50">
              {cols.map((c) => {
                const isSticky = !!c.stickyLeft;
                const left = isSticky ? stickyLeft[c.key] : undefined;
                const z = isSticky ? 10 : 1;

                // Left synthetic client name column
                if (c.key === "__client_name__") {
                  const text = extraLeftCols.find((x) => x.key === "__client_name__")?.render(r) ?? "";
                  return (
                    <td
                      key={c.key}
                      className="border border-slate-300 px-2 py-2 whitespace-nowrap font-semibold text-slate-800"
                      style={{
                        width: widths[c.key],
                        position: isSticky ? "sticky" : "static",
                        left,
                        zIndex: z,
                        background: isSticky ? "white" : "transparent",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                    >
                      {text}
                    </td>
                  );
                }

                // created_at display only (read-only)
                if (c.key === "created_at") {
                  const d = new Date(r.created_at);
                  const text = Number.isNaN(d.getTime()) ? "" : d.toLocaleDateString();
                  return (
                    <td
                      key={c.key}
                      className="border border-slate-300 px-2 py-2 whitespace-nowrap"
                      style={{
                        width: widths[c.key],
                        position: isSticky ? "sticky" : "static",
                        left,
                        zIndex: z,
                        background: isSticky ? "white" : "transparent",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                    >
                      {text}
                    </td>
                  );
                }

                const val = r[c.key];

                // Readonly list columns (show popover list)
                if (READONLY_LIST_COLS.has(c.key)) {
                  const items = asListItems(val);
                  const display = items.join(", ");
                  return (
                    <td
                      key={c.key}
                      className="border border-slate-300 px-2 py-2 align-top"
                      style={{
                        width: widths[c.key],
                        position: isSticky ? "sticky" : "static",
                        left,
                        zIndex: z,
                        background: isSticky ? "white" : "transparent",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                    >
                      <div className="whitespace-normal break-words">{display || "—"}</div>
                    </td>
                  );
                }

                // Editable fields: controlled input -> fixes date not showing after selection
                return (
                  <td
                    key={c.key}
                    className="border border-slate-300 px-2 py-2"
                    style={{
                      width: widths[c.key],
                      position: isSticky ? "sticky" : "static",
                      left,
                      zIndex: z,
                      background: isSticky ? "white" : "transparent",
                    }}
                  >
                    <EditableCell
                      rowId={String(r.id)}
                      colKey={c.key}
                      value={val}
                      saving={savingId === String(r.id)}
                      onCommit={commit}
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
