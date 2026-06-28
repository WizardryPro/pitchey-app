import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Users, DollarSign, TrendingUp, ArrowLeft,
  RefreshCw, AlertCircle, Mail, Building2,
  MapPin, Clock, Filter
} from 'lucide-react';
import { InvestmentService } from '@features/deals/services/investment.service';

interface Investor {
  id: number;
  name: string;
  email?: string;
  company_name?: string;
  profile_image?: string;
  location?: string;
  bio?: string;
  total_investments: number;
  total_invested: number;
  last_investment?: string;
  first_investment?: string;
  activity_status: 'highly_active' | 'active' | 'inactive';
}

interface InvestorStats {
  totalInvestors: number;
  activeInvestors: number;
  totalRaised: number;
}

export default function CreatorInvestors() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [investors, setInvestors] = useState<Investor[]>([]);
  const [stats, setStats] = useState<InvestorStats>({ totalInvestors: 0, activeInvestors: 0, totalRaised: 0 });
  const [filter, setFilter] = useState<'all' | 'active' | 'inactive'>('all');

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      notation: 'compact',
      maximumFractionDigits: 1
    }).format(amount);
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const loadInvestors = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await InvestmentService.getCreatorInvestors();

      if (response.success && response.data) {
        const raw = response.data as any;
        setInvestors(raw.investors || []);
        setStats(raw.stats || { totalInvestors: 0, activeInvestors: 0, totalRaised: 0 });
      }
    } catch (err) {
      const e = err instanceof Error ? err : new Error(String(err));
      console.error('Failed to load investors:', e);
      setError('Failed to load investor data. Please try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadInvestors();
  }, [loadInvestors]);

  const filteredInvestors = investors.filter(inv => {
    if (filter === 'all') return true;
    if (filter === 'active') return inv.activity_status === 'highly_active' || inv.activity_status === 'active';
    return inv.activity_status === 'inactive';
  });

  const statusColors: Record<string, string> = {
    highly_active: 'bg-green-100 text-green-700',
    active: 'bg-blue-100 text-blue-700',
    inactive: 'bg-gray-100 text-gray-600'
  };

  const statusLabels: Record<string, string> = {
    highly_active: 'Highly Active',
    active: 'Active',
    inactive: 'Inactive'
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
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
            <h1 className="text-2xl font-bold text-gray-900">Your Investors</h1>
            <p className="text-gray-600">People who have invested in your pitches</p>
          </div>
        </div>
        <button
          onClick={loadInvestors}
          className="p-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <div className="bg-white rounded-xl shadow-sm border p-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center">
              <Users className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Total Investors</p>
              <p className="text-2xl font-bold text-gray-900">{stats.totalInvestors}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border p-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-green-50 rounded-lg flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Active Investors</p>
              <p className="text-2xl font-bold text-gray-900">{stats.activeInvestors}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border p-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-purple-50 rounded-lg flex items-center justify-center">
              <DollarSign className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Total Raised</p>
              <p className="text-2xl font-bold text-gray-900">{formatCurrency(stats.totalRaised)}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
          <div className="flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-red-600" />
            <p className="text-red-700">{error}</p>
            <button onClick={loadInvestors} className="ml-auto text-red-600 hover:text-red-800 font-medium">Retry</button>
          </div>
        </div>
      )}

      {/* Filter */}
      <div className="flex items-center gap-2 mb-6">
        <Filter className="w-4 h-4 text-gray-500" />
        {(['all', 'active', 'inactive'] as const).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              filter === f
                ? 'bg-blue-100 text-blue-700'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {f === 'all' ? 'All' : f === 'active' ? 'Active' : 'Inactive'}
          </button>
        ))}
      </div>

      {/* Investor List */}
      {loading ? (
        <div className="space-y-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="bg-white rounded-xl shadow-sm border p-6 animate-pulse">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-gray-200 rounded-full" />
                <div className="flex-1">
                  <div className="h-5 bg-gray-200 rounded w-1/4 mb-2" />
                  <div className="h-4 bg-gray-200 rounded w-1/3" />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : filteredInvestors.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border p-12 text-center">
          <Users className="w-16 h-16 mx-auto mb-4 text-gray-300" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            {filter !== 'all' ? 'No matching investors' : 'No investors yet'}
          </h3>
          <p className="text-gray-500">
            {filter !== 'all'
              ? 'Try changing the filter to see more investors.'
              : 'When investors fund your pitches, they\'ll appear here.'}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredInvestors.map(investor => (
            <div key={investor.id} className="bg-white rounded-xl shadow-sm border p-6 hover:shadow-md transition">
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-4">
                  {investor.profile_image ? (
                    <img
                      src={investor.profile_image}
                      alt={investor.name}
                      className="w-12 h-12 rounded-full object-cover"
                    />
                  ) : (
                    <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                      <span className="text-blue-600 font-semibold text-lg">
                        {investor.name?.charAt(0)?.toUpperCase() || '?'}
                      </span>
                    </div>
                  )}
                  <div>
                    <h3 className="font-semibold text-gray-900">{investor.name}</h3>
                    <div className="flex flex-wrap items-center gap-3 mt-1 text-sm text-gray-500">
                      {investor.company_name && (
                        <span className="flex items-center gap-1">
                          <Building2 className="w-3.5 h-3.5" />
                          {investor.company_name}
                        </span>
                      )}
                      {investor.location && (
                        <span className="flex items-center gap-1">
                          <MapPin className="w-3.5 h-3.5" />
                          {investor.location}
                        </span>
                      )}
                      {investor.email && (
                        <span className="flex items-center gap-1">
                          <Mail className="w-3.5 h-3.5" />
                          {investor.email}
                        </span>
                      )}
                    </div>
                    {investor.bio && (
                      <p className="text-sm text-gray-600 mt-2 line-clamp-2">{investor.bio}</p>
                    )}
                  </div>
                </div>
                <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${statusColors[investor.activity_status] || 'bg-gray-100 text-gray-600'}`}>
                  {statusLabels[investor.activity_status] || investor.activity_status}
                </span>
              </div>

              <div className="flex items-center gap-6 mt-4 pt-4 border-t">
                <div>
                  <p className="text-xs text-gray-500">Total Invested</p>
                  <p className="font-semibold text-green-600">{formatCurrency(Number(investor.total_invested))}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Investments</p>
                  <p className="font-semibold text-gray-900">{investor.total_investments}</p>
                </div>
                {investor.last_investment && (
                  <div className="flex items-center gap-1 text-sm text-gray-500">
                    <Clock className="w-3.5 h-3.5" />
                    Last: {formatDate(investor.last_investment)}
                  </div>
                )}
                <button
                  onClick={() => navigate('/creator/messages')}
                  className="ml-auto flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 text-blue-700 rounded-lg text-sm font-medium hover:bg-blue-100 transition-colors"
                >
                  <Mail className="w-3.5 h-3.5" />
                  Message
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
