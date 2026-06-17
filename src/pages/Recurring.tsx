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
  next_due_date?: string;
  days_until_due?: number;
};

const categories = ['Rent', 'Subscription', 'Utilities', 'Insurance', 'EMI', 'Internet', 'Education', 'Health', 'Other'];
const paymentTypes = ['expense', 'income'];

const getDueLabel = (event: RecurringEvent) => {
  if (typeof event.days_until_due !== 'number') return `Every month on day ${event.day_of_month}`;
  if (event.days_until_due === 0) return 'Due today';
  if (event.days_until_due === 1) return 'Due tomorrow';
  return `Due in ${event.days_until_due} days`;
};

const getDateFromDayOfMonth = (dayOfMonth: number) => {
  const today = new Date();
  const lastDayOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
  return new Date(today.getFullYear(), today.getMonth(), Math.min(dayOfMonth, lastDayOfMonth));
};

export default function Recurring() {
  const [events, setEvents] = useState<RecurringEvent[]>([]);
  const [upcomingEvents, setUpcomingEvents] = useState<RecurringEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<RecurringEvent | null>(null);
  const [dueDate, setDueDate] = useState<Date | null>(new Date());

  const monthlyExpenseTotal = useMemo(
    () => events
      .filter((event) => event.type === 'expense')
      .reduce((sum, event) => sum + Number(event.amount), 0),
    [events]
  );

  const nextDueEvent = upcomingEvents[0];

  const fetchRecurring = async () => {
    setLoading(true);
    try {
      const [eventsResponse, upcomingResponse] = await Promise.all([
        api.get('/recurring'),
        api.get('/recurring/upcoming?days=365'),
      ]);
      setEvents(eventsResponse.data);
      setUpcomingEvents(upcomingResponse.data);
    } catch (error: any) {
      toast.error(getApiMessage(error, 'Failed to load recurring payments.'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRecurring();
  }, []);

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
    };

    try {
      const response = editingEvent
        ? await api.patch(`/recurring/${editingEvent.id}`, payload)
        : await api.post('/recurring', payload);

      toast.success(getApiSuccessMessage(response.data, editingEvent ? 'Recurring payment updated.' : 'Recurring payment added.'));
      closeDialog();
      fetchRecurring();
    } catch (error: any) {
      toast.error(getApiMessage(error, 'Failed to save recurring payment.'));
    }
  };

  const handleDelete = async (id: number) => {
    try {
      const response = await api.delete(`/recurring/${id}`);
      toast.success(getApiSuccessMessage(response.data, 'Recurring payment deleted.'));
      fetchRecurring();
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
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingEvent ? 'Edit Recurring Payment' : 'Add Recurring Payment'}</DialogTitle>
            </DialogHeader>
            <form key={editingEvent?.id || 'new'} onSubmit={handleSave} className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="recurring-name">Name</Label>
                <Input id="recurring-name" name="name" placeholder="Netflix, Rent, SIP reminder" defaultValue={editingEvent?.name || ''} required />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="recurring-amount">Amount (₹)</Label>
                  <Input id="recurring-amount" name="amount" type="number" step="0.01" min="0.01" defaultValue={editingEvent?.amount || ''} required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="recurring-due-date">Due Date</Label>
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
                        <SelectItem key={type} value={type}>{type === 'expense' ? 'Expense' : 'Income'}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
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
            <p className="text-sm font-medium text-[#6B7280]">Monthly Recurring Expenses</p>
            <h3 className="mt-1 text-2xl font-bold">₹{monthlyExpenseTotal.toLocaleString()}</h3>
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
            <p className="text-sm font-medium text-[#6B7280]">Tracked Items</p>
            <h3 className="mt-1 text-2xl font-bold">{events.length}</h3>
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
                  <TableHead>Due Date</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead className="w-[88px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="py-8 text-center text-[#6B7280] dark:text-[#CBD5E1]">Loading recurring payments...</TableCell>
                  </TableRow>
                ) : events.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="py-8 text-center text-[#6B7280] dark:text-[#CBD5E1]">No recurring payments added yet.</TableCell>
                  </TableRow>
                ) : (
                  events.map((event) => (
                    <TableRow key={event.id} className="border-[#E5E7EB] dark:border-[#334155]">
                      <TableCell className="font-medium">{event.name}</TableCell>
                      <TableCell><Badge variant="secondary" className="font-normal">{event.category}</Badge></TableCell>
                      <TableCell className="text-[#6B7280] dark:text-[#CBD5E1]">Monthly on day {event.day_of_month}</TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={cn(
                            "capitalize",
                            event.type === 'income' ? "border-[#EAFBF0] text-[#34C759]" : "border-[#FFF1F1] text-[#FF6B6B]"
                          )}
                        >
                          {event.type}
                        </Badge>
                      </TableCell>
                      <TableCell className={cn("text-right font-bold", event.type === 'income' ? "text-[#34C759]" : "text-[#FF6B6B]")}>
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
                              setDueDate(getDateFromDayOfMonth(event.day_of_month));
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
                      </div>
                      <p className={cn("font-bold", event.type === 'income' ? "text-[#34C759]" : "text-[#FF6B6B]")}>₹{Number(event.amount).toLocaleString()}</p>
                    </div>
                    <Badge variant="secondary" className="mt-3 text-xs">{getDueLabel(event)}</Badge>
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
