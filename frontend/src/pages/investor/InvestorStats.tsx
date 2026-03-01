import { useState, useEffect, useCallback } from 'react';
import { 
  TrendingUp, DollarSign, PieChart, Calendar, 
  Award, Target, BarChart3, Activity, Clock,
  ArrowUp, ArrowDown, Download, RefreshCw,
  Building, Users, Film, Star, Globe
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@shared/components/ui/card';
import { ChartContainer, ChartTooltip, ChartTooltipContent, ChartLegend, ChartLegendContent } from '@shared/components/ui/chart';
import { 
  LineChart, Line, 
  BarChart, Bar, 
  PieChart as RechartsPieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, ResponsiveContainer
} from 'recharts';

interface QuickStat {
  label: string;
  value: string | number;
  change: number;
  trend: 'up' | 'down' | 'stable';
  icon: any;
  color: string;
  description: string;
}

interface PerformanceMetrics {
  portfolioValue: number;
  totalInvested: number;
  unrealizedGains: number;
  realizedGains: number;
  activeInvestments: number;
  completedExits: number;
  averageROI: number;
  hitRate: number;
  dealFlow: number;
  followOnRate: number;
}

export default function InvestorStats() {
  
  const [timeRange, setTimeRange] = useState('30d');
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<QuickStat[]>([]);
  const [metrics, setMetrics] = useState<PerformanceMetrics | null>(null);

  const loadStats = useCallback(async () => {
    try {
      setLoading(true);

      const response = await fetch('/api/investor/investments/summary', {
        credentials: 'include'
      });
      const json = response.ok ? await response.json() : null;
      const data = json?.data ?? json ?? {};

      const portfolioValue = data.portfolioValue ?? data.currentValue ?? 0;
      const totalInvested = data.totalInvested ?? 0;
      const activeInvestments = data.activeInvestments ?? data.activeDeals ?? 0;
      const averageROI = data.averageROI ?? data.avgROI ?? data.averageReturn ?? 0;
      const completedExits = data.completedInvestments ?? data.completedDeals ?? 0;
      const dealFlow = data.dealFlow ?? data.totalInvestments ?? 0;

      setMetrics({
        portfolioValue,
        totalInvested,
        unrealizedGains: data.unrealizedGains ?? Math.max(0, portfolioValue - totalInvested),
        realizedGains: data.realizedGains ?? 0,
        activeInvestments,
        completedExits,
        averageROI,
        hitRate: data.hitRate ?? 0,
        dealFlow,
        followOnRate: data.followOnRate ?? 0
      });

      const fmtM = (n: number) => n >= 1000000 ? `$${(n / 1000000).toFixed(2)}M` : n >= 1000 ? `$${(n / 1000).toFixed(0)}K` : `$${n}`;

      setStats([
        {
          label: 'Portfolio Value',
          value: fmtM(portfolioValue),
          change: data.monthlyGrowth ?? 0,
          trend: (data.monthlyGrowth ?? 0) >= 0 ? 'up' : 'down',
          icon: DollarSign,
          color: 'green',
          description: 'Total current portfolio valuation'
        },
        {
          label: 'Total Invested',
          value: fmtM(totalInvested),
          change: 0,
          trend: 'stable',
          icon: Target,
          color: 'blue',
          description: 'Capital deployed across investments'
        },
        {
          label: 'Average ROI',
          value: `${averageROI.toFixed(1)}%`,
          change: 0,
          trend: averageROI > 0 ? 'up' : averageROI < 0 ? 'down' : 'stable',
          icon: TrendingUp,
          color: 'purple',
          description: 'Return on investment across portfolio'
        },
        {
          label: 'Active Investments',
          value: activeInvestments,
          change: 0,
          trend: 'stable',
          icon: Activity,
          color: 'orange',
          description: 'Currently active portfolio companies'
        },
        {
          label: 'Hit Rate',
          value: `${data.hitRate ?? 0}%`,
          change: 0,
          trend: 'stable',
          icon: Award,
          color: 'yellow',
          description: 'Successful investment rate'
        },
        {
          label: 'Deal Flow',
          value: dealFlow,
          change: 0,
          trend: 'stable',
          icon: Building,
          color: 'red',
          description: 'Opportunities reviewed this period'
        }
      ]);
    } catch (error) {
      console.error('Failed to load stats:', error);
      setMetrics({
        portfolioValue: 0,
        totalInvested: 0,
        unrealizedGains: 0,
        realizedGains: 0,
        activeInvestments: 0,
        completedExits: 0,
        averageROI: 0,
        hitRate: 0,
        dealFlow: 0,
        followOnRate: 0
      });
      setStats([]);
    } finally {
      setLoading(false);
    }
  }, [timeRange]);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  // Chart data
  const portfolioPerformanceData = [
    { month: 'Jan', portfolioValue: 5200, totalInvested: 4800 },
    { month: 'Feb', portfolioValue: 5480, totalInvested: 5000 },
    { month: 'Mar', portfolioValue: 5750, totalInvested: 5200 },
    { month: 'Apr', portfolioValue: 6100, totalInvested: 5400 },
    { month: 'May', portfolioValue: 6350, totalInvested: 5600 },
    { month: 'Jun', portfolioValue: 6800, totalInvested: 5800 },
    { month: 'Jul', portfolioValue: 7200, totalInvested: 6000 },
    { month: 'Aug', portfolioValue: 7650, totalInvested: 6100 },
    { month: 'Sep', portfolioValue: 8100, totalInvested: 6150 },
    { month: 'Oct', portfolioValue: 8400, totalInvested: 6180 },
    { month: 'Nov', portfolioValue: 8600, totalInvested: 6190 },
    { month: 'Dec', portfolioValue: 8750, totalInvested: 6200 }
  ];

  const investmentsByStageData = [
    { name: 'Seed', value: 4, fill: 'hsl(var(--chart-1))' },
    { name: 'Series A', value: 5, fill: 'hsl(var(--chart-2))' },
    { name: 'Series B', value: 2, fill: 'hsl(var(--chart-3))' },
    { name: 'Series C', value: 1, fill: 'hsl(var(--chart-4))' },
    { name: 'Growth', value: 0, fill: 'hsl(var(--chart-5))' }
  ];

  const sectorAllocationData = [
    { name: 'Film Production', value: 35, fill: 'hsl(var(--chart-1))' },
    { name: 'Streaming/Digital', value: 28, fill: 'hsl(var(--chart-2))' },
    { name: 'Animation/VFX', value: 15, fill: 'hsl(var(--chart-3))' },
    { name: 'Gaming', value: 12, fill: 'hsl(var(--chart-4))' },
    { name: 'Music/Audio', value: 7, fill: 'hsl(var(--chart-5))' },
    { name: 'Other', value: 3, fill: 'hsl(var(--chart-6))' }
  ];

  const monthlyDealsData = [
    { quarter: 'Q1 2024', reviewed: 45, closed: 3 },
    { quarter: 'Q2 2024', reviewed: 38, closed: 2 },
    { quarter: 'Q3 2024', reviewed: 42, closed: 4 },
    { quarter: 'Q4 2024', reviewed: 31, closed: 3 }
  ];

  // Chart configurations
  const portfolioConfig = {
    portfolioValue: {
      label: 'Portfolio Value',
      color: 'hsl(var(--chart-1))'
    },
    totalInvested: {
      label: 'Total Invested',
      color: 'hsl(var(--chart-2))'
    }
  };

  const stageConfig = {
    value: {
      label: 'Investments'
    }
  };

  const sectorConfig = {
    value: {
      label: 'Allocation %'
    }
  };

  const dealsConfig = {
    reviewed: {
      label: 'Deals Reviewed',
      color: 'hsl(var(--chart-1))'
    },
    closed: {
      label: 'Deals Closed',
      color: 'hsl(var(--chart-2))'
    }
  };

  const getColorClass = (color: string) => {
    const colors: { [key: string]: string } = {
      blue: 'text-blue-600 bg-blue-50',
      red: 'text-red-600 bg-red-50',
      green: 'text-green-600 bg-green-50',
      purple: 'text-purple-600 bg-purple-50',
      yellow: 'text-yellow-600 bg-yellow-50',
      orange: 'text-orange-600 bg-orange-50'
    };
    return colors[color] || 'text-gray-600 bg-gray-50';
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  };

  return (
    <div>
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Investment Analytics</h1>
              <p className="mt-2 text-gray-600">
                Track your investment performance and portfolio metrics
              </p>
            </div>
            <div className="flex items-center gap-3">
              {/* Time Range Selector */}
              <select
                value={timeRange}
                onChange={(e) => setTimeRange(e.target.value)}
                className="px-4 py-2 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
              >
                <option value="7d">Last 7 Days</option>
                <option value="30d">Last 30 Days</option>
                <option value="90d">Last 90 Days</option>
                <option value="1y">Last Year</option>
                <option value="all">All Time</option>
              </select>
              
              {/* Export Button */}
              <button className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition">
                <Download className="w-4 h-4" />
                Export
              </button>
              
              {/* Refresh Button */}
              <button 
                onClick={() => void loadStats()}
                className="p-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Quick Stats Grid */}
          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="bg-white rounded-lg shadow-sm border p-4 animate-pulse">
                  <div className="h-4 bg-gray-200 rounded w-2/3 mb-3"></div>
                  <div className="h-8 bg-gray-200 rounded w-1/2 mb-2"></div>
                  <div className="h-3 bg-gray-200 rounded w-3/4"></div>
                </div>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
              {stats.map((stat, index) => {
                const Icon = stat.icon;
                const colorClass = getColorClass(stat.color);
                
                return (
                  <div key={index} className="bg-white rounded-lg shadow-sm border p-4 hover:shadow-md transition">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-sm text-gray-600">{stat.label}</span>
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${colorClass}`}>
                        <Icon className="w-4 h-4" />
                      </div>
                    </div>
                    <div className="mb-2">
                      <span className="text-2xl font-bold text-gray-900">{stat.value}</span>
                    </div>
                    <div className="flex items-center gap-1 text-sm mb-1">
                      {stat.trend === 'up' ? (
                        <>
                          <ArrowUp className="w-4 h-4 text-green-600" />
                          <span className="text-green-600">+{stat.change}%</span>
                        </>
                      ) : stat.trend === 'down' ? (
                        <>
                          <ArrowDown className="w-4 h-4 text-red-600" />
                          <span className="text-red-600">{stat.change}%</span>
                        </>
                      ) : (
                        <span className="text-gray-500">No change</span>
                      )}
                    </div>
                    <p className="text-xs text-gray-500">{stat.description}</p>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Detailed Metrics */}
        {metrics && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
            <div className="bg-white rounded-lg shadow-sm border p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Portfolio Breakdown</h3>
              <div className="space-y-4">
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Current Value</span>
                  <span className="font-semibold text-gray-900">{formatCurrency(metrics.portfolioValue)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Total Invested</span>
                  <span className="font-semibold text-gray-900">{formatCurrency(metrics.totalInvested)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Unrealized Gains</span>
                  <span className="font-semibold text-green-600">{formatCurrency(metrics.unrealizedGains)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Realized Gains</span>
                  <span className="font-semibold text-green-600">{formatCurrency(metrics.realizedGains)}</span>
                </div>
                <div className="pt-4 border-t">
                  <div className="flex justify-between">
                    <span className="text-sm font-medium text-gray-900">Net Gain</span>
                    <span className="font-bold text-green-600">
                      {formatCurrency(metrics.unrealizedGains + metrics.realizedGains)}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-sm border p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Investment Activity</h3>
              <div className="space-y-4">
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Active Investments</span>
                  <span className="font-semibold text-gray-900">{metrics.activeInvestments}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Completed Exits</span>
                  <span className="font-semibold text-gray-900">{metrics.completedExits}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Deal Flow (Period)</span>
                  <span className="font-semibold text-gray-900">{metrics.dealFlow}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Follow-on Rate</span>
                  <span className="font-semibold text-gray-900">{metrics.followOnRate}%</span>
                </div>
                <div className="pt-4 border-t">
                  <div className="flex justify-between">
                    <span className="text-sm font-medium text-gray-900">Success Rate</span>
                    <span className="font-bold text-purple-600">{metrics.hitRate}%</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-sm border p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Performance KPIs</h3>
              <div className="space-y-4">
                <div>
                  <div className="flex justify-between mb-2">
                    <span className="text-sm text-gray-600">ROI Performance</span>
                    <span className="font-semibold text-gray-900">{metrics.averageROI}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div 
                      className="bg-purple-600 h-2 rounded-full transition-all duration-300" 
                      style={{ width: `${Math.min(metrics.averageROI, 100)}%` }}
                    />
                  </div>
                </div>
                
                <div>
                  <div className="flex justify-between mb-2">
                    <span className="text-sm text-gray-600">Hit Rate</span>
                    <span className="font-semibold text-gray-900">{metrics.hitRate}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div 
                      className="bg-green-600 h-2 rounded-full transition-all duration-300" 
                      style={{ width: `${metrics.hitRate}%` }}
                    />
                  </div>
                </div>
                
                <div>
                  <div className="flex justify-between mb-2">
                    <span className="text-sm text-gray-600">Portfolio Utilization</span>
                    <span className="font-semibold text-gray-900">85%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div className="bg-blue-600 h-2 rounded-full transition-all duration-300" style={{ width: '85%' }} />
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Charts Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* Portfolio Performance Over Time */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <div className="space-y-1">
                <CardTitle className="text-base font-medium">Portfolio Performance</CardTitle>
                <CardDescription>Track portfolio value vs invested capital</CardDescription>
              </div>
              <BarChart3 className="w-5 h-5 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <ChartContainer config={portfolioConfig} className="h-[300px]">
                <LineChart data={portfolioPerformanceData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Line 
                    type="monotone" 
                    dataKey="portfolioValue" 
                    stroke="var(--color-portfolioValue)" 
                    strokeWidth={2}
                    dot={{ fill: "var(--color-portfolioValue)" }}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="totalInvested" 
                    stroke="var(--color-totalInvested)" 
                    strokeWidth={2}
                    dot={{ fill: "var(--color-totalInvested)" }}
                  />
                  <ChartLegend content={<ChartLegendContent />} />
                </LineChart>
              </ChartContainer>
            </CardContent>
          </Card>

          {/* Investments by Stage */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <div className="space-y-1">
                <CardTitle className="text-base font-medium">Investments by Stage</CardTitle>
                <CardDescription>Number of investments per funding stage</CardDescription>
              </div>
              <PieChart className="w-5 h-5 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <ChartContainer config={stageConfig} className="h-[300px]">
                <BarChart data={investmentsByStageData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Bar dataKey="value" fill="hsl(var(--chart-1))" />
                </BarChart>
              </ChartContainer>
            </CardContent>
          </Card>

          {/* Sector Allocation */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <div className="space-y-1">
                <CardTitle className="text-base font-medium">Sector Allocation</CardTitle>
                <CardDescription>Investment distribution by industry sector</CardDescription>
              </div>
              <PieChart className="w-5 h-5 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <ChartContainer config={sectorConfig} className="h-[300px]">
                <RechartsPieChart>
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Pie data={sectorAllocationData} dataKey="value" nameKey="name" innerRadius={60}>
                    {sectorAllocationData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.fill} />
                    ))}
                  </Pie>
                  <ChartLegend content={<ChartLegendContent />} />
                </RechartsPieChart>
              </ChartContainer>
            </CardContent>
          </Card>

          {/* Deal Flow Analysis */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <div className="space-y-1">
                <CardTitle className="text-base font-medium">Deal Flow Analysis</CardTitle>
                <CardDescription>Quarterly deal pipeline and closures</CardDescription>
              </div>
              <BarChart3 className="w-5 h-5 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <ChartContainer config={dealsConfig} className="h-[300px]">
                <BarChart data={monthlyDealsData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="quarter" />
                  <YAxis />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Bar dataKey="reviewed" fill="var(--color-reviewed)" />
                  <Bar dataKey="closed" fill="var(--color-closed)" />
                  <ChartLegend content={<ChartLegendContent />} />
                </BarChart>
              </ChartContainer>
            </CardContent>
          </Card>
        </div>

        {/* Performance Insights */}
        <div className="bg-gradient-to-r from-purple-600 to-indigo-600 rounded-xl shadow-xl p-6 text-white">
          <h3 className="text-xl font-semibold mb-4">Investment Insights</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="flex items-start gap-3">
              <TrendingUp className="w-6 h-6 mt-0.5" />
              <div>
                <p className="font-medium">Strong Performance</p>
                <p className="text-purple-100 text-sm">
                  Portfolio outperforming market by 15.3% this quarter
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Target className="w-6 h-6 mt-0.5" />
              <div>
                <p className="font-medium">Diversification Opportunity</p>
                <p className="text-purple-100 text-sm">
                  Consider increasing allocation to animation/VFX sector
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Award className="w-6 h-6 mt-0.5" />
              <div>
                <p className="font-medium">Top Quartile Performance</p>
                <p className="text-purple-100 text-sm">
                  Your hit rate exceeds industry average by 25%
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}