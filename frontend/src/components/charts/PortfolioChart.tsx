import React from 'react';
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from 'recharts';
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from '@shared/components/ui/chart';

interface PortfolioChartProps {
  data?: Array<{
    month: string;
    investments: number;
    returns: number;
    portfolio: number;
  }>;
  className?: string;
}

const chartConfig = {
  investments: {
    label: "Investments",
    color: "#2563eb",
  },
  returns: {
    label: "Returns",
    color: "#16a34a",
  },
  portfolio: {
    label: "Portfolio Value",
    color: "#8b5cf6",
  },
} satisfies ChartConfig;

// Default demo data
const defaultData = [
  { month: 'Jan', investments: 50000, returns: 45000, portfolio: 450000 },
  { month: 'Feb', investments: 75000, returns: 62000, portfolio: 487000 },
  { month: 'Mar', investments: 45000, returns: 58000, portfolio: 500000 },
  { month: 'Apr', investments: 90000, returns: 78000, portfolio: 568000 },
  { month: 'May', investments: 65000, returns: 85000, portfolio: 618000 },
  { month: 'Jun', investments: 120000, returns: 95000, portfolio: 643000 },
];

export const PortfolioChart: React.FC<PortfolioChartProps> = ({ data = defaultData, className = "" }) => {
  return (
    <ChartContainer config={chartConfig} className={`min-h-[200px] w-full ${className}`}>
      <AreaChart accessibilityLayer data={data}>
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
        <Area
          dataKey="portfolio"
          type="natural"
          fill="var(--color-portfolio)"
          fillOpacity={0.4}
          stroke="var(--color-portfolio)"
          stackId="a"
        />
        <Area
          dataKey="investments"
          type="natural"
          fill="var(--color-investments)"
          fillOpacity={0.4}
          stroke="var(--color-investments)"
          stackId="b"
        />
        <Area
          dataKey="returns"
          type="natural"
          fill="var(--color-returns)"
          fillOpacity={0.4}
          stroke="var(--color-returns)"
          stackId="c"
        />
      </AreaChart>
    </ChartContainer>
  );
};