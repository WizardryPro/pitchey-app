import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  Users, Plus, Search, Filter, Star, MapPin, Calendar,
  Mail, Phone, Globe, ExternalLink, MessageCircle, FileText,
  CheckCircle, Clock, XCircle, AlertCircle, Eye, Edit2,
  Handshake, Building, Award, TrendingUp, DollarSign
} from 'lucide-react';
import { useBetterAuthStore } from '@/store/betterAuthStore';
import { config } from '@/config';
import { CollaborationService } from '@/services/collaboration.service';

interface Collaboration {
  id: string;
  partnerName: string;
  partnerType: 'studio' | 'distributor' | 'investor' | 'agency' | 'vendor' | 'talent';
  status: 'active' | 'pending' | 'completed' | 'paused' | 'cancelled';
  startDate: string;
  endDate?: string;
  projectCount: number;
  totalValue: number;
  description: string;
  contactPerson: string;
  contactEmail: string;
  contactPhone?: string;
  website?: string;
  logo?: string;
  location: string;
  rating: number;
  tags: string[];
  lastActivity: string;
  documents: CollaborationDocument[];
  projects: CollaborationProject[];
}

interface CollaborationDocument {
  id: string;
  name: string;
  type: 'contract' | 'nda' | 'proposal' | 'agreement' | 'other';
  uploadedAt: string;
  size: string;
  url?: string;
}

interface CollaborationProject {
  id: string;
  name: string;
  status: 'planning' | 'active' | 'completed' | 'cancelled';
  startDate: string;
  budget: number;
}

const partnerTypes = [
  { value: 'studio', label: 'Production Studio', icon: Building },
  { value: 'distributor', label: 'Distributor', icon: TrendingUp },
  { value: 'investor', label: 'Investor', icon: DollarSign },
  { value: 'agency', label: 'Agency', icon: Users },
  { value: 'vendor', label: 'Service Vendor', icon: Handshake },
  { value: 'talent', label: 'Talent Agency', icon: Star }
];

export default function ProductionCollaborations() {
  const navigate = useNavigate();
  const { user } = useBetterAuthStore();
  const userType = user?.userType || 'production';
  
  const [collaborations, setCollaborations] = useState<Collaboration[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedType, setSelectedType] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedCollaboration, setSelectedCollaboration] = useState<Collaboration | null>(null);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  useEffect(() => {
    fetchCollaborations();
  }, []);

  const fetchCollaborations = async () => {
    try {
      setLoading(true);
      const results = await CollaborationService.getCollaborations();
      const mapped: Collaboration[] = results.map((c: any) => ({
        id: String(c.id || ''),
        partnerName: c.partner?.name || c.partnerName || c.title || c.partner?.email?.split('@')[0] || c.contactEmail?.split('@')[0] || 'Unnamed Partner',
        partnerType: (c.partner?.type || c.partnerType || c.type || 'vendor') as Collaboration['partnerType'],
        status: (c.status || 'pending') as Collaboration['status'],
        startDate: c.startDate || c.start_date || c.proposedDate || '',
        endDate: c.endDate || c.end_date,
        projectCount: c.projectCount || c.project_count || 0,
        totalValue: c.totalValue || c.total_value || c.terms?.budget || 0,
        description: c.description || '',
        contactPerson: c.contactPerson || c.contact_person || c.partner?.name || '',
        contactEmail: c.contactEmail || c.contact_email || '',
        contactPhone: c.contactPhone || c.contact_phone,
        website: c.website,
        logo: c.logo || c.partner?.avatar,
        location: c.location || '',
        rating: c.rating || c.metrics?.rating || 0,
        tags: c.tags || [],
        lastActivity: c.lastUpdate || c.last_activity || c.lastActivity || '',
        documents: (c.documents || []).map((d: any) => ({
          id: String(d.id || ''),
          name: d.name || '',
          type: (d.type || 'other') as CollaborationDocument['type'],
          uploadedAt: d.uploadedAt || d.uploaded_at || '',
          size: d.size || ''
        })),
        projects: (c.projects || []).map((p: any) => ({
          id: String(p.id || ''),
          name: p.name || p.title || '',
          status: (p.status || 'planning') as CollaborationProject['status'],
          startDate: p.startDate || p.start_date || '',
          budget: p.budget || 0
        }))
      }));
      setCollaborations(mapped);
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      console.error('Failed to fetch collaborations:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredCollaborations = collaborations.filter(collaboration => {
    const matchesSearch = collaboration.partnerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         collaboration.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         collaboration.tags.some(tag => tag.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesType = selectedType === 'all' || collaboration.partnerType === selectedType;
    const matchesStatus = selectedStatus === 'all' || collaboration.status === selectedStatus;
    
    return matchesSearch && matchesType && matchesStatus;
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'text-green-600 bg-green-100';
      case 'pending': return 'text-yellow-600 bg-yellow-100';
      case 'completed': return 'text-blue-600 bg-blue-100';
      case 'paused': return 'text-orange-600 bg-orange-100';
      case 'cancelled': return 'text-red-600 bg-red-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'active': return CheckCircle;
      case 'pending': return Clock;
      case 'completed': return CheckCircle;
      case 'paused': return AlertCircle;
      case 'cancelled': return XCircle;
      default: return AlertCircle;
    }
  };

  const getPartnerTypeIcon = (type: string) => {
    return partnerTypes.find(pt => pt.value === type)?.icon || Building;
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const CollaborationCard = ({ collaboration }: { collaboration: Collaboration }) => {
    const StatusIcon = getStatusIcon(collaboration.status);
    const TypeIcon = getPartnerTypeIcon(collaboration.partnerType);

    return (
      <div className="bg-white rounded-lg shadow-lg overflow-hidden hover:shadow-xl transition-shadow duration-300">
        <div className="p-6">
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-lg flex items-center justify-center">
                <TypeIcon className="w-6 h-6 text-white" />
              </div>
              <div>
                <h3 className="font-bold text-gray-900 text-lg">{collaboration.partnerName}</h3>
                <p className="text-sm text-gray-600 capitalize">{collaboration.partnerType}</p>
              </div>
            </div>
            <span className={`px-3 py-1 rounded-full text-xs font-medium flex items-center gap-1 ${getStatusColor(collaboration.status)}`}>
              <StatusIcon className="w-3 h-3" />
              {collaboration.status}
            </span>
          </div>

          <p className="text-gray-700 text-sm mb-4 line-clamp-2">{collaboration.description}</p>

          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <div className="text-sm text-gray-500">Projects</div>
              <div className="font-semibold text-gray-900">{collaboration.projectCount}</div>
            </div>
            <div>
              <div className="text-sm text-gray-500">Total Value</div>
              <div className="font-semibold text-green-600">{formatCurrency(collaboration.totalValue)}</div>
            </div>
          </div>

          <div className="flex items-center gap-2 text-sm text-gray-600 mb-4">
            <MapPin className="w-4 h-4" />
            <span>{collaboration.location}</span>
            <Star className="w-4 h-4 text-yellow-500 ml-2" />
            <span>{collaboration.rating}</span>
          </div>

          <div className="flex flex-wrap gap-1 mb-4">
            {collaboration.tags.slice(0, 3).map(tag => (
              <span key={tag} className="px-2 py-1 bg-purple-100 text-purple-800 text-xs rounded-full">
                {tag}
              </span>
            ))}
            {collaboration.tags.length > 3 && (
              <span className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded-full">
                +{collaboration.tags.length - 3}
              </span>
            )}
          </div>

          <div className="flex justify-between items-center">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setSelectedCollaboration(collaboration)}
                className="px-3 py-1 text-purple-600 hover:bg-purple-50 rounded-lg transition text-sm"
              >
                <Eye className="w-4 h-4 inline mr-1" />
                View Details
              </button>
              {collaboration.contactEmail && (
                <button
                  onClick={() => window.location.href = `mailto:${collaboration.contactEmail}`}
                  className="p-1 text-gray-600 hover:bg-gray-100 rounded transition"
                >
                  <Mail className="w-4 h-4" />
                </button>
              )}
              {collaboration.website && (
                <button
                  onClick={() => window.open(collaboration.website, '_blank')}
                  className="p-1 text-gray-600 hover:bg-gray-100 rounded transition"
                >
                  <ExternalLink className="w-4 h-4" />
                </button>
              )}
            </div>
            <div className="text-xs text-gray-400">
              {new Date(collaboration.lastActivity).toLocaleDateString()}
            </div>
          </div>
        </div>
      </div>
    );
  };

  const CollaborationDetail = ({ collaboration }: { collaboration: Collaboration }) => (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-lg flex items-center justify-center">
                {React.createElement(getPartnerTypeIcon(collaboration.partnerType), { 
                  className: "w-8 h-8 text-white" 
                })}
              </div>
              <div>
                <h2 className="text-2xl font-bold text-gray-900">{collaboration.partnerName}</h2>
                <p className="text-gray-600 capitalize">{collaboration.partnerType}</p>
              </div>
            </div>
            <button
              onClick={() => setSelectedCollaboration(null)}
              className="p-2 hover:bg-gray-100 rounded-lg transition"
            >
              <XCircle className="w-6 h-6 text-gray-500" />
            </button>
          </div>
        </div>

        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <div className="col-span-2">
              <h3 className="font-semibold text-gray-900 mb-2">Description</h3>
              <p className="text-gray-700">{collaboration.description}</p>
              
              <h3 className="font-semibold text-gray-900 mb-2 mt-4">Contact Information</h3>
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm">
                  <Users className="w-4 h-4 text-gray-500" />
                  <span>{collaboration.contactPerson}</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Mail className="w-4 h-4 text-gray-500" />
                  <span>{collaboration.contactEmail}</span>
                </div>
                {collaboration.contactPhone && (
                  <div className="flex items-center gap-2 text-sm">
                    <Phone className="w-4 h-4 text-gray-500" />
                    <span>{collaboration.contactPhone}</span>
                  </div>
                )}
                {collaboration.website && (
                  <div className="flex items-center gap-2 text-sm">
                    <Globe className="w-4 h-4 text-gray-500" />
                    <a href={collaboration.website} target="_blank" rel="noopener noreferrer" className="text-purple-600 hover:underline">
                      {collaboration.website}
                    </a>
                  </div>
                )}
              </div>
            </div>

            <div>
              <div className="bg-gray-50 rounded-lg p-4">
                <h3 className="font-semibold text-gray-900 mb-3">Key Metrics</h3>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Status</span>
                    <span className={`px-2 py-1 rounded text-xs font-medium ${getStatusColor(collaboration.status)}`}>
                      {collaboration.status}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Projects</span>
                    <span className="font-semibold">{collaboration.projectCount}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Total Value</span>
                    <span className="font-semibold text-green-600">{formatCurrency(collaboration.totalValue)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Rating</span>
                    <span className="flex items-center gap-1">
                      <Star className="w-4 h-4 text-yellow-500" />
                      {collaboration.rating}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Start Date</span>
                    <span>{new Date(collaboration.startDate).toLocaleDateString()}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Projects */}
          {collaboration.projects.length > 0 && (
            <div className="mb-6">
              <h3 className="font-semibold text-gray-900 mb-3">Projects</h3>
              <div className="grid gap-3">
                {collaboration.projects.map(project => (
                  <div key={project.id} className="flex justify-between items-center p-3 border rounded-lg">
                    <div>
                      <div className="font-medium">{project.name}</div>
                      <div className="text-sm text-gray-600">Started {new Date(project.startDate).toLocaleDateString()}</div>
                    </div>
                    <div className="text-right">
                      <div className="font-semibold">{formatCurrency(project.budget)}</div>
                      <div className={`text-xs px-2 py-1 rounded ${getStatusColor(project.status)}`}>
                        {project.status}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Documents */}
          {collaboration.documents.length > 0 && (
            <div>
              <h3 className="font-semibold text-gray-900 mb-3">Documents</h3>
              <div className="space-y-2">
                {collaboration.documents.map(doc => (
                  <div key={doc.id} className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex items-center gap-3">
                      <FileText className="w-5 h-5 text-gray-500" />
                      <div>
                        <div className="font-medium">{doc.name}</div>
                        <div className="text-sm text-gray-600">
                          {doc.type} • {doc.size} • {new Date(doc.uploadedAt).toLocaleDateString()}
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={() => {
                        if (doc.url) {
                          window.open(doc.url, '_blank');
                        } else {
                          toast('Document not yet available for download', { icon: 'ℹ️' });
                        }
                      }}
                      className="px-3 py-1 text-purple-600 hover:bg-purple-50 rounded transition text-sm"
                    >
                      Download
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <div>
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Collaborations</h1>
            <p className="text-gray-600">Manage partnerships and external collaborations</p>
          </div>
          <button
            onClick={() => setShowCreateModal(true)}
            className="mt-4 md:mt-0 px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition flex items-center gap-2"
          >
            <Plus className="w-5 h-5" />
            New Collaboration
          </button>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-lg shadow p-4 mb-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="w-5 h-5 text-gray-400 absolute left-3 top-1/2 transform -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search collaborations, partners, or projects..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500"
                />
              </div>
            </div>
            
            <select
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value)}
              className="px-4 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500"
            >
              <option value="all">All Types</option>
              {partnerTypes.map(type => (
                <option key={type.value} value={type.value}>{type.label}</option>
              ))}
            </select>
            
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="px-4 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500"
            >
              <option value="all">All Statuses</option>
              <option value="active">Active</option>
              <option value="pending">Pending</option>
              <option value="completed">Completed</option>
              <option value="paused">Paused</option>
              <option value="cancelled">Cancelled</option>
            </select>

            <div className="flex border rounded-lg">
              <button
                onClick={() => setViewMode('grid')}
                className={`px-3 py-2 ${viewMode === 'grid' ? 'bg-purple-100 text-purple-600' : 'text-gray-600'} transition`}
              >
                Grid
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`px-3 py-2 ${viewMode === 'list' ? 'bg-purple-100 text-purple-600' : 'text-gray-600'} transition`}
              >
                List
              </button>
            </div>
          </div>
        </div>

        {/* Collaborations Grid/List */}
        {loading ? (
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
          </div>
        ) : filteredCollaborations.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-lg">
            <Handshake className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500 text-lg">No collaborations found</p>
            <p className="text-gray-400">Start building partnerships with industry professionals</p>
          </div>
        ) : (
          <div className={viewMode === 'grid' ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6' : 'space-y-4'}>
            {filteredCollaborations.map(collaboration => (
              <CollaborationCard key={collaboration.id} collaboration={collaboration} />
            ))}
          </div>
        )}

        {/* Collaboration Detail Modal */}
        {selectedCollaboration && (
          <CollaborationDetail collaboration={selectedCollaboration} />
        )}

        {/* New Collaboration Modal */}
        {showCreateModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-lg mx-4 p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-4">New Collaboration</h2>
              <form onSubmit={async (e) => {
                e.preventDefault();
                const form = e.currentTarget;
                const formData = new FormData(form);
                try {
                  await CollaborationService.createCollaboration({
                    title: formData.get('title') as string,
                    type: formData.get('type') as any,
                    partnerId: formData.get('partnerId') as string,
                    description: formData.get('description') as string,
                    priority: (formData.get('priority') as any) || 'medium',
                  });
                  toast.success('Collaboration created');
                  setShowCreateModal(false);
                  fetchCollaborations();
                } catch (err) {
                  const error = err instanceof Error ? err : new Error(String(err));
                  toast.error(error.message);
                }
              }}>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
                    <input name="title" required className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500" placeholder="Collaboration title" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
                    <select name="type" required className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500">
                      <option value="co-production">Co-Production</option>
                      <option value="distribution">Distribution</option>
                      <option value="financing">Financing</option>
                      <option value="talent">Talent</option>
                      <option value="vendor">Vendor</option>
                      <option value="other">Other</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Partner ID</label>
                    <input name="partnerId" required className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500" placeholder="Partner user ID or email" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Priority</label>
                    <select name="priority" className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500">
                      <option value="low">Low</option>
                      <option value="medium" selected>Medium</option>
                      <option value="high">High</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                    <textarea name="description" required rows={3} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500" placeholder="Describe the collaboration..." />
                  </div>
                </div>
                <div className="flex justify-end gap-3 mt-6">
                  <button type="button" onClick={() => setShowCreateModal(false)} className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200">Cancel</button>
                  <button type="submit" className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700">Create</button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}