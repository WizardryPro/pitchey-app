import React from 'react';
import { Line, LineChart, CartesianGrid, XAxis, YAxis } from 'recharts';
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from '@shared/components/ui/chart';

interface DataPoint {
  label: string;
  value: number;
}

interface PerformanceChartProps {
  title: string;
  datasets: {
    label: string;
    data: DataPoint[];
    color: string;
  }[];
  currency?: boolean;
}

export const PerformanceChart: React.FC<PerformanceChartProps> = ({ 
  title, 
  datasets,
  currency = false 
}) => {
  // Transform the data structure to work with Recharts
  const transformedData = React.useMemo(() => {
    if (!datasets.length || !datasets[0]?.data.length) {
      return [];
    }

    // Get all unique labels
    const labels = datasets[0].data.map(item => item.label);
    
    // Transform to chart data format
    return labels.map(label => {
      const dataPoint: Record<string, string | number> = { label };
      datasets.forEach(dataset => {
        const point = dataset.data.find(d => d.label === label);
        (dataPoint as Record<string, number | string>)[dataset.label.toLowerCase()] = point?.value ?? 0;
      });
      return dataPoint;
    });
  }, [datasets]);

  // Create chart config based on datasets
  const chartConfig = React.useMemo(() => {
    const config: ChartConfig = {};
    datasets.forEach(dataset => {
      config[dataset.label.toLowerCase()] = {
        label: dataset.label,
        color: dataset.color,
      };
    });
    return config;
  }, [datasets]);

  return (
    <div className="w-full">
      <h3 className="text-lg font-medium text-gray-900 mb-4">{title}</h3>
      <ChartContainer config={chartConfig} className="min-h-[200px] w-full">
        <LineChart accessibilityLayer data={transformedData}>
          <CartesianGrid vertical={false} />
          <XAxis 
            dataKey="label" 
            tickLine={false} 
            tickMargin={10} 
            axisLine={false} 
          />
          <YAxis
            tickLine={false}
            axisLine={false}
            tickFormatter={(value: number) =>
              currency
                ? `$${(value / 1000).toFixed(0)}k`
                : value.toLocaleString()
            }
          />
          <ChartTooltip 
            content={
              <ChartTooltipContent 
                formatter={(value) => [
                  currency 
                    ? `$${Number(value).toLocaleString()}` 
                    : Number(value).toLocaleString(),
                  ""
                ]}
              />
            } 
          />
          {datasets.map(dataset => (
            <Line
              key={dataset.label}
              dataKey={dataset.label.toLowerCase()}
              type="monotone"
              stroke={dataset.color}
              strokeWidth={2}
              dot={false}
            />
          ))}
        </LineChart>
      </ChartContainer>
    </div>
  );
};