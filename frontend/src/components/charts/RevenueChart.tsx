import React from 'react';
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts';
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from '@shared/components/ui/chart';

interface RevenueChartProps {
  data?: Array<{
    month: string;
    revenue: number;
    budget: number;
  }>;
  className?: string;
}

const chartConfig = {
  revenue: {
    label: "Revenue",
    color: "#2563eb",
  },
  budget: {
    label: "Budget",
    color: "#60a5fa",
  },
} satisfies ChartConfig;

// Default demo data
const defaultData = [
  { month: 'Jan', revenue: 180000, budget: 120000 },
  { month: 'Feb', revenue: 220000, budget: 140000 },
  { month: 'Mar', revenue: 190000, budget: 110000 },
  { month: 'Apr', revenue: 270000, budget: 160000 },
  { month: 'May', revenue: 240000, budget: 130000 },
  { month: 'Jun', revenue: 310000, budget: 180000 },
];

export const RevenueChart: React.FC<RevenueChartProps> = ({ data = defaultData, className = "" }) => {
  return (
    <ChartContainer config={chartConfig} className={`min-h-[200px] w-full ${className}`}>
      <BarChart accessibilityLayer data={data}>
        <CartesianGrid vertical={false} />
        <XAxis 
          dataKey="month" 
          tickLine={false} 
          tickMargin={10} 
          axisLine={false} 
        />
        <YAxis
          tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`}
          tickLine={false}
          axisLine={false}
        />
        <ChartTooltip 
          content={
            <ChartTooltipContent 
              formatter={(value) => [`$${Number(value).toLocaleString()}`, ""]}
            />
          } 
        />
        <Bar 
          dataKey="revenue" 
          fill="var(--color-revenue)" 
          radius={4}
        />
        <Bar 
          dataKey="budget" 
          fill="var(--color-budget)" 
          radius={4}
        />
      </BarChart>
    </ChartContainer>
  );
};