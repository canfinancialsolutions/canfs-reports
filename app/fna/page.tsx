// app/fna/page.tsx
"use client";

export const dynamic = "force-dynamic";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { getSupabase } from "@/lib/supabaseClient";

/**
 * Financial Needs Analysis (FNA) ” page.tsx
 *
 * Fixes included:
 * 1) Client search now queries public.client_registrations (via supabase().from("client_registrations"))
 *    using first_name / last_name / phone (ILIKE) and displays First, Last, Phone, Email.
 * 2) Selecting a client loads/creates an fna_header row, then fetches each tables data from the
 *    appropriate fna_* tables using fna_id.
 * 3) Minimal, practical CRUD for each fna_* table (add/edit/delete + save).
 *
 * Assumptions:
 * - Supabase auth is required; if no session, user is redirected to /auth.
 * - One œactive FNA per client is represented by the most recently updated fna_header for that client.
 */


// Auth cookie utilities
const AUTH_COOKIE = 'canfs_auth';

function hasAuthCookie(): boolean {
  if (typeof document === 'undefined') return false;
  return document.cookie.split('; ').some((c) => c.startsWith(`${AUTH_COOKIE}=true`));
}

function clearAuthCookie(): void {
  if (typeof document === 'undefined') return;
  const secure =
    typeof window !== 'undefined' && window.location?.protocol === 'https:' ? '; secure' : '';
  document.cookie = `${AUTH_COOKIE}=; path=/; max-age=0; samesite=lax${secure}`;
}

type UUID = string;

type ClientRow = {
  id: UUID;
  first_name: string;
  last_name: string;
  phone: string;
  email: string;
};

type FnaHeader = {
  id: UUID;
  client_id: UUID;
  created_at?: string;
  updated_at?: string;

  // Tell us about you
  spouse_name?: string | null;
  spouse_dob?: string | null; // date
  address?: string | null;
  city?: string | null;
  state?: string | null;
  zip_code?: string | null;
  client_dob?: string | null; // date
  home_phone?: string | null;
  mobile_phone?: string | null;
  personal_email?: string | null;
  spouse_mobile_phone?: string | null;
  spouse_email?: string | null;

  // Children / education
  more_children_planned?: boolean | null;
  more_children_count?: number | null;

  // Goals / properties
  goals_text?: string | null;
  own_or_rent?: string | null;
  properties_notes?: string | null;

  // Assets (general)
  has_old_401k?: boolean | null;
  expects_lump_sum?: boolean | null;

  // Life insurance need summary
  li_debt?: number | null;
  li_income?: number | null;
  li_mortgage?: number | null;
  li_education?: number | null;
  li_total_needed?: number | null;
  li_insurance_in_place?: number | null;
  li_insurance_gap?: number | null;

  // Estate / retirement questions
  has_will?: boolean | null;
  will_last_updated?: string | null; // date
  has_trust?: boolean | null;
  trust_type?: string | null;
  trust_purpose?: string | null;
  retirement_monthly_need?: number | null;
  retirement_target_date?: string | null; // date
  monthly_commitment?: number | null;

  // Next appointment
  next_appointment_date?: string | null; // date
  next_appointment_time?: string | null; // time
};

type RowBase = { id: UUID; fna_id: UUID } & Record<string, any>;

type TabKey =
  | "client_family"
  | "goals_properties"
  | "assets"
  | "liabilities"
  | "insurance"
  | "income_estate";

const TAB_LABELS: Record<TabKey, string> = {
  client_family: "👨‍👨‍👦‍👦Client & Family",
  goals_properties: "🎯Goals & 🏚️Properties",
  assets: "💰Assets",
  liabilities: "💁Liabilities",
  insurance: "☂️Insurance",
  income_estate: "💲Income & 🏘️Estate",
};
const US_STATES = [
  "",
  "Alabama",
  "Alaska",
  "Arizona",
  "Arkansas",
  "California",
  "Colorado",
  "Connecticut",
  "Delaware",
  "Florida",
  "Georgia",
  "Hawaii",
  "Idaho",
  "Illinois",
  "Indiana",
  "Iowa",
  "Kansas",
  "Kentucky",
  "Louisiana",
  "Maine",
  "Maryland",
  "Massachusetts",
  "Michigan",
  "Minnesota",
  "Mississippi",
  "Missouri",
  "Montana",
  "Nebraska",
  "Nevada",
  "New Hampshire",
  "New Jersey",
  "New Mexico",
  "New York",
  "North Carolina",
  "North Dakota",
  "Ohio",
  "Oklahoma",
  "Oregon",
  "Pennsylvania",
  "Rhode Island",
  "South Carolina",
  "South Dakota",
  "Tennessee",
  "Texas",
  "Utah",
  "Vermont",
  "Virginia",
  "Washington",
  "West Virginia",
  "Wisconsin",
  "Wyoming",
];

const ASSET_TAX_TYPES = ["TAX_ADVANTAGED", "TAXABLE", "TAX_DEFERRED"];
const LIABILITY_TYPES = ["CREDIT_CARD", "AUTO_LOAN", "STUDENT_LOAN", "PERSONAL_LOAN", "OTHER"];
const INSURED_ROLES = ["", "SPOUSE"];
const INSURANCE_TYPES = ["LIFE", "HEALTH"];

const INCOME_ROLES = ["", "SPOUSE"];
const INCOME_TYPES = [
  "ANNUAL_SALARY",
  "BONUS_COMMISSIONS",
  "RENTAL_INCOME",
  "CHILD_SUPPORT_ALIMONY",
  "PENSION",
  "SOCIAL_SECURITY",
  "OTHER",
];

function tmpId(prefix: string) {
  return `tmp_${prefix}_${Math.random().toString(16).slice(2)}_${Date.now()}`;
}

function asDateInput(v: any): string {
  if (!v) return "";
  // v might be YYYY-MM-DD or ISO; date inputs want YYYY-MM-DD
  const s = String(v);
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const d = new Date(s);
  return Number.isFinite(d.getTime()) ? d.toISOString().slice(0, 10) : "";
}

function asTimeInput(v: any): string {
  if (!v) return "";
  const s = String(v);
  // allow HH:MM
  if (/^\d{2}:\d{2}$/.test(s)) return s;
  // allow HH:MM:SS
  if (/^\d{2}:\d{2}:\d{2}$/.test(s)) return s.slice(0, 5);
  return "";
}

function sanitizeSearchTerm(s: string) {
  // Supabase `or()` filter uses comma separators; remove commas + parentheses to avoid breaking filter string.
  return s.replace(/[,()]/g, " ").trim();
}

type FieldType = "text" | "textarea" | "number" | "date" | "time" | "bool" | "select";

type FieldDef = {
  key: string;
  label: string;
  type: FieldType;
  options?: string[];
  placeholder?: string;
  widthClass?: string;
};

function coerceValue(type: FieldType, raw: any) {
  if (raw === "" || raw === undefined) return null;
  if (type === "number") {
    const n = Number(raw);
    return Number.isFinite(n) ? n : null;
  }
  if (type === "bool") return !!raw;
  return raw;
}

function TopButton({
  onClick,
  children,
  variant = "primary",
  disabled,
  title,
}: {
  onClick: () => void;
  children: React.ReactNode;
  variant?: "primary" | "secondary" | "danger";
  disabled?: boolean;
  title?: string;
}) {
  const base =
    "inline-flex items-center justify-center rounded-lg px-4 py-2 text-sm font-semibold transition-colors border";
  const styles =
    variant === "danger"
      ? "bg-red-600 hover:bg-red-700 text-white border-red-700"
      : variant === "secondary"
      ? "bg-white hover:bg-slate-50 text-slate-900 border-slate-300"
      : "bg-slate-900 hover:bg-slate-800 text-white border-slate-900";
  return (
    <button className={`${base} ${styles} ${disabled ? "opacity-50 cursor-not-allowed" : ""}`} onClick={onClick} disabled={disabled} title={title}>
      {children}
    </button>
  );
}

function Card({
  title,
  children,
  right,
}: {
  title: React.ReactNode;
  children: React.ReactNode;
  right?: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center justify-between gap-2 px-6 py-4 border-b border-slate-100">
        <div className="text-lg font-bold text-slate-900">{title}</div>
        {right}
      </div>
      <div className="px-6 py-5">{children}</div>
    </div>
  );
}
function FormGrid({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">{children}</div>;
}

function Field({
  def,
  value,
  onChange,
}: {
  def: FieldDef;
  value: any;
  onChange: (v: any) => void;
}) {
  const common =
    "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-400";
  const label = <div className="text-xs font-semibold text-slate-700 mb-1">{def.label}</div>;

  if (def.type === "textarea") {
    return (
      <label className={def.widthClass ?? ""}>
        {label}
        <textarea
          className={`${common} min-h-[90px]`}
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value)}
          placeholder={def.placeholder}
        />
      </label>
    );
  }

  if (def.type === "select") {
    return (
      <label className={def.widthClass ?? ""}>
        {label}
        <select className={common} value={value ?? ""} onChange={(e) => onChange(e.target.value)}>
          {(def.options ?? [""]).map((o) => (
            <option key={o} value={o}>
              {o || "”"}
            </option>
          ))}
        </select>
      </label>
    );
  }

  if (def.type === "bool") {
    return (
      <label className={def.widthClass ?? ""}>
        {label}
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            className="h-5 w-5 accent-slate-900"
            checked={!!value}
            onChange={(e) => onChange(e.target.checked)}
          />
          <span className="text-sm text-slate-800">{value ? "Yes" : "No"}</span>
        </div>
      </label>
    );
  }

  if (def.type === "date") {
    return (
      <label className={def.widthClass ?? ""}>
        {label}
        <input
          type="date"
          className={common}
          value={asDateInput(value)}
          onChange={(e) => onChange(e.target.value)}
        />
      </label>
    );
  }

  if (def.type === "time") {
    return (
      <label className={def.widthClass ?? ""}>
        {label}
        <input
          type="time"
          className={common}
          value={asTimeInput(value)}
          onChange={(e) => onChange(e.target.value)}
        />
      </label>
    );
  }

  return (
    <label className={def.widthClass ?? ""}>
      {label}
      <input
        type={def.type === "number" ? "number" : "text"}
        className={common}
        value={value ?? ""}
        onChange={(e) => onChange(def.type === "number" ? e.target.value : e.target.value)}
        placeholder={def.placeholder}
      />
    </label>
  );
}

function EditableTable({
  title,
  rows,
  setRows,
  columns,
  onSaveRow,
  onDeleteRow,
  addLabel = "Add Row",
}: {
  title: string;
  rows: RowBase[];
  setRows: React.Dispatch<React.SetStateAction<RowBase[]>>;
  columns: FieldDef[];
  onSaveRow: (row: RowBase) => Promise<void>;
  onDeleteRow: (row: RowBase) => Promise<void>;
  addLabel?: string;
}) {
  const [saving, setSaving] = useState<Record<string, boolean>>({});
  const [deleting, setDeleting] = useState<Record<string, boolean>>({});

  const minWidth = useMemo(() => {
    // simple heuristic to avoid cramped tables
    return Math.max(900, columns.length * 150);
  }, [columns.length]);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="text-sm font-bold text-slate-900">{title}</div>
        <TopButton
          variant="secondary"
          onClick={() => {
            setRows((prev) => [
              ...prev,
              {
                id: tmpId("row"),
                fna_id: prev[0]?.fna_id ?? "",
              },
            ]);
          }}
        >
          {addLabel}
        </TopButton>
      </div>

      <div className="overflow-auto border border-slate-200 rounded-xl">
        <table className="w-full text-sm border-collapse" style={{ minWidth }}>
          <thead className="bg-slate-50 sticky top-0 z-10">
            <tr className="text-left text-xs font-semibold text-slate-700">
              {columns.map((c) => (
                <th key={c.key} className="px-3 py-2 border-b border-slate-200 whitespace-nowrap">
                  {c.label}
                </th>
              ))}
              <th className="px-3 py-2 border-b border-slate-200 whitespace-nowrap">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td className="px-3 py-4 text-slate-500" colSpan={columns.length + 1}>
                  No records found.
                </td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr key={r.id} className="hover:bg-slate-50">
                  {columns.map((c) => (
                    <td key={c.key} className="px-3 py-2 border-b border-slate-100 align-top">
                      {c.type === "textarea" ? (
                        <textarea
                          className="w-full rounded-lg border border-slate-300 px-2 py-2 text-sm min-h-[60px]"
                          value={r[c.key] ?? ""}
                          onChange={(e) =>
                            setRows((prev) =>
                              prev.map((x) => (x.id === r.id ? { ...x, [c.key]: e.target.value } : x))
                            )
                          }
                        />
                      ) : c.type === "select" ? (
                        <select
                          className="w-full rounded-lg border border-slate-300 px-2 py-2 text-sm"
                          value={r[c.key] ?? ""}
                          onChange={(e) =>
                            setRows((prev) =>
                              prev.map((x) => (x.id === r.id ? { ...x, [c.key]: e.target.value } : x))
                            )
                          }
                        >
                          {(c.options ?? [""]).map((o) => (
                            <option key={o} value={o}>
                              {o || "”"}
                            </option>
                          ))}
                        </select>
                      ) : c.type === "bool" ? (
                        <input
                          type="checkbox"
                          className="h-5 w-5 accent-slate-900"
                          checked={!!r[c.key]}
                          onChange={(e) =>
                            setRows((prev) =>
                              prev.map((x) => (x.id === r.id ? { ...x, [c.key]: e.target.checked } : x))
                            )
                          }
                        />
                      ) : (
                        <input
                          type={c.type === "number" ? "number" : c.type === "date" ? "date" : c.type === "time" ? "time" : "text"}
                          className="w-full rounded-lg border border-slate-300 px-2 py-2 text-sm"
                          value={
                            c.type === "date"
                              ? asDateInput(r[c.key])
                              : c.type === "time"
                              ? asTimeInput(r[c.key])
                              : r[c.key] ?? ""
                          }
                          onChange={(e) =>
                            setRows((prev) =>
                              prev.map((x) => (x.id === r.id ? { ...x, [c.key]: e.target.value } : x))
                            )
                          }
                        />
                      )}
                    </td>
                  ))}
                  <td className="px-3 py-2 border-b border-slate-100 whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      <TopButton
                        variant="primary"
                        disabled={!!saving[r.id]}
                        onClick={async () => {
                          setSaving((p) => ({ ...p, [r.id]: true }));
                          try {
                            await onSaveRow(r);
                          } finally {
                            setSaving((p) => ({ ...p, [r.id]: false }));
                          }
                        }}
                      >
                        {saving[r.id] ? "Saving¦" : "Save"}
                      </TopButton>
                      <TopButton
                        variant="danger"
                        disabled={!!deleting[r.id]}
                        onClick={async () => {
                          setDeleting((p) => ({ ...p, [r.id]: true }));
                          try {
                            await onDeleteRow(r);
                          } finally {
                            setDeleting((p) => ({ ...p, [r.id]: false }));
                          }
                        }}
                      >
                        {deleting[r.id] ? "Deleting¦" : "Delete"}
                      </TopButton>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function Page() {
  const router = useRouter();
  // Lazily initialize Supabase  on the  runtime only
  const supabaseRef = useRef<ReturnType<typeof getSupabase> | null>(null);
  const supabase = () => {
    if (!supabaseRef.current) supabaseRef.current = getSupabase();
    return supabaseRef.current!;
  };

  const [authChecked, setAuthChecked] = useState(false);

  //  search
  const [search, setSearch] = useState("");
  const [clientRows, setClientRows] = useState<ClientRow[]>([]);
  const [clientLoading, setClientLoading] = useState(false);

  // Selected client + FNA
  const [selectedClient, setSelectedClient] = useState<ClientRow | null>(null);
  const [activeTab, setActiveTab] = useState<TabKey>("client_family");

  const [fnaHeader, setFnaHeader] = useState<FnaHeader | null>(null);
  const [fnaId, setFnaId] = useState<UUID | null>(null);

  const [childrenRows, setChildrenRows] = useState<RowBase[]>([]);
  const [propertyRows, setPropertyRows] = useState<RowBase[]>([]);
  const [assetRows, setAssetRows] = useState<RowBase[]>([]);
  const [liabilityRows, setLiabilityRows] = useState<RowBase[]>([]);
  const [insuranceRows, setInsuranceRows] = useState<RowBase[]>([]);
  const [incomeRows, setIncomeRows] = useState<RowBase[]>([]);
  const [taxRefundRow, setTaxRefundRow] = useState<RowBase | null>(null);

  const [loadingFna, setLoadingFna] = useState(false);
  const [savingHeader, setSavingHeader] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // ---------- Auth gate ----------
  useEffect(() => {
    (async () => {
      try {
        // Check cookie first (fast)
        const cookieOk = hasAuthCookie();
        if (!cookieOk) {
          // Fallback to Supabase session check
          const { data } = await supabase().auth.getSession();
          if (!data.session) {
            router.replace("/auth");
            return;
          }
        }
      } catch {
        // ignore; page will show error on subsequent calls
      } finally {
        setAuthChecked(true);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function logout() {
    try {
      await supabase().auth.signOut();
    } finally {
      clearAuthCookie();
      router.replace("/auth");
    }
  }

  // ---------- Client search ----------
  useEffect(() => {
    if (!authChecked) return;

    const t = setTimeout(() => {
      searchClients(search);
    }, 250);

    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, authChecked]);

  async function searchClients(term: string) {
    setError(null);
    setClientLoading(true);
    try {
      const needle = sanitizeSearchTerm(term);
      let q = supabase().from("client_registrations")
        .select("id, first_name, last_name, phone, email")
        .order("created_at", { ascending: false })
        .limit(50);

      if (needle) {
        q = q.or(
          `first_name.ilike.%${needle}%,last_name.ilike.%${needle}%,phone.ilike.%${needle}%`
        );
      }

      const { data, error: qErr } = await q;
      if (qErr) throw qErr;

      setClientRows((data ?? []) as ClientRow[]);
    } catch (e: any) {
      setClientRows([]);
      setError(e?.message ?? "Failed to load clients.");
    } finally {
      setClientLoading(false);
    }
  }

  // ---------- FNA load ----------
  async function ensureHeaderForClient(clientId: UUID): Promise<FnaHeader> {
    const { data: existing, error: e1 } = await supabase().from("fna_header")
      .select("*")
      .eq("client_id", clientId)
      .order("updated_at", { ascending: false })
      .limit(1);

    if (e1) throw e1;

    if (existing && existing.length > 0) {
      return existing[0] as FnaHeader;
    }

    const { data: inserted, error: e2 } = await supabase().from("fna_header")
      .insert({ client_id: clientId })
      .select("*")
      .limit(1);

    if (e2) throw e2;
    if (!inserted || inserted.length === 0) throw new Error("Failed to create FNA header.");
    return inserted[0] as FnaHeader;
  }

  async function loadFnaForClient(client: ClientRow) {
    setError(null);
    setNotice(null);
    setLoadingFna(true);

    // reset
    setSelectedClient(client);
    setActiveTab("client_family");
    setFnaHeader(null);
    setFnaId(null);
    setChildrenRows([]);
    setPropertyRows([]);
    setAssetRows([]);
    setLiabilityRows([]);
    setInsuranceRows([]);
    setIncomeRows([]);
    setTaxRefundRow(null);

    try {
      const header = await ensureHeaderForClient(client.id);
      setFnaHeader(header);
      setFnaId(header.id);

      // Fetch all tab data in parallel
      const fna_id = header.id;

      const [
        children,
        props,
        assets,
        liabilities,
        insurance,
        incomes,
        taxRefund,
      ] = await Promise.all([
        supabase().from("fna_children").select("*").eq("fna_id", fna_id).order("child_name", { ascending: true }),
        supabase().from("fna_properties").select("*").eq("fna_id", fna_id).order("address", { ascending: true }),
        supabase().from("fna_assets").select("*").eq("fna_id", fna_id).order("asset_name", { ascending: true }),
        supabase().from("fna_liabilities").select("*").eq("fna_id", fna_id).order("liability_type", { ascending: true }),
        supabase().from("fna_insurance").select("*").eq("fna_id", fna_id).order("insured_role", { ascending: true }),
        supabase().from("fna_income").select("*").eq("fna_id", fna_id).order("fna_income_role", { ascending: true }),
        supabase().from("fna_tax_refund").select("*").eq("fna_id", fna_id).limit(1),
      ]);

      for (const r of [children, props, assets, liabilities, insurance, incomes, taxRefund]) {
        if ((r as any).error) throw (r as any).error;
      }

      setChildrenRows(((children as any).data ?? []).map((x: any) => ({ ...x, fna_id })) as RowBase[]);
      setPropertyRows(((props as any).data ?? []).map((x: any) => ({ ...x, fna_id })) as RowBase[]);
      setAssetRows(((assets as any).data ?? []).map((x: any) => ({ ...x, fna_id })) as RowBase[]);
      setLiabilityRows(((liabilities as any).data ?? []).map((x: any) => ({ ...x, fna_id })) as RowBase[]);
      setInsuranceRows(((insurance as any).data ?? []).map((x: any) => ({ ...x, fna_id })) as RowBase[]);
      setIncomeRows(((incomes as any).data ?? []).map((x: any) => ({ ...x, fna_id })) as RowBase[]);

      const tr = ((taxRefund as any).data ?? [])[0];
      setTaxRefundRow(tr ? ({ ...tr, fna_id } as RowBase) : null);
    } catch (e: any) {
      setError(e?.message ?? "Failed to load FNA.");
    } finally {
      setLoadingFna(false);
    }
  }

  // ---------- Save header ----------
  async function saveHeader(partial?: Partial<FnaHeader>) {
    if (!fnaHeader) return;
    setSavingHeader(true);
    setError(null);
    setNotice(null);
    try {
      const payload: Partial<FnaHeader> = {
        ...(partial ?? fnaHeader),
        updated_at: new Date().toISOString(),
      };

      // coerce numbers/bools where relevant
      const numericKeys = new Set([
        "more_children_count",
        "li_debt",
        "li_income",
        "li_mortgage",
        "li_education",
        "li_total_needed",
        "li_insurance_in_place",
        "li_insurance_gap",
        "retirement_monthly_need",
        "monthly_commitment",
      ]);

      const boolKeys = new Set(["more_children_planned", "has_old_401k", "expects_lump_sum", "has_will", "has_trust"]);

      const cleaned: any = {};
      for (const [k, v] of Object.entries(payload)) {
        if (k === "id" || k === "client_id" || k === "created_at") continue;
        if (numericKeys.has(k)) cleaned[k] = v === "" || v == null ? null : Number(v);
        else if (boolKeys.has(k)) cleaned[k] = v == null ? null : !!v;
        else cleaned[k] = v === "" ? null : v;
      }
      cleaned.updated_at = payload.updated_at;

      const { data, error: uErr } = await supabase().from("fna_header")
        .update(cleaned)
        .eq("id", fnaHeader.id)
        .select("*")
        .limit(1);

      if (uErr) throw uErr;
      const next = (data ?? [])[0] as FnaHeader | undefined;
      if (next) setFnaHeader(next);

      setNotice("Saved.");
      setTimeout(() => setNotice(null), 2000);
    } catch (e: any) {
      setError(e?.message ?? "Failed to save.");
    } finally {
      setSavingHeader(false);
    }
  }

  // ---------- Generic row upsert/delete ----------
  async function upsertRow(table: string, row: RowBase, columns: FieldDef[]) {
    if (!fnaId) throw new Error("Missing FNA ID");
    const isTmp = String(row.id).startsWith("tmp_");

    const payload: any = { ...row };
    // remove local-only / temp-only
    if (isTmp) delete payload.id;
    payload.fna_id = fnaId;

    // coerce values
    for (const c of columns) {
      payload[c.key] = coerceValue(c.type, payload[c.key]);
    }

    if (table === "fna_income") {
      // schema uses varchar(100); keep strings
      payload.fna_income_role = payload.fna_income_role ?? "";
      payload.fna_income_type = payload.fna_income_type ?? "";
    }

    if (isTmp) {
      const { data, error } = await supabase().from(table).insert(payload).select("*").limit(1);
      if (error) throw error;
      return (data ?? [])[0] as RowBase | undefined;
    } else {
      const { data, error } = await supabase().from(table).update(payload).eq("id", row.id).select("*").limit(1);
      if (error) throw error;
      return (data ?? [])[0] as RowBase | undefined;
    }
  }

  async function deleteRow(table: string, row: RowBase) {
    const isTmp = String(row.id).startsWith("tmp_");
    if (isTmp) return; // only local
    const { error } = await supabase().from(table).delete().eq("id", row.id);
    if (error) throw error;
  }

  // ---------- Tab column definitions ----------
  const childCols: FieldDef[] = useMemo(
    () => [
      { key: "child_name", label: "Child Name", type: "text" },
      { key: "child_age", label: "Age", type: "number" },
      { key: "child_dob", label: "DOB", type: "date" },
      { key: "education_goal", label: "Education Goal", type: "text" },
      { key: "current_savings", label: "Current Savings", type: "number" },
      { key: "monthly_contribution", label: "Monthly Contribution", type: "number" },
      { key: "notes", label: "Notes", type: "textarea" },
    ],
    []
  );

  const propertyCols: FieldDef[] = useMemo(
    () => [
      { key: "address", label: "Address", type: "text" },
      { key: "mortgage_company", label: "Mortgage Company", type: "text" },
      { key: "market_value", label: "Market Value", type: "number" },
      { key: "balance", label: "Balance", type: "number" },
      { key: "interest_rate", label: "Interest Rate (%)", type: "number" },
      { key: "payment", label: "Payment", type: "number" },
      { key: "notes", label: "Notes", type: "textarea" },
    ],
    []
  );

  const assetCols: FieldDef[] = useMemo(
    () => [
      { key: "tax_type", label: "Tax Type", type: "select", options: ASSET_TAX_TYPES },
      { key: "asset_name", label: "Asset Name", type: "text" },
      { key: "asset_category", label: "Category", type: "text" },
      { key: "balance", label: "Balance", type: "number" },
      { key: "monthly_contribution", label: "Monthly Contribution", type: "number" },
      { key: "employer_match", label: "Employer Match", type: "number" },
      { key: "rate_of_return", label: "Rate of Return (%)", type: "number" },
      { key: "notes", label: "Notes", type: "textarea" },
    ],
    []
  );

  const liabilityCols: FieldDef[] = useMemo(
    () => [
      { key: "liability_type", label: "Liability Type", type: "select", options: LIABILITY_TYPES },
      { key: "description", label: "Description", type: "text" },
      { key: "lender", label: "Lender", type: "text" },
      { key: "balance", label: "Balance", type: "number" },
      { key: "interest_rate", label: "Interest Rate (%)", type: "number" },
      { key: "min_payment", label: "Min Payment", type: "number" },
      { key: "current_payment", label: "Current Payment", type: "number" },
      { key: "notes", label: "Notes", type: "textarea" },
    ],
    []
  );

  const insuranceCols: FieldDef[] = useMemo(
    () => [
      { key: "insured_role", label: "Insured Role", type: "select", options: INSURED_ROLES },
      { key: "insurance_type", label: "Insurance Type", type: "select", options: INSURANCE_TYPES },
      { key: "provider", label: "Provider", type: "text" },
      { key: "policy_type", label: "Policy Type", type: "text" },
      { key: "premium", label: "Premium", type: "number" },
      { key: "term", label: "Term", type: "text" },
      { key: "death_benefit", label: "Death Benefit", type: "number" },
      { key: "cash_value", label: "Cash Value", type: "number" },
      { key: "year_purchased", label: "Year Purchased", type: "number" },
      { key: "riders", label: "Riders", type: "text" },
      { key: "tobacco", label: "Tobacco", type: "bool" },
      { key: "marketplace", label: "Marketplace", type: "text" },
      { key: "notes", label: "Notes", type: "textarea" },
    ],
    []
  );

  const incomeCols: FieldDef[] = useMemo(
    () => [
      { key: "fna_income_role", label: "Income Role", type: "select", options: INCOME_ROLES },
      { key: "fna_income_type", label: "Income Type", type: "select", options: INCOME_TYPES },
      { key: "amount", label: "Amount", type: "number" },
      { key: "notes", label: "Notes", type: "textarea" },
    ],
    []
  );

  // ---------- Header fields by tab ----------
  const headerClientFields: FieldDef[] = useMemo(
    () => [
      { key: "spouse_name", label: "Spouse Name", type: "text" },
      { key: "spouse_dob", label: "Spouse DOB", type: "date" },
      { key: "client_dob", label: "Client DOB", type: "date" },
      { key: "address", label: "Address", type: "text", widthClass: "md:col-span-2" },
      { key: "city", label: "City", type: "text" },
      { key: "state", label: "State", type: "select", options: US_STATES },
      { key: "zip_code", label: "Zip Code", type: "text" },
      { key: "home_phone", label: "Home Phone", type: "text" },
      { key: "mobile_phone", label: "Mobile Phone", type: "text" },
      { key: "personal_email", label: "Personal Email", type: "text" },
      { key: "spouse_mobile_phone", label: "Spouse Mobile Phone", type: "text" },
      { key: "spouse_email", label: "Spouse Email", type: "text" },
      { key: "more_children_planned", label: "More Children Planned", type: "bool" },
      { key: "more_children_count", label: "More Children Count", type: "number" },
    ],
    []
  );

  const headerGoalsFields: FieldDef[] = useMemo(
    () => [
      { key: "goals_text", label: "Goals", type: "textarea", widthClass: "md:col-span-2 lg:col-span-3" },
      { key: "own_or_rent", label: "Own or Rent", type: "select", options: ["Own", "Rent"] },
      { key: "properties_notes", label: "Properties Notes", type: "textarea", widthClass: "md:col-span-2 lg:col-span-3" },
    ],
    []
  );

  const headerAssetsFields: FieldDef[] = useMemo(
    () => [
      { key: "has_old_401k", label: "Has Old 401(k)", type: "bool" },
      { key: "expects_lump_sum", label: "Expects Lump Sum", type: "bool" },
    ],
    []
  );

  const headerInsuranceNeedFields: FieldDef[] = useMemo(
    () => [
      { key: "li_debt", label: "Debt", type: "number" },
      { key: "li_income", label: "Income Replacement", type: "number" },
      { key: "li_mortgage", label: "Mortgage", type: "number" },
      { key: "li_education", label: "Education", type: "number" },
      { key: "li_total_needed", label: "Total Needed", type: "number" },
      { key: "li_insurance_in_place", label: "Insurance In Place", type: "number" },
      { key: "li_insurance_gap", label: "Insurance Gap", type: "number" },
    ],
    []
  );

  const headerEstateFields: FieldDef[] = useMemo(
    () => [
      { key: "has_will", label: "Has Will", type: "bool" },
      { key: "will_last_updated", label: "Will Last Updated", type: "date" },
      { key: "has_trust", label: "Has Trust", type: "bool" },
      { key: "trust_type", label: "Trust Type", type: "text" },
      { key: "trust_purpose", label: "Trust Purpose", type: "textarea", widthClass: "md:col-span-2 lg:col-span-3" },
      { key: "retirement_monthly_need", label: "Retirement Monthly Need", type: "number" },
      { key: "retirement_target_date", label: "Retirement Target Date", type: "date" },
      { key: "monthly_commitment", label: "Monthly Commitment", type: "number" },
      { key: "next_appointment_date", label: "Next Appointment Date", type: "date" },
      { key: "next_appointment_time", label: "Next Appointment Time", type: "time" },
    ],
    []
  );

  // ---------- Render helpers ----------
  const pageTitle = "Financial Needs Analysis";
 
  const canUseTabs = !!selectedClient && !!fnaHeader && !!fnaId;

  const selectedClientLabel = selectedClient
    ? `${selectedClient.first_name ?? ""} ${selectedClient.last_name ?? ""}`.trim()
    : "";

  const handleTabClick = (k: TabKey) => {
    if (!canUseTabs) return;
    setActiveTab(k);
  };

  // Keep fna_id populated for temp rows (when adding before any existing rows)
  useEffect(() => {
    if (!fnaId) return;

    const patchFnaId = (rows: RowBase[], setRows: React.Dispatch<React.SetStateAction<RowBase[]>>) => {
      setRows((prev) => prev.map((r) => ({ ...r, fna_id: fnaId })));
    };

    patchFnaId(childrenRows, setChildrenRows);
    patchFnaId(propertyRows, setPropertyRows);
    patchFnaId(assetRows, setAssetRows);
    patchFnaId(liabilityRows, setLiabilityRows);
    patchFnaId(insuranceRows, setInsuranceRows);
    patchFnaId(incomeRows, setIncomeRows);

    if (taxRefundRow) setTaxRefundRow((r) => (r ? { ...r, fna_id: fnaId } : r));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fnaId]);

  // ---------- UI ----------
  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-[1400px] mx-auto p-6 space-y-6">
        {/* Header */}
        <div className="rounded-2xl border border-slate-200 bg-white px-6 py-5 shadow-sm">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <img src="/can-logo.png" alt="CAN Financial Solutions" className="h-10 w-auto" />
              <div>
                <div className="text-1x2 font-bold text-blue-800">{pageTitle}</div>
                <div className="text-sm font-semibold text-yellow-500">Protecting Your Tomorrow</div>
               </div>
            </div>
            <button
              type="button"
              className="inline-flex items-center justify-center rounded-lg px-4 py-2 text-sm font-semibold transition-colors border border-slate-300 bg-transparent hover:bg-slate-50 text-slate-700"
              onClick={logout}
            >
              Logout ➜]
            </button>
          </div>
          {error && (
            <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}
          {notice && (
            <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
              {notice}
            </div>
          )}
        </div>
        {/* 1. Choose Client */}
        <Card
          title={
            <div>
              <div className="text-lg font-bold text-slate-900">1. Choose Client 👨🏻‍💼</div>
              {selectedClient && (
                <div className="mt-2 text-sm text-slate-700">
                  <span className="font-semibold">👉Selected:</span> {selectedClientLabel}{" "}
                  <span className="text-slate-500">(✉️{selectedClient.email})</span>
                </div>
              )}
            </div>
          }
          right={
            <div className="text-xs text-slate-600">
              <div className="text-slate-500 mt-1">
                {clientLoading ? "Searching¦" : `${clientRows.length} result(s)`}
              </div>
            </div>
          }
         >
          <div className="space-y-3">
            <div className="flex gap-2 items-center">
              <input
                className="w-full max-w-[420px] rounded-lg border border-slate-300 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-slate-400"
                placeholder="Search by name or phone..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
         <div className="text-slate-500 mt-1"> 👇 Select a client and complete all six sections of the FNA</div>
              <button
                type="button"
                onClick={() => {
                  setSearch("");
                  setSelectedClient(null);
                  setActiveTab("client_family");
                  setFnaHeader(null);
                  setFnaId(null);
                  setChildrenRows([]);
                  setPropertyRows([]);
                  setAssetRows([]);
                  setLiabilityRows([]);
                  setInsuranceRows([]);
                  setIncomeRows([]);
                  setTaxRefundRow(null);
                }}
                className="inline-flex items-left justify-center rounded-lg px-4 py-3 text-sm font-semibold transition-colors border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 whitespace-nowrap"
              >
                Refresh
              </button>
            </div>
           
            <div className="overflow-auto rounded-lg border border-slate-300">
              <table className="w-full text-sm min-w-[760px]" style={{ borderCollapse: 'collapse' }}>
                <thead className="bg-slate-50">
                  <tr className="text-left text-xs font-semibold text-slate-700">
                    <th className="px-4 py-3 border border-slate-300">First</th>
                    <th className="px-4 py-3 border border-slate-300">Last</th>
                    <th className="px-4 py-3 border border-slate-300">Phone</th>
                    <th className="px-4 py-3 border border-slate-300">Email</th>
                  </tr>
                </thead>
                <tbody>
                  {clientLoading ? (
                    <tr>
                      <td colSpan={4} className="px-4 py-6 text-slate-600 border border-slate-300">
                        Loading¦
                      </td>
                    </tr>
                  ) : clientRows.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-4 py-6 text-slate-500 text-center border border-slate-300">
                        No clients found.
                      </td>
                    </tr>
                  ) : (
                    clientRows.map((c) => {
                      const isSelected = selectedClient?.id === c.id;
                      return (
                        <tr
                          key={c.id}
                          className={`cursor-pointer ${isSelected ? "bg-emerald-50" : "hover:bg-slate-50"}`}
                          onClick={() => loadFnaForClient(c)}
                        >
                          <td className="px-4 py-3 border border-slate-300 font-semibold text-slate-900">
                            {c.first_name}
                          </td>
                          <td className="px-4 py-3 border border-slate-300 text-slate-900">{c.last_name}</td>
                          <td className="px-4 py-3 border border-slate-300 text-slate-700">{c.phone}</td>
                          <td className="px-4 py-3 border border-slate-300 text-slate-700">{c.email}</td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {loadingFna && (
              <div className="text-sm text-slate-600">Loading client FNA¦</div>
            )}
          </div>
        </Card>

        {/* Tabs */}
        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="px-6 pt-5">
            <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 pb-3">
              {(Object.keys(TAB_LABELS) as TabKey[]).map((k) => {
                const active = activeTab === k;
                const disabled = !canUseTabs;
                return (
                  <button
                    key={k}
                    onClick={() => handleTabClick(k)}
                    disabled={disabled}
                    className={[
                      "px-4 py-2 rounded-lg text-sm font-semibold border transition-colors",
                      active ? "bg-blue-50 text-blue-700 border-blue-200" : "bg-white text-slate-700 border-transparent hover:bg-slate-50",
                      disabled ? "opacity-50 cursor-not-allowed" : "",
                    ].join(" ")}
                  >
                    {TAB_LABELS[k]}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="px-6 py-6">
            {!canUseTabs ? (
              <div className="text-slate-600">Select a client above to begin the Financial Needs Analysis.</div>
            ) : (
              <>
                {/* Tab content */}
                {activeTab === "client_family" && (
                  <div className="space-y-6">
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-base font-bold text-slate-900">Client & Family</div>
                      <TopButton variant="primary" onClick={() => saveHeader()} disabled={savingHeader}>
                        {savingHeader ? "Saving¦" : "Save"}
                      </TopButton>
                    </div>

                    <FormGrid>
                      {headerClientFields.map((def) => (
                        <Field
                          key={def.key}
                          def={def}
                          value={(fnaHeader as any)?.[def.key]}
                          onChange={(v) => setFnaHeader((prev) => (prev ? ({ ...prev, [def.key]: v } as any) : prev))}
                        />
                      ))}
                    </FormGrid>

                    <EditableTable
                      title="Children"
                      rows={childrenRows}
                      setRows={setChildrenRows}
                      columns={childCols}
                      addLabel="Add Child"
                      onSaveRow={async (row) => {
                        setError(null);
                        try {
                          const saved = await upsertRow("fna_children", row, childCols);
                          if (saved) {
                            setChildrenRows((prev) =>
                              prev.map((r) => (r.id === row.id ? ({ ...saved, fna_id: fnaId! } as any) : r))
                            );
                          }
                          setNotice("Saved.");
                          setTimeout(() => setNotice(null), 1500);
                        } catch (e: any) {
                          setError(e?.message ?? "Save failed.");
                        }
                      }}
                      onDeleteRow={async (row) => {
                        setError(null);
                        try {
                          await deleteRow("fna_children", row);
                          setChildrenRows((prev) => prev.filter((r) => r.id !== row.id));
                          setNotice("Deleted.");
                          setTimeout(() => setNotice(null), 1500);
                        } catch (e: any) {
                          setError(e?.message ?? "Delete failed.");
                        }
                      }}
                    />
                  </div>
                )}

                {activeTab === "goals_properties" && (
                  <div className="space-y-6">
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-base font-bold text-slate-900">Goals & Properties</div>
                      <TopButton variant="primary" onClick={() => saveHeader()} disabled={savingHeader}>
                        {savingHeader ? "Saving¦" : "Save"}
                      </TopButton>
                    </div>

                    <FormGrid>
                      {headerGoalsFields.map((def) => (
                        <Field
                          key={def.key}
                          def={def}
                          value={(fnaHeader as any)?.[def.key]}
                          onChange={(v) => setFnaHeader((prev) => (prev ? ({ ...prev, [def.key]: v } as any) : prev))}
                        />
                      ))}
                    </FormGrid>

                    <EditableTable
                      title="Properties"
                      rows={propertyRows}
                      setRows={setPropertyRows}
                      columns={propertyCols}
                      addLabel="Add Property"
                      onSaveRow={async (row) => {
                        setError(null);
                        try {
                          const saved = await upsertRow("fna_properties", row, propertyCols);
                          if (saved) {
                            setPropertyRows((prev) =>
                              prev.map((r) => (r.id === row.id ? ({ ...saved, fna_id: fnaId! } as any) : r))
                            );
                          }
                          setNotice("Saved.");
                          setTimeout(() => setNotice(null), 1500);
                        } catch (e: any) {
                          setError(e?.message ?? "Save failed.");
                        }
                      }}
                      onDeleteRow={async (row) => {
                        setError(null);
                        try {
                          await deleteRow("fna_properties", row);
                          setPropertyRows((prev) => prev.filter((r) => r.id !== row.id));
                          setNotice("Deleted.");
                          setTimeout(() => setNotice(null), 1500);
                        } catch (e: any) {
                          setError(e?.message ?? "Delete failed.");
                        }
                      }}
                    />
                  </div>
                )}

                {activeTab === "assets" && (
                  <div className="space-y-6">
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-base font-bold text-slate-900">Assets</div>
                      <TopButton variant="primary" onClick={() => saveHeader()} disabled={savingHeader}>
                        {savingHeader ? "Saving¦" : "Save"}
                      </TopButton>
                    </div>

                    <FormGrid>
                      {headerAssetsFields.map((def) => (
                        <Field
                          key={def.key}
                          def={def}
                          value={(fnaHeader as any)?.[def.key]}
                          onChange={(v) => setFnaHeader((prev) => (prev ? ({ ...prev, [def.key]: v } as any) : prev))}
                        />
                      ))}
                    </FormGrid>

                    <EditableTable
                      title="Assets"
                      rows={assetRows}
                      setRows={setAssetRows}
                      columns={assetCols}
                      addLabel="Add Asset"
                      onSaveRow={async (row) => {
                        setError(null);
                        try {
                          const saved = await upsertRow("fna_assets", row, assetCols);
                          if (saved) {
                            setAssetRows((prev) =>
                              prev.map((r) => (r.id === row.id ? ({ ...saved, fna_id: fnaId! } as any) : r))
                            );
                          }
                          setNotice("Saved.");
                          setTimeout(() => setNotice(null), 1500);
                        } catch (e: any) {
                          setError(e?.message ?? "Save failed.");
                        }
                      }}
                      onDeleteRow={async (row) => {
                        setError(null);
                        try {
                          await deleteRow("fna_assets", row);
                          setAssetRows((prev) => prev.filter((r) => r.id !== row.id));
                          setNotice("Deleted.");
                          setTimeout(() => setNotice(null), 1500);
                        } catch (e: any) {
                          setError(e?.message ?? "Delete failed.");
                        }
                      }}
                    />
                  </div>
                )}

                {activeTab === "liabilities" && (
                  <div className="space-y-6">
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-base font-bold text-slate-900">Liabilities</div>
                    </div>

                    <EditableTable
                      title="Liabilities"
                      rows={liabilityRows}
                      setRows={setLiabilityRows}
                      columns={liabilityCols}
                      addLabel="Add Liability"
                      onSaveRow={async (row) => {
                        setError(null);
                        try {
                          const saved = await upsertRow("fna_liabilities", row, liabilityCols);
                          if (saved) {
                            setLiabilityRows((prev) =>
                              prev.map((r) => (r.id === row.id ? ({ ...saved, fna_id: fnaId! } as any) : r))
                            );
                          }
                          setNotice("Saved.");
                          setTimeout(() => setNotice(null), 1500);
                        } catch (e: any) {
                          setError(e?.message ?? "Save failed.");
                        }
                      }}
                      onDeleteRow={async (row) => {
                        setError(null);
                        try {
                          await deleteRow("fna_liabilities", row);
                          setLiabilityRows((prev) => prev.filter((r) => r.id !== row.id));
                          setNotice("Deleted.");
                          setTimeout(() => setNotice(null), 1500);
                        } catch (e: any) {
                          setError(e?.message ?? "Delete failed.");
                        }
                      }}
                    />
                  </div>
                )}

                {activeTab === "insurance" && (
                  <div className="space-y-6">
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-base font-bold text-slate-900">Insurance</div>
                      <TopButton variant="primary" onClick={() => saveHeader()} disabled={savingHeader}>
                        {savingHeader ? "Saving¦" : "Save"}
                      </TopButton>
                    </div>

                    <div className="rounded-xl border border-slate-200 p-4 bg-slate-50">
                      <div className="text-sm font-bold text-slate-900 mb-3">Life Insurance Need Summary</div>
                      <FormGrid>
                        {headerInsuranceNeedFields.map((def) => (
                          <Field
                            key={def.key}
                            def={def}
                            value={(fnaHeader as any)?.[def.key]}
                            onChange={(v) => setFnaHeader((prev) => (prev ? ({ ...prev, [def.key]: v } as any) : prev))}
                          />
                        ))}
                      </FormGrid>
                    </div>

                    <EditableTable
                      title="Insurance Policies"
                      rows={insuranceRows}
                      setRows={setInsuranceRows}
                      columns={insuranceCols}
                      addLabel="Add Policy"
                      onSaveRow={async (row) => {
                        setError(null);
                        try {
                          const saved = await upsertRow("fna_insurance", row, insuranceCols);
                          if (saved) {
                            setInsuranceRows((prev) =>
                              prev.map((r) => (r.id === row.id ? ({ ...saved, fna_id: fnaId! } as any) : r))
                            );
                          }
                          setNotice("Saved.");
                          setTimeout(() => setNotice(null), 1500);
                        } catch (e: any) {
                          setError(e?.message ?? "Save failed.");
                        }
                      }}
                      onDeleteRow={async (row) => {
                        setError(null);
                        try {
                          await deleteRow("fna_insurance", row);
                          setInsuranceRows((prev) => prev.filter((r) => r.id !== row.id));
                          setNotice("Deleted.");
                          setTimeout(() => setNotice(null), 1500);
                        } catch (e: any) {
                          setError(e?.message ?? "Delete failed.");
                        }
                      }}
                    />
                  </div>
                )}

                {activeTab === "income_estate" && (
                  <div className="space-y-6">
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-base font-bold text-slate-900">Income & Estate</div>
                      <TopButton variant="primary" onClick={() => saveHeader()} disabled={savingHeader}>
                        {savingHeader ? "Saving¦" : "Save"}
                      </TopButton>
                    </div>

                    <EditableTable
                      title="Income"
                      rows={incomeRows}
                      setRows={setIncomeRows}
                      columns={incomeCols}
                      addLabel="Add Income"
                      onSaveRow={async (row) => {
                        setError(null);
                        try {
                          const saved = await upsertRow("fna_income", row, incomeCols);
                          if (saved) {
                            setIncomeRows((prev) =>
                              prev.map((r) => (r.id === row.id ? ({ ...saved, fna_id: fnaId! } as any) : r))
                            );
                          }
                          setNotice("Saved.");
                          setTimeout(() => setNotice(null), 1500);
                        } catch (e: any) {
                          setError(e?.message ?? "Save failed.");
                        }
                      }}
                      onDeleteRow={async (row) => {
                        setError(null);
                        try {
                          await deleteRow("fna_income", row);
                          setIncomeRows((prev) => prev.filter((r) => r.id !== row.id));
                          setNotice("Deleted.");
                          setTimeout(() => setNotice(null), 1500);
                        } catch (e: any) {
                          setError(e?.message ?? "Delete failed.");
                        }
                      }}
                    />

                    <div className="rounded-xl border border-slate-200 p-4 bg-slate-50">
                      <div className="text-sm font-bold text-slate-900 mb-3">Estate / Retirement</div>
                      <FormGrid>
                        {headerEstateFields.map((def) => (
                          <Field
                            key={def.key}
                            def={def}
                            value={(fnaHeader as any)?.[def.key]}
                            onChange={(v) => setFnaHeader((prev) => (prev ? ({ ...prev, [def.key]: v } as any) : prev))}
                          />
                        ))}
                      </FormGrid>
                    </div>

                    <div className="rounded-xl border border-slate-200 p-4 bg-white">
                      <div className="flex items-center justify-between gap-2">
                        <div className="text-sm font-bold text-slate-900">Last Year Tax Refund</div>
                        <TopButton
                          variant="secondary"
                          onClick={async () => {
                            setError(null);
                            try {
                              if (!fnaId) return;

                              const cols: FieldDef[] = [{ key: "last_year_tax_refund", label: "Last Year Tax Refund", type: "number" }];

                              if (!taxRefundRow) {
                                const inserted = await upsertRow(
                                  "fna_tax_refund",
                                  { id: tmpId("tax"), fna_id: fnaId, last_year_tax_refund: null } as any,
                                  cols
                                );
                                if (inserted) setTaxRefundRow({ ...inserted, fna_id: fnaId } as any);
                                setNotice("Saved.");
                                setTimeout(() => setNotice(null), 1500);
                                return;
                              }

                              const saved = await upsertRow("fna_tax_refund", taxRefundRow as any, cols);
                              if (saved) setTaxRefundRow({ ...saved, fna_id: fnaId } as any);
                              setNotice("Saved.");
                              setTimeout(() => setNotice(null), 1500);
                            } catch (e: any) {
                              setError(e?.message ?? "Save failed.");
                            }
                          }}
                        >
                          Save Tax Refund
                        </TopButton>
                      </div>

                      <div className="mt-3 max-w-[420px]">
                        <Field
                          def={{ key: "last_year_tax_refund", label: "Amount", type: "number" }}
                          value={(taxRefundRow as any)?.last_year_tax_refund ?? ""}
                          onChange={(v) => setTaxRefundRow((prev) => ({ ...(prev ?? { id: tmpId("tax"), fna_id: fnaId! }), last_year_tax_refund: v } as any))}
                        />
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* Developer hint */}
        <div className="text-xs text-slate-500">
          Note: If you still see No clients found but you know data exists, verify Supabase RLS policies for
          <span className="font-semibold"> client_registrations</span> and the <span className="font-semibold">fna_* tables</span>.
          This page uses direct <span className="font-mono">supabase().from("...")</span> reads/writes.
        </div>
      </div>
    </div>
  );
}
