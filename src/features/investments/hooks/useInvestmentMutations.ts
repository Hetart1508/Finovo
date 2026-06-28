import type { FormEvent } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-toastify';
import { investmentsApi } from '@/src/api/investmentsApi';
import { invalidateInvestments } from '@/src/server-state/invalidations';
import { getApiMessage, getApiSuccessMessage } from '@/src/lib/toastMessages';
import type { Investment } from '../investments.types';

type UseInvestmentMutationsArgs = {
  editingInvestment: Investment | null;
  formTotalInvested: number;
  formCurrentValue: number;
  onSaved: () => void;
};

export function useInvestmentMutations({
  editingInvestment,
  formTotalInvested,
  formCurrentValue,
  onSaved,
}: UseInvestmentMutationsArgs) {
  const queryClient = useQueryClient();
  const refreshInvestments = () => invalidateInvestments(queryClient);

  const saveInvestment = useMutation({
    mutationFn: ({ id, payload }: { id?: number; payload: Record<string, unknown> }) =>
      investmentsApi.save(id, payload),
    onSuccess: refreshInvestments,
  });

  const deleteInvestment = useMutation({
    mutationFn: (id: number) => investmentsApi.delete(id),
    onSuccess: refreshInvestments,
  });

  const handleSave = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(event.currentTarget).entries());
    const startDate = String(data.start_date || '');
    const endDate = String(data.end_date || '');

    if (endDate < startDate) {
      toast.error('End date must be on or after start date.');
      return;
    }

    const investmentType = data.investment_type === 'lumpsum' ? 'lumpsum' : 'sip';
    const amount = Number(data.monthly_sip_amount);
    const payload = {
      investment_type: investmentType,
      sip_name: String(data.sip_name || '').trim(),
      fund_name: String(data.fund_name || '').trim(),
      monthly_sip_amount: amount,
      total_invested_amount: investmentType === 'lumpsum' ? amount : formTotalInvested,
      current_value: formCurrentValue,
      expected_cagr: Number(data.expected_cagr),
      start_date: startDate,
      end_date: endDate,
      notes: String(data.notes || '').trim(),
    };

    try {
      const response = await saveInvestment.mutateAsync({ id: editingInvestment?.id, payload });
      toast.success(getApiSuccessMessage(
        response.data,
        editingInvestment ? 'Investment updated successfully.' : 'Investment added successfully.'
      ));
      onSaved();
    } catch (error: any) {
      toast.error(getApiMessage(error, 'Failed to save investment.'));
    }
  };

  const handleDelete = async (investment: Investment) => {
    if (!window.confirm(`Delete “${investment.sip_name}”? This action cannot be undone.`)) return;

    try {
      const response = await deleteInvestment.mutateAsync(investment.id);
      toast.success(getApiSuccessMessage(response.data, 'Investment deleted successfully.'));
    } catch (error: any) {
      toast.error(getApiMessage(error, 'Failed to delete investment.'));
    }
  };

  return {
    isSaving: saveInvestment.isPending,
    isDeleting: deleteInvestment.isPending,
    handleSave,
    handleDelete,
  };
}
