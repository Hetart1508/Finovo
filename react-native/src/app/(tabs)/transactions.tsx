import { useQuery } from '@tanstack/react-query';
import { FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native';

import { transactionsApi } from '@/api/transactions';
import { AppHeader } from '@/components/app-header';
import { StateCard } from '@/components/ui/state-card';
import { useWallet } from '@/features/wallets/wallet-provider';
import { colors, radii, spacing, typography } from '@/theme/tokens';
import type { Transaction } from '@/types/finance';
import { formatRupees } from '@/utils/formatters';

function TransactionRow({ item }: { item: Transaction }) {
  const income = item.type === 'income';
  return (
    <View style={styles.row}>
      <View style={[styles.indicator, { backgroundColor: income ? colors.successSoft : colors.dangerSoft }]}>
        <Text style={{ color: income ? colors.success : colors.danger }}>{income ? '+' : '−'}</Text>
      </View>
      <View style={styles.rowContent}>
        <Text numberOfLines={1} style={styles.description}>{item.merchant_name || item.description || item.category || 'Transaction'}</Text>
        <Text style={styles.meta}>{item.category || 'Other'} · {item.date}</Text>
      </View>
      <Text style={[styles.amount, { color: income ? colors.success : colors.text }]}>
        {income ? '+' : '−'}{formatRupees(item.amount)}
      </Text>
    </View>
  );
}

export default function TransactionsScreen() {
  const { selectedWalletId } = useWallet();
  const result = useQuery({
    queryKey: ['transactions', selectedWalletId],
    queryFn: () => transactionsApi.list(selectedWalletId),
    enabled: Boolean(selectedWalletId),
  });

  return (
    <FlatList
      contentContainerStyle={styles.list}
      data={result.data ?? []}
      keyExtractor={(item) => String(item.id)}
      ListHeaderComponent={<AppHeader eyebrow="Money activity" title="Transactions" />}
      ListEmptyComponent={
        <StateCard
          title={result.isPending ? 'Loading transactions...' : result.isError ? 'Could not load transactions' : 'No transactions yet'}
          message={result.isError ? 'Check the API connection and pull to retry.' : 'Transactions for the selected wallet will appear here.'}
        />
      }
      refreshControl={<RefreshControl refreshing={result.isRefetching} onRefresh={result.refetch} tintColor={colors.primary} />}
      renderItem={({ item }) => <TransactionRow item={item} />}
    />
  );
}

const styles = StyleSheet.create({
  list: { padding: spacing.md, paddingBottom: spacing.xxl, gap: spacing.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: colors.surface, borderRadius: radii.md, padding: spacing.md, borderWidth: 1, borderColor: colors.border },
  indicator: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  rowContent: { flex: 1, gap: 3 },
  description: { ...typography.label, color: colors.text },
  meta: { ...typography.caption, color: colors.muted },
  amount: { ...typography.label },
});
