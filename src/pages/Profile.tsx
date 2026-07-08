import { useEffect, useMemo, useState } from 'react';
import type { FormEvent, ReactNode } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-toastify';
import {
  RiCheckboxCircleLine,
  RiMailLine,
  RiInformationLine,
  RiShieldUserLine,
  RiUser3Line,
  RiWallet3Line,
  RiGroupLine,
  RiDeleteBin6Line,
} from 'react-icons/ri';
import { userApi } from '@/src/api/userApi';
import { walletsApi } from '@/src/api/walletsApi';
import type { MonthlyReportPreferences, ReportFrequency } from '@/src/api/userApi';
import { Button } from '@/src/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/src/components/ui/card';
import { Input } from '@/src/components/ui/input';
import { Label } from '@/src/components/ui/label';
import { getApiMessage } from '@/src/lib/toastMessages';
import { storageKeys } from '@/src/lib/storageKeys';
import { userProfileQuery } from '@/src/server-state';
import { queryKeys } from '@/src/server-state/queryKeys';
import { useWallets } from '@/src/features/wallets/WalletProvider';
import type { RiskAppetite, UserProfile, UserProfilePayload } from '@/src/types/profile';
import { formatRupees } from '@/src/utils/formatters';

type ProfileFormState = {
  name: string;
  date_of_birth: string;
  occupation: string;
  city: string;
  country: string;
  monthly_income: string;
  monthly_expense_target: string;
  emergency_fund_target: string;
  risk_appetite: RiskAppetite | '';
  investment_goal: string;
  financial_dependents: string;
  preferred_currency: string;
  ai_personalization_enabled: boolean;
};

const emptyForm: ProfileFormState = {
  name: '',
  date_of_birth: '',
  occupation: '',
  city: '',
  country: 'India',
  monthly_income: '',
  monthly_expense_target: '',
  emergency_fund_target: '',
  risk_appetite: '',
  investment_goal: '',
  financial_dependents: '',
  preferred_currency: 'INR',
  ai_personalization_enabled: false,
};

const defaultReportPreferences: MonthlyReportPreferences = {
  email_enabled: true,
  report_frequency: 'monthly',
  custom_interval_days: 30,
  send_day_of_month: 1,
  include_ai_summary: false,
  include_next_month_planning: true,
  delivery_email: null,
};

const textOrDash = (value: unknown) =>
  typeof value === 'string' && value.trim() ? value : 'Not set';

const numberOrNull = (value: string) => {
  if (!value.trim()) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const profileToForm = (profile: UserProfile): ProfileFormState => ({
  name: profile.name || '',
  date_of_birth: profile.date_of_birth || '',
  occupation: profile.occupation || '',
  city: profile.city || '',
  country: profile.country || 'India',
  monthly_income: profile.monthly_income === null ? '' : String(profile.monthly_income),
  monthly_expense_target: profile.monthly_expense_target === null ? '' : String(profile.monthly_expense_target),
  emergency_fund_target: profile.emergency_fund_target === null ? '' : String(profile.emergency_fund_target),
  risk_appetite: profile.risk_appetite || '',
  investment_goal: profile.investment_goal || '',
  financial_dependents: profile.financial_dependents === null ? '' : String(profile.financial_dependents),
  preferred_currency: profile.preferred_currency || 'INR',
  ai_personalization_enabled: profile.ai_personalization_enabled,
});

const countCompletedFields = (profile: UserProfile | undefined) => {
  if (!profile) return 0;
  const fields = [
    profile.name,
    profile.date_of_birth,
    profile.occupation,
    profile.city,
    profile.country,
    profile.monthly_income,
    profile.monthly_expense_target,
    profile.emergency_fund_target,
    profile.risk_appetite,
    profile.investment_goal,
    profile.financial_dependents,
    profile.preferred_currency,
  ];
  return fields.filter((field) => field !== null && field !== undefined && String(field).trim() !== '').length;
};

export default function Profile() {
  const queryClient = useQueryClient();
  const { wallets, selectedWallet, selectedWalletId, setSelectedWalletId } = useWallets();
  const { data: profile, isLoading, error } = useQuery(userProfileQuery());
  const reportPreferencesQuery = useQuery({
    queryKey: queryKeys.monthlyReportPreferences,
    queryFn: () => userApi.getMonthlyReportPreferences(),
  });
  const selectedWalletMembersQuery = useQuery({
    queryKey: queryKeys.walletMembers(selectedWalletId),
    queryFn: () => walletsApi.members(selectedWalletId as number),
    enabled: Boolean(selectedWalletId && selectedWallet?.type === 'family'),
  });
  const [form, setForm] = useState<ProfileFormState>(emptyForm);
  const [reportForm, setReportForm] = useState<MonthlyReportPreferences>(defaultReportPreferences);
  const [familyWalletName, setFamilyWalletName] = useState('');
  const [familyBudget, setFamilyBudget] = useState('');
  const [memberEmail, setMemberEmail] = useState('');

  useEffect(() => {
    if (profile) setForm(profileToForm(profile));
  }, [profile]);

  useEffect(() => {
    if (reportPreferencesQuery.data) {
      setReportForm(reportPreferencesQuery.data);
    }
  }, [reportPreferencesQuery.data]);

  const completion = useMemo(() => {
    const total = 12;
    const completed = countCompletedFields(profile);
    return {
      completed,
      percent: Math.round((completed / total) * 100),
    };
  }, [profile]);
  const familyWallets = wallets.filter((wallet) => wallet.type === 'family');
  const selectedWalletMembers = selectedWalletMembersQuery.data ?? [];

  const saveProfile = useMutation({
    mutationFn: (payload: UserProfilePayload) => userApi.updateProfile(payload),
    onSuccess: (response) => {
      queryClient.setQueryData(queryKeys.userProfile, response.data);
      const storedUser = JSON.parse(localStorage.getItem(storageKeys.user) || '{}');
      localStorage.setItem(storageKeys.user, JSON.stringify({
        ...storedUser,
        name: response.data.name,
        email: response.data.email,
      }));
      window.dispatchEvent(new Event('profile-updated'));
      toast.success('Profile updated successfully.');
    },
  });

  const saveReportPreferences = useMutation({
    mutationFn: (payload: MonthlyReportPreferences) => userApi.updateMonthlyReportPreferences(payload),
    onSuccess: (response) => {
      queryClient.setQueryData(queryKeys.monthlyReportPreferences, response.data);
      toast.success('Mail report settings saved.');
    },
  });

  const createFamilyWallet = useMutation({
    mutationFn: (payload: { name: string; monthly_expense_target: number | null }) => walletsApi.create(payload),
    onSuccess: (wallet) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.wallets });
      setSelectedWalletId(wallet.id);
      setFamilyWalletName('');
      setFamilyBudget('');
      toast.success('Family wallet created.');
    },
  });

  const saveWalletBudget = useMutation({
    mutationFn: ({ walletId, budget }: { walletId: number; budget: number | null }) => walletsApi.updateBudget(walletId, budget),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.wallets });
      toast.success('Wallet budget saved.');
    },
  });

  const addWalletMember = useMutation({
    mutationFn: ({ walletId, email }: { walletId: number; email: string }) => walletsApi.addMember(walletId, email),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.walletMembers(selectedWalletId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.wallets });
      setMemberEmail('');
      toast.success('Member added to family wallet.');
    },
  });

  const removeWalletMember = useMutation({
    mutationFn: ({ walletId, userId }: { walletId: number; userId: number }) => walletsApi.removeMember(walletId, userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.walletMembers(selectedWalletId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.wallets });
      toast.success('Member removed.');
    },
  });

  const updateField = <Key extends keyof ProfileFormState>(key: Key, value: ProfileFormState[Key]) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const updateReportField = <Key extends keyof MonthlyReportPreferences>(key: Key, value: MonthlyReportPreferences[Key]) => {
    setReportForm((current) => ({ ...current, [key]: value }));
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const payload: UserProfilePayload = {
      name: form.name.trim(),
      date_of_birth: form.date_of_birth || null,
      occupation: form.occupation.trim() || null,
      city: form.city.trim() || null,
      country: form.country.trim() || 'India',
      monthly_income: numberOrNull(form.monthly_income),
      monthly_expense_target: numberOrNull(form.monthly_expense_target),
      emergency_fund_target: numberOrNull(form.emergency_fund_target),
      risk_appetite: form.risk_appetite || null,
      investment_goal: form.investment_goal.trim() || null,
      financial_dependents: numberOrNull(form.financial_dependents),
      preferred_currency: form.preferred_currency.trim().toUpperCase() || 'INR',
      ai_personalization_enabled: form.ai_personalization_enabled,
    };

    try {
      await saveProfile.mutateAsync(payload);
    } catch (saveError) {
      toast.error(getApiMessage(saveError, 'Failed to update profile.'));
    }
  };

  const handleReportSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const payload: MonthlyReportPreferences = {
      ...reportForm,
      custom_interval_days: Math.max(1, Math.min(365, Number(reportForm.custom_interval_days) || 30)),
      send_day_of_month: Math.max(1, Math.min(28, Number(reportForm.send_day_of_month) || 1)),
      delivery_email: null,
    };

    try {
      await saveReportPreferences.mutateAsync(payload);
    } catch (saveError) {
      toast.error(getApiMessage(saveError, 'Failed to save mail report settings.'));
    }
  };

  const handleCreateFamilyWallet = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    try {
      await createFamilyWallet.mutateAsync({
        name: familyWalletName.trim(),
        monthly_expense_target: numberOrNull(familyBudget),
      });
    } catch (saveError) {
      toast.error(getApiMessage(saveError, 'Failed to create family wallet.'));
    }
  };

  const handleSaveWalletBudget = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedWalletId) return;
    const formData = new FormData(event.currentTarget);
    try {
      await saveWalletBudget.mutateAsync({
        walletId: selectedWalletId,
        budget: numberOrNull(String(formData.get('wallet_budget') || '')),
      });
    } catch (saveError) {
      toast.error(getApiMessage(saveError, 'Failed to save wallet budget.'));
    }
  };

  const handleAddWalletMember = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedWalletId) return;
    try {
      await addWalletMember.mutateAsync({ walletId: selectedWalletId, email: memberEmail.trim() });
    } catch (saveError) {
      toast.error(getApiMessage(saveError, 'Failed to add member.'));
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="surface-panel rounded-lg p-6">
          <div className="h-6 w-48 rounded bg-[#E5E7EB]" />
          <div className="mt-3 h-4 w-full max-w-xl rounded bg-[#EEF6FF]" />
        </div>
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[22rem_1fr]">
          <div className="h-80 rounded-lg bg-[#FAFBFC]" />
          <div className="h-96 rounded-lg bg-[#FAFBFC]" />
        </div>
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="surface-panel rounded-lg p-6">
        <p className="text-sm font-semibold text-[#FF6B6B]">Could not load your profile.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-8">
      <div className="surface-panel metronic-surface rounded-lg p-6">
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
          <div>
            <p className="text-sm font-semibold uppercase text-[#4F9CF9]">Profile</p>
            <h1 className="mt-2 text-3xl font-black text-[#1F2937]">Personal finance context</h1>
            <p className="mt-2 max-w-2xl text-sm text-[#6B7280] dark:text-[#CBD5E1]">
              Keep your personal and financial details current so Finovo can personalize future planning and AI features with your permission.
            </p>
          </div>
          <div className="rounded-lg border border-[#E5E7EB] bg-white px-4 py-3 text-left md:text-right">
            <p className="text-xs font-semibold uppercase text-[#6B7280]">Profile completion</p>
            <p className="text-2xl font-black text-[#1F2937]">{completion.percent}%</p>
            <p className="text-xs text-[#6B7280]">{completion.completed} of 12 fields</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[22rem_1fr]">
        <div className="space-y-6">
          <Card className="surface-panel rounded-lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg font-semibold">
                <RiUser3Line className="text-[#4F9CF9]" aria-hidden="true" />
                Profile summary
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-3 rounded-lg bg-[#FAFBFC] p-3">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-[#EEF6FF] text-lg font-black text-[#4F9CF9]">
                  {profile.name?.slice(0, 1).toUpperCase() || 'U'}
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-[#1F2937]">{profile.name}</p>
                  <p className="truncate text-xs text-[#6B7280]">{profile.email}</p>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 text-sm">
                <SummaryRow label="Occupation" value={textOrDash(profile.occupation)} />
                <SummaryRow label="Location" value={[profile.city, profile.country].filter(Boolean).join(', ') || 'Not set'} />
                <SummaryRow label="Dependents" value={profile.financial_dependents ?? 'Not set'} />
                <SummaryRow label="Currency" value={profile.preferred_currency} />
              </div>
            </CardContent>
          </Card>

          <Card className="surface-panel rounded-lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg font-semibold">
                <RiWallet3Line className="text-[#34C759]" aria-hidden="true" />
                Financial snapshot
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <SummaryRow label="Monthly income" value={profile.monthly_income === null ? 'Not set' : formatRupees(profile.monthly_income)} />
              <SummaryRow label="Expense target" value={profile.monthly_expense_target === null ? 'Not set' : formatRupees(profile.monthly_expense_target)} />
              <SummaryRow label="Emergency fund" value={profile.emergency_fund_target === null ? 'Not set' : formatRupees(profile.emergency_fund_target)} />
              <SummaryRow label="Risk appetite" value={profile.risk_appetite ? profile.risk_appetite[0].toUpperCase() + profile.risk_appetite.slice(1) : 'Not set'} />
            </CardContent>
          </Card>

          <Card className="surface-panel rounded-lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg font-semibold">
                <RiGroupLine className="text-[#4F9CF9]" aria-hidden="true" />
                Family wallets
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <form onSubmit={handleCreateFamilyWallet} className="space-y-3 rounded-lg border border-[#E5E7EB] bg-[#FAFBFC] p-3">
                <Field label="Wallet name" htmlFor="family-wallet-name">
                  <Input
                    id="family-wallet-name"
                    value={familyWalletName}
                    onChange={(event) => setFamilyWalletName(event.target.value)}
                    placeholder="Sharma Family"
                    required
                  />
                </Field>
                <Field label="Monthly family budget" htmlFor="family-wallet-budget">
                  <Input
                    id="family-wallet-budget"
                    type="number"
                    min="0"
                    step="0.01"
                    value={familyBudget}
                    onChange={(event) => setFamilyBudget(event.target.value)}
                    placeholder="85000"
                  />
                </Field>
                <Button type="submit" disabled={createFamilyWallet.isPending} className="w-full bg-[#4F9CF9] hover:bg-[#3F8BE5]">
                  {createFamilyWallet.isPending ? 'Creating...' : 'Create Family Wallet'}
                </Button>
              </form>

              {familyWallets.length ? (
                <div className="space-y-2">
                  <p className="text-xs font-semibold uppercase text-[#6B7280]">Your family wallets</p>
                  {familyWallets.map((wallet) => (
                    <button
                      key={wallet.id}
                      type="button"
                      onClick={() => setSelectedWalletId(wallet.id)}
                      className={`flex w-full items-center justify-between gap-3 rounded-lg border px-3 py-2 text-left text-sm transition ${
                        selectedWalletId === wallet.id
                          ? 'border-[#4F9CF9] bg-[#EEF6FF] text-[#1F2937]'
                          : 'border-[#E5E7EB] bg-white text-[#1F2937] hover:bg-[#FAFBFC]'
                      }`}
                    >
                      <span className="min-w-0">
                        <span className="block truncate font-semibold">{wallet.name}</span>
                        <span className="block text-xs text-[#6B7280]">Family wallet - {wallet.role}</span>
                      </span>
                      <span className="shrink-0 text-xs font-semibold text-[#4F9CF9]">
                        {wallet.monthly_expense_target === null ? 'No budget' : formatRupees(wallet.monthly_expense_target)}
                      </span>
                    </button>
                  ))}
                </div>
              ) : (
                <p className="rounded-lg border border-[#E5E7EB] bg-white px-3 py-2 text-sm text-[#6B7280]">
                  Create a family wallet to share transactions and a whole-family budget.
                </p>
              )}

              {selectedWallet?.type === 'family' ? (
                <div className="space-y-4 rounded-lg border border-[#E5E7EB] bg-white p-3">
                  <div>
                    <p className="text-sm font-semibold text-[#1F2937]">{selectedWallet.name}</p>
                    <p className="text-xs text-[#6B7280]">{selectedWallet.role === 'owner' ? 'You can manage this wallet.' : 'You can view and add transactions.'}</p>
                  </div>

                  <form onSubmit={handleSaveWalletBudget} className="space-y-3">
                    <Field label="Shared monthly budget" htmlFor="selected-wallet-budget">
                      <Input
                        key={`${selectedWallet.id}-${selectedWallet.monthly_expense_target ?? 'none'}`}
                        id="selected-wallet-budget"
                        name="wallet_budget"
                        type="number"
                        min="0"
                        step="0.01"
                        defaultValue={selectedWallet.monthly_expense_target ?? ''}
                        disabled={selectedWallet.role !== 'owner'}
                        placeholder="85000"
                      />
                    </Field>
                    {selectedWallet.role === 'owner' ? (
                      <Button type="submit" variant="outline" disabled={saveWalletBudget.isPending} className="w-full">
                        {saveWalletBudget.isPending ? 'Saving...' : 'Save Budget'}
                      </Button>
                    ) : null}
                  </form>

                  {selectedWallet.role === 'owner' ? (
                    <form onSubmit={handleAddWalletMember} className="space-y-3">
                      <Field label="Add registered member" htmlFor="family-member-email">
                        <Input
                          id="family-member-email"
                          type="email"
                          value={memberEmail}
                          onChange={(event) => setMemberEmail(event.target.value)}
                          placeholder="member@example.com"
                          required
                        />
                      </Field>
                      <Button type="submit" variant="outline" disabled={addWalletMember.isPending} className="w-full">
                        {addWalletMember.isPending ? 'Adding...' : 'Add Member'}
                      </Button>
                    </form>
                  ) : null}

                  <div className="space-y-2">
                    <p className="text-xs font-semibold uppercase text-[#6B7280]">Members</p>
                    {selectedWalletMembers.map((member) => (
                      <div key={member.id} className="flex items-center justify-between gap-2 rounded-lg border border-[#E5E7EB] px-3 py-2">
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-semibold text-[#1F2937]">{member.name}</span>
                          <span className="block truncate text-xs text-[#6B7280]">{member.email} - {member.role}</span>
                        </span>
                        {selectedWallet.role === 'owner' && member.role !== 'owner' ? (
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            className="shrink-0 text-[#6B7280] hover:text-[#FF6B6B]"
                            disabled={removeWalletMember.isPending}
                            onClick={() => {
                              if (window.confirm('Remove this member from the family wallet?')) {
                                removeWalletMember.mutate({ walletId: selectedWallet.id, userId: member.id });
                              }
                            }}
                            aria-label="Remove member"
                          >
                            <RiDeleteBin6Line className="text-base" aria-hidden="true" />
                          </Button>
                        ) : null}
                      </div>
                    ))}
                    {!selectedWalletMembers.length && !selectedWalletMembersQuery.isLoading ? (
                      <p className="text-sm text-[#6B7280]">No members loaded yet.</p>
                    ) : null}
                  </div>
                </div>
              ) : null}
            </CardContent>
          </Card>

          <Card className="surface-panel rounded-lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg font-semibold">
                <RiShieldUserLine className="text-[#4F9CF9]" aria-hidden="true" />
                AI readiness
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-start gap-3 rounded-lg bg-[#EEF6FF] p-3 text-sm text-[#1F2937]">
                {profile.ai_personalization_enabled
                  ? <RiCheckboxCircleLine className="mt-0.5 shrink-0 text-lg text-[#34C759]" aria-hidden="true" />
                  : <RiInformationLine className="mt-0.5 shrink-0 text-lg text-[#4F9CF9]" aria-hidden="true" />}
                <p>
                  {profile.ai_personalization_enabled
                    ? 'AI personalization is enabled for future advisor context.'
                    : 'AI personalization is off until you choose to enable it.'}
                </p>
              </div>
            </CardContent>
          </Card>

          <Card className="surface-panel rounded-lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg font-semibold">
                <RiMailLine className="text-[#F59E0B]" aria-hidden="true" />
                Mail reports
              </CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleReportSubmit} className="space-y-4">
                <label className="flex items-start gap-3 rounded-lg border border-[#E5E7EB] bg-[#FAFBFC] p-3">
                  <input
                    type="checkbox"
                    checked={reportForm.email_enabled}
                    onChange={(event) => updateReportField('email_enabled', event.target.checked)}
                    className="mt-1 h-4 w-4 rounded border-[#E5E7EB]"
                    disabled={reportPreferencesQuery.isLoading || saveReportPreferences.isPending}
                  />
                  <span>
                    <span className="block text-sm font-semibold text-[#1F2937]">Allow mail report sending</span>
                    <span className="mt-1 block text-xs leading-5 text-[#6B7280]">
                      Turn this off to stop scheduled financial report emails.
                    </span>
                  </span>
                </label>

                <Field label="Delivery email" htmlFor="report-email">
                  <Input
                    id="report-email"
                    type="email"
                    value={profile.email}
                    disabled
                  />
                </Field>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <Field label="Frequency" htmlFor="report-frequency">
                    <select
                      id="report-frequency"
                      value={reportForm.report_frequency}
                      onChange={(event) => updateReportField('report_frequency', event.target.value as ReportFrequency)}
                      disabled={!reportForm.email_enabled || reportPreferencesQuery.isLoading || saveReportPreferences.isPending}
                      className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:bg-input/50 disabled:opacity-50"
                    >
                      <option value="daily">Daily</option>
                      <option value="weekly">Weekly</option>
                      <option value="monthly">Monthly</option>
                      <option value="custom">Custom</option>
                    </select>
                  </Field>

                  {reportForm.report_frequency === 'custom' ? (
                    <Field label="Every days" htmlFor="report-custom-interval">
                      <Input
                        id="report-custom-interval"
                        type="number"
                        min="1"
                        max="365"
                        step="1"
                        value={reportForm.custom_interval_days}
                        onChange={(event) => updateReportField('custom_interval_days', Number(event.target.value))}
                        disabled={!reportForm.email_enabled || reportPreferencesQuery.isLoading || saveReportPreferences.isPending}
                      />
                    </Field>
                  ) : (
                    <Field label="Monthly day" htmlFor="report-send-day">
                      <Input
                        id="report-send-day"
                        type="number"
                        min="1"
                        max="28"
                        step="1"
                        value={reportForm.send_day_of_month}
                        onChange={(event) => updateReportField('send_day_of_month', Number(event.target.value))}
                        disabled={reportForm.report_frequency !== 'monthly' || !reportForm.email_enabled || reportPreferencesQuery.isLoading || saveReportPreferences.isPending}
                      />
                    </Field>
                  )}
                </div>

                <Button type="submit" disabled={reportPreferencesQuery.isLoading || saveReportPreferences.isPending} className="w-full bg-[#F59E0B] hover:bg-[#D97706]">
                  {saveReportPreferences.isPending ? 'Saving...' : 'Save Mail Settings'}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>

        <Card className="surface-panel rounded-lg">
          <CardHeader>
            <CardTitle className="text-lg font-semibold">Profile information</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              <section className="space-y-4">
                <div>
                  <h2 className="text-sm font-bold uppercase text-[#6B7280]">Basic info</h2>
                </div>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <Field label="Full name" htmlFor="profile-name">
                    <Input id="profile-name" value={form.name} onChange={(event) => updateField('name', event.target.value)} required />
                  </Field>
                  <Field label="Email" htmlFor="profile-email">
                    <Input id="profile-email" value={profile.email} disabled />
                  </Field>
                  <Field label="Date of birth" htmlFor="profile-dob">
                    <Input id="profile-dob" type="date" value={form.date_of_birth} onChange={(event) => updateField('date_of_birth', event.target.value)} />
                  </Field>
                  <Field label="Occupation" htmlFor="profile-occupation">
                    <Input id="profile-occupation" value={form.occupation} onChange={(event) => updateField('occupation', event.target.value)} placeholder="Product manager, founder, student" />
                  </Field>
                  <Field label="City" htmlFor="profile-city">
                    <Input id="profile-city" value={form.city} onChange={(event) => updateField('city', event.target.value)} placeholder="Mumbai" />
                  </Field>
                  <Field label="Country" htmlFor="profile-country">
                    <Input id="profile-country" value={form.country} onChange={(event) => updateField('country', event.target.value)} placeholder="India" />
                  </Field>
                </div>
              </section>

              <section className="space-y-4">
                <div>
                  <h2 className="text-sm font-bold uppercase text-[#6B7280]">Financial info</h2>
                </div>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                  <Field label="Monthly income" htmlFor="profile-income">
                    <Input id="profile-income" type="number" min="0" step="0.01" value={form.monthly_income} onChange={(event) => updateField('monthly_income', event.target.value)} placeholder="150000" />
                  </Field>
                  <Field label="Monthly expense target" htmlFor="profile-expense-target">
                    <Input id="profile-expense-target" type="number" min="0" step="0.01" value={form.monthly_expense_target} onChange={(event) => updateField('monthly_expense_target', event.target.value)} placeholder="65000" />
                  </Field>
                  <Field label="Emergency fund target" htmlFor="profile-emergency-fund">
                    <Input id="profile-emergency-fund" type="number" min="0" step="0.01" value={form.emergency_fund_target} onChange={(event) => updateField('emergency_fund_target', event.target.value)} placeholder="600000" />
                  </Field>
                  <Field label="Dependents" htmlFor="profile-dependents">
                    <Input id="profile-dependents" type="number" min="0" step="1" value={form.financial_dependents} onChange={(event) => updateField('financial_dependents', event.target.value)} placeholder="0" />
                  </Field>
                  <Field label="Preferred currency" htmlFor="profile-currency">
                    <Input id="profile-currency" value={form.preferred_currency} maxLength={10} onChange={(event) => updateField('preferred_currency', event.target.value.toUpperCase())} />
                  </Field>
                  <Field label="Risk appetite" htmlFor="profile-risk">
                    <select
                      id="profile-risk"
                      value={form.risk_appetite}
                      onChange={(event) => updateField('risk_appetite', event.target.value as RiskAppetite | '')}
                      className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                    >
                      <option value="">Not set</option>
                      <option value="low">Low</option>
                      <option value="moderate">Moderate</option>
                      <option value="high">High</option>
                    </select>
                  </Field>
                </div>
                <Field label="Investment goal" htmlFor="profile-investment-goal">
                  <textarea
                    id="profile-investment-goal"
                    value={form.investment_goal}
                    onChange={(event) => updateField('investment_goal', event.target.value)}
                    rows={4}
                    placeholder="Build a retirement corpus, save for a home, create passive income..."
                    className="w-full rounded-lg border border-input bg-transparent px-3 py-2 text-sm outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                  />
                </Field>
              </section>

              <section className="rounded-lg border border-[#E5E7EB] bg-[#FAFBFC] p-4">
                <label className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    checked={form.ai_personalization_enabled}
                    onChange={(event) => updateField('ai_personalization_enabled', event.target.checked)}
                    className="mt-1 h-4 w-4 rounded border-[#E5E7EB]"
                  />
                  <span>
                    <span className="block text-sm font-semibold text-[#1F2937]">Use this profile for future AI personalization</span>
                    <span className="mt-1 block text-xs leading-5 text-[#6B7280]">
                      This prepares your profile for upcoming advisor and RAG features. You can turn it off any time.
                    </span>
                  </span>
                </label>
              </section>

              <div className="flex flex-col gap-3 border-t border-[#E5E7EB] pt-4 sm:flex-row sm:items-center sm:justify-end">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setForm(profileToForm(profile))}
                  disabled={saveProfile.isPending}
                  className="w-full sm:w-auto"
                >
                  Reset
                </Button>
                <Button type="submit" disabled={saveProfile.isPending} className="w-full bg-[#4F9CF9] hover:bg-[#3F8BE5] sm:w-auto">
                  {saveProfile.isPending ? 'Saving...' : 'Save Profile'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Field({ label, htmlFor, children }: { label: string; htmlFor: string; children: ReactNode }) {
  return (
    <div className="space-y-2">
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-[#E5E7EB] bg-white px-3 py-2">
      <span className="text-xs font-semibold uppercase text-[#6B7280]">{label}</span>
      <span className="min-w-0 truncate text-right text-sm font-semibold text-[#1F2937]">{value}</span>
    </div>
  );
}
