import type { FormEvent } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { parseISO } from 'date-fns';
import { toast } from 'react-toastify';
import { recurringApi } from '@/src/api/recurringApi';
import { invalidateRecurring } from '@/src/server-state/invalidations';
import { getApiMessage, getApiSuccessMessage } from '@/src/lib/toastMessages';
import type { RecurringEvent } from '../recurring.types';

type UseRecurringMutationsArgs = {
  editingEvent: RecurringEvent | null;
  dueDate: string;
  onSaved: () => void;
};

export function useRecurringMutations({ editingEvent, dueDate, onSaved }: UseRecurringMutationsArgs) {
  const queryClient = useQueryClient();
  const saveRecurring = useMutation({
    mutationFn: ({ id, payload }: { id?: number; payload: Record<string, unknown> }) =>
      recurringApi.save(id, payload),
    onSuccess: () => invalidateRecurring(queryClient),
  });
  const deleteRecurring = useMutation({
    mutationFn: (id: number) => recurringApi.delete(id),
    onSuccess: () => invalidateRecurring(queryClient),
  });

  const handleSave = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    if (!dueDate) {
      toast.error('Please select a due date.');
      return;
    }
    const parsedDueDate = parseISO(dueDate);

    const payload = {
      name: String(formData.get('name') || '').trim(),
      amount: Number(formData.get('amount')),
      day_of_month: parsedDueDate.getDate(),
      category: String(formData.get('category') || 'Other'),
      type: String(formData.get('type') || 'expense'),
      frequency: String(formData.get('frequency') || 'monthly'),
      interval_count: Number(formData.get('interval_count') || 1),
      start_date: dueDate,
      payment_mode: String(formData.get('payment_mode') || 'manual'),
      autopay_enabled: formData.get('payment_mode') === 'auto',
      payment_account: String(formData.get('payment_account') || '').trim() || null,
    };

    try {
      const response = await saveRecurring.mutateAsync({ id: editingEvent?.id, payload });
      const message = editingEvent ? 'Recurring payment updated.' : 'Recurring payment added.';
      toast.success(getApiSuccessMessage(response.data, message));
      onSaved();
    } catch (error: unknown) {
      toast.error(getApiMessage(error, 'Failed to save recurring payment.'));
    }
  };

  const handleDelete = async (id: number) => {
    try {
      const response = await deleteRecurring.mutateAsync(id);
      toast.success(getApiSuccessMessage(response.data, 'Recurring payment deleted.'));
    } catch (error: unknown) {
      toast.error(getApiMessage(error, 'Failed to delete recurring payment.'));
    }
  };

  return {
    handleSave,
    handleDelete,
  };
}
