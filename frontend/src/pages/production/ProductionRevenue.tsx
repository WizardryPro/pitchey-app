import React, { useState, useEffect } from 'react';
import {
  DollarSign, TrendingUp, Calendar, Download,
  Filter, ArrowUp, FileText,
  PieChart, BarChart3, Activity, CreditCard,
  AlertCircle, RefreshCw, Target
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@shared/components/ui/card';
import { Button } from '@shared/components/ui/button';
import { Skeleton } from '@shared/components/ui/skeleton';
import { ProductionService } from '../../services/production.service';

// Loading skeleton component for stats cards
function StatsCardSkeleton() {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-4 w-4 rounded" />
      </CardHeader>
      <CardContent>
        <Skeleton className="h-8 w-20 mb-2" />
        <Skeleton className="h-3 w-16" />
      </CardContent>
    </Card>
  );
}

// Loading skeleton for chart
function ChartSkeleton() {
  return (
    <Card className="mb-8">
      <CardHeader>
        <Skeleton className="h-6 w-32" />
      </CardHeader>
      <CardContent>
        <div className="h-64 flex items-end justify-between gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex-1 flex flex-col items-center">
              <Skeleton className="h-3 w-8 mb-2" />
              <Skeleton className="w-full rounded-t" style={{ height: `${40 + (i + 1) * 20}px` }} />
              <Skeleton className="h-3 w-6 mt-2" />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// Loading skeleton for transactions table
function TransactionsSkeleton() {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-8 w-20" />
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center justify-between py-3 border-b">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-6 w-20 rounded-full" />
              <Skeleton className="h-8 w-8" />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

interface Transaction {
  id: number;
  project: string;
  amount: number;
  date: string;
  status: string;
}

interface ChartDataPoint {
  month: string;
  revenue: number;
}

interface CategoryBreakdown {
  category: string;
  revenue: number;
  percentage: number;
}

interface RevenueData {
  totalRevenue: number;
  monthlyRevenue: number;
  yearlyRevenue: number;
  growth: number;
  avgDealSize: number;
  projectedRevenue: number;
  transactions: Transaction[];
  chartData: ChartDataPoint[];
  revenueByCategory: CategoryBreakdown[];
}

export default function ProductionRevenue() {
  const [timeRange, setTimeRange] = useState<'week' | 'month' | 'quarter' | 'year'>('month');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [revenueData, setRevenueData] = useState<RevenueData>({
    totalRevenue: 0,
    monthlyRevenue: 0,
    yearlyRevenue: 0,
    growth: 0,
    avgDealSize: 0,
    projectedRevenue: 0,
    transactions: [],
    chartData: [],
    revenueByCategory: []
  });

  useEffect(() => {
    void fetchRevenueData();
  }, [timeRange]);

  const fetchRevenueData = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await ProductionService.getRevenue();
      const data = response || {};

      const revenueByProject = (data.revenueByProject || []) as Array<{ project_title: string; revenue: number; investment_count: number }>;
      const revenueByMonth = (data.revenueByMonth || []) as Array<{ month: string; revenue: number }>;

      // Transform project data into transactions
      const transactions: Transaction[] = revenueByProject.slice(0, 5).map((p, index) => ({
        id: index + 1,
        project: p.project_title || 'Untitled',
        amount: Number(p.revenue) || 0,
        date: new Date().toISOString().split('T')[0],
        status: 'completed'
      }));

      // Transform monthly data into chart format
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const chartData: ChartDataPoint[] = revenueByMonth.map((m) => {
        const monthNum = parseInt(m.month.split('-')[1], 10) - 1;
        return {
          month: months[monthNum] || m.month,
          revenue: Number(m.revenue) || 0,
        };
      });

      // Calculate growth from last 2 months
      let growth = 0;
      if (revenueByMonth.length >= 2) {
        const curr = Number(revenueByMonth[revenueByMonth.length - 1].revenue) || 0;
        const prev = Number(revenueByMonth[revenueByMonth.length - 2].revenue) || 1;
        growth = Math.round(((curr - prev) / prev) * 100);
      }

      const revenueByCategory = (data.revenueByCategory || []) as CategoryBreakdown[];

      setRevenueData({
        totalRevenue: Number(data.totalRevenue) || 0,
        monthlyRevenue: Number(data.monthlyRevenue) || 0,
        yearlyRevenue: Number(data.yearlyRevenue) || 0,
        growth,
        avgDealSize: Number(data.avgDealSize) || 0,
        projectedRevenue: Number(data.projectedRevenue) || 0,
        transactions,
        chartData,
        revenueByCategory
      });
    } catch (err) {
      console.error('Error fetching revenue data:', err);
      setError(err instanceof Error ? err.message : 'Failed to load revenue data');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
            
      <main className="max-w-7xl mx-auto px-4 py-8">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Revenue Reports</h1>
            <p className="text-gray-600 mt-1">Track your production revenue and financial metrics</p>
          </div>
          <div className="flex gap-3">
            <Button variant="outline" className="flex items-center gap-2">
              <Download className="w-4 h-4" />
              Export Report
            </Button>
            <Button className="flex items-center gap-2 bg-purple-600 hover:bg-purple-700">
              <FileText className="w-4 h-4" />
              Generate Invoice
            </Button>
          </div>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="flex items-center gap-3">
              <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
              <div className="flex-1">
                <p className="text-sm font-medium text-red-800">Failed to load revenue data</p>
                <p className="text-sm text-red-600 mt-1">{error}</p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => { void fetchRevenueData(); }}
                className="flex items-center gap-2"
              >
                <RefreshCw className="w-4 h-4" />
                Retry
              </Button>
            </div>
          </div>
        )}

        {/* Loading State with Skeletons */}
        {loading && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
              <StatsCardSkeleton />
              <StatsCardSkeleton />
              <StatsCardSkeleton />
              <StatsCardSkeleton />
            </div>
            <ChartSkeleton />
            <TransactionsSkeleton />
          </>
        )}

        {/* Time Range Selector */}
        <div className="flex gap-2 mb-6">
          <Button 
            variant={timeRange === 'week' ? 'default' : 'outline'}
            onClick={() => setTimeRange('week')}
            size="sm"
          >
            Week
          </Button>
          <Button 
            variant={timeRange === 'month' ? 'default' : 'outline'}
            onClick={() => setTimeRange('month')}
            size="sm"
          >
            Month
          </Button>
          <Button 
            variant={timeRange === 'quarter' ? 'default' : 'outline'}
            onClick={() => setTimeRange('quarter')}
            size="sm"
          >
            Quarter
          </Button>
          <Button 
            variant={timeRange === 'year' ? 'default' : 'outline'}
            onClick={() => setTimeRange('year')}
            size="sm"
          >
            Year
          </Button>
        </div>

        {/* Revenue Stats Cards */}
        {!loading && (
        <>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">
                Total Revenue
              </CardTitle>
              <DollarSign className="h-4 w-4 text-purple-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">${(revenueData.totalRevenue / 1000000).toFixed(2)}M</div>
              <p className="text-xs text-gray-500 mt-1">All time earnings</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">
                Monthly Revenue
              </CardTitle>
              <Calendar className="h-4 w-4 text-blue-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">${(revenueData.monthlyRevenue / 1000).toFixed(0)}K</div>
              <p className="text-xs text-gray-500 mt-1">Current month</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">
                Growth Rate
              </CardTitle>
              <TrendingUp className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold flex items-center gap-1">
                <ArrowUp className="w-4 h-4 text-green-600" />
                {revenueData.growth}%
              </div>
              <p className="text-xs text-gray-500 mt-1">vs last month</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">
                Avg Deal Size
              </CardTitle>
              <Activity className="h-4 w-4 text-orange-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {revenueData.avgDealSize >= 1000000
                  ? `$${(revenueData.avgDealSize / 1000000).toFixed(2)}M`
                  : `$${(revenueData.avgDealSize / 1000).toFixed(0)}K`}
              </div>
              <p className="text-xs text-gray-500 mt-1">Per project</p>
            </CardContent>
          </Card>
        </div>

        {/* Revenue Chart */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="w-5 h-5" />
              Revenue Trend
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64 flex items-end justify-between gap-4">
              {revenueData.chartData.map((data, index) => (
                <div key={index} className="flex-1 flex flex-col items-center">
                  <div className="text-xs text-gray-600 mb-2">
                    ${(data.revenue / 1000).toFixed(0)}K
                  </div>
                  <div 
                    className="w-full bg-purple-600 rounded-t"
                    style={{ 
                      height: `${(data.revenue / 210000) * 200}px`,
                      minHeight: '20px'
                    }}
                  />
                  <div className="text-xs text-gray-600 mt-2">{data.month}</div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Recent Transactions */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span className="flex items-center gap-2">
                <CreditCard className="w-5 h-5" />
                Recent Transactions
              </span>
              <Button variant="outline" size="sm">
                <Filter className="w-4 h-4 mr-2" />
                Filter
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">Project</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">Amount</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">Date</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">Status</th>
                    <th className="text-right py-3 px-4 text-sm font-medium text-gray-600">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {revenueData.transactions.map((transaction) => (
                    <tr key={transaction.id} className="border-b hover:bg-gray-50">
                      <td className="py-3 px-4">
                        <div className="font-medium text-gray-900">{transaction.project}</div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-semibold text-gray-900">
                          ${(transaction.amount / 1000).toFixed(0)}K
                        </div>
                      </td>
                      <td className="py-3 px-4 text-gray-600">
                        {new Date(transaction.date).toLocaleDateString()}
                      </td>
                      <td className="py-3 px-4">
                        <span className={`px-2 py-1 text-xs rounded-full ${
                          transaction.status === 'completed' 
                            ? 'bg-green-100 text-green-700'
                            : 'bg-yellow-100 text-yellow-700'
                        }`}>
                          {transaction.status}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <Button variant="ghost" size="sm">
                          <FileText className="w-4 h-4" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* Revenue Breakdown */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-8">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <PieChart className="w-5 h-5" />
                Revenue by Category
              </CardTitle>
            </CardHeader>
            <CardContent>
              {revenueData.revenueByCategory.length === 0 ? (
                <p className="text-sm text-gray-500">No category data yet</p>
              ) : (
                <div className="space-y-4">
                  {revenueData.revenueByCategory.map((cat, i) => {
                    const colors = ['bg-purple-600', 'bg-blue-600', 'bg-green-600', 'bg-orange-600', 'bg-pink-600', 'bg-teal-600'];
                    return (
                      <div key={cat.category} className="flex justify-between items-center">
                        <div className="flex items-center gap-3">
                          <div className={`w-3 h-3 ${colors[i % colors.length]} rounded-full`} />
                          <span className="text-sm">{cat.category}</span>
                        </div>
                        <span className="font-semibold">{cat.percentage}%</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Target className="w-5 h-5" />
                Projected Revenue
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-purple-700 mb-2">
                {revenueData.projectedRevenue >= 1000000
                  ? `$${(revenueData.projectedRevenue / 1000000).toFixed(2)}M`
                  : `$${(revenueData.projectedRevenue / 1000).toFixed(0)}K`}
              </div>
              <p className="text-sm text-gray-500">Annual projection based on recent trends</p>
              {revenueData.yearlyRevenue > 0 && (
                <div className="mt-4 pt-4 border-t">
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-gray-600">Year to date</span>
                    <span className="font-semibold">
                      {revenueData.yearlyRevenue >= 1000000
                        ? `$${(revenueData.yearlyRevenue / 1000000).toFixed(2)}M`
                        : `$${(revenueData.yearlyRevenue / 1000).toFixed(0)}K`}
                    </span>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
        </>
        )}
      </main>
    </div>
  );
}