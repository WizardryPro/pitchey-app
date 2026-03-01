import React, { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useOnboardingStore } from '../../store/onboardingStore';
import { InteractiveTooltip } from './InteractiveTooltip';
import { Card } from '@shared/components/ui/card';
import { Button } from '@shared/components/ui/button';
import { Badge } from '@shared/components/ui/badge';

interface FeatureSpotlightProps {
  featureId: string;
  target: string;
  title: string;
  description: string;
  benefits?: string[];
  actionLabel?: string;
  actionUrl?: string;
  onAction?: () => void;
  onDismiss?: () => void;
  priority?: 'high' | 'medium' | 'low';
}

const FeatureSpotlight: React.FC<FeatureSpotlightProps> = ({
  featureId,
  target,
  title,
  description,
  benefits = [],
  actionLabel = 'Try It Now',
  actionUrl,
  onAction,
  onDismiss,
  priority = 'medium'
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const [targetElement, setTargetElement] = useState<HTMLElement | null>(null);
  
  const {
    markFeatureDiscovered,
    dismissFeaturePrompt,
    trackFeatureEngagement,
    preferences
  } = useOnboardingStore();

  // Find target element
  useEffect(() => {
    const findTarget = () => {
      const element = document.querySelector(target) as HTMLElement;
      if (element) {
        setTargetElement(element);
        setIsVisible(true);
      } else {
        setTimeout(findTarget, 100);
      }
    };
    findTarget();
  }, [target]);

  // Calculate position
  const calculatePosition = useCallback(() => {
    if (!targetElement || !isVisible) return;

    const targetRect = targetElement.getBoundingClientRect();
    const viewport = {
      width: window.innerWidth,
      height: window.innerHeight
    };

    const newPosition = {
      top: targetRect.bottom + 16,
      left: Math.max(16, Math.min(
        targetRect.left - 200,
        viewport.width - 416
      ))
    };

    setPosition(newPosition);
  }, [targetElement, isVisible]);

  useEffect(() => {
    if (isVisible && targetElement) {
      calculatePosition();
      window.addEventListener('resize', calculatePosition);
      window.addEventListener('scroll', calculatePosition);
      
      return () => {
        window.removeEventListener('resize', calculatePosition);
        window.removeEventListener('scroll', calculatePosition);
      };
    }
  }, [isVisible, targetElement, calculatePosition]);

  const handleAction = () => {
    trackFeatureEngagement(featureId);
    markFeatureDiscovered(featureId);
    
    if (onAction) {
      onAction();
    } else if (actionUrl) {
      window.location.href = actionUrl;
    }
    
    handleDismiss();
  };

  const handleDismiss = () => {
    setIsVisible(false);
    dismissFeaturePrompt(featureId);
    onDismiss?.();
  };

  const handleTryFeature = () => {
    // Simulate clicking on the target element to trigger the feature
    if (targetElement) {
      targetElement.click();
      trackFeatureEngagement(featureId);
      markFeatureDiscovered(featureId);
    }
  };

  if (!isVisible || !targetElement) return null;

  const priorityColors = {
    high: 'from-red-50 to-pink-50 border-red-200',
    medium: 'from-blue-50 to-indigo-50 border-blue-200',
    low: 'from-gray-50 to-slate-50 border-gray-200'
  };

  const priorityBadgeColors = {
    high: 'bg-red-100 text-red-800',
    medium: 'bg-blue-100 text-blue-800',
    low: 'bg-gray-100 text-gray-800'
  };

  // Create highlight overlay for target element
  const targetRect = targetElement.getBoundingClientRect();
  const highlightOverlay = (
    <div
      style={{
        position: 'fixed',
        top: targetRect.top - 4,
        left: targetRect.left - 4,
        width: targetRect.width + 8,
        height: targetRect.height + 8,
        border: '2px solid #3b82f6',
        borderRadius: '8px',
        backgroundColor: 'rgba(59, 130, 246, 0.1)',
        boxShadow: '0 0 0 4px rgba(59, 130, 246, 0.2)',
        zIndex: 9998,
        pointerEvents: 'none',
        animation: preferences.skipAnimations ? 'none' : 'pulse 2s infinite'
      }}
    />
  );

  const spotlightContent = (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black bg-opacity-30 z-[9996]" />
      
      {/* Highlight */}
      {highlightOverlay}
      
      {/* Spotlight Card */}
      <Card
        className={`fixed z-[9999] w-96 p-6 bg-gradient-to-br ${priorityColors[priority]} shadow-xl`}
        style={{ top: position.top, left: position.left }}
      >
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center space-x-2">
            <span className="text-2xl">✨</span>
            <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
          </div>
          
          <div className="flex items-center space-x-2">
            <Badge className={priorityBadgeColors[priority]}>
              New Feature
            </Badge>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleDismiss}
              className="text-gray-500 hover:text-gray-700 h-6 w-6 p-0"
            >
              ×
            </Button>
          </div>
        </div>

        <p className="text-gray-700 mb-4">{description}</p>

        {benefits.length > 0 && (
          <div className="mb-4">
            <h4 className="font-medium text-gray-900 mb-2">Benefits:</h4>
            <ul className="space-y-1">
              {benefits.map((benefit, index) => (
                <li key={index} className="text-sm text-gray-600 flex items-start">
                  <span className="text-green-500 mr-2 mt-0.5">✓</span>
                  {benefit}
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="flex gap-3">
          <Button onClick={handleAction} className="flex-1">
            {actionLabel}
          </Button>
          <Button variant="outline" onClick={handleTryFeature}>
            Try It
          </Button>
          <Button variant="ghost" onClick={handleDismiss}>
            Maybe Later
          </Button>
        </div>

        <p className="text-xs text-gray-500 text-center mt-3">
          You can turn off feature spotlights in settings
        </p>
      </Card>
    </>
  );

  return createPortal(spotlightContent, document.body);
};

interface HelpButtonProps {
  className?: string;
}

export const HelpButton: React.FC<HelpButtonProps> = ({ className = '' }) => {
  const [showHelpMenu, setShowHelpMenu] = useState(false);
  const { incrementHelpRequests, addFeaturePrompt } = useOnboardingStore();

  const helpOptions = [
    {
      id: 'quick-tour',
      title: 'Take a Quick Tour',
      description: 'Get oriented with key features',
      icon: '🗺️',
      action: () => addFeaturePrompt('dashboard-tour')
    },
    {
      id: 'feature-guide',
      title: 'Feature Guide',
      description: 'Learn about specific features',
      icon: '📚',
      action: () => addFeaturePrompt('feature-guide')
    },
    {
      id: 'keyboard-shortcuts',
      title: 'Keyboard Shortcuts',
      description: 'Work faster with shortcuts',
      icon: '⌨️',
      action: () => addFeaturePrompt('keyboard-shortcuts')
    },
    {
      id: 'contact-support',
      title: 'Contact Support',
      description: 'Get help from our team',
      icon: '💬',
      action: () => window.open('/contact', '_blank')
    }
  ];

  const handleHelpClick = () => {
    setShowHelpMenu(!showHelpMenu);
    incrementHelpRequests();
  };

  return (
    <div className={`relative ${className}`}>
      <Button
        variant="outline"
        size="sm"
        onClick={handleHelpClick}
        className="rounded-full w-10 h-10 p-0"
        data-tour="help-button"
      >
        ❓
      </Button>

      {showHelpMenu && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setShowHelpMenu(false)}
          />
          <Card className="absolute right-0 top-12 w-72 p-4 z-50 shadow-lg">
            <h3 className="font-semibold text-gray-900 mb-3">How can we help?</h3>
            <div className="space-y-2">
              {helpOptions.map(option => (
                <button
                  key={option.id}
                  onClick={() => {
                    option.action();
                    setShowHelpMenu(false);
                  }}
                  className="w-full text-left p-3 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-start space-x-3">
                    <span className="text-lg">{option.icon}</span>
                    <div>
                      <h4 className="font-medium text-gray-900">{option.title}</h4>
                      <p className="text-sm text-gray-600">{option.description}</p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </Card>
        </>
      )}
    </div>
  );
};

interface ContextualHelpProps {
  page: string;
  userType: 'creator' | 'investor' | 'production';
}

export const ContextualHelp: React.FC<ContextualHelpProps> = ({
  page,
  userType
}) => {
  const {
    discoveredFeatures,
    pendingFeaturePrompts,
    featureSpotlightQueue,
    preferences
  } = useOnboardingStore();

  // Define contextual help for different pages
  const getContextualFeatures = () => {
    const baseFeatures: Record<string, any> = {
      dashboard: {
        'analytics-overview': {
          target: '[data-tour="analytics-section"]',
          title: 'Track Your Performance',
          description: 'Monitor key metrics and performance indicators.',
          benefits: ['Real-time updates', 'Exportable reports', 'Trend analysis']
        },
        'quick-actions': {
          target: '[data-tour="quick-actions"]',
          title: 'Quick Actions',
          description: 'Access frequently used features instantly.',
          benefits: ['Save time', 'Streamlined workflow', 'One-click access']
        }
      },
      pitch: {
        'auto-save': {
          target: '[data-tour="pitch-form"]',
          title: 'Auto-Save Feature',
          description: 'Your work is automatically saved as you type.',
          benefits: ['Never lose progress', 'Work across devices', 'Peace of mind']
        }
      }
    };

    const userSpecificFeatures: Record<string, any> = {
      creator: {
        dashboard: {
          'pitch-analytics': {
            target: '[data-tour="pitch-metrics"]',
            title: 'Pitch Analytics',
            description: 'See how your pitches are performing with investors.',
            benefits: ['Track engagement', 'Optimize content', 'Identify trends']
          }
        }
      },
      investor: {
        dashboard: {
          'deal-pipeline': {
            target: '[data-tour="deal-pipeline"]',
            title: 'Deal Pipeline',
            description: 'Manage your investment opportunities efficiently.',
            benefits: ['Track progress', 'Manage deadlines', 'Organize deals']
          }
        }
      },
      production: {
        dashboard: {
          'submission-queue': {
            target: '[data-tour="submission-queue"]',
            title: 'Submission Queue',
            description: 'Review and organize incoming project submissions.',
            benefits: ['Efficient review', 'Team collaboration', 'Decision tracking']
          }
        }
      }
    };

    return {
      ...baseFeatures[page],
      ...userSpecificFeatures[userType]?.[page]
    };
  };

  const contextualFeatures = getContextualFeatures();

  // Show feature spotlights for undiscovered features
  const showFeatureSpotlight = useCallback((featureId: string) => {
    const feature = contextualFeatures[featureId];
    if (!feature) return null;

    return (
      <FeatureSpotlight
        key={featureId}
        featureId={featureId}
        target={feature.target}
        title={feature.title}
        description={feature.description}
        benefits={feature.benefits}
        priority={feature.priority || 'medium'}
      />
    );
  }, [contextualFeatures]);

  // Check for features to highlight
  useEffect(() => {
    if (!preferences.showTooltips) return;

    const timer = setTimeout(() => {
      Object.keys(contextualFeatures).forEach(featureId => {
        if (!discoveredFeatures.includes(featureId) && 
            !pendingFeaturePrompts.includes(featureId)) {
          // Randomly show feature spotlights (25% chance per feature)
          if (Math.random() < 0.25) {
            showFeatureSpotlight(featureId);
          }
        }
      });
    }, 3000); // Show after 3 seconds on page

    return () => clearTimeout(timer);
  }, [page, userType, discoveredFeatures, pendingFeaturePrompts, contextualFeatures, preferences.showTooltips, showFeatureSpotlight]);

  return (
    <>
      {/* Render queued feature spotlights */}
      {featureSpotlightQueue.map(featureId => showFeatureSpotlight(featureId))}
      
      {/* Interactive tooltips for discovered features */}
      {Object.entries(contextualFeatures).map(([featureId, feature]: [string, any]) => (
        <InteractiveTooltip
          key={featureId}
          id={featureId}
          target={feature.target}
          title={feature.title}
          content={feature.description}
          variant="tip"
          trigger="hover"
          delay={800}
          showOnce
        />
      ))}
    </>
  );
};

// Main FeatureDiscovery component that combines all discovery features
export const FeatureDiscovery: React.FC<{
  page: string;
  userType: 'creator' | 'investor' | 'production';
}> = ({ page, userType }) => {
  return (
    <>
      <ContextualHelp page={page} userType={userType} />
      <HelpButton className="fixed bottom-4 right-4 z-50" />
    </>
  );
};