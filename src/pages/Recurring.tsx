import React, { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import api from '@/src/lib/api';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { queryKeys, recurringQuery, upcomingRecurringQuery } from '@/src/lib/serverState';
import { getApiMessage, getApiSuccessMessage } from '@/src/lib/toastMessages';
import { cn } from '@/lib/utils';
import { format, parseISO } from 'date-fns';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFnsV3';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { toast } from 'react-toastify';
import {
  RiAddCircleLine,
  RiCalendarCheckLine,
  RiDeleteBin6Line,
  RiPencilLine,
  RiRefreshLine,
  RiRepeatLine,
} from 'react-icons/ri';

type RecurringEvent = {
  id: number;
  name: string;
  amount: number;
  day_of_month: number;
  category: string;
  type: string;
  frequency?: 'monthly' | 'yearly';
  interval_count?: number;
  start_date?: string | null;
  payment_mode?: 'manual' | 'auto';
  autopay_enabled?: boolean | number;
  payment_account?: string | null;
  next_due_date?: string;
  days_until_due?: number;
};

const categories = ['Rent', 'SIP', 'Mutual Fund', 'Subscription', 'Utilities', 'Insurance', 'EMI', 'Internet', 'Education', 'Health', 'Car Service', 'Maintenance', 'Other'];
const paymentTypes = ['expense', 'income', 'investment', 'service'];
const frequencies = ['monthly', 'yearly'];

const getScheduleLabel = (event: RecurringEvent) => {
  const frequency = event.frequency || 'monthly';
  const interval = Number(event.interval_count) || 1;
  const unit = frequency === 'yearly' ? 'year' : 'month';
  const intervalText = interval === 1 ? `Every ${unit}` : `Every ${interval} ${unit}s`;
  return `${intervalText} on day ${event.day_of_month}`;
};

const getDueLabel = (event: RecurringEvent) => {
  if (typeof event.days_until_due !== 'number') return getScheduleLabel(event);
  if (event.days_until_due === 0) return 'Due today';
  if (event.days_until_due === 1) return 'Due tomorrow';
  return `Due in ${event.days_until_due} days`;
};

const getDateFromDayOfMonth = (dayOfMonth: number) => {
  const today = new Date();
  const lastDayOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
  return new Date(today.getFullYear(), today.getMonth(), Math.min(dayOfMonth, lastDayOfMonth));
};

const getDateFromEvent = (event: RecurringEvent) => (
  event.start_date ? parseISO(event.start_date) : getDateFromDayOfMonth(event.day_of_month)
);

const getTypeClassName = (type: string) => {
  if (type === 'income') return 'border-[#EAFBF0] text-[#34C759]';
  if (type === 'investment') return 'border-[#EEF6FF] text-[#4F9CF9]';
  if (type === 'service') return 'border-[#FFF7E8] text-[#FFB84D]';
  return 'border-[#FFF1F1] text-[#FF6B6B]';
};

const getAmountClassName = (type: string) => (
  type === 'income' ? 'text-[#34C759]' : type === 'investment' ? 'text-[#4F9CF9]' : 'text-[#FF6B6B]'
);

export default function Recurring() {
  const queryClient = useQueryClient();
  const eventsResult = useQuery(recurringQuery());
  const upcomingResult = useQuery(upcomingRecurringQuery());
  const events = (eventsResult.data ?? []) as RecurringEvent[];
  const upcomingEvents = (upcomingResult.data ?? []) as RecurringEvent[];
  const loading = eventsResult.isPending || upcomingResult.isPending;
  const saveRecurring = useMutation({
    mutationFn: ({ id, payload }: { id?: number; payload: Record<string, unknown> }) =>
      id ? api.patch(`/recurring/${id}`, payload) : api.post('/recurring', payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.recurring }),
  });
  const deleteRecurring = useMutation({
    mutationFn: (id: number) => api.delete(`/recurring/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.recurring }),
  });
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<RecurringEvent | null>(null);
  const [dueDate, setDueDate] = useState<Date | null>(new Date());

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
    setDueDate(new Date());
  };

  const handleSave = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    if (!dueDate) {
      toast.error('Please select a due date.');
      return;
    }

    const payload = {
      name: String(formData.get('name') || '').trim(),
      amount: Number(formData.get('amount')),
      day_of_month: dueDate.getDate(),
      category: String(formData.get('category') || 'Other'),
      type: String(formData.get('type') || 'expense'),
      frequency: String(formData.get('frequency') || 'monthly'),
      interval_count: Number(formData.get('interval_count') || 1),
      start_date: format(dueDate, 'yyyy-MM-dd'),
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
            setDueDate(new Date());
          }
        }}>
          <DialogTrigger>
            <Button className="bg-[#4F9CF9] hover:bg-[#3F8BE5]" onClick={() => setDueDate(new Date())}>
              <RiAddCircleLine className="mr-2 text-base" aria-hidden="true" />
              Add Recurring
            </Button>
          </DialogTrigger>
          <DialogContent className="max-h-[calc(100vh-2rem)] overflow-y-auto sm:max-w-2xl">
            <DialogHeader>
              <DialogTitle>{editingEvent ? 'Edit Recurring Payment' : 'Add Recurring Payment'}</DialogTitle>
            </DialogHeader>
            <form key={editingEvent?.id || 'new'} onSubmit={handleSave} className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="recurring-name">Name</Label>
                <Input id="recurring-name" name="name" placeholder="Rent, SIP, WiFi subscription, car service" defaultValue={editingEvent?.name || ''} required />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="recurring-amount">Amount (₹)</Label>
                  <Input id="recurring-amount" name="amount" type="number" step="0.01" min="0.01" defaultValue={editingEvent?.amount || ''} required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="recurring-due-date">Start / Payment Date</Label>
                  <LocalizationProvider dateAdapter={AdapterDateFns}>
                    <DatePicker
                      value={dueDate}
                      onChange={setDueDate}
                      format="dd MMM yyyy"
                      slotProps={{
                        textField: {
                          id: 'recurring-due-date',
                          required: true,
                          fullWidth: true,
                          size: 'small',
                          sx: {
                            '& .MuiOutlinedInput-root': {
                              borderRadius: '8px',
                              backgroundColor: 'white',
                              fontFamily: 'inherit',
                            },
                            '& .MuiInputBase-input': {
                              fontSize: '0.875rem',
                              paddingTop: '8.5px',
                              paddingBottom: '8.5px',
                            },
                          },
                        },
                      }}
                    />
                  </LocalizationProvider>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Category</Label>
                  <Select name="category" defaultValue={editingEvent?.category || 'Subscription'}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map((category) => (
                        <SelectItem key={category} value={category}>{category}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Type</Label>
                  <Select name="type" defaultValue={editingEvent?.type || 'expense'}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {paymentTypes.map((type) => (
                        <SelectItem key={type} value={type}>
                          {type === 'expense' ? 'Expense' : type === 'income' ? 'Income' : type === 'investment' ? 'Investment' : 'Service'}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Repeats</Label>
                  <Select name="frequency" defaultValue={editingEvent?.frequency || 'monthly'}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {frequencies.map((frequency) => (
                        <SelectItem key={frequency} value={frequency}>
                          {frequency === 'monthly' ? 'Monthly' : 'Yearly'}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="recurring-interval">Every</Label>
                  <Input
                    id="recurring-interval"
                    name="interval_count"
                    type="number"
                    min="1"
                    max="120"
                    defaultValue={editingEvent?.interval_count || 1}
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Payment</Label>
                  <Select name="payment_mode" defaultValue={editingEvent?.payment_mode || (editingEvent?.autopay_enabled ? 'auto' : 'manual')}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="manual">Manual reminder</SelectItem>
                      <SelectItem value="auto">Auto debit / autopay</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="recurring-account">Account / Source</Label>
                  <Input
                    id="recurring-account"
                    name="payment_account"
                    placeholder="HDFC Bank, UPI mandate"
                    defaultValue={editingEvent?.payment_account || ''}
                  />
                </div>
              </div>

              <DialogFooter>
                <Button type="submit" className="w-full">{editingEvent ? 'Save Changes' : 'Save Recurring Payment'}</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Card className="metric-card">
          <CardContent className="p-6">
            <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-lg bg-[#EEF6FF] text-[#4F9CF9]">
              <RiRepeatLine className="text-lg" aria-hidden="true" />
            </div>
            <p className="text-sm font-medium text-[#6B7280]">Monthly Cash Outflow</p>
            <h3 className="mt-1 text-2xl font-bold">₹{Math.round(monthlyCashOutflow).toLocaleString()}</h3>
          </CardContent>
        </Card>

        <Card className="metric-card">
          <CardContent className="p-6">
            <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-lg bg-[#FFF7E8] text-[#FFB84D]">
              <RiCalendarCheckLine className="text-lg" aria-hidden="true" />
            </div>
            <p className="text-sm font-medium text-[#6B7280]">Next Payment</p>
            <h3 className="mt-1 truncate text-2xl font-bold">{nextDueEvent ? nextDueEvent.name : 'None'}</h3>
            {nextDueEvent ? <p className="mt-1 text-xs text-[#6B7280]">{getDueLabel(nextDueEvent)}</p> : null}
          </CardContent>
        </Card>

        <Card className="metric-card">
          <CardContent className="p-6">
            <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-lg bg-[#EAFBF0] text-[#34C759]">
              <RiRefreshLine className="text-lg" aria-hidden="true" />
            </div>
            <p className="text-sm font-medium text-[#6B7280]">Auto Payments</p>
            <h3 className="mt-1 text-2xl font-bold">{autoPaymentCount}</h3>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_22rem]">
        <Card className="border-none shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg font-semibold">Recurring Payments</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="border-[#E5E7EB] hover:bg-transparent dark:border-[#334155]">
                  <TableHead>Name</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Schedule</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Payment</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead className="w-[88px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={7} className="py-8 text-center text-[#6B7280] dark:text-[#CBD5E1]">Loading recurring payments...</TableCell>
                  </TableRow>
                ) : events.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="py-8 text-center text-[#6B7280] dark:text-[#CBD5E1]">No recurring payments added yet.</TableCell>
                  </TableRow>
                ) : (
                  events.map((event) => (
                    <TableRow key={event.id} className="border-[#E5E7EB] dark:border-[#334155]">
                      <TableCell className="font-medium">{event.name}</TableCell>
                      <TableCell><Badge variant="secondary" className="font-normal">{event.category}</Badge></TableCell>
                      <TableCell className="text-[#6B7280] dark:text-[#CBD5E1]">{getScheduleLabel(event)}</TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={cn("capitalize", getTypeClassName(event.type))}
                        >
                          {event.type}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          <Badge variant="secondary" className="text-xs font-normal">
                            {event.payment_mode === 'auto' || event.autopay_enabled ? 'Auto' : 'Manual'}
                          </Badge>
                          {event.payment_account ? (
                            <p className="max-w-[9rem] truncate text-xs text-[#6B7280] dark:text-[#CBD5E1]">{event.payment_account}</p>
                          ) : null}
                        </div>
                      </TableCell>
                      <TableCell className={cn("text-right font-bold", getAmountClassName(event.type))}>
                        ₹{Number(event.amount).toLocaleString()}
                      </TableCell>
                      <TableCell>
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-[#6B7280] hover:text-[#4F9CF9]"
                            onClick={() => {
                              setEditingEvent(event);
                              setDueDate(getDateFromEvent(event));
                              setDialogOpen(true);
                            }}
                            aria-label="Edit recurring payment"
                          >
                            <RiPencilLine className="text-base" aria-hidden="true" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-[#6B7280] hover:text-[#FF6B6B]"
                            onClick={() => handleDelete(event.id)}
                            aria-label="Delete recurring payment"
                          >
                            <RiDeleteBin6Line className="text-base" aria-hidden="true" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg font-semibold">Yearly Due Schedule</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {upcomingEvents.length === 0 ? (
                <p className="py-8 text-center text-sm text-[#6B7280] dark:text-[#CBD5E1]">No payments due in the next year.</p>
              ) : (
                upcomingEvents.map((event) => (
                  <div key={event.id} className="rounded-lg border border-[#E5E7EB] p-3 dark:border-[#334155]">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold">{event.name}</p>
                        <p className="mt-1 text-xs text-[#6B7280] dark:text-[#CBD5E1]">
                          {event.next_due_date ? format(parseISO(event.next_due_date), 'dd MMM yyyy') : `Day ${event.day_of_month}`} • {event.category}
                        </p>
                        <p className="mt-1 text-xs text-[#6B7280] dark:text-[#CBD5E1]">
                          {getScheduleLabel(event)} • {event.payment_mode === 'auto' || event.autopay_enabled ? 'Auto' : 'Manual'}
                        </p>
                      </div>
                      <p className={cn("font-bold", getAmountClassName(event.type))}>₹{Number(event.amount).toLocaleString()}</p>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Badge variant="secondary" className="text-xs">{getDueLabel(event)}</Badge>
                      <Badge variant="outline" className={cn("text-xs capitalize", getTypeClassName(event.type))}>{event.type}</Badge>
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
