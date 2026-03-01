import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Wallet, CreditCard, ArrowUpRight, ArrowDownLeft, 
  DollarSign, TrendingUp, Plus, History, AlertCircle, Bell, Settings,
  CheckCircle, XCircle, Clock, ExternalLink
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@shared/components/ui/card';
import { Button } from '@shared/components/ui/button';
import { Badge } from '@shared/components/ui/badge';
import { Switch } from '@shared/components/ui/switch';
import { Alert, AlertDescription } from '@shared/components/ui/alert';
import { useBetterAuthStore } from '../../store/betterAuthStore';
import { toast } from 'react-hot-toast';
import { investorApi } from '@/services/investor.service';

const InvestorWallet = () => {
  const navigate = useNavigate();
  const { user, logout } = useBetterAuthStore();
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');
  const [notifications, setNotifications] = useState([]);
  const [notificationPreferences, setNotificationPreferences] = useState({
    transactionAlerts: true,
    securityAlerts: true,
    marketingEmails: false,
    monthlyStatements: true,
    realTimeUpdates: true
  });
  const wsRef = useRef<WebSocket | null>(null);

  // Real-time transaction notifications state
  const [realtimeTransactions, setRealtimeTransactions] = useState<any[]>([]);
  const [transactionStats, setTransactionStats] = useState({
    todayVolume: 0,
    weeklyVolume: 0,
    failedTransactions: 0,
    pendingTransactions: 0
  });

  // Wallet state
  const [wallet, setWallet] = useState({
    balance: {
      available: 0,
      pending: 0,
      invested: 0,
      total: 0
    },
    transactions: [] as any[],
    paymentMethods: [] as any[],
    recentAlerts: [] as any[]
  });

  // Initialize real-time updates and fetch data
  useEffect(() => {
    loadWalletData();
    setupWebSocketConnection();
    loadNotificationPreferences();
    
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, []);

  const loadWalletData = async () => {
    try {
      setLoading(true);
      const [financialSummary, recentTransactions, transactionStatsRes, paymentMethodsRes, paymentHistoryRes] = await Promise.all([
        investorApi.getFinancialSummary(),
        investorApi.getRecentTransactions(10),
        investorApi.getTransactionStats(),
        investorApi.getAllInvestments(),
        investorApi.getTransactions({ limit: 20 })
      ]);

      setWallet(prev => {
        const summary = financialSummary.success ? (financialSummary.data as any) : null;
        const balance = summary ? {
          available: summary.totalInvested != null ? (summary.portfolioValue ?? 0) - (summary.totalInvested ?? 0) : 0,
          pending: summary.pendingInvestments ?? 0,
          invested: summary.totalInvested ?? 0,
          total: summary.portfolioValue ?? 0
        } : prev.balance;

        const transactions = recentTransactions.success
          ? ((recentTransactions.data as any)?.transactions ?? [])
          : prev.transactions;

        const paymentMethods = paymentMethodsRes.success
          ? ((paymentMethodsRes.data as any)?.paymentMethods ?? (paymentMethodsRes.data as any)?.methods ?? [])
          : prev.paymentMethods;

        return { ...prev, balance, transactions, paymentMethods };
      });

      if (recentTransactions.success) {
        setRealtimeTransactions((recentTransactions.data as any)?.transactions ?? []);
      }

      if (transactionStatsRes.success) {
        setTransactionStats((transactionStatsRes.data as any)?.stats ?? (transactionStatsRes.data as any) ?? {
          todayVolume: 0,
          weeklyVolume: 0,
          failedTransactions: 0,
          pendingTransactions: 0
        });
      }
    } catch (error) {
      console.error('Error loading wallet data:', error);
      toast.error('Failed to load wallet data');
    } finally {
      setLoading(false);
    }
  };

  const setupWebSocketConnection = () => {
    if (!user?.id) return;
    
    try {
      const wsUrl = `${process.env.VITE_WS_URL}/ws/investor/${user.id}`;
      const ws = new WebSocket(wsUrl);
      
      ws.onopen = () => {
        toast.success('Real-time updates enabled');
      };
      
      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          handleRealtimeUpdate(data);
        } catch (error) {
          console.error('Error parsing WebSocket message:', error);
        }
      };
      
      ws.onclose = () => {
        // Attempt to reconnect after 5 seconds
        setTimeout(() => setupWebSocketConnection(), 5000);
      };
      
      ws.onerror = (error) => {
        console.error('WebSocket error:', error);
      };
      
      wsRef.current = ws;
    } catch (error) {
      console.error('Error setting up WebSocket:', error);
    }
  };

  const handleRealtimeUpdate = (data: any) => {
    switch (data.type) {
      case 'transaction_update':
        handleTransactionUpdate(data);
        break;
      case 'balance_change':
        handleBalanceUpdate(data);
        break;
      case 'security_alert':
        handleSecurityAlert(data);
        break;
      case 'roi_distribution':
        handleROIDistribution(data);
        break;
      default:
    }
  };

  const handleTransactionUpdate = (data: any) => {
    const { transaction, status, previousStatus } = data;
    
    // Update transaction in the list
    setWallet(prev => ({
      ...prev,
      transactions: prev.transactions.map(t => 
        t.id === transaction.id ? { ...t, status, ...transaction } : t
      )
    }));
    
    // Show notification based on status change
    if (status === 'completed' && previousStatus === 'pending') {
      toast.success(`Transaction completed: ${transaction.description}`);
      showNotificationToast('success', 'Transaction completed', transaction.description);
    } else if (status === 'failed') {
      toast.error(`Transaction failed: ${transaction.description}`);
      showNotificationToast('error', 'Transaction failed', transaction.description);
    }
  };

  const handleBalanceUpdate = (data: any) => {
    setWallet(prev => ({
      ...prev,
      balance: {
        ...prev.balance,
        ...data.balance
      }
    }));
    
    if (data.changeAmount > 0) {
      toast.success(`Balance updated: +$${data.changeAmount.toLocaleString()}`);
    }
  };

  const handleSecurityAlert = (data: any) => {
    const { alert } = data;
    setNotifications((prev) => [alert, ...prev.slice(0, 9)] as any);
    
    if (alert.severity === 'high' || alert.severity === 'critical') {
      toast.error(`Security Alert: ${alert.message}`);
      showNotificationToast('warning', 'Security Alert', alert.message);
    }
  };

  const handleROIDistribution = (data: any) => {
    const { distribution } = data;
    
    // Add to transactions
    const newTransaction = {
      id: Date.now(),
      type: 'return',
      description: `ROI Distribution - ${distribution.period}`,
      amount: distribution.amount,
      date: new Date().toISOString().split('T')[0],
      status: 'completed',
      balance: wallet.balance.available + distribution.amount
    };
    
    setWallet(prev => ({
      ...prev,
      transactions: [newTransaction, ...prev.transactions],
      balance: {
        ...prev.balance,
        available: prev.balance.available + distribution.amount,
        total: prev.balance.total + distribution.amount
      }
    }));
    
    toast.success(`ROI Distribution received: $${distribution.amount.toLocaleString()}`);
    showNotificationToast('success', 'ROI Distribution', `Received $${distribution.amount.toLocaleString()}`);
  };

  const showNotificationToast = (type: any, title: any, message: any) => {
    const notification = {
      id: Date.now(),
      type,
      title,
      message,
      timestamp: new Date(),
      read: false
    };
    
    setNotifications((prev) => [notification, ...prev.slice(0, 9)] as any);
  };

  const loadNotificationPreferences = async () => {
    try {
      // This would typically load from the API
      // For now, using default preferences
    } catch (error) {
      console.error('Error loading notification preferences:', error);
    }
  };

  const updateNotificationPreference = async (key: any, value: any) => {
    setNotificationPreferences(prev => ({
      ...prev,
      [key]: value
    }));
    
    try {
      // Save to API
      toast.success('Notification preferences updated');
    } catch (error) {
      console.error('Error updating preferences:', error);
      toast.error('Failed to update preferences');
    }
  };

  const handleLogout = () => {
    if (wsRef.current) {
      wsRef.current.close();
    }
    logout();
    navigate('/');
  };

  const handleDeposit = () => {
    toast.success('Redirecting to deposit page...');
    // In a real app, this would navigate to a secure payment page
  };

  const handleWithdraw = () => {
    toast.success('Redirecting to withdrawal page...');
    // In a real app, this would navigate to a withdrawal form
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  };

  const getTransactionIcon = (type: string) => {
    switch (type) {
      case 'investment':
        return <ArrowUpRight className="h-4 w-4 text-red-600" />;
      case 'deposit':
        return <ArrowDownLeft className="h-4 w-4 text-green-600" />;
      case 'return':
        return <TrendingUp className="h-4 w-4 text-green-600" />;
      case 'withdrawal':
        return <ArrowUpRight className="h-4 w-4 text-orange-600" />;
      default:
        return <DollarSign className="h-4 w-4 text-gray-600" />;
    }
  };

  const getTransactionStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'failed':
        return <XCircle className="h-4 w-4 text-red-600" />;
      case 'pending':
        return <Clock className="h-4 w-4 text-yellow-600" />;
      default:
        return <AlertCircle className="h-4 w-4 text-gray-600" />;
    }
  };

  const getAlertIcon = (type: string) => {
    switch (type) {
      case 'security':
        return <AlertCircle className="h-4 w-4 text-red-600" />;
      case 'success':
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'info':
        return <Bell className="h-4 w-4 text-blue-600" />;
      default:
        return <Bell className="h-4 w-4 text-gray-600" />;
    }
  };

  const formatTimeAgo = (timestamp: any) => {
    const now = new Date();
    const time = new Date(timestamp);
    const diffInMinutes = Math.floor((now.getTime() - time.getTime()) / (1000 * 60));
    
    if (diffInMinutes < 1) return 'Just now';
    if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
    if (diffInMinutes < 1440) return `${Math.floor(diffInMinutes / 60)}h ago`;
    return `${Math.floor(diffInMinutes / 1440)}d ago`;
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      
      <div className="container mx-auto px-4 py-8 mt-20">
        <div className="max-w-6xl mx-auto">
          <div className="flex justify-between items-center mb-8">
            <div>
              <h1 className="text-3xl font-bold flex items-center gap-2">
                <Wallet className="h-8 w-8" />
                Wallet
              </h1>
              <p className="text-muted-foreground mt-2">
                Manage your investment funds and transactions
              </p>
            </div>
            <div className="flex gap-3">
              <Button onClick={handleDeposit} variant="outline">
                <Plus className="h-4 w-4 mr-2" />
                Deposit
              </Button>
              <Button onClick={handleWithdraw}>
                <ArrowUpRight className="h-4 w-4 mr-2" />
                Withdraw
              </Button>
            </div>
          </div>

          {/* Balance Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm text-muted-foreground">Available</p>
                  <DollarSign className="h-4 w-4 text-green-600" />
                </div>
                <p className="text-2xl font-bold">{formatCurrency(wallet.balance.available)}</p>
                <p className="text-xs text-muted-foreground mt-1">Ready to invest</p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm text-muted-foreground">Pending</p>
                  <History className="h-4 w-4 text-yellow-600" />
                </div>
                <p className="text-2xl font-bold">{formatCurrency(wallet.balance.pending)}</p>
                <p className="text-xs text-muted-foreground mt-1">In processing</p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm text-muted-foreground">Invested</p>
                  <TrendingUp className="h-4 w-4 text-blue-600" />
                </div>
                <p className="text-2xl font-bold">{formatCurrency(wallet.balance.invested)}</p>
                <p className="text-xs text-muted-foreground mt-1">Active investments</p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm text-muted-foreground">Total Assets</p>
                  <Wallet className="h-4 w-4 text-purple-600" />
                </div>
                <p className="text-2xl font-bold">{formatCurrency(wallet.balance.total)}</p>
                <p className="text-xs text-muted-foreground mt-1">Portfolio value</p>
              </CardContent>
            </Card>
          </div>

          {/* Tabs */}
          <div className="flex gap-4 mb-6 border-b">
            <button
              onClick={() => setActiveTab('overview')}
              className={`pb-2 px-1 ${
                activeTab === 'overview'
                  ? 'border-b-2 border-primary font-medium'
                  : 'text-muted-foreground'
              }`}
            >
              Overview
            </button>
            <button
              onClick={() => setActiveTab('transactions')}
              className={`pb-2 px-1 ${
                activeTab === 'transactions'
                  ? 'border-b-2 border-primary font-medium'
                  : 'text-muted-foreground'
              }`}
            >
              Transactions
            </button>
            <button
              onClick={() => setActiveTab('payment-methods')}
              className={`pb-2 px-1 ${
                activeTab === 'payment-methods'
                  ? 'border-b-2 border-primary font-medium'
                  : 'text-muted-foreground'
              }`}
            >
              Payment Methods
            </button>
            <button
              onClick={() => setActiveTab('notifications')}
              className={`pb-2 px-1 ${
                activeTab === 'notifications'
                  ? 'border-b-2 border-primary font-medium'
                  : 'text-muted-foreground'
              }`}
            >
              Notifications
              {notifications.filter((n: any) => !n.read).length > 0 && (
                <Badge variant="destructive" className="ml-2 h-5 w-5 p-0 text-xs">
                  {notifications.filter((n: any) => !n.read).length}
                </Badge>
              )}
            </button>
            <button
              onClick={() => setActiveTab('security')}
              className={`pb-2 px-1 ${
                activeTab === 'security'
                  ? 'border-b-2 border-primary font-medium'
                  : 'text-muted-foreground'
              }`}
            >
              Security
            </button>
          </div>

          {/* Tab Content */}
          {activeTab === 'overview' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Recent Transactions</CardTitle>
                  <CardDescription>Your latest wallet activity</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {wallet.transactions.slice(0, 3).map(transaction => (
                      <div key={transaction.id} className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-muted rounded-full">
                            {getTransactionIcon(transaction.type)}
                          </div>
                          <div>
                            <p className="font-medium text-sm">{transaction.description}</p>
                            <p className="text-xs text-muted-foreground">
                              {new Date(transaction.date).toLocaleDateString()}
                            </p>
                          </div>
                        </div>
                        <span className={`font-medium ${
                          transaction.amount > 0 ? 'text-green-600' : 'text-red-600'
                        }`}>
                          {transaction.amount > 0 ? '+' : ''}{formatCurrency(Math.abs(transaction.amount))}
                        </span>
                      </div>
                    ))}
                  </div>
                  <Button 
                    variant="link" 
                    className="w-full mt-4"
                    onClick={() => setActiveTab('transactions')}
                  >
                    View all transactions →
                  </Button>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Quick Actions</CardTitle>
                  <CardDescription>Manage your funds</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <Button variant="outline" className="w-full justify-start">
                    <ArrowDownLeft className="h-4 w-4 mr-2" />
                    Transfer from Bank
                  </Button>
                  <Button variant="outline" className="w-full justify-start">
                    <ArrowUpRight className="h-4 w-4 mr-2" />
                    Transfer to Bank
                  </Button>
                  <Button variant="outline" className="w-full justify-start">
                    <History className="h-4 w-4 mr-2" />
                    View Statement
                  </Button>
                  <Button variant="outline" className="w-full justify-start">
                    <AlertCircle className="h-4 w-4 mr-2" />
                    Set Alerts
                  </Button>
                </CardContent>
              </Card>
            </div>
          )}

          {activeTab === 'transactions' && (
            <Card>
              <CardHeader>
                <CardTitle>Transaction History</CardTitle>
                <CardDescription>All your wallet transactions</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {wallet.transactions.map(transaction => (
                    <div key={transaction.id} className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="flex items-center gap-4">
                        <div className="p-2 bg-muted rounded-full">
                          {getTransactionIcon(transaction.type)}
                        </div>
                        <div>
                          <p className="font-medium">{transaction.description}</p>
                          <p className="text-sm text-muted-foreground">
                            {new Date(transaction.date).toLocaleString()}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className={`font-medium text-lg ${
                          transaction.amount > 0 ? 'text-green-600' : 'text-red-600'
                        }`}>
                          {transaction.amount > 0 ? '+' : ''}{formatCurrency(Math.abs(transaction.amount))}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          Balance: {formatCurrency(transaction.balance)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {activeTab === 'payment-methods' && (
            <Card>
              <CardHeader>
                <CardTitle>Payment Methods</CardTitle>
                <CardDescription>Manage your connected accounts</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {wallet.paymentMethods.map(method => (
                    <div key={method.id} className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="flex items-center gap-4">
                        <div className="p-2 bg-muted rounded-full">
                          <CreditCard className="h-5 w-5" />
                        </div>
                        <div>
                          <p className="font-medium">{method.name}</p>
                          <p className="text-sm text-muted-foreground">
                            •••• {method.last4}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        {method.isDefault && (
                          <span className="px-2 py-1 text-xs bg-primary/10 text-primary rounded-full">
                            Default
                          </span>
                        )}
                        <Button variant="outline" size="sm">
                          Edit
                        </Button>
                      </div>
                    </div>
                  ))}
                  <Button variant="outline" className="w-full">
                    <Plus className="h-4 w-4 mr-2" />
                    Add Payment Method
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
};

export default InvestorWallet;