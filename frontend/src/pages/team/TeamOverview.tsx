import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Users, UserPlus, Shield, Clock, Award,
  TrendingUp, Activity, Calendar, MessageSquare,
  BarChart3, CheckCircle, AlertTriangle, Eye,
  FileText, Star, Briefcase, Plus
} from 'lucide-react';
import { useBetterAuthStore } from '../../store/betterAuthStore';
import { TeamService } from '../../services/team.service';
import { useCurrentTeam } from '@/shared/hooks/useCurrentTeam';

interface TeamStats {
  totalMembers: number;
  activeMembers: number;
  pendingInvites: number;
  departments: number;
  averageRating: number;
  totalProjects: number;
  completedProjects: number;
  activeProjects: number;
}

interface RecentActivity {
  id: string;
  type: 'member_joined' | 'project_completed' | 'invite_sent' | 'role_updated' | 'project_started';
  user: string;
  description: string;
  timestamp: string;
  metadata?: {
    projectName?: string;
    role?: string;
    department?: string;
  };
}

interface UpcomingEvent {
  id: string;
  title: string;
  type: 'meeting' | 'deadline' | 'review' | 'milestone';
  date: string;
  participants: string[];
  priority: 'low' | 'medium' | 'high';
}

export default function TeamOverview() {
  const navigate = useNavigate();
  const { user } = useBetterAuthStore();
  const userType = user?.userType || 'production';
  const { team, teamId } = useCurrentTeam();

  const [stats, setStats] = useState<TeamStats>({
    totalMembers: 0,
    activeMembers: 0,
    pendingInvites: 0,
    departments: 0,
    averageRating: 0,
    totalProjects: 0,
    completedProjects: 0,
    activeProjects: 0
  });
  const [recentActivity, setRecentActivity] = useState<RecentActivity[]>([]);
  const [upcomingEvents, setUpcomingEvents] = useState<UpcomingEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (teamId) fetchTeamData();
  }, [teamId]);

  const fetchTeamData = async () => {
    if (!teamId) return;
    try {
      setLoading(true);

      const [teamDetail, invitations] = await Promise.all([
        TeamService.getTeamById(teamId),
        TeamService.getInvitations(),
      ]);

      const members = teamDetail.members || [];
      const totalMembers = members.length;
      const activeMembers = members.length; // All members from API are active
      const pendingInvites = invitations.filter(i => i.status === 'pending').length;

      setStats({
        totalMembers,
        activeMembers,
        pendingInvites,
        departments: 1, // No department data available
        averageRating: 0,
        totalProjects: 0,
        completedProjects: 0,
        activeProjects: 0,
      });

      // Build activity list from member join dates
      const activities: RecentActivity[] = members
        .filter((m: any) => m.joinedAt)
        .sort((a: any, b: any) => new Date(b.joinedAt).getTime() - new Date(a.joinedAt).getTime())
        .slice(0, 5)
        .map((m: any, idx: number) => ({
          id: String(idx + 1),
          type: 'member_joined' as const,
          user: m.name || (m.email ? m.email.split('@')[0] : 'Unknown'),
          description: `joined the team as ${m.role}`,
          timestamp: m.joinedAt,
          metadata: { role: m.role },
        }));

      setRecentActivity(activities);

      // No events endpoint — keep empty
      setUpcomingEvents([]);
    } catch (err) {
      console.error('Failed to fetch team data:', err);
    } finally {
      setLoading(false);
    }
  };

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'member_joined': return UserPlus;
      case 'project_completed': return CheckCircle;
      case 'invite_sent': return MessageSquare;
      case 'role_updated': return Award;
      case 'project_started': return Plus;
      default: return Activity;
    }
  };

  const getActivityColor = (type: string) => {
    switch (type) {
      case 'member_joined': return 'text-green-600 bg-green-100';
      case 'project_completed': return 'text-blue-600 bg-blue-100';
      case 'invite_sent': return 'text-purple-600 bg-purple-100';
      case 'role_updated': return 'text-yellow-600 bg-yellow-100';
      case 'project_started': return 'text-indigo-600 bg-indigo-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const getEventIcon = (type: string) => {
    switch (type) {
      case 'meeting': return MessageSquare;
      case 'deadline': return AlertTriangle;
      case 'review': return Eye;
      case 'milestone': return Award;
      default: return Calendar;
    }
  };

  const getEventColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'text-red-600 bg-red-100 border-red-200';
      case 'medium': return 'text-yellow-600 bg-yellow-100 border-yellow-200';
      case 'low': return 'text-green-600 bg-green-100 border-green-200';
      default: return 'text-gray-600 bg-gray-100 border-gray-200';
    }
  };

  const formatRelativeTime = (timestamp: string) => {
    const now = new Date();
    const time = new Date(timestamp);
    const diff = now.getTime() - time.getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    
    if (hours < 1) {
      const minutes = Math.floor(diff / (1000 * 60));
      return `${minutes}m ago`;
    }
    if (hours < 24) {
      return `${hours}h ago`;
    }
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  };

  const formatEventDate = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const eventDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    
    const diffTime = eventDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) {
      return `Today at ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    } else if (diffDays === 1) {
      return `Tomorrow at ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    } else if (diffDays < 7) {
      return `${diffDays} days at ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    } else {
      return date.toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    }
  };

  return (
    <div>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Quick Actions */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Team Dashboard</h1>
            <p className="text-gray-600">Monitor team performance, activity, and upcoming events</p>
          </div>
          <div className="flex gap-3 mt-4 md:mt-0">
            <button
              onClick={() => navigate('/team/invite')}
              className="px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition flex items-center gap-2"
            >
              <UserPlus className="w-5 h-5" />
              Invite Member
            </button>
            <button
              onClick={() => navigate('/team/members')}
              className="px-6 py-3 border border-purple-600 text-purple-600 rounded-lg hover:bg-purple-50 transition flex items-center gap-2"
            >
              <Users className="w-5 h-5" />
              View All Members
            </button>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Stats Section */}
            <div className="lg:col-span-2 space-y-6">
              {/* Key Metrics */}
              <div className="bg-white rounded-lg shadow p-6">
                <h2 className="text-xl font-bold text-gray-900 mb-6">Team Metrics</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                  <div className="text-center">
                    <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center mx-auto mb-3">
                      <Users className="w-6 h-6 text-purple-600" />
                    </div>
                    <div className="text-2xl font-bold text-gray-900">{stats.totalMembers}</div>
                    <div className="text-sm text-gray-600">Total Members</div>
                    <div className="text-xs text-green-600 mt-1">
                      {stats.activeMembers} active
                    </div>
                  </div>
                  
                  <div className="text-center">
                    <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mx-auto mb-3">
                      <Briefcase className="w-6 h-6 text-blue-600" />
                    </div>
                    <div className="text-2xl font-bold text-gray-900">{stats.departments}</div>
                    <div className="text-sm text-gray-600">Departments</div>
                    <div className="text-xs text-gray-500 mt-1">
                      Cross-functional
                    </div>
                  </div>
                  
                  <div className="text-center">
                    <div className="w-12 h-12 bg-yellow-100 rounded-lg flex items-center justify-center mx-auto mb-3">
                      <Star className="w-6 h-6 text-yellow-600" />
                    </div>
                    <div className="text-2xl font-bold text-gray-900">{stats.averageRating}</div>
                    <div className="text-sm text-gray-600">Avg Rating</div>
                    <div className="text-xs text-yellow-600 mt-1">
                      High performance
                    </div>
                  </div>
                  
                  <div className="text-center">
                    <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center mx-auto mb-3">
                      <TrendingUp className="w-6 h-6 text-green-600" />
                    </div>
                    <div className="text-2xl font-bold text-gray-900">{stats.activeProjects}</div>
                    <div className="text-sm text-gray-600">Active Projects</div>
                    <div className="text-xs text-green-600 mt-1">
                      {stats.completedProjects} completed
                    </div>
                  </div>
                </div>
              </div>

              {/* Project Overview */}
              <div className="bg-white rounded-lg shadow p-6">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-xl font-bold text-gray-900">Project Overview</h2>
                  <button
                    onClick={() => navigate('/production/projects')}
                    className="text-purple-600 hover:text-purple-700 text-sm font-medium flex items-center gap-1"
                  >
                    View All <BarChart3 className="w-4 h-4" />
                  </button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-blue-600 font-medium">Total Projects</span>
                      <FileText className="w-5 h-5 text-blue-600" />
                    </div>
                    <div className="text-2xl font-bold text-blue-900">{stats.totalProjects}</div>
                    <div className="text-sm text-blue-600">All time</div>
                  </div>
                  
                  <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-green-600 font-medium">Completed</span>
                      <CheckCircle className="w-5 h-5 text-green-600" />
                    </div>
                    <div className="text-2xl font-bold text-green-900">{stats.completedProjects}</div>
                    <div className="text-sm text-green-600">
                      {Math.round((stats.completedProjects / stats.totalProjects) * 100)}% success rate
                    </div>
                  </div>
                  
                  <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-purple-600 font-medium">In Progress</span>
                      <Clock className="w-5 h-5 text-purple-600" />
                    </div>
                    <div className="text-2xl font-bold text-purple-900">{stats.activeProjects}</div>
                    <div className="text-sm text-purple-600">Active now</div>
                  </div>
                </div>
              </div>

              {/* Recent Activity */}
              <div className="bg-white rounded-lg shadow p-6">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-xl font-bold text-gray-900">Recent Activity</h2>
                  <button className="text-purple-600 hover:text-purple-700 text-sm font-medium">
                    View All
                  </button>
                </div>
                <div className="space-y-4">
                  {recentActivity.map((activity) => {
                    const Icon = getActivityIcon(activity.type);
                    return (
                      <div key={activity.id} className="flex items-start gap-4">
                        <div className={`p-2 rounded-lg ${getActivityColor(activity.type)}`}>
                          <Icon className="w-4 h-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-medium text-gray-900">{activity.user}</span>
                            <span className="text-gray-600">{activity.description}</span>
                          </div>
                          {activity.metadata && (
                            <div className="text-sm text-gray-500">
                              {activity.metadata.projectName && `Project: ${activity.metadata.projectName}`}
                              {activity.metadata.role && ` • Role: ${activity.metadata.role}`}
                              {activity.metadata.department && ` • Department: ${activity.metadata.department}`}
                            </div>
                          )}
                        </div>
                        <span className="text-sm text-gray-500 flex-shrink-0">
                          {formatRelativeTime(activity.timestamp)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Sidebar */}
            <div className="space-y-6">
              {/* Pending Invites */}
              <div className="bg-white rounded-lg shadow p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-bold text-gray-900">Pending Invites</h3>
                  <span className="px-2 py-1 bg-yellow-100 text-yellow-800 rounded-full text-sm font-medium">
                    {stats.pendingInvites}
                  </span>
                </div>
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 bg-yellow-100 rounded-lg flex items-center justify-center">
                    <Clock className="w-5 h-5 text-yellow-600" />
                  </div>
                  <div>
                    <div className="font-medium text-gray-900">
                      {stats.pendingInvites} invitations waiting
                    </div>
                    <div className="text-sm text-gray-600">Review and manage</div>
                  </div>
                </div>
                <button
                  onClick={() => navigate('/team/invite')}
                  className="w-full px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition text-sm"
                >
                  Manage Invites
                </button>
              </div>

              {/* Upcoming Events */}
              <div className="bg-white rounded-lg shadow p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-bold text-gray-900">Upcoming Events</h3>
                  <Calendar className="w-5 h-5 text-gray-500" />
                </div>
                <div className="space-y-3">
                  {upcomingEvents.slice(0, 3).map((event) => {
                    const Icon = getEventIcon(event.type);
                    return (
                      <div key={event.id} className={`p-3 rounded-lg border ${getEventColor(event.priority)}`}>
                        <div className="flex items-start gap-3">
                          <Icon className="w-4 h-4 mt-1 flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <div className="font-medium text-gray-900 text-sm">{event.title}</div>
                            <div className="text-xs text-gray-600 mt-1">
                              {formatEventDate(event.date)}
                            </div>
                            <div className="text-xs text-gray-500 mt-1">
                              {Array.isArray(event.participants) ? event.participants.slice(0, 2).join(', ') : event.participants}
                              {Array.isArray(event.participants) && event.participants.length > 2 && ` +${event.participants.length - 2} more`}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
                <button
                  onClick={() => navigate('/calendar')}
                  className="w-full px-4 py-2 mt-4 text-purple-600 border border-purple-600 rounded-lg hover:bg-purple-50 transition text-sm"
                >
                  View Calendar
                </button>
              </div>

              {/* Quick Actions */}
              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="text-lg font-bold text-gray-900 mb-4">Quick Actions</h3>
                <div className="space-y-3">
                  <button
                    onClick={() => navigate('/team/members')}
                    className="w-full flex items-center gap-3 px-4 py-3 text-left text-gray-700 hover:bg-gray-50 rounded-lg transition"
                  >
                    <Users className="w-5 h-5 text-purple-600" />
                    <div>
                      <div className="font-medium">Manage Members</div>
                      <div className="text-sm text-gray-600">View and edit team</div>
                    </div>
                  </button>
                  
                  <button
                    onClick={() => navigate('/team/invite')}
                    className="w-full flex items-center gap-3 px-4 py-3 text-left text-gray-700 hover:bg-gray-50 rounded-lg transition"
                  >
                    <UserPlus className="w-5 h-5 text-green-600" />
                    <div>
                      <div className="font-medium">Send Invites</div>
                      <div className="text-sm text-gray-600">Invite new members</div>
                    </div>
                  </button>
                  
                  <button
                    onClick={() => navigate('/production/analytics')}
                    className="w-full flex items-center gap-3 px-4 py-3 text-left text-gray-700 hover:bg-gray-50 rounded-lg transition"
                  >
                    <BarChart3 className="w-5 h-5 text-blue-600" />
                    <div>
                      <div className="font-medium">View Analytics</div>
                      <div className="text-sm text-gray-600">Team performance</div>
                    </div>
                  </button>
                  
                  <button
                    onClick={() => navigate('/settings')}
                    className="w-full flex items-center gap-3 px-4 py-3 text-left text-gray-700 hover:bg-gray-50 rounded-lg transition"
                  >
                    <Shield className="w-5 h-5 text-yellow-600" />
                    <div>
                      <div className="font-medium">Team Settings</div>
                      <div className="text-sm text-gray-600">Permissions & roles</div>
                    </div>
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}