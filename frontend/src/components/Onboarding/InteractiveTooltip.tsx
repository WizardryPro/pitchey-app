import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useOnboardingStore } from '../../store/onboardingStore';
import { Card } from '@shared/components/ui/card';
import { Button } from '@shared/components/ui/button';
import { Badge } from '@shared/components/ui/badge';

interface InteractiveTooltipProps {
  id: string;
  target: string;
  title: string;
  content: string;
  trigger?: 'hover' | 'click' | 'focus' | 'auto';
  placement?: 'top' | 'bottom' | 'left' | 'right';
  variant?: 'info' | 'tip' | 'warning' | 'feature' | 'help';
  showOnce?: boolean;
  delay?: number;
  persistent?: boolean;
  interactive?: boolean;
  maxWidth?: number;
  actions?: {
    label: string;
    action: () => void;
    variant?: 'primary' | 'secondary';
  }[];
}

export const InteractiveTooltip: React.FC<InteractiveTooltipProps> = ({
  id,
  target,
  title,
  content,
  trigger = 'hover',
  placement = 'top',
  variant = 'info',
  showOnce = false,
  delay = 500,
  persistent = false,
  interactive = true,
  maxWidth = 300,
  actions = []
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const [targetElement, setTargetElement] = useState<HTMLElement | null>(null);
  const [hasBeenShown, setHasBeenShown] = useState(false);
  
  const tooltipRef = useRef<HTMLDivElement>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const hoverTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  const {
    preferences,
    discoveredFeatures,
    markFeatureDiscovered,
    dismissFeaturePrompt,
    trackFeatureEngagement
  } = useOnboardingStore();

  // Check if tooltip should be shown
  const shouldShow = useCallback(() => {
    if (showOnce && hasBeenShown) return false;
    if (showOnce && discoveredFeatures.includes(id)) return false;
    return true;
  }, [showOnce, hasBeenShown, discoveredFeatures, id]);

  // Find target element
  useEffect(() => {
    const findTarget = () => {
      const element = document.querySelector(target) as HTMLElement;
      if (element) {
        setTargetElement(element);
      } else {
        setTimeout(findTarget, 100);
      }
    };
    findTarget();
  }, [target]);

  // Calculate position
  const calculatePosition = useCallback(() => {
    if (!targetElement || !tooltipRef.current || !isVisible) return;

    const targetRect = targetElement.getBoundingClientRect();
    const tooltipRect = tooltipRef.current.getBoundingClientRect();
    const viewport = {
      width: window.innerWidth,
      height: window.innerHeight
    };

    let newPosition = { top: 0, left: 0 };
    const offset = 12;

    switch (placement) {
      case 'top':
        newPosition = {
          top: targetRect.top - tooltipRect.height - offset,
          left: targetRect.left + (targetRect.width / 2) - (tooltipRect.width / 2)
        };
        break;
      case 'bottom':
        newPosition = {
          top: targetRect.bottom + offset,
          left: targetRect.left + (targetRect.width / 2) - (tooltipRect.width / 2)
        };
        break;
      case 'left':
        newPosition = {
          top: targetRect.top + (targetRect.height / 2) - (tooltipRect.height / 2),
          left: targetRect.left - tooltipRect.width - offset
        };
        break;
      case 'right':
        newPosition = {
          top: targetRect.top + (targetRect.height / 2) - (tooltipRect.height / 2),
          left: targetRect.right + offset
        };
        break;
    }

    // Keep within viewport
    newPosition.left = Math.max(8, Math.min(newPosition.left, viewport.width - tooltipRect.width - 8));
    newPosition.top = Math.max(8, Math.min(newPosition.top, viewport.height - tooltipRect.height - 8));

    setPosition(newPosition);
  }, [targetElement, isVisible, placement]);

  // Show tooltip
  const showTooltip = useCallback(() => {
    if (!shouldShow()) return;

    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    timeoutRef.current = setTimeout(() => {
      setIsVisible(true);
      setHasBeenShown(true);
      markFeatureDiscovered(id);
      trackFeatureEngagement(id);
    }, trigger === 'hover' ? delay : 0);
  }, [shouldShow, delay, trigger, id, markFeatureDiscovered, trackFeatureEngagement]);

  // Hide tooltip
  const hideTooltip = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    if (!persistent || !interactive) {
      setIsVisible(false);
    }
  }, [persistent, interactive]);

  // Set up event listeners
  useEffect(() => {
    if (!targetElement) return;

    const handleMouseEnter = () => {
      if (trigger === 'hover') showTooltip();
    };

    const handleMouseLeave = () => {
      if (trigger === 'hover') {
        if (hoverTimeoutRef.current) {
          clearTimeout(hoverTimeoutRef.current);
        }
        hoverTimeoutRef.current = setTimeout(hideTooltip, 100);
      }
    };

    const handleClick = () => {
      if (trigger === 'click') {
        if (isVisible) hideTooltip();
        else showTooltip();
      }
    };

    const handleFocus = () => {
      if (trigger === 'focus') showTooltip();
    };

    const handleBlur = () => {
      if (trigger === 'focus') hideTooltip();
    };

    targetElement.addEventListener('mouseenter', handleMouseEnter);
    targetElement.addEventListener('mouseleave', handleMouseLeave);
    targetElement.addEventListener('click', handleClick);
    targetElement.addEventListener('focus', handleFocus);
    targetElement.addEventListener('blur', handleBlur);

    // Auto trigger
    if (trigger === 'auto') {
      const autoTimer = setTimeout(showTooltip, 1000);
      return () => clearTimeout(autoTimer);
    }

    return () => {
      targetElement.removeEventListener('mouseenter', handleMouseEnter);
      targetElement.removeEventListener('mouseleave', handleMouseLeave);
      targetElement.removeEventListener('click', handleClick);
      targetElement.removeEventListener('focus', handleFocus);
      targetElement.removeEventListener('blur', handleBlur);
    };
  }, [targetElement, trigger, showTooltip, hideTooltip, isVisible]);

  // Position tooltip when visible
  useEffect(() => {
    if (isVisible) {
      const timer = setTimeout(calculatePosition, 50);
      return () => clearTimeout(timer);
    }
  }, [isVisible, calculatePosition]);

  // Handle tooltip hover (for interactive tooltips)
  const handleTooltipMouseEnter = () => {
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
    }
  };

  const handleTooltipMouseLeave = () => {
    if (trigger === 'hover' && !persistent) {
      hideTooltip();
    }
  };

  // Dismiss tooltip
  const handleDismiss = () => {
    setIsVisible(false);
    dismissFeaturePrompt(id);
  };

  // Cleanup
  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
    };
  }, []);

  if (!isVisible || !targetElement) return null;

  const getVariantStyles = () => {
    const base = 'relative shadow-lg border';
    const variants = {
      info: 'bg-blue-50 border-blue-200 dark:bg-blue-950 dark:border-blue-800',
      tip: 'bg-green-50 border-green-200 dark:bg-green-950 dark:border-green-800',
      warning: 'bg-yellow-50 border-yellow-200 dark:bg-yellow-950 dark:border-yellow-800',
      feature: 'bg-purple-50 border-purple-200 dark:bg-purple-950 dark:border-purple-800',
      help: 'bg-gray-50 border-gray-200 dark:bg-gray-950 dark:border-gray-800'
    };
    return `${base} ${variants[variant]}`;
  };

  const getVariantIcon = () => {
    const icons = {
      info: 'ℹ️',
      tip: '💡',
      warning: '⚠️',
      feature: '✨',
      help: '❓'
    };
    return icons[variant];
  };

  const getArrowStyles = () => {
    const arrowSize = 8;
    const offset = 16;
    
    const baseArrow = `
      position: absolute;
      width: 0;
      height: 0;
      border-style: solid;
    `;

    const variants = {
      info: 'border-blue-200',
      tip: 'border-green-200',
      warning: 'border-yellow-200',
      feature: 'border-purple-200',
      help: 'border-gray-200'
    };

    switch (placement) {
      case 'top':
        return {
          style: `${baseArrow}
            top: 100%;
            left: ${offset}px;
            border-width: ${arrowSize}px ${arrowSize}px 0 ${arrowSize}px;
            border-color: ${variants[variant]} transparent transparent transparent;`,
          className: 'tooltip-arrow-bottom'
        };
      case 'bottom':
        return {
          style: `${baseArrow}
            bottom: 100%;
            left: ${offset}px;
            border-width: 0 ${arrowSize}px ${arrowSize}px ${arrowSize}px;
            border-color: transparent transparent ${variants[variant]} transparent;`,
          className: 'tooltip-arrow-top'
        };
      case 'left':
        return {
          style: `${baseArrow}
            left: 100%;
            top: ${offset}px;
            border-width: ${arrowSize}px 0 ${arrowSize}px ${arrowSize}px;
            border-color: transparent transparent transparent ${variants[variant]};`,
          className: 'tooltip-arrow-right'
        };
      case 'right':
        return {
          style: `${baseArrow}
            right: 100%;
            top: ${offset}px;
            border-width: ${arrowSize}px ${arrowSize}px ${arrowSize}px 0;
            border-color: transparent ${variants[variant]} transparent transparent;`,
          className: 'tooltip-arrow-left'
        };
      default:
        return { style: '', className: '' };
    }
  };

  const arrow = getArrowStyles();

  const tooltipContent = (
    <Card
      ref={tooltipRef}
      className={`absolute z-[9999] ${getVariantStyles()}`}
      style={{
        top: position.top,
        left: position.left,
        maxWidth: `${maxWidth}px`,
        animation: preferences.skipAnimations ? 'none' : 'tooltipFadeIn 0.2s ease-out'
      }}
      onMouseEnter={interactive ? handleTooltipMouseEnter : undefined}
      onMouseLeave={interactive ? handleTooltipMouseLeave : undefined}
    >
      {/* Arrow */}
      <div
        className={arrow.className}
        style={arrow.style as React.CSSProperties | undefined}
      />

      <div className="p-4">
        {/* Header */}
        <div className="flex items-start justify-between mb-2">
          <div className="flex items-center space-x-2">
            <span className="text-lg">{getVariantIcon()}</span>
            <h4 className="font-semibold text-gray-900 dark:text-white">
              {title}
            </h4>
          </div>
          
          {variant === 'feature' && (
            <Badge variant="secondary" className="text-xs">
              New
            </Badge>
          )}
        </div>

        {/* Content */}
        <p className="text-sm text-gray-700 dark:text-gray-300 mb-3">
          {content}
        </p>

        {/* Actions */}
        {(actions.length > 0 || !persistent) && (
          <div className="flex items-center justify-between">
            <div className="flex gap-2">
              {actions.map((action, index) => (
                <Button
                  key={index}
                  variant={action.variant === 'primary' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => {
                    action.action();
                    trackFeatureEngagement(id);
                  }}
                >
                  {action.label}
                </Button>
              ))}
            </div>

            {!persistent && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleDismiss}
                className="text-gray-500 hover:text-gray-700"
              >
                Dismiss
              </Button>
            )}
          </div>
        )}
      </div>
    </Card>
  );

  return createPortal(tooltipContent, document.body);
};

// Animation styles
export const interactiveTooltipStyles = `
  @keyframes tooltipFadeIn {
    from {
      opacity: 0;
      transform: translateY(4px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }
`;