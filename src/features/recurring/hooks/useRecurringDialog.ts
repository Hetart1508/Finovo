import { useState } from 'react';
import { format } from 'date-fns';
import type { RecurringEvent } from '../recurring.types';
import { getDateStringFromEvent } from '../recurring.utils';

export function useRecurringDialog() {
  const todayDateString = format(new Date(), 'yyyy-MM-dd');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<RecurringEvent | null>(null);
  const [dueDate, setDueDate] = useState(todayDateString);

  const closeDialog = () => {
    setDialogOpen(false);
    setEditingEvent(null);
    setDueDate(todayDateString);
  };

  const openCreateDialog = () => {
    setEditingEvent(null);
    setDueDate(todayDateString);
    setDialogOpen(true);
  };

  const openEditDialog = (event: RecurringEvent) => {
    setEditingEvent(event);
    setDueDate(getDateStringFromEvent(event));
    setDialogOpen(true);
  };

  const handleDialogOpenChange = (open: boolean) => {
    if (open) setDialogOpen(true);
    else closeDialog();
  };

  return {
    dialogOpen,
    editingEvent,
    dueDate,
    setDueDate,
    closeDialog,
    openCreateDialog,
    openEditDialog,
    handleDialogOpenChange,
  };
}
