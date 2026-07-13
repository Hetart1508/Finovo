import {
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/src/components/ui/card';
import { formatRupees } from '@/src/utils/formatters';

type DailyDataPoint = {
  name: string;
  amount: number;
};

type CategoryDataPoint = {
  name: string;
  value: number;
};

type DashboardChartsProps = {
  dailyData: DailyDataPoint[];
  categoryData: CategoryDataPoint[];
  colors: string[];
};

export default function DashboardCharts({ dailyData, categoryData, colors }: DashboardChartsProps) {
  return (
    <div className="grid grid-cols-1 gap-5 sm:gap-8 lg:grid-cols-2">
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
                position={{ x: 68, y: 8 }}
                isAnimationActive={false}
                contentStyle={{ backgroundColor: '#fff', borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                formatter={(v: unknown) => [`₹${v}`, 'Amount']}
                wrapperStyle={{ pointerEvents: 'none' }}
              />
              <Line type="monotone" dataKey="amount" stroke="#4F9CF9" strokeWidth={3} dot={{ r: 4, fill: '#4F9CF9' }} activeDot={{ r: 6 }} />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card className="surface-panel rounded-lg">
        <CardHeader>
          <CardTitle className="text-lg font-semibold">Spending by Category</CardTitle>
        </CardHeader>
        <CardContent className="flex h-[300px] items-center">
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
                  <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />
                ))}
              </Pie>
              <Tooltip
                position={{ x: 8, y: 8 }}
                isAnimationActive={false}
                wrapperStyle={{ pointerEvents: 'none' }}
              />
            </PieChart>
          </ResponsiveContainer>
          <div className="w-1/2 space-y-2">
            {categoryData.map((item, index) => (
              <div key={item.name} className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <div className="h-3 w-3 rounded-full" style={{ backgroundColor: colors[index % colors.length] }} />
                  <span className="text-[#6B7280]">{item.name}</span>
                </div>
                <span className="font-medium">{formatRupees(item.value)}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
