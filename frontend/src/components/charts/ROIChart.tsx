import React from 'react';
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts';
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from '@shared/components/ui/chart';

interface ROIChartProps {
  data?: Array<{
    project: string;
    roi: number;
    revenue: number;
  }>;
  className?: string;
}

const chartConfig = {
  roi: {
    label: "ROI",
    color: "#16a34a",
  },
} satisfies ChartConfig;

// Default demo data
const defaultData = [
  { project: 'Last Symphony', roi: 165, revenue: 850000 },
  { project: 'Midnight Heist', roi: 234, revenue: 1200000 },
  { project: 'Silent Echo', roi: 89, revenue: 450000 },
  { project: 'Urban Dreams', roi: 198, revenue: 980000 },
  { project: 'Dark Waters', roi: 145, revenue: 720000 },
];

export const ROIChart: React.FC<ROIChartProps> = ({ data = defaultData, className = "" }) => {
  return (
    <ChartContainer config={chartConfig} className={`min-h-[200px] w-full ${className}`}>
      <BarChart accessibilityLayer data={data} layout="horizontal">
        <CartesianGrid horizontal={false} />
        <XAxis 
          type="number"
          tickFormatter={(value) => `${value}%`}
          tickLine={false}
          axisLine={false}
        />
        <YAxis 
          type="category"
          dataKey="project" 
          tickLine={false} 
          tickMargin={10} 
          axisLine={false}
          width={80}
        />
        <ChartTooltip 
          content={
            <ChartTooltipContent 
              formatter={(value, name) => [
                name === 'roi' ? `${value}%` : `$${Number(value).toLocaleString()}`,
                name === 'roi' ? 'ROI' : 'Revenue'
              ]}
            />
          } 
        />
        <Bar 
          dataKey="roi" 
          fill="var(--color-roi)" 
          radius={4}
        />
      </BarChart>
    </ChartContainer>
  );
};