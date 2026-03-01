import React from 'react';
import { Line, LineChart, CartesianGrid, XAxis, YAxis } from 'recharts';
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from '@shared/components/ui/chart';

interface EngagementChartProps {
  data?: Array<{
    date: string;
    views: number;
    likes: number;
    shares: number;
  }>;
  className?: string;
}

const chartConfig = {
  views: {
    label: "Views",
    color: "#2563eb",
  },
  likes: {
    label: "Likes", 
    color: "#dc2626",
  },
  shares: {
    label: "Shares",
    color: "#16a34a",
  },
} satisfies ChartConfig;

// Default demo data
const defaultData = [
  { date: 'Jan 1', views: 1200, likes: 89, shares: 23 },
  { date: 'Jan 8', views: 1450, likes: 102, shares: 31 },
  { date: 'Jan 15', views: 1680, likes: 125, shares: 42 },
  { date: 'Jan 22', views: 1520, likes: 110, shares: 38 },
  { date: 'Jan 29', views: 1850, likes: 145, shares: 55 },
  { date: 'Feb 5', views: 2100, likes: 167, shares: 68 },
  { date: 'Feb 12', views: 2350, likes: 198, shares: 78 },
];

export const EngagementChart: React.FC<EngagementChartProps> = ({ data = defaultData, className = "" }) => {
  return (
    <ChartContainer config={chartConfig} className={`min-h-[200px] w-full ${className}`}>
      <LineChart accessibilityLayer data={data}>
        <CartesianGrid vertical={false} />
        <XAxis 
          dataKey="date" 
          tickLine={false} 
          tickMargin={10} 
          axisLine={false} 
        />
        <YAxis
          tickLine={false}
          axisLine={false}
        />
        <ChartTooltip content={<ChartTooltipContent />} />
        <Line
          dataKey="views"
          type="monotone"
          stroke="var(--color-views)"
          strokeWidth={2}
          dot={false}
        />
        <Line
          dataKey="likes"
          type="monotone"
          stroke="var(--color-likes)"
          strokeWidth={2}
          dot={false}
        />
        <Line
          dataKey="shares"
          type="monotone"
          stroke="var(--color-shares)"
          strokeWidth={2}
          dot={false}
        />
      </LineChart>
    </ChartContainer>
  );
};