import { useState, useEffect, useCallback } from 'react';
import {
  TrendingUp, Eye, Heart, MessageSquare, Users,
  DollarSign, FileText, Award, Star, Clock,
  ArrowUp, ArrowDown, BarChart3, PieChart,
  Calendar, Filter, Download, RefreshCw, AlertCircle
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@shared/components/ui/card';
import { ChartContainer, ChartTooltip, ChartTooltipContent, ChartLegend, ChartLegendContent } from '@shared/components/ui/chart';
import {
  LineChart, Line,
  BarChart, Bar,
  PieChart as RechartsPieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, ResponsiveContainer
} from 'recharts';
import { CreatorService, type CreatorStats as CreatorStatsType, type CreatorAnalytics } from '../../services/creator.service';
import { PitchService, type Pitch } from '../../services/pitch.service';

interface QuickStat {
  label: string;
  value: string | number;
  change: number;
  trend: 'up' | 'down' | 'stable';
  icon: any;
  color: string;
}

export default function CreatorStats() {
  const [timeRange, setTimeRange] = useState('7days');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<QuickStat[]>([]);
  const [topPitches, setTopPitches] = useState<Pitch[]>([]);

  const loadStats = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch data from multiple API endpoints
      const [dashboardData, myPitches] = await Promise.all([
        CreatorService.getDashboard().catch(() => null),
        PitchService.getMyPitches().catch(() => [])
      ]);

      // Calculate stats from API data
      const apiStats = dashboardData?.stats;
      const publishedPitches = myPitches.filter((p: Pitch) => p.status === 'published');

      // Calculate total views and likes from pitches
      const totalViews = myPitches.reduce((acc: number, p: Pitch) => acc + (p.viewCount || 0), 0);
      const totalLikes = myPitches.reduce((acc: number, p: Pitch) => acc + (p.likeCount || 0), 0);
      const engagementRate = totalViews > 0 ? ((totalLikes / totalViews) * 100) : 0;

      setStats([
        {
          label: 'Total Views',
          value: totalViews.toLocaleString(),
          change: apiStats?.monthlyGrowth || 0,
          trend: (apiStats?.monthlyGrowth || 0) > 0 ? 'up' : (apiStats?.monthlyGrowth || 0) < 0 ? 'down' : 'stable',
          icon: Eye,
          color: 'blue'
        },
        {
          label: 'Engagement Rate',
          value: `${engagementRate.toFixed(1)}%`,
          change: 0,
          trend: 'stable',
          icon: Heart,
          color: 'red'
        },
        {
          label: 'Active Pitches',
          value: publishedPitches.length,
          change: 0,
          trend: 'stable',
          icon: FileText,
          color: 'purple'
        },
        {
          label: 'Total Likes',
          value: totalLikes.toLocaleString(),
          change: 0,
          trend: 'stable',
          icon: Users,
          color: 'green'
        },
        {
          label: 'Total NDAs',
          value: apiStats?.totalNDAs || myPitches.reduce((acc: number, p: Pitch) => acc + (p.ndaCount || 0), 0),
          change: 0,
          trend: 'stable',
          icon: DollarSign,
          color: 'yellow'
        },
        {
          label: 'Total Pitches',
          value: myPitches.length,
          change: 0,
          trend: 'stable',
          icon: Star,
          color: 'orange'
        }
      ]);

      // Set top pitches (sorted by views)
      const sorted = [...myPitches].sort((a, b) => (b.viewCount || 0) - (a.viewCount || 0)).slice(0, 5);
      setTopPitches(sorted);

    } catch (err) {
      console.error('Failed to load stats:', err);
      setError('Failed to load statistics. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [timeRange]);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  // Chart data
  const viewsChartData = [
    { day: 'Mon', views: 1200 },
    { day: 'Tue', views: 1900 },
    { day: 'Wed', views: 1500 },
    { day: 'Thu', views: 2100 },
    { day: 'Fri', views: 2300 },
    { day: 'Sat', views: 1800 },
    { day: 'Sun', views: 2500 }
  ];

  const engagementChartData = [
    { name: 'Likes', value: 342, fill: 'hsl(var(--chart-1))' },
    { name: 'Comments', value: 128, fill: 'hsl(var(--chart-2))' },
    { name: 'Shares', value: 87, fill: 'hsl(var(--chart-3))' },
    { name: 'Saves', value: 256, fill: 'hsl(var(--chart-4))' },
    { name: 'NDAs', value: 43, fill: 'hsl(var(--chart-5))' }
  ];

  const genrePerformanceData = [
    { genre: 'Sci-Fi', views: 3200 },
    { genre: 'Drama', views: 2800 },
    { genre: 'Action', views: 2100 },
    { genre: 'Comedy', views: 1500 },
    { genre: 'Horror', views: 1200 },
    { genre: 'Thriller', views: 1658 }
  ];

  const audienceData = [
    { name: 'Investors', value: 35, fill: 'hsl(var(--chart-1))' },
    { name: 'Producers', value: 28, fill: 'hsl(var(--chart-2))' },
    { name: 'Studios', value: 20, fill: 'hsl(var(--chart-3))' },
    { name: 'Directors', value: 12, fill: 'hsl(var(--chart-4))' },
    { name: 'Others', value: 5, fill: 'hsl(var(--chart-5))' }
  ];

  // Chart configurations
  const viewsConfig = {
    views: {
      label: 'Views',
      color: 'hsl(var(--chart-1))'
    }
  };

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

  const audienceConfig = {
    value: {
      label: 'Audience'
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
            {/* Time Range Selector */}
            <select
              value={timeRange}
              onChange={(e) => setTimeRange(e.target.value)}
              className="px-4 py-2 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
            >
              <option value="24hours">Last 24 Hours</option>
              <option value="7days">Last 7 Days</option>
              <option value="30days">Last 30 Days</option>
              <option value="90days">Last 90 Days</option>
              <option value="1year">Last Year</option>
            </select>
            
            {/* Export Button */}
            <button className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition">
              <Download className="w-4 h-4" />
              Export
            </button>
            
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
        {/* Views Over Time */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <div className="space-y-1">
              <CardTitle className="text-base font-medium">Views Over Time</CardTitle>
              <CardDescription>Daily views for the selected period</CardDescription>
            </div>
            <BarChart3 className="w-5 h-5 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <ChartContainer config={viewsConfig} className="h-[300px]">
              <LineChart data={viewsChartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="day" />
                <YAxis />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Line 
                  type="monotone" 
                  dataKey="views" 
                  stroke="var(--color-views)" 
                  strokeWidth={2}
                  dot={{ fill: "var(--color-views)" }}
                />
              </LineChart>
            </ChartContainer>
          </CardContent>
        </Card>

        {/* Engagement Breakdown */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <div className="space-y-1">
              <CardTitle className="text-base font-medium">Engagement Breakdown</CardTitle>
              <CardDescription>Types of engagement across your pitches</CardDescription>
            </div>
            <PieChart className="w-5 h-5 text-muted-foreground" />
          </CardHeader>
          <CardContent>
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
          </CardContent>
        </Card>
      </div>

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
            <ChartContainer config={genreConfig} className="h-[300px]">
              <BarChart data={genrePerformanceData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="genre" />
                <YAxis />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar dataKey="views" fill="var(--color-views)" />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>

        {/* Audience Demographics */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <div className="space-y-1">
              <CardTitle className="text-base font-medium">Audience Demographics</CardTitle>
              <CardDescription>Who is viewing your content</CardDescription>
            </div>
            <Users className="w-5 h-5 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <ChartContainer config={audienceConfig} className="h-[300px]">
              <RechartsPieChart>
                <ChartTooltip content={<ChartTooltipContent />} />
                <Pie data={audienceData} dataKey="value" nameKey="name" innerRadius={60}>
                  {audienceData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.fill} />
                  ))}
                </Pie>
                <ChartLegend content={<ChartLegendContent />} />
              </RechartsPieChart>
            </ChartContainer>
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