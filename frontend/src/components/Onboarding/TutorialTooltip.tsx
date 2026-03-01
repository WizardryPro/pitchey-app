import React, { useEffect, useRef, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useOnboardingStore } from '../../store/onboardingStore';
import { Button } from '@shared/components/ui/button';
import { Card } from '@shared/components/ui/card';
import { Progress } from '@shared/components/ui/progress';

interface TutorialTooltipProps {
  target: string;
  title: string;
  content: string;
  placement?: 'top' | 'bottom' | 'left' | 'right' | 'center';
  onNext?: () => void;
  onPrevious?: () => void;
  onSkip?: () => void;
  onComplete?: () => void;
  isFirst?: boolean;
  isLast?: boolean;
  stepNumber?: number;
  totalSteps?: number;
  highlightPadding?: number;
  customActions?: React.ReactNode;
  disableInteraction?: boolean;
}

export const TutorialTooltip: React.FC<TutorialTooltipProps> = ({
  target,
  title,
  content,
  placement = 'bottom',
  onNext,
  onPrevious,
  onSkip,
  onComplete,
  isFirst = false,
  isLast = false,
  stepNumber = 1,
  totalSteps = 1,
  highlightPadding = 8,
  customActions,
  disableInteraction = false
}) => {
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const [visible, setVisible] = useState(false);
  const [targetElement, setTargetElement] = useState<HTMLElement | null>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const _overlayRef = useRef<HTMLDivElement>(null);
  const { preferences } = useOnboardingStore();

  // Calculate tooltip position based on target element
  const calculatePosition = useCallback(() => {
    if (!targetElement || !tooltipRef.current) return;

    const targetRect = targetElement.getBoundingClientRect();
    const tooltipRect = tooltipRef.current.getBoundingClientRect();
    const viewport = {
      width: window.innerWidth,
      height: window.innerHeight
    };

    let newPosition = { top: 0, left: 0 };

    switch (placement) {
      case 'top':
        newPosition = {
          top: targetRect.top - tooltipRect.height - 16,
          left: targetRect.left + (targetRect.width / 2) - (tooltipRect.width / 2)
        };
        break;
      case 'bottom':
        newPosition = {
          top: targetRect.bottom + 16,
          left: targetRect.left + (targetRect.width / 2) - (tooltipRect.width / 2)
        };
        break;
      case 'left':
        newPosition = {
          top: targetRect.top + (targetRect.height / 2) - (tooltipRect.height / 2),
          left: targetRect.left - tooltipRect.width - 16
        };
        break;
      case 'right':
        newPosition = {
          top: targetRect.top + (targetRect.height / 2) - (tooltipRect.height / 2),
          left: targetRect.right + 16
        };
        break;
      case 'center':
        newPosition = {
          top: (viewport.height / 2) - (tooltipRect.height / 2),
          left: (viewport.width / 2) - (tooltipRect.width / 2)
        };
        break;
    }

    // Adjust for viewport boundaries
    newPosition.left = Math.max(16, Math.min(newPosition.left, viewport.width - tooltipRect.width - 16));
    newPosition.top = Math.max(16, Math.min(newPosition.top, viewport.height - tooltipRect.height - 16));

    setPosition(newPosition);
  }, [targetElement, placement]);

  // Find target element and set up observers
  useEffect(() => {
    const findTarget = () => {
      const element = document.querySelector(target) as HTMLElement;
      if (element) {
        setTargetElement(element);
        setVisible(true);
      } else {
        // If element not found, try again after a short delay
        setTimeout(findTarget, 100);
      }
    };

    findTarget();

    // Set up resize observer for responsive positioning
    const resizeObserver = new ResizeObserver(calculatePosition);
    if (targetElement) {
      resizeObserver.observe(targetElement);
    }
    
    // Set up mutation observer for DOM changes
    const mutationObserver = new MutationObserver(() => {
      if (!document.querySelector(target)) {
        setVisible(false);
      }
    });
    
    mutationObserver.observe(document.body, {
      childList: true,
      subtree: true
    });

    window.addEventListener('resize', calculatePosition);
    window.addEventListener('scroll', calculatePosition);

    return () => {
      resizeObserver.disconnect();
      mutationObserver.disconnect();
      window.removeEventListener('resize', calculatePosition);
      window.removeEventListener('scroll', calculatePosition);
    };
  }, [target, targetElement, calculatePosition]);

  // Calculate position when tooltip becomes visible
  useEffect(() => {
    if (visible && targetElement) {
      const timer = setTimeout(calculatePosition, 50);
      return () => clearTimeout(timer);
    }
  }, [visible, targetElement, calculatePosition]);

  // Create highlight overlay
  const createHighlightOverlay = () => {
    if (!targetElement) return null;

    const targetRect = targetElement.getBoundingClientRect();
    const scrollX = window.pageXOffset;
    const scrollY = window.pageYOffset;

    const highlightStyle = {
      position: 'absolute' as const,
      top: targetRect.top + scrollY - highlightPadding,
      left: targetRect.left + scrollX - highlightPadding,
      width: targetRect.width + (highlightPadding * 2),
      height: targetRect.height + (highlightPadding * 2),
      border: '2px solid #3b82f6',
      borderRadius: '8px',
      backgroundColor: 'rgba(59, 130, 246, 0.1)',
      pointerEvents: 'none' as const,
      zIndex: 9997,
      transition: preferences.skipAnimations ? 'none' : 'all 0.3s ease-in-out',
      boxShadow: '0 0 0 4px rgba(59, 130, 246, 0.2)'
    };

    return <div style={highlightStyle} />;
  };

  // Create backdrop overlay
  const createBackdrop = () => {
    if (!targetElement || disableInteraction) return null;

    const targetRect = targetElement.getBoundingClientRect();
    const scrollX = window.pageXOffset;
    const scrollY = window.pageYOffset;

    const backdropStyle = {
      position: 'fixed' as const,
      top: 0,
      left: 0,
      width: '100vw',
      height: '100vh',
      backgroundColor: 'rgba(0, 0, 0, 0.7)',
      zIndex: 9996,
      transition: preferences.skipAnimations ? 'none' : 'opacity 0.3s ease-in-out'
    };

    const cutoutStyle = {
      position: 'absolute' as const,
      top: targetRect.top + scrollY - highlightPadding,
      left: targetRect.left + scrollX - highlightPadding,
      width: targetRect.width + (highlightPadding * 2),
      height: targetRect.height + (highlightPadding * 2),
      borderRadius: '8px',
      backgroundColor: 'transparent',
      border: `${Math.max(window.innerWidth, window.innerHeight)}px solid rgba(0, 0, 0, 0.7)`
    };

    return (
      <div style={backdropStyle}>
        <div style={cutoutStyle} />
      </div>
    );
  };

  // Handle keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!visible) return;

      switch (e.key) {
        case 'Escape':
          onSkip?.();
          break;
        case 'ArrowLeft':
          if (!isFirst) onPrevious?.();
          break;
        case 'ArrowRight':
          if (isLast) onComplete?.();
          else onNext?.();
          break;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [visible, isFirst, isLast, onNext, onPrevious, onSkip, onComplete]);

  if (!visible || !targetElement) return null;

  const progress = (stepNumber / totalSteps) * 100;

  const tooltipContent = (
    <>
      {/* Backdrop */}
      {createBackdrop()}
      
      {/* Highlight */}
      {createHighlightOverlay()}
      
      {/* Tooltip */}
      <Card
        ref={tooltipRef}
        className="absolute z-[9998] w-80 max-w-sm p-4 bg-white dark:bg-gray-900 shadow-2xl border-2 border-blue-500"
        style={{
          top: position.top,
          left: position.left,
          transform: preferences.skipAnimations ? 'none' : 'scale(1)',
          animation: preferences.skipAnimations ? 'none' : 'tutorialTooltipEnter 0.3s ease-out'
        }}
      >
        {/* Progress Indicator */}
        <div className="mb-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
              Step {stepNumber} of {totalSteps}
            </span>
            <span className="text-sm text-blue-600 dark:text-blue-400">
              {Math.round(progress)}%
            </span>
          </div>
          <Progress value={progress} className="h-2" />
        </div>

        {/* Content */}
        <div className="mb-4">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
            {title}
          </h3>
          <p className="text-gray-700 dark:text-gray-300">
            {content}
          </p>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between">
          <div className="flex gap-2">
            {!isFirst && (
              <Button
                variant="outline"
                size="sm"
                onClick={onPrevious}
                disabled={isFirst}
              >
                Previous
              </Button>
            )}
            
            {isLast ? (
              <Button
                onClick={onComplete}
                size="sm"
                className="bg-green-600 hover:bg-green-700"
              >
                Complete
              </Button>
            ) : (
              <Button onClick={onNext} size="sm">
                Next
              </Button>
            )}
          </div>

          <div className="flex gap-2">
            {customActions}
            
            <Button
              variant="ghost"
              size="sm"
              onClick={onSkip}
              className="text-gray-500 hover:text-gray-700"
            >
              Skip Tour
            </Button>
          </div>
        </div>

        {/* Keyboard hints */}
        <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Use arrow keys to navigate • ESC to skip
          </p>
        </div>
      </Card>
    </>
  );

  return createPortal(tooltipContent, document.body);
};

// Animation styles (add to global CSS)
export const tooltipAnimationStyles = `
  @keyframes tutorialTooltipEnter {
    from {
      opacity: 0;
      transform: scale(0.8);
    }
    to {
      opacity: 1;
      transform: scale(1);
    }
  }

  .tutorial-tooltip-backdrop {
    animation: fadeIn 0.3s ease-in-out;
  }

  @keyframes fadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
  }
`;