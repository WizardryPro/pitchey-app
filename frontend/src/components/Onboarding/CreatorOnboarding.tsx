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
import { CREATOR_ROUTES } from '../../config/navigation.routes';
import type { TutorialStep } from '../../store/onboardingStore';

export const CreatorOnboarding: React.FC = () => {
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

  // Initialize onboarding for creators
  useEffect(() => {
    if (user?.userType === 'creator' && !currentFlow) {
      initializeOnboarding('creator');
    }
  }, [user, currentFlow, initializeOnboarding]);

  if (!currentFlow || !isOnboardingActive) return null;

  const currentStep = currentFlow.steps[currentFlow.currentStepIndex];
  const progress = ((currentFlow.currentStepIndex + 1) / currentFlow.steps.length) * 100;

  const handleStepComplete = (stepId: string) => {
    completeStep(stepId);
    
    // Auto-advance to next step after completion
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

  // Define tour steps for each onboarding phase
  const getTourSteps = (stepId: string): TutorialStep[] => {
    switch (stepId) {
      case 'dashboard-tour':
        return [
          {
            id: 'nav-overview',
            target: '[data-tour="creator-nav"]',
            title: 'Your Creator Navigation',
            content: 'This is your main navigation. Access all creator features from here.',
            placement: 'right'
          },
          {
            id: 'pitch-management',
            target: '[data-tour="pitch-menu"]',
            title: 'Pitch Management',
            content: 'Create, edit, and manage all your movie pitches from this section.',
            placement: 'bottom'
          },
          {
            id: 'analytics-overview',
            target: '[data-tour="analytics-link"]',
            title: 'Track Your Performance',
            content: 'Monitor views, engagement, and investor interest in your analytics dashboard.',
            placement: 'bottom'
          },
          {
            id: 'notifications',
            target: '[data-tour="notification-bell"]',
            title: 'Stay Updated',
            content: 'Get notified about investor interest, NDA requests, and collaboration opportunities.',
            placement: 'left'
          }
        ];
      
      case 'first-pitch':
        return [
          {
            id: 'pitch-form-title',
            target: '[data-tour="pitch-title"]',
            title: 'Craft a Compelling Title',
            content: 'Your title is the first thing investors see. Make it memorable and genre-appropriate.',
            placement: 'top'
          },
          {
            id: 'pitch-form-logline',
            target: '[data-tour="pitch-logline"]',
            title: 'Write Your Logline',
            content: 'A logline is a one-sentence summary. Keep it under 25 words and focus on the main conflict.',
            placement: 'top'
          },
          {
            id: 'pitch-form-synopsis',
            target: '[data-tour="pitch-synopsis"]',
            title: 'Develop Your Synopsis',
            content: 'Provide a detailed story overview without spoiling the ending. 2-3 paragraphs work best.',
            placement: 'top'
          },
          {
            id: 'pitch-form-budget',
            target: '[data-tour="pitch-budget"]',
            title: 'Set Your Budget Range',
            content: 'Be realistic about your budget needs. This helps match you with appropriate investors.',
            placement: 'top'
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
            userType="creator"
            userName={user?.username || 'Creator'}
            onGetStarted={() => handleStepComplete('welcome')}
            onSkip={() => handleSkipStep('welcome')}
          />
        );

      case 'profile-setup':
        return (
          <ProfileSetupStep
            onComplete={() => handleStepComplete('profile-setup')}
            onSkip={() => handleSkipStep('profile-setup')}
          />
        );

      case 'first-pitch':
        return (
          <FirstPitchStep
            onComplete={() => handleStepComplete('first-pitch')}
            onSkip={() => handleSkipStep('first-pitch')}
            onStartTour={() => setShowTour(true)}
          />
        );

      case 'nda-setup':
        return (
          <NDAEducationStep
            onComplete={() => handleStepComplete('nda-setup')}
            onSkip={() => handleSkipStep('nda-setup')}
          />
        );

      case 'dashboard-tour':
        return (
          <DashboardTourStep
            onComplete={() => handleStepComplete('dashboard-tour')}
            onSkip={() => handleSkipStep('dashboard-tour')}
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
                  Creator Onboarding
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
          tourId={`creator-${currentStep.id}-tour`}
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
const ProfileSetupStep: React.FC<{
  onComplete: () => void;
  onSkip: () => void;
}> = ({ onComplete, onSkip }) => {
  const navigate = useNavigate();

  return (
    <Card className="p-6">
      <div className="text-center mb-6">
        <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <span className="text-2xl">👤</span>
        </div>
        <h3 className="text-xl font-semibold mb-2">Complete Your Creator Profile</h3>
        <p className="text-gray-600">
          A complete profile helps investors and production companies discover and trust your work.
        </p>
      </div>

      <div className="space-y-4 mb-6">
        <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
          <div>
            <h4 className="font-medium">Professional Bio</h4>
            <p className="text-sm text-gray-600">Tell your story and highlight your experience</p>
          </div>
          <Badge variant="secondary">Required</Badge>
        </div>
        
        <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
          <div>
            <h4 className="font-medium">Portfolio Highlights</h4>
            <p className="text-sm text-gray-600">Showcase your best previous work</p>
          </div>
          <Badge variant="outline">Optional</Badge>
        </div>
        
        <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
          <div>
            <h4 className="font-medium">Contact Information</h4>
            <p className="text-sm text-gray-600">How industry professionals can reach you</p>
          </div>
          <Badge variant="secondary">Required</Badge>
        </div>
      </div>

      <div className="flex gap-4">
        <Button
          className="flex-1"
          onClick={() => {
            void navigate(CREATOR_ROUTES.profile);
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

const FirstPitchStep: React.FC<{
  onComplete: () => void;
  onSkip: () => void;
  onStartTour: () => void;
}> = ({ onComplete, onSkip, onStartTour }) => {
  const navigate = useNavigate();

  return (
    <Card className="p-6">
      <div className="text-center mb-6">
        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <span className="text-2xl">🎬</span>
        </div>
        <h3 className="text-xl font-semibold mb-2">Create Your First Pitch</h3>
        <p className="text-gray-600">
          Let's create a compelling pitch that will attract investors and production companies.
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-6 mb-6">
        <div>
          <h4 className="font-semibold mb-3">Tips for Success:</h4>
          <ul className="space-y-2 text-sm text-gray-600">
            <li className="flex items-start">
              <span className="text-green-500 mr-2">✓</span>
              Write a compelling logline under 25 words
            </li>
            <li className="flex items-start">
              <span className="text-green-500 mr-2">✓</span>
              Include a detailed but concise synopsis
            </li>
            <li className="flex items-start">
              <span className="text-green-500 mr-2">✓</span>
              Set a realistic budget range
            </li>
            <li className="flex items-start">
              <span className="text-green-500 mr-2">✓</span>
              Choose appropriate genres and themes
            </li>
          </ul>
        </div>
        
        <div>
          <h4 className="font-semibold mb-3">What You'll Learn:</h4>
          <ul className="space-y-2 text-sm text-gray-600">
            <li className="flex items-start">
              <span className="text-blue-500 mr-2">→</span>
              Industry-standard pitch formatting
            </li>
            <li className="flex items-start">
              <span className="text-blue-500 mr-2">→</span>
              How to protect your IP with NDAs
            </li>
            <li className="flex items-start">
              <span className="text-blue-500 mr-2">→</span>
              Targeting the right investors
            </li>
            <li className="flex items-start">
              <span className="text-blue-500 mr-2">→</span>
              Tracking pitch performance
            </li>
          </ul>
        </div>
      </div>

      <div className="flex gap-4">
        <Button
          className="flex-1"
          onClick={() => {
            void navigate(CREATOR_ROUTES.pitchNew);
            onComplete();
          }}
        >
          Create First Pitch
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

const NDAEducationStep: React.FC<{
  onComplete: () => void;
  onSkip: () => void;
}> = ({ onComplete, onSkip }) => {
  return (
    <Card className="p-6">
      <div className="text-center mb-6">
        <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <span className="text-2xl">🔒</span>
        </div>
        <h3 className="text-xl font-semibold mb-2">Protect Your Ideas with NDAs</h3>
        <p className="text-gray-600">
          Learn how Non-Disclosure Agreements protect your intellectual property.
        </p>
      </div>

      <div className="space-y-4 mb-6">
        <div className="p-4 bg-blue-50 rounded-lg">
          <h4 className="font-semibold text-blue-900">What is an NDA?</h4>
          <p className="text-blue-800 text-sm mt-1">
            A legal agreement that prevents others from sharing your confidential project details.
          </p>
        </div>
        
        <div className="p-4 bg-green-50 rounded-lg">
          <h4 className="font-semibold text-green-900">Why Use NDAs?</h4>
          <p className="text-green-800 text-sm mt-1">
            Protect your scripts, storylines, and unique concepts before sharing with investors.
          </p>
        </div>
        
        <div className="p-4 bg-yellow-50 rounded-lg">
          <h4 className="font-semibold text-yellow-900">How It Works on Pitchey</h4>
          <p className="text-yellow-800 text-sm mt-1">
            Investors must sign your NDA before accessing detailed project information.
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

const DashboardTourStep: React.FC<{
  onComplete: () => void;
  onSkip: () => void;
  onStartTour: () => void;
}> = ({ onComplete, onSkip, onStartTour }) => {
  const navigate = useNavigate();

  return (
    <Card className="p-6">
      <div className="text-center mb-6">
        <div className="w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <span className="text-2xl">🎛️</span>
        </div>
        <h3 className="text-xl font-semibold mb-2">Explore Your Dashboard</h3>
        <p className="text-gray-600">
          Let's take a tour of your creator dashboard and all its powerful features.
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-6 mb-6">
        <div>
          <h4 className="font-semibold mb-3">Dashboard Features:</h4>
          <ul className="space-y-2 text-sm text-gray-600">
            <li>📊 Analytics and performance metrics</li>
            <li>📝 Pitch management tools</li>
            <li>💬 Investor communication center</li>
            <li>🔔 Real-time notifications</li>
            <li>👥 Team collaboration features</li>
          </ul>
        </div>
        
        <div>
          <h4 className="font-semibold mb-3">Quick Actions:</h4>
          <ul className="space-y-2 text-sm text-gray-600">
            <li>🚀 Create new pitches</li>
            <li>📈 View pitch performance</li>
            <li>💼 Manage NDA requests</li>
            <li>🎯 Track investor interest</li>
            <li>⚙️ Customize your profile</li>
          </ul>
        </div>
      </div>

      <div className="flex gap-4">
        <Button className="flex-1" onClick={onStartTour}>
          Take Dashboard Tour
        </Button>
        <Button
          variant="outline"
          onClick={() => {
            void navigate(CREATOR_ROUTES.dashboard);
            onComplete();
          }}
        >
          Explore on My Own
        </Button>
        <Button variant="ghost" onClick={onSkip}>
          Skip Tour
        </Button>
      </div>
    </Card>
  );
};