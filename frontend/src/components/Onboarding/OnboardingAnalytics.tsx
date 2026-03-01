import React, { useState, useEffect, useMemo } from 'react';
import { useOnboardingStore } from '../../store/onboardingStore';
import { Card } from '@shared/components/ui/card';
import { Button } from '@shared/components/ui/button';
import { Badge } from '@shared/components/ui/badge';
import { Progress } from '@shared/components/ui/progress';

interface AnalyticsData {
  completionRate: number;
  averageCompletionTime: number;
  dropoffPoints: { stepId: string; dropoffRate: number }[];
  engagementMetrics: { feature: string; interactions: number }[];
  helpRequestsCount: number;
  mostSkippedSteps: { stepId: string; skipRate: number }[];
  timeSpentPerStep: { stepId: string; avgTime: number }[];
}

export const OnboardingAnalytics: React.FC = () => {
  const {
    flows,
    analytics,
    achievements,
    totalPoints,
    level,
    tutorialHistory,
    discoveredFeatures
  } = useOnboardingStore();

  const [timeRange, setTimeRange] = useState<'7d' | '30d' | 'all'>('30d');
  const [showDetails, setShowDetails] = useState(false);

  // Calculate analytics data
  const analyticsData = useMemo((): AnalyticsData => {
    const completedFlows = Object.values(flows).filter(flow => flow.completed);
    const totalFlows = Object.values(flows).length;
    
    const completionRate = totalFlows > 0 ? (completedFlows.length / totalFlows) * 100 : 0;
    
    // Calculate average completion time
    const completionTimes = completedFlows
      .filter(flow => flow.startedAt && flow.completedAt)
      .map(flow => 
        new Date(flow.completedAt!).getTime() - new Date(flow.startedAt!).getTime()
      );
    
    const averageCompletionTime = completionTimes.length > 0 
      ? completionTimes.reduce((a, b) => a + b, 0) / completionTimes.length / 1000 / 60 // minutes
      : 0;

    // Calculate dropoff points
    const stepCounts: Record<string, { started: number; completed: number }> = {};
    Object.values(flows).forEach(flow => {
      flow.steps.forEach((step, index) => {
        if (!stepCounts[step.id]) {
          stepCounts[step.id] = { started: 0, completed: 0 };
        }
        
        if (index <= flow.currentStepIndex) {
          stepCounts[step.id].started++;
        }
        
        if (step.completed) {
          stepCounts[step.id].completed++;
        }
      });
    });

    const dropoffPoints = Object.entries(stepCounts)
      .map(([stepId, counts]) => ({
        stepId,
        dropoffRate: counts.started > 0 
          ? ((counts.started - counts.completed) / counts.started) * 100 
          : 0
      }))
      .sort((a, b) => b.dropoffRate - a.dropoffRate);

    // Process engagement metrics
    const engagementMetrics = Object.entries(analytics.featureEngagement)
      .map(([feature, interactions]) => ({ feature, interactions }))
      .sort((a, b) => b.interactions - a.interactions);

    // Calculate skip rates
    const skipCounts: Record<string, { total: number; skipped: number }> = {};
    Object.values(flows).forEach(flow => {
      flow.steps.forEach(step => {
        if (!skipCounts[step.id]) {
          skipCounts[step.id] = { total: 0, skipped: 0 };
        }
        
        skipCounts[step.id].total++;
        if (step.skipped) {
          skipCounts[step.id].skipped++;
        }
      });
    });

    const mostSkippedSteps = Object.entries(skipCounts)
      .map(([stepId, counts]) => ({
        stepId,
        skipRate: counts.total > 0 ? (counts.skipped / counts.total) * 100 : 0
      }))
      .sort((a, b) => b.skipRate - a.skipRate);

    // Calculate time spent per step
    const timeSpentPerStep = Object.entries(analytics.stepCompletionTimes)
      .map(([stepId, time]) => ({
        stepId,
        avgTime: time / 1000 / 60 // Convert to minutes
      }))
      .sort((a, b) => b.avgTime - a.avgTime);

    return {
      completionRate,
      averageCompletionTime,
      dropoffPoints,
      engagementMetrics,
      helpRequestsCount: analytics.helpRequestCount,
      mostSkippedSteps,
      timeSpentPerStep
    };
  }, [flows, analytics]);

  const unlockedAchievements = achievements.filter(a => a.unlockedAt);
  const achievementCompletionRate = (unlockedAchievements.length / achievements.length) * 100;

  const exportData = () => {
    const exportableData = {
      summary: {
        completionRate: analyticsData.completionRate,
        averageCompletionTime: analyticsData.averageCompletionTime,
        achievementCompletionRate,
        totalPoints,
        level,
        helpRequests: analyticsData.helpRequestsCount
      },
      detailed: {
        flows,
        analytics,
        achievements: unlockedAchievements,
        tutorialHistory,
        discoveredFeatures
      },
      timestamp: new Date().toISOString()
    };

    const blob = new Blob([JSON.stringify(exportableData, null, 2)], {
      type: 'application/json'
    });
    
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `onboarding-analytics-${Date.now()}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Onboarding Analytics</h2>
          <p className="text-gray-600">Track your onboarding progress and engagement</p>
        </div>
        
        <div className="flex items-center space-x-3">
          <select
            value={timeRange}
            onChange={(e) => setTimeRange(e.target.value as any)}
            className="px-3 py-2 border border-gray-300 rounded-md text-sm"
          >
            <option value="7d">Last 7 days</option>
            <option value="30d">Last 30 days</option>
            <option value="all">All time</option>
          </select>
          
          <Button variant="outline" size="sm" onClick={exportData}>
            Export Data
          </Button>
          
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowDetails(!showDetails)}
          >
            {showDetails ? 'Hide Details' : 'Show Details'}
          </Button>
        </div>
      </div>

      {/* Key Metrics Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="text-2xl font-bold text-green-600 mb-1">
            {Math.round(analyticsData.completionRate)}%
          </div>
          <div className="text-sm text-gray-600">Completion Rate</div>
          <div className="text-xs text-green-600 mt-1">
            Flow completion
          </div>
        </Card>
        
        <Card className="p-4">
          <div className="text-2xl font-bold text-blue-600 mb-1">
            {Math.round(analyticsData.averageCompletionTime)}m
          </div>
          <div className="text-sm text-gray-600">Avg. Time</div>
          <div className="text-xs text-blue-600 mt-1">
            To complete
          </div>
        </Card>
        
        <Card className="p-4">
          <div className="text-2xl font-bold text-purple-600 mb-1">
            {Math.round(achievementCompletionRate)}%
          </div>
          <div className="text-sm text-gray-600">Achievements</div>
          <div className="text-xs text-purple-600 mt-1">
            {unlockedAchievements.length}/{achievements.length}
          </div>
        </Card>
        
        <Card className="p-4">
          <div className="text-2xl font-bold text-orange-600 mb-1">
            {analyticsData.helpRequestsCount}
          </div>
          <div className="text-sm text-gray-600">Help Requests</div>
          <div className="text-xs text-orange-600 mt-1">
            Support interactions
          </div>
        </Card>
      </div>

      {/* Progress Overview */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Progress Overview</h3>
        
        <div className="space-y-4">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-700">Onboarding Completion</span>
              <span className="text-sm text-gray-600">
                {Math.round(analyticsData.completionRate)}%
              </span>
            </div>
            <Progress value={analyticsData.completionRate} className="h-2" />
          </div>
          
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-700">Achievement Progress</span>
              <span className="text-sm text-gray-600">
                {Math.round(achievementCompletionRate)}%
              </span>
            </div>
            <Progress value={achievementCompletionRate} className="h-2" />
          </div>
          
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-700">Feature Discovery</span>
              <span className="text-sm text-gray-600">
                {discoveredFeatures.length} features discovered
              </span>
            </div>
            <div className="text-xs text-gray-500 mt-1">
              Tutorial completions: {tutorialHistory.length}
            </div>
          </div>
        </div>
      </Card>

      {/* Detailed Analytics */}
      {showDetails && (
        <>
          {/* Engagement Metrics */}
          <Card className="p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Feature Engagement</h3>
            
            <div className="space-y-3 max-h-64 overflow-y-auto">
              {analyticsData.engagementMetrics.length > 0 ? (
                analyticsData.engagementMetrics.map(({ feature, interactions }) => (
                  <div key={feature} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <span className="font-medium text-gray-900">{feature}</span>
                    <div className="flex items-center space-x-2">
                      <span className="text-sm text-gray-600">{interactions} interactions</span>
                      <div className="w-16">
                        <Progress 
                          value={(interactions / Math.max(...analyticsData.engagementMetrics.map(m => m.interactions))) * 100} 
                          className="h-2" 
                        />
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-gray-500 text-center py-4">No engagement data available yet</p>
              )}
            </div>
          </Card>

          {/* Dropoff Analysis */}
          <Card className="p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Step Analysis</h3>
            
            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <h4 className="font-medium text-gray-900 mb-3">Highest Dropoff Points</h4>
                <div className="space-y-2">
                  {analyticsData.dropoffPoints.slice(0, 5).map(({ stepId, dropoffRate }) => (
                    <div key={stepId} className="flex items-center justify-between p-2 bg-red-50 rounded">
                      <span className="text-sm font-medium text-gray-900">{stepId}</span>
                      <Badge variant="destructive" className="text-xs">
                        {Math.round(dropoffRate)}% dropoff
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>
              
              <div>
                <h4 className="font-medium text-gray-900 mb-3">Most Skipped Steps</h4>
                <div className="space-y-2">
                  {analyticsData.mostSkippedSteps.slice(0, 5).map(({ stepId, skipRate }) => (
                    <div key={stepId} className="flex items-center justify-between p-2 bg-yellow-50 rounded">
                      <span className="text-sm font-medium text-gray-900">{stepId}</span>
                      <Badge variant="secondary" className="text-xs bg-yellow-200 text-yellow-800">
                        {Math.round(skipRate)}% skipped
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </Card>

          {/* Time Analysis */}
          <Card className="p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Time Analysis</h3>
            
            <div className="space-y-3">
              <div className="grid grid-cols-3 gap-4 mb-4">
                <div className="text-center p-3 bg-blue-50 rounded-lg">
                  <div className="text-lg font-bold text-blue-600">
                    {Math.round(analyticsData.averageCompletionTime)}m
                  </div>
                  <div className="text-sm text-blue-800">Avg. Completion</div>
                </div>
                
                <div className="text-center p-3 bg-green-50 rounded-lg">
                  <div className="text-lg font-bold text-green-600">
                    {analyticsData.timeSpentPerStep.length > 0 
                      ? Math.round(Math.max(...analyticsData.timeSpentPerStep.map(s => s.avgTime)))
                      : 0}m
                  </div>
                  <div className="text-sm text-green-800">Longest Step</div>
                </div>
                
                <div className="text-center p-3 bg-purple-50 rounded-lg">
                  <div className="text-lg font-bold text-purple-600">
                    {analyticsData.timeSpentPerStep.length > 0 
                      ? Math.round(analyticsData.timeSpentPerStep.reduce((sum, s) => sum + s.avgTime, 0) / analyticsData.timeSpentPerStep.length)
                      : 0}m
                  </div>
                  <div className="text-sm text-purple-800">Avg. per Step</div>
                </div>
              </div>

              <div>
                <h4 className="font-medium text-gray-900 mb-2">Time Spent per Step</h4>
                <div className="space-y-2 max-h-32 overflow-y-auto">
                  {analyticsData.timeSpentPerStep.map(({ stepId, avgTime }) => (
                    <div key={stepId} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                      <span className="text-sm font-medium text-gray-900">{stepId}</span>
                      <span className="text-sm text-gray-600">{Math.round(avgTime)}m</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </Card>

          {/* Flow Status */}
          <Card className="p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Flow Status</h3>
            
            <div className="space-y-4">
              {Object.values(flows).map(flow => {
                const completedSteps = flow.steps.filter(s => s.completed).length;
                const progress = (completedSteps / flow.steps.length) * 100;
                
                return (
                  <div key={flow.id} className="p-4 border border-gray-200 rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="font-medium text-gray-900">{flow.name}</h4>
                      <div className="flex items-center space-x-2">
                        {flow.completed && (
                          <Badge className="bg-green-100 text-green-800">Completed</Badge>
                        )}
                        <span className="text-sm text-gray-600">
                          {completedSteps}/{flow.steps.length}
                        </span>
                      </div>
                    </div>
                    
                    <Progress value={progress} className="h-2 mb-2" />
                    
                    <div className="text-xs text-gray-500">
                      {flow.startedAt && (
                        <span>Started: {new Date(flow.startedAt).toLocaleDateString()}</span>
                      )}
                      {flow.completedAt && (
                        <span className="ml-4">
                          Completed: {new Date(flow.completedAt).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        </>
      )}
    </div>
  );
};