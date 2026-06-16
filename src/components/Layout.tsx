import React, { useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { toast } from 'react-toastify';
import { clearSession, getSessionExpiresAt } from '@/src/lib/session';

interface LayoutProps {
  children: React.ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const user = JSON.parse(localStorage.getItem('user') || '{}');

  const finishLogout = (message: string) => {
    clearSession();
    toast.success(message);
    navigate('/auth');
  };

  const handleLogout = () => {
    finishLogout('Logged out successfully');
  };

  useEffect(() => {
    const handleSessionExpired = () => {
      clearSession();
      toast.info('Session expired. Please login again.');
      navigate('/auth');
    };

    window.addEventListener('session-expired', handleSessionExpired);

    const expiresAt = getSessionExpiresAt();
    const timeout = expiresAt
      ? window.setTimeout(handleSessionExpired, Math.max(0, expiresAt - Date.now()))
      : undefined;

    return () => {
      window.removeEventListener('session-expired', handleSessionExpired);
      if (timeout) window.clearTimeout(timeout);
    };
  }, [navigate]);

  const navItems = [
    { name: 'Dashboard', path: '/', icon: 'ki-duotone ki-element-11' },
    { name: 'Transactions', path: '/transactions', icon: 'ki-outline ki-receipt' },
    { name: 'Smart Upload', path: '/upload', icon: 'ki-outline ki-cloud-add' },
    { name: 'Statement Import', path: '/statement-import', icon: 'ki-outline ki-file-sheet' },
    { name: 'Calendar', path: '/calendar', icon: 'ki-outline ki-calendar' },
    { name: 'AI Insights', path: '/insights', icon: 'ki-outline ki-stars' },
  ];

  return (
    <div className="app-shell flex h-screen overflow-hidden">
      <aside className="hidden w-72 flex-col border-r border-white/10 bg-slate-950 text-white lg:flex">
        <div className="p-6">
          <div className="flex items-center gap-3">
            <div className="kt-icon-badge bg-emerald-400 text-lg font-black text-slate-950 shadow-lg shadow-emerald-500/20">
              <i className="fonticon fonticon-finance" />
            </div>
            <div>
              <h1 className="text-xl font-bold">FinSight AI</h1>
              <p className="text-xs font-medium text-slate-400">Expense intelligence</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 space-y-1 px-4">
          {navItems.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              className={cn(
                "kt-nav-item metronic-action flex items-center gap-3 rounded-lg px-3 py-3 text-sm font-semibold transition-all",
                location.pathname === item.path
                  ? "bg-white text-slate-950 shadow-lg shadow-black/10"
                  : "text-slate-400 hover:bg-white/10 hover:text-white"
              )}
            >
              <i className={cn("ki-hover-rise text-lg", item.icon)} data-kt-icon-button />
              {item.name}
            </Link>
          ))}
        </nav>

        <div className="border-t border-white/10 p-4">
          <div className="mb-3 flex items-center gap-3 rounded-lg bg-white/5 px-3 py-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-white/10">
              <i className="ki-outline ki-user text-slate-200" data-kt-icon-button />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">{user.name || 'User'}</p>
              <p className="truncate text-xs text-slate-400">{user.email}</p>
            </div>
          </div>
          <Button 
            variant="ghost" 
            className="h-10 w-full justify-start text-slate-300 hover:bg-red-500/10 hover:text-red-200"
            onClick={handleLogout}
          >
            <i className="ki-outline ki-exit-right mr-2" data-kt-icon-button />
            Logout
          </Button>
        </div>
      </aside>

      <main className="flex-1 flex flex-col overflow-hidden">
        <header className="surface-panel m-4 mb-0 flex h-16 items-center justify-between rounded-lg px-5">
          <div>
            <p className="text-xs font-semibold uppercase text-slate-400">Workspace</p>
            <h2 className="text-lg font-bold text-slate-950">
              {navItems.find(item => item.path === location.pathname)?.name || 'Dashboard'}
            </h2>
          </div>
          
        </header>

        <div className="flex-1 overflow-y-auto p-4 lg:p-8">
          {children}
        </div>
      </main>
    </div>
  );
}
