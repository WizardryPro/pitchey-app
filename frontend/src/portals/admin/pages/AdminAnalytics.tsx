import React, { useState, useEffect } from 'react';
import { BarChart3, Users, Film, DollarSign, TrendingUp, TrendingDown } from 'lucide-react';
import { adminService } from '../services/admin.service';

type Timeframe = '24h' | '7d' | '30d' | '90d';

export default function AdminAnalytics() {
  const [timeframe, setTimeframe] = useState<Timeframe>('30d');
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    adminService.getAnalytics(timeframe)
      .then((result) => {
        if (!cancelled) setData(result);
      })
      .catch((err) => {
        const e = err instanceof Error ? err : new Error(String(err));
        if (!cancelled) setError(e.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [timeframe]);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900">Platform Analytics</h1>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-white rounded-lg border border-gray-200 p-6 animate-pulse">
              <div className="h-4 bg-gray-200 rounded w-1/2 mb-4"></div>
              <div className="h-8 bg-gray-200 rounded w-3/4"></div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-gray-900">Platform Analytics</h1>
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          Failed to load analytics: {error}
        </div>
      </div>
    );
  }

  const userGrowth = data?.userGrowth ?? {};
  const contentMetrics = data?.contentMetrics ?? {};
  const financialMetrics = data?.financialMetrics ?? {};
  const topGenres = data?.topGenres ?? [];
  const engagement = data?.engagementMetrics ?? {};

  const stats = [
    {
      label: 'New Users',
      value: userGrowth.newUsers ?? 0,
      change: userGrowth.growthRate ?? 0,
      icon: Users,
      color: 'purple',
    },
    {
      label: 'New Pitches',
      value: contentMetrics.newPitches ?? 0,
      change: contentMetrics.growthRate ?? 0,
      icon: Film,
      color: 'blue',
    },
    {
      label: 'Revenue',
      value: `$${(financialMetrics.revenue ?? 0).toLocaleString()}`,
      change: financialMetrics.revenueGrowthRate ?? 0,
      icon: DollarSign,
      color: 'green',
    },
    {
      label: 'Active Users',
      value: engagement.activeUsers ?? 0,
      change: engagement.activityGrowthRate ?? 0,
      icon: BarChart3,
      color: 'indigo',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Platform Analytics</h1>
        <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
          {(['24h', '7d', '30d', '90d'] as Timeframe[]).map((tf) => (
            <button
              key={tf}
              onClick={() => setTimeframe(tf)}
              className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                timeframe === tf
                  ? 'bg-white text-purple-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              {tf}
            </button>
          ))}
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat) => {
          const Icon = stat.icon;
          const isPositive = stat.change >= 0;
          return (
            <div key={stat.label} className="bg-white rounded-lg border border-gray-200 p-6">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-gray-500">{stat.label}</span>
                <Icon className={`w-5 h-5 text-${stat.color}-600`} />
              </div>
              <div className="text-2xl font-bold text-gray-900">{stat.value}</div>
              <div className={`flex items-center gap-1 mt-1 text-sm ${isPositive ? 'text-green-600' : 'text-red-600'}`}>
                {isPositive ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                <span>{Math.abs(stat.change).toFixed(1)}%</span>
                <span className="text-gray-400 ml-1">vs previous</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* User Breakdown + Top Genres */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* User Breakdown */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">User Breakdown</h3>
          <div className="space-y-3">
            {[
              { label: 'Creators', value: userGrowth.creators ?? 0, color: 'bg-purple-500' },
              { label: 'Investors', value: userGrowth.investors ?? 0, color: 'bg-green-500' },
              { label: 'Production', value: userGrowth.production ?? 0, color: 'bg-blue-500' },
            ].map((item) => {
              const total = (userGrowth.creators ?? 0) + (userGrowth.investors ?? 0) + (userGrowth.production ?? 0);
              const pct = total > 0 ? (item.value / total) * 100 : 0;
              return (
                <div key={item.label}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-gray-600">{item.label}</span>
                    <span className="font-medium">{item.value}</span>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-2">
                    <div className={`${item.color} h-2 rounded-full`} style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Top Genres */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Top Genres</h3>
          {topGenres.length === 0 ? (
            <p className="text-sm text-gray-500">No genre data available.</p>
          ) : (
            <div className="space-y-3">
              {topGenres.slice(0, 6).map((genre: any, idx: number) => (
                <div key={idx} className="flex items-center justify-between">
                  <span className="text-sm text-gray-700">{genre.name ?? genre.genre ?? `Genre ${idx + 1}`}</span>
                  <span className="text-sm font-medium text-gray-900">{genre.count ?? genre.pitches ?? 0} pitches</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Financial Summary */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Financial Summary</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div>
            <p className="text-sm text-gray-500">Total Revenue</p>
            <p className="text-xl font-bold text-gray-900">${(financialMetrics.revenue ?? 0).toLocaleString()}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Total Transactions</p>
            <p className="text-xl font-bold text-gray-900">{(financialMetrics.totalTransactions ?? 0).toLocaleString()}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Avg Transaction</p>
            <p className="text-xl font-bold text-gray-900">${(financialMetrics.avgTransaction ?? 0).toFixed(2)}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
