import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Bookmark,
  FileCheck,
  Shield,
  Users,
  RefreshCw,
  BarChart3,
} from 'lucide-react';

import { AnalyticCard } from './AnalyticCard';
import { TimeRangeFilter } from './TimeRangeFilter';
import { AnalyticsExport } from './AnalyticsExport';
import { config } from '@/config';
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
}

interface ChartData {
  genreDistribution: { genre: string; count: number }[];
  pipelineByStage: { stage: string; count: number }[];
  monthlyActivity: { date: string; value: number }[];
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
    void fetchChartData();
    let interval: NodeJS.Timeout;
    if (autoRefresh) {
      interval = setInterval(() => void fetchChartData(), 5 * 60 * 1000);
    }
    return () => { if (interval) clearInterval(interval); };
  }, [timeRange, autoRefresh, fetchChartData]);

  const transformChartData = (apiData: any): ChartData => {
    const genreData = apiData.genrePerformance || [];
    const trendsData = apiData.monthlyTrends || [];

    // Build pipeline from props (more accurate than backend pipeline stages)
    const underReview = Math.max(0, props.savedPitchCount - props.ndasSigned);
    const pipelineByStage = [
      { stage: 'Saved', count: props.savedPitchCount },
      { stage: 'Under Review', count: underReview },
      { stage: 'NDA Requested', count: props.ndaRequestsSent },
      { stage: 'NDA Signed', count: props.ndasSigned },
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
    };
  };

  // KPI cards use props directly — no loading state needed for them
  const underReview = Math.max(0, props.savedPitchCount - props.ndasSigned);

  const exportData = [{
    pitchesSaved: props.savedPitchCount,
    underReview,
    ndasActive: props.ndasSigned,
    creatorsFollowing: props.creatorsFollowing,
  }];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-xl border border-gray-200/70 shadow-sm p-6">
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
          <div className="flex items-start gap-3">
            <span className="hidden sm:inline-flex h-10 w-10 items-center justify-center rounded-xl bg-brand-portal-production/10 text-brand-portal-production">
              <BarChart3 className="w-5 h-5" />
            </span>
            <div>
              <h2 className="text-xl font-bold tracking-tight text-gray-900">Pitch Evaluation Dashboard</h2>
              <p className="text-sm text-gray-500">Track your pitch discovery, evaluation, and deal pipeline</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={() => setAutoRefresh(!autoRefresh)}
              className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                autoRefresh
                  ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200 hover:bg-emerald-100'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
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
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
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
                title="Pitches by Genre"
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
    </div>
  );
};

export default EnhancedProductionAnalytics;
