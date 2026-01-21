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

type TabId = 'about' | 'goals' | 'assets' | 'liabilities' | 'insurance' | 'income';

export default function FnaPage() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  const supabase = createClient(supabaseUrl, supabaseKey);
  
  // State
  const [clients, setClients] = useState<Client[]>([]);
  const [search, setSearch] = useState('');
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [activeTab, setActiveTab] = useState<TabId>('about');
  const [isSaving, setIsSaving] = useState(false);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [fnaId, setFnaId] = useState<string | null>(null);

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
    liabilities_credit: '',
    liabilities_auto: '',
    liabilities_student: '',
    liabilities_personal: ''
  });

  const TABS: { id: TabId; label: string }[] = [
    { id: 'about', label: 'Client & Family' },
    { id: 'goals', label: 'Goals & Properties' },
    { id: 'assets', label: 'Assets' },
    { id: 'liabilities', label: 'Liabilities' },
    { id: 'insurance', label: 'Insurance' },
    { id: 'income', label: 'Income & Estate' },
  ];

  // Load clients
  useEffect(() => {
    const loadClients = async () => {
      const { data, error } = await supabase
        .from('clientregistrations')
        .select('id, firstname, lastname, phone, email')
        .order('createdat', { ascending: false });

      if (!error && data) setClients(data as Client[]);
    };
    loadClients();
  }, []);

  // Load/create FNA
  useEffect(() => {
    if (!selectedClient || fnaId) return;
    
    const loadFna = async () => {
      const { data } = await supabase
        .from('fna_header')
        .select('*')
        .eq('client_id', selectedClient.id)
        .maybeSingle();

      if (data) {
        setFnaId(data.id);
        setForm(prev => ({ ...prev, ...data }));
      } else {
        const { data: newFna } = await supabase
          .from('fna_header')
          .insert({ client_id: selectedClient.id })
          .select()
          .single();
        if (newFna) setFnaId(newFna.id);
      }
    };
    loadFna();
  }, [selectedClient]);

  const handleChange = (field: string, value: any) => {
    setForm(prev => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    if (!fnaId) return;
    setIsSaving(true);
    
    const payload = {
      ...form,
      updated_at: new Date().toISOString(),
      more_children_count: form.more_children_count === '' ? null : Number(form.more_children_count),
      li_debt: form.li_debt === '' ? null : Number(form.li_debt),
      // Add numeric conversions...
    };

    const { error } = await supabase
      .from('fna_header')
      .update(payload)
      .eq('id', fnaId);

    setIsSaving(false);
    setStatusMsg(error ? 'Save failed' : '✅ Saved successfully!');
  };

  const filteredClients = clients.filter(c => {
    const q = search.toLowerCase();
    return c.firstname.toLowerCase().includes(q) || 
           c.lastname.toLowerCase().includes(q) || 
           c.phone.includes(q);
  });

  // EXIT BUTTON - TOP OF PAGE
  return (
    <div className="min-h-screen bg-slate-50 p-6">
      {/* HEADER WITH EXIT */}
      <div className="max-w-6xl mx-auto flex justify-between items-center mb-8 bg-white rounded-xl p-6 shadow-sm border">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Financial Needs Analysis</h1>
          <p className="text-slate-600 mt-1">Complete FNA for client across 6 organized tabs</p>
        </div>
        <button
          onClick={() => window.location.href = '/auth'}
          className="bg-red-600 hover:bg-red-700 text-white px-6 py-3 rounded-xl font-semibold transition-all shadow-md"
        >
          ← Exit to Login
        </button>
      </div>

      <div className="max-w-6xl mx-auto space-y-8">
        {/* CLIENT PICKER */}
        <section className="bg-white rounded-2xl shadow-sm border p-8">
          <h2 className="text-2xl font-bold mb-4">Select Client</h2>
          <div className="flex gap-4 mb-6">
            <input
              type="text"
              placeholder="Search by name or phone..."
              className="flex-1 px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            {selectedClient && (
              <div className="bg-blue-50 px-6 py-3 rounded-xl font-medium text-blue-800">
                {selectedClient.firstname} {selectedClient.lastname}
              </div>
            )}
          </div>

          <div className="max-h-80 overflow-auto border rounded-xl">
            <table className="w-full">
              <thead className="bg-slate-50 sticky top-0">
                <tr>
                  <th className="px-6 py-4 text-left font-semibold text-slate-700">Name</th>
                  <th className="px-6 py-4 text-left font-semibold text-slate-700">Phone</th>
                  <th className="px-6 py-4 text-left font-semibold text-slate-700">Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredClients.map(client => (
                  <tr key={client.id} className="border-t hover:bg-slate-50">
                    <td className="px-6 py-4 font-medium">{client.firstname} {client.lastname}</td>
                    <td className="px-6 py-4">{client.phone}</td>
                    <td className="px-6 py-4">
                      <button
                        className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium"
                        onClick={() => setSelectedClient(client)}
                      >
                        Select
                      </button>
                    </td>
                  </tr>
                ))}
                {filteredClients.length
