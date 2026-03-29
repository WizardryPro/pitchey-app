import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Bookmark,
  FileCheck,
  Shield,
  Users,
  Building2,
  RefreshCw,
  DollarSign,
  CheckCircle,
  TrendingUp,
} from 'lucide-react';

import { AnalyticCard } from './AnalyticCard';
import { TimeRangeFilter } from './TimeRangeFilter';
import { AnalyticsExport } from './AnalyticsExport';
import { config } from '@/config';
import type { TimeRange } from '../../services/analytics.service';
import {
  LineChart,
  BarChart,
  PieChart as PieChartComponent,
  ChartContainer,
} from './AnalyticsCharts';

interface PitchEvaluationProps {
  savedPitchCount: number;
  ndaRequestsSent: number;
  ndasSigned: number;
  creatorsFollowing: number;
  projectsStarted: number;
}

interface ChartData {
  genreDistribution: { genre: string; count: number }[];
  pipelineByStage: { stage: string; count: number }[];
  monthlyActivity: { date: string; value: number }[];
  // Project management data (only meaningful when projects exist)
  projectMetrics: {
    totalBudget: number;
    completionRate: number;
    totalRevenue: number;
  };
  projectTimelines: { project: string; planned: number; actual: number; status: string }[];
}

export const EnhancedProductionAnalytics: React.FC<PitchEvaluationProps> = (props) => {
  const [timeRange, setTimeRange] = useState<'7d' | '30d' | '90d' | '1y'>('30d');
  const [chartData, setChartData] = useState<ChartData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);

  const timeRangeRef = useRef(timeRange);
  timeRangeRef.current = timeRange;

  const fetchChartData = useCallback(async () => {
    const range = timeRangeRef.current;
    try {
      setLoading(true);
      const response = await fetch(
        `${config.API_URL}/api/production/analytics?timeframe=${range}`,
        { method: 'GET', credentials: 'include', headers: { 'Content-Type': 'application/json' } }
      );

      if (!response.ok) throw new Error(`API error: ${response.status}`);

      const result = await response.json();
      if (result.success && result.data) {
        const apiData = result.data;
        setChartData(transformChartData(apiData));
      } else {
        setChartData(null);
        setError('Unexpected API response format');
      }
    } catch (err) {
      const e = err instanceof Error ? err : new Error(String(err));
      console.error('Error fetching chart data:', e);
      setChartData(null);
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [timeRange]);

  useEffect(() => {
    fetchChartData();
    let interval: NodeJS.Timeout;
    if (autoRefresh) {
      interval = setInterval(fetchChartData, 5 * 60 * 1000);
    }
    return () => { if (interval) clearInterval(interval); };
  }, [timeRange, autoRefresh, fetchChartData]);

  const transformChartData = (apiData: any): ChartData => {
    const genreData = apiData.genrePerformance || [];
    const trendsData = apiData.monthlyTrends || [];
    const metrics = apiData.productionMetrics || {};
    const successData = apiData.successMetrics || {};

    // Build pipeline from props (more accurate than backend pipeline stages)
    const underReview = Math.max(0, props.savedPitchCount - props.ndasSigned - props.projectsStarted);
    const pipelineByStage = [
      { stage: 'Saved', count: props.savedPitchCount },
      { stage: 'Under Review', count: underReview },
      { stage: 'NDA Requested', count: props.ndaRequestsSent },
      { stage: 'NDA Signed', count: props.ndasSigned },
      { stage: 'Project Started', count: props.projectsStarted },
    ].filter(s => s.count > 0);

    return {
      genreDistribution: genreData.map((g: any) => ({
        genre: g.genre || 'Unknown',
        count: Number(g.project_count) || 0,
      })),
      pipelineByStage,
      monthlyActivity: trendsData.map((t: any) => ({
        date: t.month || '',
        value: Number(t.views) || Number(t.projects_created) || 0,
      })),
      projectMetrics: {
        totalBudget: Number(metrics.total_budget) || 0,
        completionRate: Number(metrics.avg_completion_rate) || 0,
        totalRevenue: Number(successData.total_revenue) || 0,
      },
      projectTimelines: apiData.projectTimelines?.map((t: any) => ({
        project: t.project || t.title || 'Unknown',
        planned: Number(t.planned) || 0,
        actual: Number(t.actual) || 0,
        status: t.status || 'Unknown',
      })) || [],
    };
  };

  // KPI cards use props directly — no loading state needed for them
  const underReview = Math.max(0, props.savedPitchCount - props.ndasSigned - props.projectsStarted);

  const exportData = [{
    pitchesSaved: props.savedPitchCount,
    underReview,
    ndasActive: props.ndasSigned,
    creatorsFollowing: props.creatorsFollowing,
    projectsStarted: props.projectsStarted,
  }];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-xl border p-6">
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Pitch Evaluation Dashboard</h2>
            <p className="text-gray-600">Track your pitch discovery, evaluation, and deal pipeline</p>
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
              data={exportData as any}
              title="Pitch Evaluation Analytics"
            />
          </div>
        </div>
      </div>

      {/* KPI Cards — always rendered from props, no loading dependency */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        <AnalyticCard
          title="Pitches Saved"
          value={props.savedPitchCount}
          change={0}
          icon={<Bookmark className="w-5 h-5 text-blue-500" />}
          variant="primary"
        />
        <AnalyticCard
          title="Under Review"
          value={underReview}
          change={0}
          icon={<FileCheck className="w-5 h-5 text-purple-500" />}
          variant="primary"
        />
        <AnalyticCard
          title="NDAs Active"
          value={props.ndasSigned}
          change={0}
          icon={<Shield className="w-5 h-5 text-green-500" />}
          variant="success"
        />
        <AnalyticCard
          title="Creators Following"
          value={props.creatorsFollowing}
          change={0}
          icon={<Users className="w-5 h-5 text-indigo-500" />}
          variant="secondary"
        />
        <AnalyticCard
          title="Projects Started"
          value={props.projectsStarted}
          change={0}
          icon={<Building2 className="w-5 h-5 text-orange-500" />}
          variant="warning"
        />
      </div>

      {/* Charts — depend on API fetch */}
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
        </div>
      ) : error && !chartData ? (
        <div className="text-center text-gray-500 py-8">
          <p className="mb-2">Error loading charts: {error}</p>
          <button onClick={fetchChartData} className="text-purple-600 hover:text-purple-800 underline text-sm">
            Retry
          </button>
        </div>
      ) : chartData ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Evaluation Pipeline */}
          <ChartContainer title="Evaluation Pipeline">
            {chartData.pipelineByStage.length > 0 ? (
              <BarChart
                data={chartData.pipelineByStage.map(item => ({
                  category: item.stage,
                  value: item.count
                }))}
                title="Pitches by Stage"
                height={300}
                color="#8B5CF6"
              />
            ) : (
              <div className="flex items-center justify-center h-[300px] text-gray-500">
                Save pitches from the marketplace to build your pipeline
              </div>
            )}
          </ChartContainer>

          {/* Genre Distribution */}
          <ChartContainer title="Pitches by Genre">
            {chartData.genreDistribution.length > 0 ? (
              <PieChartComponent
                data={chartData.genreDistribution.map(item => ({
                  category: item.genre,
                  value: item.count
                }))}
                title="Saved Pitches by Genre"
                type="doughnut"
                height={300}
              />
            ) : (
              <div className="flex items-center justify-center h-[300px] text-gray-500">
                No genre data available yet
              </div>
            )}
          </ChartContainer>

          {/* Monthly Activity */}
          <ChartContainer title="Monthly Activity">
            {chartData.monthlyActivity.length > 0 ? (
              <LineChart
                data={chartData.monthlyActivity}
                title="Pitch Engagement"
                color="#8B5CF6"
                height={300}
              />
            ) : (
              <div className="flex items-center justify-center h-[300px] text-gray-500">
                Activity data will appear as you engage with pitches
              </div>
            )}
          </ChartContainer>
        </div>
      ) : null}

      {/* Project Management — only shown when projects exist */}
      {props.projectsStarted > 0 && chartData && (
        <div className="space-y-6">
          <div className="border-t pt-6">
            <h2 className="text-xl font-bold text-gray-900 mb-1">Active Projects</h2>
            <p className="text-gray-500 text-sm mb-4">Tracking projects converted from pitches</p>
          </div>

          {/* Project KPIs */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <AnalyticCard
              title="Total Budget"
              value={chartData.projectMetrics.totalBudget}
              change={0}
              icon={<DollarSign className="w-5 h-5 text-green-500" />}
              variant="success"
              format="currency"
            />
            <AnalyticCard
              title="Completion Rate"
              value={chartData.projectMetrics.completionRate}
              change={0}
              icon={<CheckCircle className="w-5 h-5 text-purple-500" />}
              variant="primary"
              format="percentage"
            />
            <AnalyticCard
              title="Total Revenue"
              value={chartData.projectMetrics.totalRevenue}
              change={0}
              icon={<TrendingUp className="w-5 h-5 text-orange-500" />}
              variant="warning"
              format="currency"
            />
          </div>

          {/* Project Timelines Table */}
          {chartData.projectTimelines.length > 0 && (
            <div className="bg-white rounded-xl border p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Project Timelines</h3>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="text-left border-b border-gray-200">
                      <th className="pb-3 text-sm font-medium text-gray-600">Project</th>
                      <th className="pb-3 text-sm font-medium text-gray-600">Planned (Days)</th>
                      <th className="pb-3 text-sm font-medium text-gray-600">Actual (Days)</th>
                      <th className="pb-3 text-sm font-medium text-gray-600">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {chartData.projectTimelines.map((project, index) => (
                      <tr key={index} className="border-b border-gray-100">
                        <td className="py-3 font-medium text-gray-900">{project.project}</td>
                        <td className="py-3 text-gray-600">{project.planned || '—'}</td>
                        <td className="py-3 text-gray-600">{project.actual || 'In Progress'}</td>
                        <td className="py-3">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                            project.status === 'Completed' ? 'bg-green-100 text-green-800' :
                            project.status === 'Post-Production' ? 'bg-purple-100 text-purple-800' :
                            project.status === 'Production' ? 'bg-blue-100 text-blue-800' :
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
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default EnhancedProductionAnalytics;
