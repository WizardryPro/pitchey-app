import { useState, useEffect } from 'react';
import { useOnlineStatus } from '@/shared/hooks/useOnlineStatus';
import { useNavigate, useParams } from 'react-router-dom';
import { Save, X, Upload, FileText, Video, Image as ImageIcon, Shield, WifiOff } from 'lucide-react';
import { pitchService } from '@features/pitches/services/pitch.service';
import { useBetterAuthStore } from '../store/betterAuthStore';
import { uploadService } from '@features/uploads/services/upload.service';
import type { Pitch, UpdatePitchInput } from '@shared/types/api';
import { getGenresSync } from '@config/pitchConstants';
import { usePortalTheme } from '@shared/hooks/usePortalTheme';
import { CharacterManagement } from '@features/pitches/components/CharacterManagement';
import type { Character } from '@shared/types/character';
import { normalizeCharacters, serializeCharacters } from '@features/pitches/utils/characterUtils';
import { DocumentUpload } from '@features/uploads/components/DocumentUpload';
import type { DocumentFile } from '@features/uploads/components/DocumentUpload';
import { CreativeRosterManager, type CreativeAttachment } from '@features/pitches/components/PitchForm/EnhancedPitchFormSections';

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
  longSynopsis: string;
  budgetRange: string;
  estimatedBudget: string;
  targetAudience: string;
  productionTimeline: string;
  targetReleaseDate: string;
  visibilitySettings: {
    showShortSynopsis: boolean;
    showCharacters: boolean;
    showBudget: boolean;
    showMedia: boolean;
    showCreatorName: boolean;
  };
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
  creativeAttachments: CreativeAttachment[];
}

export default function PitchEdit() {
  const navigate = useNavigate();
  const theme = usePortalTheme();
  const { id } = useParams<{ id: string }>();
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [genres] = useState<readonly string[] | string[]>(getGenresSync());
  const [existingImageUrl, setExistingImageUrl] = useState<string | null>(null);
  const isOnline = useOnlineStatus();
  // Redirect to the editor's OWN portal pitch list after save/back/cancel. Hardcoding
  // '/creator/pitches' bounced production users to /login/creator (a creator-gated route)
  // after a save that actually SUCCEEDED — experienced as "edit threw an error / lost work".
  const userType = useBetterAuthStore((s) => s.user?.userType);
  const pitchesListPath = userType === 'production' ? '/production/pitches' : '/creator/pitches';


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
    longSynopsis: '',
    budgetRange: '',
    estimatedBudget: '',
    targetAudience: '',
    productionTimeline: '',
    targetReleaseDate: '',
    visibilitySettings: {
      showShortSynopsis: true,
      showCharacters: false,
      showBudget: false,
      showMedia: false,
      showCreatorName: true,
    },
    image: null,
    pdf: null,
    video: null,
    documents: [],
    ndaConfig: {
      requireNDA: false,
      ndaType: 'none',
      customNDA: null
    },
    characters: [],
    creativeAttachments: []
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
      // Fetch via the owner-authenticated endpoint (/api/pitches/:id), NOT the
      // public one. getById() hits /api/pitches/public/:id which 404s for DRAFTS
      // (drafts aren't public) — so creators could never edit their own drafts
      // ("Failed to load pitch"). getByIdAuthenticated returns the owner's pitch
      // regardless of draft/published status.
      const pitch = await pitchService.getByIdAuthenticated(pitchId);

      if (!pitch) {
        throw new Error('Pitch not found');
      }

      // Normalize stored genre to match the select option casing.
      // Older pitches were saved with a .toLowerCase() transform
      // (e.g. "action-comedy") but the options have Title-Case values
      // (e.g. "Action-Comedy"). Do a case-insensitive lookup so the
      // select re-populates correctly regardless of what the DB stored.
      const rawGenre = pitch.genre || '';
      const availableGenres = getGenresSync() as readonly string[];
      const normalizedGenre = availableGenres.find(
        g => g.toLowerCase() === rawGenre.toLowerCase()
      ) ?? rawGenre;

      // Resolve Format Category + Subtype. Prefer the stored structured values
      // (new pitches). Older pitches stored only a lowercased `format` (the subtype),
      // leaving category/subtype empty → "Save Changes" stayed disabled. For those,
      // reverse-derive the (category, subtype) pair from the formatCategories
      // taxonomy by case-insensitively matching the stored format string.
      let resolvedCategory = pitch.formatCategory || '';
      let resolvedSubtype = pitch.formatSubtype || '';
      if (!resolvedCategory || !resolvedSubtype) {
        const rawFormat = (pitch.format || '').toLowerCase();
        if (rawFormat) {
          for (const [cat, subs] of Object.entries(formatCategories)) {
            const matchSub = (subs as string[]).find(s => s.toLowerCase() === rawFormat);
            if (matchSub) { resolvedCategory = cat; resolvedSubtype = matchSub; break; }
          }
        }
      }

      setExistingImageUrl(pitch.titleImage || (pitch as any).title_image || null);
      setFormData({
        title: pitch.title || '',
        genre: normalizedGenre,
        format: pitch.format || '',
        formatCategory: resolvedCategory,
        formatSubtype: resolvedSubtype,
        customFormat: pitch.customFormat || '',
        logline: pitch.logline || '',
        shortSynopsis: pitch.shortSynopsis || '',
        themes: pitch.themes || '',
        worldDescription: pitch.worldDescription || '',
        longSynopsis: (pitch as any).longSynopsis ?? (pitch as any).long_synopsis ?? '',
        budgetRange: (pitch as any).budgetRange ?? (pitch as any).budget_range ?? pitch.budget ?? '',
        // Numeric USD budget — load the structured column only (the legacy free-text
        // estimated_budget may be "£400K"/ranges that don't fit a numeric input).
        estimatedBudget: (pitch as any).estimated_budget_usd != null
          ? String((pitch as any).estimated_budget_usd)
          : ((pitch as any).estimatedBudgetUsd != null ? String((pitch as any).estimatedBudgetUsd) : ''),
        targetAudience: (pitch as any).targetAudience ?? (pitch as any).target_audience ?? '',
        productionTimeline: (pitch as any).productionTimeline ?? (pitch as any).production_timeline ?? '',
        targetReleaseDate: (pitch as any).targetReleaseDate ?? (pitch as any).target_release_date ?? '',
        visibilitySettings: {
          showShortSynopsis: (pitch as any).visibility_settings?.showShortSynopsis ?? (pitch as any).visibilitySettings?.showShortSynopsis ?? true,
          showCharacters: (pitch as any).visibility_settings?.showCharacters ?? (pitch as any).visibilitySettings?.showCharacters ?? false,
          showBudget: (pitch as any).visibility_settings?.showBudget ?? (pitch as any).visibilitySettings?.showBudget ?? false,
          showMedia: (pitch as any).visibility_settings?.showMedia ?? (pitch as any).visibilitySettings?.showMedia ?? false,
          // undefined → true (existing pitches keep showing the name)
          showCreatorName: (pitch as any).visibility_settings?.showCreatorName ?? (pitch as any).visibilitySettings?.showCreatorName ?? true,
        },
        image: null,
        pdf: null,
        video: null,
        // Load the pitch's existing documents so they're visible (and not lost)
        // on the edit/manage screen. They're marked completed with a url and no
        // File, so the save loop's `d.file && !d.url` filter skips re-uploading
        // them. (Previously hardcoded to [] → uploaded docs vanished from edit.)
        documents: (Array.isArray((pitch as any).documents) ? (pitch as any).documents : []).map(
          (d: any, i: number): DocumentFile => ({
            id: String(d.id ?? d.fileKey ?? d.file_key ?? `existing-${i}`),
            type: (d.documentType ?? d.document_type ?? d.type ?? 'supporting_materials') as DocumentFile['type'],
            title: d.fileName ?? d.file_name ?? d.originalFileName ?? d.original_file_name ?? d.title ?? 'Document',
            url: d.fileUrl ?? d.file_url ?? d.url,
            size: d.fileSize ?? d.file_size ?? d.size ?? undefined,
            // Reflect the saved NDA state so the toggle shows reality on edit.
            requiresNda: d.requiresNda ?? d.requires_nda ?? undefined,
            uploadStatus: 'completed',
            uploadProgress: 100,
            // No File for already-persisted docs — the component null-guards on this.
            file: undefined,
          })
        ),
        ndaConfig: {
          requireNDA: pitch.requireNDA || false,
          ndaType: pitch.requireNDA ? 'platform' : 'none',
          customNDA: null
        },
        characters: normalizeCharacters(pitch.characters),
        // Creative-team cards. The backend getters now return these (they were
        // saved on create but never read back), and pitchService maps them to
        // camelCase. Ensure each has a stable id so the manager's keying works.
        creativeAttachments: (Array.isArray((pitch as any).creativeAttachments) ? (pitch as any).creativeAttachments : []).map(
          (c: any, i: number): CreativeAttachment => ({
            id: String(c.id ?? `existing-${i}`),
            name: c.name ?? '',
            role: c.role ?? '',
            bio: c.bio ?? '',
            imdbLink: c.imdbLink ?? c.imdb_link ?? '',
            websiteLink: c.websiteLink ?? c.website_link ?? '',
          })
        )
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
        longSynopsis: formData.longSynopsis || undefined,
        budgetRange: formData.budgetRange || undefined,
        // Always send the key (number or null) so the server can tell "cleared"
        // (null → clears) from "not edited" (key absent → preserved). undefined
        // would drop the key and make the budget unclearable.
        estimatedBudgetUsd: formData.estimatedBudget ? Number(formData.estimatedBudget) : null,
        targetAudience: formData.targetAudience || undefined,
        productionTimeline: formData.productionTimeline || undefined,
        targetReleaseDate: formData.targetReleaseDate || undefined,
        visibilitySettings: formData.visibilitySettings,
        requireNDA: formData.ndaConfig.requireNDA,
        characters: serializeCharacters(formData.characters),
        // Send the full creative-team list. The update handler deletes + re-inserts
        // pitch_creative_attachments, so the array must always reflect the current
        // desired state (empty array clears them). Drop seeded-but-unfilled roster
        // rows (the standard roles render empty until a name is typed).
        creativeAttachments: (formData.creativeAttachments || []).filter(
          (a: CreativeAttachment) => a.name?.trim()
        ),
      };

      // Collects names of any media/documents that failed to upload during this
      // save so we can surface them without aborting the whole update.
      const failedDocs: string[] = [];

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

      // Upload the standalone Script/Treatment PDF (this widget previously
      // accepted a file but never uploaded it — silent data loss). Attach it as
      // a 'script' document so it surfaces alongside other pitch documents.
      if (formData.pdf) {
        try {
          await uploadService.uploadDocument(formData.pdf, 'script', {
            pitchId: parseInt(id!),
            requiresNda: true,
          });
        } catch (pdfErr) {
          console.error('Script/Treatment PDF upload failed:', pdfErr);
          failedDocs.push(formData.pdf.name);
        }
      }

      // Upload the pitch video (same prior gap — staged but never saved) and set
      // it as the pitch video URL.
      if (formData.video) {
        try {
          const vid = await uploadService.uploadDocument(formData.video, 'video', {
            pitchId: parseInt(id!),
            folder: 'pitch-videos',
          });
          if (vid.url) {
            updateData.videoUrl = vid.url;
          }
        } catch (vidErr) {
          console.error('Pitch video upload failed:', vidErr);
          failedDocs.push(formData.video.name);
        }
      }

      // Upload any newly added project documents (scripts, decks, budget, etc.)
      // and link them to this pitch. Each carries its own document_type so it
      // surfaces in the right slot on the pitch view. Per-document failures are
      // collected rather than aborting the whole save.
      const pendingDocs = formData.documents.filter((d) => d.file && !d.url);
      for (const doc of pendingDocs) {
        const file = doc.file;
        if (!file) continue; // already guaranteed by the filter; narrows the optional type
        try {
          await uploadService.uploadDocument(file, doc.type, {
            pitchId: parseInt(id!),
            requiresNda: doc.requiresNda ?? true,
          });
        } catch (docErr) {
          console.error('Document upload failed:', doc.title, docErr);
          failedDocs.push(doc.title || file.name);
        }
      }

      await pitchService.update(parseInt(id!), updateData);
      if (failedDocs.length > 0) {
        alert(`Pitch saved, but these documents failed to upload: ${failedDocs.join(', ')}. Please try uploading them again.`);
      }
      navigate(pitchesListPath);
    } catch (error) {
      console.error('Error updating pitch:', error);
      alert(error instanceof Error ? error.message : 'Failed to update pitch');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className={`animate-spin rounded-full h-12 w-12 border-b-2 ${theme.spinnerBorder}`}></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-gray-900">Error</h1>
        <div className="py-8 text-center">
          <p className="text-gray-600">{error}</p>
          <button
            onClick={() => navigate(pitchesListPath)}
            className={`mt-4 px-4 py-2 rounded-lg transition ${theme.btnPrimary}`}
          >
            Back to Pitches
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page heading — global chrome comes from PortalLayout's MinimalHeader */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Edit Pitch</h1>
        <p className="text-sm text-gray-500 mt-1">Update your pitch information</p>
      </div>

      {/* Form */}
      <div>
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
                  className={`w-full px-3 py-2 border border-gray-300 rounded-lg ${theme.inputFocus}`}
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
                  className={`w-full px-3 py-2 border border-gray-300 rounded-lg ${theme.inputFocus}`}
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
                  className={`w-full px-3 py-2 border rounded-lg transition-colors border-gray-300 ${theme.inputFocus} focus:ring-offset-2`}
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
                    className={`w-full px-3 py-2 border rounded-lg transition-colors border-gray-300 ${theme.inputFocus} focus:ring-offset-2`}
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
                    className={`w-full px-3 py-2 border border-gray-300 rounded-lg ${theme.inputFocus}`}
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
                className={`w-full px-3 py-2 border border-gray-300 rounded-lg ${theme.inputFocus}`}
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
                className={`w-full px-3 py-2 border border-gray-300 rounded-lg ${theme.inputFocus}`}
                placeholder="Provide a brief overview of your story, main characters, and key plot points (1-2 paragraphs)"
                required
              />
              <p className="text-xs text-gray-500 mt-1">
                {formData.shortSynopsis.length}/500 characters recommended
              </p>
            </div>

            <div className="mt-6">
              <label htmlFor="longSynopsis" className="block text-sm font-medium text-gray-700 mb-2">
                Long Synopsis <span className="text-gray-400 font-normal">(optional)</span>
              </label>
              <textarea
                id="longSynopsis"
                name="longSynopsis"
                value={formData.longSynopsis}
                onChange={handleInputChange}
                rows={8}
                maxLength={5000}
                className={`w-full px-3 py-2 border border-gray-300 rounded-lg ${theme.inputFocus}`}
                placeholder="A detailed, scene-by-scene account of the full story — the deeper read for interested parties."
              />
              <p className="text-xs text-gray-500 mt-1">{formData.longSynopsis.length}/5000 characters</p>
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
                  className={`w-full px-3 py-2 border border-gray-300 rounded-lg ${theme.inputFocus}`}
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
                  className={`w-full px-3 py-2 border border-gray-300 rounded-lg ${theme.inputFocus}`}
                  placeholder="Describe the world, setting, and environment of your story. Include time period, location, atmosphere, visual style, and any unique world-building elements..."
                />
                <p className="text-xs text-gray-500 mt-1">
                  {formData.worldDescription.length}/2000 characters | Describe the world and setting in detail
                </p>
              </div>
            </div>
          </div>

          {/* Market & Production Section */}
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-6">Market & Production</h2>
            <div className="space-y-6">
              <div>
                <label htmlFor="targetAudience" className="block text-sm font-medium text-gray-700 mb-2">
                  Target Audience <span className="text-gray-400 font-normal">(optional)</span>
                </label>
                <textarea
                  id="targetAudience"
                  name="targetAudience"
                  value={formData.targetAudience}
                  onChange={handleInputChange}
                  rows={3}
                  maxLength={2000}
                  className={`w-full px-3 py-2 border border-gray-300 rounded-lg ${theme.inputFocus}`}
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
                  value={formData.productionTimeline}
                  onChange={handleInputChange}
                  rows={3}
                  maxLength={2000}
                  className={`w-full px-3 py-2 border border-gray-300 rounded-lg ${theme.inputFocus}`}
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
                  value={formData.targetReleaseDate}
                  onChange={handleInputChange}
                  maxLength={50}
                  className={`w-full px-3 py-2 border border-gray-300 rounded-lg ${theme.inputFocus}`}
                  placeholder="e.g. Q4 2027, or a target month/year"
                />
              </div>
            </div>
          </div>

          {/* Budget Section — numeric USD, capped at $1B (Karl P4) */}
          <div className="bg-white rounded-xl shadow-sm p-6">
            <label htmlFor="estimatedBudget" className="block text-sm font-medium text-gray-700 mb-2">
              Budget <span className="text-gray-400 font-normal">(USD)</span>
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
                  setFormData((prev) => ({ ...prev, estimatedBudget: capped }));
                }}
                disabled={isSubmitting}
                className="w-full pl-7 pr-14 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:outline-none truncate"
                placeholder="50,000,000"
                aria-describedby="budget-help-edit"
              />
              <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs font-medium text-gray-400">USD</span>
            </div>
            <p id="budget-help-edit" className="text-xs text-gray-500 mt-1">
              Shown in US dollars so budgets are comparable globally (payments are still processed in EUR). Max $1,000,000,000.
            </p>
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
                { key: 'showBudget', label: 'Show budget', desc: 'Display the budget publicly.' },
                { key: 'showMedia', label: 'Show media', desc: 'Display images and media publicly.' },
                { key: 'showCreatorName', label: 'Show creator name', desc: 'When off, anonymous (logged-out) visitors see "Anonymous Creator"; signed-in users still see your name.' },
              ] as const).map((opt) => {
                // showCreatorName defaults to shown when unset (backward compat)
                const checked = opt.key === 'showCreatorName'
                  ? formData.visibilitySettings[opt.key] !== false
                  : !!formData.visibilitySettings[opt.key];
                return (
                  <label key={opt.key} className="flex items-start gap-3 p-3 rounded-lg border border-gray-200 hover:border-gray-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => setFormData(prev => ({
                        ...prev,
                        visibilitySettings: { ...prev.visibilitySettings, [opt.key]: !checked },
                      }))}
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

          {/* Characters Section */}
          <div className="bg-white rounded-xl shadow-sm p-6">
            <CharacterManagement
              characters={formData.characters}
              onChange={(characters) => setFormData(prev => ({ ...prev, characters }))}
              maxCharacters={10}
            />
          </div>

          {/* Creative Team Section — mirrors the production pitch "Attached Creatives" roster */}
          <div className="bg-white rounded-xl shadow-sm p-6">
            <CreativeRosterManager
              attachments={formData.creativeAttachments || []}
              onChange={(creativeAttachments) => setFormData(prev => ({ ...prev, creativeAttachments }))}
            />
          </div>

          {/* Document Upload Section */}
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-1">Project Documents</h2>
            <p className="text-sm text-gray-500 mb-6">
              All optional. A lookbook (visual pitch deck) is a great add-on — choose the
              "Lookbook" type after selecting your file.
            </p>

            <DocumentUpload
              documents={formData.documents}
              onChange={handleDocumentChange}
              pitchId={id ? parseInt(id) : undefined}
              maxFiles={15}
              maxFileSize={10}
              disabled={isSubmitting}
              // Single upload path: stage here, upload once on Save (the save loop).
              // With autoUpload=true the component ALSO uploaded on-add, racing the
              // save loop and causing the same file to upload twice. Karl R3.
              autoUpload={false}
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

              <div className={`border-2 border-dashed border-gray-300 rounded-lg p-6 text-center transition ${theme.borderAccentHover}`}>
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
                  className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg transition cursor-pointer ${theme.btnPrimary}`}
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
              <div className={`border-2 border-dashed border-gray-300 rounded-lg p-6 text-center transition ${theme.borderAccentHover}`}>
                {formData.pdf ? (
                  <div className="flex items-center justify-between bg-gray-50 rounded-lg p-3">
                    <div className="flex items-center gap-3">
                      <FileText className={`w-5 h-5 ${theme.textAccent}`} />
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

          </div>

          {/* Optional Extras — sizzle reel / trailer + lookbook are nice-to-have, not required (Karl feedback) */}
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-1">Optional Extras</h2>
            <p className="text-sm text-gray-500 mb-6">
              Add-ons that make your pitch stand out — none of these are required. Upload a sizzle
              reel or trailer here, and add a lookbook (visual pitch deck) under Project Documents.
            </p>

            {/* Video Upload (sizzle reel / trailer) */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Sizzle Reel or Trailer <span className="text-gray-400 font-normal">(optional)</span>
              </label>
              <div className={`border-2 border-dashed border-gray-300 rounded-lg p-6 text-center transition ${theme.borderAccentHover}`}>
                {formData.video ? (
                  <div className="flex items-center justify-between bg-gray-50 rounded-lg p-3">
                    <div className="flex items-center gap-3">
                      <Video className={`w-5 h-5 ${theme.textAccent}`} />
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
                    <p className="text-sm text-gray-600 mb-2">Upload a sizzle reel or trailer (optional)</p>
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
                      className={`mt-1 w-4 h-4 ${theme.textAccent}`}
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
                      className={`mt-1 w-4 h-4 ${theme.textAccent}`}
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
                      className={`mt-1 w-4 h-4 ${theme.textAccent}`}
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
              onClick={() => navigate(pitchesListPath)}
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