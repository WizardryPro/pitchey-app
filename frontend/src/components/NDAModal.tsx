import { useState } from 'react';
import { X, Upload, FileText, Shield, AlertCircle, CheckCircle, Loader2 } from 'lucide-react';
import { ndaService } from '../services/nda.service';
import { useBetterAuthStore } from '../store/betterAuthStore';
import FileUpload from './FileUpload';
import type { NDARequestFormData, UploadedNDAFile } from '@shared/types/nda.types';

interface NDAModalProps {
  isOpen: boolean;
  onClose: () => void;
  pitchId: number;
  pitchTitle: string;
  creatorType: 'creator' | 'production' | 'investor';
  onNDASigned: () => void;
}

export default function NDAModal({
  isOpen,
  onClose,
  pitchId,
  pitchTitle,
  creatorType,
  onNDASigned: _onNDASigned
}: NDAModalProps) {
  const { user } = useBetterAuthStore();
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<'form' | 'uploading' | 'success'>('form');
  const [formData, setFormData] = useState<NDARequestFormData>({
    ndaType: 'standard',
    customTerms: '',
    acceptTerms: false
  });
  const [uploadedFiles, setUploadedFiles] = useState<UploadedNDAFile[]>([]);
  const [error, setError] = useState('');
  const [uploadProgress, setUploadProgress] = useState(0);

  if (!isOpen) return null;

  const validateForm = (): boolean => {
    if (formData.ndaType === 'upload' && uploadedFiles.length === 0) {
      setError('Please upload an NDA document');
      return false;
    }
    if (!formData.acceptTerms) {
      setError('Please accept the terms and conditions');
      return false;
    }
    return true;
  };

  const handleSubmit = async () => {
    if (!user) {
      setError('Please sign in to request access to enhanced information');
      return;
    }

    if (!validateForm()) return;

    setLoading(true);
    setError('');
    setStep('uploading');

    try {
      // Check if we can request NDA first
      const canRequestResult = await ndaService.canRequestNDA(pitchId);
      
      if (!canRequestResult.canRequest) {
        if (canRequestResult.existingNDA) {
          setError('You have already requested NDA access for this pitch. The creator will review your request soon.');
        } else {
          setError(canRequestResult.reason || 'Cannot request NDA at this time.');
        }
        setStep('form');
        return;
      }

      // Prepare request data
      const requestData: {
        pitchId: number;
        message: string;
        templateId: number | undefined;
        expiryDays: number;
        customNdaUrl?: string;
      } = {
        pitchId,
        message: formData.customTerms || `Requesting access to enhanced information for ${pitchTitle}`,
        templateId: formData.ndaType === 'standard' ? undefined : 1,
        expiryDays: 90
      };

      // If custom NDA was uploaded, include it
      if (formData.ndaType === 'upload' && uploadedFiles.length > 0) {
        // The file upload service should have already uploaded the file
        // We'll pass the file URL to the NDA request
        requestData.customNdaUrl = uploadedFiles[0].url;
      }

      // Submit NDA request
      setUploadProgress(75);
      const _nda = await ndaService.requestNDA(requestData);
      
      setUploadProgress(100);
      setStep('success');
      
      // Auto-close after 2 seconds
      setTimeout(() => {
        onClose();
        setStep('form');
        setFormData({
          ndaType: 'standard',
          customTerms: '',
          acceptTerms: false
        });
        setUploadedFiles([]);
      }, 2000);
      
    } catch (err) {
      console.error('NDA request error:', err);
      setError(err instanceof Error ? err.message : 'Failed to submit NDA request. Please try again.');
      setStep('form');
    } finally {
      setLoading(false);
    }
  };

  const handleFilesUploaded = (files: UploadedNDAFile[]) => {
    setUploadedFiles(files);
    setError(''); // Clear any upload errors
  };

  const handleFormDataChange = <K extends keyof NDARequestFormData>(field: K, value: NDARequestFormData[K]) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (error) setError(''); // Clear errors when user makes changes
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b p-6 flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">
              Request Access to Enhanced Information
            </h2>
            <p className="text-sm text-gray-600 mt-1">
              For: {pitchTitle}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Progress Indicator */}
          {step === 'uploading' && (
            <div className="mb-6">
              <div className="flex items-center justify-between text-sm text-gray-500 mb-2">
                <span>Submitting Request</span>
                <span>{uploadProgress}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div 
                  className="bg-purple-600 h-2 rounded-full transition-all duration-300" 
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
            </div>
          )}

          {step === 'success' && (
            <div className="mb-6 text-center">
              <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-green-900 mb-2">Request Submitted Successfully!</h3>
              <p className="text-gray-600">The creator will review your request and respond shortly.</p>
            </div>
          )}

          {step === 'form' && (
            <>
              {/* Info Box */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-start space-x-3">
                <Shield className="w-5 h-5 text-blue-600 mt-0.5" />
                <div className="flex-1">
                  <h3 className="font-semibold text-blue-900 mb-1">
                    Why is an NDA required?
                  </h3>
                  <p className="text-sm text-blue-800">
                    {creatorType === 'production' ? 
                      "Production companies require NDAs to protect confidential information about their slate, financing details, and distribution strategies." :
                      creatorType === 'investor' ?
                      "Investors require NDAs to protect sensitive financial information and investment terms." :
                      "Creators use NDAs to protect their creative concepts, scripts, and detailed project information."
                    }
                  </p>
                  <div className="mt-3 text-sm text-blue-800">
                    <p className="font-semibold mb-1">After signing, you'll get access to:</p>
                    <ul className="list-disc list-inside space-y-1">
                      <li>Full synopsis and treatment</li>
                      <li>Budget breakdown and financing details</li>
                      <li>Target audience and marketing strategy</li>
                      <li>Attached talent and crew</li>
                      <li>Production timeline and milestones</li>
                      <li>Distribution plans and comparable titles</li>
                    </ul>
                  </div>
                </div>
              </div>

              {/* NDA Type Selection */}
              <div className="space-y-3">
                <label className="block text-sm font-medium text-gray-700">
                  NDA Type
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => handleFormDataChange('ndaType', 'standard')}
                    className={`p-4 rounded-lg border-2 transition-all ${
                      formData.ndaType === 'standard'
                        ? 'border-purple-500 bg-purple-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <FileText className="w-6 h-6 mb-2 mx-auto text-purple-600" />
                    <div className="font-medium">Standard NDA</div>
                    <p className="text-xs text-gray-600 mt-1">
                      Use our standard confidentiality agreement
                    </p>
                  </button>
                  
                  <button
                    onClick={() => handleFormDataChange('ndaType', 'upload')}
                    className={`p-4 rounded-lg border-2 transition-all ${
                      formData.ndaType === 'upload'
                        ? 'border-purple-500 bg-purple-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <Upload className="w-6 h-6 mb-2 mx-auto text-purple-600" />
                    <div className="font-medium">Upload Your NDA</div>
                    <p className="text-xs text-gray-600 mt-1">
                      Use your company's NDA template
                    </p>
                  </button>
                </div>
              </div>

              {/* Standard NDA Terms */}
              {formData.ndaType === 'standard' && (
                <div className="space-y-3">
                  <label className="block text-sm font-medium text-gray-700">
                    Additional Terms (Optional)
                  </label>
                  <textarea
                    value={formData.customTerms}
                    onChange={(e) => handleFormDataChange('customTerms', e.target.value)}
                    placeholder="Add any specific terms or conditions..."
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    rows={4}
                  />
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <h4 className="font-semibold text-sm text-gray-700 mb-2">
                      Standard NDA Terms Include:
                    </h4>
                    <ul className="text-xs text-gray-600 space-y-1">
                      <li>• Confidentiality period: 2 years</li>
                      <li>• Non-disclosure of project details, financials, and strategies</li>
                      <li>• No unauthorized sharing or reproduction of materials</li>
                      <li>• Mutual protection of both parties' information</li>
                      <li>• Governed by applicable state/country laws</li>
                    </ul>
                  </div>
                </div>
              )}

              {/* Upload NDA */}
              {formData.ndaType === 'upload' && (
                <div className="space-y-3">
                  <label className="block text-sm font-medium text-gray-700">
                    Upload NDA Document
                  </label>
                  <FileUpload
                    onFilesUploaded={handleFilesUploaded}
                    maxFiles={1}
                    maxFileSize={10}
                    context="nda"
                    pitchId={pitchId}
                    className="border-2 border-dashed border-gray-300 rounded-lg"
                  />
                  {uploadedFiles.length > 0 && (
                    <div className="mt-4 space-y-2">
                      {uploadedFiles.map(file => (
                        <div key={file.id} className="flex items-center justify-between p-3 bg-green-50 rounded-lg border border-green-200">
                          <div className="flex items-center space-x-3">
                            <CheckCircle className="w-5 h-5 text-green-600" />
                            <div>
                              <p className="text-sm font-medium text-green-900">{file.filename}</p>
                              <p className="text-xs text-green-600">Uploaded successfully</p>
                            </div>
                          </div>
                          <span className="text-xs text-green-600">
                            {(file.size / (1024 * 1024)).toFixed(2)} MB
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                    <p className="text-sm text-yellow-800">
                      <strong>Note:</strong> Your custom NDA will be reviewed along with your request. 
                      Ensure it includes standard confidentiality clauses and mutual protection terms.
                    </p>
                  </div>
                </div>
              )}

              {/* Error Message */}
              {error && (
                <div className="flex items-center space-x-2 text-red-600 bg-red-50 p-3 rounded-lg">
                  <AlertCircle className="w-4 h-4" />
                  <span className="text-sm">{error}</span>
                </div>
              )}

              {/* Terms Acceptance */}
              <div className="space-y-4">
                <div className="flex items-start space-x-3">
                  <input
                    type="checkbox"
                    id="accept-terms"
                    checked={formData.acceptTerms}
                    onChange={(e) => handleFormDataChange('acceptTerms', e.target.checked)}
                    className="mt-1 w-4 h-4 text-purple-600 border-gray-300 rounded focus:ring-purple-500"
                  />
                  <label htmlFor="accept-terms" className="text-sm text-gray-700">
                    I agree to the terms and conditions of this NDA request and confirm that all information provided is accurate. 
                    I understand that submitting false information may result in account suspension.
                  </label>
                </div>
              </div>

              {/* User Type Warning for Creators */}
              {user?.userType === 'creator' && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                  <div className="flex items-start space-x-2">
                    <AlertCircle className="w-5 h-5 text-yellow-600 mt-0.5" />
                    <div className="text-sm text-yellow-800">
                      <p className="font-semibold">Note for Creators:</p>
                      <p>As a creator, you can request NDAs but enhanced information access is primarily for production companies and investors. Consider upgrading your account type if you're representing a production company.</p>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-gray-50 border-t p-6">
          {step === 'form' && (
            <div className="flex justify-between">
              <button
                onClick={onClose}
                className="px-6 py-2 text-gray-700 hover:text-gray-900 font-medium"
              >
                Cancel
              </button>
              <button
                onClick={() => { void handleSubmit(); }}
                disabled={loading || (formData.ndaType === 'upload' && uploadedFiles.length === 0) || !formData.acceptTerms}
                className={`px-6 py-2 rounded-lg font-medium transition-colors ${
                  loading || (formData.ndaType === 'upload' && uploadedFiles.length === 0) || !formData.acceptTerms
                    ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    : 'bg-purple-600 text-white hover:bg-purple-700'
                }`}
              >
                {loading ? (
                  <div className="flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Submitting...
                  </div>
                ) : (
                  'Submit NDA Request'
                )}
              </button>
            </div>
          )}

          {step === 'uploading' && (
            <div className="text-center">
              <div className="flex items-center justify-center gap-3 mb-3">
                <Loader2 className="w-5 h-5 animate-spin text-blue-600" />
                <span className="font-medium text-gray-900">Processing NDA Request...</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
              <p className="text-sm text-gray-500 mt-2">{uploadProgress}% complete</p>
            </div>
          )}

          {step === 'success' && (
            <div className="text-center">
              <div className="flex items-center justify-center gap-3 mb-3">
                <CheckCircle className="w-6 h-6 text-green-600" />
                <span className="font-medium text-green-900">NDA Request Submitted!</span>
              </div>
              <p className="text-sm text-gray-600">
                The creator will review your request and respond shortly.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}