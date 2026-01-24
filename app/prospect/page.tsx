
// app/prospect/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';

type Prospect = {
  id: number;
  name: string;
  spouse: string | null;
  relation_type: string | null; // F / R / A
  phone: string | null;
  city_state: string | null;
  top25: string | null;
  immigration: string | null;
  age25plus: string | null;   // Y / N
  married: string | null;
  children: string | null;
  homeowner: string | null;
  good_career: string | null;
  income_60k: string | null;
  dissatisfied: string | null;
  ambitious: string | null;
  contact_date: string | null;
  result: string | null;
  next_steps: string | null;
  comments: string | null;
};

const PAGE_SIZE = 10;

export default function ProspectListPage() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  const [prospects, setProspects] = useState<Prospect[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [resultFilter, setResultFilter] = useState<string>('ALL');
  const [page, setPage] = useState(1);

  const loadProspects = async () => {
    setLoading(true);

    const { data, error } = await supabase
      .from('prospects') // create table in Supabase using columns above
      .select('*')
      .order('id', { ascending: true });

    if (!error && data) {
      setProspects(data as Prospect[]);
    }

    setLoading(false);
  };

  useEffect(() => {
    loadProspects();
  }, []);

  const handleRefresh = () => {
    setSearch('');
    setResultFilter('ALL');
    setPage(1);
    loadProspects();
  };

  const filtered = prospects.filter((p) => {
    const q = search.trim().toLowerCase();
    const matchSearch =
      !q ||
      (p.name || '').toLowerCase().includes(q) ||
      (p.spouse || '').toLowerCase().includes(q) ||
      (p.phone || '').toLowerCase().includes(q);
    const matchResult =
      resultFilter === 'ALL' ||
      (p.result || '').toLowerCase() === resultFilter.toLowerCase();
    return matchSearch && matchResult;
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const start = (currentPage - 1) * PAGE_SIZE;
  const pageRows = filtered.slice(start, start + PAGE_SIZE);

  const uniqueResults = Array.from(
    new Set(
      prospects
        .map((p) => (p.result || '').trim())
        .filter((v) => v.length > 0)
    )
  ).sort();

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-6">
      {/* Header with logo + exit */}
      <div className="mx-auto mb-6 flex max-w-6xl items-center justify-between rounded-xl border bg-white px-6 py-4 shadow-sm">
        <div className="flex items-center gap-3">
          <img
            src="/can-logo.png"
            alt="CAN Financial Solutions"
            className="h-10 w-auto"
          />
          <div>
            <h1 className="text-xl font-bold text-slate-900">
              Prospect List Tracking
            </h1>
            <p className="text-xs text-slate-600">
              Based on CAN Financial Solutions Prospect List
            </p>
          </div>
        </div>
        <button
          className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-red-700"
          onClick={() => (window.location.href = '/auth')}
        >
          ← Logout
        </button>
      </div>

      <div className="mx-auto max-w-6xl space-y-4 rounded-xl border bg-white p-4 shadow-sm">
        {/* Controls */}
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex flex-1 flex-col gap-2 md:flex-row md:items-center">
            <input
              type="text"
              placeholder="Search by first name, last name, or phone..."
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm md:w-80"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
            />
            <select
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm md:w-48"
              value={resultFilter}
              onChange={(e) => {
                setResultFilter(e.target.value);
                setPage(1);
              }}
            >
              <option value="ALL">All Results</option>
              {uniqueResults.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              onClick={handleRefresh}
            >
              Refresh
            </button>
            <span className="text-xs text-slate-500">
              Showing {pageRows.length} of {filtered.length} filtered prospects
            </span>
          </div>
        </div>

        {/* Table */}
        <div className="max-h-[520px] overflow-auto rounded-lg border">
          <table className="min-w-full text-xs">
            <thead className="bg-slate-100 text-[11px] uppercase tracking-wide text-slate-600">
              <tr>
                <th className="px-2 py-2 text-left">#</th>
                <th className="px-2 py-2 text-left">Name</th>
                <th className="px-2 py-2 text-left">Spouse</th>
                <th className="px-2 py-2 text-left">F/R/A</th>
                <th className="px-2 py-2 text-left">Phone</th>
                <th className="px-2 py-2 text-left">City &amp; State</th>
                <th className="px-2 py-2 text-left">Top 25</th>
                <th className="px-2 py-2 text-left">Immigration</th>
                <th className="px-2 py-2 text-left">25+</th>
                <th className="px-2 py-2 text-left">Married</th>
                <th className="px-2 py-2 text-left">Children</th>
                <th className="px-2 py-2 text-left">Homeowner</th>
                <th className="px-2 py-2 text-left">Career</th>
                <th className="px-2 py-2 text-left">$60K+</th>
                <th className="px-2 py-2 text-left">Dissatisfied</th>
                <th className="px-2 py-2 text-left">Ambitious</th>
                <th className="px-2 py-2 text-left">Contact Date</th>
                <th className="px-2 py-2 text-left">Result</th>
                <th className="px-2 py-2 text-left">Next Steps</th>
                <th className="px-2 py-2 text-left">Comments</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td
                    colSpan={20}
                    className="px-3 py-4 text-center text-xs text-slate-500"
                  >
                    Loading prospects...
                  </td>
                </tr>
              )}
              {!loading && pageRows.length === 0 && (
                <tr>
                  <td
                    colSpan={20}
                    className="px-3 py-4 text-center text-xs text-slate-500"
                  >
                    No prospects found.
                  </td>
                </tr>
              )}
              {!loading &&
                pageRows.map((p) => (
                  <tr key={p.id} className="border-t hover:bg-slate-50">
                    <td className="px-2 py-2">{p.id}</td>
                    <td className="px-2 py-2">{p.name}</td>
                    <td className="px-2 py-2">{p.spouse}</td>
                    <td className="px-2 py-2">{p.relation_type}</td>
                    <td className="px-2 py-2">{p.phone}</td>
                    <td className="px-2 py-2">{p.city_state}</td>
                    <td className="px-2 py-2">{p.top25}</td>
                    <td className="px-2 py-2">{p.immigration}</td>
                    <td className="px-2 py-2">{p.age25plus}</td>
                    <td className="px-2 py-2">{p.married}</td>
                    <td className="px-2 py-2">{p.children}</td>
                    <td className="px-2 py-2">{p.homeowner}</td>
                    <td className="px-2 py-2">{p.good_career}</td>
                    <td className="px-2 py-2">{p.income_60k}</td>
                    <td className="px-2 py-2">{p.dissatisfied}</td>
                    <td className="px-2 py-2">{p.ambitious}</td>
                    <td className="px-2 py-2">{p.contact_date}</td>
                    <td className="px-2 py-2">{p.result}</td>
                    <td className="px-2 py-2">{p.next_steps}</td>
                    <td className="px-2 py-2">{p.comments}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="flex items-center justify-between pt-2 text-xs text-slate-600">
          <span>
            Page {currentPage} of {totalPages}
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={currentPage === 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="rounded-md border border-slate-300 px-2 py-1 disabled:opacity-40"
            >
              Prev
            </button>
            <button
              type="button"
              disabled={currentPage === totalPages}
              onClick={() =>
                setPage((p) => Math.min(totalPages, p + 1))
              }
              className="rounded-md border border-slate-300 px-2 py-1 disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
