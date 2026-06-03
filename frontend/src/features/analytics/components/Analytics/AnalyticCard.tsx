import React from 'react';
import { TrendingUp, TrendingDown } from 'lucide-react';

interface AnalyticCardProps {
  title: string;
  value: number | string;
  change?: number;
  icon: React.ReactNode;
  description?: string;
  variant?: 'primary' | 'secondary' | 'success' | 'warning' | 'danger';
  format?: 'number' | 'currency' | 'percentage';
}

export const AnalyticCard: React.FC<AnalyticCardProps> = ({
  title,
  value,
  change = 0,
  icon,
  description,
  variant = 'primary',
  format = 'number'
}) => {
  const formatValue = () => {
    const safeValue = value ?? 0;
    
    switch (format) {
      case 'currency':
        return new Intl.NumberFormat('en-US', { 
          style: 'currency', 
          currency: 'USD',
          notation: 'compact'
        }).format(Number(safeValue));
      case 'percentage':
        return `${Number(safeValue).toFixed(1)}%`;
      default:
        return String(safeValue);
    }
  };

  // White cards with the accent confined to the icon chip — keeps a row of KPIs cohesive
  // instead of a rainbow of full-card tints. The passed-in icon keeps its own color; this
  // only sets the soft chip background behind it.
  const chipBg = () => {
    switch (variant) {
      case 'primary': return 'bg-blue-50';
      case 'secondary': return 'bg-indigo-50';
      case 'success': return 'bg-emerald-50';
      case 'warning': return 'bg-amber-50';
      case 'danger': return 'bg-red-50';
    }
  };

  return (
    <div className="group rounded-xl border border-gray-200/70 bg-white p-5 shadow-sm transition-all duration-200 hover:border-gray-300 hover:shadow-md">
      <div className="mb-4 flex items-start justify-between">
        <div className={`inline-flex h-11 w-11 items-center justify-center rounded-xl ${chipBg()} transition-transform duration-200 group-hover:scale-105`}>
          {icon}
        </div>
        {change !== 0 && (
          <span
            className={`inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-xs font-semibold ${
              change > 0 ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'
            }`}
          >
            {change > 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
            {Math.abs(change).toFixed(1)}%
          </span>
        )}
      </div>
      <div>
        <p className="text-2xl font-bold tracking-tight text-gray-900 tabular-nums">{formatValue()}</p>
        <h3 className="mt-0.5 text-sm font-medium text-gray-500">{title}</h3>
        {description && (
          <p className="mt-1 text-xs text-gray-400">{description}</p>
        )}
      </div>
    </div>
  );
};