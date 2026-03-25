import React, { useState, useEffect } from 'react';
import { adminService } from '../services/admin.service';

interface Transaction {
  id: string;
  type: 'payment' | 'refund' | 'credit_purchase' | 'subscription' | 'commission';
  amount: number;
  currency: string;
  status: 'pending' | 'completed' | 'failed' | 'refunded' | 'disputed';
  user: {
    id: string;
    name: string;
    email: string;
    userType: string;
  };
  description: string;
  paymentMethod?: string;
  stripeTransactionId?: string;
  createdAt: string;
  updatedAt: string;
  refundableAmount?: number;
  metadata?: {
    pitchId?: string;
    pitchTitle?: string;
    subscriptionPlan?: string;
  };
}

interface TransactionFilters {
  type: string;
  status: string;
  userType: string;
  dateFrom: string;
  dateTo: string;
  sortBy: 'createdAt' | 'amount' | 'status';
  sortOrder: 'asc' | 'desc';
}

const Transactions: React.FC = () => {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<TransactionFilters>({
    type: '',
    status: '',
    userType: '',
    dateFrom: '',
    dateTo: '',
    sortBy: 'createdAt',
    sortOrder: 'desc'
  });
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);
  const [showTransactionModal, setShowTransactionModal] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [refundAmount, setRefundAmount] = useState(0);
  const [refundReason, setRefundReason] = useState('');

  useEffect(() => {
    loadTransactions();
  }, [filters]);

  const loadTransactions = async () => {
    try {
      setLoading(true);
      const data = await adminService.getTransactions(filters) as any;
      const list = Array.isArray(data) ? data : (data?.reports ?? data?.transactions ?? data?.data ?? []);
      setTransactions(list);
    } catch (err) {
      setError('Failed to load transactions');
      console.error('Transactions error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleProcessRefund = async (transactionId: string, amount: number, reason: string) => {
    try {
      setActionLoading(transactionId);
      await adminService.processRefund(transactionId, amount, reason);
      await loadTransactions();
      setShowTransactionModal(false);
      setRefundAmount(0);
      setRefundReason('');
    } catch (err) {
      console.error('Process refund error:', err);
      alert('Failed to process refund');
    } finally {
      setActionLoading(null);
    }
  };

  const getStatusBadge = (status: string) => {
    const styles = {
      pending: 'bg-yellow-100 text-yellow-800',
      completed: 'bg-green-100 text-green-800',
      failed: 'bg-red-100 text-red-800',
      refunded: 'bg-blue-100 text-blue-800',
      disputed: 'bg-purple-100 text-purple-800'
    };
    return `px-2 py-1 text-xs font-medium rounded-full ${styles[status as keyof typeof styles] || 'bg-gray-100 text-gray-800'}`;
  };

  const getTypeBadge = (type: string) => {
    const styles = {
      payment: 'bg-blue-100 text-blue-800',
      refund: 'bg-orange-100 text-orange-800',
      credit_purchase: 'bg-green-100 text-green-800',
      subscription: 'bg-purple-100 text-purple-800',
      commission: 'bg-indigo-100 text-indigo-800'
    };
    return `px-2 py-1 text-xs font-medium rounded-full ${styles[type as keyof typeof styles] || 'bg-gray-100 text-gray-800'}`;
  };

  const formatCurrency = (amount: number, currency: string = 'USD') => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency
    }).format(amount);
  };

  const calculateTotalRevenue = () => {
    return transactions
      .filter(t => t.status === 'completed' && t.type !== 'refund')
      .reduce((sum, t) => sum + t.amount, 0);
  };

  const calculateTotalRefunds = () => {
    return transactions
      .filter(t => t.status === 'completed' && t.type === 'refund')
      .reduce((sum, t) => sum + t.amount, 0);
  };

  const TransactionModal = ({ transaction }: { transaction: Transaction }) => {
    const canRefund = transaction.status === 'completed' && 
                     transaction.type !== 'refund' && 
                     (transaction.refundableAmount || 0) > 0;

    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-lg w-full max-w-2xl max-h-[90vh] overflow-y-auto">
          <div className="p-6 border-b border-gray-200">
            <div className="flex justify-between items-center">
              <h2 className="text-2xl font-semibold">Transaction Details</h2>
              <button
                onClick={() => {
                  setShowTransactionModal(false);
                  setRefundAmount(0);
                  setRefundReason('');
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            </div>
          </div>

          <div className="p-6 space-y-6">
            {/* Transaction Info */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h3 className="text-lg font-semibold mb-4">Transaction Information</h3>
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">ID</label>
                    <p className="text-gray-900 font-mono text-sm">{transaction.id}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Type</label>
                    <span className={getTypeBadge(transaction.type)}>
                      {transaction.type.replace('_', ' ')}
                    </span>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Status</label>
                    <span className={getStatusBadge(transaction.status)}>
                      {transaction.status}
                    </span>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Amount</label>
                    <p className="text-2xl font-bold text-gray-900">
                      {formatCurrency(transaction.amount, transaction.currency)}
                    </p>
                  </div>
                  {transaction.refundableAmount && transaction.refundableAmount > 0 && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Refundable Amount</label>
                      <p className="text-lg font-semibold text-green-600">
                        {formatCurrency(transaction.refundableAmount, transaction.currency)}
                      </p>
                    </div>
                  )}
                </div>
              </div>

              <div>
                <h3 className="text-lg font-semibold mb-4">User Information</h3>
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Name</label>
                    <p className="text-gray-900">{transaction.user.name}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Email</label>
                    <p className="text-gray-900">{transaction.user.email}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">User Type</label>
                    <p className="text-gray-900 capitalize">{transaction.user.userType}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Description */}
            <div>
              <h3 className="text-lg font-semibold mb-4">Description</h3>
              <div className="bg-gray-50 p-4 rounded-lg">
                <p className="text-gray-900">{transaction.description}</p>
              </div>
            </div>

            {/* Payment Details */}
            <div>
              <h3 className="text-lg font-semibold mb-4">Payment Details</h3>
              <div className="space-y-2">
                {transaction.paymentMethod && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Payment Method</label>
                    <p className="text-gray-900">{transaction.paymentMethod}</p>
                  </div>
                )}
                {transaction.stripeTransactionId && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Stripe Transaction ID</label>
                    <p className="text-gray-900 font-mono text-sm">{transaction.stripeTransactionId}</p>
                  </div>
                )}
                <div>
                  <label className="block text-sm font-medium text-gray-700">Created</label>
                  <p className="text-gray-900">{new Date(transaction.createdAt).toLocaleString()}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Last Updated</label>
                  <p className="text-gray-900">{new Date(transaction.updatedAt).toLocaleString()}</p>
                </div>
              </div>
            </div>

            {/* Metadata */}
            {transaction.metadata && Object.keys(transaction.metadata).length > 0 && (
              <div>
                <h3 className="text-lg font-semibold mb-4">Additional Information</h3>
                <div className="bg-gray-50 p-4 rounded-lg space-y-2">
                  {transaction.metadata.pitchTitle && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Related Pitch</label>
                      <p className="text-gray-900">{transaction.metadata.pitchTitle}</p>
                    </div>
                  )}
                  {transaction.metadata.subscriptionPlan && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Subscription Plan</label>
                      <p className="text-gray-900">{transaction.metadata.subscriptionPlan}</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Refund Section */}
            {canRefund && (
              <div className="border-t pt-6">
                <h3 className="text-lg font-semibold mb-4">Process Refund</h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Refund Amount
                    </label>
                    <div className="flex space-x-2">
                      <input
                        type="number"
                        value={refundAmount}
                        onChange={(e) => setRefundAmount(Number(e.target.value))}
                        max={transaction.refundableAmount}
                        min={0}
                        step="0.01"
                        className="flex-1 border border-gray-300 rounded-md px-3 py-2"
                      />
                      <button
                        onClick={() => setRefundAmount(transaction.refundableAmount || 0)}
                        className="px-3 py-2 text-sm bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
                      >
                        Max
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Refund Reason
                    </label>
                    <textarea
                      value={refundReason}
                      onChange={(e) => setRefundReason(e.target.value)}
                      rows={3}
                      className="w-full border border-gray-300 rounded-md px-3 py-2"
                      placeholder="Reason for refund..."
                    />
                  </div>

                  <button
                    onClick={() => handleProcessRefund(transaction.id, refundAmount, refundReason)}
                    disabled={actionLoading === transaction.id || refundAmount <= 0 || !refundReason.trim()}
                    className="w-full bg-red-600 text-white py-2 rounded hover:bg-red-700 disabled:opacity-50"
                  >
                    {actionLoading === transaction.id ? 'Processing...' : 'Process Refund'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Transaction Management</h1>
          <p className="text-gray-600">View payment history and process refunds</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
          <div className="bg-white p-6 rounded-lg shadow">
            <div className="text-2xl font-bold text-green-600">
              {formatCurrency(calculateTotalRevenue())}
            </div>
            <div className="text-sm text-gray-600">Total Revenue</div>
          </div>
          <div className="bg-white p-6 rounded-lg shadow">
            <div className="text-2xl font-bold text-red-600">
              {formatCurrency(calculateTotalRefunds())}
            </div>
            <div className="text-sm text-gray-600">Total Refunds</div>
          </div>
          <div className="bg-white p-6 rounded-lg shadow">
            <div className="text-2xl font-bold text-yellow-600">
              {transactions.filter(t => t.status === 'pending').length}
            </div>
            <div className="text-sm text-gray-600">Pending</div>
          </div>
          <div className="bg-white p-6 rounded-lg shadow">
            <div className="text-2xl font-bold text-purple-600">
              {transactions.filter(t => t.status === 'disputed').length}
            </div>
            <div className="text-sm text-gray-600">Disputed</div>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Type
              </label>
              <select
                value={filters.type}
                onChange={(e) => setFilters({ ...filters, type: e.target.value })}
                className="w-full border border-gray-300 rounded-md px-3 py-2"
              >
                <option value="">All Types</option>
                <option value="payment">Payment</option>
                <option value="refund">Refund</option>
                <option value="credit_purchase">Credit Purchase</option>
                <option value="subscription">Subscription</option>
                <option value="commission">Commission</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Status
              </label>
              <select
                value={filters.status}
                onChange={(e) => setFilters({ ...filters, status: e.target.value })}
                className="w-full border border-gray-300 rounded-md px-3 py-2"
              >
                <option value="">All Statuses</option>
                <option value="pending">Pending</option>
                <option value="completed">Completed</option>
                <option value="failed">Failed</option>
                <option value="refunded">Refunded</option>
                <option value="disputed">Disputed</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                User Type
              </label>
              <select
                value={filters.userType}
                onChange={(e) => setFilters({ ...filters, userType: e.target.value })}
                className="w-full border border-gray-300 rounded-md px-3 py-2"
              >
                <option value="">All Users</option>
                <option value="creator">Creator</option>
                <option value="investor">Investor</option>
                <option value="production">Production</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                From Date
              </label>
              <input
                type="date"
                value={filters.dateFrom}
                onChange={(e) => setFilters({ ...filters, dateFrom: e.target.value })}
                className="w-full border border-gray-300 rounded-md px-3 py-2"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                To Date
              </label>
              <input
                type="date"
                value={filters.dateTo}
                onChange={(e) => setFilters({ ...filters, dateTo: e.target.value })}
                className="w-full border border-gray-300 rounded-md px-3 py-2"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Sort
              </label>
              <select
                value={`${filters.sortBy}-${filters.sortOrder}`}
                onChange={(e) => {
                  const [sortBy, sortOrder] = e.target.value.split('-');
                  setFilters({ ...filters, sortBy: sortBy as any, sortOrder: sortOrder as any });
                }}
                className="w-full border border-gray-300 rounded-md px-3 py-2"
              >
                <option value="createdAt-desc">Newest First</option>
                <option value="createdAt-asc">Oldest First</option>
                <option value="amount-desc">Highest Amount</option>
                <option value="amount-asc">Lowest Amount</option>
                <option value="status-asc">Status A-Z</option>
              </select>
            </div>
          </div>
        </div>

        {/* Transactions Table */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Transaction
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    User
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Type
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Amount
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
                {loading ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-4 text-center">
                      <div className="animate-pulse">Loading transactions...</div>
                    </td>
                  </tr>
                ) : transactions.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-4 text-center text-gray-500">
                      No transactions found
                    </td>
                  </tr>
                ) : (
                  transactions.map((transaction) => (
                    <tr key={transaction.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div>
                          <div className="text-sm font-medium text-gray-900 font-mono">
                            {String(transaction.id).substring(0, 8)}...
                          </div>
                          <div className="text-sm text-gray-500">{transaction.description}</div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div>
                          <div className="text-sm font-medium text-gray-900">{transaction.user.name}</div>
                          <div className="text-sm text-gray-500">{transaction.user.email}</div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={getTypeBadge(transaction.type)}>
                          {transaction.type.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {formatCurrency(transaction.amount, transaction.currency)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={getStatusBadge(transaction.status)}>
                          {transaction.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {new Date(transaction.createdAt).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <button
                          onClick={() => {
                            setSelectedTransaction(transaction);
                            setShowTransactionModal(true);
                          }}
                          className="text-blue-600 hover:text-blue-900"
                        >
                          View
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Transaction Modal */}
        {showTransactionModal && selectedTransaction && (
          <TransactionModal transaction={selectedTransaction} />
        )}

        {error && (
          <div className="fixed bottom-4 right-4 bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-red-600">{error}</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default Transactions;