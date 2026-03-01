import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useOnboardingStore } from '../../store/onboardingStore';
import { useBetterAuthStore } from '../../store/betterAuthStore';
import { GuidedTour } from './GuidedTour';
import { OnboardingWelcome } from './OnboardingWelcome';
import { Card } from '@shared/components/ui/card';
import { Button } from '@shared/components/ui/button';
import { Badge } from '@shared/components/ui/badge';
import { Progress } from '@shared/components/ui/progress';
import { INVESTOR_ROUTES } from '../../config/navigation.routes';
import type { TutorialStep } from '../../store/onboardingStore';

export const InvestorOnboarding: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useBetterAuthStore();
  const {
    currentFlow,
    isOnboardingActive,
    initializeOnboarding,
    completeStep,
    skipStep,
    nextStep,
    previousStep,
    completeOnboarding,
    skipOnboarding
  } = useOnboardingStore();

  const [showTour, setShowTour] = useState(false);

  useEffect(() => {
    if (user?.userType === 'investor' && !currentFlow) {
      initializeOnboarding('investor');
    }
  }, [user, currentFlow, initializeOnboarding]);

  if (!currentFlow || !isOnboardingActive) return null;

  const currentStep = currentFlow.steps[currentFlow.currentStepIndex];
  const progress = ((currentFlow.currentStepIndex + 1) / currentFlow.steps.length) * 100;

  const handleStepComplete = (stepId: string) => {
    completeStep(stepId);
    
    setTimeout(() => {
      if (currentFlow.currentStepIndex < currentFlow.steps.length - 1) {
        nextStep();
      } else {
        completeOnboarding();
      }
    }, 500);
  };

  const handleSkipStep = (stepId: string) => {
    if (!currentStep.required) {
      skipStep(stepId);
      nextStep();
    }
  };

  const getTourSteps = (stepId: string): TutorialStep[] => {
    switch (stepId) {
      case 'browse-pitches':
        return [
          {
            id: 'marketplace-overview',
            target: '[data-tour="marketplace-header"]',
            title: 'Discover Projects',
            content: 'Browse thousands of movie projects looking for investment.',
            placement: 'bottom'
          },
          {
            id: 'filter-options',
            target: '[data-tour="filter-bar"]',
            title: 'Filter by Your Preferences',
            content: 'Use advanced filters to find projects that match your investment criteria.',
            placement: 'bottom'
          },
          {
            id: 'pitch-cards',
            target: '[data-tour="pitch-card"]:first-child',
            title: 'Project Overview',
            content: 'Each card shows key details: genre, budget, team, and initial metrics.',
            placement: 'top'
          },
          {
            id: 'saved-projects',
            target: '[data-tour="save-button"]',
            title: 'Save Interesting Projects',
            content: 'Save projects to review later or share with your investment team.',
            placement: 'top'
          }
        ];
      
      case 'portfolio-management':
        return [
          {
            id: 'portfolio-overview',
            target: '[data-tour="portfolio-nav"]',
            title: 'Your Investment Portfolio',
            content: 'Track all your investments and their performance in one place.',
            placement: 'right'
          },
          {
            id: 'performance-metrics',
            target: '[data-tour="performance-chart"]',
            title: 'Performance Analytics',
            content: 'Monitor ROI, project status, and market trends for your investments.',
            placement: 'top'
          },
          {
            id: 'deal-pipeline',
            target: '[data-tour="deals-section"]',
            title: 'Manage Your Deals',
            content: 'Track negotiations, pending deals, and completed investments.',
            placement: 'bottom'
          }
        ];
      
      default:
        return [];
    }
  };

  const renderStepContent = () => {
    switch (currentStep.id) {
      case 'welcome':
        return (
          <OnboardingWelcome
            userType="investor"
            userName={user?.username || 'Investor'}
            onGetStarted={() => handleStepComplete('welcome')}
            onSkip={() => handleSkipStep('welcome')}
          />
        );

      case 'profile-setup':
        return (
          <InvestorProfileStep
            onComplete={() => handleStepComplete('profile-setup')}
            onSkip={() => handleSkipStep('profile-setup')}
          />
        );

      case 'browse-pitches':
        return (
          <BrowsePitchesStep
            onComplete={() => handleStepComplete('browse-pitches')}
            onSkip={() => handleSkipStep('browse-pitches')}
            onStartTour={() => setShowTour(true)}
          />
        );

      case 'nda-signing':
        return (
          <NDASigningStep
            onComplete={() => handleStepComplete('nda-signing')}
            onSkip={() => handleSkipStep('nda-signing')}
          />
        );

      case 'portfolio-management':
        return (
          <PortfolioManagementStep
            onComplete={() => handleStepComplete('portfolio-management')}
            onSkip={() => handleSkipStep('portfolio-management')}
            onStartTour={() => setShowTour(true)}
          />
        );

      default:
        return (
          <Card className="p-6 text-center">
            <h3 className="text-lg font-semibold mb-2">{currentStep.title}</h3>
            <p className="text-gray-600 mb-4">{currentStep.description}</p>
            <div className="flex gap-2 justify-center">
              <Button onClick={() => handleStepComplete(currentStep.id)}>
                Complete
              </Button>
              {!currentStep.required && (
                <Button variant="outline" onClick={() => handleSkipStep(currentStep.id)}>
                  Skip
                </Button>
              )}
            </div>
          </Card>
        );
    }
  };

  return (
    <>
      <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center">
        <div className="w-full max-w-4xl mx-4">
          {/* Progress Header */}
          <div className="bg-white dark:bg-gray-900 rounded-t-lg p-4 border-b">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                  Investor Onboarding
                </h2>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Step {currentFlow.currentStepIndex + 1} of {currentFlow.steps.length}
                </p>
              </div>
              
              <div className="flex items-center space-x-4">
                <div className="text-right">
                  <div className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Progress: {Math.round(progress)}%
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    {currentStep.estimatedTime && `~${currentStep.estimatedTime} min remaining`}
                  </div>
                </div>
                
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={skipOnboarding}
                  className="text-gray-500"
                >
                  Skip Onboarding
                </Button>
              </div>
            </div>
            
            <Progress value={progress} className="h-2" />
          </div>

          {/* Step Content */}
          <div className="bg-white dark:bg-gray-900 rounded-b-lg p-6 max-h-96 overflow-y-auto">
            {renderStepContent()}
          </div>

          {/* Navigation Footer */}
          <div className="bg-gray-50 dark:bg-gray-800 rounded-b-lg p-4 flex justify-between items-center">
            <Button
              variant="outline"
              onClick={previousStep}
              disabled={currentFlow.currentStepIndex === 0}
            >
              Previous
            </Button>

            <div className="flex items-center space-x-2">
              {currentFlow.steps.map((step, index) => (
                <div
                  key={step.id}
                  className={`w-3 h-3 rounded-full ${
                    index < currentFlow.currentStepIndex
                      ? 'bg-green-500'
                      : index === currentFlow.currentStepIndex
                      ? 'bg-blue-500'
                      : 'bg-gray-300'
                  }`}
                />
              ))}
            </div>

            <Button
              onClick={() => {
                if (currentFlow.currentStepIndex < currentFlow.steps.length - 1) {
                  nextStep();
                } else {
                  completeOnboarding();
                }
              }}
            >
              {currentFlow.currentStepIndex < currentFlow.steps.length - 1 ? 'Next' : 'Finish'}
            </Button>
          </div>
        </div>
      </div>

      {/* Guided Tours */}
      {showTour && (
        <GuidedTour
          tourId={`investor-${currentStep.id}-tour`}
          steps={getTourSteps(currentStep.id)}
          onComplete={() => setShowTour(false)}
          onSkip={() => setShowTour(false)}
          autoStart
        />
      )}
    </>
  );
};

// Individual Step Components
const InvestorProfileStep: React.FC<{
  onComplete: () => void;
  onSkip: () => void;
}> = ({ onComplete, onSkip }) => {
  const navigate = useNavigate();

  return (
    <Card className="p-6">
      <div className="text-center mb-6">
        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <span className="text-2xl">💼</span>
        </div>
        <h3 className="text-xl font-semibold mb-2">Set Up Your Investment Profile</h3>
        <p className="text-gray-600">
          Define your investment preferences to discover projects that match your criteria.
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-4 mb-6">
        <div className="p-4 bg-blue-50 rounded-lg">
          <h4 className="font-semibold text-blue-900 mb-2">Investment Criteria</h4>
          <ul className="text-sm text-blue-800 space-y-1">
            <li>• Budget ranges you're comfortable with</li>
            <li>• Preferred genres and themes</li>
            <li>• Geographic preferences</li>
            <li>• Risk tolerance levels</li>
          </ul>
        </div>
        
        <div className="p-4 bg-green-50 rounded-lg">
          <h4 className="font-semibold text-green-900 mb-2">Professional Background</h4>
          <ul className="text-sm text-green-800 space-y-1">
            <li>• Investment experience</li>
            <li>• Industry connections</li>
            <li>• Portfolio highlights</li>
            <li>• Expertise areas</li>
          </ul>
        </div>
      </div>

      <div className="flex gap-4">
        <Button 
          className="flex-1" 
          onClick={() => {
            navigate(INVESTOR_ROUTES.settings);
            onComplete();
          }}
        >
          Set Up Profile
        </Button>
        <Button variant="outline" onClick={onSkip}>
          Skip for Now
        </Button>
      </div>
    </Card>
  );
};

const BrowsePitchesStep: React.FC<{
  onComplete: () => void;
  onSkip: () => void;
  onStartTour: () => void;
}> = ({ onComplete, onSkip, onStartTour }) => {
  const navigate = useNavigate();

  return (
    <Card className="p-6">
      <div className="text-center mb-6">
        <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <span className="text-2xl">🔍</span>
        </div>
        <h3 className="text-xl font-semibold mb-2">Discover Amazing Projects</h3>
        <p className="text-gray-600">
          Explore our marketplace of movie pitches and find your next investment opportunity.
        </p>
      </div>

      <div className="space-y-4 mb-6">
        <div className="p-4 border rounded-lg">
          <h4 className="font-semibold mb-2">Smart Filtering</h4>
          <p className="text-sm text-gray-600">
            Filter by budget, genre, location, and more to find projects that match your investment thesis.
          </p>
        </div>
        
        <div className="p-4 border rounded-lg">
          <h4 className="font-semibold mb-2">Detailed Project Information</h4>
          <p className="text-sm text-gray-600">
            Access comprehensive project details, team backgrounds, and financial projections.
          </p>
        </div>
        
        <div className="p-4 border rounded-lg">
          <h4 className="font-semibold mb-2">Due Diligence Tools</h4>
          <p className="text-sm text-gray-600">
            Use our built-in tools to evaluate projects and communicate with creators.
          </p>
        </div>
      </div>

      <div className="flex gap-4">
        <Button 
          className="flex-1" 
          onClick={() => {
            navigate(INVESTOR_ROUTES.discover);
            onComplete();
          }}
        >
          Start Browsing
        </Button>
        <Button variant="outline" onClick={onStartTour}>
          Take Tour First
        </Button>
        <Button variant="ghost" onClick={onSkip}>
          Skip
        </Button>
      </div>
    </Card>
  );
};

const NDASigningStep: React.FC<{
  onComplete: () => void;
  onSkip: () => void;
}> = ({ onComplete, onSkip }) => {
  return (
    <Card className="p-6">
      <div className="text-center mb-6">
        <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <span className="text-2xl">🔒</span>
        </div>
        <h3 className="text-xl font-semibold mb-2">Understanding NDAs as an Investor</h3>
        <p className="text-gray-600">
          Learn how Non-Disclosure Agreements protect creators and enable detailed project access.
        </p>
      </div>

      <div className="space-y-4 mb-6">
        <div className="p-4 bg-blue-50 rounded-lg">
          <h4 className="font-semibold text-blue-900">Why Creators Require NDAs</h4>
          <p className="text-blue-800 text-sm mt-1">
            NDAs protect sensitive project information like full scripts, financial models, and strategic plans.
          </p>
        </div>
        
        <div className="p-4 bg-green-50 rounded-lg">
          <h4 className="font-semibold text-green-900">What Happens After Signing</h4>
          <p className="text-green-800 text-sm mt-1">
            You'll gain access to detailed project information, including full scripts and business plans.
          </p>
        </div>
        
        <div className="p-4 bg-yellow-50 rounded-lg">
          <h4 className="font-semibold text-yellow-900">Your Rights and Obligations</h4>
          <p className="text-yellow-800 text-sm mt-1">
            NDAs typically prevent sharing information but don't restrict your investment decisions.
          </p>
        </div>
      </div>

      <div className="flex gap-4">
        <Button className="flex-1" onClick={onComplete}>
          I Understand NDAs
        </Button>
        <Button variant="outline" onClick={onSkip}>
          Skip This Step
        </Button>
      </div>
    </Card>
  );
};

const PortfolioManagementStep: React.FC<{
  onComplete: () => void;
  onSkip: () => void;
  onStartTour: () => void;
}> = ({ onComplete, onSkip, onStartTour }) => {
  const navigate = useNavigate();

  return (
    <Card className="p-6">
      <div className="text-center mb-6">
        <div className="w-16 h-16 bg-indigo-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <span className="text-2xl">📊</span>
        </div>
        <h3 className="text-xl font-semibold mb-2">Master Portfolio Management</h3>
        <p className="text-gray-600">
          Track your investments, monitor performance, and manage your movie portfolio effectively.
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-6 mb-6">
        <div>
          <h4 className="font-semibold mb-3">Key Features:</h4>
          <ul className="space-y-2 text-sm text-gray-600">
            <li className="flex items-start">
              <span className="text-blue-500 mr-2">📈</span>
              Real-time performance tracking
            </li>
            <li className="flex items-start">
              <span className="text-blue-500 mr-2">💰</span>
              ROI and cash flow analysis
            </li>
            <li className="flex items-start">
              <span className="text-blue-500 mr-2">📋</span>
              Deal pipeline management
            </li>
            <li className="flex items-start">
              <span className="text-blue-500 mr-2">🎯</span>
              Risk assessment tools
            </li>
          </ul>
        </div>
        
        <div>
          <h4 className="font-semibold mb-3">Analytics Available:</h4>
          <ul className="space-y-2 text-sm text-gray-600">
            <li className="flex items-start">
              <span className="text-green-500 mr-2">→</span>
              Portfolio diversification analysis
            </li>
            <li className="flex items-start">
              <span className="text-green-500 mr-2">→</span>
              Market trend comparisons
            </li>
            <li className="flex items-start">
              <span className="text-green-500 mr-2">→</span>
              Project milestone tracking
            </li>
            <li className="flex items-start">
              <span className="text-green-500 mr-2">→</span>
              Tax reporting assistance
            </li>
          </ul>
        </div>
      </div>

      <div className="flex gap-4">
        <Button className="flex-1" onClick={onStartTour}>
          Take Portfolio Tour
        </Button>
        <Button 
          variant="outline" 
          onClick={() => {
            navigate(INVESTOR_ROUTES.portfolio);
            onComplete();
          }}
        >
          Explore Dashboard
        </Button>
        <Button variant="ghost" onClick={onSkip}>
          Skip Tour
        </Button>
      </div>
    </Card>
  );
};