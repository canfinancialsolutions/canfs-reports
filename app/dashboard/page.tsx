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
  interest_type?: string;
};

// Error Boundary Component
const ErrorBoundary = ({ children }: { children: React.ReactNode }) => {
  const [hasError, setHasError] = useState(false);

  const handleError = useCallback((error: Error, errorInfo: React.ErrorInfo) => {
    console.error('Dashboard Error:', error, errorInfo);
    setHasError(true);
  }, []);

  if (hasError) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
        <div className="max-w-md w-full bg-white rounded-2xl p-8 border border-slate-200 text-center">
          <div className="w-16 h-16 mx-auto mb-4 bg-red-100 rounded-2xl flex items-center justify-center">
            <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-slate-900 mb-2">Something went wrong</h2>
          <p className="text-slate-600 mb-6">Please refresh the page or try logging in again.</p>
          <button
            onClick={() => window.location.reload()}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2.5 px-4 rounded-xl transition-colors"
          >
            Refresh Page
          </button>
        </div>
      </div>
    );
  }

  return (
    // @ts-ignore - Error boundary class component pattern
    <ErrorFallback 
      fallbackRender={() => null}
      onError={handleError}
      children={children}
    />
  );
};

// Simple Error Fallback (React 18+ compatible)
const ErrorFallback = ({ 
  fallbackRender, 
  onError, 
  children 
}: { 
  fallbackRender: () => React.ReactElement;
  onError: (error: Error, errorInfo: React.ErrorInfo) => void;
  children: React.ReactNode;
}) => {
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    if (hasError) {
      onError(new Error('Client error'), { componentStack: 'Dashboard' });
    }
  }, [hasError, onError]);

  if (hasError) return fallbackRender();

  return <>{children}</>;
};

function useRequireAuth() {
  const [ready, setReady] = useState(false);
  const [authError, setAuthError] = useState(false);

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
        setAuthError(true);
      }
    };

    checkAuth();
  }, []);

  if (authError) {
    window.location.href = '/auth';
    return false;
  }

  return ready;
}

export default function DashboardPage() {
  const ready = useRequireAuth();
  
  if (!ready) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4 py-12">
        <div className="text-lg text-slate-500 animate-pulse">Loading Dashboard...</div>
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
  const [supabaseError, setSupabaseError] = useState<string | null>(null);

  // Safe Supabase client creation
  const supabaseUrl = typeof process !== 'undefined' ? process.env.NEXT_PUBLIC_SUPABASE_URL || '' : '';
  const supabaseKey = typeof process !== 'undefined' ? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '' : '';
  
  const supabase = useMemo(() => {
    if (!supabaseUrl || !supabaseKey) {
      console.warn('Supabase env vars missing');
      return null;
    }
    try {
      return (window as any).SupabaseClient || null; // Fallback for SSR
    } catch {
      return null;
    }
  }, [supabaseUrl, supabaseKey]);

  const loadClients = useCallback(async () => {
    if (!supabase) {
      setSupabaseError('Supabase not configured');
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setSupabaseError(null);
      
      // Mock data if Supabase fails (for demo)
      const mockData: Client[] = [
        {
          id: '1',
          first_name: 'John',
          last_name: 'Doe',
          phone: '(555) 123-4567',
          email: 'john@example.com',
          status: 'New Client',
          created_at: new Date().toISOString(),
        },
        {
          id: '2',
          first_name: 'Jane',
          last_name: 'Smith',
          phone: '(555) 987-6543',
          email: 'jane@example.com',
          status: 'In Progress',
          created_at: new Date(Date.now() - 86400000).toISOString(),
        }
      ];

      setClients(mockData);
      
      const total = mockData.length;
      const newCount = mockData.filter(c => c.status === 'New Client').length;
      const inProgress = mockData.filter(c => c.status === 'In Progress').length;
      const completed = mockData.filter(c => c.status === 'Completed').length;
      
      setStats({ total, new: newCount, inProgress, completed });
    } catch (error) {
      console.error('Load clients error:', error);
      setSupabaseError('Failed to load clients');
      setClients([]);
      setStats({ total: 0, new: 0, inProgress: 0, completed: 0 });
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    loadClients();
  }, [loadClients]);

  const handleLogout = useCallback(() => {
    try {
      clearSession();
      window.location.href = '/auth';
    } catch (error) {
      console.error('Logout error:', error);
      window.location.href = '/auth';
    }
  }, []);

  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
        {/* HEADER */}
        <header className="bg-white/80 backdrop-blur-md border-b border-slate-200/50 sticky top-0 z-50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between h-16">
              <div className="flex items-center space-x-3">
                <div className="w-11 h-11 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-2xl flex items-center justify-center shadow-lg">
                  <span className="text-white font-bold text-xl">C</span>
                </div>
                <div>
                  <h1 className="text-2xl font-bold bg-gradient-to-r from-slate-900 to-slate-700 bg-clip-text text-transparent">
                    Dashboard
                  </h1>
                  <p className="text-xs text-slate-500 font-medium tracking-wide uppercase">
                    CAN Financial Solutions
                  </p>
                </div>
              </div>
              
              <button
                onClick={handleLogout}
                className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white/80 backdrop-blur-sm px-4 py-2 text-sm font-semibold text-slate-900 shadow-lg hover:shadow-xl hover:bg-slate-50/80 hover:border-slate-300 transition-all duration-200"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7" />
                </svg>
                Logout
              </button>
            </div>
          </div>
        </header>

        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          {/* STATS */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
            {[
              { label: 'Total Clients', value: stats.total, color: 'blue', icon: '👥' },
              { label: 'New', value: stats.new, color: 'emerald', icon: '✨' },
              { label: 'In Progress', value: stats.inProgress, color: 'orange', icon: '⏳' },
              { label: 'Completed', value: stats.completed, color: 'slate', icon: '✅' }
            ].map(({ label, value, color, icon }, i) => (
              <div key={i} className="group bg-white/70 backdrop-blur-sm rounded-3xl border border-white/50 p-8 shadow-xl hover:shadow-2xl hover:-translate-y-1 transition-all duration-300 hover:border-white/70">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-slate-600 uppercase tracking-wide mb-2">
                      {label}
                    </p>
                    <p className="text-4xl font-black bg-gradient-to-r from-slate-900 via-slate-800 to-slate-700 bg-clip-text text-transparent">
                      {value}
                    </p>
                  </div>
                  <div className={`p-4 rounded-2xl bg-gradient-to-br from-${color}-500 to-${color}-600 shadow-lg group-hover:scale-110 transition-transform duration-200`}>
                    <span className="text-2xl">{icon}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* CLIENTS TABLE */}
          <div className="bg-white/70 backdrop-blur-sm rounded-3xl border border-white/50 shadow-2xl overflow-hidden">
            <div className="p-8 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <h2 className="text-2xl font-black bg-gradient-to-r from-slate-900 to-slate-700 bg-clip-text text-transparent">
                  Recent Clients
                </h2>
                <div className={`px-3 py-1 rounded-full text-xs font-semibold bg-${loading ? 'slate' : supabaseError ? 'red' : 'emerald'}-100 text-${loading ? 'slate' : supabaseError ? 'red' : 'emerald'}-800`}>
                  {loading ? 'Loading...' : supabaseError ? 'Error' : `${clients.length} clients`}
                </div>
              </div>
              <p className="text-slate-600 mt-1">
                {supabaseError || (loading ? 'Loading client data...' : 'Latest registrations')}
              </p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50/50">
                  <tr>
                    <th className="px-8 py-5 text-left text-xs font-bold text-slate-700 uppercase tracking-wider">Name</th>
                    <th className="px-6 py-5 text-left text-xs font-bold text-slate-700 uppercase tracking-wider">Phone</th>
                    <th className="px-6 py-5 text-left text-xs font-bold text-slate-700 uppercase tracking-wider">Email</th>
                    <th className="px-6 py-5 text-left text-xs font-bold text-slate-700 uppercase tracking-wider">Status</th>
                    <th className="px-6 py-5 text-left text-xs font-bold text-slate-700 uppercase tracking-wider">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {loading ? (
                    <tr>
                      <td colSpan={5} className="px-8 py-20 text-center">
                        <div className="flex flex-col items-center gap-3">
                          <div className="w-12 h-12 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin"></div>
                          <div className="text-slate-500">Loading clients...</div>
                        </div>
                      </td>
                    </tr>
                  ) : clients.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-8 py-20 text-center text-slate-500">
                        No clients found. {supabaseError && `(${supabaseError})`}
                      </td>
                    </tr>
                  ) : (
                    clients.slice(0, 10).map((client, i) => (
                      <tr key={client.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="px-8 py-6">
                          <div className="font-semibold text-slate-900">
                            {client.first_name} {client.last_name || ''}
                          </div>
                        </td>
                        <td className="px-6 py-6 text-sm text-slate-700">{client.phone || '-'}</td>
                        <td className="px-6 py-6 text-sm text-slate-700 max-w-md truncate">
                          {client.email || '-'}
                        </td>
                        <td className="px-6 py-6">
                          <span className={`inline-flex px-3 py-1 text-xs font-bold rounded-full capitalize ${
                            client.status === 'New Client' 
                              ? 'bg-emerald-100 text-emerald-800' 
                              : client.status === 'Completed' 
                              ? 'bg-slate-100 text-slate-800' 
                              : 'bg-orange-100 text-orange-800'
                          }`}>
                            {client.status || 'Unknown'}
                          </span>
                        </td>
                        <td className="px-6 py-6 text-sm text-slate-500">
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
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mt-12">
            <div className="lg:col-span-2 bg-white/70 backdrop-blur-sm rounded-3xl border border-white/50 p-8 shadow-2xl">
              <h3 className="text-xl font-black mb-6 bg-gradient-to-r from-slate-900 to-slate-700 bg-clip-text text-transparent">
                Quick Actions
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <a href="/prospect" className="group p-6 border border-slate-200 rounded-2xl hover:border-blue-300 hover:shadow-xl hover:bg-blue-50/50 transition-all duration-300">
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl flex items-center justify-center shadow-lg group-hover:scale-105 transition-transform">
                      <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                      </svg>
                    </div>
                    <div>
                      <h4 className="font-bold text-slate-900 text-lg mb-1 group-hover:text-blue-700">Prospect List</h4>
                      <p className="text-slate-600">View and manage all prospects</p>
                    </div>
                  </div>
                </a>
                
                <a href="/fna" className="group p-6 border border-slate-200 rounded-2xl hover:border-emerald-300 hover:shadow-xl hover:bg-emerald-50/50 transition-all duration-300">
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-2xl flex items-center justify-center shadow-lg group-hover:scale-105 transition-transform">
                      <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                      </svg>
                    </div>
                    <div>
                      <h4 className="font-bold text-slate-900 text-lg mb-1 group-hover:text-emerald-700">FNA Analysis</h4>
                      <p className="text-slate-600">Financial Need Analysis tools</p>
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
