import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Upload, X, FileText, Video, Image as ImageIcon, Shield, AlertCircle, WifiOff } from 'lucide-react';
import { useBetterAuthStore } from '../store/betterAuthStore';
import { useToast } from '@shared/components/feedback/ToastProvider';
import LoadingSpinner from '@shared/components/feedback/LoadingSpinner';
import { pitchService } from '../services/pitch.service';
import { uploadService } from '../services/upload.service';
import { getGenresSync, getFormatsSync, FALLBACK_GENRES } from '../constants/pitchConstants';
import { useFormValidation } from '../hooks/useFormValidation';
import { usePitchUploadManager } from '../hooks/usePitchUploadManager';
import { PitchFormSchema, type PitchFormData, getCharacterCountInfo } from '../schemas/pitch.schema';
import { a11y } from '../utils/accessibility';
import { MESSAGES, VALIDATION_MESSAGES, SUCCESS_MESSAGES, ERROR_MESSAGES } from '../constants/messages';
import { CharacterManagement } from '../components/CharacterManagement';
import type { Character } from '../types/character';
import { serializeCharacters } from '../utils/characterUtils';
// DocumentUpload removed — using DocumentUploadHub instead (Karl feedback #6)
import type { DocumentFile } from '../components/DocumentUpload';
import DocumentUploadHub from '../components/FileUpload/DocumentUploadHub';
import NDAUploadSection from '../components/FileUpload/NDAUploadSection';
import type { NDADocument } from '../components/FileUpload/NDAUploadSection';
import type { EnhancedUploadResult } from '../services/enhanced-upload.service';
import {
  ToneAndStyleSection,
  CompsSection,
  StoryBreakdownSection,
  WhyNowSection,
  ProductionLocationSection,
  DevelopmentStageSelect,
  CreativeAttachmentsManager,
  VideoUrlSection,
  type CreativeAttachment
} from '../components/PitchForm/EnhancedPitchFormSections';

// PitchFormData type is now imported from pitch.schema.ts

export default function CreatePitch() {
  const navigate = useNavigate();
  const { } = useBetterAuthStore();
  const { success, error } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [currentStep, setCurrentStep] = useState<'form' | 'creating' | 'uploading' | 'complete'>('form');
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  // Track online/offline status
  useEffect(() => {
    const goOnline = () => setIsOnline(true);
    const goOffline = () => setIsOnline(false);
    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);
    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
    };
  }, []);
  const [genres, setGenres] = useState<string[]>([...(getGenresSync() || [])]);
  const [formats, setFormats] = useState<string[]>([...(getFormatsSync() || [])]);

  // Upload manager for coordinating file uploads after pitch creation
  const uploadManager = usePitchUploadManager();
  
  // Initial form data with enhanced fields
  const initialData: PitchFormData = {
    title: '',
    genre: '',
    format: '',
    formatCategory: 'Television - Scripted',
    formatSubtype: '',
    customFormat: '',
    logline: '',
    shortSynopsis: '',
    themes: '',
    worldDescription: '',
    // New enhanced fields
    toneAndStyle: '',
    comps: '',
    storyBreakdown: '',
    whyNow: '',
    productionLocation: '',
    developmentStage: undefined,
    developmentStageOther: '',
    creativeAttachments: [],
    videoUrl: '',
    videoPassword: '',
    videoPlatform: '',
    // Media fields
    image: null,
    video: null,
    documents: [],
    ndaConfig: {
      requireNDA: false,
      ndaType: 'none',
      customNDA: null
    },
    characters: [],
    seekingInvestment: false,
    budgetRange: undefined
  };
  
  // NDA document state
  const [ndaDocument, setNdaDocument] = useState<NDADocument | null>(null);
  
  // Use Valibot validation hook
  const {
    data: formData,
    errors: fieldErrors,
    isValid,
    isValidating,
    touchedFields,
    getFieldProps,
    handleFieldChange,
    handleFieldBlur,
    handleSubmit: validateAndSubmit,
    validateField,
    setValue,
    setValues,
    hasFieldError,
    getFieldError
  } = useFormValidation(initialData, {
    schema: PitchFormSchema,
    mode: 'onBlur',
    debounceMs: 300
  });
  
  const formRef = useRef<HTMLFormElement>(null);
  
  // Initialize accessibility announcer
  useEffect(() => {
    a11y.announcer.createAnnouncer();
  }, []);

  // Format categories and their subtypes
  const formatCategories = {
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

  // Load configuration from API on component mount
  useEffect(() => {
    const loadConfig = async () => {
      try {
        const { getGenres, getFormats } = await import('../constants/pitchConstants');
        const [genresData, formatsData] = await Promise.all([
          getGenres(),
          getFormats()
        ]);
        setGenres(genresData);
        setFormats(formatsData);
      } catch (err) {
        console.warn('Failed to load configuration, using fallback:', err);
        // Already using sync fallback values
      }
    };
    loadConfig();
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    handleFieldChange(name as keyof PitchFormData)(value);
  };
  
  const handleBlur = (fieldName: string) => {
    handleFieldBlur(fieldName as keyof PitchFormData)();
  };

  const handleFormatCategoryChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const category = e.target.value;
    setValues({
      formatCategory: category as any,
      formatSubtype: '', // Reset subtype when category changes
      customFormat: '', // Reset custom format
      format: category // Set the main format to the category
    });
    
    // Validate the category field
    handleFieldChange('formatCategory')(category);
  };

  const handleFormatSubtypeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const subtype = e.target.value;
    setValues({
      formatSubtype: subtype,
      format: subtype === 'Custom Format (please specify)' ? 'Custom' : subtype
    });
    
    // Validate the subtype field
    handleFieldChange('formatSubtype')(subtype);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, fileType: 'image' | 'video') => {
    const file = e.target.files?.[0] || null;

    if (file) {
      // Validate the file immediately
      validateField(fileType, file).then(errors => {
        if (errors.length > 0) {
          // Announce file error
          a11y.validation.announceFieldError(fileType, errors[0]);
          return;
        }

        // Add to upload manager for deferred upload after pitch creation
        const uploadId = uploadManager.addUpload(file, fileType);

        // Set the file with upload reference
        setValue(fileType as keyof PitchFormData, {
          file,
          uploadId,
          preview: URL.createObjectURL(file)
        } as any);

        // Announce successful file selection
        a11y.announcer.announce(`File ${file.name} selected for upload`);
      });
    } else {
      setValue(fileType as keyof PitchFormData, null as any);
    }
  };

  const removeFile = (fileType: 'image' | 'video') => {
    // Get current file data to remove from upload manager
    const currentFile = formData[fileType] as { uploadId?: string } | null;
    if (currentFile?.uploadId) {
      uploadManager.removeUpload(currentFile.uploadId);
    }

    setValue(fileType as keyof PitchFormData, null as any);

    // Announce file removal
    a11y.announcer.announce('File removed');
  };

  const handleDocumentChange = (documents: DocumentFile[]) => {
    setValue('documents', documents as any);
  };
  
  // Document type detection is now handled by the DocumentUpload component
  
  // Document updates are now handled by the DocumentUpload component
  
  // Document removal is now handled by the DocumentUpload component
  
  const handleNDADocumentChange = (document: NDADocument | null) => {
    setNdaDocument(document);
    
    // Update form data based on NDA document
    if (!document || document.ndaType === 'none') {
      setValue('ndaConfig', {
        requireNDA: false,
        ndaType: 'none',
        customNDA: null
      } as any);
    } else if (document.ndaType === 'standard') {
      setValue('ndaConfig', {
        requireNDA: true,
        ndaType: 'platform',
        customNDA: null
      } as any);
    } else if (document.ndaType === 'custom') {
      setValue('ndaConfig', {
        requireNDA: true,
        ndaType: 'custom',
        customNDA: document.file || null
      } as any);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Prevent submission when offline
    if (!navigator.onLine) {
      error('You are offline', 'Please check your internet connection and try again.');
      return;
    }

    setIsSubmitting(true);
    setCurrentStep('form');

    // Validate NDA configuration
    if (ndaDocument?.ndaType === 'custom' && (!ndaDocument.file || ndaDocument.uploadStatus !== 'completed')) {
      setIsSubmitting(false);
      error('Invalid NDA Configuration', 'Please ensure your custom NDA is properly uploaded before submitting.');
      return;
    }

    // Use Valibot validation hook for form submission
    const isFormValid = await validateAndSubmit(async (validatedData) => {
      try {
        setCurrentStep('creating');

        // Use the validated data from Valibot
        const finalFormat = validatedData.formatSubtype === 'Custom Format (please specify)'
          ? validatedData.customFormat
          : validatedData.formatSubtype || validatedData.formatCategory;

        // Prepare pitch data with NDA information
        const pitchData: any = {
          title: validatedData.title,
          genre: validatedData.genre,
          format: finalFormat,
          logline: validatedData.logline,
          shortSynopsis: validatedData.shortSynopsis,
          requireNDA: validatedData.ndaConfig.requireNDA,
          seekingInvestment: validatedData.seekingInvestment,
          budgetRange: validatedData.budgetRange || undefined,
          budgetBracket: validatedData.budgetRange || 'Medium',
          estimatedBudget: 1000000,
          productionTimeline: '6-12 months',
          themes: validatedData.themes,
          worldDescription: validatedData.worldDescription,
          characters: serializeCharacters(validatedData.characters || []),
          aiUsed: false,
          // Enhanced fields
          toneAndStyle: validatedData.toneAndStyle,
          comps: validatedData.comps,
          storyBreakdown: validatedData.storyBreakdown,
          whyNow: validatedData.whyNow,
          productionLocation: validatedData.productionLocation,
          developmentStage: validatedData.developmentStage,
          // Video URL fields
          videoUrl: validatedData.videoUrl,
          videoPassword: validatedData.videoPassword,
          videoPlatform: validatedData.videoPlatform,
          // Documents will be uploaded separately
          documents: validatedData.documents || []
        };

        // Add custom NDA URL if available
        if (ndaDocument?.ndaType === 'custom' && ndaDocument.url) {
          pitchData.customNdaText = ndaDocument.url;
        }

        // PHASE 1: Create the pitch first to get the pitchId
        const pitch = await pitchService.create(pitchData);
        const pitchId = pitch.id;

        // PHASE 2: Upload any pending media files with the actual pitchId
        if (uploadManager.hasUploads) {
          setCurrentStep('uploading');

          const uploadResults = await uploadManager.executeUploads(pitchId);

          // Check for upload errors
          if (uploadResults.failed.length > 0) {
            console.warn('Some uploads failed:', uploadResults.failed);
            // Continue anyway - pitch is created, some files may have uploaded
          }

          // PHASE 3: Update pitch with media URLs if any uploads succeeded
          if (uploadResults.successful.length > 0) {
            const mediaUpdates: any = {};

            // Find image and video URLs from successful uploads
            const imageUpload = uploadResults.successful.find(r =>
              (r as any).category === 'image' || (r as any).type?.includes('image') || (r as any).filename?.match(/\.(jpg|jpeg|png|gif|webp)$/i)
            );
            const videoUpload = uploadResults.successful.find(r =>
              (r as any).category === 'video' || (r as any).type?.includes('video') || (r as any).filename?.match(/\.(mp4|mov|avi|webm)$/i)
            );

            if (imageUpload) {
              mediaUpdates.titleImage = imageUpload.url;
            }
            if (videoUpload) {
              mediaUpdates.trailerUrl = videoUpload.url;
            }

            // Update pitch with media URLs if we have any
            if (Object.keys(mediaUpdates).length > 0) {
              try {
                await pitchService.update(pitchId, mediaUpdates);
              } catch (updateErr) {
                console.warn('Failed to update pitch with media URLs:', updateErr);
                error('Media link warning', 'Your pitch was created but the cover image/video link could not be saved. You can add it later by editing the pitch.');
              }
            }
          }
        }

        setCurrentStep('complete');

        // Announce success to screen readers
        a11y.validation.announceSuccess(SUCCESS_MESSAGES.PITCH_CREATED || 'Pitch created successfully');

        success(SUCCESS_MESSAGES.PITCH_CREATED || 'Pitch created successfully', 'Your pitch has been created and is ready for review.');

        // PHASE 4: Navigate only after everything completes
        navigate('/creator/pitches');
      } catch (err: any) {
        console.error('Error creating pitch:', err);
        const errorMessage = err.message || ERROR_MESSAGES?.UNEXPECTED_ERROR || 'An unexpected error occurred';

        // Announce error to screen readers
        a11y.announcer.announce(`Error: ${errorMessage}`, 'assertive');

        error('Failed to create pitch', errorMessage);
        setCurrentStep('form');
      } finally {
        setIsSubmitting(false);
      }
    });
    
    if (!isFormValid) {
      setIsSubmitting(false);
      const errorKeys = Object.keys(fieldErrors);
      if (errorKeys.length > 0) {
        // Show toast with error summary
        error(
          'Please fix validation errors',
          `${errorKeys.length} field(s) need attention: ${errorKeys.slice(0, 3).join(', ')}${errorKeys.length > 3 ? ` and ${errorKeys.length - 3} more` : ''}`
        );
        // Focus first field with error
        a11y.focus.focusById(errorKeys[0]);
      }
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-indigo-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center gap-4">
            <button
              {...a11y.button.getAttributes({
                type: 'button',
                ariaLabel: 'Go back to creator dashboard'
              })}
              onClick={() => navigate('/creator/dashboard')}
              className={`p-2 text-gray-500 hover:text-gray-700 transition rounded-lg hover:bg-gray-100 ${a11y.classes.focusVisible}`}
            >
              <ArrowLeft className="w-5 h-5" aria-hidden="true" />
            </button>
            <div>
              <h1 id="page-title" className="text-2xl font-bold text-gray-900">Create New Pitch</h1>
              <p className="text-sm text-gray-500">Share your creative vision with potential investors</p>
            </div>
          </div>
        </div>
      </header>

      {/* Connectivity Warning */}
      {!isOnline && (
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pt-6">
          <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-lg p-3">
            <WifiOff className="w-4 h-4 text-red-600 shrink-0" />
            <p className="text-red-700 text-sm">You are offline. You can fill out the form, but submission requires an internet connection.</p>
          </div>
        </div>
      )}

      {/* Cost Overview Notice */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pt-6">
        <div className="bg-gradient-to-r from-yellow-50 to-orange-50 border border-yellow-200 rounded-lg p-4 mb-6">
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0">
              <AlertCircle className="w-5 h-5 text-yellow-600 mt-0.5" />
            </div>
            <div>
              <h3 className="font-medium text-yellow-900 mb-2">💰 Credit System Overview</h3>
              <p className="text-sm text-yellow-800 mb-2">
                Creating a pitch uses credits from your subscription. Basic pitch creation (form + 1 image) costs <strong>10 credits</strong>.
              </p>
              <p className="text-xs text-yellow-700">
                Additional uploads cost extra credits. See specific costs in each upload section below.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Form */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <form 
          ref={formRef}
          onSubmit={handleSubmit} 
          className="space-y-8"
          noValidate
          data-testid="create-pitch-form"
          {...a11y.aria.labelledBy('page-title')}
        >
          {/* Basic Information */}
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-6">Basic Information</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <div>
                <label 
                  {...a11y.formField.getLabelAttributes('title', true)}
                >
                  Title
                </label>
                <input
                  {...a11y.formField.getAttributes({
                    id: 'title',
                    label: 'Title',
                    required: true,
                    invalid: hasFieldError('title'),
                    errorId: hasFieldError('title') ? 'title-error' : undefined
                  })}
                  type="text"
                  name="title"
                  value={formData.title}
                  onChange={handleInputChange}
                  onBlur={() => handleBlur('title')}
                  className={`w-full px-3 py-2 border rounded-lg transition-colors ${
                    hasFieldError('title')
                      ? 'border-red-500 focus:ring-red-500' 
                      : 'border-gray-300 focus:ring-purple-500'
                  } focus:outline-none focus:ring-2 ${a11y.classes.focusVisible}`}
                  placeholder="Enter your pitch title"
                  data-testid="title-input"
                />
                {hasFieldError('title') && (
                  <div {...(a11y.formField.getErrorAttributes('title') as React.HTMLAttributes<HTMLDivElement>)}>
                    <AlertCircle className="w-4 h-4 inline mr-1" aria-hidden="true" />
                    {getFieldError('title')[0]}
                  </div>
                )}
              </div>

              <div>
                <label 
                  {...a11y.formField.getLabelAttributes('genre', true)}
                >
                  Genre
                </label>
                <select
                  {...a11y.formField.getAttributes({
                    id: 'genre',
                    label: 'Genre',
                    required: true,
                    invalid: hasFieldError('genre'),
                    errorId: hasFieldError('genre') ? 'genre-error' : undefined
                  })}
                  name="genre"
                  value={formData.genre}
                  onChange={handleInputChange}
                  onBlur={() => handleBlur('genre')}
                  className={`w-full px-3 py-2 border rounded-lg transition-colors ${
                    hasFieldError('genre')
                      ? 'border-red-500 focus:ring-red-500' 
                      : 'border-gray-300 focus:ring-purple-500'
                  } focus:outline-none focus:ring-2 ${a11y.classes.focusVisible}`}
                  data-testid="genre-select"
                >
                  <option value="">Select a genre</option>
                  {(genres && genres.length > 0 ? genres : FALLBACK_GENRES).map(genre => (
                    <option key={genre} value={genre}>{genre}</option>
                  ))}
                </select>
                {hasFieldError('genre') && (
                  <div {...(a11y.formField.getErrorAttributes('genre') as React.HTMLAttributes<HTMLDivElement>)}>
                    <AlertCircle className="w-4 h-4 inline mr-1" aria-hidden="true" />
                    {getFieldError('genre')[0]}
                  </div>
                )}
              </div>

              <div>
                <label 
                  {...a11y.formField.getLabelAttributes('formatCategory', true)}
                >
                  Format Category
                </label>
                <select
                  {...a11y.formField.getAttributes({
                    id: 'formatCategory',
                    label: 'Format Category',
                    required: true,
                    invalid: fieldErrors.formatCategory?.length > 0,
                    errorId: fieldErrors.formatCategory?.length > 0 ? 'formatCategory-error' : undefined
                  })}
                  value={formData.formatCategory}
                  onChange={handleFormatCategoryChange}
                  className={`w-full px-3 py-2 border rounded-lg transition-colors ${
                    fieldErrors.formatCategory?.length > 0 
                      ? 'border-red-500 focus:ring-red-500' 
                      : 'border-gray-300 focus:ring-purple-500'
                  } focus:outline-none focus:ring-2 ${a11y.classes.focusVisible}`}
                >
                  <option value="">Select a format category</option>
                  {Object.keys(formatCategories).map(category => (
                    <option key={category} value={category}>{category}</option>
                  ))}
                </select>
                {fieldErrors.formatCategory?.length > 0 && (
                  <div {...(a11y.formField.getErrorAttributes('formatCategory') as React.HTMLAttributes<HTMLDivElement>)}>
                    <AlertCircle className="w-4 h-4 inline mr-1" aria-hidden="true" />
                    {fieldErrors.formatCategory[0]}
                  </div>
                )}
              </div>

              {formData.formatCategory && (
                <div>
                  <label 
                    {...a11y.formField.getLabelAttributes('formatSubtype', true)}
                  >
                    Format Subtype
                  </label>
                  <select
                    {...a11y.formField.getAttributes({
                      id: 'formatSubtype',
                      label: 'Format Subtype',
                      required: true,
                      invalid: fieldErrors.formatSubtype?.length > 0,
                      errorId: fieldErrors.formatSubtype?.length > 0 ? 'formatSubtype-error' : undefined
                    })}
                    value={formData.formatSubtype}
                    onChange={handleFormatSubtypeChange}
                    className={`w-full px-3 py-2 border rounded-lg transition-colors ${
                      fieldErrors.formatSubtype?.length > 0 
                        ? 'border-red-500 focus:ring-red-500' 
                        : 'border-gray-300 focus:ring-purple-500'
                    } focus:outline-none focus:ring-2 ${a11y.classes.focusVisible}`}
                  >
                    <option value="">Select a format subtype</option>
                    {formatCategories[formData.formatCategory as keyof typeof formatCategories]?.map(subtype => (
                      <option key={subtype} value={subtype}>{subtype}</option>
                    ))}
                  </select>
                  {fieldErrors.formatSubtype?.length > 0 && (
                    <div {...(a11y.formField.getErrorAttributes('formatSubtype') as React.HTMLAttributes<HTMLDivElement>)}>
                      <AlertCircle className="w-4 h-4 inline mr-1" aria-hidden="true" />
                      {fieldErrors.formatSubtype[0]}
                    </div>
                  )}
                </div>
              )}

              {formData.formatSubtype === 'Custom Format (please specify)' && (
                <div>
                  <label 
                    {...a11y.formField.getLabelAttributes('customFormat', true)}
                  >
                    Custom Format
                  </label>
                  <input
                    {...a11y.formField.getAttributes({
                      id: 'customFormat',
                      label: 'Custom Format',
                      required: true,
                      invalid: fieldErrors.customFormat?.length > 0,
                      errorId: fieldErrors.customFormat?.length > 0 ? 'customFormat-error' : undefined
                    })}
                    type="text"
                    value={formData.customFormat}
                    onChange={handleInputChange}
                    onBlur={() => handleBlur('customFormat')}
                    className={`w-full px-3 py-2 border rounded-lg transition-colors ${
                      fieldErrors.customFormat?.length > 0 
                        ? 'border-red-500 focus:ring-red-500' 
                        : 'border-gray-300 focus:ring-purple-500'
                    } focus:outline-none focus:ring-2 ${a11y.classes.focusVisible}`}
                    placeholder="Please specify your custom format"
                  />
                  {fieldErrors.customFormat?.length > 0 && (
                    <div {...(a11y.formField.getErrorAttributes('customFormat') as React.HTMLAttributes<HTMLDivElement>)}>
                      <AlertCircle className="w-4 h-4 inline mr-1" aria-hidden="true" />
                      {fieldErrors.customFormat[0]}
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="mt-6">
              <label 
                {...a11y.formField.getLabelAttributes('logline', true)}
              >
                Logline
              </label>
              <textarea
                {...a11y.formField.getAttributes({
                  id: 'logline',
                  label: 'Logline',
                  required: true,
                  invalid: fieldErrors.logline?.length > 0,
                  errorId: fieldErrors.logline?.length > 0 ? 'logline-error' : undefined,
                  helpId: 'logline-help'
                })}
                value={formData.logline}
                onChange={handleInputChange}
                onBlur={() => handleBlur('logline')}
                rows={3}
                className={`w-full px-3 py-2 border rounded-lg transition-colors ${
                  fieldErrors.logline?.length > 0 
                    ? 'border-red-500 focus:ring-red-500' 
                    : 'border-gray-300 focus:ring-purple-500'
                } focus:outline-none focus:ring-2 ${a11y.classes.focusVisible}`}
                placeholder="A one-sentence summary of your story"
                data-testid="logline-textarea"
              />
              {fieldErrors.logline?.length > 0 && (
                <div {...(a11y.formField.getErrorAttributes('logline') as React.HTMLAttributes<HTMLDivElement>)}>
                  <AlertCircle className="w-4 h-4 inline mr-1" aria-hidden="true" />
                  {fieldErrors.logline[0]}
                </div>
              )}
              <p {...a11y.formField.getHelpAttributes('logline')}>
                Keep it concise and compelling - this is what hooks potential investors
              </p>
            </div>

            <div className="mt-6">
              <label 
                {...a11y.formField.getLabelAttributes('shortSynopsis', true)}
              >
                Short Synopsis
              </label>
              <textarea
                {...a11y.formField.getAttributes({
                  id: 'shortSynopsis',
                  label: 'Short Synopsis',
                  required: true,
                  invalid: fieldErrors.shortSynopsis?.length > 0,
                  errorId: fieldErrors.shortSynopsis?.length > 0 ? 'shortSynopsis-error' : undefined,
                  helpId: 'shortSynopsis-help'
                })}
                value={formData.shortSynopsis}
                onChange={handleInputChange}
                onBlur={() => handleBlur('shortSynopsis')}
                rows={6}
                className={`w-full px-3 py-2 border rounded-lg transition-colors ${
                  fieldErrors.shortSynopsis?.length > 0 
                    ? 'border-red-500 focus:ring-red-500' 
                    : 'border-gray-300 focus:ring-purple-500'
                } focus:outline-none focus:ring-2 ${a11y.classes.focusVisible}`}
                placeholder="A brief overview of your story"
              />
              {fieldErrors.shortSynopsis?.length > 0 && (
                <div {...(a11y.formField.getErrorAttributes('shortSynopsis') as React.HTMLAttributes<HTMLDivElement>)}>
                  <AlertCircle className="w-4 h-4 inline mr-1" aria-hidden="true" />
                  {fieldErrors.shortSynopsis[0]}
                </div>
              )}
              <p {...a11y.formField.getHelpAttributes('shortSynopsis')}>
                {formData.shortSynopsis.length}/1000 characters | {formData.shortSynopsis.length < 500 ? `${formData.shortSynopsis.length}/500` : '✓'} characters recommended
              </p>
            </div>
          </div>

          {/* Themes & World Section */}
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-6">Themes & World Building</h2>
            
            <div className="space-y-6">
              <div>
                <label 
                  htmlFor="themes"
                  className="block text-sm font-medium text-gray-700 mb-2"
                >
                  Themes
                </label>
                <textarea
                  id="themes"
                  name="themes"
                  value={formData.themes}
                  onChange={handleInputChange}
                  onBlur={() => handleBlur('themes')}
                  rows={4}
                  maxLength={1000}
                  className={`w-full px-3 py-2 border rounded-lg transition-colors ${
                    fieldErrors.themes?.length > 0 
                      ? 'border-red-500 focus:ring-red-500' 
                      : 'border-gray-300 focus:ring-purple-500'
                  } focus:outline-none focus:ring-2`}
                  placeholder="Describe the themes explored in your story (e.g., love, betrayal, redemption, social justice, family bonds, etc.)"
                />
                {fieldErrors.themes?.length > 0 && (
                  <div className="mt-1 text-sm text-red-600 flex items-center">
                    <AlertCircle className="w-4 h-4 inline mr-1" aria-hidden="true" />
                    {fieldErrors.themes[0]}
                  </div>
                )}
                <p className="text-xs text-gray-500 mt-1">
                  {(formData.themes || '').length}/1000 characters | Recommended: 500-1000 characters
                </p>
              </div>

              <div>
                <label 
                  htmlFor="worldDescription"
                  className="block text-sm font-medium text-gray-700 mb-2"
                >
                  World & Setting
                </label>
                <textarea
                  id="worldDescription"
                  name="worldDescription"
                  value={formData.worldDescription}
                  onChange={handleInputChange}
                  onBlur={() => handleBlur('worldDescription')}
                  rows={6}
                  maxLength={2000}
                  className={`w-full px-3 py-2 border rounded-lg transition-colors ${
                    fieldErrors.worldDescription?.length > 0 
                      ? 'border-red-500 focus:ring-red-500' 
                      : 'border-gray-300 focus:ring-purple-500'
                  } focus:outline-none focus:ring-2`}
                  placeholder="Describe the world, setting, and environment of your story. Include time period, location, atmosphere, visual style, and any unique world-building elements..."
                />
                {fieldErrors.worldDescription?.length > 0 && (
                  <div className="mt-1 text-sm text-red-600 flex items-center">
                    <AlertCircle className="w-4 h-4 inline mr-1" aria-hidden="true" />
                    {fieldErrors.worldDescription[0]}
                  </div>
                )}
                <p className="text-xs text-gray-500 mt-1">
                  {(formData.worldDescription || '').length}/2000 characters | Describe the world and setting in detail
                </p>
              </div>
            </div>
          </div>

          {/* Enhanced Story & Style Section */}
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-6">Story & Style Details</h2>
            
            <div className="space-y-6">
              <ToneAndStyleSection
                value={formData.toneAndStyle || ''}
                onChange={(value) => setValue('toneAndStyle', value)}
              />
              
              <CompsSection
                value={formData.comps || ''}
                onChange={(value) => setValue('comps', value)}
              />
              
              <StoryBreakdownSection
                value={formData.storyBreakdown || ''}
                onChange={(value) => setValue('storyBreakdown', value)}
              />
            </div>
          </div>

          {/* Market & Production Section */}
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-6">Market & Production</h2>
            
            <div className="space-y-6">
              <WhyNowSection
                value={formData.whyNow || ''}
                onChange={(value) => setValue('whyNow', value)}
              />
              
              <ProductionLocationSection
                value={formData.productionLocation || ''}
                onChange={(value) => setValue('productionLocation', value)}
              />
              
              <DevelopmentStageSelect
                value={formData.developmentStage || ''}
                otherValue={formData.developmentStageOther}
                onChange={(stage, other) => {
                  setValue('developmentStage', stage);
                  if (other !== undefined) setValue('developmentStageOther', other);
                }}
              />
            </div>
          </div>

          {/* Creative Team Section */}
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-6">Creative Team</h2>
            
            <CreativeAttachmentsManager
              attachments={formData.creativeAttachments || []}
              onChange={(attachments) => setValue('creativeAttachments', attachments)}
            />
          </div>

          {/* Funding & Budget Section */}
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-6">Funding & Investment</h2>
            
            <div className="space-y-6">
              {/* Seeking Investment Toggle */}
              <div className="flex items-start">
                <div className="flex items-center h-5">
                  <input
                    id="seekingInvestment"
                    name="seekingInvestment"
                    type="checkbox"
                    checked={formData.seekingInvestment}
                    onChange={(e) => setValue('seekingInvestment', e.target.checked)}
                    className="w-4 h-4 text-purple-600 border-gray-300 rounded focus:ring-purple-500"
                  />
                </div>
                <div className="ml-3">
                  <label htmlFor="seekingInvestment" className="text-sm font-medium text-gray-900">
                    Actively Seeking Investment
                  </label>
                  <p className="text-sm text-gray-500">
                    Check this box if you're looking for investors for this project
                  </p>
                </div>
              </div>

              {/* Budget Range (only show if seeking investment) */}
              {formData.seekingInvestment && (
                <div>
                  <label htmlFor="budgetRange" className="block text-sm font-medium text-gray-700 mb-2">
                    Estimated Budget Range
                  </label>
                  <select
                    id="budgetRange"
                    name="budgetRange"
                    value={formData.budgetRange}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:outline-none"
                  >
                    <option value="">Select a budget range</option>
                    <option value="0-100k">Under $100K (Micro-budget)</option>
                    <option value="100k-500k">$100K - $500K (Low budget)</option>
                    <option value="500k-1m">$500K - $1M (Medium budget)</option>
                    <option value="1m-5m">$1M - $5M (Moderate budget)</option>
                    <option value="5m-20m">$5M - $20M (Mid-level budget)</option>
                    <option value="20m-50m">$20M - $50M (High budget)</option>
                    <option value="50m+">$50M+ (Blockbuster)</option>
                  </select>
                  <p className="text-xs text-gray-500 mt-1">
                    This helps investors understand the scale of investment needed
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Characters Section */}
          <div className="bg-white rounded-xl shadow-sm p-6">
            <CharacterManagement
              characters={(formData.characters || []) as Character[]}
              onChange={(characters) => setValue('characters', characters as any)}
              maxCharacters={10}
            />
          </div>

          {/* NDA Configuration */}
          <NDAUploadSection
            ndaDocument={ndaDocument || undefined}
            onChange={handleNDADocumentChange}
            disabled={isSubmitting}
            className="mb-6"
          />

          {/* Media Uploads */}
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-6">Media & Assets</h2>
            
            {/* Image Upload */}
            <div className="mb-6">
              <label 
                id="image-label"
                className="block text-sm font-medium text-gray-700 mb-2"
              >
                Cover Image
              </label>
              <div
                {...a11y.fileUpload.getDropZoneAttributes({
                  disabled: isSubmitting,
                  labelId: 'image-label'
                })}
                onClick={() => document.getElementById('image-upload')?.click()}
                onKeyDown={(e: React.KeyboardEvent<HTMLDivElement>) => {
                  const handler = a11y.keyboard.onActivate(() => document.getElementById('image-upload')?.click());
                  handler(e as any);
                }}
              >
                {formData.image ? (
                  <div className="flex items-center justify-between bg-gray-50 rounded-lg p-3">
                    <div className="flex items-center gap-3">
                      <ImageIcon className="w-5 h-5 text-purple-600" aria-hidden="true" />
                      <div>
                        <span className="text-sm font-medium block">{formData.image.name}</span>
                        <span className="text-xs text-gray-500">
                          {(formData.image.size / 1024 / 1024).toFixed(1)}MB
                        </span>
                      </div>
                    </div>
                    <button
                      {...a11y.button.getAttributes({
                        type: 'button',
                        disabled: isSubmitting,
                        ariaLabel: 'Remove file'
                      })}
                      onClick={(e) => {
                        e.stopPropagation();
                        removeFile('image');
                      }}
                      className={`text-red-500 hover:text-red-700 transition-colors p-1 rounded ${a11y.classes.focusVisible}`}
                    >
                      <X className="w-4 h-4" aria-hidden="true" />
                    </button>
                  </div>
                ) : (
                  <div>
                    <ImageIcon className="w-8 h-8 text-gray-400 mx-auto mb-2" aria-hidden="true" />
                    <p className="text-sm text-gray-600 mb-2">Upload a cover image for your pitch (JPG, PNG, GIF, WebP - Max 10MB)</p>
                    <div className="inline-flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition">
                      <Upload className="w-4 h-4" aria-hidden="true" />
                      Choose Image
                    </div>
                  </div>
                )}
              </div>
              <input
                {...a11y.fileUpload.getInputAttributes({
                  id: 'image-upload',
                  accept: 'image/*',
                  disabled: isSubmitting
                })}
                onChange={(e) => handleFileChange(e, 'image')}
              />
              <div id="image-upload-instructions" className={a11y.classes.srOnly}>
                {'Click to upload or drag and drop'}
              </div>
              {fieldErrors.image?.length > 0 && (
                <div {...(a11y.formField.getErrorAttributes('image') as React.HTMLAttributes<HTMLDivElement>)}>
                  <AlertCircle className="w-4 h-4 inline mr-1" aria-hidden="true" />
                  {fieldErrors.image[0]}
                </div>
              )}
              <div className="mt-2 p-2 bg-yellow-50 border border-yellow-200 rounded text-xs text-yellow-800">
                💰 <strong>This Costs Extra:</strong> First image included with basic upload (10 credits), additional images cost 1 credit each
              </div>
            </div>


            {/* Video Upload */}
            <div>
              <label 
                id="video-label"
                className="block text-sm font-medium text-gray-700 mb-2"
              >
                Pitch Video (Optional)
              </label>
              <div
                {...a11y.fileUpload.getDropZoneAttributes({
                  disabled: isSubmitting,
                  labelId: 'video-label'
                })}
                onClick={() => document.getElementById('video-upload')?.click()}
                onKeyDown={(e: React.KeyboardEvent<HTMLDivElement>) => {
                  const handler = a11y.keyboard.onActivate(() => document.getElementById('video-upload')?.click());
                  handler(e as any);
                }}
              >
                {formData.video ? (
                  <div className="flex items-center justify-between bg-gray-50 rounded-lg p-3">
                    <div className="flex items-center gap-3">
                      <Video className="w-5 h-5 text-purple-600" aria-hidden="true" />
                      <div>
                        <span className="text-sm font-medium block">{formData.video.name}</span>
                        <span className="text-xs text-gray-500">
                          {(formData.video.size / 1024 / 1024).toFixed(1)}MB
                        </span>
                      </div>
                    </div>
                    <button
                      {...a11y.button.getAttributes({
                        type: 'button',
                        disabled: isSubmitting,
                        ariaLabel: 'Remove file'
                      })}
                      onClick={(e) => {
                        e.stopPropagation();
                        removeFile('video');
                      }}
                      className={`text-red-500 hover:text-red-700 transition-colors p-1 rounded ${a11y.classes.focusVisible}`}
                    >
                      <X className="w-4 h-4" aria-hidden="true" />
                    </button>
                  </div>
                ) : (
                  <div>
                    <Video className="w-8 h-8 text-gray-400 mx-auto mb-2" aria-hidden="true" />
                    <p className="text-sm text-gray-600 mb-2">Upload a pitch video (MP4, MOV, AVI - Max 100MB)</p>
                    <div className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition">
                      <Upload className="w-4 h-4" aria-hidden="true" />
                      Choose Video
                    </div>
                  </div>
                )}
              </div>
              <input
                {...a11y.fileUpload.getInputAttributes({
                  id: 'video-upload',
                  accept: 'video/*',
                  disabled: isSubmitting
                })}
                onChange={(e) => handleFileChange(e, 'video')}
              />
              <div id="video-upload-instructions" className={a11y.classes.srOnly}>
                {'Click to upload or drag and drop'}
              </div>
              {fieldErrors.video?.length > 0 && (
                <div {...(a11y.formField.getErrorAttributes('video') as React.HTMLAttributes<HTMLDivElement>)}>
                  <AlertCircle className="w-4 h-4 inline mr-1" aria-hidden="true" />
                  {fieldErrors.video[0]}
                </div>
              )}
              <div className="mt-2 p-2 bg-yellow-50 border border-yellow-200 rounded text-xs text-yellow-800">
                💰 <strong>This Costs Extra:</strong> Video links cost 1 credit each
              </div>
            </div>
          </div>

          {/* Document Upload Hub with R2 Storage */}
          <div className="mb-8">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Pitch Documents & NDA Settings
            </h3>
            <DocumentUploadHub
              pitchId={undefined} // Will be set after pitch creation
              deferUploads={true} // Defer uploads until pitch is created
              onFilesSelected={(files: File[]) => {
                // Add document files to upload manager for deferred upload
                files.forEach(file => {
                  uploadManager.addUpload(file, 'document');
                });
              }}
              onUploadComplete={(results: EnhancedUploadResult[]) => {
                // Store uploaded documents (for non-deferred mode)
                const documentUrls = results.map(r => ({
                  url: (r as any).cdnUrl || (r as any).url,
                  filename: (r as any).filename,
                  size: (r as any).size,
                  type: (r as any).type,
                  r2Key: (r as any).r2Key
                }));
                setValue('documents', documentUrls as any);
                success('Documents uploaded successfully');
              }}
              onNDAChange={(nda: NDADocument | null) => {
                setNdaDocument(nda);
                if (nda) {
                  setValue('ndaConfig', {
                    requireNDA: true,
                    ndaType: nda.ndaType,
                    customNDA: nda.ndaType === 'custom' ? (nda as any).documentFile : null
                  } as any);
                } else {
                  setValue('ndaConfig', {
                    requireNDA: false,
                    ndaType: 'none',
                    customNDA: null
                  } as any);
                }
              }}
              disabled={isSubmitting}
              className="border-t pt-6"
            />
          </div>

          {/* Validation Error Summary */}
          {Object.keys(fieldErrors).length > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4" role="alert">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-red-500 mt-0.5 flex-shrink-0" />
                <div>
                  <h3 className="font-medium text-red-800 mb-2">
                    Please fix {Object.keys(fieldErrors).length} error{Object.keys(fieldErrors).length > 1 ? 's' : ''} before submitting
                  </h3>
                  <ul className="space-y-1">
                    {Object.entries(fieldErrors).map(([field, errors]) => (
                      errors && errors.length > 0 && (
                        <li key={field}>
                          <button
                            type="button"
                            onClick={() => a11y.focus.focusById(field)}
                            className="text-sm text-red-700 hover:text-red-900 underline cursor-pointer"
                          >
                            {field}: {errors[0]}
                          </button>
                        </li>
                      )
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          )}

          {/* Submit */}
          <div className="flex justify-end gap-4">
            <button
              {...a11y.button.getAttributes({
                type: 'button',
                disabled: isSubmitting,
                ariaLabel: 'Cancel'
              })}
              onClick={() => navigate('/creator/dashboard')}
              className={`px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition ${a11y.classes.focusVisible} ${isSubmitting ? a11y.classes.disabledElement : ''}`}
              data-testid="cancel-button"
            >
              Cancel
            </button>
            <button
              {...a11y.button.getAttributes({
                type: 'submit',
                disabled: isSubmitting,
                loading: isSubmitting,
                ariaLabel: isSubmitting ? 'Creating pitch...' : 'Submit pitch'
              })}
              className={`px-6 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-lg hover:shadow-lg transition flex items-center gap-2 ${a11y.classes.focusVisible} ${isSubmitting ? a11y.classes.disabledElement : ''}`}
              data-testid="submit-button"
            >
              {isSubmitting ? (
                <>
                  <LoadingSpinner size="sm" color="white" aria-hidden="true" />
                  <span aria-live="polite">
                    {currentStep === 'creating' && 'Creating pitch...'}
                    {currentStep === 'uploading' && `Uploading files (${uploadManager.overallProgress}%)...`}
                    {currentStep === 'complete' && 'Finalizing...'}
                    {currentStep === 'form' && 'Validating...'}
                  </span>
                </>
              ) : (
                uploadManager.hasUploads
                  ? `Create Pitch (${uploadManager.pendingUploads.length} files to upload)`
                  : 'Create Pitch'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}