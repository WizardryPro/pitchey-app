import React, { useState, useEffect } from 'react';
import {
  BarChart3, Activity, TrendingUp, DollarSign,
  Film, Award, Briefcase, Clock, Target
} from 'lucide-react';
import ProductionAnalytics from '@portals/production/pages/ProductionAnalytics';
import ProductionActivity from '@portals/production/pages/ProductionActivity';
import ProductionStats from '@portals/production/pages/ProductionStats';
import ProductionRevenue from '@portals/production/pages/ProductionRevenue';
import { ProductionService } from '@portals/production/services/production.service';

export default function ProductionAnalyticsPage() {
  const [activeTab, setActiveTab] = useState<'overview' | 'activity' | 'stats' | 'revenue'>('overview');
  const [overviewStats, setOverviewStats] = useState<{ completedProjects: number; activeProjects: number; pipelineProjects: number; totalBudget: number; spentPercent: number }>({ completedProjects: 0, activeProjects: 0, pipelineProjects: 0, totalBudget: 0, spentPercent: 0 });

  useEffect(() => {
    const load = async () => {
      try {
        const dashboard = await ProductionService.getDashboard();
        const stats = dashboard?.stats;
        if (stats) {
          const total = stats.totalProjects || 0;
          const active = stats.activeProjects || 0;
          const completed = total - active;
          const budget = stats.totalBudget || 0;
          setOverviewStats({
            completedProjects: completed > 0 ? completed : 0,
            activeProjects: active,
            pipelineProjects: stats.pitchesReviewed || 0,
            totalBudget: budget,
            spentPercent: budget > 0 ? Math.round((active / Math.max(total, 1)) * 100) : 0,
          });
        }
      } catch {
        // Keep defaults
      }
    };
    load();
  }, []);

  const tabs = [
    { id: 'overview', label: 'Overview', icon: BarChart3 },
    { id: 'activity', label: 'Activity', icon: Activity },
    { id: 'stats', label: 'Quick Stats', icon: TrendingUp },
    { id: 'revenue', label: 'Revenue', icon: DollarSign }
  ];

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Analytics & Performance</h1>
        <p className="text-gray-600 mt-1">Track your production metrics and project performance</p>
      </div>

      <div>
        {/* Tab Navigation */}
        <div className="bg-white rounded-lg shadow-sm mb-6">
          <div className="border-b border-gray-200">
            <nav className="-mb-px flex space-x-6 sm:space-x-8 px-4 sm:px-6 overflow-x-auto scrollbar-hide" aria-label="Tabs">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id as any)}
                    className={`
                      flex items-center gap-2 py-4 px-1 border-b-2 font-medium text-sm transition-colors whitespace-nowrap shrink-0
                      ${activeTab === tab.id
                        ? 'border-purple-500 text-purple-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                      }
                    `}
                  >
                    <Icon className="w-4 h-4" />
                    {tab.label}
                  </button>
                );
              })}
            </nav>
          </div>
        </div>

        {/* Tab Content */}
        <div className="transition-all duration-200 ease-in-out">
          {activeTab === 'overview' && (
            <div className="space-y-6">
              {/* Main Analytics Component */}
              <ProductionAnalytics />
              
              {/* Additional Overview Sections */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Project Performance */}
                <div className="bg-white rounded-xl border p-6">
                  <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                    <Film className="w-5 h-5 text-purple-600" />
                    Project Performance
                  </h3>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                          <Award className="w-5 h-5 text-green-600" />
                        </div>
                        <div>
                          <p className="font-medium">Completed Projects</p>
                          <p className="text-sm text-gray-500">All Time</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-2xl font-bold">{overviewStats.completedProjects}</p>
                      </div>
                    </div>

                    <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                          <Briefcase className="w-5 h-5 text-blue-600" />
                        </div>
                        <div>
                          <p className="font-medium">Active Projects</p>
                          <p className="text-sm text-gray-500">Currently Running</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-2xl font-bold">{overviewStats.activeProjects}</p>
                        <p className="text-xs text-gray-600">In production</p>
                      </div>
                    </div>

                    <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-yellow-100 rounded-lg flex items-center justify-center">
                          <Clock className="w-5 h-5 text-yellow-600" />
                        </div>
                        <div>
                          <p className="font-medium">Pitches Reviewed</p>
                          <p className="text-sm text-gray-500">Total reviewed</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-2xl font-bold">{overviewStats.pipelineProjects}</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Budget Overview */}
                <div className="bg-white rounded-xl border p-6">
                  <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                    <Target className="w-5 h-5 text-purple-600" />
                    Budget Overview
                  </h3>
                  <div className="space-y-4">
                    <div className="p-4 bg-purple-50 rounded-lg">
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <p className="text-sm text-gray-600">Total Budget</p>
                          <p className="text-2xl font-bold text-purple-900">
                            ${overviewStats.totalBudget > 0 ? (overviewStats.totalBudget / 1000000).toFixed(1) + 'M' : '0'}
                          </p>
                        </div>
                        <span className="px-2 py-1 bg-purple-100 text-purple-700 text-xs font-medium rounded">
                          {new Date().getFullYear()}
                        </span>
                      </div>
                    </div>

                    <div className="space-y-3">
                      <div>
                        <div className="flex justify-between mb-2">
                          <span className="text-sm text-gray-600">Active Allocation</span>
                          <span className="text-sm font-semibold">{overviewStats.spentPercent}%</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div className="bg-purple-600 h-2 rounded-full" style={{ width: `${overviewStats.spentPercent}%` }}></div>
                        </div>
                      </div>

                      <div>
                        <div className="flex justify-between mb-2">
                          <span className="text-sm text-gray-600">Available</span>
                          <span className="text-sm font-semibold">{100 - overviewStats.spentPercent}%</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div className="bg-green-600 h-2 rounded-full" style={{ width: `${100 - overviewStats.spentPercent}%` }}></div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'activity' && (
            <ProductionActivity />
          )}

          {activeTab === 'stats' && (
            <ProductionStats />
          )}

          {activeTab === 'revenue' && (
            <ProductionRevenue />
          )}
        </div>
      </div>
    </div>
  );
}