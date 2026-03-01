import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Save, X, Upload, FileText, Video, Image as ImageIcon, Shield, WifiOff } from 'lucide-react';
import { pitchService } from '../services/pitch.service';
import { uploadService } from '../services/upload.service';
import type { Pitch, UpdatePitchInput } from '@shared/types/api';
import { getGenresSync } from '../constants/pitchConstants';
import { CharacterManagement } from '../components/CharacterManagement';
import type { Character } from '@shared/types/character';
import { normalizeCharacters, serializeCharacters } from '../utils/characterUtils';
import { DocumentUpload } from '../components/DocumentUpload';
import type { DocumentFile } from '../components/DocumentUpload';

interface PitchFormData {
  title: string;
  genre: string;
  format: string;
  formatCategory: string;
  formatSubtype: string;
  customFormat: string;
  logline: string;
  shortSynopsis: string;
  themes: string;
  worldDescription: string;
  image: File | null;
  pdf: File | null;
  video: File | null;
  documents: DocumentFile[];
  ndaConfig: {
    requireNDA: boolean;
    ndaType: 'none' | 'platform' | 'custom';
    customNDA: File | null;
  };
  characters: Character[];
}

export default function PitchEdit() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [genres] = useState<readonly string[] | string[]>(getGenresSync());
  const [existingImageUrl, setExistingImageUrl] = useState<string | null>(null);
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  // Online/offline detection
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const [formData, setFormData] = useState<PitchFormData>({
    title: '',
    genre: '',
    format: '',
    formatCategory: '',
    formatSubtype: '',
    customFormat: '',
    logline: '',
    shortSynopsis: '',
    themes: '',
    worldDescription: '',
    image: null,
    pdf: null,
    video: null,
    documents: [],
    ndaConfig: {
      requireNDA: false,
      ndaType: 'none',
      customNDA: null
    },
    characters: []
  });

  const formatCategories: Record<string, string[]> = {
    'Television - Scripted': [
      'Narrative Series (ongoing)',
      'Limited Series (closed-ended)',
      'Soap/Continuing Drama',
      'Anthology Series'
    ],
    'Television - Unscripted': [
      'Documentary One-off',
      'Documentary Series',
      'Docudrama / Hybrid',
      'Reality Series (competition, dating, makeover, Docu-reality)',
      'Game / Quiz Show',
      'Talk / Variety / Sketch Show',
      'Lifestyle / Factual Entertainment'
    ],
    'Film': [
      'Feature Narrative (live action)',
      'Feature Documentary',
      'Feature Animation',
      'Anthology / Omnibus Film',
      'Short Film / Short Documentary'
    ],
    'Animation (Series)': [
      'Kids Series',
      'Adult Series',
      'Limited Series / Specials'
    ],
    'Audio': [
      'Podcast - Drama (scripted fiction)',
      'Podcast - Documentary (non-fiction)',
      'Podcast - Hybrid / Docudrama'
    ],
    'Digital / Emerging': [
      'Web Series / Digital-first Series',
      'Interactive / Immersive (VR/AR, choose-your-own path)'
    ],
    'Stage-to-Screen': [
      'Recorded Theatre',
      'Comedy Specials',
      'Performance Hybrids'
    ],
    'Other': [
      'Custom Format (please specify)'
    ]
  };

  useEffect(() => {
    if (id) {
      fetchPitch(parseInt(id));
    }
  }, [id]);

  const fetchPitch = async (pitchId: number) => {
    try {
      // Fetch the specific pitch by ID
      const pitch = await pitchService.getById(pitchId);

      if (!pitch) {
        throw new Error('Pitch not found');
      }
      
      setExistingImageUrl(pitch.titleImage || (pitch as any).title_image || null);
      setFormData({
        title: pitch.title || '',
        genre: pitch.genre || '',
        format: pitch.format || '',
        formatCategory: pitch.formatCategory || '',
        formatSubtype: pitch.formatSubtype || '',
        customFormat: pitch.customFormat || '',
        logline: pitch.logline || '',
        shortSynopsis: pitch.shortSynopsis || '',
        themes: pitch.themes || '',
        worldDescription: pitch.worldDescription || '',
        image: null,
        pdf: null,
        video: null,
        documents: [],
        ndaConfig: {
          requireNDA: pitch.requireNDA || false,
          ndaType: pitch.requireNDA ? 'platform' : 'none',
          customNDA: null
        },
        characters: normalizeCharacters(pitch.characters)
      });
    } catch (error) {
      console.error('Failed to fetch pitch:', error);
      setError('Failed to load pitch');
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleFormatCategoryChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const category = e.target.value;
    setFormData(prev => ({
      ...prev,
      formatCategory: category,
      formatSubtype: '', // Reset subtype when category changes
      customFormat: '', // Reset custom format
      format: category // Set the main format to the category
    }));
  };

  const handleFormatSubtypeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const subtype = e.target.value;
    setFormData(prev => ({
      ...prev,
      formatSubtype: subtype,
      format: subtype === 'Custom Format (please specify)' ? 'Custom' : subtype
    }));
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, fileType: 'image' | 'pdf' | 'video') => {
    const file = e.target.files?.[0] || null;
    setFormData(prev => ({
      ...prev,
      [fileType]: file
    }));
  };

  const removeFile = (fileType: 'image' | 'pdf' | 'video') => {
    setFormData(prev => ({
      ...prev,
      [fileType]: null
    }));
  };

  const handleDocumentChange = (documents: DocumentFile[]) => {
    setFormData(prev => ({
      ...prev,
      documents
    }));
  };
  
  const handleNDAChange = (ndaType: 'none' | 'platform' | 'custom') => {
    setFormData(prev => ({
      ...prev,
      ndaConfig: {
        ...prev.ndaConfig,
        requireNDA: ndaType !== 'none',
        ndaType,
        customNDA: ndaType !== 'custom' ? null : prev.ndaConfig.customNDA
      }
    }));
  };
  
  const handleCustomNDAUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.type !== 'application/pdf') {
        alert('Custom NDA must be a PDF file.');
        return;
      }
      
      if (file.size > 10 * 1024 * 1024) {
        alert('Custom NDA must be less than 10MB.');
        return;
      }
      
      setFormData(prev => ({
        ...prev,
        ndaConfig: {
          ...prev.ndaConfig,
          customNDA: file
        }
      }));
    }
  };

  const validateForm = () => {
    const { title, genre, format, formatCategory, formatSubtype, customFormat, logline, shortSynopsis } = formData;
    const isCustomFormat = formatSubtype === 'Custom Format (please specify)';
    const isFormatValid = formatCategory && formatSubtype && (!isCustomFormat || customFormat.trim());
    return title.trim() && genre && format && isFormatValid && logline.trim() && shortSynopsis.trim();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!isOnline) {
      setError('You are offline. Please check your internet connection and try again.');
      return;
    }

    if (!validateForm()) {
      alert('Please fill in all required fields');
      return;
    }

    setIsSubmitting(true);

    try {
      const updateData: UpdatePitchInput = {
        title: formData.title,
        genre: formData.genre,
        format: formData.format,
        formatCategory: formData.formatCategory,
        formatSubtype: formData.formatSubtype,
        customFormat: formData.customFormat,
        logline: formData.logline,
        shortSynopsis: formData.shortSynopsis,
        themes: formData.themes,
        worldDescription: formData.worldDescription,
        requireNDA: formData.ndaConfig.requireNDA,
        characters: serializeCharacters(formData.characters)
      };

      // Upload image via /api/upload and set as title image
      if (formData.image) {
        const result = await uploadService.uploadDocument(formData.image, 'image', {
          pitchId: parseInt(id!),
          folder: 'pitch-images'
        });
        if (result.url) {
          updateData.titleImage = result.url;
        }
      }

      await pitchService.update(parseInt(id!), updateData);
      navigate('/creator/pitches');
    } catch (error) {
      console.error('Error updating pitch:', error);
      alert(error instanceof Error ? error.message : 'Failed to update pitch');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 to-indigo-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 to-indigo-50">
        <header className="bg-white shadow-sm border-b">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
            <div className="flex items-center gap-4">
              <button
                onClick={() => navigate('/creator/pitches')}
                className="p-2 text-gray-500 hover:text-gray-700 transition rounded-lg hover:bg-gray-100"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <h1 className="text-2xl font-bold text-gray-900">Error</h1>
            </div>
          </div>
        </header>
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12 text-center">
          <p className="text-gray-600">{error}</p>
          <button
            onClick={() => navigate('/creator/pitches')}
            className="mt-4 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition"
          >
            Back to Pitches
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-indigo-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/creator/pitches')}
              className="p-2 text-gray-500 hover:text-gray-700 transition rounded-lg hover:bg-gray-100"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Edit Pitch</h1>
              <p className="text-sm text-gray-500">Update your pitch information</p>
            </div>
          </div>
        </div>
      </header>

      {/* Form */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Offline banner */}
        {!isOnline && (
          <div className="mb-6 p-3 bg-yellow-50 border border-yellow-200 rounded-lg flex items-center gap-3">
            <WifiOff className="w-5 h-5 text-yellow-600 flex-shrink-0" />
            <div>
              <p className="text-sm font-medium text-yellow-800">You are offline</p>
              <p className="text-xs text-yellow-600">Changes cannot be saved until your connection is restored.</p>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-8">
          {/* Basic Information */}
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-6">Basic Information</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-2">
                  Title *
                </label>
                <input
                  type="text"
                  id="title"
                  name="title"
                  value={formData.title}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                  placeholder="Enter your project title"
                  required
                />
              </div>

              <div>
                <label htmlFor="genre" className="block text-sm font-medium text-gray-700 mb-2">
                  Genre *
                </label>
                <select
                  id="genre"
                  name="genre"
                  value={formData.genre}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                  required
                >
                  <option value="">Select a genre</option>
                  {genres.map(genre => (
                    <option key={genre} value={genre}>{genre}</option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="formatCategory" className="block text-sm font-medium text-gray-700 mb-2">
                  Format Category *
                </label>
                <select
                  id="formatCategory"
                  name="formatCategory"
                  value={formData.formatCategory}
                  onChange={handleFormatCategoryChange}
                  aria-required="true"
                  required
                  className="w-full px-3 py-2 border rounded-lg transition-colors border-gray-300 focus:ring-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2"
                >
                  <option value="">Select a format category</option>
                  {Object.keys(formatCategories).map(category => (
                    <option key={category} value={category}>{category}</option>
                  ))}
                </select>
              </div>

              {formData.formatCategory && (
                <div>
                  <label htmlFor="formatSubtype" className="block text-sm font-medium text-gray-700 mb-2">
                    Format Subtype *
                  </label>
                  <select
                    id="formatSubtype"
                    name="formatSubtype"
                    value={formData.formatSubtype}
                    onChange={handleFormatSubtypeChange}
                    aria-required="true"
                    required
                    className="w-full px-3 py-2 border rounded-lg transition-colors border-gray-300 focus:ring-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2"
                  >
                    <option value="">Select a format subtype</option>
                    {formatCategories[formData.formatCategory as keyof typeof formatCategories]?.map(subtype => (
                      <option key={subtype} value={subtype}>{subtype}</option>
                    ))}
                  </select>
                </div>
              )}

              {formData.formatSubtype === 'Custom Format (please specify)' && (
                <div>
                  <label htmlFor="customFormat" className="block text-sm font-medium text-gray-700 mb-2">
                    Custom Format *
                  </label>
                  <input
                    type="text"
                    id="customFormat"
                    name="customFormat"
                    value={formData.customFormat}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                    placeholder="Please specify your custom format"
                    required
                  />
                </div>
              )}
            </div>

            <div className="mt-6">
              <label htmlFor="logline" className="block text-sm font-medium text-gray-700 mb-2">
                Logline *
              </label>
              <textarea
                id="logline"
                name="logline"
                value={formData.logline}
                onChange={handleInputChange}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                placeholder="A one-sentence summary of your story (max 2-3 sentences)"
                required
              />
              <p className="text-xs text-gray-500 mt-1">
                Keep it concise and compelling - this is what hooks potential investors
              </p>
            </div>

            <div className="mt-6">
              <label htmlFor="shortSynopsis" className="block text-sm font-medium text-gray-700 mb-2">
                Short Synopsis *
              </label>
              <textarea
                id="shortSynopsis"
                name="shortSynopsis"
                value={formData.shortSynopsis}
                onChange={handleInputChange}
                rows={6}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                placeholder="Provide a brief overview of your story, main characters, and key plot points (1-2 paragraphs)"
                required
              />
              <p className="text-xs text-gray-500 mt-1">
                {formData.shortSynopsis.length}/500 characters recommended
              </p>
            </div>
          </div>

          {/* Themes & World Section */}
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-6">Themes & World Building</h2>
            
            <div className="space-y-6">
              <div>
                <label htmlFor="themes" className="block text-sm font-medium text-gray-700 mb-2">
                  Themes
                </label>
                <textarea
                  id="themes"
                  name="themes"
                  value={formData.themes}
                  onChange={handleInputChange}
                  rows={4}
                  maxLength={1000}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                  placeholder="Describe the themes explored in your story (e.g., love, betrayal, redemption, social justice, family bonds, etc.)"
                />
                <p className="text-xs text-gray-500 mt-1">
                  {formData.themes.length}/1000 characters | Recommended: 500-1000 characters
                </p>
              </div>

              <div>
                <label htmlFor="worldDescription" className="block text-sm font-medium text-gray-700 mb-2">
                  World & Setting
                </label>
                <textarea
                  id="worldDescription"
                  name="worldDescription"
                  value={formData.worldDescription}
                  onChange={handleInputChange}
                  rows={6}
                  maxLength={2000}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                  placeholder="Describe the world, setting, and environment of your story. Include time period, location, atmosphere, visual style, and any unique world-building elements..."
                />
                <p className="text-xs text-gray-500 mt-1">
                  {formData.worldDescription.length}/2000 characters | Describe the world and setting in detail
                </p>
              </div>
            </div>
          </div>

          {/* Characters Section */}
          <div className="bg-white rounded-xl shadow-sm p-6">
            <CharacterManagement
              characters={formData.characters}
              onChange={(characters) => setFormData(prev => ({ ...prev, characters }))}
              maxCharacters={10}
            />
          </div>

          {/* Document Upload Section */}
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-6">Project Documents</h2>
            
            <DocumentUpload
              documents={formData.documents}
              onChange={handleDocumentChange}
              maxFiles={15}
              maxFileSize={10}
              disabled={isSubmitting}
              showProgress={true}
              enableDragDrop={true}
              showPreview={true}
            />
            
            <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="flex items-start gap-3">
                <Shield className="w-5 h-5 text-blue-600 mt-0.5" />
                <div>
                  <h4 className="font-medium text-blue-900">Document Guidelines</h4>
                  <ul className="text-sm text-blue-800 mt-1 space-y-1">
                    <li>• Upload updated scripts, treatments, pitch decks, and supporting materials</li>
                    <li>• Each file must be under 10MB (PDF, DOC, DOCX, PPT, PPTX, TXT)</li>
                    <li>• Changes to documents will be visible to investors who have access</li>
                    <li>• Consider version control for important document updates</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>

          {/* Media Uploads */}
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-6">Media & Assets</h2>
            
            {/* Image Upload */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Cover Image
              </label>

              {/* Current/Existing Image */}
              {existingImageUrl && !formData.image && (
                <div className="mb-4">
                  <p className="text-sm text-gray-500 mb-2">Current cover image:</p>
                  <div className="relative aspect-[21/9] overflow-hidden rounded-lg bg-gray-100">
                    <img src={existingImageUrl} alt="Current cover" className="w-full h-full object-cover" />
                  </div>
                </div>
              )}

              {/* New file selected — show preview */}
              {formData.image && (
                <div className="mb-4">
                  <p className="text-sm text-gray-500 mb-2">New image selected:</p>
                  <div className="relative aspect-[21/9] overflow-hidden rounded-lg bg-gray-100">
                    <img src={URL.createObjectURL(formData.image)} alt="Preview" className="w-full h-full object-cover" />
                  </div>
                  <div className="flex items-center justify-between mt-2 bg-gray-50 rounded-lg p-3">
                    <span className="text-sm font-medium">{formData.image.name}</span>
                    <button type="button" onClick={() => removeFile('image')} className="text-red-500 hover:text-red-700">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}

              <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-purple-500 transition">
                <ImageIcon className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                <p className="text-sm text-gray-600 mb-2">
                  {existingImageUrl || formData.image ? 'Replace cover image' : 'Upload a cover image (optional)'}
                </p>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => handleFileChange(e, 'image')}
                  className="hidden"
                  id="image-upload"
                />
                <label
                  htmlFor="image-upload"
                  className="inline-flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition cursor-pointer"
                >
                  <Upload className="w-4 h-4" />
                  {existingImageUrl || formData.image ? 'Choose New Image' : 'Choose Image'}
                </label>
              </div>
            </div>

            {/* PDF Upload */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Script/Treatment (PDF)
              </label>
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-purple-500 transition">
                {formData.pdf ? (
                  <div className="flex items-center justify-between bg-gray-50 rounded-lg p-3">
                    <div className="flex items-center gap-3">
                      <FileText className="w-5 h-5 text-purple-600" />
                      <span className="text-sm font-medium">{formData.pdf.name}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeFile('pdf')}
                      className="text-red-500 hover:text-red-700"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <div>
                    <FileText className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                    <p className="text-sm text-gray-600 mb-2">Upload a new script or treatment (optional)</p>
                    <input
                      type="file"
                      accept=".pdf"
                      onChange={(e) => handleFileChange(e, 'pdf')}
                      className="hidden"
                      id="pdf-upload"
                    />
                    <label
                      htmlFor="pdf-upload"
                      className="inline-flex items-center gap-2 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition cursor-pointer"
                    >
                      <Upload className="w-4 h-4" />
                      Choose PDF
                    </label>
                  </div>
                )}
              </div>
            </div>

            {/* Video Upload */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Pitch Video (Optional)
              </label>
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-purple-500 transition">
                {formData.video ? (
                  <div className="flex items-center justify-between bg-gray-50 rounded-lg p-3">
                    <div className="flex items-center gap-3">
                      <Video className="w-5 h-5 text-purple-600" />
                      <span className="text-sm font-medium">{formData.video.name}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeFile('video')}
                      className="text-red-500 hover:text-red-700"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <div>
                    <Video className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                    <p className="text-sm text-gray-600 mb-2">Upload a new pitch video (optional)</p>
                    <input
                      type="file"
                      accept="video/*"
                      onChange={(e) => handleFileChange(e, 'video')}
                      className="hidden"
                      id="video-upload"
                    />
                    <label
                      htmlFor="video-upload"
                      className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition cursor-pointer"
                    >
                      <Upload className="w-4 h-4" />
                      Choose Video
                    </label>
                  </div>
                )}
              </div>
            </div>
          </div>
          
          {/* NDA Configuration */}
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-6">NDA Configuration</h2>
            
            <div className="space-y-4">
              <div>
                <p className="text-sm font-medium text-gray-700 mb-3">NDA Requirements</p>
                <div className="space-y-3">
                  <label className="flex items-start gap-3 cursor-pointer">
                    <input
                      type="radio"
                      name="ndaType"
                      value="none"
                      checked={formData.ndaConfig.ndaType === 'none'}
                      onChange={() => handleNDAChange('none')}
                      className="mt-1 w-4 h-4 text-purple-600"
                    />
                    <div>
                      <span className="text-sm font-medium text-gray-900">No NDA Required</span>
                      <p className="text-xs text-gray-500">All content will be publicly accessible</p>
                    </div>
                  </label>
                  
                  <label className="flex items-start gap-3 cursor-pointer">
                    <input
                      type="radio"
                      name="ndaType"
                      value="platform"
                      checked={formData.ndaConfig.ndaType === 'platform'}
                      onChange={() => handleNDAChange('platform')}
                      className="mt-1 w-4 h-4 text-purple-600"
                    />
                    <div>
                      <span className="text-sm font-medium text-gray-900">Use Platform Standard NDA</span>
                      <p className="text-xs text-gray-500">Viewers must sign our standard NDA to access detailed content</p>
                    </div>
                  </label>
                  
                  <label className="flex items-start gap-3 cursor-pointer">
                    <input
                      type="radio"
                      name="ndaType"
                      value="custom"
                      checked={formData.ndaConfig.ndaType === 'custom'}
                      onChange={() => handleNDAChange('custom')}
                      className="mt-1 w-4 h-4 text-purple-600"
                    />
                    <div>
                      <span className="text-sm font-medium text-gray-900">Use Custom NDA</span>
                      <p className="text-xs text-gray-500">Upload your own NDA document for viewers to sign</p>
                    </div>
                  </label>
                </div>
              </div>
              
              {/* Custom NDA Upload */}
              {formData.ndaConfig.ndaType === 'custom' && (
                <div className="mt-4 p-4 bg-purple-50 border border-purple-200 rounded-lg">
                  <label className="block text-sm font-medium text-purple-900 mb-2">
                    Upload Custom NDA
                  </label>
                  <input
                    type="file"
                    accept=".pdf"
                    onChange={handleCustomNDAUpload}
                    className="hidden"
                    id="custom-nda-upload"
                  />
                  
                  {formData.ndaConfig.customNDA ? (
                    <div className="flex items-center justify-between bg-white rounded-lg p-3 border">
                      <div className="flex items-center gap-3">
                        <Shield className="w-5 h-5 text-purple-600" />
                        <div>
                          <span className="text-sm font-medium">{formData.ndaConfig.customNDA.name}</span>
                          <p className="text-xs text-gray-500">
                            {(formData.ndaConfig.customNDA.size / 1024 / 1024).toFixed(2)} MB
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setFormData(prev => ({
                          ...prev,
                          ndaConfig: { ...prev.ndaConfig, customNDA: null }
                        }))}
                        className="text-red-500 hover:text-red-600"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <label
                      htmlFor="custom-nda-upload"
                      className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 cursor-pointer"
                    >
                      <Upload className="w-4 h-4" />
                      Upload NDA (PDF only)
                    </label>
                  )}
                  
                  <p className="text-xs text-purple-700 mt-2">
                    Your custom NDA will be presented to viewers before they can access detailed pitch content.
                  </p>
                </div>
              )}
              
              {/* NDA Info */}
              {formData.ndaConfig.requireNDA && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <div className="flex items-start gap-3">
                    <Shield className="w-5 h-5 text-blue-600 mt-0.5" />
                    <div>
                      <h4 className="font-medium text-blue-900">NDA Protection Active</h4>
                      <p className="text-sm text-blue-800 mt-1">
                        {formData.ndaConfig.ndaType === 'platform' 
                          ? 'Viewers will need to sign our standard NDA to access detailed content, scripts, and media files.'
                          : 'Viewers will need to sign your custom NDA to access detailed content, scripts, and media files.'
                        }
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Submit */}
          <div className="flex justify-end gap-4">
            <button
              type="button"
              onClick={() => navigate('/creator/pitches')}
              className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !validateForm()}
              className="px-6 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-lg hover:shadow-lg transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              <Save className="w-4 h-4" />
              {isSubmitting ? 'Saving Changes...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}