import React, { useEffect, useMemo, useState } from 'react';
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
  RiArrowDownSLine,
  RiArrowLeftDownLine,
  RiArrowLeftSLine,
  RiArrowRightUpLine,
  RiArrowRightSLine,
  RiArrowUpDownLine,
  RiArrowUpSLine,
  RiDeleteBin6Line,
  RiExternalLinkLine,
  RiEyeLine,
  RiFilter3Line,
  RiPencilLine,
  RiSave3Line,
  RiSearchLine,
  RiSkipLeftLine,
  RiSkipRightLine,
} from 'react-icons/ri';

type SortKey = 'type' | 'date' | 'description' | 'category' | 'payment_mode' | 'amount';
type SortDirection = 'asc' | 'desc';

const ITEMS_PER_PAGE = 10;

const sortLabels: Record<SortKey, string> = {
  type: 'Type',
  date: 'Date',
  description: 'Description',
  category: 'Category',
  payment_mode: 'Mode',
  amount: 'Amount',
};

const isPdfBill = (url: string) => {
  const cleanUrl = url.split('?')[0].toLowerCase();
  return cleanUrl.endsWith('.pdf') || cleanUrl.includes('/raw/upload/');
};

const getBillUrl = (url: string) => {
  if (/^https?:\/\//i.test(url)) return url;
  return `${window.location.origin}${url.startsWith('/') ? '' : '/'}${url}`;
};

export default function Transactions() {
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [sortKey, setSortKey] = useState<SortKey | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [currentPage, setCurrentPage] = useState(1);
  const [transactionDate, setTransactionDate] = useState<Date | null>(new Date());
  const [editingTransaction, setEditingTransaction] = useState<any | null>(null);
  const [viewingBill, setViewingBill] = useState<any | null>(null);
  const todayDateString = format(new Date(), 'yyyy-MM-dd');

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

  const openBillInNewTab = (url: string) => {
    const openedWindow = window.open(getBillUrl(url), '_blank');
    if (openedWindow) {
      openedWindow.opener = null;
    }
  };

  const handleAdd = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const data = Object.fromEntries(formData.entries());
    const selectedDate = transactionDate ? format(transactionDate, 'yyyy-MM-dd') : '';

    if (selectedDate > todayDateString) {
      toast.error('Transaction date cannot be in the future.');
      return;
    }
    
    try {
      const response = await api.post('/transactions', {
        ...data,
        amount: parseFloat(data.amount as string),
        date: selectedDate,
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
    const selectedDate = String(data.date || '');

    if (selectedDate > todayDateString) {
      toast.error('Transaction date cannot be in the future.');
      return;
    }

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

  const handleSort = (key: SortKey) => {
    setCurrentPage(1);

    if (sortKey !== key) {
      setSortKey(key);
      setSortDirection('asc');
      return;
    }

    if (sortDirection === 'asc') {
      setSortDirection('desc');
      return;
    }

    setSortKey(null);
    setSortDirection('asc');
  };

  const filteredTransactions = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    return transactions.filter(t => {
      const matchesSearch = !normalizedSearch ||
        (t.description || '').toLowerCase().includes(normalizedSearch) ||
        (t.category || '').toLowerCase().includes(normalizedSearch) ||
        (t.payment_mode || '').toLowerCase().includes(normalizedSearch);
      const matchesFilter = filter === 'all' || t.type === filter;
      return matchesSearch && matchesFilter;
    });
  }, [filter, search, transactions]);

  const sortedTransactions = useMemo(() => {
    if (!sortKey) return filteredTransactions;

    const getSortValue = (transaction: any) => {
      if (sortKey === 'amount') return Number(transaction.amount) || 0;
      if (sortKey === 'date') return parseISO(transaction.date).getTime();
      return String(transaction[sortKey] || '').toLowerCase();
    };

    return [...filteredTransactions].sort((first, second) => {
      const firstValue = getSortValue(first);
      const secondValue = getSortValue(second);
      if (firstValue < secondValue) return sortDirection === 'asc' ? -1 : 1;
      if (firstValue > secondValue) return sortDirection === 'asc' ? 1 : -1;
      return Number(second.id || 0) - Number(first.id || 0);
    });
  }, [filteredTransactions, sortDirection, sortKey]);

  const totalPages = Math.max(1, Math.ceil(sortedTransactions.length / ITEMS_PER_PAGE));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const pageStartIndex = (safeCurrentPage - 1) * ITEMS_PER_PAGE;
  const paginatedTransactions = sortedTransactions.slice(pageStartIndex, pageStartIndex + ITEMS_PER_PAGE);

  useEffect(() => {
    setCurrentPage(1);
  }, [filter, search]);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const SortableHead = ({
    sort,
    children,
    className,
  }: {
    sort: SortKey;
    children: React.ReactNode;
    className?: string;
  }) => {
    const active = sortKey === sort;
    const Icon = !active ? RiArrowUpDownLine : sortDirection === 'asc' ? RiArrowUpSLine : RiArrowDownSLine;
    const nextSortLabel = !active
      ? 'ascending'
      : sortDirection === 'asc'
        ? 'descending'
        : 'default order';

    return (
      <TableHead className={cn("font-bold text-[#4B5563] dark:text-[#CBD5E1]", className)}>
        <button
          type="button"
          onClick={() => handleSort(sort)}
          className={cn(
            "inline-flex w-full min-w-0 items-center gap-1 rounded-md text-left font-semibold transition hover:text-[#4F9CF9]",
            className?.includes('text-right') && "ml-auto"
          )}
          aria-label={`Sort ${sortLabels[sort]} ${nextSortLabel}`}
        >
          <span className="min-w-0 truncate">{children}</span>
          <Icon className="shrink-0 text-base" aria-hidden="true" />
        </button>
      </TableHead>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <RiSearchLine className="absolute left-3 top-1/2 -translate-y-1/2 text-base text-[#6B7280]" aria-hidden="true" />
          <Input 
            placeholder="Search description, category, or mode..." 
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
                      maxDate={new Date()}
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

      <Card className="overflow-hidden border border-[#E5E7EB] shadow-[0_18px_45px_rgba(31,41,55,0.08)] dark:border-[#334155]">
        <CardContent className="p-0">
          <Table className="table-fixed border-separate border-spacing-0 [&_td]:border-r [&_td]:border-[#E5E7EB] [&_td:last-child]:border-r-0 [&_th]:border-r [&_th]:border-[#D9DEE7] [&_th:last-child]:border-r-0 dark:[&_td]:border-[#334155] dark:[&_th]:border-[#334155]">
            <colgroup>
              <col className="w-[52px]" />
              <col className="w-[60px]" />
              <col className="w-[96px]" />
              <col className="w-[28%]" />
              <col className="w-[108px]" />
              <col className="w-[94px]" />
              <col className="w-[108px]" />
              <col className="w-[78px]" />
            </colgroup>
            <TableHeader className="bg-[#F8FAFC] dark:bg-[#1E293B]">
              <TableRow className="border-[#D9DEE7] hover:bg-transparent dark:border-[#334155]">
                <TableHead className="font-bold text-[#4B5563] dark:text-[#CBD5E1]">SR No</TableHead>
                <SortableHead sort="type">Type</SortableHead>
                <SortableHead sort="date">Date</SortableHead>
                <SortableHead sort="description">Description</SortableHead>
                <SortableHead sort="category">Category</SortableHead>
                <SortableHead sort="payment_mode">Mode</SortableHead>
                <SortableHead sort="amount" className="text-right">Amount</SortableHead>
                <TableHead className="font-bold text-[#4B5563] dark:text-[#CBD5E1]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-[#6B7280]">Loading transactions...</TableCell>
                </TableRow>
              ) : sortedTransactions.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-[#6B7280]">No transactions found.</TableCell>
                </TableRow>
              ) : (
                paginatedTransactions.map((t, index) => (
                  <TableRow key={t.id} className="border-[#E5E7EB] bg-white hover:bg-[#F8FBFF] dark:border-[#334155] dark:bg-[#111827] dark:hover:bg-[#162033]">
                    <TableCell className="font-medium text-[#6B7280] dark:text-[#6B7280]">
                      {pageStartIndex + index + 1}
                    </TableCell>
                    <TableCell>
                      <div className={cn(
                        "flex h-7 w-7 items-center justify-center rounded-full",
                        t.type === 'income' ? "bg-[#EAFBF0] text-[#34C759]" : "bg-[#FFF1F1] text-[#FF6B6B]"
                      )}>
                        {t.type === 'income' ? <RiArrowRightUpLine className="text-base" aria-hidden="true" /> : <RiArrowLeftDownLine className="text-base" aria-hidden="true" />}
                      </div>
                    </TableCell>
                    <TableCell className="text-[#6B7280] dark:text-[#6B7280]">
                      {format(parseISO(t.date), 'dd MMM yyyy')}
                    </TableCell>
                    <TableCell className="min-w-0">
                      <span className="block truncate font-medium" title={t.description || '-'}>
                        {t.description || '-'}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="max-w-full truncate font-normal" title={t.category}>{t.category}</Badge>
                    </TableCell>
                    <TableCell className="min-w-0 text-[#6B7280] dark:text-[#6B7280]">
                      <span className="block truncate" title={t.payment_mode}>{t.payment_mode}</span>
                    </TableCell>
                    <TableCell className={cn(
                      "truncate text-right font-bold",
                      t.type === 'income' ? "text-[#34C759]" : "text-[#1F2937] text-[#FF6B6B]"
                    )}>
                      {t.type === 'income' ? '+' : '-'}₹{t.amount.toLocaleString()}
                    </TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-1">
                        {t.bill_url ? (
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            className="text-[#6B7280] hover:text-[#4F9CF9]"
                            onClick={() => setViewingBill(t)}
                            aria-label="View invoice bill"
                            title="View invoice bill"
                          >
                            <RiEyeLine className="text-base" aria-hidden="true" />
                          </Button>
                        ) : null}
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          className="text-[#6B7280] hover:text-[#4F9CF9]"
                          onClick={() => setEditingTransaction(t)}
                          aria-label="Edit transaction"
                        >
                          <RiPencilLine className="text-base" aria-hidden="true" />
                        </Button>
                      <Button 
                        variant="ghost" 
                        size="icon-sm" 
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
          <div className="flex flex-col gap-3 border-t border-[#E5E7EB] bg-[#FBFCFE] px-4 py-3 text-sm text-[#6B7280] dark:border-[#334155] dark:bg-[#111827] dark:text-[#CBD5E1] sm:flex-row sm:items-center sm:justify-between">
            <p>
              {sortedTransactions.length === 0
                ? 'Showing 0 transactions'
                : `Showing ${pageStartIndex + 1}-${Math.min(pageStartIndex + ITEMS_PER_PAGE, sortedTransactions.length)} of ${sortedTransactions.length} transactions`}
            </p>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="icon"
                onClick={() => setCurrentPage(1)}
                disabled={safeCurrentPage === 1 || sortedTransactions.length === 0}
                aria-label="First page"
                title="First page"
              >
                <RiSkipLeftLine className="text-base" aria-hidden="true" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
                disabled={safeCurrentPage === 1 || sortedTransactions.length === 0}
                aria-label="Previous page"
                title="Previous page"
              >
                <RiArrowLeftSLine className="text-base" aria-hidden="true" />
              </Button>
              <span className="min-w-[6rem] text-center font-medium text-[#1F2937] dark:text-[#CBD5E1]">
                Page {safeCurrentPage} / {totalPages}
              </span>
              <Button
                variant="outline"
                size="icon"
                onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
                disabled={safeCurrentPage === totalPages || sortedTransactions.length === 0}
                aria-label="Next page"
                title="Next page"
              >
                <RiArrowRightSLine className="text-base" aria-hidden="true" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                onClick={() => setCurrentPage(totalPages)}
                disabled={safeCurrentPage === totalPages || sortedTransactions.length === 0}
                aria-label="Last page"
                title="Last page"
              >
                <RiSkipRightLine className="text-base" aria-hidden="true" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Dialog open={Boolean(viewingBill)} onOpenChange={(open) => !open && setViewingBill(null)}>
        {viewingBill ? (
          <DialogContent className="max-h-[calc(100vh-2rem)] overflow-y-auto sm:max-w-4xl">
            <DialogHeader>
              <DialogTitle>Invoice Bill</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="rounded-lg border border-[#E5E7EB] bg-[#F8FAFC] p-3 dark:border-[#334155] dark:bg-[#111827]">
                <p className="truncate text-sm font-semibold text-[#1F2937] dark:text-[#CBD5E1]">
                  {viewingBill.description || viewingBill.category}
                </p>
                <p className="mt-1 text-xs text-[#6B7280] dark:text-[#CBD5E1]">
                  {format(parseISO(viewingBill.date), 'dd MMM yyyy')} • ₹{Number(viewingBill.amount).toLocaleString()}
                </p>
              </div>

              {isPdfBill(viewingBill.bill_url) ? (
                <div className="h-[70vh] overflow-hidden rounded-lg border border-[#E5E7EB] dark:border-[#334155]">
                  <iframe
                    src={getBillUrl(viewingBill.bill_url)}
                    title="Invoice bill PDF"
                    className="h-full w-full bg-white"
                  />
                </div>
              ) : (
                <div className="flex max-h-[70vh] items-center justify-center overflow-auto rounded-lg border border-[#E5E7EB] bg-[#0F172A]/5 p-3 dark:border-[#334155]">
                  <img
                    src={getBillUrl(viewingBill.bill_url)}
                    alt="Invoice bill"
                    className="max-h-[66vh] max-w-full rounded-md object-contain"
                  />
                </div>
              )}

              <div className="flex justify-end">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => openBillInNewTab(viewingBill.bill_url)}
                >
                  <RiExternalLinkLine className="text-base" aria-hidden="true" />
                  Open in new tab
                </Button>
              </div>
            </div>
          </DialogContent>
        ) : null}
      </Dialog>

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
                <Input id="edit-date" name="date" type="date" max={todayDateString} defaultValue={format(parseISO(editingTransaction.date), 'yyyy-MM-dd')} required />
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
