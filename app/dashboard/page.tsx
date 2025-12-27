"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import * as XLSX from "xlsx";
import { addDays, format, isValid, parseISO, startOfWeek } from "date-fns";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";

type Row = {
  id: string;
  created_at: string;

  first_name: string;
  last_name: string;
  phone: string;
  email: string;

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

const EDIT_FIELDS: (keyof Row)[] = [
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

export default function Dashboard() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [rangeStart, setRangeStart] = useState(format(new Date(), "yyyy-MM-dd"));
  const [rangeEnd, setRangeEnd] = useState(format(addDays(new Date(), 30), "yyyy-MM-dd"));
  const [savingId, setSavingId] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  // Auth guard
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) window.location.href = "/";
    });
  }, []);

  const fetchRows = async () => {
    setLoading(true);
    setErr(null);

    let query = supabase
      .from("client_registrations")
      .select(
        "id,created_at,first_name,last_name,phone,email,CalledOn,BOP_Date,BOP_Status,Followup_Date,FollowUp_Status,Product,Issued,Comment,Remark"
      )
      .order("created_at", { ascending: false })
      .limit(200);

    const search = q.trim();
    if (search) {
      // search by first/last/phone
      query = query.or(
        `first_name.ilike.%${search}%,last_name.ilike.%${search}%,phone.ilike.%${search}%`
      );
    }

    const { data, error } = await query;
    if (error) setErr(error.message);
    setRows((data || []) as Row[]);
    setLoading(false);
  };

  useEffect(() => {
    fetchRows();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
    // counts by week for BOP_Date (within the selected range)
    const map = new Map<string, number>();
    for (const r of upcoming) {
      const dt = parseISO(String(r.BOP_Date));
      if (!isValid(dt)) continue;
      const wk = startOfWeek(dt, { weekStartsOn: 1 }); // Monday
      const key = format(wk, "yyyy-MM-dd");
      map.set(key, (map.get(key) || 0) + 1);
    }
    return Array.from(map.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([weekStart, count]) => ({ weekStart, count }));
  }, [upcoming]);

  const updateCell = async (id: string, field: keyof Row, value: string) => {
    setSavingId(id);
    setErr(null);

    // For date/time fields: allow empty => null
    const payload: any = {};
    payload[field] = value?.trim() ? value : null;

    const { error } = await supabase.from("client_registrations").update(payload).eq("id", id);
    if (error) setErr(error.message);

    // update local state
    setRows((prev) =>
      prev.map((r) => (r.id === id ? ({ ...r, [field]: payload[field] } as Row) : r))
    );

    setSavingId(null);
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
    await supabase.auth.signOut();
    window.location.href = "/";
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-7xl mx-auto p-6 space-y-6">
        <header className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-center gap-3">
            <img src="/can-logo.png" className="h-10" alt="CAN Financial Solutions" />
            <div>
              <div className="text-2xl font-bold text-slate-800">Client Registration Reports</div>
              <div className="text-sm text-slate-500">Search, edit, upcoming meetings, export & trends</div>
            </div>
          </div>
          <button onClick={signOut} className="rounded-xl bg-white border border-slate-200 px-4 py-2 text-slate-700 hover:bg-slate-100">
            Sign out
          </button>
        </header>

        {err && (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-red-700">
            {err}
          </div>
        )}

        {/* Controls */}
        <div className="grid lg:grid-cols-3 gap-4">
          <Card title="Search">
            <div className="flex gap-2">
              <input
                className="w-full rounded-xl border border-slate-200 px-4 py-3"
                placeholder="First name, last name, or phone"
                value={q}
                onChange={(e) => setQ(e.target.value)}
              />
              <button
                onClick={fetchRows}
                className="rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-semibold px-4"
              >
                Go
              </button>
            </div>
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
                Upcoming records: <span className="font-semibold text-slate-800">{upcoming.length}</span>
              </div>
              <button
                onClick={exportXlsx}
                className="rounded-xl bg-white border border-slate-200 px-4 py-2 text-slate-700 hover:bg-slate-100"
              >
                Export XLSX
              </button>
            </div>
          </Card>

          <Card title="Weekly BOP Trend">
            <div className="h-40">
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

        {/* Upcoming table (editable) */}
        <Card title="Upcoming BOP Meetings (Editable)">
          {loading ? (
            <div className="text-slate-600">Loading...</div>
          ) : (
            <div className="overflow-auto">
              <table className="min-w-[1200px] w-full border-separate border-spacing-0">
                <thead>
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
                  </tr>
                </thead>
                <tbody>
                  {upcoming.map((r) => (
                    <tr key={r.id} className="bg-white">
                      <Td>
                        <div className="font-semibold text-slate-800">
                          {r.first_name} {r.last_name}
                        </div>
                        <div className="text-xs text-slate-500">Created: {new Date(r.created_at).toLocaleString()}</div>
                      </Td>
                      <Td>{r.phone}</Td>
                      <Td className="max-w-[240px] truncate">{r.email}</Td>

                      {EDIT_FIELDS.map((field) => (
                        <Td key={String(field)}>
                          <input
                            className="w-full rounded-lg border border-slate-200 px-2 py-2 text-sm"
                            value={(r[field] as any) ?? ""}
                            placeholder={field.toString()}
                            onChange={(e) => {
                              const v = e.target.value;
                              setRows((prev) =>
                                prev.map((x) => (x.id === r.id ? ({ ...x, [field]: v } as Row) : x))
                              );
                            }}
                            onBlur={(e) => updateCell(r.id, field, e.target.value)}
                          />
                        </Td>
                      ))}
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
                <div className="text-slate-600 py-6">No upcoming BOP_Date records in the selected range.</div>
              )}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl bg-white border border-slate-200 shadow-sm p-5">
      <div className="text-lg font-bold text-slate-800 mb-4">{title}</div>
      {children}
    </div>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return <th className="sticky top-0 bg-slate-50 border-b border-slate-200 px-3 py-3">{children}</th>;
}
function Td({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <td className={`border-b border-slate-100 px-3 py-3 align-top ${className}`}>{children}</td>;
}
