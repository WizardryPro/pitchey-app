import React, { useState, useEffect, useCallback } from 'react';
import { TrendingUp, TrendingDown, PieChart, BarChart3, Calendar, Download, Filter } from 'lucide-react';
import { InvestmentService } from '../../services/investment.service';

interface AnalyticsData {
  totalROI: number;
  bestPerforming: {
    id: number;
    pitchTitle: string;
    returnPercentage: number;
    amount: number;
  };
  worstPerforming: {
    id: number;
    pitchTitle: string;
    returnPercentage: number;
    amount: number;
  };
  diversification: {
    byGenre: Record<string, number>;
    byStage: Record<string, number>;
  };
  monthlyPerformance: Array<{
    month: string;
    value: number;
    change: number;
  }>;
}

interface InvestmentAnalyticsProps {
  userType: 'investor' | 'creator' | 'production';
  className?: string;
}

export default function InvestmentAnalytics({ userType, className = '' }: InvestmentAnalyticsProps) {
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState<'3m' | '6m' | '1y' | 'all'>('6m');
  const [selectedMetric, setSelectedMetric] = useState<'value' | 'roi' | 'volume'>('value');

  const fetchAnalytics = useCallback(async () => {
    try {
      setLoading(true);
      
      if (userType === 'investor') {
        const response = await InvestmentService.getPortfolioAnalytics();
        if (response.success && response.data) {
          setAnalytics(response.data as any);
        }
      }
      // Add similar calls for creator and production analytics
      
    } catch (error) {
      console.error('Error fetching analytics:', error);
    } finally {
      setLoading(false);
    }
  }, [userType]);

  useEffect(() => {
    void fetchAnalytics();
  }, [fetchAnalytics]);

  const formatCurrency = useCallback((amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      notation: 'compact',
      maximumFractionDigits: 1
    }).format(amount);
  }, []);

  const formatPercentage = useCallback((percentage: number) => {
    return `${percentage >= 0 ? '+' : ''}${percentage.toFixed(1)}%`;
  }, []);

  const getGenreColors = useCallback((genre: string, index: number) => {
    const colors = [
      'bg-blue-500', 'bg-green-500', 'bg-purple-500', 'bg-yellow-500',
      'bg-red-500', 'bg-indigo-500', 'bg-pink-500', 'bg-gray-500'
    ];
    return colors[index % colors.length];
  }, []);

  const exportAnalytics = useCallback(() => {
    if (!analytics) return;
    
    const data = {
      reportType: 'Investment Analytics',
      timeRange,
      generatedAt: new Date().toISOString(),
      totalROI: analytics.totalROI,
      bestPerforming: analytics.bestPerforming,
      worstPerforming: analytics.worstPerforming,
      diversification: analytics.diversification,
      monthlyPerformance: analytics.monthlyPerformance
    };
    
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `investment-analytics-${timeRange}-${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [analytics, timeRange]);

  if (loading) {
    return (
      <div className={`bg-white rounded-xl shadow-sm p-6 ${className}`}>
        <div className="animate-pulse">
          <div className="h-6 bg-gray-200 rounded w-1/3 mb-4"></div>
          <div className="grid grid-cols-2 gap-4 mb-6">
            <div className="h-32 bg-gray-200 rounded"></div>
            <div className="h-32 bg-gray-200 rounded"></div>
          </div>
          <div className="h-64 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  if (!analytics) {
    return (
      <div className={`bg-white rounded-xl shadow-sm p-6 ${className}`}>
        <div className="text-center py-8">
          <BarChart3 className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-500">No analytics data available</p>
          <p className="text-sm text-gray-400">Make some investments to see analytics</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`bg-white rounded-xl shadow-sm ${className}`}>
      {/* Header */}
      <div className="px-6 py-4 border-b">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <h3 className="text-lg font-semibold text-gray-900">Investment Analytics</h3>
          
          <div className="flex items-center gap-3">
            {/* Time Range Filter */}
            <select
              value={timeRange}
              onChange={(e) => setTimeRange(e.target.value as any)}
              className="text-sm border border-gray-300 rounded-lg px-3 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="3m">Last 3 Months</option>
              <option value="6m">Last 6 Months</option>
              <option value="1y">Last Year</option>
              <option value="all">All Time</option>
            </select>

            {/* Export Button */}
            <button
              onClick={exportAnalytics}
              className="flex items-center gap-2 px-3 py-1 text-sm text-gray-600 hover:text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              <Download className="w-4 h-4" />
              Export
            </button>
          </div>
        </div>
      </div>

      <div className="p-6">
        {/* Performance Overview */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          {/* Best Performing */}
          <div className="bg-green-50 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-3">
              <TrendingUp className="w-5 h-5 text-green-600" />
              <h4 className="font-medium text-green-900">Best Performing</h4>
            </div>
            <h5 className="font-semibold text-gray-900 mb-1">{analytics.bestPerforming.pitchTitle}</h5>
            <p className="text-lg font-bold text-green-600">
              {formatPercentage(analytics.bestPerforming.returnPercentage)}
            </p>
            <p className="text-sm text-gray-600">
              {formatCurrency(analytics.bestPerforming.amount)} invested
            </p>
          </div>

          {/* Worst Performing */}
          <div className="bg-red-50 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-3">
              <TrendingDown className="w-5 h-5 text-red-600" />
              <h4 className="font-medium text-red-900">Needs Attention</h4>
            </div>
            <h5 className="font-semibold text-gray-900 mb-1">{analytics.worstPerforming.pitchTitle}</h5>
            <p className="text-lg font-bold text-red-600">
              {formatPercentage(analytics.worstPerforming.returnPercentage)}
            </p>
            <p className="text-sm text-gray-600">
              {formatCurrency(analytics.worstPerforming.amount)} invested
            </p>
          </div>
        </div>

        {/* Monthly Performance Chart */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h4 className="font-medium text-gray-900">Performance Trend</h4>
            <select
              value={selectedMetric}
              onChange={(e) => setSelectedMetric(e.target.value as any)}
              className="text-sm border border-gray-300 rounded px-2 py-1"
            >
              <option value="value">Portfolio Value</option>
              <option value="roi">ROI %</option>
              <option value="volume">Investment Volume</option>
            </select>
          </div>
          
          <div className="h-64 flex items-end space-x-2">
            {analytics.monthlyPerformance.map((month, index) => (
              <div key={index} className="flex-1 flex flex-col items-center">
                <div
                  className="w-full bg-blue-500 rounded-t"
                  style={{
                    height: `${Math.max(10, (month.value / Math.max(...analytics.monthlyPerformance.map(m => m.value))) * 200)}px`
                  }}
                ></div>
                <div className="mt-2 text-xs text-gray-600 text-center">
                  <p className="font-medium">{month.month}</p>
                  <p className={month.change >= 0 ? 'text-green-600' : 'text-red-600'}>
                    {formatPercentage(month.change)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Diversification */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* By Genre */}
          <div>
            <h4 className="font-medium text-gray-900 mb-4">Diversification by Genre</h4>
            <div className="space-y-3">
              {Object.entries(analytics.diversification.byGenre).map(([genre, percentage], index) => (
                <div key={genre} className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`w-3 h-3 rounded-full ${getGenreColors(genre, index)}`}></div>
                    <span className="text-sm text-gray-700">{genre}</span>
                  </div>
                  <span className="text-sm font-medium text-gray-900">{percentage.toFixed(1)}%</span>
                </div>
              ))}
            </div>
          </div>

          {/* By Stage */}
          <div>
            <h4 className="font-medium text-gray-900 mb-4">Diversification by Stage</h4>
            <div className="space-y-3">
              {Object.entries(analytics.diversification.byStage).map(([stage, percentage], index) => (
                <div key={stage} className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`w-3 h-3 rounded-full ${getGenreColors(stage, index)}`}></div>
                    <span className="text-sm text-gray-700">{stage}</span>
                  </div>
                  <span className="text-sm font-medium text-gray-900">{percentage.toFixed(1)}%</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Overall ROI */}
        <div className="mt-8 p-4 bg-gray-50 rounded-lg">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <PieChart className="w-5 h-5 text-gray-600" />
              <span className="font-medium text-gray-900">Overall Portfolio ROI</span>
            </div>
            <span className={`text-xl font-bold ${analytics.totalROI >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {formatPercentage(analytics.totalROI)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}