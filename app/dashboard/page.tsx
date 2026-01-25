// app/dashboard/page.tsx
'use client';

import React, { useEffect, useMemo, useRef, useState } from "react";
import * as XLSX from "xlsx";
import { 
  addDays, 
  format,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval
} from "date-fns";
import { createClient } from '@supabase/supabase-js';
import { 
  hasSession, 
  clearSession 
} from '../lib/auth-client';

type Client = {
  id: string;
  first_name: string;
  last_name: string;
  phone: string;
  email: string;
  status: string;
  created_at: string;
  interest_type: string;
};

function useRequireAuth() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!hasSession()) {
      window.location.href = '/auth';
      return;
    }
    setReady(true);
  }, []);

  return ready;
}

export default function DashboardPage() {
  const ready = useRequireAuth();
  if (!ready) return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center">
      <div className="text-lg text-slate-500">Loading...</div>
    </div>
  );

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  const supabase = useMemo(
    () => createClient(supabaseUrl, supabaseKey),
    [supabaseUrl, supabaseKey],
  );

  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    total: 0,
    new: 0,
    inProgress: 0,
    completed: 0,
  });

  // Load clients from Supabase
  const loadClients = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('client_registrations')
      .select('id, first_name, last_name, phone, email, status, created_at, interest_type')
      .order('created_at', { ascending: false });

    if (!error && data) {
      setClients(data as Client[]);
      
      // Calculate stats
      const total = data.length;
      const newCount = data.filter(c => c.status === 'New Client').length;
      const inProgress = data.filter(c => c.status !== 'New Client' && c.status !== 'Completed').length;
      const completed = data.filter(c => c.status === 'Completed').length;
      
      setStats({ total, new: newCount, inProgress, completed });
    }
    setLoading(false);
  };

  useEffect(() => {
    loadClients();
  }, []);

  const handleLogout = () => {
    clearSession();
    window.location.href = '/auth';
  };

  return (
    <div className="min-h-screen bg-slate-50">
      {/* HEADER */}
      <div className="bg-white border-b border-slate-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src="/can-logo.png" alt="CAN Financial Solutions" className="h-10 w-auto" />
            <div>
              <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
              <p className="text-sm text-slate-600">CAN Financial Solutions - Admin Overview</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-900 shadow-sm hover:bg-slate-50"
          >
            Logout
          </button>
        </div>
      </div>

      <div className="px-6 py-8">
        {/* STATS CARDS */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-600 uppercase tracking-wide">Total Clients</p>
                <p className="mt-1 text-3xl font-bold text-slate-900">{stats.total}</p>
              </div>
              <div className="p-3 rounded-xl bg-blue-100">
                <div className="h-8 w-8 bg-blue-600 rounded-lg flex items-center justify-center">
                  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                  </svg>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-600 uppercase tracking-wide">New</p>
                <p className="mt-1 text-3xl font-bold text-emerald-600">{stats.new}</p>
              </div>
              <div className="p-3 rounded-xl bg-emerald-100">
                <div className="h-8 w-8 bg-emerald-600 rounded-lg flex items-center justify-center">
                  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                  </svg>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-600 uppercase tracking-wide">In Progress</p>
                <p className="mt-1 text-3xl font-bold text-orange-600">{stats.inProgress}</p>
              </div>
              <div className="p-3 rounded-xl bg-orange-100">
                <div className="h-8 w-8 bg-orange-600 rounded-lg flex items-center justify-center">
                  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-600 uppercase tracking-wide">Completed</p>
                <p className="mt-1 text-3xl font-bold text-slate-900">{stats.completed}</p>
              </div>
              <div className="p-3 rounded-xl bg-slate-100">
                <div className="h-8 w-8 bg-slate-900 rounded-lg flex items-center justify-center">
                  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* RECENT CLIENTS TABLE */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-200">
            <h2 className="text-lg font-semibold text-slate-900">Recent Clients</h2>
            <p className="text-sm text-slate-600">Latest client registrations</p>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Name</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Phone</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Email</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Created</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {loading ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center text-slate-500">
                      Loading clients...
                    </td>
                  </tr>
                ) : clients.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center text-slate-500">
                      No clients found.
                    </td>
                  </tr>
                ) : (
                  clients.slice(0, 10).map((client) => (
                    <tr key={client.id} className="hover:bg-slate-50">
                      <td className="px-6 py-4">
                        <div className="font-medium text-slate-900">
                          {client.first_name} {client.last_name}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-700">{client.phone}</td>
                      <td className="px-6 py-4 text-sm text-slate-700">{client.email}</td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                          client.status === 'New Client' ? 'bg-emerald-100 text-emerald-800' :
                          client.status === 'Completed' ? 'bg-slate-100 text-slate-800' :
                          'bg-orange-100 text-orange-800'
                        }`}>
                          {client.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-500">
                        {client.created_at ? new Date(client.created_at).toLocaleDateString() : '-'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* QUICK ACTIONS */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-8">
          <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
            <h3 className="text-lg font-semibold text-slate-900 mb-4">Quick Actions</h3>
            <div className="space-y-3">
              <a href="/prospect" className="block p-4 border border-slate-200 rounded-lg hover:border-slate-300 hover:shadow-sm transition-all">
                <div className="font-medium text-slate-900">Prospect List</div>
                <div className="text-sm text-slate-600">View and manage prospects</div>
              </a>
              <a href="/fna" className="block p-4 border border-slate-200 rounded-lg hover:border-slate-300 hover:shadow-sm transition-all">
                <div className="font-medium text-slate-900">FNA Analysis</div>
                <div className="text-sm text-slate-600">Financial Need Analysis</div>
              </a>
            </div>
          </div>
          
          <div className="md:col-span-2 bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
            <h3 className="text-lg font-semibold text-slate-900 mb-2">Next Steps</h3>
            <ul className="text-sm text-slate-600 space-y-1">
              <li>• Review {stats.new} new client registrations</li>
              <li>• Follow up on {stats.inProgress} in-progress cases</li>
              <li>• Update prospect tracking records</li>
              <li>• Schedule client meetings</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
