'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';

type Prospect = {
  id: number;
  first_name: string;
  last_name: string;
  spouse: string | null;
  relation_type: string | null;
  phone: string | null;
  city_state: string | null;
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

// Dropdown options
const YN_OPTIONS = [
  { value: '', label: '—' },
  { value: 'Y', label: 'Yes' },
  { value: 'N', label: 'No' }
];

const RELATION_OPTIONS = [
  { value: '', label: '—' },
  { value: 'Friend', label: 'Friend (F)' },
  { value: 'Relative', label: 'Relative (R)' },
  { value: 'Acquaintance', label: 'Acquaintance (A)' },
  { value: 'Referral', label: 'Referral' },
  { value: 'Others', label: 'Others' }
];

const STATE_OPTIONS = [
  { value: '', label: '—' },
  { value: 'TX', label: 'Texas (TX)' },
  { value: 'NE', label: 'Nebraska (NE)' },
  { value: 'CA', label: 'California (CA)' },
  { value: 'FL', label: 'Florida (FL)' },
  { value: 'NY', label: 'New York (NY)' }
  // Add more states as needed
];

const RESULT_OPTIONS = [
  { value: '', label: '—' },
  { value: 'Business', label: 'Business' },
  { value: 'Both', label: 'Both' },
  { value: 'Client Solution', label: 'Client Solution' },
  { value: 'In-Progress', label: 'In-Progress' },
  { value: 'Called', label: 'Called' },
  { value: 'Not Interested', label: 'Not Interested' },
  { value: 'Others', label: 'Others' }
];

function SelectDropdown({
  value,
  options,
  onChange,
  placeholder
}: {
  value: string | null;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <select
      value={value || ''}
      onChange={(e) => onChange(e.target.value)}
      className="w-full rounded-lg border border-slate-200 px-3 py-1.5 text-xs focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
    >
      <option value="">{placeholder || 'Select'}</option>
      {options.map((opt) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
  );
}

export default function ProspectListPage() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  // States
  const [prospects, setProspects] = useState<Prospect[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [resultFilter, setResultFilter] = useState<string>('');
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<Partial<Prospect>>({});
  const [page, setPage] = useState(1);

  const loadProspects = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('prospects')
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

  const startEdit = (prospect: Prospect) => {
    setEditingId(prospect.id);
    setEditForm({
      first_name: prospect.first_name,
      last_name: prospect.last_name,
      spouse: prospect.spouse || '',
      relation_type: prospect.relation_type || '',
      phone: prospect.phone || '',
      city_state: prospect.city_state || '',
      top25: prospect.top25 || '',
      immigration: prospect.immigration || '',
      age25plus: prospect.age25plus || '',
      married: prospect.married || '',
      children: prospect.children || '',
      homeowner: prospect.homeowner || '',
      good_career: prospect.good_career || '',
      income_60k: prospect.income_60k || '',
      dissatisfied: prospect.dissatisfied || '',
      ambitious: prospect.ambitious || '',
      contact_date: prospect.contact_date || '',
      result: prospect.result || '',
      next_steps: prospect.next_steps || '',
      comments: prospect.comments || ''
    });
  };

  const saveEdit = async () => {
    if (!editingId || !editForm.first_name || !editForm.last_name) return;

    const { error } = await supabase
      .from('prospects')
      .update({
        ...editForm,
        updated_at: new Date().toISOString()
      })
      .eq('id', editingId);

    if (!error) {
      setEditingId(null);
      setEditForm({});
      loadProspects();
    }
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditForm({});
  };

  const filtered = prospects.filter((p) => {
    const q = search.trim().toLowerCase();
    const matchSearch =
      !q ||
      p.first_name.toLowerCase().includes(q) ||
      p.last_name.toLowerCase().includes(q) ||
      (p.phone || '').toLowerCase().includes(q);
    const matchResult = !resultFilter || p.result === resultFilter;
    return matchSearch && matchResult;
  });

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const currentPage = Math.min(page, totalPages);
  const start = (currentPage - 1) * PAGE_SIZE;
  const pageRows = filtered.slice(start, start + PAGE_SIZE);

  return (
    <div className="min-h-screen bg-slate-50 p-4 sm:p-6">
      {/* Header */}
      <div className="mx-auto mb-6 max-w-7xl rounded-xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-lg bg-blue-600 flex items-center justify-center">
              <span className="text-xl font-bold text-white">CAN</span>
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900">Prospect List</h1>
              <p className="text-sm text-slate-600">CAN Financial Solutions Tracking</p>
            </div>
          </div>
          <button
            className="rounded-lg bg-red-600 px-6 py-2.5 text-sm font-semibold text-white shadow hover:bg-red-700"
            onClick={() => window.location.href = '/auth'}
          >
            ← Logout
          </button>
        </div>
      </div>

      <div className="mx-auto max-w-7xl">
        {/* Controls */}
        <div className="mb-6 rounded-xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-1 flex-col gap-3 lg:flex-row lg:items-center">
              <input
                type="text"
                placeholder="Search by first name, last name, or phone..."
                className="flex-1 rounded-lg border border-slate-200 px-4 py-2.5 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
              />
              <select
                className="w-full max-w-xs rounded-lg border border-slate-200 px-4 py-2.5 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 lg:w-auto"
                value={resultFilter}
                onChange={(e) => {
                  setResultFilter(e.target.value);
                  setPage(1);
                }}
              >
                <option value="">All Results</option>
                {RESULT_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
            <button
              className="rounded-lg border border-slate-300 bg-white px-6 py-2.5 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
              onClick={handleRefresh}
            >
              🔄 Refresh
            </button>
          </div>
          <div className="mt-3 text-sm text-slate-600">
            Showing {pageRows.length} of {filtered.length} prospects (Page {currentPage} of {totalPages})
          </div>
        </div>

        {/* Table */}
        <div className="overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-slate-200">
          <div className="max-h-[600px] overflow-auto">
            <table className="w-full text-xs">
              <thead className="bg-slate-50 text-slate-600">
                <tr>
                  <th className="w-12 px-3 py-3 text-left font-semibold">#</th>
                  <th className="px-3 py-3 text-left font-semibold">Name</th>
                  <th className="w-24 px-3 py-3 text-left font-semibold">Spouse</th>
                  <th className="w-24 px-3 py-3 text-left font-semibold">Relation</th>
                  <th className="w-28 px-3 py-3 text-left font-semibold">Phone</th>
                  <th className="w-28 px-3 py-3 text-left font-semibold">City/State</th>
                  <th className="w-16 px-2 py-3 text-left font-semibold">Top25</th>
                  <th className="w-20 px-2 py-3 text-left font-semibold">Immigration</th>
                  <th className="w-14 px-2 py-3 text-left font-semibold">25+</th>
                  <th className="w-14 px-2 py-3 text-left font-semibold">Married</th>
                  <th className="w-14 px-2 py-3 text-left font-semibold">Kids</th>
                  <th className="w-16 px-2 py-3 text-left font-semibold">Home</th>
                  <th className="w-14 px-2 py-3 text-left font-semibold">Career</th>
                  <th className="w-14 px-2 py-3 text-left font-semibold">$60K</th>
                  <th className="w-16 px-2 py-3 text-left font-semibold">Dissatisfied</th>
                  <th className="w-14 px-2 py-3 text-left font-semibold">Ambitious</th>
                  <th className="w-20 px-2 py-3 text-left font-semibold">Contact</th>
                  <th className="w-24 px-3 py-3 text-left font-semibold">Result</th>
                  <th className="w-20 px-3 py-3 text-left font-semibold">Next</th>
                  <th className="px-3 py-3 text-left font-semibold">Comments</th>
                  <th className="w-28 px-3 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  <tr>
                    <td colSpan={21} className="py-12 text-center text-sm text-slate-500">
                      Loading prospects...
                    </td>
                  </tr>
                ) : pageRows.length === 0 ? (
                  <tr>
                    <td colSpan={21} className="py-12 text-center text-sm text-slate-500">
                      No prospects match your filters
                    </td>
                  </tr>
                ) : (
                  pageRows.map((prospect) => (
                    <tr key={prospect.id} className="hover:bg-slate-50">
                      <td className="px-3 py-3 font-mono text-sm">{prospect.id}</td>
                      <td className="px-3 py-3 font-medium">
                        {editingId === prospect.id ? (
                          <div className="space-y-1">
                            <input
                              value={editForm.first_name || ''}
                              onChange={(e) => setEditForm({ ...editForm, first_name: e.target.value })}
                              className="w-full rounded border border-slate-300 px-2 py-1 text-xs"
                              maxLength={100}
                            />
                            <input
                              value={editForm.last_name || ''}
                              onChange={(e) => setEditForm({ ...editForm, last_name: e.target.value })}
                              className="w-full rounded border border-slate-300 px-2 py-1 text-xs"
                              maxLength={100}
                            />
                          </div>
                        ) : (
                          `${prospect.first_name} ${prospect.last_name}`
                        )}
                      </td>
                      <td className="px-3 py-3">
                        {editingId === prospect.id ? (
                          <input
                            value={editForm.spouse || ''}
                            onChange={(e) => setEditForm({ ...editForm, spouse: e.target.value })}
                            className="w-full rounded border border-slate-
