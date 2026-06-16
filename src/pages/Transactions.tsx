import React, { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger,
  DialogFooter
} from '@/components/ui/dialog';
import api from '@/src/lib/api';
import { format, parseISO } from 'date-fns';
import { toast } from 'react-toastify';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { getApiMessage, getApiSuccessMessage } from '@/src/lib/toastMessages';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFnsV3';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import {
  RiAddCircleLine,
  RiArrowLeftDownLine,
  RiArrowRightUpLine,
  RiDeleteBin6Line,
  RiFilter3Line,
  RiPencilLine,
  RiSave3Line,
  RiSearchLine,
} from 'react-icons/ri';

export default function Transactions() {
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [transactionDate, setTransactionDate] = useState<Date | null>(new Date());
  const [editingTransaction, setEditingTransaction] = useState<any | null>(null);

  const fetchTransactions = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/transactions');
      setTransactions(data);
    } catch (error: any) {
      toast.error(getApiMessage(error, "Failed to fetch transactions."));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTransactions();
  }, []);

  const handleDelete = async (id: number) => {
    try {
      const response = await api.delete(`/transactions/${id}`);
      setTransactions(transactions.filter(t => t.id !== id));
      toast.success(getApiSuccessMessage(response.data, "Transaction deleted successfully"));
    } catch (error: any) {
      toast.error(getApiMessage(error, "Failed to delete transaction."));
    }
  };

  const handleAdd = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const data = Object.fromEntries(formData.entries());
    
    try {
      const response = await api.post('/transactions', {
        ...data,
        amount: parseFloat(data.amount as string),
        date: transactionDate ? format(transactionDate, 'yyyy-MM-dd') : '',
      });
      toast.success(getApiSuccessMessage(response.data, "Transaction added successfully"));
      setTransactionDate(new Date());
      fetchTransactions();
    } catch (error: any) {
      toast.error(getApiMessage(error, "Failed to add transaction."));
    }
  };

  const handleUpdate = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!editingTransaction) return;

    const formData = new FormData(e.currentTarget);
    const data = Object.fromEntries(formData.entries());

    try {
      const response = await api.put(`/transactions/${editingTransaction.id}`, {
        ...data,
        amount: parseFloat(data.amount as string),
      });
      setTransactions((current) =>
        current.map((transaction) =>
          transaction.id === editingTransaction.id ? response.data : transaction
        )
      );
      setEditingTransaction(null);
      toast.success(getApiSuccessMessage(response.data, "Transaction updated successfully"));
    } catch (error: any) {
      toast.error(getApiMessage(error, "Failed to update transaction."));
    }
  };

  const filteredTransactions = transactions.filter(t => {
    const matchesSearch = (t.description || '').toLowerCase().includes(search.toLowerCase()) || 
                          t.category.toLowerCase().includes(search.toLowerCase());
    const matchesFilter = filter === 'all' || t.type === filter;
    return matchesSearch && matchesFilter;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <RiSearchLine className="absolute left-3 top-1/2 -translate-y-1/2 text-base text-[#6B7280]" aria-hidden="true" />
          <Input 
            placeholder="Search transactions..." 
            className="pl-10" 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        
        <div className="flex items-center gap-3">
          <Select value={filter} onValueChange={setFilter}>
            <SelectTrigger className="w-[150px]">
              <RiFilter3Line className="mr-2 text-base" aria-hidden="true" />
              <SelectValue placeholder="Filter" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value="expense">Expenses</SelectItem>
              <SelectItem value="income">Income</SelectItem>
            </SelectContent>
          </Select>

          <Dialog>
            <DialogTrigger>
              <Button className="bg-[#4F9CF9] hover:bg-[#3F8BE5]">
                <RiAddCircleLine className="mr-2 text-base" aria-hidden="true" />
                Add Transaction
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add New Transaction</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleAdd} className="space-y-4 py-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="type">Type</Label>
                    <Select name="type" defaultValue="expense">
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="expense">Expense</SelectItem>
                        <SelectItem value="income">Income</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="amount">Amount (₹)</Label>
                    <Input id="amount" name="amount" type="number" step="0.01" required />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="category">Category</Label>
                  <Select name="category" defaultValue="Food">
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {['Food', 'Transport', 'Shopping', 'Utilities', 'Entertainment', 'Health', 'Other'].map(c => (
                        <SelectItem key={c} value={c}>{c}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="date">Date</Label>
                  <LocalizationProvider dateAdapter={AdapterDateFns}>
                    <DatePicker
                      value={transactionDate}
                      onChange={setTransactionDate}
                      format="dd MMM yyyy"
                      slotProps={{
                        textField: {
                          id: 'date',
                          name: 'date',
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
                <div className="space-y-2">
                  <Label htmlFor="payment_mode">Payment Mode</Label>
                  <Select name="payment_mode" defaultValue="UPI">
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="UPI">UPI</SelectItem>
                      <SelectItem value="Card">Card</SelectItem>
                      <SelectItem value="Cash">Cash</SelectItem>
                      <SelectItem value="Net Banking">Net Banking</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="description">Description</Label>
                  <Input id="description" name="description" placeholder="Lunch at Starbucks" />
                </div>
                <DialogFooter>
                  <Button type="submit" className="w-full">Save Transaction</Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Card className="border-none shadow-sm">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent border-[#E5E7EB] dark:border-[#E5E7EB]">
                <TableHead className="w-[100px]">Type</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Mode</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead className="w-[88px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-[#6B7280]">Loading transactions...</TableCell>
                </TableRow>
              ) : filteredTransactions.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-[#6B7280]">No transactions found.</TableCell>
                </TableRow>
              ) : (
                filteredTransactions.map((t) => (
                  <TableRow key={t.id} className="border-[#E5E7EB] dark:border-[#E5E7EB]">
                    <TableCell>
                      <div className={cn(
                        "w-8 h-8 rounded-full flex items-center justify-center",
                        t.type === 'income' ? "bg-[#EAFBF0] text-[#34C759]" : "bg-[#FFF1F1] text-[#FF6B6B]"
                      )}>
                        {t.type === 'income' ? <RiArrowRightUpLine className="text-base" aria-hidden="true" /> : <RiArrowLeftDownLine className="text-base" aria-hidden="true" />}
                      </div>
                    </TableCell>
                    <TableCell className="text-[#6B7280] dark:text-[#6B7280]">
                      {format(parseISO(t.date), 'dd MMM yyyy')}
                    </TableCell>
                    <TableCell className="font-medium">{t.description || '-'}</TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="font-normal">{t.category}</Badge>
                    </TableCell>
                    <TableCell className="text-[#6B7280] dark:text-[#6B7280]">{t.payment_mode}</TableCell>
                    <TableCell className={cn(
                      "text-right font-bold",
                      t.type === 'income' ? "text-[#34C759]" : "text-[#1F2937] text-[#FF6B6B]"
                    )}>
                      {t.type === 'income' ? '+' : '-'}₹{t.amount.toLocaleString()}
                    </TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-[#6B7280] hover:text-[#4F9CF9]"
                          onClick={() => setEditingTransaction(t)}
                          aria-label="Edit transaction"
                        >
                          <RiPencilLine className="text-base" aria-hidden="true" />
                        </Button>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="text-[#6B7280] hover:text-[#FF6B6B]"
                        onClick={() => handleDelete(t.id)}
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

      <Dialog open={Boolean(editingTransaction)} onOpenChange={(open) => !open && setEditingTransaction(null)}>
        {editingTransaction ? (
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit Transaction</DialogTitle>
            </DialogHeader>
            <form key={editingTransaction.id} onSubmit={handleUpdate} className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-type">Type</Label>
                  <Select name="type" defaultValue={editingTransaction.type}>
                    <SelectTrigger id="edit-type">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="expense">Expense</SelectItem>
                      <SelectItem value="income">Income</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-amount">Amount (₹)</Label>
                  <Input id="edit-amount" name="amount" type="number" step="0.01" min="0.01" defaultValue={editingTransaction.amount} required />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-category">Category</Label>
                <Select name="category" defaultValue={editingTransaction.category}>
                  <SelectTrigger id="edit-category">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {['Food', 'Transport', 'Shopping', 'Utilities', 'Entertainment', 'Health', 'Other', 'Salary'].map(c => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-date">Date</Label>
                <Input id="edit-date" name="date" type="date" defaultValue={format(parseISO(editingTransaction.date), 'yyyy-MM-dd')} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-payment-mode">Payment Mode</Label>
                <Select name="payment_mode" defaultValue={editingTransaction.payment_mode}>
                  <SelectTrigger id="edit-payment-mode">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="UPI">UPI</SelectItem>
                    <SelectItem value="Card">Card</SelectItem>
                    <SelectItem value="Cash">Cash</SelectItem>
                    <SelectItem value="Net Banking">Net Banking</SelectItem>
                    <SelectItem value="Bank Transfer">Bank Transfer</SelectItem>
                    <SelectItem value="Bank Statement">Bank Statement</SelectItem>
                    <SelectItem value="Wallet">Wallet</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-description">Description</Label>
                <Input id="edit-description" name="description" defaultValue={editingTransaction.description || ''} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-bill-url">Bill URL</Label>
                <Input id="edit-bill-url" name="bill_url" defaultValue={editingTransaction.bill_url || ''} placeholder="https://..." />
              </div>
              <DialogFooter>
                <Button type="submit" className="w-full">
                  <RiSave3Line className="mr-2 text-base" aria-hidden="true" />
                  Save Changes
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        ) : null}
      </Dialog>
    </div>
  );
}
