import React, { useState, useEffect, useCallback } from 'react';
import { Calendar, DollarSign, TrendingUp, TrendingDown, Download, Search, Eye} from 'lucide-react';
import { investorApi } from '../../services/investor.service';

interface Transaction {
  id: number;
  type: 'investment' | 'return' | 'dividend' | 'fee' | 'withdrawal';
  amount: number;
  investmentId: number;
  pitchTitle: string;
  pitchGenre?: string;
  creatorName?: string;
  status: 'completed' | 'pending' | 'failed';
  date: Date;
  description?: string;
  relatedTransactionId?: number;
}

interface TransactionHistoryProps {
  userType: 'investor' | 'creator' | 'production';
  className?: string;
  compact?: boolean;
  maxItems?: number;
}

export default function TransactionHistory({ 
  userType, 
  className = '',
  compact = false,
  maxItems 
}: TransactionHistoryProps) {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'date' | 'amount' | 'type'>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const pageSize = compact ? (maxItems || 5) : 20;

  const fetchTransactions = useCallback(async () => {
    try {
      setLoading(true);

      const response = await investorApi.getTransactions({
        page: currentPage,
        limit: pageSize,
        type: filterType !== 'all' ? filterType : undefined,
        search: searchTerm || undefined,
      });

      if (response.success && response.data) {
        const data = response.data as any;
        const rawTransactions: any[] = data.transactions || [];

        // Map API response to local Transaction type
        const mapped: Transaction[] = rawTransactions.map((t: any) => ({
          id: t.id,
          type: (t.type || 'investment') as Transaction['type'],
          amount: Number(t.amount) || 0,
          investmentId: t.investment_id || t.investmentId || 0,
          pitchTitle: t.pitch_title || t.pitchTitle || '',
          pitchGenre: t.genre || t.pitchGenre,
          creatorName: t.creator_name || t.creatorName,
          status: (t.status || 'completed') as Transaction['status'],
          date: new Date(t.created_at || t.date || Date.now()),
          description: t.description || t.notes,
          relatedTransactionId: t.related_transaction_id || t.relatedTransactionId,
        }));

        // Apply client-side status filter (if API doesn't support it)
        const filtered = filterStatus === 'all'
          ? mapped
          : mapped.filter(t => t.status === filterStatus);

        // Apply client-side sorting
        filtered.sort((a, b) => {
          let comparison = 0;
          switch (sortBy) {
            case 'date':
              comparison = new Date(a.date).getTime() - new Date(b.date).getTime();
              break;
            case 'amount':
              comparison = Math.abs(a.amount) - Math.abs(b.amount);
              break;
            case 'type':
              comparison = a.type.localeCompare(b.type);
              break;
          }
          return sortOrder === 'desc' ? -comparison : comparison;
        });

        setTransactions(filtered);
        setTotalPages(data.totalPages || data.total_pages || Math.ceil((data.total || filtered.length) / pageSize));
      } else {
        setTransactions([]);
        setTotalPages(1);
      }
    } catch (err) {
      const e = err instanceof Error ? err : new Error(String(err));
      console.error('Error fetching transactions:', e.message);
      setTransactions([]);
    } finally {
      setLoading(false);
    }
  }, [currentPage, filterType, filterStatus, sortBy, sortOrder, searchTerm, pageSize]);

  useEffect(() => {
    void fetchTransactions();
  }, [fetchTransactions]);

  const formatCurrency = useCallback((amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      notation: 'compact',
      maximumFractionDigits: 1
    }).format(Math.abs(amount));
  }, []);

  const formatDate = useCallback((date: Date) => {
    return new Date(date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  }, []);

  const getTransactionIcon = (type: string) => {
    switch (type) {
      case 'investment':
        return <DollarSign className="w-4 h-4" />;
      case 'return':
        return <TrendingUp className="w-4 h-4" />;
      case 'dividend':
        return <TrendingUp className="w-4 h-4" />;
      case 'fee':
        return <TrendingDown className="w-4 h-4" />;
      case 'withdrawal':
        return <TrendingDown className="w-4 h-4" />;
      default:
        return <DollarSign className="w-4 h-4" />;
    }
  };

  const getTransactionColor = (type: string, amount: number) => {
    if (amount < 0 || type === 'fee' || type === 'withdrawal') {
      return 'text-red-600 bg-red-50';
    }
    if (type === 'return' || type === 'dividend') {
      return 'text-green-600 bg-green-50';
    }
    return 'text-blue-600 bg-blue-50';
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-green-100 text-green-800';
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      case 'failed':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const exportTransactions = useCallback(() => {
    const csvContent = [
      'Date,Type,Amount,Status,Pitch,Creator,Description',
      ...transactions.map(t => 
        `${formatDate(t.date)},${t.type},${t.amount},${t.status},"${t.pitchTitle}","${t.creatorName || ''}","${t.description || ''}"`
      )
    ].join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `transaction-history-${Date.now()}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [transactions, formatDate]);

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
      {/* Header */}
      {!compact && (
        <div className="px-6 py-4 border-b">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <h3 className="text-lg font-semibold text-gray-900">Transaction History</h3>
            
            <div className="flex flex-wrap items-center gap-3">
              {/* Search */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <input
                  type="text"
                  placeholder="Search transactions..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Filters */}
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                className="text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">All Types</option>
                <option value="investment">Investments</option>
                <option value="return">Returns</option>
                <option value="dividend">Dividends</option>
                <option value="fee">Fees</option>
                <option value="withdrawal">Withdrawals</option>
              </select>

              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">All Status</option>
                <option value="completed">Completed</option>
                <option value="pending">Pending</option>
                <option value="failed">Failed</option>
              </select>

              {/* Sort */}
              <select
                value={`${sortBy}-${sortOrder}`}
                onChange={(e) => {
                  const [field, order] = e.target.value.split('-');
                  setSortBy(field as any);
                  setSortOrder(order as any);
                }}
                className="text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="date-desc">Latest First</option>
                <option value="date-asc">Oldest First</option>
                <option value="amount-desc">Highest Amount</option>
                <option value="amount-asc">Lowest Amount</option>
                <option value="type-asc">Type A-Z</option>
              </select>

              {/* Export */}
              <button
                onClick={exportTransactions}
                className="flex items-center gap-2 px-3 py-2 text-sm text-gray-600 hover:text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                <Download className="w-4 h-4" />
                Export
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Transactions List */}
      <div className="p-6">
        {transactions.length === 0 ? (
          <div className="text-center py-8">
            <Calendar className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500 mb-2">No transactions found</p>
            <p className="text-sm text-gray-400">
              {searchTerm || filterType !== 'all' || filterStatus !== 'all' 
                ? 'Try adjusting your filters' 
                : 'Transactions will appear here as you invest'}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {transactions.map((transaction) => (
              <div
                key={transaction.id}
                className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-start gap-4 flex-1">
                  <div className={`p-2 rounded-lg ${getTransactionColor(transaction.type, transaction.amount)}`}>
                    {getTransactionIcon(transaction.type)}
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-1">
                      <h4 className="font-medium text-gray-900 capitalize">
                        {transaction.type.replace('_', ' ')}
                      </h4>
                      <span className={`px-2 py-1 text-xs rounded-full ${getStatusColor(transaction.status)}`}>
                        {transaction.status}
                      </span>
                    </div>
                    
                    <p className="text-sm text-gray-600 mb-1">
                      {transaction.pitchTitle} {transaction.creatorName && `by ${transaction.creatorName}`}
                    </p>
                    
                    {transaction.description && (
                      <p className="text-xs text-gray-500 mb-2">{transaction.description}</p>
                    )}
                    
                    <div className="flex items-center gap-4 text-xs text-gray-500">
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {formatDate(transaction.date)}
                      </span>
                      {transaction.pitchGenre && (
                        <span className="bg-gray-100 px-2 py-1 rounded">
                          {transaction.pitchGenre}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="text-right">
                  <p className={`font-semibold ${
                    transaction.amount < 0 ? 'text-red-600' : 'text-green-600'
                  }`}>
                    {transaction.amount < 0 ? '-' : '+'}
                    {formatCurrency(transaction.amount)}
                  </p>
                  <button className="text-xs text-blue-600 hover:text-blue-700 flex items-center gap-1 mt-1">
                    <Eye className="w-3 h-3" />
                    Details
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Pagination */}
        {!compact && totalPages > 1 && (
          <div className="flex items-center justify-between mt-6 pt-4 border-t">
            <p className="text-sm text-gray-500">
              Page {currentPage} of {totalPages}
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="px-3 py-1 text-sm border border-gray-300 rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
              >
                Previous
              </button>
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