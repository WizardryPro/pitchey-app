import React, { useState, useEffect, useMemo } from 'react';
import {
  Shield,
  TrendingUp,
  Clock,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Eye,
  Bell,
  Users,
  FileText,
  Calendar,
  Filter,
  Download,
  Settings,
  Zap,
  BarChart3
} from 'lucide-react';
import { useToast } from '@shared/components/feedback/ToastProvider';
import { ndaService } from '../../services/nda.service';
import NDAApprovalWorkflow from './NDAApprovalWorkflow';
import NDANotificationCenter from './NDANotificationCenter';
import { formatDistanceToNow, format } from 'date-fns';
import type { NDA } from '@shared/types/api';

interface NDADashboardProps {
  userId: number;
  userRole: 'creator' | 'investor' | 'production';
}

interface NDAStats {
  total: number;
  pending: number;
  approved: number;
  rejected: number;
  expired: number;
  approvalRate: number;
  avgResponseTimeHours: number;
  recent: {
    requests: number;
    approvals: number;
    approvalRate: number;
  };
  urgency: {
    priority: number;
    standard: number;
  };
}

interface QuickAction {
  id: string;
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  action: () => void;
  color: string;
  urgent?: boolean;
}

function NDAAnalyticsPanel() {
  const [analyticsData, setAnalyticsData] = useState<{
    totalRequests: number;
    approved: number;
    rejected: number;
    pending: number;
    avgResponseTime: number;
  } | null>(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(true);
  const [timeframe, setTimeframe] = useState('30d');

  useEffect(() => {
    const loadAnalytics = async () => {
      try {
        setAnalyticsLoading(true);
        const data = await ndaService.getNDAAnalytics(timeframe);
        setAnalyticsData({
          totalRequests: data.totalRequests ?? 0,
          approved: data.approved ?? 0,
          rejected: data.rejected ?? 0,
          pending: data.pending ?? 0,
          avgResponseTime: data.avgResponseTime ?? 0
        });
      } catch (err) {
        const e = err instanceof Error ? err : new Error(String(err));
        console.error('Failed to load NDA analytics:', e);
      } finally {
        setAnalyticsLoading(false);
      }
    };
    loadAnalytics();
  }, [timeframe]);

  if (analyticsLoading) {
    return (
      <div className="flex items-center justify-center h-48">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900">NDA Analytics</h3>
        <select
          value={timeframe}
          onChange={(e) => setTimeframe(e.target.value)}
          className="px-3 py-1.5 border border-gray-300 rounded-md text-sm"
        >
          <option value="7d">Last 7 days</option>
          <option value="30d">Last 30 days</option>
          <option value="90d">Last 90 days</option>
          <option value="all">All time</option>
        </select>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center gap-3">
            <FileText className="w-8 h-8 text-blue-500" />
            <div>
              <p className="text-sm text-gray-500">Total NDAs</p>
              <p className="text-xl font-semibold text-gray-900">{analyticsData?.totalRequests ?? 0}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center gap-3">
            <CheckCircle className="w-8 h-8 text-green-500" />
            <div>
              <p className="text-sm text-gray-500">Signed</p>
              <p className="text-xl font-semibold text-green-600">{analyticsData?.approved ?? 0}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center gap-3">
            <Clock className="w-8 h-8 text-yellow-500" />
            <div>
              <p className="text-sm text-gray-500">Pending</p>
              <p className="text-xl font-semibold text-yellow-600">{analyticsData?.pending ?? 0}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center gap-3">
            <TrendingUp className="w-8 h-8 text-purple-500" />
            <div>
              <p className="text-sm text-gray-500">Avg Time to Sign</p>
              <p className="text-xl font-semibold text-gray-900">
                {analyticsData?.avgResponseTime ? `${Math.round(analyticsData.avgResponseTime)}h` : 'N/A'}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function NDADashboard({ userId, userRole }: NDADashboardProps) {
  const [activeTab, setActiveTab] = useState<'overview' | 'approvals' | 'notifications' | 'analytics'>('overview');
  const [stats, setStats] = useState<NDAStats | null>(null);
  const [recentNDAs, setRecentNDAs] = useState<NDA[]>([]);
  const [loading, setLoading] = useState(true);
  const [timeframe, setTimeframe] = useState<'7d' | '30d' | '90d'>('30d');
  const [refreshKey, setRefreshKey] = useState(0);
  
  const { success, error } = useToast();

  useEffect(() => {
    loadDashboardData();
  }, [userId, timeframe, refreshKey]);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      
      const [statsData, ndaData] = await Promise.all([
        ndaService.getNDAStats(),
        ndaService.getNDAs({ 
          limit: 10,
          [userRole === 'creator' ? 'creatorId' : 'requesterId']: userId
        })
      ]);
      
      setStats(statsData as unknown as NDAStats);
      setRecentNDAs(ndaData.ndas);
      
    } catch (err) {
      console.error('Failed to load dashboard data:', err);
      error('Loading Failed', 'Unable to load dashboard data. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const quickActions: QuickAction[] = useMemo(() => {
    const actions: QuickAction[] = [];
    
    if (userRole === 'creator') {
      const pendingCount = stats?.pending || 0;
      
      actions.push(
        {
          id: 'review-pending',
          title: `Review Pending NDAs`,
          description: `${pendingCount} request${pendingCount !== 1 ? 's' : ''} awaiting review`,
          icon: Clock,
          action: () => setActiveTab('approvals'),
          color: 'bg-blue-600 hover:bg-blue-700',
          urgent: pendingCount > 0
        },
        {
          id: 'view-analytics',
          title: 'View Analytics',
          description: 'Analyze NDA trends and performance',
          icon: BarChart3,
          action: () => setActiveTab('analytics'),
          color: 'bg-green-600 hover:bg-green-700'
        },
        {
          id: 'download-reports',
          title: 'Download Reports',
          description: 'Export NDA data and analytics',
          icon: Download,
          action: () => handleDownloadReports(),
          color: 'bg-purple-600 hover:bg-purple-700'
        }
      );
    }
    
    // Common actions for all users
    actions.push(
      {
        id: 'view-notifications',
        title: 'Notifications',
        description: 'View all NDA-related notifications',
        icon: Bell,
        action: () => setActiveTab('notifications'),
        color: 'bg-orange-600 hover:bg-orange-700'
      }
    );
    
    return actions;
  }, [userRole, stats]);

  const handleDownloadReports = async () => {
    try {
      // Generate and download NDA report
      const reportData = {
        stats,
        recentNDAs,
        generatedAt: new Date().toISOString()
      };
      
      const blob = new Blob([JSON.stringify(reportData, null, 2)], {
        type: 'application/json'
      });
      
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `NDA_Report_${format(new Date(), 'yyyy-MM-dd')}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      
      success('Report Downloaded', 'NDA report has been downloaded successfully.');
    } catch (err) {
      error('Download Failed', 'Unable to generate report. Please try again.');
    }
  };

  const StatCard = ({ 
    title, 
    value, 
    change, 
    icon: Icon, 
    color,
    subtitle 
  }: { 
    title: string; 
    value: string | number; 
    change?: string; 
    icon: React.ComponentType<{ className?: string }>; 
    color: string;
    subtitle?: string;
  }) => (
    <div className="bg-white rounded-lg border border-gray-200 p-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-gray-600">{title}</p>
          <p className="text-3xl font-bold text-gray-900">{typeof value === 'number' ? value.toLocaleString() : (value || '0')}</p>
          {subtitle && (
            <p className="text-xs text-gray-500 mt-1">{subtitle}</p>
          )}
        </div>
        <div className={`p-3 rounded-lg ${color}`}>
          <Icon className="w-6 h-6 text-white" />
        </div>
      </div>
      {change && (
        <div className="mt-4">
          <span className="text-sm text-green-600">{change}</span>
          <span className="text-sm text-gray-500 ml-2">vs last period</span>
        </div>
      )}
    </div>
  );

  if (loading) {
    return (
      <div className="flex justify-center items-center h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Shield className="w-8 h-8 text-blue-600" />
          <div>
            <h1 className="text-2xl font-bold text-gray-900">NDA Management</h1>
            <p className="text-gray-500">
              {userRole === 'creator' 
                ? 'Manage and approve NDA requests for your pitches'
                : 'Track your NDA requests and access status'
              }
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          <select
            value={timeframe}
            onChange={(e) => setTimeframe(e.target.value as '7d' | '30d' | '90d')}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="7d">Last 7 days</option>
            <option value="30d">Last 30 days</option>
            <option value="90d">Last 90 days</option>
          </select>
          
          <button
            onClick={() => setRefreshKey(prev => prev + 1)}
            className="p-2 border border-gray-300 rounded-lg hover:bg-gray-50"
            title="Refresh"
          >
            <TrendingUp className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          {[
            { id: 'overview', label: 'Overview', icon: BarChart3 },
            ...(userRole === 'creator' ? [{ id: 'approvals', label: 'Approvals', icon: CheckCircle }] : []),
            { id: 'notifications', label: 'Notifications', icon: Bell },
            { id: 'analytics', label: 'Analytics', icon: TrendingUp }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-2 py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === tab.id
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
              {tab.id === 'approvals' && stats?.pending && stats.pending > 0 && (
                <span className="bg-red-500 text-white text-xs rounded-full px-2 py-1 min-w-[20px] text-center">
                  {stats.pending}
                </span>
              )}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* Statistics Cards */}
          {stats && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <StatCard
                title="Total NDAs"
                value={stats.total}
                icon={FileText}
                color="bg-blue-500"
                subtitle={`${stats.recent.requests} in last 7 days`}
              />
              
              <StatCard
                title="Pending Reviews"
                value={stats.pending}
                icon={Clock}
                color="bg-yellow-500"
                subtitle={userRole === 'creator' ? 'Awaiting your review' : 'Awaiting response'}
              />
              
              <StatCard
                title="Approval Rate"
                value={`${stats.approvalRate}%`}
                change={`${stats.recent.approvalRate}% recent`}
                icon={CheckCircle}
                color="bg-green-500"
              />
              
              <StatCard
                title="Avg Response Time"
                value={`${Math.round(stats.avgResponseTimeHours)}h`}
                icon={TrendingUp}
                color="bg-purple-500"
                subtitle="Time to decision"
              />
            </div>
          )}

          {/* Quick Actions */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {quickActions.map(action => (
                <button
                  key={action.id}
                  onClick={action.action}
                  className={`text-left p-4 rounded-lg border border-gray-200 hover:shadow-md transition-shadow ${
                    action.urgent ? 'ring-2 ring-red-200 border-red-300' : ''
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className={`p-2 rounded-lg ${action.color}`}>
                      <action.icon className="w-5 h-5 text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="font-medium text-gray-900 flex items-center gap-2">
                        {action.title}
                        {action.urgent && <Zap className="w-4 h-4 text-yellow-500" />}
                      </h4>
                      <p className="text-sm text-gray-500 mt-1">{action.description}</p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Recent Activity */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Recent NDA Activity</h3>
              <button
                onClick={() => setActiveTab(userRole === 'creator' ? 'approvals' : 'notifications')}
                className="text-sm text-blue-600 hover:text-blue-700"
              >
                View All
              </button>
            </div>
            
            {recentNDAs.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <FileText className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                <p>No recent NDA activity</p>
              </div>
            ) : (
              <div className="space-y-3">
                {recentNDAs.slice(0, 5).map(nda => (
                  <div key={nda.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-lg ${
                        nda.status === 'approved' ? 'bg-green-100 text-green-600' :
                        nda.status === 'rejected' ? 'bg-red-100 text-red-600' :
                        nda.status === 'pending' ? 'bg-yellow-100 text-yellow-600' :
                        'bg-gray-100 text-gray-600'
                      }`}>
                        {nda.status === 'approved' ? <CheckCircle className="w-4 h-4" /> :
                         nda.status === 'rejected' ? <XCircle className="w-4 h-4" /> :
                         nda.status === 'pending' ? <Clock className="w-4 h-4" /> :
                         <AlertTriangle className="w-4 h-4" />}
                      </div>
                      
                      <div>
                        <p className="font-medium text-gray-900">
                          {nda.pitch?.title || 'Unknown Pitch'}
                        </p>
                        <p className="text-sm text-gray-500">
                          {userRole === 'creator'
                            ? `Request from ${(nda.requester as any)?.username || 'Unknown User'}`
                            : `Request to ${(nda.pitchOwner as any)?.username || 'Unknown Creator'}`
                          } • {formatDistanceToNow(new Date(nda.createdAt), { addSuffix: true })}
                        </p>
                      </div>
                    </div>
                    
                    <span className={`px-2 py-1 rounded text-xs font-medium ${
                      nda.status === 'approved' ? 'bg-green-100 text-green-700' :
                      nda.status === 'rejected' ? 'bg-red-100 text-red-700' :
                      nda.status === 'pending' ? 'bg-yellow-100 text-yellow-700' :
                      'bg-gray-100 text-gray-700'
                    }`}>
                      {nda.status}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'approvals' && userRole === 'creator' && (
        <NDAApprovalWorkflow
          creatorId={userId}
          onRequestProcessed={(requestId, action) => {
            setRefreshKey(prev => prev + 1);
            success(
              'Request Processed',
              `NDA request has been ${action === 'approved' ? 'approved' : 'rejected'}.`
            );
          }}
        />
      )}

      {activeTab === 'notifications' && (
        <NDANotificationCenter
          userId={userId}
          onNotificationAction={(notificationId, action) => {
            if (action === 'read') {
              // Handle read action
            }
          }}
          onNDAAction={(requestId, action) => {
            if (action === 'view' || action === 'approve' || action === 'reject') {
              setActiveTab('approvals');
            }
          }}
        />
      )}

      {activeTab === 'analytics' && (
        <NDAAnalyticsPanel />
      )}
    </div>
  );
}