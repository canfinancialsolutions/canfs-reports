'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';

type Client = {
  id: string;
  firstname: string;
  lastname: string;
  phone: string;
  email: string | null;
};

type TabId =
  | 'about'
  | 'goals'
  | 'assets'
  | 'liabilities'
  | 'insurance'
  | 'income';

type FormData = {
  spouse_name: string;
  address: string;
  city: string;
  state: string;
  zip_code: string;
  more_children_planned: boolean | null;
  more_children_count: string;

  goals_text: string;
  own_or_rent: string;
  properties_notes: string;

  has_old_401k: boolean | null;
  expects_lump_sum: boolean | null;

  li_debt: string;
  li_income: string;
  li_mortgage: string;
  li_education: string;
  li_insurance_in_place: string;

  liabilities_credit: string;
  liabilities_auto: string;
  liabilities_student: string;
  liabilities_personal: string;

  retirement_monthly_need: string;
  monthly_commitment: string;
  next_appointment_date: string;
  next_appointment_time: string;
};

const TAB_LIST: { id: TabId; label: string }[] = [
  { id: 'about', label: 'Client & Family' },
  { id: 'goals', label: 'Goals & Properties' },
  { id: 'assets', label: 'Assets' },
  { id: 'liabilities', label: 'Liabilities' },
  { id: 'insurance', label: 'Insurance' },
  { id: 'income', label: 'Income & Estate' },
];

function InputRow(props: {
  label: string;
  field: keyof FormData;
  value: string;
  onChange: (field: keyof FormData, value: string) => void;
  type?: string;
  placeholder?: string;
}) {
  const { label, field, value, onChange, type = 'text', placeholder } = props;
  return (
    <label className="block space-y-1">
      <span className="text-sm font-medium text-slate-700">{label}</span>
      <input
        type={type}
        className="w-full rounded-lg border border-slate-200 px-4 py-2 text-sm focus:border-transparent focus:ring-2 focus:ring-blue-500"
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(field, e.target.value)}
      />
    </label>
  );
}

function TextAreaRow(props: {
  label: string;
  field: keyof FormData;
  value: string;
  onChange: (field: keyof FormData, value: string) => void;
  rows?: number;
  placeholder?: string;
}) {
  const { label, field, value, onChange, rows = 4, placeholder } = props;
  return (
    <label className="block space-y-1">
      <span className="text-sm font-medium text-slate-700">{label}</span>
      <textarea
        className="w-full rounded-lg border border-slate-200 px-4 py-2 text-sm focus:border-transparent focus:ring-2 focus:ring-blue-500"
        rows={rows}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(field, e.target.value)}
      />
    </label>
  );
}

function YesNoRow(props: {
  label: string;
  field: keyof FormData;
  value: boolean | null;
  onChange: (field: keyof FormData, value: boolean | null) => void;
}) {
  const { label, field, value, onChange } = props;
  return (
    <div className="space-y-2">
      <span className="block text-sm font-medium text-slate-700">{label}</span>
      <div className="flex gap-3">
        <button
          type="button"
          className={`px-4 py-2 rounded-lg border-2 text-sm font-medium transition-all ${
            value === true
              ? 'bg-blue-600 text-white border-blue-600'
              : 'border-slate-300 hover:border-slate-400'
          }`}
          onClick={() => onChange(field, true)}
        >
          Yes
        </button>
        <button
          type="button"
          className={`px-4 py-2 rounded-lg border-2 text-sm font-medium transition-all ${
            value === false
              ? 'bg-blue-600 text-white border-blue-600'
              : 'border-slate-300 hover:border-slate-400'
          }`}
          onClick={() => onChange(field, false)}
        >
          No
        </button>
      </div>
    </div>
  );
}

export default function FnaPage() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  const [clients, setClients] = useState<Client[]>([]);
  const [search, setSearch] = useState('');
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [fnaId, setFnaId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabId>('about');
  const [isSaving, setIsSaving] = useState(false);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  const [form, setForm] = useState<FormData>({
    spouse_name: '',
    address: '',
    city: '',
    state: '',
    zip_code: '',
    more_children_planned: null,
    more_children_count: '',
    goals_text: '',
    own_or_rent: '',
    properties_notes: '',
    has_old_401k: null,
    expects_lump_sum: null,
    li_debt: '',
    li_income: '',
    li_mortgage: '',
    li_education: '',
    li_insurance_in_place: '',
    liabilities_credit: '',
    liabilities_auto: '',
    liabilities_student: '',
    liabilities_personal: '',
    retirement_monthly_need: '',
    monthly_commitment: '',
    next_appointment_date: '',
    next_appointment_time: '',
  });

  // load clients
  useEffect(() => {
    const load = async () => {
      const { data, error } = await supabase
        .from('clientregistrations')
        .select('id, firstname, lastname, phone, email')
        .order('createdat', { ascending: false });

      if (!error && data) {
        setClients(data as Client[]);
      }
    };
    load();
  }, []);

  // load or create FNA header when client selected
  useEffect(() => {
    if (!selectedClient) return;

    const loadFna = async () => {
      const { data, error } = await supabase
        .from('fna_header')
        .select('*')
        .eq('client_id', selectedClient.id)
        .maybeSingle();

      if (!error && data) {
        setFnaId(data.id);
        setForm((prev) => ({
          ...prev,
          ...mapDbToForm(data),
        }));
        return;
      }

      const { data: inserted, error: insertError } = await supabase
        .from('fna_header')
        .insert({ client_id: selectedClient.id })
        .select()
        .single();

      if (!insertError && inserted) {
        setFnaId(inserted.id);
      }
    };

    loadFna();
  }, [selectedClient]);

  const mapDbToForm = (row: any): Partial<FormData> => {
    return {
      spouse_name: row.spouse_name ?? '',
      address: row.address ?? '',
      city: row.city ?? '',
      state: row.state ?? '',
      zip_code: row.zip_code ?? '',
      more_children_planned: row.more_children_planned ?? null,
      more_children_count: row.more_children_count?.toString() ?? '',
      goals_text: row.goals_text ?? '',
      own_or_rent: row.own_or_rent ?? '',
      properties_notes: row.properties_notes ?? '',
      has_old_401k: row.has_old_401k ?? null,
      expects_lump_sum: row.expects_lump_sum ?? null,
      li_debt: row.li_debt?.toString() ?? '',
      li_income: row.li_income?.toString() ?? '',
      li_mortgage: row.li_mortgage?.toString() ?? '',
      li_education: row.li_education?.toString() ?? '',
      li_insurance_in_place: row.li_insurance_in_place?.toString() ?? '',
      liabilities_credit: row.liabilities_credit?.toString() ?? '',
      liabilities_auto: row.liabilities_auto?.toString() ?? '',
      liabilities_student: row.liabilities_student?.toString() ?? '',
      liabilities_personal: row.liabilities_personal?.toString() ?? '',
      retirement_monthly_need: row.retirement_monthly_need?.toString() ?? '',
      monthly_commitment: row.monthly_commitment?.toString() ?? '',
      next_appointment_date: row.next_appointment_date
        ? row.next_appointment_date.slice(0, 10)
        : '',
      next_appointment_time: row.next_appointment_time ?? '',
    };
  };

  const handleChange = (field: keyof FormData, value: string | boolean | null) => {
    setForm((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleSave = async () => {
    if (!selectedClient || !fnaId) return;
    setIsSaving(true);
    setStatusMsg(null);

    const payload: any = {
      spouse_name: form.spouse_name,
      address: form.address,
      city: form.city,
      state: form.state,
      zip_code: form.zip_code,
      more_children_planned: form.more_children_planned,
      more_children_count: numberOrNull(form.more_children_count),
      goals_text: form.goals_text,
      own_or_rent: form.own_or_rent,
      properties_notes: form.properties_notes,
      has_old_401k: form.has_old_401k,
      expects_lump_sum: form.expects_lump_sum,
      li_debt: numberOrNull(form.li_debt),
      li_income: numberOrNull(form.li_income),
      li_mortgage: numberOrNull(form.li_mortgage),
      li_education: numberOrNull(form.li_education),
      li_insurance_in_place: numberOrNull(form.li_insurance_in_place),
      liabilities_credit: numberOrNull(form.liabilities_credit),
      liabilities_auto: numberOrNull(form.liabilities_auto),
      liabilities_student: numberOrNull(form.liabilities_student),
      liabilities_personal: numberOrNull(form.liabilities_personal),
      retirement_monthly_need: numberOrNull(form.retirement_monthly_need),
      monthly_commitment: numberOrNull(form.monthly_commitment),
      next_appointment_date:
        form.next_appointment_date || null,
      next_appointment_time:
        form.next_appointment_time || null,
      updated_at: new Date().toISOString(),
    };

    const { error } = await supabase
      .from('fna_header')
      .update(payload)
      .eq('id', fnaId);

    setIsSaving(false);
    setStatusMsg(error ? 'Error saving FNA' : 'FNA saved successfully');
  };

  const numberOrNull = (v: string) => {
    if (!v) return null;
    const n = Number(v);
    return Number.isNaN(n) ? null : n;
  };

  const filteredClients = clients.filter((c) => {
    const q = search.toLowerCase();
    return (
      c.firstname.toLowerCase().includes(q) ||
      c.lastname.toLowerCase().includes(q) ||
      c.phone.toLowerCase().includes(q)
    );
  });

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-6">
      {/* Header with exit */}
      <div className="mx-auto mb-6 flex max-w-6xl items-center justify-between rounded-xl border bg-white px-6 py-4 shadow-sm">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">
            Financial Needs Analysis
          </h1>
          <p className="text-sm text-slate-600">
            Select a client and complete all six sections of the FNA.
          </p>
        </div>
        <button
          className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-red-700"
          onClick={() => (window.location.href = '/auth')}
        >
          ← Exit to Login
        </button>
      </div>

      <div className="mx-auto max-w-6xl space-y-6">
        {/* Client picker */}
        <section className="rounded-xl border bg-white p-4 shadow-sm">
          <h2 className="mb-3 text-lg font-semibold text-slate-900">
            1. Choose Client
          </h2>
          <div className="mb-3 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <input
              type="text"
              className="w-full rounded-lg border border-slate-200 px-4 py-2 text-sm md:w-80"
              placeholder="Search by name or phone..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            {selectedClient && (
              <div className="text-xs text-slate-600">
                Active client:{' '}
                <span className="font-semibold">
                  {selectedClient.firstname} {selectedClient.lastname}
                </span>{' '}
                ({selectedClient.phone})
              </div>
            )}
          </div>
          <div className="max-h-64 overflow-auto rounded-lg border">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-3 py-2 text-left">First</th>
                  <th className="px-3 py-2 text-left">Last</th>
                  <th className="px-3 py-2 text-left">Phone</th>
                  <th className="px-3 py-2 text-left">Email</th>
                  <th className="px-3 py-2" />
                </tr>
              </thead>
              <tbody>
                {filteredClients.map((c) => (
                  <tr
                    key={c.id}
                    className={
                      selectedClient?.id === c.id
                        ? 'bg-blue-50'
                        : 'hover:bg-slate-50'
                    }
                  >
                    <td className="px-3 py-2">{c.firstname}</td>
                    <td className="px-3 py-2">{c.lastname}</td>
                    <td className="px-3 py-2">{c.phone}</td>
                    <td className="px-3 py-2 text-xs text-slate-600">
                      {c.email}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <button
                        className="rounded-md bg-blue-600 px-3 py-1 text-xs font-semibold text-white hover:bg-blue-700"
                        onClick={() => {
                          setSelectedClient(c);
                          setFnaId(null); // force reload
                        }}
                      >
                        Select
                      </button>
                    </td>
                  </tr>
                ))}
                {filteredClients.length === 0 && (
                  <tr>
                    <td
                      colSpan={5}
                      className="px-3 py-4 text-center text-xs text-slate-500"
                    >
                      No clients found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        {/* Tabs + form */}
        <section className="rounded-xl border bg-white p-4 shadow-sm">
          <div className="mb-4 flex flex-wrap gap-1 border-b">
            {TAB_LIST.map((tab) => (
              <button
                key={tab.id}
                type="button"
                disabled={!selectedClient}
                className={`px-3 py-2 text-xs font-medium border-b-2 ${
                  activeTab === tab.id
                    ? 'border-blue-600 text-blue-700'
                    : 'border-transparent text-slate-500 hover:text-slate-700'
                }`}
                onClick={() => setActiveTab(tab.id)}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {!selectedClient && (
            <p className="text-sm text-slate-500">
              Select a client above to begin the Financial Needs Analysis.
            </p>
          )}

          {selectedClient && (
            <div className="space-y-6">
              {activeTab === 'about' && (
                <AboutTab form={form} onChange={handleChange} />
              )}
              {activeTab === 'goals' && (
                <GoalsTab form={form} onChange={handleChange} />
              )}
              {activeTab === 'assets' && (
                <AssetsTab form={form} onChange={handleChange} />
              )}
              {activeTab === 'liabilities' && (
                <LiabilitiesTab form={form} onChange={handleChange} />
              )}
              {activeTab === 'insurance' && (
                <InsuranceTab form={form} onChange={handleChange} />
              )}
              {activeTab === 'income' && (
                <IncomeTab form={form} onChange={handleChange} />
              )}

              <div className="mt-4 flex items-center justify-between border-t pt-3">
                {statusMsg && (
                  <p className="text-xs text-slate-600">{statusMsg}</p>
                )}
                <button
                  type="button"
                  disabled={isSaving}
                  onClick={handleSave}
                  className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
                >
                  {isSaving ? 'Saving...' : 'Save FNA'}
                </button>
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

/* --- TAB COMPONENTS --- */

function AboutTab({
  form,
  onChange,
}: {
  form: FormData;
  onChange: (field: keyof FormData, value: string | boolean | null) => void;
}) {
  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold text-slate-800">
        Tell us about you
      </h3>
      <div className="grid gap-3 md:grid-cols-2">
        <InputRow
          label="Spouse Name"
          field="spouse_name"
          value={form.spouse_name}
          onChange={onChange}
        />
        <InputRow
          label="Address"
          field="address"
          value={form.address}
          onChange={onChange}
        />
        <InputRow
          label="City"
          field="city"
          value={form.city}
          onChange={onChange}
        />
        <InputRow
          label="State"
          field="state"
          value={form.state}
          onChange={onChange}
        />
        <InputRow
          label="ZIP Code"
          field="zip_code"
          value={form.zip_code}
          onChange={onChange}
        />
      </div>

      <h4 className="text-sm font-semibold text-slate-800">
        Children & Education
      </h4>
      <div className="grid gap-3 md:grid-cols-3">
        <YesNoRow
          label="Do you plan to have more children?"
          field="more_children_planned"
          value={form.more_children_planned}
          onChange={onChange}
        />
        <InputRow
          label="If yes, how many?"
          field="more_children_count"
          value={form.more_children_count}
          onChange={onChange}
          type="number"
        />
      </div>
    </div>
  );
}

function GoalsTab({
  form,
  onChange,
}: {
  form: FormData;
  onChange: (field: keyof FormData, value: string | boolean | null) => void;
}) {
  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold text-slate-800">
        Tell us about your goals
      </h3>
      <TextAreaRow
        label="What financial goals are most important to you in the next 5–10 years?"
        field="goals_text"
        value={form.goals_text}
        onChange={onChange}
        rows={4}
      />
      <h4 className="text-sm font-semibold text-slate-800">Properties</h4>
      <div className="grid gap-3 md:grid-cols-3">
        <InputRow
          label="Do you own or rent?"
          field="own_or_rent"
          value={form.own_or_rent}
          onChange={onChange}
          placeholder="Own / Rent"
        />
        <TextAreaRow
          label="Notes about your home / properties"
          field="properties_notes"
          value={form.properties_notes}
          onChange={onChange}
          rows={3}
        />
      </div>
    </div>
  );
}

function AssetsTab({
  form,
  onChange,
}: {
  form: FormData;
  onChange: (field: keyof FormData, value: string | boolean | null) => void;
}) {
  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold text-slate-800">
        Tell us about your assets
      </h3>
      <YesNoRow
        label="Do you have a 401(k) from a previous employer?"
        field="has_old_401k"
        value={form.has_old_401k}
        onChange={onChange}
      />
      <YesNoRow
        label="Do you expect any lump sums or inheritance in the near future?"
        field="expects_lump_sum"
        value={form.expects_lump_sum}
        onChange={onChange}
      />
      <p className="text-xs text-slate-500">
        Detailed line items (tax-advantaged, taxable, tax-deferred) can be
        added later using separate tables.
      </p>
    </div>
  );
}

function LiabilitiesTab({
  form,
  onChange,
}: {
  form: FormData;
  onChange: (field: keyof FormData, value: string | boolean | null) => void;
}) {
  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold text-slate-800">
        Tell us about your liabilities
      </h3>
      <div className="grid gap-3 md:grid-cols-2">
        <InputRow
          label="Credit card debt ($)"
          field="liabilities_credit"
          value={form.liabilities_credit}
          onChange={onChange}
          type="number"
        />
        <InputRow
          label="Auto loans ($)"
          field="liabilities_auto"
          value={form.liabilities_auto}
          onChange={onChange}
          type="number"
        />
        <InputRow
          label="Student loans ($)"
          field="liabilities_student"
          value={form.liabilities_student}
          onChange={onChange}
          type="number"
        />
        <InputRow
          label="Personal loans / other ($)"
          field="liabilities_personal"
          value={form.liabilities_personal}
          onChange={onChange}
          type="number"
        />
      </div>
      <p className="text-xs text-slate-500">
        Use these totals for quick planning; more detailed debt snowball
        tracking can be added later.
      </p>
    </div>
  );
}

function InsuranceTab({
  form,
  onChange,
}: {
  form: FormData;
  onChange: (field: keyof FormData, value: string | boolean | null) => void;
}) {
  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold text-slate-800">
        Tell us about your insurance
      </h3>
      <div className="grid gap-3 md:grid-cols-2">
        <InputRow
          label="Debt to cover ($)"
          field="li_debt"
          value={form.li_debt}
          onChange={onChange}
          type="number"
        />
        <InputRow
          label="Income replacement ($)"
          field="li_income"
          value={form.li_income}
          onChange={onChange}
          type="number"
        />
        <InputRow
          label="Mortgage payoff ($)"
          field="li_mortgage"
          value={form.li_mortgage}
          onChange={onChange}
          type="number"
        />
        <InputRow
          label="Education funding ($)"
          field="li_education"
          value={form.li_education}
          onChange={onChange}
          type="number"
        />
        <InputRow
          label="Existing life insurance total ($)"
          field="li_insurance_in_place"
          value={form.li_insurance_in_place}
          onChange={onChange}
          type="number"
        />
      </div>
      <p className="text-xs text-slate-500">
        The detailed life insurance need calculation can be automated later
        using these values.
      </p>
    </div>
  );
}

function IncomeTab({
  form,
  onChange,
}: {
  form: FormData;
  onChange: (field: keyof FormData, value: string | boolean | null) => void;
}) {
  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold text-slate-800">
        Tell us about your income & retirement
      </h3>
      <div className="grid gap-3 md:grid-cols-2">
        <InputRow
          label="If you retired today, monthly income needed ($)"
          field="retirement_monthly_need"
          value={form.retirement_monthly_need}
          onChange={onChange}
          type="number"
        />
        <InputRow
          label="Additional monthly commitment to goals ($)"
          field="monthly_commitment"
          value={form.monthly_commitment}
          onChange={onChange}
          type="number"
        />
        <InputRow
          label="Next appointment date"
          field="next_appointment_date"
          value={form.next_appointment_date}
          onChange={onChange}
          type="date"
        />
        <InputRow
          label="Next appointment time"
          field="next_appointment_time"
          value={form.next_appointment_time}
          onChange={onChange}
          type="time"
        />
      </div>
    </div>
  );
}
