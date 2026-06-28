/**
 * Legal Document Dashboard Component
 * Displays and manages user's generated legal documents
 */

import React, { useState, useEffect, useCallback } from 'react';
import { FileText, Download, Eye, Edit, Trash2, Filter, Search, Calendar, AlertTriangle, CheckCircle } from 'lucide-react';
import api from '../../lib/api';

interface GeneratedDocument {
  id: string;
  document_name: string;
  document_type: string;
  status: 'draft' | 'under_review' | 'approved' | 'executed' | 'cancelled' | 'expired';
  jurisdiction: string;
  compliance_status: 'pending' | 'compliant' | 'requires_review' | 'non_compliant';
  pdf_file_path?: string;
  docx_file_path?: string;
  html_preview?: string;
  template_name: string;
  template_description: string;
  created_at: string;
  updated_at: string;
  expires_at?: string;
}

const LegalDocumentDashboard: React.FC = () => {
  const [documents, setDocuments] = useState<GeneratedDocument[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [typeFilter, setTypeFilter] = useState<string>('');
  const [complianceFilter, setComplianceFilter] = useState<string>('');
  const [jurisdictionFilter, setJurisdictionFilter] = useState<string>('');

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const ITEMS_PER_PAGE = 10;

  useEffect(() => {
    void loadDocuments();
  }, [currentPage, statusFilter, typeFilter, complianceFilter, jurisdictionFilter]);

  const loadDocuments = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams({
        limit: ITEMS_PER_PAGE.toString(),
        offset: ((currentPage - 1) * ITEMS_PER_PAGE).toString(),
        ...(statusFilter && { status: statusFilter }),
        ...(typeFilter && { document_type: typeFilter }),
        ...(jurisdictionFilter && { jurisdiction: jurisdictionFilter }),
      });

      const response = await api.get(`/api/legal/documents?${params.toString()}`);

      if (response.data?.success) {
        const newDocuments = response.data.data.documents;
        
        if (currentPage === 1) {
          setDocuments(newDocuments);
        } else {
          setDocuments(prev => [...prev, ...newDocuments]);
        }
        
        setHasMore(newDocuments.length === ITEMS_PER_PAGE);
      }
    } catch (error) {
      console.error('Error loading documents:', error);
      setError('Failed to load documents');
    } finally {
      setLoading(false);
    }
  }, [currentPage, statusFilter, typeFilter, jurisdictionFilter]);

  const filteredDocuments = documents.filter(doc => {
    if (!searchTerm) return true;
    return (
      doc.document_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      doc.template_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      doc.document_type.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }).filter(doc => {
    if (!complianceFilter) return true;
    return doc.compliance_status === complianceFilter;
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'draft': return 'bg-gray-100 text-gray-800';
      case 'under_review': return 'bg-yellow-100 text-yellow-800';
      case 'approved': return 'bg-green-100 text-green-800';
      case 'executed': return 'bg-blue-100 text-blue-800';
      case 'cancelled': return 'bg-red-100 text-red-800';
      case 'expired': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getComplianceColor = (status: string) => {
    switch (status) {
      case 'compliant': return 'bg-green-100 text-green-800';
      case 'requires_review': return 'bg-yellow-100 text-yellow-800';
      case 'non_compliant': return 'bg-red-100 text-red-800';
      case 'pending': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getComplianceIcon = (status: string) => {
    switch (status) {
      case 'compliant': return <CheckCircle className="w-4 h-4 text-green-600" />;
      case 'requires_review': return <AlertTriangle className="w-4 h-4 text-yellow-600" />;
      case 'non_compliant': return <AlertTriangle className="w-4 h-4 text-red-600" />;
      default: return <AlertTriangle className="w-4 h-4 text-gray-600" />;
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

  const resetFilters = () => {
    setSearchTerm('');
    setStatusFilter('');
    setTypeFilter('');
    setComplianceFilter('');
    setJurisdictionFilter('');
    setCurrentPage(1);
  };

  const loadMore = () => {
    setCurrentPage(prev => prev + 1);
  };

  const previewDocument = (document: GeneratedDocument) => {
    if (document.html_preview) {
      const previewWindow = window.open('', '_blank');
      if (previewWindow) {
        previewWindow.document.write(document.html_preview);
        previewWindow.document.close();
      }
    }
  };

  const downloadDocument = (document: GeneratedDocument, format: 'pdf' | 'docx') => {
    const filePath = format === 'pdf' ? document.pdf_file_path : document.docx_file_path;
    if (filePath) {
      window.open(filePath, '_blank');
    }
  };

  // Get unique values for filters
  const uniqueStatuses = [...new Set(documents.map(doc => doc.status))];
  const uniqueTypes = [...new Set(documents.map(doc => doc.document_type))];
  const uniqueJurisdictions = [...new Set(documents.map(doc => doc.jurisdiction))];
  const uniqueCompliance = [...new Set(documents.map(doc => doc.compliance_status))];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Legal Documents</h1>
          <p className="text-gray-600">Manage your generated legal documents</p>
        </div>
        
        <button
          onClick={() => window.location.href = '/legal/wizard'}
          className="bg-blue-500 text-white px-6 py-2 rounded-lg hover:bg-blue-600 transition-colors"
        >
          Create New Document
        </button>
      </div>

      {/* Search and Filters */}
      <div className="bg-white rounded-lg border p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-medium text-gray-900">Search & Filters</h2>
          <button
            onClick={resetFilters}
            className="text-blue-600 hover:text-blue-700 text-sm font-medium"
          >
            Clear All
          </button>
        </div>
        
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search documents..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          
          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All Statuses</option>
            {uniqueStatuses.map(status => (
              <option key={status} value={status}>
                {status.replace('_', ' ').toUpperCase()}
              </option>
            ))}
          </select>
          
          {/* Type Filter */}
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All Types</option>
            {uniqueTypes.map(type => (
              <option key={type} value={type}>
                {type.replace('_', ' ').toUpperCase()}
              </option>
            ))}
          </select>
          
          {/* Compliance Filter */}
          <select
            value={complianceFilter}
            onChange={(e) => setComplianceFilter(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All Compliance</option>
            {uniqueCompliance.map(compliance => (
              <option key={compliance} value={compliance}>
                {compliance.replace('_', ' ').toUpperCase()}
              </option>
            ))}
          </select>
          
          {/* Jurisdiction Filter */}
          <select
            value={jurisdictionFilter}
            onChange={(e) => setJurisdictionFilter(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All Jurisdictions</option>
            {uniqueJurisdictions.map(jurisdiction => (
              <option key={jurisdiction} value={jurisdiction}>
                {jurisdiction}
              </option>
            ))}
          </select>
          
          {/* Filter Button */}
          <button
            onClick={() => setCurrentPage(1)}
            className="bg-blue-500 text-white px-4 py-2 rounded-md hover:bg-blue-600 transition-colors flex items-center justify-center"
          >
            <Filter className="w-4 h-4 mr-2" />
            Filter
          </button>
        </div>
        
        {/* Active Filters */}
        {(searchTerm || statusFilter || typeFilter || complianceFilter || jurisdictionFilter) && (
          <div className="mt-4 flex flex-wrap gap-2">
            {searchTerm && (
              <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded-full text-sm">
                Search: {searchTerm}
              </span>
            )}
            {statusFilter && (
              <span className="bg-green-100 text-green-800 px-2 py-1 rounded-full text-sm">
                Status: {statusFilter}
              </span>
            )}
            {typeFilter && (
              <span className="bg-purple-100 text-purple-800 px-2 py-1 rounded-full text-sm">
                Type: {typeFilter}
              </span>
            )}
            {complianceFilter && (
              <span className="bg-yellow-100 text-yellow-800 px-2 py-1 rounded-full text-sm">
                Compliance: {complianceFilter}
              </span>
            )}
            {jurisdictionFilter && (
              <span className="bg-indigo-100 text-indigo-800 px-2 py-1 rounded-full text-sm">
                Jurisdiction: {jurisdictionFilter}
              </span>
            )}
          </div>
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

      {/* Documents List */}
      <div className="bg-white rounded-lg border">
        {filteredDocuments.length === 0 ? (
          <div className="p-12 text-center">
            <FileText className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No documents found</h3>
            <p className="text-gray-600 mb-6">
              {searchTerm || statusFilter || typeFilter || complianceFilter || jurisdictionFilter
                ? 'Try adjusting your search filters'
                : 'Create your first legal document using the wizard'}
            </p>
            <button
              onClick={() => window.location.href = '/legal/wizard'}
              className="bg-blue-500 text-white px-6 py-2 rounded-lg hover:bg-blue-600 transition-colors"
            >
              Create Document
            </button>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="text-left py-3 px-6 font-medium text-gray-900">Document</th>
                    <th className="text-left py-3 px-6 font-medium text-gray-900">Type</th>
                    <th className="text-left py-3 px-6 font-medium text-gray-900">Status</th>
                    <th className="text-left py-3 px-6 font-medium text-gray-900">Compliance</th>
                    <th className="text-left py-3 px-6 font-medium text-gray-900">Jurisdiction</th>
                    <th className="text-left py-3 px-6 font-medium text-gray-900">Created</th>
                    <th className="text-left py-3 px-6 font-medium text-gray-900">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {filteredDocuments.map((document) => (
                    <tr key={document.id} className="hover:bg-gray-50">
                      <td className="py-4 px-6">
                        <div className="flex items-center">
                          <FileText className="w-5 h-5 text-blue-600 mr-3 flex-shrink-0" />
                          <div>
                            <p className="font-medium text-gray-900 truncate">
                              {document.document_name}
                            </p>
                            <p className="text-sm text-gray-600 truncate">
                              {document.template_name}
                            </p>
                          </div>
                        </div>
                      </td>
                      
                      <td className="py-4 px-6">
                        <span className="text-sm text-gray-900">
                          {document.document_type.replace('_', ' ').toUpperCase()}
                        </span>
                      </td>
                      
                      <td className="py-4 px-6">
                        <span className={`inline-block px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(document.status)}`}>
                          {document.status.replace('_', ' ').toUpperCase()}
                        </span>
                      </td>
                      
                      <td className="py-4 px-6">
                        <div className="flex items-center">
                          {getComplianceIcon(document.compliance_status)}
                          <span className={`ml-2 inline-block px-2 py-1 rounded-full text-xs font-medium ${getComplianceColor(document.compliance_status)}`}>
                            {document.compliance_status.replace('_', ' ').toUpperCase()}
                          </span>
                        </div>
                      </td>
                      
                      <td className="py-4 px-6">
                        <span className="text-sm text-gray-900">{document.jurisdiction}</span>
                      </td>
                      
                      <td className="py-4 px-6">
                        <div className="flex items-center text-sm text-gray-600">
                          <Calendar className="w-4 h-4 mr-2" />
                          {formatDate(document.created_at)}
                        </div>
                      </td>
                      
                      <td className="py-4 px-6">
                        <div className="flex items-center space-x-2">
                          {document.html_preview && (
                            <button
                              onClick={() => previewDocument(document)}
                              className="text-blue-600 hover:text-blue-700 p-2 rounded-md hover:bg-blue-50 transition-colors"
                              title="Preview"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                          )}
                          
                          {document.pdf_file_path && (
                            <button
                              onClick={() => downloadDocument(document, 'pdf')}
                              className="text-red-600 hover:text-red-700 p-2 rounded-md hover:bg-red-50 transition-colors"
                              title="Download PDF"
                            >
                              <Download className="w-4 h-4" />
                            </button>
                          )}
                          
                          {document.docx_file_path && (
                            <button
                              onClick={() => downloadDocument(document, 'docx')}
                              className="text-blue-600 hover:text-blue-700 p-2 rounded-md hover:bg-blue-50 transition-colors"
                              title="Download DOCX"
                            >
                              <Download className="w-4 h-4" />
                            </button>
                          )}
                          
                          <button
                            className="text-gray-600 hover:text-gray-700 p-2 rounded-md hover:bg-gray-50 transition-colors"
                            title="Edit"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          
                          <button
                            className="text-red-600 hover:text-red-700 p-2 rounded-md hover:bg-red-50 transition-colors"
                            title="Delete"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            
            {/* Load More */}
            {hasMore && (
              <div className="p-6 border-t text-center">
                <button
                  onClick={loadMore}
                  disabled={loading}
                  className="bg-gray-100 text-gray-700 px-6 py-2 rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? 'Loading...' : 'Load More'}
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* Statistics */}
      <div className="grid gap-4 md:grid-cols-4">
        <div className="bg-white rounded-lg border p-6">
          <div className="flex items-center">
            <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
              <FileText className="w-4 h-4 text-blue-600" />
            </div>
            <div className="ml-4">
              <p className="text-2xl font-bold text-gray-900">{documents.length}</p>
              <p className="text-sm text-gray-600">Total Documents</p>
            </div>
          </div>
        </div>
        
        <div className="bg-white rounded-lg border p-6">
          <div className="flex items-center">
            <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center">
              <CheckCircle className="w-4 h-4 text-green-600" />
            </div>
            <div className="ml-4">
              <p className="text-2xl font-bold text-gray-900">
                {documents.filter(d => d.compliance_status === 'compliant').length}
              </p>
              <p className="text-sm text-gray-600">Compliant</p>
            </div>
          </div>
        </div>
        
        <div className="bg-white rounded-lg border p-6">
          <div className="flex items-center">
            <div className="w-8 h-8 bg-yellow-100 rounded-lg flex items-center justify-center">
              <AlertTriangle className="w-4 h-4 text-yellow-600" />
            </div>
            <div className="ml-4">
              <p className="text-2xl font-bold text-gray-900">
                {documents.filter(d => d.compliance_status === 'requires_review').length}
              </p>
              <p className="text-sm text-gray-600">Need Review</p>
            </div>
          </div>
        </div>
        
        <div className="bg-white rounded-lg border p-6">
          <div className="flex items-center">
            <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
              <Download className="w-4 h-4 text-blue-600" />
            </div>
            <div className="ml-4">
              <p className="text-2xl font-bold text-gray-900">
                {documents.filter(d => d.status === 'executed').length}
              </p>
              <p className="text-sm text-gray-600">Executed</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LegalDocumentDashboard;