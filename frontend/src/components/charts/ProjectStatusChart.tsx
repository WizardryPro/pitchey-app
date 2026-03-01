import React from 'react';
import { Pie, PieChart, Cell } from 'recharts';
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from '@shared/components/ui/chart';

interface ProjectStatusChartProps {
  data?: Array<{
    status: string;
    count: number;
  }>;
  className?: string;
}

const chartConfig = {
  development: {
    label: "Development",
    color: "#eab308",
  },
  production: {
    label: "Production", 
    color: "#3b82f6",
  },
  completed: {
    label: "Completed",
    color: "#22c55e",
  },
  released: {
    label: "Released",
    color: "#8b5cf6",
  },
} satisfies ChartConfig;

// Default demo data
const defaultData = [
  { status: 'development', count: 3 },
  { status: 'production', count: 2 },
  { status: 'completed', count: 4 },
  { status: 'released', count: 2 },
];

const COLORS = ['#eab308', '#3b82f6', '#22c55e', '#8b5cf6'];

export const ProjectStatusChart: React.FC<ProjectStatusChartProps> = ({ data = defaultData, className = "" }) => {
  return (
    <ChartContainer config={chartConfig} className={`min-h-[200px] w-full ${className}`}>
      <PieChart>
        <ChartTooltip
          content={
            <ChartTooltipContent 
              formatter={(value, name) => [
                `${value} projects`,
                chartConfig[name as keyof typeof chartConfig]?.label || name
              ]}
            />
          }
        />
        <Pie
          data={data}
          dataKey="count"
          nameKey="status"
          cx="50%"
          cy="50%"
          outerRadius={80}
          fill="#8884d8"
          label={({ status, percent }) => 
            `${chartConfig[status as keyof typeof chartConfig]?.label} ${(percent * 100).toFixed(0)}%`
          }
        >
          {data.map((entry, index) => (
            <Cell 
              key={`cell-${index}`} 
              fill={chartConfig[entry.status as keyof typeof chartConfig]?.color || COLORS[index % COLORS.length]} 
            />
          ))}
        </Pie>
      </PieChart>
    </ChartContainer>
  );
};