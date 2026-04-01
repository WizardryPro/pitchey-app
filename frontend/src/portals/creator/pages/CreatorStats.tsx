import { useState, useEffect, useCallback } from 'react';
import {
  TrendingUp, Eye, Heart, Users,
  DollarSign, FileText, Award, Star,
  ArrowUp, ArrowDown, PieChart,
  Download, RefreshCw, AlertCircle
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@shared/components/ui/card';
import { ChartContainer, ChartTooltip, ChartTooltipContent, ChartLegend, ChartLegendContent } from '@shared/components/ui/chart';
import {
  BarChart, Bar,
  PieChart as RechartsPieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid
} from 'recharts';
import { CreatorService, type CreatorStats as CreatorStatsType, type CreatorAnalytics } from '@features/analytics/services/creator.service';
import { AnalyticsService } from '@features/analytics/services/analytics.service';
import { PitchService, type Pitch } from '@features/pitches/services/pitch.service';

interface QuickStat {
  label: string;
  value: string | number;
  change: number;
  trend: 'up' | 'down' | 'stable';
  icon: any;
  color: string;
}

export default function CreatorStats() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<QuickStat[]>([]);
  const [topPitches, setTopPitches] = useState<Pitch[]>([]);
  const [genrePerformanceData, setGenrePerformanceData] = useState<{ genre: string; views: number }[]>([]);
  const [engagementChartData, setEngagementChartData] = useState<{ name: string; value: number; fill: string }[]>([]);

  const loadStats = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch data from multiple API endpoints
      const [dashboardData, myPitches, dashboardMetrics] = await Promise.all([
        CreatorService.getDashboard().catch(() => null),
        PitchService.getMyPitches().catch(() => []),
        AnalyticsService.getDashboardMetrics().catch(() => null)
      ]);

      // Calculate stats from API data
      const apiStats = dashboardData?.stats;
      const publishedPitches = myPitches.filter((p: Pitch) => p.status === 'published');

      // Calculate total views and likes from pitches
      const totalViews = myPitches.reduce((acc: number, p: Pitch) => acc + (p.viewCount || 0), 0);
      const totalLikes = myPitches.reduce((acc: number, p: Pitch) => acc + (p.likeCount || 0), 0);
      const totalNDAs = apiStats?.totalNDAs || myPitches.reduce((acc: number, p: Pitch) => acc + (p.ndaCount || 0), 0);
      const engagementRate = totalViews > 0 ? ((totalLikes / totalViews) * 100) : 0;

      // Change percentages from analytics dashboard
      const ov = dashboardMetrics?.overview;
      const viewsChg = ov?.viewsChange || 0;
      const likesChg = ov?.likesChange || 0;
      const pitchesChg = ov?.pitchesChange || 0;
      const ndasChg = ov?.ndasChange || 0;

      const trendOf = (v: number): 'up' | 'down' | 'stable' => v > 0 ? 'up' : v < 0 ? 'down' : 'stable';

      setStats([
        {
          label: 'Total Views',
          value: totalViews.toLocaleString(),
          change: viewsChg,
          trend: trendOf(viewsChg),
          icon: Eye,
          color: 'blue'
        },
        {
          label: 'Engagement Rate',
          value: `${engagementRate.toFixed(1)}%`,
          change: likesChg,
          trend: trendOf(likesChg),
          icon: Heart,
          color: 'red'
        },
        {
          label: 'Active Pitches',
          value: publishedPitches.length,
          change: pitchesChg,
          trend: trendOf(pitchesChg),
          icon: FileText,
          color: 'purple'
        },
        {
          label: 'Total Likes',
          value: totalLikes.toLocaleString(),
          change: likesChg,
          trend: trendOf(likesChg),
          icon: Users,
          color: 'green'
        },
        {
          label: 'Total NDAs',
          value: totalNDAs,
          change: ndasChg,
          trend: trendOf(ndasChg),
          icon: DollarSign,
          color: 'yellow'
        },
        {
          label: 'Total Pitches',
          value: myPitches.length,
          change: pitchesChg,
          trend: trendOf(pitchesChg),
          icon: Star,
          color: 'orange'
        }
      ]);

      // Build genre performance from real pitch data
      const genreMap = new Map<string, number>();
      myPitches.forEach((p: Pitch) => {
        const genre = p.genre || 'Unknown';
        genreMap.set(genre, (genreMap.get(genre) || 0) + (p.viewCount || 0));
      });
      setGenrePerformanceData(
        Array.from(genreMap.entries())
          .map(([genre, views]) => ({ genre, views }))
          .sort((a, b) => b.views - a.views)
      );

      // Build engagement breakdown from real totals
      setEngagementChartData([
        { name: 'Likes', value: totalLikes, fill: 'hsl(var(--chart-1))' },
        { name: 'NDAs', value: totalNDAs, fill: 'hsl(var(--chart-2))' },
        { name: 'Views', value: totalViews, fill: 'hsl(var(--chart-3))' }
      ].filter(d => d.value > 0));

      // Set top pitches (sorted by views)
      const sorted = [...myPitches].sort((a, b) => (b.viewCount || 0) - (a.viewCount || 0)).slice(0, 5);
      setTopPitches(sorted);

    } catch (err) {
      console.error('Failed to load stats:', err);
      setError('Failed to load statistics. Please try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  // Chart configurations
  const engagementConfig = {
    value: {
      label: 'Engagement'
    }
  };

  const genreConfig = {
    views: {
      label: 'Views',
      color: 'hsl(var(--chart-1))'
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

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Quick Stats</h1>
            <p className="mt-2 text-gray-600">
              Track your performance and engagement metrics
            </p>
          </div>
          <div className="flex items-center gap-3">
            {/* Refresh Button */}
            <button
              onClick={loadStats}
              className="p-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Error State */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
            <div className="flex items-center gap-3">
              <AlertCircle className="w-5 h-5 text-red-600" />
              <p className="text-red-700">{error}</p>
              <button
                onClick={loadStats}
                className="ml-auto text-red-600 hover:text-red-800 font-medium"
              >
                Retry
              </button>
            </div>
          </div>
        )}

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
                  <div className="flex items-center gap-1 text-sm">
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
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Genre Performance */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <div className="space-y-1">
              <CardTitle className="text-base font-medium">Genre Performance</CardTitle>
              <CardDescription>Views breakdown by genre</CardDescription>
            </div>
            <TrendingUp className="w-5 h-5 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {genrePerformanceData.length > 0 ? (
              <ChartContainer config={genreConfig} className="h-[300px]">
                <BarChart data={genrePerformanceData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="genre" />
                  <YAxis />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Bar dataKey="views" fill="var(--color-views)" />
                </BarChart>
              </ChartContainer>
            ) : (
              <div className="flex items-center justify-center h-[300px] text-gray-500">
                No genre data yet
              </div>
            )}
          </CardContent>
        </Card>

        {/* Engagement Breakdown */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <div className="space-y-1">
              <CardTitle className="text-base font-medium">Engagement Breakdown</CardTitle>
              <CardDescription>Likes, NDAs, and views across your pitches</CardDescription>
            </div>
            <PieChart className="w-5 h-5 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {engagementChartData.length > 0 ? (
              <ChartContainer config={engagementConfig} className="h-[300px]">
                <RechartsPieChart>
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Pie data={engagementChartData} dataKey="value" nameKey="name">
                    {engagementChartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.fill} />
                    ))}
                  </Pie>
                  <ChartLegend content={<ChartLegendContent />} />
                </RechartsPieChart>
              </ChartContainer>
            ) : (
              <div className="flex items-center justify-center h-[300px] text-gray-500">
                No engagement data yet
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Top Performing Pitches */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <div className="space-y-1">
            <CardTitle className="text-base font-medium">Top Performing Pitches</CardTitle>
            <CardDescription>Your most successful pitches by engagement</CardDescription>
          </div>
          <Award className="w-5 h-5 text-muted-foreground" />
        </CardHeader>
        <CardContent>
        <div className="overflow-x-auto">
          {topPitches.length > 0 ? (
            <table className="min-w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-3 px-4 font-semibold text-sm text-gray-900">Pitch Title</th>
                  <th className="text-center py-3 px-4 font-semibold text-sm text-gray-900">Views</th>
                  <th className="text-center py-3 px-4 font-semibold text-sm text-gray-900">Likes</th>
                  <th className="text-center py-3 px-4 font-semibold text-sm text-gray-900">NDAs</th>
                  <th className="text-center py-3 px-4 font-semibold text-sm text-gray-900">Engagement</th>
                  <th className="text-center py-3 px-4 font-semibold text-sm text-gray-900">Status</th>
                </tr>
              </thead>
              <tbody>
                {topPitches.map((pitch, index) => {
                  const engagementRate = pitch.viewCount && pitch.viewCount > 0
                    ? ((pitch.likeCount || 0) / pitch.viewCount * 100).toFixed(1)
                    : '0.0';
                  const statusColors: Record<string, string> = {
                    published: 'bg-green-100 text-green-800',
                    draft: 'bg-gray-100 text-gray-800',
                    under_review: 'bg-yellow-100 text-yellow-800',
                    archived: 'bg-red-100 text-red-800'
                  };

                  return (
                    <tr key={pitch.id} className={`${index < topPitches.length - 1 ? 'border-b' : ''} hover:bg-gray-50`}>
                      <td className="py-3 px-4">
                        <div>
                          <p className="font-medium text-gray-900">{pitch.title}</p>
                          <p className="text-sm text-gray-500 capitalize">{pitch.genre}</p>
                        </div>
                      </td>
                      <td className="text-center py-3 px-4">{(pitch.viewCount || 0).toLocaleString()}</td>
                      <td className="text-center py-3 px-4">{(pitch.likeCount || 0).toLocaleString()}</td>
                      <td className="text-center py-3 px-4">{pitch.ndaCount || 0}</td>
                      <td className="text-center py-3 px-4">
                        <span className={`font-semibold ${parseFloat(engagementRate) >= 5 ? 'text-green-600' : 'text-yellow-600'}`}>
                          {engagementRate}%
                        </span>
                      </td>
                      <td className="text-center py-3 px-4">
                        <span className={`px-2 py-1 rounded-full text-xs ${statusColors[pitch.status] || 'bg-gray-100 text-gray-800'}`}>
                          {pitch.status.replace('_', ' ')}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          ) : (
            <div className="text-center py-8 text-gray-500">
              <FileText className="w-12 h-12 mx-auto mb-3 text-gray-300" />
              <p>No pitches yet. Create your first pitch to see stats!</p>
            </div>
          )}
        </div>
        </CardContent>
      </Card>
    </div>
  );
}