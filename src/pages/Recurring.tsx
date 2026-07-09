import { useEffect } from 'react';
import { Button } from '@/src/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/src/components/ui/dialog';
import { useQuery } from '@tanstack/react-query';
import { recurringQuery, upcomingRecurringQuery } from '@/src/server-state/recurringQueries';
import { getApiMessage } from '@/src/lib/toastMessages';
import { toast } from 'react-toastify';
import {
  RiAddCircleLine,
} from 'react-icons/ri';
import { RecurringForm } from '@/src/features/recurring/components/RecurringForm';
import { RecurringMetricCards } from '@/src/features/recurring/components/RecurringMetricCards';
import { RecurringPaymentsTable } from '@/src/features/recurring/components/RecurringPaymentsTable';
import { YearlyDueScheduleCard } from '@/src/features/recurring/components/YearlyDueScheduleCard';
import type { RecurringEvent } from '@/src/features/recurring/recurring.types';
import { useRecurringDialog } from '@/src/features/recurring/hooks/useRecurringDialog';
import { useRecurringMetrics } from '@/src/features/recurring/hooks/useRecurringMetrics';
import { useRecurringMutations } from '@/src/features/recurring/hooks/useRecurringMutations';

export default function Recurring() {
  const eventsResult = useQuery(recurringQuery());
  const upcomingResult = useQuery(upcomingRecurringQuery());
  const events = (eventsResult.data ?? []) as RecurringEvent[];
  const upcomingEvents = (upcomingResult.data ?? []) as RecurringEvent[];
  const loading = eventsResult.isPending || upcomingResult.isPending;
  const {
    dialogOpen,
    editingEvent,
    dueDate,
    setDueDate,
    closeDialog,
    openCreateDialog,
    openEditDialog,
    handleDialogOpenChange,
  } = useRecurringDialog();
  const { monthlyCashOutflow, autoPaymentCount, nextDueEvent } = useRecurringMetrics(events, upcomingEvents);
  const { handleSave, handleDelete } = useRecurringMutations({ editingEvent, dueDate, onSaved: closeDialog });

  useEffect(() => {
    const error = eventsResult.error || upcomingResult.error;
    if (error) toast.error(getApiMessage(error, 'Failed to load recurring payments.'), { toastId: 'recurring-query-error' });
  }, [eventsResult.error, upcomingResult.error]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div>
          <p className="text-sm font-semibold uppercase text-[#4F9CF9]">Recurring planner</p>
          <h1 className="mt-2 text-3xl font-black text-[#1F2937]">Subscriptions and future payments</h1>
          <p className="mt-2 max-w-2xl text-sm text-[#6B7280]">
            Track monthly subscriptions, EMIs, rent, and fees so upcoming payments are visible before they arrive.
          </p>
        </div>

        <Dialog open={dialogOpen} onOpenChange={handleDialogOpenChange}>
          <DialogTrigger>
            <Button className="bg-[#4F9CF9] hover:bg-[#3F8BE5]" onClick={openCreateDialog}>
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
          onEdit={openEditDialog}
          onDelete={handleDelete}
        />
        <YearlyDueScheduleCard upcomingEvents={upcomingEvents} />
      </div>
    </div>
  );
}
