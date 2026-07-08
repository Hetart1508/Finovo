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
  const [initialSelectedWalletId] = useState<number | null>(() => {
    const stored = Number(localStorage.getItem(storageKeys.selectedWalletId));
    return Number.isInteger(stored) && stored > 0 ? stored : null;
  });
  const [selectedWalletId, setSelectedWalletIdState] = useState<number | null>(null);

  useEffect(() => {
    if (!wallets.length || selectedWalletId !== null) return;

    const selectedExists = initialSelectedWalletId ? wallets.some((wallet) => wallet.id === initialSelectedWalletId) : false;
    const wallet = selectedExists
      ? wallets.find((wallet) => wallet.id === initialSelectedWalletId)
      : wallets.find((wallet) => wallet.type === 'personal') ?? wallets[0];

    if (!wallet) return;

    setSelectedWalletIdState(wallet.id);
    localStorage.setItem(storageKeys.selectedWalletId, String(wallet.id));
  }, [initialSelectedWalletId, selectedWalletId, wallets]);

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
