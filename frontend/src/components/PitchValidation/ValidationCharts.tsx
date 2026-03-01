/**
 * Advanced Validation Scoring Visualizations
 * Beautiful charts and interactive data visualizations
 */

import React, { useState, useMemo } from 'react';
import {
  AreaChart, Area, BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  ScatterChart, Scatter, ComposedChart, Treemap,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';
import { 
  TrendingUp, TrendingDown, BarChart3, PieChart as PieIcon,
  Target, Award, DollarSign, Users, Calendar, Star,
  ChevronDown, Filter, Download, Share2, Info
} from 'lucide-react';

import type {
  ValidationCategories,
  CategoryScore,
  ValidationScore,
  ComparableProject,
  BenchmarkData,
  ScoreTrend
} from '@shared/types/pitch-validation.types';

// Main chart container component
export const ValidationChartsContainer: React.FC<{
  validationData: ValidationScore;
  trends?: ScoreTrend[];
  comparables?: ComparableProject[];
  benchmarks?: BenchmarkData[];
  className?: string;
}> = ({ validationData, trends, comparables, benchmarks, className = '' }) => {
  const [activeChart, setActiveChart] = useState<string>('category-breakdown');

  const chartOptions = [
    { id: 'category-breakdown', label: 'Category Breakdown', icon: PieIcon },
    { id: 'radar-analysis', label: 'Performance Radar', icon: Target },
    { id: 'trend-analysis', label: 'Score Trends', icon: TrendingUp },
    { id: 'competitive-analysis', label: 'Market Position', icon: Award },
    { id: 'benchmark-comparison', label: 'Industry Benchmarks', icon: BarChart3 },
    { id: 'success-prediction', label: 'Success Scenarios', icon: Star }
  ];

  return (
    <div className={`validation-charts-container space-y-6 ${className}`}>
      {/* Chart Selection */}
      <ChartSelector 
        options={chartOptions} 
        activeChart={activeChart} 
        onChartChange={setActiveChart} 
      />

      {/* Chart Display */}
      <div className="bg-white rounded-lg shadow border border-gray-200 p-6">
        {activeChart === 'category-breakdown' && (
          <CategoryBreakdownChart categories={validationData.categories} />
        )}
        
        {activeChart === 'radar-analysis' && (
          <RadarAnalysisChart categories={validationData.categories} />
        )}
        
        {activeChart === 'trend-analysis' && trends && (
          <TrendAnalysisChart trends={trends} />
        )}
        
        {activeChart === 'competitive-analysis' && comparables && (
          <CompetitiveAnalysisChart 
            comparables={comparables} 
            currentScore={validationData.overallScore}
          />
        )}
        
        {activeChart === 'benchmark-comparison' && benchmarks && (
          <BenchmarkComparisonChart benchmarks={benchmarks} />
        )}
        
        {activeChart === 'success-prediction' && (
          <SuccessPredictionChart prediction={validationData.aiInsights.successPrediction} />
        )}
      </div>
    </div>
  );
};

// Chart selector component
const ChartSelector: React.FC<{
  options: Array<{ id: string; label: string; icon: any }>;
  activeChart: string;
  onChartChange: (chartId: string) => void;
}> = ({ options, activeChart, onChartChange }) => {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((option) => {
        const Icon = option.icon;
        return (
          <button
            key={option.id}
            onClick={() => onChartChange(option.id)}
            className={`
              flex items-center space-x-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors
              ${activeChart === option.id
                ? 'bg-blue-600 text-white shadow-md'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }
            `}
          >
            <Icon className="w-4 h-4" />
            <span>{option.label}</span>
          </button>
        );
      })}
    </div>
  );
};

// Category breakdown pie and donut charts
const CategoryBreakdownChart: React.FC<{ categories: ValidationCategories }> = ({ categories }) => {
  const data = Object.entries(categories).map(([key, category]) => ({
    name: key.charAt(0).toUpperCase() + key.slice(1),
    value: category.score,
    weight: category.weight,
    fill: getCategoryColor(key)
  }));

  const weightedData = Object.entries(categories).map(([key, category]) => ({
    name: key.charAt(0).toUpperCase() + key.slice(1),
    value: (category.score * category.weight) / 100,
    fill: getCategoryColor(key, 0.7)
  }));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Category Performance</h3>
        <div className="flex items-center space-x-2 text-sm text-gray-600">
          <Info className="w-4 h-4" />
          <span>Raw scores vs. weighted contribution</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Raw Scores Pie Chart */}
        <div>
          <h4 className="text-sm font-medium text-gray-700 mb-3">Raw Category Scores</h4>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                outerRadius={80}
                dataKey="value"
                label={({ name, value }) => `${name}: ${value}`}
                labelLine={false}
              >
                {data.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.fill} />
                ))}
              </Pie>
              <Tooltip 
                formatter={(value: number) => [`${value}/100`, 'Score']}
                contentStyle={{ 
                  backgroundColor: 'white', 
                  border: '1px solid #e2e8f0',
                  borderRadius: '8px'
                }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Weighted Contribution Donut Chart */}
        <div>
          <h4 className="text-sm font-medium text-gray-700 mb-3">Weighted Contribution</h4>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={weightedData}
                cx="50%"
                cy="50%"
                innerRadius={40}
                outerRadius={80}
                dataKey="value"
                label={({ name, value }) => `${name}: ${value.toFixed(1)}`}
                labelLine={false}
              >
                {weightedData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.fill} />
                ))}
              </Pie>
              <Tooltip 
                formatter={(value: number) => [`${value.toFixed(1)} pts`, 'Contribution']}
                contentStyle={{ 
                  backgroundColor: 'white', 
                  border: '1px solid #e2e8f0',
                  borderRadius: '8px'
                }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Category Details Table */}
      <CategoryDetailsTable categories={categories} />
    </div>
  );
};

// Radar chart for performance analysis
const RadarAnalysisChart: React.FC<{ categories: ValidationCategories }> = ({ categories }) => {
  const data = Object.entries(categories).map(([key, category]) => ({
    category: key.charAt(0).toUpperCase() + key.slice(1),
    score: category.score,
    confidence: category.confidence,
    benchmark: 60 // Industry average (would come from actual data)
  }));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Performance Radar Analysis</h3>
        <div className="flex items-center space-x-4 text-sm">
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
            <span>Your Score</span>
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 bg-gray-400 rounded-full"></div>
            <span>Industry Avg</span>
          </div>
        </div>
      </div>

      <ResponsiveContainer width="100%" height={400}>
        <RadarChart data={data} margin={{ top: 20, right: 80, bottom: 20, left: 80 }}>
          <PolarGrid />
          <PolarAngleAxis dataKey="category" />
          <PolarRadiusAxis 
            domain={[0, 100]} 
            tick={false}
            axisLine={false}
          />
          <Radar
            name="Your Score"
            dataKey="score"
            stroke="#3B82F6"
            fill="#3B82F6"
            fillOpacity={0.2}
            strokeWidth={2}
          />
          <Radar
            name="Industry Avg"
            dataKey="benchmark"
            stroke="#9CA3AF"
            fill="none"
            strokeWidth={1}
            strokeDasharray="5 5"
          />
          <Tooltip 
            content={({ active, payload, label }) => {
              if (active && payload && payload.length) {
                const data = payload[0].payload;
                return (
                  <div className="bg-white p-3 border border-gray-200 rounded-lg shadow">
                    <p className="font-semibold">{label}</p>
                    <p className="text-blue-600">Score: {data.score}/100</p>
                    <p className="text-gray-600">Confidence: {data.confidence}%</p>
                    <p className="text-gray-500">Industry Avg: {data.benchmark}/100</p>
                  </div>
                );
              }
              return null;
            }}
          />
        </RadarChart>
      </ResponsiveContainer>

      {/* Performance Insights */}
      <PerformanceInsights categories={categories} />
    </div>
  );
};

// Trend analysis chart
const TrendAnalysisChart: React.FC<{ trends: ScoreTrend[] }> = ({ trends }) => {
  const chartData = trends.map(trend => ({
    date: new Date(trend.date).toLocaleDateString(),
    overall: trend.overall_score,
    story: trend.category_scores.story?.score || 0,
    market: trend.category_scores.market?.score || 0,
    finance: trend.category_scores.finance?.score || 0,
    team: trend.category_scores.team?.score || 0,
    production: trend.category_scores.production?.score || 0
  }));

  const [showCategories, setShowCategories] = useState(false);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Score Evolution Over Time</h3>
        <div className="flex items-center space-x-2">
          <button
            onClick={() => setShowCategories(!showCategories)}
            className="flex items-center space-x-1 text-sm text-blue-600 hover:text-blue-800"
          >
            <span>{showCategories ? 'Hide' : 'Show'} Categories</span>
            <ChevronDown className={`w-4 h-4 transition-transform ${showCategories ? 'rotate-180' : ''}`} />
          </button>
        </div>
      </div>

      <ResponsiveContainer width="100%" height={400}>
        <ComposedChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="date" />
          <YAxis domain={[0, 100]} />
          
          {/* Overall score area */}
          <Area
            type="monotone"
            dataKey="overall"
            fill="#3B82F6"
            fillOpacity={0.3}
            stroke="#3B82F6"
            strokeWidth={3}
            name="Overall Score"
          />

          {/* Category lines */}
          {showCategories && (
            <>
              <Line type="monotone" dataKey="story" stroke="#EF4444" strokeWidth={2} name="Story" />
              <Line type="monotone" dataKey="market" stroke="#10B981" strokeWidth={2} name="Market" />
              <Line type="monotone" dataKey="finance" stroke="#F59E0B" strokeWidth={2} name="Finance" />
              <Line type="monotone" dataKey="team" stroke="#8B5CF6" strokeWidth={2} name="Team" />
              <Line type="monotone" dataKey="production" stroke="#06B6D4" strokeWidth={2} name="Production" />
            </>
          )}

          <Tooltip 
            contentStyle={{ 
              backgroundColor: 'white', 
              border: '1px solid #e2e8f0',
              borderRadius: '8px'
            }}
          />
          <Legend />
        </ComposedChart>
      </ResponsiveContainer>

      {/* Trend Insights */}
      <TrendInsights trends={trends} />
    </div>
  );
};

// Competitive analysis scatter chart
const CompetitiveAnalysisChart: React.FC<{ 
  comparables: ComparableProject[]; 
  currentScore: number;
}> = ({ comparables, currentScore }) => {
  const data = comparables.map(project => ({
    name: project.title,
    budget: project.budget / 1000000, // Convert to millions
    roi: project.roi,
    relevance: project.relevance_score,
    year: project.year
  }));

  // Add current project as a special point
  const currentProject = {
    name: 'Your Pitch',
    budget: 10, // Placeholder - would come from actual pitch data
    roi: 0, // No ROI yet
    relevance: 100,
    year: new Date().getFullYear(),
    isCurrent: true
  };

  const allData = [...data, currentProject];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Competitive Market Analysis</h3>
        <div className="flex items-center space-x-4 text-sm">
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
            <span>Your Pitch</span>
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 bg-gray-400 rounded-full"></div>
            <span>Comparables</span>
          </div>
        </div>
      </div>

      <ResponsiveContainer width="100%" height={400}>
        <ScatterChart
          data={allData}
          margin={{ top: 20, right: 20, bottom: 20, left: 20 }}
        >
          <CartesianGrid />
          <XAxis 
            type="number" 
            dataKey="budget" 
            name="Budget" 
            unit="M"
            label={{ value: 'Budget (Millions $)', position: 'insideBottom', offset: -10 }}
          />
          <YAxis 
            type="number" 
            dataKey="roi" 
            name="ROI" 
            unit="%"
            label={{ value: 'ROI (%)', angle: -90, position: 'insideLeft' }}
          />
          <Tooltip 
            content={({ active, payload }) => {
              if (active && payload && payload.length) {
                const data = payload[0].payload;
                return (
                  <div className="bg-white p-3 border border-gray-200 rounded-lg shadow">
                    <p className="font-semibold">{data.name}</p>
                    <p>Budget: ${data.budget}M</p>
                    <p>ROI: {data.roi}%</p>
                    <p>Year: {data.year}</p>
                    <p>Relevance: {data.relevance}%</p>
                  </div>
                );
              }
              return null;
            }}
          />
          <Scatter
            name="Projects"
            dataKey="roi"
            fill="#9CA3AF"
          />
        </ScatterChart>
      </ResponsiveContainer>

      {/* Market Insights */}
      <MarketInsights comparables={comparables} currentScore={currentScore} />
    </div>
  );
};

// Benchmark comparison chart
const BenchmarkComparisonChart: React.FC<{ benchmarks: BenchmarkData[] }> = ({ benchmarks }) => {
  const data = benchmarks.map(benchmark => ({
    category: benchmark.category.charAt(0).toUpperCase() + benchmark.category.slice(1),
    yourScore: benchmark.your_score,
    industryAvg: benchmark.industry_average,
    topQuartile: benchmark.top_quartile,
    percentile: benchmark.percentile
  }));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Industry Benchmark Comparison</h3>
        <div className="flex items-center space-x-4 text-sm">
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
            <span>Your Score</span>
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 bg-gray-400 rounded-full"></div>
            <span>Industry Average</span>
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 bg-green-500 rounded-full"></div>
            <span>Top Quartile</span>
          </div>
        </div>
      </div>

      <ResponsiveContainer width="100%" height={400}>
        <BarChart data={data} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="category" />
          <YAxis domain={[0, 100]} />
          <Tooltip 
            content={({ active, payload, label }) => {
              if (active && payload && payload.length) {
                const data = payload[0].payload;
                return (
                  <div className="bg-white p-3 border border-gray-200 rounded-lg shadow">
                    <p className="font-semibold">{label}</p>
                    <p className="text-blue-600">Your Score: {data.yourScore}/100</p>
                    <p className="text-gray-600">Industry Avg: {data.industryAvg}/100</p>
                    <p className="text-green-600">Top Quartile: {data.topQuartile}/100</p>
                    <p className="text-purple-600">Percentile: {data.percentile}th</p>
                  </div>
                );
              }
              return null;
            }}
          />
          <Legend />
          <Bar dataKey="topQuartile" fill="#10B981" name="Top Quartile" />
          <Bar dataKey="industryAvg" fill="#9CA3AF" name="Industry Average" />
          <Bar dataKey="yourScore" fill="#3B82F6" name="Your Score" />
        </BarChart>
      </ResponsiveContainer>

      {/* Benchmark Insights */}
      <BenchmarkInsights benchmarks={benchmarks} />
    </div>
  );
};

// Success prediction chart
const SuccessPredictionChart: React.FC<{ prediction: any }> = ({ prediction }) => {
  const scenarioData = prediction.scenarios.map((scenario: any) => ({
    scenario: scenario.scenario.charAt(0).toUpperCase() + scenario.scenario.slice(1),
    probability: scenario.probability,
    roiMin: scenario.roi_range[0],
    roiMax: scenario.roi_range[1],
    roiAvg: (scenario.roi_range[0] + scenario.roi_range[1]) / 2
  }));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Success Prediction Analysis</h3>
        <div className="text-right">
          <div className="text-2xl font-bold text-green-600">{prediction.probability}%</div>
          <div className="text-sm text-gray-600">Success Probability</div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Scenario Probability Chart */}
        <div>
          <h4 className="text-sm font-medium text-gray-700 mb-3">Scenario Probabilities</h4>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={scenarioData}
                cx="50%"
                cy="50%"
                outerRadius={80}
                dataKey="probability"
                label={({ scenario, probability }: any) => `${scenario}: ${probability}%`}
              >
                {scenarioData.map((entry: any, index: number) => (
                  <Cell key={`cell-${index}`} fill={getScenarioColor(entry.scenario)} />
                ))}
              </Pie>
              <Tooltip 
                formatter={(value: number) => [`${value}%`, 'Probability']}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* ROI Range Chart */}
        <div>
          <h4 className="text-sm font-medium text-gray-700 mb-3">Expected ROI Ranges</h4>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={scenarioData} layout="horizontal">
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis type="number" domain={[0, 'dataMax']} />
              <YAxis type="category" dataKey="scenario" width={80} />
              <Tooltip 
                formatter={(value: number, name: string) => [
                  name === 'roiMin' ? `${value}%` : `${value}%`,
                  name === 'roiMin' ? 'Min ROI' : 'Max ROI'
                ]}
              />
              <Bar dataKey="roiMin" fill="#FCA5A5" name="Min ROI" />
              <Bar dataKey="roiMax" fill="#34D399" name="Max ROI" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Key Factors */}
      <div>
        <h4 className="text-sm font-medium text-gray-700 mb-3">Key Success Factors</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {prediction.keyFactors.map((factor: string, index: number) => (
            <div key={index} className="flex items-center space-x-2 bg-gray-50 rounded-lg p-3">
              <Star className="w-4 h-4 text-yellow-500" />
              <span className="text-sm text-gray-700">{factor}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

// Helper components and functions

const CategoryDetailsTable: React.FC<{ categories: ValidationCategories }> = ({ categories }) => {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-200">
            <th className="text-left py-2 px-3 font-medium text-gray-700">Category</th>
            <th className="text-center py-2 px-3 font-medium text-gray-700">Score</th>
            <th className="text-center py-2 px-3 font-medium text-gray-700">Weight</th>
            <th className="text-center py-2 px-3 font-medium text-gray-700">Confidence</th>
            <th className="text-center py-2 px-3 font-medium text-gray-700">Contribution</th>
          </tr>
        </thead>
        <tbody>
          {Object.entries(categories).map(([key, category]) => (
            <tr key={key} className="border-b border-gray-100">
              <td className="py-2 px-3 font-medium text-gray-900 capitalize">{key}</td>
              <td className="py-2 px-3 text-center">
                <span className={`font-semibold ${getScoreTextColor(category.score)}`}>
                  {category.score}/100
                </span>
              </td>
              <td className="py-2 px-3 text-center text-gray-600">{category.weight}%</td>
              <td className="py-2 px-3 text-center text-gray-600">{category.confidence}%</td>
              <td className="py-2 px-3 text-center font-medium">
                {((category.score * category.weight) / 100).toFixed(1)} pts
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

const PerformanceInsights: React.FC<{ categories: ValidationCategories }> = ({ categories }) => {
  const insights = useMemo(() => {
    const scores = Object.values(categories).map(cat => cat.score);
    const strongest = Object.entries(categories).reduce((a, b) => a[1].score > b[1].score ? a : b);
    const weakest = Object.entries(categories).reduce((a, b) => a[1].score < b[1].score ? a : b);
    const avgScore = scores.reduce((a, b) => a + b, 0) / scores.length;

    return {
      strongest: { name: strongest[0], score: strongest[1].score },
      weakest: { name: weakest[0], score: weakest[1].score },
      average: Math.round(avgScore),
      aboveAverage: scores.filter(score => score > avgScore).length,
      belowAverage: scores.filter(score => score < avgScore).length
    };
  }, [categories]);

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      <div className="bg-green-50 rounded-lg p-4">
        <div className="flex items-center space-x-2 mb-2">
          <TrendingUp className="w-4 h-4 text-green-600" />
          <span className="text-sm font-medium text-green-700">Strongest Area</span>
        </div>
        <div className="text-lg font-bold text-green-800 capitalize">{insights.strongest.name}</div>
        <div className="text-sm text-green-600">{insights.strongest.score}/100</div>
      </div>

      <div className="bg-red-50 rounded-lg p-4">
        <div className="flex items-center space-x-2 mb-2">
          <TrendingDown className="w-4 h-4 text-red-600" />
          <span className="text-sm font-medium text-red-700">Needs Attention</span>
        </div>
        <div className="text-lg font-bold text-red-800 capitalize">{insights.weakest.name}</div>
        <div className="text-sm text-red-600">{insights.weakest.score}/100</div>
      </div>

      <div className="bg-blue-50 rounded-lg p-4">
        <div className="flex items-center space-x-2 mb-2">
          <Target className="w-4 h-4 text-blue-600" />
          <span className="text-sm font-medium text-blue-700">Overall Balance</span>
        </div>
        <div className="text-lg font-bold text-blue-800">{insights.average}/100</div>
        <div className="text-sm text-blue-600">
          {insights.aboveAverage} above, {insights.belowAverage} below average
        </div>
      </div>
    </div>
  );
};

const TrendInsights: React.FC<{ trends: ScoreTrend[] }> = ({ trends }) => {
  const insights = useMemo(() => {
    if (trends.length < 2) return null;

    const latest = trends[trends.length - 1];
    const previous = trends[trends.length - 2];
    const change = latest.overall_score - previous.overall_score;

    return {
      change,
      trend: change > 0 ? 'improving' : change < 0 ? 'declining' : 'stable',
      totalImprovement: latest.overall_score - trends[0].overall_score,
      timespan: trends.length - 1
    };
  }, [trends]);

  if (!insights) return null;

  return (
    <div className="bg-gray-50 rounded-lg p-4">
      <h4 className="text-sm font-medium text-gray-700 mb-3">Trend Analysis</h4>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
        <div>
          <span className="text-gray-600">Recent Change:</span>
          <div className={`font-semibold ${
            insights.change > 0 ? 'text-green-600' : 
            insights.change < 0 ? 'text-red-600' : 'text-gray-600'
          }`}>
            {insights.change > 0 ? '+' : ''}{insights.change} points
          </div>
        </div>
        <div>
          <span className="text-gray-600">Overall Trend:</span>
          <div className={`font-semibold capitalize ${
            insights.trend === 'improving' ? 'text-green-600' : 
            insights.trend === 'declining' ? 'text-red-600' : 'text-gray-600'
          }`}>
            {insights.trend}
          </div>
        </div>
        <div>
          <span className="text-gray-600">Total Progress:</span>
          <div className={`font-semibold ${
            insights.totalImprovement > 0 ? 'text-green-600' : 
            insights.totalImprovement < 0 ? 'text-red-600' : 'text-gray-600'
          }`}>
            {insights.totalImprovement > 0 ? '+' : ''}{insights.totalImprovement} points
          </div>
        </div>
      </div>
    </div>
  );
};

const MarketInsights: React.FC<{ 
  comparables: ComparableProject[]; 
  currentScore: number; 
}> = ({ comparables, currentScore }) => {
  const insights = useMemo(() => {
    const avgROI = comparables.reduce((sum, comp) => sum + comp.roi, 0) / comparables.length;
    const avgBudget = comparables.reduce((sum, comp) => sum + comp.budget, 0) / comparables.length;
    const topPerformer = comparables.reduce((best, comp) => comp.roi > best.roi ? comp : best);
    
    return {
      avgROI: Math.round(avgROI),
      avgBudget: Math.round(avgBudget / 1000000),
      topPerformer,
      totalProjects: comparables.length
    };
  }, [comparables]);

  return (
    <div className="bg-gray-50 rounded-lg p-4">
      <h4 className="text-sm font-medium text-gray-700 mb-3">Market Insights</h4>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
        <div>
          <span className="text-gray-600">Avg ROI:</span>
          <div className="font-semibold text-gray-900">{insights.avgROI}%</div>
        </div>
        <div>
          <span className="text-gray-600">Avg Budget:</span>
          <div className="font-semibold text-gray-900">${insights.avgBudget}M</div>
        </div>
        <div>
          <span className="text-gray-600">Top Performer:</span>
          <div className="font-semibold text-gray-900" title={insights.topPerformer.title}>
            {insights.topPerformer.roi}% ROI
          </div>
        </div>
        <div>
          <span className="text-gray-600">Comparables:</span>
          <div className="font-semibold text-gray-900">{insights.totalProjects} projects</div>
        </div>
      </div>
    </div>
  );
};

const BenchmarkInsights: React.FC<{ benchmarks: BenchmarkData[] }> = ({ benchmarks }) => {
  const insights = useMemo(() => {
    const avgPercentile = benchmarks.reduce((sum, b) => sum + b.percentile, 0) / benchmarks.length;
    const aboveAverage = benchmarks.filter(b => b.your_score >= b.industry_average).length;
    const topQuartile = benchmarks.filter(b => b.your_score >= b.top_quartile).length;
    
    return {
      avgPercentile: Math.round(avgPercentile),
      aboveAverage,
      topQuartile,
      total: benchmarks.length
    };
  }, [benchmarks]);

  return (
    <div className="bg-gray-50 rounded-lg p-4">
      <h4 className="text-sm font-medium text-gray-700 mb-3">Benchmark Summary</h4>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
        <div>
          <span className="text-gray-600">Avg Percentile:</span>
          <div className="font-semibold text-blue-600">{insights.avgPercentile}th</div>
        </div>
        <div>
          <span className="text-gray-600">Above Average:</span>
          <div className="font-semibold text-green-600">
            {insights.aboveAverage}/{insights.total}
          </div>
        </div>
        <div>
          <span className="text-gray-600">Top Quartile:</span>
          <div className="font-semibold text-green-600">
            {insights.topQuartile}/{insights.total}
          </div>
        </div>
        <div>
          <span className="text-gray-600">Competitive Level:</span>
          <div className="font-semibold text-gray-900">
            {insights.avgPercentile >= 75 ? 'Strong' : 
             insights.avgPercentile >= 50 ? 'Average' : 'Improving'}
          </div>
        </div>
      </div>
    </div>
  );
};

// Utility functions
const getCategoryColor = (category: string, opacity: number = 1) => {
  const colors: Record<string, string> = {
    story: '#EF4444',
    market: '#10B981', 
    finance: '#F59E0B',
    team: '#8B5CF6',
    production: '#06B6D4'
  };
  
  const baseColor = colors[category] || '#6B7280';
  if (opacity === 1) return baseColor;
  
  // Convert hex to rgba with opacity
  const r = parseInt(baseColor.slice(1, 3), 16);
  const g = parseInt(baseColor.slice(3, 5), 16);
  const b = parseInt(baseColor.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${opacity})`;
};

const getScoreTextColor = (score: number) => {
  if (score >= 80) return 'text-green-600';
  if (score >= 60) return 'text-yellow-600';
  if (score >= 40) return 'text-orange-600';
  return 'text-red-600';
};

const getScenarioColor = (scenario: string) => {
  const colors: Record<string, string> = {
    pessimistic: '#EF4444',
    realistic: '#F59E0B',
    optimistic: '#10B981'
  };
  return colors[scenario.toLowerCase()] || '#6B7280';
};

export default ValidationChartsContainer;