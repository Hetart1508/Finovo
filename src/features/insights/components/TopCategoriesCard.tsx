import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/src/components/ui/card';
import type { TopCategoryDataPoint } from '../insights.types';

type TopCategoriesCardProps = {
  categoryData: TopCategoryDataPoint[];
  loading: boolean;
};

export function TopCategoriesCard({ categoryData, loading }: TopCategoriesCardProps) {
  return (
    <Card className="border-none shadow-sm h-[320px]">
      <CardHeader>
        <CardTitle className="text-lg">Top Categories</CardTitle>
      </CardHeader>
      <CardContent className="h-[250px]">
        {loading ? (
          <div className="h-full flex items-center justify-center text-[#6B7280]">Loading data...</div>
        ) : categoryData.length === 0 ? (
          <div className="h-full flex items-center justify-center text-[#6B7280]">No data</div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={categoryData}>
              <CartesianGrid strokeDasharray="3" vertical={false} />
              <XAxis dataKey="name" fontSize={12} />
              <YAxis tickFormatter={(value) => `₹${value}`} fontSize={11} />
              <Tooltip
                position={{ x: 68, y: 8 }}
                isAnimationActive={false}
                wrapperStyle={{ pointerEvents: 'none' }}
              />
              <Bar dataKey="value" fill="#4F9CF9" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
