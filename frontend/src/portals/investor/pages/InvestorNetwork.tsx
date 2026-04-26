import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Users, Building2, UserCheck, TrendingUp,
  Search, Filter, Globe, Award, Star,
  Briefcase, DollarSign, Film, MessageSquare,
  Calendar, MapPin, Link2, Mail, Phone,
  ChevronRight, Plus, Check, X
} from 'lucide-react';
import { investorApi } from '@features/deals/services/investor.service';

interface NetworkMember {
  id: string;
  name: string;
  type: 'investor' | 'creator' | 'production';
  avatar?: string;
  title: string;
  company?: string;
  location?: string;
  connectionStatus: 'connected' | 'pending' | 'suggested';
  bio?: string;
  stats: {
    investments?: number;
    portfolio?: number;
    productions?: number;
    pitches?: number;
    successRate?: number;
  };
  interests?: string[];
  mutualConnections?: number;
  joinedDate?: string;
  lastActive?: string;
}

export default function InvestorNetwork() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'investor' | 'creator' | 'production'>('all');
  const [networkMembers, setNetworkMembers] = useState<NetworkMember[]>([]);
  const [filteredMembers, setFilteredMembers] = useState<NetworkMember[]>([]);

  useEffect(() => {
    loadNetworkData();
  }, []);

  useEffect(() => {
    filterMembers();
  }, [networkMembers, searchQuery, filterType]);

  const loadNetworkData = async () => {
    try {
      const response = await investorApi.getNetwork();
      if (response.success && response.data) {
        const data = response.data as any;
        const connections: any[] = data.connections || data.network || [];
        const mapped: NetworkMember[] = connections.map((c: any) => ({
          id: String(c.id || ''),
          name: c.name || c.username || 'Unknown',
          type: (c.user_type || c.type || 'investor') as 'investor' | 'creator' | 'production',
          avatar: c.avatar_url || c.avatar,
          title: c.title || c.role || '',
          company: c.company_name || c.company,
          location: c.location || '',
          connectionStatus: (c.connection_status || c.status || 'suggested') as 'connected' | 'pending' | 'suggested',
          bio: c.bio || '',
          stats: {
            investments: c.investments_count || c.investments || 0,
            portfolio: c.portfolio_count || c.portfolio || 0,
            productions: c.productions_count || c.productions || 0,
            pitches: c.pitches_count || c.pitches || 0,
            successRate: c.success_rate || c.successRate || 0
          },
          interests: c.interests || c.genres || [],
          mutualConnections: c.mutual_connections || 0,
          joinedDate: c.joined_date || c.created_at || '',
          lastActive: c.last_active || ''
        }));
        setNetworkMembers(mapped);
      }
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      console.error('Failed to load network data:', error);
    } finally {
      setLoading(false);
    }
  };

  const filterMembers = () => {
    let filtered = [...networkMembers];

    // Filter by type
    if (filterType !== 'all') {
      filtered = filtered.filter(member => member.type === filterType);
    }

    // Filter by search query
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(member =>
        member.name.toLowerCase().includes(query) ||
        member.title.toLowerCase().includes(query) ||
        member.company?.toLowerCase().includes(query) ||
        member.interests?.some(interest => interest.toLowerCase().includes(query))
      );
    }

    setFilteredMembers(filtered);
  };

  const handleConnect = async (memberId: string) => {
    const API_URL = import.meta.env.VITE_API_URL || '';
    try {
      await fetch(`${API_URL}/api/investor/connections/${memberId}`, {
        method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }
      });
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      console.error('Failed to send connection request:', error);
    }
    setNetworkMembers(prev => prev.map(member =>
      member.id === memberId
        ? { ...member, connectionStatus: 'pending' }
        : member
    ));
  };

  const handleAcceptConnection = async (memberId: string) => {
    const API_URL = import.meta.env.VITE_API_URL || '';
    try {
      await fetch(`${API_URL}/api/investor/connections/${memberId}/accept`, {
        method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }
      });
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      console.error('Failed to accept connection:', error);
    }
    setNetworkMembers(prev => prev.map(member =>
      member.id === memberId
        ? { ...member, connectionStatus: 'connected' }
        : member
    ));
  };

  const getMemberIcon = (type: string) => {
    switch (type) {
      case 'investor':
        return DollarSign;
      case 'creator':
        return Film;
      case 'production':
        return Building2;
      default:
        return Users;
    }
  };

  const getMemberColor = (type: string) => {
    switch (type) {
      case 'investor':
        return 'text-indigo-600 bg-indigo-100';
      case 'creator':
        return 'text-purple-600 bg-purple-100';
      case 'production':
        return 'text-blue-600 bg-blue-100';
      default:
        return 'text-gray-600 bg-gray-100';
    }
  };

  if (loading) {
    return (
      <div>
                <div className="flex items-center justify-center h-64">
          <div className="text-gray-600">Loading network...</div>
        </div>
      </div>
    );
  }

  const connectedCount = networkMembers.filter(m => m.connectionStatus === 'connected').length;
  const pendingCount = networkMembers.filter(m => m.connectionStatus === 'pending').length;

  return (
    <div>
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Page Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">My Network</h1>
          <p className="mt-2 text-sm text-gray-600">
            Connect with investors, creators, and production companies
          </p>
          <div className="mt-4 flex items-center space-x-6 text-sm">
            <div className="flex items-center">
              <UserCheck className="w-4 h-4 text-indigo-500 mr-1" />
              <span className="text-gray-700">
                <span className="font-semibold">{connectedCount}</span> Connections
              </span>
            </div>
            <div className="flex items-center">
              <Users className="w-4 h-4 text-yellow-500 mr-1" />
              <span className="text-gray-700">
                <span className="font-semibold">{pendingCount}</span> Pending
              </span>
            </div>
            <div className="flex items-center">
              <Globe className="w-4 h-4 text-blue-500 mr-1" />
              <span className="text-gray-700">
                <span className="font-semibold">{networkMembers.length}</span> Total Network
              </span>
            </div>
          </div>
        </div>

        {/* Search and Filters */}
        <div className="bg-white shadow rounded-lg p-6 mb-6">
          <div className="flex flex-col lg:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input
                  type="text"
                  id="network-search"
                  name="network-search"
                  placeholder="Search by name, company, or interests..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  autoComplete="off"
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:ring-purple-500 focus:border-purple-500"
                />
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <Filter className="w-5 h-5 text-gray-400" />
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value as any)}
                className="border border-gray-300 rounded-md px-4 py-2 focus:ring-purple-500 focus:border-purple-500"
              >
                <option value="all">All Types</option>
                <option value="investor">Investors</option>
                <option value="creator">Creators</option>
                <option value="production">Production Companies</option>
              </select>
            </div>
          </div>
        </div>

        {/* Network Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {filteredMembers.map((member) => {
            const Icon = getMemberIcon(member.type);
            const colorClass = getMemberColor(member.type);

            return (
              <div key={member.id} className="bg-white rounded-lg shadow hover:shadow-lg transition-shadow">
                <div className="p-6">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start space-x-4">
                      <div className={`w-12 h-12 rounded-full ${colorClass} flex items-center justify-center`}>
                        <Icon className="w-6 h-6" />
                      </div>
                      <div className="flex-1">
                        <h3 className="text-lg font-semibold text-gray-900">{member.name}</h3>
                        <p className="text-sm text-gray-600">{member.title}</p>
                        {member.company && (
                          <p className="text-sm text-gray-500">{member.company}</p>
                        )}
                        {member.location && (
                          <div className="mt-1 flex items-center text-sm text-gray-500">
                            <MapPin className="w-3 h-3 mr-1" />
                            {member.location}
                          </div>
                        )}
                      </div>
                    </div>
                    
                    {/* Connection Status */}
                    <div>
                      {member.connectionStatus === 'connected' ? (
                        <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800">
                          <Check className="w-3 h-3 mr-1" />
                          Connected
                        </span>
                      ) : member.connectionStatus === 'pending' ? (
                        <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                          Pending
                        </span>
                      ) : (
                        <button
                          onClick={() => handleConnect(member.id)}
                          className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800 hover:bg-purple-200"
                        >
                          <Plus className="w-3 h-3 mr-1" />
                          Connect
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Bio */}
                  {member.bio && (
                    <p className="mt-3 text-sm text-gray-600">{member.bio}</p>
                  )}

                  {/* Stats */}
                  <div className="mt-4 flex items-center space-x-4 text-sm">
                    {member.stats.investments !== undefined && (
                      <div>
                        <span className="font-semibold text-gray-900">{member.stats.investments}</span>
                        <span className="text-gray-500 ml-1">Investments</span>
                      </div>
                    )}
                    {member.stats.portfolio !== undefined && (
                      <div>
                        <span className="font-semibold text-gray-900">{member.stats.portfolio}</span>
                        <span className="text-gray-500 ml-1">Portfolio</span>
                      </div>
                    )}
                    {member.stats.productions !== undefined && (
                      <div>
                        <span className="font-semibold text-gray-900">{member.stats.productions}</span>
                        <span className="text-gray-500 ml-1">Productions</span>
                      </div>
                    )}
                    {member.stats.pitches !== undefined && (
                      <div>
                        <span className="font-semibold text-gray-900">{member.stats.pitches}</span>
                        <span className="text-gray-500 ml-1">Pitches</span>
                      </div>
                    )}
                    {member.stats.successRate !== undefined && (
                      <div className="flex items-center">
                        <TrendingUp className="w-4 h-4 text-indigo-500 mr-1" />
                        <span className="font-semibold text-gray-900">{member.stats.successRate}%</span>
                      </div>
                    )}
                  </div>

                  {/* Interests */}
                  {member.interests && (
                    <div className="mt-4">
                      <div className="flex flex-wrap gap-2">
                        {member.interests.map((interest, idx) => (
                          <span
                            key={idx}
                            className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800"
                          >
                            {interest}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Footer */}
                  <div className="mt-4 pt-4 border-t border-gray-200 flex items-center justify-between text-xs text-gray-500">
                    <div className="flex items-center space-x-3">
                      {member.mutualConnections && (
                        <span>{member.mutualConnections} mutual connections</span>
                      )}
                      {member.lastActive && (
                        <span>Active {member.lastActive}</span>
                      )}
                    </div>
                    <button
                      onClick={() => navigate(`/network/${member.id}`)}
                      className="text-indigo-600 hover:text-purple-700 font-medium"
                    >
                      View Profile
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Empty State */}
        {filteredMembers.length === 0 && (
          <div className="bg-white rounded-lg shadow p-12 text-center">
            <Users className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No network members found</h3>
            <p className="text-gray-600">Try adjusting your search or filter criteria</p>
          </div>
        )}
      </div>
    </div>
  );
}