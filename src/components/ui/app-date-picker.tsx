import { useState } from 'react';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { format, parseISO } from 'date-fns';
import { RiCalendarLine } from 'react-icons/ri';
import { Input } from '@/src/components/ui/input';
import { cn } from '@/lib/utils';

type AppDatePickerProps = {
  id?: string;
  name?: string;
  value?: string;
  defaultValue?: string;
  onChange?: (value: string) => void;
  min?: string;
  max?: string;
  required?: boolean;
  placeholder?: string;
  className?: string;
};

const toDate = (value?: string) => {
  if (!value) return null;
  const date = parseISO(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

export function AppDatePicker({
  id,
  name,
  value,
  defaultValue = '',
  onChange,
  min,
  max,
  required,
  placeholder = 'Select date',
  className,
}: AppDatePickerProps) {
  const [internalValue, setInternalValue] = useState(defaultValue);
  const selectedValue = value === undefined ? internalValue : value;

  const updateValue = (date: Date | null) => {
    const nextValue = date ? format(date, 'yyyy-MM-dd') : '';
    if (value === undefined) setInternalValue(nextValue);
    onChange?.(nextValue);
  };

  return (
    <div className={cn('relative w-full', className)}>
      <DatePicker
        selected={toDate(selectedValue)}
        onChange={updateValue}
        minDate={toDate(min) || undefined}
        maxDate={toDate(max) || undefined}
        dateFormat="dd MMM yyyy"
        placeholderText={placeholder}
        showMonthDropdown
        showYearDropdown
        dropdownMode="select"
        calendarStartDay={1}
        showPopperArrow={false}
        popperPlacement="bottom-start"
        popperClassName="modern-date-popper"
        calendarClassName="modern-date-calendar"
        customInput={<Input id={id} className="cursor-pointer bg-white pr-10 dark:bg-[#111827]" readOnly />}
      />
      <RiCalendarLine className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-lg text-[#4F9CF9]" aria-hidden="true" />
      {name ? <input type="hidden" name={name} value={selectedValue} required={required} /> : null}
    </div>
  );
}
