import React from 'react';
import { DollarSign, Users, Target, TrendingUp, Award, ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface FundingMetrics {
  totalRaised: number;
  fundingGoal?: number;
  activeInvestors: number;
  averageInvestment: number;
  fundingProgress: number;
  monthlyGrowth?: number;
  recentInvestments?: {
    id: number;
    amount: number;
    investorName: string;
    date: Date;
  }[];
  topInvestor?: {
    name: string;
    amount: number;
  };
}

interface FundingOverviewProps {
  metrics: FundingMetrics;
  showRecentActivity?: boolean;
  className?: string;
}

export default function FundingOverview({ 
  metrics, 
  showRecentActivity = true,
  className = '' 
}: FundingOverviewProps) {
  const navigate = useNavigate();

  const formatCurrency = (amount: number | undefined | null) => {
    const safeAmount = amount || 0;
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      notation: 'compact',
      maximumFractionDigits: 1
    }).format(safeAmount);
  };

  const formatDate = (date: Date) => {
    return new Date(date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric'
    });
  };

  const progressPercentage = (metrics.fundingGoal && metrics.totalRaised) 
    ? Math.min(((metrics.totalRaised || 0) / metrics.fundingGoal) * 100, 100)
    : 0;

  return (
    <div className={`bg-white rounded-xl shadow-sm p-6 ${className}`}>
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-gray-900">Funding Overview</h3>
        <div className="flex items-center gap-2">
          <DollarSign className="w-5 h-5 text-green-500" />
          <span className="text-sm text-gray-500">Live Data</span>
        </div>
      </div>

      {/* Main Metrics Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="bg-green-50 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <DollarSign className="w-4 h-4 text-green-600" />
            <span className="text-sm text-gray-600">Total Raised</span>
          </div>
          <p className="text-xl font-bold text-gray-900">{formatCurrency(metrics.totalRaised || 0)}</p>
          {metrics.monthlyGrowth && (
            <p className="text-sm text-green-600">+{metrics.monthlyGrowth}% this month</p>
          )}
        </div>

        <div className="bg-blue-50 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <Users className="w-4 h-4 text-blue-600" />
            <span className="text-sm text-gray-600">Active Investors</span>
          </div>
          <p className="text-xl font-bold text-gray-900">{metrics.activeInvestors || 0}</p>
          <p className="text-sm text-gray-500">backing your projects</p>
        </div>

        <div className="bg-purple-50 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="w-4 h-4 text-purple-600" />
            <span className="text-sm text-gray-600">Avg Investment</span>
          </div>
          <p className="text-xl font-bold text-gray-900">{formatCurrency(metrics.averageInvestment || 0)}</p>
          <p className="text-sm text-gray-500">per investor</p>
        </div>

        <div className="bg-orange-50 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <Target className="w-4 h-4 text-orange-600" />
            <span className="text-sm text-gray-600">Progress</span>
          </div>
          <p className="text-xl font-bold text-gray-900">{(metrics.fundingProgress || 0).toFixed(0)}%</p>
          <p className="text-sm text-gray-500">of funding goals</p>
        </div>
      </div>

      {/* Funding Progress Bar */}
      {metrics.fundingGoal && (
        <div className="mb-6">
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm font-medium text-gray-700">Funding Progress</span>
            <span className="text-sm text-gray-500">
              {formatCurrency(metrics.totalRaised)} of {formatCurrency(metrics.fundingGoal)}
            </span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-3">
            <div 
              className="bg-gradient-to-r from-green-500 to-green-600 h-3 rounded-full transition-all duration-300"
              style={{ width: `${progressPercentage}%` }}
            ></div>
          </div>
          <p className="text-xs text-gray-500 mt-1">
            {progressPercentage >= 100 ? 'Goal achieved!' : `${(100 - progressPercentage).toFixed(0)}% remaining`}
          </p>
        </div>
      )}

      {/* Recent Activity */}
      {showRecentActivity && metrics.recentInvestments && metrics.recentInvestments.length > 0 && (
        <div className="border-t pt-4">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-sm font-medium text-gray-700">Recent Investments</h4>
            <button 
              onClick={() => { void navigate('/creator/investments'); }}
              className="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1"
            >
              View All
              <ArrowRight className="w-3 h-3" />
            </button>
          </div>
          <div className="space-y-2">
            {metrics.recentInvestments.slice(0, 3).map((investment) => (
              <div key={investment.id} className="flex items-center justify-between py-2 px-3 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                    <DollarSign className="w-4 h-4 text-green-600" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900">{investment.investorName}</p>
                    <p className="text-xs text-gray-500">{formatDate(investment.date)}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold text-green-600">
                    {formatCurrency(investment.amount)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Top Investor */}
      {metrics.topInvestor && (
        <div className="border-t pt-4 mt-4">
          <h4 className="text-sm font-medium text-gray-700 mb-3">Top Investor</h4>
          <div className="flex items-center gap-3 p-3 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg">
            <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
              <Award className="w-5 h-5 text-blue-600" />
            </div>
            <div className="flex-1">
              <p className="font-medium text-gray-900">{metrics.topInvestor.name}</p>
              <p className="text-sm text-gray-500">Leading investor</p>
            </div>
            <div className="text-right">
              <p className="font-semibold text-blue-600">
                {formatCurrency(metrics.topInvestor.amount)}
              </p>
              <p className="text-xs text-gray-500">total invested</p>
            </div>
          </div>
        </div>
      )}

      {/* Quick Actions */}
      <div className="border-t pt-4 mt-4">
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => { void navigate('/creator/analytics'); }}
            className="flex items-center justify-center gap-2 py-2 px-4 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg transition-colors"
          >
            <Users className="w-4 h-4" />
            <span className="text-sm font-medium">View Analytics</span>
          </button>
          <button
            onClick={() => { void navigate('/creator/billing'); }}
            className="flex items-center justify-center gap-2 py-2 px-4 bg-gray-50 hover:bg-gray-100 text-gray-700 rounded-lg transition-colors"
          >
            <Target className="w-4 h-4" />
            <span className="text-sm font-medium">Billing & Plans</span>
          </button>
        </div>
      </div>
    </div>
  );
}