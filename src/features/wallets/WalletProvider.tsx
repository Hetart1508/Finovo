import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { walletsApi, type Wallet } from '@/src/api/walletsApi';
import { storageKeys } from '@/src/lib/storageKeys';
import { queryKeys } from '@/src/server-state/queryKeys';

type WalletContextValue = {
  wallets: Wallet[];
  selectedWallet: Wallet | null;
  selectedWalletId: number | null;
  walletsLoading: boolean;
  setSelectedWalletId: (walletId: number) => void;
};

const WalletContext = createContext<WalletContextValue | null>(null);

export function WalletProvider({ children }: { children: ReactNode }) {
  const walletsQuery = useQuery({
    queryKey: queryKeys.wallets,
    queryFn: walletsApi.list,
  });
  const wallets = walletsQuery.data ?? [];
  const [selectedWalletId, setSelectedWalletIdState] = useState<number | null>(() => {
    const stored = Number(localStorage.getItem(storageKeys.selectedWalletId));
    return Number.isInteger(stored) && stored > 0 ? stored : null;
  });

  useEffect(() => {
    if (!wallets.length) return;
    const selectedExists = selectedWalletId ? wallets.some((wallet) => wallet.id === selectedWalletId) : false;
    if (selectedExists) return;

    const fallbackWallet = wallets.find((wallet) => wallet.type === 'personal') ?? wallets[0];
    setSelectedWalletIdState(fallbackWallet.id);
    localStorage.setItem(storageKeys.selectedWalletId, String(fallbackWallet.id));
  }, [selectedWalletId, wallets]);

  const setSelectedWalletId = (walletId: number) => {
    setSelectedWalletIdState(walletId);
    localStorage.setItem(storageKeys.selectedWalletId, String(walletId));
  };

  const selectedWallet = useMemo(
    () => wallets.find((wallet) => wallet.id === selectedWalletId) ?? null,
    [selectedWalletId, wallets]
  );

  const value = useMemo<WalletContextValue>(() => ({
    wallets,
    selectedWallet,
    selectedWalletId,
    walletsLoading: walletsQuery.isPending,
    setSelectedWalletId,
  }), [selectedWallet, selectedWalletId, wallets, walletsQuery.isPending]);

  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>;
}

export function useWallets() {
  const context = useContext(WalletContext);
  if (!context) {
    throw new Error('useWallets must be used within WalletProvider');
  }
  return context;
}
