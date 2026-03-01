import { useState, useEffect } from 'react';
import { 
  TrendingUp, TrendingDown, DollarSign, Target, Award,
  Calendar, BarChart3, PieChart, Download, RefreshCw,
  ArrowUp, ArrowDown, Activity, Globe, Users, Building
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@shared/components/ui/card';
import { ChartContainer, ChartTooltip, ChartTooltipContent, ChartLegend, ChartLegendContent } from '@shared/components/ui/chart';
import { 
  LineChart, Line, 
  BarChart, Bar, 
  PieChart as RechartsPieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, ResponsiveContainer
} from 'recharts';
import { useBetterAuthStore } from '../../store/betterAuthStore';
import { investorApi } from '@/services/investor.service';

interface PerformanceMetrics {
  totalReturn: number;
  annualizedReturn: number;
  volatility: number;
  sharpeRatio: number;
  maxDrawdown: number;
  hitRate: number;
  averageHoldingPeriod: number;
  activeInvestments: number;
}

interface PortfolioAllocation {
  genre: string;
  allocation: number;
  performance: number;
  count: number;
}

export default function InvestorPerformance() {
  const { user, logout } = useBetterAuthStore();
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState('1y');
  const [metrics, setMetrics] = useState<PerformanceMetrics | null>(null);
  const [allocations, setAllocations] = useState<PortfolioAllocation[]>([]);

  useEffect(() => {
    loadPerformanceData();
  }, [timeRange]);

  const loadPerformanceData = async () => {
    try {
      setLoading(true);
      const [perfResponse, roiResponse, categoryResponse] = await Promise.all([
        investorApi.getPerformance(timeRange),
        investorApi.getROISummary(timeRange),
        investorApi.getROIByCategory(timeRange)
      ]);

      // Map performance data
      const perfData = perfResponse.success ? (perfResponse.data as any) : {};
      setMetrics({
        totalReturn: perfData.totalReturn ?? perfData.total_return ?? 0,
        annualizedReturn: perfData.annualizedReturn ?? perfData.annualized_return ?? 0,
        volatility: perfData.volatility ?? 0,
        sharpeRatio: perfData.sharpeRatio ?? perfData.sharpe_ratio ?? 0,
        maxDrawdown: perfData.maxDrawdown ?? perfData.max_drawdown ?? 0,
        hitRate: perfData.hitRate ?? perfData.hit_rate ?? (roiResponse.data as any)?.summary?.profitable_count ?? 0,
        averageHoldingPeriod: perfData.averageHoldingPeriod ?? perfData.avg_holding_period ?? 0,
        activeInvestments: perfData.activeInvestments ?? perfData.active_investments ?? 0
      });

      // Populate portfolio vs market chart from API performance data
      const performanceHistory: any[] = perfData.history ?? perfData.performanceData ?? perfData.data ?? [];
      if (performanceHistory.length > 0) {
        setPerformanceChartPoints(performanceHistory.map((point: any) => ({
          month: point.month ?? point.date ?? '',
          portfolio: point.portfolioValue ?? point.value ?? 0,
          market: point.marketValue ?? point.benchmark ?? 0
        })));
      } else {
        setPerformanceChartPoints([]);
      }

      // Map category allocations
      const categories: any[] = (categoryResponse.data as any)?.categories || [];
      if (categories.length > 0) {
        const totalCount = categories.reduce((sum: number, c: any) => sum + (c.count || 0), 0);
        setAllocations(categories.map((c: any) => ({
          genre: c.category || '',
          allocation: totalCount > 0 ? Math.round((c.count / totalCount) * 100) : 0,
          performance: c.avg_roi || 0,
          count: c.count || 0
        })));
      }
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      console.error('Failed to load performance data:', error);
    } finally {
      setLoading(false);
    }
  };

  // Chart data - populated from API response via metrics/allocations state
  const [performanceChartPoints, setPerformanceChartPoints] = useState<{ month: string; portfolio: number; market: number }[]>([]);

  const allocationChartData = {
    labels: allocations.map(a => a.genre),
    datasets: [
      {
        data: allocations.map(a => a.allocation),
        backgroundColor: [
          'rgba(147, 51, 234, 0.8)',
          'rgba(59, 130, 246, 0.8)',
          'rgba(34, 197, 94, 0.8)',
          'rgba(251, 146, 60, 0.8)',
          'rgba(239, 68, 68, 0.8)'
        ]
      }
    ]
  };

  const performanceByGenreData = {
    labels: allocations.map(a => a.genre),
    datasets: [
      {
        label: 'Performance (%)',
        data: allocations.map(a => a.performance),
        backgroundColor: 'rgba(147, 51, 234, 0.8)',
        borderColor: 'rgb(147, 51, 234)',
        borderWidth: 1
      }
    ]
  };

  const formatPercentage = (value: number) => {
    const sign = value >= 0 ? '+' : '';
    return `${sign}${value.toFixed(1)}%`;
  };

  if (loading) {
    return (
      <div>
                <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
        </div>
      </div>
    );
  }

  return (
    <div>
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Performance Analysis</h1>
            <p className="mt-2 text-sm text-gray-600">
              Detailed analysis of your investment portfolio performance
            </p>
          </div>
          <div className="mt-4 sm:mt-0 flex gap-3">
            <select
              value={timeRange}
              onChange={(e) => setTimeRange(e.target.value)}
              className="px-4 py-2 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
            >
              <option value="1m">Last Month</option>
              <option value="3m">Last 3 Months</option>
              <option value="6m">Last 6 Months</option>
              <option value="1y">Last Year</option>
              <option value="all">All Time</option>
            </select>
            
            <button className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50">
              <Download className="w-4 h-4 mr-2" />
              Export Report
            </button>
            
            <button onClick={loadPerformanceData} className="p-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50">
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Key Metrics */}
        {metrics && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <div className="bg-white rounded-lg shadow-sm border p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-medium text-gray-900">Total Return</h3>
                <TrendingUp className="w-5 h-5 text-green-600" />
              </div>
              <div className="flex items-center gap-2">
                <p className="text-3xl font-bold text-gray-900">{formatPercentage(metrics.totalReturn)}</p>
                <ArrowUp className="w-4 h-4 text-green-600" />
              </div>
              <p className="text-sm text-gray-500 mt-1">Since inception</p>
            </div>

            <div className="bg-white rounded-lg shadow-sm border p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-medium text-gray-900">Annualized Return</h3>
                <Target className="w-5 h-5 text-purple-600" />
              </div>
              <div className="flex items-center gap-2">
                <p className="text-3xl font-bold text-gray-900">{formatPercentage(metrics.annualizedReturn)}</p>
                <ArrowUp className="w-4 h-4 text-green-600" />
              </div>
              <p className="text-sm text-gray-500 mt-1">Year over year</p>
            </div>

            <div className="bg-white rounded-lg shadow-sm border p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-medium text-gray-900">Sharpe Ratio</h3>
                <Award className="w-5 h-5 text-yellow-600" />
              </div>
              <p className="text-3xl font-bold text-gray-900">{metrics.sharpeRatio.toFixed(2)}</p>
              <p className="text-sm text-gray-500 mt-1">Risk-adjusted return</p>
            </div>

            <div className="bg-white rounded-lg shadow-sm border p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-medium text-gray-900">Hit Rate</h3>
                <Activity className="w-5 h-5 text-blue-600" />
              </div>
              <p className="text-3xl font-bold text-gray-900">{metrics.hitRate}%</p>
              <p className="text-sm text-gray-500 mt-1">Successful investments</p>
            </div>
          </div>
        )}

        {/* Performance Chart */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow-sm border p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold text-gray-900">Portfolio vs Market</h2>
              <BarChart3 className="w-5 h-5 text-gray-400" />
            </div>
            {performanceChartPoints.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={performanceChartPoints}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis />
                  <ChartTooltip />
                  <Line type="monotone" dataKey="portfolio" stroke="#10b981" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="market" stroke="#6366f1" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-[300px] text-gray-500 text-sm">
                No performance data available
              </div>
            )}
          </div>

          <div className="bg-white rounded-lg shadow-sm border p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold text-gray-900">Genre Allocation</h2>
              <PieChart className="w-5 h-5 text-gray-400" />
            </div>
            <ResponsiveContainer width="100%" height={300}>
              <RechartsPieChart>
                <Pie
                  data={allocations.map(a => ({
                    name: a.genre,
                    value: a.allocation
                  }))}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={2}
                  dataKey="value"
                >
                  {allocations.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={['#10b981', '#6366f1', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'][index % 6]} />
                  ))}
                </Pie>
                <ChartTooltip />
              </RechartsPieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Performance by Genre */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow-sm border p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold text-gray-900">Performance by Genre</h2>
              <BarChart3 className="w-5 h-5 text-gray-400" />
            </div>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={allocations.map(a => ({
                genre: a.genre,
                performance: a.performance
              }))}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="genre" />
                <YAxis tickFormatter={(value) => `${value}%`} />
                <ChartTooltip formatter={(value: any) => `${value}%`} />
                <Bar dataKey="performance" fill="#10b981" />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="bg-white rounded-lg shadow-sm border p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold text-gray-900">Risk Metrics</h2>
              <Activity className="w-5 h-5 text-gray-400" />
            </div>
            {metrics && (
              <div className="space-y-4">
                <div>
                  <div className="flex justify-between text-sm mb-2">
                    <span className="text-gray-600">Volatility</span>
                    <span className="font-medium">{metrics.volatility.toFixed(1)}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div 
                      className="bg-yellow-500 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${Math.min(metrics.volatility, 50) * 2}%` }}
                    />
                  </div>
                </div>
                
                <div>
                  <div className="flex justify-between text-sm mb-2">
                    <span className="text-gray-600">Max Drawdown</span>
                    <span className="font-medium text-red-600">{metrics.maxDrawdown.toFixed(1)}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div 
                      className="bg-red-500 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${Math.abs(metrics.maxDrawdown) * 4}%` }}
                    />
                  </div>
                </div>
                
                <div>
                  <div className="flex justify-between text-sm mb-2">
                    <span className="text-gray-600">Avg Holding Period</span>
                    <span className="font-medium">{metrics.averageHoldingPeriod.toFixed(1)} years</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Detailed Allocation Table */}
        <div className="bg-white rounded-lg shadow-sm border">
          <div className="px-6 py-4 border-b">
            <h2 className="text-xl font-semibold text-gray-900">Genre Breakdown</h2>
          </div>
          
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Genre
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Allocation
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Investments
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Performance
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {allocations.map((allocation, index) => (
                  <tr key={index} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">{allocation.genre}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <div className="text-sm text-gray-900">{allocation.allocation}%</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <div className="text-sm text-gray-900">{allocation.count}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <div className={`text-sm font-medium ${
                        allocation.performance > 0 ? 'text-green-600' : 'text-red-600'
                      }`}>
                        {formatPercentage(allocation.performance)}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <div className="flex items-center justify-center">
                        {allocation.performance > 20 ? (
                          <TrendingUp className="w-4 h-4 text-green-600" />
                        ) : allocation.performance > 0 ? (
                          <ArrowUp className="w-4 h-4 text-green-600" />
                        ) : (
                          <TrendingDown className="w-4 h-4 text-red-600" />
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}