import AsyncStorage from '@react-native-async-storage/async-storage';
import { useQuery } from '@tanstack/react-query';
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import { walletsApi } from '@/api/wallets';
import { useAuth } from '@/features/auth/auth-provider';
import type { Wallet } from '@/types/finance';

const selectedWalletKey = 'finovo.mobile.selectedWalletId';

type WalletContextValue = {
  wallets: Wallet[];
  selectedWallet: Wallet | null;
  selectedWalletId: number | null;
  isLoading: boolean;
  selectWallet: (id: number) => void;
};

const WalletContext = createContext<WalletContextValue | null>(null);

export function WalletProvider({ children }: { children: ReactNode }) {
  const { status } = useAuth();
  const result = useQuery({ queryKey: ['wallets'], queryFn: walletsApi.list, enabled: status === 'authenticated' });
  const wallets = result.data ?? [];
  const [selectedWalletId, setSelectedWalletId] = useState<number | null>(null);

  useEffect(() => {
    if (!wallets.length || selectedWalletId !== null) return;
    void AsyncStorage.getItem(selectedWalletKey).then((stored) => {
      const storedId = Number(stored);
      const selected = wallets.find((wallet) => wallet.id === storedId)
        ?? wallets.find((wallet) => wallet.type === 'personal')
        ?? wallets[0];
      if (selected) setSelectedWalletId(selected.id);
    });
  }, [selectedWalletId, wallets]);

  const selectWallet = (id: number) => {
    setSelectedWalletId(id);
    void AsyncStorage.setItem(selectedWalletKey, String(id));
  };
  const selectedWallet = wallets.find((wallet) => wallet.id === selectedWalletId) ?? null;
  const value = useMemo(() => ({ wallets, selectedWallet, selectedWalletId, isLoading: result.isPending, selectWallet }), [result.isPending, selectedWallet, selectedWalletId, wallets]);
  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>;
}

export function useWallet() {
  const value = useContext(WalletContext);
  if (!value) throw new Error('useWallet must be used inside WalletProvider');
  return value;
}
