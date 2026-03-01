import React, { useState, useEffect } from 'react';
import {
  Shield,
  Send,
  Clock,
  CheckCircle,
  XCircle,
  AlertTriangle,
  FileText,
  Eye,
  Download,
  MessageSquare,
  Calendar,
  User,
  Building,
  Mail,
  RefreshCw,
  Zap
} from 'lucide-react';
import { useToast } from '@shared/components/feedback/ToastProvider';
import { ndaService } from '../../services/nda.service';
import { formatDistanceToNow } from 'date-fns';
import type { NDA } from '@shared/types/api';

interface NDARequestPanelProps {
  pitchId: number;
  pitchTitle: string;
  userId: number;
  onRequestSubmitted?: (nda: NDA) => void;
  onStatusChange?: (status: string) => void;
}

interface NDARules {
  canRequest: boolean;
  reason?: string;
  existingNDA?: NDA;
  error?: string;
}

const STATUS_CONFIG = {
  pending: {
    icon: Clock,
    color: 'text-blue-600 bg-blue-50 border-blue-200',
    title: 'Request Pending',
    description: 'Your NDA request is being reviewed by the creator.'
  },
  approved: {
    icon: CheckCircle,
    color: 'text-green-600 bg-green-50 border-green-200',
    title: 'NDA Approved',
    description: 'Your NDA request has been approved. You now have access to confidential materials.'
  },
  rejected: {
    icon: XCircle,
    color: 'text-red-600 bg-red-50 border-red-200',
    title: 'Request Rejected',
    description: 'Your NDA request was not approved at this time.'
  },
  expired: {
    icon: AlertTriangle,
    color: 'text-orange-600 bg-orange-50 border-orange-200',
    title: 'NDA Expired',
    description: 'Your NDA access has expired and needs to be renewed.'
  }
};

export default function NDARequestPanel({
  pitchId,
  pitchTitle,
  userId,
  onRequestSubmitted,
  onStatusChange
}: NDARequestPanelProps) {
  const [ndaRules, setNdaRules] = useState<NDARules>({ canRequest: false });
  const [currentNDA, setCurrentNDA] = useState<NDA | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState('');
  const [showRequestForm, setShowRequestForm] = useState(false);
  const [templates, setTemplates] = useState<any[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<number | null>(null);
  const [requestUrgency, setRequestUrgency] = useState<'standard' | 'priority'>('standard');
  const [businessJustification, setBusinessJustification] = useState('');
  
  const { success, error } = useToast();

  useEffect(() => {
    checkNDAStatus();
    loadTemplates();
  }, [pitchId, userId]);

  const checkNDAStatus = async () => {
    try {
      setLoading(true);
      
      // Check if user can request NDA
      const canRequestResult = await ndaService.canRequestNDA(pitchId);
      setNdaRules(canRequestResult);
      
      // Get current NDA status
      const statusResult = await ndaService.getNDAStatus(pitchId);
      
      if (statusResult.hasNDA && statusResult.nda) {
        setCurrentNDA(statusResult.nda);
        onStatusChange?.(statusResult.nda.status);
      } else {
        setCurrentNDA(null);
        onStatusChange?.('none');
      }
      
    } catch (err) {
      console.error('Failed to check NDA status:', err);
      error('Status Check Failed', 'Unable to verify NDA status. Please refresh and try again.');
    } finally {
      setLoading(false);
    }
  };

  const loadTemplates = async () => {
    try {
      const templatesData = await ndaService.getTemplates();
      setTemplates(templatesData);
      
      // Select default template if available
      const defaultTemplate = templatesData.find(t => t.isDefault);
      if (defaultTemplate) {
        setSelectedTemplate(defaultTemplate.id);
      }
    } catch (err) {
      console.error('Failed to load templates:', err);
    }
  };

  const handleSubmitRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!message.trim()) {
      error('Message Required', 'Please provide a message explaining your request.');
      return;
    }

    try {
      setSubmitting(true);
      
      const newNDA = await ndaService.requestNDA({
        pitchId,
        message: message.trim(),
        templateId: selectedTemplate || undefined,
        // Add additional metadata for priority handling
        ...(requestUrgency === 'priority' && {
          metadata: {
            urgency: 'high',
            businessJustification: businessJustification
          }
        })
      });
      
      setCurrentNDA(newNDA);
      setShowRequestForm(false);
      setMessage('');
      setBusinessJustification('');
      
      success(
        'NDA Request Submitted', 
        'Your NDA request has been sent to the creator for review.'
      );
      
      onRequestSubmitted?.(newNDA);
      onStatusChange?.('pending');
      
      // Update rules after successful submission
      await checkNDAStatus();
      
    } catch (err: any) {
      console.error('Failed to submit NDA request:', err);
      error('Request Failed', err.message || 'Unable to submit NDA request. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSendReminder = async () => {
    if (!currentNDA) return;
    
    try {
      await ndaService.sendReminder(currentNDA.id);
      success('Reminder Sent', 'A reminder has been sent to the creator.');
    } catch (err) {
      error('Reminder Failed', 'Unable to send reminder. Please try again.');
    }
  };

  const handleDownloadDocument = async (signed: boolean = false) => {
    if (!currentNDA) return;
    
    try {
      const blob = await ndaService.downloadNDA(currentNDA.id, signed);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `NDA_${pitchTitle}_${signed ? 'signed' : 'unsigned'}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      
      success('Download Started', 'NDA document download has started.');
    } catch (err) {
      error('Download Failed', 'Unable to download NDA document.');
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading) {
    return (
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <div className="flex justify-center items-center h-32">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      </div>
    );
  }

  // Show existing NDA status
  if (currentNDA) {
    const statusConfig = STATUS_CONFIG[currentNDA.status as keyof typeof STATUS_CONFIG];
    const StatusIcon = statusConfig.icon;
    
    return (
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <div className="flex items-center gap-3 mb-4">
          <Shield className="w-6 h-6 text-blue-600" />
          <h3 className="text-lg font-semibold text-gray-900">NDA Status</h3>
        </div>
        
        <div className={`border rounded-lg p-4 ${statusConfig.color} mb-4`}>
          <div className="flex items-start gap-3">
            <StatusIcon className="w-6 h-6 mt-1" />
            <div className="flex-1">
              <h4 className="font-semibold text-lg">{statusConfig.title}</h4>
              <p className="text-sm opacity-90 mt-1">{statusConfig.description}</p>
            </div>
          </div>
        </div>
        
        {/* NDA Details */}
        <div className="space-y-3 text-sm text-gray-600">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4" />
            <span>Requested: {formatDate(currentNDA.createdAt)}</span>
          </div>
          
          {currentNDA.respondedAt && (
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4" />
              <span>Responded: {formatDate(currentNDA.respondedAt)}</span>
            </div>
          )}
          
          {currentNDA.expiresAt && currentNDA.status === 'approved' && (
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" />
              <span>
                Expires: {formatDate(currentNDA.expiresAt)}
                <span className="ml-2 text-xs text-gray-500">
                  ({formatDistanceToNow(new Date(currentNDA.expiresAt), { addSuffix: true })})
                </span>
              </span>
            </div>
          )}
          
          {currentNDA.notes && (
            <div className="mt-4 p-3 bg-gray-50 rounded-lg">
              <div className="flex items-start gap-2">
                <MessageSquare className="w-4 h-4 text-gray-500 mt-0.5" />
                <div>
                  <div className="font-medium text-gray-700 text-xs">Creator's Note:</div>
                  <p className="text-gray-700">{currentNDA.notes}</p>
                </div>
              </div>
            </div>
          )}
          
          {currentNDA.rejectionReason && (
            <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
              <div className="flex items-start gap-2">
                <XCircle className="w-4 h-4 text-red-500 mt-0.5" />
                <div>
                  <div className="font-medium text-red-700 text-xs">Rejection Reason:</div>
                  <p className="text-red-700">{currentNDA.rejectionReason}</p>
                </div>
              </div>
            </div>
          )}
        </div>
        
        {/* Action Buttons */}
        <div className="flex items-center gap-3 mt-6 pt-4 border-t border-gray-200">
          {currentNDA.status === 'pending' && (
            <button
              onClick={handleSendReminder}
              className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
            >
              <Send className="w-4 h-4" />
              Send Reminder
            </button>
          )}
          
          {currentNDA.status === 'approved' && (
            <button
              onClick={() => handleDownloadDocument(true)}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
            >
              <Download className="w-4 h-4" />
              Download Signed NDA
            </button>
          )}
          
          {(currentNDA.status === 'rejected' || currentNDA.status === 'expired') && ndaRules.canRequest && (
            <button
              onClick={() => setShowRequestForm(true)}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              <RefreshCw className="w-4 h-4" />
              Request New NDA
            </button>
          )}
          
          <button
            onClick={checkNDAStatus}
            className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh Status
          </button>
        </div>
      </div>
    );
  }

  // Show request form or access denied message
  if (!ndaRules.canRequest) {
    return (
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <div className="flex items-center gap-3 mb-4">
          <Shield className="w-6 h-6 text-gray-400" />
          <h3 className="text-lg font-semibold text-gray-900">NDA Access</h3>
        </div>
        
        <div className="text-center py-8">
          <AlertTriangle className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h4 className="text-lg font-medium text-gray-900 mb-2">NDA Request Not Available</h4>
          <p className="text-gray-500">
            {ndaRules.reason || 'You cannot request an NDA for this pitch at this time.'}
          </p>
          {ndaRules.error && (
            <p className="text-red-500 text-sm mt-2">{ndaRules.error}</p>
          )}
        </div>
      </div>
    );
  }

  // Show request button or form
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-6">
      <div className="flex items-center gap-3 mb-4">
        <Shield className="w-6 h-6 text-blue-600" />
        <h3 className="text-lg font-semibold text-gray-900">Request NDA Access</h3>
      </div>
      
      {!showRequestForm ? (
        <div className="text-center py-8">
          <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Shield className="w-8 h-8 text-blue-600" />
          </div>
          
          <h4 className="text-lg font-medium text-gray-900 mb-2">
            This pitch requires an NDA
          </h4>
          <p className="text-gray-500 mb-6 max-w-md mx-auto">
            To access confidential materials for "{pitchTitle}", you'll need to request and sign a Non-Disclosure Agreement.
          </p>
          
          <button
            onClick={() => setShowRequestForm(true)}
            className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 mx-auto"
          >
            <Send className="w-5 h-5" />
            Request NDA Access
          </button>
        </div>
      ) : (
        <form onSubmit={handleSubmitRequest} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Request Priority
            </label>
            <div className="space-y-2">
              <label className="flex items-center gap-3 p-3 border border-gray-200 rounded-lg cursor-pointer hover:border-blue-300">
                <input
                  type="radio"
                  name="urgency"
                  value="standard"
                  checked={requestUrgency === 'standard'}
                  onChange={(e) => setRequestUrgency(e.target.value as 'standard' | 'priority')}
                  className="w-4 h-4 text-blue-600"
                />
                <div className="flex-1">
                  <div className="font-medium text-gray-900">Standard Request</div>
                  <div className="text-sm text-gray-500">Normal processing time (2-5 business days)</div>
                </div>
              </label>
              
              <label className="flex items-center gap-3 p-3 border border-gray-200 rounded-lg cursor-pointer hover:border-yellow-300">
                <input
                  type="radio"
                  name="urgency"
                  value="priority"
                  checked={requestUrgency === 'priority'}
                  onChange={(e) => setRequestUrgency(e.target.value as 'standard' | 'priority')}
                  className="w-4 h-4 text-yellow-600"
                />
                <div className="flex-1">
                  <div className="font-medium text-gray-900 flex items-center gap-2">
                    Priority Request
                    <Zap className="w-4 h-4 text-yellow-500" />
                  </div>
                  <div className="text-sm text-gray-500">Expedited review (24-48 hours)</div>
                </div>
              </label>
            </div>
          </div>
          
          {requestUrgency === 'priority' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Business Justification for Priority Request *
              </label>
              <textarea
                value={businessJustification}
                onChange={(e) => setBusinessJustification(e.target.value)}
                required
                rows={3}
                placeholder="Please explain why you need priority processing (e.g., upcoming deadline, investor meeting, etc.)"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          )}
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Message to Creator *
            </label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              required
              rows={4}
              placeholder="Introduce yourself and explain your interest in this project. Include relevant experience, company information, or investment capacity."
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-blue-500 focus:border-blue-500"
            />
            <div className="text-xs text-gray-500 mt-1">
              A thoughtful message increases your chances of approval
            </div>
          </div>
          
          {templates.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                NDA Template
              </label>
              <select
                value={selectedTemplate || ''}
                onChange={(e) => setSelectedTemplate(e.target.value ? parseInt(e.target.value) : null)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">Standard NDA</option>
                {templates.map(template => (
                  <option key={template.id} value={template.id}>
                    {template.name} {template.isDefault ? '(Default)' : ''}
                  </option>
                ))}
              </select>
            </div>
          )}
          
          <div className="bg-gray-50 rounded-lg p-4">
            <h5 className="font-medium text-gray-900 mb-2">What happens next?</h5>
            <ol className="text-sm text-gray-600 space-y-1">
              <li>1. Your request will be sent to the creator for review</li>
              <li>2. The creator will evaluate your request and background</li>
              <li>3. You'll receive an email notification with their decision</li>
              <li>4. If approved, you'll gain access to confidential materials</li>
            </ol>
          </div>
          
          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={submitting}
              className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {submitting ? (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
              ) : (
                <Send className="w-4 h-4" />
              )}
              {submitting ? 'Submitting...' : 'Send NDA Request'}
            </button>
            
            <button
              type="button"
              onClick={() => setShowRequestForm(false)}
              className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
          </div>
        </form>
      )}
    </div>
  );
}