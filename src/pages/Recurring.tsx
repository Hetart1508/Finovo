import React, { useEffect, useMemo, useState } from 'react';
import { Button } from '@/src/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/src/components/ui/dialog';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { recurringApi } from '@/src/api/recurringApi';
import { recurringQuery, upcomingRecurringQuery } from '@/src/server-state/recurringQueries';
import { invalidateRecurring } from '@/src/server-state/invalidations';
import { getApiMessage, getApiSuccessMessage } from '@/src/lib/toastMessages';
import { format, parseISO } from 'date-fns';
import { toast } from 'react-toastify';
import {
  RiAddCircleLine,
} from 'react-icons/ri';
import { RecurringForm } from '@/src/features/recurring/components/RecurringForm';
import { RecurringMetricCards } from '@/src/features/recurring/components/RecurringMetricCards';
import { RecurringPaymentsTable } from '@/src/features/recurring/components/RecurringPaymentsTable';
import { YearlyDueScheduleCard } from '@/src/features/recurring/components/YearlyDueScheduleCard';
import type { RecurringEvent } from '@/src/features/recurring/recurring.types';
import { getDateStringFromEvent } from '@/src/features/recurring/recurring.utils';

export default function Recurring() {
  const queryClient = useQueryClient();
  const eventsResult = useQuery(recurringQuery());
  const upcomingResult = useQuery(upcomingRecurringQuery());
  const events = (eventsResult.data ?? []) as RecurringEvent[];
  const upcomingEvents = (upcomingResult.data ?? []) as RecurringEvent[];
  const loading = eventsResult.isPending || upcomingResult.isPending;
  const saveRecurring = useMutation({
    mutationFn: ({ id, payload }: { id?: number; payload: Record<string, unknown> }) =>
      recurringApi.save(id, payload),
    onSuccess: () => invalidateRecurring(queryClient),
  });
  const deleteRecurring = useMutation({
    mutationFn: (id: number) => recurringApi.delete(id),
    onSuccess: () => invalidateRecurring(queryClient),
  });
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<RecurringEvent | null>(null);
  const todayDateString = format(new Date(), 'yyyy-MM-dd');
  const [dueDate, setDueDate] = useState(todayDateString);

  const monthlyCashOutflow = useMemo(
    () => events
      .filter((event) => event.type !== 'income')
      .reduce((sum, event) => {
        const interval = Number(event.interval_count) || 1;
        const monthlyEquivalent = event.frequency === 'yearly'
          ? Number(event.amount) / (interval * 12)
          : Number(event.amount) / interval;
        return sum + monthlyEquivalent;
      }, 0),
    [events]
  );

  const autoPaymentCount = useMemo(
    () => events.filter((event) => event.payment_mode === 'auto' || Boolean(event.autopay_enabled)).length,
    [events]
  );

  const nextDueEvent = upcomingEvents[0];

  useEffect(() => {
    const error = eventsResult.error || upcomingResult.error;
    if (error) toast.error(getApiMessage(error, 'Failed to load recurring payments.'), { toastId: 'recurring-query-error' });
  }, [eventsResult.error, upcomingResult.error]);

  const closeDialog = () => {
    setDialogOpen(false);
    setEditingEvent(null);
    setDueDate(todayDateString);
  };

  const handleSave = async (event: React.FormEvent<HTMLFormElement>) => {
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

      toast.success(getApiSuccessMessage(response.data, editingEvent ? 'Recurring payment updated.' : 'Recurring payment added.'));
      closeDialog();
    } catch (error: any) {
      toast.error(getApiMessage(error, 'Failed to save recurring payment.'));
    }
  };

  const handleDelete = async (id: number) => {
    try {
      const response = await deleteRecurring.mutateAsync(id);
      toast.success(getApiSuccessMessage(response.data, 'Recurring payment deleted.'));
    } catch (error: any) {
      toast.error(getApiMessage(error, 'Failed to delete recurring payment.'));
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div>
          <p className="text-sm font-semibold uppercase text-[#4F9CF9]">Recurring planner</p>
          <h1 className="mt-2 text-3xl font-black text-[#1F2937]">Subscriptions and future payments</h1>
          <p className="mt-2 max-w-2xl text-sm text-[#6B7280] dark:text-[#CBD5E1]">
            Track monthly subscriptions, EMIs, rent, and fees so upcoming payments are visible before they arrive.
          </p>
        </div>

        <Dialog open={dialogOpen} onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) {
            setEditingEvent(null);
            setDueDate(todayDateString);
          }
        }}>
          <DialogTrigger>
            <Button className="bg-[#4F9CF9] hover:bg-[#3F8BE5]" onClick={() => setDueDate(todayDateString)}>
              <RiAddCircleLine className="mr-2 text-base" aria-hidden="true" />
              Add Recurring
            </Button>
          </DialogTrigger>
          <DialogContent className="max-h-[calc(100vh-2rem)] overflow-y-auto sm:max-w-2xl">
            <DialogHeader>
              <DialogTitle>{editingEvent ? 'Edit Recurring Payment' : 'Add Recurring Payment'}</DialogTitle>
            </DialogHeader>
            <RecurringForm
              editingEvent={editingEvent}
              dueDate={dueDate}
              onDueDateChange={setDueDate}
              onSubmit={handleSave}
            />
          </DialogContent>
        </Dialog>
      </div>

      <RecurringMetricCards
        monthlyCashOutflow={monthlyCashOutflow}
        nextDueEvent={nextDueEvent}
        autoPaymentCount={autoPaymentCount}
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_22rem]">
        <RecurringPaymentsTable
          events={events}
          loading={loading}
          onEdit={(event) => {
            setEditingEvent(event);
            setDueDate(getDateStringFromEvent(event));
            setDialogOpen(true);
          }}
          onDelete={handleDelete}
        />
        <YearlyDueScheduleCard upcomingEvents={upcomingEvents} />
      </div>
    </div>
  );
}
