import React, { useState } from 'react';
import { useOnboardingStore } from '../../store/onboardingStore';
import { useOnboarding } from './OnboardingManager';
import { Card } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Progress } from '../ui/progress';
import { OnboardingAnalytics } from './OnboardingAnalytics';
import { AchievementGallery, ProgressStats } from './AchievementSystem';

const OnboardingSettings: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'overview' | 'preferences' | 'analytics' | 'achievements'>('overview');
  
  const {
    currentFlow,
    preferences,
    achievements,
    totalPoints,
    level,
    streakDays,
    flows,
    updatePreferences,
    resetOnboarding,
    resetAchievements
  } = useOnboardingStore();

  const {
    isCompleted,
    isSkipped,
    startOnboarding,
    restartOnboarding
  } = useOnboarding();

  const completedFlows = Object.values(flows).filter(flow => flow.completed);
  const unlockedAchievements = achievements.filter(a => a.unlockedAt);

  const tabs = [
    { id: 'overview', label: 'Overview', icon: '📊' },
    { id: 'preferences', label: 'Preferences', icon: '⚙️' },
    { id: 'analytics', label: 'Analytics', icon: '📈' },
    { id: 'achievements', label: 'Achievements', icon: '🏆' }
  ];

  const renderOverview = () => (
    <div className="space-y-6">
      {/* Current Status */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Onboarding Status</h3>
          <div className="flex gap-2">
            {isCompleted && (
              <Badge className="bg-green-100 text-green-800">Completed</Badge>
            )}
            {isSkipped && (
              <Badge variant="secondary">Skipped</Badge>
            )}
            {currentFlow && !isCompleted && !isSkipped && (
              <Badge className="bg-blue-100 text-blue-800">In Progress</Badge>
            )}
          </div>
        </div>

        {currentFlow ? (
          <div className="space-y-4">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-700">{currentFlow.name}</span>
                <span className="text-sm text-gray-600">
                  {currentFlow.steps.filter(s => s.completed).length}/{currentFlow.steps.length} steps
                </span>
              </div>
              <Progress 
                value={(currentFlow.steps.filter(s => s.completed).length / currentFlow.steps.length) * 100} 
                className="h-2" 
              />
            </div>
            
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => restartOnboarding()}
              >
                Restart Onboarding
              </Button>

              {isCompleted && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => startOnboarding()}
                >
                  Review Steps
                </Button>
              )}
            </div>
          </div>
        ) : (
          <div className="text-center py-6">
            <p className="text-gray-600 mb-4">
              {isCompleted 
                ? "You've completed the onboarding! Want to review the steps?"
                : "Get started with our interactive onboarding experience."
              }
            </p>
            <Button onClick={() => startOnboarding()}>
              {isCompleted ? "Review Onboarding" : "Start Onboarding"}
            </Button>
          </div>
        )}
      </Card>

      {/* Progress Stats */}
      <ProgressStats showDetailed />

      {/* Flow History */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Onboarding History</h3>
        
        <div className="space-y-3">
          {completedFlows.length > 0 ? (
            completedFlows.map(flow => (
              <div key={flow.id} className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
                <div>
                  <h4 className="font-medium text-green-900">{flow.name}</h4>
                  <p className="text-sm text-green-700">
                    Completed {flow.completedAt ? new Date(flow.completedAt).toLocaleDateString() : 'Unknown'}
                  </p>
                </div>
                <Badge className="bg-green-100 text-green-800">✓ Done</Badge>
              </div>
            ))
          ) : (
            <p className="text-gray-500 text-center py-4">No completed onboarding flows yet</p>
          )}
        </div>
      </Card>
    </div>
  );

  const renderPreferences = () => (
    <Card className="p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Onboarding Preferences</h3>
      
      <div className="space-y-6">
        {/* Tutorial Settings */}
        <div>
          <h4 className="font-medium text-gray-900 mb-3">Tutorial Settings</h4>
          <div className="space-y-3">
            <label className="flex items-center space-x-3">
              <input
                type="checkbox"
                checked={preferences.showTooltips}
                onChange={(e) => updatePreferences({ showTooltips: e.target.checked })}
                className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
              />
              <div>
                <span className="text-sm font-medium text-gray-900">Show Interactive Tooltips</span>
                <p className="text-xs text-gray-600">Display helpful tooltips throughout the platform</p>
              </div>
            </label>

            <label className="flex items-center space-x-3">
              <input
                type="checkbox"
                checked={preferences.autoplayTutorials}
                onChange={(e) => updatePreferences({ autoplayTutorials: e.target.checked })}
                className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
              />
              <div>
                <span className="text-sm font-medium text-gray-900">Auto-play Tutorials</span>
                <p className="text-xs text-gray-600">Automatically start relevant tutorials</p>
              </div>
            </label>

            <label className="flex items-center space-x-3">
              <input
                type="checkbox"
                checked={preferences.skipAnimations}
                onChange={(e) => updatePreferences({ skipAnimations: e.target.checked })}
                className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
              />
              <div>
                <span className="text-sm font-medium text-gray-900">Skip Animations</span>
                <p className="text-xs text-gray-600">Disable animations for faster navigation</p>
              </div>
            </label>
          </div>
        </div>

        {/* Gamification Settings */}
        <div>
          <h4 className="font-medium text-gray-900 mb-3">Gamification</h4>
          <div className="space-y-3">
            <label className="flex items-center space-x-3">
              <input
                type="checkbox"
                checked={preferences.enableGamification}
                onChange={(e) => updatePreferences({ enableGamification: e.target.checked })}
                className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
              />
              <div>
                <span className="text-sm font-medium text-gray-900">Enable Achievements</span>
                <p className="text-xs text-gray-600">Show achievement notifications and progress tracking</p>
              </div>
            </label>
          </div>
        </div>

        {/* Notification Settings */}
        <div>
          <h4 className="font-medium text-gray-900 mb-3">Reminder Settings</h4>
          <div>
            <label className="block text-sm font-medium text-gray-900 mb-2">
              Reminder Frequency
            </label>
            <select
              value={preferences.reminderFrequency}
              onChange={(e) => updatePreferences({ 
                reminderFrequency: e.target.value as 'daily' | 'weekly' | 'never' 
              })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="daily">Daily reminders</option>
              <option value="weekly">Weekly reminders</option>
              <option value="never">No reminders</option>
            </select>
            <p className="text-xs text-gray-600 mt-1">
              How often to remind you about incomplete onboarding steps
            </p>
          </div>
        </div>

        {/* Reset Options */}
        <div className="pt-6 border-t border-gray-200">
          <h4 className="font-medium text-gray-900 mb-3">Reset Options</h4>
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 bg-yellow-50 rounded-lg">
              <div>
                <span className="text-sm font-medium text-yellow-900">Reset Onboarding Progress</span>
                <p className="text-xs text-yellow-700">Start the onboarding process from the beginning</p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={resetOnboarding}
                className="text-yellow-700 border-yellow-300 hover:bg-yellow-100"
              >
                Reset
              </Button>
            </div>

            <div className="flex items-center justify-between p-3 bg-red-50 rounded-lg">
              <div>
                <span className="text-sm font-medium text-red-900">Reset All Achievements</span>
                <p className="text-xs text-red-700">Clear all unlocked achievements and points</p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={resetAchievements}
                className="text-red-700 border-red-300 hover:bg-red-100"
              >
                Reset
              </Button>
            </div>
          </div>
        </div>
      </div>
    </Card>
  );

  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Onboarding & Tutorials</h1>
        <p className="text-gray-600">
          Manage your learning experience and track your progress
        </p>
      </div>

      {/* Tab Navigation */}
      <div className="flex space-x-1 mb-6 bg-gray-100 p-1 rounded-lg">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`flex-1 px-4 py-2 text-sm font-medium rounded-md transition-colors ${
              activeTab === tab.id
                ? 'bg-white text-blue-600 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <span className="mr-2">{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div>
        {activeTab === 'overview' && renderOverview()}
        {activeTab === 'preferences' && renderPreferences()}
        {activeTab === 'analytics' && <OnboardingAnalytics />}
        {activeTab === 'achievements' && <AchievementGallery />}
      </div>
    </div>
  );
};

export default OnboardingSettings;