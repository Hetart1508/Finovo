import { useEffect, useMemo, useState } from 'react';
import { differenceInCalendarDays, parseISO } from 'date-fns';
import {
  calculateLumpsumFutureValue,
  calculateSipFutureValue,
  getSipDurationMonths,
} from '@/src/lib/investmentCalculations';
import type { Investment, InvestmentType } from '../investments.types';
import { defaultEndDate, getInvestmentType, today } from '../investments.utils';

export function useInvestmentFormState() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingInvestment, setEditingInvestment] = useState<Investment | null>(null);
  const [selectedInvestmentType, setSelectedInvestmentType] = useState<InvestmentType>('sip');
  const [investmentAmount, setInvestmentAmount] = useState('');
  const [formExpectedCagr, setFormExpectedCagr] = useState('12');
  const [formStartDate, setFormStartDate] = useState(today);
  const [formEndDate, setFormEndDate] = useState(defaultEndDate);

  const formTotalInvested = useMemo(() => {
    const amount = Number(investmentAmount);
    if (selectedInvestmentType === 'lumpsum') return Number.isFinite(amount) ? amount : 0;
    const months = getSipDurationMonths(formStartDate, formEndDate);
    return Number.isFinite(amount) ? amount * months : 0;
  }, [formEndDate, formStartDate, investmentAmount, selectedInvestmentType]);

  const formCurrentValue = useMemo(() => {
    const amount = Number(investmentAmount);
    const cagr = Number(formExpectedCagr);
    if (formStartDate > today) return 0;

    const elapsedSipMonths = getSipDurationMonths(formStartDate, today);
    const elapsedLumpsumMonths = Math.max(0, differenceInCalendarDays(parseISO(today), parseISO(formStartDate)) / 365 * 12);
    const calculatedValue = selectedInvestmentType === 'lumpsum'
      ? calculateLumpsumFutureValue(amount, cagr, elapsedLumpsumMonths)
      : calculateSipFutureValue(amount, cagr, elapsedSipMonths);

    return Number.isFinite(calculatedValue) ? Number(calculatedValue.toFixed(2)) : 0;
  }, [formExpectedCagr, formStartDate, investmentAmount, selectedInvestmentType]);

  useEffect(() => {
    if (!dialogOpen || !editingInvestment) return;
    setSelectedInvestmentType(getInvestmentType(editingInvestment));
    setInvestmentAmount(editingInvestment.monthly_sip_amount ? String(editingInvestment.monthly_sip_amount) : '');
    setFormExpectedCagr(editingInvestment.expected_cagr !== undefined ? String(editingInvestment.expected_cagr) : '12');
    setFormStartDate(editingInvestment.start_date || today);
    setFormEndDate(editingInvestment.end_date || defaultEndDate);
  }, [dialogOpen, editingInvestment]);

  const closeDialog = () => {
    setDialogOpen(false);
    setEditingInvestment(null);
  };

  const openCreateDialog = () => {
    setEditingInvestment(null);
    setSelectedInvestmentType('sip');
    setInvestmentAmount('');
    setFormExpectedCagr('12');
    setFormStartDate(today);
    setFormEndDate(defaultEndDate);
    setDialogOpen(true);
  };

  const openEditDialog = (investment: Investment) => {
    setEditingInvestment(investment);
    setDialogOpen(true);
  };

  return {
    dialogOpen,
    editingInvestment,
    selectedInvestmentType,
    investmentAmount,
    formExpectedCagr,
    formStartDate,
    formEndDate,
    formTotalInvested,
    formCurrentValue,
    setDialogOpen,
    setSelectedInvestmentType,
    setInvestmentAmount,
    setFormExpectedCagr,
    setFormStartDate,
    setFormEndDate,
    closeDialog,
    openCreateDialog,
    openEditDialog,
  };
}
