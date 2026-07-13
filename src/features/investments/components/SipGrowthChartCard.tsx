import { Card, CardContent, CardHeader, CardTitle } from '@/src/components/ui/card';
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { RiLineChartLine } from 'react-icons/ri';
import { currency } from '../investments.utils';

type GrowthPoint = {
  label: string;
  estimatedValue: number;
  contributedAmount: number;
};

type SipGrowthChartCardProps = {
  growthData: GrowthPoint[];
};

export function SipGrowthChartCard({ growthData }: SipGrowthChartCardProps) {
  return (
    <Card className="surface-panel rounded-lg">
      <CardHeader>
        <CardTitle className="text-lg font-semibold">Projected SIP Growth</CardTitle>
        <p className="text-sm text-[#6B7280]">Month-wise up to 3 years, then year-wise for longer plans.</p>
      </CardHeader>
      <CardContent className="h-[360px]">
        {growthData.length ? (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={growthData} margin={{ top: 8, right: 12, left: 8, bottom: 8 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
              <XAxis dataKey="label" fontSize={12} tickLine={false} axisLine={false} minTickGap={24} />
              <YAxis fontSize={12} tickLine={false} axisLine={false} width={72} tickFormatter={(value) => `₹${Math.round(Number(value) / 1000)}k`} />
              <Tooltip
                position={{ x: 88, y: 8 }}
                isAnimationActive={false}
                cursor={false}
                formatter={(value: any, name: string) => [currency.format(Number(value)), name === 'estimatedValue' ? 'Estimated Value' : 'Contributed']}
                labelFormatter={(label) => `Duration: ${label}`}
                contentStyle={{ backgroundColor: '#fff', borderRadius: '8px', border: '1px solid #E5E7EB', boxShadow: '0 12px 30px rgba(31,41,55,0.12)' }}
                wrapperStyle={{ pointerEvents: 'none' }}
              />
              <Legend formatter={(value) => value === 'estimatedValue' ? 'Estimated Value' : 'Contributed Amount'} />
              <Line type="monotone" dataKey="estimatedValue" stroke="#4F9CF9" strokeWidth={3} dot={false} activeDot={{ r: 5 }} />
              <Line type="monotone" dataKey="contributedAmount" stroke="#FFB84D" strokeWidth={2} strokeDasharray="5 5" dot={false} />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex h-full flex-col items-center justify-center rounded-lg border border-dashed border-[#DCE3EC] bg-[#FAFBFC] px-6 text-center">
            <RiLineChartLine className="text-4xl text-[#4F9CF9]" aria-hidden="true" />
            <p className="mt-3 font-semibold">Enter a valid SIP plan to see its growth</p>
            <p className="mt-1 max-w-sm text-sm text-[#6B7280]">The end date must be after the start date and the monthly amount must be greater than zero.</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
