/**
 * Comprehensive Legal Document Library
 * Advanced document management system for storing, organizing, 
 * and retrieving completed legal documents with search and filtering
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { 
  Search, 
  Filter, 
  Archive, 
  Download, 
  Eye, 
  Edit, 
  Trash2, 
  Plus, 
  Calendar, 
  Clock, 
  FileText, 
  Folder, 
  Tag, 
  Users, 
  AlertTriangle, 
  CheckCircle, 
  Star, 
  Share2, 
  MoreVertical,
  ArrowUpDown,
  Grid,
  List,
  BookOpen,
  Shield,
  Globe,
  Scale
} from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../lib/api';

// Types
interface LegalDocument {
  id: string;
  document_name: string;
  document_type: string;
  category: string;
  status: 'draft' | 'under_review' | 'approved' | 'executed' | 'cancelled' | 'expired';
  compliance_status: 'pending' | 'compliant' | 'requires_review' | 'non_compliant';
  jurisdiction: string;
  template_name: string;
  parties: Array<{
    name: string;
    role: string;
    email?: string;
  }>;
  created_at: string;
  updated_at: string;
  executed_at?: string;
  expires_at?: string;
  generated_by: string;
  author_name: string;
  pdf_file_path?: string;
  docx_file_path?: string;
  html_preview?: string;
  file_size: number;
  tags: string[];
  is_favorite: boolean;
  access_level: 'private' | 'team' | 'organization';
  signature_status?: 'not_required' | 'pending_signatures' | 'partially_signed' | 'fully_executed';
  related_pitch_id?: string;
  related_nda_id?: string;
  related_investment_id?: string;
}

interface LibraryFilters {
  search: string;
  category: string;
  status: string;
  compliance: string;
  jurisdiction: string;
  dateRange: {
    start?: Date;
    end?: Date;
  };
  tags: string[];
  author: string;
  accessLevel: string;
}

interface LibrarySettings {
  viewMode: 'grid' | 'list';
  sortBy: 'created_at' | 'updated_at' | 'document_name' | 'status' | 'expires_at';
  sortOrder: 'asc' | 'desc';
  itemsPerPage: number;
  showPreview: boolean;
  autoRefresh: boolean;
}

const LegalLibrary: React.FC = () => {
  // State management
  const [documents, setDocuments] = useState<LegalDocument[]>([]);
  const [filteredDocuments, setFilteredDocuments] = useState<LegalDocument[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Filters and settings
  const [filters, setFilters] = useState<LibraryFilters>({
    search: '',
    category: '',
    status: '',
    compliance: '',
    jurisdiction: '',
    dateRange: {},
    tags: [],
    author: '',
    accessLevel: ''
  });
  
  const [settings, setSettings] = useState<LibrarySettings>({
    viewMode: 'list',
    sortBy: 'created_at',
    sortOrder: 'desc',
    itemsPerPage: 25,
    showPreview: false,
    autoRefresh: false
  });

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  // Selection and actions
  const [selectedDocuments, setSelectedDocuments] = useState<Set<string>>(new Set());
  const [showBulkActions, setShowBulkActions] = useState(false);
  
  // Modal states
  const [previewDocument, setPreviewDocument] = useState<LegalDocument | null>(null);
  const [showFilters, setShowFilters] = useState(false);

  // Available filter options
  const [availableCategories, setAvailableCategories] = useState<string[]>([]);
  const [availableJurisdictions, setAvailableJurisdictions] = useState<string[]>([]);
  const [availableTags, setAvailableTags] = useState<string[]>([]);
  const [availableAuthors, setAvailableAuthors] = useState<Array<{id: string; name: string}>>([]);

  // Load documents
  useEffect(() => {
    void loadDocuments();
    void loadFilterOptions();
  }, [filters, settings.sortBy, settings.sortOrder, currentPage, settings.itemsPerPage]);

  // Filter documents locally
  useEffect(() => {
    applyFilters();
  }, [documents, filters]);

  const loadDocuments = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams({
        limit: settings.itemsPerPage.toString(),
        offset: ((currentPage - 1) * settings.itemsPerPage).toString(),
        sort_by: settings.sortBy,
        sort_order: settings.sortOrder,
        ...(filters.category && { category: filters.category }),
        ...(filters.status && { status: filters.status }),
        ...(filters.compliance && { compliance_status: filters.compliance }),
        ...(filters.jurisdiction && { jurisdiction: filters.jurisdiction }),
        ...(filters.author && { author: filters.author }),
        ...(filters.accessLevel && { access_level: filters.accessLevel })
      });

      const response = await api.get(`/api/legal/library?${params.toString()}`);

      if (response.data?.success) {
        setDocuments(response.data.data.documents);
        setTotalCount(response.data.data.total);
      }
    } catch (error) {
      console.error('Error loading documents:', error);
      setError('Failed to load document library');
    } finally {
      setLoading(false);
    }
  }, [filters, settings, currentPage]);

  const loadFilterOptions = useCallback(async () => {
    try {
      const response = await api.get('/api/legal/library/filter-options');
      if (response.data?.success) {
        const { categories, jurisdictions, tags, authors } = response.data.data;
        setAvailableCategories(categories);
        setAvailableJurisdictions(jurisdictions);
        setAvailableTags(tags);
        setAvailableAuthors(authors);
      }
    } catch (error) {
      console.error('Error loading filter options:', error);
    }
  }, []);

  const applyFilters = useCallback(() => {
    let filtered = [...documents];

    // Search filter
    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      filtered = filtered.filter(doc =>
        doc.document_name.toLowerCase().includes(searchLower) ||
        doc.template_name.toLowerCase().includes(searchLower) ||
        doc.parties.some(party => party.name.toLowerCase().includes(searchLower)) ||
        doc.tags.some(tag => tag.toLowerCase().includes(searchLower))
      );
    }

    // Date range filter
    if (filters.dateRange.start || filters.dateRange.end) {
      filtered = filtered.filter(doc => {
        const docDate = new Date(doc.created_at);
        if (filters.dateRange.start && docDate < filters.dateRange.start) return false;
        if (filters.dateRange.end && docDate > filters.dateRange.end) return false;
        return true;
      });
    }

    // Tag filter
    if (filters.tags.length > 0) {
      filtered = filtered.filter(doc =>
        filters.tags.some(tag => doc.tags.includes(tag))
      );
    }

    setFilteredDocuments(filtered);
  }, [documents, filters]);

  const toggleDocumentSelection = (documentId: string) => {
    setSelectedDocuments(prev => {
      const newSelection = new Set(prev);
      if (newSelection.has(documentId)) {
        newSelection.delete(documentId);
      } else {
        newSelection.add(documentId);
      }
      setShowBulkActions(newSelection.size > 0);
      return newSelection;
    });
  };

  const selectAllDocuments = () => {
    const allIds = filteredDocuments.map(doc => doc.id);
    setSelectedDocuments(new Set(allIds));
    setShowBulkActions(true);
  };

  const clearSelection = () => {
    setSelectedDocuments(new Set());
    setShowBulkActions(false);
  };

  const downloadDocument = async (document: LegalDocument, format: 'pdf' | 'docx') => {
    try {
      const filePath = format === 'pdf' ? document.pdf_file_path : document.docx_file_path;
      if (filePath) {
        window.open(filePath, '_blank');
      } else {
        setError(`${format.toUpperCase()} file not available for this document`);
      }
    } catch (error) {
      console.error('Download error:', error);
      setError('Failed to download document');
    }
  };

  const toggleFavorite = async (documentId: string) => {
    try {
      await api.post(`/api/legal/library/${documentId}/favorite`);
      setDocuments(prev =>
        prev.map(doc =>
          doc.id === documentId ? { ...doc, is_favorite: !doc.is_favorite } : doc
        )
      );
    } catch (error) {
      console.error('Toggle favorite error:', error);
      setError('Failed to update favorite status');
    }
  };

  const archiveDocuments = async (documentIds: string[]) => {
    try {
      await api.post('/api/legal/library/bulk-archive', { document_ids: documentIds });
      setDocuments(prev => prev.filter(doc => !documentIds.includes(doc.id)));
      clearSelection();
      toast.success('Documents archived');
    } catch (error) {
      console.error('Archive error:', error);
      setError('Failed to archive documents');
      toast.error('Failed to archive documents');
    }
  };

  const exportDocuments = async (format: 'pdf' | 'zip' | 'json') => {
    try {
      const documentIds = Array.from(selectedDocuments);
      const response = await api.post('/api/legal/library/export', {
        document_ids: documentIds,
        format
      });

      if (response.data?.success) {
        window.open(response.data.data.download_url, '_blank');
        clearSelection();
      }
    } catch (error) {
      console.error('Export error:', error);
      setError('Failed to export documents');
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'draft': return <Edit className="w-4 h-4 text-gray-500" />;
      case 'under_review': return <Clock className="w-4 h-4 text-yellow-500" />;
      case 'approved': return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'executed': return <Shield className="w-4 h-4 text-blue-500" />;
      case 'cancelled': return <Trash2 className="w-4 h-4 text-red-500" />;
      case 'expired': return <AlertTriangle className="w-4 h-4 text-orange-500" />;
      default: return <FileText className="w-4 h-4 text-gray-500" />;
    }
  };

  const getComplianceIcon = (status: string) => {
    switch (status) {
      case 'compliant': return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'requires_review': return <AlertTriangle className="w-4 h-4 text-yellow-500" />;
      case 'non_compliant': return <AlertTriangle className="w-4 h-4 text-red-500" />;
      default: return <Clock className="w-4 h-4 text-gray-500" />;
    }
  };

  const formatFileSize = (bytes: number) => {
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    if (bytes === 0) return '0 Bytes';
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
  };

  const resetFilters = () => {
    setFilters({
      search: '',
      category: '',
      status: '',
      compliance: '',
      jurisdiction: '',
      dateRange: {},
      tags: [],
      author: '',
      accessLevel: ''
    });
    setCurrentPage(1);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Legal Document Library</h1>
          <p className="text-gray-600">Manage and organize your legal document collection</p>
        </div>
        
        <div className="flex space-x-3">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="bg-gray-100 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-200 transition-colors flex items-center"
          >
            <Filter className="w-4 h-4 mr-2" />
            Filters
          </button>
          
          <button
            onClick={() => window.location.href = '/legal/wizard'}
            className="bg-blue-500 text-white px-6 py-2 rounded-lg hover:bg-blue-600 transition-colors flex items-center"
          >
            <Plus className="w-4 h-4 mr-2" />
            Create Document
          </button>
        </div>
      </div>

      {/* Statistics */}
      <div className="grid gap-4 md:grid-cols-5">
        <div className="bg-white rounded-lg border p-4">
          <div className="flex items-center">
            <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
              <FileText className="w-4 h-4 text-blue-600" />
            </div>
            <div className="ml-3">
              <p className="text-2xl font-bold text-gray-900">{totalCount}</p>
              <p className="text-sm text-gray-600">Total Documents</p>
            </div>
          </div>
        </div>
        
        <div className="bg-white rounded-lg border p-4">
          <div className="flex items-center">
            <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center">
              <CheckCircle className="w-4 h-4 text-green-600" />
            </div>
            <div className="ml-3">
              <p className="text-2xl font-bold text-gray-900">
                {documents.filter(d => d.status === 'executed').length}
              </p>
              <p className="text-sm text-gray-600">Executed</p>
            </div>
          </div>
        </div>
        
        <div className="bg-white rounded-lg border p-4">
          <div className="flex items-center">
            <div className="w-8 h-8 bg-yellow-100 rounded-lg flex items-center justify-center">
              <Clock className="w-4 h-4 text-yellow-600" />
            </div>
            <div className="ml-3">
              <p className="text-2xl font-bold text-gray-900">
                {documents.filter(d => d.status === 'under_review').length}
              </p>
              <p className="text-sm text-gray-600">Under Review</p>
            </div>
          </div>
        </div>
        
        <div className="bg-white rounded-lg border p-4">
          <div className="flex items-center">
            <div className="w-8 h-8 bg-orange-100 rounded-lg flex items-center justify-center">
              <AlertTriangle className="w-4 h-4 text-orange-600" />
            </div>
            <div className="ml-3">
              <p className="text-2xl font-bold text-gray-900">
                {documents.filter(d => d.expires_at && new Date(d.expires_at) < new Date()).length}
              </p>
              <p className="text-sm text-gray-600">Expired</p>
            </div>
          </div>
        </div>
        
        <div className="bg-white rounded-lg border p-4">
          <div className="flex items-center">
            <div className="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center">
              <Star className="w-4 h-4 text-purple-600" />
            </div>
            <div className="ml-3">
              <p className="text-2xl font-bold text-gray-900">
                {documents.filter(d => d.is_favorite).length}
              </p>
              <p className="text-sm text-gray-600">Favorites</p>
            </div>
          </div>
        </div>
      </div>

      {/* Advanced Filters Panel */}
      {showFilters && (
        <div className="bg-white rounded-lg border p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-medium text-gray-900">Advanced Filters</h3>
            <button
              onClick={resetFilters}
              className="text-blue-600 hover:text-blue-700 text-sm font-medium"
            >
              Reset All
            </button>
          </div>
          
          <div className="grid gap-4 md:grid-cols-4">
            {/* Search */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Search</label>
              <div className="relative">
                <Search className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search documents..."
                  value={filters.search}
                  onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
                  className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
            
            {/* Category */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Category</label>
              <select
                value={filters.category}
                onChange={(e) => setFilters(prev => ({ ...prev, category: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All Categories</option>
                {availableCategories.map(category => (
                  <option key={category} value={category}>
                    {category.replace('_', ' ').toUpperCase()}
                  </option>
                ))}
              </select>
            </div>
            
            {/* Status */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
              <select
                value={filters.status}
                onChange={(e) => setFilters(prev => ({ ...prev, status: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All Statuses</option>
                <option value="draft">Draft</option>
                <option value="under_review">Under Review</option>
                <option value="approved">Approved</option>
                <option value="executed">Executed</option>
                <option value="cancelled">Cancelled</option>
                <option value="expired">Expired</option>
              </select>
            </div>
            
            {/* Jurisdiction */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Jurisdiction</label>
              <select
                value={filters.jurisdiction}
                onChange={(e) => setFilters(prev => ({ ...prev, jurisdiction: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All Jurisdictions</option>
                {availableJurisdictions.map(jurisdiction => (
                  <option key={jurisdiction} value={jurisdiction}>
                    {jurisdiction}
                  </option>
                ))}
              </select>
            </div>
          </div>
          
          <div className="grid gap-4 md:grid-cols-3 mt-4">
            {/* Date Range */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Date Range</label>
              <div className="flex space-x-2">
                <input
                  type="date"
                  value={filters.dateRange.start?.toISOString().split('T')[0] || ''}
                  onChange={(e) => setFilters(prev => ({
                    ...prev,
                    dateRange: { ...prev.dateRange, start: e.target.value ? new Date(e.target.value) : undefined }
                  }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <input
                  type="date"
                  value={filters.dateRange.end?.toISOString().split('T')[0] || ''}
                  onChange={(e) => setFilters(prev => ({
                    ...prev,
                    dateRange: { ...prev.dateRange, end: e.target.value ? new Date(e.target.value) : undefined }
                  }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
            
            {/* Author */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Author</label>
              <select
                value={filters.author}
                onChange={(e) => setFilters(prev => ({ ...prev, author: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All Authors</option>
                {availableAuthors.map(author => (
                  <option key={author.id} value={author.id}>
                    {author.name}
                  </option>
                ))}
              </select>
            </div>
            
            {/* Access Level */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Access Level</label>
              <select
                value={filters.accessLevel}
                onChange={(e) => setFilters(prev => ({ ...prev, accessLevel: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All Access Levels</option>
                <option value="private">Private</option>
                <option value="team">Team</option>
                <option value="organization">Organization</option>
              </select>
            </div>
          </div>
        </div>
      )}

      {/* Controls */}
      <div className="bg-white rounded-lg border p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            {/* View Mode Toggle */}
            <div className="flex bg-gray-100 rounded-lg p-1">
              <button
                onClick={() => setSettings(prev => ({ ...prev, viewMode: 'list' }))}
                className={`px-3 py-1 rounded-md text-sm transition-colors ${
                  settings.viewMode === 'list' 
                    ? 'bg-white text-gray-900 shadow-sm' 
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <List className="w-4 h-4" />
              </button>
              <button
                onClick={() => setSettings(prev => ({ ...prev, viewMode: 'grid' }))}
                className={`px-3 py-1 rounded-md text-sm transition-colors ${
                  settings.viewMode === 'grid' 
                    ? 'bg-white text-gray-900 shadow-sm' 
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <Grid className="w-4 h-4" />
              </button>
            </div>
            
            {/* Sort Controls */}
            <div className="flex items-center space-x-2">
              <select
                value={settings.sortBy}
                onChange={(e) => setSettings(prev => ({ ...prev, sortBy: e.target.value as any }))}
                className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              >
                <option value="created_at">Created Date</option>
                <option value="updated_at">Updated Date</option>
                <option value="document_name">Document Name</option>
                <option value="status">Status</option>
                <option value="expires_at">Expiry Date</option>
              </select>
              
              <button
                onClick={() => setSettings(prev => ({ ...prev, sortOrder: prev.sortOrder === 'asc' ? 'desc' : 'asc' }))}
                className="p-2 border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
              >
                <ArrowUpDown className="w-4 h-4" />
              </button>
            </div>
          </div>
          
          <div className="flex items-center space-x-3">
            {selectedDocuments.size > 0 && (
              <div className="text-sm text-gray-600">
                {selectedDocuments.size} selected
              </div>
            )}
            
            <div className="text-sm text-gray-600">
              {filteredDocuments.length} of {totalCount} documents
            </div>
          </div>
        </div>
      </div>

      {/* Bulk Actions */}
      {showBulkActions && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <span className="text-sm font-medium text-blue-900">
                {selectedDocuments.size} documents selected
              </span>
              <button
                onClick={clearSelection}
                className="text-sm text-blue-600 hover:text-blue-700"
              >
                Clear Selection
              </button>
            </div>
            
            <div className="flex items-center space-x-3">
              <button
                onClick={() => exportDocuments('pdf')}
                className="bg-red-500 text-white px-3 py-2 rounded-md hover:bg-red-600 transition-colors text-sm flex items-center"
              >
                <Download className="w-4 h-4 mr-2" />
                Export PDF
              </button>
              
              <button
                onClick={() => exportDocuments('zip')}
                className="bg-blue-500 text-white px-3 py-2 rounded-md hover:bg-blue-600 transition-colors text-sm flex items-center"
              >
                <Archive className="w-4 h-4 mr-2" />
                Export ZIP
              </button>
              
              <button
                onClick={() => archiveDocuments(Array.from(selectedDocuments))}
                className="bg-gray-500 text-white px-3 py-2 rounded-md hover:bg-gray-600 transition-colors text-sm flex items-center"
              >
                <Archive className="w-4 h-4 mr-2" />
                Archive
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center">
            <AlertTriangle className="w-5 h-5 text-red-500 mr-3" />
            <p className="text-red-700">{error}</p>
          </div>
        </div>
      )}

      {/* Documents Grid/List */}
      {settings.viewMode === 'list' ? (
        <div className="bg-white rounded-lg border">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="w-8 py-3 px-4">
                    <input
                      type="checkbox"
                      onChange={() => selectedDocuments.size === filteredDocuments.length ? clearSelection() : selectAllDocuments()}
                      checked={selectedDocuments.size === filteredDocuments.length && filteredDocuments.length > 0}
                    />
                  </th>
                  <th className="text-left py-3 px-6 font-medium text-gray-900">Document</th>
                  <th className="text-left py-3 px-6 font-medium text-gray-900">Type</th>
                  <th className="text-left py-3 px-6 font-medium text-gray-900">Status</th>
                  <th className="text-left py-3 px-6 font-medium text-gray-900">Compliance</th>
                  <th className="text-left py-3 px-6 font-medium text-gray-900">Parties</th>
                  <th className="text-left py-3 px-6 font-medium text-gray-900">Created</th>
                  <th className="text-left py-3 px-6 font-medium text-gray-900">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredDocuments.map((document) => (
                  <tr key={document.id} className="hover:bg-gray-50">
                    <td className="py-4 px-4">
                      <input
                        type="checkbox"
                        checked={selectedDocuments.has(document.id)}
                        onChange={() => toggleDocumentSelection(document.id)}
                      />
                    </td>
                    
                    <td className="py-4 px-6">
                      <div className="flex items-center">
                        <FileText className="w-5 h-5 text-blue-600 mr-3 flex-shrink-0" />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center">
                            <p className="font-medium text-gray-900 truncate">
                              {document.document_name}
                            </p>
                            {document.is_favorite && (
                              <Star className="w-4 h-4 text-yellow-500 ml-2 flex-shrink-0" />
                            )}
                          </div>
                          <p className="text-sm text-gray-600 truncate">
                            {document.template_name}
                          </p>
                          <div className="flex items-center mt-1 space-x-2">
                            <span className="text-xs text-gray-500">
                              {formatFileSize(document.file_size)}
                            </span>
                            {document.jurisdiction && (
                              <span className="text-xs text-gray-500 flex items-center">
                                <Globe className="w-3 h-3 mr-1" />
                                {document.jurisdiction}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </td>
                    
                    <td className="py-4 px-6">
                      <span className="text-sm text-gray-900">
                        {document.document_type.replace('_', ' ').toUpperCase()}
                      </span>
                    </td>
                    
                    <td className="py-4 px-6">
                      <div className="flex items-center">
                        {getStatusIcon(document.status)}
                        <span className="ml-2 text-sm text-gray-900">
                          {document.status.replace('_', ' ').toUpperCase()}
                        </span>
                      </div>
                    </td>
                    
                    <td className="py-4 px-6">
                      <div className="flex items-center">
                        {getComplianceIcon(document.compliance_status)}
                        <span className="ml-2 text-sm text-gray-900">
                          {document.compliance_status.replace('_', ' ').toUpperCase()}
                        </span>
                      </div>
                    </td>
                    
                    <td className="py-4 px-6">
                      <div className="flex items-center text-sm text-gray-600">
                        <Users className="w-4 h-4 mr-2" />
                        {document.parties.length}
                        {document.parties.length > 0 && (
                          <span className="ml-1">
                            ({document.parties[0].name}
                            {document.parties.length > 1 && ` +${document.parties.length - 1}`})
                          </span>
                        )}
                      </div>
                    </td>
                    
                    <td className="py-4 px-6">
                      <div className="flex items-center text-sm text-gray-600">
                        <Calendar className="w-4 h-4 mr-2" />
                        <div>
                          <div>{new Date(document.created_at).toLocaleDateString()}</div>
                          <div className="text-xs text-gray-500">
                            by {document.author_name}
                          </div>
                        </div>
                      </div>
                    </td>
                    
                    <td className="py-4 px-6">
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => setPreviewDocument(document)}
                          className="text-blue-600 hover:text-blue-700 p-2 rounded-md hover:bg-blue-50 transition-colors"
                          title="Preview"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        
                        {document.pdf_file_path && (
                          <button
                            onClick={() => downloadDocument(document, 'pdf')}
                            className="text-red-600 hover:text-red-700 p-2 rounded-md hover:bg-red-50 transition-colors"
                            title="Download PDF"
                          >
                            <Download className="w-4 h-4" />
                          </button>
                        )}
                        
                        <button
                          onClick={() => toggleFavorite(document.id)}
                          className={`p-2 rounded-md transition-colors ${
                            document.is_favorite
                              ? 'text-yellow-600 hover:text-yellow-700 hover:bg-yellow-50'
                              : 'text-gray-600 hover:text-gray-700 hover:bg-gray-50'
                          }`}
                          title={document.is_favorite ? "Remove from favorites" : "Add to favorites"}
                        >
                          <Star className={`w-4 h-4 ${document.is_favorite ? 'fill-current' : ''}`} />
                        </button>
                        
                        <button
                          className="text-gray-600 hover:text-gray-700 p-2 rounded-md hover:bg-gray-50 transition-colors"
                          title="More actions"
                        >
                          <MoreVertical className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          
          {filteredDocuments.length === 0 && (
            <div className="p-12 text-center">
              <BookOpen className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No documents found</h3>
              <p className="text-gray-600 mb-6">
                {filters.search || filters.category || filters.status 
                  ? 'Try adjusting your search filters'
                  : 'Create your first legal document using the wizard'
                }
              </p>
              <button
                onClick={() => window.location.href = '/legal/wizard'}
                className="bg-blue-500 text-white px-6 py-2 rounded-lg hover:bg-blue-600 transition-colors"
              >
                Create Document
              </button>
            </div>
          )}
        </div>
      ) : (
        // Grid view would go here - similar structure but in card format
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filteredDocuments.map((document) => (
            <div key={document.id} className="bg-white rounded-lg border p-4 hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center">
                  <FileText className="w-5 h-5 text-blue-600 mr-2" />
                  <span className="text-sm text-gray-500">
                    {document.document_type.replace('_', ' ').toUpperCase()}
                  </span>
                </div>
                {document.is_favorite && (
                  <Star className="w-4 h-4 text-yellow-500 fill-current" />
                )}
              </div>
              
              <h3 className="font-medium text-gray-900 mb-2 truncate" title={document.document_name}>
                {document.document_name}
              </h3>
              
              <p className="text-sm text-gray-600 mb-3 truncate">
                {document.template_name}
              </p>
              
              <div className="flex items-center justify-between text-sm text-gray-500 mb-3">
                <div className="flex items-center">
                  {getStatusIcon(document.status)}
                  <span className="ml-1">{document.status}</span>
                </div>
                <div className="flex items-center">
                  <Users className="w-4 h-4 mr-1" />
                  {document.parties.length}
                </div>
              </div>
              
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-500">
                  {new Date(document.created_at).toLocaleDateString()}
                </span>
                
                <div className="flex space-x-2">
                  <button
                    onClick={() => setPreviewDocument(document)}
                    className="text-blue-600 hover:text-blue-700"
                    title="Preview"
                  >
                    <Eye className="w-4 h-4" />
                  </button>
                  {document.pdf_file_path && (
                    <button
                      onClick={() => downloadDocument(document, 'pdf')}
                      className="text-red-600 hover:text-red-700"
                      title="Download PDF"
                    >
                      <Download className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalCount > settings.itemsPerPage && (
        <div className="bg-white rounded-lg border p-4">
          <div className="flex items-center justify-between">
            <div className="text-sm text-gray-600">
              Showing {((currentPage - 1) * settings.itemsPerPage) + 1} to {Math.min(currentPage * settings.itemsPerPage, totalCount)} of {totalCount} documents
            </div>
            
            <div className="flex space-x-2">
              <button
                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                disabled={currentPage === 1}
                className="px-3 py-2 border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Previous
              </button>
              
              <span className="px-3 py-2 text-sm text-gray-600">
                Page {currentPage} of {Math.ceil(totalCount / settings.itemsPerPage)}
              </span>
              
              <button
                onClick={() => setCurrentPage(prev => prev + 1)}
                disabled={currentPage >= Math.ceil(totalCount / settings.itemsPerPage)}
                className="px-3 py-2 border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Next
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Document Preview Modal */}
      {previewDocument && (
        <DocumentPreviewModal
          document={previewDocument}
          onClose={() => setPreviewDocument(null)}
        />
      )}
    </div>
  );
};

// Document Preview Modal Component
const DocumentPreviewModal: React.FC<{
  document: LegalDocument;
  onClose: () => void;
}> = ({ document, onClose }) => {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg w-full max-w-4xl max-h-screen overflow-hidden">
        <div className="flex items-center justify-between p-6 border-b">
          <div>
            <h3 className="text-lg font-medium text-gray-900">{document.document_name}</h3>
            <p className="text-sm text-gray-600">{document.template_name}</p>
          </div>
          
          <div className="flex items-center space-x-3">
            {document.pdf_file_path && (
              <button
                onClick={() => window.open(document.pdf_file_path, '_blank')}
                className="bg-red-500 text-white px-4 py-2 rounded-md hover:bg-red-600 transition-colors flex items-center"
              >
                <Download className="w-4 h-4 mr-2" />
                Download PDF
              </button>
            )}
            
            <button
              onClick={onClose}
              className="text-gray-600 hover:text-gray-800"
            >
              <span className="text-xl">×</span>
            </button>
          </div>
        </div>
        
        <div className="p-6 max-h-96 overflow-y-auto">
          {document.html_preview ? (
            <div
              className="prose max-w-none"
              dangerouslySetInnerHTML={{ __html: document.html_preview }}
            />
          ) : (
            <div className="text-center py-12 text-gray-500">
              <FileText className="w-12 h-12 mx-auto mb-4 text-gray-400" />
              <p>Preview not available for this document</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default LegalLibrary;