// app/prospect/page.tsx
'use client';

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { createClient } from '@supabase/supabase-js';
 
// Add to your dashboard page (top section)
<div className="flex justify-between items-center mb-6">
  <h1 className="text-2xl font-bold">CAN Financial Solutions Dashboard</h1>
  <button
    onClick={() => window.location.href = '/auth'}
    className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg font-medium transition-colors"
  >
    ← Exit
  </button>
</div>


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
const RESULT_OPTIONS = ['', 'Business', 'Both', 'Client Solution', 'In-Progress', 'Called', 'Not Interested', 'Others'] as const;

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

const stateToName = (v?: string | null) => {
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


const yesNoNormalize = (v?: string | null) => {
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
  state: stateToName(p.state),
  top25: yesNoNormalize(p.top25),
  immigration: p.immigration || '',
  age25plus: yesNoNormalize(p.age25plus),
  married: yesNoNormalize(p.married),
  children: yesNoNormalize(p.children),
  homeowner: yesNoNormalize(p.homeowner),
  good_career: yesNoNormalize(p.good_career),
  income_60k: yesNoNormalize(p.income_60k),
  dissatisfied: yesNoNormalize(p.dissatisfied),
  ambitious: yesNoNormalize(p.ambitious),
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


const normalizeProspectRow = (p: Prospect): Prospect => ({
  ...p,
  state: stateToName(p.state) || null,
  top25: yesNoNormalize(p.top25) || null,
  age25plus: yesNoNormalize(p.age25plus) || null,
  married: yesNoNormalize(p.married) || null,
  children: yesNoNormalize(p.children) || null,
  homeowner: yesNoNormalize(p.homeowner) || null,
  good_career: yesNoNormalize(p.good_career) || null,
  income_60k: yesNoNormalize(p.income_60k) || null,
  dissatisfied: yesNoNormalize(p.dissatisfied) || null,
  ambitious: yesNoNormalize(p.ambitious) || null,
});

const Field = ({ label, children }: { label: string; children: ReactNode }) => (
  <div className="flex flex-col gap-1">
    <label className="text-xs font-semibold text-slate-700">{label}</label>
    {children}
  </div>
);


const SubCard = ({ children }: { children: ReactNode }) => (
  <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
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

const YesNoCheckbox = ({
  value,
  onChange,
  disabled,
  compact,
}: {
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
  compact?: boolean;
}) => {
  const v = yesNoNormalize(value);

  const setYes = () => onChange(v === 'Yes' ? '' : 'Yes');
  const setNo = () => onChange(v === 'No' ? '' : 'No');

  return (
    <div className={`flex items-center ${compact ? 'gap-2' : 'gap-3'}`}>
      <label className={`inline-flex items-center ${compact ? 'gap-1 text-xs' : 'gap-2 text-sm'} text-slate-700`}>
        <input
          type="checkbox"
          className="h-4 w-4 rounded border-slate-300"
          checked={v === 'Yes'}
          onChange={() => setYes()}
          disabled={disabled}
        />
        <span>Yes</span>
      </label>

      <label className={`inline-flex items-center ${compact ? 'gap-1 text-xs' : 'gap-2 text-sm'} text-slate-700`}>
        <input
          type="checkbox"
          className="h-4 w-4 rounded border-slate-300"
          checked={v === 'No'}
          onChange={() => setNo()}
          disabled={disabled}
        />
        <span>No</span>
      </label>
    </div>
  );
};

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
        className="min-h-[96px] w-full resize-y px-3 py-2 text-sm text-slate-900 outline-none whitespace-pre-wrap break-words"
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

  const [activeId, setActiveId] = useState<number | null>(null); // highlighted row
  const [original, setOriginal] = useState<Prospect | null>(null); // original selected row (edit mode)
  const [form, setForm] = useState<ProspectForm>(emptyForm());
  const [mode, setMode] = useState<'new' | 'edit'>('new'); // card mode when visible
  const [showCard, setShowCard] = useState(false);
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

  const selected = useMemo(() => {
    if (activeId == null) return null;
    return prospects.find((p) => p.id === activeId) || null;
  }, [prospects, activeId]);

  const requiredFilled =
    form.first_name.trim().length > 0 && form.last_name.trim().length > 0 && form.phone.trim().length > 0;

  const dirty = mode === 'edit' && original ? isDirtyVsOriginal(form, original) : false;

  const isNewFormEmpty = (f: ProspectForm) => {
    const check: (keyof ProspectForm)[] = [
      'first_name',
      'last_name',
      'spouse_name',
      'relation_type',
      'phone',
      'city',
      'state',
      'top25',
      'immigration',
      'age25plus',
      'married',
      'children',
      'homeowner',
      'good_career',
      'income_60k',
      'dissatisfied',
      'ambitious',
      'contact_date',
      'result',
      'next_steps',
      'comments',
    ];
    return check.every((k) => (f[k] || '').toString().trim().length === 0);
  };

  const loadProspects = async () => {
    if (!supabase) {
      setProspects([]);
      setLoading(false);
      setToast(
        'error',
        'Supabase is not configured. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to your environment variables.'
      );
      return;
    }

    setLoading(true);
    setErrorMsg('');

    const db: any = (supabase as any).schema ? (supabase as any).schema('public') : supabase;
    const { data, error } = await db.from('prospects').select('*').order('id', { ascending: false });

    if (error) {
      setToast('error', error.message);
      setLoading(false);
      return;
    }

    const rows = ((data || []) as Prospect[]).map(normalizeProspectRow);
    setProspects(rows);
    setLoading(false);

    // Keep highlighted selection in sync after reload (do not clobber an open edit form)
    if (activeId != null) {
      const updated = rows.find((r) => r.id === activeId) || null;
      if (!updated) {
        setActiveId(null);
        setOriginal(null);
        if (showCard && mode === 'edit') {
          setShowCard(false);
          setMode('new');
          setForm(emptyForm());
        }
      } else if (showCard && mode === 'edit' && original && !dirty) {
        setOriginal(updated);
        setForm(formFromProspect(updated));
      }
    }
  };

  useEffect(() => {
    loadProspects();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabase]);

  const filtered = prospects.filter((p) => {
    const qRaw = search.trim();
    const q = qRaw.toLowerCase();
    const qDigits = qRaw.replace(/\D/g, '');

    const haystack = [
      p.first_name,
      p.last_name,
      p.spouse_name,
      p.relation_type,
      p.phone,
      p.city,
      p.state,
      p.immigration,
      p.result,
      p.next_steps,
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();

    const phoneDigits = (p.phone || '').replace(/\D/g, '');

    const matchSearch = !q || haystack.includes(q) || (!!qDigits && phoneDigits.includes(qDigits));

    const matchResult = resultFilter === 'ALL' || normText(p.result || '') === normText(resultFilter);
    return matchSearch && matchResult;
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const start = (currentPage - 1) * PAGE_SIZE;
  const pageRows = filtered.slice(start, start + PAGE_SIZE);

  const buildPayloadFromForm = (f: ProspectForm) => {
    const stateName = stateToName(f.state);
    return {
      first_name: f.first_name.trim(),
      last_name: f.last_name.trim() || null,
      spouse_name: toNull(f.spouse_name),
      relation_type: toNull(f.relation_type),
      phone: f.phone.trim() || null,
      city: toNull(f.city),
      state: stateName ? stateName : null,
      top25: yesNoNormalize(f.top25) || null,
      immigration: toNull(f.immigration),
      age25plus: yesNoNormalize(f.age25plus) || null,
      married: yesNoNormalize(f.married) || null,
      children: yesNoNormalize(f.children) || null,
      homeowner: yesNoNormalize(f.homeowner) || null,
      good_career: yesNoNormalize(f.good_career) || null,
      income_60k: yesNoNormalize(f.income_60k) || null,
      dissatisfied: yesNoNormalize(f.dissatisfied) || null,
      ambitious: yesNoNormalize(f.ambitious) || null,
      contact_date: toNull(f.contact_date),
      result: toNull(f.result),
      next_steps: toNull(f.next_steps),
      comments: toNull(f.comments),
    } as Omit<Prospect, 'id'>;
  };

  const beginNewProspect = () => {
    if (saving) return;

    // prevent losing an in-progress new entry
    if (showCard && mode === 'new' && !isNewFormEmpty(form)) {
      setToast('error', 'You have an in-progress New Prospect. Please Save or Cancel before starting over.');
      return;
    }
    // prevent losing edits
    if (showCard && mode === 'edit' && dirty) {
      setToast('error', 'You have unsaved changes. Please Save before starting a new prospect.');
      return;
    }

    setMode('new');
    setShowCard(true);
    setOriginal(null);
    setActiveId(null);
    setForm(emptyForm());
  };

  const handleSelectRow = (p: Prospect) => {
    if (saving) return;

    if (showCard && mode === 'new' && !isNewFormEmpty(form)) {
      setToast('error', 'You have an in-progress New Prospect. Please Save or Cancel before selecting another row.');
      return;
    }
    if (showCard && mode === 'edit' && dirty && p.id !== activeId) {
      setToast('error', 'You have unsaved changes. Please Save before selecting another prospect.');
      return;
    }

    setActiveId(p.id);
    setOriginal(p);
    setForm(formFromProspect(p));
    setMode('edit');
    setShowCard(true);
  };

  const openEditFromSelection = () => {
    if (saving) return;

    if (!selected) {
      setToast('error', 'Please select a prospect row first.');
      return;
    }
    if (showCard && mode === 'new' && !isNewFormEmpty(form)) {
      setToast('error', 'You have an in-progress New Prospect. Please Save or Cancel before editing another prospect.');
      return;
    }

    setOriginal(selected);
    setForm(formFromProspect(selected));
    setMode('edit');
    setShowCard(true);
  };

  const saveNew = async () => {
    if (!supabase) {
      setToast('error', 'Missing Supabase environment variables.');
      return;
    }
    if (!requiredFilled) {
      setToast('error', 'First Name, Last Name, and Phone are required.');
      return;
    }

    setSaving(true);

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

    const inserted = normalizeProspectRow(data as Prospect);

    setProspects((prev) => [inserted, ...prev.filter((x) => x.id !== inserted.id)]);
    setActiveId(inserted.id);
    setToast('success', `Added prospect #${inserted.id}`);

    // Keep card open for rapid entry, but clear fields
    setOriginal(null);
    setForm(emptyForm());
    setMode('new');
    setShowCard(true);

    setSaving(false);
  };

  const saveEdit = async () => {
    if (!supabase) {
      setToast('error', 'Missing Supabase environment variables.');
      return;
    }
    if (!requiredFilled) {
      setToast('error', 'First Name, Last Name, and Phone are required.');
      return;
    }
    if (!activeId || !original) {
      setToast('error', 'Please select a prospect row first.');
      return;
    }
    if (!dirty) {
      setToast('error', 'No changes to save.');
      return;
    }

    setSaving(true);

    const payload = {
      ...buildPayloadFromForm(form),
      updated_at: new Date().toISOString(),
    } as Partial<Omit<Prospect, 'id'>>;

    const { data, error } = await supabase.from('prospects').update(payload).eq('id', activeId).select('*').single();

    if (error) {
      setToast('error', error.message);
      setSaving(false);
      return;
    }

    const updated = normalizeProspectRow(data as Prospect);

    setProspects((prev) => prev.map((x) => (x.id === updated.id ? updated : x)));
    setActiveId(updated.id);
    setToast('success', `Saved prospect #${updated.id}`);

    // After saving edits, stay highlighted and switch to "Save New Prospect" flow (per requested UX)
    setOriginal(updated);
    setMode('new');
    setForm(emptyForm());
    setShowCard(true);

    setSaving(false);
  };

  const handleTopAction = () => {
    if (saving) return;

    // If currently editing with the card open, the top action is "Save"
    if (showCard && mode === 'edit') {
      void saveEdit();
      return;
    }

    // Otherwise, top action is "Edit Prospect"
    openEditFromSelection();
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
            {/* Top-of-table action: Edit Prospect (or Save in edit mode) */}
            <button
              type="button"
              className={`inline-flex h-10 items-center justify-center rounded-lg px-4 text-sm font-semibold ${
                showCard && mode === 'edit'
                  ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                  : 'border border-slate-200 bg-white text-slate-900 hover:bg-slate-50'
              } ${!canTopAction ? 'opacity-60' : ''}`}
              disabled={!canTopAction}
              onClick={handleTopAction}
              title={!canTopAction && !(showCard && mode === 'edit') ? 'Select a row to edit' : undefined}
            >
              {saving && showCard && mode === 'edit' ? 'Saving…' : topActionLabel}
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
                  pageRows.map((p, idx) => {
                    const isActive = p.id === activeId;
                    return (
                      <tr
                        key={p.id}
                        onClick={() => handleSelectRow(p)}
                        className={`cursor-pointer border-t ${
                          isActive ? 'bg-emerald-50' : 'hover:bg-slate-50'
                        }`}
                      >
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
                        <td className="px-3 py-2">{p.contact_date || ''}</td>
                        <td className="px-3 py-2">{p.result || ''}</td>
                        <td className="px-3 py-2">{p.next_steps || ''}</td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between px-3 py-3">
            <div className="text-sm text-slate-600">
              Page {currentPage} of {totalPages}
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={currentPage <= 1}
              >
                Prev
              </button>
              <button
                type="button"
                className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage >= totalPages}
              >
                Next
              </button>
            </div>
          </div>
        </div>

        {/* Below-table action: New Prospect (or Save New Prospect / Add Prospect in new mode) */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {/* Hide below-table button during edit mode */}
            {!(showCard && mode === 'edit') && (
              <>
                <button
                  type="button"
                  className={`inline-flex h-10 items-center justify-center rounded-lg px-4 text-sm font-semibold ${
                    showCard ? 'bg-emerald-600 text-white hover:bg-emerald-700' : 'border border-slate-200 bg-white text-slate-900 hover:bg-slate-50'
                  } ${!canBottomAction ? 'opacity-60' : ''}`}
                  onClick={handleBottomAction}
                  disabled={!canBottomAction}
                >
                  {saving && showCard ? 'Saving…' : bottomPrimaryLabel}
                </button>

                {showCard && mode === 'new' && (
                  <button
                    type="button"
                    className="inline-flex h-10 items-center justify-center rounded-lg border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-900 hover:bg-slate-50"
                    onClick={handleCancelNew}
                    disabled={saving}
                  >
                    Cancel
                  </button>
                )}
              </>
            )}
          </div>

          <div className="text-xs text-slate-500">
            {showCard && mode === 'new' ? 'Fill First Name, Last Name, and Phone to enable Save.' : ''}
          </div>
        </div>

        {/* Single Card (hidden by default) */}
        {showCard && (
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
            <div className="mb-2 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-slate-900">{mode === 'edit' ? 'Selected Prospect' : 'New Prospect'}</h2>
                <p className="text-sm text-slate-600">
                  {mode === 'edit' && selected
                    ? `Editing #${selected.id} — ${selected.first_name}${selected.last_name ? ' ' + selected.last_name : ''}`
                    : 'Enter details below, then use the button under the table to save.'}
                </p>
              </div>

              {mode === 'edit' && (
                <button
                  type="button"
                  className="inline-flex h-10 items-center justify-center rounded-lg border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-900 hover:bg-slate-50 disabled:opacity-50"
                  onClick={handleCloseEdit}
                  disabled={saving}
                >
                  Close
                </button>
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
                      onChange={(v) => setForm((p) => ({ ...p, first_name: v }))}
                      disabled={saving}
                    />
                  </Field>

                  <Field label="Last Name *">
                    <TextInput
                      compact
                      placeholder="Last Name"
                      value={form.last_name}
                      onChange={(v) => setForm((p) => ({ ...p, last_name: v }))}
                      disabled={saving}
                    />
                  </Field>

                  <Field label="Spouse Name">
                    <TextInput
                      compact
                      placeholder="Spouse Name"
                      value={form.spouse_name}
                      onChange={(v) => setForm((p) => ({ ...p, spouse_name: v }))}
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
                      onChange={(v) => setForm((p) => ({ ...p, phone: v }))}
                      disabled={saving}
                    />
                  </Field>

                  <Field label="City">
                    <TextInput
                      compact
                      placeholder="City"
                      value={form.city}
                      onChange={(v) => setForm((p) => ({ ...p, city: v }))}
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
                    <YesNoCheckbox compact value={form.top25} onChange={(v) => setForm((p) => ({ ...p, top25: v }))} disabled={saving} />
                  </Field>

                  <Field label="Age 25+">
                    <YesNoCheckbox compact value={form.age25plus} onChange={(v) => setForm((p) => ({ ...p, age25plus: v }))} disabled={saving} />
                  </Field>

                  <Field label="Married">
                    <YesNoCheckbox compact value={form.married} onChange={(v) => setForm((p) => ({ ...p, married: v }))} disabled={saving} />
                  </Field>

                  <Field label="Children">
                    <YesNoCheckbox compact value={form.children} onChange={(v) => setForm((p) => ({ ...p, children: v }))} disabled={saving} />
                  </Field>

                  <Field label="Homeowner">
                    <YesNoCheckbox compact value={form.homeowner} onChange={(v) => setForm((p) => ({ ...p, homeowner: v }))} disabled={saving} />
                  </Field>

                  <Field label="Good Career">
                    <YesNoCheckbox compact value={form.good_career} onChange={(v) => setForm((p) => ({ ...p, good_career: v }))} disabled={saving} />
                  </Field>

                  <Field label="Income 60K">
                    <YesNoCheckbox compact value={form.income_60k} onChange={(v) => setForm((p) => ({ ...p, income_60k: v }))} disabled={saving} />
                  </Field>

                  <Field label="Dissatisfied">
                    <YesNoCheckbox compact value={form.dissatisfied} onChange={(v) => setForm((p) => ({ ...p, dissatisfied: v }))} disabled={saving} />
                  </Field>

                  <Field label="Ambitious">
                    <YesNoCheckbox compact value={form.ambitious} onChange={(v) => setForm((p) => ({ ...p, ambitious: v }))} disabled={saving} />
                  </Field>
                </div>
              </SubCard>

              <SubCard>
                <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                  <Field label="Contact Date">
                    <DateInput
                      compact
                      value={form.contact_date}
                      onChange={(v) => setForm((p) => ({ ...p, contact_date: v }))}
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
                      onChange={(v) => setForm((p) => ({ ...p, next_steps: v }))}
                      disabled={saving}
                    />
                  </Field>
                </div>
              </SubCard>

              <SubCard>
                <Field label="Comments">
                  <CommentsEditor value={form.comments} onChange={(v) => setForm((p) => ({ ...p, comments: v }))} disabled={saving} />
                </Field>
              </SubCard>
            </div>
            </div>
        )}
      </div>
    </div>
  );
}
