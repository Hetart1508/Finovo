import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';

import { transactionsApi } from '@/api/transactions';
import { AppHeader } from '@/components/app-header';
import { MetricCard } from '@/components/metric-card';
import { StateCard } from '@/components/ui/state-card';
import { useWallet } from '@/features/wallets/wallet-provider';
import { colors, spacing, typography } from '@/theme/tokens';
import { formatRupees } from '@/utils/formatters';

export default function DashboardScreen() {
  const { selectedWalletId } = useWallet();
  const result = useQuery({
    queryKey: ['transactions', selectedWalletId],
    queryFn: () => transactionsApi.list(selectedWalletId),
    enabled: Boolean(selectedWalletId),
  });
  const transactions = result.data ?? [];
  const totals = useMemo(() => transactions.reduce(
    (sum, item) => ({
      income: sum.income + (item.type === 'income' ? Number(item.amount) : 0),
      expense: sum.expense + (item.type === 'expense' ? Number(item.amount) : 0),
    }),
    { income: 0, expense: 0 },
  ), [transactions]);

  return (
    <ScrollView
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={result.isRefetching} onRefresh={result.refetch} tintColor={colors.primary} />}>
      <AppHeader eyebrow="Workspace" title="Dashboard" />

      <View style={styles.hero}>
        <Text style={styles.heroEyebrow}>FINANCIAL OVERVIEW</Text>
        <Text style={styles.heroTitle}>Your money, clearly understood.</Text>
        <Text style={styles.heroBody}>Live data from the same Finovo backend used by the website.</Text>
      </View>

      {result.isError ? (
        <StateCard title="Could not load dashboard" message="Check EXPO_PUBLIC_API_URL and your session, then pull to retry." />
      ) : (
        <View style={styles.metrics}>
          <MetricCard label="Income" value={formatRupees(totals.income)} tone="positive" />
          <MetricCard label="Expense" value={formatRupees(totals.expense)} tone="negative" />
          <MetricCard label="Balance" value={formatRupees(totals.income - totals.expense)} tone="primary" />
          <MetricCard label="Transactions" value={String(transactions.length)} tone="neutral" />
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.md, paddingBottom: spacing.xxl, gap: spacing.lg },
  hero: { backgroundColor: colors.primary, borderRadius: 18, padding: spacing.lg, gap: spacing.sm },
  heroEyebrow: { ...typography.caption, color: '#DCEEFF', fontWeight: '800', letterSpacing: 0.8 },
  heroTitle: { ...typography.display, color: colors.surface },
  heroBody: { ...typography.body, color: '#EAF4FF' },
  metrics: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
});
