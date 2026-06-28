/**
 * Legal Document Wizard Component
 * Comprehensive step-by-step legal document generation interface
 * for entertainment industry contracts and agreements
 */

import React, { useState, useEffect, useCallback } from 'react';
import { ArrowRight, ArrowLeft, FileText, Users, MapPin, AlertTriangle, CheckCircle, Download, Eye } from 'lucide-react';
import api from '../../lib/api';
import { useBetterAuthStore } from '../../store/betterAuthStore';

// Types
interface DocumentTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  jurisdictions: string[];
  variables: Record<string, DocumentVariable>;
  usage_count: number;
}

interface DocumentVariable {
  name: string;
  type: 'string' | 'number' | 'date' | 'currency' | 'text' | 'boolean' | 'array' | 'object';
  required: boolean;
  description: string;
  default?: any;
  enum?: string[];
  min?: number;
  max?: number;
  validation?: string;
}

interface Party {
  id: string;
  name: string;
  type: 'creator' | 'investor' | 'production_company' | 'individual' | 'legal_entity';
  email?: string;
  address?: string;
  company?: string;
  title?: string;
}

interface Jurisdiction {
  code: string;
  name: string;
  supported_document_types: string[];
  has_entertainment_rules: boolean;
  electronic_signatures_supported: boolean;
}

interface ValidationError {
  field: string;
  message: string;
  type: 'required' | 'format' | 'range' | 'enum' | 'custom';
}

interface ComplianceIssue {
  type: 'error' | 'warning' | 'info';
  message: string;
  clause?: string;
  recommendation?: string;
}

interface GeneratedDocument {
  id: string;
  document_name: string;
  document_type: string;
  status: string;
  html_preview: string;
  pdf_file_path?: string;
  docx_file_path?: string;
  compliance_status: 'compliant' | 'requires_review' | 'non_compliant';
}

const userTypeToPartyType = (userType: string): Party['type'] => {
  switch (userType) {
    case 'creator': return 'creator';
    case 'investor': return 'investor';
    case 'production': return 'production_company';
    default: return 'individual';
  }
};

const LegalDocumentWizard: React.FC = () => {
  const user = useBetterAuthStore(s => s.user);

  // Main state
  const [currentStep, setCurrentStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Data state
  const [templates, setTemplates] = useState<DocumentTemplate[]>([]);
  const [jurisdictions, setJurisdictions] = useState<Jurisdiction[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<DocumentTemplate | null>(null);
  const [selectedJurisdiction, setSelectedJurisdiction] = useState<string>('');
  // Auto-populate with logged-in user as first party
  const [parties, setParties] = useState<Party[]>(() => {
    if (!user) return [];
    return [{
      id: String(user.id),
      name: [user.firstName, user.lastName].filter(Boolean).join(' ') || user.username || '',
      type: userTypeToPartyType(user.userType),
      email: user.email,
      company: user.companyName || '',
      title: '',
      address: user.location || ''
    }];
  });
  const [variables, setVariables] = useState<Record<string, any>>({});
  const [validationErrors, setValidationErrors] = useState<ValidationError[]>([]);
  const [complianceIssues, setComplianceIssues] = useState<ComplianceIssue[]>([]);
  const [generatedDocument, setGeneratedDocument] = useState<GeneratedDocument | null>(null);

  // Generation options
  const [generatePDF, setGeneratePDF] = useState(true);
  const [generateDOCX, setGenerateDOCX] = useState(false);
  const [includeWatermark, setIncludeWatermark] = useState(false);
  const [watermarkText, setWatermarkText] = useState('CONFIDENTIAL');
  const [confidentialMarking, setConfidentialMarking] = useState(true);

  // Load initial data
  useEffect(() => {
    void loadTemplates();
    void loadJurisdictions();
  }, []);

  const loadTemplates = useCallback(async () => {
    try {
      setLoading(true);
      const response = await api.get('/api/legal/templates');
      if (response.data?.success) {
        setTemplates(response.data.data.templates);
      }
    } catch (error) {
      console.error('Error loading templates:', error);
      setError('Failed to load document templates');
    } finally {
      setLoading(false);
    }
  }, []);

  const loadJurisdictions = useCallback(async () => {
    try {
      const response = await api.get('/api/legal/jurisdictions');
      if (response.data?.success) {
        setJurisdictions(response.data.data.jurisdictions);
      }
    } catch (error) {
      console.error('Error loading jurisdictions:', error);
    }
  }, []);

  const validateCurrentStep = useCallback(async (): Promise<boolean> => {
    setValidationErrors([]);
    setComplianceIssues([]);

    switch (currentStep) {
      case 1: // Template Selection
        if (!selectedTemplate) {
          setError('Please select a document template');
          return false;
        }
        break;

      case 2: // Jurisdiction Selection
        if (!selectedJurisdiction) {
          setError('Please select a jurisdiction');
          return false;
        }
        if (selectedTemplate && !selectedTemplate.jurisdictions.includes(selectedJurisdiction)) {
          setError('Selected template is not available in this jurisdiction');
          return false;
        }
        break;

      case 3: // Parties
        if (parties.length === 0) {
          setError('Please add at least one party');
          return false;
        }
        const invalidParties = parties.filter(p => !p.name || !p.type);
        if (invalidParties.length > 0) {
          setError('Please complete all party information');
          return false;
        }
        break;

      case 4: // Variables
        if (selectedTemplate) {
          try {
            setLoading(true);
            const response = await api.post('/api/legal/validate', {
              template_id: selectedTemplate.id,
              variables,
              jurisdiction: selectedJurisdiction,
              validation_level: 'compliance'
            });

            if (response.data?.success) {
              const { validation, compliance } = response.data.data;
              
              if (!validation.isValid) {
                setValidationErrors(validation.errors);
                setError('Please fix the validation errors below');
                return false;
              }

              if (compliance?.issues) {
                setComplianceIssues(compliance.issues);
                const criticalIssues = compliance.issues.filter((issue: ComplianceIssue) => issue.type === 'error');
                if (criticalIssues.length > 0) {
                  setError('Please resolve critical compliance issues');
                  return false;
                }
              }
            }
          } catch (error) {
            console.error('Validation error:', error);
            setError('Failed to validate document');
            return false;
          } finally {
            setLoading(false);
          }
        }
        break;
    }

    setError(null);
    return true;
  }, [currentStep, selectedTemplate, selectedJurisdiction, parties, variables]);

  const nextStep = useCallback(async () => {
    const isValid = await validateCurrentStep();
    if (isValid) {
      setCurrentStep(prev => Math.min(prev + 1, 5));
    }
  }, [validateCurrentStep]);

  const prevStep = useCallback(() => {
    setCurrentStep(prev => Math.max(prev - 1, 1));
    setError(null);
  }, []);

  const generateDocument = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const requestData = {
        template_id: selectedTemplate!.id,
        variables,
        jurisdiction: selectedJurisdiction,
        parties,
        generation_options: {
          auto_generate_pdf: generatePDF,
          auto_generate_docx: generateDOCX,
          include_watermark: includeWatermark,
          watermark_text: includeWatermark ? watermarkText : undefined,
          confidential_marking: confidentialMarking
        }
      };

      const response = await api.post('/api/legal/generate', requestData);

      if (response.data?.success) {
        setGeneratedDocument(response.data.data.document);
        setCurrentStep(5);
      } else {
        setError(response.data?.error || 'Failed to generate document');
      }
    } catch (error: any) {
      console.error('Document generation error:', error);
      if (error.response?.data?.validation_errors) {
        setValidationErrors(error.response.data.validation_errors);
        setError('Please fix the validation errors');
      } else {
        setError('Failed to generate document');
      }
    } finally {
      setLoading(false);
    }
  }, [selectedTemplate, variables, selectedJurisdiction, parties, generatePDF, generateDOCX, includeWatermark, watermarkText, confidentialMarking]);

  const addParty = useCallback(() => {
    const newParty: Party = {
      id: Date.now().toString(),
      name: '',
      type: 'individual'
    };
    setParties(prev => [...prev, newParty]);
  }, []);

  const updateParty = useCallback((id: string, updates: Partial<Party>) => {
    setParties(prev => prev.map(p => p.id === id ? { ...p, ...updates } : p));
  }, []);

  const removeParty = useCallback((id: string) => {
    setParties(prev => prev.filter(p => p.id !== id));
  }, []);

  const updateVariable = useCallback((name: string, value: any) => {
    setVariables(prev => ({ ...prev, [name]: value }));
  }, []);

  const renderStepIndicator = () => (
    <div className="flex items-center justify-between mb-8">
      {['Template', 'Jurisdiction', 'Parties', 'Variables', 'Generate'].map((step, index) => (
        <div key={step} className="flex items-center">
          <div
            className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-medium transition-colors ${
              index + 1 < currentStep 
                ? 'bg-green-500 text-white' 
                : index + 1 === currentStep 
                ? 'bg-blue-500 text-white' 
                : 'bg-gray-200 text-gray-600'
            }`}
          >
            {index + 1 < currentStep ? <CheckCircle className="w-5 h-5" /> : index + 1}
          </div>
          <span className={`ml-2 text-sm font-medium ${
            index + 1 <= currentStep ? 'text-gray-900' : 'text-gray-500'
          }`}>
            {step}
          </span>
          {index < 4 && (
            <ArrowRight className="w-4 h-4 mx-4 text-gray-400" />
          )}
        </div>
      ))}
    </div>
  );

  const renderTemplateSelection = () => (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-900">Select Document Template</h2>
      
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {templates.map((template) => (
          <div
            key={template.id}
            className={`p-6 border-2 rounded-lg cursor-pointer transition-colors ${
              selectedTemplate?.id === template.id
                ? 'border-blue-500 bg-blue-50'
                : 'border-gray-200 hover:border-gray-300'
            }`}
            onClick={() => setSelectedTemplate(template)}
          >
            <div className="flex items-start justify-between">
              <FileText className="w-8 h-8 text-blue-600 flex-shrink-0" />
              <span className="text-sm text-gray-500 bg-gray-100 px-2 py-1 rounded">
                {template.category.replace('_', ' ')}
              </span>
            </div>
            
            <h3 className="mt-4 text-lg font-semibold text-gray-900">
              {template.name}
            </h3>
            
            <p className="mt-2 text-sm text-gray-600">
              {template.description}
            </p>
            
            <div className="mt-4 flex items-center justify-between text-sm text-gray-500">
              <span>{template.jurisdictions.join(', ')}</span>
              <span>{template.usage_count} uses</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  const renderJurisdictionSelection = () => (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-900">Select Jurisdiction</h2>
      
      <div className="grid gap-4 md:grid-cols-2">
        {jurisdictions
          .filter(j => selectedTemplate?.jurisdictions.includes(j.code))
          .map((jurisdiction) => (
            <div
              key={jurisdiction.code}
              className={`p-6 border-2 rounded-lg cursor-pointer transition-colors ${
                selectedJurisdiction === jurisdiction.code
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
              onClick={() => setSelectedJurisdiction(jurisdiction.code)}
            >
              <div className="flex items-start justify-between">
                <MapPin className="w-6 h-6 text-blue-600 flex-shrink-0" />
                <span className="text-sm text-gray-500">
                  {jurisdiction.code}
                </span>
              </div>
              
              <h3 className="mt-4 text-lg font-semibold text-gray-900">
                {jurisdiction.name}
              </h3>
              
              <div className="mt-4 space-y-2">
                {jurisdiction.has_entertainment_rules && (
                  <span className="inline-block bg-purple-100 text-purple-800 px-2 py-1 rounded text-xs">
                    Entertainment Rules
                  </span>
                )}
                {jurisdiction.electronic_signatures_supported && (
                  <span className="inline-block bg-green-100 text-green-800 px-2 py-1 rounded text-xs">
                    E-Signatures
                  </span>
                )}
              </div>
            </div>
          ))}
      </div>
    </div>
  );

  const renderPartiesStep = () => (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900">Document Parties</h2>
        <button
          onClick={addParty}
          className="bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600 transition-colors"
        >
          <Users className="w-4 h-4 inline mr-2" />
          Add Party
        </button>
      </div>
      
      <div className="space-y-4">
        {parties.map((party) => (
          <div key={party.id} className="p-6 border rounded-lg">
            <div className="grid gap-4 md:grid-cols-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Name *
                </label>
                <input
                  type="text"
                  value={party.name}
                  onChange={(e) => updateParty(party.id, { name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Party name"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Type *
                </label>
                <select
                  value={party.type}
                  onChange={(e) => updateParty(party.id, { type: e.target.value as Party['type'] })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="creator">Creator</option>
                  <option value="investor">Investor</option>
                  <option value="production_company">Production Company</option>
                  <option value="individual">Individual</option>
                  <option value="legal_entity">Legal Entity</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Email
                </label>
                <input
                  type="email"
                  value={party.email || ''}
                  onChange={(e) => updateParty(party.id, { email: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="party@example.com"
                />
              </div>
            </div>
            
            <div className="grid gap-4 md:grid-cols-2 mt-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Company
                </label>
                <input
                  type="text"
                  value={party.company || ''}
                  onChange={(e) => updateParty(party.id, { company: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Company name"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Title
                </label>
                <input
                  type="text"
                  value={party.title || ''}
                  onChange={(e) => updateParty(party.id, { title: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Job title"
                />
              </div>
            </div>
            
            <div className="mt-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Address
              </label>
              <textarea
                value={party.address || ''}
                onChange={(e) => updateParty(party.id, { address: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Full address"
                rows={2}
              />
            </div>
            
            <div className="mt-4 flex justify-end">
              <button
                onClick={() => removeParty(party.id)}
                className="text-red-600 hover:text-red-800 text-sm font-medium"
              >
                Remove Party
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  const renderVariablesStep = () => (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-900">Document Variables</h2>
      
      {validationErrors.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <h3 className="text-lg font-medium text-red-800 mb-2">Validation Errors</h3>
          <ul className="space-y-1">
            {validationErrors.map((error, index) => (
              <li key={index} className="text-sm text-red-700">
                <strong>{error.field}:</strong> {error.message}
              </li>
            ))}
          </ul>
        </div>
      )}
      
      {complianceIssues.length > 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <h3 className="text-lg font-medium text-yellow-800 mb-2">Compliance Issues</h3>
          <ul className="space-y-2">
            {complianceIssues.map((issue, index) => (
              <li key={index} className="text-sm">
                <div className={`flex items-start ${
                  issue.type === 'error' ? 'text-red-700' :
                  issue.type === 'warning' ? 'text-yellow-700' :
                  'text-blue-700'
                }`}>
                  <AlertTriangle className="w-4 h-4 mt-0.5 mr-2 flex-shrink-0" />
                  <div>
                    <p>{issue.message}</p>
                    {issue.recommendation && (
                      <p className="mt-1 text-xs opacity-75">
                        Recommendation: {issue.recommendation}
                    </p>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
      
      <div className="grid gap-6 md:grid-cols-2">
        {selectedTemplate && Object.entries(selectedTemplate.variables).map(([name, variable]) => (
          <div key={name} className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">
              {variable.description}
              {variable.required && <span className="text-red-500 ml-1">*</span>}
            </label>
            
            {variable.type === 'string' && !variable.enum && (
              <input
                type="text"
                value={variables[name] || variable.default || ''}
                onChange={(e) => updateVariable(name, e.target.value)}
                className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                  validationErrors.some(e => e.field === name) ? 'border-red-300' : 'border-gray-300'
                }`}
                placeholder={variable.description}
              />
            )}
            
            {variable.type === 'string' && variable.enum && (
              <select
                value={variables[name] || variable.default || ''}
                onChange={(e) => updateVariable(name, e.target.value)}
                className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                  validationErrors.some(e => e.field === name) ? 'border-red-300' : 'border-gray-300'
                }`}
              >
                <option value="">Select an option</option>
                {variable.enum.map(option => (
                  <option key={option} value={option}>{option}</option>
                ))}
              </select>
            )}
            
            {variable.type === 'number' && (
              <input
                type="number"
                value={variables[name] || variable.default || ''}
                onChange={(e) => updateVariable(name, parseFloat(e.target.value) || '')}
                min={variable.min}
                max={variable.max}
                className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                  validationErrors.some(e => e.field === name) ? 'border-red-300' : 'border-gray-300'
                }`}
                placeholder={variable.description}
              />
            )}
            
            {variable.type === 'date' && (
              <input
                type="date"
                value={variables[name] || variable.default || ''}
                onChange={(e) => updateVariable(name, e.target.value)}
                className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                  validationErrors.some(e => e.field === name) ? 'border-red-300' : 'border-gray-300'
                }`}
              />
            )}
            
            {variable.type === 'text' && (
              <textarea
                value={variables[name] || variable.default || ''}
                onChange={(e) => updateVariable(name, e.target.value)}
                className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                  validationErrors.some(e => e.field === name) ? 'border-red-300' : 'border-gray-300'
                }`}
                placeholder={variable.description}
                rows={3}
              />
            )}
            
            {variable.type === 'boolean' && (
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={variables[name] || variable.default || false}
                  onChange={(e) => updateVariable(name, e.target.checked)}
                  className="mr-2"
                />
                <span className="text-sm text-gray-600">Yes</span>
              </label>
            )}
            
            {variable.type === 'currency' && (
              <div className="relative">
                <span className="absolute left-3 top-2 text-gray-500">$</span>
                <input
                  type="number"
                  value={variables[name] || variable.default || ''}
                  onChange={(e) => updateVariable(name, parseFloat(e.target.value) || '')}
                  className={`w-full pl-8 pr-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                    validationErrors.some(e => e.field === name) ? 'border-red-300' : 'border-gray-300'
                  }`}
                  placeholder="0.00"
                  min="0"
                  step="0.01"
                />
              </div>
            )}
          </div>
        ))}
      </div>
      
      <div className="border-t pt-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Generation Options</h3>
        
        <div className="space-y-4">
          <div className="flex items-center">
            <input
              type="checkbox"
              id="generatePDF"
              checked={generatePDF}
              onChange={(e) => setGeneratePDF(e.target.checked)}
              className="mr-3"
            />
            <label htmlFor="generatePDF" className="text-sm font-medium text-gray-700">
              Generate PDF document
            </label>
          </div>
          
          <div className="flex items-center">
            <input
              type="checkbox"
              id="generateDOCX"
              checked={generateDOCX}
              onChange={(e) => setGenerateDOCX(e.target.checked)}
              className="mr-3"
            />
            <label htmlFor="generateDOCX" className="text-sm font-medium text-gray-700">
              Generate DOCX document
            </label>
          </div>
          
          <div className="flex items-center">
            <input
              type="checkbox"
              id="confidentialMarking"
              checked={confidentialMarking}
              onChange={(e) => setConfidentialMarking(e.target.checked)}
              className="mr-3"
            />
            <label htmlFor="confidentialMarking" className="text-sm font-medium text-gray-700">
              Add confidential marking
            </label>
          </div>
          
          <div className="flex items-center">
            <input
              type="checkbox"
              id="includeWatermark"
              checked={includeWatermark}
              onChange={(e) => setIncludeWatermark(e.target.checked)}
              className="mr-3"
            />
            <label htmlFor="includeWatermark" className="text-sm font-medium text-gray-700">
              Include watermark
            </label>
          </div>
          
          {includeWatermark && (
            <div className="ml-8">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Watermark Text
              </label>
              <input
                type="text"
                value={watermarkText}
                onChange={(e) => setWatermarkText(e.target.value)}
                className="w-64 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="CONFIDENTIAL"
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );

  const renderGenerationStep = () => (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">Generate Legal Document</h2>
        
        {!generatedDocument ? (
          <div className="space-y-6">
            <div className="bg-gray-50 rounded-lg p-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Document Summary</h3>
              
              <div className="text-left space-y-2 text-sm text-gray-600">
                <p><strong>Template:</strong> {selectedTemplate?.name}</p>
                <p><strong>Jurisdiction:</strong> {jurisdictions.find(j => j.code === selectedJurisdiction)?.name}</p>
                <p><strong>Parties:</strong> {parties.length}</p>
                <p><strong>Output Formats:</strong> {[
                  generatePDF && 'PDF',
                  generateDOCX && 'DOCX'
                ].filter(Boolean).join(', ') || 'HTML Preview Only'}</p>
              </div>
            </div>
            
            <button
              onClick={generateDocument}
              disabled={loading}
              className="bg-green-500 text-white px-8 py-3 rounded-lg hover:bg-green-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Generating Document...' : 'Generate Document'}
            </button>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="bg-green-50 border border-green-200 rounded-lg p-6">
              <div className="flex items-center justify-center mb-4">
                <CheckCircle className="w-8 h-8 text-green-500 mr-3" />
                <h3 className="text-xl font-medium text-green-800">
                  Document Generated Successfully!
                </h3>
              </div>
              
              <div className="text-center space-y-4">
                <p className="text-gray-600">
                  Your legal document has been generated and is ready for review.
                </p>
                
                <div className="flex justify-center space-x-4">
                  <button
                    onClick={() => window.open(`data:text/html,${encodeURIComponent(generatedDocument.html_preview)}`)}
                    className="bg-blue-500 text-white px-6 py-2 rounded-lg hover:bg-blue-600 transition-colors flex items-center"
                  >
                    <Eye className="w-4 h-4 mr-2" />
                    Preview
                  </button>
                  
                  {generatedDocument.pdf_file_path && (
                    <button
                      onClick={() => window.open(generatedDocument.pdf_file_path)}
                      className="bg-red-500 text-white px-6 py-2 rounded-lg hover:bg-red-600 transition-colors flex items-center"
                    >
                      <Download className="w-4 h-4 mr-2" />
                      Download PDF
                    </button>
                  )}
                  
                  {generatedDocument.docx_file_path && (
                    <button
                      onClick={() => window.open(generatedDocument.docx_file_path)}
                      className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors flex items-center"
                    >
                      <Download className="w-4 h-4 mr-2" />
                      Download DOCX
                    </button>
                  )}
                </div>
                
                <div className="mt-6 p-4 bg-gray-50 rounded-lg">
                  <h4 className="font-medium text-gray-900 mb-2">Compliance Status</h4>
                  <span className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${
                    generatedDocument.compliance_status === 'compliant' ? 'bg-green-100 text-green-800' :
                    generatedDocument.compliance_status === 'requires_review' ? 'bg-yellow-100 text-yellow-800' :
                    'bg-red-100 text-red-800'
                  }`}>
                    {generatedDocument.compliance_status.replace('_', ' ').toUpperCase()}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );

  const renderCurrentStep = () => {
    switch (currentStep) {
      case 1: return renderTemplateSelection();
      case 2: return renderJurisdictionSelection();
      case 3: return renderPartiesStep();
      case 4: return renderVariablesStep();
      case 5: return renderGenerationStep();
      default: return renderTemplateSelection();
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="bg-white rounded-xl shadow-lg p-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Legal Document Wizard</h1>
          <p className="text-gray-600">
            Create professional entertainment industry legal documents with automated compliance checking
          </p>
        </div>
        
        {renderStepIndicator()}
        
        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="flex items-center">
              <AlertTriangle className="w-5 h-5 text-red-500 mr-3" />
              <p className="text-red-700">{error}</p>
            </div>
          </div>
        )}
        
        {loading && (
          <div className="mb-6 text-center">
            <div className="inline-flex items-center px-4 py-2 bg-blue-50 rounded-lg">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500 mr-3"></div>
              <span className="text-blue-700">Loading...</span>
            </div>
          </div>
        )}
        
        <div className="mb-8">
          {renderCurrentStep()}
        </div>
        
        <div className="flex justify-between">
          <button
            onClick={prevStep}
            disabled={currentStep === 1}
            className="bg-gray-300 text-gray-700 px-6 py-2 rounded-lg hover:bg-gray-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Previous
          </button>
          
          {currentStep < 4 ? (
            <button
              onClick={nextStep}
              disabled={loading}
              className="bg-blue-500 text-white px-6 py-2 rounded-lg hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
            >
              Next
              <ArrowRight className="w-4 h-4 ml-2" />
            </button>
          ) : currentStep === 4 ? (
            <button
              onClick={nextStep}
              disabled={loading}
              className="bg-green-500 text-white px-6 py-2 rounded-lg hover:bg-green-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
            >
              Review & Generate
              <ArrowRight className="w-4 h-4 ml-2" />
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
};

export default LegalDocumentWizard;