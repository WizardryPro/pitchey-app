/**
 * Real-Time Pitch Validation Component
 * Provides instant feedback as users type and edit their pitch
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  CheckCircle, AlertTriangle, Info, Lightbulb,
  Target, TrendingUp, Clock, Zap, Eye,
  BarChart3, DollarSign, Users, BookOpen
} from 'lucide-react';

// Inline debounce function to avoid lodash import issues
function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): ((...args: Parameters<T>) => void) & { cancel: () => void } {
  let timeout: NodeJS.Timeout | null = null;
  const debounced = function(this: any, ...args: Parameters<T>) {
    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(() => func.apply(this, args), wait);
  };
  debounced.cancel = function() {
    if (timeout) clearTimeout(timeout);
  };
  return debounced as any;
}

import type { RealTimeValidation } from '@shared/types/pitch-validation.types';

interface RealTimeValidatorProps {
  pitchId: string;
  field: string;
  value: string;
  placeholder?: string;
  label?: string;
  fieldType?: 'title' | 'logline' | 'synopsis' | 'budget' | 'genre' | 'text';
  showDetailedFeedback?: boolean;
  onScoreChange?: (score: number) => void;
  className?: string;
}

export const RealTimeValidator: React.FC<RealTimeValidatorProps> = ({
  pitchId,
  field,
  value,
  placeholder,
  label,
  fieldType = 'text',
  showDetailedFeedback = true,
  onScoreChange,
  className = ''
}) => {
  const [validation, setValidation] = useState<RealTimeValidation | null>(null);
  const [isValidating, setIsValidating] = useState(false);
  const [showFeedback, setShowFeedback] = useState(false);
  const validateTimeoutRef = useRef<NodeJS.Timeout>();

  // Debounced validation function
  const debouncedValidate = useCallback(
    debounce(async (content: string) => {
      if (!content.trim()) {
        setValidation(null);
        setIsValidating(false);
        return;
      }

      setIsValidating(true);
      
      try {
        const response = await fetch('/api/validation/realtime', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            pitchId,
            field,
            content
          })
        });

        if (response.ok) {
          const result = await response.json();
          if (result.success) {
            setValidation(result.data);
            setShowFeedback(true);
            onScoreChange?.(result.data.quickScore);
          }
        }
      } catch (error) {
        console.error('Real-time validation failed:', error);
      } finally {
        setIsValidating(false);
      }
    }, 500),
    [pitchId, field, onScoreChange]
  );

  useEffect(() => {
    if (value) {
      debouncedValidate(value);
    } else {
      setValidation(null);
      setShowFeedback(false);
    }

    return () => {
      debouncedValidate.cancel();
    };
  }, [value, debouncedValidate]);

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-600';
    if (score >= 60) return 'text-yellow-600';
    if (score >= 40) return 'text-orange-600';
    return 'text-red-600';
  };

  const getScoreBgColor = (score: number) => {
    if (score >= 80) return 'bg-green-50 border-green-200';
    if (score >= 60) return 'bg-yellow-50 border-yellow-200';
    if (score >= 40) return 'bg-orange-50 border-orange-200';
    return 'bg-red-50 border-red-200';
  };

  const getFieldIcon = () => {
    switch (fieldType) {
      case 'title': return BookOpen;
      case 'logline': return Target;
      case 'synopsis': return Eye;
      case 'budget': return DollarSign;
      case 'genre': return BarChart3;
      default: return Info;
    }
  };

  const renderFieldSpecificMetrics = () => {
    if (!validation || !value) return null;

    const wordCount = value.split(/\s+/).filter(word => word.length > 0).length;
    const charCount = value.length;

    switch (fieldType) {
      case 'title':
        return <TitleMetrics value={value} validation={validation} />;
      case 'logline':
        return <LoglineMetrics value={value} validation={validation} wordCount={wordCount} />;
      case 'synopsis':
        return <SynopsisMetrics value={value} validation={validation} wordCount={wordCount} />;
      case 'budget':
        return <BudgetMetrics value={value} validation={validation} />;
      default:
        return (
          <div className="text-xs text-gray-500">
            {wordCount} words • {charCount} characters
          </div>
        );
    }
  };

  const FieldIcon = getFieldIcon();

  return (
    <div className={`real-time-validator ${className}`}>
      {/* Validation Score Badge */}
      {validation && showFeedback && (
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center space-x-2">
            <FieldIcon className="w-4 h-4 text-gray-500" />
            {label && (
              <span className="text-sm font-medium text-gray-700">{label}</span>
            )}
          </div>
          
          <div className="flex items-center space-x-2">
            {isValidating && (
              <div className="w-4 h-4 border-2 border-blue-300 border-t-blue-600 rounded-full animate-spin" />
            )}
            
            <div className={`
              px-2 py-1 rounded-full text-xs font-semibold border
              ${getScoreBgColor(validation.quickScore)}
            `}>
              <span className={getScoreColor(validation.quickScore)}>
                {validation.quickScore}/100
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Field-Specific Metrics */}
      {validation && showFeedback && (
        <div className="mb-3">
          {renderFieldSpecificMetrics()}
        </div>
      )}

      {/* Feedback Panel */}
      {validation && showFeedback && showDetailedFeedback && (
        <ValidationFeedbackPanel validation={validation} fieldType={fieldType} />
      )}
    </div>
  );
};

// Field-specific metric components
const TitleMetrics: React.FC<{ value: string; validation: RealTimeValidation }> = ({ value, validation }) => {
  const wordCount = value.split(/\s+/).filter(word => word.length > 0).length;
  const charCount = value.length;
  
  const getWordCountStatus = (count: number) => {
    if (count >= 1 && count <= 3) return { color: 'text-green-600', status: 'Optimal' };
    if (count >= 4 && count <= 5) return { color: 'text-yellow-600', status: 'Good' };
    return { color: 'text-red-600', status: 'Too long' };
  };

  const getLengthStatus = (length: number) => {
    if (length >= 8 && length <= 15) return { color: 'text-green-600', status: 'Perfect' };
    if (length >= 5 && length <= 20) return { color: 'text-yellow-600', status: 'Good' };
    return { color: 'text-red-600', status: 'Adjust' };
  };

  const wordStatus = getWordCountStatus(wordCount);
  const lengthStatus = getLengthStatus(charCount);

  return (
    <div className="grid grid-cols-2 gap-4 text-xs">
      <div className="flex items-center justify-between">
        <span className="text-gray-600">Words:</span>
        <span className={`font-medium ${wordStatus.color}`}>
          {wordCount} ({wordStatus.status})
        </span>
      </div>
      <div className="flex items-center justify-between">
        <span className="text-gray-600">Length:</span>
        <span className={`font-medium ${lengthStatus.color}`}>
          {charCount} ({lengthStatus.status})
        </span>
      </div>
    </div>
  );
};

const LoglineMetrics: React.FC<{ 
  value: string; 
  validation: RealTimeValidation; 
  wordCount: number;
}> = ({ value, validation, wordCount }) => {
  const hasProtagonist = /\b(a|an|the)\s+\w+/.test(value.toLowerCase());
  const hasConflict = /(must|fights|struggles|battles|faces|confronts)/.test(value.toLowerCase());
  const hasStakes = /(or|before|to save|to stop|to prevent)/.test(value.toLowerCase());

  const getWordCountStatus = (count: number) => {
    if (count >= 25 && count <= 50) return { color: 'text-green-600', status: 'Perfect' };
    if (count >= 15 && count <= 60) return { color: 'text-yellow-600', status: 'Good' };
    return { color: 'text-red-600', status: 'Adjust' };
  };

  const wordStatus = getWordCountStatus(wordCount);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-xs">
        <span className="text-gray-600">Word Count:</span>
        <span className={`font-medium ${wordStatus.color}`}>
          {wordCount} ({wordStatus.status})
        </span>
      </div>
      
      <div className="grid grid-cols-3 gap-2 text-xs">
        <div className="flex items-center space-x-1">
          {hasProtagonist ? (
            <CheckCircle className="w-3 h-3 text-green-500" />
          ) : (
            <AlertTriangle className="w-3 h-3 text-red-500" />
          )}
          <span className={hasProtagonist ? 'text-green-600' : 'text-red-600'}>
            Protagonist
          </span>
        </div>
        
        <div className="flex items-center space-x-1">
          {hasConflict ? (
            <CheckCircle className="w-3 h-3 text-green-500" />
          ) : (
            <AlertTriangle className="w-3 h-3 text-red-500" />
          )}
          <span className={hasConflict ? 'text-green-600' : 'text-red-600'}>
            Conflict
          </span>
        </div>
        
        <div className="flex items-center space-x-1">
          {hasStakes ? (
            <CheckCircle className="w-3 h-3 text-green-500" />
          ) : (
            <AlertTriangle className="w-3 h-3 text-red-500" />
          )}
          <span className={hasStakes ? 'text-green-600' : 'text-red-600'}>
            Stakes
          </span>
        </div>
      </div>
    </div>
  );
};

const SynopsisMetrics: React.FC<{ 
  value: string; 
  validation: RealTimeValidation; 
  wordCount: number;
}> = ({ value, validation, wordCount }) => {
  const sentences = value.split(/[.!?]+/).filter(s => s.trim().length > 0).length;
  const avgSentenceLength = sentences > 0 ? Math.round(wordCount / sentences) : 0;
  const hasThreeActs = /begins|starts|opens/.test(value.toLowerCase()) && 
                     /however|but|when|then/.test(value.toLowerCase()) && 
                     /finally|ultimately|in the end/.test(value.toLowerCase());

  const getWordCountStatus = (count: number) => {
    if (count >= 150 && count <= 500) return { color: 'text-green-600', status: 'Ideal' };
    if (count >= 100 && count <= 600) return { color: 'text-yellow-600', status: 'Good' };
    return { color: 'text-red-600', status: 'Adjust' };
  };

  const getSentenceLengthStatus = (avg: number) => {
    if (avg >= 10 && avg <= 25) return { color: 'text-green-600', status: 'Good' };
    if (avg >= 8 && avg <= 30) return { color: 'text-yellow-600', status: 'OK' };
    return { color: 'text-red-600', status: 'Review' };
  };

  const wordStatus = getWordCountStatus(wordCount);
  const sentenceStatus = getSentenceLengthStatus(avgSentenceLength);

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 gap-4 text-xs">
        <div className="flex items-center justify-between">
          <span className="text-gray-600">Words:</span>
          <span className={`font-medium ${wordStatus.color}`}>
            {wordCount} ({wordStatus.status})
          </span>
        </div>
        
        <div className="flex items-center justify-between">
          <span className="text-gray-600">Sentences:</span>
          <span className="font-medium text-gray-700">{sentences}</span>
        </div>
      </div>
      
      <div className="grid grid-cols-2 gap-4 text-xs">
        <div className="flex items-center justify-between">
          <span className="text-gray-600">Avg length:</span>
          <span className={`font-medium ${sentenceStatus.color}`}>
            {avgSentenceLength} ({sentenceStatus.status})
          </span>
        </div>
        
        <div className="flex items-center space-x-1">
          {hasThreeActs ? (
            <CheckCircle className="w-3 h-3 text-green-500" />
          ) : (
            <AlertTriangle className="w-3 h-3 text-yellow-500" />
          )}
          <span className={hasThreeActs ? 'text-green-600' : 'text-yellow-600'}>
            Three-act structure
          </span>
        </div>
      </div>
    </div>
  );
};

const BudgetMetrics: React.FC<{ value: string; validation: RealTimeValidation }> = ({ value, validation }) => {
  const budgetValue = parseFloat(value.replace(/[,$]/g, ''));
  const formattedBudget = isNaN(budgetValue) ? 'Invalid' : `$${(budgetValue / 1000000).toFixed(1)}M`;
  
  const getBudgetCategory = (budget: number) => {
    if (budget < 1000000) return { category: 'Micro', color: 'text-blue-600' };
    if (budget < 5000000) return { category: 'Low', color: 'text-green-600' };
    if (budget < 25000000) return { category: 'Medium', color: 'text-yellow-600' };
    if (budget < 100000000) return { category: 'High', color: 'text-orange-600' };
    return { category: 'Blockbuster', color: 'text-red-600' };
  };

  const budgetCategory = isNaN(budgetValue) 
    ? { category: 'Invalid', color: 'text-red-600' }
    : getBudgetCategory(budgetValue);

  return (
    <div className="grid grid-cols-2 gap-4 text-xs">
      <div className="flex items-center justify-between">
        <span className="text-gray-600">Amount:</span>
        <span className="font-medium text-gray-700">{formattedBudget}</span>
      </div>
      
      <div className="flex items-center justify-between">
        <span className="text-gray-600">Category:</span>
        <span className={`font-medium ${budgetCategory.color}`}>
          {budgetCategory.category}
        </span>
      </div>
    </div>
  );
};

// Main feedback panel component
const ValidationFeedbackPanel: React.FC<{ 
  validation: RealTimeValidation; 
  fieldType: string; 
}> = ({ validation, fieldType }) => {
  const [activeTab, setActiveTab] = useState<'suggestions' | 'warnings'>('suggestions');

  if (!validation.suggestions.length && !validation.warnings.length) {
    return null;
  }

  return (
    <div className="mt-3 bg-white border border-gray-200 rounded-lg overflow-hidden">
      {/* Tab Headers */}
      <div className="flex border-b border-gray-200">
        {validation.suggestions.length > 0 && (
          <button
            onClick={() => setActiveTab('suggestions')}
            className={`
              flex items-center space-x-2 px-3 py-2 text-sm font-medium transition-colors
              ${activeTab === 'suggestions'
                ? 'bg-blue-50 text-blue-700 border-b-2 border-blue-500'
                : 'text-gray-600 hover:text-gray-800'
              }
            `}
          >
            <Lightbulb className="w-4 h-4" />
            <span>Suggestions ({validation.suggestions.length})</span>
          </button>
        )}
        
        {validation.warnings.length > 0 && (
          <button
            onClick={() => setActiveTab('warnings')}
            className={`
              flex items-center space-x-2 px-3 py-2 text-sm font-medium transition-colors
              ${activeTab === 'warnings'
                ? 'bg-yellow-50 text-yellow-700 border-b-2 border-yellow-500'
                : 'text-gray-600 hover:text-gray-800'
              }
            `}
          >
            <AlertTriangle className="w-4 h-4" />
            <span>Warnings ({validation.warnings.length})</span>
          </button>
        )}
      </div>

      {/* Tab Content */}
      <div className="p-3">
        {activeTab === 'suggestions' && validation.suggestions.length > 0 && (
          <div className="space-y-2">
            {validation.suggestions.map((suggestion, index) => (
              <div key={index} className="flex items-start space-x-2 text-sm">
                <Lightbulb className="w-4 h-4 text-blue-500 mt-0.5 flex-shrink-0" />
                <span className="text-gray-700">{suggestion}</span>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'warnings' && validation.warnings.length > 0 && (
          <div className="space-y-2">
            {validation.warnings.map((warning, index) => (
              <div key={index} className="flex items-start space-x-2 text-sm">
                <AlertTriangle className="w-4 h-4 text-yellow-500 mt-0.5 flex-shrink-0" />
                <span className="text-gray-700">{warning}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Quick Action Buttons */}
      <div className="border-t border-gray-100 px-3 py-2 bg-gray-50">
        <div className="flex items-center justify-between">
          <div className="text-xs text-gray-500">
            Last updated: {new Date(validation.timestamp).toLocaleTimeString()}
          </div>
          
          <div className="flex items-center space-x-2">
            <QuickActionButtons fieldType={fieldType} validation={validation} />
          </div>
        </div>
      </div>
    </div>
  );
};

// Quick action buttons for different field types
const QuickActionButtons: React.FC<{ 
  fieldType: string; 
  validation: RealTimeValidation; 
}> = ({ fieldType, validation }) => {
  const handleQuickAction = (action: string) => {
    // Implement quick actions like "Show Examples", "Get Help", etc.
  };

  const getQuickActions = () => {
    switch (fieldType) {
      case 'title':
        return [
          { label: 'Examples', action: 'show_title_examples' },
          { label: 'Generator', action: 'title_generator' }
        ];
      case 'logline':
        return [
          { label: 'Templates', action: 'show_logline_templates' },
          { label: 'Guide', action: 'logline_guide' }
        ];
      case 'synopsis':
        return [
          { label: 'Structure', action: 'structure_guide' },
          { label: 'Examples', action: 'synopsis_examples' }
        ];
      case 'budget':
        return [
          { label: 'Calculator', action: 'budget_calculator' },
          { label: 'Ranges', action: 'budget_ranges' }
        ];
      default:
        return [];
    }
  };

  const quickActions = getQuickActions();

  if (quickActions.length === 0) return null;

  return (
    <>
      {quickActions.map((action, index) => (
        <button
          key={index}
          onClick={() => handleQuickAction(action.action)}
          className="text-xs text-blue-600 hover:text-blue-800 hover:underline"
        >
          {action.label}
        </button>
      ))}
    </>
  );
};

// Progress bar component for overall field completion
export const ValidationProgressBar: React.FC<{ 
  score: number; 
  label?: string;
  className?: string;
}> = ({ score, label, className = '' }) => {
  const getProgressColor = (score: number) => {
    if (score >= 80) return 'bg-green-500';
    if (score >= 60) return 'bg-yellow-500';
    if (score >= 40) return 'bg-orange-500';
    return 'bg-red-500';
  };

  const getTextColor = (score: number) => {
    if (score >= 80) return 'text-green-600';
    if (score >= 60) return 'text-yellow-600';
    if (score >= 40) return 'text-orange-600';
    return 'text-red-600';
  };

  return (
    <div className={`validation-progress-bar ${className}`}>
      {label && (
        <div className="flex items-center justify-between mb-1">
          <span className="text-sm font-medium text-gray-700">{label}</span>
          <span className={`text-sm font-semibold ${getTextColor(score)}`}>
            {score}/100
          </span>
        </div>
      )}
      
      <div className="w-full bg-gray-200 rounded-full h-2">
        <div 
          className={`h-2 rounded-full transition-all duration-300 ${getProgressColor(score)}`}
          style={{ width: `${Math.max(0, Math.min(100, score))}%` }}
        />
      </div>
    </div>
  );
};

export default RealTimeValidator;