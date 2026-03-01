import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useBetterAuthStore } from '../../store/betterAuthStore';
import { 
  History, Download, Filter, Search, ArrowUpRight,
  ArrowDownLeft, Calendar, DollarSign, RefreshCw, ChevronLeft, ChevronRight
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@shared/components/ui/card';
import { Button } from '@shared/components/ui/button';
import { investorApi } from '@/services/investor.service';

interface Transaction {
  id: number;
  type: string;
  amount: number;
  description: string;
  category?: string;
  status: string;
  created_at: string;
  pitch_title?: string;
}

interface TransactionStats {
  total_transactions: number;
  total_in: number;
  total_out: number;
  categories_used: number;
}

const TransactionHistory = () => {
  const navigate = useNavigate();
  const { user, logout } = useBetterAuthStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [stats, setStats] = useState<TransactionStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [filterType, setFilterType] = useState<string>('all');
  const [dateRange, setDateRange] = useState<{ start?: string; end?: string }>({});

  useEffect(() => {
    fetchTransactions();
    fetchStats();
  }, [page, filterType, searchQuery, dateRange]);

  const fetchTransactions = async () => {
    try {
      setLoading(true);
      const response = await investorApi.getTransactions({
        page,
        limit: 20,
        type: filterType !== 'all' ? filterType : undefined,
        search: searchQuery || undefined,
        startDate: dateRange.start,
        endDate: dateRange.end,
      });
      
      setTransactions((response.data as any)?.items || []);
      setTotalPages(Math.ceil(((response.data as any)?.total || 0) / 20));
    } catch (error) {
      console.error('Error fetching transactions:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const response = await investorApi.getTransactionStats();
      if (response.data) {
        setStats((response.data as any).stats || response.data as any);
      }
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  };

  const handleExport = async () => {
    try {
      const response = await investorApi.exportTransactions();
      const url = window.URL.createObjectURL(new Blob([(response as any).data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `transactions_${Date.now()}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (error) {
      console.error('Error exporting transactions:', error);
    }
  };


  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  return (
    <div>
            <main className="container mx-auto px-4 py-6">
        <div className="mb-8">
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Transaction History</h1>
              <p className="text-gray-600 mt-2">All your investment transactions and returns</p>
            </div>
            <Button variant="outline" onClick={handleExport}>
              <Download className="h-4 w-4 mr-2" />
              Export CSV
            </Button>
          </div>
        </div>

        <Card className="mb-6">
          <CardContent className="p-4">
            <div className="flex gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input
                  type="text"
                  id="transactions-search"
                  name="transactions-search"
                  placeholder="Search transactions..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  autoComplete="off"
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg"
                />
              </div>
              <Button variant="outline">
                <Filter className="h-4 w-4 mr-2" />
                Filter
              </Button>
            </div>
          </CardContent>
        </Card>

        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <Card>
              <CardContent className="p-4">
                <p className="text-sm text-gray-600">Total Transactions</p>
                <p className="text-2xl font-bold">{stats.total_transactions}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <p className="text-sm text-gray-600">Total Inflow</p>
                <p className="text-2xl font-bold text-green-600">{formatCurrency(stats.total_in)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <p className="text-sm text-gray-600">Total Outflow</p>
                <p className="text-2xl font-bold text-red-600">{formatCurrency(stats.total_out)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <p className="text-sm text-gray-600">Net Position</p>
                <p className="text-2xl font-bold">{formatCurrency(stats.total_in - stats.total_out)}</p>
              </CardContent>
            </Card>
          </div>
        )}

        <Card>
          <CardHeader>
            <CardTitle>All Transactions</CardTitle>
            <CardDescription>Complete history of your financial activities</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex justify-center items-center h-32">
                <RefreshCw className="h-8 w-8 animate-spin text-purple-600" />
              </div>
            ) : transactions.length > 0 ? (
              <>
                <div className="space-y-4">
                  {transactions.map(tx => (
                    <div key={tx.id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50">
                      <div className="flex items-center gap-4">
                        <div className={`p-2 rounded-full ${
                          tx.type === 'investment' ? 'bg-purple-100' : 
                          tx.type === 'return' ? 'bg-green-100' : 
                          tx.type === 'deposit' ? 'bg-blue-100' :
                          tx.type === 'withdrawal' ? 'bg-orange-100' :
                          'bg-gray-100'
                        }`}>
                          {tx.type === 'investment' ? <ArrowUpRight className="h-5 w-5 text-purple-600" /> :
                           tx.type === 'return' ? <ArrowDownLeft className="h-5 w-5 text-green-600" /> :
                           tx.type === 'deposit' ? <ArrowDownLeft className="h-5 w-5 text-blue-600" /> :
                           tx.type === 'withdrawal' ? <ArrowUpRight className="h-5 w-5 text-orange-600" /> :
                           <DollarSign className="h-5 w-5 text-gray-600" />}
                        </div>
                        <div>
                          <p className="font-medium text-gray-900">{tx.description}</p>
                          {tx.pitch_title && (
                            <p className="text-sm text-gray-600">{tx.pitch_title}</p>
                          )}
                          <p className="text-xs text-gray-500">{new Date(tx.created_at).toLocaleDateString()}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className={`font-semibold ${
                          tx.type === 'return' || tx.type === 'deposit' ? 'text-green-600' : 'text-gray-900'
                        }`}>
                          {tx.type === 'return' || tx.type === 'deposit' ? '+' : '-'}
                          {formatCurrency(Math.abs(tx.amount))}
                        </p>
                        <span className={`text-xs px-2 py-1 rounded-full ${
                          tx.status === 'completed' ? 'bg-green-100 text-green-800' : 
                          tx.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                          'bg-gray-100 text-gray-800'
                        }`}>
                          {tx.status}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
                
                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="flex justify-center items-center gap-2 mt-6">
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => setPage(p => Math.max(1, p - 1))}
                      disabled={page === 1}
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <span className="px-3 py-1 text-sm text-gray-600">
                      Page {page} of {totalPages}
                    </span>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                      disabled={page === totalPages}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </>
            ) : (
              <div className="text-center py-8">
                <p className="text-gray-500">No transactions found</p>
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default TransactionHistory;