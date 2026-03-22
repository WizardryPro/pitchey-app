import { useState } from 'react';
import { 
  Shield, Clock, CheckCircle, XCircle, AlertTriangle, 
  Search, Eye, Building2, DollarSign, User,
  Calendar, Download, Bell
} from 'lucide-react';

interface NDAItem {
  id: number;
  pitchId: number;
  pitchTitle: string;
  status: 'pending' | 'approved' | 'rejected' | 'signed' | 'expired';
  ndaType: 'basic' | 'enhanced' | 'custom';
  requestedDate?: string;
  signedDate?: string;
  expiresAt?: string;
  expiresIn?: string;
  requester?: string;
  requesterType?: 'creator' | 'investor' | 'production';
  companyName?: string;
  creator?: string;
  creatorType?: 'creator' | 'investor' | 'production';
  signerName?: string;
  signerType?: 'creator' | 'investor' | 'production';
  signerCompany?: string;
  message?: string;
  rejectionReason?: string;
  accessGranted?: boolean;
}

interface NDAManagementPanelProps {
  category: 'incoming-signed' | 'outgoing-signed' | 'incoming-requests' | 'outgoing-requests';
  items: NDAItem[];
  onApprove?: (item: NDAItem) => void;
  onReject?: (item: NDAItem) => void;
  onViewPitch?: (pitchId: number) => void;
  onDownloadNDA?: (item: NDAItem) => void;
  title: string;
  description: string;
  emptyMessage?: string;
  showActions?: boolean;
}

export default function NDAManagementPanel({
  category,
  items,
  onApprove,
  onReject,
  onViewPitch,
  onDownloadNDA,
  title,
  description,
  emptyMessage,
  showActions = false
}: NDAManagementPanelProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterType, setFilterType] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'date' | 'company' | 'pitch'>('date');

  // Filter and sort items
  const filteredItems = items.filter(item => {
    const matchesSearch = item.pitchTitle.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         item.companyName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         item.creator?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         item.requester?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         item.signerName?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = filterStatus === 'all' || item.status === filterStatus;
    const matchesType = filterType === 'all' || item.ndaType === filterType;
    
    return matchesSearch && matchesStatus && matchesType;
  }).sort((a, b) => {
    switch (sortBy) {
      case 'company':
        const aCompany = a.companyName || a.creator || a.requester || a.signerName || '';
        const bCompany = b.companyName || b.creator || b.requester || b.signerName || '';
        return aCompany.localeCompare(bCompany);
      case 'pitch':
        return a.pitchTitle.localeCompare(b.pitchTitle);
      default: // date
        const aDate = a.signedDate || a.requestedDate || '';
        const bDate = b.signedDate || b.requestedDate || '';
        return new Date(bDate).getTime() - new Date(aDate).getTime();
    }
  });

  const getStatusBadge = (status: string) => {
    const styles = {
      pending: 'bg-yellow-100 text-yellow-800 border-yellow-300',
      approved: 'bg-green-100 text-green-800 border-green-300',
      rejected: 'bg-red-100 text-red-800 border-red-300',
      signed: 'bg-blue-100 text-blue-800 border-blue-300',
      expired: 'bg-gray-100 text-gray-800 border-gray-300'
    };
    
    const icons = {
      pending: Clock,
      approved: CheckCircle,
      rejected: XCircle,
      signed: Shield,
      expired: AlertTriangle
    };
    
    const Icon = icons[status as keyof typeof icons] || Shield;
    
    return (
      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium border ${styles[status as keyof typeof styles] || styles.pending}`}>
        <Icon className="w-3 h-3" />
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </span>
    );
  };

  const getTypeBadge = (type: string) => {
    const styles = {
      basic: 'bg-gray-100 text-gray-700',
      enhanced: 'bg-purple-100 text-purple-700',
      custom: 'bg-indigo-100 text-indigo-700'
    };
    
    return (
      <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium ${styles[type as keyof typeof styles] || styles.basic}`}>
        {type.charAt(0).toUpperCase() + type.slice(1)} NDA
      </span>
    );
  };

  const getUserTypeIcon = (userType?: string) => {
    switch (userType) {
      case 'production':
        return <Building2 className="w-4 h-4 text-purple-600" />;
      case 'investor':
        return <DollarSign className="w-4 h-4 text-green-600" />;
      default:
        return <User className="w-4 h-4 text-gray-600" />;
    }
  };

  const getUserTypeBadge = (userType?: string) => {
    const styles = {
      production: 'bg-purple-100 text-purple-700',
      investor: 'bg-green-100 text-green-700',
      creator: 'bg-gray-100 text-gray-700'
    };
    
    const labels = {
      production: 'Production Co.',
      investor: 'Investor',
      creator: 'Creator'
    };
    
    return (
      <span className={`inline-flex items-center px-2 py-1 rounded text-xs ${styles[userType as keyof typeof styles] || styles.creator}`}>
        {labels[userType as keyof typeof labels] || 'Creator'}
      </span>
    );
  };

  const isExpired = (expiresAt?: string) => {
    if (!expiresAt) return false;
    return new Date(expiresAt) <= new Date();
  };

  const isExpiringSoon = (expiresAt?: string) => {
    if (!expiresAt) return false;
    const expiryDate = new Date(expiresAt);
    if (expiryDate <= new Date()) return false; // already expired, not "soon"
    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
    return expiryDate <= thirtyDaysFromNow;
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const getCardBorderColor = () => {
    switch (category) {
      case 'incoming-signed':
        return 'border-blue-200 bg-gradient-to-r from-blue-50 to-cyan-50';
      case 'outgoing-signed':
        return 'border-green-200 bg-gradient-to-r from-green-50 to-emerald-50';
      case 'incoming-requests':
        return 'border-amber-200 bg-gradient-to-r from-amber-50 to-orange-50';
      case 'outgoing-requests':
        return 'border-yellow-200 bg-yellow-50';
      default:
        return 'border-gray-200 bg-white';
    }
  };

  const getCategoryIcon = () => {
    switch (category) {
      case 'incoming-signed':
        return <Shield className="w-5 h-5 text-blue-600" />;
      case 'outgoing-signed':
        return <Shield className="w-5 h-5 text-green-600" />;
      case 'incoming-requests':
        return <Bell className="w-5 h-5 text-amber-600" />;
      case 'outgoing-requests':
        return <Clock className="w-5 h-5 text-yellow-600" />;
    }
  };

  return (
    <div className={`rounded-xl shadow-sm p-6 border-2 ${getCardBorderColor()}`}>
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div className="flex items-center gap-3">
          {getCategoryIcon()}
          <div>
            <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              {title}
              {items.length > 0 && (
                <span className={`px-2 py-1 text-white text-xs rounded-full ${
                  category === 'incoming-requests' ? 'bg-amber-600 animate-pulse' :
                  category === 'outgoing-requests' ? 'bg-yellow-600' :
                  category === 'incoming-signed' ? 'bg-blue-600' :
                  'bg-green-600'
                }`}>
                  {items.length}
                </span>
              )}
            </h3>
            <p className="text-sm text-gray-600 mt-1">{description}</p>
          </div>
        </div>
        
        {items.length > 0 && (
          <div className="flex gap-3 text-sm">
            {category.includes('signed') && items.filter(item => isExpired(item.expiresAt)).length > 0 && (
              <div className="text-center">
                <div className="font-semibold text-red-600">
                  {items.filter(item => isExpired(item.expiresAt)).length}
                </div>
                <div className="text-gray-600">Expired</div>
              </div>
            )}
            {category.includes('signed') && items.filter(item => !isExpired(item.expiresAt) && isExpiringSoon(item.expiresAt)).length > 0 && (
              <div className="text-center">
                <div className="font-semibold text-orange-600">
                  {items.filter(item => !isExpired(item.expiresAt) && isExpiringSoon(item.expiresAt)).length}
                </div>
                <div className="text-gray-600">Expiring Soon</div>
              </div>
            )}
            <div className="text-center">
              <div className="font-semibold text-gray-900">{items.length}</div>
              <div className="text-gray-600">Total</div>
            </div>
          </div>
        )}
      </div>

      {/* Search and Filters */}
      {items.length > 0 && (
        <div className="mb-6 space-y-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                type="text"
                placeholder="Search by pitch title, company, or person..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent text-sm"
              />
            </div>
            
            <div className="flex gap-2">
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500"
              >
                <option value="all">All Status</option>
                <option value="pending">Pending</option>
                <option value="approved">Approved</option>
                <option value="signed">Signed</option>
                <option value="rejected">Rejected</option>
                <option value="expired">Expired</option>
              </select>
              
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500"
              >
                <option value="all">All Types</option>
                <option value="basic">Basic</option>
                <option value="enhanced">Enhanced</option>
                <option value="custom">Custom</option>
              </select>
              
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as 'date' | 'company' | 'pitch')}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500"
              >
                <option value="date">Sort by Date</option>
                <option value="company">Sort by Company</option>
                <option value="pitch">Sort by Pitch</option>
              </select>
            </div>
          </div>
        </div>
      )}

      {/* Content */}
      {filteredItems.length === 0 ? (
        <div className="text-center py-12">
          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
            {getCategoryIcon()}
          </div>
          <p className="text-gray-500 text-center">
            {searchTerm || filterStatus !== 'all' || filterType !== 'all' 
              ? 'No items match your search criteria' 
              : emptyMessage || 'No items to display'
            }
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredItems.map((item) => (
            <div key={`${item.id}-${item.pitchId}`} className="bg-white border rounded-lg p-4 hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  {/* Pitch Title and Status */}
                  <div className="flex items-center gap-2 mb-2">
                    <h4 className="font-medium text-gray-900 truncate">
                      {item.pitchTitle}
                    </h4>
                    {getStatusBadge(item.status)}
                    {getTypeBadge(item.ndaType)}
                    {item.status === 'signed' && isExpired(item.expiresAt) && (
                      <span className="inline-flex items-center gap-1 px-2 py-1 bg-red-100 text-red-800 rounded-full text-xs">
                        <AlertTriangle className="w-3 h-3" />
                        Expired
                      </span>
                    )}
                    {item.status === 'signed' && !isExpired(item.expiresAt) && isExpiringSoon(item.expiresAt) && (
                      <span className="inline-flex items-center gap-1 px-2 py-1 bg-orange-100 text-orange-800 rounded-full text-xs">
                        <AlertTriangle className="w-3 h-3" />
                        Expiring Soon
                      </span>
                    )}
                  </div>
                  
                  {/* User/Company Info */}
                  <div className="flex items-center gap-3 mb-2">
                    {getUserTypeIcon(
                      item.requesterType || item.creatorType || item.signerType
                    )}
                    <span className="text-sm font-medium text-gray-700">
                      {item.companyName || item.creator || item.requester || item.signerName}
                    </span>
                    {getUserTypeBadge(
                      item.requesterType || item.creatorType || item.signerType
                    )}
                  </div>
                  
                  {/* Message/Reason */}
                  {item.message && (
                    <div className="mb-2 p-2 bg-blue-50 rounded text-sm text-gray-700 italic">
                      "{item.message}"
                    </div>
                  )}
                  
                  {item.rejectionReason && (
                    <div className="mb-2 p-2 bg-red-50 rounded text-sm text-red-700">
                      Rejection reason: {item.rejectionReason}
                    </div>
                  )}
                  
                  {/* Dates */}
                  <div className="flex items-center gap-4 text-xs text-gray-500">
                    {item.requestedDate && (
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        Requested: {formatDate(item.requestedDate)}
                      </span>
                    )}
                    {item.signedDate && (
                      <span className="flex items-center gap-1">
                        <CheckCircle className="w-3 h-3" />
                        Signed: {formatDate(item.signedDate)}
                      </span>
                    )}
                    {item.expiresAt && item.status === 'signed' && (
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        Expires: {formatDate(item.expiresAt)}
                      </span>
                    )}
                    {item.expiresIn && (
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        Expires in: {item.expiresIn}
                      </span>
                    )}
                  </div>
                </div>
                
                {/* Actions */}
                <div className="flex flex-col gap-2 ml-4">
                  {/* Pending Request Actions */}
                  {showActions && item.status === 'pending' && category === 'incoming-requests' && (
                    <div className="flex gap-2">
                      <button
                        onClick={() => onApprove?.(item)}
                        className="px-3 py-1 bg-green-600 text-white rounded text-sm hover:bg-green-700 flex items-center gap-1"
                      >
                        <CheckCircle className="w-3 h-3" />
                        Approve
                      </button>
                      <button
                        onClick={() => onReject?.(item)}
                        className="px-3 py-1 bg-red-100 text-red-700 rounded text-sm hover:bg-red-200 flex items-center gap-1"
                      >
                        <XCircle className="w-3 h-3" />
                        Decline
                      </button>
                    </div>
                  )}
                  
                  {/* General Actions */}
                  <div className="flex gap-2">
                    {onViewPitch && (
                      <button
                        onClick={() => onViewPitch(item.pitchId)}
                        className="text-purple-600 hover:text-purple-700 text-sm flex items-center gap-1"
                      >
                        <Eye className="w-3 h-3" />
                        View Pitch
                      </button>
                    )}
                    
                    {item.status === 'signed' && onDownloadNDA && (
                      <button
                        onClick={() => onDownloadNDA(item)}
                        className="text-blue-600 hover:text-blue-700 text-sm flex items-center gap-1"
                      >
                        <Download className="w-3 h-3" />
                        Download
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}