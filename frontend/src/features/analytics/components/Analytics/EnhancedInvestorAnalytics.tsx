import React, { useState, useEffect, useCallback } from 'react';
import { 
  DollarSign, 
  TrendingUp, 
  Briefcase, 
  PieChart, 
  Star, 
  Users,
  Target,
  BarChart3,
  TrendingDown,
  RefreshCw,
  Download,
  Calendar
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

interface InvestorAnalyticsProps {
  portfolioPerformance?: {
    totalInvestments: number;
    totalInvested: number;
    activeDeals: number;
    averageReturn: number;
    returnChange: number;
    ndaSignedCount: number;
    recommendationMatchRate: number;
  };
}

interface InvestorAnalyticsData {
  kpis: {
    totalInvestments: number;
    totalInvested: number;
    portfolioValue: number;
    activeDeals: number;
    averageROI: number;
    successRate: number;
    monthlyDeals: number;
    ndasSigned: number;
    diversificationIndex: number;
    riskScore: number;
  };
  changes: {
    investmentsChange: number;
    investedChange: number;
    portfolioChange: number;
    dealsChange: number;
    roiChange: number;
    successChange: number;
    monthlyDealsChange: number;
    ndaChange: number;
    diversificationChange: number;
    riskChange: number;
  };
  charts: {
    portfolioGrowth: { date: string; value: number }[];
    investmentsByCategory: { category: string; amount: number; count: number }[];
    dealFlow: { date: string; value: number }[];
    roiTrends: { date: string; value: number }[];
    riskAssessment: { risk: string; count: number }[];
    monthlyPerformance: { month: string; invested: number; returns: number; deals: number }[];
    topInvestments: { title: string; amount: number; roi: number; status: string }[];
    marketSegments: { segment: string; allocation: number; performance: number }[];
  };
}

export const EnhancedInvestorAnalytics: React.FC<InvestorAnalyticsProps> = ({ 
  portfolioPerformance 
}) => {
  const [timeRange, setTimeRange] = useState<'7d' | '30d' | '90d' | '1y'>('30d');
  const [analyticsData, setAnalyticsData] = useState<InvestorAnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);

  const fetchAnalyticsData = useCallback(async () => {
    try {
      setLoading(true);

      // Call the investor analytics API with timeframe parameter
      const response = await fetch(
        `${config.API_URL}/api/investor/analytics?period=${timeRange === '7d' ? 'week' : timeRange === '30d' ? 'month' : timeRange === '90d' ? 'quarter' : 'year'}`,
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

      // Backend returns { success: true, data: { analytics: {...} } }
      // Also handle variations like { success: true, analytics: {...} } or { success: true, data: {...} }
      const analyticsData = result.data?.analytics || result.data;

      if (result.success && analyticsData) {
        // Transform API response to component data structure
        const transformedData: InvestorAnalyticsData = transformApiResponse(analyticsData);
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

  // Transform API response to component data structure.
  //
  // The /api/investor/analytics endpoint returns ONLY real fields:
  //   performance[], topPerformers[], riskAnalysis{}, genrePerformance[].
  // It does NOT return portfolio value, active-deal counts, monthly-deal counts,
  // NDA counts, or period-over-period deltas. Anything we can't derive from the
  // real fields is left at 0 — we do NOT fabricate it. (KPIs at 0 read as "no
  // data"; AnalyticCard hides the trend badge when change === 0.)
  const transformApiResponse = (apiData: any): InvestorAnalyticsData => {
    const genres: any[] = Array.isArray(apiData.genrePerformance) ? apiData.genrePerformance : [];
    const performance: any[] = Array.isArray(apiData.performance) ? apiData.performance : [];
    const risk = apiData.riskAnalysis;

    const totalInvested = genres.reduce((sum, g) => sum + (g.totalValue || 0), 0);
    const totalInvestments = genres.reduce((sum, g) => sum + (g.investments || 0), 0);

    // Value-weighted average ROI across genres (avgROI comes from real roi_percentage).
    const averageROI = totalInvested > 0
      ? genres.reduce((sum, g) => sum + (g.avgROI || 0) * (g.totalValue || 0), 0) / totalInvested
      : 0;

    // Current portfolio value derived from invested capital + recorded ROI per genre.
    // This is the only honest portfolio-value aggregate the API supports.
    const portfolioValue = Math.round(
      genres.reduce((sum, g) => sum + (g.totalValue || 0) * (1 + (g.avgROI || 0) / 100), 0)
    );

    // Diversification = (1 − Herfindahl index over invested value) × 10, 0–10 scale.
    const diversificationIndex = totalInvested > 0
      ? (1 - genres.reduce((sum, g) => sum + Math.pow((g.totalValue || 0) / totalInvested, 2), 0)) * 10
      : 0;

    // riskAnalysis values are real percentages (sum to 100 when investments exist).
    const riskScore = risk
      ? ((risk.highRisk || 0) * 3 + (risk.mediumRisk || 0) * 2 + (risk.lowRisk || 0)) / 100 * 10
      : 0;

    return {
      kpis: {
        totalInvestments,
        totalInvested,
        portfolioValue,
        activeDeals: 0,   // not provided by the API
        averageROI,
        successRate: 0,   // not provided by the API
        monthlyDeals: 0,  // not provided by the API
        ndasSigned: 0,    // not provided by the API
        diversificationIndex,
        riskScore,
      },
      changes: {
        // The analytics API does not return period-over-period deltas. Show no
        // trend badge rather than invent one (AnalyticCard hides change === 0).
        investmentsChange: 0,
        investedChange: 0,
        portfolioChange: 0,
        dealsChange: 0,
        roiChange: 0,
        successChange: 0,
        monthlyDealsChange: 0,
        ndaChange: 0,
        diversificationChange: 0,
        riskChange: 0,
      },
      charts: {
        // Real time-series from the API; empty array → charts render their empty state.
        portfolioGrowth: performance.map((p) => ({
          date: p.date,
          value: (p.invested || 0) + (p.returns || 0),
        })),
        investmentsByCategory: genres.map((g) => ({
          category: g.genre || 'Unknown',
          amount: g.totalValue || 0,
          count: g.investments || 0,
        })),
        dealFlow: [], // per-period deal counts not provided by the API
        roiTrends: performance.map((p) => ({
          date: p.date,
          value: p.invested > 0 ? Math.round(((p.returns || 0) / p.invested) * 100) : 0,
        })),
        riskAssessment: risk ? [
          { risk: 'Low Risk', count: risk.lowRisk || 0 },
          { risk: 'Medium Risk', count: risk.mediumRisk || 0 },
          { risk: 'High Risk', count: risk.highRisk || 0 },
        ] : [],
        monthlyPerformance: performance.map((p) => ({
          month: p.date,
          invested: p.invested || 0,
          returns: p.returns || 0,
          deals: 0,
        })),
        topInvestments: (apiData.topPerformers || []).map((p: any) => ({
          title: p.pitchTitle || 'Unknown',
          amount: p.amount || 0,
          roi: p.currentValue && p.amount ? Math.round((p.currentValue - p.amount) / p.amount * 100) : 0,
          status: p.status || 'Active',
        })),
        marketSegments: [], // not provided by the API
      }
    };
  };

  useEffect(() => {
    void fetchAnalyticsData();

    // Set up auto-refresh every 5 minutes if enabled
    let interval: NodeJS.Timeout;
    if (autoRefresh) {
      interval = setInterval(fetchAnalyticsData, 5 * 60 * 1000);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [timeRange, autoRefresh, fetchAnalyticsData]);

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
            <h2 className="text-2xl font-bold text-gray-900">Investment Portfolio Analytics</h2>
            <p className="text-gray-600">Monitor your investment performance and portfolio growth</p>
          </div>
          
          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={() => setAutoRefresh(!autoRefresh)}
              className={`flex items-center space-x-2 px-3 py-2 rounded-lg text-sm transition-colors ${
                autoRefresh 
                  ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200 hover:bg-emerald-100'
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
              title="Investor Analytics"
            />
          </div>
        </div>
      </div>

      {/* Primary KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <AnalyticCard 
          title="Total Investments"
          value={analyticsData.kpis.totalInvestments}
          change={analyticsData.changes.investmentsChange}
          icon={<Briefcase className="w-5 h-5 text-blue-500" />}
          variant="primary"
        />
        <AnalyticCard 
          title="Portfolio Value"
          value={analyticsData.kpis.portfolioValue}
          change={analyticsData.changes.portfolioChange}
          icon={<DollarSign className="w-5 h-5 text-green-500" />}
          variant="success"
          format="currency"
        />
        <AnalyticCard 
          title="Average ROI"
          value={analyticsData.kpis.averageROI}
          change={analyticsData.changes.roiChange}
          icon={<TrendingUp className="w-5 h-5 text-purple-500" />}
          variant="primary"
          format="percentage"
        />
        <AnalyticCard 
          title="Active Deals"
          value={analyticsData.kpis.activeDeals}
          change={analyticsData.changes.dealsChange}
          icon={<Target className="w-5 h-5 text-orange-500" />}
          variant="warning"
        />
        <AnalyticCard 
          title="Success Rate"
          value={analyticsData.kpis.successRate}
          change={analyticsData.changes.successChange}
          icon={<Star className="w-5 h-5 text-yellow-500" />}
          variant="warning"
          format="percentage"
        />
      </div>

      {/* Secondary KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <AnalyticCard 
          title="Total Invested"
          value={analyticsData.kpis.totalInvested}
          change={analyticsData.changes.investedChange}
          icon={<DollarSign className="w-5 h-5 text-indigo-500" />}
          variant="secondary"
          format="currency"
        />
        <AnalyticCard 
          title="Monthly Deals"
          value={analyticsData.kpis.monthlyDeals}
          change={analyticsData.changes.monthlyDealsChange}
          icon={<BarChart3 className="w-5 h-5 text-teal-500" />}
          variant="success"
        />
        <AnalyticCard 
          title="NDAs Signed"
          value={analyticsData.kpis.ndasSigned}
          change={analyticsData.changes.ndaChange}
          icon={<Users className="w-5 h-5 text-pink-500" />}
          variant="danger"
        />
        <AnalyticCard 
          title="Diversification Index"
          value={analyticsData.kpis.diversificationIndex.toFixed(1)}
          change={analyticsData.changes.diversificationChange}
          icon={<PieChart className="w-5 h-5 text-cyan-500" />}
          variant="success"
        />
        <AnalyticCard 
          title="Risk Score"
          value={analyticsData.kpis.riskScore.toFixed(1)}
          change={analyticsData.changes.riskChange}
          icon={<TrendingDown className="w-5 h-5 text-red-500" />}
          variant="danger"
        />
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Portfolio Growth */}
        <ChartContainer title="Portfolio Value Growth">
          {analyticsData.charts.portfolioGrowth.length > 0 ? (
            <AreaChart
              data={analyticsData.charts.portfolioGrowth}
              title="Portfolio Value ($)"
              color="#10B981"
              height={300}
            />
          ) : (
            <div className="flex items-center justify-center h-[300px] text-gray-500">No data available</div>
          )}
        </ChartContainer>

        {/* ROI Trends */}
        <ChartContainer title="ROI Trends">
          {analyticsData.charts.roiTrends.length > 0 ? (
            <LineChart
              data={analyticsData.charts.roiTrends}
              title="ROI (%)"
              color="#8B5CF6"
              height={300}
            />
          ) : (
            <div className="flex items-center justify-center h-[300px] text-gray-500">No data available</div>
          )}
        </ChartContainer>

        {/* Investment by Category */}
        <ChartContainer title="Investments by Category">
          {analyticsData.charts.investmentsByCategory.length > 0 ? (
            <BarChart
              data={analyticsData.charts.investmentsByCategory.map(item => ({
                category: item.category,
                value: item.amount
              }))}
              title="Investment Amount ($)"
              height={300}
            />
          ) : (
            <div className="flex items-center justify-center h-[300px] text-gray-500">No data available</div>
          )}
        </ChartContainer>

        {/* Risk Assessment */}
        <ChartContainer title="Portfolio Risk Distribution">
          {analyticsData.charts.riskAssessment.some(item => item.count > 0) ? (
            <PieChartComponent
              data={analyticsData.charts.riskAssessment.map(item => ({
                category: item.risk,
                value: item.count
              }))}
              title="Investment Risk Levels"
              type="doughnut"
              height={300}
            />
          ) : (
            <div className="flex items-center justify-center h-[300px] text-gray-500">No data available</div>
          )}
        </ChartContainer>

        {/* Deal Flow */}
        <ChartContainer title="Monthly Deal Flow">
          {analyticsData.charts.dealFlow.length > 0 ? (
            <BarChart
              data={analyticsData.charts.dealFlow.map((item) => ({
                category: new Date(item.date).toLocaleDateString('en-US', { month: 'short' }),
                value: item.value
              }))}
              title="Number of Deals"
              height={300}
            />
          ) : (
            <div className="flex items-center justify-center h-[300px] text-gray-500">No data available</div>
          )}
        </ChartContainer>

        {/* Market Segments Performance */}
        <ChartContainer title="Market Segment Performance">
          {analyticsData.charts.marketSegments.length > 0 ? (
            <MultiLineChart
              datasets={[
                {
                  label: 'Allocation (%)',
                  data: analyticsData.charts.marketSegments.map(item => ({
                    date: item.segment,
                    value: item.allocation
                  })),
                  color: '#3B82F6'
                },
                {
                  label: 'Performance (%)',
                  data: analyticsData.charts.marketSegments.map(item => ({
                    date: item.segment,
                    value: item.performance
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
      <ChartContainer title="Monthly Investment Performance">
        {analyticsData.charts.monthlyPerformance.length > 0 ? (
          <StackedBarChart
            data={analyticsData.charts.monthlyPerformance.map(item => ({
              category: item.month,
              values: [
                { label: 'Invested', value: item.invested / 1000 },
                { label: 'Returns', value: item.returns / 1000 }
              ]
            }))}
            height={350}
          />
        ) : (
          <div className="flex items-center justify-center h-[350px] text-gray-500">No data available</div>
        )}
      </ChartContainer>

      {/* Top Investments */}
      <div className="bg-white rounded-xl border p-6">
        <h3 className="text-xl font-semibold text-gray-900 mb-6">Top Investment Opportunities</h3>
        {analyticsData.charts.topInvestments.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {analyticsData.charts.topInvestments.map((investment, index) => (
              <div key={index} className="bg-gray-50 rounded-lg p-4 hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between mb-2">
                  <h4 className="font-medium text-gray-900 truncate flex-1">{investment.title}</h4>
                  <span className={`text-xs px-2 py-1 rounded-full ml-2 ${
                    investment.status === 'Active'
                      ? 'bg-green-100 text-green-800'
                      : 'bg-blue-100 text-blue-800'
                  }`}>
                    {investment.status}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <p className="text-gray-600">Investment</p>
                    <p className="font-semibold">${(investment.amount / 1000).toFixed(0)}k</p>
                  </div>
                  <div>
                    <p className="text-gray-600">ROI</p>
                    <p className={`font-semibold ${
                      investment.roi > 25 ? 'text-green-600' :
                      investment.roi > 15 ? 'text-yellow-600' : 'text-red-600'
                    }`}>
                      {investment.roi.toFixed(1)}%
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center text-gray-500 py-8">No data available</div>
        )}
      </div>

      {/*
        Removed the static "Portfolio Health", "Market Insights", and
        "Recommendations" panels — they rendered hardcoded strings
        ("Action films showing 15% growth", "Consider increasing Sci-Fi
        allocation", etc.) to every investor regardless of their actual
        portfolio. No data source backs them. Reinstate only when a real
        insights/recommendations endpoint exists. See issue #287.
      */}
    </div>
  );
};

export default EnhancedInvestorAnalytics;