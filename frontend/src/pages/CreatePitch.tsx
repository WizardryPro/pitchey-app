import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useOnlineStatus } from '@/shared/hooks/useOnlineStatus';
import { useNavigate, useLocation } from 'react-router-dom';
import { ArrowLeft, Upload, X, FileText, Video, Image as ImageIcon, Shield, AlertCircle, WifiOff, CheckCircle, Circle, UserPlus } from 'lucide-react';
import { useToast } from '@shared/components/feedback/ToastProvider';
import LoadingSpinner from '@shared/components/feedback/LoadingSpinner';
import { pitchService } from '@features/pitches/services/pitch.service';
import { uploadService } from '@features/uploads/services/upload.service';
import { getGenresSync, getFormatsSync, FALLBACK_GENRES } from '@config/pitchConstants';
import { useFormValidation } from '@/shared/hooks/useFormValidation';
import { usePitchUploadManager } from '@features/pitches/hooks/usePitchUploadManager';
import { PitchFormSchema, type PitchFormData, getCharacterCountInfo } from '../schemas/pitch.schema';
import { a11y } from '../utils/accessibility';
import { useBetterAuthStore } from '../store/betterAuthStore';
import { MESSAGES, VALIDATION_MESSAGES, SUCCESS_MESSAGES, ERROR_MESSAGES } from '@config/messages';
import { CharacterManagement } from '@features/pitches/components/CharacterManagement';
import type { Character } from '@shared/types/character';
import { serializeCharacters } from '@features/pitches/utils/characterUtils';
// DocumentUpload removed — using DocumentUploadHub instead (Karl feedback #6)
// Use the same typed document uploader (Script/Treatment/Pitch Deck/etc.) as the
// Edit page, instead of the generic DocumentUploadHub drag-drop — per Karl's
// request for parity with edit. NDA selection is rendered via NDAUploadSection.
import { DocumentUpload, type DocumentFile } from '@features/uploads/components/DocumentUpload';
import NDAUploadSection, { type NDADocument } from '@features/ndas/components/NDAUploadSection';
import {
  ToneAndStyleSection,
  CompsSection,
  StoryBreakdownSection,
  WhyNowSection,
  ProductionLocationSection,
  DevelopmentStageSelect,
  CreativeRosterManager,
  VideoUrlSection,
  type CreativeAttachment
} from '@features/pitches/components/PitchForm/EnhancedPitchFormSections';

// PitchFormData type is now imported from pitch.schema.ts

export default function CreatePitch() {
  const navigate = useNavigate();
  const location = useLocation();
  const { success, error } = useToast();
  const { user } = useBetterAuthStore();
  const isProduction = user?.userType === 'production';

  // When a creator lands here via a producer's invite link (InviteLanding redirect, or the
  // post-verification return-to for new sign-ups), surface who they're pitching to. The actual
  // producer→creator attribution is the auto-follow recorded at invite redemption; this banner
  // just makes that intent visible. Source: nav state (logged-in redirect) or ?invitedBy= (new-user
  // return-to, which survives the email-verification round-trip that nav state cannot).
  const invitedBy = ((location.state as { invitedBy?: string } | null)?.invitedBy
    || new URLSearchParams(location.search).get('invitedBy')
    || '').trim();
  const [isSubmitting, setIsSubmitting] = useState(false);
  // Which action is in flight — drives the button label ("Publishing…" vs
  // "Creating…") and the publish step after the pitch is created.
  const [publishing, setPublishing] = useState(false);
  const [currentStep, setCurrentStep] = useState<'form' | 'creating' | 'uploading' | 'complete'>('form');
  const isOnline = useOnlineStatus();
  const [aiExtracting, setAiExtracting] = useState(false);
  const [hasAttemptedSubmit, setHasAttemptedSubmit] = useState(false);
  const aiFileInputRef = React.useRef<HTMLInputElement>(null);

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
    longSynopsis: '',
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
    targetAudience: '',
    productionTimeline: '',
    targetReleaseDate: '',
    estimatedBudget: '',
    visibilitySettings: {
      showShortSynopsis: true,
      showCharacters: false,
      showBudget: false,
      showMedia: false,
      showCreatorName: true,
    },
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
    budgetRange: undefined,
    aiUsed: false,
    aiDisclosure: 'none' as const
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
    'AI': [
      'AI-Generated Film',
      'AI-Assisted Production',
      'AI Animation',
      'AI Interactive Experience'
    ],
    'Other': [
      'Custom Format (please specify)'
    ]
  };

  // Load configuration from API on component mount
  useEffect(() => {
    const loadConfig = async () => {
      try {
        const { getGenres, getFormats } = await import('@config/pitchConstants');
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
      // Validate the file immediately — pass the raw File so ImageFileSchema
      // (instanceof File check) evaluates correctly.
      validateField(fileType, file).then(errors => {
        if (errors.length > 0) {
          // Announce file error
          a11y.validation.announceFieldError(fileType, errors[0]);
          return;
        }

        // Add to upload manager for deferred upload after pitch creation.
        // We do NOT store the uploadId on the schema value — ImageFileSchema
        // expects a bare File (instanceof File) and storing {file, uploadId, preview}
        // causes the schema check to fail at submit time, blocking submission.
        uploadManager.addUpload(file, fileType);

        // Store the raw File so the schema validates cleanly on submit.
        setValue(fileType as keyof PitchFormData, file as any);

        // Announce successful file selection
        a11y.announcer.announce(`File ${file.name} selected for upload`);
      });
    } else {
      setValue(fileType as keyof PitchFormData, null as any);
    }
  };

  const removeFile = (fileType: 'image' | 'video') => {
    // The stored value is now a bare File (not {file, uploadId, preview}).
    // Uploads are deferred — nothing has been sent to the server yet — so we
    // clear the pending upload from the manager by filtering on the File
    // reference, then null out the form value.
    const currentFile = formData[fileType] as File | null;
    if (currentFile instanceof File) {
      // Remove the matching pending upload by file identity
      const match = uploadManager.pendingUploads.find(
        u => u.type === fileType && u.file === currentFile
      );
      if (match) {
        uploadManager.removeUpload(match.id);
      }
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

  const submitPitch = async (publish: boolean) => {
    // Prevent submission when offline
    if (!navigator.onLine) {
      error('You are offline', 'Please check your internet connection and try again.');
      return;
    }

    setIsSubmitting(true);
    setPublishing(publish);
    setHasAttemptedSubmit(true);
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
          // Persist the structured format taxonomy too (proper-cased) so the Edit
          // form can repopulate the Format Category / Subtype selects. Without these
          // the backend stored NULL for format_category/format_subtype and the edit
          // page left "Select a format category" → Save Changes stayed disabled.
          formatCategory: validatedData.formatCategory,
          formatSubtype: validatedData.formatSubtype,
          logline: validatedData.logline,
          shortSynopsis: validatedData.shortSynopsis,
          longSynopsis: validatedData.longSynopsis || undefined,
          requireNDA: validatedData.ndaConfig.requireNDA,
          seekingInvestment: validatedData.seekingInvestment,
          budgetRange: validatedData.budgetRange || undefined,
          budgetBracket: validatedData.budgetRange || undefined,
          estimatedBudget: validatedData.estimatedBudget || undefined,
          estimatedBudgetUsd: validatedData.estimatedBudget ? Number(validatedData.estimatedBudget) : undefined,
          productionTimeline: validatedData.productionTimeline || undefined,
          targetAudience: validatedData.targetAudience || undefined,
          targetReleaseDate: validatedData.targetReleaseDate || undefined,
          visibilitySettings: validatedData.visibilitySettings || undefined,
          themes: validatedData.themes,
          worldDescription: validatedData.worldDescription,
          characters: serializeCharacters(validatedData.characters || []),
          aiDisclosure: (validatedData as any).aiDisclosure || 'none',
          aiUsed: ((validatedData as any).aiDisclosure || 'none') !== 'none',
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
          documents: validatedData.documents || [],
          // Attached creatives roster — only persist rows with a name (the seeded
          // standard roles render empty until filled). Was previously dropped on create.
          creativeAttachments: (formData.creativeAttachments || []).filter(
            (a: CreativeAttachment) => a.name?.trim()
          )
        };

        // Add custom NDA URL if available
        if (ndaDocument?.ndaType === 'custom' && ndaDocument.url) {
          pitchData.customNdaText = ndaDocument.url;
        }

        // PHASE 1: Create the pitch first to get the pitchId
        const pitch = await pitchService.create(pitchData);
        const pitchId = pitch.id;

        // PHASE 2b: Upload typed project documents now that we have the pitchId.
        // These come from the DocumentUpload component (held in formData.documents);
        // same upload path as the Edit page so they attach to the pitch (uploads/<uid>/
        // + pitch_documents row). Per-doc failures don't abort the create.
        const pendingDocs = (formData.documents || []).filter((d: any) => d?.file && !d?.url);
        if (pendingDocs.length > 0) {
          setCurrentStep('uploading');
          for (const doc of pendingDocs) {
            try {
              await uploadService.uploadDocument((doc as any).file, (doc as any).type, {
                pitchId,
                requiresNda: (doc as any).requiresNda ?? true,
              });
            } catch (docErr) {
              console.error('Document upload failed:', (doc as any).title, docErr);
            }
          }
        }

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

        // The pitch is created as a draft. If the creator hit "Publish", flip it
        // live now (after media uploads so the published pitch already has its
        // cover/trailer). A failed publish must NOT look like a failed create —
        // the draft is safely saved, so we degrade to a clear "saved as draft"
        // message rather than an error.
        if (publish) {
          try {
            await pitchService.publish(pitchId);
            success(
              'Pitch published!',
              'It\'s now live on the marketplace for investors to find.'
            );
          } catch (pubErr) {
            const e = pubErr instanceof Error ? pubErr : new Error(String(pubErr));
            error(
              'Saved as a draft — not published',
              e.message || 'Your pitch is saved, but we couldn\'t publish it. Open it from "My Pitches" and hit Publish.'
            );
          }
        } else {
          // A new pitch is saved as a DRAFT — it does NOT appear on the marketplace
          // until it's published. Say so explicitly so creators don't wait for it to
          // show up on its own (the "takes a while to appear" confusion).
          success(
            'Pitch saved as a draft',
            'It won\'t appear on the marketplace until you publish it — open it from "My Pitches" and hit Publish.'
          );
        }

        // PHASE 4: Navigate only after everything completes
        void navigate(isProduction ? '/production/pitches' : '/creator/pitches');
      } catch (err: any) {
        console.error('Error creating pitch:', err);
        const errorMessage = err.message || ERROR_MESSAGES?.UNEXPECTED_ERROR || 'An unexpected error occurred';

        // Announce error to screen readers
        a11y.announcer.announce(`Error: ${errorMessage}`, 'assertive');

        error('Failed to create pitch', errorMessage);
        setCurrentStep('form');
      } finally {
        setIsSubmitting(false);
        setPublishing(false);
      }
    });

    if (!isFormValid) {
      setIsSubmitting(false);
      setPublishing(false);
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

  // Form-level submit (Enter key) defaults to the safe action: save as draft.
  // The explicit Publish button calls submitPitch(true).
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    void submitPitch(false);
  };

  const handleAiExtract = async (file: File) => {
    setAiExtracting(true);
    try {
      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch(`${import.meta.env.VITE_API_URL || ''}/api/pitches/ai-extract`, {
        method: 'POST',
        credentials: 'include',
        body: formData,
      });

      const data = await res.json();

      if (!data.success) {
        error('AI Extraction Failed', data.error || 'Could not extract data from document');
        return;
      }

      const extracted = data.data?.extracted;
      if (!extracted) return;

      // Auto-fill form fields from AI extraction
      const updates: Partial<PitchFormData> = {};
      if (extracted.title) updates.title = extracted.title;
      if (extracted.logline) updates.logline = extracted.logline;
      if (extracted.genre) updates.genre = extracted.genre;
      if (extracted.shortSynopsis) updates.shortSynopsis = extracted.shortSynopsis;
      if (extracted.themes && Array.isArray(extracted.themes)) updates.themes = extracted.themes;
      if (extracted.toneAndStyle) updates.toneAndStyle = extracted.toneAndStyle;
      if (extracted.comparableFilms) updates.comps = extracted.comparableFilms;
      if (extracted.worldDescription) updates.worldDescription = extracted.worldDescription;
      if (extracted.characters && Array.isArray(extracted.characters)) {
        updates.characters = extracted.characters.map((c: any) => ({
          name: c.name || '',
          description: c.description || '',
          age: c.age || '',
          gender: c.gender || '',
        }));
      }

      // Apply updates to form
      setValues(updates);

      success(
        'AI Extraction Complete',
        `Filled ${Object.keys(updates).length} fields from "${file.name}". ${data.data.creditsUsed} credits used.`
      );
    } catch (err) {
      const e = err instanceof Error ? err : new Error(String(err));
      error('AI Extraction Failed', e.message);
    } finally {
      setAiExtracting(false);
    }
  };

  // Pitch completeness — weights from ui-tokens.json
  const completeness = useMemo(() => {
    const fields = [
      { label: 'Title', weight: 10, filled: !!formData.title?.trim() },
      { label: 'Logline', weight: 20, filled: (formData.logline?.trim().length || 0) >= 10 },
      { label: 'Genre', weight: 10, filled: !!formData.genre },
      { label: 'Synopsis', weight: 30, filled: (formData.shortSynopsis?.trim().length || 0) >= 50 },
      { label: 'Media', weight: 20, filled: !!(formData.image || (formData.documents && formData.documents.length > 0) || formData.videoUrl) },
      { label: 'Details', weight: 10, filled: !!(formData.developmentStage || formData.toneAndStyle || formData.whyNow) },
    ];
    const score = fields.reduce((sum, f) => sum + (f.filled ? f.weight : 0), 0);
    return { score, fields };
  }, [formData.title, formData.logline, formData.genre, formData.shortSynopsis, formData.image, formData.documents, formData.videoUrl, formData.developmentStage, formData.toneAndStyle, formData.whyNow]);

  const completenessColor = completeness.score < 40 ? 'bg-red-500' : completeness.score < 70 ? 'bg-amber-500' : 'bg-emerald-500';

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-indigo-50">
      {/* Hidden file input for AI extraction */}
      <input
        ref={aiFileInputRef}
        type="file"
        accept=".pdf,.txt,.docx"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void handleAiExtract(file);
          e.target.value = '';
        }}
      />

      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                {...a11y.button.getAttributes({
                  type: 'button',
                  ariaLabel: 'Go back'
                })}
                onClick={() => navigate(isProduction ? '/production/dashboard' : '/creator/dashboard')}
                className={`p-2 text-gray-500 hover:text-gray-700 transition rounded-lg hover:bg-gray-100 ${a11y.classes.focusVisible}`}
              >
                <ArrowLeft className="w-5 h-5" aria-hidden="true" />
              </button>
              <div>
                <h1 id="page-title" className="text-2xl font-bold text-gray-900">Create New Pitch</h1>
                <p className="text-sm text-gray-500">Share your creative vision with potential investors</p>
              </div>
            </div>
            <button
              onClick={() => aiFileInputRef.current?.click()}
              disabled={aiExtracting}
              className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-lg hover:from-indigo-700 hover:to-purple-700 transition disabled:opacity-50 text-sm font-medium shadow-sm"
            >
              {aiExtracting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Extracting...
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4" />
                  Auto-fill from Document
                </>
              )}
            </button>
          </div>
        </div>
      </header>

      {invitedBy && (
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pt-4">
          <div className="flex items-center gap-3 rounded-lg border border-purple-200 bg-purple-50 px-4 py-3">
            <span className="flex-shrink-0 w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center">
              <UserPlus className="w-4 h-4 text-purple-600" />
            </span>
            <p className="text-sm text-purple-900">
              You're pitching to <strong>{invitedBy}</strong>. They'll see your pitch in their feed as
              soon as you publish.
            </p>
          </div>
        </div>
      )}

      {/* Pitch Completeness Bar */}
      <div className="sticky top-0 z-40 bg-white/95 backdrop-blur border-b">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-2">
          <div className="flex items-center gap-3">
            <span className="text-xs font-medium text-gray-600 shrink-0">{completeness.score}%</span>
            <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${completenessColor}`}
                style={{ width: `${completeness.score}%` }}
              />
            </div>
            <div className="hidden sm:flex items-center gap-2">
              {completeness.fields.map(f => (
                <span key={f.label} className="flex items-center gap-0.5 text-[10px] text-gray-500" title={f.label}>
                  {f.filled
                    ? <CheckCircle className="w-3 h-3 text-emerald-500" />
                    : <Circle className="w-3 h-3 text-gray-300" />}
                  {f.label}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>

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

            <div className="mt-6">
              <label htmlFor="longSynopsis" className="block text-sm font-medium text-gray-700 mb-2">
                Long Synopsis <span className="text-gray-400 font-normal">(optional)</span>
              </label>
              <textarea
                id="longSynopsis"
                name="longSynopsis"
                value={formData.longSynopsis || ''}
                onChange={handleInputChange}
                rows={8}
                maxLength={5000}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                placeholder="A detailed, scene-by-scene account of the full story — the deeper read for interested parties."
              />
              <p className="text-xs text-gray-500 mt-1">{(formData.longSynopsis || '').length}/5000 characters</p>
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

              <div>
                <label htmlFor="targetAudience" className="block text-sm font-medium text-gray-700 mb-2">
                  Target Audience <span className="text-gray-400 font-normal">(optional)</span>
                </label>
                <textarea
                  id="targetAudience"
                  name="targetAudience"
                  value={formData.targetAudience || ''}
                  onChange={handleInputChange}
                  rows={3}
                  maxLength={2000}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                  placeholder="Who is this for? Demographics, comparable audiences, platform fit..."
                />
              </div>

              <div>
                <label htmlFor="productionTimeline" className="block text-sm font-medium text-gray-700 mb-2">
                  Production Timeline <span className="text-gray-400 font-normal">(optional)</span>
                </label>
                <textarea
                  id="productionTimeline"
                  name="productionTimeline"
                  value={formData.productionTimeline || ''}
                  onChange={handleInputChange}
                  rows={3}
                  maxLength={2000}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                  placeholder="Key milestones and schedule — development, pre-production, shoot, post..."
                />
              </div>

              <div>
                <label htmlFor="targetReleaseDate" className="block text-sm font-medium text-gray-700 mb-2">
                  Target Release Date <span className="text-gray-400 font-normal">(optional)</span>
                </label>
                <input
                  type="text"
                  id="targetReleaseDate"
                  name="targetReleaseDate"
                  value={formData.targetReleaseDate || ''}
                  onChange={handleInputChange}
                  maxLength={50}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                  placeholder="e.g. Q4 2027, or a target month/year"
                />
              </div>
            </div>
          </div>

          {/* Creative Team Section — mirrors the production pitch "Attached Creatives" roster */}
          <div className="bg-white rounded-xl shadow-sm p-6">
            <CreativeRosterManager
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

              {/* Budget — numeric USD, capped at $1B (Karl P4). Stored as a clean
                  integer; the "$"/"USD" affordances + comma formatting keep it readable
                  and inside the box at max length. */}
              <div>
                <label htmlFor="estimatedBudget" className="block text-sm font-medium text-gray-700 mb-2">
                  Budget <span className="text-gray-400 font-normal">(optional, USD)</span>
                </label>
                <div className="relative">
                  <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
                  <input
                    type="text"
                    inputMode="numeric"
                    id="estimatedBudget"
                    name="estimatedBudget"
                    value={formData.estimatedBudget ? Number(formData.estimatedBudget).toLocaleString('en-US') : ''}
                    onChange={(e) => {
                      const digits = e.target.value.replace(/[^0-9]/g, '');
                      const capped = digits ? String(Math.min(Number(digits), 1000000000)) : '';
                      setValue('estimatedBudget', capped);
                    }}
                    className="w-full pl-7 pr-14 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 truncate"
                    placeholder="50,000,000"
                    aria-describedby="budget-help"
                  />
                  <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs font-medium text-gray-400">USD</span>
                </div>
                <p id="budget-help" className="text-xs text-gray-500 mt-1">
                  Shown in US dollars so budgets are comparable globally (payments are still processed in EUR). Max $1,000,000,000.
                </p>
              </div>
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


          </div>

          {/* Optional Extras — sizzle reel / trailer + lookbook are nice-to-have, not required (Karl feedback) */}
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-1">Optional Extras</h2>
            <p className="text-sm text-gray-500 mb-6">
              Add-ons that make your pitch stand out — none of these are required. Upload a sizzle
              reel or trailer here, and add a lookbook (visual pitch deck) under Project Documents below.
            </p>

            {/* Video Upload (sizzle reel / trailer) */}
            <div>
              <label
                id="video-label"
                className="block text-sm font-medium text-gray-700 mb-2"
              >
                Sizzle Reel or Trailer <span className="text-gray-400 font-normal">(optional)</span>
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
                    <p className="text-sm text-gray-600 mb-2">Upload a sizzle reel or trailer (MP4, MOV, AVI - Max 100MB)</p>
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

          {/* Public Visibility Section */}
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-2">Public Visibility</h2>
            <p className="text-sm text-gray-500 mb-6">
              Choose what's visible on the public pitch page before a viewer signs an NDA.
            </p>
            <div className="space-y-3">
              {([
                { key: 'showShortSynopsis', label: 'Show short synopsis', desc: 'Display the short synopsis publicly.' },
                { key: 'showCharacters', label: 'Show characters', desc: 'Reveal the character list publicly.' },
                { key: 'showBudget', label: 'Show budget', desc: 'Display budget range / estimate publicly.' },
                { key: 'showMedia', label: 'Show media', desc: 'Display images and media publicly.' },
                { key: 'showCreatorName', label: 'Show creator name', desc: 'When off, anonymous (logged-out) visitors see "Anonymous Creator"; signed-in users still see your name.' },
              ] as const).map((opt) => {
                const current = formData.visibilitySettings || {};
                const checked = !!(current as Record<string, boolean>)[opt.key];
                return (
                  <label key={opt.key} className="flex items-start gap-3 p-3 rounded-lg border border-gray-200 hover:border-gray-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => setValue('visibilitySettings', { ...current, [opt.key]: !checked } as any)}
                      className="mt-1 w-4 h-4 text-purple-600 border-gray-300 rounded focus:ring-purple-500"
                    />
                    <div>
                      <span className="text-sm font-medium text-gray-900">{opt.label}</span>
                      <p className="text-xs text-gray-500">{opt.desc}</p>
                    </div>
                  </label>
                );
              })}
            </div>
          </div>

          {/* Document Upload Hub with R2 Storage */}
          <div className="mb-8">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Pitch Documents & NDA Settings
            </h3>
            {/* NDA selection (same component the edit page uses for NDA config) */}
            <NDAUploadSection
              disabled={isSubmitting}
              ndaDocument={ndaDocument ?? undefined}
              onChange={(nda: NDADocument | null) => {
                setNdaDocument(nda);
                if (nda && nda.ndaType !== 'none') {
                  const schemaType = nda.ndaType === 'custom' ? 'custom' : 'platform';
                  setValue('ndaConfig', {
                    requireNDA: true,
                    ndaType: schemaType,
                    customNDA: schemaType === 'custom' ? (nda as any).documentFile : null
                  } as any);
                } else {
                  setValue('ndaConfig', {
                    requireNDA: false,
                    ndaType: 'none',
                    customNDA: null
                  } as any);
                }
              }}
            />

            {/* Typed document uploader (Script/Treatment/Pitch Deck/etc.) — same as
                the Edit page. Files are held in formData.documents and uploaded after
                the pitch is created (PHASE 2b in submit), so they attach with pitchId. */}
            <div className="border-t pt-6 mt-6">
              <h4 className="text-base font-semibold text-gray-900 mb-1">Project Documents</h4>
              <p className="text-sm text-gray-500 mb-4">
                All optional. A lookbook (visual pitch deck) is a great add-on — choose the
                "Lookbook" type after selecting your file.
              </p>
              <DocumentUpload
                documents={(formData.documents ?? []) as unknown as DocumentFile[]}
                onChange={handleDocumentChange as unknown as (docs: DocumentFile[]) => void}
                maxFiles={15}
                maxFileSize={10}
                disabled={isSubmitting}
                autoUpload={false}
                showProgress={true}
                enableDragDrop={true}
                showPreview={true}
              />
            </div>

            {/* AI Usage Disclosure */}
            <div className="border-t pt-6 mt-6">
              <span className="font-medium text-gray-900">AI Usage Disclosure</span>
              <p className="text-xs text-gray-500 mt-1 mb-3">
                Tell viewers how (if at all) AI was used in this pitch. Choosing "Nothing made with AI"
                earns the Pitchey-verified Human Made badge; if AI content is later discovered, Pitchey
                reserves the right to remove it.
              </p>
              <div className="space-y-2">
                {[
                  { value: 'none', label: 'Nothing made with AI', desc: 'This pitch is entirely human-created.' },
                  { value: 'promo', label: 'AI used in promotional material only', desc: 'e.g. AI-assisted key art or trailer graphics; the script and core creative are human-made.' },
                  { value: 'production', label: 'AI used for script and/or production', desc: 'AI contributed to the screenplay, story, or production assets.' },
                ].map((opt) => {
                  const selected = (((formData as any).aiDisclosure as string) ?? 'none') === opt.value;
                  return (
                    <label
                      key={opt.value}
                      className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition ${
                        selected ? 'border-emerald-400 bg-emerald-50' : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <input
                        type="radio"
                        name="aiDisclosure"
                        value={opt.value}
                        checked={selected}
                        onChange={() => setValue('aiDisclosure' as any, opt.value)}
                        className="mt-1 text-emerald-600 focus:ring-emerald-500"
                      />
                      <div>
                        <span className="font-medium text-gray-900 flex items-center gap-2">
                          {opt.label}
                          {opt.value === 'none' && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                              Pitchey Verified
                            </span>
                          )}
                        </span>
                        <p className="text-xs text-gray-500 mt-1">{opt.desc}</p>
                      </div>
                    </label>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Validation Error Summary — only show after submit attempt */}
          {hasAttemptedSubmit && (() => {
            const visibleErrors = Object.entries(fieldErrors).filter(
              ([, errs]) => errs && errs.length > 0
            );
            return visibleErrors.length > 0 ? (
              <div className="bg-red-50 border border-red-200 rounded-xl p-4" role="alert">
                <div className="flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-red-500 mt-0.5 flex-shrink-0" />
                  <div>
                    <h3 className="font-medium text-red-800 mb-2">
                      Please fix {visibleErrors.length} error{visibleErrors.length > 1 ? 's' : ''} before submitting
                    </h3>
                    <ul className="space-y-1">
                      {visibleErrors.map(([field, errors]) => (
                        <li key={field}>
                          <button
                            type="button"
                            onClick={() => a11y.focus.focusById(field)}
                            className="text-sm text-red-700 hover:text-red-900 underline cursor-pointer"
                          >
                            {field}: {errors[0]}
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            ) : null;
          })()}

          {/* Submit */}
          <div className="flex justify-end gap-4">
            <button
              {...a11y.button.getAttributes({
                type: 'button',
                disabled: isSubmitting,
                ariaLabel: 'Cancel'
              })}
              onClick={() => navigate(isProduction ? '/production/dashboard' : '/creator/dashboard')}
              className={`px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition ${a11y.classes.focusVisible} ${isSubmitting ? a11y.classes.disabledElement : ''}`}
              data-testid="cancel-button"
            >
              Cancel
            </button>
            {/* Save as Draft — also the form's default action (Enter key submits here) */}
            <button
              {...a11y.button.getAttributes({
                type: 'submit',
                disabled: isSubmitting,
                loading: isSubmitting && !publishing,
                ariaLabel: isSubmitting && !publishing ? 'Saving draft...' : 'Save as draft'
              })}
              className={`px-6 py-2 border border-purple-300 text-purple-700 bg-white rounded-lg hover:bg-purple-50 transition flex items-center gap-2 ${a11y.classes.focusVisible} ${isSubmitting ? a11y.classes.disabledElement : ''}`}
              data-testid="save-draft-button"
            >
              {isSubmitting && !publishing ? (
                <>
                  <LoadingSpinner size="sm" color="purple" aria-hidden="true" />
                  <span aria-live="polite">
                    {currentStep === 'creating' && 'Saving draft...'}
                    {currentStep === 'uploading' && `Uploading files (${uploadManager.overallProgress}%)...`}
                    {currentStep === 'complete' && 'Finalizing...'}
                    {currentStep === 'form' && 'Validating...'}
                  </span>
                </>
              ) : (
                uploadManager.hasUploads
                  ? `Save as Draft (${uploadManager.pendingUploads.length} files)`
                  : 'Save as Draft'
              )}
            </button>
            {/* Publish — creates the pitch then flips it live in one step */}
            <button
              {...a11y.button.getAttributes({
                type: 'button',
                disabled: isSubmitting,
                loading: isSubmitting && publishing,
                ariaLabel: isSubmitting && publishing ? 'Publishing pitch...' : 'Publish pitch'
              })}
              onClick={() => void submitPitch(true)}
              className={`px-6 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-lg hover:shadow-lg transition flex items-center gap-2 ${a11y.classes.focusVisible} ${isSubmitting ? a11y.classes.disabledElement : ''}`}
              data-testid="publish-button"
            >
              {isSubmitting && publishing ? (
                <>
                  <LoadingSpinner size="sm" color="white" aria-hidden="true" />
                  <span aria-live="polite">
                    {currentStep === 'creating' && 'Creating pitch...'}
                    {currentStep === 'uploading' && `Uploading files (${uploadManager.overallProgress}%)...`}
                    {currentStep === 'complete' && 'Publishing...'}
                    {currentStep === 'form' && 'Validating...'}
                  </span>
                </>
              ) : (
                uploadManager.hasUploads
                  ? `Publish (${uploadManager.pendingUploads.length} files)`
                  : 'Publish'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}