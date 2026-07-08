import api from '@/src/lib/api';
import { getData } from './http';

export type WalletType = 'personal' | 'family';
export type WalletRole = 'owner' | 'member';

export type Wallet = {
  id: number;
  name: string;
  type: WalletType;
  owner_user_id: number;
  monthly_expense_target: number | null;
  role: WalletRole;
  member_count: number;
};

export type WalletMember = {
  id: number;
  name: string;
  email: string;
  role: WalletRole;
  created_at: string;
};

export const walletsApi = {
  list: () => getData<Wallet[]>(api.get('/wallets')),
  create: (payload: { name: string; monthly_expense_target?: number | null }) =>
    getData<Wallet>(api.post('/wallets', payload)),
  members: (walletId: number) =>
    getData<WalletMember[]>(api.get(`/wallets/${walletId}/members`)),
  addMember: (walletId: number, email: string) =>
    getData<{ members: WalletMember[] }>(api.post(`/wallets/${walletId}/members`, { email })),
  removeMember: (walletId: number, userId: number) =>
    api.delete(`/wallets/${walletId}/members/${userId}`),
  updateBudget: (walletId: number, monthlyExpenseTarget: number | null) =>
    getData<Wallet>(api.patch(`/wallets/${walletId}/budget`, { monthly_expense_target: monthlyExpenseTarget })),
};
