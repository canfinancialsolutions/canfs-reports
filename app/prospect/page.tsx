// app/prospect/page.tsx
'use client';

import { useEffect, useMemo, useState } from 'react';
import { createClient } from '@supabase/supabase-js';

type Prospect = {
  id: number;
  first_name: string;
  last_name: string | null;
  spouse_name: string | null;
  relation_type: string | null;
  phone: string | null;
  city: string | null;
  state: string | null;
  top25: string | null;
  immigration: string | null;
  age25plus: string | null;
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
  created_at: string;
  updated_at: string;
};

const PAGE_SIZE = 10;

const RESULT_OPTIONS = [
  '',
  'Business',
  'Both',
  'Client Solution',
  'In-Progress',
  'Called',
  'Not Interested',
  'Others',
];

export default function ProspectPage() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  const supabase = useMemo(
    () => createClient(supabaseUrl, supabaseKey),
    [supabaseUrl, supabaseKey],
  );

  const [prospects, setProspects] = useState<Prospect[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [resultFilter, setResultFilter] = useState<string>('');
  const [page, setPage] = useState(1);

  // FETCH from public.prospects
  const loadProspects = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('prospects')              // TABLE NAME FROM SCRIPT
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
    setResultFilter('');
    setPage(1);
    loadProspects();
  };

  // filter + search
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return prospects.filter((p) => {
      const matchSearch =
        !q ||
        p.first_name.toLowerCase().includes(q) ||
        (p.last_name || '').toLowerCase().includes(q) ||
        (p.spouse_name || '').toLowerCase().includes(q) ||
        (p.phone || '').toLowerCase().includes(q);

      const matchResult =
        !resultFilter || (p.result || '').toLowerCase() === resultFilter.toLowerCase();

      return matchSearch && matchResult;
    });
  }, [prospects, search, resultFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const start = (currentPage - 1) * PAGE_SIZE;
  const pageRows = filtered.slice(start, start + PAGE_SIZE);

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-6">
      {/* HEADER */}
      <div className="mx-auto mb-6 flex max-w-6xl items-center justify-between rounded-xl border bg-white px-6 py-4 shadow-sm">
        <div className="flex items-center gap-3">
          <img src="/can-logo.png" alt="CAN Financial Solutions" className="h-10 w-auto" />
          <div>
            <h1 className="text-xl font-bold text-slate-900">Prospect List Tracking</h1>
            <p className="text-xs text-slate-600">
              Based on CAN Financial Solutions Prospect List
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => {
            document.cookie = 'canfs_auth=; path=/; max-age=0';
            window.location.href = '/auth';
          }}
          className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-900 shadow-sm hover:bg-slate-50"
        >
          Logout
        </button>
      </div>

      {/* FILTER BAR */}
      <div className="mx-auto max-w-6xl space-y-4 rounded-xl border bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex flex-1 flex-col gap-2 md:flex-row md:items-center">
            <input
              type="text"
              placeholder="Search by first name, last name, spouse name, or phone..."
              className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm md:w-96"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
            />
            <select
              className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm md:w-56"
              value={resultFilter}
              onChange={(e) => {
                setResultFilter(e.target.value);
                setPage(1);
              }}
            >
              <option value="">All Results</option>
              {RESULT_OPTIONS.map((r) =>
                r ? (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ) : null,
              )}
            </select>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleRefresh}
              className="inline-flex h-10 items-center justify-center rounded-lg border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-900 hover:bg-slate-50"
            >
              Refresh
            </button>
            <div className="text-sm text-slate-500">
              Showing {pageRows.length} of {filtered.length} prospects
            </div>
          </div>
        </div>

        {/* TABLE */}
        <div className="rounded-xl border border-slate-200">
          <div className="overflow-x-auto">
            <table className="min-w-[1200px] w-full text-sm">
              <thead className="bg-slate-100 text-slate-700">
                <tr className="[&>th]:whitespace-nowrap [&>th]:px-3 [&>th]:py-2 [&>th]:text-left [&>th]:font-semibold">
                  <th>#</th>
                  <th>First Name</th>
                  <th>Last Name</th>
                  <th>Spouse Name</th>
                  <th>Relation Type</th>
                  <th>Phone</th>
                  <th>City</th>
                  <th>State</th>
                  <th>Top 25</th>
                  <th>Immigration</th>
                  <th>Age 25+</th>
                  <th>Married</th>
                  <th>Children</th>
                  <th>Homeowner</th>
                  <th>Good Career</th>
                  <th>Income 60K</th>
                  <th>Dissatisfied</th>
                  <th>Ambitious</th>
                  <th>Contact Date</th>
                  <th>Result</th>
                  <th>Next Steps</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={21} className="px-3 py-6 text-center text-slate-500">
                      Loading…
                    </td>
                  </tr>
                ) : pageRows.length === 0 ? (
                  <tr>
                    <td colSpan={21} className="px-3 py-6 text-center text-slate-500">
                      No prospects found.
                    </td>
                  </tr>
                ) : (
                  pageRows.map((p, idx) => (
                    <tr key={p.id} className="border-t hover:bg-slate-50">
                      <td className="px-3 py-2">{start + idx + 1}</td>
                      <td className="px-3 py-2">{p.first_name}</td>
                      <td className="px-3 py-2">{p.last_name || ''}</td>
                      <td className="px-3 py-2">{p.spouse_name || ''}</td>
                      <td className="px-3 py-2">{p.relation_type || ''}</td>
                      <td className="px-3 py-2">{p.phone || ''}</td>
                      <td className="px-3 py-2">{p.city || ''}</td>
                      <td className="px-3 py-2">{p.state || ''}</td>
                      <td className="px-3 py-2">{p.top25 || ''}</td>
                      <td className="px-3 py-2">{p.immigration || ''}</td>
                      <td className="px-3 py-2">{p.age25plus || ''}</td>
                      <td className="px-3 py-2">{p.married || ''}</td>
                      <td className="px-3 py-2">{p.children || ''}</td>
                      <td className="px-3 py-2">{p.homeowner || ''}</td>
                      <td className="px-3 py-2">{p.good_career || ''}</td>
                      <td className="px-3 py-2">{p.income_60k || ''}</td>
                      <td className="px-3 py-2">{p.dissatisfied || ''}</td>
                      <td className="px-3 py-2">{p.ambitious || ''}</td>
                      <td className="px-3 py-2">
                        {p.contact_date ? p.contact_date.toString().slice(0, 10) : ''}
                      </td>
                      <td className="px-3 py-2">{p.result || ''}</td>
                      <td className="px-3 py-2">{p.next_steps || ''}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* PAGINATION */}
          <div className="flex items-center justify-between px-3 py-3">
            <div className="text-sm text-slate-600">
              Page {currentPage} of {totalPages}
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={currentPage === 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                Prev
              </button>
              <button
                type="button"
                disabled={currentPage === totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                Next
              </button>
            </div>
          </div>
        </div>

        {/* Footer actions */}
        <div className="flex items-center justify-between pt-2">
          <button
            type="button"
            className="inline-flex h-10 items-center justify-center rounded-lg border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-900 hover:bg-slate-50"
          >
            New Prospect
          </button>
          <div className="text-xs text-slate-500" />
        </div>
      </div>
    </div>
  );
}
