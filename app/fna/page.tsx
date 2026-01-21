
'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';  // ← FIXED: Import at TOP

// FNA Types
type Client = {
  id: string;
  firstname: string;
  lastname: string;
  phone: string;
  email: string | null;
};

type TabId = 'about' | 'goals' | 'assets' | 'liabilities' | 'insurance' | 'income';

export default function FnaPage() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  const supabase = createClient(supabaseUrl, supabaseKey);  // ← FIXED: Inside function OK now
  
  const [clients, setClients] = useState<Client[]>([]);
  const [search, setSearch] = useState('');
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [activeTab, setActiveTab] = useState<TabId>('about');
  const [isSaving, setIsSaving] = useState(false);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  const [form, setForm] = useState<any>({
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
    retirement_monthly_need: '',
    monthly_commitment: '',
    next_appointment_date: '',
    next_appointment_time: '',
  });

  const [fnaId, setFnaId] = useState<string | null>(null);

  // Load clients
  useEffect(() => {
    const loadClients = async () => {
      const { data, error } = await supabase
        .from('clientregistrations')
        .select('id, firstname, lastname, phone, email')
        .order('createdat', { ascending: false });

      if (!error && data) {
        setClients(data as Client[]);
      } else {
        console.error('Load clients error:', error);
      }
    };
    loadClients();
  }, []);

  // Load or create FNA for selected client
  useEffect(() => {
    if (!selectedClient) return;

    const loadFna = async () => {
      const { data, error } = await supabase
        .from('fna_header')
        .select('*')
        .eq('client_id', selectedClient.id)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') {  // PGRST116 = no rows
        console.error('Load FNA error:', error);
        return;
      }

      if (data) {
        setFnaId(data.id);
        setForm((prev: any) => ({ ...prev, ...data }));
      } else {
        // Create new FNA header
        const { data: inserted, error: insertError } = await supabase
          .from('fna_header')
          .insert({ client_id: selectedClient.id })
          .select()
          .single();

        if (!insertError && inserted) {
          setFnaId(inserted.id);
        }
      }
    };

    loadFna();
  }, [selectedClient]);

  const handleChange = (field: string, value: any) => {
    setForm((prev: any) => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    if (!selectedClient || !fnaId) return;
    setIsSaving(true);
    setStatusMsg(null);

    const payload = {
      ...form,
      updated_at: new Date().toISOString(),
      more_children_count: form.more_children_count === '' ? null : Number(form.more_children_count),
      li_debt: form.li_debt === '' ? null : Number(form.li_debt),
      li_income: form.li_income === '' ? null : Number(form.li_income),
      li_mortgage: form.li_mortgage === '' ? null : Number(form.li_mortgage),
      li_education: form.li_education === '' ? null : Number(form.li_education),
      li_insurance_in_place: form.li_insurance_in_place === '' ? null : Number(form.li_insurance_in_place),
      retirement_monthly_need: form.retirement_monthly_need === '' ? null : Number(form.retirement_monthly_need),
      monthly_commitment: form.monthly_commitment === '' ? null : Number(form.monthly_commitment),
    };

    const { error } = await supabase
      .from('fna_header')
      .update(payload)
      .eq('id', fnaId);

    setIsSaving(false);
    if (error) {
      setStatusMsg('Error saving: ' + error.message);
    } else {
      setStatusMsg('✅ Saved successfully!');
    }
  };

  const TABS: { id: TabId; label: string }[] = [
    { id: 'about', label: 'Client & Family' },
    { id: 'goals', label: 'Goals & Properties' },
    { id: 'assets', label: 'Assets' },
    { id: 'liabilities', label: 'Liabilities' },
    { id: 'insurance', label: 'Insurance' },
    { id: 'income', label: 'Income & Estate' },
  ];

  const filteredClients = clients.filter((c) => {
    const q = search.toLowerCase();
    return (
      c.firstname.toLowerCase().includes(q) ||
      c.lastname.toLowerCase().includes(q) ||
      c.phone.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6">
      {/* Client picker */}
      <section className="rounded-lg border bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-bold mb-2 text-slate-900">
          Financial Needs Analysis
        </h1>
        <p className="text-slate-600 mb-6">
          Select a client to complete their FNA across 6 organized tabs.
        </p>

        <div className="flex flex-col gap-3 lg:flex-row lg:items-end mb-6">
          <input
            type="text"
            placeholder="🔍 Search clients by name or phone..."
            className="flex-1 rounded-xl border border-slate-200 px-4 py-3 focus:ring-2 focus:ring-blue-500"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {selectedClient && (
            <div className="text-sm text-slate-700 bg-blue-50 px-4 py-2 rounded-lg">
              Active: <strong>{selectedClient.firstname} {selectedClient.lastname}</strong> 
              ({selectedClient.phone})
            </div>
          )}
        </div>

        <div className="max-h-64 overflow-auto rounded-xl border border-slate-200">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 sticky top-0">
              <tr>
                <th className="px-4 py-3 text-left font-semibold text-slate-700">Name</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-700">Phone</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-700">Email</th>
                <th className="px-4 py-3 text-right font-semibold text-slate-700">Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredClients.map((c) => (
                <tr key={c.id} className="border-t hover:bg-slate-50">
                  <td className="px-4 py-3 font-medium">{c.firstname} {c.lastname}</td>
                  <td className="px-4 py-3">{c.phone}</td>
                  <td className="px-4 py-3 text-slate-500">{c.email || '—'}</td>
                  <td className="px-4 py-3 text-right">
                    <button
                      className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
                      onClick={() => setSelectedClient(c)}
                    >
                      Select
                    </button>
                  </td>
                </tr>
              ))}
              {filteredClients.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-slate-500 py-12">
                    {search ? 'No matching clients found.' : 'No clients in database yet.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* FNA Tabs */}
      {selectedClient && (
        <section className="rounded-xl border bg-white shadow-sm">
          <div className="border-b px-6 py-4">
            <div className="flex flex-wrap gap-2">
              {TABS.map((tab) => (
                <button
                  key={tab.id}
                  className={`px-4 py-2 rounded-t-lg text-sm font-medium transition-all ${
                    activeTab === tab.id
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                  }`}
                  onClick={() => setActiveTab(tab.id)}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          <div className="p-6">
            {activeTab === 'about' && <AboutTab form={form} onChange={handleChange} />}
            {activeTab === 'goals' && <GoalsTab form={form} onChange={handleChange} />}
            {activeTab === 'assets' && <AssetsTab form={form} onChange={handleChange} />}
            {activeTab === 'liabilities' && <LiabilitiesTab />}
            {activeTab === 'insurance' && <InsuranceTab form={form} onChange={handleChange} />}
            {activeTab === 'income' && <IncomeTab form={form} onChange={handleChange} />}

            <div className="mt-8 pt-6 border-t flex items-center justify-between">
              {statusMsg && (
                <div className={`text-sm px-3 py-2 rounded-lg ${
                  statusMsg.includes('✅') ? 'bg-green-50 text-green-800' : 'bg-yellow-50 text-yellow-800'
                }`}>
                  {statusMsg}
                </div>
              )}
              <button
                className="bg-blue-600 hover:bg-blue-700 text-white font-medium px-6 py-3 rounded-xl transition-all disabled:opacity-50"
                disabled={isSaving}
                onClick={handleSave}
              >
                {isSaving ? '💾 Saving...' : '💾 Save FNA'}
              </button>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}

// Input components (unchanged from previous)
function InputRow({ label, field, value, onChange, type = 'text', placeholder }: any) {
  return (
    <label className="block space-y-1">
      <span className="text-sm font-medium text-slate-700">{label}</span>
      <input
        type={type}
        className="w-full rounded-lg border border-slate-200 px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        value={value ?? ''}
        placeholder={placeholder}
        onChange={(e) => onChange(field, e.target.value)}
      />
    </label>
  );
}

function TextAreaRow({ label, field, value, onChange, rows = 3 }: any) {
  return (
    <label className="block space-y-1">
      <span className="text-sm font-medium text-slate-700">{label}</span>
      <textarea
        rows={rows}
        className="w-full rounded-lg border border-slate-200 px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        value={value ?? ''}
        onChange={(e) => onChange(field, e.target.value)}
      />
    </label>
  );
}

function YesNoRow({ label, field, value, onChange }: any) {
  return (
    <div className="space-y-2">
      <span className="text-sm font-medium text-slate-700 block">{label}</span>
      <div className="flex gap-3">
        <button
          type="button"
          className={`px-4 py-2 rounded-lg border-2 font-medium text-sm transition-all ${
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
          className={`px-4 py-2 rounded-lg border-2 font-medium text-sm transition-all ${
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

// Tab content (simplified)
function AboutTab({ form, onChange }: any) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <InputRow label="Spouse Name" field="spouse_name" value={form.spouse_name} onChange={onChange} />
      <InputRow label="Street Address" field="address" value={form.address} onChange={onChange} />
      <InputRow label="City" field="city" value={form.city} onChange={onChange} />
      <InputRow label="State" field="state" value={form.state} onChange={onChange} />
      <InputRow label="ZIP Code" field="zip_code" value={form.zip_code} onChange={onChange} />
      
      <div className="md:col-span-2">
        <YesNoRow 
          label="Plan to have more children?" 
          field="more_children_planned" 
          value={form.more_children_planned} 
          onChange={onChange} 
        />
      </div>
    </div>
  );
}

function GoalsTab({ form, onChange }: any) {
  return (
    <div className="space-y-6">
      <TextAreaRow 
        label="Financial goals (5-10 years)" 
        field="goals_text" 
        value={form.goals_text} 
        onChange={onChange}
      />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <InputRow label="Own or Rent?" field="own_or_rent" value={form.own_or_rent} onChange={onChange} />
      </div>
    </div>
  );
}

function AssetsTab({ form, onChange }: any) {
  return (
    <div className="space-y-6">
      <YesNoRow label="401k from previous employer?" field="has_old_401k" value={form.has_old_401k} onChange={onChange} />
      <YesNoRow label="Expect lump sums/inheritance?" field="expects_lump_sum" value={form.expects_lump_sum} onChange={onChange} />
    </div>
  );
}

function LiabilitiesTab() {
  return <div>Liabilities table coming soon...</div>;
}

function InsuranceTab({ form, onChange }: any) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <InputRow label="Debt to cover ($)" field="li_debt" value={form.li_debt} onChange={onChange} type="number" />
      <InputRow label="Income replacement ($)" field="li_income" value={form.li_income} onChange={onChange} type="number" />
      <InputRow label="Mortgage ($)" field="li_mortgage" value={form.li_mortgage} onChange={onChange} type="number" />
      <InputRow label="Education ($)" field="li_education" value={form.li_education} onChange={onChange} type="number" />
      <InputRow label="Current insurance ($)" field="li_insurance_in_place" value={form.li_insurance_in_place} onChange={onChange} type="number" />
    </div>
  );
}

function IncomeTab({ form, onChange }: any) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <InputRow label="Monthly retirement need ($)" field="retirement_monthly_need" value={form.retirement_monthly_need} onChange={onChange} type="number" />
      <InputRow label="Monthly commitment ($)" field="monthly_commitment" value={form.monthly_commitment} onChange={onChange} type="number" />
      <InputRow label="Next appt date" field="next_appointment_date" value={form.next_appointment_date} onChange={onChange} type="date" />
      <InputRow label="Next appt time" field="next_appointment_time" value={form.next_appointment_time} onChange={onChange} type="time" />
    </div>
  );
}
