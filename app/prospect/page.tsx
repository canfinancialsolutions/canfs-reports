// app/prospect/page.tsx
'use client';

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { createClient } from '@supabase/supabase-js';

type Prospect = {
  id: number;
  first_name: string; // NOT NULL
  last_name: string | null;
  spouse_name: string | null;
  relation_type: string | null; // Friend / Relative / Acquaintance / Referral/Others
  phone: string | null;
  city: string | null;
  state: string | null; // two-letter abbreviation
  top25: string | null; // Y / N
  immigration: string | null; // H1B / GC / C / EAD etc.
  age25plus: string | null; // Y / N
  married: string | null; // Y / N
  children: string | null; // Y / N
  homeowner: string | null; // Y / N
  good_career: string | null; // Y / N
  income_60k: string | null; // Y / N
  dissatisfied: string | null; // Y / N
  ambitious: string | null; // Y / N
  contact_date: string | null; // YYYY-MM-DD
  result: string | null; // Business / Both / Client Solution / In-Progress / Called / Not Interested / Others
  next_steps: string | null;
  comments: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

type ProspectForm = {
  first_name: string;
  last_name: string;
  spouse_name: string;
  relation_type: string;
  phone: string;
  city: string;
  state: string;
  top25: string;
  immigration: string;
  age25plus: string;
  married: string;
  children: string;
  homeowner: string;
  good_career: string;
  income_60k: string;
  dissatisfied: string;
  ambitious: string;
  contact_date: string;
  result: string;
  next_steps: string;
  comments: string;
};

const PAGE_SIZE = 10;

const RELATION_OPTIONS = ['Friend', 'Relative', 'Acquaintance', 'Referral/Others'] as const;
const RESULT_OPTIONS = ['Business', 'Both', 'Client Solution', 'In-Progress', 'Called', 'Not Interested', 'Others'] as const;

const IMMIGRATION_STATUS_OPTIONS: string[] = [
  \"\",
  \"U.S. Citizen\",
  \"U.S.Green Card\",
  \"H-1B\",
  \"H-1B/I-140 Approved\",
  \"L-1A\",
  \"L-1B\",
  \"F-1 Student\",
  \"F-1 OPT\",
  \"F-1 STEM OPT\",
  \"H-4 EAD\",
  \"E-3\",
  \"I-485 Pending\",
  \"I-485 EAD/AP\",
  \"Other Visa Status\",
];

const STATES = [
  { abbr: 'AL', name: 'Alabama' },
  { abbr: 'AK', name: 'Alaska' },
  { abbr: 'AZ', name: 'Arizona' },
  { abbr: 'AR', name: 'Arkansas' },
  { abbr: 'CA', name: 'California' },
  { abbr: 'CO', name: 'Colorado' },
  { abbr: 'CT', name: 'Connecticut' },
  { abbr: 'DE', name: 'Delaware' },
  { abbr: 'DC', name: 'District of Columbia' },
  { abbr: 'FL', name: 'Florida' },
  { abbr: 'GA', name: 'Georgia' },
  { abbr: 'HI', name: 'Hawaii' },
  { abbr: 'ID', name: 'Idaho' },
  { abbr: 'IL', name: 'Illinois' },
  { abbr: 'IN', name: 'Indiana' },
  { abbr: 'IA', name: 'Iowa' },
  { abbr: 'KS', name: 'Kansas' },
  { abbr: 'KY', name: 'Kentucky' },
  { abbr: 'LA', name: 'Louisiana' },
  { abbr: 'ME', name: 'Maine' },
  { abbr: 'MD', name: 'Maryland' },
  { abbr: 'MA', name: 'Massachusetts' },
  { abbr: 'MI', name: 'Michigan' },
  { abbr: 'MN', name: 'Minnesota' },
  { abbr: 'MS', name: 'Mississippi' },
  { abbr: 'MO', name: 'Missouri' },
  { abbr: 'MT', name: 'Montana' },
  { abbr: 'NE', name: 'Nebraska' },
  { abbr: 'NV', name: 'Nevada' },
  { abbr: 'NH', name: 'New Hampshire' },
  { abbr: 'NJ', name: 'New Jersey' },
  { abbr: 'NM', name: 'New Mexico' },
  { abbr: 'NY', name: 'New York' },
  { abbr: 'NC', name: 'North Carolina' },
  { abbr: 'ND', name: 'North Dakota' },
  { abbr: 'OH', name: 'Ohio' },
  { abbr: 'OK', name: 'Oklahoma' },
  { abbr: 'OR', name: 'Oregon' },
  { abbr: 'PA', name: 'Pennsylvania' },
  { abbr: 'RI', name: 'Rhode Island' },
  { abbr: 'SC', name: 'South Carolina' },
  { abbr: 'SD', name: 'South Dakota' },
  { abbr: 'TN', name: 'Tennessee' },
  { abbr: 'TX', name: 'Texas' },
  { abbr: 'UT', name: 'Utah' },
  { abbr: 'VT', name: 'Vermont' },
  { abbr: 'VA', name: 'Virginia' },
  { abbr: 'WA', name: 'Washington' },
  { abbr: 'WV', name: 'West Virginia' },
  { abbr: 'WI', name: 'Wisconsin' },
  { abbr: 'WY', name: 'Wyoming' },
] as const;

const ynNormalize = (v?: string | null) => {
  const s = (v || '').trim().toLowerCase();
  if (!s) return '';
  if (s === 'y' || s === 'yes' || s === 'true') return 'Y';
  if (s === 'n' || s === 'no' || s === 'false') return 'N';
  return v || '';
};

const normText = (s: string) =>
  s
    .trim()
    .toLowerCase()
    .replace(/[\u2010\u2011\u2012\u2013\u2014\u2015\u2212]/g, '-');

const toNull = (s: string | null | undefined) => {
  const v = (s ?? '').trim();
  return v.length ? v : null;
};

const emptyForm = (): ProspectForm => ({
  first_name: '',
  last_name: '',
  spouse_name: '',
  relation_type: '',
  phone: '',
  city: '',
  state: '',
  top25: '',
  immigration: '',
  age25plus: '',
  married: '',
  children: '',
  homeowner: '',
  good_career: '',
  income_60k: '',
  dissatisfied: '',
  ambitious: '',
  contact_date: '',
  result: '',
  next_steps: '',
  comments: '',
});

const formFromProspect = (p: Prospect): ProspectForm => ({
  first_name: p.first_name || '',
  last_name: p.last_name || '',
  spouse_name: p.spouse_name || '',
  relation_type: p.relation_type || '',
  phone: p.phone || '',
  city: p.city || '',
  state: (p.state || '').toUpperCase(),
  top25: ynNormalize(p.top25),
  immigration: p.immigration || '',
  age25plus: ynNormalize(p.age25plus),
  married: ynNormalize(p.married),
  children: ynNormalize(p.children),
  homeowner: ynNormalize(p.homeowner),
  good_career: ynNormalize(p.good_career),
  income_60k: ynNormalize(p.income_60k),
  dissatisfied: ynNormalize(p.dissatisfied),
  ambitious: ynNormalize(p.ambitious),
  contact_date: (p.contact_date || '').slice(0, 10),
  result: p.result || '',
  next_steps: p.next_steps || '',
  comments: p.comments || '',
});

const isDirtyVsOriginal = (form: ProspectForm, original: Prospect) => {
  const o = formFromProspect(original);
  // Compare normalized form values to avoid false positives from casing.
  const keys = Object.keys(form) as (keyof ProspectForm)[];
  return keys.some((k) => {
    const a = String(form[k] ?? '').trim();
    const b = String(o[k] ?? '').trim();
    if (k === 'state') return a.toUpperCase() !== b.toUpperCase();
    return a !== b;
  });
};

const Field = ({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) => (
  <div className="flex flex-col gap-1">
    <label className="text-xs font-semibold text-slate-700">{label}</label>
    {children}
  </div>
);

const TextInput = ({
  value,
  onChange,
  placeholder,
  disabled,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  disabled?: boolean;
}) => (
  <input
    type="text"
    className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900"
    value={value}
    disabled={disabled}
    placeholder={placeholder}
    onChange={(e) => onChange(e.target.value)}
  />
);

const DateInput = ({
  value,
  onChange,
  disabled,
}: {
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
}) => (
  <input
    type="date"
    className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900"
    value={(value || '').slice(0, 10)}
    disabled={disabled}
    onChange={(e) => onChange(e.target.value)}
  />
);

const YesNoSelect = ({
  value,
  onChange,
  disabled,
}: {
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
}) => (
  <select
    className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900"
    value={ynNormalize(value)}
    disabled={disabled}
    onChange={(e) => onChange(e.target.value)}
  >
    <option value=""></option>
    <option value="Y">Yes</option>
    <option value="N">No</option>
  </select>

const LogoutIcon = ({ className }: { className?: string }) => (
  <svg
    viewBox="0 0 24 24"
    aria-hidden="true"
    className={className || 'h-4 w-4'}
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
    <polyline points="16 17 21 12 16 7" />
    <line x1="21" y1="12" x2="9" y2="12" />
  </svg>
);

);

export default function ProspectListPage() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  const supabase = useMemo(() => {
    if (!supabaseUrl || !supabaseKey) return null;
    return createClient(supabaseUrl, supabaseKey);
  }, [supabaseUrl, supabaseKey]);

  const [prospects, setProspects] = useState<Prospect[]>([]);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [successMsg, setSuccessMsg] = useState<string>('');

  const [search, setSearch] = useState('');
  const [resultFilter, setResultFilter] = useState<string>('ALL');
  const [page, setPage] = useState(1);

  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [selectedOriginal, setSelectedOriginal] = useState<Prospect | null>(null);
  const [selectedForm, setSelectedForm] = useState<ProspectForm>(emptyForm());
  const [savingSelected, setSavingSelected] = useState(false);

  const [showNew, setShowNew] = useState(false);
  const [newProspect, setNewProspect] = useState<ProspectForm>(emptyForm());
  const [inserting, setInserting] = useState(false);

  const setToast = (kind: 'success' | 'error', msg: string) => {
    if (kind === 'success') {
      setSuccessMsg(msg);
      setErrorMsg('');
    } else {
      setErrorMsg(msg);
      setSuccessMsg('');
    }
    window.setTimeout(() => {
      setSuccessMsg('');
      setErrorMsg('');
    }, 3500);
  };

  const loadProspects = async () => {
    if (!supabase) {
      setToast('error', 'Missing Supabase environment variables (NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY).');
      return;
    }

    setLoading(true);
    setErrorMsg('');

    const { data, error } = await supabase.from('prospects').select('*').order('id', { ascending: true });

    if (error) {
      setToast('error', error.message);
      setLoading(false);
      return;
    }

    const rows = (data || []) as Prospect[];
    setProspects(rows);
    setLoading(false);

    // Keep selection in sync after reload
    if (selectedId != null) {
      const updated = rows.find((r) => r.id === selectedId) || null;
      if (!updated) {
        setSelectedId(null);
        setSelectedOriginal(null);
        setSelectedForm(emptyForm());
      } else if (selectedOriginal && !isDirtyVsOriginal(selectedForm, selectedOriginal)) {
        setSelectedOriginal(updated);
        setSelectedForm(formFromProspect(updated));
      } else {
        setSelectedOriginal(updated);
      }
    }
  };

  useEffect(() => {
    loadProspects();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabase]);

  const filtered = prospects.filter((p) => {
    const q = search.trim().toLowerCase();
    const matchSearch =
      !q ||
      (p.first_name || '').toLowerCase().includes(q) ||
      (p.last_name || '').toLowerCase().includes(q) ||
      (p.spouse_name || '').toLowerCase().includes(q) ||
      (p.phone || '').toLowerCase().includes(q);

    const matchResult = resultFilter === 'ALL' || normText(p.result || '') === normText(resultFilter);

    return matchSearch && matchResult;
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const start = (currentPage - 1) * PAGE_SIZE;
  const pageRows = filtered.slice(start, start + PAGE_SIZE);

  const selectedDirty = selectedOriginal ? isDirtyVsOriginal(selectedForm, selectedOriginal) : false;

  const handleSelectRow = (p: Prospect) => {
    if (savingSelected) return;
    if (selectedOriginal && selectedDirty && p.id !== selectedId) {
      setToast('error', 'You have unsaved changes. Please Save or Cancel before selecting another prospect.');
      return;
    }

    setSelectedId(p.id);
    setSelectedOriginal(p);
    setSelectedForm(formFromProspect(p));
  };

  const handleCancelSelected = () => {
    if (!selectedOriginal) return;
    setSelectedForm(formFromProspect(selectedOriginal));
  };

  const saveSelected = async () => {
    if (!supabase) {
      setToast('error', 'Missing Supabase environment variables.');
      return;
    }
    if (!selectedOriginal || selectedId == null) {
      setToast('error', 'Please select a prospect row first.');
      return;
    }

    const first = selectedForm.first_name.trim();
    if (!first) {
      setToast('error', 'First Name is required.');
      return;
    }

    setSavingSelected(true);

    const payload: Partial<Omit<Prospect, 'id'>> = {
      first_name: first,
      last_name: toNull(selectedForm.last_name),
      spouse_name: toNull(selectedForm.spouse_name),
      relation_type: toNull(selectedForm.relation_type),
      phone: toNull(selectedForm.phone),
      city: toNull(selectedForm.city),
      state: (() => {
        const s = (selectedForm.state || '').trim();
        return s ? s.toUpperCase() : null;
      })(),
      top25: ynNormalize(selectedForm.top25) || null,
      immigration: toNull(selectedForm.immigration),
      age25plus: ynNormalize(selectedForm.age25plus) || null,
      married: ynNormalize(selectedForm.married) || null,
      children: ynNormalize(selectedForm.children) || null,
      homeowner: ynNormalize(selectedForm.homeowner) || null,
      good_career: ynNormalize(selectedForm.good_career) || null,
      income_60k: ynNormalize(selectedForm.income_60k) || null,
      dissatisfied: ynNormalize(selectedForm.dissatisfied) || null,
      ambitious: ynNormalize(selectedForm.ambitious) || null,
      contact_date: toNull(selectedForm.contact_date),
      result: toNull(selectedForm.result),
      next_steps: toNull(selectedForm.next_steps),
      comments: toNull(selectedForm.comments),
      updated_at: new Date().toISOString(),
    };

    const { error } = await supabase.from('prospects').update(payload).eq('id', selectedId);

    if (error) {
      setToast('error', error.message);
      setSavingSelected(false);
      return;
    }

    setToast('success', `Saved prospect #${selectedId}`);
    setSavingSelected(false);
    await loadProspects();
  };

  const insertNew = async () => {
    if (!supabase) {
      setToast('error', 'Missing Supabase environment variables.');
      return;
    }

    const first_name = newProspect.first_name.trim();
    if (!first_name) {
      setToast('error', 'First Name is required.');
      return;
    }

    setInserting(true);

    const payload: Omit<Prospect, 'id'> = {
      first_name,
      last_name: toNull(newProspect.last_name),
      spouse_name: toNull(newProspect.spouse_name),
      relation_type: toNull(newProspect.relation_type),
      phone: toNull(newProspect.phone),
      city: toNull(newProspect.city),
      state: (() => {
        const s = (newProspect.state || '').trim();
        return s ? s.toUpperCase() : null;
      })(),
      top25: ynNormalize(newProspect.top25) || null,
      immigration: toNull(newProspect.immigration),
      age25plus: ynNormalize(newProspect.age25plus) || null,
      married: ynNormalize(newProspect.married) || null,
      children: ynNormalize(newProspect.children) || null,
      homeowner: ynNormalize(newProspect.homeowner) || null,
      good_career: ynNormalize(newProspect.good_career) || null,
      income_60k: ynNormalize(newProspect.income_60k) || null,
      dissatisfied: ynNormalize(newProspect.dissatisfied) || null,
      ambitious: ynNormalize(newProspect.ambitious) || null,
      contact_date: toNull(newProspect.contact_date),
      result: toNull(newProspect.result),
      next_steps: toNull(newProspect.next_steps),
      comments: toNull(newProspect.comments),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const { error } = await supabase.from('prospects').insert(payload);

    if (error) {
      setToast('error', error.message);
      setInserting(false);
      return;
    }

    setToast('success', 'Prospect added.');
    setNewProspect(emptyForm());
    setInserting(false);
    setShowNew(false);
    setPage(1);
    await loadProspects();
  };

  const handleRefresh = async () => {
    if (selectedOriginal && selectedDirty) {
      setToast('error', 'You have unsaved changes. Please Save or Cancel before refreshing.');
      return;
    }
    setSearch('');
    setResultFilter('ALL');
    setPage(1);
    setShowNew(false);
    setNewProspect(emptyForm());
    setSelectedId(null);
    setSelectedOriginal(null);
    setSelectedForm(emptyForm());
    await loadProspects();
  };

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-6">
      {/* Header */}
      <div className="mx-auto mb-6 flex max-w-6xl items-center justify-between rounded-xl border bg-white px-6 py-4 shadow-sm">
        <div className="flex items-center gap-3">
          <img src="/can-logo.png" alt="CAN Financial Solutions" className="h-10 w-auto" />
          <div>
            <h1 className="text-xl font-bold text-slate-900">Prospect List Tracking</h1>
            <p className="text-xs text-slate-600">Based on CAN Financial Solutions Prospect List</p>
          </div>
        </div>
        <button
          type="button"
          className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-900 shadow-sm hover:bg-slate-50"
          onClick={() => (window.location.href = '/auth')}
        >
          <LogoutIcon className="h-4 w-4" />
          Logout
        </button>
      </div>

      <div className="mx-auto max-w-6xl space-y-4 rounded-xl border bg-white p-4 shadow-sm">
        {/* Toasts */}
        {(errorMsg || successMsg) && (
          <div
            className={`rounded-lg border px-3 py-2 text-sm ${
              errorMsg ? 'border-red-200 bg-red-50 text-red-700' : 'border-emerald-200 bg-emerald-50 text-emerald-700'
            }`}
          >
            {errorMsg || successMsg}
          </div>
        )}

        {/* Controls */}
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
              <option value="ALL">All Results</option>
              {RESULT_OPTIONS.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              onClick={() => setShowNew((v) => !v)}
            >
              {showNew ? 'Hide New Prospect' : 'Add New Prospect'}
            </button>

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

        {/* Table (read-only list) */}
        <div className="rounded-lg border">
          <div className="max-h-[520px] overflow-auto">
            <table className="min-w-full text-xs">
              <thead className="sticky top-0 bg-slate-100">
                <tr>
                  {[
                    '#',
                    'First Name',
                    'Last Name',
                    'Spouse Name',
                    'Relation Type',
                    'Phone',
                    'City',
                    'State',
                    'Top 25',
                    'Immigration',
                    'Age 25+',
                    'Married',
                    'Children',
                    'Homeowner',
                    'Good Career',
                    'Income 60K',
                    'Dissatisfied',
                    'Ambitious',
                    'Contact Date',
                    'Result',
                    'Next Steps',
                    'Comments',
                  ].map((h) => (
                    <th
                      key={h}
                      className="whitespace-nowrap px-2 py-2 text-left text-[11px] font-semibold tracking-wide text-slate-700"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>

              <tbody>
                {loading && (
                  <tr>
                    <td colSpan={22} className="px-3 py-4 text-center text-xs text-slate-500">
                      Loading prospects...
                    </td>
                  </tr>
                )}

                {!loading && pageRows.length === 0 && (
                  <tr>
                    <td colSpan={22} className="px-3 py-4 text-center text-xs text-slate-500">
                      No prospects found.
                    </td>
                  </tr>
                )}

                {!loading &&
                  pageRows.map((p) => {
                    const selected = p.id === selectedId;
                    return (
                      <tr
                        key={p.id}
                        className={`border-t cursor-pointer hover:bg-slate-50 ${selected ? 'bg-emerald-50' : ''}`}
                        onClick={() => handleSelectRow(p)}
                        title="Click to view / edit this prospect"
                      >
                        <td className="px-2 py-2 align-top text-slate-700">{p.id}</td>
                        <td className="px-2 py-2 align-top min-w-[120px]">{p.first_name}</td>
                        <td className="px-2 py-2 align-top min-w-[120px]">{p.last_name || ''}</td>
                        <td className="px-2 py-2 align-top min-w-[120px]">{p.spouse_name || ''}</td>
                        <td className="px-2 py-2 align-top min-w-[150px]">{p.relation_type || ''}</td>
                        <td className="px-2 py-2 align-top min-w-[120px]">{p.phone || ''}</td>
                        <td className="px-2 py-2 align-top min-w-[120px]">{p.city || ''}</td>
                        <td className="px-2 py-2 align-top min-w-[90px]">{(p.state || '').toUpperCase()}</td>
                        <td className="px-2 py-2 align-top min-w-[70px]">{ynNormalize(p.top25)}</td>
                        <td className="px-2 py-2 align-top min-w-[120px]">{p.immigration || ''}</td>
                        <td className="px-2 py-2 align-top min-w-[80px]">{ynNormalize(p.age25plus)}</td>
                        <td className="px-2 py-2 align-top min-w-[70px]">{ynNormalize(p.married)}</td>
                        <td className="px-2 py-2 align-top min-w-[70px]">{ynNormalize(p.children)}</td>
                        <td className="px-2 py-2 align-top min-w-[80px]">{ynNormalize(p.homeowner)}</td>
                        <td className="px-2 py-2 align-top min-w-[90px]">{ynNormalize(p.good_career)}</td>
                        <td className="px-2 py-2 align-top min-w-[90px]">{ynNormalize(p.income_60k)}</td>
                        <td className="px-2 py-2 align-top min-w-[90px]">{ynNormalize(p.dissatisfied)}</td>
                        <td className="px-2 py-2 align-top min-w-[90px]">{ynNormalize(p.ambitious)}</td>
                        <td className="px-2 py-2 align-top min-w-[110px]">{(p.contact_date || '').slice(0, 10)}</td>
                        <td className="px-2 py-2 align-top min-w-[140px]">{p.result || ''}</td>
                        <td className="px-2 py-2 align-top min-w-[90px]">{p.next_steps || ''}</td>
                        <td className="px-2 py-2 align-top min-w-[160px]">{p.comments || ''}</td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between px-3 py-2 text-xs text-slate-600">
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
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                className="rounded-md border border-slate-300 px-2 py-1 disabled:opacity-40"
              >
                Next
              </button>
            </div>
          </div>
        </div>

        {/* Selected Prospect (detail editor) */}
        <div className="rounded-lg border bg-slate-50 p-4">
          <div className="mb-3 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-sm font-bold text-slate-900">Selected Prospect</h2>
              <p className="text-xs text-slate-600">
                {selectedOriginal
                  ? `Editing #${selectedOriginal.id} — ${selectedOriginal.first_name}${selectedOriginal.last_name ? ' ' + selectedOriginal.last_name : ''}`
                  : 'Click a row in the table above to view and update a single record.'}
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={!selectedOriginal || !selectedDirty || savingSelected}
                onClick={saveSelected}
                className="rounded-lg bg-emerald-600 px-4 py-2 text-xs font-semibold text-white shadow hover:bg-emerald-700 disabled:opacity-40"
              >
                {savingSelected ? 'Saving...' : 'Save Changes'}
              </button>
              <button
                type="button"
                disabled={!selectedOriginal || !selectedDirty || savingSelected}
                onClick={handleCancelSelected}
                className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-40"
              >
                Cancel
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Field label="First Name *">
              <TextInput
                value={selectedForm.first_name}
                onChange={(v) => setSelectedForm((p) => ({ ...p, first_name: v }))}
                disabled={!selectedOriginal || savingSelected}
              />
            </Field>

            <Field label="Last Name">
              <TextInput
                value={selectedForm.last_name}
                onChange={(v) => setSelectedForm((p) => ({ ...p, last_name: v }))}
                disabled={!selectedOriginal || savingSelected}
              />
            </Field>

            <Field label="Spouse Name">
              <TextInput
                value={selectedForm.spouse_name}
                onChange={(v) => setSelectedForm((p) => ({ ...p, spouse_name: v }))}
                disabled={!selectedOriginal || savingSelected}
              />
            </Field>

            <Field label="Relation Type">
              <select
                className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900"
                value={selectedForm.relation_type}
                disabled={!selectedOriginal || savingSelected}
                onChange={(e) => setSelectedForm((p) => ({ ...p, relation_type: e.target.value }))}
              >
                <option value=""></option>
                {RELATION_OPTIONS.map((o) => (
                  <option key={o || '__EMPTY__'} value={o}>
                    {o}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Phone">
              <TextInput
                value={selectedForm.phone}
                onChange={(v) => setSelectedForm((p) => ({ ...p, phone: v }))}
                disabled={!selectedOriginal || savingSelected}
              />
            </Field>

            <Field label="City">
              <TextInput
                value={selectedForm.city}
                onChange={(v) => setSelectedForm((p) => ({ ...p, city: v }))}
                disabled={!selectedOriginal || savingSelected}
              />
            </Field>

            <Field label="State">
              <select
                className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900"
                value={selectedForm.state}
                disabled={!selectedOriginal || savingSelected}
                onChange={(e) => setSelectedForm((p) => ({ ...p, state: e.target.value }))}
              >
                <option value=""></option>
                {STATES.map((s) => (
                  <option key={s.abbr} value={s.abbr}>
                    {s.abbr} - {s.name}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Immigration">
              <select
                className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900"
                value={selectedForm.immigration}
                disabled={!selectedOriginal || savingSelected}
                onChange={(e) => setSelectedForm((p) => ({ ...p, immigration: e.target.value }))}
              >
                {IMMIGRATION_STATUS_OPTIONS.map((o) => (
                  <option key={o || '__EMPTY__'} value={o}>
                    {o}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Top 25">
              <YesNoSelect
                value={selectedForm.top25}
                onChange={(v) => setSelectedForm((p) => ({ ...p, top25: v }))}
                disabled={!selectedOriginal || savingSelected}
              />
            </Field>

            <Field label="Age 25+">
              <YesNoSelect
                value={selectedForm.age25plus}
                onChange={(v) => setSelectedForm((p) => ({ ...p, age25plus: v }))}
                disabled={!selectedOriginal || savingSelected}
              />
            </Field>

            <Field label="Married">
              <YesNoSelect
                value={selectedForm.married}
                onChange={(v) => setSelectedForm((p) => ({ ...p, married: v }))}
                disabled={!selectedOriginal || savingSelected}
              />
            </Field>

            <Field label="Children">
              <YesNoSelect
                value={selectedForm.children}
                onChange={(v) => setSelectedForm((p) => ({ ...p, children: v }))}
                disabled={!selectedOriginal || savingSelected}
              />
            </Field>

            <Field label="Homeowner">
              <YesNoSelect
                value={selectedForm.homeowner}
                onChange={(v) => setSelectedForm((p) => ({ ...p, homeowner: v }))}
                disabled={!selectedOriginal || savingSelected}
              />
            </Field>

            <Field label="Good Career">
              <YesNoSelect
                value={selectedForm.good_career}
                onChange={(v) => setSelectedForm((p) => ({ ...p, good_career: v }))}
                disabled={!selectedOriginal || savingSelected}
              />
            </Field>

            <Field label="Income 60K">
              <YesNoSelect
                value={selectedForm.income_60k}
                onChange={(v) => setSelectedForm((p) => ({ ...p, income_60k: v }))}
                disabled={!selectedOriginal || savingSelected}
              />
            </Field>

            <Field label="Dissatisfied">
              <YesNoSelect
                value={selectedForm.dissatisfied}
                onChange={(v) => setSelectedForm((p) => ({ ...p, dissatisfied: v }))}
                disabled={!selectedOriginal || savingSelected}
              />
            </Field>

            <Field label="Ambitious">
              <YesNoSelect
                value={selectedForm.ambitious}
                onChange={(v) => setSelectedForm((p) => ({ ...p, ambitious: v }))}
                disabled={!selectedOriginal || savingSelected}
              />
            </Field>

            <Field label="Contact Date">
              <DateInput
                value={selectedForm.contact_date}
                onChange={(v) => setSelectedForm((p) => ({ ...p, contact_date: v }))}
                disabled={!selectedOriginal || savingSelected}
              />
            </Field>

            <Field label="Result">
              <select
                className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900"
                value={selectedForm.result}
                disabled={!selectedOriginal || savingSelected}
                onChange={(e) => setSelectedForm((p) => ({ ...p, result: e.target.value }))}
              >
                <option value=""></option>
                {RESULT_OPTIONS.map((o) => (
                  <option key={o || '__EMPTY__'} value={o}>
                    {o}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Next Steps">
              <TextInput
                value={selectedForm.next_steps}
                onChange={(v) => setSelectedForm((p) => ({ ...p, next_steps: v }))}
                disabled={!selectedOriginal || savingSelected}
              />
            </Field>

            <Field label="Comments">
              <TextInput
                value={selectedForm.comments}
                onChange={(v) => setSelectedForm((p) => ({ ...p, comments: v }))}
                disabled={!selectedOriginal || savingSelected}
              />
            </Field>
          </div>

          <p className="mt-3 text-[11px] text-slate-500">
            Yes/No dropdowns store values as <span className="font-semibold">Y</span> / <span className="font-semibold">N</span>.
          </p>
        </div>

        {/* New Prospect (collapsed by default so the main UI shows the table first) */}
        {showNew && (
          <div className="rounded-lg border bg-white p-4">
            <div className="mb-3 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
              <div>
                <h2 className="text-sm font-bold text-slate-900">New Prospect</h2>
                <p className="text-xs text-slate-600">Add a new record to the prospects table.</p>
              </div>
              <button
                type="button"
                onClick={insertNew}
                disabled={inserting}
                className="rounded-lg bg-emerald-600 px-4 py-2 text-xs font-semibold text-white shadow hover:bg-emerald-700 disabled:opacity-50"
              >
                {inserting ? 'Saving...' : 'Save Prospect'}
              </button>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <Field label="First Name *">
                <TextInput value={newProspect.first_name} onChange={(v) => setNewProspect((p) => ({ ...p, first_name: v }))} />
              </Field>
              <Field label="Last Name">
                <TextInput value={newProspect.last_name} onChange={(v) => setNewProspect((p) => ({ ...p, last_name: v }))} />
              </Field>
              <Field label="Spouse Name">
                <TextInput value={newProspect.spouse_name} onChange={(v) => setNewProspect((p) => ({ ...p, spouse_name: v }))} />
              </Field>
              <Field label="Relation Type">
                <select
                  className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900"
                  value={newProspect.relation_type}
                  onChange={(e) => setNewProspect((p) => ({ ...p, relation_type: e.target.value }))}
                >
                  <option value=""></option>
                  {RELATION_OPTIONS.map((o) => (
                    <option key={o || '__EMPTY__'} value={o}>
                      {o}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="Phone">
                <TextInput value={newProspect.phone} onChange={(v) => setNewProspect((p) => ({ ...p, phone: v }))} />
              </Field>
              <Field label="City">
                <TextInput value={newProspect.city} onChange={(v) => setNewProspect((p) => ({ ...p, city: v }))} />
              </Field>

              <Field label="State">
                <select
                  className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900"
                  value={newProspect.state}
                  onChange={(e) => setNewProspect((p) => ({ ...p, state: e.target.value }))}
                >
                  <option value=""></option>
                  {STATES.map((s) => (
                    <option key={s.abbr} value={s.abbr}>
                      {s.abbr} - {s.name}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="Immigration">
                <select
                  className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900"
                  value={newProspect.immigration}
                  onChange={(e) => setNewProspect((p) => ({ ...p, immigration: e.target.value }))}
                >
                  {IMMIGRATION_STATUS_OPTIONS.map((o) => (
                    <option key={o || '__EMPTY__'} value={o}>
                      {o}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="Top 25">
                <YesNoSelect value={newProspect.top25} onChange={(v) => setNewProspect((p) => ({ ...p, top25: v }))} />
              </Field>

              <Field label="Age 25+">
                <YesNoSelect value={newProspect.age25plus} onChange={(v) => setNewProspect((p) => ({ ...p, age25plus: v }))} />
              </Field>

              <Field label="Married">
                <YesNoSelect value={newProspect.married} onChange={(v) => setNewProspect((p) => ({ ...p, married: v }))} />
              </Field>

              <Field label="Children">
                <YesNoSelect value={newProspect.children} onChange={(v) => setNewProspect((p) => ({ ...p, children: v }))} />
              </Field>

              <Field label="Homeowner">
                <YesNoSelect value={newProspect.homeowner} onChange={(v) => setNewProspect((p) => ({ ...p, homeowner: v }))} />
              </Field>

              <Field label="Good Career">
                <YesNoSelect value={newProspect.good_career} onChange={(v) => setNewProspect((p) => ({ ...p, good_career: v }))} />
              </Field>

              <Field label="Income 60K">
                <YesNoSelect value={newProspect.income_60k} onChange={(v) => setNewProspect((p) => ({ ...p, income_60k: v }))} />
              </Field>

              <Field label="Dissatisfied">
                <YesNoSelect value={newProspect.dissatisfied} onChange={(v) => setNewProspect((p) => ({ ...p, dissatisfied: v }))} />
              </Field>

              <Field label="Ambitious">
                <YesNoSelect value={newProspect.ambitious} onChange={(v) => setNewProspect((p) => ({ ...p, ambitious: v }))} />
              </Field>

              <Field label="Contact Date">
                <DateInput value={newProspect.contact_date} onChange={(v) => setNewProspect((p) => ({ ...p, contact_date: v }))} />
              </Field>

              <Field label="Result">
                <select
                  className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900"
                  value={newProspect.result}
                  onChange={(e) => setNewProspect((p) => ({ ...p, result: e.target.value }))}
                >
                  <option value=""></option>
                  {RESULT_OPTIONS.map((o) => (
                    <option key={o || '__EMPTY__'} value={o}>
                      {o}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="Next Steps">
                <TextInput value={newProspect.next_steps} onChange={(v) => setNewProspect((p) => ({ ...p, next_steps: v }))} />
              </Field>

              <Field label="Comments">
                <TextInput value={newProspect.comments} onChange={(v) => setNewProspect((p) => ({ ...p, comments: v }))} />
              </Field>
            </div>

            <p className="mt-3 text-[11px] text-slate-500">
              Yes/No dropdowns store values as <span className="font-semibold">Y</span> / <span className="font-semibold">N</span>.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
