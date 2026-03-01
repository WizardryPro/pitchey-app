import { useState, useEffect } from 'react';
import {
  TrendingUp, TrendingDown, DollarSign, Film, Users, Eye,
  Heart, Clock, CheckCircle, AlertCircle, Star, Award,
  Calendar, Target, Zap, Activity, BarChart3, PieChart,
  ArrowUp, ArrowDown, Minus, PlayCircle, StopCircle,
  RefreshCw, Download, Share, Filter, Info
} from 'lucide-react';
import { useBetterAuthStore } from '../../store/betterAuthStore';
import { ProductionService } from '../../services/production.service';
import { RevenueChart } from '../../components/charts/RevenueChart';
import { ProjectStatusChart } from '../../components/charts/ProjectStatusChart';

interface QuickStat {
  id: string;
  title: string;
  value: string | number;
  change: number;
  changeType: 'increase' | 'decrease' | 'neutral';
  trend: 'up' | 'down' | 'stable';
  icon: React.ElementType;
  color: string;
  description: string;
}

interface TrendData {
  label: string;
  value: number;
  change: number;
}

interface ComparisonMetric {
  title: string;
  current: number;
  previous: number;
  unit: string;
  format: 'number' | 'currency' | 'percentage';
}

export default function ProductionStats() {
    const { user, logout } = useBetterAuthStore();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [timeRange, setTimeRange] = useState<'24h' | '7d' | '30d' | '90d'>('30d');
  
  // Stats data state
  const [quickStats, setQuickStats] = useState<QuickStat[]>([]);
  const [trendData, setTrendData] = useState<TrendData[]>([]);
  const [comparisonMetrics, setComparisonMetrics] = useState<ComparisonMetric[]>([]);
  const [kpiSummary, setKpiSummary] = useState<any>(null);

  // Load stats data from API
  useEffect(() => {
    loadStatsData();
  }, [timeRange]);

  const loadStatsData = async () => {
    try {
      setError(null);
      setLoading(true);

      // Fetch dashboard data which includes stats
      const [dashboardData, analyticsData] = await Promise.all([
        ProductionService.getDashboard().catch(() => null),
        ProductionService.getAnalytics(timeRange === '30d' ? 'month' : timeRange === '90d' ? 'quarter' : 'month').catch(() => null)
      ]);

      const stats = dashboardData?.stats;

      if (stats) {
        setQuickStats([
          {
            id: '1',
            title: 'Total Projects',
            value: stats.totalProjects || 0,
            change: 0,
            changeType: 'neutral',
            trend: 'stable',
            icon: Film,
            color: 'text-purple-600',
            description: 'Total production projects'
          },
          {
            id: '2',
            title: 'Active Projects',
            value: stats.activeProjects || 0,
            change: 0,
            changeType: 'neutral',
            trend: 'stable',
            icon: PlayCircle,
            color: 'text-blue-600',
            description: 'Currently active projects'
          },
          {
            id: '3',
            title: 'Total Budget',
            value: `$${((stats.totalBudget || 0) / 1000000).toFixed(1)}M`,
            change: 0,
            changeType: 'neutral',
            trend: 'stable',
            icon: DollarSign,
            color: 'text-green-600',
            description: 'Total budget across all projects'
          },
          {
            id: '4',
            title: 'Pitches Reviewed',
            value: stats.pitchesReviewed || 0,
            change: 0,
            changeType: 'neutral',
            trend: 'stable',
            icon: Eye,
            color: 'text-orange-600',
            description: 'Pitches reviewed this period'
          },
          {
            id: '5',
            title: 'Deals Signed',
            value: stats.pitchesContracted || 0,
            change: 0,
            changeType: 'neutral',
            trend: 'stable',
            icon: CheckCircle,
            color: 'text-green-600',
            description: 'Successful pitch contracts'
          },
          {
            id: '6',
            title: 'NDAs Signed',
            value: stats.ndaSigned || 0,
            change: 0,
            changeType: 'neutral',
            trend: 'stable',
            icon: Award,
            color: 'text-yellow-600',
            description: 'NDAs signed with creators'
          }
        ]);
      }

      if (analyticsData) {
        setKpiSummary({
          dealConversionRate: analyticsData.dealConversionRate,
          avgProductionTime: analyticsData.avgProductionTime,
          successRate: analyticsData.successRate
        });
      }

    } catch (err) {
      console.error('Failed to load stats data:', err);
      setError(err instanceof Error ? err.message : 'Failed to load stats data');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadStatsData();
  };

  const formatValue = (value: number, format: 'number' | 'currency' | 'percentage') => {
    switch (format) {
      case 'currency':
        return new Intl.NumberFormat('en-US', {
          style: 'currency',
          currency: 'USD',
          minimumFractionDigits: 0,
          maximumFractionDigits: 0
        }).format(value);
      case 'percentage':
        return `${value}%`;
      default:
        return value.toLocaleString();
    }
  };

  const getChangeIcon = (changeType: 'increase' | 'decrease' | 'neutral') => {
    switch (changeType) {
      case 'increase':
        return ArrowUp;
      case 'decrease':
        return ArrowDown;
      default:
        return Minus;
    }
  };

  const getChangeColor = (changeType: 'increase' | 'decrease' | 'neutral') => {
    switch (changeType) {
      case 'increase':
        return 'text-green-600';
      case 'decrease':
        return 'text-red-600';
      default:
        return 'text-gray-500';
    }
  };

  if (loading) {
    return (
      <div>
                <div className="flex items-center justify-center h-64">
          <div className="flex items-center space-x-2">
            <RefreshCw className="w-5 h-5 animate-spin text-blue-600" />
            <span className="text-gray-600">Loading statistics...</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Production Overview</h1>
            <p className="mt-2 text-sm text-gray-600">
              Quick insights and key performance indicators for your production operations
            </p>
          </div>
          
          <div className="mt-4 sm:mt-0 flex flex-col sm:flex-row gap-3">
            {/* Time Range Filter */}
            <select
              value={timeRange}
              onChange={(e) => setTimeRange(e.target.value as any)}
              className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              <option value="24h">Last 24 hours</option>
              <option value="7d">Last 7 days</option>
              <option value="30d">Last 30 days</option>
              <option value="90d">Last 90 days</option>
            </select>
            
            {/* Refresh Button */}
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
              {refreshing ? 'Refreshing...' : 'Refresh'}
            </button>
          </div>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="mb-6 bg-yellow-50 border border-yellow-200 rounded-md p-4">
            <div className="flex">
              <AlertCircle className="w-5 h-5 text-yellow-400" />
              <div className="ml-3">
                <h3 className="text-sm font-medium text-yellow-800">
                  API Connection Issue
                </h3>
                <div className="mt-2 text-sm text-yellow-700">
                  <p>Unable to connect to stats API. Showing demo data. {error}</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* KPI Summary Card */}
        {kpiSummary && (
          <div className="bg-gradient-to-r from-blue-500 to-purple-600 rounded-lg shadow-lg p-6 mb-8 text-white">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <div className="text-center">
                <div className="text-3xl font-bold">{kpiSummary.overallScore}/10</div>
                <div className="text-blue-100 text-sm">Overall Score</div>
              </div>
              <div className="text-center">
                <div className="text-lg font-semibold">{kpiSummary.performanceLevel}</div>
                <div className="text-blue-100 text-sm">Performance Level</div>
              </div>
              <div className="text-center">
                <div className="text-lg font-semibold">{kpiSummary.topPerformer}</div>
                <div className="text-blue-100 text-sm">Top Performer</div>
              </div>
              <div className="text-center">
                <div className="text-lg font-semibold">{kpiSummary.improvementArea}</div>
                <div className="text-blue-100 text-sm">Focus Area</div>
              </div>
            </div>
          </div>
        )}

        {/* Quick Stats Grid */}
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4 mb-8">
          {quickStats.map((stat) => {
            const IconComponent = stat.icon;
            const ChangeIcon = getChangeIcon(stat.changeType);
            const changeColor = getChangeColor(stat.changeType);
            
            return (
              <div key={stat.id} className="bg-white overflow-hidden shadow rounded-lg hover:shadow-lg transition-shadow">
                <div className="p-5">
                  <div className="flex items-center">
                    <div className="flex-shrink-0">
                      <IconComponent className={`w-8 h-8 ${stat.color}`} />
                    </div>
                    <div className="ml-5 w-0 flex-1">
                      <dl>
                        <dt className="text-sm font-medium text-gray-500 truncate">
                          {stat.title}
                        </dt>
                        <dd className="flex items-baseline">
                          <div className="text-2xl font-semibold text-gray-900">
                            {stat.value}
                          </div>
                          <div className={`ml-2 flex items-baseline text-sm font-semibold ${changeColor}`}>
                            <ChangeIcon className="w-3 h-3 flex-shrink-0 self-center" />
                            <span className="sr-only">
                              {stat.changeType === 'increase' ? 'Increased' : 
                               stat.changeType === 'decrease' ? 'Decreased' : 'No change'} by
                            </span>
                            {Math.abs(stat.change)}%
                          </div>
                        </dd>
                      </dl>
                    </div>
                  </div>
                  <div className="mt-3">
                    <p className="text-xs text-gray-600">{stat.description}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Comparison Metrics */}
        <div className="bg-white shadow rounded-lg p-6 mb-8">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-medium text-gray-900">Period Comparison</h3>
            <BarChart3 className="w-5 h-5 text-gray-400" />
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {comparisonMetrics.map((metric, index) => {
              const change = ((metric.current - metric.previous) / metric.previous) * 100;
              const isPositive = change > 0;
              
              return (
                <div key={index} className="text-center p-4 bg-gray-50 rounded-lg">
                  <h4 className="text-sm font-medium text-gray-700 mb-2">{metric.title}</h4>
                  <div className="space-y-2">
                    <div>
                      <span className="text-2xl font-bold text-gray-900">
                        {formatValue(metric.current, metric.format)}
                      </span>
                      <span className="text-sm text-gray-500 ml-1">{metric.unit}</span>
                    </div>
                    <div className="flex items-center justify-center space-x-1">
                      <span className="text-sm text-gray-500">vs</span>
                      <span className="text-sm text-gray-700 font-medium">
                        {formatValue(metric.previous, metric.format)}
                      </span>
                    </div>
                    <div className={`flex items-center justify-center space-x-1 text-sm font-medium ${
                      isPositive ? 'text-green-600' : 'text-red-600'
                    }`}>
                      {isPositive ? (
                        <ArrowUp className="w-3 h-3" />
                      ) : (
                        <ArrowDown className="w-3 h-3" />
                      )}
                      <span>{Math.abs(change).toFixed(1)}%</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Trend Visualization */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* Revenue Trend */}
          <div className="bg-white shadow rounded-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium text-gray-900">Revenue Trend</h3>
              <TrendingUp className="w-5 h-5 text-gray-400" />
            </div>
            <div className="h-64">
              <RevenueChart />
            </div>
          </div>

          {/* Project Status Distribution */}
          <div className="bg-white shadow rounded-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium text-gray-900">Project Distribution</h3>
              <PieChart className="w-5 h-5 text-gray-400" />
            </div>
            <div className="h-64">
              <ProjectStatusChart />
            </div>
          </div>
        </div>

        {/* Recent Trends Summary */}
        <div className="bg-white shadow rounded-lg p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-medium text-gray-900">Recent Trends</h3>
            <Activity className="w-5 h-5 text-gray-400" />
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="flex items-center p-4 bg-green-50 rounded-lg">
              <div className="flex-shrink-0">
                <TrendingUp className="w-8 h-8 text-green-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-green-900">Deal Conversion</p>
                <p className="text-lg font-bold text-green-600">{kpiSummary?.dealConversionRate != null ? `${kpiSummary.dealConversionRate}%` : '—'}</p>
              </div>
            </div>

            <div className="flex items-center p-4 bg-blue-50 rounded-lg">
              <div className="flex-shrink-0">
                <Clock className="w-8 h-8 text-blue-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-blue-900">Avg Production Time</p>
                <p className="text-lg font-bold text-blue-600">{kpiSummary?.avgProductionTime != null ? `${kpiSummary.avgProductionTime}d` : '—'}</p>
              </div>
            </div>

            <div className="flex items-center p-4 bg-purple-50 rounded-lg">
              <div className="flex-shrink-0">
                <CheckCircle className="w-8 h-8 text-purple-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-purple-900">Success Rate</p>
                <p className="text-lg font-bold text-purple-600">{kpiSummary?.successRate != null ? `${kpiSummary.successRate}%` : '—'}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}