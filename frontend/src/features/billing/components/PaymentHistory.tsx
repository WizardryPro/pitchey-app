import { useState, useEffect } from 'react';
import { 
  Filter, 
  Search, 
  Download, 
  Calendar,
  CreditCard,
  Coins,
  CheckCircle,
  XCircle,
  Clock,
  AlertCircle,
  ChevronDown,
  RefreshCw
} from 'lucide-react';
import { paymentsAPI } from '@/lib/apiServices';

interface PaymentHistoryProps {
  payments: any[];
  onRefresh: () => void;
}

interface FilterState {
  type: string;
  status: string;
  startDate: string;
  endDate: string;
  searchTerm: string;
}

const PAYMENT_TYPES = [
  { value: '', label: 'All Types' },
  { value: 'subscription', label: 'Subscription' },
  { value: 'credits', label: 'Credits' },
  { value: 'deal_fee', label: 'Deal Fee' },
];

const PAYMENT_STATUSES = [
  { value: '', label: 'All Statuses' },
  { value: 'completed', label: 'Completed' },
  { value: 'pending', label: 'Pending' },
  { value: 'failed', label: 'Failed' },
  { value: 'refunded', label: 'Refunded' },
];

export default function PaymentHistory({ payments: initialPayments, onRefresh }: PaymentHistoryProps) {
  const [payments, setPayments] = useState(initialPayments);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const paymentsPerPage = 20;
  
  const [filters, setFilters] = useState<FilterState>({
    type: '',
    status: '',
    startDate: '',
    endDate: '',
    searchTerm: ''
  });

  const [appliedFilters, setAppliedFilters] = useState<FilterState>({
    type: '',
    status: '',
    startDate: '',
    endDate: '',
    searchTerm: ''
  });

  useEffect(() => {
    setPayments(initialPayments);
  }, [initialPayments]);

  const applyFilters = async () => {
    try {
      setLoading(true);
      setError(null);
      setAppliedFilters(filters);
      
      const params: any = {
        limit: paymentsPerPage,
        offset: (currentPage - 1) * paymentsPerPage
      };
      
      if (filters.type) params.type = filters.type;
      if (filters.status) params.status = filters.status;
      if (filters.startDate) params.startDate = filters.startDate;
      if (filters.endDate) params.endDate = filters.endDate;
      
      const result = await paymentsAPI.getPaymentHistory(params) as any;

      if (result && result.payments) {
        let filteredPayments = result.payments;

        // Apply client-side search filter
        if (filters.searchTerm) {
          const searchLower = filters.searchTerm.toLowerCase();
          filteredPayments = filteredPayments.filter((payment: any) =>
            payment.description?.toLowerCase().includes(searchLower) ||
            payment.id?.toString().includes(searchLower) ||
            payment.stripePaymentIntentId?.toLowerCase().includes(searchLower)
          );
        }

        setPayments(filteredPayments);
        setTotalPages(Math.ceil((result.total || filteredPayments.length) / paymentsPerPage));
      }
    } catch (err: any) {
      setError(err.message || 'Failed to filter payments');
    } finally {
      setLoading(false);
    }
  };

  const clearFilters = () => {
    const emptyFilters = {
      type: '',
      status: '',
      startDate: '',
      endDate: '',
      searchTerm: ''
    };
    setFilters(emptyFilters);
    setAppliedFilters(emptyFilters);
    setCurrentPage(1);
    setPayments(initialPayments);
  };

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    applyFilters();
  };

  const exportPayments = async () => {
    try {
      setLoading(true);
      const headers = ['Date', 'Description', 'Type', 'Credits', 'Status'];
      const rows = payments.map((p: any) => {
        const amount = parseFloat(p.amount);
        const signed = p.type === 'usage' ? -Math.abs(amount) : Math.abs(amount);
        return [
          new Date(p.createdAt).toLocaleDateString(),
          (p.description || `Entry #${p.id}`).replace(/,/g, ' '),
          p.type || 'unknown',
          String(signed),
          p.status || 'unknown'
        ];
      });
      const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `payment-history-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      const e = err instanceof Error ? err : new Error(String(err));
      setError(e.message || 'Failed to export payments');
    } finally {
      setLoading(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'pending':
        return <Clock className="w-4 h-4 text-yellow-500" />;
      case 'failed':
        return <XCircle className="w-4 h-4 text-red-500" />;
      case 'refunded':
        return <AlertCircle className="w-4 h-4 text-orange-500" />;
      default:
        return <Clock className="w-4 h-4 text-gray-400" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-green-100 text-green-800';
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      case 'failed':
        return 'bg-red-100 text-red-800';
      case 'refunded':
        return 'bg-orange-100 text-orange-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'subscription':
        return <CreditCard className="w-4 h-4 text-purple-500" />;
      case 'credits':
        return <Coins className="w-4 h-4 text-blue-500" />;
      case 'deal_fee':
        return <CreditCard className="w-4 h-4 text-green-500" />;
      default:
        return <CreditCard className="w-4 h-4 text-gray-400" />;
    }
  };

  const hasActiveFilters = Object.values(appliedFilters).some(value => value !== '');

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900">Payment History</h3>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
              showFilters || hasActiveFilters
                ? 'bg-purple-100 text-purple-700'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            <Filter className="w-4 h-4" />
            Filters
            {hasActiveFilters && (
              <span className="bg-purple-600 text-white text-xs rounded-full px-2 py-0.5">
                {Object.values(appliedFilters).filter(v => v).length}
              </span>
            )}
          </button>
          
          <button
            onClick={exportPayments}
            disabled={loading}
            className="flex items-center gap-2 px-3 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 text-sm font-medium disabled:opacity-50"
          >
            <Download className="w-4 h-4" />
            Export
          </button>
          
          <button
            onClick={onRefresh}
            disabled={loading}
            className="flex items-center gap-2 px-3 py-2 bg-purple-100 text-purple-700 rounded-lg hover:bg-purple-200 text-sm font-medium disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-700">{error}</p>
        </div>
      )}

      {/* Filters Panel */}
      {showFilters && (
        <div className="bg-white border rounded-lg p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
            {/* Type Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Payment Type
              </label>
              <select
                value={filters.type}
                onChange={(e) => setFilters({ ...filters, type: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              >
                {PAYMENT_TYPES.map(type => (
                  <option key={type.value} value={type.value}>
                    {type.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Status Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Status
              </label>
              <select
                value={filters.status}
                onChange={(e) => setFilters({ ...filters, status: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              >
                {PAYMENT_STATUSES.map(status => (
                  <option key={status.value} value={status.value}>
                    {status.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Search */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Search
              </label>
              <div className="relative">
                <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 transform -translate-y-1/2" />
                <input
                  type="text"
                  value={filters.searchTerm}
                  onChange={(e) => setFilters({ ...filters, searchTerm: e.target.value })}
                  placeholder="Search payments..."
                  className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
              </div>
            </div>

            {/* Date Range */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Start Date
              </label>
              <input
                type="date"
                value={filters.startDate}
                onChange={(e) => setFilters({ ...filters, startDate: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                End Date
              </label>
              <input
                type="date"
                value={filters.endDate}
                onChange={(e) => setFilters({ ...filters, endDate: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
            </div>
          </div>

          <div className="flex gap-3">
            <button
              onClick={applyFilters}
              disabled={loading}
              className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 text-sm font-medium"
            >
              Apply Filters
            </button>
            <button
              onClick={clearFilters}
              className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 text-sm font-medium"
            >
              Clear All
            </button>
          </div>
        </div>
      )}

      {/* Payments Table */}
      <div className="bg-white border rounded-lg overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
            <span className="ml-3 text-gray-600">Loading payments...</span>
          </div>
        ) : payments.length > 0 ? (
          <>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Payment
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Type
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Credits
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Date
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {payments.map((payment: any, index: number) => (
                    <tr key={payment.id || index} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="flex-shrink-0 w-8 h-8 bg-gray-100 rounded-lg flex items-center justify-center">
                            {getTypeIcon(payment.type)}
                          </div>
                          <div className="ml-3">
                            <div className="text-sm font-medium text-gray-900">
                              {payment.description || `Payment #${payment.id}`}
                            </div>
                            {payment.stripePaymentIntentId && (
                              <div className="text-xs text-gray-500">
                                ID: {payment.stripePaymentIntentId.substring(0, 20)}...
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800 capitalize">
                          {payment.type?.replace('_', ' ') || 'unknown'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        {(() => {
                          const isDebit = payment.type === 'usage';
                          const amount = parseFloat(payment.amount);
                          return (
                            <div className={`font-medium ${isDebit ? 'text-red-600' : 'text-green-600'}`}>
                              {isDebit ? '−' : '+'}{Math.abs(amount)}
                              <span className="text-xs text-gray-500 ml-1">credits</span>
                            </div>
                          );
                        })()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(payment.status)}`}>
                          {getStatusIcon(payment.status)}
                          {payment.status?.charAt(0).toUpperCase() + payment.status?.slice(1)}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        <div>{new Date(payment.createdAt).toLocaleDateString()}</div>
                        <div className="text-xs text-gray-500">
                          {new Date(payment.createdAt).toLocaleTimeString()}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        <div className="flex items-center gap-2">
                          {payment.invoice && (
                            <button className="text-purple-600 hover:text-purple-700 flex items-center gap-1">
                              <Download className="w-4 h-4" />
                              Receipt
                            </button>
                          )}
                          {payment.stripePaymentIntentId && (
                            <button
                              onClick={() => window.open(`https://dashboard.stripe.com/payments/${payment.stripePaymentIntentId}`, '_blank')}
                              className="text-gray-600 hover:text-gray-700 text-xs"
                            >
                              View in Stripe
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="bg-white px-4 py-3 flex items-center justify-between border-t border-gray-200 sm:px-6">
                <div className="flex-1 flex justify-between sm:hidden">
                  <button
                    onClick={() => handlePageChange(currentPage - 1)}
                    disabled={currentPage <= 1}
                    className="relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
                  >
                    Previous
                  </button>
                  <button
                    onClick={() => handlePageChange(currentPage + 1)}
                    disabled={currentPage >= totalPages}
                    className="ml-3 relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
                  >
                    Next
                  </button>
                </div>
                <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm text-gray-700">
                      Showing page <span className="font-medium">{currentPage}</span> of{' '}
                      <span className="font-medium">{totalPages}</span>
                    </p>
                  </div>
                  <div>
                    <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px">
                      {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                        <button
                          key={page}
                          onClick={() => handlePageChange(page)}
                          className={`relative inline-flex items-center px-4 py-2 border text-sm font-medium ${
                            page === currentPage
                              ? 'z-10 bg-purple-50 border-purple-500 text-purple-600'
                              : 'bg-white border-gray-300 text-gray-500 hover:bg-gray-50'
                          }`}
                        >
                          {page}
                        </button>
                      ))}
                    </nav>
                  </div>
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="text-center py-12">
            <CreditCard className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500">
              {hasActiveFilters ? 'No payments found matching your filters' : 'No payment history found'}
            </p>
            {hasActiveFilters && (
              <button
                onClick={clearFilters}
                className="mt-2 text-purple-600 hover:text-purple-700 text-sm font-medium"
              >
                Clear filters to see all payments
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}