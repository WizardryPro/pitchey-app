import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  DollarSign,
  TrendingUp,
  Layers,
  PieChart,
  Users,
  Shield,
  Building2,
  Clock,
  Calendar,
  CheckCircle,
  AlertCircle,
  RefreshCw,
  Download,
  Zap,
  BarChart3
} from 'lucide-react';

import { AnalyticCard } from './AnalyticCard';
import { TimeRangeFilter } from './TimeRangeFilter';
import { PerformanceChart } from './PerformanceChart';
import { AnalyticsExport } from './AnalyticsExport';
import { config } from '@/config';
import type { TimeRange } from '../../services/analytics.service';
import { 
  LineChart, 
  BarChart, 
  PieChart as PieChartComponent, 
  ChartContainer,
  MultiLineChart,
  AreaChart,
  StackedBarChart
} from './AnalyticsCharts';

interface ProductionAnalyticsProps {
  productionPerformance?: {
    totalPitches: number;
    totalRevenue: number;
    activeProjects: number;
    ndaSignedCount: number;
    averageProjectBudget: number;
    creatorInteractions: number;
  };
}

interface ProductionAnalyticsData {
  kpis: {
    activeProjects: number;
    totalBudget: number;
    avgProjectCost: number;
    completionRate: number;
    partnerships: number;
    monthlyRevenue: number;
    crewUtilization: number;
    onTimeDelivery: number;
    costVariance: number;
    clientSatisfaction: number;
  };
  changes: {
    projectsChange: number;
    budgetChange: number;
    costChange: number;
    completionChange: number;
    partnershipsChange: number;
    revenueChange: number;
    utilizationChange: number;
    deliveryChange: number;
    varianceChange: number;
    satisfactionChange: number;
  };
  charts: {
    projectPipeline: { stage: string; count: number; budget: number }[];
    budgetUtilization: { date: string; value: number }[];
    partnershipGrowth: { date: string; value: number }[];
    revenueProjections: { date: string; value: number }[];
    genreDistribution: { genre: string; projects: number; budget: number }[];
    monthlyMetrics: { month: string; projects: number; revenue: number; costs: number }[];
    projectTimelines: { project: string; planned: number; actual: number; status: string }[];
    resourceAllocation: { resource: string; allocated: number; utilized: number }[];
  };
}

export const EnhancedProductionAnalytics: React.FC<ProductionAnalyticsProps> = ({ 
  productionPerformance 
}) => {
  const [timeRange, setTimeRange] = useState<'7d' | '30d' | '90d' | '1y'>('30d');
  const [analyticsData, setAnalyticsData] = useState<ProductionAnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);

  // Use ref to always read the latest timeRange inside the callback,
  // avoiding stale-closure issues that cause "click twice to update"
  const timeRangeRef = useRef(timeRange);
  timeRangeRef.current = timeRange;

  const fetchAnalyticsData = useCallback(async () => {
    const range = timeRangeRef.current;
    try {
      setLoading(true);

      // Call the production analytics API with timeframe parameter
      const response = await fetch(
        `${config.API_URL}/api/production/analytics?timeframe=${range}`,
        {
          method: 'GET',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      const result = await response.json();

      // Backend returns { success: true, data: { summary, recentActivity, ... } }
      if (result.success && (result.data || result.analytics)) {
        // Transform API response to component data structure
        const apiData = result.data || result.analytics;
        const transformedData: ProductionAnalyticsData = transformApiResponse(apiData, range);
        setAnalyticsData(transformedData);
      } else {
        console.warn('API returned unexpected structure', result);
        setAnalyticsData(null);
        setError('Unexpected API response format');
      }
    } catch (err) {
      const e = err instanceof Error ? err : new Error(String(err));
      console.error('Error fetching analytics data:', e);
      setAnalyticsData(null);
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [timeRange]);

  useEffect(() => {
    fetchAnalyticsData();
    
    // Set up auto-refresh every 5 minutes if enabled
    let interval: NodeJS.Timeout;
    if (autoRefresh) {
      interval = setInterval(fetchAnalyticsData, 5 * 60 * 1000);
    }
    
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [timeRange, autoRefresh, fetchAnalyticsData]);

  // Transform API response to component data structure
  const transformApiResponse = (apiData: any, _range: string): ProductionAnalyticsData => {
    const metrics = apiData.productionMetrics || {};
    const genreData = apiData.genrePerformance || [];
    const timelineData = apiData.timelineAdherence || [];
    const crewData = apiData.crewUtilization || [];
    const successData = apiData.successMetrics || {};
    const trendsData = apiData.monthlyTrends || [];

    const totalProjects = Number(metrics.total_projects) || 0;
    const totalBudget = Number(metrics.total_budget) || 0;

    return {
      kpis: {
        activeProjects: Number(metrics.active_projects) || 0,
        totalBudget,
        avgProjectCost: totalProjects > 0 ? totalBudget / totalProjects : 0,
        completionRate: Number(metrics.avg_completion_rate) || 0,
        partnerships: Number(metrics.partnerships) || 0,
        monthlyRevenue: Number(successData.total_revenue) || 0,
        crewUtilization: crewData.length > 0
          ? crewData.reduce((acc: number, c: any) => acc + (Number(c.utilization_rate) || 0), 0) / crewData.length
          : 0,
        onTimeDelivery: timelineData.length > 0
          ? timelineData.reduce((acc: number, t: any) => acc + (Number(t.on_time_percentage) || 0), 0) / timelineData.length
          : 0,
        costVariance: metrics.total_budget && metrics.total_spent
          ? ((Number(metrics.total_spent) - Number(metrics.total_budget)) / Number(metrics.total_budget)) * 100
          : 0,
        clientSatisfaction: Number(successData.client_satisfaction) || 0,
      },
      changes: {
        projectsChange: Number(metrics.projects_change) || 0,
        budgetChange: Number(metrics.budget_change) || 0,
        costChange: Number(metrics.cost_change) || 0,
        completionChange: Number(metrics.completion_change) || 0,
        partnershipsChange: Number(metrics.partnerships_change) || 0,
        revenueChange: Number(successData.revenue_change) || 0,
        utilizationChange: 0,
        deliveryChange: 0,
        varianceChange: 0,
        satisfactionChange: 0,
      },
      charts: {
        projectPipeline: timelineData.length > 0
          ? timelineData.map((t: any) => ({
              stage: t.stage || 'Unknown',
              count: Number(t.projects) || 0,
              budget: 0
            }))
          : [],
        budgetUtilization: trendsData.map((t: any) => ({
          date: t.month || '',
          value: totalBudget > 0 ? Math.round((Number(t.costs) / totalBudget) * 100) : 0
        })),
        partnershipGrowth: trendsData.map((t: any) => ({
          date: t.month || '',
          value: Number(t.projects_created) || 0
        })),
        revenueProjections: trendsData.map((t: any) => ({
          date: t.month || '',
          value: Number(t.revenue) || 0
        })),
        genreDistribution: genreData.length > 0
          ? genreData.map((g: any) => ({
              genre: g.genre || 'Unknown',
              projects: Number(g.project_count) || 0,
              budget: Number(g.total_investment) || 0
            }))
          : [],
        monthlyMetrics: trendsData.map((t: any) => ({
          month: t.month || '',
          projects: Number(t.projects_created) || 0,
          revenue: Number(t.revenue) || 0,
          costs: Number(t.costs) || 0
        })),
        projectTimelines: apiData.projectTimelines?.map((t: any) => ({
          project: t.project || t.title || 'Unknown',
          planned: Number(t.planned) || 0,
          actual: Number(t.actual) || 0,
          status: t.status || 'Unknown',
        })) || [],
        resourceAllocation: crewData.length > 0
          ? crewData.map((c: any) => ({
              resource: c.department || 'Unknown',
              allocated: Number(c.total_crew) || 0,
              utilized: Math.round((Number(c.total_crew) || 0) * (Number(c.utilization_rate) || 80) / 100)
            }))
          : []
      }
    };
  };

  // Stub generators removed — all charts now use real API data from monthlyTrends

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!analyticsData) {
    return (
      <div className="text-center text-gray-500 py-8">
        <p className="mb-2">{error ? `Error: ${error}` : 'No analytics data available yet.'}</p>
        <button
          onClick={fetchAnalyticsData}
          className="text-blue-600 hover:text-blue-800 underline text-sm"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-xl border p-6">
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Production Analytics Dashboard</h2>
            <p className="text-gray-600">Monitor project pipeline, costs, and operational efficiency</p>
          </div>
          
          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={() => setAutoRefresh(!autoRefresh)}
              className={`flex items-center space-x-2 px-3 py-2 rounded-lg text-sm transition-colors ${
                autoRefresh 
                  ? 'bg-green-100 text-green-700 hover:bg-green-200' 
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              <RefreshCw className={`w-4 h-4 ${autoRefresh ? 'animate-pulse' : ''}`} />
              <span>Auto Refresh</span>
            </button>
            
            <TimeRangeFilter
              value={timeRange}
              onChange={(range) => setTimeRange(range)}
              defaultRange="30d"
            />
            
            <AnalyticsExport
              data={analyticsData as any}
              title="Production Analytics"
            />
          </div>
        </div>
      </div>

      {/* Primary KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <AnalyticCard 
          title="Active Projects"
          value={analyticsData.kpis.activeProjects}
          change={analyticsData.changes.projectsChange}
          icon={<Building2 className="w-5 h-5 text-blue-500" />}
          variant="primary"
        />
        <AnalyticCard 
          title="Total Budget"
          value={analyticsData.kpis.totalBudget}
          change={analyticsData.changes.budgetChange}
          icon={<DollarSign className="w-5 h-5 text-green-500" />}
          variant="success"
          format="currency"
        />
        <AnalyticCard 
          title="Completion Rate"
          value={analyticsData.kpis.completionRate}
          change={analyticsData.changes.completionChange}
          icon={<CheckCircle className="w-5 h-5 text-purple-500" />}
          variant="primary"
          format="percentage"
        />
        <AnalyticCard 
          title="Monthly Revenue"
          value={analyticsData.kpis.monthlyRevenue}
          change={analyticsData.changes.revenueChange}
          icon={<TrendingUp className="w-5 h-5 text-orange-500" />}
          variant="warning"
          format="currency"
        />
        <AnalyticCard 
          title="Partnerships"
          value={analyticsData.kpis.partnerships}
          change={analyticsData.changes.partnershipsChange}
          icon={<Users className="w-5 h-5 text-indigo-500" />}
          variant="secondary"
        />
      </div>

      {/* Secondary KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <AnalyticCard 
          title="Avg Project Cost"
          value={analyticsData.kpis.avgProjectCost}
          change={analyticsData.changes.costChange}
          icon={<PieChart className="w-5 h-5 text-cyan-500" />}
          variant="success"
          format="currency"
        />
        <AnalyticCard 
          title="Crew Utilization"
          value={analyticsData.kpis.crewUtilization}
          change={analyticsData.changes.utilizationChange}
          icon={<Zap className="w-5 h-5 text-yellow-500" />}
          variant="warning"
          format="percentage"
        />
        <AnalyticCard 
          title="On-Time Delivery"
          value={analyticsData.kpis.onTimeDelivery}
          change={analyticsData.changes.deliveryChange}
          icon={<Clock className="w-5 h-5 text-teal-500" />}
          variant="success"
          format="percentage"
        />
        <AnalyticCard 
          title="Cost Variance"
          value={analyticsData.kpis.costVariance.toFixed(1)}
          change={analyticsData.changes.varianceChange}
          icon={<BarChart3 className="w-5 h-5 text-red-500" />}
          variant="danger"
          format="percentage"
        />
        <AnalyticCard 
          title="Client Satisfaction"
          value={analyticsData.kpis.clientSatisfaction.toFixed(1)}
          change={analyticsData.changes.satisfactionChange}
          icon={<Shield className="w-5 h-5 text-green-500" />}
          variant="success"
        />
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Project Pipeline */}
        <ChartContainer title="Project Pipeline by Stage">
          {analyticsData.charts.projectPipeline.length > 0 ? (
            <BarChart
              data={analyticsData.charts.projectPipeline.map(item => ({
                category: item.stage,
                value: item.count
              }))}
              title="Number of Projects"
              height={300}
            />
          ) : (
            <div className="flex items-center justify-center h-[300px] text-gray-500">No data available</div>
          )}
        </ChartContainer>

        {/* Budget Utilization */}
        <ChartContainer title="Budget Utilization Trends">
          <AreaChart
            data={analyticsData.charts.budgetUtilization}
            title="Utilization (%)"
            color="#F59E0B"
            height={300}
          />
        </ChartContainer>

        {/* Genre Distribution */}
        <ChartContainer title="Projects by Genre">
          {analyticsData.charts.genreDistribution.length > 0 ? (
            <PieChartComponent
              data={analyticsData.charts.genreDistribution.map(item => ({
                category: item.genre,
                value: item.projects
              }))}
              title="Project Distribution"
              type="doughnut"
              height={300}
            />
          ) : (
            <div className="flex items-center justify-center h-[300px] text-gray-500">No data available</div>
          )}
        </ChartContainer>

        {/* Revenue Projections */}
        <ChartContainer title="Revenue Projections">
          <LineChart
            data={analyticsData.charts.revenueProjections}
            title="Projected Revenue ($)"
            color="#10B981"
            height={300}
          />
        </ChartContainer>

        {/* Partnership Growth */}
        <ChartContainer title="Partnership Growth">
          <AreaChart
            data={analyticsData.charts.partnershipGrowth}
            title="Active Partnerships"
            color="#8B5CF6"
            height={300}
          />
        </ChartContainer>

        {/* Resource Utilization */}
        <ChartContainer title="Resource Utilization">
          {analyticsData.charts.resourceAllocation.length > 0 ? (
            <MultiLineChart
              datasets={[
                {
                  label: 'Allocated',
                  data: analyticsData.charts.resourceAllocation.map(item => ({
                    date: item.resource,
                    value: item.allocated
                  })),
                  color: '#3B82F6'
                },
                {
                  label: 'Utilized',
                  data: analyticsData.charts.resourceAllocation.map(item => ({
                    date: item.resource,
                    value: item.utilized
                  })),
                  color: '#EF4444'
                }
              ]}
              height={300}
            />
          ) : (
            <div className="flex items-center justify-center h-[300px] text-gray-500">No data available</div>
          )}
        </ChartContainer>
      </div>

      {/* Monthly Performance Overview */}
      <ChartContainer title="Monthly Financial Performance">
        <StackedBarChart
          data={analyticsData.charts.monthlyMetrics.map(item => ({
            category: item.month,
            values: [
              { label: 'Revenue', value: item.revenue / 1000 },
              { label: 'Costs', value: item.costs / 1000 }
            ]
          }))}
          height={350}
        />
      </ChartContainer>

      {/* Project Timelines */}
      <div className="bg-white rounded-xl border p-6">
        <h3 className="text-xl font-semibold text-gray-900 mb-6">Project Timeline Performance</h3>
        {analyticsData.charts.projectTimelines.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-left border-b border-gray-200">
                  <th className="pb-3 text-gray-600">Project</th>
                  <th className="pb-3 text-gray-600">Planned (Days)</th>
                  <th className="pb-3 text-gray-600">Actual (Days)</th>
                  <th className="pb-3 text-gray-600">Variance</th>
                  <th className="pb-3 text-gray-600">Status</th>
                </tr>
              </thead>
              <tbody className="space-y-2">
                {analyticsData.charts.projectTimelines.map((project, index) => (
                  <tr key={index} className="border-b border-gray-100">
                    <td className="py-3 font-medium text-gray-900">{project.project}</td>
                    <td className="py-3 text-gray-600">{project.planned}</td>
                    <td className="py-3 text-gray-600">{project.actual || 'TBD'}</td>
                    <td className={`py-3 font-medium ${
                      project.actual === 0 ? 'text-gray-400' :
                      project.actual <= project.planned ? 'text-green-600' : 'text-red-600'
                    }`}>
                      {project.actual === 0 ? '-' :
                       project.actual <= project.planned ?
                       `${project.planned - project.actual} days early` :
                       `${project.actual - project.planned} days late`}
                    </td>
                    <td className="py-3">
                      <span className={`px-2 py-1 rounded-full text-xs ${
                        project.status === 'Completed' ? 'bg-green-100 text-green-800' :
                        project.status === 'In Progress' ? 'bg-blue-100 text-blue-800' :
                        project.status === 'Post-Production' ? 'bg-purple-100 text-purple-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {project.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center text-gray-500 py-8">No data available</div>
        )}
      </div>

      {/* Operational Insights — only show when there's real data */}
      {analyticsData.kpis.activeProjects > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="bg-white rounded-xl border p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Production Health</h3>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Pipeline Status</span>
                <span className={`font-semibold ${analyticsData.kpis.activeProjects > 0 ? 'text-green-600' : 'text-gray-400'}`}>
                  {analyticsData.kpis.activeProjects > 0 ? 'Active' : 'No projects'}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Budget Control</span>
                <span className={`font-semibold ${analyticsData.kpis.costVariance <= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {analyticsData.kpis.costVariance <= 0 ? 'On Track' : 'Over Budget'}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Completion Rate</span>
                <span className={`font-semibold ${analyticsData.kpis.completionRate >= 80 ? 'text-green-600' : analyticsData.kpis.completionRate >= 50 ? 'text-yellow-600' : 'text-red-600'}`}>
                  {analyticsData.kpis.completionRate}%
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-600">On-Time Delivery</span>
                <span className={`font-semibold ${analyticsData.kpis.onTimeDelivery >= 80 ? 'text-green-600' : analyticsData.kpis.onTimeDelivery >= 60 ? 'text-yellow-600' : 'text-red-600'}`}>
                  {analyticsData.kpis.onTimeDelivery}%
                </span>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl border p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Key Metrics</h3>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Active Projects</span>
                <span className="font-semibold text-gray-900">{analyticsData.kpis.activeProjects}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Total Budget</span>
                <span className="font-semibold text-gray-900">
                  {analyticsData.kpis.totalBudget > 0 ? `$${(analyticsData.kpis.totalBudget / 1000000).toFixed(1)}M` : '$0'}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Avg Project Cost</span>
                <span className="font-semibold text-gray-900">
                  {analyticsData.kpis.avgProjectCost > 0 ? `$${(analyticsData.kpis.avgProjectCost / 1000000).toFixed(1)}M` : '$0'}
                </span>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl border p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Performance</h3>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Monthly Revenue</span>
                <span className="font-semibold text-gray-900">
                  {analyticsData.kpis.monthlyRevenue > 0 ? `$${(analyticsData.kpis.monthlyRevenue / 1000).toFixed(0)}K` : '$0'}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Partnerships</span>
                <span className="font-semibold text-gray-900">{analyticsData.kpis.partnerships}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Client Satisfaction</span>
                <span className="font-semibold text-gray-900">
                  {analyticsData.kpis.clientSatisfaction > 0 ? analyticsData.kpis.clientSatisfaction.toFixed(1) : 'N/A'}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default EnhancedProductionAnalytics;