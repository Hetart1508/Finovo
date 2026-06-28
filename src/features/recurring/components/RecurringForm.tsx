import type { FormEvent } from 'react';
import { AppDatePicker } from '@/src/components/ui/app-date-picker';
import { Button } from '@/src/components/ui/button';
import { DialogFooter } from '@/src/components/ui/dialog';
import { Input } from '@/src/components/ui/input';
import { Label } from '@/src/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/src/components/ui/select';
import { categories, frequencies, paymentTypes } from '../recurring.constants';
import type { RecurringEvent } from '../recurring.types';

type RecurringFormProps = {
  editingEvent: RecurringEvent | null;
  dueDate: string;
  onDueDateChange: (value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
};

export function RecurringForm({ editingEvent, dueDate, onDueDateChange, onSubmit }: RecurringFormProps) {
  return (
    <form key={editingEvent?.id || 'new'} onSubmit={onSubmit} className="space-y-4 py-4">
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
          <AppDatePicker id="recurring-due-date" value={dueDate} onChange={onDueDateChange} required />
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
          <Input id="recurring-interval" name="interval_count" type="number" min="1" max="120" defaultValue={editingEvent?.interval_count || 1} required />
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
          <Input id="recurring-account" name="payment_account" placeholder="HDFC Bank, UPI mandate" defaultValue={editingEvent?.payment_account || ''} />
        </div>
      </div>

      <DialogFooter>
        <Button type="submit" className="w-full">{editingEvent ? 'Save Changes' : 'Save Recurring Payment'}</Button>
      </DialogFooter>
    </form>
  );
}
