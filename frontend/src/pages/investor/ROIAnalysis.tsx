import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  TrendingUp, DollarSign, Percent,
  Download,
  ArrowUp, ArrowDown, AlertTriangle, CheckCircle
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@shared/components/ui/card';
import { Button } from '@shared/components/ui/button';
import { useBetterAuthStore } from '../../store/betterAuthStore';
import { investorApi } from '@/services/investor.service';
import type { ROISummary, ROIMetric } from '@/services/investor.service';
import {
  BarChart,
  Bar,
  PieChart as RechartsPieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Area,
  AreaChart
} from 'recharts';

const ROIAnalysis = () => {
  const navigate = useNavigate();
  const { logout } = useBetterAuthStore();
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState('1y');
  const [roiSummary, setRoiSummary] = useState<ROISummary | null>(null);
  const [categoryMetrics, setCategoryMetrics] = useState<ROIMetric[]>([]);

  useEffect(() => {
    loadROIData();
  }, [timeRange]);

  const [error, setError] = useState<string | null>(null);
  const [trendData, setTrendData] = useState<{ month: string; roi: number; invested: number; returned: number }[]>([]);

  const loadROIData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch ROI summary
      const summaryResponse = await investorApi.getROISummary(timeRange);
      if (summaryResponse.success && summaryResponse.data?.summary) {
        setRoiSummary(summaryResponse.data.summary);
      } else {
        setRoiSummary({ total_investments: 0, average_roi: 0, best_roi: 0, worst_roi: 0, profitable_count: 0 });
      }

      // Fetch ROI by category
      const categoryResponse = await investorApi.getROIByCategory(timeRange);
      if (categoryResponse.success && categoryResponse.data?.categories) {
        setCategoryMetrics(categoryResponse.data.categories);
      } else {
        setCategoryMetrics([]);
      }

      // Trend data comes from performance endpoint
      try {
        const perfResponse = await fetch(`${import.meta.env.VITE_API_URL || ''}/api/investor/performance`, {
          credentials: 'include',
        });
        if (perfResponse.ok) {
          const perfResult = await perfResponse.json();
          const timeline = perfResult.roiTimeline || [];
          setTrendData(timeline.map((t: any) => ({
            month: new Date(t.month + '-01').toLocaleString('default', { month: 'short' }),
            roi: Number(t.value) > 0 && Number(t.invested) > 0
              ? Math.round(((Number(t.value) - Number(t.invested)) / Number(t.invested)) * 100 * 10) / 10
              : 0,
            invested: Number(t.invested) || 0,
            returned: Number(t.value) || 0,
          })));
        } else {
          setTrendData([]);
        }
      } catch {
        setTrendData([]);
      }

    } catch (err) {
      const e = err instanceof Error ? err : new Error(String(err));
      console.error('Failed to load ROI data:', e);
      setError(e.message);
      setCategoryMetrics([]);
      setRoiSummary(null);
    } finally {
      setLoading(false);
    }
  };

  const monthlyROIData = trendData;

  const pieColors = ['#8b5cf6', '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#ec4899'];

  // Calculate metrics from summary and category data
  const totalInvested = roiSummary?.total_investments || 0;
  const totalReturned = categoryMetrics.reduce((sum, m) => sum + m.total_profit, 0);
  const totalROI = roiSummary?.average_roi || 0;
  const bestPerforming = categoryMetrics.reduce((best, current) =>
    (current.avg_roi > (best?.avg_roi || 0)) ? current : best,
    categoryMetrics[0] || { category: 'N/A', avg_roi: 0 }
  );
  const totalProjects = categoryMetrics.reduce((sum, m) => sum + m.count, 0);

  const formatCurrency = (amount: number) => {
    if (amount >= 1000000) {
      return `$${(amount / 1000000).toFixed(1)}M`;
    }
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0
    }).format(amount);
  };

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/login/investor');
    } catch (error) {
      console.error('Logout failed:', error);
    }
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

  if (error) {
    return (
      <div className="container mx-auto px-4 py-6">
        <div className="text-center py-12 bg-white rounded-lg">
          <AlertTriangle className="w-12 h-12 text-red-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">Failed to load ROI data</h3>
          <p className="text-gray-600 mb-4">{error}</p>
          <Button onClick={loadROIData} variant="outline">
            Retry
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <main className="container mx-auto px-4 py-6">
        {/* Header */}
        <div className="mb-8">
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">ROI Analysis</h1>
              <p className="text-gray-600 mt-2">
                Comprehensive return on investment analysis and performance metrics
              </p>
            </div>
            <div className="flex gap-3">
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
              <Button variant="ghost" className="text-gray-600" onClick={handleLogout}>
                Logout
              </Button>
              <Button variant="outline">
                <Download className="h-4 w-4 mr-2" />
                Export Analysis
              </Button>
            </div>
          </div>
        </div>

        {/* Key Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Total Invested</p>
                  <p className="text-2xl font-bold text-gray-900">{formatCurrency(totalInvested)}</p>
                  <p className="text-xs text-gray-500 mt-1">Across {totalProjects} projects</p>
                </div>
                <DollarSign className="h-8 w-8 text-purple-600" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Total Returns</p>
                  <p className="text-2xl font-bold text-green-600">{formatCurrency(totalReturned)}</p>
                  <p className="text-xs text-gray-500 mt-1">+{formatCurrency(totalReturned - totalInvested)} profit</p>
                </div>
                <TrendingUp className="h-8 w-8 text-green-600" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Overall ROI</p>
                  <p className="text-2xl font-bold text-blue-600">{totalROI.toFixed(1)}%</p>
                  <p className="text-xs text-gray-500 mt-1">Portfolio performance</p>
                </div>
                <Percent className="h-8 w-8 text-blue-600" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Best Performer</p>
                  <p className="text-2xl font-bold text-purple-600">{bestPerforming?.category || 'N/A'}</p>
                  <p className="text-xs text-gray-500 mt-1">{bestPerforming?.avg_roi || 0}% ROI</p>
                </div>
                <CheckCircle className="h-8 w-8 text-purple-600" />
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* ROI Trend Chart */}
          <Card>
            <CardHeader>
              <CardTitle>ROI Trend Over Time</CardTitle>
              <CardDescription>Monthly return on investment progression</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={monthlyROIData}>
                  <defs>
                    <linearGradient id="colorROI" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.8} />
                      <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis />
                  <Tooltip formatter={(value: number) => `${value}%`} />
                  <Area
                    type="monotone"
                    dataKey="roi"
                    stroke="#8b5cf6"
                    fillOpacity={1}
                    fill="url(#colorROI)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Category Distribution */}
          <Card>
            <CardHeader>
              <CardTitle>ROI by Category</CardTitle>
              <CardDescription>Investment returns across different genres</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <RechartsPieChart>
                  <Pie
                    data={categoryMetrics}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ category, avg_roi }) => `${category}: ${avg_roi}%`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="total_profit"
                  >
                    {categoryMetrics.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={pieColors[index % pieColors.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value: number) => formatCurrency(value)} />
                </RechartsPieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>

        {/* Detailed Comparison */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Investment vs Returns Comparison</CardTitle>
            <CardDescription>Side-by-side comparison of investments and returns by category</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={400}>
              <BarChart data={categoryMetrics.map(cat => ({
                category: cat.category,
                invested: cat.total_profit / (1 + cat.avg_roi / 100), // Calculate invested from profit and ROI
                returned: cat.total_profit
              }))}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="category" />
                <YAxis />
                <Tooltip formatter={(value: any) => formatCurrency(value as number)} />
                <Legend />
                <Bar dataKey="invested" fill="#8b5cf6" name="Invested" />
                <Bar dataKey="returned" fill="#10b981" name="Returned" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* ROI Table */}
        <Card>
          <CardHeader>
            <CardTitle>Detailed ROI Breakdown</CardTitle>
            <CardDescription>Category-wise return on investment analysis</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Category
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Projects
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Invested
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Returned
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Profit/Loss
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      ROI
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {categoryMetrics.map((metric, index) => {
                    const invested = metric.total_profit / (1 + metric.avg_roi / 100);
                    const profit = metric.total_profit - invested;
                    const isProfit = profit > 0;
                    return (
                      <tr key={index} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-gray-900">{metric.category}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-900">{metric.count}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-900">{formatCurrency(invested)}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-gray-900">{formatCurrency(metric.total_profit)}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className={`text-sm font-medium flex items-center ${isProfit ? 'text-green-600' : 'text-red-600'}`}>
                            {isProfit ? <ArrowUp className="h-4 w-4 mr-1" /> : <ArrowDown className="h-4 w-4 mr-1" />}
                            {formatCurrency(Math.abs(profit))}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className={`text-lg font-bold ${metric.avg_roi > 50 ? 'text-green-600' : metric.avg_roi > 0 ? 'text-blue-600' : 'text-red-600'}`}>
                            {metric.avg_roi}%
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {metric.avg_roi > 50 ? (
                            <span className="inline-flex items-center px-2 py-1 text-xs font-medium bg-green-100 text-green-800 rounded-full">
                              <CheckCircle className="h-3 w-3 mr-1" />
                              Excellent
                            </span>
                          ) : metric.avg_roi > 0 ? (
                            <span className="inline-flex items-center px-2 py-1 text-xs font-medium bg-blue-100 text-blue-800 rounded-full">
                              <TrendingUp className="h-3 w-3 mr-1" />
                              Positive
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2 py-1 text-xs font-medium bg-red-100 text-red-800 rounded-full">
                              <AlertTriangle className="h-3 w-3 mr-1" />
                              Underperforming
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default ROIAnalysis;