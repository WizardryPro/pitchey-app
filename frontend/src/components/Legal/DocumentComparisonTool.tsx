/**
 * Advanced Document Comparison Tool
 * Provides side-by-side comparison of legal documents with change tracking,
 * risk assessment, and compliance analysis
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { 
  ArrowLeftRight, 
  AlertTriangle, 
  CheckCircle, 
  FileText, 
  Eye, 
  Download, 
  Settings,
  Filter,
  RotateCcw,
  Save,
  Share2,
  Calendar,
  User,
  Scale
} from 'lucide-react';
import api from '../../lib/api';

// Types
interface DocumentVersion {
  id: string;
  document_name: string;
  document_type: string;
  version: string;
  content: any;
  created_at: string;
  created_by: string;
  author_name?: string;
  file_size: number;
  compliance_status: 'compliant' | 'requires_review' | 'non_compliant';
}

interface DocumentChange {
  type: 'addition' | 'deletion' | 'modification';
  field: string;
  section?: string;
  originalValue?: any;
  newValue?: any;
  riskLevel?: 'low' | 'medium' | 'high' | 'critical';
  description?: string;
}

interface ComparisonResult {
  changes: DocumentChange[];
  changesSummary: {
    totalChanges: number;
    additions: number;
    deletions: number;
    modifications: number;
  };
  riskAssessment: {
    overallRisk: 'low' | 'medium' | 'high' | 'critical';
    riskFactors: Array<{
      factor: string;
      riskLevel: 'low' | 'medium' | 'high' | 'critical';
      description: string;
      recommendation: string;
    }>;
    complianceScore: number;
  };
  legalAnalysis: {
    significantChanges: string[];
    complianceImpact: string[];
    recommendations: string[];
  };
}

interface ComparisonSettings {
  showMinorChanges: boolean;
  highlightRiskyChanges: boolean;
  groupBySection: boolean;
  showLineNumbers: boolean;
  compareMode: 'side-by-side' | 'unified' | 'inline';
}

const DocumentComparisonTool: React.FC = () => {
  // State management
  const [documents, setDocuments] = useState<DocumentVersion[]>([]);
  const [selectedDocument1, setSelectedDocument1] = useState<DocumentVersion | null>(null);
  const [selectedDocument2, setSelectedDocument2] = useState<DocumentVersion | null>(null);
  const [comparisonResult, setComparisonResult] = useState<ComparisonResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Comparison settings
  const [settings, setSettings] = useState<ComparisonSettings>({
    showMinorChanges: true,
    highlightRiskyChanges: true,
    groupBySection: true,
    showLineNumbers: false,
    compareMode: 'side-by-side'
  });

  // Filters
  const [changeTypeFilter, setChangeTypeFilter] = useState<string>('');
  const [riskLevelFilter, setRiskLevelFilter] = useState<string>('');
  const [sectionFilter, setSectionFilter] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState<string>('');

  // Load available documents
  useEffect(() => {
    void loadDocuments();
  }, []);

  const loadDocuments = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await api.get('/api/legal/documents/versions');
      if (response.data?.success) {
        setDocuments(response.data.data.documents || []);
      } else {
        setDocuments([]);
      }
    } catch (error) {
      console.error('Error loading documents:', error);
      setDocuments([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const compareDocuments = useCallback(async () => {
    if (!selectedDocument1 || !selectedDocument2) {
      setError('Please select two documents to compare');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const response = await api.post('/api/legal/documents/compare', {
        document1_id: selectedDocument1.id,
        document2_id: selectedDocument2.id,
        comparison_settings: settings
      });

      if (response.data?.success) {
        setComparisonResult(response.data.data.comparison);
      } else {
        setError('Failed to compare documents');
      }
    } catch (error: any) {
      console.error('Comparison error:', error);
      setError(error.response?.data?.error || 'Failed to compare documents');
    } finally {
      setLoading(false);
    }
  }, [selectedDocument1, selectedDocument2, settings]);

  // Filter changes based on current filters
  const filteredChanges = useMemo(() => {
    if (!comparisonResult) return [];
    
    return comparisonResult.changes.filter(change => {
      // Type filter
      if (changeTypeFilter && change.type !== changeTypeFilter) return false;
      
      // Risk level filter
      if (riskLevelFilter && change.riskLevel !== riskLevelFilter) return false;
      
      // Section filter
      if (sectionFilter && change.section !== sectionFilter) return false;
      
      // Search term filter
      if (searchTerm) {
        const searchLower = searchTerm.toLowerCase();
        return (
          change.field.toLowerCase().includes(searchLower) ||
          change.description?.toLowerCase().includes(searchLower) ||
          JSON.stringify(change.originalValue).toLowerCase().includes(searchLower) ||
          JSON.stringify(change.newValue).toLowerCase().includes(searchLower)
        );
      }
      
      return true;
    });
  }, [comparisonResult, changeTypeFilter, riskLevelFilter, sectionFilter, searchTerm]);

  const resetFilters = () => {
    setChangeTypeFilter('');
    setRiskLevelFilter('');
    setSectionFilter('');
    setSearchTerm('');
  };

  const getChangeIcon = (type: string) => {
    switch (type) {
      case 'addition': return <span className="text-green-600 font-bold">+</span>;
      case 'deletion': return <span className="text-red-600 font-bold">-</span>;
      case 'modification': return <span className="text-blue-600 font-bold">~</span>;
      default: return null;
    }
  };

  const getRiskColor = (riskLevel?: string) => {
    switch (riskLevel) {
      case 'critical': return 'text-red-800 bg-red-100 border-red-300';
      case 'high': return 'text-orange-800 bg-orange-100 border-orange-300';
      case 'medium': return 'text-yellow-800 bg-yellow-100 border-yellow-300';
      case 'low': return 'text-green-800 bg-green-100 border-green-300';
      default: return 'text-gray-800 bg-gray-100 border-gray-300';
    }
  };

  const getComplianceIcon = (status: string) => {
    switch (status) {
      case 'compliant': return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'requires_review': return <AlertTriangle className="w-5 h-5 text-yellow-500" />;
      case 'non_compliant': return <AlertTriangle className="w-5 h-5 text-red-500" />;
      default: return <AlertTriangle className="w-5 h-5 text-gray-500" />;
    }
  };

  const exportComparison = async () => {
    if (!comparisonResult) return;

    try {
      const response = await api.post('/api/legal/documents/export-comparison', {
        document1_id: selectedDocument1?.id,
        document2_id: selectedDocument2?.id,
        comparison_result: comparisonResult,
        export_format: 'pdf'
      });

      if (response.data?.success) {
        const downloadUrl = response.data.data.download_url;
        window.open(downloadUrl, '_blank');
      }
    } catch (error) {
      console.error('Export error:', error);
      setError('Failed to export comparison');
    }
  };

  // Get unique values for filters
  const uniqueChangeTypes = [...new Set(comparisonResult?.changes.map(c => c.type) || [])];
  const uniqueRiskLevels = [...new Set(comparisonResult?.changes.map(c => c.riskLevel).filter(Boolean) || [])];
  const uniqueSections = [...new Set(comparisonResult?.changes.map(c => c.section).filter(Boolean) || [])];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Document Comparison Tool</h1>
          <p className="text-gray-600">Compare legal documents with advanced change tracking and risk analysis</p>
        </div>
      </div>

      {/* Document Selection */}
      <div className="bg-white rounded-lg border p-6">
        {documents.length === 0 && !loading ? (
          <div className="text-center py-12">
            <FileText className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No Documents Yet</h3>
            <p className="text-gray-500">Generate a legal document using the Document Wizard first, then come back here to compare versions.</p>
          </div>
        ) : (
        <>
        <h2 className="text-lg font-medium text-gray-900 mb-4">Select Documents to Compare</h2>
        
        <div className="grid gap-6 md:grid-cols-2">
          {/* Document 1 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Original Document
            </label>
            <select
              value={selectedDocument1?.id || ''}
              onChange={(e) => {
                const doc = documents.find(d => d.id === e.target.value);
                setSelectedDocument1(doc || null);
              }}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Select a document...</option>
              {documents.map(doc => (
                <option key={doc.id} value={doc.id}>
                  {doc.document_name} (v{doc.version}) - {new Date(doc.created_at).toLocaleDateString()}
                </option>
              ))}
            </select>
            
            {selectedDocument1 && (
              <div className="mt-3 p-3 bg-gray-50 rounded-md">
                <div className="flex items-center justify-between text-sm text-gray-600">
                  <span className="flex items-center">
                    <FileText className="w-4 h-4 mr-2" />
                    {selectedDocument1.document_type.replace('_', ' ').toUpperCase()}
                  </span>
                  {getComplianceIcon(selectedDocument1.compliance_status)}
                </div>
                <div className="flex items-center mt-2 text-xs text-gray-500">
                  <User className="w-3 h-3 mr-1" />
                  {selectedDocument1.author_name || 'Unknown'}
                  <Calendar className="w-3 h-3 ml-3 mr-1" />
                  {new Date(selectedDocument1.created_at).toLocaleDateString()}
                </div>
              </div>
            )}
          </div>

          {/* Document 2 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Modified Document
            </label>
            <select
              value={selectedDocument2?.id || ''}
              onChange={(e) => {
                const doc = documents.find(d => d.id === e.target.value);
                setSelectedDocument2(doc || null);
              }}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Select a document...</option>
              {documents.map(doc => (
                <option key={doc.id} value={doc.id}>
                  {doc.document_name} (v{doc.version}) - {new Date(doc.created_at).toLocaleDateString()}
                </option>
              ))}
            </select>
            
            {selectedDocument2 && (
              <div className="mt-3 p-3 bg-gray-50 rounded-md">
                <div className="flex items-center justify-between text-sm text-gray-600">
                  <span className="flex items-center">
                    <FileText className="w-4 h-4 mr-2" />
                    {selectedDocument2.document_type.replace('_', ' ').toUpperCase()}
                  </span>
                  {getComplianceIcon(selectedDocument2.compliance_status)}
                </div>
                <div className="flex items-center mt-2 text-xs text-gray-500">
                  <User className="w-3 h-3 mr-1" />
                  {selectedDocument2.author_name || 'Unknown'}
                  <Calendar className="w-3 h-3 ml-3 mr-1" />
                  {new Date(selectedDocument2.created_at).toLocaleDateString()}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Comparison Settings */}
        <div className="mt-6 p-4 border rounded-lg bg-gray-50">
          <div className="flex items-center mb-3">
            <Settings className="w-4 h-4 mr-2" />
            <span className="text-sm font-medium">Comparison Settings</span>
          </div>
          
          <div className="grid gap-4 md:grid-cols-3">
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={settings.showMinorChanges}
                onChange={(e) => setSettings(prev => ({ ...prev, showMinorChanges: e.target.checked }))}
                className="mr-2"
              />
              <span className="text-sm">Show minor changes</span>
            </label>
            
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={settings.highlightRiskyChanges}
                onChange={(e) => setSettings(prev => ({ ...prev, highlightRiskyChanges: e.target.checked }))}
                className="mr-2"
              />
              <span className="text-sm">Highlight risky changes</span>
            </label>
            
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={settings.groupBySection}
                onChange={(e) => setSettings(prev => ({ ...prev, groupBySection: e.target.checked }))}
                className="mr-2"
              />
              <span className="text-sm">Group by section</span>
            </label>
          </div>
        </div>

        {/* Compare Button */}
        <div className="mt-6 flex justify-center">
          <button
            onClick={compareDocuments}
            disabled={!selectedDocument1 || !selectedDocument2 || loading}
            className="bg-blue-500 text-white px-8 py-3 rounded-lg hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
          >
            {loading ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-3"></div>
                Comparing Documents...
              </>
            ) : (
              <>
                <ArrowLeftRight className="w-5 h-5 mr-3" />
                Compare Documents
              </>
            )}
          </button>
        </div>
        </>
        )}
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center">
            <AlertTriangle className="w-5 h-5 text-red-500 mr-3" />
            <p className="text-red-700">{error}</p>
          </div>
        </div>
      )}

      {/* Comparison Results */}
      {comparisonResult && (
        <div className="space-y-6">
          {/* Summary Statistics */}
          <div className="grid gap-4 md:grid-cols-4">
            <div className="bg-white rounded-lg border p-4">
              <div className="flex items-center">
                <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                  <FileText className="w-4 h-4 text-blue-600" />
                </div>
                <div className="ml-3">
                  <p className="text-2xl font-bold text-gray-900">
                    {comparisonResult.changesSummary.totalChanges}
                  </p>
                  <p className="text-sm text-gray-600">Total Changes</p>
                </div>
              </div>
            </div>
            
            <div className="bg-white rounded-lg border p-4">
              <div className="flex items-center">
                <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center">
                  <span className="text-green-600 font-bold">+</span>
                </div>
                <div className="ml-3">
                  <p className="text-2xl font-bold text-gray-900">
                    {comparisonResult.changesSummary.additions}
                  </p>
                  <p className="text-sm text-gray-600">Additions</p>
                </div>
              </div>
            </div>
            
            <div className="bg-white rounded-lg border p-4">
              <div className="flex items-center">
                <div className="w-8 h-8 bg-red-100 rounded-lg flex items-center justify-center">
                  <span className="text-red-600 font-bold">−</span>
                </div>
                <div className="ml-3">
                  <p className="text-2xl font-bold text-gray-900">
                    {comparisonResult.changesSummary.deletions}
                  </p>
                  <p className="text-sm text-gray-600">Deletions</p>
                </div>
              </div>
            </div>
            
            <div className="bg-white rounded-lg border p-4">
              <div className="flex items-center">
                <div className="w-8 h-8 bg-yellow-100 rounded-lg flex items-center justify-center">
                  <span className="text-yellow-600 font-bold">~</span>
                </div>
                <div className="ml-3">
                  <p className="text-2xl font-bold text-gray-900">
                    {comparisonResult.changesSummary.modifications}
                  </p>
                  <p className="text-sm text-gray-600">Modifications</p>
                </div>
              </div>
            </div>
          </div>

          {/* Risk Assessment */}
          <div className="bg-white rounded-lg border p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium text-gray-900">Risk Assessment</h3>
              <div className="flex items-center space-x-4">
                <div className="flex items-center">
                  <Scale className="w-4 h-4 mr-2 text-gray-500" />
                  <span className={`px-3 py-1 rounded-full text-sm font-medium ${getRiskColor(comparisonResult.riskAssessment.overallRisk)}`}>
                    {comparisonResult.riskAssessment.overallRisk.toUpperCase()} RISK
                  </span>
                </div>
                <div className="flex items-center">
                  <span className="text-sm text-gray-600 mr-2">Compliance Score:</span>
                  <span className={`px-2 py-1 rounded text-sm font-medium ${
                    comparisonResult.riskAssessment.complianceScore >= 80 ? 'bg-green-100 text-green-800' :
                    comparisonResult.riskAssessment.complianceScore >= 60 ? 'bg-yellow-100 text-yellow-800' :
                    'bg-red-100 text-red-800'
                  }`}>
                    {comparisonResult.riskAssessment.complianceScore}%
                  </span>
                </div>
              </div>
            </div>

            {comparisonResult.riskAssessment.riskFactors.length > 0 && (
              <div className="space-y-3">
                <h4 className="font-medium text-gray-900">Risk Factors</h4>
                {comparisonResult.riskAssessment.riskFactors.map((factor, index) => (
                  <div key={index} className={`p-3 rounded-lg border ${getRiskColor(factor.riskLevel)}`}>
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h5 className="font-medium">{factor.factor}</h5>
                        <p className="text-sm mt-1">{factor.description}</p>
                        <p className="text-xs mt-2 italic">Recommendation: {factor.recommendation}</p>
                      </div>
                      <span className={`px-2 py-1 rounded text-xs font-medium ml-3 ${getRiskColor(factor.riskLevel)}`}>
                        {factor.riskLevel.toUpperCase()}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Filters */}
          <div className="bg-white rounded-lg border p-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium text-gray-900">Filter Changes</h3>
              <div className="flex space-x-2">
                <button
                  onClick={resetFilters}
                  className="text-sm text-blue-600 hover:text-blue-700 flex items-center"
                >
                  <RotateCcw className="w-4 h-4 mr-1" />
                  Reset
                </button>
                <button
                  onClick={exportComparison}
                  className="bg-green-500 text-white px-4 py-2 rounded-md hover:bg-green-600 transition-colors text-sm flex items-center"
                >
                  <Download className="w-4 h-4 mr-2" />
                  Export
                </button>
              </div>
            </div>
            
            <div className="grid gap-4 md:grid-cols-5">
              <div>
                <input
                  type="text"
                  placeholder="Search changes..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                />
              </div>
              
              <select
                value={changeTypeFilter}
                onChange={(e) => setChangeTypeFilter(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              >
                <option value="">All Types</option>
                {uniqueChangeTypes.map(type => (
                  <option key={type} value={type}>{type}</option>
                ))}
              </select>
              
              <select
                value={riskLevelFilter}
                onChange={(e) => setRiskLevelFilter(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              >
                <option value="">All Risk Levels</option>
                {uniqueRiskLevels.map(level => (
                  <option key={level} value={level}>{level}</option>
                ))}
              </select>
              
              <select
                value={sectionFilter}
                onChange={(e) => setSectionFilter(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              >
                <option value="">All Sections</option>
                {uniqueSections.map(section => (
                  <option key={section} value={section}>{section}</option>
                ))}
              </select>
              
              <div className="text-sm text-gray-600 flex items-center">
                <Filter className="w-4 h-4 mr-2" />
                {filteredChanges.length} of {comparisonResult.changes.length}
              </div>
            </div>
          </div>

          {/* Changes List */}
          <div className="bg-white rounded-lg border">
            <div className="p-4 border-b">
              <h3 className="text-lg font-medium text-gray-900">Document Changes</h3>
            </div>
            
            <div className="divide-y divide-gray-200">
              {filteredChanges.map((change, index) => (
                <div key={index} className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center mb-2">
                        {getChangeIcon(change.type)}
                        <span className="ml-2 font-medium text-gray-900">{change.field}</span>
                        {change.section && (
                          <span className="ml-2 text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">
                            {change.section}
                          </span>
                        )}
                        {change.riskLevel && (
                          <span className={`ml-2 text-xs px-2 py-1 rounded ${getRiskColor(change.riskLevel)}`}>
                            {change.riskLevel.toUpperCase()}
                          </span>
                        )}
                      </div>
                      
                      {change.description && (
                        <p className="text-sm text-gray-600 mb-3">{change.description}</p>
                      )}
                      
                      <div className="grid gap-4 md:grid-cols-2">
                        {change.originalValue !== undefined && (
                          <div>
                            <div className="text-xs text-gray-500 mb-1">Original</div>
                            <div className="p-2 bg-red-50 border border-red-200 rounded text-sm font-mono">
                              {typeof change.originalValue === 'string' 
                                ? change.originalValue 
                                : JSON.stringify(change.originalValue, null, 2)}
                            </div>
                          </div>
                        )}
                        
                        {change.newValue !== undefined && (
                          <div>
                            <div className="text-xs text-gray-500 mb-1">Modified</div>
                            <div className="p-2 bg-green-50 border border-green-200 rounded text-sm font-mono">
                              {typeof change.newValue === 'string' 
                                ? change.newValue 
                                : JSON.stringify(change.newValue, null, 2)}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
              
              {filteredChanges.length === 0 && (
                <div className="p-8 text-center text-gray-500">
                  <FileText className="w-12 h-12 mx-auto mb-4 text-gray-400" />
                  <p>No changes match the current filters</p>
                </div>
              )}
            </div>
          </div>

          {/* Legal Analysis */}
          {comparisonResult.legalAnalysis && (
            <div className="bg-white rounded-lg border p-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Legal Analysis</h3>
              
              <div className="grid gap-6 md:grid-cols-3">
                <div>
                  <h4 className="font-medium text-gray-900 mb-2">Significant Changes</h4>
                  <ul className="space-y-1 text-sm text-gray-600">
                    {comparisonResult.legalAnalysis.significantChanges.map((change, index) => (
                      <li key={index} className="flex items-start">
                        <AlertTriangle className="w-4 h-4 text-orange-500 mr-2 flex-shrink-0 mt-0.5" />
                        {change}
                      </li>
                    ))}
                  </ul>
                </div>
                
                <div>
                  <h4 className="font-medium text-gray-900 mb-2">Compliance Impact</h4>
                  <ul className="space-y-1 text-sm text-gray-600">
                    {comparisonResult.legalAnalysis.complianceImpact.map((impact, index) => (
                      <li key={index} className="flex items-start">
                        <Scale className="w-4 h-4 text-blue-500 mr-2 flex-shrink-0 mt-0.5" />
                        {impact}
                      </li>
                    ))}
                  </ul>
                </div>
                
                <div>
                  <h4 className="font-medium text-gray-900 mb-2">Recommendations</h4>
                  <ul className="space-y-1 text-sm text-gray-600">
                    {comparisonResult.legalAnalysis.recommendations.map((rec, index) => (
                      <li key={index} className="flex items-start">
                        <CheckCircle className="w-4 h-4 text-green-500 mr-2 flex-shrink-0 mt-0.5" />
                        {rec}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default DocumentComparisonTool;