import React, { useEffect, useState } from 'react';
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
  const [theme, setTheme] = useState(() => (
    document.documentElement.classList.contains('dark') ? 'dark' : 'light'
  ));

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

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    localStorage.setItem('theme', theme);
  }, [theme]);

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
      <aside className="hidden w-72 flex-col border-r border-[#E5E7EB] bg-white text-[#1F2937] lg:flex">
        <div className="p-6">
          <div className="flex items-center gap-3">
            <div className="kt-icon-badge bg-[#EEF6FF] text-lg font-black text-[#4F9CF9] shadow-lg shadow-[#4F9CF9]/15">
              <i className="fonticon fonticon-finance" />
            </div>
            <div>
              <h1 className="text-xl font-bold">FinSight AI</h1>
              <p className="text-xs font-medium text-[#6B7280]">Expense intelligence</p>
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
                  ? "bg-[#EEF6FF] text-[#4F9CF9] shadow-sm"
                  : "text-[#6B7280] hover:bg-[#FAFBFC] hover:text-[#1F2937]"
              )}
            >
              <i className={cn("ki-hover-rise text-lg", item.icon)} data-kt-icon-button />
              {item.name}
            </Link>
          ))}
        </nav>

        <div className="border-t border-[#E5E7EB] p-4">
          <div className="mb-3 flex items-center gap-3 rounded-lg bg-[#FAFBFC] px-3 py-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#EEF6FF]">
              <i className="ki-outline ki-user text-[#4F9CF9]" data-kt-icon-button />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">{user.name || 'User'}</p>
              <p className="truncate text-xs text-[#6B7280]">{user.email}</p>
            </div>
          </div>
          <Button 
            variant="ghost" 
            className="h-10 w-full justify-start text-[#6B7280] hover:bg-[#FFF1F1] hover:text-[#FF6B6B]"
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
            <p className="text-xs font-semibold uppercase text-[#6B7280]">Workspace</p>
            <h2 className="text-lg font-bold text-[#1F2937]">
              {navItems.find(item => item.path === location.pathname)?.name || 'Dashboard'}
            </h2>
          </div>
          <Button
            variant="outline"
            size="icon"
            aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}
            title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}
            onClick={() => setTheme((current) => current === 'dark' ? 'light' : 'dark')}
          >
            <i className={cn("ki-solid text-base", theme === 'dark' ? "ki-sun" : "ki-moon")} aria-hidden="true" />
          </Button>
        </header>

        <div className="flex-1 overflow-y-auto p-4 lg:p-8">
          {children}
        </div>
      </main>
    </div>
  );
}
