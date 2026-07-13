import React, { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { Button } from '@/src/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger } from '@/src/components/ui/select';
import { toast } from 'react-toastify';
import { clearSession, getSessionExpiresAt } from '@/src/lib/session';
import { storageKeys } from '@/src/lib/storageKeys';
import { authApi } from '@/src/api/authApi';
import { useWallets } from '@/src/features/wallets/WalletProvider';
import { useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { AddTransactionDialog } from '@/src/features/transactions/components/AddTransactionDialog';
import { useTransactionMutations } from '@/src/features/transactions/hooks/useTransactionMutations';
import {
  RiDashboard2Line,
  RiFileUploadLine,
  RiHistoryLine,
  RiLogoutCircleRLine,
  RiScanLine,
  RiSparkling2Line,
  RiUser3Line,
  RiWallet3Line,
  RiCalendarEventLine,
  RiCloseLine,
  RiMenu3Line,
  RiRepeatLine,
  RiFundsLine,
  RiRobot2Line,
  RiUserSettingsLine,
  RiGroupLine,
  RiBarChartBoxLine,
} from 'react-icons/ri';

interface LayoutProps {
  children: React.ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  const queryClient = useQueryClient();
  const location = useLocation();
  const navigate = useNavigate();
  const { wallets, selectedWallet, selectedWalletId, walletsLoading, setSelectedWalletId } = useWallets();
  const [user, setUser] = useState(() => JSON.parse(localStorage.getItem(storageKeys.user) || '{}'));
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [globalAddDialogOpen, setGlobalAddDialogOpen] = useState(false);
  const todayDateString = format(new Date(), 'yyyy-MM-dd');
  const [globalTransactionDate, setGlobalTransactionDate] = useState(todayDateString);
  const globalTransactionMutations = useTransactionMutations({
    editingTransaction: null,
    transactionDate: globalTransactionDate,
    todayDateString,
    selectedWalletId,
    onAdded: () => setGlobalTransactionDate(todayDateString),
    onUpdated: () => undefined,
  });

  const finishLogout = (message: string) => {
    clearSession();
    queryClient.clear();
    toast.success(message);
    navigate('/auth');
  };

  const handleLogout = async () => {
    try {
      await authApi.logout();
    } finally {
      finishLogout('Logged out successfully');
    }
  };

  useEffect(() => {
    const handleSessionExpired = () => {
      clearSession();
      queryClient.clear();
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
  }, [navigate, queryClient]);

  useEffect(() => {
    setMobileNavOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    const syncUser = () => setUser(JSON.parse(localStorage.getItem(storageKeys.user) || '{}'));
    window.addEventListener('profile-updated', syncUser);
    window.addEventListener('storage', syncUser);
    return () => {
      window.removeEventListener('profile-updated', syncUser);
      window.removeEventListener('storage', syncUser);
    };
  }, []);

  useEffect(() => {
    let active = true;
    authApi.me().then(({ data }) => {
      if (!active) return;
      localStorage.setItem(storageKeys.user, JSON.stringify(data.user));
      setUser(data.user);
    }).catch(() => undefined);
    return () => { active = false; };
  }, []);

  const navItems = [
    { name: 'Dashboard', path: '/', icon: RiDashboard2Line },
    { name: 'Transactions', path: '/transactions', icon: RiHistoryLine },
    { name: 'Smart Upload', path: '/upload', icon: RiScanLine },
    { name: 'Statement Import', path: '/statement-import', icon: RiFileUploadLine },
    { name: 'Calendar', path: '/calendar', icon: RiCalendarEventLine },
    { name: 'Recurring', path: '/recurring', icon: RiRepeatLine },
    { name: 'Investments', path: '/investments', icon: RiFundsLine },
    { name: 'Wealth Advisor', path: '/wealth-advisor', icon: RiRobot2Line },
    { name: 'AI Insights', path: '/insights', icon: RiSparkling2Line },
    ...(user.gemini_admin ? [{ name: 'Gemini Usage', path: '/admin/ai-usage', icon: RiBarChartBoxLine }] : []),
    { name: 'Profile', path: '/profile', icon: RiUserSettingsLine },
  ];
  const activeItem = navItems.find(item => item.path === location.pathname) || navItems[0];
  const getWalletLabel = (wallet: typeof wallets[number]) =>
    wallet.type === 'family' ? wallet.name : 'Personal wallet';

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
      <aside className="hidden w-60 flex-col overflow-hidden border-r border-[#E5E7EB] bg-white text-[#1F2937] lg:flex">
        <div className="shrink-0 p-6">
          <div className="flex items-center gap-3">
            <div className="kt-icon-badge bg-[#EEF6FF] text-lg font-black text-[#4F9CF9] shadow-lg shadow-[#4F9CF9]/15">
              <RiWallet3Line aria-hidden="true" />
            </div>
            <div>
              <h1 className="text-xl font-bold">Finovo AI</h1>
              <p className="text-xs font-medium text-[#6B7280]">Expense intelligence</p>
            </div>
          </div>
        </div>

        <nav className="min-h-0 flex-1 space-y-1 overflow-y-auto overscroll-contain px-4 pb-4">
          {navItems.map((item) => renderNavLink(item))}
        </nav>

        <div className="shrink-0 border-t border-[#E5E7EB] p-4">
          <Link to="/profile" className="mb-3 flex items-center gap-3 rounded-lg bg-[#FAFBFC] px-3 py-3 transition-colors hover:bg-[#EEF6FF]">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#EEF6FF]">
              <RiUser3Line className="text-[#4F9CF9]" aria-hidden="true" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">{user.name || 'User'}</p>
              <p className="truncate text-xs text-[#6B7280]">{user.email}</p>
            </div>
          </Link>
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
        <div className="flex shrink-0 items-center justify-between p-5">
          <div className="flex items-center gap-3">
            <div className="kt-icon-badge bg-[#EEF6FF] text-lg font-black text-[#4F9CF9] shadow-lg shadow-[#4F9CF9]/15">
              <RiWallet3Line aria-hidden="true" />
            </div>
            <div>
              <h1 className="text-lg font-bold">Finovo AI</h1>
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

        <nav className="min-h-0 flex-1 space-y-1 overflow-y-auto overscroll-contain px-4 pb-4">
          {navItems.map((item) => renderNavLink(item, 'drawer'))}
        </nav>

        <div className="shrink-0 border-t border-[#E5E7EB] p-4">
          <Link to="/profile" className="mb-3 flex items-center gap-3 rounded-lg bg-[#FAFBFC] px-3 py-3 transition-colors hover:bg-[#EEF6FF]">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#EEF6FF]">
              <RiUser3Line className="text-[#4F9CF9]" aria-hidden="true" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">{user.name || 'User'}</p>
              <p className="truncate text-xs text-[#6B7280]">{user.email}</p>
            </div>
          </Link>
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

      <main className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
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
          <div className="flex min-w-0 shrink-0 items-center gap-2">
            <RiGroupLine className="hidden text-lg text-[#4F9CF9] sm:block" aria-hidden="true" />
            <Select
              aria-label="Select wallet"
              value={selectedWalletId ? String(selectedWalletId) : undefined}
              disabled={walletsLoading || wallets.length === 0}
              onValueChange={(value) => setSelectedWalletId(Number(value))}
            >
              <SelectTrigger
                className="h-9 w-32 border-[#E5E7EB] bg-white px-2.5 text-sm font-semibold text-[#1F2937] sm:w-72 lg:w-80"
                title={selectedWallet ? getWalletLabel(selectedWallet) : 'Select wallet'}
              >
                <span className="min-w-0 flex-1 truncate text-left">
                  {selectedWallet ? getWalletLabel(selectedWallet) : 'Select wallet'}
                </span>
              </SelectTrigger>
              <SelectContent align="start" className="z-[90]">
                {wallets.map((wallet) => (
                  <SelectItem key={wallet.id} value={String(wallet.id)}>{getWalletLabel(wallet)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </header>

        <div className="app-scroll min-w-0 flex-1 p-3 pb-24 sm:p-4 sm:pb-24 lg:p-6 lg:pb-28 xl:p-8 xl:pb-28">
          <div className="mx-auto min-w-0 w-full max-w-[100rem]">
            {children}
          </div>
        </div>
      </main>

      <AddTransactionDialog
        open={globalAddDialogOpen}
        onOpenChange={setGlobalAddDialogOpen}
        transactionDate={globalTransactionDate}
        maxDate={todayDateString}
        onTransactionDateChange={setGlobalTransactionDate}
        onAddTransaction={globalTransactionMutations.handleAdd}
        onExtractTransaction={globalTransactionMutations.handleExtract}
        extractingTransaction={globalTransactionMutations.extractingTransaction}
        selectedWalletName={selectedWallet?.name ?? 'Wallet'}
      />

      {/* Temporarily hidden global Add Transaction and Wealth Advisor actions.
      <div className="pointer-events-none fixed bottom-[max(1rem,env(safe-area-inset-bottom))] right-4 z-30 flex flex-col items-center gap-3 sm:right-6 lg:right-8">
        <button
          type="button"
          onClick={() => setGlobalAddDialogOpen(true)}
          className="pointer-events-auto inline-flex h-12 w-12 items-center justify-center rounded-full border border-[#34C759]/25 bg-[#34C759]/25 text-white/85 shadow-[0_12px_28px_rgba(52,199,89,0.14)] backdrop-blur-[2px] transition hover:border-transparent hover:bg-[#2EB851] hover:text-white hover:shadow-[0_16px_35px_rgba(52,199,89,0.32)] focus-visible:border-transparent focus-visible:bg-[#2EB851] focus-visible:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#34C759]/40"
          aria-label="Add transaction"
          title="Add transaction"
        >
          <RiAddCircleLine className="text-xl" aria-hidden="true" />
        </button>

        <Link
          to="/wealth-advisor"
          className="pointer-events-auto inline-flex h-12 w-12 items-center justify-center rounded-full border border-[#4F9CF9]/25 bg-[#4F9CF9]/25 text-white/85 shadow-[0_12px_28px_rgba(79,156,249,0.14)] backdrop-blur-[2px] transition hover:border-transparent hover:bg-[#3F8BE5] hover:text-white hover:shadow-[0_16px_35px_rgba(79,156,249,0.32)] focus-visible:border-transparent focus-visible:bg-[#3F8BE5] focus-visible:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4F9CF9]/40"
          aria-label="Open wealth advisor chat"
          title="Wealth advisor chat"
        >
          <RiRobot2Line className="text-xl" aria-hidden="true" />
        </Link>
      </div>
      */}
    </div>
  );
}
