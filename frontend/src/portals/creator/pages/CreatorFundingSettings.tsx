import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft, DollarSign, Target, RefreshCw,
  AlertCircle, Save, TrendingUp, Users, Wallet
} from 'lucide-react';
import { InvestmentService } from '@features/deals/services/investment.service';

interface FundingGoals {
  fundingGoal: number;
  minimumInvestment: number;
  maximumInvestment: number;
  preferredInvestorTypes: string[];
  acceptingInvestments: boolean;
}

const INVESTOR_TYPES = [
  'Angel Investor',
  'Venture Capital',
  'Production Company',
  'Private Equity',
  'Individual',
  'Corporate',
  'Government Grant'
];

export default function CreatorFundingSettings() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [currentRaised, setCurrentRaised] = useState(0);
  const [activeInvestors, setActiveInvestors] = useState(0);
  const [goals, setGoals] = useState<FundingGoals>({
    fundingGoal: 0,
    minimumInvestment: 0,
    maximumInvestment: 0,
    preferredInvestorTypes: [],
    acceptingInvestments: true
  });

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 0
    }).format(amount);
  };

  const loadFundingData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await InvestmentService.getCreatorFunding();

      if (response.success && response.data) {
        const data = response.data;
        setCurrentRaised(data.totalRaised || 0);
        setActiveInvestors(data.activeInvestors || 0);
        setGoals(prev => ({
          ...prev,
          fundingGoal: data.fundingGoal || prev.fundingGoal,
        }));
      }
    } catch (err) {
      const e = err instanceof Error ? err : new Error(String(err));
      console.error('Failed to load funding data:', e);
      setError('Failed to load funding settings.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadFundingData();
  }, [loadFundingData]);

  const handleSave = async () => {
    try {
      setSaving(true);
      setError(null);
      setSuccess(null);

      const API_URL = import.meta.env.VITE_API_URL || '';
      await fetch(`${API_URL}/api/creator/funding-settings`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(goals),
      });

      setSuccess('Funding settings saved successfully.');
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      const e = err instanceof Error ? err : new Error(String(err));
      console.error('Failed to save funding settings:', e);
      setError('Failed to save settings. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const toggleInvestorType = (type: string) => {
    setGoals(prev => ({
      ...prev,
      preferredInvestorTypes: prev.preferredInvestorTypes.includes(type)
        ? prev.preferredInvestorTypes.filter(t => t !== type)
        : [...prev.preferredInvestorTypes, type]
    }));
  };

  const progressPercentage = goals.fundingGoal > 0
    ? Math.min((currentRaised / goals.fundingGoal) * 100, 100)
    : 0;

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-gray-200 rounded w-1/3" />
          <div className="h-4 bg-gray-200 rounded w-1/2" />
          <div className="bg-white rounded-xl p-6 space-y-4">
            <div className="h-6 bg-gray-200 rounded w-1/4" />
            <div className="h-10 bg-gray-200 rounded" />
            <div className="h-10 bg-gray-200 rounded" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/creator/dashboard')}
            className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-gray-600" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Funding Settings</h1>
            <p className="text-gray-600">Manage your funding goals and investor preferences</p>
          </div>
        </div>
        <button
          onClick={loadFundingData}
          className="p-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* Alerts */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
          <div className="flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-red-600" />
            <p className="text-red-700">{error}</p>
          </div>
        </div>
      )}
      {success && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
          <div className="flex items-center gap-3">
            <Save className="w-5 h-5 text-green-600" />
            <p className="text-green-700">{success}</p>
          </div>
        </div>
      )}

      {/* Current Status */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <div className="bg-white rounded-xl shadow-sm border p-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-green-50 rounded-lg flex items-center justify-center">
              <DollarSign className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Total Raised</p>
              <p className="text-2xl font-bold text-gray-900">{formatCurrency(currentRaised)}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border p-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center">
              <Users className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Active Investors</p>
              <p className="text-2xl font-bold text-gray-900">{activeInvestors}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border p-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-purple-50 rounded-lg flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Progress</p>
              <p className="text-2xl font-bold text-gray-900">{progressPercentage.toFixed(0)}%</p>
            </div>
          </div>
        </div>
      </div>

      {/* Funding Goal */}
      <div className="bg-white rounded-xl shadow-sm border p-6 mb-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <Target className="w-5 h-5 text-orange-500" />
          Funding Goal
        </h2>

        {goals.fundingGoal > 0 && (
          <div className="mb-4">
            <div className="flex justify-between text-sm mb-1">
              <span className="text-gray-600">{formatCurrency(currentRaised)} raised</span>
              <span className="text-gray-600">Goal: {formatCurrency(goals.fundingGoal)}</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-3">
              <div
                className="bg-gradient-to-r from-green-500 to-green-600 h-3 rounded-full transition-all duration-300"
                style={{ width: `${progressPercentage}%` }}
              />
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Overall Funding Goal ($)</label>
            <input
              type="number"
              value={goals.fundingGoal || ''}
              onChange={e => setGoals(prev => ({ ...prev, fundingGoal: Number(e.target.value) }))}
              placeholder="e.g. 500000"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Minimum Investment ($)</label>
            <input
              type="number"
              value={goals.minimumInvestment || ''}
              onChange={e => setGoals(prev => ({ ...prev, minimumInvestment: Number(e.target.value) }))}
              placeholder="e.g. 1000"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Maximum Investment ($)</label>
            <input
              type="number"
              value={goals.maximumInvestment || ''}
              onChange={e => setGoals(prev => ({ ...prev, maximumInvestment: Number(e.target.value) }))}
              placeholder="e.g. 100000"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
        </div>
      </div>

      {/* Investor Preferences */}
      <div className="bg-white rounded-xl shadow-sm border p-6 mb-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <Wallet className="w-5 h-5 text-blue-500" />
          Investor Preferences
        </h2>

        <div className="mb-4">
          <div className="flex items-center justify-between mb-3">
            <label className="text-sm font-medium text-gray-700">Accepting Investments</label>
            <button
              onClick={() => setGoals(prev => ({ ...prev, acceptingInvestments: !prev.acceptingInvestments }))}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                goals.acceptingInvestments ? 'bg-green-500' : 'bg-gray-300'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  goals.acceptingInvestments ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>
          <p className="text-sm text-gray-500">
            {goals.acceptingInvestments
              ? 'Your pitches are open to investments from interested parties.'
              : 'Investment requests are currently paused.'}
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Preferred Investor Types</label>
          <div className="flex flex-wrap gap-2">
            {INVESTOR_TYPES.map(type => (
              <button
                key={type}
                onClick={() => toggleInvestorType(type)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  goals.preferredInvestorTypes.includes(type)
                    ? 'bg-blue-100 text-blue-700 border border-blue-200'
                    : 'bg-gray-100 text-gray-600 border border-gray-200 hover:bg-gray-200'
                }`}
              >
                {type}
              </button>
            ))}
          </div>
          <p className="text-sm text-gray-500 mt-2">
            Select the types of investors you prefer. Leave empty to accept all types.
          </p>
        </div>
      </div>

      {/* Save Button */}
      <div className="flex justify-end">
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          <Save className="w-4 h-4" />
          {saving ? 'Saving...' : 'Save Settings'}
        </button>
      </div>
    </div>
  );
}
