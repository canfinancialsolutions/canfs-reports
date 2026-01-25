// app/dashboard/page.tsx
'use client';

import { useEffect, useMemo, useState, useCallback } from 'react';

// INLINE AUTH - NO EXTERNAL DEPENDENCIES
const setSession = () => {
  if (typeof document !== 'undefined') {
    document.cookie = 'canfs_auth=true; path=/; max-age=86400';
  }
};

const clearSession = () => {
  if (typeof document !== 'undefined') {
    document.cookie = 'canfs_auth=; path=/; max-age=0';
  }
};

const hasSession = (): boolean => {
  if (typeof document === 'undefined') return false;
  try {
    return document.cookie.split(';').some((c) => c.trim().startsWith('canfs_auth=true'));
  } catch {
    return false;
  }
};

type Client = {
  id: string;
  first_name: string;
  last_name?: string;
  phone?: string;
  email?: string;
  status?: string;
  created_at?: string;
};

// SIMPLIFIED Error Boundary - No complex fallbackRender
const ErrorBoundary = ({ children }: { children: React.ReactNode }) => {
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    // Catch global errors
    const handleError = (event: ErrorEvent) => {
      console.error('Global error:', event.error);
      setHasError(true);
    };
    
    window.addEventListener('error', handleError);
    return () => window.removeEventListener('error', handleError);
  }, []);

  if (hasError) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4 py-12">
        <div className="max-w-md w-full bg-white rounded-2xl p-8 border border-slate-200 text-center shadow-xl">
          <div className="w-16 h-16 mx-auto mb-6 bg-red-100 rounded-2xl flex items-center justify-center">
            <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-slate-900 mb-4">Something went wrong</h2>
          <p className="text-slate-600 mb-8">Please refresh the page to continue.</p>
          <button
            onClick={() => window.location.reload()}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-6 rounded-xl transition-all duration-200 shadow-lg hover:shadow-xl"
          >
            Refresh Dashboard
          </button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};

function useRequireAuth() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const checkAuth = () => {
      try {
        if (!hasSession()) {
          window.location.href = '/auth';
          return;
        }
        setReady(true);
      } catch (error) {
        console.error('Auth check failed:', error);
        window.location.href = '/auth';
      }
    };

    checkAuth();
  }, []);

  return ready;
}

export default function DashboardPage() {
  const ready = useRequireAuth();
  
  if (!ready) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-xl font-semibold text-slate-500 animate-pulse">Loading...</div>
      </div>
    );
  }

  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    total: 0,
    new: 0,
    inProgress: 0,
    completed: 0,
  });

  const loadClients = useCallback(async () => {
    try {
      setLoading(true);
      
      // Demo data - replace with real Supabase when ready
      const demoClients: Client[] = [
        {
          id: '1',
          first_name: 'John',
          last_name: 'Doe',
          phone: '(555) 123-4567',
          email: 'john.doe@canfs.com',
          status: 'New Client',
          created_at: new Date(Date.now() - 86400000).toISOString(), // yesterday
        },
        {
          id: '2',
          first_name: 'Jane',
          last_name: 'Smith',
          phone: '(555) 987-6543',
          email: 'jane.smith@canfs.com',
          status: 'In Progress',
          created_at: new Date().toISOString(),
        },
        {
          id: '3',
          first_name: 'Mike',
          last_name: 'Johnson',
          phone: '(555) 456-7890',
          email: 'mike.johnson@canfs.com',
          status: 'New Client',
          created_at: new Date(Date.now() - 2 * 86400000).toISOString(),
        }
      ];

      setClients(demoClients);
      
      const total = demoClients.length;
      const newCount = demoClients.filter(c => c.status === 'New Client').length;
      const inProgress = demoClients.filter(c => c.status === 'In Progress').length;
      const completed = demoClients.filter(c => c.status === 'Completed').length;
      
      setStats({ total, new: newCount, inProgress, completed });
    } catch (error) {
      console.error('Load clients error:', error);
      setClients([]);
      setStats({ total: 0, new: 0, inProgress: 0, completed: 0 });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadClients();
  }, [loadClients]);

  const handleLogout = () => {
    try {
      clearSession();
      window.location.href = '/auth';
    } catch {
      window.location.href = '/auth';
    }
  };

  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
        {/* HEADER */}
        <header className="bg-white shadow-sm border-b border-slate-200 sticky top-0 z-50 backdrop-blur-md">
          <div className="max-w-7xl mx-auto px-6 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-2xl flex items-center justify-center shadow-lg">
                  <span className="text-white font-bold text-2xl">C</span>
                </div>
                <div>
                  <h1 className="text-3xl font-black bg-gradient-to-r from-slate-900 to-slate-700 bg-clip-text text-transparent">
                    Dashboard
                  </h1>
                  <p className="text-slate-600 font-medium">CAN Financial Solutions Admin</p>
                </div>
              </div>
              
              <button
                onClick={handleLogout}
                className="inline-flex items-center gap-2 rounded-2xl bg-white border-2 border-slate-200 px-6 py-3 text-sm font-bold text-slate-900 shadow-lg hover:shadow-xl hover:border-slate-300 hover:bg-slate-50 transition-all duration-200"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
                Logout
              </button>
            </div>
          </div>
        </header>

        <main className="max-w-7xl mx-auto px-6 py-12">
          {/* STATS GRID */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
            {[
              { label: 'Total Clients', value: stats.total, color: 'blue', icon: '👥' },
              { label: 'New Clients', value: stats.new, color: 'emerald', icon: '✨' },
              { label: 'In Progress', value: stats.inProgress, color: 'orange', icon: '⏳' },
              { label: 'Completed', value: stats.completed, color: 'slate', icon: '✅' }
            ].map(({ label, value, color, icon }, i) => (
              <div key={i} className="group bg-white/80 backdrop-blur-sm rounded-3xl border border-white/50 p-8 shadow-xl hover:shadow-2xl hover:-translate-y-2 transition-all duration-300 hover:border-slate-200">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm font-semibold text-slate-600 uppercase tracking-wide mb-3">
                      {label}
                    </p>
                    <p className="text-4xl font-black text-slate-900">{value}</p>
                  </div>
                  <div className={`p-4 rounded-2xl bg-gradient-to-br from-${color}-500 to-${color}-600 text-white shadow-lg group-hover:scale-110 transition-all duration-300`}>
                    <span className="text-2xl">{icon}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* RECENT CLIENTS */}
          <div className="bg-white/80 backdrop-blur-sm rounded-3xl border border-white/50 shadow-2xl overflow-hidden mb-12">
            <div className="p-8 border-b border-slate-100">
              <div className="flex items-center gap-4">
                <h2 className="text-2xl font-black text-slate-900">Recent Clients</h2>
                <span className={`px-4 py-2 rounded-2xl text-sm font-semibold ${
                  loading 
                    ? 'bg-blue-100 text-blue-800' 
                    : clients.length > 0 
                    ? 'bg-emerald-100 text-emerald-800' 
                    : 'bg-slate-100 text-slate-800'
                }`}>
                  {loading ? 'Loading...' : `${clients.length} clients`}
                </span>
              </div>
              <p className="text-slate-600 mt-2">Latest client registrations and activity</p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50/50">
                  <tr>
                    <th className="px-8 py-4 text-left text-xs font-bold text-slate-700 uppercase tracking-wider">Name</th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-slate-700 uppercase tracking-wider">Phone</th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-slate-700 uppercase tracking-wider">Email</th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-slate-700 uppercase tracking-wider">Status</th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-slate-700 uppercase tracking-wider">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {loading ? (
                    <tr>
                      <td colSpan={5} className="px-8 py-16 text-center">
                        <div className="flex flex-col items-center gap-4">
                          <div className="w-12 h-12 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin"></div>
                          <div className="text-lg text-slate-600 font-medium">Loading clients...</div>
                        </div>
                      </td>
                    </tr>
                  ) : clients.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-8 py-16 text-center text-slate-500">
                        No clients yet. New registrations will appear here.
                      </td>
                    </tr>
                  ) : (
                    clients.slice(0, 10).map((client) => (
                      <tr key={client.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="px-8 py-6 border-t">
                          <div className="font-semibold text-slate-900">
                            {client.first_name} {client.last_name || ''}
                          </div>
                        </td>
                        <td className="px-6 py-6 text-sm text-slate-700 border-t">{client.phone || '-'}</td>
                        <td className="px-6 py-6 text-sm text-slate-700 max-w-md truncate border-t">{client.email || '-'}</td>
                        <td className="px-6 py-6 border-t">
                          <span className={`inline-flex px-3 py-1 text-xs font-bold rounded-full capitalize ${
                            client.status === 'New Client' 
                              ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' 
                              : client.status === 'Completed' 
                              ? 'bg-slate-100 text-slate-800 border border-slate-200' 
                              : 'bg-orange-100 text-orange-800 border border-orange-200'
                          }`}>
                            {client.status || 'Unknown'}
                          </span>
                        </td>
                        <td className="px-6 py-6 text-sm text-slate-500 border-t">
                          {client.created_at 
                            ? new Date(client.created_at).toLocaleDateString('en-US', {
                                year: 'numeric',
                                month: 'short',
                                day: 'numeric'
                              })
                            : '-'
                          }
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* QUICK ACTIONS */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 bg-white/80 backdrop-blur-sm rounded-3xl border border-white/50 p-8 shadow-2xl">
              <h3 className="text-2xl font-black mb-8 bg-gradient-to-r from-slate-900 to-slate-700 bg-clip-text text-transparent">
                Quick Actions
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <a href="/prospect" className="group p-8 border-2 border-slate-200 rounded-3xl hover:border-blue-300 hover:shadow-2xl hover:bg-gradient-to-r hover:from-blue-50 hover:to-indigo-50 transition-all duration-300">
                  <div className="flex items-start gap-6">
                    <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl flex items-center justify-center shadow-xl group-hover:scale-110 transition-all duration-300">
                      <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                      </svg>
                    </div>
                    <div>
                      <h4 className="text-2xl font-black text-slate-900 mb-3 group-hover:text-blue-700 transition-colors">Prospect List</h4>
                      <p className="text-xl text-slate-600 font-semibold">View and manage all prospects</p>
                    </div>
                  </div>
                </a>
                
                <a href="/fna" className="group p-8 border-2 border-slate-200 rounded-3xl hover:border-emerald-300 hover:shadow-2xl hover:bg-gradient-to-r hover:from-emerald-50 hover:to-teal-50 transition-all duration-300">
                  <div className="flex items-start gap-6">
                    <div className="w-16 h-16 bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-2xl flex items-center justify-center shadow-xl group-hover:scale-110 transition-all duration-300">
                      <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                      </svg>
                    </div>
                    <div>
                      <h4 className="text-2xl font-black text-slate-900 mb-3 group-hover:text-emerald-700 transition-colors">FNA Analysis</h4>
                      <p className="text-xl text-slate-600 font-semibold">Financial Need Analysis tools</p>
                    </div>
                  </div>
                </a>
              </div>
            </div>
          </div>
        </main>
      </div>
    </ErrorBoundary>
  );
}
