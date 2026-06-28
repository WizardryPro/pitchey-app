import { useState, useEffect } from 'react';
import { Shield, Lock, CheckCircle, Clock, AlertCircle, Download, FileText, AlertTriangle } from 'lucide-react';
import { useBetterAuthStore } from '@/store/betterAuthStore';
import { ndaService } from '../services/nda.service';
import NDAWizard from './NDAWizard';

interface NDAStatusProps {
  pitchId: number;
  creatorId: number;
  creatorName?: string;
  pitchTitle?: string;
  onNDARequest?: () => void;
  compact?: boolean;
  showWizard?: boolean;
}

interface NDAStatusData {
  hasAccess: boolean;
  reason: string;
  protectedContent: {
    hasAccess: boolean;
    accessLevel?: string;
    protectedFields: string[];
    nda?: any;
  };
}

export default function NDAStatus({ 
  pitchId, 
  creatorId, 
  creatorName = 'Creator',
  pitchTitle = 'this pitch',
  onNDARequest, 
  compact = false,
  showWizard = true 
}: NDAStatusProps) {
  const { user } = useBetterAuthStore();
  const [ndaStatus, setNDAStatus] = useState<NDAStatusData | null>(null);
  const [loading, setLoading] = useState(true);
  const [requestLoading, setRequestLoading] = useState(false);
  const [showNDAWizard, setShowNDAWizard] = useState(false);
  const [canRequest, setCanRequest] = useState(false);

  useEffect(() => {
    if (user && user.id !== creatorId) {
      void fetchNDAStatus();
    } else {
      setLoading(false);
    }
  }, [pitchId, user]);

  const fetchNDAStatus = async () => {
    try {
      const [statusResponse, canRequestResponse] = await Promise.all([
        ndaService.getNDAStatus(pitchId),
        ndaService.canRequestNDA(pitchId)
      ]);
      
      setNDAStatus({
        hasAccess: statusResponse.canAccess,
        reason: statusResponse.nda?.status || (statusResponse.error ? 'no_nda' : 'pending'),
        protectedContent: {
          hasAccess: statusResponse.canAccess,
          accessLevel: statusResponse.nda?.status,
          protectedFields: [],
          nda: statusResponse.nda
        }
      });
      
      setCanRequest(canRequestResponse.canRequest);
    } catch (error) {
      console.error('Failed to fetch NDA status:', error);
      setCanRequest(true); // Default to allowing request if check fails
    } finally {
      setLoading(false);
    }
  };

  const handleRequestNDA = async () => {
    if (onNDARequest) {
      onNDARequest();
      return;
    }

    if (showWizard) {
      setShowNDAWizard(true);
    }
  };
  
  const handleWizardClose = () => {
    setShowNDAWizard(false);
    fetchNDAStatus(); // Refresh status when wizard closes
  };

  const downloadNDA = async () => {
    if (!ndaStatus?.protectedContent.nda) return;
    
    try {
      const blob = await ndaService.downloadNDA(ndaStatus.protectedContent.nda.id, true);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `NDA-${ndaStatus.protectedContent.nda.id}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('Failed to download NDA:', error);
    }
  };

  if (loading) {
    return (
      <div className={`flex items-center ${compact ? 'space-x-1' : 'space-x-2'}`}>
        <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-purple-600"></div>
        {!compact && <span className="text-xs text-gray-500">Checking access...</span>}
      </div>
    );
  }

  // Don't show for the pitch owner
  if (!user || user.id === creatorId) {
    return null;
  }

  // User has access
  if (ndaStatus?.hasAccess) {
    const accessLevel = ndaStatus.protectedContent.accessLevel || 'signed';
    return (
      <div className={`flex items-center ${compact ? 'space-x-1' : 'space-x-2'}`}>
        <CheckCircle className={`${compact ? 'w-3 h-3' : 'w-4 h-4'} text-green-600`} />
        {!compact && (
          <div className="flex items-center space-x-2">
            <span className="text-xs font-medium text-green-600">
              {accessLevel === 'signed' ? 'NDA Signed - Full Access' : 'Access Granted'}
            </span>
            {ndaStatus.protectedContent.nda && (
              <button
                onClick={downloadNDA}
                className="text-xs text-purple-600 hover:text-purple-700 flex items-center space-x-1"
                title="Download Signed NDA"
              >
                <Download className="w-3 h-3" />
                <span>Download NDA</span>
              </button>
            )}
          </div>
        )}
      </div>
    );
  }
  
  // NDA pending approval
  if (ndaStatus?.reason === 'pending') {
    return (
      <div className={`flex items-center ${compact ? 'space-x-1' : 'space-x-2'}`}>
        <Clock className={`${compact ? 'w-3 h-3' : 'w-4 h-4'} text-amber-500`} />
        {!compact && (
          <div className="flex items-center space-x-2">
            <span className="text-xs font-medium text-amber-600">
              NDA Request Pending
            </span>
            <span className="text-xs text-gray-500">
              Awaiting creator approval
            </span>
          </div>
        )}
      </div>
    );
  }
  
  // NDA approved but not signed
  if (ndaStatus?.reason === 'approved') {
    return (
      <div className={`flex items-center ${compact ? 'space-x-1' : 'space-x-2'}`}>
        <FileText className={`${compact ? 'w-3 h-3' : 'w-4 h-4'} text-blue-600`} />
        {!compact && (
          <div className="flex items-center space-x-2">
            <span className="text-xs font-medium text-blue-600">
              NDA Ready to Sign
            </span>
            <button
              onClick={() => setShowNDAWizard(true)}
              className="text-xs bg-blue-600 text-white px-2 py-1 rounded hover:bg-blue-700"
            >
              Sign Now
            </button>
          </div>
        )}
      </div>
    );
  }
  
  // NDA rejected
  if (ndaStatus?.reason === 'rejected') {
    return (
      <div className={`flex items-center ${compact ? 'space-x-1' : 'space-x-2'}`}>
        <AlertTriangle className={`${compact ? 'w-3 h-3' : 'w-4 h-4'} text-red-500`} />
        {!compact && (
          <div className="flex items-center space-x-2">
            <span className="text-xs font-medium text-red-600">
              NDA Request Rejected
            </span>
            {canRequest && (
              <button
                onClick={handleRequestNDA}
                className="text-xs bg-purple-600 text-white px-2 py-1 rounded hover:bg-purple-700"
              >
                Request Again
              </button>
            )}
          </div>
        )}
      </div>
    );
  }

  // NDA required - no existing request
  return (
    <>
      <div className={`flex items-center ${compact ? 'space-x-1' : 'space-x-2'}`}>
        <Lock className={`${compact ? 'w-3 h-3' : 'w-4 h-4'} text-amber-600`} />
        {!compact && (
          <div className="flex items-center space-x-2">
            <span className="text-xs text-amber-600">Protected Content - NDA Required</span>
            {canRequest ? (
              <button
                onClick={handleRequestNDA}
                disabled={requestLoading}
                className="text-xs bg-purple-600 text-white px-2 py-1 rounded hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {requestLoading ? 'Loading...' : 'Request Access'}
              </button>
            ) : (
              <span className="text-xs text-gray-500">
                Access not available
              </span>
            )}
          </div>
        )}
      </div>
      
      {/* NDA Wizard */}
      {showNDAWizard && (
        <NDAWizard
          isOpen={showNDAWizard}
          onClose={handleWizardClose}
          pitchId={pitchId}
          pitchTitle={pitchTitle}
          creatorName={creatorName}
          onStatusChange={fetchNDAStatus}
        />
      )}
    </>
  );
}

// NDA Status Badge for compact display
export function NDAStatusBadge({ 
  pitchId, 
  creatorId 
}: { 
  pitchId: number; 
  creatorId: number; 
}) {
  return (
    <div className="absolute top-2 right-2 bg-white/90 backdrop-blur-sm rounded-full p-1">
      <NDAStatus pitchId={pitchId} creatorId={creatorId} compact={true} />
    </div>
  );
}

// Protected content indicator
export function ProtectedContentIndicator({ 
  fields, 
  hasAccess 
}: { 
  fields: string[]; 
  hasAccess: boolean; 
}) {
  if (fields.length === 0 || hasAccess) return null;

  return (
    <div className="flex items-center space-x-1 text-amber-600 bg-amber-50 px-2 py-1 rounded text-xs">
      <Shield className="w-3 h-3" />
      <span>Protected Content - NDA Required</span>
    </div>
  );
}