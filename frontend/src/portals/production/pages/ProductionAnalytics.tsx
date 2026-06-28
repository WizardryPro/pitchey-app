import { useState, useEffect } from 'react';
import {
  TrendingUp, DollarSign, Film, BarChart3,
  Target, ArrowUp, ArrowDown,
  Eye, AlertTriangle, CheckCircle,
  RefreshCw
} from 'lucide-react';
import { config } from '@/config';
import { RevenueChart } from '@features/analytics/components/charts/RevenueChart';
import { ROIChart } from '@features/analytics/components/charts/ROIChart';

interface AnalyticsMetric {
  title: string;
  value: string | number;
  change: number;
  changeType: 'increase' | 'decrease' | 'neutral';
  icon: React.ElementType;
  color: string;
}

interface ProjectPerformance {
  id: string;
  title: string;
  genre: string;
  roi: number;
  revenue: number;
  budget: number;
  status: 'development' | 'production' | 'completed' | 'released';
  views: number;
  engagement: number;
}

interface FinancialData {
  totalRevenue: number;
  totalBudget: number;
  avgROI: number;
  profitableProjects: number;
  monthlyRevenue: { month: string; revenue: number; budget: number }[];
}

interface ResourceUtilization {
  totalProjects: number;
  activeProjects: number;
  completedProjects: number;
  completionRate: number;
}

export default function ProductionAnalytics() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [timeRange, setTimeRange] = useState<'7d' | '30d' | '90d' | '1y'>('30d');
  
  // Analytics data state
  const [metrics, setMetrics] = useState<AnalyticsMetric[]>([]);
  const [projectPerformance, setProjectPerformance] = useState<ProjectPerformance[]>([]);
  const [financialData, setFinancialData] = useState<FinancialData | null>(null);
  const [resourceUtilization, setResourceUtilization] = useState<ResourceUtilization | null>(null);

  // Load analytics data from API
  useEffect(() => {
    void loadAnalyticsData();
  }, [timeRange]);

  const loadAnalyticsData = async () => {
    try {
      setError(null);
      const response = await fetch(`${config.API_URL}/api/production/analytics?timeframe=${timeRange}`, {
        method: 'GET',
        credentials: 'include'
      });

      if (!response.ok) {
        throw new Error(`Analytics API error: ${response.status}`);
      }

      const result = await response.json();
      const apiData = result.data || {};
      const pm = apiData.productionMetrics || {};
      const sm = apiData.successMetrics || {};

      const totalRevenue = parseFloat(sm.total_revenue) || 0;
      const activeProjects = parseInt(pm.active_projects) || 0;
      const completedProjects = parseInt(pm.completed_projects) || 0;
      const totalProjects = parseInt(pm.total_projects) || 0;
      const avgBudget = parseFloat(pm.avg_budget) || 0;

      setMetrics([
        {
          title: 'Total Revenue',
          value: `$${totalRevenue.toLocaleString()}`,
          change: 0,
          changeType: totalRevenue > 0 ? 'increase' : 'neutral',
          icon: DollarSign,
          color: 'text-green-600'
        },
        {
          title: 'Active Projects',
          value: activeProjects,
          change: 0,
          changeType: activeProjects > 0 ? 'increase' : 'neutral',
          icon: Film,
          color: 'text-blue-600'
        },
        {
          title: 'Completed Projects',
          value: completedProjects,
          change: 0,
          changeType: completedProjects > 0 ? 'increase' : 'neutral',
          icon: CheckCircle,
          color: 'text-purple-600'
        },
        {
          title: 'Avg Budget',
          value: `$${avgBudget.toLocaleString()}`,
          change: 0,
          changeType: avgBudget > 0 ? 'increase' : 'neutral',
          icon: TrendingUp,
          color: 'text-orange-600'
        }
      ]);

      // Map monthly trends → revenue chart data
      const monthlyRevenue = (apiData.monthlyTrends || []).map((t: { month: string; revenue: number; costs: number }) => ({
        month: t.month,
        revenue: parseFloat(String(t.revenue)) || 0,
        budget: parseFloat(String(t.costs)) || 0
      }));

      setFinancialData({
        totalRevenue,
        totalBudget: parseFloat(pm.total_budget) || 0,
        avgROI: 0,
        profitableProjects: 0,
        monthlyRevenue
      });

      // Map project performance
      const projects = (apiData.projectPerformance || []).map((p: { id: string; title: string; genre: string; roi: number; revenue: number; budget: number; status: string; views: number }) => ({
        id: p.id,
        title: p.title,
        genre: p.genre || 'Other',
        roi: parseFloat(String(p.roi)) || 0,
        revenue: parseFloat(String(p.revenue)) || 0,
        budget: parseFloat(String(p.budget)) || 0,
        status: p.status || 'development',
        views: parseInt(String(p.views)) || 0,
        engagement: 0
      }));
      setProjectPerformance(projects);

      // Resource utilization from production metrics
      const completionRate = parseFloat(pm.avg_completion_rate) || 0;
      setResourceUtilization({
        totalProjects,
        activeProjects,
        completedProjects,
        completionRate: Math.round(completionRate)
      });

    } catch (err) {
      const e = err instanceof Error ? err : new Error(String(err));
      console.error('Failed to load analytics data:', e);
      setError(e.message);
      setMetrics([]);
      setProjectPerformance([]);
      setFinancialData(null);
      setResourceUtilization(null);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadAnalyticsData();
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  };

  if (loading) {
    return (
      <div>
                <div className="flex items-center justify-center h-64">
          <div className="flex items-center space-x-2">
            <RefreshCw className="w-5 h-5 animate-spin text-blue-600" />
            <span className="text-gray-600">Loading analytics data...</span>
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
            <h1 className="text-2xl font-bold text-gray-900">Production Analytics</h1>
            <p className="mt-2 text-sm text-gray-600">
              Comprehensive insights into your production performance and financial metrics
            </p>
          </div>
          
          <div className="mt-4 sm:mt-0 flex flex-col sm:flex-row gap-3">
            {/* Time Range Filter */}
            <select
              value={timeRange}
              onChange={(e) => setTimeRange(e.target.value as any)}
              className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              <option value="7d">Last 7 days</option>
              <option value="30d">Last 30 days</option>
              <option value="90d">Last 90 days</option>
              <option value="1y">Last year</option>
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
              <AlertTriangle className="w-5 h-5 text-yellow-400" />
              <div className="ml-3">
                <h3 className="text-sm font-medium text-yellow-800">
                  API Connection Issue
                </h3>
                <div className="mt-2 text-sm text-yellow-700">
                  <p>Unable to connect to analytics API. {error}</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Key Metrics Grid */}
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4 mb-8">
          {metrics.map((metric, index) => (
            <div key={index} className="bg-white overflow-hidden shadow rounded-lg">
              <div className="p-5">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <metric.icon className={`w-6 h-6 ${metric.color}`} />
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className="text-sm font-medium text-gray-500 truncate">
                        {metric.title}
                      </dt>
                      <dd className="flex items-baseline">
                        <div className="text-2xl font-semibold text-gray-900">
                          {metric.value}
                        </div>
                        <div className={`ml-2 flex items-baseline text-sm font-semibold ${
                          metric.changeType === 'increase' ? 'text-green-600' : 
                          metric.changeType === 'decrease' ? 'text-red-600' : 'text-gray-500'
                        }`}>
                          {metric.changeType === 'increase' ? (
                            <ArrowUp className="w-3 h-3 flex-shrink-0 self-center" />
                          ) : metric.changeType === 'decrease' ? (
                            <ArrowDown className="w-3 h-3 flex-shrink-0 self-center" />
                          ) : null}
                          <span className="sr-only">
                            {metric.changeType === 'increase' ? 'Increased' : 'Decreased'} by
                          </span>
                          {Math.abs(metric.change)}%
                        </div>
                      </dd>
                    </dl>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Charts and Detailed Analytics */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* Revenue Trend Chart */}
          <div className="bg-white overflow-hidden shadow rounded-lg">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium text-gray-900">Revenue Trends</h3>
                <BarChart3 className="w-5 h-5 text-gray-400" />
              </div>
              <div className="h-64">
                <RevenueChart data={financialData?.monthlyRevenue} />
              </div>
            </div>
          </div>

          {/* Project Performance */}
          <div className="bg-white overflow-hidden shadow rounded-lg">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium text-gray-900">ROI by Project</h3>
                <Target className="w-5 h-5 text-gray-400" />
              </div>
              <div className="h-64">
                <ROIChart data={(projectPerformance ?? []).map(p => ({
                  project: p.title,
                  roi: p.roi,
                  revenue: p.revenue
                }))} />
              </div>
            </div>
          </div>
        </div>

        {/* Project Performance Table */}
        <div className="bg-white shadow overflow-hidden sm:rounded-md mb-8">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-medium text-gray-900">Project Performance</h3>
            <p className="mt-1 text-sm text-gray-600">
              Detailed performance metrics for your production projects
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Project
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Genre
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Revenue
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Budget
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    ROI
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Views
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {projectPerformance.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-8 text-center text-sm text-gray-500">
                      No production projects yet. Create projects to see performance data.
                    </td>
                  </tr>
                ) : projectPerformance.map((project) => (
                  <tr key={project.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <Film className="w-4 h-4 text-gray-400 mr-2" />
                        <div className="text-sm font-medium text-gray-900">
                          {project.title}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {project.genre}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {formatCurrency(project.revenue)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {formatCurrency(project.budget)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        project.roi > 150 ? 'bg-green-100 text-green-800' :
                        project.roi > 100 ? 'bg-yellow-100 text-yellow-800' :
                        'bg-red-100 text-red-800'
                      }`}>
                        {project.roi}%
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      <div className="flex items-center">
                        <Eye className="w-4 h-4 text-gray-400 mr-1" />
                        {project.views.toLocaleString()}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        project.status === 'completed' ? 'bg-green-100 text-green-800' :
                        project.status === 'production' ? 'bg-blue-100 text-blue-800' :
                        project.status === 'development' ? 'bg-yellow-100 text-yellow-800' :
                        'bg-purple-100 text-purple-800'
                      }`}>
                        {project.status === 'development' ? 'Development' :
                         project.status === 'production' ? 'Production' :
                         project.status === 'completed' ? 'Completed' : 'Released'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Resource Utilization Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white overflow-hidden shadow rounded-lg">
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <Film className="w-8 h-8 text-blue-600" />
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">
                      Active Projects
                    </dt>
                    <dd className="text-lg font-medium text-gray-900">
                      {resourceUtilization != null ? resourceUtilization.activeProjects : 'N/A'}
                    </dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white overflow-hidden shadow rounded-lg">
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <CheckCircle className="w-8 h-8 text-green-600" />
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">
                      Completed Projects
                    </dt>
                    <dd className="text-lg font-medium text-gray-900">
                      {resourceUtilization != null ? resourceUtilization.completedProjects : 'N/A'}
                    </dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white overflow-hidden shadow rounded-lg">
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <TrendingUp className="w-8 h-8 text-purple-600" />
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">
                      Completion Rate
                    </dt>
                    <dd className="text-lg font-medium text-gray-900">
                      {resourceUtilization != null ? `${resourceUtilization.completionRate}%` : 'N/A'}
                    </dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}