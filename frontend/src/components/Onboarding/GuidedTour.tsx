import React, { useEffect, useCallback, useState } from 'react';
import { useOnboardingStore, type TutorialStep } from '../../store/onboardingStore';
import { TutorialTooltip } from './TutorialTooltip';
import { Button } from '@shared/components/ui/button';
import { Card } from '@shared/components/ui/card';
import { Badge } from '@shared/components/ui/badge';
import { Progress } from '@shared/components/ui/progress';

interface GuidedTourProps {
  tourId: string;
  steps: TutorialStep[];
  onComplete?: () => void;
  onSkip?: () => void;
  autoStart?: boolean;
  allowSkip?: boolean;
  showProgress?: boolean;
  customStyles?: {
    tooltipClassName?: string;
    overlayClassName?: string;
  };
}

interface TourOverviewProps {
  tourId: string;
  steps: TutorialStep[];
  onStart: () => void;
  onSkip: () => void;
  estimatedTime?: number;
  difficulty?: 'beginner' | 'intermediate' | 'advanced';
  category?: string;
}

const TourOverview: React.FC<TourOverviewProps> = ({
  tourId,
  steps,
  onStart,
  onSkip,
  estimatedTime = 5,
  difficulty = 'beginner',
  category = 'Tutorial'
}) => {
  const difficultyColors = {
    beginner: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
    intermediate: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
    advanced: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
  };

  return (
    <Card className="w-96 mx-auto p-6 bg-white dark:bg-gray-900 shadow-xl border border-blue-200">
      <div className="text-center mb-6">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
          Ready for a Quick Tour?
        </h2>
        <p className="text-gray-600 dark:text-gray-400">
          We'll show you around the key features in just a few minutes.
        </p>
      </div>

      <div className="space-y-4 mb-6">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Category</span>
          <Badge variant="secondary">{category}</Badge>
        </div>
        
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Difficulty</span>
          <Badge className={difficultyColors[difficulty]}>
            {difficulty.charAt(0).toUpperCase() + difficulty.slice(1)}
          </Badge>
        </div>
        
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Steps</span>
          <span className="text-sm text-gray-600 dark:text-gray-400">{steps.length} steps</span>
        </div>
        
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Estimated Time</span>
          <span className="text-sm text-gray-600 dark:text-gray-400">{estimatedTime} minutes</span>
        </div>
      </div>

      <div className="mb-6">
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
          What you'll learn:
        </h3>
        <ul className="space-y-1">
          {steps.slice(0, 3).map((step, index) => (
            <li key={step.id} className="text-sm text-gray-600 dark:text-gray-400 flex items-start">
              <span className="inline-block w-4 h-4 rounded-full bg-blue-500 text-white text-xs flex items-center justify-center mr-2 mt-0.5 flex-shrink-0">
                {index + 1}
              </span>
              {step.title}
            </li>
          ))}
          {steps.length > 3 && (
            <li className="text-sm text-gray-500 dark:text-gray-400 ml-6">
              ...and {steps.length - 3} more steps
            </li>
          )}
        </ul>
      </div>

      <div className="flex gap-3">
        <Button onClick={onStart} className="flex-1" size="lg">
          Start Tour
        </Button>
        <Button variant="outline" onClick={onSkip} size="lg">
          Skip
        </Button>
      </div>

      <p className="text-xs text-center text-gray-500 dark:text-gray-400 mt-4">
        You can skip or pause the tour at any time
      </p>
    </Card>
  );
};

export const GuidedTour: React.FC<GuidedTourProps> = ({
  tourId,
  steps,
  onComplete,
  onSkip,
  autoStart = false,
  allowSkip = true,
  showProgress = true,
  customStyles
}) => {
  const {
    activeTutorial,
    currentTutorialStep,
    tutorialSteps,
    preferences,
    startTutorial,
    nextTutorialStep,
    previousTutorialStep,
    completeTutorial,
    skipTutorial
  } = useOnboardingStore();

  const [showOverview, setShowOverview] = useState(!autoStart);
  const [startTime, setStartTime] = useState<number | null>(null);

  const isActive = activeTutorial === tourId;
  const currentStep = isActive ? tutorialSteps[currentTutorialStep] : null;

  // Auto-start if enabled
  useEffect(() => {
    if (autoStart && !isActive) {
      handleStartTour();
    }
  }, [autoStart, isActive]);

  const handleStartTour = useCallback(() => {
    setShowOverview(false);
    setStartTime(Date.now());
    startTutorial(tourId, steps);
  }, [tourId, steps, startTutorial]);

  const handleNext = useCallback(() => {
    if (currentTutorialStep < tutorialSteps.length - 1) {
      nextTutorialStep();
    } else {
      handleComplete();
    }
  }, [currentTutorialStep, tutorialSteps.length, nextTutorialStep]);

  const handlePrevious = useCallback(() => {
    if (currentTutorialStep > 0) {
      previousTutorialStep();
    }
  }, [currentTutorialStep, previousTutorialStep]);

  const handleSkip = useCallback(() => {
    setShowOverview(false);
    skipTutorial();
    onSkip?.();
  }, [skipTutorial, onSkip]);

  const handleComplete = useCallback(() => {
    const endTime = Date.now();
    const duration = startTime ? (endTime - startTime) / 1000 : 0;
    
    setShowOverview(false);
    completeTutorial();
    onComplete?.();
    
    // Track completion analytics
  }, [tourId, startTime, completeTutorial, onComplete]);

  // Handle window focus to pause tour
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden && isActive) {
        // Optionally pause tour when tab becomes inactive
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [isActive]);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (isActive) {
        skipTutorial();
      }
    };
  }, []);

  // Show tour overview
  if (showOverview && !isActive) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[9999]">
        <TourOverview
          tourId={tourId}
          steps={steps}
          onStart={handleStartTour}
          onSkip={handleSkip}
          estimatedTime={Math.ceil(steps.length * 1.5)}
          difficulty={steps.length > 8 ? 'advanced' : steps.length > 5 ? 'intermediate' : 'beginner'}
          category="Platform Tour"
        />
      </div>
    );
  }

  // Tour is not active
  if (!isActive || !currentStep) {
    return null;
  }

  const isFirstStep = currentTutorialStep === 0;
  const isLastStep = currentTutorialStep === tutorialSteps.length - 1;
  const progress = ((currentTutorialStep + 1) / tutorialSteps.length) * 100;

  return (
    <>
      {/* Progress indicator (if enabled and not center placement) */}
      {showProgress && currentStep.placement !== 'center' && (
        <div className="fixed top-4 left-1/2 transform -translate-x-1/2 z-[9999]">
          <Card className="px-4 py-2 bg-white dark:bg-gray-900 shadow-lg">
            <div className="flex items-center space-x-3">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Tour Progress
              </span>
              <div className="flex-1 w-32">
                <Progress value={progress} className="h-2" />
              </div>
              <span className="text-sm text-blue-600 dark:text-blue-400">
                {currentTutorialStep + 1}/{tutorialSteps.length}
              </span>
            </div>
          </Card>
        </div>
      )}

      {/* Tutorial tooltip */}
      <TutorialTooltip
        target={currentStep.target}
        title={currentStep.title}
        content={currentStep.content}
        placement={currentStep.placement}
        onNext={handleNext}
        onPrevious={handlePrevious}
        onSkip={allowSkip ? handleSkip : undefined}
        onComplete={handleComplete}
        isFirst={isFirstStep}
        isLast={isLastStep}
        stepNumber={currentTutorialStep + 1}
        totalSteps={tutorialSteps.length}
        highlightPadding={currentStep.highlightPadding}
        customActions={
          currentStep.customComponent ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => currentStep.action?.()}
            >
              Try It
            </Button>
          ) : undefined
        }
      />

      {/* Tour controls (floating) */}
      <div className="fixed bottom-4 right-4 z-[9999]">
        <Card className="p-3 bg-white dark:bg-gray-900 shadow-lg">
          <div className="flex items-center space-x-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={handlePrevious}
              disabled={isFirstStep}
            >
              ←
            </Button>
            
            <span className="text-sm text-gray-600 dark:text-gray-400 px-2">
              {currentTutorialStep + 1} / {tutorialSteps.length}
            </span>
            
            <Button
              variant="ghost"
              size="sm"
              onClick={handleNext}
            >
              {isLastStep ? '✓' : '→'}
            </Button>
            
            {allowSkip && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleSkip}
                className="ml-2 text-gray-500"
              >
                Skip
              </Button>
            )}
          </div>
        </Card>
      </div>

      {/* Backdrop for better focus */}
      <div 
        className={`fixed inset-0 bg-black bg-opacity-30 z-[9995] ${
          preferences.skipAnimations ? '' : 'transition-opacity duration-300'
        }`}
        onClick={() => {
          // Allow clicking outside to continue (for accessibility)
          if (!currentStep.optional) return;
          handleNext();
        }}
      />
    </>
  );
};

// Hook for easy tour management
export const useTour = () => {
  const {
    activeTutorial,
    currentTutorialStep,
    tutorialSteps,
    startTutorial,
    completeTutorial,
    skipTutorial,
    nextTutorialStep,
    previousTutorialStep
  } = useOnboardingStore();

  const startTour = useCallback((tourId: string, steps: TutorialStep[]) => {
    startTutorial(tourId, steps);
  }, [startTutorial]);

  const completeTour = useCallback(() => {
    completeTutorial();
  }, [completeTutorial]);

  const skipTour = useCallback(() => {
    skipTutorial();
  }, [skipTutorial]);

  return {
    activeTutorial,
    currentStep: tutorialSteps[currentTutorialStep],
    currentStepIndex: currentTutorialStep,
    totalSteps: tutorialSteps.length,
    isActive: !!activeTutorial,
    startTour,
    completeTour,
    skipTour,
    nextStep: nextTutorialStep,
    previousStep: previousTutorialStep
  };
};