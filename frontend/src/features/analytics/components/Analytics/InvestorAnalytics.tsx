import React, { useState } from 'react';
import { 
  DollarSign, 
  TrendingUp, 
  Briefcase, 
  PieChart, 
  Star, 
  Users 
} from 'lucide-react';

import { AnalyticCard } from './AnalyticCard';
import { TimeRangeFilter } from './TimeRangeFilter';
import { PerformanceChart } from './PerformanceChart';
import { AnalyticsExport } from './AnalyticsExport';

interface InvestorAnalyticsProps {
  portfolioPerformance: {
    totalInvestments: number;
    totalInvested: number;
    activeDeals: number;
    averageReturn: number;
    returnChange: number;
    ndaSignedCount: number;
    recommendationMatchRate: number;
  };
}

export const InvestorAnalytics: React.FC<InvestorAnalyticsProps> = ({ 
  portfolioPerformance 
}) => {
  const [timeRange, setTimeRange] = useState<'7d' | '30d' | '90d' | '1y'>('30d');

  const performanceData = {
    returns: [] as { label: string; value: number }[],
    investments: [] as { label: string; value: number }[]
  };

  return (
    <div className="bg-white rounded-xl border p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-semibold text-gray-900">
          Investment Portfolio Analytics
        </h2>
        <div className="flex items-center gap-4">
          <TimeRangeFilter
            value={timeRange}
            onChange={(range) => setTimeRange(range)}
            defaultRange="30d"
          />
          <AnalyticsExport 
            data={[]}  // Replace with actual data
            title="Investor Analytics"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
        <AnalyticCard 
          title="Total Investments"
          value={portfolioPerformance.totalInvestments}
          icon={<Briefcase className="w-5 h-5 text-blue-500" />}
          variant="primary"
        />
        <AnalyticCard 
          title="Total Invested"
          value={portfolioPerformance.totalInvested}
          icon={<DollarSign className="w-5 h-5 text-green-500" />}
          variant="success"
          format="currency"
        />
        <AnalyticCard 
          title="Active Deals"
          value={portfolioPerformance.activeDeals}
          icon={<TrendingUp className="w-5 h-5 text-purple-500" />}
          variant="primary"
        />
        <AnalyticCard 
          title="Avg. Return"
          value={portfolioPerformance.averageReturn}
          change={portfolioPerformance.returnChange}
          icon={<PieChart className="w-5 h-5 text-yellow-500" />}
          variant="warning"
          format="percentage"
        />
        <AnalyticCard 
          title="NDA Signed"
          value={portfolioPerformance.ndaSignedCount}
          icon={<Star className="w-5 h-5 text-indigo-500" />}
          variant="secondary"
        />
        <AnalyticCard 
          title="Recommendation Match"
          value={portfolioPerformance.recommendationMatchRate}
          icon={<Users className="w-5 h-5 text-red-500" />}
          variant="danger"
          format="percentage"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-gray-50 rounded-xl p-6">
          <h3 className="text-lg font-semibold mb-4">Returns Performance</h3>
          <PerformanceChart 
            title="Investment Returns"
            datasets={[{
              label: 'Returns',
              data: performanceData.returns,
              color: '#F43F5E'
            }]}
          />
        </div>
        <div className="bg-gray-50 rounded-xl p-6">
          <h3 className="text-lg font-semibold mb-4">Total Investment</h3>
          <PerformanceChart 
            title="Invested Capital"
            datasets={[{
              label: 'Investments',
              data: performanceData.investments,
              color: '#10B981'
            }]}
            currency={true}
          />
        </div>
      </div>
    </div>
  );
};