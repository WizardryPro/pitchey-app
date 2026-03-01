import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useBetterAuthStore } from '../../store/betterAuthStore';
import { 
  DollarSign, TrendingUp, Wallet, PiggyBank,
  CreditCard, Coins, BarChart3, Download, RefreshCw
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@shared/components/ui/card';
import { Button } from '@shared/components/ui/button';
import { investorApi } from '@/services/investor.service';

interface FinancialSummaryData {
  available_funds: number;
  allocated_funds: number;
  total_returns: number;
  pending_amount: number;
  ytd_growth: number;
}

interface Transaction {
  id: number;
  type: string;
  amount: number;
  description: string;
  created_at: string;
  pitch_title?: string;
}

const FinancialOverview = () => {
  const navigate = useNavigate();
  const { user, logout } = useBetterAuthStore();
  const [financialData, setFinancialData] = useState<FinancialSummaryData | null>(null);
  const [recentTransactions, setRecentTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchFinancialData();
  }, []);

  const fetchFinancialData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Fetch financial summary
      const summaryResponse = await investorApi.getFinancialSummary();
      setFinancialData(summaryResponse.data as any);

      // Fetch recent transactions
      const transactionsResponse = await investorApi.getRecentTransactions(5);
      setRecentTransactions((transactionsResponse.data as any)?.transactions || []);
    } catch (err) {
      console.error('Error fetching financial data:', err);
      setError('Failed to load financial data');
    } finally {
      setLoading(false);
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
              <h1 className="text-3xl font-bold text-gray-900">Financial Overview</h1>
              <p className="text-gray-600 mt-2">Complete financial summary and portfolio valuation</p>
            </div>
            <Button variant="outline">
              <Download className="h-4 w-4 mr-2" />
              Export Statement
            </Button>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center items-center h-64">
            <RefreshCw className="h-8 w-8 animate-spin text-purple-600" />
          </div>
        ) : error ? (
          <Card>
            <CardContent className="p-6 text-center">
              <p className="text-red-600">{error}</p>
              <Button onClick={fetchFinancialData} className="mt-4" variant="outline">
                <RefreshCw className="h-4 w-4 mr-2" />
                Retry
              </Button>
            </CardContent>
          </Card>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600">Total Assets</p>
                      <p className="text-2xl font-bold text-gray-900">
                        {formatCurrency((financialData?.available_funds || 0) + (financialData?.allocated_funds || 0))}
                      </p>
                    </div>
                    <Wallet className="h-8 w-8 text-purple-600" />
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600">Available Funds</p>
                      <p className="text-2xl font-bold text-green-600">
                        {formatCurrency(financialData?.available_funds || 0)}
                      </p>
                    </div>
                    <DollarSign className="h-8 w-8 text-green-600" />
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600">Allocated Funds</p>
                      <p className="text-2xl font-bold text-blue-600">
                        {formatCurrency(financialData?.allocated_funds || 0)}
                      </p>
                    </div>
                    <Coins className="h-8 w-8 text-blue-600" />
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600">YTD Growth</p>
                      <p className="text-2xl font-bold text-purple-600">
                        {financialData?.ytd_growth ? `+${financialData.ytd_growth}%` : '0%'}
                      </p>
                    </div>
                    <TrendingUp className="h-8 w-8 text-purple-600" />
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <Card>
                <CardHeader>
                  <CardTitle>Recent Transactions</CardTitle>
                  <CardDescription>Your latest financial activities</CardDescription>
                </CardHeader>
                <CardContent>
                  {recentTransactions.length > 0 ? (
                    <div className="space-y-4">
                      {recentTransactions.map((transaction) => (
                        <div key={transaction.id} className="flex justify-between items-start pb-4 border-b last:border-0">
                          <div>
                            <p className="font-medium text-gray-900">{transaction.description}</p>
                            {transaction.pitch_title && (
                              <p className="text-sm text-gray-600">{transaction.pitch_title}</p>
                            )}
                            <p className="text-xs text-gray-500 mt-1">
                              {new Date(transaction.created_at).toLocaleDateString()}
                            </p>
                          </div>
                          <span className={`font-bold ${
                            transaction.type === 'deposit' || transaction.type === 'return' 
                              ? 'text-green-600' 
                              : 'text-red-600'
                          }`}>
                            {transaction.type === 'deposit' || transaction.type === 'return' ? '+' : '-'}
                            {formatCurrency(Math.abs(transaction.amount))}
                          </span>
                        </div>
                      ))}
                      <Button 
                        variant="outline" 
                        className="w-full"
                        onClick={() => navigate('/investor/transaction-history')}
                      >
                        View All Transactions
                      </Button>
                    </div>
                  ) : (
                    <p className="text-gray-500 text-center py-8">No recent transactions</p>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Financial Summary</CardTitle>
                  <CardDescription>Overview of your financial position</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex justify-between items-center pb-3 border-b">
                      <span className="text-gray-600">Total Returns</span>
                      <span className="font-bold text-green-600">
                        {formatCurrency(financialData?.total_returns || 0)}
                      </span>
                    </div>
                    <div className="flex justify-between items-center pb-3 border-b">
                      <span className="text-gray-600">Pending Transactions</span>
                      <span className="font-bold text-yellow-600">
                        {formatCurrency(financialData?.pending_amount || 0)}
                      </span>
                    </div>
                    <div className="flex justify-between items-center pb-3 border-b">
                      <span className="text-gray-600">Available for Investment</span>
                      <span className="font-bold">
                        {formatCurrency(financialData?.available_funds || 0)}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-gray-600">Active Portfolio Value</span>
                      <span className="font-bold">
                        {formatCurrency(financialData?.allocated_funds || 0)}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </>
        )}
      </main>
    </div>
  );
};

export default FinancialOverview;