// app/prospect/page.tsx
'use client';

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
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
  immigration: string | null;
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
  '',
  'U.S. Citizen',
  'U.S.Green Card',
  'H-1B',
  'H-1B/I-140 Approved',
  'L-1A',
  'L-1B',
  'F-1 Student',
  'F-1 OPT',
  'F-1 STEM OPT',
  'H-4 EAD',
  'E-3',
  'I-485 Pending',
  'I-485 EAD/AP',
  'Other Visa Status',
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
    .replace(/[‐‑‒–—―−]/g, '-');

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
  const keys = Object.keys(form) as (keyof ProspectForm)[];
  return keys.some((k) => {
    const a = String(form[k] ?? '').trim();
    const b = String(o[k] ?? '').trim();
    if (k === 'state') return a.toUpperCase() !== b.toUpperCase();
    return a !== b;
  });
};

const Field = ({ label, children }: { label: string; children: ReactNode }) => (
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
  compact,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  disabled?: boolean;
  compact?: boolean;
}) => (
  <input
    type="text"
    className={`${compact ? 'h-9 text-xs' : 'h-10 text-sm'} w-full rounded-lg border border-slate-200 bg-white px-3 text-slate-900`}
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
  compact,
}: {
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
  compact?: boolean;
}) => (
  <input
    type="date"
    className={`${compact ? 'h-9 text-xs' : 'h-10 text-sm'} w-full rounded-lg border border-slate-200 bg-white px-3 text-slate-900`}
    value={(value || '').slice(0, 10)}
    disabled={disabled}
    onChange={(e) => onChange(e.target.value)}
  />
);

const YesNoSelect = ({
  value,
  onChange,
  disabled,
  compact,
}: {
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
  compact?: boolean;
}) => (
  <select
    className={`${compact ? 'h-9 text-xs' : 'h-10 text-sm'} w-full rounded-lg border border-slate-200 bg-white px-3 text-slate-900`}
    value={ynNormalize(value)}
    disabled={disabled}
    onChange={(e) => onChange(e.target.value)}
  >
    <option value=""></option>
    <option value="Y">Yes</option>
    <option value="N">No</option>
  </select>
);

const ToolbarButton = ({
  label,
  onClick,
  disabled,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
}) => (
  <button
    type="button"
    disabled={disabled}
    className="rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40"
    onClick={onClick}
  >
    {label}
  </button>
);

const CommentsEditor = ({
  value,
  onChange,
  disabled,
}: {
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
}) => {
  const ref = useRef<HTMLTextAreaElement | null>(null);

  const wrapSelection = (before: string, after: string) => {
    const el = ref.current;
    if (!el) return;
    const start = el.selectionStart ?? value.length;
    const end = el.selectionEnd ?? value.length;
    const selected = value.slice(start, end);
    const next = value.slice(0, start) + before + selected + after + value.slice(end);
    onChange(next);
    requestAnimationFrame(() => {
      el.focus();
      const cursor = start + before.length + selected.length + after.length;
      el.setSelectionRange(cursor, cursor);
    });
  };

  const prefixLines = (prefix: string) => {
    const el = ref.current;
    if (!el) return;
    const start = el.selectionStart ?? 0;
    const end = el.selectionEnd ?? 0;
    const before = value.slice(0, start);
    const sel = value.slice(start, end) || '';
    const after = value.slice(end);

    const lines = sel.length ? sel.split('\n') : [''];
    const nextSel = lines.map((l) => (l.startsWith(prefix) ? l : prefix + l)).join('\n');
    const next = before + nextSel + after;
    onChange(next);

    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(start, start + nextSel.length);
    });
  };

  return (
    <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 bg-slate-50 px-2 py-2">
        <span className="text-[11px] font-semibold text-slate-600">Format</span>
        <ToolbarButton label="Bold" disabled={disabled} onClick={() => wrapSelection('**', '**')} />
        <ToolbarButton label="Italic" disabled={disabled} onClick={() => wrapSelection('*', '*')} />
        <ToolbarButton label="Bullets" disabled={disabled} onClick={() => prefixLines('- ')} />
        <ToolbarButton label="Numbered" disabled={disabled} onClick={() => prefixLines('1. ')} />
        <ToolbarButton label="Clear" disabled={disabled} onClick={() => onChange('')} />
      </div>
      <textarea
        ref={ref}
        className="min-h-[120px] w-full resize-y px-3 py-2 text-sm text-slate-900 outline-none whitespace-pre-wrap break-words"
        value={value}
        disabled={disabled}
        placeholder="Enter notes..."
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
};

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

  const [activeId, setActiveId] = useState<number | null>(null);
  const [original, setOriginal] = useState<Prospect | null>(null);
  const [form, setForm] = useState<ProspectForm>(emptyForm());
  const [mode, setMode] = useState<'new' | 'view' | 'edit'>('new');
  const [saving, setSaving] = useState(false);

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

  const hasUnsaved = mode === 'edit' && original ? isDirtyVsOriginal(form, original) : false;

  const loadProspects = async () => {
    if (!supabase) {
      setToast('error', 'Missing Supabase environment variables (NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY).');
      return;
    }

    setLoading(true);
    setErrorMsg('');

    const { data, error } = await supabase.from('prospects').select('*').order('id', { ascending: false });

    if (error) {
      setToast('error', error.message);
      setLoading(false);
      return;
    }

    const rows = (data || []) as Prospect[];
    setProspects(rows);
    setLoading(false);

    // Keep selection in sync after reload (do not clobber unsaved edits)
    if (activeId != null) {
      const updated = rows.find((r) => r.id === activeId) || null;
      if (!updated) {
        setActiveId(null);
        setOriginal(null);
        setForm(emptyForm());
        setMode('new');
      } else {
        setOriginal(updated);
        if (!(mode === 'edit' && hasUnsaved)) {
          setForm(formFromProspect(updated));
          setMode('view');
        }
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

  const requiredFilled =
    form.first_name.trim().length > 0 && form.last_name.trim().length > 0 && form.phone.trim().length > 0;

  const editable = mode === 'new' || mode === 'edit';
  const dirty = original ? isDirtyVsOriginal(form, original) : false;

  const showSave = (mode === 'edit') || (mode === 'new' && requiredFilled);
  const canSave =
    (mode === 'new' && requiredFilled && !saving) ||
    (mode === 'edit' && requiredFilled && dirty && !saving);

  const actionLabel = activeId ? 'Edit Prospect' : 'Add New Prospect';

  const resetToNew = () => {
    setActiveId(null);
    setOriginal(null);
    setForm(emptyForm());
    setMode('new');
  };

  const handleSelectRow = (p: Prospect) => {
    if (saving) return;
    if (mode === 'edit' && hasUnsaved && p.id !== activeId) {
      setToast('error', 'You have unsaved changes. Please Save or Cancel before selecting another prospect.');
      return;
    }
    setActiveId(p.id);
    setOriginal(p);
    setForm(formFromProspect(p));
    setMode('view');
  };

  const handlePrimaryAction = () => {
    if (saving) return;
    if (mode === 'edit' && hasUnsaved) {
      setToast('error', 'You have unsaved changes. Please Save or Cancel before switching.');
      return;
    }
    if (activeId) {
      setMode('edit');
    } else {
      // Add New Prospect flow
      resetToNew();
    }
  };

  const handleCancel = () => {
    if (saving) return;

    if (mode === 'edit' && original) {
      setForm(formFromProspect(original));
      setMode('view');
      return;
    }

    // New mode: clear fields & hide save button (until required fields are filled)
    resetToNew();
  };

  const buildPayloadFromForm = (f: ProspectForm) => {
    const stateAbbr = (f.state || '').trim();
    return {
      first_name: f.first_name.trim(),
      last_name: f.last_name.trim() || null,
      spouse_name: toNull(f.spouse_name),
      relation_type: toNull(f.relation_type),
      phone: f.phone.trim() || null,
      city: toNull(f.city),
      state: stateAbbr ? stateAbbr.toUpperCase() : null,
      top25: ynNormalize(f.top25) || null,
      immigration: toNull(f.immigration),
      age25plus: ynNormalize(f.age25plus) || null,
      married: ynNormalize(f.married) || null,
      children: ynNormalize(f.children) || null,
      homeowner: ynNormalize(f.homeowner) || null,
      good_career: ynNormalize(f.good_career) || null,
      income_60k: ynNormalize(f.income_60k) || null,
      dissatisfied: ynNormalize(f.dissatisfied) || null,
      ambitious: ynNormalize(f.ambitious) || null,
      contact_date: toNull(f.contact_date),
      result: toNull(f.result),
      next_steps: toNull(f.next_steps),
      comments: toNull(f.comments),
    } as Omit<Prospect, 'id'>;
  };

  const handleSave = async () => {
    if (!supabase) {
      setToast('error', 'Missing Supabase environment variables.');
      return;
    }

    if (!requiredFilled) {
      setToast('error', 'First Name, Last Name, and Phone are required.');
      return;
    }

    if (mode === 'edit' && (!activeId || !original)) {
      setToast('error', 'Please select a prospect row first.');
      return;
    }

    if (mode === 'edit' && !dirty) {
      setToast('error', 'No changes to save.');
      return;
    }

    setSaving(true);

    if (mode === 'new') {
      const payload = {
        ...buildPayloadFromForm(form),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const { data, error } = await supabase.from('prospects').insert(payload).select('*').single();

      if (error) {
        setToast('error', error.message);
        setSaving(false);
        return;
      }

      const inserted = data as Prospect;
      setProspects((prev) => [inserted, ...prev.filter((x) => x.id !== inserted.id)]);
      setActiveId(inserted.id);
      setOriginal(inserted);
      setForm(formFromProspect(inserted));
      setMode('view');
      setToast('success', `Added prospect #${inserted.id}`);
      setSaving(false);
      return;
    }

    // Edit mode
    const payload = {
      ...buildPayloadFromForm(form),
      updated_at: new Date().toISOString(),
    } as Partial<Omit<Prospect, 'id'>>;

    const { data, error } = await supabase.from('prospects').update(payload).eq('id', activeId!).select('*').single();

    if (error) {
      setToast('error', error.message);
      setSaving(false);
      return;
    }

    const updated = data as Prospect;
    setProspects((prev) => prev.map((x) => (x.id === updated.id ? updated : x)));
    setOriginal(updated);
    setForm(formFromProspect(updated));
    setMode('view');
    setToast('success', `Saved prospect #${updated.id}`);
    setSaving(false);
  };

  const handleRefresh = async () => {
    if (mode === 'edit' && hasUnsaved) {
      setToast('error', 'You have unsaved changes. Please Save or Cancel before refreshing.');
      return;
    }
    setSearch('');
    setResultFilter('ALL');
    setPage(1);
    resetToNew();
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
              className={`rounded-lg px-3 py-2 text-xs font-semibold shadow-sm ${
                activeId
                  ? 'border border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
                  : 'bg-emerald-600 text-white hover:bg-emerald-700'
              }`}
              onClick={handlePrimaryAction}
            >
              {actionLabel}
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
          <div className="max-h-[420px] overflow-auto">
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
                    const selected = p.id === activeId;
                    return (
                      <tr
                        key={p.id}
                        className={`border-t cursor-pointer hover:bg-slate-50 ${selected ? 'bg-emerald-50' : ''}`}
                        onClick={() => handleSelectRow(p)}
                        title="Click to view this prospect"
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
                        <td className="px-2 py-2 align-top min-w-[160px]">{p.immigration || ''}</td>
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
                        <td className="px-2 py-2 align-top min-w-[120px]">{p.next_steps || ''}</td>
                        <td className="px-2 py-2 align-top min-w-[220px]">{p.comments || ''}</td>
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

        {/* Single Card: New/Edit Prospect */}
        <div className="rounded-lg border bg-slate-50 p-4">
          <div className="mb-3 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-sm font-bold text-slate-900">
                {mode === 'new' ? 'Add New Prospect' : mode === 'edit' ? 'Edit Prospect' : 'Prospect Details'}
              </h2>
              <p className="text-xs text-slate-600">
                {mode === 'new'
                  ? 'Enter details below. First Name, Last Name, and Phone are required.'
                  : original
                    ? `#${original.id} — ${original.first_name}${original.last_name ? ' ' + original.last_name : ''}`
                    : 'Select a row above to view details, then click Edit Prospect to update.'}
              </p>
            </div>

            <div className="flex items-center gap-2">
              {showSave && (
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={!canSave}
                  className="rounded-lg bg-emerald-600 px-4 py-2 text-xs font-semibold text-white shadow hover:bg-emerald-700 disabled:opacity-40"
                >
                  {saving ? 'Saving...' : 'Save'}
                </button>
              )}

              {(mode === 'edit' || (mode === 'new' && (form.first_name || form.last_name || form.phone || form.city || form.state || form.spouse_name))) && (
                <button
                  type="button"
                  onClick={handleCancel}
                  disabled={saving}
                  className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-40"
                >
                  {mode === 'edit' ? 'Cancel' : 'Clear'}
                </button>
              )}
            </div>
          </div>

          <div className="space-y-4">
            {/* Name row */}
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <Field label="First Name *">
                <TextInput
                  value={form.first_name}
                  onChange={(v) => setForm((p) => ({ ...p, first_name: v }))}
                  disabled={!editable || saving}
                />
              </Field>

              <Field label="Last Name *">
                <TextInput
                  value={form.last_name}
                  onChange={(v) => setForm((p) => ({ ...p, last_name: v }))}
                  disabled={!editable || saving}
                />
              </Field>
            </div>

            {/* Spouse / Relation */}
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <Field label="Spouse Name">
                <TextInput
                  value={form.spouse_name}
                  onChange={(v) => setForm((p) => ({ ...p, spouse_name: v }))}
                  disabled={!editable || saving}
                />
              </Field>

              <Field label="Relation Type">
                <select
                  className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 disabled:opacity-60"
                  value={form.relation_type}
                  disabled={!editable || saving}
                  onChange={(e) => setForm((p) => ({ ...p, relation_type: e.target.value }))}
                >
                  <option value=""></option>
                  {RELATION_OPTIONS.map((o) => (
                    <option key={o} value={o}>
                      {o}
                    </option>
                  ))}
                </select>
              </Field>
            </div>

            {/* Phone / City / State in one row */}
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <Field label="Phone *">
                <TextInput
                  value={form.phone}
                  onChange={(v) => setForm((p) => ({ ...p, phone: v }))}
                  disabled={!editable || saving}
                />
              </Field>

              <Field label="City">
                <TextInput
                  value={form.city}
                  onChange={(v) => setForm((p) => ({ ...p, city: v }))}
                  disabled={!editable || saving}
                />
              </Field>

              <Field label="State">
                <select
                  className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 disabled:opacity-60"
                  value={form.state}
                  disabled={!editable || saving}
                  onChange={(e) => setForm((p) => ({ ...p, state: e.target.value }))}
                >
                  <option value=""></option>
                  {STATES.map((s) => (
                    <option key={s.abbr} value={s.abbr}>
                      {s.abbr} - {s.name}
                    </option>
                  ))}
                </select>
              </Field>
            </div>

            {/* Immigration -> Next Steps in compact 4 columns */}
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
              <Field label="Immigration">
                <select
                  className="h-9 w-full rounded-lg border border-slate-200 bg-white px-2 text-xs text-slate-900 disabled:opacity-60"
                  value={form.immigration}
                  disabled={!editable || saving}
                  onChange={(e) => setForm((p) => ({ ...p, immigration: e.target.value }))}
                >
                  {IMMIGRATION_STATUS_OPTIONS.map((o) => (
                    <option key={o || '__EMPTY__'} value={o}>
                      {o}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="Contact Date">
                <DateInput
                  value={form.contact_date}
                  onChange={(v) => setForm((p) => ({ ...p, contact_date: v }))}
                  disabled={!editable || saving}
                  compact
                />
              </Field>

              <Field label="Result">
                <select
                  className="h-9 w-full rounded-lg border border-slate-200 bg-white px-2 text-xs text-slate-900 disabled:opacity-60"
                  value={form.result}
                  disabled={!editable || saving}
                  onChange={(e) => setForm((p) => ({ ...p, result: e.target.value }))}
                >
                  <option value=""></option>
                  {RESULT_OPTIONS.map((o) => (
                    <option key={o} value={o}>
                      {o}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="Next Steps">
                <TextInput
                  value={form.next_steps}
                  onChange={(v) => setForm((p) => ({ ...p, next_steps: v }))}
                  disabled={!editable || saving}
                  compact
                  placeholder="Next steps..."
                />
              </Field>
            </div>

            {/* Y/N flags compact */}
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
              <Field label="Top 25">
                <YesNoSelect value={form.top25} onChange={(v) => setForm((p) => ({ ...p, top25: v }))} disabled={!editable || saving} compact />
              </Field>
              <Field label="Age 25+">
                <YesNoSelect value={form.age25plus} onChange={(v) => setForm((p) => ({ ...p, age25plus: v }))} disabled={!editable || saving} compact />
              </Field>
              <Field label="Married">
                <YesNoSelect value={form.married} onChange={(v) => setForm((p) => ({ ...p, married: v }))} disabled={!editable || saving} compact />
              </Field>
              <Field label="Children">
                <YesNoSelect value={form.children} onChange={(v) => setForm((p) => ({ ...p, children: v }))} disabled={!editable || saving} compact />
              </Field>
              <Field label="Homeowner">
                <YesNoSelect value={form.homeowner} onChange={(v) => setForm((p) => ({ ...p, homeowner: v }))} disabled={!editable || saving} compact />
              </Field>
              <Field label="Good Career">
                <YesNoSelect value={form.good_career} onChange={(v) => setForm((p) => ({ ...p, good_career: v }))} disabled={!editable || saving} compact />
              </Field>
              <Field label="Income 60K">
                <YesNoSelect value={form.income_60k} onChange={(v) => setForm((p) => ({ ...p, income_60k: v }))} disabled={!editable || saving} compact />
              </Field>
              <Field label="Dissatisfied">
                <YesNoSelect value={form.dissatisfied} onChange={(v) => setForm((p) => ({ ...p, dissatisfied: v }))} disabled={!editable || saving} compact />
              </Field>
              <Field label="Ambitious">
                <YesNoSelect value={form.ambitious} onChange={(v) => setForm((p) => ({ ...p, ambitious: v }))} disabled={!editable || saving} compact />
              </Field>
            </div>

            {/* Comments with toolbar */}
            <div className="grid grid-cols-1">
              <Field label="Comments">
                <CommentsEditor
                  value={form.comments}
                  onChange={(v) => setForm((p) => ({ ...p, comments: v }))}
                  disabled={!editable || saving}
                />
              </Field>
            </div>

            <p className="text-[11px] text-slate-500">
              Yes/No dropdowns store values as <span className="font-semibold">Y</span> / <span className="font-semibold">N</span>.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
