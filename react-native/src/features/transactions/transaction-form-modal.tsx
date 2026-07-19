import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  paymentModes,
  todayDateString,
  transactionCategories,
} from '@/features/transactions/transaction-view';
import { colors, radii, spacing, typography } from '@/theme/tokens';
import type { Transaction, TransactionDraft, TransactionType } from '@/types/finance';

type AddMode = 'ai' | 'manual';
type SourceType = 'manual' | 'single_line';

type TransactionFormModalProps = {
  visible: boolean;
  transaction: Transaction | null;
  walletName: string;
  saving: boolean;
  extracting: boolean;
  onClose: () => void;
  onExtract: (description: string) => Promise<Partial<TransactionDraft> | null>;
  onSubmit: (draft: TransactionDraft, sourceType: SourceType) => Promise<boolean>;
};

const emptyDraft = (): TransactionDraft => ({
  type: 'expense',
  amount: 0,
  category: 'Other',
  date: todayDateString(),
  payment_mode: 'UPI',
  description: '',
  bill_url: '',
});

export function TransactionFormModal({
  visible,
  transaction,
  walletName,
  saving,
  extracting,
  onClose,
  onExtract,
  onSubmit,
}: TransactionFormModalProps) {
  const editing = Boolean(transaction);
  const [addMode, setAddMode] = useState<AddMode>('ai');
  const [aiDescription, setAiDescription] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [sourceType, setSourceType] = useState<SourceType>('manual');
  const [type, setType] = useState<TransactionType>('expense');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('Other');
  const [date, setDate] = useState(todayDateString());
  const [paymentMode, setPaymentMode] = useState('UPI');
  const [description, setDescription] = useState('');
  const [billUrl, setBillUrl] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!visible) return;
    const draft = transaction ? {
      ...emptyDraft(),
      ...transaction,
      amount: Number(transaction.amount),
      description: transaction.description || transaction.merchant_name || '',
      bill_url: transaction.bill_url || '',
    } : emptyDraft();
    setAddMode('ai');
    setAiDescription('');
    setShowForm(Boolean(transaction));
    setSourceType('manual');
    setType(draft.type);
    setAmount(transaction ? String(draft.amount) : '');
    setCategory(draft.category || (draft.type === 'income' ? 'Salary' : 'Other'));
    setDate(draft.date);
    setPaymentMode(draft.payment_mode || 'UPI');
    setDescription(draft.description || '');
    setBillUrl(draft.bill_url || '');
    setError('');
  }, [transaction, visible]);

  const selectType = (nextType: TransactionType) => {
    setType(nextType);
    if (nextType === 'income') setCategory('Salary');
  };

  const selectManualMode = () => {
    setAddMode('manual');
    setShowForm(true);
    setSourceType('manual');
    setError('');
  };

  const extract = async () => {
    if (aiDescription.trim().length < 6) return;
    setError('');
    const extracted = await onExtract(aiDescription.trim());
    if (!extracted) return;

    const nextType = extracted.type || 'expense';
    setType(nextType);
    setAmount(extracted.amount ? String(extracted.amount) : '');
    setCategory(nextType === 'income' ? 'Salary' : extracted.category || 'Other');
    setDate(extracted.date || todayDateString());
    setPaymentMode(extracted.payment_mode || 'UPI');
    setDescription(aiDescription.trim());
    setShowForm(true);
    setSourceType('single_line');
  };

  const submit = async () => {
    const numericAmount = Number(amount);
    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
      setError('Enter an amount greater than zero.');
      return;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(new Date(`${date}T00:00:00`).getTime())) {
      setError('Enter the date as YYYY-MM-DD.');
      return;
    }
    if (date > todayDateString()) {
      setError('Transaction date cannot be in the future.');
      return;
    }
    if (!category) {
      setError('Select a category.');
      return;
    }

    setError('');
    await onSubmit({
      type,
      amount: numericAmount,
      category,
      date,
      payment_mode: paymentMode,
      description: description.trim(),
      ...(editing ? { bill_url: billUrl.trim() } : {}),
    }, sourceType);
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={saving ? undefined : onClose}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.keyboardView}>
          <View style={styles.modalHeader}>
            <View style={styles.modalTitleGroup}>
              <Text style={styles.modalTitle}>{editing ? 'Edit Transaction' : 'Add New Transaction'}</Text>
              <Text numberOfLines={1} style={styles.modalSubtitle}>Saving to {walletName}</Text>
            </View>
            <Pressable
              accessibilityLabel="Close transaction form"
              disabled={saving}
              hitSlop={8}
              onPress={onClose}
              style={styles.iconButton}>
              <Ionicons name="close" size={22} color={colors.text} />
            </Pressable>
          </View>

          <ScrollView
            contentContainerStyle={styles.formContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}>
            {!editing ? (
              <View style={styles.segmentedControl}>
                <SegmentButton
                  active={addMode === 'ai'}
                  icon="sparkles-outline"
                  label="AI Add"
                  onPress={() => {
                    setAddMode('ai');
                    setShowForm(sourceType === 'single_line');
                  }}
                />
                <SegmentButton active={addMode === 'manual'} icon="add-circle-outline" label="Manual" onPress={selectManualMode} />
              </View>
            ) : null}

            {!editing && addMode === 'ai' ? (
              <View style={styles.section}>
                <FieldLabel label="Describe Transaction" />
                <TextInput
                  multiline
                  maxLength={1000}
                  onChangeText={setAiDescription}
                  placeholder="Paid 450 for lunch today using UPI"
                  placeholderTextColor={colors.muted}
                  style={[styles.input, styles.textArea]}
                  textAlignVertical="top"
                  value={aiDescription}
                />
                <Pressable
                  disabled={extracting || aiDescription.trim().length < 6}
                  onPress={extract}
                  style={({ pressed }) => [styles.secondaryButton, (pressed || extracting) && styles.buttonPressed]}>
                  {extracting
                    ? <ActivityIndicator color={colors.primary} size="small" />
                    : <Ionicons name="refresh-outline" size={18} color={colors.primary} />}
                  <Text style={styles.secondaryButtonText}>{extracting ? 'Extracting...' : 'Extract Details'}</Text>
                </Pressable>
                {sourceType === 'single_line' && showForm ? (
                  <View style={styles.infoBox}>
                    <Ionicons name="checkmark-circle-outline" size={18} color={colors.primary} />
                    <Text style={styles.infoText}>Review the extracted details before saving.</Text>
                  </View>
                ) : null}
              </View>
            ) : null}

            {showForm ? (
              <View style={styles.section}>
                <FieldLabel label="Type" />
                <View style={styles.segmentedControl}>
                  <SegmentButton active={type === 'expense'} icon="arrow-down-outline" label="Expense" onPress={() => selectType('expense')} />
                  <SegmentButton active={type === 'income'} icon="arrow-up-outline" label="Income" onPress={() => selectType('income')} />
                </View>

                <FieldLabel label="Amount (INR)" />
                <TextInput
                  keyboardType="decimal-pad"
                  onChangeText={setAmount}
                  placeholder="0.00"
                  placeholderTextColor={colors.muted}
                  style={styles.input}
                  value={amount}
                />

                <ChoiceField label="Category" options={[...transactionCategories]} value={category} onChange={setCategory} />

                <FieldLabel label="Date" />
                <View style={styles.inputWithIcon}>
                  <Ionicons name="calendar-outline" size={18} color={colors.muted} />
                  <TextInput
                    autoCapitalize="none"
                    maxLength={10}
                    onChangeText={setDate}
                    placeholder="YYYY-MM-DD"
                    placeholderTextColor={colors.muted}
                    style={styles.iconInput}
                    value={date}
                  />
                </View>

                <ChoiceField label="Payment Mode" options={[...paymentModes]} value={paymentMode} onChange={setPaymentMode} />

                <FieldLabel label="Description" />
                <TextInput
                  maxLength={1000}
                  onChangeText={setDescription}
                  placeholder="Lunch at Starbucks"
                  placeholderTextColor={colors.muted}
                  style={styles.input}
                  value={description}
                />

                {editing ? (
                  <>
                    <FieldLabel label="Bill URL" />
                    <TextInput
                      autoCapitalize="none"
                      keyboardType="url"
                      onChangeText={setBillUrl}
                      placeholder="https://..."
                      placeholderTextColor={colors.muted}
                      style={styles.input}
                      value={billUrl}
                    />
                  </>
                ) : null}

                {error ? (
                  <View style={styles.errorBox}>
                    <Ionicons name="alert-circle-outline" size={18} color={colors.danger} />
                    <Text style={styles.errorText}>{error}</Text>
                  </View>
                ) : null}

                <Pressable
                  disabled={saving}
                  onPress={submit}
                  style={({ pressed }) => [styles.primaryButton, (pressed || saving) && styles.buttonPressed]}>
                  {saving
                    ? <ActivityIndicator color={colors.surface} size="small" />
                    : <Ionicons name={editing ? 'save-outline' : 'add-circle-outline'} size={19} color={colors.surface} />}
                  <Text style={styles.primaryButtonText}>{saving ? 'Saving...' : editing ? 'Save Changes' : 'Save Transaction'}</Text>
                </Pressable>
              </View>
            ) : null}
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}

function FieldLabel({ label }: { label: string }) {
  return <Text style={styles.fieldLabel}>{label}</Text>;
}

function SegmentButton({
  active,
  icon,
  label,
  onPress,
}: {
  active: boolean;
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={[styles.segment, active && styles.segmentActive]}>
      <Ionicons name={icon} size={18} color={active ? colors.surface : colors.muted} />
      <Text style={[styles.segmentText, active && styles.segmentTextActive]}>{label}</Text>
    </Pressable>
  );
}

function ChoiceField({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: string[];
  value: string;
  onChange: (value: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  return (
    <View style={styles.choiceField}>
      <FieldLabel label={label} />
      <Pressable accessibilityRole="button" onPress={() => setExpanded((current) => !current)} style={styles.choiceTrigger}>
        <Text style={styles.choiceValue}>{value}</Text>
        <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={18} color={colors.muted} />
      </Pressable>
      {expanded ? (
        <View style={styles.choiceOptions}>
          {options.map((option) => {
            const selected = option === value;
            return (
              <Pressable
                key={option}
                onPress={() => {
                  onChange(option);
                  setExpanded(false);
                }}
                style={[styles.choiceOption, selected && styles.choiceOptionSelected]}>
                <Text style={[styles.choiceOptionText, selected && styles.choiceOptionTextSelected]}>{option}</Text>
                {selected ? <Ionicons name="checkmark" size={18} color={colors.primary} /> : null}
              </Pressable>
            );
          })}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  keyboardView: { flex: 1 },
  modalHeader: { minHeight: 68, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border, backgroundColor: colors.surface, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md },
  modalTitleGroup: { flex: 1 },
  modalTitle: { ...typography.heading, color: colors.text },
  modalSubtitle: { ...typography.caption, color: colors.muted },
  iconButton: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center', borderRadius: radii.sm, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  formContent: { padding: spacing.md, paddingBottom: spacing.xxl, gap: spacing.md },
  section: { gap: spacing.sm },
  segmentedControl: { flexDirection: 'row', backgroundColor: '#EEF1F5', padding: 4, borderRadius: radii.sm, gap: 4 },
  segment: { minHeight: 42, flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.xs, borderRadius: 6 },
  segmentActive: { backgroundColor: colors.primary },
  segmentText: { ...typography.label, color: colors.muted },
  segmentTextActive: { color: colors.surface },
  fieldLabel: { ...typography.label, color: colors.text, marginTop: spacing.xs },
  input: { minHeight: 48, borderWidth: 1, borderColor: colors.border, borderRadius: radii.sm, backgroundColor: colors.surface, paddingHorizontal: 13, paddingVertical: 10, ...typography.body, color: colors.text },
  textArea: { minHeight: 88 },
  inputWithIcon: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, borderWidth: 1, borderColor: colors.border, borderRadius: radii.sm, backgroundColor: colors.surface, paddingHorizontal: 13 },
  iconInput: { flex: 1, minHeight: 46, ...typography.body, color: colors.text },
  secondaryButton: { minHeight: 46, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, borderWidth: 1, borderColor: colors.primary, borderRadius: radii.sm, backgroundColor: colors.surface },
  secondaryButtonText: { ...typography.label, color: colors.primary },
  primaryButton: { minHeight: 50, marginTop: spacing.sm, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, borderRadius: radii.sm, backgroundColor: colors.primary },
  primaryButtonText: { ...typography.label, color: colors.surface },
  buttonPressed: { opacity: 0.65 },
  infoBox: { minHeight: 42, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.sm, borderWidth: 1, borderColor: '#D8EAFE', borderRadius: radii.sm, backgroundColor: colors.primarySoft },
  infoText: { ...typography.caption, color: '#2878D0', flex: 1 },
  errorBox: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.sm, borderRadius: radii.sm, backgroundColor: colors.dangerSoft },
  errorText: { ...typography.caption, color: colors.danger, flex: 1 },
  choiceField: { gap: spacing.xs },
  choiceTrigger: { minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 1, borderColor: colors.border, borderRadius: radii.sm, backgroundColor: colors.surface, paddingHorizontal: 13 },
  choiceValue: { ...typography.body, color: colors.text },
  choiceOptions: { borderWidth: 1, borderColor: colors.border, borderRadius: radii.sm, overflow: 'hidden', backgroundColor: colors.surface },
  choiceOption: { minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 13, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  choiceOptionSelected: { backgroundColor: colors.primarySoft },
  choiceOptionText: { ...typography.body, color: colors.text },
  choiceOptionTextSelected: { color: colors.primary, fontWeight: '700' },
});
