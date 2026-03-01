import { useState, useRef, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { 
  ArrowLeft, Upload, X, FileText, Video, Image as ImageIcon, 
  Film, DollarSign, Calendar, BookOpen, BarChart3, Plus, 
  Trash2, CheckCircle, AlertCircle, Loader2, Eye, EyeOff,
  ChevronRight, Save, Send, Shield
} from 'lucide-react';
import { useBetterAuthStore } from '../store/betterAuthStore';
import { usePitchStore } from '../store/pitchStore';
import { getGenresSync, getFormatsSync, getBudgetRangesSync } from '@config/pitchConstants';

interface MediaFile {
  id: string;
  type: 'lookbook' | 'script' | 'trailer' | 'pitch_deck' | 'budget_breakdown' | 'production_timeline' | 'nda' | 'other';
  file: File;
  title: string;
  description?: string;
  preview?: string;
}

interface Character {
  name: string;
  description: string;
  age?: string;
  gender?: string;
  actor?: string;
}

export default function ProductionPitchCreate() {
  const navigate = useNavigate();
  const { draftId } = useParams();
  const { user } = useBetterAuthStore();
  const { saveDraft, publishDraft, loadDraft, addPitch, currentDraft, setCurrentDraft } = usePitchStore();
  const [currentStep, setCurrentStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDraft, setIsDraft] = useState(false);
  const [saveMessage, setSaveMessage] = useState('');
  const [genres, setGenres] = useState<string[]>((getGenresSync() as string[]) || []);
  const [formats, setFormats] = useState<string[]>((getFormatsSync() as string[]) || []);
  const [budgetBrackets, setBudgetBrackets] = useState<string[]>((getBudgetRangesSync() as string[]) || []);
  
  // Form Data State
  const [formData, setFormData] = useState({
    // Basic Info
    title: '',
    genre: '',
    format: '',
    logline: '',
    
    // Synopsis
    shortSynopsis: '',
    longSynopsis: '',
    
    // Characters
    characters: [] as Character[],
    
    // Budget & Timeline
    budgetBracket: '',
    estimatedBudget: '',
    productionTimeline: '',
    targetReleaseDate: '',
    
    // Media Files
    titleImage: null as File | null,
    mediaFiles: [] as MediaFile[],
    
    // Themes & Audience
    themes: [] as string[],
    targetAudience: '',
    comparableTitles: '',
    
    // Visibility Settings
    visibilitySettings: {
      showShortSynopsis: true,
      showCharacters: false,
      showBudget: false,
      showMedia: false,
    },
    
    // NDA Configuration
    ndaConfig: {
      requireNDA: false,
      ndaType: 'none' as 'none' | 'platform' | 'custom',
      customNDA: null as File | null
    }
  });

  const [newCharacter, setNewCharacter] = useState<Character>({
    name: '', description: '', age: '', gender: '', actor: ''
  });
  const [newTheme, setNewTheme] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pitchId, setPitchId] = useState<number | null>(null);

  // Load configuration from API on component mount
  useEffect(() => {
    const loadConfig = async () => {
      try {
        const { getGenres, getFormats, getBudgetRanges } = await import('@config/pitchConstants');
        const [genresData, formatsData, budgetRangesData] = await Promise.all([
          getGenres(),
          getFormats(),
          getBudgetRanges()
        ]);
        setGenres(genresData);
        setFormats(formatsData);
        setBudgetBrackets(budgetRangesData);
      } catch (err) {
        console.warn('Failed to load configuration, using fallback:', err);
        // Already using sync fallback values
      }
    };
    loadConfig();
  }, []);

  // Load draft if editing
  useEffect(() => {
    if (draftId) {
      const draft = loadDraft(parseInt(draftId));
      if (draft) {
        setFormData({
          title: draft.title || '',
          genre: draft.genre || '',
          format: draft.format || '',
          logline: draft.logline || '',
          shortSynopsis: draft.shortSynopsis || '',
          longSynopsis: draft.longSynopsis || '',
          characters: draft.characters || [],
          budgetBracket: draft.budget || '',
          estimatedBudget: draft.estimatedBudget?.toString() || '',
          productionTimeline: draft.productionTimeline || '',
          targetReleaseDate: draft.targetReleaseDate || '',
          titleImage: null,
          mediaFiles: [],
          themes: draft.themes || [],
          targetAudience: draft.targetAudience || '',
          comparableTitles: draft.comparableTitles || '',
          visibilitySettings: draft.visibilitySettings || {
            showShortSynopsis: true,
            showCharacters: false,
            showBudget: false,
            showMedia: false,
          },
          ndaConfig: (draft as any).ndaConfig || {
            requireNDA: false,
            ndaType: 'none',
            customNDA: null
          }
        });
        setPitchId(draft.id || null);
      }
    } else if (currentDraft) {
      // Load auto-saved draft
      setFormData({
        title: currentDraft.title || '',
        genre: currentDraft.genre || '',
        format: currentDraft.format || '',
        logline: currentDraft.logline || '',
        shortSynopsis: currentDraft.shortSynopsis || '',
        longSynopsis: currentDraft.longSynopsis || '',
        characters: currentDraft.characters || [],
        budgetBracket: currentDraft.budget || '',
        estimatedBudget: currentDraft.estimatedBudget?.toString() || '',
        productionTimeline: currentDraft.productionTimeline || '',
        targetReleaseDate: currentDraft.targetReleaseDate || '',
        titleImage: null,
        mediaFiles: [],
        themes: currentDraft.themes || [],
        targetAudience: currentDraft.targetAudience || '',
        comparableTitles: currentDraft.comparableTitles || '',
        visibilitySettings: currentDraft.visibilitySettings || {
          showShortSynopsis: true,
          showCharacters: false,
          showBudget: false,
          showMedia: false,
        },
        ndaConfig: (currentDraft as any).ndaConfig || {
          requireNDA: false,
          ndaType: 'none',
          customNDA: null
        }
      });
      setPitchId(currentDraft.id || null);
    }
  }, [draftId, currentDraft, loadDraft]);
  
  // File Input Refs
  const titleImageRef = useRef<HTMLInputElement>(null);
  const mediaFileRef = useRef<HTMLInputElement>(null);
  const customNDARef = useRef<HTMLInputElement>(null);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    // Clear error when user starts typing
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  const handleVisibilityChange = (setting: keyof typeof formData.visibilitySettings) => {
    setFormData(prev => ({
      ...prev,
      visibilitySettings: {
        ...prev.visibilitySettings,
        [setting]: !prev.visibilitySettings[setting]
      }
    }));
  };

  const handleTitleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.type.startsWith('image/')) {
      setFormData(prev => ({ ...prev, titleImage: file }));
    }
  };

  const handleMediaFileAdd = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const newMediaFiles: MediaFile[] = files.map(file => ({
      id: crypto.randomUUID(),
      type: detectFileType(file),
      file,
      title: file.name.split('.')[0],
      description: '',
      preview: file.type.startsWith('image/') ? URL.createObjectURL(file) : undefined
    }));
    
    setFormData(prev => ({
      ...prev,
      mediaFiles: [...prev.mediaFiles, ...newMediaFiles]
    }));
  };

  const detectFileType = (file: File): MediaFile['type'] => {
    const name = file.name.toLowerCase();
    if (name.includes('lookbook')) return 'lookbook';
    if (name.includes('script')) return 'script';
    if (name.includes('budget')) return 'budget_breakdown';
    if (name.includes('timeline')) return 'production_timeline';
    if (name.includes('deck') || name.includes('presentation')) return 'pitch_deck';
    if (name.includes('nda') || name.includes('agreement')) return 'nda';
    if (file.type.startsWith('video/')) return 'trailer';
    return 'other';
  };

  const updateMediaFile = (id: string, updates: Partial<MediaFile>) => {
    setFormData(prev => ({
      ...prev,
      mediaFiles: prev.mediaFiles.map(file =>
        file.id === id ? { ...file, ...updates } : file
      )
    }));
  };

  const removeMediaFile = (id: string) => {
    setFormData(prev => ({
      ...prev,
      mediaFiles: prev.mediaFiles.filter(file => file.id !== id)
    }));
  };

  const addCharacter = () => {
    if (newCharacter.name && newCharacter.description) {
      setFormData(prev => ({
        ...prev,
        characters: [...prev.characters, newCharacter]
      }));
      setNewCharacter({ name: '', description: '', age: '', gender: '', actor: '' });
    }
  };

  const removeCharacter = (index: number) => {
    setFormData(prev => ({
      ...prev,
      characters: prev.characters.filter((_, i) => i !== index)
    }));
  };

  const addTheme = () => {
    if (newTheme && !formData.themes.includes(newTheme)) {
      setFormData(prev => ({
        ...prev,
        themes: [...prev.themes, newTheme]
      }));
      setNewTheme('');
    }
  };

  const removeTheme = (theme: string) => {
    setFormData(prev => ({
      ...prev,
      themes: prev.themes.filter(t => t !== theme)
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

  const validateStep = (step: number): boolean => {
    const newErrors: Record<string, string> = {};
    
    switch (step) {
      case 1:
        if (!formData.title) newErrors.title = 'Title is required';
        if (!formData.genre) newErrors.genre = 'Genre is required';
        if (!formData.format) newErrors.format = 'Format is required';
        if (!formData.logline) newErrors.logline = 'Logline is required';
        break;
      case 2:
        if (!formData.shortSynopsis) newErrors.shortSynopsis = 'Short synopsis is required';
        break;
      case 3:
        if (!formData.budgetBracket) newErrors.budgetBracket = 'Budget bracket is required';
        break;
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleNextStep = () => {
    if (validateStep(currentStep)) {
      setCurrentStep(prev => Math.min(prev + 1, 5));
    }
  };

  const handlePrevStep = () => {
    setCurrentStep(prev => Math.max(prev - 1, 1));
  };

  const handleSaveDraft = () => {
    // Prepare pitch data
    const pitchData = {
      id: pitchId || Date.now(),
      title: formData.title || 'Untitled Pitch',
      genre: formData.genre,
      format: formData.format,
      logline: formData.logline,
      shortSynopsis: formData.shortSynopsis,
      longSynopsis: formData.longSynopsis,
      characters: formData.characters,
      budget: formData.budgetBracket,
      estimatedBudget: formData.estimatedBudget ? parseFloat(formData.estimatedBudget) : undefined,
      productionTimeline: formData.productionTimeline,
      targetReleaseDate: formData.targetReleaseDate,
      themes: formData.themes,
      targetAudience: formData.targetAudience,
      comparableTitles: formData.comparableTitles,
      visibilitySettings: formData.visibilitySettings,
      status: 'draft' as const,
      mediaFiles: formData.mediaFiles.map(m => ({
        type: m.type,
        count: 1,
        uploaded: true
      }))
    };

    // Save to store
    saveDraft(pitchData);
    
    // Show success message
    setSaveMessage('Draft saved successfully!');
    setTimeout(() => setSaveMessage(''), 3000);
    
    // Update pitchId if new
    if (!pitchId) {
      setPitchId(pitchData.id);
    }
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    
    if (!validateStep(5)) {
      setCurrentStep(1);
      return;
    }

    setIsSubmitting(true);

    try {
      // Prepare pitch data
      const pitchData = {
        id: pitchId || Date.now(),
        title: formData.title,
        genre: formData.genre.toLowerCase(),
        format: formData.format.toLowerCase().replace(' ', '_'),
        logline: formData.logline,
        shortSynopsis: formData.shortSynopsis,
        longSynopsis: formData.longSynopsis,
        characters: formData.characters,
        budget: formData.budgetBracket,
        estimatedBudget: formData.estimatedBudget ? parseFloat(formData.estimatedBudget) : undefined,
        productionTimeline: formData.productionTimeline,
        targetReleaseDate: formData.targetReleaseDate,
        themes: formData.themes,
        targetAudience: formData.targetAudience,
        comparableTitles: formData.comparableTitles,
        visibilitySettings: formData.visibilitySettings,
        status: 'published' as const,
        viewCount: 0,
        likeCount: 0,
        ndaCount: 0,
        followersCount: 0,
        createdAt: new Date().toISOString(),
        publishedAt: new Date().toISOString(),
        mediaFiles: formData.mediaFiles.map(m => ({
          type: m.type,
          count: 1,
          uploaded: true
        }))
      };

      // Add to store
      addPitch(pitchData);
      
      // Clear current draft if exists
      setCurrentDraft(null);
      
      // Navigate to dashboard
      navigate('/production/dashboard');
    } catch (error) {
      console.error('Error creating pitch:', error);
      alert('Failed to create pitch. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const getStepTitle = (step: number) => {
    switch (step) {
      case 1: return 'Basic Information';
      case 2: return 'Synopsis & Story';
      case 3: return 'Budget & Timeline';
      case 4: return 'Media & Documents';
      case 5: return 'Review & Visibility';
      default: return '';
    }
  };

  const getFileIcon = (type: MediaFile['type']) => {
    switch (type) {
      case 'lookbook': return BookOpen;
      case 'script': return FileText;
      case 'trailer': return Video;
      case 'pitch_deck': return BarChart3;
      case 'budget_breakdown': return DollarSign;
      case 'production_timeline': return Calendar;
      case 'nda': return Shield;
      default: return FileText;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={() => navigate('/production/dashboard')}
                className="p-2 hover:bg-gray-100 rounded-lg"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Create Production Pitch</h1>
                <p className="text-sm text-gray-600">Upload comprehensive pitch materials</p>
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              {saveMessage && (
                <span className="text-sm text-green-600 flex items-center gap-1">
                  <CheckCircle className="w-4 h-4" />
                  {saveMessage}
                </span>
              )}
              <button
                onClick={handleSaveDraft}
                disabled={isSubmitting}
                className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                <Save className="w-4 h-4" />
                Save Draft
              </button>
              {currentStep === 5 && (
                <button
                  onClick={handleSubmit}
                  disabled={isSubmitting}
                  className="flex items-center gap-2 px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Publishing...
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4" />
                      Publish Pitch
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Progress Bar */}
      <div className="bg-white border-b">
        <div className="max-w-6xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            {[1, 2, 3, 4, 5].map((step) => (
              <div key={step} className="flex-1 flex items-center">
                <button
                  onClick={() => step < currentStep && setCurrentStep(step)}
                  disabled={step > currentStep}
                  className={`flex items-center gap-2 ${
                    step === currentStep ? 'text-purple-600 font-medium' :
                    step < currentStep ? 'text-gray-900' : 'text-gray-400'
                  }`}
                >
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 ${
                    step === currentStep ? 'border-purple-600 bg-purple-50' :
                    step < currentStep ? 'border-green-500 bg-green-50' : 'border-gray-300'
                  }`}>
                    {step < currentStep ? (
                      <CheckCircle className="w-5 h-5 text-green-500" />
                    ) : (
                      <span>{step}</span>
                    )}
                  </div>
                  <span className="hidden md:inline">{getStepTitle(step)}</span>
                </button>
                {step < 5 && (
                  <div className={`flex-1 h-0.5 mx-2 ${
                    step < currentStep ? 'bg-green-500' : 'bg-gray-300'
                  }`} />
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Form Content */}
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="bg-white rounded-xl shadow-sm p-8">
          {/* Step 1: Basic Information */}
          {currentStep === 1 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-xl font-semibold mb-4">Basic Information</h2>
                <p className="text-gray-600 mb-6">Start with the essential details of your production</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Project Title *
                </label>
                <input
                  type="text"
                  name="title"
                  value={formData.title}
                  onChange={handleInputChange}
                  placeholder="Enter your project title"
                  className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500 ${
                    errors.title ? 'border-red-500' : 'border-gray-300'
                  }`}
                />
                {errors.title && (
                  <p className="mt-1 text-sm text-red-500">{errors.title}</p>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Genre *
                  </label>
                  <select
                    name="genre"
                    value={formData.genre}
                    onChange={handleInputChange}
                    className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500 ${
                      errors.genre ? 'border-red-500' : 'border-gray-300'
                    }`}
                  >
                    <option value="">Select Genre</option>
                    {genres && genres.length > 0 ? genres.map(genre => (
                      <option key={genre} value={genre.toLowerCase()}>{genre}</option>
                    )) : (
                      <option value="" disabled>Loading genres...</option>
                    )}
                  </select>
                  {errors.genre && (
                    <p className="mt-1 text-sm text-red-500">{errors.genre}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Format *
                  </label>
                  <select
                    name="format"
                    value={formData.format}
                    onChange={handleInputChange}
                    className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500 ${
                      errors.format ? 'border-red-500' : 'border-gray-300'
                    }`}
                  >
                    <option value="">Select Format</option>
                    {formats && formats.length > 0 ? formats.map(format => (
                      <option key={format} value={format.toLowerCase().replace(' ', '_')}>{format}</option>
                    )) : (
                      <option value="" disabled>Loading formats...</option>
                    )}
                  </select>
                  {errors.format && (
                    <p className="mt-1 text-sm text-red-500">{errors.format}</p>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Logline *
                </label>
                <textarea
                  name="logline"
                  value={formData.logline}
                  onChange={handleInputChange}
                  placeholder="A compelling one-sentence description of your project"
                  rows={2}
                  className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500 ${
                    errors.logline ? 'border-red-500' : 'border-gray-300'
                  }`}
                />
                {errors.logline && (
                  <p className="mt-1 text-sm text-red-500">{errors.logline}</p>
                )}
              </div>

              {/* Title Image */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Title Image
                </label>
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
                  <input
                    ref={titleImageRef}
                    type="file"
                    accept="image/*"
                    onChange={handleTitleImageChange}
                    className="hidden"
                  />
                  {formData.titleImage ? (
                    <div className="relative inline-block">
                      <img
                        src={URL.createObjectURL(formData.titleImage)}
                        alt="Title"
                        className="max-h-48 rounded-lg"
                      />
                      <button
                        onClick={() => setFormData(prev => ({ ...prev, titleImage: null }))}
                        className="absolute -top-2 -right-2 p-1 bg-red-500 text-white rounded-full hover:bg-red-600"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => titleImageRef.current?.click()}
                      className="inline-flex items-center gap-2 px-4 py-2 bg-purple-100 text-purple-700 rounded-lg hover:bg-purple-200"
                    >
                      <ImageIcon className="w-5 h-5" />
                      Upload Title Image
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Step 2: Synopsis & Story */}
          {currentStep === 2 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-xl font-semibold mb-4">Synopsis & Story</h2>
                <p className="text-gray-600 mb-6">Provide detailed information about your story</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Short Synopsis *
                </label>
                <textarea
                  name="shortSynopsis"
                  value={formData.shortSynopsis}
                  onChange={handleInputChange}
                  placeholder="A brief overview of your story (200-300 words)"
                  rows={4}
                  className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500 ${
                    errors.shortSynopsis ? 'border-red-500' : 'border-gray-300'
                  }`}
                />
                {errors.shortSynopsis && (
                  <p className="mt-1 text-sm text-red-500">{errors.shortSynopsis}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Long Synopsis
                </label>
                <textarea
                  name="longSynopsis"
                  value={formData.longSynopsis}
                  onChange={handleInputChange}
                  placeholder="A detailed synopsis of your story"
                  rows={8}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                />
              </div>

              {/* Characters */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Main Characters
                </label>
                <div className="space-y-4">
                  {formData.characters.map((character, index) => (
                    <div key={index} className="p-4 bg-gray-50 rounded-lg">
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <h4 className="font-medium">{character.name}</h4>
                          {character.actor && (
                            <p className="text-sm text-gray-600">Actor: {character.actor}</p>
                          )}
                        </div>
                        <button
                          onClick={() => removeCharacter(index)}
                          className="text-red-500 hover:text-red-600"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                      <p className="text-sm text-gray-700">{character.description}</p>
                      {(character.age || character.gender) && (
                        <p className="text-sm text-gray-500 mt-1">
                          {character.age && `Age: ${character.age}`}
                          {character.age && character.gender && ' • '}
                          {character.gender && `Gender: ${character.gender}`}
                        </p>
                      )}
                    </div>
                  ))}
                  
                  <div className="border-2 border-dashed border-gray-300 rounded-lg p-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <input
                        type="text"
                        value={newCharacter.name}
                        onChange={e => setNewCharacter(prev => ({ ...prev, name: e.target.value }))}
                        placeholder="Character Name"
                        className="px-3 py-2 border border-gray-300 rounded-lg"
                      />
                      <input
                        type="text"
                        value={newCharacter.actor}
                        onChange={e => setNewCharacter(prev => ({ ...prev, actor: e.target.value }))}
                        placeholder="Actor (optional)"
                        className="px-3 py-2 border border-gray-300 rounded-lg"
                      />
                    </div>
                    <textarea
                      value={newCharacter.description}
                      onChange={e => setNewCharacter(prev => ({ ...prev, description: e.target.value }))}
                      placeholder="Character Description"
                      rows={2}
                      className="w-full mt-4 px-3 py-2 border border-gray-300 rounded-lg"
                    />
                    <div className="flex gap-4 mt-4">
                      <input
                        type="text"
                        value={newCharacter.age}
                        onChange={e => setNewCharacter(prev => ({ ...prev, age: e.target.value }))}
                        placeholder="Age (optional)"
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-lg"
                      />
                      <input
                        type="text"
                        value={newCharacter.gender}
                        onChange={e => setNewCharacter(prev => ({ ...prev, gender: e.target.value }))}
                        placeholder="Gender (optional)"
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-lg"
                      />
                      <button
                        onClick={addCharacter}
                        disabled={!newCharacter.name || !newCharacter.description}
                        className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <Plus className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Themes */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Themes
                </label>
                <div className="flex flex-wrap gap-2 mb-3">
                  {formData.themes.map(theme => (
                    <span
                      key={theme}
                      className="inline-flex items-center gap-1 px-3 py-1 bg-purple-100 text-purple-700 rounded-full text-sm"
                    >
                      {theme}
                      <button
                        onClick={() => removeTheme(theme)}
                        className="hover:text-purple-900"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newTheme}
                    onChange={e => setNewTheme(e.target.value)}
                    onKeyPress={e => e.key === 'Enter' && (e.preventDefault(), addTheme())}
                    placeholder="Add a theme"
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg"
                  />
                  <button
                    onClick={addTheme}
                    disabled={!newTheme}
                    className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50"
                  >
                    Add
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Target Audience
                </label>
                <textarea
                  name="targetAudience"
                  value={formData.targetAudience}
                  onChange={handleInputChange}
                  placeholder="Describe your target demographic and audience"
                  rows={3}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Comparable Titles
                </label>
                <textarea
                  name="comparableTitles"
                  value={formData.comparableTitles}
                  onChange={handleInputChange}
                  placeholder="List similar successful projects and their performance"
                  rows={3}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                />
              </div>
            </div>
          )}

          {/* Step 3: Budget & Timeline */}
          {currentStep === 3 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-xl font-semibold mb-4">Budget & Timeline</h2>
                <p className="text-gray-600 mb-6">Provide financial and scheduling information</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Budget Bracket *
                  </label>
                  <select
                    name="budgetBracket"
                    value={formData.budgetBracket}
                    onChange={handleInputChange}
                    className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500 ${
                      errors.budgetBracket ? 'border-red-500' : 'border-gray-300'
                    }`}
                  >
                    <option value="">Select Budget Range</option>
                    {budgetBrackets && budgetBrackets.length > 0 ? budgetBrackets.map(bracket => (
                      <option key={bracket} value={bracket}>{bracket}</option>
                    )) : (
                      <option value="" disabled>Loading budget ranges...</option>
                    )}
                  </select>
                  {errors.budgetBracket && (
                    <p className="mt-1 text-sm text-red-500">{errors.budgetBracket}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Estimated Budget
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-2.5 text-gray-500">$</span>
                    <input
                      type="text"
                      name="estimatedBudget"
                      value={formData.estimatedBudget}
                      onChange={handleInputChange}
                      placeholder="15,000,000"
                      className="w-full pl-8 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Production Timeline
                </label>
                <textarea
                  name="productionTimeline"
                  value={formData.productionTimeline}
                  onChange={handleInputChange}
                  placeholder="Describe your production schedule and key milestones"
                  rows={4}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Target Release Date
                </label>
                <input
                  type="date"
                  name="targetReleaseDate"
                  value={formData.targetReleaseDate}
                  onChange={handleInputChange}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                />
              </div>

              <div className="bg-purple-50 border border-purple-200 rounded-lg p-6">
                <h3 className="font-semibold text-purple-900 mb-3">Financial Information</h3>
                <div className="space-y-4 text-sm">
                  <div>
                    <label className="text-purple-700">Financing Status</label>
                    <p className="text-gray-600 mt-1">Describe current financing and what you're seeking</p>
                    <textarea
                      placeholder="e.g., 40% secured from private investors, seeking $9M to complete financing"
                      rows={2}
                      className="w-full mt-2 px-3 py-2 border border-purple-200 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="text-purple-700">ROI Projections</label>
                    <p className="text-gray-600 mt-1">Expected returns and box office projections</p>
                    <textarea
                      placeholder="Based on comparable titles and market analysis..."
                      rows={2}
                      className="w-full mt-2 px-3 py-2 border border-purple-200 rounded-lg"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Step 4: Media & Documents */}
          {currentStep === 4 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-xl font-semibold mb-4">Media & Documents</h2>
                <p className="text-gray-600 mb-6">Upload all supporting materials for your pitch</p>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
                <div className="flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-blue-600 mt-0.5" />
                  <div>
                    <h3 className="font-semibold text-blue-900">Enhanced Media for Production Companies</h3>
                    <p className="text-sm text-blue-800 mt-1">
                      As a production company, you can upload comprehensive materials including lookbooks, 
                      scripts, trailers, pitch decks, budget breakdowns, and production timelines.
                    </p>
                  </div>
                </div>
              </div>

              {/* Media Files */}
              <div>
                <div className="flex items-center justify-between mb-4">
                  <label className="block text-sm font-medium text-gray-700">
                    Media Files ({formData.mediaFiles.length})
                  </label>
                  <input
                    ref={mediaFileRef}
                    type="file"
                    multiple
                    accept=".pdf,.doc,.docx,.ppt,.pptx,.mp4,.mov,.avi,.jpg,.jpeg,.png"
                    onChange={handleMediaFileAdd}
                    className="hidden"
                  />
                  <button
                    onClick={() => mediaFileRef.current?.click()}
                    className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
                  >
                    <Upload className="w-4 h-4" />
                    Add Files
                  </button>
                </div>

                {formData.mediaFiles.length > 0 ? (
                  <div className="space-y-3">
                    {formData.mediaFiles.map(media => {
                      const Icon = getFileIcon(media.type);
                      return (
                        <div key={media.id} className="p-4 bg-gray-50 rounded-lg">
                          <div className="flex items-start gap-4">
                            <div className={`p-3 rounded-lg ${
                              media.type === 'script' ? 'bg-blue-100 text-blue-600' :
                              media.type === 'lookbook' ? 'bg-green-100 text-green-600' :
                              media.type === 'trailer' ? 'bg-red-100 text-red-600' :
                              media.type === 'pitch_deck' ? 'bg-purple-100 text-purple-600' :
                              media.type === 'budget_breakdown' ? 'bg-yellow-100 text-yellow-600' :
                              media.type === 'production_timeline' ? 'bg-indigo-100 text-indigo-600' :
                              'bg-gray-100 text-gray-600'
                            }`}>
                              <Icon className="w-5 h-5" />
                            </div>
                            <div className="flex-1">
                              <input
                                type="text"
                                value={media.title}
                                onChange={e => updateMediaFile(media.id, { title: e.target.value })}
                                placeholder="File Title"
                                className="w-full mb-2 px-3 py-1 border border-gray-300 rounded"
                              />
                              <select
                                value={media.type}
                                onChange={e => updateMediaFile(media.id, { type: e.target.value as MediaFile['type'] })}
                                className="mb-2 px-3 py-1 border border-gray-300 rounded text-sm"
                              >
                                <option value="lookbook">Lookbook</option>
                                <option value="script">Script</option>
                                <option value="trailer">Trailer</option>
                                <option value="pitch_deck">Pitch Deck</option>
                                <option value="budget_breakdown">Budget Breakdown</option>
                                <option value="production_timeline">Production Timeline</option>
                                <option value="nda">NDA</option>
                                <option value="other">Other</option>
                              </select>
                              <textarea
                                value={media.description}
                                onChange={e => updateMediaFile(media.id, { description: e.target.value })}
                                placeholder="Brief description (optional)"
                                rows={2}
                                className="w-full px-3 py-1 border border-gray-300 rounded text-sm"
                              />
                              <p className="text-xs text-gray-500 mt-1">
                                {media.file.name} • {(media.file.size / 1024 / 1024).toFixed(2)} MB
                              </p>
                            </div>
                            <button
                              onClick={() => removeMediaFile(media.id)}
                              className="text-red-500 hover:text-red-600"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
                    <Upload className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                    <p className="text-gray-600 mb-2">No files uploaded yet</p>
                    <p className="text-sm text-gray-500">
                      Upload scripts, lookbooks, pitch decks, trailers, and more
                    </p>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                <div className="p-4 bg-gray-50 rounded-lg">
                  <BookOpen className="w-5 h-5 text-green-600 mb-2" />
                  <h4 className="font-medium">Lookbooks</h4>
                  <p className="text-gray-600 text-xs mt-1">Visual style guides</p>
                </div>
                <div className="p-4 bg-gray-50 rounded-lg">
                  <FileText className="w-5 h-5 text-blue-600 mb-2" />
                  <h4 className="font-medium">Scripts</h4>
                  <p className="text-gray-600 text-xs mt-1">Full or sample scripts</p>
                </div>
                <div className="p-4 bg-gray-50 rounded-lg">
                  <Video className="w-5 h-5 text-red-600 mb-2" />
                  <h4 className="font-medium">Trailers</h4>
                  <p className="text-gray-600 text-xs mt-1">Video previews</p>
                </div>
                <div className="p-4 bg-gray-50 rounded-lg">
                  <BarChart3 className="w-5 h-5 text-purple-600 mb-2" />
                  <h4 className="font-medium">Pitch Decks</h4>
                  <p className="text-gray-600 text-xs mt-1">Presentation materials</p>
                </div>
                <div className="p-4 bg-gray-50 rounded-lg">
                  <DollarSign className="w-5 h-5 text-yellow-600 mb-2" />
                  <h4 className="font-medium">Budget Breakdown</h4>
                  <p className="text-gray-600 text-xs mt-1">Detailed financials</p>
                </div>
                <div className="p-4 bg-gray-50 rounded-lg">
                  <Calendar className="w-5 h-5 text-indigo-600 mb-2" />
                  <h4 className="font-medium">Timeline</h4>
                  <p className="text-gray-600 text-xs mt-1">Production schedule</p>
                </div>
              </div>
            </div>
          )}

          {/* Step 5: Review & Visibility */}
          {currentStep === 5 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-xl font-semibold mb-4">Review & Visibility Settings</h2>
                <p className="text-gray-600 mb-6">Control what information is visible before NDA</p>
              </div>

              {/* Summary */}
              <div className="bg-gray-50 rounded-lg p-6">
                <h3 className="font-semibold mb-4">Pitch Summary</h3>
                <dl className="space-y-3 text-sm">
                  <div className="flex justify-between">
                    <dt className="text-gray-600">Title:</dt>
                    <dd className="font-medium">{formData.title || 'Not set'}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-gray-600">Genre:</dt>
                    <dd className="font-medium">{formData.genre || 'Not set'}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-gray-600">Format:</dt>
                    <dd className="font-medium">{formData.format || 'Not set'}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-gray-600">Budget:</dt>
                    <dd className="font-medium">{formData.budgetBracket || 'Not set'}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-gray-600">Characters:</dt>
                    <dd className="font-medium">{formData.characters.length} added</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-gray-600">Media Files:</dt>
                    <dd className="font-medium">{formData.mediaFiles.length} uploaded</dd>
                  </div>
                </dl>
              </div>

              {/* Visibility Settings */}
              <div>
                <h3 className="font-semibold mb-4">Public Visibility Settings</h3>
                <p className="text-sm text-gray-600 mb-4">
                  Choose what information is visible to users who haven't signed an NDA
                </p>
                <div className="space-y-3">
                  <label className="flex items-center justify-between p-4 bg-white border rounded-lg cursor-pointer hover:bg-gray-50">
                    <div className="flex items-center gap-3">
                      <Eye className={formData.visibilitySettings.showShortSynopsis ? 'w-5 h-5 text-green-600' : 'w-5 h-5 text-gray-400'} />
                      <div>
                        <p className="font-medium">Short Synopsis</p>
                        <p className="text-sm text-gray-600">Display the brief overview publicly</p>
                      </div>
                    </div>
                    <input
                      type="checkbox"
                      checked={formData.visibilitySettings.showShortSynopsis}
                      onChange={() => handleVisibilityChange('showShortSynopsis')}
                      className="w-5 h-5 text-purple-600 rounded"
                    />
                  </label>

                  <label className="flex items-center justify-between p-4 bg-white border rounded-lg cursor-pointer hover:bg-gray-50">
                    <div className="flex items-center gap-3">
                      {formData.visibilitySettings.showCharacters ? (
                        <Eye className="w-5 h-5 text-green-600" />
                      ) : (
                        <EyeOff className="w-5 h-5 text-gray-400" />
                      )}
                      <div>
                        <p className="font-medium">Main Characters</p>
                        <p className="text-sm text-gray-600">Show character information publicly</p>
                      </div>
                    </div>
                    <input
                      type="checkbox"
                      checked={formData.visibilitySettings.showCharacters}
                      onChange={() => handleVisibilityChange('showCharacters')}
                      className="w-5 h-5 text-purple-600 rounded"
                    />
                  </label>

                  <label className="flex items-center justify-between p-4 bg-white border rounded-lg cursor-pointer hover:bg-gray-50">
                    <div className="flex items-center gap-3">
                      {formData.visibilitySettings.showBudget ? (
                        <Eye className="w-5 h-5 text-green-600" />
                      ) : (
                        <EyeOff className="w-5 h-5 text-gray-400" />
                      )}
                      <div>
                        <p className="font-medium">Budget Information</p>
                        <p className="text-sm text-gray-600">Display budget bracket publicly</p>
                      </div>
                    </div>
                    <input
                      type="checkbox"
                      checked={formData.visibilitySettings.showBudget}
                      onChange={() => handleVisibilityChange('showBudget')}
                      className="w-5 h-5 text-purple-600 rounded"
                    />
                  </label>

                  <label className="flex items-center justify-between p-4 bg-white border rounded-lg cursor-pointer hover:bg-gray-50">
                    <div className="flex items-center gap-3">
                      {formData.visibilitySettings.showMedia ? (
                        <Eye className="w-5 h-5 text-green-600" />
                      ) : (
                        <EyeOff className="w-5 h-5 text-gray-400" />
                      )}
                      <div>
                        <p className="font-medium">Media Previews</p>
                        <p className="text-sm text-gray-600">Show media file types (not content)</p>
                      </div>
                    </div>
                    <input
                      type="checkbox"
                      checked={formData.visibilitySettings.showMedia}
                      onChange={() => handleVisibilityChange('showMedia')}
                      className="w-5 h-5 text-purple-600 rounded"
                    />
                  </label>
                </div>
              </div>

              {/* NDA Configuration */}
              <div className="bg-white border border-gray-200 rounded-lg p-6">
                <h3 className="font-semibold mb-4">NDA Configuration</h3>
                
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
                        ref={customNDARef}
                        type="file"
                        accept=".pdf"
                        onChange={handleCustomNDAUpload}
                        className="hidden"
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
                        <button
                          type="button"
                          onClick={() => customNDARef.current?.click()}
                          className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
                        >
                          <Upload className="w-4 h-4" />
                          Upload NDA (PDF only)
                        </button>
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
            </div>
          )}

          {/* Navigation Buttons */}
          <div className="flex justify-between mt-8 pt-6 border-t">
            {currentStep > 1 && (
              <button
                onClick={handlePrevStep}
                className="flex items-center gap-2 px-6 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                <ArrowLeft className="w-4 h-4" />
                Previous
              </button>
            )}
            {currentStep < 5 ? (
              <button
                onClick={handleNextStep}
                className="ml-auto flex items-center gap-2 px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
              >
                Next
                <ChevronRight className="w-4 h-4" />
              </button>
            ) : (
              <button
                onClick={handleSubmit}
                disabled={isSubmitting}
                className="ml-auto flex items-center gap-2 px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Publishing...
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    Publish Pitch
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}