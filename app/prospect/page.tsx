// app/prospect/page.tsx
'use client';

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';

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

const RELATION_OPTIONS = ['', 'Friend', 'Relative', 'Acquaintance', 'Referral/Others'] as const;
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

const STATE_NAME_OPTIONS = STATES.map((s) => s.name);

const stateToName = (v?: string | null): string => {
  const raw = (v || '').trim();
  if (!raw) return '';

  // Handles legacy values like "TX - Texas" or "TX-Texas"
  if (raw.includes('-')) {
    const part = raw.split('-').slice(-1)[0]?.trim();
    if (part) return part;
  }

  const abbr = raw.toUpperCase();
  const found = STATES.find((s) => s.abbr === abbr);
  if (found) return found.name;

  // Assume it is already a state name
  return raw;
};

const yesNoNormalize = (v?: string | null): string => {
  const raw = (v || '').trim();
  const s = raw.toLowerCase();
  if (!s) return '';
  if (s === 'y' || s === 'yes' || s === 'true') return 'Yes';
  if (s === 'n' || s === 'no' || s === 'false') return 'No';
  // If already stored as 'Yes' / 'No' (any case), normalize capitalization
  if (s === 'yes') return 'Yes';
  if (s === 'no') return 'No';
  return raw;
};

const normText = (s: string): string =>
  s.trim().toLowerCase().replace(/[\u2010-\u2015\u2212]/g, "-");

const toNull = (s: string | null | undefined): string | null => {
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

const toProspectForm = (p: Prospect): ProspectForm => ({
  first_name: p.first_name ?? '',
  last_name: p.last_name ?? '',
  spouse_name: p.spouse_name ?? '',
  relation_type: p.relation_type ?? '',
  phone: p.phone ?? '',
  city: p.city ?? '',
  state: stateToName(p.state),
  top25: yesNoNormalize(p.top25),
  immigration: p.immigration ?? '',
  age25plus: yesNoNormalize(p.age25plus),
  married: yesNoNormalize(p.married),
  children: yesNoNormalize(p.children),
  homeowner: yesNoNormalize(p.homeowner),
  good_career: yesNoNormalize(p.good_career),
  income_60k: yesNoNormalize(p.income_60k),
  dissatisfied: yesNoNormalize(p.dissatisfied),
  ambitious: yesNoNormalize(p.ambitious),
  contact_date: p.contact_date ?? '',
  result: p.result ?? '',
  next_steps: p.next_steps ?? '',
  comments: p.comments ?? '',
});

// -----------------------------------------------------------------------------
// Supabase Setup
// -----------------------------------------------------------------------------

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

// -----------------------------------------------------------------------------
// Component: LogoutIcon (simple SVG icon)
// -----------------------------------------------------------------------------

const LogoutIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
  </svg>
);

// -----------------------------------------------------------------------------
// Subcomponents
// -----------------------------------------------------------------------------

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-slate-700">{label}</label>
      {children}
    </div>
  );
}

interface TextInputProps {
  compact?: boolean;
  placeholder?: string;
  value?: string;
  onChange?: (value: string) => void;
  disabled?: boolean;
}

function TextInput({ compact = false, placeholder = '', value = '', onChange, disabled = false }: TextInputProps) {
  const cn = compact ? 'h-9' : 'h-10';
  return (
    <input
      type="text"
      className={`${cn} w-full rounded-lg border border-slate-200 px-2 text-xs text-slate-900 placeholder-slate-400`}
      placeholder={placeholder}
      value={value}
      onChange={(e) => onChange?.(e.target.value)}
      disabled={disabled}
    />
  );
}

interface DateInputProps {
  compact?: boolean;
  value?: string;
  onChange?: (value: string) => void;
  disabled?: boolean;
}

function DateInput({ compact = false, value = '', onChange, disabled = false }: DateInputProps) {
  const cn = compact ? 'h-9' : 'h-10';
  return (
    <input
      type="date"
      className={`${cn} w-full rounded-lg border border-slate-200 px-2 text-xs text-slate-900`}
      value={value}
      onChange={(e) => onChange?.(e.target.value)}
      disabled={disabled}
    />
  );
}

interface YesNoCheckboxProps {
  compact?: boolean;
  value?: string;
  onChange?: (value: string) => void;
  disabled?: boolean;
}

function YesNoCheckbox({ compact = false, value = '', onChange, disabled = false }: YesNoCheckboxProps) {
  const checked = value === 'Yes';
  const handleToggle = () => {
    if (disabled) return;
    onChange?.(checked ? 'No' : 'Yes');
  };
  const cn = compact ? 'h-9' : 'h-10';
  return (
    <div
      className={`${cn} flex w-full cursor-pointer items-center justify-center rounded-lg border ${
        checked ? 'border-emerald-600 bg-emerald-50' : 'border-slate-200 bg-white'
      } text-xs font-semibold ${disabled ? 'opacity-50' : ''}`}
      onClick={handleToggle}
    >
      {checked ? 'Yes' : 'No'}
    </div>
  );
}

interface CommentsEditorProps {
  value?: string;
  onChange?: (value: string) => void;
  disabled?: boolean;
}

function CommentsEditor({ value = '', onChange, disabled = false }: CommentsEditorProps) {
  return (
    <textarea
      className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 placeholder-slate-400"
      rows={3}
      placeholder="Comments..."
      value={value}
      onChange={(e) => onChange?.(e.target.value)}
      disabled={disabled}
    />
  );
}

function SubCard({ children }: { children: ReactNode }) {
  return <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">{children}</div>;
}

// -----------------------------------------------------------------------------
// Main Page Component
// -----------------------------------------------------------------------------

export default function ProspectPage() {
  const router = useRouter();

  // State
  const [prospects, setProspects] = useState<Prospect[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const [mode, setMode] = useState<'new' | 'edit'>('new');
  const [showCard, setShowCard] = useState(false);
  const [form, setForm] = useState<ProspectForm>(emptyForm());
  const [original, setOriginal] = useState<Prospect | null>(null);

  const [search, setSearch] = useState('');
  const [resultFilter, setResultFilter] = useState('ALL');
  const [page, setPage] = useState(1);
  const [activeId, setActiveId] = useState<number | null>(null);

  const dismissTimeout = useRef<NodeJS.Timeout | null>(null);

  const setToast = (type: 'error' | 'success', message: string) => {
    if (type === 'error') {
      setErrorMsg(message);
      setSuccessMsg(null);
    } else {
      setSuccessMsg(message);
      setErrorMsg(null);
    }

    if (dismissTimeout.current) clearTimeout(dismissTimeout.current);
    dismissTimeout.current = setTimeout(() => {
      setErrorMsg(null);
      setSuccessMsg(null);
    }, 5000);
  };

  // Auth
  useEffect(() => {
    if (!hasAuthCookie()) {
      router.push('/auth');
    }
  }, [router]);

  const logout = () => {
    clearAuthCookie();
    router.push('/auth');
  };

  // Load prospects on mount
  useEffect(() => {
    void loadProspects();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Ensure form is updated when entering edit mode with a selected prospect
  useEffect(() => {
    if (mode === 'edit' && activeId && showCard) {
      const p = prospects.find((x) => x.id === activeId);
      if (p && JSON.stringify(toProspectForm(p)) !== JSON.stringify(form)) {
        setForm(toProspectForm(p));
        setOriginal(p);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, activeId, showCard, prospects]);

  const loadProspects = async () => {
    setLoading(true);
    setErrorMsg(null);

    const { data, error } = await supabase.from('prospects').select('*').order('id', { ascending: false });

    if (error) {
      setToast('error', `Error loading prospects: ${error.message}`);
      setProspects([]);
    } else {
      setProspects(data || []);
    }
    setLoading(false);
  };

  // Filter prospects
  const filtered = useMemo(() => {
    let arr = prospects.slice();

    // Filter by text search
    if (search.trim()) {
      const norm = normText(search);
      arr = arr.filter((p) => {
        const fname = normText(p.first_name ?? '');
        const lname = normText(p.last_name ?? '');
        const spouse = normText(p.spouse_name ?? '');
        const phone = normText(p.phone ?? '');
        return fname.includes(norm) || lname.includes(norm) || spouse.includes(norm) || phone.includes(norm);
      });
    }

    // Filter by result
    if (resultFilter !== 'ALL') {
      arr = arr.filter((p) => {
        const res = (p.result ?? '').trim();
        return res === resultFilter;
      });
    }

    // Sort by ID descending (newest first)
    arr.sort((a, b) => (b.id ?? 0) - (a.id ?? 0));

    return arr;
  }, [prospects, search, resultFilter]);

  // Pagination
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);

  const pageRows = useMemo(() => {
    const start = (safePage - 1) * PAGE_SIZE;
    return filtered.slice(start, start + PAGE_SIZE);
  }, [filtered, safePage]);

  const requiredFilled = !!form.first_name.trim() && !!form.last_name.trim() && !!form.phone.trim();

  const dirty = useMemo(() => {
    if (!original) return false;
    const orig = toProspectForm(original);
    return JSON.stringify(form) !== JSON.stringify(orig);
  }, [form, original]);

  // Actions
  const beginNewProspect = () => {
    if (saving) return;
    setMode('new');
    setActiveId(null);
    setOriginal(null);
    setForm(emptyForm());
    setShowCard(true);
  };

  const handleSelectRow = (p: Prospect) => {
    if (saving) return;
    setActiveId(p.id);
  };

  const handleShowProspect = () => {
    if (saving) return;
    if (!activeId) {
      setToast('error', 'Select a row first.');
      return;
    }
    const p = prospects.find((x) => x.id === activeId);
    if (!p) {
      setToast('error', 'Row not found.');
      return;
    }

    setOriginal(p);
    setForm(toProspectForm(p));
    setMode('edit');
    setShowCard(true);
  };

  const handleTopAction = async () => {
    if (saving) return;

    // Edit mode => save
    if (showCard && mode === 'edit') {
      await saveEdit();
      return;
    }

    // Otherwise => begin editing the selected row
    if (!activeId) {
      setToast('error', 'Select a row first.');
      return;
    }
    const p = prospects.find((x) => x.id === activeId);
    if (!p) {
      setToast('error', 'Row not found.');
      return;
    }

    setOriginal(p);
    setForm(toProspectForm(p));
    setMode('edit');
    setShowCard(true);
  };

  const saveNew = async () => {
    if (saving) return;
    if (!requiredFilled) {
      setToast('error', 'Missing required fields (First Name, Last Name, Phone).');
      return;
    }

    setSaving(true);
    setErrorMsg(null);

    const { error } = await supabase.from('prospects').insert([
      {
        first_name: form.first_name.trim(),
        last_name: toNull(form.last_name),
        spouse_name: toNull(form.spouse_name),
        relation_type: toNull(form.relation_type),
        phone: toNull(form.phone),
        city: toNull(form.city),
        state: toNull(form.state),
        top25: toNull(form.top25),
        immigration: toNull(form.immigration),
        age25plus: toNull(form.age25plus),
        married: toNull(form.married),
        children: toNull(form.children),
        homeowner: toNull(form.homeowner),
        good_career: toNull(form.good_career),
        income_60k: toNull(form.income_60k),
        dissatisfied: toNull(form.dissatisfied),
        ambitious: toNull(form.ambitious),
        contact_date: toNull(form.contact_date),
        result: toNull(form.result),
        next_steps: toNull(form.next_steps),
        comments: toNull(form.comments),
      },
    ]);

    setSaving(false);

    if (error) {
      setToast('error', `Error saving: ${error.message}`);
      return;
    }

    setToast('success', 'Saved.');
    setShowCard(false);
    setMode('new');
    setOriginal(null);
    setForm(emptyForm());
    await loadProspects();
  };

  const saveEdit = async () => {
    if (saving) return;
    if (!original) {
      setToast('error', 'No record selected for editing.');
      return;
    }
    if (!requiredFilled) {
      setToast('error', 'Missing required fields.');
      return;
    }

    setSaving(true);
    setErrorMsg(null);

    const { error } = await supabase
      .from('prospects')
      .update({
        first_name: form.first_name.trim(),
        last_name: toNull(form.last_name),
        spouse_name: toNull(form.spouse_name),
        relation_type: toNull(form.relation_type),
        phone: toNull(form.phone),
        city: toNull(form.city),
        state: toNull(form.state),
        top25: toNull(form.top25),
        immigration: toNull(form.immigration),
        age25plus: toNull(form.age25plus),
        married: toNull(form.married),
        children: toNull(form.children),
        homeowner: toNull(form.homeowner),
        good_career: toNull(form.good_career),
        income_60k: toNull(form.income_60k),
        dissatisfied: toNull(form.dissatisfied),
        ambitious: toNull(form.ambitious),
        contact_date: toNull(form.contact_date),
        result: toNull(form.result),
        next_steps: toNull(form.next_steps),
        comments: toNull(form.comments),
        updated_at: new Date().toISOString(),
      })
      .eq('id', original.id);

    setSaving(false);

    if (error) {
      setToast('error', `Error updating: ${error.message}`);
      return;
    }

    setToast('success', 'Updated.');
    setShowCard(false);
    setMode('new');
    setOriginal(null);
    setForm(emptyForm());
    await loadProspects();
  };

  const handleBottomAction = () => {
    if (saving) return;

    if (!showCard) {
      beginNewProspect();
      return;
    }

    if (mode === 'new') {
      void saveNew();
    }
  };

  const handleCancelNew = () => {
    if (saving) return;
    setForm(emptyForm());
    setOriginal(null);
    setMode('new');
    setShowCard(true);
  };

  const handleCloseEdit = () => {
    if (saving) return;
    if (mode === 'edit' && dirty) {
      setToast('error', 'You have unsaved changes. Please Save before closing.');
      return;
    }
    setShowCard(false);
    setMode('new');
    setOriginal(null);
    setForm(emptyForm());
  };

  const handleRefresh = async () => {
    if (saving) return;

    // Hide card, clear filters, and reload table
    setSearch('');
    setResultFilter('ALL');
    setPage(1);
    setActiveId(null);
    setOriginal(null);
    setForm(emptyForm());
    setMode('new');
    setShowCard(false);
    await loadProspects();
  };

  const topActionLabel = showCard && mode === 'edit' ? 'Save' : 'Edit Prospect';
  const canTopAction = showCard && mode === 'edit' ? requiredFilled && dirty && !saving : !!activeId && !saving;

  const bottomPrimaryLabel = !showCard ? 'New Prospect' : 'Save New Prospect';
  const canBottomAction = !showCard ? !saving : mode === 'new' ? requiredFilled && !saving : false;

  const selected = prospects.find((p) => p.id === activeId);

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-[1400px] mx-auto p-6 space-y-6">
        {/* Header - Matching FNA page style */}
        <div className="rounded-2xl border border-slate-200 bg-white px-6 py-5 shadow-sm">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <img src="/can-logo.png" alt="CAN Financial Solutions" className="h-10 w-auto" />
              <div>
                <div className="text-1x3 font-bold text-blue-800">Prospect List Tracking</div>
                 <div className="text-sm font-semibold text-yellow-500">Protecting Your Tomorrow</div>
              </div>
            </div>
            <button
              type="button"
              className="inline-flex items-center justify-center rounded-lg px-4 py-2 text-sm font-semibold transition-colors border border-slate-300 bg-transparent text-slate-700"
              onClick={logout}
            >
              Logout ➜]
            </button>
          </div>

          {/* Toasts */}
          {errorMsg && (
            <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {errorMsg}
            </div>
          )}
          {successMsg && (
            <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
              {successMsg}
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="px-6 py-5 space-y-4">
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
                {/* Show button - always visible, displays selected prospect */}
                <button
                  type="button"
                  className="inline-flex h-10 items-center justify-center rounded-lg border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-900 hover:bg-slate-50 disabled:opacity-60"
                  disabled={!activeId || saving}
                  onClick={handleShowProspect}
                  title={!activeId ? 'Select a row to view' : undefined}
                >
                  Show
                </button>

                <button
                  type="button"
                  className="inline-flex h-10 items-center justify-center rounded-lg border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-900 hover:bg-slate-50"
                  onClick={handleRefresh}
                  disabled={saving}
                >
                  Refresh
                </button>

                <div className="text-sm text-slate-500">
                  Showing {filtered.length} of {prospects.length} {filtered.length === 1 ? 'prospect' : 'prospects'}
                </div>
              </div>
            </div>

            {/* Table */}
            <div className="rounded-xl border border-slate-200">
              <div className="overflow-x-auto">
                <table className="min-w-[1200px] w-full text-sm">
                  <thead className="bg-slate-100 text-slate-700">
                    <tr className="[&>th]:whitespace-nowrap [&>th]:px-3 [&>th]:py-2 [&>th]:text-left [&>th]:font-semibold">
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
                        <td colSpan={20} className="px-3 py-6 text-center text-slate-500">
                          Loading...
                        </td>
                      </tr>
                    ) : pageRows.length === 0 ? (
                      <tr>
                        <td colSpan={20} className="px-3 py-6 text-center text-slate-500">
                          No prospects found.
                        </td>
                      </tr>
                    ) : (
                      pageRows.map((p) => {
                        const isActive = p.id === activeId;
                        return (
                          <tr
                            key={p.id}
                            onClick={() => handleSelectRow(p)}
                            className={`cursor-pointer border-t ${
                              isActive ? 'bg-emerald-50' : 'hover:bg-slate-50'
                            } [&>td]:px-3 [&>td]:py-2 [&>td]:text-xs [&>td]:text-slate-700`}
                          >
                            <td className="font-semibold text-slate-900">{p.first_name}</td>
                            <td>{p.last_name}</td>
                            <td>{p.spouse_name}</td>
                            <td>{p.relation_type}</td>
                            <td>{p.phone}</td>
                            <td>{p.city}</td>
                            <td>{p.state}</td>
                            <td className={p.top25 === 'Yes' || p.top25 === 'Y' ? 'text-emerald-700 font-semibold' : ''}>{yesNoNormalize(p.top25)}</td>
                            <td className="text-slate-600">{p.immigration}</td>
                            <td className={p.age25plus === 'Yes' || p.age25plus === 'Y' ? 'text-emerald-700 font-semibold' : ''}>{yesNoNormalize(p.age25plus)}</td>
                            <td className={p.married === 'Yes' || p.married === 'Y' ? 'text-emerald-700 font-semibold' : ''}>{yesNoNormalize(p.married)}</td>
                            <td className={p.children === 'Yes' || p.children === 'Y' ? 'text-emerald-700 font-semibold' : ''}>{yesNoNormalize(p.children)}</td>
                            <td className={p.homeowner === 'Yes' || p.homeowner === 'Y' ? 'text-emerald-700 font-semibold' : ''}>{yesNoNormalize(p.homeowner)}</td>
                            <td className={p.good_career === 'Yes' || p.good_career === 'Y' ? 'text-emerald-700 font-semibold' : ''}>{yesNoNormalize(p.good_career)}</td>
                            <td className={p.income_60k === 'Yes' || p.income_60k === 'Y' ? 'text-emerald-700 font-semibold' : ''}>{yesNoNormalize(p.income_60k)}</td>
                            <td className={p.dissatisfied === 'Yes' || p.dissatisfied === 'Y' ? 'text-emerald-700 font-semibold' : ''}>{yesNoNormalize(p.dissatisfied)}</td>
                            <td className={p.ambitious === 'Yes' || p.ambitious === 'Y' ? 'text-emerald-700 font-semibold' : ''}>{yesNoNormalize(p.ambitious)}</td>
                            <td className="text-slate-600">{p.contact_date}</td>
                            <td className="text-slate-900 font-medium">{p.result}</td>
                            <td>{p.next_steps}</td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Pagination */}
            <div className="flex items-center justify-between">
              <button
                type="button"
                className="inline-flex h-9 items-center justify-center rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-900 hover:bg-slate-50 disabled:opacity-50"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
              >
                Previous
              </button>

              <div className="text-sm text-slate-600">
                Page {safePage} of {totalPages}
              </div>

              <button
                type="button"
                className="inline-flex h-9 items-center justify-center rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-900 hover:bg-slate-50 disabled:opacity-50"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
              >
                Next
              </button>
            </div>

            {/* Bottom action buttons */}
            <div className="flex flex-wrap items-center justify-center gap-2">
              <button
                type="button"
                className={`inline-flex h-10 items-center justify-center rounded-lg px-6 text-sm font-semibold ${
                  canBottomAction
                    ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                    : 'border border-slate-200 bg-white text-slate-900 hover:bg-slate-50'
                } ${!canBottomAction ? 'opacity-60' : ''}`}
                disabled={!canBottomAction}
                onClick={handleBottomAction}
              >
                {saving && showCard && mode === 'new' ? 'Saving...' : bottomPrimaryLabel}
              </button>

              {showCard && mode === 'new' && (
                <button
                  type="button"
                  className="inline-flex h-10 items-center justify-center rounded-lg border border-slate-200 bg-white px-6 text-sm font-semibold text-slate-900 hover:bg-slate-50"
                  onClick={handleCancelNew}
                  disabled={saving}
                >
                  Cancel
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Form Card */}
        {showCard && (
          <div className="rounded-2xl border border-slate-200 bg-white px-6 py-5 shadow-sm">
            <div className="mb-4 flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-bold text-slate-900">{mode === 'edit' ? 'Selected Prospect🧑🏻‍🤝‍🧑🏻' : 'New Prospect🧑🏻‍🤝‍🧑🏻'}</h2>
                <p className="text-sm text-slate-600">
                  {mode === 'edit' && selected
                    ? `Editing✍🏻: ${selected.first_name}${selected.last_name ? ' ' + selected.last_name : ''}`
                    : 'Enter details below, then use the button under the table to save.'}
                </p>
              </div>

              {mode === 'edit' && (
                <div className="flex gap-2">
                  {/* Save button - only shows when data is edited (dirty) */}
                  {dirty && (
                    <button
                      type="button"
                      className="inline-flex h-10 items-center justify-center rounded-lg bg-emerald-600 px-4 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
                      onClick={saveEdit}
                      disabled={saving || !requiredFilled}
                    >
                      {saving ? 'Saving...' : 'Save'}
                    </button>
                  )}
                  <button
                    type="button"
                    className="inline-flex h-10 items-center justify-center rounded-lg border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-900 hover:bg-slate-50 disabled:opacity-50"
                    onClick={handleCloseEdit}
                    disabled={saving}
                  >
                    Close
                  </button>
                </div>
              )}
            </div>

            {/* Form layout */}
            <div className="space-y-3">
              <SubCard>
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-4">
                  <Field label="First Name *">
                    <TextInput
                      compact
                      placeholder="First Name"
                      value={form.first_name}
                      onChange={(v: string) => setForm((p) => ({ ...p, first_name: v }))}
                      disabled={saving}
                    />
                  </Field>

                  <Field label="Last Name *">
                    <TextInput
                      compact
                      placeholder="Last Name"
                      value={form.last_name}
                      onChange={(v: string) => setForm((p) => ({ ...p, last_name: v }))}
                      disabled={saving}
                    />
                  </Field>

                  <Field label="Spouse Name">
                    <TextInput
                      compact
                      placeholder="Spouse Name"
                      value={form.spouse_name}
                      onChange={(v: string) => setForm((p) => ({ ...p, spouse_name: v }))}
                      disabled={saving}
                    />
                  </Field>

                  <Field label="Relation Type">
                    <select
                      className="h-9 w-full rounded-lg border border-slate-200 bg-white px-2 text-xs text-slate-900"
                      value={form.relation_type}
                      onChange={(e) => setForm((p) => ({ ...p, relation_type: e.target.value }))}
                      disabled={saving}
                    >
                      {RELATION_OPTIONS.map((o) => (
                        <option key={o} value={o}>
                          {o || 'Select...'}
                        </option>
                      ))}
                    </select>
                  </Field>
                </div>
              </SubCard>

              <SubCard>
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-4">
                  <Field label="Phone *">
                    <TextInput
                      compact
                      placeholder="Phone"
                      value={form.phone}
                      onChange={(v: string) => setForm((p) => ({ ...p, phone: v }))}
                      disabled={saving}
                    />
                  </Field>

                  <Field label="City">
                    <TextInput
                      compact
                      placeholder="City"
                      value={form.city}
                      onChange={(v: string) => setForm((p) => ({ ...p, city: v }))}
                      disabled={saving}
                    />
                  </Field>

                  <Field label="State">
                    <select
                      className="h-9 w-full rounded-lg border border-slate-200 bg-white px-2 text-xs text-slate-900"
                      value={form.state}
                      onChange={(e) => setForm((p) => ({ ...p, state: e.target.value }))}
                      disabled={saving}
                    >
                      <option value=""></option>
                      {STATE_NAME_OPTIONS.map((name) => (
                        <option key={name} value={name}>
                          {name}
                        </option>
                      ))}
                    </select>
                  </Field>

                  <Field label="Immigration">
                    <select
                      className="h-9 w-full rounded-lg border border-slate-200 bg-white px-2 text-xs text-slate-900"
                      value={form.immigration}
                      onChange={(e) => setForm((p) => ({ ...p, immigration: e.target.value }))}
                      disabled={saving}
                    >
                      {IMMIGRATION_STATUS_OPTIONS.map((o) => (
                        <option key={o} value={o}>
                          {o || 'Select...'}
                        </option>
                      ))}
                    </select>
                  </Field>
                </div>
              </SubCard>

              <SubCard>
                <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5 xl:grid-cols-9">
                  <Field label="Top 25">
                    <YesNoCheckbox compact value={form.top25} onChange={(v: string) => setForm((p) => ({ ...p, top25: v }))} disabled={saving} />
                  </Field>

                  <Field label="Age 25+">
                    <YesNoCheckbox compact value={form.age25plus} onChange={(v: string) => setForm((p) => ({ ...p, age25plus: v }))} disabled={saving} />
                  </Field>

                  <Field label="Married">
                    <YesNoCheckbox compact value={form.married} onChange={(v: string) => setForm((p) => ({ ...p, married: v }))} disabled={saving} />
                  </Field>

                  <Field label="Children">
                    <YesNoCheckbox compact value={form.children} onChange={(v: string) => setForm((p) => ({ ...p, children: v }))} disabled={saving} />
                  </Field>

                  <Field label="Homeowner">
                    <YesNoCheckbox compact value={form.homeowner} onChange={(v: string) => setForm((p) => ({ ...p, homeowner: v }))} disabled={saving} />
                  </Field>

                  <Field label="Good Career">
                    <YesNoCheckbox compact value={form.good_career} onChange={(v: string) => setForm((p) => ({ ...p, good_career: v }))} disabled={saving} />
                  </Field>

                  <Field label="Income 60K">
                    <YesNoCheckbox compact value={form.income_60k} onChange={(v: string) => setForm((p) => ({ ...p, income_60k: v }))} disabled={saving} />
                  </Field>

                  <Field label="Dissatisfied">
                    <YesNoCheckbox compact value={form.dissatisfied} onChange={(v: string) => setForm((p) => ({ ...p, dissatisfied: v }))} disabled={saving} />
                  </Field>

                  <Field label="Ambitious">
                    <YesNoCheckbox compact value={form.ambitious} onChange={(v: string) => setForm((p) => ({ ...p, ambitious: v }))} disabled={saving} />
                  </Field>
                </div>
              </SubCard>

              <SubCard>
                <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                  <Field label="Contact Date">
                    <DateInput
                      compact
                      value={form.contact_date}
                      onChange={(v: string) => setForm((p) => ({ ...p, contact_date: v }))}
                      disabled={saving}
                    />
                  </Field>

                  <Field label="Result">
                    <select
                      className="h-9 w-full rounded-lg border border-slate-200 bg-white px-2 text-xs text-slate-900"
                      value={form.result}
                      onChange={(e) => setForm((p) => ({ ...p, result: e.target.value }))}
                      disabled={saving}
                    >
                      {RESULT_OPTIONS.map((o) => (
                        <option key={o} value={o}>
                          {o || 'Select...'}
                        </option>
                      ))}
                    </select>
                  </Field>

                  <Field label="Next Steps">
                    <TextInput
                      compact
                      placeholder="Next Steps"
                      value={form.next_steps}
                      onChange={(v: string) => setForm((p) => ({ ...p, next_steps: v }))}
                      disabled={saving}
                    />
                  </Field>
                </div>
              </SubCard>

              <SubCard>
                <Field label="Comments">
                  <CommentsEditor value={form.comments} onChange={(v: string) => setForm((p) => ({ ...p, comments: v }))} disabled={saving} />
                </Field>
              </SubCard>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
