"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import * as XLSX from "xlsx";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  BarChart,
  Bar,
  Legend,
  CartesianGrid,
  LabelList,
} from "recharts";

/* =========================
   Supabase
========================= */
let _supabase: SupabaseClient | null = null;

function getSupabase() {
  if (_supabase) return _supabase;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    // Avoid crashing build; show runtime error in UI.
    // eslint-disable-next-line no-console
    console.error("Missing NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY");
  }

  _supabase = createClient(url || "", key || "");
  return _supabase;
}

/* =========================
   UI Helpers
========================= */
function cx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

function Card(props: { title: string; right?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
        <div className="text-lg font-semibold text-slate-800">{props.title}</div>
        {props.right}
      </div>
      <div className="p-5">{props.children}</div>
    </div>
  );
}

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary";
};

function Button({ variant = "primary", className, ...props }: ButtonProps) {
  const base =
    "inline-flex items-center justify-center rounded-xl px-4 py-2 text-sm font-medium transition border";
  const styles =
    variant === "primary"
      ? "bg-emerald-600 text-white border-emerald-600 hover:bg-emerald-700"
      : "bg-white text-slate-700 border-slate-300 hover:bg-slate-50";
  return <button {...props} className={cx(base, styles, className)} />;
}

function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={cx(
        "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-200",
        props.className
      )}
    />
  );
}

/* =========================
   Date helpers (datetime-local)
========================= */
function toDateTimeLocalValue(raw: any): string {
  if (!raw) return "";
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(
    d.getMinutes()
  )}`;
}

function fromDateTimeLocalValue(localVal: string): string | null {
  if (!localVal) return null;
  const d = new Date(localVal); // interpreted as LOCAL time
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString(); // store as ISO UTC
}

function fmtDisplay(raw: any): string {
  if (!raw) return "";
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return String(raw);
  return d.toLocaleString();
}

/* =========================
   Resizable Columns Hook
========================= */
type ColWidthMap = Record<string, number>;

function useResizableColumns(storageKey: string, colIds: string[], defaults: ColWidthMap) {
  const [widths, setWidths] = useState<ColWidthMap>({});
  const dragRef = useRef<{ id: string; startX: number; startW: number } | null>(null);

  // Load
  useEffect(() => {
    try {
      const saved = typeof window !== "undefined" ? window.localStorage.getItem(storageKey) : null;
      if (saved) {
        const parsed = JSON.parse(saved) as ColWidthMap;
        setWidths(parsed || {});
      }
    } catch {
      // ignore
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageKey]);

  // Save
  useEffect(() => {
    try {
      if (typeof window !== "undefined") {
        window.localStorage.setItem(storageKey, JSON.stringify(widths));
      }
    } catch {
      // ignore
    }
  }, [storageKey, widths]);

  const onMouseMove = useCallback((e: MouseEvent) => {
    const drag = dragRef.current;
    if (!drag) return;
    const dx = e.clientX - drag.startX;
    const next = Math.max(80, drag.startW + dx);
    setWidths((prev) => ({ ...prev, [drag.id]: next }));
  }, []);

  const onMouseUp = useCallback(() => {
    dragRef.current = null;
    window.removeEventListener("mousemove", onMouseMove);
    window.removeEventListener("mouseup", onMouseUp);
  }, [onMouseMove]);

  const startResize = useCallback(
    (id: string) => (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const current = widths[id] ?? defaults[id] ?? 160;
      dragRef.current = { id, startX: e.clientX, startW: current };
      window.addEventListener("mousemove", onMouseMove);
      window.addEventListener("mouseup", onMouseUp);
    },
    [defaults, onMouseMove, onMouseUp, widths]
  );

  // ensure we have defaults for all columns
  const effectiveWidths = useMemo(() => {
    const out: ColWidthMap = {};
    for (const id of colIds) out[id] = widths[id] ?? defaults[id] ?? 160;
    return out;
  }, [colIds, defaults, widths]);

  return { widths: effectiveWidths, startResize };
}

/* =========================
   Types
========================= */
type SortDir = "asc" | "desc";
type SortState = { key: string; dir: SortDir };

type AnyRow = Record<string, any> & { id?: string | number };

type ProgressRow = {
  clientid: string | number;
  client_name: string;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  email: string | null;
  last_call_date: any;
  call_attempts: number | null;
  last_bop_date: any;
  bop_attempts: number | null;
  last_followup_date: any;
  followup_attempts: number | null;
};

/* =========================
   Main Page
========================= */
const PAGE_SIZE = 20;

export default function DashboardPage() {
  const [error, setError] = useState<string | null>(null);

  // logout
  const logout = useCallback(async () => {
    try {
      const supabase = getSupabase();
      await supabase.auth.signOut(); // <-- fixes your "await supabase.auth" semicolon error
      window.location.href = "/";
    } catch (e: any) {
      setError(e?.message || "Logout failed");
    }
  }, []);

  /* ===== All Records ===== */
  const [records, setRecords] = useState<AnyRow[]>([]);
  const [total, setTotal] = useState<number>(0);
  const [page, setPage] = useState<number>(0);
  const [pageJump, setPageJump] = useState<string>("1");
  const [loading, setLoading] = useState<boolean>(false);

  const [q, setQ] = useState<string>("");

  const [sortAll, setSortAll] = useState<SortState>({ key: "first_name", dir: "asc" });

  // Drafts keep user-entered values visible even if a save fails (prevents “date disappears” UX).
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [savingCell, setSavingCell] = useState<string | null>(null);

  const totalPages = Math.max(1, Math.ceil((total || 0) / PAGE_SIZE));
  const canPrev = page > 0;
  const canNext = page + 1 < totalPages;

  const applyAllSort = useCallback(
    (query: any, sort: SortState) => {
      if (sort.key === "client_name") {
        // sort by first_name + last_name
        return query.order("first_name", { ascending: sort.dir === "asc" }).order("last_name", {
          ascending: sort.dir === "asc",
        });
      }
      return query.order(sort.key, { ascending: sort.dir === "asc", nullsFirst: false });
    },
    []
  );

  // SERVER-side sort + pagination (this is what you need so sorting applies to the entire dataset)
  const loadPage = useCallback(
    async (nextPage: number, nextSort?: SortState) => {
      setError(null);
      setLoading(true);
      try {
        const supabase = getSupabase();

        const search = q.trim();

        // count query
        let countQuery = supabase.from("client_registrations").select("id", { count: "exact", head: true });
        if (search) {
          // ilike is case-insensitive
          countQuery = countQuery.or(
            `first_name.ilike.%${search}%,last_name.ilike.%${search}%,phone.ilike.%${search}%,email.ilike.%${search}%`
          );
        }
        const { count, error: cErr } = await countQuery;
        if (cErr) throw cErr;
        setTotal(count ?? 0);

        const from = nextPage * PAGE_SIZE;
        const to = from + PAGE_SIZE - 1;

        let dataQuery = supabase.from("client_registrations").select("*").range(from, to);

        if (search) {
          dataQuery = dataQuery.or(
            `first_name.ilike.%${search}%,last_name.ilike.%${search}%,phone.ilike.%${search}%,email.ilike.%${search}%`
          );
        }

        const effectiveSort = nextSort ?? sortAll;
        dataQuery = applyAllSort(dataQuery, effectiveSort);

        const { data, error } = await dataQuery;
        if (error) throw error;

        setRecords((data || []) as AnyRow[]);
        setPage(nextPage);
        setPageJump(String(nextPage + 1));
      } catch (e: any) {
        setError(e?.message || "Failed to load records");
      } finally {
        setLoading(false);
      }
    },
    [applyAllSort, q, sortAll]
  );

  // Initial + whenever search/sort changes (reset to page 1)
  useEffect(() => {
    loadPage(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, sortAll.key, sortAll.dir]);

  const onSortAllClick = useCallback(
    (key: string) => {
      setSortAll((prev) => {
        const dir: SortDir = prev.key === key ? (prev.dir === "asc" ? "desc" : "asc") : "asc";
        return { key, dir };
      });
      // loadPage(0) will run from effect
    },
    []
  );

  const buildClientName = useCallback((r: AnyRow) => {
    const fn = String(r.first_name || "").trim();
    const ln = String(r.last_name || "").trim();
    const full = `${fn} ${ln}`.trim();
    return full || String(r.client_name || r.clientid || "");
  }, []);

  const setDraft = useCallback((id: string | number, field: string, val: string) => {
    const k = `${id}:${field}`;
    setDrafts((prev) => ({ ...prev, [k]: val }));
  }, []);

  const clearDraft = useCallback((id: string | number, field: string) => {
    const k = `${id}:${field}`;
    setDrafts((prev) => {
      const next = { ...prev };
      delete next[k];
      return next;
    });
  }, []);

  const updateRowLocal = useCallback((id: string | number, patch: Record<string, any>) => {
    setRecords((prev) => prev.map((r) => (String(r.id) === String(id) ? { ...r, ...patch } : r)));
  }, []);

  const saveField = useCallback(
    async (id: string | number, field: string, value: any) => {
      const cellKey = `${id}:${field}`;
      setSavingCell(cellKey);
      setError(null);
      try {
        const supabase = getSupabase();
        const payload: any = { [field]: value };

        const { error } = await supabase.from("client_registrations").update(payload).eq("id", id);
        if (error) throw error;

        updateRowLocal(id, payload);
        clearDraft(id, field);
      } catch (e: any) {
        // Keep the draft visible so user doesn't lose the selected date.
        const msg = e?.message || "Save failed";

        // Friendly hint for your exact issue:
        if (String(e?.code) === "42501" || msg.toLowerCase().includes("row-level security")) {
          setError(
            `${msg}. This is a database Row Level Security (RLS) block (often from a trigger inserting into client_call_track). Fix the RLS policy in Supabase to allow the write.`
          );
        } else {
          setError(msg);
        }
      } finally {
        setSavingCell(null);
      }
    },
    [clearDraft, updateRowLocal]
  );

  // Date commit handler (blur / enter)
  const commitDate = useCallback(
    async (rowId: string | number, field: "CalledOn" | "BOP_Date" | "Followup_Date") => {
      const k = `${rowId}:${field}`;
      const localVal = drafts[k];
      if (localVal === undefined) return; // nothing to save
      const iso = fromDateTimeLocalValue(localVal);
      await saveField(rowId, field, iso);
    },
    [drafts, saveField]
  );

  /* ===== Upcoming Range + Table ===== */
  const [rangeStart, setRangeStart] = useState<string>(() => {
    const d = new Date();
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  });
  const [rangeEnd, setRangeEnd] = useState<string>(() => {
    const d = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  });
  const [upcoming, setUpcoming] = useState<AnyRow[]>([]);
  const [upcomingLoading, setUpcomingLoading] = useState<boolean>(false);
  const [upcomingVisible, setUpcomingVisible] = useState<boolean>(false);
  const [sortUpcoming, setSortUpcoming] = useState<SortState>({ key: "BOP_Date", dir: "asc" });

  const fetchUpcoming = useCallback(async () => {
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

      query =
        sortUpcoming.key === "client_name"
          ? query.order("first_name", { ascending: sortUpcoming.dir === "asc" }).order("last_name", {
              ascending: sortUpcoming.dir === "asc",
            })
          : query.order(sortUpcoming.key, { ascending: sortUpcoming.dir === "asc" });

      const { data, error } = await query;
      if (error) throw error;

      setUpcoming((data || []) as AnyRow[]);
      setUpcomingVisible(false); // user asked: keep hidden before pressing Load
    } catch (e: any) {
      setError(e?.message || "Failed to load upcoming meetings");
    } finally {
      setUpcomingLoading(false);
    }
  }, [rangeEnd, rangeStart, sortUpcoming]);

  const exportUpcomingXlsx = useCallback(() => {
    const ws = XLSX.utils.json_to_sheet(upcoming);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Upcoming_BOP");
    XLSX.writeFile(wb, `Upcoming_BOP_${rangeStart}_to_${rangeEnd}.xlsx`);
  }, [rangeEnd, rangeStart, upcoming]);

  /* ===== Progress Summary ===== */
  const [progressRows, setProgressRows] = useState<ProgressRow[]>([]);
  const [progressLoading, setProgressLoading] = useState<boolean>(false);
  const [progressVisible, setProgressVisible] = useState<boolean>(true);
  const [progressPage, setProgressPage] = useState<number>(0);
  const [progressFilter, setProgressFilter] = useState<string>("");
  const [progressSort, setProgressSort] = useState<SortState>({ key: "client_name", dir: "asc" });

  const fetchProgressSummary = useCallback(async () => {
    setProgressLoading(true);
    setError(null);
    try {
      const supabase = getSupabase();
      const { data, error } = await supabase
        .from("v_client_progress_summary")
        .select(
          "clientid, first_name, last_name, phone, email, last_call_date, call_attempts, last_bop_date, bop_attempts, last_followup_date, followup_attempts"
        )
        .limit(10000);

      if (error) throw error;

      const rows: ProgressRow[] = (data || []).map((r: any) => ({
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
  }, []);

  useEffect(() => {
    fetchProgressSummary();
  }, [fetchProgressSummary]);

  const onSortProgressClick = useCallback((key: string) => {
    setProgressSort((prev) => {
      const dir: SortDir = prev.key === key ? (prev.dir === "asc" ? "desc" : "asc") : "asc";
      return { key, dir };
    });
    setProgressPage(0);
  }, []);

  const progressFilteredSorted = useMemo(() => {
    const f = progressFilter.trim().toLowerCase();
    let arr = progressRows;
    if (f) {
      arr = arr.filter((r) => (r.client_name || "").toLowerCase().includes(f));
    }

    const dirMul = progressSort.dir === "asc" ? 1 : -1;
    const key = progressSort.key;

    const getVal = (r: ProgressRow) => {
      switch (key) {
        case "client_name":
          return r.client_name || "";
        case "last_call_date":
          return r.last_call_date ? new Date(r.last_call_date).getTime() : 0;
        case "call_attempts":
          return r.call_attempts ?? 0;
        case "last_bop_date":
          return r.last_bop_date ? new Date(r.last_bop_date).getTime() : 0;
        case "bop_attempts":
          return r.bop_attempts ?? 0;
        case "last_followup_date":
          return r.last_followup_date ? new Date(r.last_followup_date).getTime() : 0;
        case "followup_attempts":
          return r.followup_attempts ?? 0;
        default:
          return (r as any)[key] ?? "";
      }
    };

    return [...arr].sort((a, b) => {
      const av = getVal(a);
      const bv = getVal(b);
      if (typeof av === "number" && typeof bv === "number") return (av - bv) * dirMul;
      return String(av).localeCompare(String(bv)) * dirMul;
    });
  }, [progressFilter, progressRows, progressSort]);

  const progressTotalPages = Math.max(1, Math.ceil(progressFilteredSorted.length / PAGE_SIZE));
  const progressSlice = useMemo(() => {
    const from = progressPage * PAGE_SIZE;
    const to = from + PAGE_SIZE;
    return progressFilteredSorted.slice(from, to);
  }, [progressFilteredSorted, progressPage]);

  /* ===== Trends ===== */
  const [trendLoading, setTrendLoading] = useState(false);
  const [weekly, setWeekly] = useState<Array<any>>([]);
  const [monthly, setMonthly] = useState<Array<any>>([]);

  const fetchTrends = useCallback(async () => {
    setTrendLoading(true);
    setError(null);
    try {
      const supabase = getSupabase();
      const now = new Date();
      const yearStart = new Date(now.getFullYear(), 0, 1).toISOString();

      // Current year
      const { data, error } = await supabase
        .from("client_registrations")
        .select("created_at,BOP_Date")
        .gte("created_at", yearStart)
        .limit(10000);

      if (error) throw error;

      const rows = (data || []) as AnyRow[];

      // weekly last 5 weeks (by created_at)
      const weeks: any[] = [];
      const start = new Date();
      start.setDate(start.getDate() - 35);
      start.setHours(0, 0, 0, 0);

      for (let i = 0; i < 5; i++) {
        const ws = new Date(start.getTime() + i * 7 * 24 * 60 * 60 * 1000);
        const we = new Date(ws.getTime() + 7 * 24 * 60 * 60 * 1000);
        const label = we.toISOString().slice(0, 10);

        let prospects = 0;
        let bops = 0;

        for (const r of rows) {
          const created = r.created_at ? new Date(r.created_at) : null;
          if (created && created >= ws && created < we) prospects++;

          const bop = r.BOP_Date ? new Date(r.BOP_Date) : null;
          if (bop && bop >= ws && bop < we) bops++;
        }

        weeks.push({ weekEnd: label, prospects, bops });
      }

      // monthly current year
      const monthMap = new Map<string, { prospects: number; bops: number }>();
      for (let m = 0; m < 12; m++) {
        const key = `${now.getFullYear()}-${String(m + 1).padStart(2, "0")}`;
        monthMap.set(key, { prospects: 0, bops: 0 });
      }
      for (const r of rows) {
        const created = r.created_at ? new Date(r.created_at) : null;
        if (created && created.getFullYear() === now.getFullYear()) {
          const k = `${created.getFullYear()}-${String(created.getMonth() + 1).padStart(2, "0")}`;
          const cur = monthMap.get(k);
          if (cur) cur.prospects++;
        }
        const bop = r.BOP_Date ? new Date(r.BOP_Date) : null;
        if (bop && bop.getFullYear() === now.getFullYear()) {
          const k = `${bop.getFullYear()}-${String(bop.getMonth() + 1).padStart(2, "0")}`;
          const cur = monthMap.get(k);
          if (cur) cur.bops++;
        }
      }

      setWeekly(weeks);
      setMonthly(
        Array.from(monthMap.entries()).map(([month, v]) => ({
          month,
          prospects: v.prospects,
          bops: v.bops,
        }))
      );
    } catch (e: any) {
      setError(e?.message || "Failed to load trends");
    } finally {
      setTrendLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTrends();
  }, [fetchTrends]);

  /* =========================
     Table Column Definitions
  ========================= */
  const allColumns = useMemo(() => {
    // Keep this list focused on what you’re editing most.
    // You can add more DB columns here safely.
    return [
      { id: "client_name", label: "Client Name", sortKey: "client_name", stickyLeft: true, width: 220 },
      { id: "ReferredBy", label: "Referred By", sortKey: "ReferredBy", width: 160 },
      { id: "CalledOn", label: "Called On", sortKey: "CalledOn", width: 210 },
      { id: "BOP_Date", label: "BOP Date", sortKey: "BOP_Date", width: 210 },
      { id: "BOP_Status", label: "BOP Status", sortKey: "BOP_Status", width: 160 },
      { id: "Followup_Date", label: "Follow-Up Date", sortKey: "Followup_Date", width: 210 },
      { id: "Followup_Status", label: "Follow-Up Status", sortKey: "Followup_Status", width: 170 },
      { id: "Product", label: "Product", sortKey: "Product", width: 140 },
      { id: "Issued", label: "Issued", sortKey: "Issued", width: 210 },
      { id: "Comment", label: "Comment", sortKey: "Comment", width: 220 },
      { id: "Remark", label: "Remark", sortKey: "Remark", width: 220 },
    ] as const;
  }, []);

  const allColIds = useMemo(() => allColumns.map((c) => c.id), [allColumns]);
  const allColDefaults = useMemo(() => {
    const m: ColWidthMap = {};
    for (const c of allColumns) m[c.id] = c.width ?? 160;
    return m;
  }, [allColumns]);
  const allResize = useResizableColumns("cols:allRecords", allColIds, allColDefaults);

  const upcomingColIds = allColIds;
  const upcomingResize = useResizableColumns("cols:upcoming", upcomingColIds, allColDefaults);

  const progressColumns = useMemo(() => {
    return [
      { id: "client_name", label: "Client Name", sortKey: "client_name", stickyLeft: true, width: 220 },
      { id: "first_name", label: "First Name", sortKey: "first_name", width: 140 },
      { id: "last_name", label: "Last Name", sortKey: "last_name", width: 140 },
      { id: "phone", label: "Phone", sortKey: "phone", width: 160 },
      { id: "email", label: "Email", sortKey: "email", width: 260 },
      { id: "last_call_date", label: "Last Call On", sortKey: "last_call_date", width: 190 },
      { id: "call_attempts", label: "No of Calls", sortKey: "call_attempts", width: 140 },
      { id: "last_bop_date", label: "Last BOP Call On", sortKey: "last_bop_date", width: 210 },
      { id: "bop_attempts", label: "No of BOP Calls", sortKey: "bop_attempts", width: 160 },
      { id: "last_followup_date", label: "Last FollowUp On", sortKey: "last_followup_date", width: 210 },
      { id: "followup_attempts", label: "No of FollowUp Calls", sortKey: "followup_attempts", width: 180 },
    ] as const;
  }, []);
  const progressColIds = useMemo(() => progressColumns.map((c) => c.id), [progressColumns]);
  const progressDefaults = useMemo(() => {
    const m: ColWidthMap = {};
    for (const c of progressColumns) m[c.id] = c.width ?? 160;
    return m;
  }, [progressColumns]);
  const progressResize = useResizableColumns("cols:progress", progressColIds, progressDefaults);

  /* =========================
     Generic Table Renderer
  ========================= */
  function ResizableTable<T extends AnyRow>(props: {
    rows: T[];
    columns: Array<{
      id: string;
      label: string;
      sortKey?: string;
      stickyLeft?: boolean;
    }>;
    widths: ColWidthMap;
    startResize: (id: string) => (e: React.MouseEvent) => void;
    sort?: SortState;
    onSort?: (sortKey: string) => void;
    renderCell: (row: T, colId: string) => React.ReactNode;
    maxHeightClass?: string;
  }) {
    const maxHeightClass = props.maxHeightClass ?? "max-h-[520px]";

    return (
      <div className={cx("overflow-auto border border-slate-400 bg-white", maxHeightClass)}>
        <table className="min-w-max w-full border-collapse">
          <thead>
            <tr>
              {props.columns.map((c, idx) => {
                const isStickyLeft = !!c.stickyLeft;
                const isStickyTop = true;
                const isCorner = isStickyLeft && isStickyTop;
                const z = isCorner ? "z-[80]" : isStickyTop ? "z-[60]" : isStickyLeft ? "z-[50]" : "z-[10]";

                const sortable = !!c.sortKey && !!props.onSort;
                const active = props.sort && c.sortKey && props.sort.key === c.sortKey;

                return (
                  <th
                    key={c.id}
                    style={{ width: props.widths[c.id], minWidth: 80 }}
                    className={cx(
                      "border border-slate-500 bg-slate-100 text-left text-xs font-semibold text-slate-700",
                      "px-2 py-2",
                      isStickyTop && "sticky top-0",
                      isStickyLeft && "sticky left-0",
                      z,
                      sortable && "cursor-pointer select-none"
                    )}
                    onClick={() => {
                      if (sortable && c.sortKey) props.onSort?.(c.sortKey);
                    }}
                  >
                    <div className="flex items-center gap-1 pr-3">
                      <span>{c.label}</span>
                      {active && <span className="text-slate-500">{props.sort?.dir === "asc" ? "↑" : "↓"}</span>}
                    </div>

                    {/* Resizer handle (thin) */}
                    <div
                      onMouseDown={props.startResize(c.id)}
                      className="absolute right-0 top-0 h-full w-[6px] cursor-col-resize"
                      style={{ transform: "translateX(50%)" }}
                      title="Drag to resize"
                    />
                  </th>
                );
              })}
            </tr>
          </thead>

          <tbody>
            {props.rows.length === 0 ? (
              <tr>
                <td colSpan={props.columns.length} className="border border-slate-300 p-4 text-sm text-slate-500">
                  No records.
                </td>
              </tr>
            ) : (
              props.rows.map((r, i) => (
                <tr key={String(r.id ?? i)} className={i % 2 === 0 ? "bg-white" : "bg-slate-50"}>
                  {props.columns.map((c) => {
                    const isStickyLeft = !!c.stickyLeft;
                    return (
                      <td
                        key={c.id}
                        style={{ width: props.widths[c.id], minWidth: 80 }}
                        className={cx(
                          "border border-slate-300 px-2 py-2 text-sm text-slate-800 align-top",
                          isStickyLeft && "sticky left-0 z-[40] bg-inherit"
                        )}
                      >
                        {props.renderCell(r, c.id)}
                      </td>
                    );
                  })}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    );
  }

  /* =========================
     Render cells (All Records)
  ========================= */
  const renderAllCell = useCallback(
    (r: AnyRow, colId: string) => {
      const id = r.id as string | number;

      if (colId === "client_name") {
        return <span className="font-semibold">{buildClientName(r)}</span>;
      }

      // date editable columns
      if (colId === "CalledOn" || colId === "BOP_Date" || colId === "Followup_Date") {
        const k = `${id}:${colId}`;
        const value = drafts[k] ?? toDateTimeLocalValue(r[colId]);
        const saving = savingCell === k;

        return (
          <div className="flex items-center gap-2">
            <input
              type="datetime-local"
              className="w-full rounded-md border border-slate-300 px-2 py-1 text-sm"
              value={value}
              onChange={(e) => setDraft(id, colId, e.target.value)}
              onBlur={() => commitDate(id, colId as any)}
              onKeyDown={(e) => {
                if (e.key === "Enter") commitDate(id, colId as any);
              }}
              disabled={saving}
            />
            {saving && <span className="text-xs text-slate-500">…</span>}
          </div>
        );
      }

      // Issued could be datetime as well (keep consistent)
      if (colId === "Issued") {
        const k = `${id}:${colId}`;
        const value = drafts[k] ?? toDateTimeLocalValue(r[colId]);
        const saving = savingCell === k;

        return (
          <div className="flex items-center gap-2">
            <input
              type="datetime-local"
              className="w-full rounded-md border border-slate-300 px-2 py-1 text-sm"
              value={value}
              onChange={(e) => setDraft(id, colId, e.target.value)}
              onBlur={() => {
                const iso = fromDateTimeLocalValue(drafts[k] ?? "");
                saveField(id, colId, iso);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  const iso = fromDateTimeLocalValue(drafts[k] ?? "");
                  saveField(id, colId, iso);
                }
              }}
              disabled={saving}
            />
            {saving && <span className="text-xs text-slate-500">…</span>}
          </div>
        );
      }

      // default editable text
      const k = `${id}:${colId}`;
      const value = drafts[k] ?? (r[colId] ?? "");
      const saving = savingCell === k;

      return (
        <input
          className="w-full rounded-md border border-slate-300 px-2 py-1 text-sm"
          value={value}
          onChange={(e) => setDraft(id, colId, e.target.value)}
          onBlur={() => {
            const v = drafts[k];
            if (v === undefined) return;
            saveField(id, colId, v.trim() ? v : null);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              const v = drafts[k];
              if (v === undefined) return;
              saveField(id, colId, v.trim() ? v : null);
            }
          }}
          disabled={saving}
        />
      );
    },
    [buildClientName, commitDate, drafts, saveField, savingCell, setDraft]
  );

  /* =========================
     Render cells (Upcoming)
  ========================= */
  const renderUpcomingCell = useCallback(
    (r: AnyRow, colId: string) => {
      // reuse same editor rules
      return renderAllCell(r, colId);
    },
    [renderAllCell]
  );

  /* =========================
     Render cells (Progress Summary)
     - Hide zeros in attempts columns
  ========================= */
  const renderProgressCell = useCallback((r: ProgressRow, colId: string) => {
    if (colId === "client_name") return <span className="font-semibold">{r.client_name}</span>;
    if (colId === "last_call_date") return <span>{fmtDisplay(r.last_call_date)}</span>;
    if (colId === "last_bop_date") return <span>{fmtDisplay(r.last_bop_date)}</span>;
    if (colId === "last_followup_date") return <span>{fmtDisplay(r.last_followup_date)}</span>;

    if (colId === "call_attempts" || colId === "bop_attempts" || colId === "followup_attempts") {
      const n = (r as any)[colId] ?? 0;
      return <span>{n && n !== 0 ? String(n) : ""}</span>; // hide zero
    }

    return <span>{String((r as any)[colId] ?? "")}</span>;
  }, []);

  /* =========================
     Sort handlers for upcoming
  ========================= */
  const onSortUpcomingClick = useCallback((key: string) => {
    setSortUpcoming((prev) => {
      const dir: SortDir = prev.key === key ? (prev.dir === "asc" ? "desc" : "asc") : "asc";
      return { key, dir };
    });
  }, []);

  /* =========================
     Graph data colors
  ========================= */
  const trendColors = {
    prospectsLine: "#2563eb", // blue
    bopsLine: "#f59e0b", // amber
    prospectsBar: "#22c55e", // green
    bopsBar: "#a855f7", // purple
  };

  /* =========================
     Page
  ========================= */
  return (
    <div className="min-h-screen bg-slate-50">
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
        <Card
          title="Trends"
          right={
            <Button variant="secondary" onClick={fetchTrends} disabled={trendLoading}>
              {trendLoading ? "Loading…" : "Refresh"}
            </Button>
          }
        >
          <div className="grid lg:grid-cols-2 gap-6">
            <div>
              <div className="text-xs font-semibold text-slate-600 mb-2">Weekly (Last 5 Weeks)</div>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={weekly}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="weekEnd" tick={{ fontSize: 11 }} />
                    <YAxis allowDecimals={false} />
                    <Tooltip />
                    <Legend />
                    <Line type="monotone" dataKey="prospects" stroke={trendColors.prospectsLine} dot>
                      <LabelList dataKey="prospects" position="top" />
                    </Line>
                    <Line type="monotone" dataKey="bops" stroke={trendColors.bopsLine} dot>
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
                  <BarChart data={monthly}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                    <YAxis allowDecimals={false} />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="prospects" fill={trendColors.prospectsBar}>
                      <LabelList dataKey="prospects" position="top" />
                    </Bar>
                    <Bar dataKey="bops" fill={trendColors.bopsBar}>
                      <LabelList dataKey="bops" position="top" />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </Card>

        {/* Upcoming Range */}
        <Card
          title="Upcoming BOP Date Range"
          right={
            <div className="flex gap-2">
              <Button onClick={fetchUpcoming} disabled={upcomingLoading}>
                {upcomingLoading ? "Loading…" : "Load"}
              </Button>
              <Button variant="secondary" onClick={exportUpcomingXlsx} disabled={upcoming.length === 0}>
                Export XLSX
              </Button>
            </div>
          }
        >
          <div className="grid md:grid-cols-2 gap-4">
            <label className="block">
              <div className="text-xs font-semibold text-slate-600 mb-1">Start</div>
              <Input type="date" value={rangeStart} onChange={(e) => setRangeStart(e.target.value)} />
            </label>
            <label className="block">
              <div className="text-xs font-semibold text-slate-600 mb-1">End</div>
              <Input type="date" value={rangeEnd} onChange={(e) => setRangeEnd(e.target.value)} />
            </label>
          </div>

          <div className="mt-4 flex items-center gap-3">
            <Button
              variant="secondary"
              onClick={() => setUpcomingVisible((v) => !v)}
              disabled={upcoming.length === 0}
            >
              {upcomingVisible ? "Hide Upcoming Table" : "Show Upcoming Table"}
            </Button>
            <div className="text-xs text-slate-500">After you press Load, you can show/hide the Upcoming table.</div>
          </div>
        </Card>

        {/* Upcoming Table */}
        {upcomingVisible && upcoming.length > 0 && (
          <Card
            title="Upcoming BOP Meetings (Editable)"
            right={<div className="text-xs text-slate-600">Click headers to sort. Drag header edge to resize.</div>}
          >
            <ResizableTable
              rows={upcoming}
              columns={allColumns as any}
              widths={upcomingResize.widths}
              startResize={upcomingResize.startResize}
              sort={sortUpcoming.key === "client_name" ? { key: "client_name", dir: sortUpcoming.dir } : sortUpcoming}
              onSort={(k) => onSortUpcomingClick(k)}
              renderCell={renderUpcomingCell}
              maxHeightClass="max-h-[520px]"
            />
          </Card>
        )}

        {/* Progress Summary */}
        <Card
          title="Client Progress Summary"
          right={
            <div className="flex items-center gap-2">
              <Button variant="secondary" onClick={fetchProgressSummary} disabled={progressLoading}>
                {progressLoading ? "Loading…" : "Refresh"}
              </Button>
              <Button variant="secondary" onClick={() => setProgressVisible((v) => !v)}>
                {progressVisible ? "Hide Table" : "Show Table"}
              </Button>
              <div className="flex gap-2 ml-4">
                <Button
                  variant="secondary"
                  disabled={progressPage <= 0}
                  onClick={() => setProgressPage((p) => Math.max(0, p - 1))}
                >
                  Previous
                </Button>
                <Button
                  variant="secondary"
                  disabled={progressPage + 1 >= progressTotalPages}
                  onClick={() => setProgressPage((p) => Math.min(progressTotalPages - 1, p + 1))}
                >
                  Next
                </Button>
              </div>
            </div>
          }
        >
          <div className="flex items-center gap-3 mb-3">
            <div className="w-[420px] max-w-full">
              <Input
                placeholder="Filter by client name..."
                value={progressFilter}
                onChange={(e) => setProgressFilter(e.target.value)}
              />
            </div>
            <div className="text-xs text-slate-600">Click headers to sort. Drag header edge to resize.</div>
          </div>

          {progressVisible && (
            <ResizableTable
              rows={progressSlice as any}
              columns={progressColumns as any}
              widths={progressResize.widths}
              startResize={progressResize.startResize}
              sort={progressSort}
              onSort={(k) => onSortProgressClick(k)}
              renderCell={renderProgressCell as any}
              maxHeightClass="max-h-[520px]"
            />
          )}
        </Card>

        {/* All Records */}
        <Card
          title="All Records (Editable)"
          right={
            <div className="flex items-center gap-2">
              <div className="w-[340px]">
                <Input placeholder="Search (name/phone/email)..." value={q} onChange={(e) => setQ(e.target.value)} />
              </div>
              <Button variant="secondary" onClick={() => loadPage(0)} disabled={loading}>
                {loading ? "Loading…" : "Refresh"}
              </Button>
              <div className="flex items-center gap-2 ml-4">
                <Button variant="secondary" disabled={!canPrev} onClick={() => loadPage(page - 1)}>
                  Previous
                </Button>
                <Button variant="secondary" disabled={!canNext} onClick={() => loadPage(page + 1)}>
                  Next
                </Button>
              </div>
              <div className="flex items-center gap-2 ml-2">
                <span className="text-xs text-slate-600">Go to page</span>
                <Input
                  className="w-[80px]"
                  value={pageJump}
                  onChange={(e) => setPageJump(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      const n = Math.max(1, Math.min(totalPages, Number(pageJump || "1")));
                      loadPage(n - 1);
                    }
                  }}
                />
                <Button
                  variant="secondary"
                  onClick={() => {
                    const n = Math.max(1, Math.min(totalPages, Number(pageJump || "1")));
                    loadPage(n - 1);
                  }}
                >
                  Go
                </Button>
              </div>
            </div>
          }
        >
          <div className="text-xs text-slate-600 mb-2">
            Sorting is <b>server-side</b>, so it sorts the <b>entire dataset</b> and then paginates.
          </div>

          <ResizableTable
            rows={records}
            columns={allColumns as any}
            widths={allResize.widths}
            startResize={allResize.startResize}
            sort={sortAll.key === "client_name" ? { key: "client_name", dir: sortAll.dir } : sortAll}
            onSort={(k) => onSortAllClick(k)}
            renderCell={renderAllCell}
            maxHeightClass="max-h-[640px]"
          />

          <div className="mt-2 text-xs text-slate-600">
            Page {page + 1} of {totalPages} (showing {PAGE_SIZE} per page)
          </div>
        </Card>
      </div>
    </div>
  );
}
