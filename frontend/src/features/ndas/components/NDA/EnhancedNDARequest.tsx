import { useState } from 'react';
import { X, Shield, Upload, FileText, AlertCircle, CheckCircle, User, Building2, DollarSign, Eye } from 'lucide-react';
import { ndaService } from '../../services/nda.service';
import { useBetterAuthStore } from '@/store/betterAuthStore';

interface EnhancedNDARequestProps {
  isOpen: boolean;
  onClose: () => void;
  pitchId: number;
  pitchTitle: string;
  creatorName: string;
  creatorType: 'creator' | 'production' | 'investor';
  onSuccess: () => void;
}

interface RequestFormData {
  message: string;
  companyInfo: {
    position: string;
    companySize: string;
    investmentRange: string;
    intendedUse: string;
    experience: string;
  };
  ndaType: 'standard' | 'custom';
  customFile?: File;
  urgency: 'standard' | 'expedited';
  referenceSource: string;
}

export default function EnhancedNDARequest({ 
  isOpen, 
  onClose, 
  pitchId, 
  pitchTitle,
  creatorName,
  creatorType,
  onSuccess 
}: EnhancedNDARequestProps) {
  const { user } = useBetterAuthStore();
  const [step, setStep] = useState<'info' | 'details' | 'submit'>('info');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showNDAPreview, setShowNDAPreview] = useState(false);
  const [formData, setFormData] = useState<RequestFormData>({
    message: '',
    companyInfo: {
      position: '',
      companySize: '',
      investmentRange: '',
      intendedUse: '',
      experience: '',
    },
    ndaType: 'standard',
    urgency: 'standard',
    referenceSource: '',
  });

  if (!isOpen) return null;

  const handleInputChange = (field: keyof RequestFormData, value: any) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleCompanyInfoChange = (field: keyof RequestFormData['companyInfo'], value: string) => {
    setFormData(prev => ({
      ...prev,
      companyInfo: {
        ...prev.companyInfo,
        [field]: value
      }
    }));
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFormData(prev => ({
        ...prev,
        customFile: e.target.files![0]
      }));
    }
  };

  const handleSubmit = async () => {
    setLoading(true);
    setError('');

    try {
      // Construct detailed message
      const detailedMessage = `
${formData.message}

--- Professional Information ---
Position: ${formData.companyInfo.position}
Company Size: ${formData.companyInfo.companySize}
Investment Range: ${formData.companyInfo.investmentRange}
Intended Use: ${formData.companyInfo.intendedUse}
Industry Experience: ${formData.companyInfo.experience}
${formData.referenceSource ? `Reference/Source: ${formData.referenceSource}` : ''}

This is a ${formData.urgency} priority request.
      `.trim();

      await ndaService.requestNDA({
        pitchId,
        message: detailedMessage,
        expiryDays: 90
      });

      onSuccess();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit NDA request');
    } finally {
      setLoading(false);
    }
  };

  const canProceedToDetails = () => {
    return formData.message.trim().length >= 50;
  };

  const canSubmit = () => {
    return formData.companyInfo.position && 
           formData.companyInfo.intendedUse && 
           formData.companyInfo.experience &&
           (formData.ndaType === 'standard' || formData.customFile);
  };

  const getCreatorTypeIcon = () => {
    switch (creatorType) {
      case 'production': return <Building2 className="w-5 h-5 text-purple-600" />;
      case 'investor': return <DollarSign className="w-5 h-5 text-green-600" />;
      default: return <User className="w-5 h-5 text-gray-600" />;
    }
  };

  const getCreatorTypeLabel = () => {
    switch (creatorType) {
      case 'production': return 'Production Company';
      case 'investor': return 'Investor';
      default: return 'Creator';
    }
  };

  const getProtectedContentDescription = () => {
    switch (creatorType) {
      case 'production':
        return "This production company provides access to detailed slate information, financing structures, distribution partnerships, and strategic development plans.";
      case 'investor':
        return "This investor shares proprietary deal terms, investment criteria, funding timelines, and portfolio strategy details.";
      default:
        return "This creator provides access to full treatments, detailed budgets, production timelines, and confidential project development information.";
    }
  };

  const getStandardNDAText = () => {
    return `
MUTUAL NON-DISCLOSURE AGREEMENT

This Non-Disclosure Agreement ("Agreement") is entered into on ${new Date().toLocaleDateString()} by and between:

DISCLOSING PARTY: ${creatorName} (${getCreatorTypeLabel()})
RECEIVING PARTY: ${user?.firstName} ${user?.lastName} (${user?.userType || 'Professional'})

PROJECT: "${pitchTitle}"

1. CONFIDENTIAL INFORMATION
All information disclosed in relation to the above project, including but not limited to:
• Creative concepts, treatments, and scripts
• Financial projections and budget information
• Production timelines and business plans
• Distribution strategies and market analysis
• Talent attachments and deal structures

2. OBLIGATIONS
The Receiving Party agrees to:
• Keep all information strictly confidential
• Use information solely for evaluation purposes
• Not disclose to any third parties
• Return or destroy information upon request

3. TERM
This agreement shall remain in effect for 2 years from the date of signature.

4. EXCEPTIONS
This agreement does not apply to information that:
• Is already publicly available
• Was known prior to disclosure
• Is independently developed

By proceeding, you acknowledge that you have read, understood, and agree to be bound by the terms of this Non-Disclosure Agreement.

ELECTRONIC SIGNATURE NOTICE
By clicking "Submit NDA Request" below, you are providing your electronic signature and consent to be legally bound by this agreement. Electronic signatures have the same legal effect as handwritten signatures.
    `.trim();
  };

  // NDA Preview Modal Component
  const NDAPreviewModal = () => {
    if (!showNDAPreview) return null;

    return (
      <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
          {/* Preview Header */}
          <div className="p-6 border-b bg-blue-50">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Eye className="w-6 h-6 text-blue-600" />
                <div>
                  <h3 className="text-xl font-bold text-gray-900">NDA Preview</h3>
                  <p className="text-sm text-gray-600">Review the agreement terms before submission</p>
                </div>
              </div>
              <button
                onClick={() => setShowNDAPreview(false)}
                className="p-2 hover:bg-blue-100 rounded-full transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Preview Content */}
          <div className="flex-1 overflow-y-auto p-6">
            <div className="bg-gray-50 rounded-lg p-6 font-mono text-sm leading-relaxed whitespace-pre-line">
              {formData.ndaType === 'standard' ? getStandardNDAText() : 
               formData.customFile ? `Custom NDA Document: ${formData.customFile.name}\n\nThis custom NDA will be reviewed and processed separately. The standard terms above serve as a reference for the type of agreement that will be established.` : 
               getStandardNDAText()}
            </div>
          </div>

          {/* Preview Footer */}
          <div className="p-6 border-t bg-gray-50 flex justify-between items-center">
            <div className="text-sm text-gray-600">
              <p className="font-semibold mb-1">Legal Notice:</p>
              <p>This {formData.ndaType === 'standard' ? 'standard' : 'custom'} NDA will be legally binding upon your submission.</p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setShowNDAPreview(false)}
                className="px-4 py-2 text-gray-600 hover:text-gray-800 font-medium"
              >
                Close Preview
              </button>
              <button
                onClick={() => {
                  setShowNDAPreview(false);
                  void handleSubmit();
                }}
                disabled={loading}
                className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium disabled:bg-gray-300"
              >
                {loading ? 'Submitting...' : 'Accept & Submit Request'}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b p-6 flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">
              Request Enhanced Access
            </h2>
            <p className="text-sm text-gray-600 mt-1">
              To: {pitchTitle} by {creatorName}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Progress Indicator */}
        <div className="px-6 py-4 bg-gray-50 border-b">
          <div className="flex items-center">
            <div className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-medium ${
              step === 'info' ? 'bg-purple-600 text-white' : 'bg-gray-200 text-gray-600'
            }`}>
              1
            </div>
            <div className={`flex-1 h-1 mx-3 ${
              step !== 'info' ? 'bg-purple-600' : 'bg-gray-200'
            }`}></div>
            <div className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-medium ${
              step === 'details' ? 'bg-purple-600 text-white' : 
              step === 'submit' ? 'bg-gray-200 text-gray-600' : 'bg-gray-200 text-gray-600'
            }`}>
              2
            </div>
            <div className={`flex-1 h-1 mx-3 ${
              step === 'submit' ? 'bg-purple-600' : 'bg-gray-200'
            }`}></div>
            <div className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-medium ${
              step === 'submit' ? 'bg-purple-600 text-white' : 'bg-gray-200 text-gray-600'
            }`}>
              3
            </div>
          </div>
          <div className="flex justify-between mt-2 text-xs text-gray-500">
            <span>Introduction</span>
            <span>Professional Details</span>
            <span>Submit Request</span>
          </div>
        </div>

        <div className="p-6">
          {/* Step 1: Information */}
          {step === 'info' && (
            <div className="space-y-6">
              {/* Creator Info */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  {getCreatorTypeIcon()}
                  <div className="flex-1">
                    <h3 className="font-semibold text-blue-900 mb-1">
                      Requesting access from {getCreatorTypeLabel()}
                    </h3>
                    <p className="text-sm text-blue-800 mb-3">
                      {getProtectedContentDescription()}
                    </p>
                    <div className="text-sm text-blue-800">
                      <p className="font-semibold mb-1">You'll gain access to:</p>
                      <ul className="list-disc list-inside space-y-1">
                        {creatorType === 'production' ? (
                          <>
                            <li>Complete development slate and pipeline</li>
                            <li>Financing structures and investor terms</li>
                            <li>Distribution partnerships and strategies</li>
                            <li>Production timelines and budget allocations</li>
                            <li>Talent attachments and deal structures</li>
                          </>
                        ) : creatorType === 'investor' ? (
                          <>
                            <li>Investment thesis and portfolio strategy</li>
                            <li>Deal terms and funding structures</li>
                            <li>Due diligence requirements and process</li>
                            <li>Portfolio company support and resources</li>
                            <li>Investment timeline and decision criteria</li>
                          </>
                        ) : (
                          <>
                            <li>Full treatment and detailed synopsis</li>
                            <li>Complete budget breakdown and financing plan</li>
                            <li>Production timeline and milestone schedule</li>
                            <li>Attached talent and key crew information</li>
                            <li>Distribution strategy and market analysis</li>
                            <li>Direct contact information and next steps</li>
                          </>
                        )}
                      </ul>
                    </div>
                  </div>
                </div>
              </div>

              {/* User Profile */}
              <div className="bg-gray-50 rounded-lg p-4">
                <h4 className="font-medium text-gray-900 mb-2">Your Profile Information</h4>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="font-medium text-gray-700">Name:</span>
                    <span className="ml-2 text-gray-600">{user?.firstName} {user?.lastName}</span>
                  </div>
                  <div>
                    <span className="font-medium text-gray-700">Type:</span>
                    <span className="ml-2 text-gray-600">{user?.userType || 'Professional'}</span>
                  </div>
                  {user?.companyName && (
                    <div className="col-span-2">
                      <span className="font-medium text-gray-700">Company:</span>
                      <span className="ml-2 text-gray-600">{user.companyName}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Initial Message */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Introduction Message *
                </label>
                <textarea
                  value={formData.message}
                  onChange={(e) => handleInputChange('message', e.target.value)}
                  placeholder={`Dear ${creatorName},

I am interested in learning more about "${pitchTitle}" and would like to request access to the enhanced information under NDA. 

${creatorType === 'production' 
  ? "I am exploring potential collaboration opportunities and would value the chance to review your detailed development slate and strategic plans."
  : creatorType === 'investor'
  ? "I am interested in understanding your investment approach and criteria to explore potential partnership opportunities."
  : "I believe this project aligns with my professional interests and would appreciate the opportunity to review the complete materials."
}

I understand and respect the confidential nature of this information and am prepared to sign your NDA.

Best regards`}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  rows={8}
                />
                <div className="flex justify-between items-center mt-1">
                  <p className="text-xs text-gray-500">
                    Minimum 50 characters. Be professional and specific about your interest.
                  </p>
                  <span className={`text-xs ${
                    formData.message.length >= 50 ? 'text-green-600' : 'text-gray-400'
                  }`}>
                    {formData.message.length}/50
                  </span>
                </div>
              </div>

              {/* Reference Source */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  How did you find this project? (Optional)
                </label>
                <select
                  value={formData.referenceSource}
                  onChange={(e) => handleInputChange('referenceSource', e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                >
                  <option value="">Select source...</option>
                  <option value="marketplace_browse">Marketplace browsing</option>
                  <option value="industry_contact">Industry contact/referral</option>
                  <option value="social_media">Social media</option>
                  <option value="industry_event">Industry event/festival</option>
                  <option value="trade_publication">Trade publication</option>
                  <option value="existing_relationship">Existing relationship</option>
                  <option value="other">Other</option>
                </select>
              </div>
            </div>
          )}

          {/* Step 2: Professional Details */}
          {step === 'details' && (
            <div className="space-y-6">
              <div className="bg-gradient-to-r from-purple-50 to-indigo-50 rounded-lg p-4 border border-purple-200">
                <h3 className="font-semibold text-purple-900 mb-2">
                  Professional Information
                </h3>
                <p className="text-sm text-purple-800">
                  This information helps the {getCreatorTypeLabel().toLowerCase()} understand your professional background and intended use for their confidential information.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Your Position/Title *
                  </label>
                  <input
                    type="text"
                    value={formData.companyInfo.position}
                    onChange={(e) => handleCompanyInfoChange('position', e.target.value)}
                    placeholder="e.g., Producer, Executive, Investment Manager"
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Company/Organization Size
                  </label>
                  <select
                    value={formData.companyInfo.companySize}
                    onChange={(e) => handleCompanyInfoChange('companySize', e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  >
                    <option value="">Select size...</option>
                    <option value="independent">Independent/Freelancer</option>
                    <option value="startup">Startup (1-10 employees)</option>
                    <option value="small">Small (11-50 employees)</option>
                    <option value="medium">Medium (51-200 employees)</option>
                    <option value="large">Large (200+ employees)</option>
                    <option value="studio">Major Studio/Network</option>
                  </select>
                </div>

                {user?.userType === 'investor' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Typical Investment Range
                    </label>
                    <select
                      value={formData.companyInfo.investmentRange}
                      onChange={(e) => handleCompanyInfoChange('investmentRange', e.target.value)}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    >
                      <option value="">Select range...</option>
                      <option value="under_100k">Under $100K</option>
                      <option value="100k_500k">$100K - $500K</option>
                      <option value="500k_1m">$500K - $1M</option>
                      <option value="1m_5m">$1M - $5M</option>
                      <option value="5m_plus">$5M+</option>
                      <option value="flexible">Flexible based on project</option>
                    </select>
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Request Priority
                  </label>
                  <div className="space-y-2">
                    <label className="flex items-center">
                      <input
                        type="radio"
                        name="urgency"
                        value="standard"
                        checked={formData.urgency === 'standard'}
                        onChange={(e) => handleInputChange('urgency', e.target.value)}
                        className="mr-2"
                      />
                      <span className="text-sm">Standard (3-5 business days)</span>
                    </label>
                    <label className="flex items-center">
                      <input
                        type="radio"
                        name="urgency"
                        value="expedited"
                        checked={formData.urgency === 'expedited'}
                        onChange={(e) => handleInputChange('urgency', e.target.value)}
                        className="mr-2"
                      />
                      <span className="text-sm">Expedited (urgent response needed)</span>
                    </label>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Intended Use of Information *
                </label>
                <textarea
                  value={formData.companyInfo.intendedUse}
                  onChange={(e) => handleCompanyInfoChange('intendedUse', e.target.value)}
                  placeholder="Please describe how you plan to use this information (e.g., investment evaluation, partnership consideration, distribution assessment, etc.)"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  rows={3}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Relevant Industry Experience *
                </label>
                <textarea
                  value={formData.companyInfo.experience}
                  onChange={(e) => handleCompanyInfoChange('experience', e.target.value)}
                  placeholder="Briefly describe your relevant experience in the entertainment industry, previous projects, or professional background"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  rows={3}
                />
              </div>
            </div>
          )}

          {/* Step 3: Submit */}
          {step === 'submit' && (
            <div className="space-y-6">
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <CheckCircle className="w-5 h-5 text-green-600 mt-0.5" />
                  <div>
                    <h3 className="font-semibold text-green-900 mb-1">
                      Ready to Submit Request
                    </h3>
                    <p className="text-sm text-green-800">
                      Your professional NDA request is complete and ready to send to {creatorName}.
                    </p>
                  </div>
                </div>
              </div>

              {/* NDA Type Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  NDA Type Selection
                </label>
                <div className="grid grid-cols-2 gap-4">
                  <button
                    onClick={() => handleInputChange('ndaType', 'standard')}
                    className={`p-4 rounded-lg border-2 transition-all text-left ${
                      formData.ndaType === 'standard'
                        ? 'border-purple-500 bg-purple-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <FileText className="w-6 h-6 mb-2 text-purple-600" />
                    <div className="font-medium">Standard NDA</div>
                    <p className="text-xs text-gray-600 mt-1">
                      Use Pitchey's industry-standard confidentiality agreement
                    </p>
                  </button>
                  
                  <button
                    onClick={() => handleInputChange('ndaType', 'custom')}
                    className={`p-4 rounded-lg border-2 transition-all text-left ${
                      formData.ndaType === 'custom'
                        ? 'border-purple-500 bg-purple-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <Upload className="w-6 h-6 mb-2 text-purple-600" />
                    <div className="font-medium">Custom NDA</div>
                    <p className="text-xs text-gray-600 mt-1">
                      Upload your organization's NDA template
                    </p>
                  </button>
                </div>
              </div>

              {/* Custom NDA Upload */}
              {formData.ndaType === 'custom' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Upload Custom NDA Document
                  </label>
                  <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
                    <input
                      type="file"
                      accept=".pdf,.doc,.docx"
                      onChange={handleFileUpload}
                      className="hidden"
                      id="custom-nda-upload"
                    />
                    <label
                      htmlFor="custom-nda-upload"
                      className="cursor-pointer inline-flex flex-col items-center"
                    >
                      <Upload className="w-12 h-12 text-gray-400 mb-3" />
                      <span className="text-sm font-medium text-purple-600 hover:text-purple-700">
                        Click to upload custom NDA
                      </span>
                      <span className="text-xs text-gray-500 mt-1">
                        PDF, DOC, or DOCX (max 10MB)
                      </span>
                    </label>
                    {formData.customFile && (
                      <div className="mt-4 flex items-center justify-center space-x-2">
                        <FileText className="w-4 h-4 text-green-600" />
                        <span className="text-sm text-gray-700">{formData.customFile.name}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Request Summary */}
              <div className="bg-gray-50 rounded-lg p-4">
                <h4 className="font-medium text-gray-900 mb-3">Request Summary</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Project:</span>
                    <span className="text-gray-900">{pitchTitle}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Creator:</span>
                    <span className="text-gray-900">{creatorName} ({getCreatorTypeLabel()})</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Your Role:</span>
                    <span className="text-gray-900">{formData.companyInfo.position || 'Not specified'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">NDA Type:</span>
                    <span className="text-gray-900 capitalize">{formData.ndaType}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Priority:</span>
                    <span className="text-gray-900 capitalize">{formData.urgency}</span>
                  </div>
                </div>
              </div>

              {/* Terms Agreement */}
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-amber-600 mt-0.5" />
                  <div className="text-sm">
                    <p className="font-semibold text-amber-900 mb-1">Important Agreement Terms:</p>
                    <ul className="text-amber-800 space-y-1 list-disc list-inside">
                      <li>All shared information will be kept strictly confidential</li>
                      <li>Information will only be used for the stated purpose</li>
                      <li>No unauthorized sharing or reproduction is permitted</li>
                      <li>Confidentiality obligations survive termination</li>
                      <li>Violation may result in legal action and damages</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Error Display */}
          {error && (
            <div className="mt-6 bg-red-50 border border-red-200 rounded-lg p-4 flex items-start space-x-3">
              <AlertCircle className="w-5 h-5 text-red-500 mt-0.5" />
              <div className="flex-1">
                <h3 className="font-medium text-red-800">Error</h3>
                <p className="text-sm text-red-700 mt-1">{error}</p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-gray-50 border-t p-6 flex justify-between">
          <button
            onClick={step === 'info' ? onClose : () => setStep(step === 'details' ? 'info' : 'details')}
            className="px-6 py-2 text-gray-700 hover:text-gray-900 font-medium"
          >
            {step === 'info' ? 'Cancel' : 'Previous'}
          </button>
          
          <div className="flex space-x-3">
            {step === 'info' && (
              <button
                onClick={() => setStep('details')}
                disabled={!canProceedToDetails()}
                className={`px-6 py-2 rounded-lg font-medium transition-colors ${
                  canProceedToDetails()
                    ? 'bg-purple-600 text-white hover:bg-purple-700'
                    : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                }`}
              >
                Continue
              </button>
            )}
            
            {step === 'details' && (
              <button
                onClick={() => setStep('submit')}
                className="px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 font-medium"
              >
                Review Request
              </button>
            )}
            
            {step === 'submit' && (
              <>
                <button
                  onClick={() => setShowNDAPreview(true)}
                  disabled={!canSubmit()}
                  className={`px-6 py-2 rounded-lg font-medium transition-colors ${
                    !canSubmit()
                      ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                      : 'bg-blue-600 text-white hover:bg-blue-700'
                  }`}
                >
                  <Eye className="w-4 h-4 mr-2 inline" />
                  Preview NDA
                </button>
                <button
                  onClick={() => setShowNDAPreview(true)}
                  disabled={loading || !canSubmit()}
                  className={`px-6 py-2 rounded-lg font-medium transition-colors ${
                    loading || !canSubmit()
                      ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                      : 'bg-green-600 text-white hover:bg-green-700'
                  }`}
                >
                  {loading ? 'Submitting...' : 'Review & Submit Request'}
                </button>
              </>
            )}
          </div>
        </div>
      </div>
      
      {/* NDA Preview Modal */}
      <NDAPreviewModal />
    </div>
  );
}