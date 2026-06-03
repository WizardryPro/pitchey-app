import React from 'react';
import {
  LineChart as RechartsLineChart,
  Line,
  BarChart as RechartsBarChart,
  Bar,
  PieChart as RechartsPieChart,
  Pie,
  Cell,
  AreaChart as RechartsAreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts';

export interface ChartDataPoint {
  date: string;
  value: number;
  label?: string;
}

export interface CategoryData {
  category: string;
  value: number;
  count?: number;
}

// Common chart options
const commonOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: {
      position: 'top' as const,
    },
  },
  scales: {
    x: {
      grid: {
        display: false,
      },
    },
    y: {
      grid: {
        color: 'rgba(0, 0, 0, 0.1)',
      },
      beginAtZero: true,
    },
  },
};

const pieOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: {
      position: 'right' as const,
    },
  },
};

// Colors for charts
const colors = {
  primary: '#3B82F6',
  secondary: '#10B981',
  accent: '#F59E0B',
  danger: '#EF4444',
  purple: '#8B5CF6',
  pink: '#EC4899',
  indigo: '#6366F1',
  teal: '#14B8A6',
};

const chartColors = [
  colors.primary,
  colors.secondary,
  colors.accent,
  colors.purple,
  colors.pink,
  colors.indigo,
  colors.teal,
  colors.danger,
];

// Line Chart Component
interface LineChartProps {
  data: ChartDataPoint[];
  title?: string;
  color?: string;
  fill?: boolean;
  height?: number;
}

export const LineChart: React.FC<LineChartProps> = ({
  data,
  title = 'Line Chart',
  color = colors.primary,
  fill = false,
  height = 300,
}) => {
  return (
    <div style={{ height }} className="bg-white rounded-lg border border-gray-200 p-4">
      <h4 className="text-lg font-medium text-gray-900 mb-4">{title}</h4>
      <ResponsiveContainer width="100%" height={height - 60}>
        <RechartsLineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis 
            dataKey="date" 
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: 12, fill: '#666' }}
          />
          <YAxis 
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: 12, fill: '#666' }}
          />
          <Tooltip 
            contentStyle={{
              backgroundColor: 'white',
              border: '1px solid #e5e7eb',
              borderRadius: '8px',
              boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
            }}
          />
          <Line 
            type="monotone" 
            dataKey="value" 
            stroke={color}
            strokeWidth={2}
            fill={fill ? color : 'none'}
            fillOpacity={fill ? 0.1 : 0}
            dot={{ fill: color, strokeWidth: 2, r: 4 }}
            activeDot={{ r: 6, stroke: color, strokeWidth: 2 }}
          />
        </RechartsLineChart>
      </ResponsiveContainer>
    </div>
  );
};

// Bar Chart Component
interface BarChartProps {
  data: CategoryData[];
  title?: string;
  color?: string;
  horizontal?: boolean;
  height?: number;
}

export const BarChart: React.FC<BarChartProps> = ({
  data,
  title = 'Bar Chart',
  color = colors.primary,
  horizontal = false,
  height = 300,
}) => {
  return (
    <div style={{ height }} className="bg-white rounded-lg border border-gray-200 p-4">
      <h4 className="text-lg font-medium text-gray-900 mb-4">{title}</h4>
      <ResponsiveContainer width="100%" height={height - 60}>
        <RechartsBarChart 
          data={data}
          layout={horizontal ? 'vertical' : 'horizontal'}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          {horizontal ? (
            <>
              <XAxis 
                type="number"
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 12, fill: '#666' }}
              />
              <YAxis 
                type="category"
                dataKey="category"
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 12, fill: '#666' }}
              />
            </>
          ) : (
            <>
              <XAxis 
                type="category"
                dataKey="category"
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 12, fill: '#666' }}
              />
              <YAxis 
                type="number"
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 12, fill: '#666' }}
              />
            </>
          )}
          <Tooltip 
            contentStyle={{
              backgroundColor: 'white',
              border: '1px solid #e5e7eb',
              borderRadius: '8px',
              boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
            }}
          />
          <Bar 
            dataKey="value" 
            fill={color}
            radius={[2, 2, 0, 0]}
          />
        </RechartsBarChart>
      </ResponsiveContainer>
    </div>
  );
};

// Multi-Line Chart Component
interface MultiLineChartProps {
  datasets: {
    label: string;
    data: ChartDataPoint[];
    color: string;
  }[];
  height?: number;
}

export const MultiLineChart: React.FC<MultiLineChartProps> = ({
  datasets,
  height = 300,
}) => {
  // Combine all datasets into one data array for Recharts
  const combinedData = datasets[0]?.data.map((point, index) => {
    const dataPoint: any = { date: point.date };
    datasets.forEach((dataset) => {
      dataPoint[dataset.label] = dataset.data[index]?.value || 0;
    });
    return dataPoint;
  }) || [];

  return (
    <div style={{ height }} className="bg-white rounded-lg border border-gray-200 p-4">
      <h4 className="text-lg font-medium text-gray-900 mb-4">Multi-Line Chart</h4>
      <ResponsiveContainer width="100%" height={height - 60}>
        <RechartsLineChart data={combinedData}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis 
            dataKey="date" 
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: 12, fill: '#666' }}
          />
          <YAxis 
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: 12, fill: '#666' }}
          />
          <Tooltip 
            contentStyle={{
              backgroundColor: 'white',
              border: '1px solid #e5e7eb',
              borderRadius: '8px',
              boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
            }}
          />
          <Legend />
          {datasets.map((dataset, index) => (
            <Line 
              key={dataset.label}
              type="monotone" 
              dataKey={dataset.label}
              stroke={dataset.color}
              strokeWidth={2}
              dot={{ fill: dataset.color, strokeWidth: 2, r: 4 }}
              activeDot={{ r: 6, stroke: dataset.color, strokeWidth: 2 }}
            />
          ))}
        </RechartsLineChart>
      </ResponsiveContainer>
    </div>
  );
};

// Pie Chart Component
interface PieChartProps {
  data: CategoryData[];
  title?: string;
  type?: 'pie' | 'doughnut';
  height?: number;
}

export const PieChart: React.FC<PieChartProps> = ({
  data,
  title = 'Distribution',
  type = 'pie',
  height = 300,
}) => {
  return (
    <div style={{ height }} className="bg-white rounded-lg border border-gray-200 p-4">
      <h4 className="text-lg font-medium text-gray-900 mb-4">{title}</h4>
      <ResponsiveContainer width="100%" height={height - 60}>
        <RechartsPieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            outerRadius={type === 'doughnut' ? 80 : 60}
            innerRadius={type === 'doughnut' ? 40 : 0}
            fill="#8884d8"
            dataKey="value"
            label={({ category, percent }) => `${category} ${(percent * 100).toFixed(0)}%`}
          >
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={chartColors[index % chartColors.length]} />
            ))}
          </Pie>
          <Tooltip 
            contentStyle={{
              backgroundColor: 'white',
              border: '1px solid #e5e7eb',
              borderRadius: '8px',
              boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
            }}
          />
          <Legend />
        </RechartsPieChart>
      </ResponsiveContainer>
    </div>
  );
};

// Area Chart Component
interface AreaChartProps {
  data: ChartDataPoint[];
  title?: string;
  color?: string;
  height?: number;
}

export const AreaChart: React.FC<AreaChartProps> = ({
  data,
  title = 'Area Chart',
  color = colors.primary,
  height = 300,
}) => {
  // Determine if all values are zero to set a visible Y domain
  const maxValue = data.reduce((max, d) => Math.max(max, d.value || 0), 0);
  const yDomain: [number, string | number] = maxValue === 0 ? [0, 100] : [0, 'auto'];

  return (
    <div style={{ height }} className="bg-white rounded-lg border border-gray-200 p-4">
      <h4 className="text-lg font-medium text-gray-900 mb-4">{title}</h4>
      <ResponsiveContainer width="100%" height={height - 60}>
        <RechartsAreaChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis
            dataKey="date"
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: 12, fill: '#666' }}
          />
          <YAxis
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: 12, fill: '#666' }}
            domain={yDomain}
          />
          <Tooltip 
            contentStyle={{
              backgroundColor: 'white',
              border: '1px solid #e5e7eb',
              borderRadius: '8px',
              boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
            }}
          />
          <Area 
            type="monotone" 
            dataKey="value" 
            stroke={color}
            strokeWidth={2}
            fill={color}
            fillOpacity={0.1}
          />
        </RechartsAreaChart>
      </ResponsiveContainer>
    </div>
  );
};

// Stacked Bar Chart Component
interface StackedBarChartProps {
  data: {
    category: string;
    values: { label: string; value: number }[];
  }[];
  height?: number;
}

export const StackedBarChart: React.FC<StackedBarChartProps> = ({
  data,
  height = 300,
}) => {
  // Transform data for Recharts
  const chartData = data.map(item => {
    const dataPoint: any = { category: item.category };
    item.values.forEach(val => {
      dataPoint[val.label] = val.value;
    });
    return dataPoint;
  });

  // Get all unique labels for stacked bars
  const allLabels = Array.from(new Set(data.flatMap(item => item.values.map(val => val.label))));

  return (
    <div style={{ height }} className="bg-white rounded-lg border border-gray-200 p-4">
      <h4 className="text-lg font-medium text-gray-900 mb-4">Stacked Bar Chart</h4>
      <ResponsiveContainer width="100%" height={height - 60}>
        <RechartsBarChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis 
            dataKey="category"
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: 12, fill: '#666' }}
          />
          <YAxis 
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: 12, fill: '#666' }}
          />
          <Tooltip 
            contentStyle={{
              backgroundColor: 'white',
              border: '1px solid #e5e7eb',
              borderRadius: '8px',
              boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
            }}
          />
          <Legend />
          {allLabels.map((label, index) => (
            <Bar 
              key={label}
              dataKey={label}
              stackId="stack"
              fill={chartColors[index % chartColors.length]}
            />
          ))}
        </RechartsBarChart>
      </ResponsiveContainer>
    </div>
  );
};

// Metric Card Component
interface MetricCardProps {
  title: string;
  value: string | number;
  change?: number;
  changeType?: 'increase' | 'decrease' | 'neutral';
  format?: 'number' | 'currency' | 'percentage';
  icon?: React.ReactNode;
  className?: string;
}

export const MetricCard: React.FC<MetricCardProps> = ({
  title,
  value,
  change,
  changeType = 'neutral',
  format = 'number',
  icon,
  className = '',
}) => {
  const formatValue = (val: string | number) => {
    if (format === 'currency') {
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      }).format(Number(val));
    }
    if (format === 'percentage') {
      return `${val}%`;
    }
    if (typeof val === 'number' && val >= 1000) {
      return new Intl.NumberFormat('en-US', {
        notation: 'compact',
        maximumFractionDigits: 1,
      }).format(val);
    }
    return val.toString();
  };

  const getChangeColor = () => {
    switch (changeType) {
      case 'increase':
        return 'text-green-600';
      case 'decrease':
        return 'text-red-600';
      default:
        return 'text-gray-600';
    }
  };

  const getChangeIcon = () => {
    switch (changeType) {
      case 'increase':
        return '↗';
      case 'decrease':
        return '↘';
      default:
        return '→';
    }
  };

  return (
    <div className={`bg-white rounded-lg shadow-md p-6 ${className}`}>
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <p className="text-sm font-medium text-gray-600 mb-1">{title}</p>
          <p className="text-2xl font-bold text-gray-900">{formatValue(value)}</p>
          {change !== undefined && (
            <p className={`text-sm mt-1 ${getChangeColor()}`}>
              <span className="inline-flex items-center">
                {getChangeIcon()}
                <span className="ml-1">
                  {Math.abs(change)}% vs last period
                </span>
              </span>
            </p>
          )}
        </div>
        {icon && (
          <div className="ml-4 text-2xl text-gray-400">
            {icon}
          </div>
        )}
      </div>
    </div>
  );
};

// Chart Container Component
interface ChartContainerProps {
  title: string;
  children: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}

export const ChartContainer: React.FC<ChartContainerProps> = ({
  title,
  children,
  actions,
  className = '',
}) => {
  return (
    <div className={`bg-white rounded-xl border border-gray-200/70 shadow-sm ${className}`}>
      <div className="flex items-center justify-between p-4 border-b border-gray-100">
        <h3 className="text-base font-semibold text-gray-900">{title}</h3>
        {actions && <div className="flex space-x-2">{actions}</div>}
      </div>
      <div className="p-4">
        {children}
      </div>
    </div>
  );
};

export default {
  LineChart,
  BarChart,
  MultiLineChart,
  PieChart,
  AreaChart,
  StackedBarChart,
  MetricCard,
  ChartContainer,
};