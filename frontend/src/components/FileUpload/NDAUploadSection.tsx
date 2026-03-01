import React, { useState, useCallback, useEffect } from 'react';
import {
  Upload,
  X,
  FileText,
  Shield,
  CheckCircle,
  AlertTriangle,
  Eye,
  Download,
  Edit3,
  Library,
  RefreshCw
} from 'lucide-react';
import { useToast } from '@shared/components/feedback/ToastProvider';
import { uploadService } from '../../services/upload.service';
import { NDAService, type NDATemplate } from '../../services/nda.service';

export interface NDADocument {
  id: string;
  file?: File;
  title: string;
  description?: string;
  url?: string;
  uploadStatus: 'idle' | 'uploading' | 'completed' | 'error';
  uploadProgress: number;
  error?: string;
  isCustom: boolean; // true for custom NDA, false for standard NDA
  ndaType: 'standard' | 'custom' | 'template' | 'none';
  templateId?: number; // ID of selected NDA template
}

interface NDAUploadSectionProps {
  ndaDocument?: NDADocument;
  onChange: (document: NDADocument | null) => void;
  disabled?: boolean;
  required?: boolean;
  className?: string;
}

export default function NDAUploadSection({
  ndaDocument,
  onChange,
  disabled = false,
  required = false,
  className = ''
}: NDAUploadSectionProps) {
  const [dragOver, setDragOver] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [templates, setTemplates] = useState<NDATemplate[]>([]);
  const [templatesLoading, setTemplatesLoading] = useState(false);
  const [templatesError, setTemplatesError] = useState<string | null>(null);
  const { success, error } = useToast();

  // Load templates when "template" type is selected
  const loadTemplates = useCallback(async () => {
    if (templates.length > 0) return; // Already loaded
    setTemplatesLoading(true);
    setTemplatesError(null);
    try {
      const result = await NDAService.getNDATemplates();
      setTemplates(result.templates);
    } catch (err) {
      const e = err instanceof Error ? err : new Error(String(err));
      setTemplatesError(e.message);
    } finally {
      setTemplatesLoading(false);
    }
  }, [templates.length]);

  const handleTemplateSelect = useCallback((template: NDATemplate) => {
    onChange({
      id: `nda-template-${template.id}`,
      title: template.name,
      description: template.description || 'Saved NDA template',
      uploadStatus: 'completed',
      uploadProgress: 100,
      isCustom: false,
      ndaType: 'template',
      templateId: template.id
    });
  }, [onChange]);

  const handleNDATypeChange = useCallback((type: 'standard' | 'custom' | 'template' | 'none') => {
    if (type === 'none') {
      onChange(null);
    } else if (type === 'standard') {
      onChange({
        id: `nda-standard-${Date.now()}`,
        title: 'Platform Standard NDA',
        description: 'Use the platform\'s standard Non-Disclosure Agreement',
        uploadStatus: 'completed',
        uploadProgress: 100,
        isCustom: false,
        ndaType: 'standard'
      });
    } else if (type === 'template') {
      // Show template picker — temporarily set to idle until user picks one
      onChange({
        id: `nda-template-${Date.now()}`,
        title: 'Select a Template',
        description: 'Choose from your saved NDA templates',
        uploadStatus: 'idle',
        uploadProgress: 0,
        isCustom: false,
        ndaType: 'template'
      });
      loadTemplates();
    } else {
      // Custom NDA - prepare for file upload
      onChange({
        id: `nda-custom-${Date.now()}`,
        title: 'Custom NDA Document',
        description: 'Upload your own custom Non-Disclosure Agreement',
        uploadStatus: 'idle',
        uploadProgress: 0,
        isCustom: true,
        ndaType: 'custom'
      });
    }
  }, [onChange, loadTemplates]);

  const handleFileSelect = useCallback(async (file: File) => {
    if (!file) return;

    // Validate file type (PDF only for NDAs)
    if (file.type !== 'application/pdf') {
      error('Invalid File Type', 'NDA documents must be PDF files');
      return;
    }

    // Validate file size (10MB limit for NDA docs)
    if (file.size > 10 * 1024 * 1024) {
      error('File Too Large', 'NDA documents must be under 10MB');
      return;
    }

    const newDocument: NDADocument = {
      id: `nda-custom-${Date.now()}`,
      file,
      title: file.name.replace('.pdf', ''),
      description: 'Custom NDA document',
      uploadStatus: 'uploading',
      uploadProgress: 0,
      isCustom: true,
      ndaType: 'custom'
    };

    onChange(newDocument);

    try {
      const result = await uploadService.uploadDocument(file, 'nda', {
        folder: 'nda-documents',
        isPublic: false,
        requiresNda: false, // NDA docs themselves don't require NDA
        onProgress: (progress) => {
          onChange({
            ...newDocument,
            uploadProgress: progress.percentage
          });
        }
      });

      onChange({
        ...newDocument,
        uploadStatus: 'completed',
        uploadProgress: 100,
        url: result.url
      });

      success('NDA Uploaded', 'Your custom NDA document has been uploaded successfully');

    } catch (uploadError: any) {
      onChange({
        ...newDocument,
        uploadStatus: 'error',
        error: uploadError.message || 'Upload failed'
      });
      
      error('Upload Failed', uploadError.message || 'Failed to upload NDA document');
    }
  }, [onChange, success, error]);

  const handleFileInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileSelect(file);
    }
    // Reset input
    e.target.value = '';
  }, [handleFileSelect]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);

    if (disabled) return;

    const file = e.dataTransfer.files[0];
    if (file) {
      handleFileSelect(file);
    }
  }, [disabled, handleFileSelect]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    if (!disabled) {
      setDragOver(true);
    }
  }, [disabled]);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
  }, []);

  const removeDocument = useCallback(() => {
    onChange(null);
  }, [onChange]);

  const updateTitle = useCallback((newTitle: string) => {
    if (ndaDocument) {
      onChange({
        ...ndaDocument,
        title: newTitle
      });
    }
  }, [ndaDocument, onChange]);

  return (
    <div className={`bg-white border border-gray-200 rounded-lg p-6 ${className}`}>
      <div className="flex items-center gap-2 mb-4">
        <Shield className="w-5 h-5 text-blue-600" />
        <h3 className="text-lg font-semibold text-gray-900">
          Non-Disclosure Agreement (NDA)
        </h3>
        {required && (
          <span className="text-red-500 text-sm">*Required</span>
        )}
      </div>

      <div className="space-y-4">
        {/* NDA Type Selection */}
        <div className="space-y-3">
          <p className="text-sm text-gray-600 mb-3">
            Choose how you want to handle NDAs for this pitch:
          </p>

          <div className="space-y-2">
            <label className="flex items-center gap-3 p-3 border border-gray-200 rounded-lg cursor-pointer hover:border-blue-300 transition-colors">
              <input
                type="radio"
                name="ndaType"
                value="standard"
                checked={ndaDocument?.ndaType === 'standard'}
                onChange={() => handleNDATypeChange('standard')}
                disabled={disabled}
                className="w-4 h-4 text-blue-600"
              />
              <div className="flex-1">
                <div className="font-medium text-gray-900">Use Platform Standard NDA</div>
                <div className="text-sm text-gray-500">
                  Use our pre-approved standard Non-Disclosure Agreement
                </div>
              </div>
              <CheckCircle className="w-5 h-5 text-green-500" />
            </label>

            <label className="flex items-center gap-3 p-3 border border-gray-200 rounded-lg cursor-pointer hover:border-blue-300 transition-colors">
              <input
                type="radio"
                name="ndaType"
                value="custom"
                checked={ndaDocument?.ndaType === 'custom'}
                onChange={() => handleNDATypeChange('custom')}
                disabled={disabled}
                className="w-4 h-4 text-blue-600"
              />
              <div className="flex-1">
                <div className="font-medium text-gray-900">Upload Custom NDA</div>
                <div className="text-sm text-gray-500">
                  Provide your own custom Non-Disclosure Agreement (PDF only)
                </div>
              </div>
              <Upload className="w-5 h-5 text-blue-500" />
            </label>

            <label className="flex items-center gap-3 p-3 border border-gray-200 rounded-lg cursor-pointer hover:border-purple-300 transition-colors">
              <input
                type="radio"
                name="ndaType"
                value="template"
                checked={ndaDocument?.ndaType === 'template'}
                onChange={() => handleNDATypeChange('template')}
                disabled={disabled}
                className="w-4 h-4 text-purple-600"
              />
              <div className="flex-1">
                <div className="font-medium text-gray-900">Select from Your Templates</div>
                <div className="text-sm text-gray-500">
                  Choose from your previously saved NDA templates
                </div>
              </div>
              <Library className="w-5 h-5 text-purple-500" />
            </label>

            <label className="flex items-center gap-3 p-3 border border-gray-200 rounded-lg cursor-pointer hover:border-red-300 transition-colors">
              <input
                type="radio"
                name="ndaType"
                value="none"
                checked={!ndaDocument || ndaDocument.ndaType === 'none'}
                onChange={() => handleNDATypeChange('none')}
                disabled={disabled || required}
                className="w-4 h-4 text-red-600"
              />
              <div className="flex-1">
                <div className="font-medium text-gray-900">No NDA Required</div>
                <div className="text-sm text-gray-500">
                  This pitch does not require any Non-Disclosure Agreement
                </div>
              </div>
              <X className="w-5 h-5 text-red-500" />
            </label>
          </div>
        </div>

        {/* Custom NDA Upload Area */}
        {ndaDocument?.ndaType === 'custom' && (
          <div className="mt-4 space-y-4">
            {!ndaDocument.file && ndaDocument.uploadStatus === 'idle' && (
              <div
                className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                  dragOver
                    ? 'border-blue-400 bg-blue-50'
                    : 'border-gray-300 hover:border-gray-400'
                }`}
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
              >
                <div className="flex flex-col items-center gap-4">
                  <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                    <FileText className="w-6 h-6 text-blue-600" />
                  </div>
                  
                  <div>
                    <p className="text-lg font-medium text-gray-900 mb-2">
                      Upload Custom NDA
                    </p>
                    <p className="text-sm text-gray-500 mb-4">
                      Drag & drop your PDF file here, or click to browse
                    </p>
                    
                    <label className="inline-flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg cursor-pointer hover:bg-blue-700 transition-colors">
                      <Upload className="w-4 h-4" />
                      Choose PDF File
                      <input
                        type="file"
                        accept=".pdf,application/pdf"
                        onChange={handleFileInputChange}
                        disabled={disabled}
                        className="hidden"
                      />
                    </label>
                  </div>
                  
                  <div className="text-xs text-gray-400">
                    PDF only • Max 10MB
                  </div>
                </div>
              </div>
            )}

            {/* Upload Progress */}
            {ndaDocument.uploadStatus === 'uploading' && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-center gap-3 mb-3">
                  <FileText className="w-5 h-5 text-blue-600" />
                  <div className="flex-1">
                    <div className="font-medium text-gray-900">{ndaDocument.title}</div>
                    <div className="text-sm text-gray-500">Uploading...</div>
                  </div>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2 mb-2">
                  <div
                    className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${ndaDocument.uploadProgress}%` }}
                  />
                </div>
                <div className="text-xs text-gray-500 text-center">
                  {ndaDocument.uploadProgress}% uploaded
                </div>
              </div>
            )}

            {/* Uploaded Document */}
            {ndaDocument.uploadStatus === 'completed' && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                    <FileText className="w-5 h-5 text-green-600" />
                  </div>
                  
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={ndaDocument.title}
                        onChange={(e) => updateTitle(e.target.value)}
                        className="font-medium text-gray-900 bg-transparent border-none outline-none flex-1"
                        disabled={disabled}
                      />
                      <Edit3 className="w-4 h-4 text-gray-400" />
                    </div>
                    <div className="text-sm text-gray-500">Custom NDA document uploaded</div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    {ndaDocument.url && (
                      <button
                        onClick={() => setShowPreview(true)}
                        className="p-2 text-gray-500 hover:text-gray-700 transition-colors"
                        title="Preview document"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                    )}
                    
                    <button
                      onClick={removeDocument}
                      disabled={disabled}
                      className="p-2 text-red-500 hover:text-red-700 transition-colors"
                      title="Remove document"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                
                <div className="flex items-center gap-1 mt-2">
                  <CheckCircle className="w-4 h-4 text-green-500" />
                  <span className="text-sm text-green-700">Ready to use</span>
                </div>
              </div>
            )}

            {/* Upload Error */}
            {ndaDocument.uploadStatus === 'error' && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <div className="flex items-center gap-3">
                  <AlertTriangle className="w-5 h-5 text-red-600" />
                  <div className="flex-1">
                    <div className="font-medium text-red-900">Upload Failed</div>
                    <div className="text-sm text-red-600">{ndaDocument.error}</div>
                  </div>
                  
                  <button
                    onClick={() => handleNDATypeChange('custom')}
                    className="text-sm text-red-600 hover:text-red-700 font-medium"
                  >
                    Try Again
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Template Selection */}
        {ndaDocument?.ndaType === 'template' && !ndaDocument.templateId && (
          <div className="mt-4 space-y-3">
            {templatesLoading && (
              <div className="flex items-center justify-center py-6 text-gray-500">
                <RefreshCw className="w-5 h-5 animate-spin mr-2" />
                Loading templates...
              </div>
            )}

            {templatesError && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-center">
                <AlertTriangle className="w-5 h-5 text-red-500 mx-auto mb-2" />
                <p className="text-sm text-red-600 mb-2">{templatesError}</p>
                <button
                  onClick={loadTemplates}
                  className="text-sm text-red-700 font-medium hover:underline"
                >
                  Try Again
                </button>
              </div>
            )}

            {!templatesLoading && !templatesError && templates.length === 0 && (
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-6 text-center">
                <Library className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                <p className="text-sm text-gray-600">No saved templates found.</p>
                <p className="text-xs text-gray-400 mt-1">Create templates from the NDA management section.</p>
              </div>
            )}

            {!templatesLoading && templates.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm font-medium text-gray-700">Select a template:</p>
                {templates.map(template => (
                  <button
                    key={template.id}
                    onClick={() => handleTemplateSelect(template)}
                    className="w-full text-left p-3 border border-gray-200 rounded-lg hover:border-purple-400 hover:bg-purple-50 transition-colors"
                  >
                    <div className="font-medium text-gray-900">{template.name}</div>
                    {template.description && (
                      <div className="text-sm text-gray-500 mt-1">{template.description}</div>
                    )}
                    {template.isDefault && (
                      <span className="inline-block mt-1 px-2 py-0.5 bg-purple-100 text-purple-700 text-xs rounded">Default</span>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Selected Template Confirmation */}
        {ndaDocument?.ndaType === 'template' && ndaDocument.templateId && (
          <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                <Library className="w-5 h-5 text-purple-600" />
              </div>

              <div className="flex-1">
                <div className="font-medium text-purple-900">{ndaDocument.title}</div>
                <div className="text-sm text-purple-600">
                  {ndaDocument.description}
                </div>
              </div>

              <button
                onClick={removeDocument}
                disabled={disabled}
                className="p-2 text-red-500 hover:text-red-700 transition-colors"
                title="Remove template selection"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex items-center gap-1 mt-2">
              <CheckCircle className="w-4 h-4 text-green-500" />
              <span className="text-sm text-green-700">Ready to use</span>
            </div>
          </div>
        )}

        {/* Standard NDA Confirmation */}
        {ndaDocument?.ndaType === 'standard' && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                <Shield className="w-5 h-5 text-blue-600" />
              </div>
              
              <div className="flex-1">
                <div className="font-medium text-blue-900">Platform Standard NDA</div>
                <div className="text-sm text-blue-600">
                  Users will be required to accept our standard NDA before accessing your content
                </div>
              </div>
              
              <div className="flex items-center gap-2">
                <button
                  onClick={() => window.open('/legal/standard-nda', '_blank')}
                  className="p-2 text-blue-600 hover:text-blue-700 transition-colors"
                  title="View standard NDA"
                >
                  <Eye className="w-4 h-4" />
                </button>
                
                <button
                  onClick={removeDocument}
                  disabled={disabled}
                  className="p-2 text-red-500 hover:text-red-700 transition-colors"
                  title="Remove NDA requirement"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
            
            <div className="flex items-center gap-1 mt-2">
              <CheckCircle className="w-4 h-4 text-green-500" />
              <span className="text-sm text-green-700">Ready to use</span>
            </div>
          </div>
        )}
      </div>

      {/* Document Preview Modal */}
      {showPreview && ndaDocument?.url && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl h-full max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between p-4 border-b">
              <h3 className="text-lg font-semibold">NDA Document Preview</h3>
              <button
                onClick={() => setShowPreview(false)}
                className="p-2 text-gray-500 hover:text-gray-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="flex-1 overflow-hidden">
              <iframe
                src={ndaDocument.url}
                className="w-full h-full"
                title="NDA Document Preview"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}