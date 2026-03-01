import React from 'react';
import { useOnboardingStore } from '../../store/onboardingStore';
import { Card } from '@shared/components/ui/card';
import { Progress } from '@shared/components/ui/progress';
import { Badge } from '@shared/components/ui/badge';
import { Button } from '@shared/components/ui/button';

interface OnboardingProgressProps {
  showDetails?: boolean;
  compact?: boolean;
  className?: string;
}

export const OnboardingProgress: React.FC<OnboardingProgressProps> = ({
  showDetails = false,
  compact = false,
  className = ''
}) => {
  const {
    currentFlow,
    isOnboardingActive,
    completeOnboarding,
    skipOnboarding
  } = useOnboardingStore();

  if (!currentFlow || !isOnboardingActive) return null;

  const completedSteps = currentFlow.steps.filter(step => step.completed).length;
  const totalSteps = currentFlow.steps.length;
  const progress = (completedSteps / totalSteps) * 100;
  const currentStep = currentFlow.steps[currentFlow.currentStepIndex];

  if (compact) {
    return (
      <div className={`flex items-center space-x-3 p-3 bg-blue-50 rounded-lg ${className}`}>
        <div className="flex-1">
          <div className="flex items-center justify-between mb-1">
            <span className="text-sm font-medium text-blue-900">
              Onboarding Progress
            </span>
            <span className="text-sm text-blue-700">
              {completedSteps}/{totalSteps}
            </span>
          </div>
          <Progress value={progress} className="h-2" />
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={skipOnboarding}
          className="text-blue-600 border-blue-300 hover:bg-blue-100"
        >
          Skip
        </Button>
      </div>
    );
  }

  return (
    <Card className={`p-6 ${className}`}>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">
            {currentFlow.name}
          </h3>
          <p className="text-sm text-gray-600">
            Step {currentFlow.currentStepIndex + 1} of {totalSteps}
          </p>
        </div>
        
        <div className="text-right">
          <div className="text-sm font-medium text-gray-700">
            {Math.round(progress)}% Complete
          </div>
          <div className="text-xs text-gray-500">
            {currentStep?.estimatedTime && `~${currentStep.estimatedTime} min`}
          </div>
        </div>
      </div>

      <Progress value={progress} className="h-3 mb-4" />

      {showDetails && (
        <div className="space-y-3">
          {currentFlow.steps.map((step, index) => (
            <div
              key={step.id}
              className={`flex items-center justify-between p-3 rounded-lg ${
                index === currentFlow.currentStepIndex
                  ? 'bg-blue-50 border border-blue-200'
                  : step.completed
                  ? 'bg-green-50 border border-green-200'
                  : 'bg-gray-50 border border-gray-200'
              }`}
            >
              <div className="flex items-center space-x-3">
                <div
                  className={`w-6 h-6 rounded-full flex items-center justify-center text-sm font-medium ${
                    step.completed
                      ? 'bg-green-500 text-white'
                      : index === currentFlow.currentStepIndex
                      ? 'bg-blue-500 text-white'
                      : 'bg-gray-300 text-gray-600'
                  }`}
                >
                  {step.completed ? '✓' : index + 1}
                </div>
                
                <div>
                  <h4 className="font-medium text-gray-900">
                    {step.title}
                  </h4>
                  <p className="text-sm text-gray-600">
                    {step.description}
                  </p>
                </div>
              </div>

              <div className="flex items-center space-x-2">
                {step.required && (
                  <Badge variant="secondary" className="text-xs">
                    Required
                  </Badge>
                )}
                
                {step.estimatedTime && (
                  <span className="text-xs text-gray-500">
                    {step.estimatedTime}m
                  </span>
                )}
                
                {step.completed && (
                  <span className="text-xs text-green-600 font-medium">
                    Done
                  </span>
                )}
                
                {step.skipped && (
                  <span className="text-xs text-yellow-600 font-medium">
                    Skipped
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="flex justify-between items-center mt-6 pt-4 border-t">
        <Button
          variant="outline"
          onClick={skipOnboarding}
          className="text-gray-600"
        >
          Skip Onboarding
        </Button>
        
        {completedSteps === totalSteps && (
          <Button
            onClick={completeOnboarding}
            className="bg-green-600 hover:bg-green-700"
          >
            Complete Onboarding
          </Button>
        )}
      </div>
    </Card>
  );
};