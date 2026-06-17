import React, { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { toast } from 'react-toastify';
import { clearSession, getSessionExpiresAt } from '@/src/lib/session';
import {
  RiDashboard2Line,
  RiFileUploadLine,
  RiHistoryLine,
  RiLogoutCircleRLine,
  RiMoonLine,
  RiScanLine,
  RiSparkling2Line,
  RiSunLine,
  RiUser3Line,
  RiWallet3Line,
  RiCalendarEventLine,
  RiCloseLine,
  RiMenu3Line,
} from 'react-icons/ri';

interface LayoutProps {
  children: React.ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
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

  useEffect(() => {
    setMobileNavOpen(false);
  }, [location.pathname]);

  const navItems = [
    { name: 'Dashboard', path: '/', icon: RiDashboard2Line },
    { name: 'Transactions', path: '/transactions', icon: RiHistoryLine },
    { name: 'Smart Upload', path: '/upload', icon: RiScanLine },
    { name: 'Statement Import', path: '/statement-import', icon: RiFileUploadLine },
    { name: 'Calendar', path: '/calendar', icon: RiCalendarEventLine },
    { name: 'AI Insights', path: '/insights', icon: RiSparkling2Line },
  ];
  const activeItem = navItems.find(item => item.path === location.pathname) || navItems[0];

  const renderNavLink = (
    item: typeof navItems[number],
    variant: 'sidebar' | 'drawer' = 'sidebar'
  ) => {
    const Icon = item.icon;
    const isActive = location.pathname === item.path;

    return (
      <Link
        key={item.path}
        to={item.path}
        className={cn(
          "group/nav kt-nav-item metronic-action flex items-center gap-3 rounded-lg text-sm font-semibold transition-all",
          variant === 'drawer' ? "px-3 py-3.5" : "px-3 py-3",
          isActive
            ? "bg-[#EEF6FF] text-[#4F9CF9] shadow-sm"
            : "text-[#6B7280] hover:bg-[#FAFBFC] hover:text-[#1F2937]"
        )}
      >
        <Icon className="text-lg transition-transform group-hover/nav:scale-110" aria-hidden="true" />
        {item.name}
      </Link>
    );
  };

  return (
    <div className="app-shell flex h-dvh overflow-hidden">
      <aside className="hidden w-72 flex-col border-r border-[#E5E7EB] bg-white text-[#1F2937] lg:flex">
        <div className="p-6">
          <div className="flex items-center gap-3">
            <div className="kt-icon-badge bg-[#EEF6FF] text-lg font-black text-[#4F9CF9] shadow-lg shadow-[#4F9CF9]/15">
              <RiWallet3Line aria-hidden="true" />
            </div>
            <div>
              <h1 className="text-xl font-bold">FinSight AI</h1>
              <p className="text-xs font-medium text-[#6B7280]">Expense intelligence</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 space-y-1 px-4">
          {navItems.map((item) => renderNavLink(item))}
        </nav>

        <div className="border-t border-[#E5E7EB] p-4">
          <div className="mb-3 flex items-center gap-3 rounded-lg bg-[#FAFBFC] px-3 py-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#EEF6FF]">
              <RiUser3Line className="text-[#4F9CF9]" aria-hidden="true" />
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
            <RiLogoutCircleRLine className="mr-2 text-base" aria-hidden="true" />
            Logout
          </Button>
        </div>
      </aside>

      {mobileNavOpen ? (
        <button
          type="button"
          className="fixed inset-0 z-40 bg-[#1F2937]/35 backdrop-blur-[2px] lg:hidden"
          aria-label="Close navigation menu"
          onClick={() => setMobileNavOpen(false)}
        />
      ) : null}

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-[min(20rem,86vw)] flex-col border-r border-[#E5E7EB] bg-white text-[#1F2937] shadow-2xl transition-transform duration-200 lg:hidden",
          mobileNavOpen ? "translate-x-0" : "-translate-x-full"
        )}
        aria-hidden={!mobileNavOpen}
      >
        <div className="flex items-center justify-between p-5">
          <div className="flex items-center gap-3">
            <div className="kt-icon-badge bg-[#EEF6FF] text-lg font-black text-[#4F9CF9] shadow-lg shadow-[#4F9CF9]/15">
              <RiWallet3Line aria-hidden="true" />
            </div>
            <div>
              <h1 className="text-lg font-bold">FinSight AI</h1>
              <p className="text-xs font-medium text-[#6B7280]">Expense intelligence</p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="text-[#6B7280]"
            aria-label="Close navigation menu"
            onClick={() => setMobileNavOpen(false)}
          >
            <RiCloseLine className="text-lg" aria-hidden="true" />
          </Button>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto px-4 pb-4">
          {navItems.map((item) => renderNavLink(item, 'drawer'))}
        </nav>

        <div className="border-t border-[#E5E7EB] p-4">
          <div className="mb-3 flex items-center gap-3 rounded-lg bg-[#FAFBFC] px-3 py-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#EEF6FF]">
              <RiUser3Line className="text-[#4F9CF9]" aria-hidden="true" />
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
            <RiLogoutCircleRLine className="mr-2 text-base" aria-hidden="true" />
            Logout
          </Button>
        </div>
      </aside>

      <main className="flex flex-1 flex-col overflow-hidden">
        <header className="surface-panel m-3 mb-0 flex min-h-16 items-center justify-between gap-3 rounded-lg px-3 sm:m-4 sm:mb-0 sm:px-5">
          <div className="flex min-w-0 items-center gap-3">
            <Button
              variant="outline"
              size="icon"
              className="lg:hidden"
              aria-label="Open navigation menu"
              aria-expanded={mobileNavOpen}
              onClick={() => setMobileNavOpen(true)}
            >
              <RiMenu3Line className="text-lg" aria-hidden="true" />
            </Button>
            <div className="min-w-0">
            <p className="text-xs font-semibold uppercase text-[#6B7280]">Workspace</p>
            <h2 className="truncate text-base font-bold text-[#1F2937] sm:text-lg">
              {activeItem.name}
            </h2>
            </div>
          </div>
          <Button
            variant="outline"
            size="icon"
            aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}
            title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}
            onClick={() => setTheme((current) => current === 'dark' ? 'light' : 'dark')}
          >
            {theme === 'dark' ? <RiSunLine className="text-base" aria-hidden="true" /> : <RiMoonLine className="text-base" aria-hidden="true" />}
          </Button>
        </header>

        <div className="flex-1 overflow-y-auto p-3 sm:p-4 lg:p-8">
          {children}
        </div>
      </main>
    </div>
  );
}
