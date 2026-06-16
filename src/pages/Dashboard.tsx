import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line
} from 'recharts';
import api from '@/src/lib/api';
import { format, startOfMonth, endOfMonth, isWithinInterval, parseISO } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { toast } from 'react-toastify';
import { getApiMessage } from '@/src/lib/toastMessages';

const COLORS = ['#2563eb', '#059669', '#d97706', '#e11d48', '#0891b2', '#7c3aed', '#475569'];

export default function Dashboard() {
  const [transactions, setTransactions] = useState<any[]>([]);
  const [recurring, setRecurring] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [tRes, rRes] = await Promise.all([
          api.get('/transactions'),
          api.get('/recurring')
        ]);
        setTransactions(tRes.data);
        setRecurring(rRes.data);
      } catch (error: any) {
        console.error("Failed to fetch dashboard data", error);
        toast.error(getApiMessage(error, "Failed to fetch dashboard data."));
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const currentMonth = startOfMonth(new Date());
  const monthEnd = endOfMonth(new Date());

  const monthTransactions = transactions.filter(t => 
    isWithinInterval(parseISO(t.date), { start: currentMonth, end: monthEnd })
  );

  const totalIncome = monthTransactions
    .filter(t => t.type === 'income')
    .reduce((acc, t) => acc + t.amount, 0);

  const totalExpense = monthTransactions
    .filter(t => t.type === 'expense')
    .reduce((acc, t) => acc + t.amount, 0);

  const balance = totalIncome - totalExpense;

  const categoryData = Object.entries(
    monthTransactions
      .filter(t => t.type === 'expense')
      .reduce((acc: any, t) => {
        acc[t.category] = (acc[t.category] || 0) + t.amount;
        return acc;
      }, {})
  ).map(([name, value]) => ({ name, value }));

  const dailyData = Object.entries(
    monthTransactions
      .filter(t => t.type === 'expense')
      .reduce((acc: any, t) => {
        const day = format(parseISO(t.date), 'dd MMM');
        acc[day] = (acc[day] || 0) + t.amount;
        return acc;
      }, {})
  ).map(([name, amount]) => ({ name, amount })).reverse();

  if (loading) return <div className="flex h-full items-center justify-center text-sm font-semibold text-slate-500">Loading dashboard...</div>;

  return (
    <div className="kt-enter space-y-8">
      <div className="surface-panel metronic-surface rounded-lg p-6">
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
          <div>
            <p className="text-sm font-semibold uppercase text-emerald-600">Financial overview</p>
            <h1 className="mt-2 text-3xl font-black text-slate-950">This month's money movement</h1>
          
          </div>
          <div className="rounded-lg border border-slate-200 bg-white px-4 py-3 text-right">
            <p className="text-xs font-semibold uppercase text-slate-400">Transactions</p>
            <p className="text-2xl font-black text-slate-950">{monthTransactions.length}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="metric-card">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
                <i className="ki-solid ki-arrow-up-right text-lg" data-kt-icon-button />
              </div>
              <Badge variant="outline" className="text-emerald-600 border-emerald-200">Monthly</Badge>
            </div>
            <p className="text-sm text-slate-500 font-medium">Total Income</p>
            <h3 className="text-2xl font-bold mt-1">₹{totalIncome.toLocaleString()}</h3>
          </CardContent>
        </Card>

        <Card className="metric-card">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-rose-50 text-rose-600">
                <i className="ki-solid ki-arrow-down-left text-lg" data-kt-icon-button />
              </div>
              <Badge variant="outline" className="text-rose-600 border-rose-200">Monthly</Badge>
            </div>
            <p className="text-sm text-slate-500 font-medium">Total Expenses</p>
            <h3 className="text-2xl font-bold mt-1">₹{totalExpense.toLocaleString()}</h3>
          </CardContent>
        </Card>

        <Card className="border-none bg-slate-950 text-white shadow-[0_18px_45px_rgba(15,23,42,0.22)]">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-emerald-400 text-slate-950">
                <i className="ki-duotone ki-wallet text-lg" data-kt-icon-button />
              </div>
              <Badge variant="outline" className="text-white border-white/30">Current</Badge>
            </div>
            <p className="text-sm text-slate-300 font-medium">Net Balance</p>
            <h3 className="text-2xl font-bold mt-1">₹{balance.toLocaleString()}</h3>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Spending Trend */}
        <Card className="surface-panel rounded-lg">
          <CardHeader>
            <CardTitle className="text-lg font-semibold">Spending Trend</CardTitle>
          </CardHeader>
          <CardContent className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={dailyData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="name" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis fontSize={12} tickLine={false} axisLine={false} tickFormatter={(v) => `₹${v}`} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#fff', borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                  formatter={(v: any) => [`₹${v}`, 'Amount']}
                />
                <Line type="monotone" dataKey="amount" stroke="#6366f1" strokeWidth={3} dot={{ r: 4, fill: '#6366f1' }} activeDot={{ r: 6 }} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Category Breakdown */}
        <Card className="surface-panel rounded-lg">
          <CardHeader>
            <CardTitle className="text-lg font-semibold">Spending by Category</CardTitle>
          </CardHeader>
          <CardContent className="h-[300px] flex items-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={categoryData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {categoryData.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
            <div className="w-1/2 space-y-2">
              {categoryData.map((item, index) => (
                <div key={item.name} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }}></div>
                    <span className="text-slate-600 dark:text-slate-400">{item.name}</span>
                  </div>
                  <span className="font-medium">₹{item.value.toLocaleString()}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Recent Transactions */}
        <Card className="surface-panel rounded-lg lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg font-semibold">Recent Transactions</CardTitle>
            <Button variant="ghost" size="sm" className="text-indigo-600">View All</Button>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {transactions.slice(0, 5).map((t) => (
                <div key={t.id} className="flex items-center justify-between p-3 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                  <div className="flex items-center gap-4">
                    <div className={cn(
                      "w-10 h-10 rounded-full flex items-center justify-center",
                      t.type === 'income' ? "bg-emerald-50 text-emerald-600" : "bg-rose-50 text-rose-600"
                    )}>
                      <i className={cn("ki-solid text-lg", t.type === 'income' ? "ki-arrow-up-right" : "ki-arrow-down-left")} aria-hidden="true" />
                    </div>
                    <div>
                      <p className="font-medium">{t.description || t.category}</p>
                      <p className="text-xs text-slate-500">{format(parseISO(t.date), 'dd MMM yyyy')} • {t.payment_mode}</p>
                    </div>
                  </div>
                  <p className={cn(
                    "font-bold",
                    t.type === 'income' ? "text-emerald-600" : "text-slate-900 dark:text-white"
                  )}>
                    {t.type === 'income' ? '+' : '-'}₹{t.amount.toLocaleString()}
                  </p>
                </div>
              ))}
              {transactions.length === 0 && <p className="text-center text-slate-500 py-8">No transactions yet.</p>}
            </div>
          </CardContent>
        </Card>

        {/* Recurring Reminders */}
        <Card className="surface-panel rounded-lg">
          <CardHeader>
            <CardTitle className="text-lg font-semibold">Upcoming Payments</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {recurring.map((r) => (
                <div key={r.id} className="flex items-start gap-4 p-3 border border-slate-100 dark:border-slate-800 rounded-xl">
                  <div className="p-2 bg-indigo-50 dark:bg-indigo-900/20 rounded-lg">
                    <i className="ki-outline ki-calendar text-indigo-600" aria-hidden="true" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium">{r.name}</p>
                    <p className="text-xs text-slate-500">Due on {r.day_of_month}th • ₹{r.amount.toLocaleString()}</p>
                  </div>
                  <Badge variant="secondary" className="text-[10px] uppercase">{r.type}</Badge>
                </div>
              ))}
              {recurring.length === 0 && (
                <div className="text-center py-8">
                  <i className="ki-outline ki-warning mx-auto mb-2 text-3xl text-slate-300" aria-hidden="true" />
                  <p className="text-sm text-slate-500">No recurring payments set.</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
