import { Card, CardContent, CardHeader, CardTitle } from '@/src/components/ui/card';

export function DashboardChartsSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
      {['Spending Trend', 'Spending by Category'].map((title) => (
        <Card key={title} className="surface-panel rounded-lg">
          <CardHeader>
            <CardTitle className="text-lg font-semibold">{title}</CardTitle>
          </CardHeader>
          <CardContent className="h-[300px]">
            <div className="h-full rounded-lg bg-[#EEF6FF]" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
