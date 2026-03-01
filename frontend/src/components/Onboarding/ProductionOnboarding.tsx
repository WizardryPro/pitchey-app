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
import { PRODUCTION_ROUTES } from '../../config/navigation.routes';
import type { TutorialStep } from '../../store/onboardingStore';

export const ProductionOnboarding: React.FC = () => {
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
    if (user?.userType === 'production' && !currentFlow) {
      initializeOnboarding('production');
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
      case 'submission-process':
        return [
          {
            id: 'submissions-overview',
            target: '[data-tour="submissions-nav"]',
            title: 'Manage Submissions',
            content: 'Access and organize all pitch submissions in one centralized location.',
            placement: 'right'
          },
          {
            id: 'submission-filtering',
            target: '[data-tour="submission-filters"]',
            title: 'Filter Submissions',
            content: 'Sort by genre, budget, submission date, and custom criteria.',
            placement: 'bottom'
          },
          {
            id: 'review-workflow',
            target: '[data-tour="review-stages"]',
            title: 'Review Workflow',
            content: 'Move projects through your custom review stages: New → Review → Shortlisted → Accepted.',
            placement: 'top'
          },
          {
            id: 'collaboration-tools',
            target: '[data-tour="team-notes"]',
            title: 'Team Collaboration',
            content: 'Add private notes, share feedback, and collaborate with your team on submissions.',
            placement: 'left'
          }
        ];
      
      case 'pipeline-management':
        return [
          {
            id: 'pipeline-overview',
            target: '[data-tour="pipeline-nav"]',
            title: 'Production Pipeline',
            content: 'Manage your entire production pipeline from development to post-production.',
            placement: 'right'
          },
          {
            id: 'project-stages',
            target: '[data-tour="pipeline-stages"]',
            title: 'Project Stages',
            content: 'Track projects through Development, Pre-Production, Production, and Post-Production.',
            placement: 'bottom'
          },
          {
            id: 'resource-management',
            target: '[data-tour="resource-tracker"]',
            title: 'Resource Management',
            content: 'Monitor budgets, schedules, and resource allocation across all projects.',
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
            userType="production"
            userName={user?.username || 'Production Team'}
            onGetStarted={() => handleStepComplete('welcome')}
            onSkip={() => handleSkipStep('welcome')}
          />
        );

      case 'company-setup':
        return (
          <CompanySetupStep
            onComplete={() => handleStepComplete('company-setup')}
            onSkip={() => handleSkipStep('company-setup')}
          />
        );

      case 'submission-process':
        return (
          <SubmissionProcessStep
            onComplete={() => handleStepComplete('submission-process')}
            onSkip={() => handleSkipStep('submission-process')}
            onStartTour={() => setShowTour(true)}
          />
        );

      case 'collaboration-tools':
        return (
          <CollaborationToolsStep
            onComplete={() => handleStepComplete('collaboration-tools')}
            onSkip={() => handleSkipStep('collaboration-tools')}
          />
        );

      case 'pipeline-management':
        return (
          <PipelineManagementStep
            onComplete={() => handleStepComplete('pipeline-management')}
            onSkip={() => handleSkipStep('pipeline-management')}
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
                  Production Company Onboarding
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
          tourId={`production-${currentStep.id}-tour`}
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
const CompanySetupStep: React.FC<{
  onComplete: () => void;
  onSkip: () => void;
}> = ({ onComplete, onSkip }) => {
  const navigate = useNavigate();

  return (
    <Card className="p-6">
      <div className="text-center mb-6">
        <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <span className="text-2xl">🏢</span>
        </div>
        <h3 className="text-xl font-semibold mb-2">Set Up Your Production Company</h3>
        <p className="text-gray-600">
          Complete your company profile to attract the best creators and showcase your capabilities.
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-4 mb-6">
        <div className="p-4 bg-blue-50 rounded-lg">
          <h4 className="font-semibold text-blue-900 mb-2">Company Information</h4>
          <ul className="text-sm text-blue-800 space-y-1">
            <li>• Company name and logo</li>
            <li>• Production capabilities</li>
            <li>• Years of experience</li>
            <li>• Notable productions</li>
          </ul>
        </div>
        
        <div className="p-4 bg-green-50 rounded-lg">
          <h4 className="font-semibold text-green-900 mb-2">Submission Criteria</h4>
          <ul className="text-sm text-green-800 space-y-1">
            <li>• Preferred genres</li>
            <li>• Budget ranges</li>
            <li>• Geographic preferences</li>
            <li>• Submission guidelines</li>
          </ul>
        </div>
      </div>

      <div className="p-4 bg-yellow-50 rounded-lg mb-6">
        <h4 className="font-semibold text-yellow-900 mb-2">Why This Matters</h4>
        <p className="text-yellow-800 text-sm">
          A complete profile helps creators understand your production style and ensures you receive 
          submissions that match your interests and capabilities.
        </p>
      </div>

      <div className="flex gap-4">
        <Button 
          className="flex-1" 
          onClick={() => {
            navigate('/production/settings/profile');
            onComplete();
          }}
        >
          Set Up Company Profile
        </Button>
        <Button variant="outline" onClick={onSkip}>
          Skip for Now
        </Button>
      </div>
    </Card>
  );
};

const SubmissionProcessStep: React.FC<{
  onComplete: () => void;
  onSkip: () => void;
  onStartTour: () => void;
}> = ({ onComplete, onSkip, onStartTour }) => {
  const navigate = useNavigate();

  return (
    <Card className="p-6">
      <div className="text-center mb-6">
        <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <span className="text-2xl">📥</span>
        </div>
        <h3 className="text-xl font-semibold mb-2">Master Submission Management</h3>
        <p className="text-gray-600">
          Learn how to efficiently review and organize the movie pitches submitted to your company.
        </p>
      </div>

      <div className="space-y-4 mb-6">
        <div className="p-4 border border-purple-200 rounded-lg">
          <h4 className="font-semibold mb-2 flex items-center">
            <span className="w-6 h-6 bg-purple-500 text-white rounded-full flex items-center justify-center text-sm mr-2">1</span>
            Submission Inbox
          </h4>
          <p className="text-sm text-gray-600 ml-8">
            All new submissions appear in your inbox with key details and filtering options.
          </p>
        </div>
        
        <div className="p-4 border border-purple-200 rounded-lg">
          <h4 className="font-semibold mb-2 flex items-center">
            <span className="w-6 h-6 bg-purple-500 text-white rounded-full flex items-center justify-center text-sm mr-2">2</span>
            Review Workflow
          </h4>
          <p className="text-sm text-gray-600 ml-8">
            Move projects through custom stages: New → Review → Shortlisted → Accepted/Rejected.
          </p>
        </div>
        
        <div className="p-4 border border-purple-200 rounded-lg">
          <h4 className="font-semibold mb-2 flex items-center">
            <span className="w-6 h-6 bg-purple-500 text-white rounded-full flex items-center justify-center text-sm mr-2">3</span>
            Team Collaboration
          </h4>
          <p className="text-sm text-gray-600 ml-8">
            Share feedback with your team and track decision-making progress.
          </p>
        </div>
      </div>

      <div className="flex gap-4">
        <Button 
          className="flex-1" 
          onClick={() => {
            navigate(PRODUCTION_ROUTES.submissions);
            onComplete();
          }}
        >
          View Submissions
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

const CollaborationToolsStep: React.FC<{
  onComplete: () => void;
  onSkip: () => void;
}> = ({ onComplete, onSkip }) => {
  return (
    <Card className="p-6">
      <div className="text-center mb-6">
        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <span className="text-2xl">🤝</span>
        </div>
        <h3 className="text-xl font-semibold mb-2">Collaboration Made Easy</h3>
        <p className="text-gray-600">
          Discover tools to work effectively with creators, investors, and your internal team.
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-6 mb-6">
        <div>
          <h4 className="font-semibold mb-3">With Creators:</h4>
          <ul className="space-y-2 text-sm text-gray-600">
            <li className="flex items-start">
              <span className="text-green-500 mr-2">✓</span>
              Direct messaging and feedback
            </li>
            <li className="flex items-start">
              <span className="text-green-500 mr-2">✓</span>
              Contract and NDA management
            </li>
            <li className="flex items-start">
              <span className="text-green-500 mr-2">✓</span>
              Development milestone tracking
            </li>
            <li className="flex items-start">
              <span className="text-green-500 mr-2">✓</span>
              Collaborative script development
            </li>
          </ul>
        </div>
        
        <div>
          <h4 className="font-semibold mb-3">With Your Team:</h4>
          <ul className="space-y-2 text-sm text-gray-600">
            <li className="flex items-start">
              <span className="text-blue-500 mr-2">→</span>
              Internal notes and reviews
            </li>
            <li className="flex items-start">
              <span className="text-blue-500 mr-2">→</span>
              Role-based access control
            </li>
            <li className="flex items-start">
              <span className="text-blue-500 mr-2">→</span>
              Decision tracking workflows
            </li>
            <li className="flex items-start">
              <span className="text-blue-500 mr-2">→</span>
              Project status updates
            </li>
          </ul>
        </div>
      </div>

      <div className="p-4 bg-gray-50 rounded-lg mb-6">
        <h4 className="font-semibold mb-2">Key Benefits</h4>
        <p className="text-sm text-gray-600">
          Streamlined communication reduces email clutter, keeps all project information centralized, 
          and ensures everyone stays aligned on project progress and decisions.
        </p>
      </div>

      <div className="flex gap-4">
        <Button className="flex-1" onClick={onComplete}>
          Got It!
        </Button>
        <Button variant="outline" onClick={onSkip}>
          Skip This Step
        </Button>
      </div>
    </Card>
  );
};

const PipelineManagementStep: React.FC<{
  onComplete: () => void;
  onSkip: () => void;
  onStartTour: () => void;
}> = ({ onComplete, onSkip, onStartTour }) => {
  const navigate = useNavigate();

  return (
    <Card className="p-6">
      <div className="text-center mb-6">
        <div className="w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <span className="text-2xl">⚡</span>
        </div>
        <h3 className="text-xl font-semibold mb-2">Optimize Your Production Pipeline</h3>
        <p className="text-gray-600">
          Learn to manage your entire production pipeline from development to distribution.
        </p>
      </div>

      <div className="space-y-4 mb-6">
        <div className="p-4 bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg border">
          <h4 className="font-semibold mb-2 text-blue-900">Development Stage</h4>
          <p className="text-sm text-blue-800">
            Script development, budget planning, talent attachment, and financing.
          </p>
        </div>
        
        <div className="p-4 bg-gradient-to-r from-purple-50 to-pink-50 rounded-lg border">
          <h4 className="font-semibold mb-2 text-purple-900">Pre-Production</h4>
          <p className="text-sm text-purple-800">
            Casting, location scouting, crew hiring, and production scheduling.
          </p>
        </div>
        
        <div className="p-4 bg-gradient-to-r from-pink-50 to-red-50 rounded-lg border">
          <h4 className="font-semibold mb-2 text-pink-900">Production</h4>
          <p className="text-sm text-pink-800">
            Principal photography, daily rushes, and production management.
          </p>
        </div>
        
        <div className="p-4 bg-gradient-to-r from-red-50 to-orange-50 rounded-lg border">
          <h4 className="font-semibold mb-2 text-red-900">Post-Production</h4>
          <p className="text-sm text-red-800">
            Editing, VFX, sound design, color grading, and final delivery.
          </p>
        </div>
      </div>

      <div className="flex gap-4">
        <Button className="flex-1" onClick={onStartTour}>
          Take Pipeline Tour
        </Button>
        <Button 
          variant="outline" 
          onClick={() => {
            navigate(PRODUCTION_ROUTES.pipeline);
            onComplete();
          }}
        >
          Explore Pipeline
        </Button>
        <Button variant="ghost" onClick={onSkip}>
          Skip Tour
        </Button>
      </div>
    </Card>
  );
};