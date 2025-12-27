"use client";

export const dynamic = "force-dynamic";

import { useEffect, useMemo, useState } from "react";
import * as XLSX from "xlsx";
import { addDays, format, isValid, parseISO, startOfWeek } from "date-fns";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip } from "recharts";
import { getSupabase } from "@/lib/supabaseClient";
import { Button, Card, Pill } from "@/components/ui";

type Row = {
  id: string;
  created_at: string;

  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  email: string | null;

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

const FIELDS: (keyof Row)[] = [
  "CalledOn",
  "BOP_Date",
  "BOP_Status",
  "Followup_Date",
  "FollowUp_Status",
  "Product",
  "Issued",
  "Comment",
  "Remark",
];

const DATE_FIELDS: (keyof Row)[] = ["CalledOn", "BOP_Date", "Followup_Date", "Issued"];

function toLocalInput(value: string | null) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  // datetime-local requires yyyy-MM-ddTHH:mm
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function fromLocalInput(value: string) {
  if (!value?.trim()) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

export default function Dashboard() {
  const [rows, setRows] = useState<Row[]>([]);
  const [q, setQ] = useState("");
  const [rangeStart, setRangeStart] = useState(format(new Date(), "yyyy-MM-dd"));
  const [rangeEnd, setRangeEnd] = useState(format(addDays(new Date(), 30), "yyyy-MM-dd"));
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Auth guard
  useEffect(() => {
    (async () => {
      try {
        const supabase = getSupabase();
        const { data } = await supabase.auth.getSession();
        if (!data.session) {
          window.location.href = "/";
          return;
        }
        await fetchRows();
      } catch (e: any) {
        setError(e?.message || "Failed to initialize");
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchRows = async () => {
    setLoading(true);
    setError(null);
    try {
      const supabase = getSupabase();
      let query = supabase
        .from("client_registrations")
        .select(
          "id,created_at,first_name,last_name,phone,email,CalledOn,BOP_Date,BOP_Status,Followup_Date,FollowUp_Status,Product,Issued,Comment,Remark"
        )
        .order("created_at", { ascending: false })
        .limit(500);

      const search = q.trim();
      if (search) {
        query = query.or(
          `first_name.ilike.%${search}%,last_name.ilike.%${search}%,phone.ilike.%${search}%`
        );
      }

      const { data, error } = await query;
      if (error) throw error;
      setRows((data || []) as Row[]);
    } catch (e: any) {
      setError(e?.message || "Fetch failed");
    } finally {
      setLoading(false);
    }
  };

  const upcoming = useMemo(() => {
    const s = parseISO(rangeStart);
    const e = parseISO(rangeEnd);

    return rows
      .filter((r) => r.BOP_Date)
      .map((r) => ({ ...r, bop: parseISO(String(r.BOP_Date)) }))
      .filter((r) => isValid(r.bop) && r.bop >= s && r.bop <= e)
      .sort((a, b) => a.bop.getTime() - b.bop.getTime());
  }, [rows, rangeStart, rangeEnd]);

  const weeklyChart = useMemo(() => {
    const map = new Map<string, number>();
    for (const r of upcoming) {
      const dt = parseISO(String(r.BOP_Date));
      if (!isValid(dt)) continue;
      const wk = startOfWeek(dt, { weekStartsOn: 1 });
      const key = format(wk, "yyyy-MM-dd");
      map.set(key, (map.get(key) || 0) + 1);
    }
    return Array.from(map.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([weekStart, count]) => ({ weekStart, count }));
  }, [upcoming]);

  const updateCell = async (id: string, field: keyof Row, value: string) => {
    setSavingId(id);
    setError(null);
    try {
      const supabase = getSupabase();
      const payload: any = {};

      if (DATE_FIELDS.includes(field)) {
        payload[field] = fromLocalInput(value);
      } else {
        payload[field] = value?.trim() ? value : null;
      }

      const { error } = await supabase.from("client_registrations").update(payload).eq("id", id);
      if (error) throw error;

      setRows((prev) =>
        prev.map((r) => (r.id === id ? ({ ...r, [field]: payload[field] } as Row) : r))
      );
    } catch (e: any) {
      setError(e?.message || "Update failed");
    } finally {
      setSavingId(null);
    }
  };

  const exportXlsx = () => {
    const exportRows = upcoming.map((r) => ({
      FirstName: r.first_name,
      LastName: r.last_name,
      Phone: r.phone,
      Email: r.email,
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
      <div className="max-w-[1400px] mx-auto p-6 space-y-6">
        <header className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-center gap-3">
            <img src="/can-logo.svg" className="h-10" alt="CAN Financial Solutions" />
            <div>
              <div className="text-2xl font-bold text-slate-800">Client Reports</div>
              <div className="text-sm text-slate-500">
                Search, edit follow-ups, upcoming BOP meetings, export & weekly trend
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Pill>{upcoming.length} upcoming</Pill>
            <Button variant="secondary" onClick={signOut}>Sign out</Button>
          </div>
        </header>

        {error && (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-red-700">
            {error}
          </div>
        )}

        <div className="grid lg:grid-cols-3 gap-4">
          <Card title="Search">
            <div className="flex gap-2">
              <input
                className="w-full rounded-xl border border-slate-200 px-4 py-3"
                placeholder="Search by first name, last name, or phone"
                value={q}
                onChange={(e) => setQ(e.target.value)}
              />
              <Button onClick={fetchRows}>Go</Button>
            </div>
            <div className="text-xs text-slate-500 mt-2">Loads up to 500 latest records.</div>
          </Card>

          <Card title="Upcoming BOP Date Range">
            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <div className="text-xs font-semibold text-slate-600 mb-1">Start</div>
                <input
                  type="date"
                  className="w-full rounded-xl border border-slate-200 px-3 py-2"
                  value={rangeStart}
                  onChange={(e) => setRangeStart(e.target.value)}
                />
              </label>
              <label className="block">
                <div className="text-xs font-semibold text-slate-600 mb-1">End</div>
                <input
                  type="date"
                  className="w-full rounded-xl border border-slate-200 px-3 py-2"
                  value={rangeEnd}
                  onChange={(e) => setRangeEnd(e.target.value)}
                />
              </label>
            </div>
            <div className="mt-3 flex items-center justify-between">
              <div className="text-sm text-slate-600">
                Upcoming: <span className="font-semibold text-slate-800">{upcoming.length}</span>
              </div>
              <Button variant="secondary" onClick={exportXlsx}>Export XLSX</Button>
            </div>
          </Card>

          <Card title="Weekly BOP Trend">
            <div className="h-44">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={weeklyChart}>
                  <XAxis dataKey="weekStart" tick={{ fontSize: 11 }} />
                  <YAxis allowDecimals={false} />
                  <Tooltip />
                  <Bar dataKey="count" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </div>

        <Card title="Upcoming BOP Meetings (Editable)">
          {loading ? (
            <div className="text-slate-600">Loading...</div>
          ) : (
            <div className="overflow-auto rounded-xl border border-slate-200">
              <table className="min-w-[1350px] w-full border-separate border-spacing-0 bg-white">
                <thead className="sticky top-0 bg-slate-50">
                  <tr className="text-left text-xs uppercase tracking-wide text-slate-500">
                    <Th>Client</Th>
                    <Th>Phone</Th>
                    <Th>Email</Th>
                    <Th>CalledOn</Th>
                    <Th>BOP_Date</Th>
                    <Th>BOP_Status</Th>
                    <Th>Followup_Date</Th>
                    <Th>FollowUp_Status</Th>
                    <Th>Product</Th>
                    <Th>Issued</Th>
                    <Th>Comment</Th>
                    <Th>Remark</Th>
                    <Th>Status</Th>
                  </tr>
                </thead>
                <tbody>
                  {upcoming.map((r) => (
                    <tr key={r.id} className="hover:bg-slate-50">
                      <Td>
                        <div className="font-semibold text-slate-800">
                          {(r.first_name || "") + " " + (r.last_name || "")}
                        </div>
                        <div className="text-xs text-slate-500">
                          Created: {new Date(r.created_at).toLocaleString()}
                        </div>
                      </Td>
                      <Td>{r.phone || ""}</Td>
                      <Td className="max-w-[240px] truncate">{r.email || ""}</Td>

                      {FIELDS.map((field) => {
                        const isDate = DATE_FIELDS.includes(field);
                        const currentVal = r[field] as any;

                        return (
                          <Td key={String(field)}>
                            <input
                              type={isDate ? "datetime-local" : "text"}
                              className="w-full rounded-lg border border-slate-200 px-2 py-2 text-sm"
                              value={isDate ? toLocalInput(currentVal) : (currentVal ?? "")}
                              placeholder={String(field)}
                              onChange={(e) => {
                                const v = e.target.value;
                                setRows((prev) =>
                                  prev.map((x) =>
                                    x.id === r.id ? ({ ...x, [field]: isDate ? fromLocalInput(v) : v } as any) : x
                                  )
                                );
                              }}
                              onBlur={(e) => updateCell(r.id, field, e.target.value)}
                            />
                          </Td>
                        );
                      })}

                      <Td>
                        {savingId === r.id ? (
                          <span className="text-xs text-teal-700 font-semibold">Saving...</span>
                        ) : (
                          <span className="text-xs text-slate-500"> </span>
                        )}
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {upcoming.length === 0 && (
                <div className="text-slate-600 p-6">
                  No upcoming BOP_Date records in the selected range.
                </div>
              )}
            </div>
          )}
        </Card>

        <Card title="All Records (Latest 500)">
          <div className="text-sm text-slate-600 mb-3">
            Tip: Use search to find a specific client quickly.
          </div>

          <div className="overflow-auto rounded-xl border border-slate-200">
            <table className="min-w-[1000px] w-full border-separate border-spacing-0 bg-white">
              <thead className="sticky top-0 bg-slate-50">
                <tr className="text-left text-xs uppercase tracking-wide text-slate-500">
                  <Th>Created</Th>
                  <Th>Client</Th>
                  <Th>Phone</Th>
                  <Th>Email</Th>
                  <Th>BOP_Date</Th>
                  <Th>BOP_Status</Th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50">
                    <Td>{new Date(r.created_at).toLocaleDateString()}</Td>
                    <Td className="font-semibold text-slate-800">
                      {(r.first_name || "") + " " + (r.last_name || "")}
                    </Td>
                    <Td>{r.phone || ""}</Td>
                    <Td className="max-w-[260px] truncate">{r.email || ""}</Td>
                    <Td>{r.BOP_Date ? new Date(r.BOP_Date).toLocaleString() : ""}</Td>
                    <Td>{r.BOP_Status || ""}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </div>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return <th className="border-b border-slate-200 px-3 py-3">{children}</th>;
}
function Td({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <td className={`border-b border-slate-100 px-3 py-3 align-top ${className}`}>{children}</td>;
}
