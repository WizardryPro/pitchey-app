/**
 * Enhanced Pitch Form with Integrated Validation
 * Real-time validation feedback and scoring
 */

import React, { useState, useEffect, useCallback } from 'react';
import { 
  Save, Eye, Send, Zap, Target, BarChart3, AlertTriangle, 
  CheckCircle, Clock, TrendingUp, Star, ChevronRight, Plus, Edit
} from 'lucide-react';

import { RealTimeValidator, ValidationProgressBar } from './RealTimeValidator';
import { ValidationDashboard } from './ValidationDashboard';
import { ValidationChartsContainer } from './ValidationCharts';

import type { 
  ValidationScore, 
  RealTimeValidation,
  ValidationRecommendation 
} from '@shared/types/pitch-validation.types';

interface PitchFormData {
  title: string;
  logline: string;
  synopsis: string;
  genre: string;
  budget: string;
  director?: string;
  producer?: string;
  cast?: string[];
  targetAudience?: string;
  releaseStrategy?: string;
  scriptPages?: number;
}

interface EnhancedPitchFormProps {
  pitchId?: string;
  initialData?: Partial<PitchFormData>;
  onSave?: (data: PitchFormData) => void;
  onSubmit?: (data: PitchFormData) => void;
  className?: string;
}

export const EnhancedPitchForm: React.FC<EnhancedPitchFormProps> = ({
  pitchId = 'temp_pitch_id',
  initialData = {},
  onSave,
  onSubmit,
  className = ''
}) => {
  const [formData, setFormData] = useState<PitchFormData>({
    title: '',
    logline: '',
    synopsis: '',
    genre: 'drama',
    budget: '',
    director: '',
    producer: '',
    cast: [],
    targetAudience: '',
    releaseStrategy: '',
    scriptPages: undefined,
    ...initialData
  });

  const [validationScores, setValidationScores] = useState<Record<string, number>>({});
  const [overallScore, setOverallScore] = useState<number>(0);
  const [validationData, setValidationData] = useState<ValidationScore | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [showValidationDashboard, setShowValidationDashboard] = useState(false);
  const [activeRecommendations, setActiveRecommendations] = useState<ValidationRecommendation[]>([]);
  
  const [activeTab, setActiveTab] = useState<'form' | 'validation' | 'analytics'>('form');

  // Calculate overall score based on individual field scores
  useEffect(() => {
    const scores = Object.values(validationScores);
    if (scores.length > 0) {
      const average = scores.reduce((sum, score) => sum + score, 0) / scores.length;
      setOverallScore(Math.round(average));
    }
  }, [validationScores]);

  const handleFieldChange = (field: keyof PitchFormData, value: string | string[] | number) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleFieldScoreChange = useCallback((field: string, score: number) => {
    setValidationScores(prev => ({ ...prev, [field]: score }));
  }, []);

  const runFullAnalysis = async () => {
    setIsAnalyzing(true);
    try {
      const response = await fetch('/api/validation/analyze', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          pitchData: {
            title: formData.title,
            logline: formData.logline,
            synopsis: formData.synopsis,
            genre: formData.genre,
            budget: parseFloat(formData.budget.replace(/[,$]/g, '')) || 0,
            director: formData.director,
            producer: formData.producer,
            cast: formData.cast,
            script_pages: formData.scriptPages,
            target_audience: formData.targetAudience,
            release_strategy: formData.releaseStrategy
          },
          options: {
            depth: 'comprehensive',
            include_market_data: true,
            include_comparables: true,
            include_predictions: true
          }
        })
      });

      if (response.ok) {
        const result = await response.json();
        if (result.success) {
          setValidationData(result.data);
          setActiveRecommendations(result.data.recommendations.filter((rec: ValidationRecommendation) => 
            rec.priority === 'high'
          ).slice(0, 5));
          setShowValidationDashboard(true);
          setActiveTab('validation');
        }
      }
    } catch (error) {
      console.error('Full analysis failed:', error);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleSave = () => {
    onSave?.(formData);
  };

  const handleSubmit = () => {
    onSubmit?.(formData);
  };

  const getCompletionPercentage = () => {
    const requiredFields = ['title', 'logline', 'synopsis', 'genre', 'budget'];
    const completedFields = requiredFields.filter(field => formData[field as keyof PitchFormData]);
    return Math.round((completedFields.length / requiredFields.length) * 100);
  };

  const isFormComplete = () => {
    return getCompletionPercentage() === 100;
  };

  return (
    <div className={`enhanced-pitch-form max-w-6xl mx-auto ${className}`}>
      {/* Header with Progress */}
      <div className="bg-white rounded-lg shadow border border-gray-200 p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Create Your Pitch</h1>
            <p className="text-gray-600">Get instant AI-powered feedback as you write</p>
          </div>
          
          <div className="flex items-center space-x-3">
            {overallScore > 0 && (
              <div className="text-center">
                <div className={`text-2xl font-bold ${
                  overallScore >= 80 ? 'text-green-600' : 
                  overallScore >= 60 ? 'text-yellow-600' : 'text-red-600'
                }`}>
                  {overallScore}
                </div>
                <div className="text-xs text-gray-500">AI Score</div>
              </div>
            )}
            
            <button
              onClick={runFullAnalysis}
              disabled={isAnalyzing || !isFormComplete()}
              className={`
                flex items-center space-x-2 px-4 py-2 rounded-lg font-medium transition-colors
                ${isFormComplete()
                  ? 'bg-blue-600 text-white hover:bg-blue-700'
                  : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                }
              `}
            >
              {isAnalyzing ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Analyzing...</span>
                </>
              ) : (
                <>
                  <Zap className="w-4 h-4" />
                  <span>AI Analysis</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Overall Progress Bar */}
        <div className="mb-4">
          <div className="flex items-center justify-between text-sm text-gray-600 mb-1">
            <span>Form Completion</span>
            <span>{getCompletionPercentage()}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div 
              className="bg-blue-600 h-2 rounded-full transition-all duration-300" 
              style={{ width: `${getCompletionPercentage()}%` }}
            />
          </div>
        </div>

        {/* Tab Navigation */}
        <NavigationTabs activeTab={activeTab} onTabChange={(tab: string) => setActiveTab(tab as any)} />
      </div>

      {/* Tab Content */}
      {activeTab === 'form' && (
        <FormTab 
          formData={formData}
          onFieldChange={handleFieldChange}
          onFieldScoreChange={handleFieldScoreChange}
          pitchId={pitchId}
        />
      )}

      {activeTab === 'validation' && validationData && (
        <ValidationTab 
          validationData={validationData}
          activeRecommendations={activeRecommendations}
          onAnalyze={runFullAnalysis}
        />
      )}

      {activeTab === 'analytics' && validationData && (
        <AnalyticsTab validationData={validationData} />
      )}

      {/* Action Buttons */}
      <div className="flex items-center justify-between bg-white rounded-lg shadow border border-gray-200 p-6">
        <div className="flex items-center space-x-4">
          <div className="text-sm text-gray-600">
            Last saved: <span className="font-medium">Auto-saved</span>
          </div>
          
          {activeRecommendations.length > 0 && (
            <div className="flex items-center space-x-2 text-sm">
              <AlertTriangle className="w-4 h-4 text-yellow-500" />
              <span className="text-gray-600">
                {activeRecommendations.length} recommendations available
              </span>
            </div>
          )}
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={handleSave}
            className="flex items-center space-x-2 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
          >
            <Save className="w-4 h-4" />
            <span>Save Draft</span>
          </button>

          <button
            onClick={handleSubmit}
            disabled={!isFormComplete() || overallScore < 60}
            className={`
              flex items-center space-x-2 px-6 py-2 rounded-lg font-medium transition-colors
              ${isFormComplete() && overallScore >= 60
                ? 'bg-green-600 text-white hover:bg-green-700'
                : 'bg-gray-300 text-gray-500 cursor-not-allowed'
              }
            `}
          >
            <Send className="w-4 h-4" />
            <span>Submit Pitch</span>
          </button>
        </div>
      </div>
    </div>
  );
};

// Navigation Tabs Component
const NavigationTabs: React.FC<{
  activeTab: string;
  onTabChange: (tab: string) => void;
}> = ({ activeTab, onTabChange }) => {
  const tabs = [
    { id: 'form', label: 'Pitch Form', icon: Edit },
    { id: 'validation', label: 'AI Validation', icon: Target },
    { id: 'analytics', label: 'Market Analytics', icon: BarChart3 }
  ];

  return (
    <div className="flex space-x-1">
      {tabs.map((tab) => {
        const Icon = tab.icon;
        return (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            className={`
              flex items-center space-x-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors
              ${activeTab === tab.id
                ? 'bg-blue-100 text-blue-700'
                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
              }
            `}
          >
            <Icon className="w-4 h-4" />
            <span>{tab.label}</span>
          </button>
        );
      })}
    </div>
  );
};

// Form Tab Component
const FormTab: React.FC<{
  formData: PitchFormData;
  onFieldChange: (field: keyof PitchFormData, value: string | string[] | number) => void;
  onFieldScoreChange: (field: string, score: number) => void;
  pitchId: string;
}> = ({ formData, onFieldChange, onFieldScoreChange, pitchId }) => {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Main Form */}
      <div className="lg:col-span-2 space-y-6">
        {/* Title Field */}
        <div className="bg-white rounded-lg shadow border border-gray-200 p-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Project Title *
          </label>
          <input
            type="text"
            value={formData.title}
            onChange={(e) => onFieldChange('title', e.target.value)}
            placeholder="Enter a compelling title for your project"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          <RealTimeValidator
            pitchId={pitchId}
            field="title"
            value={formData.title}
            fieldType="title"
            onScoreChange={(score) => onFieldScoreChange('title', score)}
            className="mt-3"
          />
        </div>

        {/* Logline Field */}
        <div className="bg-white rounded-lg shadow border border-gray-200 p-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Logline *
          </label>
          <textarea
            value={formData.logline}
            onChange={(e) => onFieldChange('logline', e.target.value)}
            placeholder="A one-sentence summary that captures the essence of your story..."
            rows={3}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          <RealTimeValidator
            pitchId={pitchId}
            field="logline"
            value={formData.logline}
            fieldType="logline"
            onScoreChange={(score) => onFieldScoreChange('logline', score)}
            className="mt-3"
          />
        </div>

        {/* Synopsis Field */}
        <div className="bg-white rounded-lg shadow border border-gray-200 p-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Synopsis *
          </label>
          <textarea
            value={formData.synopsis}
            onChange={(e) => onFieldChange('synopsis', e.target.value)}
            placeholder="Provide a detailed synopsis of your story, including the three-act structure..."
            rows={8}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          <RealTimeValidator
            pitchId={pitchId}
            field="synopsis"
            value={formData.synopsis}
            fieldType="synopsis"
            onScoreChange={(score) => onFieldScoreChange('synopsis', score)}
            className="mt-3"
          />
        </div>

        {/* Genre and Budget */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white rounded-lg shadow border border-gray-200 p-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Genre *
            </label>
            <select
              value={formData.genre}
              onChange={(e) => onFieldChange('genre', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="drama">Drama</option>
              <option value="comedy">Comedy</option>
              <option value="action">Action</option>
              <option value="horror">Horror</option>
              <option value="thriller">Thriller</option>
              <option value="romance">Romance</option>
              <option value="scifi">Science Fiction</option>
              <option value="fantasy">Fantasy</option>
              <option value="documentary">Documentary</option>
            </select>
            <RealTimeValidator
              pitchId={pitchId}
              field="genre"
              value={formData.genre}
              fieldType="genre"
              onScoreChange={(score) => onFieldScoreChange('genre', score)}
              showDetailedFeedback={false}
              className="mt-3"
            />
          </div>

          <div className="bg-white rounded-lg shadow border border-gray-200 p-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Budget *
            </label>
            <input
              type="text"
              value={formData.budget}
              onChange={(e) => onFieldChange('budget', e.target.value)}
              placeholder="$1,000,000"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <RealTimeValidator
              pitchId={pitchId}
              field="budget"
              value={formData.budget}
              fieldType="budget"
              onScoreChange={(score) => onFieldScoreChange('budget', score)}
              className="mt-3"
            />
          </div>
        </div>

        {/* Optional Fields */}
        <OptionalFieldsSection 
          formData={formData} 
          onFieldChange={onFieldChange} 
        />
      </div>

      {/* Sidebar with Progress and Tips */}
      <div className="space-y-6">
        <ScoringSidebar validationScores={{}} />
        <TipsAndGuidance />
      </div>
    </div>
  );
};

// Validation Tab Component
const ValidationTab: React.FC<{
  validationData: ValidationScore;
  activeRecommendations: ValidationRecommendation[];
  onAnalyze: () => void;
}> = ({ validationData, activeRecommendations, onAnalyze }) => {
  return (
    <div>
      <ValidationDashboard
        pitchId={validationData.pitchId}
        onAnalyzeClick={onAnalyze}
      />
    </div>
  );
};

// Analytics Tab Component
const AnalyticsTab: React.FC<{
  validationData: ValidationScore;
}> = ({ validationData }) => {
  return (
    <div>
      <ValidationChartsContainer
        validationData={validationData}
        comparables={validationData.comparables}
        benchmarks={validationData.benchmarks}
      />
    </div>
  );
};

// Helper Components

const OptionalFieldsSection: React.FC<{
  formData: PitchFormData;
  onFieldChange: (field: keyof PitchFormData, value: string | string[] | number) => void;
}> = ({ formData, onFieldChange }) => {
  const [showOptional, setShowOptional] = useState(false);

  return (
    <div className="bg-white rounded-lg shadow border border-gray-200 p-6">
      <button
        onClick={() => setShowOptional(!showOptional)}
        className="flex items-center justify-between w-full text-left"
      >
        <span className="text-lg font-semibold text-gray-900">Additional Information</span>
        <ChevronRight className={`w-5 h-5 text-gray-400 transition-transform ${showOptional ? 'rotate-90' : ''}`} />
      </button>

      {showOptional && (
        <div className="mt-4 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Director
              </label>
              <input
                type="text"
                value={formData.director || ''}
                onChange={(e) => onFieldChange('director', e.target.value)}
                placeholder="Director name"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Producer
              </label>
              <input
                type="text"
                value={formData.producer || ''}
                onChange={(e) => onFieldChange('producer', e.target.value)}
                placeholder="Producer name"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Target Audience
            </label>
            <input
              type="text"
              value={formData.targetAudience || ''}
              onChange={(e) => onFieldChange('targetAudience', e.target.value)}
              placeholder="e.g., 18-34 year olds, families, genre enthusiasts"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Release Strategy
            </label>
            <select
              value={formData.releaseStrategy || ''}
              onChange={(e) => onFieldChange('releaseStrategy', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">Select strategy</option>
              <option value="theatrical">Theatrical Release</option>
              <option value="streaming">Streaming Platform</option>
              <option value="hybrid">Theatrical + Streaming</option>
              <option value="festival">Festival Circuit</option>
              <option value="direct">Direct to Consumer</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Script Pages
            </label>
            <input
              type="number"
              value={formData.scriptPages || ''}
              onChange={(e) => onFieldChange('scriptPages', parseInt(e.target.value) || 0)}
              placeholder="120"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>
      )}
    </div>
  );
};

const ScoringSidebar: React.FC<{
  validationScores: Record<string, number>;
}> = ({ validationScores }) => {
  return (
    <div className="bg-white rounded-lg shadow border border-gray-200 p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Real-time Scoring</h3>
      
      <div className="space-y-3">
        {Object.entries(validationScores).map(([field, score]) => (
          <ValidationProgressBar 
            key={field}
            score={score} 
            label={field.charAt(0).toUpperCase() + field.slice(1)}
          />
        ))}
        
        {Object.keys(validationScores).length === 0 && (
          <div className="text-center py-6 text-gray-500">
            <Target className="w-8 h-8 mx-auto mb-2 text-gray-400" />
            <p className="text-sm">Start writing to see real-time scoring</p>
          </div>
        )}
      </div>
    </div>
  );
};

const TipsAndGuidance: React.FC = () => {
  const tips = [
    {
      icon: Star,
      title: "Strong Title",
      tip: "Keep titles 1-3 words for maximum impact and memorability"
    },
    {
      icon: Target,
      title: "Effective Logline", 
      tip: "Include protagonist, conflict, and stakes in 25-50 words"
    },
    {
      icon: TrendingUp,
      title: "Market Timing",
      tip: "Consider current genre trends and seasonal timing for release"
    },
    {
      icon: CheckCircle,
      title: "Complete Picture",
      tip: "Fill in optional fields to get more accurate AI analysis"
    }
  ];

  return (
    <div className="bg-white rounded-lg shadow border border-gray-200 p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Pro Tips</h3>
      
      <div className="space-y-4">
        {tips.map((tip, index) => {
          const Icon = tip.icon;
          return (
            <div key={index} className="flex items-start space-x-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Icon className="w-4 h-4 text-blue-600" />
              </div>
              <div>
                <h4 className="text-sm font-semibold text-gray-900">{tip.title}</h4>
                <p className="text-sm text-gray-600">{tip.tip}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default EnhancedPitchForm;