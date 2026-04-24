import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { Eye, Heart, MessageSquare, Share2, TrendingUp, Calendar, Users, Download } from 'lucide-react';
import { analyticsService, type PitchAnalytics } from '@features/analytics/services/analytics.service';
import { pitchService } from '@features/pitches/services/pitch.service';


export default function PitchAnalytics() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const [analytics, setAnalytics] = useState<PitchAnalytics | null>(null);
  const [pitchTitle, setPitchTitle] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [timeRange, setTimeRange] = useState<'7d' | '30d' | '90d'>('30d');

  useEffect(() => {
    if (id) {
      fetchAnalytics(parseInt(id));
    }
  }, [id, timeRange]);

  const fetchAnalytics = async (pitchId: number) => {
    try {
      // Fetch both pitch details and analytics in parallel
      const [pitchDetails, analyticsData] = await Promise.all([
        pitchService.getById(pitchId).catch(() => null),
        analyticsService.getPitchAnalytics(
          pitchId,
          {
            start: '',
            end: '',
            preset: (timeRange === '7d' ? 'week' :
                    timeRange === '30d' ? 'month' : 'quarter') as 'week' | 'month' | 'quarter'
          }
        )
      ]);

      // Set the pitch title
      if (pitchDetails) {
        setPitchTitle(pitchDetails.title || `Pitch #${pitchId}`);
      } else {
        setPitchTitle(`Pitch #${pitchId}`);
      }
      
      // Map backend response to expected format
      // Calculate views this week and month from viewsByDate
      const last7Days = analyticsData.viewsByDate?.slice(-7) || [];
      const viewsThisWeek = last7Days.reduce((sum: number, day: any) => sum + (day.views || 0), 0);
      const viewsThisMonth = (analyticsData.viewsByDate || []).reduce((sum: number, day: any) => sum + (day.views || 0), 0);
      
      const mappedData: any = {
        ...analyticsData,
        pitchId: pitchId,
        title: pitchDetails?.title || `Pitch #${pitchId}`,
        totalViews: analyticsData.views || pitchDetails?.viewCount || 0,
        totalLikes: analyticsData.likes || pitchDetails?.likeCount || 0,
        totalMessages: analyticsData.messages || analyticsData.ndaRequests || 0,
        totalShares: analyticsData.shares || 0,
        viewsThisWeek: viewsThisWeek,
        viewsThisMonth: viewsThisMonth,
        viewsByDay: analyticsData.viewsByDate || [],
        viewerTypes: analyticsData.demographics ? 
          Object.entries(analyticsData.demographics).map(([type, count]) => {
            // Backend returns percentages as the count values (e.g., 65, 20, 15)
            // These are already percentages, not raw counts
            const percentage = count as number;
            // Calculate approximate count based on total views
            const estimatedCount = Math.round((percentage / 100) * (analyticsData.views || 100));
            return { 
              type, 
              count: estimatedCount,
              percentage: percentage
            };
          }) : [],
        engagement: {
          clickThroughRate: analyticsData.views > 0 ? (analyticsData.likes / analyticsData.views) : 0
        }
      };
      
      setAnalytics(mappedData);
    } catch (error) {
      console.error('Failed to fetch analytics:', error);
      setError(error instanceof Error ? error.message : 'Failed to load analytics');
    } finally {
      setLoading(false);
    }
  };

  const formatNumber = (num: number | undefined | null) => {
    // Extra defensive checks
    if (num === undefined || num === null || !num || isNaN(num)) {
      return '0';
    }
    if (num >= 1000000) {
      return (num / 1000000).toFixed(1) + 'M';
    } else if (num >= 1000) {
      return (num / 1000).toFixed(1) + 'K';
    }
    return Math.floor(num).toString();
  };

  const formatTime = (seconds: number | undefined | null) => {
    if (!seconds || seconds === undefined || seconds === null || isNaN(seconds)) {
      return '0:00';
    }
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 to-indigo-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
      </div>
    );
  }

  if (error || !analytics) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-gray-900">Analytics Not Found</h1>
        <div className="py-8 text-center">
          <p className="text-gray-600">{error}</p>
          <button
            onClick={() => navigate('/creator/pitches')}
            className="mt-4 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition"
          >
            Back to Pitches
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page heading — global chrome comes from PortalLayout's MinimalHeader */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Analytics</h1>
          <p className="text-sm text-gray-500 mt-1">{pitchTitle || analytics?.title || 'Loading...'}</p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <select
            value={timeRange}
            onChange={(e) => setTimeRange(e.target.value as '7d' | '30d' | '90d')}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
          >
            <option value="7d">Last 7 days</option>
            <option value="30d">Last 30 days</option>
            <option value="90d">Last 90 days</option>
          </select>
          <button
            onClick={() => toast('Analytics export coming soon', { icon: 'ℹ️' })}
            className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition"
          >
            <Download className="w-4 h-4" />
            Export
          </button>
        </div>
      </div>

      <div>
        {/* Key Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-xl shadow-sm p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Views</p>
                <p className="text-3xl font-bold text-gray-900">{formatNumber(analytics?.totalViews)}</p>
                <p className="text-sm text-green-600 mt-1">
                  <TrendingUp className="w-4 h-4 inline mr-1" />
                  +{analytics?.viewsThisWeek || 0} this week
                </p>
              </div>
              <div className="p-3 bg-blue-100 rounded-lg">
                <Eye className="w-6 h-6 text-blue-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Likes</p>
                <p className="text-3xl font-bold text-gray-900">{formatNumber(analytics?.totalLikes)}</p>
                <p className="text-sm text-gray-500 mt-1">
                  {(analytics?.totalViews && analytics.totalViews > 0) ? (((analytics?.totalLikes || 0) / analytics.totalViews) * 100).toFixed(1) : '0'}% of views
                </p>
              </div>
              <div className="p-3 bg-pink-100 rounded-lg">
                <Heart className="w-6 h-6 text-pink-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Messages</p>
                <p className="text-3xl font-bold text-gray-900">{formatNumber(analytics?.totalMessages)}</p>
                <p className="text-sm text-gray-500 mt-1">Investor inquiries</p>
              </div>
              <div className="p-3 bg-green-100 rounded-lg">
                <MessageSquare className="w-6 h-6 text-green-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Shares</p>
                <p className="text-3xl font-bold text-gray-900">{formatNumber(analytics?.totalShares)}</p>
                <p className="text-sm text-gray-500 mt-1">External shares</p>
              </div>
              <div className="p-3 bg-purple-100 rounded-lg">
                <Share2 className="w-6 h-6 text-purple-600" />
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Views Chart */}
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Views Over Time</h3>
            <div className="space-y-3">
              {(analytics?.viewsByDate || []).slice(-7).map((day: any, index: number) => (
                <div key={day.date} className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">
                    {new Date(day.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                  </span>
                  <div className="flex items-center gap-3 flex-1 ml-4">
                    <div className="flex-1 bg-gray-200 rounded-full h-2">
                      <div 
                        className="bg-purple-600 h-2 rounded-full" 
                        style={{ width: `${Math.max(5, ((day.views || 0) / Math.max(...(analytics?.viewsByDate || []).map((d: any) => d.views || d.count || 0), 1)) * 100)}%` }}
                      ></div>
                    </div>
                    <span className="text-sm font-medium text-gray-900 min-w-[40px] text-right">{day.views || day.count || 0}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Viewer Types */}
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Viewer Types</h3>
            <div className="space-y-4">
              {(analytics?.viewerTypes || []).map((viewer: any, index: number) => (
                <div key={viewer.type} className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`w-3 h-3 rounded-full ${
                      index === 0 ? 'bg-purple-600' : 
                      index === 1 ? 'bg-blue-600' : 
                      index === 2 ? 'bg-green-600' : 'bg-gray-600'
                    }`}></div>
                    <span className="text-sm text-gray-700 capitalize">{viewer.type}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-gray-900">
                      {viewer.percentage.toFixed(0)}%
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Engagement Metrics */}
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Engagement</h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between py-3 border-b border-gray-100">
                <span className="text-sm text-gray-600">Average View Time</span>
                <span className="text-sm font-medium text-gray-900">
                  {formatTime(analytics?.engagement?.averageViewTime || 0)}
                </span>
              </div>
              <div className="flex items-center justify-between py-3 border-b border-gray-100">
                <span className="text-sm text-gray-600">Click-through Rate</span>
                <span className="text-sm font-medium text-gray-900">
                  {((analytics?.engagement?.clickThroughRate || 0) * 100).toFixed(1)}%
                </span>
              </div>
              <div className="flex items-center justify-between py-3">
                <span className="text-sm text-gray-600">Return Visitors</span>
                <span className="text-sm font-medium text-gray-900">
                  {analytics?.engagement?.returnVisitors || 0}
                </span>
              </div>
            </div>
          </div>

          {/* Top Referrers */}
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Top Referrers</h3>
            <div className="space-y-3">
              {(analytics?.topReferrers || []).map((referrer, index) => (
                <div key={referrer.source} className="flex items-center justify-between py-2">
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-medium text-gray-700">#{index + 1}</span>
                    <span className="text-sm text-gray-700">{referrer.source}</span>
                  </div>
                  <span className="text-sm font-medium text-gray-900">{referrer.views} views</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Performance Insights */}
        <div className="mt-8 bg-white rounded-xl shadow-sm p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Performance Insights</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="text-center p-4 bg-green-50 rounded-lg">
              <div className="text-2xl font-bold text-green-600 mb-1">
                {(analytics.viewsThisMonth || 0) > 0 ?
                  ((analytics.viewsThisMonth || 0) > (analytics.viewsThisWeek || 0) * 4 ? 'Strong' : 'Growing') :
                  'New'}
              </div>
              <div className="text-sm text-gray-600">Monthly Performance</div>
            </div>
            <div className="text-center p-4 bg-blue-50 rounded-lg">
              <div className="text-2xl font-bold text-blue-600 mb-1">
                {(analytics?.engagement?.clickThroughRate || 0) > 0.1 ? 'High' : 
                 (analytics?.engagement?.clickThroughRate || 0) > 0 ? 'Moderate' : 'Building'}
              </div>
              <div className="text-sm text-gray-600">Engagement Level</div>
            </div>
            <div className="text-center p-4 bg-purple-50 rounded-lg">
              <div className="text-2xl font-bold text-purple-600 mb-1">
                {(analytics.totalViews || 0) > 0 ?
                  `${((analytics.totalMessages || 0) / (analytics.totalViews || 1) * 100).toFixed(1)}%` :
                  'N/A'}
              </div>
              <div className="text-sm text-gray-600">Conversion Rate</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}