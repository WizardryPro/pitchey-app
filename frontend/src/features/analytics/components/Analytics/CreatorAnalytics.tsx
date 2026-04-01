import React from 'react';
import {
  TrendingUp,
  Eye,
  Heart,
  Users,
  DollarSign
} from 'lucide-react';

import { AnalyticCard } from './AnalyticCard';
import { TimeRangeFilter } from './TimeRangeFilter';
import { PerformanceChart } from './PerformanceChart';
import { AnalyticsExport } from './AnalyticsExport';

interface CreatorAnalyticsProps {
  pitchPerformance: {
    totalViews: number;
    viewsChange: number;
    totalLikes: number;
    likesChange: number;
    potentialInvestment: number;
    investmentChange: number;
  };
  followers?: number;
  followersChange?: number;
  engagementRate?: number;
  trends?: {
    viewsOverTime?: { labels: string[]; datasets: { label: string; data: number[] }[] };
    pitchesOverTime?: { labels: string[]; datasets: { label: string; data: number[] }[] };
  };
  timeRange?: '7d' | '30d' | '90d' | '1y';
  onTimeRangeChange?: (range: '7d' | '30d' | '90d' | '1y') => void;
}

export const CreatorAnalytics: React.FC<CreatorAnalyticsProps> = ({
  pitchPerformance,
  followers = 0,
  followersChange = 0,
  engagementRate = 0,
  trends,
  timeRange = '30d',
  onTimeRangeChange
}) => {

  // Build chart data from trends
  const performanceData = {
    views: (trends?.viewsOverTime?.labels || []).map((label, i) => ({
      label,
      value: trends?.viewsOverTime?.datasets?.[0]?.data?.[i] || 0
    })),
    likes: (trends?.pitchesOverTime?.labels || []).map((label, i) => ({
      label,
      value: trends?.pitchesOverTime?.datasets?.[0]?.data?.[i] || 0
    }))
  };

  // Calculate engagement rate if not provided
  const calculatedEngagement = engagementRate || (
    pitchPerformance.totalViews > 0
      ? Math.round((pitchPerformance.totalLikes / pitchPerformance.totalViews) * 100 * 10) / 10
      : 0
  );

  return (
    <div className="bg-white rounded-xl border p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-semibold text-gray-900">
          Pitch Performance Analytics
        </h2>
        <div className="flex items-center gap-4">
          <TimeRangeFilter
            value={timeRange}
            onChange={(range) => onTimeRangeChange?.(range)}
            defaultRange="30d"
          />
          <AnalyticsExport 
            data={[]}  // Replace with actual data
            title="Creator Analytics"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4 mb-8">
        <AnalyticCard
          title="Total Views"
          value={pitchPerformance.totalViews}
          change={pitchPerformance.viewsChange}
          icon={<Eye className="w-5 h-5 text-blue-500" />}
          variant="primary"
        />
        <AnalyticCard
          title="Total Likes"
          value={pitchPerformance.totalLikes}
          change={pitchPerformance.likesChange}
          icon={<Heart className="w-5 h-5 text-red-500" />}
          variant="danger"
        />
        <AnalyticCard
          title="Potential Investment"
          value={pitchPerformance.potentialInvestment}
          change={pitchPerformance.investmentChange}
          icon={<DollarSign className="w-5 h-5 text-purple-500" />}
          variant="primary"
          format="currency"
        />
        <AnalyticCard
          title="Followers"
          value={followers}
          change={followersChange}
          icon={<Users className="w-5 h-5 text-indigo-500" />}
          variant="secondary"
        />
        <AnalyticCard
          title="Engagement Rate"
          value={calculatedEngagement}
          icon={<TrendingUp className="w-5 h-5 text-yellow-500" />}
          variant="warning"
          format="percentage"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-gray-50 rounded-xl p-6">
          <h3 className="text-lg font-semibold mb-4">Views Performance</h3>
          <PerformanceChart 
            title="Views Over Time"
            datasets={[{
              label: 'Views',
              data: performanceData.views,
              color: '#3B82F6'
            }]}
          />
        </div>
        <div className="bg-gray-50 rounded-xl p-6">
          <h3 className="text-lg font-semibold mb-4">Likes Performance</h3>
          <PerformanceChart 
            title="Likes Over Time"
            datasets={[{
              label: 'Likes',
              data: performanceData.likes,
              color: '#EF4444'
            }]}
          />
        </div>
      </div>
    </div>
  );
};