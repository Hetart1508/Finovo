import type { ReactNode } from 'react';
import { format, parseISO } from 'date-fns';
import { Badge } from '@/src/components/ui/badge';
import { Button } from '@/src/components/ui/button';
import { Card, CardContent } from '@/src/components/ui/card';
import { StateMessage } from '@/src/components/shared/StateMessage';
import { formatSignedRupees } from '@/src/utils/formatters';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/src/components/ui/table';
import { cn } from '@/lib/utils';
import {
  RiArrowDownSLine,
  RiArrowLeftDownLine,
  RiArrowLeftSLine,
  RiArrowRightUpLine,
  RiArrowRightSLine,
  RiArrowUpSLine,
  RiDeleteBin6Line,
  RiEyeLine,
  RiPencilLine,
  RiSkipLeftLine,
  RiSkipRightLine,
} from 'react-icons/ri';
import { ITEMS_PER_PAGE, sortLabels } from '../transactions.constants';
import type { SortDirection, SortKey, Transaction } from '../transactions.types';

type TransactionsTableCardProps = {
  loading: boolean;
  transactions: Transaction[];
  totalTransactions: number;
  pageStartIndex: number;
  safeCurrentPage: number;
  totalPages: number;
  sortKey: SortKey | null;
  sortDirection: SortDirection;
  onSort: (key: SortKey) => void;
  onPageChange: (updater: number | ((page: number) => number)) => void;
  onViewBill: (transaction: Transaction) => void;
  onEditTransaction: (transaction: Transaction) => void;
  onDeleteTransaction: (id: number) => void;
  showCreatedBy?: boolean;
};

export function TransactionsTableCard({
  loading,
  transactions,
  totalTransactions,
  pageStartIndex,
  safeCurrentPage,
  totalPages,
  sortKey,
  sortDirection,
  onSort,
  onPageChange,
  onViewBill,
  onEditTransaction,
  onDeleteTransaction,
  showCreatedBy = false,
}: TransactionsTableCardProps) {
  return (
    <Card className="min-w-0 overflow-hidden border border-[#E5E7EB] shadow-[0_18px_45px_rgba(31,41,55,0.08)]">
      <CardContent className="min-w-0 p-0">
        <div className="min-w-0 max-w-full">
          <Table
            className={cn(
              'table-fixed [&_th]:px-2 [&_td]:px-2',
              showCreatedBy ? 'min-w-[860px]' : 'min-w-[760px]'
            )}
            containerClassName="touch-auto overflow-x-auto overflow-y-visible overscroll-x-contain [-webkit-overflow-scrolling:touch]"
          >
          <colgroup>
            <col className="w-[40px]" />
            <col className="w-[38px]" />
            <col className="w-[76px]" />
            <col className="w-[26%]" />
            <col className="w-[76px]" />
            <col className="w-[68px]" />
            <col className="w-[94px]" />
            {showCreatedBy ? <col className="w-[104px]" /> : null}
            <col className="w-[92px]" />
          </colgroup>
          <TableHeader className="bg-[#F8FAFC]">
            <TableRow className="border-[#D9DEE7] hover:bg-transparent">
              <TableHead className="px-1 font-bold text-[#4B5563]">SR No</TableHead>
              <SortableHead sort="type" sortKey={sortKey} sortDirection={sortDirection} onSort={onSort} className="px-1">Type</SortableHead>
              <SortableHead sort="date" sortKey={sortKey} sortDirection={sortDirection} onSort={onSort} className="px-1 text-center text-xs">Date</SortableHead>
              <SortableHead sort="description" sortKey={sortKey} sortDirection={sortDirection} onSort={onSort}>Description</SortableHead>
              <SortableHead sort="category" sortKey={sortKey} sortDirection={sortDirection} onSort={onSort}>Category</SortableHead>
              <SortableHead sort="payment_mode" sortKey={sortKey} sortDirection={sortDirection} onSort={onSort}>Mode</SortableHead>
              <SortableHead sort="amount" sortKey={sortKey} sortDirection={sortDirection} onSort={onSort} className="text-center">Amount</SortableHead>
              {showCreatedBy ? <TableHead className="font-bold text-[#4B5563]">Added by</TableHead> : null}
              <TableHead className="font-bold text-[#4B5563]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={showCreatedBy ? 9 : 8}><StateMessage>Loading transactions...</StateMessage></TableCell>
              </TableRow>
            ) : totalTransactions === 0 ? (
              <TableRow>
                <TableCell colSpan={showCreatedBy ? 9 : 8}><StateMessage>No transactions found.</StateMessage></TableCell>
              </TableRow>
            ) : (
              transactions.map((transaction, index) => (
                <TransactionRow
                  key={transaction.id}
                  transaction={transaction}
                  serialNumber={pageStartIndex + index + 1}
                  onViewBill={onViewBill}
                  onEditTransaction={onEditTransaction}
                  onDeleteTransaction={onDeleteTransaction}
                  showCreatedBy={showCreatedBy}
                />
              ))
            )}
          </TableBody>
          </Table>
        </div>
        <TablePagination
          totalTransactions={totalTransactions}
          pageStartIndex={pageStartIndex}
          safeCurrentPage={safeCurrentPage}
          totalPages={totalPages}
          onPageChange={onPageChange}
        />
      </CardContent>
    </Card>
  );
}

function SortableHead({
  sort,
  sortKey,
  sortDirection,
  children,
  className,
  onSort,
}: {
  sort: SortKey;
  sortKey: SortKey | null;
  sortDirection: SortDirection;
  children: ReactNode;
  className?: string;
  onSort: (key: SortKey) => void;
}) {
  const active = sortKey === sort;
  const nextSortLabel = !active
    ? 'ascending'
    : sortDirection === 'asc'
      ? 'descending'
      : 'default order';

  return (
    <TableHead
      aria-sort={active ? (sortDirection === 'asc' ? 'ascending' : 'descending') : 'none'}
      className={cn('font-bold text-[#4B5563]', className)}
    >
      <button
        type="button"
        onClick={() => onSort(sort)}
        className={cn(
          'inline-flex w-full min-w-0 items-center gap-1 rounded-md text-left font-semibold transition hover:text-[#4F9CF9]',
          className?.includes('text-right') && 'justify-end',
          className?.includes('text-center') && 'justify-center'
        )}
        aria-label={`Sort ${sortLabels[sort]} ${nextSortLabel}`}
      >
        <span className="min-w-0 truncate">{children}</span>
        {active && (sortDirection === 'asc'
          ? <RiArrowUpSLine className="shrink-0 text-base" aria-hidden="true" />
          : <RiArrowDownSLine className="shrink-0 text-base" aria-hidden="true" />)}
      </button>
    </TableHead>
  );
}

function TransactionRow({
  transaction,
  serialNumber,
  onViewBill,
  onEditTransaction,
  onDeleteTransaction,
  showCreatedBy,
}: {
  transaction: Transaction;
  serialNumber: number;
  onViewBill: (transaction: Transaction) => void;
  onEditTransaction: (transaction: Transaction) => void;
  onDeleteTransaction: (id: number) => void;
  showCreatedBy: boolean;
}) {
  return (
    <TableRow className="border-[#E5E7EB] bg-white hover:bg-[#F8FBFF]">
      <TableCell className="px-1 font-medium text-[#6B7280]">{serialNumber}</TableCell>
      <TableCell className="px-1">
        <div className={cn(
          'flex h-7 w-7 items-center justify-center rounded-full',
          transaction.type === 'income' ? 'bg-[#EAFBF0] text-[#34C759]' : 'bg-[#FFF1F1] text-[#FF6B6B]'
        )}>
          {transaction.type === 'income' ? <RiArrowRightUpLine className="text-base" aria-hidden="true" /> : <RiArrowLeftDownLine className="text-base" aria-hidden="true" />}
        </div>
      </TableCell>
      <TableCell className="px-1 text-center text-xs text-[#6B7280]">
        {format(parseISO(transaction.date), 'dd MMM yyyy')}
      </TableCell>
      <TableCell className="min-w-0">
        <span className="block truncate font-medium" title={transaction.merchant_name || transaction.description || '-'}>
          {transaction.merchant_name || transaction.description || '-'}
        </span>
        {transaction.payee_vpa ? <span className="block truncate text-xs text-[#6B7280]">{transaction.payee_vpa}</span> : null}
      </TableCell>
      <TableCell>
        <Badge variant="secondary" className="max-w-full truncate font-normal" title={transaction.category}>{transaction.category}</Badge>
      </TableCell>
      <TableCell className="min-w-0 text-[#6B7280]">
        <span className="block truncate" title={transaction.payment_mode}>{transaction.payment_mode}</span>
      </TableCell>
      <TableCell className={cn(
        'truncate text-center font-bold',
        transaction.type === 'income' ? 'text-[#34C759]' : 'text-[#1F2937] text-[#FF6B6B]'
      )}>
        {formatSignedRupees(transaction.amount, transaction.type === 'income')}
      </TableCell>
      {showCreatedBy ? (
        <TableCell className="min-w-0 text-[#6B7280]">
          <span className="block truncate" title={transaction.created_by_email || transaction.created_by_name || 'Member'}>
            {transaction.created_by_name || transaction.created_by_email || 'Member'}
          </span>
        </TableCell>
      ) : null}
      <TableCell>
        <div className="flex justify-end gap-1">
          {transaction.bill_url ? (
            <Button
              variant="ghost"
              size="icon-sm"
              className="text-[#6B7280] hover:text-[#4F9CF9]"
              onClick={() => onViewBill(transaction)}
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
            onClick={() => onEditTransaction(transaction)}
            aria-label="Edit transaction"
          >
            <RiPencilLine className="text-base" aria-hidden="true" />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            className="text-[#6B7280] hover:text-[#FF6B6B]"
            onClick={() => onDeleteTransaction(transaction.id)}
            aria-label="Delete transaction"
          >
            <RiDeleteBin6Line className="text-base" aria-hidden="true" />
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );
}

function TablePagination({
  totalTransactions,
  pageStartIndex,
  safeCurrentPage,
  totalPages,
  onPageChange,
}: {
  totalTransactions: number;
  pageStartIndex: number;
  safeCurrentPage: number;
  totalPages: number;
  onPageChange: (updater: number | ((page: number) => number)) => void;
}) {
  return (
    <div className="flex flex-col gap-3 border-t border-[#E5E7EB] bg-[#FBFCFE] px-4 py-3 text-sm text-[#6B7280] sm:flex-row sm:items-center sm:justify-between">
      <p className="text-center sm:text-left">
        {totalTransactions === 0
          ? 'Showing 0 transactions'
          : `Showing ${pageStartIndex + 1}-${Math.min(pageStartIndex + ITEMS_PER_PAGE, totalTransactions)} of ${totalTransactions} transactions`}
      </p>
      <div className="flex items-center justify-center gap-2 sm:justify-start">
        <Button
          variant="outline"
          size="icon"
          onClick={() => onPageChange(1)}
          disabled={safeCurrentPage === 1 || totalTransactions === 0}
          aria-label="First page"
          title="First page"
        >
          <RiSkipLeftLine className="text-base" aria-hidden="true" />
        </Button>
        <Button
          variant="outline"
          size="icon"
          onClick={() => onPageChange((page) => Math.max(1, page - 1))}
          disabled={safeCurrentPage === 1 || totalTransactions === 0}
          aria-label="Previous page"
          title="Previous page"
        >
          <RiArrowLeftSLine className="text-base" aria-hidden="true" />
        </Button>
        <span className="min-w-[6rem] text-center font-medium text-[#1F2937]">
          Page {safeCurrentPage} / {totalPages}
        </span>
        <Button
          variant="outline"
          size="icon"
          onClick={() => onPageChange((page) => Math.min(totalPages, page + 1))}
          disabled={safeCurrentPage === totalPages || totalTransactions === 0}
          aria-label="Next page"
          title="Next page"
        >
          <RiArrowRightSLine className="text-base" aria-hidden="true" />
        </Button>
        <Button
          variant="outline"
          size="icon"
          onClick={() => onPageChange(totalPages)}
          disabled={safeCurrentPage === totalPages || totalTransactions === 0}
          aria-label="Last page"
          title="Last page"
        >
          <RiSkipRightLine className="text-base" aria-hidden="true" />
        </Button>
      </div>
    </div>
  );
}
