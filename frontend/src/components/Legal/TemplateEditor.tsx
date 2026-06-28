/**
 * Advanced Legal Template Editor
 * Provides comprehensive template creation and editing with variable mapping,
 * conditional clauses, and jurisdiction-specific customization
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { 
  Save, 
  Plus, 
  Trash2, 
  Edit, 
  Code, 
  Eye, 
  Download, 
  Upload,
  Copy,
  AlertTriangle,
  CheckCircle,
  Settings,
  FileText,
  Globe,
  Layers,
  Type,
  Hash,
  Calendar,
  DollarSign,
  ToggleLeft,
  List,
  Text,
  Brackets
} from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../lib/api';

// Types
interface TemplateVariable {
  name: string;
  type: 'string' | 'number' | 'date' | 'currency' | 'text' | 'boolean' | 'array' | 'object';
  required: boolean;
  description: string;
  default?: any;
  enum?: string[];
  min?: number;
  max?: number;
  validation?: string;
  placeholder?: string;
  dependsOn?: string;
  category?: string;
}

interface ConditionalClause {
  id: string;
  name: string;
  description: string;
  condition: string; // JavaScript-like condition
  content: string;
  variables?: Record<string, TemplateVariable>;
  priority?: number;
}

interface TemplateSection {
  id: string;
  title: string;
  content: string;
  order: number;
  isOptional: boolean;
  conditions?: string;
  variables?: string[];
}

interface DocumentTemplate {
  id?: string;
  name: string;
  description: string;
  category: string;
  jurisdictions: string[];
  variables: Record<string, TemplateVariable>;
  conditional_clauses?: Record<string, ConditionalClause>;
  template_content: {
    title: string;
    preamble: string;
    sections: TemplateSection[];
    signature_blocks?: string;
  };
  compliance_requirements?: Record<string, any>;
  version?: string;
  is_active: boolean;
}

interface ValidationResult {
  isValid: boolean;
  errors: Array<{
    field: string;
    message: string;
    type: string;
  }>;
  warnings: Array<{
    field: string;
    message: string;
  }>;
}

const TemplateEditor: React.FC = () => {
  // State management
  const [template, setTemplate] = useState<DocumentTemplate>({
    name: '',
    description: '',
    category: 'nda',
    jurisdictions: [],
    variables: {},
    conditional_clauses: {},
    template_content: {
      title: '',
      preamble: '',
      sections: []
    },
    is_active: true
  });

  const [availableJurisdictions, setAvailableJurisdictions] = useState<Array<{
    code: string;
    name: string;
  }>>([]);
  
  const [currentTab, setCurrentTab] = useState<'basic' | 'variables' | 'content' | 'clauses' | 'preview'>('basic');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [validation, setValidation] = useState<ValidationResult | null>(null);
  
  // Variable editor state
  const [showVariableEditor, setShowVariableEditor] = useState(false);
  const [editingVariable, setEditingVariable] = useState<{
    name: string;
    variable: TemplateVariable;
    isNew: boolean;
  } | null>(null);

  // Section editor state
  const [editingSection, setEditingSection] = useState<TemplateSection | null>(null);
  const [showSectionEditor, setShowSectionEditor] = useState(false);

  // Conditional clause editor state
  const [editingClause, setEditingClause] = useState<ConditionalClause | null>(null);
  const [showClauseEditor, setShowClauseEditor] = useState(false);

  // Preview state
  const [previewData, setPreviewData] = useState<Record<string, any>>({});

  // Load initial data
  useEffect(() => {
    void loadJurisdictions();
  }, []);

  const loadJurisdictions = useCallback(async () => {
    try {
      const response = await api.get('/api/legal/jurisdictions');
      if (response.data?.success) {
        setAvailableJurisdictions(response.data.data.jurisdictions);
      }
    } catch (error) {
      console.error('Error loading jurisdictions:', error);
    }
  }, []);

  const validateTemplate = useCallback(async (): Promise<ValidationResult> => {
    const errors: Array<{ field: string; message: string; type: string }> = [];
    const warnings: Array<{ field: string; message: string }> = [];

    // Basic validation
    if (!template.name.trim()) {
      errors.push({ field: 'name', message: 'Template name is required', type: 'required' });
    }

    if (!template.description.trim()) {
      errors.push({ field: 'description', message: 'Template description is required', type: 'required' });
    }

    if (template.jurisdictions.length === 0) {
      warnings.push({ field: 'jurisdictions', message: 'No jurisdictions selected - template will have limited usability' });
    }

    if (!template.template_content.title.trim()) {
      errors.push({ field: 'template_content.title', message: 'Document title is required', type: 'required' });
    }

    if (template.template_content.sections.length === 0) {
      warnings.push({ field: 'template_content.sections', message: 'Template has no sections - consider adding content sections' });
    }

    // Variable validation
    Object.entries(template.variables).forEach(([name, variable]) => {
      if (!variable.description.trim()) {
        warnings.push({ field: `variables.${name}`, message: `Variable "${name}" lacks description` });
      }

      if (variable.type === 'number' && variable.min !== undefined && variable.max !== undefined && variable.min >= variable.max) {
        errors.push({ field: `variables.${name}`, message: `Variable "${name}" min value must be less than max value`, type: 'range' });
      }

      if (variable.validation && variable.type === 'string') {
        try {
          new RegExp(variable.validation);
        } catch (e) {
          errors.push({ field: `variables.${name}`, message: `Variable "${name}" has invalid regex pattern`, type: 'format' });
        }
      }
    });

    // Content validation
    const variablePattern = /\{\{(\w+)\}\}/g;
    const usedVariables = new Set<string>();
    
    // Check preamble for variables
    const preambleMatches = template.template_content.preamble.match(variablePattern);
    if (preambleMatches) {
      preambleMatches.forEach(match => {
        const varName = match.replace(/[{}]/g, '');
        usedVariables.add(varName);
        if (!template.variables[varName]) {
          errors.push({ field: 'preamble', message: `Undefined variable "${varName}" used in preamble`, type: 'reference' });
        }
      });
    }

    // Check sections for variables
    template.template_content.sections.forEach((section, index) => {
      const sectionMatches = section.content.match(variablePattern);
      if (sectionMatches) {
        sectionMatches.forEach(match => {
          const varName = match.replace(/[{}]/g, '');
          usedVariables.add(varName);
          if (!template.variables[varName]) {
            errors.push({ field: `section.${index}`, message: `Undefined variable "${varName}" used in section "${section.title}"`, type: 'reference' });
          }
        });
      }
    });

    // Check for unused variables
    Object.keys(template.variables).forEach(varName => {
      if (!usedVariables.has(varName)) {
        warnings.push({ field: `variables.${varName}`, message: `Variable "${varName}" is defined but not used in template` });
      }
    });

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }, [template]);

  const saveTemplate = useCallback(async () => {
    try {
      setSaving(true);
      setError(null);

      const validationResult = await validateTemplate();
      setValidation(validationResult);

      if (!validationResult.isValid) {
        setError('Please fix validation errors before saving');
        return;
      }

      const endpoint = template.id ? `/api/legal/templates/${template.id}` : '/api/legal/templates';
      const method = template.id ? 'PUT' : 'POST';

      const response = await api.request({
        method,
        url: endpoint,
        data: template
      });

      if (response.data?.success) {
        const wasUpdate = !!template.id;
        if (!template.id) {
          setTemplate(prev => ({ ...prev, id: response.data.data.template.id }));
        }
        toast.success(wasUpdate ? 'Template updated' : 'Template created');
      } else {
        setError('Failed to save template');
        toast.error('Failed to save template');
      }
    } catch (error: any) {
      console.error('Save error:', error);
      setError(error.response?.data?.error || 'Failed to save template');
      toast.error(error.response?.data?.error || 'Failed to save template');
    } finally {
      setSaving(false);
    }
  }, [template, validateTemplate]);

  const loadTemplate = useCallback(async (templateId: string) => {
    try {
      setLoading(true);
      const response = await api.get(`/api/legal/templates/${templateId}`);
      if (response.data?.success) {
        setTemplate(response.data.data.template);
      }
    } catch (error) {
      console.error('Load error:', error);
      setError('Failed to load template');
    } finally {
      setLoading(false);
    }
  }, []);

  const addVariable = useCallback(() => {
    setEditingVariable({
      name: '',
      variable: {
        name: '',
        type: 'string',
        required: false,
        description: '',
        category: 'general'
      },
      isNew: true
    });
    setShowVariableEditor(true);
  }, []);

  const editVariable = useCallback((name: string) => {
    setEditingVariable({
      name,
      variable: template.variables[name],
      isNew: false
    });
    setShowVariableEditor(true);
  }, [template.variables]);

  const saveVariable = useCallback((name: string, variable: TemplateVariable) => {
    setTemplate(prev => {
      const newVariables = { ...prev.variables };
      
      // If renaming, remove old key
      if (editingVariable && editingVariable.name !== name && !editingVariable.isNew) {
        delete newVariables[editingVariable.name];
      }
      
      newVariables[name] = variable;
      
      return {
        ...prev,
        variables: newVariables
      };
    });
    
    setShowVariableEditor(false);
    setEditingVariable(null);
  }, [editingVariable]);

  const deleteVariable = useCallback((name: string) => {
    setTemplate(prev => {
      const newVariables = { ...prev.variables };
      delete newVariables[name];
      return {
        ...prev,
        variables: newVariables
      };
    });
  }, []);

  const addSection = useCallback(() => {
    const newSection: TemplateSection = {
      id: Date.now().toString(),
      title: '',
      content: '',
      order: template.template_content.sections.length,
      isOptional: false
    };
    setEditingSection(newSection);
    setShowSectionEditor(true);
  }, [template.template_content.sections.length]);

  const editSection = useCallback((section: TemplateSection) => {
    setEditingSection(section);
    setShowSectionEditor(true);
  }, []);

  const saveSection = useCallback((section: TemplateSection) => {
    setTemplate(prev => {
      const sections = [...prev.template_content.sections];
      const existingIndex = sections.findIndex(s => s.id === section.id);
      
      if (existingIndex >= 0) {
        sections[existingIndex] = section;
      } else {
        sections.push(section);
      }
      
      return {
        ...prev,
        template_content: {
          ...prev.template_content,
          sections
        }
      };
    });
    
    setShowSectionEditor(false);
    setEditingSection(null);
  }, []);

  const deleteSection = useCallback((sectionId: string) => {
    setTemplate(prev => ({
      ...prev,
      template_content: {
        ...prev.template_content,
        sections: prev.template_content.sections.filter(s => s.id !== sectionId)
      }
    }));
  }, []);

  const getVariableIcon = (type: string) => {
    switch (type) {
      case 'string': return <Type className="w-4 h-4" />;
      case 'number': return <Hash className="w-4 h-4" />;
      case 'date': return <Calendar className="w-4 h-4" />;
      case 'currency': return <DollarSign className="w-4 h-4" />;
      case 'boolean': return <ToggleLeft className="w-4 h-4" />;
      case 'array': return <List className="w-4 h-4" />;
      case 'text': return <Text className="w-4 h-4" />;
      case 'object': return <Brackets className="w-4 h-4" />;
      default: return <Type className="w-4 h-4" />;
    }
  };

  const generatePreview = useCallback(async () => {
    try {
      setLoading(true);
      
      // Generate sample data for all variables
      const sampleData: Record<string, any> = {};
      Object.entries(template.variables).forEach(([name, variable]) => {
        switch (variable.type) {
          case 'string':
            sampleData[name] = variable.placeholder || `Sample ${name}`;
            break;
          case 'number':
            sampleData[name] = variable.default || (variable.min || 0) + 10;
            break;
          case 'date':
            sampleData[name] = new Date().toISOString().split('T')[0];
            break;
          case 'currency':
            sampleData[name] = variable.default || 10000;
            break;
          case 'boolean':
            sampleData[name] = variable.default || true;
            break;
          case 'text':
            sampleData[name] = variable.placeholder || `Sample ${name} content`;
            break;
          default:
            sampleData[name] = variable.default || `Sample ${name}`;
        }
      });
      
      setPreviewData(sampleData);
    } catch (error) {
      console.error('Preview generation error:', error);
    } finally {
      setLoading(false);
    }
  }, [template.variables]);

  const renderPreview = useMemo(() => {
    let content = template.template_content.preamble;
    
    // Replace variables in content
    Object.entries(previewData).forEach(([name, value]) => {
      const pattern = new RegExp(`\\{\\{${name}\\}\\}`, 'g');
      content = content.replace(pattern, String(value));
    });

    return content;
  }, [template.template_content.preamble, previewData]);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Template Editor</h1>
          <p className="text-gray-600">Create and customize legal document templates</p>
        </div>
        
        <div className="flex space-x-3">
          <button
            onClick={() => validateTemplate().then(setValidation)}
            className="bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600 transition-colors flex items-center"
          >
            <CheckCircle className="w-4 h-4 mr-2" />
            Validate
          </button>
          
          <button
            onClick={saveTemplate}
            disabled={saving}
            className="bg-green-500 text-white px-6 py-2 rounded-lg hover:bg-green-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
          >
            {saving ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                Saving...
              </>
            ) : (
              <>
                <Save className="w-4 h-4 mr-2" />
                Save Template
              </>
            )}
          </button>
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center">
            <AlertTriangle className="w-5 h-5 text-red-500 mr-3" />
            <p className="text-red-700">{error}</p>
          </div>
        </div>
      )}

      {/* Validation Results */}
      {validation && (
        <div className="mb-6 space-y-4">
          {validation.errors.length > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <h3 className="text-lg font-medium text-red-800 mb-2">Validation Errors</h3>
              <ul className="space-y-1">
                {validation.errors.map((error, index) => (
                  <li key={index} className="text-sm text-red-700 flex items-start">
                    <AlertTriangle className="w-4 h-4 mt-0.5 mr-2 flex-shrink-0" />
                    <span><strong>{error.field}:</strong> {error.message}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          
          {validation.warnings.length > 0 && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <h3 className="text-lg font-medium text-yellow-800 mb-2">Warnings</h3>
              <ul className="space-y-1">
                {validation.warnings.map((warning, index) => (
                  <li key={index} className="text-sm text-yellow-700 flex items-start">
                    <AlertTriangle className="w-4 h-4 mt-0.5 mr-2 flex-shrink-0" />
                    <span><strong>{warning.field}:</strong> {warning.message}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Navigation Tabs */}
      <div className="bg-white rounded-lg border mb-8">
        <div className="border-b">
          <nav className="flex space-x-8" aria-label="Tabs">
            {[
              { id: 'basic', name: 'Basic Info', icon: FileText },
              { id: 'variables', name: 'Variables', icon: Settings },
              { id: 'content', name: 'Content', icon: Edit },
              { id: 'clauses', name: 'Clauses', icon: Layers },
              { id: 'preview', name: 'Preview', icon: Eye }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setCurrentTab(tab.id as any)}
                className={`py-2 px-1 border-b-2 font-medium text-sm flex items-center ${
                  currentTab === tab.id
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <tab.icon className="w-4 h-4 mr-2" />
                {tab.name}
              </button>
            ))}
          </nav>
        </div>

        <div className="p-6">
          {/* Basic Info Tab */}
          {currentTab === 'basic' && (
            <div className="space-y-6">
              <div className="grid gap-6 md:grid-cols-2">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Template Name *
                  </label>
                  <input
                    type="text"
                    value={template.name}
                    onChange={(e) => setTemplate(prev => ({ ...prev, name: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="e.g., Standard NDA Template"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Category *
                  </label>
                  <select
                    value={template.category}
                    onChange={(e) => setTemplate(prev => ({ ...prev, category: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="nda">Non-Disclosure Agreement</option>
                    <option value="investment_agreement">Investment Agreement</option>
                    <option value="production_contract">Production Contract</option>
                    <option value="talent_agreement">Talent Agreement</option>
                    <option value="distribution_agreement">Distribution Agreement</option>
                    <option value="term_sheet">Term Sheet</option>
                  </select>
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Description *
                </label>
                <textarea
                  value={template.description}
                  onChange={(e) => setTemplate(prev => ({ ...prev, description: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  rows={3}
                  placeholder="Describe the purpose and usage of this template..."
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Jurisdictions
                </label>
                <div className="grid gap-2 md:grid-cols-3">
                  {availableJurisdictions.map(jurisdiction => (
                    <label key={jurisdiction.code} className="flex items-center">
                      <input
                        type="checkbox"
                        checked={template.jurisdictions.includes(jurisdiction.code)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setTemplate(prev => ({
                              ...prev,
                              jurisdictions: [...prev.jurisdictions, jurisdiction.code]
                            }));
                          } else {
                            setTemplate(prev => ({
                              ...prev,
                              jurisdictions: prev.jurisdictions.filter(j => j !== jurisdiction.code)
                            }));
                          }
                        }}
                        className="mr-2"
                      />
                      <span className="text-sm">{jurisdiction.name}</span>
                    </label>
                  ))}
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Document Title *
                </label>
                <input
                  type="text"
                  value={template.template_content.title}
                  onChange={(e) => setTemplate(prev => ({
                    ...prev,
                    template_content: {
                      ...prev.template_content,
                      title: e.target.value
                    }
                  }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g., MUTUAL NON-DISCLOSURE AGREEMENT"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Preamble
                </label>
                <textarea
                  value={template.template_content.preamble}
                  onChange={(e) => setTemplate(prev => ({
                    ...prev,
                    template_content: {
                      ...prev.template_content,
                      preamble: e.target.value
                    }
                  }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  rows={4}
                  placeholder="This agreement is entered into on {{effective_date}} between {{party_names}}..."
                />
              </div>
            </div>
          )}

          {/* Variables Tab */}
          {currentTab === 'variables' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-medium text-gray-900">Template Variables</h3>
                <button
                  onClick={addVariable}
                  className="bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600 transition-colors flex items-center"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Add Variable
                </button>
              </div>
              
              <div className="space-y-4">
                {Object.entries(template.variables).map(([name, variable]) => (
                  <div key={name} className="p-4 border rounded-lg">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center">
                        {getVariableIcon(variable.type)}
                        <div className="ml-3">
                          <h4 className="text-sm font-medium text-gray-900">
                            {name}
                            {variable.required && <span className="text-red-500 ml-1">*</span>}
                          </h4>
                          <p className="text-sm text-gray-600">{variable.description}</p>
                          <div className="flex items-center mt-1 space-x-2">
                            <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">
                              {variable.type}
                            </span>
                            {variable.category && (
                              <span className="text-xs text-gray-500 bg-blue-100 px-2 py-1 rounded">
                                {variable.category}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex space-x-2">
                        <button
                          onClick={() => editVariable(name)}
                          className="text-blue-600 hover:text-blue-800 p-1"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => deleteVariable(name)}
                          className="text-red-600 hover:text-red-800 p-1"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
                
                {Object.keys(template.variables).length === 0 && (
                  <div className="text-center py-8 text-gray-500">
                    <Type className="w-12 h-12 mx-auto mb-4 text-gray-400" />
                    <p>No variables defined yet</p>
                    <p className="text-sm">Click "Add Variable" to create template variables</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Content Tab */}
          {currentTab === 'content' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-medium text-gray-900">Template Sections</h3>
                <button
                  onClick={addSection}
                  className="bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600 transition-colors flex items-center"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Add Section
                </button>
              </div>
              
              <div className="space-y-4">
                {template.template_content.sections
                  .sort((a, b) => a.order - b.order)
                  .map((section) => (
                    <div key={section.id} className="p-4 border rounded-lg">
                      <div className="flex items-center justify-between mb-3">
                        <div>
                          <h4 className="text-sm font-medium text-gray-900">
                            {section.order + 1}. {section.title}
                            {section.isOptional && <span className="text-gray-500 ml-2">(Optional)</span>}
                          </h4>
                          {section.conditions && (
                            <p className="text-xs text-blue-600">Condition: {section.conditions}</p>
                          )}
                        </div>
                        
                        <div className="flex space-x-2">
                          <button
                            onClick={() => editSection(section)}
                            className="text-blue-600 hover:text-blue-800 p-1"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => deleteSection(section.id)}
                            className="text-red-600 hover:text-red-800 p-1"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                      
                      <div className="text-sm text-gray-600 bg-gray-50 p-3 rounded max-h-32 overflow-y-auto">
                        {section.content || <em>No content</em>}
                      </div>
                    </div>
                  ))}
                
                {template.template_content.sections.length === 0 && (
                  <div className="text-center py-8 text-gray-500">
                    <FileText className="w-12 h-12 mx-auto mb-4 text-gray-400" />
                    <p>No sections defined yet</p>
                    <p className="text-sm">Click "Add Section" to create template content</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Preview Tab */}
          {currentTab === 'preview' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-medium text-gray-900">Template Preview</h3>
                <button
                  onClick={generatePreview}
                  className="bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600 transition-colors flex items-center"
                >
                  <Eye className="w-4 h-4 mr-2" />
                  Generate Preview
                </button>
              </div>
              
              <div className="bg-white border rounded-lg p-6 min-h-96">
                <div className="prose max-w-none">
                  <h1 className="text-center">{template.template_content.title}</h1>
                  <div className="whitespace-pre-wrap">{renderPreview}</div>
                  
                  {template.template_content.sections.map((section) => (
                    <div key={section.id}>
                      <h2>{section.title}</h2>
                      <div className="whitespace-pre-wrap">
                        {section.content.replace(/\{\{(\w+)\}\}/g, (match, varName) => 
                          previewData[varName] || match
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Variable Editor Modal */}
      {showVariableEditor && editingVariable && (
        <VariableEditorModal
          variable={editingVariable}
          onSave={saveVariable}
          onCancel={() => {
            setShowVariableEditor(false);
            setEditingVariable(null);
          }}
        />
      )}

      {/* Section Editor Modal */}
      {showSectionEditor && editingSection && (
        <SectionEditorModal
          section={editingSection}
          variables={Object.keys(template.variables)}
          onSave={saveSection}
          onCancel={() => {
            setShowSectionEditor(false);
            setEditingSection(null);
          }}
        />
      )}
    </div>
  );
};

// Variable Editor Modal Component
const VariableEditorModal: React.FC<{
  variable: { name: string; variable: TemplateVariable; isNew: boolean };
  onSave: (name: string, variable: TemplateVariable) => void;
  onCancel: () => void;
}> = ({ variable, onSave, onCancel }) => {
  const [name, setName] = useState(variable.name);
  const [varData, setVarData] = useState<TemplateVariable>(variable.variable);

  const handleSave = () => {
    if (name.trim() && varData.description.trim()) {
      onSave(name.trim(), varData);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-md max-h-screen overflow-y-auto">
        <h3 className="text-lg font-medium text-gray-900 mb-4">
          {variable.isNew ? 'Add Variable' : 'Edit Variable'}
        </h3>
        
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Variable Name *
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="e.g., effective_date"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Type *
            </label>
            <select
              value={varData.type}
              onChange={(e) => setVarData(prev => ({ ...prev, type: e.target.value as TemplateVariable['type'] }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="string">String</option>
              <option value="number">Number</option>
              <option value="date">Date</option>
              <option value="currency">Currency</option>
              <option value="boolean">Boolean</option>
              <option value="text">Text (Multi-line)</option>
              <option value="array">Array</option>
              <option value="object">Object</option>
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Description *
            </label>
            <textarea
              value={varData.description}
              onChange={(e) => setVarData(prev => ({ ...prev, description: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              rows={3}
              placeholder="Describe this variable's purpose..."
            />
          </div>
          
          <div className="flex items-center">
            <input
              type="checkbox"
              id="required"
              checked={varData.required}
              onChange={(e) => setVarData(prev => ({ ...prev, required: e.target.checked }))}
              className="mr-2"
            />
            <label htmlFor="required" className="text-sm text-gray-700">
              Required variable
            </label>
          </div>
          
          {varData.type === 'string' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Placeholder
              </label>
              <input
                type="text"
                value={varData.placeholder || ''}
                onChange={(e) => setVarData(prev => ({ ...prev, placeholder: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="e.g., Enter party name"
              />
            </div>
          )}
          
          {(varData.type === 'number' || varData.type === 'currency') && (
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Minimum Value
                </label>
                <input
                  type="number"
                  value={varData.min || ''}
                  onChange={(e) => setVarData(prev => ({ ...prev, min: parseFloat(e.target.value) || undefined }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Maximum Value
                </label>
                <input
                  type="number"
                  value={varData.max || ''}
                  onChange={(e) => setVarData(prev => ({ ...prev, max: parseFloat(e.target.value) || undefined }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          )}
        </div>
        
        <div className="flex justify-end space-x-3 mt-6">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors"
          >
            Save Variable
          </button>
        </div>
      </div>
    </div>
  );
};

// Section Editor Modal Component
const SectionEditorModal: React.FC<{
  section: TemplateSection;
  variables: string[];
  onSave: (section: TemplateSection) => void;
  onCancel: () => void;
}> = ({ section, variables, onSave, onCancel }) => {
  const [sectionData, setSectionData] = useState<TemplateSection>(section);

  const handleSave = () => {
    if (sectionData.title.trim() && sectionData.content.trim()) {
      onSave(sectionData);
    }
  };

  const insertVariable = (varName: string) => {
    setSectionData(prev => ({
      ...prev,
      content: prev.content + `{{${varName}}}`
    }));
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-4xl max-h-screen overflow-y-auto">
        <h3 className="text-lg font-medium text-gray-900 mb-4">
          {section.title ? 'Edit Section' : 'Add Section'}
        </h3>
        
        <div className="grid gap-6 md:grid-cols-3">
          <div className="md:col-span-2 space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Section Title *
              </label>
              <input
                type="text"
                value={sectionData.title}
                onChange={(e) => setSectionData(prev => ({ ...prev, title: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="e.g., 1. DEFINITION OF CONFIDENTIAL INFORMATION"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Content *
              </label>
              <textarea
                value={sectionData.content}
                onChange={(e) => setSectionData(prev => ({ ...prev, content: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                rows={12}
                placeholder="Enter section content... Use {{variable_name}} to insert variables."
              />
            </div>
            
            <div className="grid gap-4 md:grid-cols-2">
              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="optional"
                  checked={sectionData.isOptional}
                  onChange={(e) => setSectionData(prev => ({ ...prev, isOptional: e.target.checked }))}
                  className="mr-2"
                />
                <label htmlFor="optional" className="text-sm text-gray-700">
                  Optional section
                </label>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Order
                </label>
                <input
                  type="number"
                  value={sectionData.order}
                  onChange={(e) => setSectionData(prev => ({ ...prev, order: parseInt(e.target.value) || 0 }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
            
            {sectionData.isOptional && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Display Conditions
                </label>
                <input
                  type="text"
                  value={sectionData.conditions || ''}
                  onChange={(e) => setSectionData(prev => ({ ...prev, conditions: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g., party_count > 2"
                />
              </div>
            )}
          </div>
          
          <div>
            <h4 className="text-sm font-medium text-gray-700 mb-3">Available Variables</h4>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {variables.map(varName => (
                <button
                  key={varName}
                  onClick={() => insertVariable(varName)}
                  className="w-full text-left px-3 py-2 text-sm bg-gray-50 hover:bg-gray-100 rounded border text-gray-700"
                >
                  {varName}
                </button>
              ))}
              
              {variables.length === 0 && (
                <p className="text-sm text-gray-500 italic">No variables defined</p>
              )}
            </div>
          </div>
        </div>
        
        <div className="flex justify-end space-x-3 mt-6">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors"
          >
            Save Section
          </button>
        </div>
      </div>
    </div>
  );
};

export default TemplateEditor;