// app/prospect/page.tsx
'use client';

import { useEffect, useMemo, useState } from 'react';
import { createClient } from '@supabase/supabase-js';

type Prospect = {
  id: number;
  first_name: string; // NOT NULL
  last_name: string | null;
  spouse_name: string | null;
  relation_type: string | null; // Friend / Relative / Acquaintance / Referral/Others
  phone: string | null;
  city: string | null;
  state: string | null; // two-letter abbreviation (recommended)
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

type NewProspectForm = {
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
const RESULT_OPTIONS = [
  'Business',
  'Both',
  'Client Solution',
  'In-Progress',
  'Called',
  'Not Interested',
  'Others',
] as const;

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

type DraftMap = Record<number, Partial<Prospect>>;

export default function ProspectListPage() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

  const supabase = useMemo(() => createClient(supabaseUrl, supabaseKey), [supabaseUrl, supabaseKey]);

  const [prospects, setProspects] = useState<Prospect[]>([]);
  const [loading, setLoading] = useState(false);
  const [savingIds, setSavingIds] = useState<Record<number, boolean>>({});
  const [inserting, setInserting] = useState(false);

  const [errorMsg, setErrorMsg] = useState<string>('');
  const [successMsg, setSuccessMsg] = useState<string>('');

  const [search, setSearch] = useState('');
  const [resultFilter, setResultFilter] = useState<string>('ALL');
  const [page, setPage] = useState(1);

  const [drafts, setDrafts] = useState<DraftMap>({});

  const [showNew, setShowNew] = useState(true);
  const [newProspect, setNewProspect] = useState<NewProspectForm>({
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
    setLoading(true);
    setErrorMsg('');

    const { data, error } = await supabase.from('prospects').select('*').order('id', { ascending: true });

    if (error) {
      setToast('error', error.message);
      setLoading(false);
      return;
    }

    setProspects((data || []) as Prospect[]);
    setLoading(false);
  };

  useEffect(() => {
    loadProspects();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleRefresh = () => {
    setSearch('');
    setResultFilter('ALL');
    setPage(1);
    setDrafts({});
    setShowNew(true);
    setNewProspect({
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
    loadProspects();
  };

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

  const updateDraft = (id: number, patch: Partial<Prospect>) => {
    setDrafts((prev) => ({
      ...prev,
      [id]: { ...(prev[id] || {}), ...patch },
    }));
  };

  const discardDraft = (id: number) => {
    setDrafts((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  };

  const valueFor = <K extends keyof Prospect>(row: Prospect, id: number, key: K): Prospect[K] => {
    const d = drafts[id] as Partial<Prospect> | undefined;
    if (d && key in d) return d[key] as Prospect[K];
    return row[key];
  };

  const saveRow = async (row: Prospect) => {
    const id = row.id;
    const draft = drafts[id];
    if (!draft || Object.keys(draft).length === 0) return;

    const finalFirst = String((draft.first_name ?? row.first_name) || '').trim();
    if (!finalFirst) {
      setToast('error', 'First Name is required.');
      return;
    }

    setSavingIds((p) => ({ ...p, [id]: true }));

    const payload: Partial<Omit<Prospect, 'id'>> = {
      first_name: finalFirst,
      last_name: toNull(draft.last_name ?? row.last_name),
      spouse_name: toNull(draft.spouse_name ?? row.spouse_name),
      relation_type: toNull(draft.relation_type ?? row.relation_type),
      phone: toNull(draft.phone ?? row.phone),
      city: toNull(draft.city ?? row.city),
      state: (() => {
        const s = (draft.state ?? row.state ?? '').trim();
        return s ? s.toUpperCase() : null;
      })(),
      top25: ynNormalize(draft.top25 ?? row.top25) || null,
      immigration: toNull(draft.immigration ?? row.immigration),
      age25plus: ynNormalize(draft.age25plus ?? row.age25plus) || null,
      married: ynNormalize(draft.married ?? row.married) || null,
      children: ynNormalize(draft.children ?? row.children) || null,
      homeowner: ynNormalize(draft.homeowner ?? row.homeowner) || null,
      good_career: ynNormalize(draft.good_career ?? row.good_career) || null,
      income_60k: ynNormalize(draft.income_60k ?? row.income_60k) || null,
      dissatisfied: ynNormalize(draft.dissatisfied ?? row.dissatisfied) || null,
      ambitious: ynNormalize(draft.ambitious ?? row.ambitious) || null,
      contact_date: toNull(draft.contact_date ?? row.contact_date),
      result: toNull(draft.result ?? row.result),
      next_steps: toNull(draft.next_steps ?? row.next_steps),
      comments: toNull(draft.comments ?? row.comments),
      updated_at: new Date().toISOString(),
    };

    const { error } = await supabase.from('prospects').update(payload).eq('id', id);

    if (error) {
      setToast('error', error.message);
      setSavingIds((p) => ({ ...p, [id]: false }));
      return;
    }

    discardDraft(id);
    setToast('success', `Saved prospect #${id}`);
    setSavingIds((p) => ({ ...p, [id]: false }));
    loadProspects();
  };

  const insertNew = async () => {
    setInserting(true);

    const first_name = newProspect.first_name.trim();
    if (!first_name) {
      setToast('error', 'First Name is required.');
      setInserting(false);
      return;
    }

    const payload: Omit<Prospect, 'id'> = {
      first_name,
      last_name: toNull(newProspect.last_name),
      spouse_name: toNull(newProspect.spouse_name),
      relation_type: toNull(newProspect.relation_type),
      phone: toNull(newProspect.phone),
      city: toNull(newProspect.city),
      state: toNull(newProspect.state.toUpperCase()),
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
    setNewProspect({
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
    setInserting(false);
    setPage(1);
    loadProspects();
  };

  const YesNoSelect = ({
    value,
    onChange,
    disabled,
  }: {
    value: string | null | undefined;
    onChange: (v: string) => void;
    disabled?: boolean;
  }) => (
    <select
      className="h-8 w-full min-w-[86px] rounded-md border border-slate-200 bg-white px-2 text-xs text-slate-900"
      value={ynNormalize(value)}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value)}
    >
      <option value=""></option>
      <option value="Y">Yes</option>
      <option value="N">No</option>
    </select>
  );

  const TextInput = ({
    value,
    onChange,
    placeholder,
    disabled,
    minW,
  }: {
    value: string | null | undefined;
    onChange: (v: string) => void;
    placeholder?: string;
    disabled?: boolean;
    minW?: string;
  }) => (
    <input
      type="text"
      className={`h-8 w-full rounded-md border border-slate-200 bg-white px-2 text-xs text-slate-900 ${minW || ''}`}
      value={value || ''}
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
    value: string | null | undefined;
    onChange: (v: string) => void;
    disabled?: boolean;
  }) => (
    <input
      type="date"
      className="h-8 w-full min-w-[145px] rounded-md border border-slate-200 bg-white px-2 text-xs text-slate-900"
      value={(value || '').slice(0, 10)}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value)}
    />
  );

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
          className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-red-700"
          onClick={() => (window.location.href = '/auth')}
        >
          ← Logout
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

        {/* New Prospect */}
        {showNew && (
          <div className="rounded-lg border bg-slate-50 p-3">
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-800">New Prospect</h2>
              <button
                type="button"
                onClick={insertNew}
                disabled={inserting}
                className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white shadow hover:bg-emerald-700 disabled:opacity-50"
              >
                {inserting ? 'Saving...' : 'Save Prospect'}
              </button>
            </div>

            <div className="grid grid-cols-1 gap-2 md:grid-cols-4">
              <TextInput
                value={newProspect.first_name}
                onChange={(v) => setNewProspect((p) => ({ ...p, first_name: v }))}
                placeholder="First Name *"
              />
              <TextInput
                value={newProspect.last_name}
                onChange={(v) => setNewProspect((p) => ({ ...p, last_name: v }))}
                placeholder="Last Name"
              />
              <TextInput
                value={newProspect.spouse_name}
                onChange={(v) => setNewProspect((p) => ({ ...p, spouse_name: v }))}
                placeholder="Spouse Name"
              />
              <select
                className="h-8 w-full rounded-md border border-slate-200 bg-white px-2 text-xs text-slate-900"
                value={newProspect.relation_type}
                onChange={(e) => setNewProspect((p) => ({ ...p, relation_type: e.target.value }))}
              >
                <option value=""></option>
                {RELATION_OPTIONS.map((o) => (
                  <option key={o} value={o}>
                    {o}
                  </option>
                ))}
              </select>

              <TextInput
                value={newProspect.phone}
                onChange={(v) => setNewProspect((p) => ({ ...p, phone: v }))}
                placeholder="Phone"
              />
              <TextInput value={newProspect.city} onChange={(v) => setNewProspect((p) => ({ ...p, city: v }))} placeholder="City" />
              <select
                className="h-8 w-full rounded-md border border-slate-200 bg-white px-2 text-xs text-slate-900"
                value={newProspect.state}
                onChange={(e) => setNewProspect((p) => ({ ...p, state: e.target.value }))}
              >
                <option value="">State</option>
                {STATES.map((s) => (
                  <option key={s.abbr} value={s.abbr}>
                    {s.abbr} - {s.name}
                  </option>
                ))}
              </select>
              <TextInput
                value={newProspect.immigration}
                onChange={(v) => setNewProspect((p) => ({ ...p, immigration: v }))}
                placeholder="Immigration"
              />

              <YesNoSelect value={newProspect.top25} onChange={(v) => setNewProspect((p) => ({ ...p, top25: v }))} />
              <YesNoSelect value={newProspect.age25plus} onChange={(v) => setNewProspect((p) => ({ ...p, age25plus: v }))} />
              <YesNoSelect value={newProspect.married} onChange={(v) => setNewProspect((p) => ({ ...p, married: v }))} />
              <YesNoSelect value={newProspect.children} onChange={(v) => setNewProspect((p) => ({ ...p, children: v }))} />

              <YesNoSelect value={newProspect.homeowner} onChange={(v) => setNewProspect((p) => ({ ...p, homeowner: v }))} />
              <YesNoSelect value={newProspect.good_career} onChange={(v) => setNewProspect((p) => ({ ...p, good_career: v }))} />
              <YesNoSelect value={newProspect.income_60k} onChange={(v) => setNewProspect((p) => ({ ...p, income_60k: v }))} />
              <YesNoSelect value={newProspect.dissatisfied} onChange={(v) => setNewProspect((p) => ({ ...p, dissatisfied: v }))} />

              <YesNoSelect value={newProspect.ambitious} onChange={(v) => setNewProspect((p) => ({ ...p, ambitious: v }))} />
              <DateInput value={newProspect.contact_date} onChange={(v) => setNewProspect((p) => ({ ...p, contact_date: v }))} />
              <select
                className="h-8 w-full rounded-md border border-slate-200 bg-white px-2 text-xs text-slate-900"
                value={newProspect.result}
                onChange={(e) => setNewProspect((p) => ({ ...p, result: e.target.value }))}
              >
                <option value=""></option>
                {RESULT_OPTIONS.map((o) => (
                  <option key={o} value={o}>
                    {o}
                  </option>
                ))}
              </select>
              <TextInput
                value={newProspect.next_steps}
                onChange={(v) => setNewProspect((p) => ({ ...p, next_steps: v }))}
                placeholder="Next Steps"
              />

              <TextInput
                value={newProspect.comments}
                onChange={(v) => setNewProspect((p) => ({ ...p, comments: v }))}
                placeholder="Comments"
              />
            </div>

            <p className="mt-2 text-[11px] text-slate-500">
              Yes/No dropdowns store values as <span className="font-semibold">Y</span> / <span className="font-semibold">N</span>.
            </p>
          </div>
        )}

        {/* Table */}
        <div className="max-h-[560px] overflow-auto rounded-lg border">
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
                  'Actions',
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
                  <td colSpan={23} className="px-3 py-4 text-center text-xs text-slate-500">
                    Loading prospects...
                  </td>
                </tr>
              )}

              {!loading && pageRows.length === 0 && (
                <tr>
                  <td colSpan={23} className="px-3 py-4 text-center text-xs text-slate-500">
                    No prospects found.
                  </td>
                </tr>
              )}

              {!loading &&
                pageRows.map((p) => {
                  const id = p.id;
                  const draft = drafts[id];
                  const dirty = !!draft && Object.keys(draft).length > 0;
                  const saving = !!savingIds[id];

                  return (
                    <tr key={id} className={`border-t hover:bg-slate-50 ${dirty ? 'bg-amber-50/40' : ''}`}>
                      <td className="px-2 py-2 align-top text-slate-700">{id}</td>

                      <td className="px-2 py-2 align-top">
                        <TextInput
                          value={valueFor(p, id, 'first_name') as string}
                          onChange={(v) => updateDraft(id, { first_name: v })}
                          disabled={saving}
                          minW="min-w-[140px]"
                        />
                      </td>

                      <td className="px-2 py-2 align-top">
                        <TextInput
                          value={valueFor(p, id, 'last_name') as string | null}
                          onChange={(v) => updateDraft(id, { last_name: v })}
                          disabled={saving}
                          minW="min-w-[140px]"
                        />
                      </td>

                      <td className="px-2 py-2 align-top">
                        <TextInput
                          value={valueFor(p, id, 'spouse_name') as string | null}
                          onChange={(v) => updateDraft(id, { spouse_name: v })}
                          disabled={saving}
                          minW="min-w-[140px]"
                        />
                      </td>

                      <td className="px-2 py-2 align-top">
                        <select
                          className="h-8 w-full min-w-[170px] rounded-md border border-slate-200 bg-white px-2 text-xs text-slate-900"
                          value={(valueFor(p, id, 'relation_type') as string | null) || ''}
                          disabled={saving}
                          onChange={(e) => updateDraft(id, { relation_type: e.target.value })}
                        >
                          <option value=""></option>
                          {RELATION_OPTIONS.map((o) => (
                            <option key={o} value={o}>
                              {o}
                            </option>
                          ))}
                        </select>
                      </td>

                      <td className="px-2 py-2 align-top">
                        <TextInput
                          value={valueFor(p, id, 'phone') as string | null}
                          onChange={(v) => updateDraft(id, { phone: v })}
                          disabled={saving}
                          minW="min-w-[140px]"
                        />
                      </td>

                      <td className="px-2 py-2 align-top">
                        <TextInput
                          value={valueFor(p, id, 'city') as string | null}
                          onChange={(v) => updateDraft(id, { city: v })}
                          disabled={saving}
                          minW="min-w-[160px]"
                        />
                      </td>

                      <td className="px-2 py-2 align-top">
                        <select
                          className="h-8 w-full min-w-[180px] rounded-md border border-slate-200 bg-white px-2 text-xs text-slate-900"
                          value={(valueFor(p, id, 'state') as string | null) || ''}
                          disabled={saving}
                          onChange={(e) => updateDraft(id, { state: e.target.value })}
                        >
                          <option value=""></option>
                          {STATES.map((s) => (
                            <option key={s.abbr} value={s.abbr}>
                              {s.abbr} - {s.name}
                            </option>
                          ))}
                        </select>
                      </td>

                      <td className="px-2 py-2 align-top">
                        <YesNoSelect value={valueFor(p, id, 'top25') as string | null} onChange={(v) => updateDraft(id, { top25: v })} disabled={saving} />
                      </td>

                      <td className="px-2 py-2 align-top">
                        <TextInput
                          value={valueFor(p, id, 'immigration') as string | null}
                          onChange={(v) => updateDraft(id, { immigration: v })}
                          disabled={saving}
                          minW="min-w-[150px]"
                        />
                      </td>

                      <td className="px-2 py-2 align-top">
                        <YesNoSelect value={valueFor(p, id, 'age25plus') as string | null} onChange={(v) => updateDraft(id, { age25plus: v })} disabled={saving} />
                      </td>

                      <td className="px-2 py-2 align-top">
                        <YesNoSelect value={valueFor(p, id, 'married') as string | null} onChange={(v) => updateDraft(id, { married: v })} disabled={saving} />
                      </td>

                      <td className="px-2 py-2 align-top">
                        <YesNoSelect value={valueFor(p, id, 'children') as string | null} onChange={(v) => updateDraft(id, { children: v })} disabled={saving} />
                      </td>

                      <td className="px-2 py-2 align-top">
                        <YesNoSelect value={valueFor(p, id, 'homeowner') as string | null} onChange={(v) => updateDraft(id, { homeowner: v })} disabled={saving} />
                      </td>

                      <td className="px-2 py-2 align-top">
                        <YesNoSelect value={valueFor(p, id, 'good_career') as string | null} onChange={(v) => updateDraft(id, { good_career: v })} disabled={saving} />
                      </td>

                      <td className="px-2 py-2 align-top">
                        <YesNoSelect value={valueFor(p, id, 'income_60k') as string | null} onChange={(v) => updateDraft(id, { income_60k: v })} disabled={saving} />
                      </td>

                      <td className="px-2 py-2 align-top">
                        <YesNoSelect value={valueFor(p, id, 'dissatisfied') as string | null} onChange={(v) => updateDraft(id, { dissatisfied: v })} disabled={saving} />
                      </td>

                      <td className="px-2 py-2 align-top">
                        <YesNoSelect value={valueFor(p, id, 'ambitious') as string | null} onChange={(v) => updateDraft(id, { ambitious: v })} disabled={saving} />
                      </td>

                      <td className="px-2 py-2 align-top">
                        <DateInput value={valueFor(p, id, 'contact_date') as string | null} onChange={(v) => updateDraft(id, { contact_date: v })} disabled={saving} />
                      </td>

                      <td className="px-2 py-2 align-top">
                        <select
                          className="h-8 w-full min-w-[170px] rounded-md border border-slate-200 bg-white px-2 text-xs text-slate-900"
                          value={(valueFor(p, id, 'result') as string | null) || ''}
                          disabled={saving}
                          onChange={(e) => updateDraft(id, { result: e.target.value })}
                        >
                          <option value=""></option>
                          {RESULT_OPTIONS.map((o) => (
                            <option key={o} value={o}>
                              {o}
                            </option>
                          ))}
                        </select>
                      </td>

                      <td className="px-2 py-2 align-top">
                        <TextInput
                          value={valueFor(p, id, 'next_steps') as string | null}
                          onChange={(v) => updateDraft(id, { next_steps: v })}
                          disabled={saving}
                          minW="min-w-[140px]"
                        />
                      </td>

                      <td className="px-2 py-2 align-top">
                        <TextInput
                          value={valueFor(p, id, 'comments') as string | null}
                          onChange={(v) => updateDraft(id, { comments: v })}
                          disabled={saving}
                          minW="min-w-[220px]"
                        />
                      </td>

                      <td className="px-2 py-2 align-top">
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            disabled={!dirty || saving}
                            onClick={() => saveRow(p)}
                            className="rounded-md bg-emerald-600 px-2 py-1 text-[11px] font-semibold text-white shadow hover:bg-emerald-700 disabled:opacity-40"
                          >
                            {saving ? 'Saving...' : 'Save'}
                          </button>
                          <button
                            type="button"
                            disabled={!dirty || saving}
                            onClick={() => discardDraft(id)}
                            className="rounded-md border border-slate-300 px-2 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40"
                          >
                            Cancel
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
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
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
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
