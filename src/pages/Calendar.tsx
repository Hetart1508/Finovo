import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Calendar } from '@/components/ui/calendar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import api from '@/src/lib/api';
import { format, parseISO, isSameDay } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, Settings } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';

export default function CalendarView() {
  const [date, setDate] = useState<Date | undefined>(new Date());
  const [transactions, setTransactions] = useState<any[]>([]);
  const [threshold, setThreshold] = useState(1000);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [tRes, uRes] = await Promise.all([
          api.get('/transactions'),
          api.get('/auth/login') // This is a hack to get user data if needed, but we'll use localStorage
        ]);
        setTransactions(tRes.data);
        const user = JSON.parse(localStorage.getItem('user') || '{}');
        setThreshold(user.daily_threshold || 1000);
      } catch (error) {
        console.error(error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const handleUpdateThreshold = async () => {
    try {
      await api.patch('/user/threshold', { threshold });
      const user = JSON.parse(localStorage.getItem('user') || '{}');
      localStorage.setItem('user', JSON.stringify({ ...user, daily_threshold: threshold }));
      toast.success("Daily threshold updated!");
    } catch (error) {
      toast.error("Failed to update threshold.");
    }
  };

  const getDailyTotal = (d: Date) => {
    return transactions
      .filter(t => t.type === 'expense' && isSameDay(parseISO(t.date), d))
      .reduce((acc, t) => acc + t.amount, 0);
  };

  const selectedDayTransactions = transactions.filter(t => date && isSameDay(parseISO(t.date), date));
  const selectedDayTotal = date ? getDailyTotal(date) : 0;

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Expense Calendar</h1>
          <p className="text-slate-500">Track your daily spending patterns and stay within limits.</p>
        </div>
        
        <Popover>
          <PopoverTrigger>
            <Button variant="outline" className="gap-2">
              <Settings className="w-4 h-4" />
              Threshold: ₹{threshold}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-80 p-4">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Daily Spending Limit (₹)</Label>
                <p className="text-xs text-slate-500">Dates exceeding this will be highlighted in red.</p>
                <Input 
                  type="number" 
                  value={threshold} 
                  onChange={(e) => setThreshold(parseInt(e.target.value))} 
                />
              </div>
              <Button className="w-full" onClick={handleUpdateThreshold}>Save Threshold</Button>
            </div>
          </PopoverContent>
        </Popover>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <Card className="lg:col-span-2 border-none shadow-sm overflow-hidden">
          <CardContent className="p-0">
            <Calendar
              mode="single"
              selected={date}
              onSelect={setDate}
              className="w-full p-8"
              modifiers={{
                exceeded: (d) => getDailyTotal(d) > threshold,
                spending: (d) => getDailyTotal(d) > 0 && getDailyTotal(d) <= threshold
              }}
              modifiersClassNames={{
                exceeded: "bg-rose-100 text-rose-900 font-bold border-2 border-rose-500 rounded-md",
                spending: "bg-indigo-50 text-indigo-700 rounded-md"
              }}
            />
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card className="border-none shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg">
                {date ? format(date, 'dd MMMM yyyy') : 'Select a date'}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="p-4 bg-slate-50 dark:bg-slate-900 rounded-xl">
                <p className="text-sm text-slate-500">Total Spending</p>
                <div className="flex items-center justify-between mt-1">
                  <h3 className="text-2xl font-bold">₹{selectedDayTotal.toLocaleString()}</h3>
                  {selectedDayTotal > threshold && (
                    <Badge variant="destructive" className="gap-1">
                      <AlertTriangle className="w-3 h-3" />
                      Over Limit
                    </Badge>
                  )}
                </div>
              </div>

              <div className="space-y-3">
                <p className="text-sm font-semibold uppercase tracking-wider text-slate-400">Transactions</p>
                {selectedDayTransactions.length > 0 ? (
                  selectedDayTransactions.map(t => (
                    <div key={t.id} className="flex items-center justify-between py-2 border-b border-slate-100 dark:border-slate-800 last:border-0">
                      <div>
                        <p className="text-sm font-medium">{t.description || t.category}</p>
                        <p className="text-xs text-slate-500">{t.category} • {t.payment_mode}</p>
                      </div>
                      <p className={cn(
                        "text-sm font-bold",
                        t.type === 'income' ? "text-emerald-600" : "text-slate-900 dark:text-white"
                      )}>
                        {t.type === 'income' ? '+' : '-'}₹{t.amount.toLocaleString()}
                      </p>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-slate-500 italic py-4">No transactions on this day.</p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
