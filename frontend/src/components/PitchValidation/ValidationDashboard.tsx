/**
 * Comprehensive Pitch Validation Dashboard
 * Beautiful visualizations and actionable insights
 */

import React, { useState, useEffect } from 'react';
import {
  LineChart, Line, AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  RadialBarChart, RadialBar, ScatterChart, Scatter,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';
import { 
  TrendingUp, TrendingDown, Award, AlertTriangle, Target, 
  CheckCircle, Clock, Star, Zap, BarChart3, PieChart as PieIcon,
  ArrowUp, ArrowDown, Minus, ChevronRight, RefreshCw,
  BookOpen, DollarSign, Users, Film, Calendar, Eye
} from 'lucide-react';

import type {
  ValidationScore,
  ValidationDashboard as ValidationDashboardData,
  ValidationCategories,
  CategoryScore,
  ValidationRecommendation,
  CompetitivePosition,
  ValidationMilestone
} from '@shared/types/pitch-validation.types';

interface ValidationDashboardProps {
  pitchId: string;
  onRecommendationClick?: (recommendation: ValidationRecommendation) => void;
  onAnalyzeClick?: () => void;
  className?: string;
}

export const ValidationDashboard: React.FC<ValidationDashboardProps> = ({
  pitchId,
  onRecommendationClick,
  onAnalyzeClick,
  className = ''
}) => {
  const [dashboardData, setDashboardData] = useState<ValidationDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'categories' | 'trends' | 'recommendations' | 'comparisons'>('overview');

  useEffect(() => {
    fetchDashboardData();
  }, [pitchId]);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/validation/dashboard/${pitchId}`);
      
      if (!response.ok) {
        throw new Error('Failed to load validation data');
      }
      
      const result = await response.json();
      if (result.success) {
        setDashboardData(result.data);
      } else {
        setError(result.error || 'Failed to load validation data');
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleAnalyzeClick = () => {
    onAnalyzeClick?.();
    // Refresh data after analysis
    setTimeout(fetchDashboardData, 2000);
  };

  if (loading) {
    return (
      <div className={`validation-dashboard ${className}`}>
        <div className="flex items-center justify-center h-96">
          <div className="flex items-center space-x-2 text-gray-600">
            <RefreshCw className="w-5 h-5 animate-spin" />
            <span>Loading validation dashboard...</span>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`validation-dashboard ${className}`}>
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
          <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-3" />
          <h3 className="text-lg font-semibold text-red-800 mb-2">
            Validation Data Unavailable
          </h3>
          <p className="text-red-600 mb-4">{error}</p>
          <button
            onClick={handleAnalyzeClick}
            className="bg-red-600 text-white px-6 py-2 rounded-lg hover:bg-red-700 transition-colors"
          >
            Run Pitch Analysis
          </button>
        </div>
      </div>
    );
  }

  if (!dashboardData) {
    return (
      <div className={`validation-dashboard ${className}`}>
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 text-center">
          <Eye className="w-12 h-12 text-blue-500 mx-auto mb-3" />
          <h3 className="text-lg font-semibold text-blue-800 mb-2">
            No Validation Data
          </h3>
          <p className="text-blue-600 mb-4">
            Get instant feedback on your pitch with our AI-powered validation system.
          </p>
          <button
            onClick={handleAnalyzeClick}
            className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors"
          >
            Analyze My Pitch
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`validation-dashboard space-y-6 ${className}`}>
      {/* Dashboard Header */}
      <DashboardHeader 
        dashboardData={dashboardData} 
        onAnalyzeClick={handleAnalyzeClick}
      />

      {/* Navigation Tabs */}
      <NavigationTabs
        activeTab={activeTab}
        onTabChange={(tab: string) => setActiveTab(tab as any)}
      />

      {/* Tab Content */}
      {activeTab === 'overview' && (
        <OverviewTab dashboardData={dashboardData} />
      )}

      {activeTab === 'categories' && (
        <CategoriesTab 
          categories={dashboardData.currentScore.categories}
          benchmarks={dashboardData.currentScore.benchmarks}
        />
      )}

      {activeTab === 'trends' && (
        <TrendsTab trends={dashboardData.trends} />
      )}

      {activeTab === 'recommendations' && (
        <RecommendationsTab 
          recommendations={dashboardData.activeRecommendations}
          allRecommendations={dashboardData.currentScore.recommendations}
          onRecommendationClick={onRecommendationClick}
        />
      )}

      {activeTab === 'comparisons' && (
        <ComparisonsTab 
          competitivePosition={dashboardData.competitivePosition}
          comparables={dashboardData.currentScore.comparables}
        />
      )}
    </div>
  );
};

// Dashboard Header Component
const DashboardHeader: React.FC<{
  dashboardData: ValidationDashboardData;
  onAnalyzeClick: () => void;
}> = ({ dashboardData, onAnalyzeClick }) => {
  const { currentScore, pitch } = dashboardData;
  
  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-600';
    if (score >= 60) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getScoreLabel = (score: number) => {
    if (score >= 80) return 'Excellent';
    if (score >= 60) return 'Good';
    if (score >= 40) return 'Needs Work';
    return 'Requires Attention';
  };

  return (
    <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{pitch.title}</h1>
          <p className="text-gray-600">Created by {pitch.creator}</p>
        </div>
        <button
          onClick={onAnalyzeClick}
          className="flex items-center space-x-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
        >
          <RefreshCw className="w-4 h-4" />
          <span>Re-analyze</span>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Overall Score */}
        <div className="lg:col-span-1">
          <div className="text-center">
            <div className={`text-5xl font-bold ${getScoreColor(currentScore.overallScore)} mb-2`}>
              {currentScore.overallScore}
            </div>
            <div className="text-gray-600 mb-1">Overall Score</div>
            <div className={`font-semibold ${getScoreColor(currentScore.overallScore)}`}>
              {getScoreLabel(currentScore.overallScore)}
            </div>
            <div className="mt-2 text-sm text-gray-500">
              Confidence: {currentScore.confidence}%
            </div>
          </div>
        </div>

        {/* Category Breakdown */}
        <div className="lg:col-span-3">
          <div className="grid grid-cols-5 gap-4">
            {Object.entries(currentScore.categories).map(([key, category]) => (
              <CategoryScoreCard 
                key={key} 
                name={key} 
                category={category} 
              />
            ))}
          </div>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mt-6 pt-6 border-t border-gray-200">
        <MetricCard
          icon={Target}
          label="Recommendations"
          value={currentScore.recommendations.length}
          trend="neutral"
        />
        <MetricCard
          icon={BarChart3}
          label="Comparables"
          value={currentScore.comparables.length}
          trend="neutral"
        />
        <MetricCard
          icon={Award}
          label="Success Prediction"
          value={`${currentScore.aiInsights.successPrediction.probability}%`}
          trend="neutral"
        />
        <MetricCard
          icon={TrendingUp}
          label="Market Timing"
          value={`${dashboardData.currentScore.marketTiming.optimalTimingScore}/100`}
          trend="neutral"
        />
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
    { id: 'overview', label: 'Overview', icon: BarChart3 },
    { id: 'categories', label: 'Categories', icon: PieIcon },
    { id: 'trends', label: 'Trends', icon: TrendingUp },
    { id: 'recommendations', label: 'Recommendations', icon: Target },
    { id: 'comparisons', label: 'Market Position', icon: Award }
  ];

  return (
    <div className="flex space-x-1 bg-gray-100 p-1 rounded-lg">
      {tabs.map((tab) => {
        const Icon = tab.icon;
        return (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            className={`
              flex items-center space-x-2 px-4 py-2 rounded-md text-sm font-medium transition-colors
              ${activeTab === tab.id
                ? 'bg-white text-blue-600 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
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

// Overview Tab Component
const OverviewTab: React.FC<{ dashboardData: ValidationDashboardData }> = ({ dashboardData }) => {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Score Radar Chart */}
      <div className="bg-white rounded-lg shadow border border-gray-200 p-6">
        <h3 className="text-lg font-semibold mb-4">Category Performance</h3>
        <ScoreRadarChart categories={dashboardData.currentScore.categories} />
      </div>

      {/* AI Insights */}
      <div className="bg-white rounded-lg shadow border border-gray-200 p-6">
        <h3 className="text-lg font-semibold mb-4">AI Insights</h3>
        <AIInsightsPanel insights={dashboardData.currentScore.aiInsights} />
      </div>

      {/* Success Prediction */}
      <div className="bg-white rounded-lg shadow border border-gray-200 p-6">
        <h3 className="text-lg font-semibold mb-4">Success Prediction</h3>
        <SuccessPredictionPanel prediction={dashboardData.currentScore.aiInsights.successPrediction} />
      </div>

      {/* Market Timing */}
      <div className="bg-white rounded-lg shadow border border-gray-200 p-6">
        <h3 className="text-lg font-semibold mb-4">Market Timing</h3>
        <MarketTimingPanel timing={dashboardData.currentScore.marketTiming} />
      </div>
    </div>
  );
};

// Categories Tab Component
const CategoriesTab: React.FC<{ 
  categories: ValidationCategories; 
  benchmarks: any[]; 
}> = ({ categories, benchmarks }) => {
  return (
    <div className="space-y-6">
      {Object.entries(categories).map(([key, category]) => (
        <CategoryDetailCard 
          key={key} 
          name={key} 
          category={category}
          benchmark={benchmarks.find(b => b.category === key)}
        />
      ))}
    </div>
  );
};

// Trends Tab Component
const TrendsTab: React.FC<{ trends: any[] }> = ({ trends }) => {
  return (
    <div className="bg-white rounded-lg shadow border border-gray-200 p-6">
      <h3 className="text-lg font-semibold mb-4">Score Evolution</h3>
      <ResponsiveContainer width="100%" height={400}>
        <LineChart data={trends}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="date" />
          <YAxis domain={[0, 100]} />
          <Tooltip />
          <Legend />
          <Line 
            type="monotone" 
            dataKey="overall_score" 
            stroke="#3B82F6" 
            strokeWidth={3}
            name="Overall Score"
          />
          <Line 
            type="monotone" 
            dataKey="category_scores.story.score" 
            stroke="#EF4444" 
            strokeWidth={2}
            name="Story"
          />
          <Line 
            type="monotone" 
            dataKey="category_scores.market.score" 
            stroke="#10B981" 
            strokeWidth={2}
            name="Market"
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};

// Recommendations Tab Component
const RecommendationsTab: React.FC<{
  recommendations: ValidationRecommendation[];
  allRecommendations: ValidationRecommendation[];
  onRecommendationClick?: (recommendation: ValidationRecommendation) => void;
}> = ({ recommendations, allRecommendations, onRecommendationClick }) => {
  const [filter, setFilter] = useState<'all' | 'high' | 'medium' | 'low'>('all');

  const filteredRecommendations = filter === 'all' 
    ? allRecommendations 
    : allRecommendations.filter(rec => rec.priority === filter);

  return (
    <div className="space-y-6">
      {/* Filter Tabs */}
      <div className="flex space-x-2">
        {['all', 'high', 'medium', 'low'].map((priority) => (
          <button
            key={priority}
            onClick={() => setFilter(priority as any)}
            className={`
              px-4 py-2 rounded-lg text-sm font-medium transition-colors
              ${filter === priority
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }
            `}
          >
            {priority.charAt(0).toUpperCase() + priority.slice(1)}
            {priority !== 'all' && ` Priority`}
          </button>
        ))}
      </div>

      {/* Recommendations List */}
      <div className="space-y-4">
        {filteredRecommendations.map((recommendation) => (
          <RecommendationCard
            key={recommendation.id}
            recommendation={recommendation}
            onClick={() => onRecommendationClick?.(recommendation)}
          />
        ))}
      </div>

      {filteredRecommendations.length === 0 && (
        <div className="text-center py-8 text-gray-500">
          <Target className="w-12 h-12 mx-auto mb-3 text-gray-400" />
          <p>No recommendations found for the selected filter.</p>
        </div>
      )}
    </div>
  );
};

// Comparisons Tab Component
const ComparisonsTab: React.FC<{
  competitivePosition: CompetitivePosition;
  comparables: any[];
}> = ({ competitivePosition, comparables }) => {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Competitive Position */}
      <div className="bg-white rounded-lg shadow border border-gray-200 p-6">
        <h3 className="text-lg font-semibold mb-4">Market Position</h3>
        <CompetitivePositionPanel position={competitivePosition} />
      </div>

      {/* Comparable Projects */}
      <div className="bg-white rounded-lg shadow border border-gray-200 p-6">
        <h3 className="text-lg font-semibold mb-4">Comparable Projects</h3>
        <ComparableProjectsList comparables={comparables} />
      </div>
    </div>
  );
};

// Helper Components

const CategoryScoreCard: React.FC<{ name: string; category: CategoryScore }> = ({ name, category }) => {
  const getScoreColor = (score: number) => {
    if (score >= 80) return 'bg-green-500';
    if (score >= 60) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  return (
    <div className="text-center">
      <div className="relative mb-2">
        <div className="w-16 h-16 mx-auto bg-gray-200 rounded-full flex items-center justify-center">
          <div className={`w-12 h-12 rounded-full ${getScoreColor(category.score)} flex items-center justify-center text-white font-bold`}>
            {category.score}
          </div>
        </div>
      </div>
      <div className="text-sm font-medium text-gray-700 capitalize">{name}</div>
    </div>
  );
};

const MetricCard: React.FC<{
  icon: React.ComponentType<any>;
  label: string;
  value: string | number;
  trend: 'up' | 'down' | 'neutral';
}> = ({ icon: Icon, label, value, trend }) => {
  const getTrendIcon = () => {
    switch (trend) {
      case 'up': return <ArrowUp className="w-4 h-4 text-green-500" />;
      case 'down': return <ArrowDown className="w-4 h-4 text-red-500" />;
      default: return <Minus className="w-4 h-4 text-gray-400" />;
    }
  };

  return (
    <div className="flex items-center space-x-3">
      <div className="p-2 bg-gray-100 rounded-lg">
        <Icon className="w-5 h-5 text-gray-600" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-gray-700">{label}</div>
        <div className="flex items-center space-x-1">
          <span className="text-lg font-semibold text-gray-900">{value}</span>
          {getTrendIcon()}
        </div>
      </div>
    </div>
  );
};

const CategoryDetailCard: React.FC<{
  name: string;
  category: CategoryScore;
  benchmark?: any;
}> = ({ name, category, benchmark }) => {
  return (
    <div className="bg-white rounded-lg shadow border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold capitalize">{name}</h3>
        <div className="text-2xl font-bold text-blue-600">{category.score}/100</div>
      </div>

      {/* Progress Bar */}
      <div className="mb-4">
        <div className="flex justify-between text-sm text-gray-600 mb-1">
          <span>Performance</span>
          <span>{category.score}%</span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div 
            className="bg-blue-600 h-2 rounded-full" 
            style={{ width: `${category.score}%` }}
          />
        </div>
      </div>

      {/* Factors */}
      <div className="space-y-3">
        {category.factors.map((factor, index) => (
          <div key={index} className="flex items-center justify-between">
            <div className="flex-1">
              <div className="text-sm font-medium text-gray-700">{factor.name}</div>
              <div className="text-xs text-gray-500">{factor.description}</div>
            </div>
            <div className="text-right">
              <div className="text-sm font-semibold text-gray-900">{factor.score}/100</div>
              <div className={`text-xs ${
                factor.impact === 'high' ? 'text-red-600' :
                factor.impact === 'medium' ? 'text-yellow-600' : 'text-green-600'
              }`}>
                {factor.impact} impact
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Strengths and Weaknesses */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-4 pt-4 border-t border-gray-200">
        {category.strengths.length > 0 && (
          <div>
            <h4 className="text-sm font-semibold text-green-700 mb-2">Strengths</h4>
            <ul className="space-y-1">
              {category.strengths.map((strength, index) => (
                <li key={index} className="text-sm text-green-600 flex items-center">
                  <CheckCircle className="w-3 h-3 mr-2" />
                  {strength}
                </li>
              ))}
            </ul>
          </div>
        )}

        {category.weaknesses.length > 0 && (
          <div>
            <h4 className="text-sm font-semibold text-red-700 mb-2">Areas for Improvement</h4>
            <ul className="space-y-1">
              {category.weaknesses.map((weakness, index) => (
                <li key={index} className="text-sm text-red-600 flex items-center">
                  <AlertTriangle className="w-3 h-3 mr-2" />
                  {weakness}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
};

const RecommendationCard: React.FC<{
  recommendation: ValidationRecommendation;
  onClick?: () => void;
}> = ({ recommendation, onClick }) => {
  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'bg-red-100 text-red-800 border-red-200';
      case 'medium': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'low': return 'bg-blue-100 text-blue-800 border-blue-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getEffortIcon = (effort: string) => {
    switch (effort) {
      case 'high': return <Clock className="w-4 h-4" />;
      case 'medium': return <Zap className="w-4 h-4" />;
      case 'low': return <CheckCircle className="w-4 h-4" />;
      default: return <Minus className="w-4 h-4" />;
    }
  };

  return (
    <div 
      className="bg-white rounded-lg shadow border border-gray-200 p-6 hover:shadow-md transition-shadow cursor-pointer"
      onClick={onClick}
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center space-x-3">
          <span className={`px-2 py-1 rounded-full text-xs font-semibold border ${getPriorityColor(recommendation.priority)}`}>
            {recommendation.priority} priority
          </span>
          <span className="text-xs text-gray-500 uppercase tracking-wider">
            {recommendation.category}
          </span>
        </div>
        <div className="text-right">
          <div className="text-sm font-semibold text-blue-600">
            +{recommendation.estimatedImpact} points
          </div>
          <div className="text-xs text-gray-500">potential impact</div>
        </div>
      </div>

      <h4 className="text-lg font-semibold text-gray-900 mb-2">
        {recommendation.title}
      </h4>
      
      <p className="text-gray-600 mb-4">
        {recommendation.description}
      </p>

      <div className="flex items-center justify-between text-sm text-gray-500">
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-1">
            {getEffortIcon(recommendation.effort)}
            <span>{recommendation.effort} effort</span>
          </div>
          <div className="flex items-center space-x-1">
            <Calendar className="w-4 h-4" />
            <span>{recommendation.timeline}</span>
          </div>
          {recommendation.cost > 0 && (
            <div className="flex items-center space-x-1">
              <DollarSign className="w-4 h-4" />
              <span>${recommendation.cost.toLocaleString()}</span>
            </div>
          )}
        </div>
        <ChevronRight className="w-4 h-4" />
      </div>
    </div>
  );
};

// Additional helper components for complex visualizations
const ScoreRadarChart: React.FC<{ categories: ValidationCategories }> = ({ categories }) => {
  const data = Object.entries(categories).map(([key, category]) => ({
    category: key.charAt(0).toUpperCase() + key.slice(1),
    score: category.score,
    fullMark: 100
  }));

  return (
    <ResponsiveContainer width="100%" height={300}>
      <RadialBarChart cx="50%" cy="50%" innerRadius="10%" outerRadius="80%" data={data}>
        <RadialBar dataKey="score" cornerRadius={10} fill="#3B82F6" />
        <Tooltip />
      </RadialBarChart>
    </ResponsiveContainer>
  );
};

const AIInsightsPanel: React.FC<{ insights: any }> = ({ insights }) => {
  return (
    <div className="space-y-4">
      <div className="flex items-center space-x-3">
        <div className="p-2 bg-purple-100 rounded-lg">
          <Zap className="w-5 h-5 text-purple-600" />
        </div>
        <div>
          <div className="text-sm font-medium text-gray-700">Innovation Score</div>
          <div className="text-lg font-semibold text-gray-900">{insights.innovationScore}/100</div>
        </div>
      </div>

      <div className="flex items-center space-x-3">
        <div className="p-2 bg-green-100 rounded-lg">
          <TrendingUp className="w-5 h-5 text-green-600" />
        </div>
        <div>
          <div className="text-sm font-medium text-gray-700">Viral Potential</div>
          <div className="text-lg font-semibold text-gray-900">{insights.viralPotential}/100</div>
        </div>
      </div>

      <div className="pt-3 border-t border-gray-200">
        <h5 className="text-sm font-semibold text-gray-700 mb-2">Market Positioning</h5>
        <p className="text-sm text-gray-600">
          {insights.marketPositioning.recommended_position}
        </p>
      </div>
    </div>
  );
};

const SuccessPredictionPanel: React.FC<{ prediction: any }> = ({ prediction }) => {
  return (
    <div className="space-y-4">
      <div className="text-center">
        <div className="text-3xl font-bold text-green-600 mb-1">
          {prediction.probability}%
        </div>
        <div className="text-sm text-gray-600">Success Probability</div>
        <div className="text-xs text-gray-500">
          Confidence: {prediction.confidence}%
        </div>
      </div>

      <div className="space-y-2">
        {prediction.scenarios.map((scenario: any, index: number) => (
          <div key={index} className="flex items-center justify-between">
            <span className="text-sm font-medium text-gray-700 capitalize">
              {scenario.scenario}
            </span>
            <span className="text-sm text-gray-600">
              {scenario.roi_range[0]}-{scenario.roi_range[1]}% ROI
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

const MarketTimingPanel: React.FC<{ timing: any }> = ({ timing }) => {
  return (
    <div className="space-y-4">
      <div className="text-center">
        <div className="text-2xl font-bold text-blue-600 mb-1">
          {timing.optimalTimingScore}/100
        </div>
        <div className="text-sm text-gray-600">Timing Score</div>
      </div>

      <div className="space-y-3">
        <div>
          <h5 className="text-sm font-semibold text-gray-700 mb-1">Current Trends</h5>
          {timing.currentTrends.slice(0, 2).map((trend: any, index: number) => (
            <div key={index} className="text-sm text-gray-600 flex items-center justify-between">
              <span>{trend.trend}</span>
              <span className="text-green-600">{trend.strength}/100</span>
            </div>
          ))}
        </div>

        <div>
          <h5 className="text-sm font-semibold text-gray-700 mb-1">Optimal Release Window</h5>
          {timing.releaseWindowRecommendations.slice(0, 1).map((window: any, index: number) => (
            <div key={index} className="text-sm text-gray-600">
              <div>{window.start_date} - {window.end_date}</div>
              <div className="text-xs text-gray-500">{window.reasoning}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

const CompetitivePositionPanel: React.FC<{ position: CompetitivePosition }> = ({ position }) => {
  return (
    <div className="space-y-4">
      <div className="text-center">
        <div className="text-2xl font-bold text-blue-600 mb-1">
          #{position.ranking}
        </div>
        <div className="text-sm text-gray-600">
          out of {position.total_in_category} similar pitches
        </div>
        <div className="text-xs text-gray-500">
          {position.percentile}th percentile
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <h5 className="text-sm font-semibold text-green-700 mb-2">Strengths vs Competition</h5>
          <ul className="space-y-1">
            {position.strengths_vs_competition.map((strength, index) => (
              <li key={index} className="text-xs text-green-600">
                • {strength}
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h5 className="text-sm font-semibold text-red-700 mb-2">Areas to Improve</h5>
          <ul className="space-y-1">
            {position.weaknesses_vs_competition.map((weakness, index) => (
              <li key={index} className="text-xs text-red-600">
                • {weakness}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
};

const ComparableProjectsList: React.FC<{ comparables: any[] }> = ({ comparables }) => {
  return (
    <div className="space-y-3">
      {comparables.slice(0, 3).map((project, index) => (
        <div key={index} className="border border-gray-200 rounded-lg p-3">
          <div className="flex items-center justify-between mb-2">
            <h5 className="font-medium text-gray-900">{project.title}</h5>
            <span className="text-sm text-blue-600">{project.relevance_score}% match</span>
          </div>
          <div className="text-sm text-gray-600">
            <div>Genre: {project.genre} • Year: {project.year}</div>
            <div>Budget: ${(project.budget / 1000000).toFixed(1)}M • ROI: {project.roi}%</div>
          </div>
        </div>
      ))}

      {comparables.length === 0 && (
        <div className="text-center py-4 text-gray-500">
          <Film className="w-8 h-8 mx-auto mb-2 text-gray-400" />
          <p className="text-sm">No comparable projects found</p>
        </div>
      )}
    </div>
  );
};

export default ValidationDashboard;