// app/dashboard/page.tsx
'use client';

import { useEffect, useState } from 'react';

export default function DashboardPage() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Simple auth check - NO complex logic
  useEffect(() => {
    const checkCookie = () => {
      try {
        const cookies = document.cookie.split(';');
        const hasAuthCookie = cookies.some(cookie => 
          cookie.trim().startsWith('canfs_auth=true')
        );
        
        if (hasAuthCookie) {
          setIsAuthenticated(true);
        } else {
          window.location.href = '/auth';
        }
      } catch (error) {
        console.error('Auth check failed:', error);
        window.location.href = '/auth';
      } finally {
        setIsLoading(false);
      }
    };

    // Small delay to ensure DOM/cookies are ready
    const timer = setTimeout(checkCookie, 50);
    return () => clearTimeout(timer);
  }, []);

  // Show loading while checking auth
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center">
        <div className="flex items-center gap-3 text-slate-500">
          <div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin"></div>
          <span className="text-lg font-semibold">Loading Dashboard...</span>
        </div>
      </div>
    );
  }

  // If not authenticated, redirect happens above
  if (!isAuthenticated) {
    return null;
  }

  const handleLogout = () => {
    document.cookie = 'canfs_auth=; path=/; max-age=0';
    window.location.href = '/auth';
  };

  // Demo data - ZERO external dependencies
  const clients = [
    { id: '1', first_name: 'John', last_name: 'Doe', phone: '(555) 123-4567', email: 'john@canfs.com', status: 'New Client' },
    { id: '2', first_name: 'Jane', last_name: 'Smith', phone: '(555) 987-6543', email: 'jane@canfs.com', status: 'In Progress' },
  ];

  const stats = {
    total: 2,
    new: 1,
    inProgress: 1,
    completed: 0,
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      {/* HEADER */}
      <header className="bg-white/90 backdrop-blur-md shadow-sm border-b border-slate-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-2xl flex items-center justify-center shadow-lg">
                <span className="text-white font-bold text-2xl">C</span>
              </div>
              <div>
                <h1 className="text-3xl font-black bg-gradient-to-r from-slate-900 via-slate-800 to-slate-700 bg-clip-text text-transparent">
                  Dashboard
                </h1>
                <p className="text-sm text-slate-600 font-medium">CAN Financial Solutions</p>
              </div>
            </div>
            
            <button
              onClick={handleLogout}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl bg-white border-2 border-slate-200 text-sm font-bold text-slate-900 shadow-lg hover:shadow-xl hover:border-slate-300 hover:bg-slate-50 transition-all duration-200"
            >
              Logout
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-12">
        {/* STATS */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
          {[
            { label: 'Total Clients', value: stats.total, color: 'from-blue-500 to-blue-600' },
            { label: 'New Clients', value: stats.new, color: 'from-emerald-500 to-emerald-600' },
            { label: 'In Progress', value: stats.inProgress, color: 'from-orange-500 to-orange-600' },
            { label: 'Completed', value: stats.completed, color: 'from-slate-500 to-slate-600' }
          ].map(({ label, value, color }, i) => (
            <div key={i} className="group bg-white/80 backdrop-blur-sm rounded-3xl p-8 shadow-xl border border-slate-200 hover:shadow-2xl hover:-translate-y-1 transition-all duration-300">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-slate-600 uppercase tracking-wide mb-3">{label}</p>
                  <p className="text-4xl font-black text-slate-900">{value}</p>
                </div>
                <div className={`p-4 rounded-2xl bg-gradient-to-br ${color} shadow-lg group-hover:scale-110 transition-transform duration-200`}>
                  <div className="w-6 h-6 bg-white/20 rounded-full flex items-center justify-center backdrop-blur-sm"></div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* CLIENTS TABLE */}
        <div className="bg-white/80 backdrop-blur-sm rounded-3xl shadow-2xl border border-slate-200 overflow-hidden mb-12">
          <div className="p-8 border-b border-slate-100 bg-gradient-to-r from-slate-50 to-slate-100">
            <h2 className="text-2xl font-black text-slate-900 mb-1">Recent Clients</h2>
            <p className="text-slate-600">Latest registrations ({clients.length} total)</p>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-8 py-4 text-left text-xs font-bold text-slate-700 uppercase tracking-wider">Name</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-slate-700 uppercase tracking-wider">Phone</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-slate-700 uppercase tracking-wider">Email</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-slate-700 uppercase tracking-wider">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {clients.map((client) => (
                  <tr key={client.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-8 py-6 font-semibold text-slate-900">
                      {client.first_name} {client.last_name}
                    </td>
                    <td className="px-6 py-6 text-sm text-slate-700">{client.phone}</td>
                    <td className="px-6 py-6 text-sm text-slate-700 max-w-md truncate">{client.email}</td>
                    <td className="px-6 py-6">
                      <span className={`inline-flex px-3 py-1 text-xs font-bold rounded-full ${
                        client.status === 'New Client'
                          ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                          : 'bg-orange-100 text-orange-800 border border-orange-200'
                      }`}>
                        {client.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* QUICK ACTIONS */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <a 
            href="/prospect"
            className="group bg-white p-8 rounded-3xl shadow-xl border border-slate-200 hover:shadow-2xl hover:-translate-y-2 transition-all duration-300 hover:border-blue-300"
          >
            <div className="flex items-center gap-6">
              <div className="w-20 h-20 bg-gradient-to-br from-blue-500 to-blue-600 rounded-3xl flex items-center justify-center shadow-2xl group-hover:scale-110 transition-all duration-300">
                <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </div>
              <div>
                <h3 className="text-2xl font-black text-slate-900 mb-2 group-hover:text-blue-700 transition-colors">Prospect List</h3>
                <p className="text-xl text-slate-600 font-semibold">View and manage prospects</p>
              </div>
            </div>
          </a>
          
          <a 
            href="/fna"
            className="group bg-white p-8 rounded-3xl shadow-xl border border-slate-200 hover:shadow-2xl hover:-translate-y-2 transition-all duration-300 hover:border-emerald-300"
          >
            <div className="flex items-center gap-6">
              <div className="w-20 h-20 bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-3xl flex items-center justify-center shadow-2xl group-hover:scale-110 transition-all duration-300">
                <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                </svg>
              </div>
              <div>
                <h3 className="text-2xl font-black text-slate-900 mb-2 group-hover:text-emerald-700 transition-colors">FNA Analysis</h3>
                <p className="text-xl text-slate-600 font-semibold">Financial Need Analysis</p>
              </div>
            </div>
          </a>
        </div>
      </main>
    </div>
  );
}
