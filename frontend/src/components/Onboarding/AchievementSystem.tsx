import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useOnboardingStore, type Achievement } from '../../store/onboardingStore';
import { Card } from '@shared/components/ui/card';
import { Button } from '@shared/components/ui/button';
import { Badge } from '@shared/components/ui/badge';
import { Progress } from '@shared/components/ui/progress';

interface AchievementNotificationProps {
  achievement: Achievement;
  onClose: () => void;
}

const AchievementNotification: React.FC<AchievementNotificationProps> = ({
  achievement,
  onClose
}) => {
  useEffect(() => {
    const timer = setTimeout(onClose, 5000); // Auto-close after 5 seconds
    return () => clearTimeout(timer);
  }, [onClose]);

  const content = (
    <div className="fixed top-4 right-4 z-[10000] max-w-sm">
      <Card className="p-4 bg-gradient-to-r from-yellow-50 to-amber-50 border-yellow-200 shadow-lg animate-slideInRight">
        <div className="flex items-start space-x-3">
          <div className="text-3xl">{achievement.icon}</div>
          <div className="flex-1">
            <div className="flex items-center justify-between mb-1">
              <h4 className="font-bold text-yellow-900">Achievement Unlocked!</h4>
              <Button
                variant="ghost"
                size="sm"
                onClick={onClose}
                className="text-yellow-700 hover:text-yellow-900 h-6 w-6 p-0"
              >
                ×
              </Button>
            </div>
            <h5 className="font-semibold text-yellow-800 mb-1">
              {achievement.title}
            </h5>
            <p className="text-sm text-yellow-700 mb-2">
              {achievement.description}
            </p>
            <div className="flex items-center justify-between">
              <Badge variant="secondary" className="bg-yellow-200 text-yellow-800">
                +{achievement.points} points
              </Badge>
              <span className="text-xs text-yellow-600">
                {achievement.category}
              </span>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );

  return createPortal(content, document.body);
};

interface AchievementDisplayProps {
  achievement: Achievement;
  compact?: boolean;
}

const AchievementDisplay: React.FC<AchievementDisplayProps> = ({
  achievement,
  compact = false
}) => {
  const isUnlocked = !!achievement.unlockedAt;

  if (compact) {
    return (
      <div
        className={`flex items-center space-x-2 p-2 rounded-lg transition-all ${
          isUnlocked
            ? 'bg-green-50 border border-green-200'
            : 'bg-gray-50 border border-gray-200 opacity-60'
        }`}
      >
        <div className={`text-lg ${isUnlocked ? '' : 'grayscale'}`}>
          {achievement.icon}
        </div>
        <div className="flex-1 min-w-0">
          <h4 className={`font-medium text-sm truncate ${
            isUnlocked ? 'text-gray-900' : 'text-gray-500'
          }`}>
            {achievement.title}
          </h4>
          <p className={`text-xs truncate ${
            isUnlocked ? 'text-gray-600' : 'text-gray-400'
          }`}>
            {achievement.description}
          </p>
        </div>
        <div className="text-right">
          <div className={`text-xs font-medium ${
            isUnlocked ? 'text-green-600' : 'text-gray-400'
          }`}>
            {achievement.points}pt
          </div>
          {isUnlocked && achievement.unlockedAt && (
            <div className="text-xs text-gray-500">
              {new Date(achievement.unlockedAt).toLocaleDateString()}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <Card className={`p-4 transition-all ${
      isUnlocked
        ? 'bg-gradient-to-br from-green-50 to-emerald-50 border-green-200 shadow-sm'
        : 'bg-gray-50 border-gray-200 opacity-70'
    }`}>
      <div className="flex items-start space-x-3">
        <div className={`text-2xl ${isUnlocked ? '' : 'grayscale'}`}>
          {achievement.icon}
        </div>
        <div className="flex-1">
          <div className="flex items-center justify-between mb-2">
            <h3 className={`font-semibold ${
              isUnlocked ? 'text-gray-900' : 'text-gray-500'
            }`}>
              {achievement.title}
            </h3>
            <Badge
              variant={isUnlocked ? 'default' : 'secondary'}
              className={isUnlocked ? 'bg-green-100 text-green-800' : ''}
            >
              {achievement.category}
            </Badge>
          </div>
          
          <p className={`text-sm mb-3 ${
            isUnlocked ? 'text-gray-700' : 'text-gray-400'
          }`}>
            {achievement.description}
          </p>
          
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <span className={`text-sm font-medium ${
                isUnlocked ? 'text-green-600' : 'text-gray-400'
              }`}>
                {achievement.points} points
              </span>
              {isUnlocked && (
                <span className="text-xs text-green-500 font-medium">
                  ✓ Unlocked
                </span>
              )}
            </div>
            
            {isUnlocked && achievement.unlockedAt && (
              <span className="text-xs text-gray-500">
                {new Date(achievement.unlockedAt).toLocaleDateString()}
              </span>
            )}
          </div>
        </div>
      </div>
    </Card>
  );
};

interface ProgressStatsProps {
  showDetailed?: boolean;
}

export const ProgressStats: React.FC<ProgressStatsProps> = ({
  showDetailed = false
}) => {
  const {
    achievements,
    totalPoints,
    level,
    streakDays,
    lastActivityDate
  } = useOnboardingStore();

  const unlockedAchievements = achievements.filter(a => a.unlockedAt);
  const pointsToNextLevel = (level * 100) - totalPoints;
  const levelProgress = (totalPoints % 100);

  if (!showDetailed) {
    return (
      <div className="flex items-center space-x-4 p-3 bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg">
        <div className="text-center">
          <div className="text-lg font-bold text-blue-600">Level {level}</div>
          <div className="text-xs text-gray-600">Progress</div>
        </div>
        
        <div className="flex-1">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-gray-600">Level Progress</span>
            <span className="text-xs text-gray-600">{levelProgress}/100</span>
          </div>
          <Progress value={levelProgress} className="h-2" />
        </div>
        
        <div className="text-center">
          <div className="text-lg font-bold text-purple-600">{totalPoints}</div>
          <div className="text-xs text-gray-600">Points</div>
        </div>
        
        <div className="text-center">
          <div className="text-lg font-bold text-orange-600">{streakDays}</div>
          <div className="text-xs text-gray-600">Day Streak</div>
        </div>
      </div>
    );
  }

  return (
    <Card className="p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Your Progress</h3>
      
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="text-center p-4 bg-blue-50 rounded-lg">
          <div className="text-2xl font-bold text-blue-600 mb-1">Level {level}</div>
          <div className="text-sm text-blue-800">Current Level</div>
          <div className="text-xs text-blue-600 mt-1">
            {pointsToNextLevel > 0 ? `${pointsToNextLevel} to next` : 'Max level!'}
          </div>
        </div>
        
        <div className="text-center p-4 bg-purple-50 rounded-lg">
          <div className="text-2xl font-bold text-purple-600 mb-1">{totalPoints}</div>
          <div className="text-sm text-purple-800">Total Points</div>
        </div>
        
        <div className="text-center p-4 bg-green-50 rounded-lg">
          <div className="text-2xl font-bold text-green-600 mb-1">
            {unlockedAchievements.length}
          </div>
          <div className="text-sm text-green-800">Achievements</div>
          <div className="text-xs text-green-600 mt-1">
            of {achievements.length}
          </div>
        </div>
        
        <div className="text-center p-4 bg-orange-50 rounded-lg">
          <div className="text-2xl font-bold text-orange-600 mb-1">{streakDays}</div>
          <div className="text-sm text-orange-800">Day Streak</div>
          {lastActivityDate && (
            <div className="text-xs text-orange-600 mt-1">
              Last: {new Date(lastActivityDate).toLocaleDateString()}
            </div>
          )}
        </div>
      </div>

      {/* Level Progress */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-gray-700">
            Level {level} Progress
          </span>
          <span className="text-sm text-gray-600">
            {levelProgress}/100 points
          </span>
        </div>
        <Progress value={levelProgress} className="h-3" />
      </div>

      {/* Recent Achievements */}
      <div>
        <h4 className="font-medium text-gray-900 mb-3">Recent Achievements</h4>
        <div className="space-y-2 max-h-32 overflow-y-auto">
          {unlockedAchievements
            .slice()
            .sort((a, b) => 
              new Date(b.unlockedAt!).getTime() - new Date(a.unlockedAt!).getTime()
            )
            .slice(0, 3)
            .map(achievement => (
              <AchievementDisplay
                key={achievement.id}
                achievement={achievement}
                compact
              />
            ))}
          
          {unlockedAchievements.length === 0 && (
            <p className="text-sm text-gray-500 italic">
              Complete onboarding steps to unlock achievements!
            </p>
          )}
        </div>
      </div>
    </Card>
  );
};

export const AchievementGallery: React.FC = () => {
  const { achievements } = useOnboardingStore();
  const [filter, setFilter] = useState<'all' | 'unlocked' | 'locked'>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');

  const categories = ['all', ...new Set(achievements.map(a => a.category))];
  
  const filteredAchievements = achievements.filter(achievement => {
    const statusMatch = 
      filter === 'all' ||
      (filter === 'unlocked' && achievement.unlockedAt) ||
      (filter === 'locked' && !achievement.unlockedAt);
    
    const categoryMatch = 
      categoryFilter === 'all' || achievement.category === categoryFilter;
    
    return statusMatch && categoryMatch;
  });

  const unlockedCount = achievements.filter(a => a.unlockedAt).length;
  const completionPercentage = (unlockedCount / achievements.length) * 100;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Achievements</h2>
          <p className="text-gray-600">
            {unlockedCount} of {achievements.length} unlocked ({Math.round(completionPercentage)}%)
          </p>
        </div>
        
        <div className="flex gap-2">
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value as any)}
            className="px-3 py-2 border border-gray-300 rounded-md text-sm"
          >
            <option value="all">All Achievements</option>
            <option value="unlocked">Unlocked Only</option>
            <option value="locked">Locked Only</option>
          </select>
          
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-md text-sm"
          >
            {categories.map(category => (
              <option key={category} value={category}>
                {category === 'all' ? 'All Categories' : 
                 category.charAt(0).toUpperCase() + category.slice(1)}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="mb-6">
        <Progress value={completionPercentage} className="h-3" />
        <p className="text-sm text-gray-600 mt-2">
          Overall completion: {Math.round(completionPercentage)}%
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {filteredAchievements.map(achievement => (
          <AchievementDisplay
            key={achievement.id}
            achievement={achievement}
          />
        ))}
      </div>

      {filteredAchievements.length === 0 && (
        <div className="text-center py-8">
          <p className="text-gray-500">No achievements match your current filters.</p>
        </div>
      )}
    </div>
  );
};

export const AchievementManager: React.FC = () => {
  const [notifications, setNotifications] = useState<Achievement[]>([]);
  const { achievements } = useOnboardingStore();

  // Watch for new achievements
  useEffect(() => {
    const checkForNewAchievements = () => {
      const newlyUnlocked = achievements.filter(
        achievement => 
          achievement.unlockedAt && 
          new Date(achievement.unlockedAt).getTime() > Date.now() - 1000
      );
      
      if (newlyUnlocked.length > 0) {
        setNotifications(prev => [...prev, ...newlyUnlocked]);
      }
    };

    const interval = setInterval(checkForNewAchievements, 1000);
    return () => clearInterval(interval);
  }, [achievements]);

  const handleCloseNotification = (achievementId: string) => {
    setNotifications(prev => prev.filter(a => a.id !== achievementId));
  };

  return (
    <>
      {notifications.map(achievement => (
        <AchievementNotification
          key={`${achievement.id}-${achievement.unlockedAt}`}
          achievement={achievement}
          onClose={() => handleCloseNotification(achievement.id)}
        />
      ))}
    </>
  );
};

// Main achievement system component (combines gallery and manager)
export const AchievementSystem: React.FC = () => {
  return (
    <div className="space-y-6">
      <ProgressStats showDetailed />
      <AchievementGallery />
      <AchievementManager />
    </div>
  );
};