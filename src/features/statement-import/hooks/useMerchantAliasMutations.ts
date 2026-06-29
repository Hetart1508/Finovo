import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-toastify';
import { merchantAliasesApi } from '@/src/api/merchantAliasesApi';
import { invalidateMerchantAliases, invalidateTransactions } from '@/src/server-state/invalidations';
import { getApiMessage } from '@/src/lib/toastMessages';

export function useMerchantAliasMutations() {
  const queryClient = useQueryClient();
  const [aliasEdits, setAliasEdits] = useState<Record<number, string>>({});

  const deleteAlias = useMutation({
    mutationFn: (id: number) => merchantAliasesApi.delete(id),
    onSuccess: () => invalidateMerchantAliases(queryClient),
  });
  const updateAlias = useMutation({
    mutationFn: ({ id, company_name }: { id: number; company_name: string }) => merchantAliasesApi.update(id, company_name),
    onSuccess: (_response, variables) => {
      setAliasEdits((current) => {
        const next = { ...current };
        delete next[variables.id];
        return next;
      });
      invalidateMerchantAliases(queryClient);
      invalidateTransactions(queryClient);
      toast.success('Merchant name updated.');
    },
    onError: (error) => toast.error(getApiMessage(error, 'Failed to update merchant name.')),
  });

  return {
    aliasEdits,
    setAliasEdits,
    deleteAlias,
    updateAlias,
  };
}
