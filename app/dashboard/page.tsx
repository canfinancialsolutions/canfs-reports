"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
  BarChart,
  Bar,
} from "recharts";

type SortDir = "asc" | "desc";
type SortState = { key: string; dir: SortDir };

type RegistrationRow = {
  id: string;
  first_name?: string | null;
  last_name?: string | null;
  phone?: string | null;
  email?: string | null;

  created_at?: string | null;
  status?: string | null;

  interest_type?: string | null;
  business_opportunities?: string | null;
  wealth_solutions?: string | null;

  profession?: string | null;
  preferred_days?: string | null;
  preferred_time?: string | null;
  referred_by?: string | null;

  called_on?: string | null;
  bop_date?: string | null;
  BOP_Status?: string | null;

  followup_date?: string | null;
  followup_status?: string | null;

  product?: string | null;
  issued?: string | null;
  comment?: string | null;
  remark?: string | null;
};

type ProgressRow = {
  client_name: string;
  first_name?: string | null;
  last_name?: string | null;
  phone?: string | null;
  email?: string | null;

  last_call_date?: string | null;
  call_attempts?: number | null;

  last_bop_date?: string | null;
  bop_attempts?: number | null;

  last_followup_date?: string | null;
  followup_attempts?: number | null;
};

const PAGE_SIZE = 20;

function getSupabase(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  return createClient(url, key);
}

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

/** Convert ISO -> value for <input type="datetime-local"> (local time) */
function toDateTimeLocalValue(iso: string | null | undefined) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}T${pad2(
    d.getHours()
  )}:${pad2(d.getMinutes())}`;
}

/** Convert datetime-local string -> ISO (UTC) */
function fromDateTimeLocalValue(v: string) {
  if (!v) return null;
  // v is like "YYYY-MM-DDTHH:mm"
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

function formatDisplayDate(iso: string | null | undefined) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString();
}

function safeText(v: any) {
  if (v === null || v === undefined) return "";
  return String(v);
}

/**
 * IMPORTANT: Sort must happen on the SERVER (Supabase query),
 * then pagination (range) is applied after ordering.
 */
function applyOrder(query: any, sort: SortState) {
  const asc = sort.dir === "asc";
  const key = sort.key;

  // special: client_name sorts by last_name then first_name (change if you have "client_name" column)
  if (key === "client_name") {
    return query
      .order("last_name", { ascending: asc, nullsLast: true })
      .order("first_name", { ascending: asc, nullsLast: true });
  }

  const map: Record<string, string> = {
    created_date: "created_at",
    status: "status",
    called_on: "called_on",
    bop_date: "bop_date",
    bop_status: "BOP_Status",
    followup_date: "followup_date",
    followup_status: "followup_status",
    email: "email",
    phone: "phone",
    first_name: "first_name",
    last_name: "last_name",
  };

  const col = map[key] ?? key;
  return query.order(col, { ascending: asc, nullsLast: true });
}

/** =========================
 *  Resizable columns (all tables)
 *  drag the thin handle at the right edge of each header
 *  ========================= */
function useColumnWidths(initial: Record<string, number>) {
  const [widths, setWidths] = useState<Record<string, number>>(initial);

  const resizingRef = useRef<{
    key: string;
    startX: number;
    startW: number;
  } | null>(null);

  useEffect(() => {
    function onMove(e: MouseEvent) {
      if (!resizingRef.current) return;
      const { key, startX, startW } = resizingRef.current;
      const delta = e.clientX - startX;
      const next = Math.max(60, startW + delta);
      setWidths((prev) => ({ ...prev, [key]: next }));
    }
    function onUp() {
      resizingRef.current = null;
    }
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, []);

  function startResize(key: string, e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    const th = (e.currentTarget as HTMLDivElement).parentElement as HTMLTableCellElement | null;
    const currentWidth = widths[key] ?? th?.getBoundingClientRect().width ?? 160;
    resizingRef.current = { key, startX: e.clientX, startW: currentWidth };
  }

  return { widths, setWidths, startResize };
}

function HeaderCell(props: {
  label: string;
  sortKey?: string;
  sort?: SortState;
  onSort?: (key: string) => void;
  width?: number;
  stickyLeft?: boolean;
  stickyTop?: boolean;
  zIndex?: number;
  startResize?: (key: string, e: React.MouseEvent) => void;
  resizeKey?: string;
}) {
  const {
    label,
    sortKey,
    sort,
    onSort,
    width,
    stickyLeft,
    stickyTop,
    zIndex,
    startResize,
    resizeKey,
  } = props;

  const isSorted = !!sortKey && sort?.key === sortKey;
  const arrow = isSorted ? (sort?.dir === "asc" ? " ↑" : " ↓") : "";

  const style: React.CSSProperties = {
    width: width ? `${width}px` : undefined,
    minWidth: width ? `${width}px` : undefined,
    maxWidth: width ? `${width}px` : undefined,
    position: stickyLeft || stickyTop ? "sticky" : undefined,
    left: stickyLeft ? 0 : undefined,
    top: stickyTop ? 0 : undefined,
    zIndex: zIndex ?? (stickyLeft && stickyTop ? 30 : stickyLeft ? 20 : stickyTop ? 10 : 1),
    background: "#f8fafc",
  };

  return (
    <th
      className="border border-slate-500 px-3 py-2 text-left text-xs font-semibold text-slate-700 relative select-none"
      style={style}
      onClick={() => {
        if (sortKey && onSort) onSort(sortKey);
      }}
    >
      <div className="flex items-center gap-2">
        <span className="truncate">{label + arrow}</span>
      </div>

      {/* thin drag handle at right edge */}
      {startResize && resizeKey ? (
        <div
          className="absolute top-0 right-0 h-full w-[6px] cursor-col-resize"
          onMouseDown={(e) => startResize(resizeKey, e)}
        />
      ) : null}
    </th>
  );
}

function Cell(props: {
  children: React.ReactNode;
  width?: number;
  stickyLeft?: boolean;
  stickyTop?: boolean;
  zIndex?: number;
  className?: string;
}) {
  const { children, width, stickyLeft, stickyTop, zIndex, className } = props;
  const style: React.CSSProperties = {
    width: width ? `${width}px` : undefined,
    minWidth: width ? `${width}px` : undefined,
    maxWidth: width ? `${width}px` : undefined,
    position: stickyLeft || stickyTop ? "sticky" : undefined,
    left: stickyLeft ? 0 : undefined,
    top: stickyTop ? 0 : undefined,
    zIndex: zIndex ?? (stickyLeft && stickyTop ? 25 : stickyLeft ? 15 : stickyTop ? 5 : 1),
    background: stickyLeft ? "white" : undefined,
  };

  return (
    <td className={`border border-slate-300 px-3 py-2 align-top ${className ?? ""}`} style={style}>
      {children}
    </td>
  );
}

export default function DashboardPage() {
  const supabase = useMemo(() => getSupabase(), []);

  const [error, setError] = useState<string | null>(null);

  // Logout
  async function logout() {
    try {
      setError(null);
      await supabase.auth.signOut();
      // optionally redirect if you have a login page
      // window.location.href = "/";
    } catch (e: any) {
      setError(e?.message || "Logout failed");
    }
  }

  /** ======================
   * Trends
   * ====================== */
  const [trendsLoading, setTrendsLoading] = useState(false);
  const [weeklyData, setWeeklyData] = useState<any[]>([]);
  const [monthlyData, setMonthlyData] = useState<any[]>([]);

  async function loadTrends() {
    setTrendsLoading(true);
    setError(null);

    try {
      // Pull enough rows to compute charts (last year + recent weeks)
      const now = new Date();
      const startOfYear = new Date(now.getFullYear(), 0, 1);
      const lastYearISO = startOfYear.toISOString();

      const { data, error: e1 } = await supabase
        .from("client_registrations")
        .select("created_at,BOP_Date")
        .gte("created_at", lastYearISO);

      if (e1) throw e1;

      const rows = (data ?? []) as { created_at: string | null; bop_date: string | null }[];

      // Weekly (last 5 weeks incl current): group by week start (Sunday)
      const weeks: { label: string; prospects: number; bops: number }[] = [];
      const end = new Date();
      end.setHours(0, 0, 0, 0);

      for (let i = 4; i >= 0; i--) {
        const wkEnd = new Date(end);
        wkEnd.setDate(wkEnd.getDate() - i * 7);

        const wkStart = new Date(wkEnd);
        wkStart.setDate(wkStart.getDate() - 6);

        const startMs = wkStart.getTime();
        const endMs = new Date(wkEnd.getFullYear(), wkEnd.getMonth(), wkEnd.getDate(), 23, 59, 59).getTime();

        const prospects = rows.filter((r) => {
          if (!r.created_at) return false;
          const t = new Date(r.created_at).getTime();
          return t >= startMs && t <= endMs;
        }).length;

        const bops = rows.filter((r) => {
          if (!r.bop_date) return false;
          const t = new Date(r.bop_date).getTime();
          return t >= startMs && t <= endMs;
        }).length;

        weeks.push({
          label: wkEnd.toISOString().slice(0, 10),
          prospects,
          bops,
        });
      }

      // Monthly (current year)
      const months: { label: string; prospects: number; bops: number }[] = [];
      for (let m = 0; m < 12; m++) {
        const mStart = new Date(now.getFullYear(), m, 1);
        const mEnd = new Date(now.getFullYear(), m + 1, 0, 23, 59, 59);
        const startMs = mStart.getTime();
        const endMs = mEnd.getTime();

        const prospects = rows.filter((r) => {
          if (!r.created_at) return false;
          const t = new Date(r.created_at).getTime();
          return t >= startMs && t <= endMs;
        }).length;

        const bops = rows.filter((r) => {
          if (!r.bop_date) return false;
          const t = new Date(r.bop_date).getTime();
          return t >= startMs && t <= endMs;
        }).length;

        months.push({
          label: `${now.getFullYear()}-${pad2(m + 1)}`,
          prospects,
          bops,
        });
      }

      setWeeklyData(weeks);
      setMonthlyData(months);
    } catch (e: any) {
      setError(e?.message || "Failed to load trends");
    } finally {
      setTrendsLoading(false);
    }
  }

  /** ======================
   * Upcoming BOP meetings
   * ====================== */
  const [upcomingStart, setUpcomingStart] = useState<string>(() => {
    const d = new Date();
    return `${pad2(d.getMonth() + 1)}/${pad2(d.getDate())}/${d.getFullYear()}`;
  });
  const [upcomingEnd, setUpcomingEnd] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() + 30);
    return `${pad2(d.getMonth() + 1)}/${pad2(d.getDate())}/${d.getFullYear()}`;
  });

  const [upcomingVisible, setUpcomingVisible] = useState(true);
  const [upcomingLoading, setUpcomingLoading] = useState(false);
  const [upcomingRows, setUpcomingRows] = useState<RegistrationRow[]>([]);
  const [upcomingSort, setUpcomingSort] = useState<SortState>({ key: "client_name", dir: "asc" });
  const [upcomingPage, setUpcomingPage] = useState(0);
  const [upcomingTotal, setUpcomingTotal] = useState(0);

  function parseMMDDYYYY(s: string) {
    const m = s.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (!m) return null;
    const mm = Number(m[1]);
    const dd = Number(m[2]);
    const yyyy = Number(m[3]);
    const d = new Date(yyyy, mm - 1, dd);
    if (Number.isNaN(d.getTime())) return null;
    return d;
  }

  async function loadUpcoming(page: number) {
    setUpcomingLoading(true);
    setError(null);

    try {
      const s = parseMMDDYYYY(upcomingStart);
      const e = parseMMDDYYYY(upcomingEnd);
      if (!s || !e) throw new Error("Invalid start/end date (use MM/DD/YYYY)");

      const startISO = new Date(s.getFullYear(), s.getMonth(), s.getDate(), 0, 0, 0).toISOString();
      const endISO = new Date(e.getFullYear(), e.getMonth(), e.getDate(), 23, 59, 59).toISOString();

      // count
      let countQ = supabase
        .from("client_registrations")
        .select("id", { count: "exact", head: true })
        .gte("BOP_Date", startISO)
        .lte("BOP_Date", endISO);

      const { count, error: cErr } = await countQ;
      if (cErr) throw cErr;
      setUpcomingTotal(count ?? 0);

      const from = page * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;

      let q = supabase
        .from("client_registrations")
        .select(
          "id,first_name,last_name,phone,email,created_at,status,interest_type,business_opportunities,wealth_solutions,BOP_Date,BOP_Status,Followup_Date"
        )
        .gte("BOP_Date", startISO)
        .lte("BOP_Date", endISO);

      q = applyOrder(q, upcomingSort);

      const { data, error: e2 } = await q.range(from, to);
      if (e2) throw e2;

      setUpcomingRows((data ?? []) as any);
      setUpcomingPage(page);
    } catch (e: any) {
      setError(e?.message || "Failed to load upcoming");
    } finally {
      setUpcomingLoading(false);
    }
  }

  /** ======================
   * All Records (Editable)
   * ====================== */
  const [allQ, setAllQ] = useState("");
  const [allLoading, setAllLoading] = useState(false);
  const [allRows, setAllRows] = useState<RegistrationRow[]>([]);
  const [allSort, setAllSort] = useState<SortState>({ key: "client_name", dir: "asc" });
  const [allPage, setAllPage] = useState(0);
  const [allTotal, setAllTotal] = useState(0);

  // Draft input cache so the datetime-local never “disappears” during typing
  const [draftDate, setDraftDate] = useState<Record<string, { called?: string; bop?: string; follow?: string }>>({});

  async function loadAll(page: number) {
    setAllLoading(true);
    setError(null);

    try {
      const s = allQ.trim();

      // count
      let countQ = supabase
        .from("client_registrations")
        .select("id", { count: "exact", head: true });

      if (s) {
        // ilike is case-insensitive
        countQ = countQ.or(
          `first_name.ilike.%${s}%,last_name.ilike.%${s}%,phone.ilike.%${s}%,email.ilike.%${s}%`
        );
      }

      const { count, error: cErr } = await countQ;
      if (cErr) throw cErr;
      setAllTotal(count ?? 0);

      const from = page * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;

      let q = supabase
        .from("client_registrations")
        .select(
          "id,first_name,last_name,phone,email,created_at,status,profession,preferred_days,preferred_time,referred_by,CalledOn,BOP_Date,BOP_Status,Followup_Date,FollowUp_Status,Product,Issued,Comment,Remark, client_status"
        );

      if (s) {
        q = q.or(
          `first_name.ilike.%${s}%,last_name.ilike.%${s}%,phone.ilike.%${s}%,email.ilike.%${s}%`
        );
      }

      // ✅ server-side sort (whole dataset)
      q = applyOrder(q, allSort);

      // ✅ paginate after ordering
      const { data, error: e2 } = await q.range(from, to);
      if (e2) throw e2;

      setAllRows((data ?? []) as any);
      setAllPage(page);
    } catch (e: any) {
      setError(e?.message || "Failed to load all records");
    } finally {
      setAllLoading(false);
    }
  }

  /** Save date columns (called_on, bop_date, followup_date)
   *  NOTE: If you still get RLS error "client_call_track", that is BACKEND policy.
   *  This code will keep the selected date visible immediately (optimistic UI).
   */
  async function saveRegistrationDate(id: string, field: "CalledOn" | "BOP_Date" | "followup_date", iso: string | null) {
    const payload: any = {};
    payload[field] = iso;

    const { error: e1 } = await supabase.from("client_registrations").update(payload).eq("id", id);
    if (e1) throw e1;
  }

  /** ======================
   * Client Progress Summary
   * ====================== */
  const [progressVisible, setProgressVisible] = useState(true);
  const [progressFilter, setProgressFilter] = useState("");
  const [progressLoading, setProgressLoading] = useState(false);
  const [progressRows, setProgressRows] = useState<ProgressRow[]>([]);
  const [progressSort, setProgressSort] = useState<SortState>({ key: "client_name", dir: "asc" });
  const [progressPage, setProgressPage] = useState(0);
  const [progressTotal, setProgressTotal] = useState(0);

  async function loadProgress(page: number) {
    setProgressLoading(true);
    setError(null);

    try {
      const s = progressFilter.trim();

      // Prefer a view/table if you have it (client_progress_summary)
      // If it doesn't exist, show a helpful error.
      let countQ = supabase
        .from("client_progress_summary")
        .select("client_name", { count: "exact", head: true });

      if (s) {
        countQ = countQ.ilike("client_name", `%${s}%`);
      }

      const { count, error: cErr } = await countQ;
      if (cErr) throw cErr;
      setProgressTotal(count ?? 0);

      const from = page * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;

      let q = supabase
        .from("client_progress_summary")
        .select(
          "client_name,first_name,last_name,phone,email,last_call_date,call_attempts,last_bop_date,bop_attempts,last_followup_date,followup_attempts"
        );

      if (s) q = q.ilike("client_name", `%${s}%`);

      // server sort for whole dataset
      q = applyOrder(q, progressSort);

      const { data, error: e2 } = await q.range(from, to);
      if (e2) throw e2;

      setProgressRows((data ?? []) as any);
      setProgressPage(page);
    } catch (e: any) {
      setError(
        e?.message ||
          'Failed to load Client Progress Summary. Make sure "client_progress_summary" exists or share your current query/view.'
      );
    } finally {
      setProgressLoading(false);
    }
  }

  /** ======================
   * Column definitions + widths
   * ====================== */
  // All Records columns (make ALL resizable)
  const allCols = useMemo(
    () => [
      { key: "client_name", label: "Client Name", w: 180, sticky: true },
      { key: "preferred_days", label: "Preferred Days", w: 160 },
      { key: "preferred_time", label: "Preferred Time", w: 160 },
      { key: "referred_by", label: "Referred By", w: 160 },
      { key: "calledon", label: "Called On", w: 210 },
      { key: "bop_date", label: "BOP Date", w: 210 },
      { key: "bop_status", label: "BOP Status", w: 160 },
      { key: "followup_date", label: "Follow-Up Date", w: 210 },
      { key: "followup_status", label: "Follow-Up Status", w: 180 },
      { key: "product", label: "Product", w: 160 },
      { key: "issued", label: "Issued", w: 210 },
      { key: "comment", label: "Comment", w: 220 },
      { key: "remark", label: "Remark", w: 180 },
    ],
    []
  );

  const { widths: allWidths, startResize: startResizeAll } = useColumnWidths(
    Object.fromEntries(allCols.map((c) => [c.key, c.w]))
  );

  const upcomingCols = useMemo(
    () => [
      { key: "client_name", label: "Client Name", w: 180, sticky: true },
      { key: "bop_date", label: "BOP Date", w: 210 },
      { key: "created_date", label: "Created Date", w: 140 },
      { key: "bop_status", label: "BOP Status", w: 160 },
      { key: "followup_date", label: "Follow-Up Date", w: 210 },
      { key: "status", label: "Status", w: 120 },
      { key: "interest_type", label: "Interest Type", w: 160 },
      { key: "business_opportunities", label: "Business Opportunities", w: 220 },
      { key: "wealth_solutions", label: "Wealth Solutions", w: 220 },
    ],
    []
  );

  const { widths: upcomingWidths, startResize: startResizeUpcoming } = useColumnWidths(
    Object.fromEntries(upcomingCols.map((c) => [c.key, c.w]))
  );

  const progressCols = useMemo(
    () => [
      { key: "client_name", label: "Client Name", w: 180, sticky: true },
      { key: "first_name", label: "First Name", w: 90 },
      { key: "last_name", label: "Last Name", w: 90 },
      { key: "phone", label: "Phone", w: 120 },
      { key: "email", label: "Email", w: 220 },
      { key: "last_call_date", label: "Last Call On", w: 190 },
      { key: "call_attempts", label: "No of Calls", w: 90 },
      { key: "last_bop_date", label: "Last BOP Call On", w: 200 },
      { key: "bop_attempts", label: "No of BOP Calls", w: 120 },
      { key: "last_followup_date", label: "Last FollowUp On", w: 200 },
      { key: "followup_attempts", label: "No of FollowUp Calls", w: 140 },
    ],
    []
  );

  const { widths: progressWidths, startResize: startResizeProgress } = useColumnWidths(
    Object.fromEntries(progressCols.map((c) => [c.key, c.w]))
  );

  /** ======================
   * Initial load
   * ====================== */
  useEffect(() => {
    loadTrends();
    loadAll(0);
    loadUpcoming(0);
    loadProgress(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** ======================
   * Sort handlers (server sort + reset to page 0)
   * ====================== */
  function toggleSort(prev: SortState, key: string): SortState {
    if (prev.key === key) return { key, dir: prev.dir === "asc" ? "desc" : "asc" };
    return { key, dir: "asc" };
  }

  function onAllSort(key: string) {
    setAllSort((p) => {
      const next = toggleSort(p, key);
      // reload first page
      setTimeout(() => loadAll(0), 0);
      return next;
    });
  }

  function onUpcomingSort(key: string) {
    setUpcomingSort((p) => {
      const next = toggleSort(p, key);
      setTimeout(() => loadUpcoming(0), 0);
      return next;
    });
  }

  function onProgressSort(key: string) {
    setProgressSort((p) => {
      const next = toggleSort(p, key);
      setTimeout(() => loadProgress(0), 0);
      return next;
    });
  }

  /** ======================
   * Pagination helpers
   * ====================== */
  function pageCount(total: number) {
    return Math.max(1, Math.ceil(total / PAGE_SIZE));
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-[1600px] mx-auto p-6 space-y-6">
        {/* Header */}
        <header className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="text-xl font-semibold text-slate-900">Excel-style tables, editable follow-ups, and trends</div>
          </div>

          <div className="flex items-center gap-2">
            <button
              className="px-3 py-2 rounded-lg border border-slate-200 bg-white text-slate-900 hover:bg-slate-50"
              onClick={logout}
            >
              Logout
            </button>
          </div>
        </header>

        {/* Error */}
        {error ? (
          <div className="border border-red-200 bg-red-50 text-red-800 rounded-xl p-3 text-sm">{error}</div>
        ) : null}

        {/* Trends */}
        <section className="bg-white rounded-2xl border border-slate-200 p-5">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-900">Trends</h2>
            <button
              className="px-3 py-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-50"
              onClick={loadTrends}
              disabled={trendsLoading}
            >
              Refresh
            </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-4">
            <div>
              <div className="text-sm font-medium text-slate-700 mb-2">Weekly (Last 5 Weeks)</div>
              <div className="h-[260px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={weeklyData} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    {/* Different colors */}
                    <Line type="monotone" dataKey="prospects" name="prospects" stroke="#2563eb" strokeWidth={2} dot />
                    <Line type="monotone" dataKey="bops" name="bops" stroke="#16a34a" strokeWidth={2} dot />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div>
              <div className="text-sm font-medium text-slate-700 mb-2">Monthly (Current Year)</div>
              <div className="h-[260px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={monthlyData} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    {/* Different colors */}
                    <Bar dataKey="prospects" name="prospects" fill="#2563eb" />
                    <Bar dataKey="bops" name="bops" fill="#16a34a" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </section>

        {/* Upcoming BOP Date Range */}
        <section className="bg-white rounded-2xl border border-slate-200 p-5">
          <h2 className="text-lg font-semibold text-slate-900">Upcoming BOP Date Range</h2>

          <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mt-4 items-end">
            <div className="md:col-span-2">
              <label className="block text-sm text-slate-700 mb-1">Start</label>
              <input
                className="w-full px-3 py-2 rounded-lg border border-slate-200"
                value={upcomingStart}
                onChange={(e) => setUpcomingStart(e.target.value)}
                placeholder="MM/DD/YYYY"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm text-slate-700 mb-1">End</label>
              <input
                className="w-full px-3 py-2 rounded-lg border border-slate-200"
                value={upcomingEnd}
                onChange={(e) => setUpcomingEnd(e.target.value)}
                placeholder="MM/DD/YYYY"
              />
            </div>

            <div className="flex gap-2">
              <button
                className="px-4 py-2 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50"
                onClick={() => loadUpcoming(0)}
                disabled={upcomingLoading}
              >
                Load
              </button>

              <button
                className="px-4 py-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50"
                onClick={() => setUpcomingVisible((v) => !v)}
              >
                {upcomingVisible ? "Hide Upcoming Table" : "Show Upcoming Table"}
              </button>
            </div>
          </div>
        </section>

        {/* Upcoming BOP Meetings */}
        {upcomingVisible ? (
          <section className="bg-white rounded-2xl border border-slate-200 p-5">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-lg font-semibold text-slate-900">Upcoming BOP Meetings (Editable)</h2>
              <div className="flex items-center gap-2">
                <div className="text-sm text-slate-600">
                  Page {upcomingPage + 1} of {pageCount(upcomingTotal)}
                </div>
                <button
                  className="px-3 py-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-50"
                  onClick={() => loadUpcoming(Math.max(0, upcomingPage - 1))}
                  disabled={upcomingPage <= 0 || upcomingLoading}
                >
                  Previous
                </button>
                <button
                  className="px-3 py-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-50"
                  onClick={() => loadUpcoming(Math.min(pageCount(upcomingTotal) - 1, upcomingPage + 1))}
                  disabled={upcomingPage >= pageCount(upcomingTotal) - 1 || upcomingLoading}
                >
                  Next
                </button>
              </div>
            </div>

            <div className="text-sm text-slate-600 mt-1">Table supports vertical + horizontal scrolling.</div>

            <div className="mt-3 overflow-auto border border-slate-500 bg-white max-h-[420px]">
              <table className="min-w-[1400px] w-full border-collapse" style={{ tableLayout: "fixed" }}>
                <thead>
                  <tr>
                    {upcomingCols.map((c) => (
                      <HeaderCell
                        key={c.key}
                        label={c.label}
                        sortKey={c.key}
                        sort={upcomingSort}
                        onSort={onUpcomingSort}
                        width={upcomingWidths[c.key]}
                        stickyLeft={c.sticky}
                        stickyTop
                        zIndex={c.sticky ? 35 : 15}
                        startResize={startResizeUpcoming}
                        resizeKey={c.key}
                      />
                    ))}
                  </tr>
                </thead>

                <tbody>
                  {upcomingRows.map((r) => {
                    const clientName = `${safeText(r.first_name)} ${safeText(r.last_name)}`.trim() || "(no name)";
                    return (
                      <tr key={r.id}>
                        <Cell width={upcomingWidths["client_name"]} stickyLeft className="font-semibold">
                          {clientName}
                        </Cell>

                        <Cell width={upcomingWidths["bop_date"]}>{formatDisplayDate(r.bop_date)}</Cell>
                        <Cell width={upcomingWidths["created_date"]}>
                          {r.created_at ? new Date(r.created_at).toLocaleDateString() : ""}
                        </Cell>
                        <Cell width={upcomingWidths["bop_status"]}>{safeText(r.BOP_Status)}</Cell>
                        <Cell width={upcomingWidths["followup_date"]}>{formatDisplayDate(r.followup_date)}</Cell>
                        <Cell width={upcomingWidths["status"]}>{safeText(r.status)}</Cell>
                        <Cell width={upcomingWidths["interest_type"]}>{safeText(r.interest_type)}</Cell>
                        <Cell width={upcomingWidths["business_opportunities"]}>{safeText(r.business_opportunities)}</Cell>
                        <Cell width={upcomingWidths["wealth_solutions"]}>{safeText(r.wealth_solutions)}</Cell>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        ) : null}

        {/* All Records (Editable) */}
        <section className="bg-white rounded-2xl border border-slate-200 p-5">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold text-slate-900">All Records (Editable)</h2>

            <div className="flex items-center gap-2">
              <div className="text-sm text-slate-600">
                Page {allPage + 1} of {pageCount(allTotal)}
              </div>
              <button
                className="px-3 py-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-50"
                onClick={() => loadAll(Math.max(0, allPage - 1))}
                disabled={allPage <= 0 || allLoading}
              >
                Previous
              </button>
              <button
                className="px-3 py-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-50"
                onClick={() => loadAll(Math.min(pageCount(allTotal) - 1, allPage + 1))}
                disabled={allPage >= pageCount(allTotal) - 1 || allLoading}
              >
                Next
              </button>
            </div>
          </div>

          <div className="mt-3 flex items-center gap-2">
            <input
              className="w-full md:w-[420px] px-3 py-2 rounded-lg border border-slate-200"
              value={allQ}
              onChange={(e) => setAllQ(e.target.value)}
              placeholder="Search (name / phone / email)..."
            />
            <button
              className="px-3 py-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-50"
              onClick={() => loadAll(0)}
              disabled={allLoading}
            >
              Refresh
            </button>
          </div>

          <div className="mt-3 overflow-auto border border-slate-500 bg-white max-h-[520px]">
            <table className="min-w-[1700px] w-full border-collapse" style={{ tableLayout: "fixed" }}>
              <thead>
                <tr>
                  {allCols.map((c) => (
                    <HeaderCell
                      key={c.key}
                      label={c.label}
                      sortKey={c.key}
                      sort={allSort}
                      onSort={onAllSort}
                      width={allWidths[c.key]}
                      stickyLeft={c.sticky}
                      stickyTop
                      zIndex={c.sticky ? 35 : 15}
                      startResize={startResizeAll}
                      resizeKey={c.key}
                    />
                  ))}
                </tr>
              </thead>

              <tbody>
                {allRows.map((r) => {
                  const clientName = `${safeText(r.first_name)} ${safeText(r.last_name)}`.trim() || "(no name)";
                  const d = draftDate[r.id] || {};

                  const calledInput = d.called ?? toDateTimeLocalValue(r.called_on);
                  const bopInput = d.bop ?? toDateTimeLocalValue(r.bop_date);
                  const followInput = d.follow ?? toDateTimeLocalValue(r.followup_date);

                  return (
                    <tr key={r.id}>
                      <Cell width={allWidths["client_name"]} stickyLeft className="font-semibold">
                        {clientName}
                      </Cell>

                      <Cell width={allWidths["preferred_days"]}>{safeText(r.preferred_days)}</Cell>
                      <Cell width={allWidths["preferred_time"]}>{safeText(r.preferred_time)}</Cell>
                      <Cell width={allWidths["referred_by"]}>{safeText(r.referred_by)}</Cell>

                      {/* Called On (editable + must persist in state immediately) */}
                      <Cell width={allWidths["called_on"]}>
                        <input
                          type="datetime-local"
                          className="w-full bg-transparent outline-none"
                          value={calledInput}
                          onChange={(e) => {
                            const v = e.target.value;
                            setDraftDate((prev) => ({ ...prev, [r.id]: { ...(prev[r.id] || {}), called: v } }));

                            const iso = fromDateTimeLocalValue(v);
                            // optimistic UI: update row immediately so it doesn't disappear on blur
                            setAllRows((prev) => prev.map((x) => (x.id === r.id ? { ...x, called_on: iso } : x)));

                            // persist
                            saveRegistrationDate(r.id, "called_on", iso).catch((err: any) => {
                              setError(err?.message || "Failed to save Called On");
                            });
                          }}
                          onBlur={() => {
                            // once blur happens, clear draft so it reuses saved value
                            setDraftDate((prev) => {
                              const next = { ...prev };
                              if (next[r.id]) next[r.id] = { ...next[r.id], called: undefined };
                              return next;
                            });
                          }}
                        />
                      </Cell>

                      {/* BOP Date */}
                      <Cell width={allWidths["bop_date"]}>
                        <input
                          type="datetime-local"
                          className="w-full bg-transparent outline-none"
                          value={bopInput}
                          onChange={(e) => {
                            const v = e.target.value;
                            setDraftDate((prev) => ({ ...prev, [r.id]: { ...(prev[r.id] || {}), bop: v } }));

                            const iso = fromDateTimeLocalValue(v);
                            setAllRows((prev) => prev.map((x) => (x.id === r.id ? { ...x, bop_date: iso } : x)));

                            saveRegistrationDate(r.id, "bop_date", iso).catch((err: any) => {
                              setError(err?.message || "Failed to save BOP Date");
                            });
                          }}
                          onBlur={() => {
                            setDraftDate((prev) => {
                              const next = { ...prev };
                              if (next[r.id]) next[r.id] = { ...next[r.id], bop: undefined };
                              return next;
                            });
                          }}
                        />
                      </Cell>

                      <Cell width={allWidths["bop_status"]}>{safeText(r.BOP_Status)}</Cell>

                      {/* Follow-Up Date */}
                      <Cell width={allWidths["followup_date"]}>
                        <input
                          type="datetime-local"
                          className="w-full bg-transparent outline-none"
                          value={followInput}
                          onChange={(e) => {
                            const v = e.target.value;
                            setDraftDate((prev) => ({ ...prev, [r.id]: { ...(prev[r.id] || {}), follow: v } }));

                            const iso = fromDateTimeLocalValue(v);
                            setAllRows((prev) =>
                              prev.map((x) => (x.id === r.id ? { ...x, followup_date: iso } : x))
                            );

                            saveRegistrationDate(r.id, "followup_date", iso).catch((err: any) => {
                              setError(err?.message || "Failed to save Follow-Up Date");
                            });
                          }}
                          onBlur={() => {
                            setDraftDate((prev) => {
                              const next = { ...prev };
                              if (next[r.id]) next[r.id] = { ...next[r.id], follow: undefined };
                              return next;
                            });
                          }}
                        />
                      </Cell>

                      <Cell width={allWidths["followup_status"]}>{safeText(r.followup_status)}</Cell>
                      <Cell width={allWidths["product"]}>{safeText(r.product)}</Cell>
                      <Cell width={allWidths["issued"]}>{formatDisplayDate(r.issued)}</Cell>
                      <Cell width={allWidths["comment"]}>{safeText(r.comment)}</Cell>
                      <Cell width={allWidths["remark"]}>{safeText(r.remark)}</Cell>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* NOTE about RLS */}
          <div className="mt-2 text-xs text-slate-500">
            If saving dates still fails with{" "}
            <span className="font-mono">new row violates row-level security policy for table "client_call_track"</span>,
            that is a Supabase RLS policy issue (backend). Your UI will keep the selected date visible immediately,
            but you must fix the RLS policy or remove the insert into <span className="font-mono">client_call_track</span>{" "}
            to persist it permanently.
          </div>
        </section>

        {/* Client Progress Summary */}
        <section className="bg-white rounded-2xl border border-slate-200 p-5">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold text-slate-900">Client Progress Summary</h2>

            <div className="flex items-center gap-2">
              <button
                className="px-3 py-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-50"
                onClick={() => loadProgress(0)}
                disabled={progressLoading}
              >
                Refresh
              </button>
              <button
                className="px-3 py-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50"
                onClick={() => setProgressVisible((v) => !v)}
              >
                {progressVisible ? "Hide Table" : "Show Table"}
              </button>

              <div className="text-sm text-slate-600 ml-2">
                Page {progressPage + 1} of {pageCount(progressTotal)}
              </div>
              <button
                className="px-3 py-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-50"
                onClick={() => loadProgress(Math.max(0, progressPage - 1))}
                disabled={progressPage <= 0 || progressLoading}
              >
                Previous
              </button>
              <button
                className="px-3 py-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-50"
                onClick={() => loadProgress(Math.min(pageCount(progressTotal) - 1, progressPage + 1))}
                disabled={progressPage >= pageCount(progressTotal) - 1 || progressLoading}
              >
                Next
              </button>
            </div>
          </div>

          <div className="mt-3 flex items-center gap-2">
            <input
              className="w-full md:w-[520px] px-3 py-2 rounded-lg border border-slate-200"
              value={progressFilter}
              onChange={(e) => setProgressFilter(e.target.value)}
              placeholder="Filter by client name..."
            />
            <button
              className="px-3 py-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-50"
              onClick={() => loadProgress(0)}
              disabled={progressLoading}
            >
              Apply
            </button>
          </div>

          {progressVisible ? (
            <div className="mt-3 overflow-auto border border-slate-500 bg-white max-h-[420px]">
              <table className="min-w-[1500px] w-full border-collapse" style={{ tableLayout: "fixed" }}>
                <thead>
                  <tr>
                    {progressCols.map((c) => (
                      <HeaderCell
                        key={c.key}
                        label={c.label}
                        sortKey={c.key}
                        sort={progressSort}
                        onSort={onProgressSort}
                        width={progressWidths[c.key]}
                        stickyLeft={c.sticky}
                        stickyTop
                        zIndex={c.sticky ? 35 : 15}
                        startResize={startResizeProgress}
                        resizeKey={c.key}
                      />
                    ))}
                  </tr>
                </thead>

                <tbody>
                  {progressRows.map((r, idx) => (
                    <tr key={`${r.client_name}-${idx}`}>
                      <Cell width={progressWidths["client_name"]} stickyLeft className="font-semibold">
                        {r.client_name}
                      </Cell>
                      <Cell width={progressWidths["first_name"]}>{safeText(r.first_name)}</Cell>
                      <Cell width={progressWidths["last_name"]}>{safeText(r.last_name)}</Cell>
                      <Cell width={progressWidths["phone"]}>{safeText(r.phone)}</Cell>
                      <Cell width={progressWidths["email"]}>{safeText(r.email)}</Cell>

                      <Cell width={progressWidths["last_call_date"]}>{formatDisplayDate(r.last_call_date)}</Cell>
                      <Cell width={progressWidths["call_attempts"]}>
                        {/* Don’t show zero */}
                        {r.call_attempts && r.call_attempts !== 0 ? r.call_attempts : ""}
                      </Cell>

                      <Cell width={progressWidths["last_bop_date"]}>{formatDisplayDate(r.last_bop_date)}</Cell>
                      <Cell width={progressWidths["bop_attempts"]}>
                        {r.bop_attempts && r.bop_attempts !== 0 ? r.bop_attempts : ""}
                      </Cell>

                      <Cell width={progressWidths["last_followup_date"]}>{formatDisplayDate(r.last_followup_date)}</Cell>
                      <Cell width={progressWidths["followup_attempts"]}>
                        {r.followup_attempts && r.followup_attempts !== 0 ? r.followup_attempts : ""}
                      </Cell>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </section>
      </div>
    </div>
  );
}
