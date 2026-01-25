"use client";

import React, { useEffect, useMemo, useRef, useState } from 'react';
import * as XLSX from 'xlsx';
import { addDays, addMonths, format, isValid, parseISO, startOfMonth, subMonths, subDays, endOfMonth } from 'date-fns';
import { ResponsiveContainer, XAxis, YAxis, Tooltip, BarChart, Bar, LabelList } from 'recharts';
import { getSupabase } from '@/lib/supabaseClient';
import { Button, Card } from '@/components/ui';
import { useRequireCanfsAuth, clearCanfsAuthCookie } from '@/lib/useRequireCanfsAuth';

export const dynamic = 'force-dynamic';

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
type ProgressSortKey = 
  | "client_name" 
  | "last_call_date" 
  | "call_attempts" 
  | "last_bop_date" 
  | "bop_attempts" 
  | "last_followup_date" 
  | "followup_attempts"; 
const ALL_PAGE_SIZE = 10; 
const PROGRESS_PAGE_SIZE = 10; 
const READONLY_LIST_COLS = new Set([ 
  "interest_type", 
  "business_opportunities", 
  "wealth_solutions", 
  "preferred_days", 
]); 
// Date & datetime keys (UI mapping only) 
const DATE_TIME_KEYS = new Set([ 
  "BOP_Date", 
  "CalledOn", 
  "Followup_Date", 
  "FollowUp_Date", 
  "Issued", 
]); 
const DATE_ONLY_KEYS = new Set(["date_of_birth"]); // calendar date without time 
/** ------- Yellow highlight helper (ignore timestamp) ------- */ 
function dateOnOrAfterToday(dateVal: any): boolean { 
  if (!dateVal) return false; 
  const d = new Date(dateVal); 
  if (Number.isNaN(d.getTime())) return false; 
  const today = new Date(); 
  const dOnly = new Date(d.getFullYear(), d.getMonth(), d.getDate()); 
  const tOnly = new Date(today.getFullYear(), today.getMonth(), today.getDate()); 
  return dOnly.getTime() >= tOnly.getTime(); 
} 
const HIGHLIGHT_DATE_KEYS = new Set(["BOP_Date", "Followup_Date", "FollowUp_Date"]); 
const LABEL_OVERRIDES: Record<string, string> = { 
  client_name: "Client Name", 
  last_call_date: "Last Call On", 
  call_attempts: "No of Calls", 
  last_bop_date: "Last/Next BOP Call On", 
  bop_attempts: "No of BOP Calls", 
  last_followup_date: "Last/Next FollowUp On", 
  followup_attempts: "No of FollowUp Calls", 
  created_at: "Created Date", 
  interest_type: "Interest Type", 
  business_opportunities: "Business Opportunities", 
  wealth_solutions: "Wealth Solutions", 
  preferred_days: "Preferred Days", 
  preferred_time: "Preferred Time", 
  referred_by: "Referred By", 
  Profession: "Profession", 
  Product: "Products Sold", 
  Comment: "Comment", 
  Remark: "Remark", 
  CalledOn: "Called On", 
  BOP_Date: "BOP Date", 
  BOP_Status: "BOP Status", 
  Followup_Date: "Follow-Up Date", 
  FollowUp_Status: "Follow-Up Status", 
  spouse_name: "Spouse Name", 
  date_of_birth: "Date Of Birth", 
  children: "Children", 
  city: "City", 
  state: "State", 
  immigration_status: "Immigration Status", 
  work_details: "Work Details", 
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
function toLocalDateInput(value: any) { 
  if (!value) return ""; 
  const d = new Date(value); 
  if (Number.isNaN(d.getTime())) return ""; 
  const pad = (n: number) => String(n).padStart(2, "0"); 
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; 
} 
function fromLocalInput(value: string) { 
  if (!value?.trim()) return null; 
  const d = new Date(value); 
  if (Number.isNaN(d.getTime())) return null; 
  return d.toISOString(); 
} 
function fromLocalDate(value: string) { 
  if (!value?.trim()) return null; 
  const parts = value.split("-"); 
  if (parts.length !== 3) return null; 
  const [y, m, d] = parts.map((x) => Number(x)); 
  const dt = new Date(y, (m ?? 1) - 1, d ?? 1); 
  if (Number.isNaN(dt.getTime())) return null; 
  return dt.toISOString(); 
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
  const DESC_FIRST = new Set<SortKey>(["CalledOn", "BOP_Date", "Followup_Date"]); 
  if (cur.key !== k) { 
    return { key: k, dir: (DESC_FIRST.has(k) ? "desc" : "asc") as SortDir }; 
  } 
  return { key: k, dir: cur.dir === "asc" ? ("desc" as SortDir) : ("asc" as SortDir) }; 
} 
function toggleProgressSort( 
  cur: { key: ProgressSortKey; dir: SortDir }, 
  k: ProgressSortKey 
) { 
  const DESC_FIRST = new Set<ProgressSortKey>([ 
    "last_call_date", 
    "last_bop_date", 
    "last_followup_date", 
  ]); 
  if (cur.key !== k) { 
    return { key: k, dir: (DESC_FIRST.has(k) ? "desc" : "asc") as SortDir }; 
  } 
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
const US_STATE_OPTIONS: string[] = [ 
  "", 
  "Alabama", "Alaska", "Arizona", "Arkansas", "California", "Colorado", "Connecticut", "Delaware", 
  "Florida", "Georgia", "Hawaii", "Idaho", "Illinois", "Indiana", "Iowa", "Kansas", "Kentucky", 
  "Louisiana", "Maine", "Maryland", "Massachusetts", "Michigan", "Minnesota", "Mississippi", "Missouri", 
  "Montana", "Nebraska", "Nevada", "New Hampshire", "New Jersey", "New Mexico", "New York", "North Carolina", 
  "North Dakota", "Ohio", "Oklahoma", "Oregon", "Pennsylvania", "Rhode Island", "South Carolina", "South Dakota", 
  "Tennessee", "Texas", "Utah", "Vermont", "Virginia", "Washington", "West Virginia", "Wisconsin", "Wyoming", 
]; 
const IMMIGRATION_STATUS_OPTIONS: string[] = [ 
  "", 
  "U.S. Citizen", "U.S.Green Card", "H-1B", "H-1B/I-140 Approved", "L-1A", "L-1B", "F-1 Student", 
  "F-1 OPT", "F-1 STEM OPT", "H-4 EAD", "E-3", "I-485 Pending", "I-485 EAD/AP", "Other Visa Status", 
]; 
const STATUS_OPTIONS: Record<string, string[]> = { 
  status: ["", "Prospect Client", "New Client",  "Existing Client", "Referral Client", "Initiated", "In-Progress", "On-Hold", "Closed", "Completed"], 
  followup_status: ["", "Open", "In-Progress", "Follow-Up", "Follow-Up 2", "On Hold", "Completed"], 
  "follow-up_status": ["", "Open", "In-Progress", "Follow-Up", "Follow-Up 2", "On Hold", "Completed"], 
  client_status: ["", "New Client", "Initiated", "Interested", "In-Progress", "Closed", "On Hold", "Purchased", "Re-Opened", "Completed"],
  bop_status: ["", "Presented", "Business", "Client", "In-Progress", "On-Hold", "Clarification", "Not Interested", "Completed", "Closed"], 
  state: US_STATE_OPTIONS, 
  immigration_status: IMMIGRATION_STATUS_OPTIONS, 
}; 
function optionsForKey(k: string): string[] | null { 
  const lk = k.toLowerCase().replace(/\s+/g, "_"); 
  if (lk in STATUS_OPTIONS) return STATUS_OPTIONS[lk]; 
  return null; 
} 
export default function Dashboard() {
  const ready = useRequireCanfsAuth();
  if (!ready) {
    return (
      <div className="min-h-screen grid place-items-center text-slate-600">
        Checking authentication…
      </div>
    );
  }
 
  const [error, setError] = useState<string | null>(null); 
  const [daily60, setDaily60] = useState<{ day: string; calls?: number; bops?: number; followups?: number }[]>([]); 
  const [monthly12, setMonthly12] = useState<{ month: string; calls?: number; bops?: number; followups?: number }[]>([]); 
  const [trendLoading, setTrendLoading] = useState(false); 
  const [rangeStart, setRangeStart] = useState(format(new Date(), "yyyy-MM-dd")); 
  const [rangeEnd, setRangeEnd] = useState(format(addDays(new Date(), 30), "yyyy-MM-dd")); 
  const [upcoming, setUpcoming] = useState<Row[]>([]); 
  const [upcomingLoading, setUpcomingLoading] = useState(false); 
  const [sortUpcoming, setSortUpcoming] = useState<{ key: SortKey; dir: SortDir }>({ key: "BOP_Date", dir: "desc" }); 
  const [progressRows, setProgressRows] = useState<Row[]>([]); 
  const [progressLoading, setProgressLoading] = useState(false); 
  const [progressFilter, setProgressFilter] = useState(""); 
  const [progressSort, setProgressSort] = useState<{ key: ProgressSortKey; dir: SortDir }>({ key: "last_call_date", dir: "desc" }); 
  const [progressPage, setProgressPage] = useState(0); 
  const [q, setQ] = useState(""); 
  const [records, setRecords] = useState<Row[]>([]); 
  const [total, setTotal] = useState(0); 
  const [page, setPage] = useState(0); 
  const [pageJump, setPageJump] = useState("1"); 
  const [loading, setLoading] = useState(true); 
  const [savingId, setSavingId] = useState<string | null>(null); 
  const [sortAll, setSortAll] = useState<{ key: SortKey; dir: SortDir }>({ key: "created_at", dir: "desc" }); 
  const [recordsVisible, setRecordsVisible] = useState(false);  

  const [trendsVisible, setTrendsVisible] = useState(false);
  const [upcomingVisible, setUpcomingVisible] = useState(false);
  const [progressVisible, setProgressVisible] = useState(false);
 
  useEffect(() => { 
    (async () => { 
      try { 
        await Promise.all([fetchTrends(), fetchProgressSummary(), loadPage(0)]); 
      } catch (e: any) { 
        setError(e?.message ?? "Failed to initialize"); 
      } finally { 
        setLoading(false); 
      } 
    })(); 
  }, []); 
  useEffect(() => { 
    loadPage(0); 
  }, [sortAll.key, sortAll.dir]); 
  useEffect(() => { 
    if (upcoming.length) fetchUpcoming(); 
  }, [sortUpcoming.key, sortUpcoming.dir]); 
  useEffect(() => { 
    const id = setTimeout(() => { 
      loadPage(0); 
     const [recordsVisible, setRecordsVisible] = useState(false);  
      setRecordsVisible(true); 
    }, 300); 
    return () => clearTimeout(id); 
  }, [q]); 
  function applySort(query: any, sort: { key: SortKey; dir: SortDir }) { 
    const ascending = sort.dir === "asc"; 
    if (sort.key === "client") return query.order("first_name", { ascending }).order("last_name", { ascending }); 
    return query.order(sort.key, { ascending }); 
  } 
 async function logout() {
  try {
    clearCanfsAuthCookie();
    const supabase = getSupabase();
    await supabase.auth.signOut();
  } finally {
    window.location.href = '/auth';
  }
} 
function ProgressSummaryTable({ rows, sortState, onSortChange }: { rows: Row[]; sortState: { key: ProgressSortKey; dir: SortDir }; onSortChange: (k: ProgressSortKey) => void; }) { 
  const { widths, startResize } = useColumnResizer(); 
  const cols = useMemo(() => [ 
    { id: "client_name", label: "Client Name", key: "client_name" as ProgressSortKey, defaultW: 170 }, 
    { id: "first_name", label: "First Name", defaultW: 95 }, 
    { id: "last_name", label: "Last Name", defaultW: 90 }, 
    { id: "phone", label: "Phone", defaultW: 105 }, 
    { id: "email", label: "Email", defaultW: 220 }, 
    { id: "last_call_date", label: "Called On", key: "last_call_date" as ProgressSortKey, defaultW: 190 }, 
    { id: "call_attempts", label: "No of Calls", key: "call_attempts" as ProgressSortKey, defaultW: 90 }, 
    { id: "last_bop_date", label: "Last/Next BOP Call On", key: "last_bop_date" as ProgressSortKey, defaultW: 200 }, 
    { id: "bop_attempts", label: "No of BOP Calls", key: "bop_attempts" as ProgressSortKey, defaultW: 110 }, 
    { id: "last_followup_date", label: "Last/Next FollowUp On", key: "last_followup_date" as ProgressSortKey, defaultW: 200 }, 
    { id: "followup_attempts", label: "No of FollowUp Calls", key: "followup_attempts" as ProgressSortKey, defaultW: 140 }, 
  ], []); 
  const getW = (id: string, def: number) => widths[id] ?? def; 
  const stickyLeftPx = (colIndex: number) => (colIndex <= 0 ? 0 : 0); 
  const sortIcon = (k?: ProgressSortKey) => { if (!k) return null; if (sortState.key !== k) return <span className="ml-1 text-black">↕</span>; return <span className="ml-1 text-black">{sortState.dir === "asc" ? "↑" : "↓"}</span>; }; 
  const minWidth = cols.reduce((sum, c) => sum + getW(c.id, c.defaultW), 0); 
  const fmtDate = (v: any) => { if (!v) return "—"; const d = new Date(v); const t = d.getTime(); if (!Number.isFinite(t)) return "—"; return d.toLocaleString(); }; 
  const fmtCount = (v: any) => { const n = Number(v); if (!Number.isFinite(n)) return "—"; return String(n); }; 
  return ( 
    <div className="overflow-auto border border-slate-500 bg-white max-h-[520px]"> 
      <table className="w-full table-fixed border-collapse" style={{ minWidth }}> 
        <thead className="sticky top-0 bg-slate-100 z-20"> 
          <tr className="text-left text-xs font-semibold text-black"> 
            {cols.map((c, idx) => { 
              const w = getW(c.id, c.defaultW); 
              const isSticky = idx === 0; 
              const style: React.CSSProperties = { 
                width: w, minWidth: w, maxWidth: w, position: isSticky ? "sticky" : undefined, left: isSticky ? stickyLeftPx(idx) : undefined, top: 0, zIndex: isSticky ? 40 : 20, background: isSticky ? "#f1f5f9" : undefined, 
              }; 
              return ( 
                <th key={c.id} className="border border-slate-500 px-2 py-2 whitespace-nowrap relative" style={style}> 
                  {"key" in c ? ( 
                    <button className="inline-flex items-center hover:underline" onClick={() => onSortChange((c as any).key!)} type="button"> 
                      {c.label} 
                      {sortIcon((c as any).key)} 
                    </button> 
                  ) : ( 
                    c.label 
                  )} 
                  <div className="absolute top-0 right-0 h-full w-2 cursor-col-resize select-none" onMouseDown={(e) => startResize(e, c.id, w)}> 
                    <div className="mx-auto h-full w-px bg-slate-300" /> 
                  </div> 
                </th> 
              ); 
            })} 
          </tr> 
        </thead> 
        <tbody> 
          {rows.map((r, ridx) => ( 
            <tr key={String((r as any).clientid ?? ridx)} className="hover:bg-slate-50"> 
              {cols.map((c, idx) => { 
                const w = getW(c.id, c.defaultW); 
                const isSticky = idx === 0; 
                const style: React.CSSProperties = { 
                  width: w, minWidth: w, maxWidth: w, position: isSticky ? "sticky" : undefined, left: isSticky ? stickyLeftPx(idx) : undefined, zIndex: isSticky ? 10 : 1, background: isSticky ? "#ffffff" : undefined, verticalAlign: "middle", 
                }; 
                let v = "—"; 
                let tdClass = "border border-slate-300 px-2 py-2 whitespace-nowrap"; 
                if (c.id === "client_name") v = String(r.client_name ?? "—"); 
                else if (c.id === "first_name") v = String(r.first_name ?? "—"); 
                else if (c.id === "last_name") v = String(r.last_name ?? "—"); 
                else if (c.id === "phone") v = String(r.phone ?? "—"); 
                else if (c.id === "email") v = String(r.email ?? "—"); 
                else if (c.id === "last_call_date") v = fmtDate(r.last_call_date); 
                else if (c.id === "call_attempts") { v = fmtCount(r.call_attempts); tdClass += " text-center align-middle"; } 
                else if (c.id === "last_bop_date") v = fmtDate(r.last_bop_date); 
                else if (c.id === "bop_attempts") { v = fmtCount(r.bop_attempts); tdClass += " text-center align-middle"; } 
                else if (c.id === "last_followup_date") v = fmtDate(r.last_followup_date); 
                else if (c.id === "followup_attempts") { v = fmtCount(r.followup_attempts); tdClass += " text-center align-middle"; } 
                return (<td key={c.id} className={`${tdClass} ${isSticky ? "font-semibold text-black" : ""}`} style={style}>{v}</td>); 
              })} 
            </tr> 
          ))} 
        </tbody> 
      </table> 
    </div> 
  ); 
} 
function ExcelTableEditable({ 
  rows, savingId, onUpdate, extraLeftCols, maxHeightClass, sortState, onSortChange, preferredOrder, stickyLeftCount = 1, nonEditableKeys = new Set<string>(), viewOnlyPopupKeys = new Set<string>(), 
}: { 
  rows: Row[]; savingId: string | null; onUpdate: (id: string, key: string, value: string) => Promise<void>; 
  extraLeftCols: { label: string; render: (r: Row) => string; sortable?: SortKey }[]; maxHeightClass: string; 
  sortState: { key: SortKey; dir: SortDir }; onSortChange: (key: SortKey) => void; preferredOrder?: string[]; stickyLeftCount?: number; 
  nonEditableKeys?: Set<string>; viewOnlyPopupKeys?: Set<string>; 
}) { 
  const { widths, startResize } = useColumnResizer(); 
  const [openCell, setOpenCell] = useState<string | null>(null); 
  const [drafts, setDrafts] = useState<Record<string, string>>({}); 
  const sortIcon = (k?: SortKey) => { if (!k) return null; if (sortState.key !== k) return <span className="ml-1 text-black">↕</span>; return <span className="ml-1 text-black">{sortState.dir === "asc" ? "↑" : "↓"}</span>; }; 
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
  const WRAP_KEYS = new Set(["referred_by", "Product", "Comment", "Remark", "product", "comment", "remark", "immigration_status", "work_details"]); 
  const SAVE_KEY_NORMALIZE: Record<string, string> = { comment: "Comment", remark: "Remark", product: "Product", Comment: "Comment", Remark: "Remark", Product: "Product", ReferredBy: "referred_by", referredby: "referred_by" }; 
  const columns = useMemo(() => { 
    const extra = extraLeftCols.map((c, i) => ({ id: `extra:${i}`, label: c.label, sortable: c.sortable, kind: "extra" as const, defaultW: c.label.toLowerCase().includes("client") ? 180 : 150 })); 
    const main = keys.map((k) => { 
      const label = labelFor(k); 
      const isDateTime = DATE_TIME_KEYS.has(k); 
      const isDateOnly = DATE_ONLY_KEYS.has(k); 
      const defaultW = k === "created_at" ? 120 : isDateTime ? 220 : isDateOnly ? 180 : k.toLowerCase().includes("email") ? 240 : WRAP_KEYS.has(k) || READONLY_LIST_COLS.has(k) ? 260 : 160; 
      const sortable = k === "created_at" ? ("created_at" as SortKey) : k === "BOP_Date" ? ("BOP_Date" as SortKey) : k === "BOP_Status" ? ("BOP_Status" as SortKey) : k === "Followup_Date" ? ("Followup_Date" as SortKey) : k === "status" ? ("status" as SortKey) : k === "CalledOn" ? ("CalledOn" as SortKey) : k === "Issued" ? ("Issued" as SortKey) : undefined; 
      return { id: `col:${k}`, key: k, label, sortable, kind: "data" as const, defaultW }; 
    }); 
    return [...extra, ...main]; 
  }, [extraLeftCols, keys]); 
  const getW = (id: string, def: number) => widths[id] ?? def; 
  const stickyLeftPx = (colIndex: number) => { let left = 0; for (let i = 0; i < colIndex; i++) { const c = (columns as any)[i]; left += getW(c.id, c.defaultW ?? 160); } return left; }; 
  const minWidth = (columns as any).reduce((sum: number, c: any) => sum + getW(c.id, c.defaultW ?? 160), 0); 
  const getCellValueForInput = (r: Row, k: string) => { const isDateTime = DATE_TIME_KEYS.has(k); const isDateOnly = DATE_ONLY_KEYS.has(k); const val = r[k]; if (isDateTime) return toLocalInput(val); if (isDateOnly) return toLocalDateInput(val); return val ?? ""; }; 
  const shouldHighlight = (k: string, r: Row) => HIGHLIGHT_DATE_KEYS.has(k) && dateOnOrAfterToday(r[k]); 
  return ( 
    <div className={`overflow-auto border border-slate-500 bg-white ${maxHeightClass}`}> 
      <table className="w-full table-fixed border-collapse" style={{ minWidth }}> 
        <thead className="sticky top-0 bg-slate-100 z-20"> 
          <tr className="text-left text-xs font-semibold text-black"> 
            {(columns as any).map((c: any, colIndex: number) => { 
              const w = getW(c.id, c.defaultW ?? 160); 
              const isSticky = colIndex < stickyLeftCount; 
              const isTopLeft = isSticky; 
              const style: React.CSSProperties = { width: w, minWidth: w, maxWidth: w, position: isSticky ? "sticky" : undefined, left: isSticky ? stickyLeftPx(colIndex) : undefined, top: 0, zIndex: isTopLeft ? 50 : 20, background: isSticky ? "#f1f5f9" : undefined }; 
              const headerLabel = c.label; 
              return ( 
                <th key={c.id} className="border border-slate-500 px-2 py-2 whitespace-nowrap relative" style={style}> 
                  {c.sortable ? ( 
                    <button className="inline-flex items-center hover:underline" onClick={() => onSortChange(c.sortable)} type="button"> 
                      {headerLabel} 
                      {sortIcon(c.sortable)} 
                    </button> 
                  ) : ( 
                    headerLabel 
                  )} 
                  <div className="absolute top-0 right-0 h-full w-2 cursor-col-resize select-none" onMouseDown={(e) => startResize(e, c.id, w)}> 
                    <div className="mx-auto h-full w-px bg-slate-300" /> 
                  </div> 
                </th> 
              ); 
            })} 
          </tr> 
        </thead> 
        <tbody> 
          {rows.map((r, ridx) => ( 
            <tr key={String(r.id ?? ridx)} className={`hover:bg-slate-50 ${r.client_status === "New Client" ? "bg-[#B1FB17]" : r.client_status === "Interested" ? "bg-[#728FCE]" : r.client_status === "In-Progress" ? "bg-[#ADDFFF]" : r.client_status === "Closed" ? "bg-[#E6BF83]" : r.client_status === "On Hold" ? "bg-[#C9BE62]" : r.client_status === "Completed" ? "bg-[#3CB371] text-black" : ""}`}> 
              {(columns as any).map((c: any, colIndex: number) => { 
                const w = getW(c.id, c.defaultW ?? 160); 
                const isSticky = colIndex < stickyLeftCount; 
                const style: React.CSSProperties = { width: w, minWidth: w, maxWidth: w, position: isSticky ? "sticky" : undefined, left: isSticky ? stickyLeftPx(colIndex) : undefined, zIndex: isSticky ? 10 : 1, background: isSticky ? "#ffffff" : undefined }; 
                if (c.kind === "extra") { 
                  const idx = Number(String(c.id).split(":")[1] ?? "0"); 
                  const colDef = extraLeftCols[idx]; 
                  const v = colDef?.render ? colDef.render(r) : ""; 
                  return (<td key={c.id} className={`border border-slate-300 px-2 py-2 whitespace-nowrap font-semibold text-black ${shouldHighlight(c.key as string, r) ? "bg-yellow-200" : ""}`} style={style}>{v}</td>); 
                } 
                const k = c.key as string; 
                if (k === "created_at") { 
                  const d = new Date(r.created_at); 
                  const v = Number.isNaN(d.getTime()) ? "" : d.toLocaleDateString(); 
                  return (<td key={c.id} className={`border border-slate-300 px-2 py-2 whitespace-nowrap ${shouldHighlight(k, r) ? "bg-yellow-200" : ""}`} style={style}>{v}</td>); 
                } 
                const cellId = `${r.id}:${k}`; 
                const statusOptions = optionsForKey(k); 
                if (statusOptions) { 
                  const value = drafts[cellId] !== undefined ? drafts[cellId] : String(getCellValueForInput(r, k)); 
                  return ( 
                    <td key={c.id} className={`border border-slate-300 px-2 py-2 ${shouldHighlight(k, r) ? "bg-yellow-200" : ""}`} style={style}> 
                      <select 
                        className="w-full bg-transparent border-0 outline-none text-sm" 
                        value={value ?? ""} 
                        onChange={(e) => setDrafts((prev) => ({ ...prev, [cellId]: e.target.value }))} 
                        onBlur={() => { const v = drafts[cellId] ?? value ?? ""; if (v !== undefined) onUpdate(String(r.id), k, String(v)); }} 
                        disabled={savingId != null && String(savingId) === String(r.id)} 
                      > 
                        {statusOptions.map((opt, idx) => (<option key={`${k}:${idx}:${opt}`} value={opt}>{opt || "—"}</option>))} 
                      </select> 
                    </td> 
                  ); 
                } 
                if (READONLY_LIST_COLS.has(k)) { 
                  const cellIdList = `${r.id}:${k}`; 
                  const items = asListItems(r[k]); 
                  const display = items.join(", "); 
                  const showPopup = openCell === cellIdList; 
                  return ( 
                    <td key={c.id} className={`border border-slate-300 px-2 py-2 align-top ${shouldHighlight(k, r) ? "bg-yellow-200" : ""}`} style={style}> 
                      <div className="relative"> 
                        <button type="button" className="w-full text-left text-black whitespace-normal break-words" onClick={() => setOpenCell((cur) => (cur === cellIdList ? null : cellIdList))}>{display || "—"}</button> 
                        {showPopup && ( 
                          <div className="absolute left-0 top-full mt-1 w-72 max-w-[70vw] bg-white border border-slate-500 shadow-lg z-30"> 
                            <div className="px-2 py-1 text-xs font-semibold text-black bg-slate-100 border-b border-slate-300">{labelFor(k)}</div> 
                            <ul className="max-h-48 overflow-auto"> 
                              {(items.length ? items : ["(empty)"]).map((x, i) => (<li key={i} className="px-2 py-1 text-sm border-b border-slate-100">{x}</li>))} 
                            </ul> 
                            <div className="p-2"><Button variant="secondary" onClick={() => setOpenCell(null)}>Close</Button></div> 
                          </div> 
                        )} 
                      </div> 
                    </td> 
                  ); 
                } 
                if (WRAP_KEYS.has(k) && viewOnlyPopupKeys.has(k)) { 
                  const cellIdView = `${r.id}:${k}`; 
                  const showPopup = openCell === cellIdView; 
                  const baseVal = String(getCellValueForInput(r, k)); 
                  return ( 
                    <td key={c.id} className={`border border-slate-300 px-2 py-2 align-top ${shouldHighlight(k, r) ? "bg-yellow-200" : ""}`} style={style}> 
                      <div className="relative"> 
                        <button type="button" className="w-full text-left text-black whitespace-normal break-words" onClick={() => setOpenCell((cur) => (cur === cellIdView ? null : cellIdView))}>{baseVal || "—"}</button> 
                        {showPopup && ( 
                          <div className="absolute left-0 top-full mt-1 w-80 max-w-[80vw] bg-white border border-slate-500 shadow-xl z-40"> 
                            <div className="px-2 py-1 text-xs font-semibold text-black bg-slate-100 border-b border-slate-300">{labelFor(k)}</div> 
                            <div className="p-2"> 
                              <textarea rows={5} readOnly className="w-full border border-slate-300 px-2 py-1 text-sm whitespace-pre-wrap break-words resize-none overflow-auto bg-slate-50" value={baseVal} /> 
                              <div className="mt-2"><Button variant="secondary" onClick={() => setOpenCell(null)}>Close</Button></div> 
                            </div> 
                          </div> 
                        )} 
                      </div> 
                    </td> 
                  ); 
                } 
                if (nonEditableKeys.has(k)) { 
                  const displayVal = DATE_ONLY_KEYS.has(k) ? (() => { const d = new Date(r[k]); return Number.isNaN(d.getTime()) ? "—" : d.toLocaleDateString(); })() : String(getCellValueForInput(r, k)) || "—"; 
                  return (<td key={c.id} className={`border border-slate-300 px-2 py-2 whitespace-normal break-words ${shouldHighlight(k, r) ? "bg-yellow-200" : ""}`} style={style}>{displayVal}</td>); 
                } 
                if (WRAP_KEYS.has(k)) { 
                  const cellIdWrap = `${r.id}:${k}`; 
                  const showPopup = openCell === cellIdWrap; 
                  const baseVal = String(getCellValueForInput(r, k)); 
                  return ( 
                    <td key={c.id} className={`border border-slate-300 px-2 py-2 align-top ${shouldHighlight(k, r) ? "bg-yellow-200" : ""}`} style={style}> 
                      <div className="relative"> 
                        <button type="button" className="w-full text-left text-black whitespace-normal break-words" onClick={() => { setDrafts((prev) => ({ ...prev, [cellIdWrap]: drafts[cellIdWrap] ?? baseVal })); setOpenCell((cur) => (cur === cellIdWrap ? null : cellIdWrap)); }}>{baseVal || "—"}</button> 
                        {showPopup && ( 
                          <div className="absolute left-0 top-full mt-1 w-80 max-w-[80vw] bg-white border border-slate-500 shadow-xl z-40"> 
                            <div className="px-2 py-1 text-xs font-semibold text-black bg-slate-100 border-b border-slate-300">{labelFor(k)}</div> 
                            <div className="p-2"> 
                              <textarea rows={5} className="w-full border border-slate-300 px-2 py-1 text-sm whitespace-pre-wrap break-words resize-none overflow-auto" value={drafts[cellIdWrap] ?? ""} onChange={(e) => setDrafts((prev) => ({ ...prev, [cellIdWrap]: e.target.value }))} onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.stopPropagation(); } }} /> 
                              <div className="mt-2 flex items-center gap-2"> 
                                <Button variant="secondary" onClick={async () => { const mappedKey = SAVE_KEY_NORMALIZE[k] ?? k; await onUpdate(String(r.id), mappedKey, drafts[cellIdWrap] ?? "" ); setOpenCell(null); setDrafts((prev) => { const next = { ...prev }; delete next[cellIdWrap]; return next; }); }} disabled={savingId != null && String(savingId) === String(r.id)}>Save</Button> 
                                <Button variant="secondary" onClick={() => { setOpenCell(null); setDrafts((prev) => { const next = { ...prev }; delete next[cellIdWrap]; return next; }); }}>Cancel</Button> 
                              </div> 
                            </div> 
                          </div> 
                        )} 
                      </div> 
                    </td> 
                  ); 
                } 
                const cellIdInput = `${r.id}:${k}`; 
                const isDateTime = DATE_TIME_KEYS.has(k); 
                const isDateOnly = DATE_ONLY_KEYS.has(k); 
                const value = drafts[cellIdInput] !== undefined ? drafts[cellIdInput] : String(getCellValueForInput(r, k)); 
                const inputType = isDateTime ? "datetime-local" : isDateOnly ? "date" : "text"; 
                return ( 
                  <td key={c.id} className={`border border-slate-300 px-2 py-2 ${shouldHighlight(k, r) ? "bg-yellow-200" : ""}`} style={style}> 
                    <input 
                      type={inputType} 
                      step={isDateTime ? 60 : undefined} 
                      className="w-full bg-transparent border-0 outline-none text-sm" 
                      value={value} 
                      onChange={(e) => setDrafts((prev) => ({ ...prev, [cellIdInput]: e.target.value }))} 
                      onBlur={() => { const v = drafts[cellIdInput] ?? value ?? ""; if (v !== undefined) onUpdate(String(r.id), k, String(v)); }} 
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
