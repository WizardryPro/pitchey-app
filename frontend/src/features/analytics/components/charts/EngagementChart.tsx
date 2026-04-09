import React from 'react';
import { Line, LineChart, CartesianGrid, XAxis, YAxis } from 'recharts';
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from '@shared/components/ui/chart';

interface EngagementChartProps {
  data?: Array<{
    date: string;
    views: number;
    ratings: number;
    shares: number;
  }>;
  className?: string;
}

const chartConfig = {
  views: {
    label: "Views",
    color: "#2563eb",
  },
  ratings: {
    label: "Ratings",
    color: "#9333ea",
  },
  shares: {
    label: "Shares",
    color: "#16a34a",
  },
} satisfies ChartConfig;

export const EngagementChart: React.FC<EngagementChartProps> = ({ data = [], className = "" }) => {
  if (data.length === 0) {
    return (
      <div className={`flex items-center justify-center min-h-[200px] w-full text-gray-400 text-sm ${className}`}>
        No engagement data available
      </div>
    );
  }

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
          dataKey="ratings"
          type="monotone"
          stroke="var(--color-ratings)"
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