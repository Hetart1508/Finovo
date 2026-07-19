import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Linking,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { apiBaseUrl } from '@/api/client';
import { transactionsApi, type CreateTransactionPayload } from '@/api/transactions';
import { AppHeader } from '@/components/app-header';
import { StateCard } from '@/components/ui/state-card';
import { TransactionFormModal } from '@/features/transactions/transaction-form-modal';
import {
  filterTransactions,
  ITEMS_PER_PAGE,
  sortLabels,
  sortTransactions,
  type SortDirection,
  type SortKey,
  type TransactionFilter,
} from '@/features/transactions/transaction-view';
import { useWallet } from '@/features/wallets/wallet-provider';
import { colors, radii, shadows, spacing, typography } from '@/theme/tokens';
import type { Transaction, TransactionDraft } from '@/types/finance';
import { formatRupees } from '@/utils/formatters';

const columnWidths = {
  serial: 54,
  type: 62,
  date: 104,
  description: 210,
  category: 112,
  payment_mode: 108,
  amount: 128,
  addedBy: 130,
  actions: 132,
} as const;

const baseTableWidth = columnWidths.serial
  + columnWidths.type
  + columnWidths.date
  + columnWidths.description
  + columnWidths.category
  + columnWidths.payment_mode
  + columnWidths.amount
  + columnWidths.actions;

function getErrorMessage(caught: unknown, fallback: string) {
  const error = caught as { response?: { data?: { error?: string; message?: string } }; message?: string };
  return error.response?.data?.error || error.response?.data?.message || error.message || fallback;
}

function confirmAction(title: string, message: string, confirmLabel: string, destructive = false) {
  return new Promise<boolean>((resolve) => {
    Alert.alert(title, message, [
      { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
      { text: confirmLabel, style: destructive ? 'destructive' : 'default', onPress: () => resolve(true) },
    ], { cancelable: true, onDismiss: () => resolve(false) });
  });
}

export default function TransactionsScreen() {
  const queryClient = useQueryClient();
  const { selectedWallet, selectedWalletId } = useWallet();
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [filter, setFilter] = useState<TransactionFilter>('all');
  const [sortKey, setSortKey] = useState<SortKey | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [currentPage, setCurrentPage] = useState(1);
  const [formVisible, setFormVisible] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);

  const result = useQuery({
    queryKey: ['transactions', selectedWalletId],
    queryFn: () => transactionsApi.list(selectedWalletId),
    enabled: Boolean(selectedWalletId),
  });

  const refreshTransactions = () => queryClient.invalidateQueries({ queryKey: ['transactions'] });
  const createMutation = useMutation({ mutationFn: transactionsApi.create, onSuccess: refreshTransactions });
  const updateMutation = useMutation({
    mutationFn: ({ id, draft }: { id: number; draft: TransactionDraft }) => transactionsApi.update(id, draft),
    onSuccess: refreshTransactions,
  });
  const deleteMutation = useMutation({ mutationFn: transactionsApi.delete, onSuccess: refreshTransactions });
  const extractMutation = useMutation({ mutationFn: transactionsApi.extract });

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 500);
    return () => clearTimeout(timer);
  }, [search]);

  const filteredAndSorted = useMemo(
    () => sortTransactions(filterTransactions(result.data ?? [], debouncedSearch, filter), sortKey, sortDirection),
    [debouncedSearch, filter, result.data, sortDirection, sortKey],
  );
  const totalPages = Math.max(1, Math.ceil(filteredAndSorted.length / ITEMS_PER_PAGE));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const pageStartIndex = (safeCurrentPage - 1) * ITEMS_PER_PAGE;
  const visibleTransactions = filteredAndSorted.slice(pageStartIndex, pageStartIndex + ITEMS_PER_PAGE);
  const showCreatedBy = selectedWallet?.type === 'family';

  useEffect(() => setCurrentPage(1), [debouncedSearch, filter, selectedWalletId]);
  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(totalPages);
  }, [currentPage, totalPages]);

  const handleSort = (key: SortKey) => {
    setCurrentPage(1);
    if (sortKey !== key) {
      setSortKey(key);
      setSortDirection('asc');
    } else if (sortDirection === 'asc') {
      setSortDirection('desc');
    } else {
      setSortKey(null);
      setSortDirection('asc');
    }
  };

  const closeForm = () => {
    if (createMutation.isPending || updateMutation.isPending) return;
    setFormVisible(false);
    setEditingTransaction(null);
  };

  const handleSubmit = async (draft: TransactionDraft, sourceType: 'manual' | 'single_line') => {
    if (editingTransaction) {
      try {
        const response = await updateMutation.mutateAsync({ id: editingTransaction.id, draft });
        closeForm();
        Alert.alert('Transaction updated', response.message || 'Your changes were saved successfully.');
        return true;
      } catch (caught) {
        Alert.alert('Could not update transaction', getErrorMessage(caught, 'Please try again.'));
        return false;
      }
    }

    const payload: CreateTransactionPayload = {
      ...draft,
      wallet_id: selectedWalletId,
      idempotency_key: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      source_type: sourceType,
    };
    try {
      const response = await createMutation.mutateAsync(payload);
      closeForm();
      Alert.alert('Transaction added', response.message || 'The transaction was saved successfully.');
      return true;
    } catch (caught) {
      const duplicate = (caught as { response?: { data?: { requiresConfirmation?: boolean } } }).response?.data;
      if (duplicate?.requiresConfirmation) {
        const confirmed = await confirmAction(
          'Possible duplicate',
          'A matching transaction already exists. Add this as a separate transaction anyway?',
          'Add Anyway',
        );
        if (!confirmed) return false;
        try {
          const response = await createMutation.mutateAsync({ ...payload, allowPossibleDuplicate: true });
          closeForm();
          Alert.alert('Transaction added', response.message || 'The transaction was saved successfully.');
          return true;
        } catch (retryError) {
          Alert.alert('Could not add transaction', getErrorMessage(retryError, 'Please try again.'));
          return false;
        }
      }
      Alert.alert('Could not add transaction', getErrorMessage(caught, 'Please try again.'));
      return false;
    }
  };

  const handleExtract = async (description: string) => {
    try {
      return await extractMutation.mutateAsync(description);
    } catch (caught) {
      Alert.alert(
        'Could not extract details',
        getErrorMessage(caught, 'Add details like the amount, date, and payment mode, then try again.'),
      );
      return null;
    }
  };

  const handleDelete = async (transaction: Transaction) => {
    const confirmed = await confirmAction(
      'Delete transaction?',
      'This transaction will be permanently deleted. This action cannot be undone.',
      'Delete',
      true,
    );
    if (!confirmed) return;
    try {
      const response = await deleteMutation.mutateAsync(transaction.id);
      Alert.alert('Transaction deleted', response.message || 'The transaction was removed.');
    } catch (caught) {
      Alert.alert('Could not delete transaction', getErrorMessage(caught, 'Please try again.'));
    }
  };

  const handleViewBill = async (transaction: Transaction) => {
    if (!transaction.bill_url) return;
    const origin = apiBaseUrl.replace(/\/api$/, '');
    const url = /^https?:\/\//i.test(transaction.bill_url)
      ? transaction.bill_url
      : `${origin}${transaction.bill_url.startsWith('/') ? '' : '/'}${transaction.bill_url}`;
    try {
      await Linking.openURL(url);
    } catch {
      Alert.alert('Could not open bill', 'The bill link is invalid or unavailable.');
    }
  };

  return (
    <ScrollView
      contentContainerStyle={styles.screen}
      keyboardShouldPersistTaps="handled"
      refreshControl={<RefreshControl refreshing={result.isRefetching} onRefresh={result.refetch} tintColor={colors.primary} />}>
      <AppHeader eyebrow="Money activity" title="Transactions" />

      <View style={styles.toolbar}>
        <View style={styles.searchBox}>
          <Ionicons name="search-outline" size={19} color={colors.muted} />
          <TextInput
            accessibilityLabel="Search transactions"
            onChangeText={setSearch}
            placeholder="Search description, category, or mode..."
            placeholderTextColor={colors.muted}
            returnKeyType="search"
            style={styles.searchInput}
            value={search}
          />
          {search ? (
            <Pressable accessibilityLabel="Clear search" hitSlop={8} onPress={() => setSearch('')}>
              <Ionicons name="close-circle" size={19} color={colors.muted} />
            </Pressable>
          ) : null}
        </View>

        <View style={styles.toolbarActions}>
          <View style={styles.filterControl}>
            {(['all', 'expense', 'income'] as TransactionFilter[]).map((value) => (
              <Pressable
                accessibilityRole="button"
                key={value}
                onPress={() => setFilter(value)}
                style={[styles.filterButton, filter === value && styles.filterButtonActive]}>
                <Text style={[styles.filterText, filter === value && styles.filterTextActive]}>
                  {value === 'all' ? 'All' : value === 'expense' ? 'Expenses' : 'Income'}
                </Text>
              </Pressable>
            ))}
          </View>
          <Pressable
            accessibilityLabel="Add transaction"
            onPress={() => {
              setEditingTransaction(null);
              setFormVisible(true);
            }}
            style={({ pressed }) => [styles.addButton, pressed && styles.pressed]}>
            <Ionicons name="add-circle-outline" size={19} color={colors.surface} />
            <Text style={styles.addButtonText}>Add Transaction</Text>
          </Pressable>
        </View>
      </View>

      {result.isError ? (
        <StateCard title="Could not load transactions" message="Check the API connection and pull to retry." />
      ) : (
        <View style={styles.tableCard}>
          <ScrollView horizontal showsHorizontalScrollIndicator contentContainerStyle={styles.tableScroll}>
            <View style={{ width: baseTableWidth + (showCreatedBy ? columnWidths.addedBy : 0) }}>
              <View style={[styles.tableRow, styles.tableHeader]}>
                <TableHead label="SR No" width={columnWidths.serial} />
                <SortableHead column="type" direction={sortDirection} label="Type" sortKey={sortKey} width={columnWidths.type} onSort={handleSort} />
                <SortableHead column="date" direction={sortDirection} label="Date" sortKey={sortKey} width={columnWidths.date} onSort={handleSort} />
                <SortableHead column="description" direction={sortDirection} label="Description" sortKey={sortKey} width={columnWidths.description} onSort={handleSort} />
                <SortableHead column="category" direction={sortDirection} label="Category" sortKey={sortKey} width={columnWidths.category} onSort={handleSort} />
                <SortableHead column="payment_mode" direction={sortDirection} label="Mode" sortKey={sortKey} width={columnWidths.payment_mode} onSort={handleSort} />
                <SortableHead column="amount" direction={sortDirection} label="Amount" sortKey={sortKey} width={columnWidths.amount} onSort={handleSort} />
                {showCreatedBy ? <TableHead label="Added by" width={columnWidths.addedBy} /> : null}
                <TableHead label="Actions" width={columnWidths.actions} />
              </View>

              {result.isPending ? (
                <TableMessage message="Loading transactions..." />
              ) : filteredAndSorted.length === 0 ? (
                <TableMessage message="No transactions found." />
              ) : visibleTransactions.map((transaction, index) => (
                <TransactionRow
                  key={transaction.id}
                  serialNumber={pageStartIndex + index + 1}
                  showCreatedBy={showCreatedBy}
                  transaction={transaction}
                  onDelete={() => void handleDelete(transaction)}
                  onEdit={() => {
                    setEditingTransaction(transaction);
                    setFormVisible(true);
                  }}
                  onViewBill={() => void handleViewBill(transaction)}
                />
              ))}
            </View>
          </ScrollView>

          <Pagination
            currentPage={safeCurrentPage}
            pageStartIndex={pageStartIndex}
            totalPages={totalPages}
            totalTransactions={filteredAndSorted.length}
            onPageChange={setCurrentPage}
          />
        </View>
      )}

      <TransactionFormModal
        extracting={extractMutation.isPending}
        onClose={closeForm}
        onExtract={handleExtract}
        onSubmit={handleSubmit}
        saving={createMutation.isPending || updateMutation.isPending}
        transaction={editingTransaction}
        visible={formVisible}
        walletName={selectedWallet?.name || 'Wallet'}
      />
    </ScrollView>
  );
}

function TableHead({ label, width }: { label: string; width: number }) {
  return <View style={[styles.tableCell, styles.headerCell, { width }]}><Text style={styles.headerText}>{label}</Text></View>;
}

function SortableHead({
  column,
  direction,
  label,
  sortKey,
  width,
  onSort,
}: {
  column: SortKey;
  direction: SortDirection;
  label: string;
  sortKey: SortKey | null;
  width: number;
  onSort: (key: SortKey) => void;
}) {
  const active = sortKey === column;
  const nextDirection = !active ? 'ascending' : direction === 'asc' ? 'descending' : 'default order';
  return (
    <Pressable
      accessibilityLabel={`Sort ${sortLabels[column]} ${nextDirection}`}
      onPress={() => onSort(column)}
      style={[styles.tableCell, styles.headerCell, styles.sortableHead, { width }]}>
      <Text numberOfLines={1} style={styles.headerText}>{label}</Text>
      {active ? <Ionicons name={direction === 'asc' ? 'chevron-up' : 'chevron-down'} size={15} color={colors.primary} /> : null}
    </Pressable>
  );
}

function TransactionRow({
  transaction,
  serialNumber,
  showCreatedBy,
  onViewBill,
  onEdit,
  onDelete,
}: {
  transaction: Transaction;
  serialNumber: number;
  showCreatedBy: boolean;
  onViewBill: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const income = transaction.type === 'income';
  const description = transaction.merchant_name || transaction.description || '-';
  return (
    <View style={styles.tableRow}>
      <View style={[styles.tableCell, { width: columnWidths.serial }]}><Text style={styles.mutedCell}>{serialNumber}</Text></View>
      <View style={[styles.tableCell, { width: columnWidths.type }]}>
        <View style={[styles.typeIcon, income ? styles.incomeIcon : styles.expenseIcon]}>
          <Ionicons name={income ? 'arrow-up-outline' : 'arrow-down-outline'} size={17} color={income ? colors.success : colors.danger} />
        </View>
      </View>
      <View style={[styles.tableCell, { width: columnWidths.date }]}><Text style={styles.mutedCell}>{formatDate(transaction.date)}</Text></View>
      <View style={[styles.tableCell, styles.descriptionCell, { width: columnWidths.description }]}>
        <Text numberOfLines={1} style={styles.primaryCell}>{description}</Text>
        {transaction.payee_vpa ? <Text numberOfLines={1} style={styles.secondaryCell}>{transaction.payee_vpa}</Text> : null}
      </View>
      <View style={[styles.tableCell, { width: columnWidths.category }]}>
        <View style={styles.categoryBadge}><Text numberOfLines={1} style={styles.categoryText}>{transaction.category || 'Other'}</Text></View>
      </View>
      <View style={[styles.tableCell, { width: columnWidths.payment_mode }]}><Text numberOfLines={1} style={styles.mutedCell}>{transaction.payment_mode || '-'}</Text></View>
      <View style={[styles.tableCell, { width: columnWidths.amount }]}>
        <Text numberOfLines={1} style={[styles.amountCell, { color: income ? colors.success : colors.danger }]}>
          {income ? '+' : '-'}{formatRupees(transaction.amount)}
        </Text>
      </View>
      {showCreatedBy ? (
        <View style={[styles.tableCell, { width: columnWidths.addedBy }]}>
          <Text numberOfLines={1} style={styles.mutedCell}>{transaction.created_by_name || transaction.created_by_email || 'Member'}</Text>
        </View>
      ) : null}
      <View style={[styles.tableCell, styles.actionCell, { width: columnWidths.actions }]}>
        {transaction.bill_url ? <ActionButton icon="eye-outline" label="View bill" onPress={onViewBill} /> : <View style={styles.actionPlaceholder} />}
        <ActionButton icon="pencil-outline" label="Edit transaction" onPress={onEdit} />
        <ActionButton danger icon="trash-outline" label="Delete transaction" onPress={onDelete} />
      </View>
    </View>
  );
}

function ActionButton({ icon, label, danger = false, onPress }: { icon: keyof typeof Ionicons.glyphMap; label: string; danger?: boolean; onPress: () => void }) {
  return (
    <Pressable accessibilityLabel={label} hitSlop={4} onPress={onPress} style={({ pressed }) => [styles.rowAction, pressed && styles.pressed]}>
      <Ionicons name={icon} size={18} color={danger ? colors.danger : colors.muted} />
    </Pressable>
  );
}

function TableMessage({ message }: { message: string }) {
  return <View style={styles.tableMessage}><Text style={styles.tableMessageText}>{message}</Text></View>;
}

function Pagination({
  totalTransactions,
  pageStartIndex,
  currentPage,
  totalPages,
  onPageChange,
}: {
  totalTransactions: number;
  pageStartIndex: number;
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}) {
  const atStart = currentPage === 1 || totalTransactions === 0;
  const atEnd = currentPage === totalPages || totalTransactions === 0;
  return (
    <View style={styles.pagination}>
      <Text style={styles.paginationSummary}>
        {totalTransactions === 0
          ? 'Showing 0 transactions'
          : `Showing ${pageStartIndex + 1}-${Math.min(pageStartIndex + ITEMS_PER_PAGE, totalTransactions)} of ${totalTransactions}`}
      </Text>
      <View style={styles.paginationControls}>
        <PageButton disabled={atStart} icon="play-skip-back" label="First page" onPress={() => onPageChange(1)} />
        <PageButton disabled={atStart} icon="chevron-back" label="Previous page" onPress={() => onPageChange(Math.max(1, currentPage - 1))} />
        <Text style={styles.pageText}>Page {currentPage} / {totalPages}</Text>
        <PageButton disabled={atEnd} icon="chevron-forward" label="Next page" onPress={() => onPageChange(Math.min(totalPages, currentPage + 1))} />
        <PageButton disabled={atEnd} icon="play-skip-forward" label="Last page" onPress={() => onPageChange(totalPages)} />
      </View>
    </View>
  );
}

function PageButton({ disabled, icon, label, onPress }: { disabled: boolean; icon: keyof typeof Ionicons.glyphMap; label: string; onPress: () => void }) {
  return (
    <Pressable accessibilityLabel={label} disabled={disabled} onPress={onPress} style={[styles.pageButton, disabled && styles.disabledButton]}>
      <Ionicons name={icon} size={17} color={disabled ? '#B8C0CC' : colors.text} />
    </Pressable>
  );
}

function formatDate(value: string) {
  const [year, month, day] = value.split('-').map(Number);
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  if (!year || !month || !day || !months[month - 1]) return value;
  return `${String(day).padStart(2, '0')} ${months[month - 1]} ${year}`;
}

const styles = StyleSheet.create({
  screen: { padding: spacing.md, paddingBottom: spacing.xxl, gap: spacing.md },
  toolbar: { gap: spacing.sm },
  searchBox: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, borderWidth: 1, borderColor: colors.border, borderRadius: radii.sm, backgroundColor: colors.surface, paddingHorizontal: 13 },
  searchInput: { flex: 1, minHeight: 46, ...typography.body, color: colors.text },
  toolbarActions: { gap: spacing.sm },
  filterControl: { minHeight: 44, flexDirection: 'row', padding: 4, gap: 4, borderRadius: radii.sm, backgroundColor: '#EEF1F5' },
  filterButton: { flex: 1, alignItems: 'center', justifyContent: 'center', borderRadius: 6, paddingHorizontal: spacing.xs },
  filterButtonActive: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  filterText: { ...typography.caption, color: colors.muted },
  filterTextActive: { color: colors.primary, fontWeight: '700' },
  addButton: { minHeight: 46, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, borderRadius: radii.sm, backgroundColor: colors.primary },
  addButtonText: { ...typography.label, color: colors.surface },
  pressed: { opacity: 0.62 },
  tableCard: { borderWidth: 1, borderColor: colors.border, borderRadius: radii.sm, overflow: 'hidden', backgroundColor: colors.surface, ...shadows.card },
  tableScroll: { minWidth: '100%' },
  tableRow: { minHeight: 66, flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: colors.border, backgroundColor: colors.surface },
  tableHeader: { minHeight: 48, backgroundColor: '#F3F6FA' },
  tableCell: { paddingHorizontal: spacing.xs, alignItems: 'center', justifyContent: 'center' },
  headerCell: { borderRightWidth: StyleSheet.hairlineWidth, borderRightColor: '#D9DEE7' },
  sortableHead: { flexDirection: 'row', gap: 2 },
  headerText: { fontSize: 11, lineHeight: 15, fontWeight: '800', color: '#4B5563' },
  mutedCell: { ...typography.caption, color: colors.muted, textAlign: 'center' },
  primaryCell: { ...typography.caption, color: colors.text, fontWeight: '700', alignSelf: 'stretch' },
  secondaryCell: { fontSize: 10, lineHeight: 14, color: colors.muted, alignSelf: 'stretch' },
  descriptionCell: { alignItems: 'flex-start' },
  typeIcon: { width: 30, height: 30, alignItems: 'center', justifyContent: 'center', borderRadius: radii.pill },
  incomeIcon: { backgroundColor: colors.successSoft },
  expenseIcon: { backgroundColor: colors.dangerSoft },
  categoryBadge: { maxWidth: '100%', borderRadius: radii.sm, backgroundColor: '#EEF1F5', paddingHorizontal: 8, paddingVertical: 5 },
  categoryText: { fontSize: 11, lineHeight: 15, color: colors.text },
  amountCell: { ...typography.caption, fontWeight: '800', textAlign: 'center' },
  actionCell: { flexDirection: 'row', justifyContent: 'flex-end', gap: 2 },
  rowAction: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center', borderRadius: radii.sm },
  actionPlaceholder: { width: 36, height: 36 },
  tableMessage: { minHeight: 150, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface },
  tableMessageText: { ...typography.body, color: colors.muted },
  pagination: { padding: spacing.sm, gap: spacing.sm, backgroundColor: '#FBFCFE' },
  paginationSummary: { ...typography.caption, color: colors.muted, textAlign: 'center' },
  paginationControls: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.xs },
  pageButton: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.border, borderRadius: radii.sm, backgroundColor: colors.surface },
  disabledButton: { backgroundColor: '#F3F5F7' },
  pageText: { minWidth: 78, ...typography.caption, color: colors.text, textAlign: 'center' },
});
