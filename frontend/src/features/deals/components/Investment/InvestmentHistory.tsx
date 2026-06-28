import React, { useState, useEffect } from 'react';
import { Clock, DollarSign, TrendingUp, TrendingDown, Eye, Calendar, ChevronRight, Filter } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface Investment {
  id: number;
  amount: number;
  pitchId: number;
  pitchTitle: string;
  pitchGenre?: string;
  creatorName?: string;
  status: 'pending' | 'active' | 'completed' | 'cancelled';
  investmentDate: Date;
  currentValue: number;
  returnAmount: number;
  returnPercentage: number;
  terms?: any;
  daysInvested?: number;
}

interface InvestmentHistoryProps {
  investments: Investment[];
  loading?: boolean;
  showPagination?: boolean;
  pageSize?: number;
  onInvestmentClick?: (investment: Investment) => void;
  className?: string;
}

export default function InvestmentHistory({ 
  investments, 
  loading = false,
  showPagination = true,
  pageSize = 10,
  onInvestmentClick,
  className = ''
}: InvestmentHistoryProps) {
  const navigate = useNavigate();
  const [currentPage, setCurrentPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'date' | 'amount' | 'return'>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // Filter and sort investments
  const filteredInvestments = investments
    .filter(inv => statusFilter === 'all' || inv.status === statusFilter)
    .sort((a, b) => {
      let comparison = 0;
      switch (sortBy) {
        case 'date':
          comparison = new Date(a.investmentDate).getTime() - new Date(b.investmentDate).getTime();
          break;
        case 'amount':
          comparison = a.amount - b.amount;
          break;
        case 'return':
          comparison = a.returnPercentage - b.returnPercentage;
          break;
      }
      return sortOrder === 'desc' ? -comparison : comparison;
    });

  // Pagination
  const totalPages = Math.ceil(filteredInvestments.length / pageSize);
  const startIndex = (currentPage - 1) * pageSize;
  const currentInvestments = filteredInvestments.slice(startIndex, startIndex + pageSize);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      notation: 'compact',
      maximumFractionDigits: 1
    }).format(amount);
  };

  const formatDate = (date: Date) => {
    return new Date(date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-green-100 text-green-800';
      case 'completed':
        return 'bg-blue-100 text-blue-800';
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      case 'cancelled':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const handleInvestmentClick = (investment: Investment) => {
    if (onInvestmentClick) {
      onInvestmentClick(investment);
    } else {
      void navigate(`/investment/${investment.id}`);
    }
  };

  if (loading) {
    return (
      <div className={`bg-white rounded-xl shadow-sm p-6 ${className}`}>
        <div className="animate-pulse">
          <div className="h-6 bg-gray-200 rounded w-1/4 mb-4"></div>
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-16 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`bg-white rounded-xl shadow-sm ${className}`}>
      {/* Header with Filters */}
      <div className="px-6 py-4 border-b">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <h3 className="text-lg font-semibold text-gray-900">Investment History</h3>
          
          <div className="flex items-center gap-3">
            {/* Status Filter */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="text-sm border border-gray-300 rounded-lg px-3 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Status</option>
              <option value="active">Active</option>
              <option value="completed">Completed</option>
              <option value="pending">Pending</option>
              <option value="cancelled">Cancelled</option>
            </select>

            {/* Sort Options */}
            <select
              value={`${sortBy}-${sortOrder}`}
              onChange={(e) => {
                const [field, order] = e.target.value.split('-');
                setSortBy(field as any);
                setSortOrder(order as any);
              }}
              className="text-sm border border-gray-300 rounded-lg px-3 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="date-desc">Latest First</option>
              <option value="date-asc">Oldest First</option>
              <option value="amount-desc">Highest Amount</option>
              <option value="amount-asc">Lowest Amount</option>
              <option value="return-desc">Best Returns</option>
              <option value="return-asc">Worst Returns</option>
            </select>
          </div>
        </div>
      </div>

      {/* Investment List */}
      <div className="p-6">
        {currentInvestments.length === 0 ? (
          <div className="text-center py-8">
            <DollarSign className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500 mb-2">No investments found</p>
            <p className="text-sm text-gray-400">
              {statusFilter !== 'all' ? 'Try changing the filter' : 'Start investing in film projects'}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {currentInvestments.map((investment) => (
              <div
                key={investment.id}
                onClick={() => handleInvestmentClick(investment)}
                className="border rounded-lg p-4 hover:shadow-md transition-shadow cursor-pointer"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-2">
                      <h4 className="font-semibold text-gray-900 truncate">
                        {investment.pitchTitle}
                      </h4>
                      <span className={`px-2 py-1 text-xs rounded-full ${getStatusColor(investment.status)}`}>
                        {investment.status}
                      </span>
                    </div>
                    
                    <div className="flex items-center gap-4 text-sm text-gray-500 mb-3">
                      {investment.pitchGenre && (
                        <span className="bg-gray-100 px-2 py-1 rounded">
                          {investment.pitchGenre}
                        </span>
                      )}
                      {investment.creatorName && (
                        <span>by {investment.creatorName}</span>
                      )}
                      <span className="flex items-center gap-1">
                        <Calendar className="w-4 h-4" />
                        {formatDate(investment.investmentDate)}
                      </span>
                      {investment.daysInvested && (
                        <span className="flex items-center gap-1">
                          <Clock className="w-4 h-4" />
                          {investment.daysInvested} days
                        </span>
                      )}
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                      <div>
                        <p className="text-xs text-gray-500">Investment</p>
                        <p className="font-semibold text-gray-900">{formatCurrency(investment.amount)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Current Value</p>
                        <p className="font-semibold text-gray-900">{formatCurrency(investment.currentValue)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Return</p>
                        <p className={`font-semibold ${investment.returnPercentage >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {formatCurrency(investment.returnAmount)}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">ROI</p>
                        <div className="flex items-center gap-1">
                          {investment.returnPercentage >= 0 ? (
                            <TrendingUp className="w-4 h-4 text-green-500" />
                          ) : (
                            <TrendingDown className="w-4 h-4 text-red-500" />
                          )}
                          <p className={`font-semibold ${investment.returnPercentage >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {investment.returnPercentage >= 0 ? '+' : ''}{investment.returnPercentage.toFixed(1)}%
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  <ChevronRight className="w-5 h-5 text-gray-400 flex-shrink-0 ml-4" />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Pagination */}
        {showPagination && totalPages > 1 && (
          <div className="flex items-center justify-between mt-6 pt-4 border-t">
            <p className="text-sm text-gray-500">
              Showing {startIndex + 1} to {Math.min(startIndex + pageSize, filteredInvestments.length)} of {filteredInvestments.length} investments
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="px-3 py-1 text-sm border border-gray-300 rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
              >
                Previous
              </button>
              <span className="text-sm text-gray-500">
                Page {currentPage} of {totalPages}
              </span>
              <button
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="px-3 py-1 text-sm border border-gray-300 rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}