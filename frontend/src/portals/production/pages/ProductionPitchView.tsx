import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft, Eye, Share2, Bookmark, BookmarkCheck,
  Shield, MessageSquare, Clock, Calendar, User, Tag,
  Film, DollarSign, Briefcase, TrendingUp, Users,
  FileText, Download, Calculator, MapPin, Camera,
  Clapperboard, Settings,
  AlertCircle, CheckCircle, XCircle, Star, ChevronRight,
  Truck, Home, Globe, Mic, Edit3, Package, Upload, Sparkles, Heart
} from 'lucide-react';
import { pitchAPI } from '@/lib/api';
import { formatCurrency } from '@shared/utils/formatters';
import apiClient, { savedPitchesAPI } from '@/lib/api-client';
import { useBetterAuthStore } from '@/store/betterAuthStore';
import FormatDisplay from '@/components/FormatDisplay';
import { getCreditCost } from '@config/subscription-plans';
import { toast } from 'react-hot-toast';
import { ProductionService } from '../services/production.service';
import type { ProductionNoteResponse, ProductionTeamMember } from '../services/production.service';
import FollowButton from '@features/browse/components/FollowButton';
import InterestedCard from '@features/pitches/components/InterestedCard';
import { pitchService } from '@features/pitches/services/pitch.service';
import PitchDocuments from '@features/pitches/components/PitchDocuments';
import SocialProofBadge from '@shared/components/SocialProofBadge';
import FeedbackSection from '@/components/feedback/FeedbackSection';
import { CollaborationNdaModal } from '@features/teams/components/CollaborationNdaModal';

interface Pitch {
  id: string;
  userId: string;
  creatorName?: string;
  creatorCompany?: string;
  title: string;
  logline: string;
  genre: string;
  format: string;
  formatCategory?: string;
  formatSubtype?: string;
  pages?: number;
  shortSynopsis: string;
  longSynopsis?: string;
  budget: string;
  estimatedBudget?: string;
  productionTimeline?: string;
  targetAudience?: string;
  comparableFilms?: string;
  status: 'draft' | 'published' | 'in_review' | 'optioned' | 'produced';
  visibility: 'public' | 'private' | 'nda_only';
  views: number;
  likes: number;
  ratingAverage: number;
  pitcheyScoreAvg: number;
  viewerScoreAvg: number;
  createdAt: string;
  updatedAt: string;
  hasSignedNDA?: boolean;
  isCompanyMember?: boolean;
  companyTeamId?: number | null;     // team to sign the collaboration NDA for
  companyNdaSigned?: boolean;        // member has signed the company NDA (B3 Phase 2)
  collaboration?: {                  // pitch-scoped producer↔creator collaboration
    id: number;
    status: string;                  // 'pending' | 'accepted'
    role: string | null;
    withUserId: number;
    withName: string | null;
  } | null;
  requiresNDA?: boolean;           // pitch was created with NDA protection
  require_nda?: boolean;           // snake-case fallback
  creatorType?: string;            // owner's user_type — selects workspace mode
  creator_type?: string;           // snake-case as returned by getPitch
  creator?: { id?: number; name?: string; userType?: string };
  ndaCount?: number;
  thumbnail?: string;
  pitchDeck?: string;
  script?: string;
  trailer?: string;
  characters?: any[];
  locations?: string[];
  themes?: string[];
}

interface ProductionNote {
  id: string;
  content: string;
  createdAt: string;
  category: 'casting' | 'location' | 'budget' | 'schedule' | 'team' | 'general';
  author?: string;
  shared?: boolean;
}

interface PitchCompleteness {
  score: number;
  total: number;
  fields: Array<{ label: string; present: boolean; hint: string }>;
  productionReadiness: number;
  teamFilled: number;
  teamTotal: number;
}

interface TeamMember {
  role: string;
  name: string;
  status: 'confirmed' | 'pending' | 'considering';
}

const ProductionPitchView: React.FC = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const { isAuthenticated, user: authUser } = useBetterAuthStore();
  const [pitch, setPitch] = useState<Pitch | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'production' | 'team' | 'notes'>('overview');
  const [isShortlisted, setIsShortlisted] = useState(false);
  const [savedPitchId, setSavedPitchId] = useState<number | null>(null);
  const [collaborators, setCollaborators] = useState<{ name: string; userType: string; role: string }[]>([]);
  const [notes, setNotes] = useState<ProductionNote[]>([]);
  const [newNote, setNewNote] = useState('');
  const [noteCategory, setNoteCategory] = useState<ProductionNote['category']>('general');
  const [completeness, setCompleteness] = useState<PitchCompleteness | null>(null);
  const [productionChecklist, setProductionChecklist] = useState({
    scriptAnalysis: false,
    budgetBreakdown: false,
    locationScouting: false,
    castingPlan: false,
    crewAssembly: false,
    equipmentList: false,
    insuranceCoverage: false,
    distributionPlan: false,
    marketingStrategy: false,
    legalClearance: false
  });
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([
    { role: 'Director', name: '', status: 'pending' },
    { role: 'Producer', name: '', status: 'pending' },
    { role: 'Cinematographer', name: '', status: 'pending' },
    { role: 'Production Designer', name: '', status: 'pending' },
    { role: 'Editor', name: '', status: 'pending' },
    { role: 'Composer', name: '', status: 'pending' }
  ]);

  const isOwner = !!(pitch?.userId && authUser?.id && String(pitch.userId) === String(authUser.id));
  // Hybrid production workspace (Karl option B), mirrors the backend's resolveWorkspace:
  //  • production-OWNED pitch → owner + seated company members edit the one
  //    canonical workspace; NDA-signed producers VIEW read-only.
  //  • creator-OWNED pitch → any production user edits their OWN private workspace.
  const ownerIsProduction =
    (pitch?.creatorType || pitch?.creator_type || pitch?.creator?.userType) === 'production';
  // B3 Phase 2: a seated company member only collaborates once they've signed the
  // company collaboration NDA. Pending members see a sign prompt, not the workspace.
  const isCompanyMemberSigned = !!pitch?.isCompanyMember && !!pitch?.companyNdaSigned;
  const isCompanyMemberPending = !!pitch?.isCompanyMember && !pitch?.companyNdaSigned;
  const canEditWorkspace = ownerIsProduction
    ? (isOwner || isCompanyMemberSigned)
    : (authUser?.userType === 'production');
  // Anyone who may see the workspace tab CONTENT (owner, NDA-signed producer, or
  // a signed company member). Pending members are excluded — they get the prompt.
  const canSeeWorkspace = isOwner || !!pitch?.hasSignedNDA || isCompanyMemberSigned;
  const [signCompanyNda, setSignCompanyNda] = useState(false);

  // Whether this pitch was created WITH NDA protection. Pitches created without
  // one are openly accessible — so we don't offer "Request NDA Access" on them.
  const requiresNda =
    pitch?.requiresNDA ?? pitch?.require_nda ?? (pitch?.visibility === 'nda_only');

  // --- Workspace access affordances (UI/UX) -------------------------------
  // A quiet "who am I here" system shared across the Feasibility/Team/Notes
  // tabs, so the edit-vs-view split reads as intentional rather than as a
  // disabled form.
  // Evaluation mode = a producer looking at someone else's (creator-owned) pitch.
  // The Team/Notes here are a PRIVATE scratchpad scoped to this company — NOT the
  // creator's project workspace. We keep that logic but relabel + badge so it never
  // reads as if you own or are managing the creator's pitch.
  const evaluationMode = !ownerIsProduction;
  const evalCreatorName = pitch?.creatorName || pitch?.creatorCompany || 'the creator';
  // Pitch-scoped collaboration state (producer↔creator).
  const collab = pitch?.collaboration ?? null;
  const isCollaborating = collab?.status === 'accepted';
  const collabPending = collab?.status === 'pending';
  // Access chip — in evaluation mode we lead with an unmissable status badge.
  // Once the creator accepts, it flips from "not your pitch" to "Collaborating".
  const accessChip = (
    <div className="flex flex-wrap items-center justify-end gap-2">
      {evaluationMode && (
        isCollaborating ? (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 ring-1 ring-inset ring-emerald-200">
            <Users className="h-3.5 w-3.5" /> Collaborating with {evalCreatorName}
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700 ring-1 ring-inset ring-amber-200">
            <Eye className="h-3.5 w-3.5" /> Evaluating · not your pitch
          </span>
        )
      )}
      {canEditWorkspace ? (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-semibold text-indigo-700 ring-1 ring-inset ring-indigo-200">
          <Edit3 className="h-3.5 w-3.5" /> Editor
        </span>
      ) : (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-500 ring-1 ring-inset ring-slate-200">
          <Eye className="h-3.5 w-3.5" /> View only
        </span>
      )}
    </div>
  );
  const workspaceScopeNote = ownerIsProduction
    ? (canEditWorkspace ? 'Shared workspace — visible to your whole company team.' : 'Read-only access granted by your signed NDA.')
    : isCollaborating
    ? `Shared with ${evalCreatorName} — you're co-developing this pitch together. Both of you can edit the Attached Creatives and Notes.`
    : `You're planning ${evalCreatorName}'s pitch as a possible production — it isn't your project. Private to your company: ${evalCreatorName} can’t see any of this.`;
  // In evaluation mode (a creator-owned pitch you didn't create), the private
  // Team/Notes workspace stays HIDDEN until you opt in by saving the pitch to
  // your slate. Your own production pitches always have it.
  const workspaceUnlocked = !evaluationMode || isShortlisted;
  const [isLiked, setIsLiked] = useState(false);
  const [isLiking, setIsLiking] = useState(false);
  const [autoFillLoading, setAutoFillLoading] = useState(false);
  const [ndaRequested, setNdaRequested] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // If the workspace gets locked again (e.g. you un-save an evaluation pitch)
  // while you're on a hidden tab, fall back to Overview so nothing strands.
  useEffect(() => {
    if (!workspaceUnlocked && (activeTab === 'team' || activeTab === 'notes')) {
      setActiveTab('overview');
    }
  }, [workspaceUnlocked, activeTab]);

  useEffect(() => {
    if (id) {
      void fetchPitchData();
      void loadProductionData();
    }
  }, [id]);

  // Calculate pitch completeness when pitch data, checklist, or team changes
  useEffect(() => {
    if (pitch) {
      calculateCompleteness();
    }
  }, [pitch, productionChecklist, teamMembers]);

  // Auto-list the workspace collaborators (owner + creators who joined via the
  // company code). Surfaces "who's on this team" without manual entry — distinct
  // from the manually-curated creative roster below.
  useEffect(() => {
    if (!id) return;
    let live = true;
    apiClient.get<any>(`/api/production/pitches/${id}/collaborators`)
      .then((res: any) => {
        if (!live) return;
        const d = res?.data ?? res;
        setCollaborators(Array.isArray(d?.collaborators) ? d.collaborators : []);
      })
      .catch(() => { /* degrade quietly */ });
    return () => { live = false; };
  }, [id]);

  const fetchPitchData = async () => {
    try {
      setLoading(true);
      
      // Try to use public endpoint first for better compatibility
      // This ensures the pitch loads even if authentication fails
      let response;
      try {
        // First try the public endpoint which always works
        response = await pitchAPI.getPublicById(parseInt(id!));
        
        // For ANY authenticated user, fetch the authenticated record so owner/like
        // state (isLiked), hasSignedNDA, AND isCompanyMember paint — the public
        // endpoint emits none of those. This was previously gated to production
        // users, which locked the Team/Notes tabs for seated creator members (B3)
        // because isCompanyMember never reached the client. The backend getById
        // enforces access itself; a 403 falls back to public data.
        if (isAuthenticated) {
          try {
            const fullResponse = await pitchAPI.getById(parseInt(id!));
            response = fullResponse; // Use the full data if available
          } catch (authError) {
            // Fall back to public data if authenticated request fails
          }
        }
      } catch (publicError) {
        // If public endpoint fails, try authenticated as fallback
        response = await pitchAPI.getById(parseInt(id!));
      }
      
      setPitch(response);
      setIsLiked(!!(response as any).isLiked);

    } catch (error) {
      console.error('Failed to fetch pitch:', error);
      setError('Failed to load pitch details');
    } finally {
      setLoading(false);
    }
  };

  const loadProductionData = async () => {
    const pitchId = parseInt(id!, 10);
    if (!pitchId) return;

    try {
      // Load all production data from API in parallel
      const [apiNotes, apiChecklist, apiTeam] = await Promise.all([
        ProductionService.getPitchNotes(pitchId).catch(() => []),
        ProductionService.getPitchChecklist(pitchId).catch(() => ({})),
        ProductionService.getPitchTeam(pitchId).catch(() => []),
      ]);

      // Map API notes to component format
      if (apiNotes.length > 0) {
        setNotes(apiNotes.map((n: ProductionNoteResponse) => ({
          id: String(n.id),
          content: n.content,
          createdAt: n.created_at,
          category: n.category,
          author: n.author,
          shared: (n as any).shared ?? false,
        })));
      }

      // Merge API checklist with defaults (API may have subset of keys)
      if (Object.keys(apiChecklist).length > 0) {
        setProductionChecklist(prev => ({ ...prev, ...apiChecklist }));
      }

      // Use API team if available, otherwise keep defaults
      if (apiTeam.length > 0) {
        setTeamMembers(apiTeam);
      }

      // Check saved/shortlisted status from API
      try {
        const saveCheck = await savedPitchesAPI.isPitchSaved(parseInt(id!, 10));
        if (saveCheck.data?.isSaved) {
          setIsShortlisted(true);
          setSavedPitchId(saveCheck.data.savedPitchId ?? null);
        }
      } catch {
        // Ignore — not critical
      }
    } catch (err) {
      const e = err instanceof Error ? err : new Error(String(err));
      console.error('Failed to load production data:', e.message);
    }
  };

  const calculateCompleteness = () => {
    if (!pitch) return;

    const fields = [
      { label: 'Logline', present: !!(pitch.logline), hint: 'Add a one-line pitch summary' },
      { label: 'Synopsis', present: !!(pitch.longSynopsis || pitch.shortSynopsis), hint: 'Write a detailed synopsis to attract interest' },
      { label: 'Script', present: !!(pitch.script), hint: 'Upload a script — pitches with scripts get more NDA requests' },
      { label: 'Pitch Deck', present: !!(pitch.pitchDeck), hint: 'A pitch deck helps investors assess viability' },
      { label: 'Trailer / Sizzle', present: !!(pitch.trailer), hint: 'Video content dramatically increases engagement' },
      { label: 'Budget', present: !!(pitch.budget || pitch.estimatedBudget), hint: 'Include budget range for production assessment' },
      { label: 'Characters', present: !!(pitch.characters && pitch.characters.length > 0), hint: 'Define key characters for casting assessment' },
      { label: 'Target Audience', present: !!(pitch.targetAudience), hint: 'Specify who this is for — helps with distribution planning' },
    ];

    // Team assembly progress
    const filledRoles = teamMembers.filter(m => m.name && m.name.trim() !== '').length;
    const hasTeam = filledRoles > 0;
    fields.push({
      label: `Creatives (${filledRoles}/${teamMembers.length} roles)`,
      present: hasTeam,
      hint: 'Attach key creative names — pitches with attached talent read as more bankable',
    });

    const presentCount = fields.filter(f => f.present).length;

    // Production readiness from checklist
    const completed = Object.values(productionChecklist).filter(Boolean).length;
    const total = Object.keys(productionChecklist).length;
    const readinessScore = total > 0 ? Math.round((completed / total) * 100) : 0;

    setCompleteness({
      score: presentCount,
      total: fields.length,
      fields,
      productionReadiness: readinessScore,
      teamFilled: filledRoles,
      teamTotal: teamMembers.length,
    });
  };

  const handleShortlistToggle = async () => {
    const pitchId = parseInt(id!, 10);
    const wasShortlisted = isShortlisted;

    // Optimistic update
    setIsShortlisted(!wasShortlisted);

    try {
      if (wasShortlisted && savedPitchId) {
        await savedPitchesAPI.unsavePitch(savedPitchId);
        setSavedPitchId(null);
        toast.success('Removed from saved pitches');
      } else {
        const result = await savedPitchesAPI.savePitch(pitchId);
        setSavedPitchId(result.data?.id ?? null);
        toast.success('Added to saved pitches');
      }
    } catch (err) {
      // Rollback
      setIsShortlisted(wasShortlisted);
      const e = err instanceof Error ? err : new Error(String(err));
      toast.error(e.message);
    }
  };

  const handleContactCreator = () => {
    void navigate(`/production/messages?recipient=${pitch?.userId}&pitch=${id}`);
  };

  // Propose a pitch-scoped collaboration to the creator. On accept (their side)
  // the producer's private Team Plan + Notes become the shared workspace.
  const [proposingCollab, setProposingCollab] = useState(false);
  const handleProposeCollaboration = async () => {
    if (!pitch?.userId || proposingCollab) return;
    setProposingCollab(true);
    try {
      const res = await apiClient.post('/api/collaborations', {
        collaboratorId: parseInt(String(pitch.userId), 10),
        pitchId: parseInt(String(pitch.id), 10),
        role: 'co_development',
      });
      if (res.success) {
        toast.success(`Collaboration proposed to ${pitch.creatorName || 'the creator'}.`);
        await fetchPitchData(); // refresh → pitch.collaboration becomes 'pending'
      } else {
        toast.error(res.error?.message || 'Could not propose collaboration.');
      }
    } catch (err) {
      const e = err instanceof Error ? err : new Error(String(err));
      toast.error(e.message);
    } finally {
      setProposingCollab(false);
    }
  };

  // Like — production cos can like a pitch they're evaluating (mirrors PitchDetail).
  // Optimistic toggle; POST to add, DELETE to remove.
  const handleLike = async () => {
    if (!pitch) return;
    if (!isAuthenticated) { void navigate('/login/production'); return; }
    const next = !isLiked;
    setIsLiked(next);
    setPitch(p => p ? ({ ...p, likes: (p.likes || 0) + (next ? 1 : -1) }) : p);
    try {
      const { API_URL } = await import('@/config');
      const res = await fetch(`${API_URL}/api/pitches/${pitch.id}/like`, {
        method: next ? 'POST' : 'DELETE',
        credentials: 'include',
      });
      if (!res.ok) throw new Error(`Like failed: ${res.status}`);
    } catch (err) {
      // Revert on failure
      setIsLiked(!next);
      setPitch(p => p ? ({ ...p, likes: (p.likes || 0) + (next ? -1 : 1) }) : p);
    }
  };

  const handleSharePitch = async () => {
    if (!pitch) return;
    // Share the PUBLIC pitch URL (/pitch/:id), NOT the gated /production/pitch/:id
    // portal route. Only the public route has the social-unfurl Pages Function
    // (functions/pitch/[id].ts) that injects Open Graph / Twitter Card tags + a
    // preview image, so this is what renders a rich card in DMs / X / FB / iMessage.
    const url = `${window.location.origin}/pitch/${pitch.id}`;
    const title = pitch.title ? `${pitch.title} — Pitchey` : 'Pitchey';
    const text = pitch.logline || 'Check out this pitch on Pitchey.';
    // Native share sheet where supported (mobile + some desktop); clipboard fallback.
    if (navigator.share) {
      try {
        await navigator.share({ title, text, url });
        return;
      } catch (err) {
        // User dismissed the sheet → stop quietly. Other errors → clipboard fallback.
        if (err instanceof Error && err.name === 'AbortError') return;
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      toast.success('Link copied to clipboard');
    } catch {
      toast.error('Failed to copy link');
    }
  };

  const handleAddNote = async () => {
    if (!newNote.trim()) return;
    const pitchId = parseInt(id!, 10);

    // Optimistic update
    const tempNote: ProductionNote = {
      id: Date.now().toString(),
      content: newNote,
      createdAt: new Date().toISOString(),
      category: noteCategory,
      author: 'Production Team'
    };
    setNotes(prev => [...prev, tempNote]);
    setNewNote('');

    try {
      const saved = await ProductionService.createPitchNote(pitchId, {
        content: tempNote.content,
        category: tempNote.category,
        author: tempNote.author,
      });
      // Replace temp note with server-assigned ID
      setNotes(prev => prev.map(n =>
        n.id === tempNote.id
          ? { ...n, id: String(saved.id), createdAt: saved.created_at }
          : n
      ));
      toast.success('Note added');
    } catch (err) {
      const e = err instanceof Error ? err : new Error(String(err));
      // Roll back optimistic update
      setNotes(prev => prev.filter(n => n.id !== tempNote.id));
      toast.error(e.message);
    }
  };

  const handleDeleteNote = async (noteId: string) => {
    const pitchId = parseInt(id!, 10);
    const previousNotes = notes;

    // Optimistic delete
    setNotes(prev => prev.filter(n => n.id !== noteId));

    try {
      await ProductionService.deletePitchNote(pitchId, parseInt(noteId, 10));
      toast.success('Note deleted');
    } catch (err) {
      const e = err instanceof Error ? err : new Error(String(err));
      setNotes(previousNotes); // Roll back
      toast.error(e.message);
    }
  };

  const handleToggleShare = async (noteId: string) => {
    const pitchId = parseInt(id!, 10);
    const note = notes.find(n => n.id === noteId);
    if (!note) return;

    const newShared = !note.shared;
    // Optimistic update
    setNotes(prev => prev.map(n => n.id === noteId ? { ...n, shared: newShared } : n));

    try {
      await apiClient.patch(`/api/production/pitches/${pitchId}/notes/${noteId}/share`, {
        shared: newShared,
      });
      toast.success(newShared ? 'Note shared with creator' : 'Note unshared');
    } catch (err) {
      const e = err instanceof Error ? err : new Error(String(err));
      // Roll back
      setNotes(prev => prev.map(n => n.id === noteId ? { ...n, shared: !newShared } : n));
      toast.error(e.message);
    }
  };

  const handleChecklistUpdate = async (key: keyof typeof productionChecklist) => {
    const pitchId = parseInt(id!, 10);
    const updated = { ...productionChecklist, [key]: !productionChecklist[key] };
    setProductionChecklist(updated);

    try {
      await ProductionService.updatePitchChecklist(pitchId, updated);
    } catch (err) {
      const e = err instanceof Error ? err : new Error(String(err));
      // Roll back
      setProductionChecklist(prev => ({ ...prev, [key]: !prev[key] }));
      toast.error(e.message);
    }
  };

  const handleTeamUpdate = async (index: number, field: 'name' | 'status', value: string) => {
    const pitchId = parseInt(id!, 10);
    const updated = [...teamMembers];
    updated[index] = { ...updated[index], [field]: value };
    setTeamMembers(updated);

    try {
      await ProductionService.updatePitchTeam(pitchId, updated);
    } catch (err) {
      const e = err instanceof Error ? err : new Error(String(err));
      // Auto-save on each field edit — no success toast (noise), but a failed
      // save must not be silent or the producer loses edits without knowing.
      console.error('Failed to save team:', e.message);
      toast.error('Couldn\'t save team changes. Please try again.');
    }
  };

  const handleAutoFill = async (file: File) => {
    const pitchId = parseInt(id!, 10);
    setAutoFillLoading(true);

    try {
      const result = await ProductionService.aiAutofill(file);

      // Apply checklist
      if (result.checklist) {
        const merged = { ...productionChecklist, ...result.checklist };
        setProductionChecklist(merged);
        await ProductionService.updatePitchChecklist(pitchId, merged).catch(() =>
          toast.error('Checklist filled on screen but failed to save — it will not persist on reload.'));
      }

      // Apply team (preserve existing names if AI returns empty ones)
      if (result.team && result.team.length > 0) {
        const newTeam = result.team.map((aiMember) => {
          const existing = teamMembers.find(m => m.role === aiMember.role);
          return {
            role: aiMember.role,
            name: existing?.name || aiMember.name || '',
            status: (aiMember.status || existing?.status || 'pending') as 'confirmed' | 'pending' | 'considering',
          };
        });
        setTeamMembers(newTeam);
        await ProductionService.updatePitchTeam(pitchId, newTeam).catch(() =>
          toast.error('Team filled on screen but failed to save — it will not persist on reload.'));
      }

      // Apply notes — create each via API
      if (result.notes && result.notes.length > 0) {
        const validCategories = ['casting', 'location', 'budget', 'schedule', 'team', 'general'];
        for (const aiNote of result.notes) {
          const category = validCategories.includes(aiNote.category) ? aiNote.category : 'general';
          const tempNote: ProductionNote = {
            id: Date.now().toString() + Math.random().toString(36).substring(2),
            content: aiNote.content,
            createdAt: new Date().toISOString(),
            category: category as ProductionNote['category'],
            author: 'AI Auto-fill',
          };
          setNotes(prev => [...prev, tempNote]);

          try {
            const saved = await ProductionService.createPitchNote(pitchId, {
              content: tempNote.content,
              category,
              author: 'AI Auto-fill',
            });
            setNotes(prev => prev.map(n =>
              n.id === tempNote.id
                ? { ...n, id: String(saved.id), createdAt: saved.created_at }
                : n
            ));
          } catch {
            // Keep the optimistic note even if save fails
          }
        }
      }

      toast.success(`Auto-fill complete! ${result.creditsUsed} credits used.`);
      setActiveTab('production');
    } catch (err) {
      const e = err instanceof Error ? err : new Error(String(err));
      toast.error(e.message);
    } finally {
      setAutoFillLoading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const getChecklistProgress = () => {
    const completed = Object.values(productionChecklist).filter(Boolean).length;
    const total = Object.keys(productionChecklist).length;
    return (completed / total) * 100;
  };

  const getScoreColor = (score: number) => {
    if (score >= 70) return 'text-green-600';
    if (score >= 40) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getCategoryIcon = (category: ProductionNote['category']) => {
    switch (category) {
      case 'casting': return <Users className="h-4 w-4 text-purple-600" />;
      case 'location': return <MapPin className="h-4 w-4 text-blue-600" />;
      case 'budget': return <DollarSign className="h-4 w-4 text-green-600" />;
      case 'schedule': return <Calendar className="h-4 w-4 text-indigo-600" />;
      case 'team': return <Briefcase className="h-4 w-4 text-indigo-600" />;
      default: return <MessageSquare className="h-4 w-4 text-gray-600" />;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-blue-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  if (error || !pitch) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-blue-50 flex items-center justify-center p-8">
        <div className="bg-white rounded-2xl shadow-xl p-8 text-center max-w-md">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Error Loading Pitch</h2>
          <p className="text-gray-600 mb-6">{error || 'Pitch not found'}</p>
          <button
            onClick={() => navigate('/production/dashboard')}
            className="px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
          >
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-blue-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 h-14 flex items-center justify-between px-4 sm:px-6 sticky top-0 z-40">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center text-gray-600 hover:text-gray-900 text-sm"
          >
            <ArrowLeft className="h-4 w-4 mr-1.5" />
            Back
          </button>
          <span className="text-gray-300">|</span>
          <span className="text-sm font-medium text-gray-900 truncate max-w-xs">{pitch.title}</span>
        </div>

        <div className="flex items-center space-x-2 sm:space-x-3">
          {/* Like + Save now live in the unified InterestedCard in the sidebar */}
          {!isOwner && (
            <button
              onClick={handleContactCreator}
              className="flex items-center px-3 py-1.5 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700"
            >
              <MessageSquare className="h-4 w-4 sm:mr-1.5" />
              <span className="hidden sm:inline">Contact</span>
            </button>
          )}

          {isOwner && pitch && (
            <button
              onClick={() => navigate(`/production/pitches/${pitch.id}/edit`)}
              className="flex items-center px-3 py-1.5 bg-purple-600 text-white rounded-lg text-sm hover:bg-purple-700"
            >
              <Edit3 className="h-4 w-4 sm:mr-1.5" />
              <span className="hidden sm:inline">Edit</span>
            </button>
          )}

          <button
            onClick={handleSharePitch}
            className="flex items-center px-3 py-1.5 bg-gray-100 text-gray-700 rounded-lg text-sm hover:bg-gray-200"
          >
            <Share2 className="h-4 w-4 sm:mr-1.5" />
            <span className="hidden sm:inline">Share</span>
          </button>
        </div>
      </header>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column - Pitch Details */}
          <div className="lg:col-span-2">
            {/* Tabs */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 mb-6">
              <div className="flex border-b">
                {(workspaceUnlocked ? ['overview', 'production', 'team', 'notes'] : ['overview', 'production']).map((tab) => {
                  const ndaRequired = tab === 'team' || tab === 'notes';
                  // Seated company members (B3) reach Team/Notes once they've
                  // signed the company collaboration NDA — matches the tab-content
                  // gate (canSeeWorkspace). Pending members stay locked and see the
                  // sign prompt in the Access card.
                  const locked = ndaRequired && !canSeeWorkspace;
                  return (
                    <button
                      key={tab}
                      onClick={() => !locked && setActiveTab(tab as any)}
                      disabled={locked}
                      className={`flex-1 py-3 px-4 text-sm font-medium capitalize ${
                        locked
                          ? 'text-gray-300 cursor-not-allowed'
                          : activeTab === tab
                          ? 'text-indigo-600 border-b-2 border-indigo-600'
                          : 'text-gray-500 hover:text-gray-700'
                      }`}
                      title={locked ? 'NDA required to view' : undefined}
                    >
                      {tab === 'production'
                        ? 'Feasibility'
                        : tab === 'team'
                        ? (evaluationMode ? 'My Creatives' : 'Creatives')
                        : tab === 'notes'
                        ? (evaluationMode ? 'My Notes' : 'Notes')
                        : tab}
                      {locked && ' 🔒'}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Tab Content */}
            {activeTab === 'overview' && (
              <div className="space-y-6">
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-8">
                {pitch.thumbnail && (
                  <img 
                    src={pitch.thumbnail} 
                    alt={pitch.title}
                    className="w-full h-64 object-cover rounded-lg mb-6"
                  />
                )}
                
                <h1 className="text-3xl font-bold text-gray-900 mb-2">{pitch.title}</h1>
                
                {(pitch.creatorName || pitch.userId) && (
                  <div className="flex items-center gap-3 text-gray-600 mb-4">
                    {pitch.creatorName && (
                      <p>
                        by <span
                          className="hover:text-purple-600 cursor-pointer font-medium text-gray-900"
                          onClick={() => navigate(`/creator/${pitch.userId}`)}
                        >{pitch.creatorName}</span>
                        {pitch.creatorCompany && ` • ${pitch.creatorCompany}`}
                      </p>
                    )}
                    {!isOwner && pitch.userId && (
                      <FollowButton creatorId={parseInt(pitch.userId)} variant="small" />
                    )}
                  </div>
                )}
                
                <div className="flex flex-wrap gap-2 mb-6">
                  <span className="px-3 py-1 bg-indigo-100 text-indigo-700 rounded-full text-sm">
                    {pitch.genre}
                  </span>
                  <span className="px-3 py-1 bg-slate-100 text-slate-700 rounded-full text-sm">
                    <FormatDisplay
                      formatCategory={pitch.formatCategory}
                      formatSubtype={pitch.formatSubtype}
                      format={pitch.format}
                      variant="subtype-only"
                    />
                  </span>
                  <span className="px-3 py-1 bg-emerald-100 text-emerald-700 rounded-full text-sm">
                    {formatCurrency(pitch.budget)}
                  </span>
                  {pitch.pages && (
                    <span className="px-3 py-1 bg-slate-100 text-slate-700 rounded-full text-sm">
                      {pitch.pages} pages
                    </span>
                  )}
                </div>

                {/* Engagement & Social Proof */}
                <div className="mb-6">
                  <SocialProofBadge
                    pitchId={Number(pitch.id)}
                    viewCount={pitch.views ?? 0}
                    likeCount={pitch.likes ?? 0}
                    isOwner={isOwner}
                    isAuthenticated={isAuthenticated}
                  />
                  {/* Pitchey Score moved into the Feedback & Ratings section below
                      (FeedbackDisplay's headline cards) — reliable role-weighted score
                      from the ratings API, instead of the flaky pitch.ratingAverage. */}
                  <div className="mt-4">
                    <div className="bg-gray-50 rounded-lg p-3 text-center">
                      <p className="text-2xl font-bold text-gray-900">{pitch.ndaCount ?? 0}</p>
                      <p className="text-xs text-gray-500 flex items-center justify-center gap-1"><Shield className="w-3 h-3" /> NDAs Signed</p>
                    </div>
                  </div>
                </div>

                <p className="text-xl text-gray-700 mb-6 italic">"{pitch.logline}"</p>
                
                <div className="space-y-6">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">Production Overview</h3>
                    <p className="text-gray-700 whitespace-pre-wrap">{pitch.shortSynopsis}</p>
                  </div>
                  
                  {pitch.characters && pitch.characters.length > 0 && (
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900 mb-2">Key Characters</h3>
                      <div className="grid grid-cols-2 gap-3">
                        {pitch.characters.map((character: any, index: number) => (
                          <div key={index} className="p-3 bg-gray-50 rounded-lg">
                            <div className="font-medium">{character.name}</div>
                            <div className="text-sm text-gray-600">{character.description}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  {pitch.locations && pitch.locations.length > 0 && (
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900 mb-2">Key Locations</h3>
                      <div className="flex flex-wrap gap-2">
                        {pitch.locations.map((location: string, index: number) => (
                          <span key={index} className="px-3 py-1 bg-blue-50 text-blue-700 rounded-full text-sm">
                            {location}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  {pitch.comparableFilms && (
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900 mb-2">Comparable Productions</h3>
                      <p className="text-gray-700">{pitch.comparableFilms}</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Engagement Actions — unified "Interested?" box, placed ABOVE the
                  feedback so the like/follow/save controls are seen first. */}
              {!isOwner && (
                <InterestedCard
                  pitchId={pitch.id}
                  creatorId={pitch.userId ? parseInt(String(pitch.userId)) : undefined}
                  initialLiked={isLiked}
                  initialSaved={isShortlisted}
                  isAuthenticated={isAuthenticated}
                  isOwner={isOwner}
                  fromPath={`/production/pitch/${id}`}
                  // Saving an evaluation pitch is the opt-in that unlocks the
                  // private Team/Notes workspace (kept in sync without a reload).
                  onSavedChange={evaluationMode ? setIsShortlisted : undefined}
                />
              )}

              {/* Opt-in hint — only when this is someone else's pitch you haven't
                  saved yet: saving opens a private planning workspace. */}
              {evaluationMode && !isShortlisted && (
                <p className="text-sm text-gray-500 bg-indigo-50/50 ring-1 ring-inset ring-indigo-100 rounded-lg px-4 py-3">
                  💡 Save this pitch to open a private <span className="font-medium text-gray-700">Team&nbsp;Plan</span> &amp; <span className="font-medium text-gray-700">Notes</span> workspace — your space to plan it as a production. The creator never sees it.
                </p>
              )}

              {/* Collaboration bridge — once you've opted in (saved) and built a
                  plan, propose co-developing the pitch with its creator. On accept,
                  your private Team Plan + Notes become the shared workspace. */}
              {evaluationMode && workspaceUnlocked && (
                isCollaborating ? (
                  <div className="flex items-start gap-3 rounded-xl bg-emerald-50 ring-1 ring-inset ring-emerald-200 px-4 py-3.5">
                    <Users className="h-5 w-5 shrink-0 text-emerald-600" />
                    <div className="text-sm">
                      <p className="font-semibold text-emerald-800">Collaborating with {pitch?.creatorName || 'the creator'}</p>
                      <p className="mt-0.5 text-emerald-700">Your Team Plan &amp; Notes are now shared — you're both co-developing this pitch.</p>
                    </div>
                  </div>
                ) : collabPending ? (
                  <div className="flex items-start gap-3 rounded-xl bg-indigo-50 ring-1 ring-inset ring-indigo-200 px-4 py-3.5">
                    <Clock className="h-5 w-5 shrink-0 text-indigo-500" />
                    <div className="text-sm">
                      <p className="font-semibold text-indigo-800">Collaboration proposed</p>
                      <p className="mt-0.5 text-indigo-700">Waiting for {pitch?.creatorName || 'the creator'} to accept. Once they do, your plan becomes a shared workspace.</p>
                    </div>
                  </div>
                ) : (
                  <div className="rounded-xl bg-white ring-1 ring-inset ring-gray-200 px-4 py-3.5 shadow-sm">
                    <div className="flex items-start gap-3">
                      <Users className="h-5 w-5 shrink-0 text-indigo-500" />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-gray-900">Ready to develop this together?</p>
                        <p className="mt-0.5 text-sm text-gray-500">Propose a collaboration to {pitch?.creatorName || 'the creator'}. If they accept, your Team Plan &amp; Notes become a shared workspace you co-develop.</p>
                        <button
                          onClick={handleProposeCollaboration}
                          disabled={proposingCollab}
                          className="mt-3 inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-3.5 py-2 text-sm font-medium text-white transition hover:bg-indigo-700 disabled:opacity-50"
                        >
                          <Users className="h-4 w-4" />
                          {proposingCollab ? 'Proposing…' : 'Propose collaboration'}
                        </button>
                      </div>
                    </div>
                  </div>
                )
              )}

              {/* Feedback & rating — production cos can rate + leave structured
                  feedback, same as other viewers on PitchDetail. */}
              <FeedbackSection
                pitchId={Number(pitch.id)}
                isOwner={isOwner}
                isAuthenticated={isAuthenticated}
                userType={authUser?.userType || ''}
                showScoreSummary={true}
              />
              </div>
            )}

            {activeTab === 'production' && completeness && (
              <div className="space-y-6">
                {/* Pitch Completeness */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-8">
                  <h2 className="text-2xl font-bold text-gray-900 mb-1">Pitch Package Assessment</h2>
                  <p className="text-sm text-gray-500 mb-6">What the creator has provided — gaps indicate areas to request more information</p>

                  {/* Completeness Score */}
                  <div className="mb-6 p-5 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Package Completeness</h3>
                      <span className={`text-2xl font-bold ${getScoreColor(Math.round((completeness.score / completeness.total) * 100))}`}>
                        {completeness.score}/{completeness.total}
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-3">
                      <div
                        className={`h-3 rounded-full transition-all duration-300 ${
                          completeness.score >= 6 ? 'bg-green-500' :
                          completeness.score >= 4 ? 'bg-yellow-500' : 'bg-red-500'
                        }`}
                        style={{ width: `${(completeness.score / completeness.total) * 100}%` }}
                      />
                    </div>
                  </div>

                  {/* Field-by-field breakdown */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {completeness.fields.map((field) => (
                      <div
                        key={field.label}
                        className={`flex items-start gap-3 p-3 rounded-lg ${
                          field.present ? 'bg-green-50 border border-green-200' : 'bg-gray-50 border border-gray-200'
                        }`}
                      >
                        {field.present ? (
                          <CheckCircle className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
                        ) : (
                          <AlertCircle className="h-5 w-5 text-gray-400 flex-shrink-0 mt-0.5" />
                        )}
                        <div>
                          <span className={`text-sm font-medium ${field.present ? 'text-green-800' : 'text-gray-700'}`}>
                            {field.label}
                          </span>
                          {!field.present && (
                            <p className="text-xs text-gray-500 mt-0.5">{field.hint}</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Production Readiness */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-8">
                  <div className="flex items-center justify-between mb-2">
                    <h2 className="text-lg font-bold text-gray-900">Production Readiness</h2>
                    <span className={`text-lg font-bold ${getScoreColor(completeness.productionReadiness)}`}>
                      {completeness.productionReadiness}%
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2 mb-6">
                    <div
                      className="bg-indigo-500 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${completeness.productionReadiness}%` }}
                    />
                  </div>

                  {/* Production Checklist */}
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2.5">
                      <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-700">Production Checklist</h3>
                      {accessChip}
                    </div>
                    <span className="text-sm font-medium text-gray-500">{getChecklistProgress().toFixed(0)}% Complete</span>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {Object.entries(productionChecklist).map(([key, value]) => {
                      const label = key.replace(/([A-Z])/g, ' $1').trim();
                      const indicator = value ? (
                        <CheckCircle className="h-5 w-5 shrink-0 text-emerald-500" />
                      ) : (
                        <span className="h-5 w-5 shrink-0 rounded-full ring-1 ring-inset ring-gray-300" />
                      );
                      const textCls = value ? 'font-medium text-gray-900' : 'text-gray-500';
                      const boxCls = value
                        ? 'border-emerald-200 bg-emerald-50/60'
                        : 'border-gray-200 bg-gray-50/60';
                      return canEditWorkspace ? (
                        <button
                          key={key}
                          onClick={() => handleChecklistUpdate(key as keyof typeof productionChecklist)}
                          className={`flex items-center gap-2.5 rounded-lg border px-3 py-2 text-left transition hover:border-emerald-300 hover:bg-emerald-50/80 ${boxCls}`}
                        >
                          {indicator}
                          <span className={`text-sm capitalize ${textCls}`}>{label}</span>
                        </button>
                      ) : (
                        <div key={key} className={`flex items-center gap-2.5 rounded-lg border px-3 py-2 ${boxCls}`}>
                          {indicator}
                          <span className={`text-sm capitalize ${textCls}`}>{label}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'team' && canSeeWorkspace && workspaceUnlocked && (
              <div className="bg-white rounded-2xl shadow-sm ring-1 ring-gray-100 p-6 sm:p-8">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-center gap-2.5">
                    <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 ring-1 ring-inset ring-indigo-100">
                      <Users className="h-5 w-5" />
                    </span>
                    <h2 className="text-xl font-bold tracking-tight text-gray-900">{evaluationMode ? 'Your Attached Creatives' : 'Attached Creatives'}</h2>
                  </div>
                  {accessChip}
                </div>
                <p className="mt-1 mb-5 pl-[3.05rem] text-sm text-gray-500">{workspaceScopeNote}</p>

                {/* Collaborators — auto-populated from the company join codes
                    (owner + creators who redeemed a code). NOT the creative roster
                    below; nobody types these in. */}
                {collaborators.length > 0 && (
                  <div className="mb-6 rounded-xl bg-indigo-50/40 p-3.5 ring-1 ring-inset ring-indigo-100">
                    <p className="mb-2 text-[0.68rem] font-semibold uppercase tracking-wide text-indigo-500">
                      Collaborators · auto-added when they join your company code
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {collaborators.map((c, i) => {
                        const initials = (c.name || '?').trim().split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase();
                        return (
                          <span key={i} className="inline-flex items-center gap-1.5 rounded-full bg-white px-2.5 py-1 text-xs font-medium text-gray-700 ring-1 ring-inset ring-gray-200">
                            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-indigo-600 text-[0.6rem] font-semibold text-white">{initials}</span>
                            {c.name}
                            {c.role === 'owner' && <span className="text-[0.6rem] font-semibold uppercase text-indigo-400">owner</span>}
                          </span>
                        );
                      })}
                    </div>
                  </div>
                )}

                <p className="mb-2 pl-0.5 text-[0.68rem] font-semibold uppercase tracking-wide text-gray-400">Creative roster</p>
                <div className="space-y-2.5">
                  {teamMembers.map((member, index) => {
                    const initials = member.name
                      ? member.name.trim().split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase()
                      : '';
                    return (
                      <div
                        key={index}
                        className={`flex items-center gap-4 rounded-xl border p-3.5 transition ${
                          member.name
                            ? 'border-indigo-200 bg-indigo-50/40'
                            : 'border-gray-100 bg-gray-50/60'
                        }`}
                      >
                        <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-semibold ${
                          initials ? 'bg-indigo-600 text-white' : 'bg-gray-200 text-gray-400'
                        }`}>
                          {initials || <Users className="h-4 w-4" />}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="text-[0.7rem] font-semibold uppercase tracking-wide text-gray-400">{member.role}</p>
                          {canEditWorkspace ? (
                            <input
                              type="text"
                              value={member.name}
                              onChange={(e) => handleTeamUpdate(index, 'name', e.target.value)}
                              placeholder="Add a name…"
                              className="mt-0.5 w-full bg-transparent text-sm font-medium text-gray-900 placeholder:text-gray-400 placeholder:font-normal focus:outline-none"
                            />
                          ) : (
                            <p className={`mt-0.5 text-sm font-medium ${member.name ? 'text-gray-900' : 'italic text-gray-400'}`}>
                              {member.name || 'Unassigned'}
                            </p>
                          )}
                        </div>
                        {/* No status/workflow chrome — these are just names attached to
                            the pitch as metadata, not a crew-confirmation pipeline. */}
                      </div>
                    );
                  })}
                </div>

                {canEditWorkspace && (
                  <button
                    onClick={async () => {
                      try {
                        await ProductionService.updatePitchTeam(parseInt(id!, 10), teamMembers);
                        toast.success('Attached creatives saved');
                      } catch (err) {
                        const e = err instanceof Error ? err : new Error(String(err));
                        toast.error(e.message);
                      }
                    }}
                    className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700"
                  >
                    <CheckCircle className="h-4 w-4" /> Save Creatives
                  </button>
                )}
              </div>
            )}

            {activeTab === 'notes' && canSeeWorkspace && workspaceUnlocked && (
              <div className="bg-white rounded-2xl shadow-sm ring-1 ring-gray-100 p-6 sm:p-8">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-center gap-2.5">
                    <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 ring-1 ring-inset ring-indigo-100">
                      <FileText className="h-5 w-5" />
                    </span>
                    <h2 className="text-xl font-bold tracking-tight text-gray-900">{evaluationMode ? 'Your Private Notes' : 'Production Notes'}</h2>
                  </div>
                  {accessChip}
                </div>
                <p className="mt-1 mb-6 pl-[3.05rem] text-sm text-gray-500">{workspaceScopeNote}</p>

                {/* Add Note Form — editors only (owner + company members). NDA
                    viewers see the notes list below, read-only. */}
                {canEditWorkspace && (
                <div className="mb-6 p-4 bg-gray-50 rounded-lg">
                  <div className="flex space-x-2 mb-3">
                    {(['casting', 'location', 'budget', 'schedule', 'team', 'general'] as const).map((cat) => (
                      <button
                        key={cat}
                        onClick={() => setNoteCategory(cat)}
                        className={`px-3 py-1 rounded-full text-sm capitalize ${
                          noteCategory === cat
                            ? 'bg-indigo-600 text-white'
                            : 'bg-white text-gray-700 border'
                        }`}
                      >
                        {cat}
                      </button>
                    ))}
                  </div>
                  <textarea
                    value={newNote}
                    onChange={(e) => setNewNote(e.target.value)}
                    placeholder="Add a production note..."
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    rows={3}
                  />
                  <button
                    onClick={handleAddNote}
                    className="mt-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
                  >
                    Add Note
                  </button>
                </div>
                )}

                {/* Notes List */}
                <div className="space-y-3">
                  {notes.length > 0 ? (
                    notes.map((note) => (
                      <div key={note.id} className={`p-4 rounded-lg ${note.shared ? 'bg-blue-50 border border-blue-200' : 'bg-gray-50'}`}>
                        <div className="flex items-start justify-between">
                          <div className="flex items-start space-x-2">
                            {getCategoryIcon(note.category)}
                            <div>
                              <p className="text-gray-700">{note.content}</p>
                              <p className="text-xs text-gray-500 mt-1">
                                {note.author} • {new Date(note.createdAt).toLocaleString()}
                              </p>
                            </div>
                          </div>
                          {canEditWorkspace ? (
                          <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                            <button
                              onClick={() => handleToggleShare(note.id)}
                              className={`flex items-center gap-1 px-2 py-1 rounded text-xs font-medium transition ${
                                note.shared
                                  ? 'bg-blue-100 text-blue-700 hover:bg-blue-200'
                                  : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                              }`}
                              title={note.shared ? 'Shared with creator — click to unshare' : 'Share this note with the pitch creator'}
                            >
                              <Share2 className="h-3 w-3" />
                              {note.shared ? 'Shared' : 'Share'}
                            </button>
                            <button
                              onClick={() => handleDeleteNote(note.id)}
                              className="text-red-600 hover:text-red-700"
                            >
                              <XCircle className="h-4 w-4" />
                            </button>
                          </div>
                          ) : note.shared ? (
                            <span className="flex items-center gap-1 px-2 py-1 rounded text-xs font-medium bg-blue-100 text-blue-700 flex-shrink-0 ml-2">
                              <Share2 className="h-3 w-3" /> Shared
                            </span>
                          ) : null}
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-gray-500 text-center py-8">No notes yet. Start by adding production notes above.</p>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Right Column - Sidebar */}
          <div className="space-y-6">
            {/* Interested box moved above the feedback in the main column. */}

            {/* Access — the NDA is the single gate that unlocks the full script,
                pitch deck, and all production materials (no separate "request script"). */}
            {!isOwner && (
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                <h3 className="text-lg font-semibold text-gray-900">Access</h3>
                {!requiresNda ? (
                  <div className="mt-3 flex items-start gap-2.5 rounded-lg bg-emerald-50 px-3.5 py-3 text-emerald-800">
                    <CheckCircle className="h-5 w-5 shrink-0 text-emerald-600" />
                    <p className="text-sm font-medium leading-snug">No NDA required — the script &amp; production materials are open below.</p>
                  </div>
                ) : pitch?.hasSignedNDA ? (
                  <div className="mt-3 flex items-start gap-2.5 rounded-lg bg-emerald-50 px-3.5 py-3 text-emerald-800">
                    <CheckCircle className="h-5 w-5 shrink-0 text-emerald-600" />
                    <p className="text-sm font-medium leading-snug">NDA signed — the full script &amp; production materials are unlocked below.</p>
                  </div>
                ) : ndaRequested ? (
                  <div className="mt-3 flex items-start gap-2.5 rounded-lg bg-amber-50 px-3.5 py-3 text-amber-800">
                    <Clock className="h-5 w-5 shrink-0 text-amber-600" />
                    <p className="text-sm font-medium leading-snug">NDA request pending — you'll get access once the creator approves it.</p>
                  </div>
                ) : isCompanyMemberPending ? (
                  <div className="mt-3 rounded-lg bg-amber-50 px-3.5 py-3 text-amber-900">
                    <div className="flex items-start gap-2.5">
                      <Shield className="h-5 w-5 shrink-0 text-amber-600" />
                      <p className="text-sm font-medium leading-snug">
                        Sign the {pitch?.creator?.name || 'company'} NDA to start collaborating on this project.
                      </p>
                    </div>
                    <button
                      onClick={() => setSignCompanyNda(true)}
                      className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg bg-purple-600 px-4 py-2.5 font-medium text-white shadow-sm transition hover:bg-purple-700"
                    >
                      <Shield className="h-4 w-4" /> Sign NDA to collaborate
                    </button>
                  </div>
                ) : isCompanyMemberSigned ? (
                  <div className="mt-3 flex items-start gap-2.5 rounded-lg bg-indigo-50 px-3.5 py-3 text-indigo-800">
                    <Users className="h-5 w-5 shrink-0 text-indigo-600" />
                    <p className="text-sm font-medium leading-snug">You're collaborating on this project as a company member.</p>
                  </div>
                ) : !(authUser?.userType === 'investor' || authUser?.userType === 'production') ? (
                  <p className="mt-3 text-sm leading-relaxed text-gray-500">The full script &amp; materials are released under an NDA to evaluating investors and production companies.</p>
                ) : (
                  <>
                    <p className="mt-1 mb-4 text-sm leading-relaxed text-gray-500">Sign an NDA to unlock the full script, pitch deck, and production materials.</p>
                    <button
                      onClick={async () => {
                        if (!id) return;
                        if (!confirm(`Request NDA access? This costs ${getCreditCost('nda_request')} credits.`)) return;
                        try {
                          const res = await apiClient.post('/api/ndas/request', { pitchId: id });
                          if (res.success) {
                            setNdaRequested(true);
                            toast.success('NDA request sent');
                          } else {
                            toast.error((res.error as any)?.message || 'Failed to request NDA');
                          }
                        } catch (err) {
                          const e = err instanceof Error ? err : new Error(String(err));
                          toast.error(e.message);
                        }
                      }}
                      className="flex w-full items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 font-medium text-white shadow-sm transition hover:bg-indigo-700"
                    >
                      <Shield className="h-4 w-4" />
                      Request NDA Access · {getCreditCost('nda_request')} credits
                    </button>
                    <p className="mt-3 text-center text-xs text-gray-400">Questions for the creator? Use Contact above.</p>
                  </>
                )}
              </div>
            )}

            {/* Production Requirements */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Production Requirements</h3>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="flex items-center text-gray-600">
                    <Film className="h-4 w-4 mr-2" />
                    Format
                  </span>
                  <FormatDisplay 
                    formatCategory={pitch.formatCategory}
                    formatSubtype={pitch.formatSubtype}
                    format={pitch.format}
                    variant="compact"
                  />
                </div>
                <div className="flex items-center justify-between">
                  <span className="flex items-center text-gray-600">
                    <DollarSign className="h-4 w-4 mr-2" />
                    Budget
                  </span>
                  <span className="font-semibold">{formatCurrency(pitch.budget)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="flex items-center text-gray-600">
                    <Clock className="h-4 w-4 mr-2" />
                    Timeline
                  </span>
                  <span className="font-semibold">{pitch.productionTimeline || '9-12 months'}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="flex items-center text-gray-600">
                    <MapPin className="h-4 w-4 mr-2" />
                    Locations
                  </span>
                  <span className="font-semibold">{pitch.locations?.length || 'TBD'}</span>
                </div>
              </div>
            </div>

            {/* AI Assessment — owner only. Removed when viewing someone else's pitch
                (a production user assessing another creator's pitch shouldn't see the
                owner-side auto-fill toolkit). */}
            {isOwner && <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-3">AI Assessment</h3>
              <p className="text-sm text-gray-500 mb-4">
                Upload a script, treatment, or pitch deck to auto-fill the feasibility checklist, team priorities, and production notes.
              </p>
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.txt,.docx"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void handleAutoFill(file);
                }}
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={autoFillLoading}
                className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-lg hover:from-indigo-700 hover:to-purple-700 transition disabled:opacity-50 text-sm font-medium shadow-sm"
              >
                {autoFillLoading ? (
                  <>
                    <Sparkles className="h-4 w-4 animate-pulse" />
                    Analyzing document...
                  </>
                ) : (
                  <>
                    <Upload className="h-4 w-4" />
                    Auto-fill from Document
                  </>
                )}
              </button>
              <p className="text-xs text-gray-400 mt-2 text-center">PDF, TXT, or DOCX — 5 credits</p>
            </div>}

            {/* Documents — show full links post-NDA, attachment status pre-NDA */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Production Materials</h3>
              {(isOwner || pitch.hasSignedNDA || !requiresNda) ? (
                ((pitch as any).documents?.length || pitch.script || pitch.pitchDeck || pitch.trailer) ? (
                  <PitchDocuments
                    documents={(pitch as any).documents}
                    script={pitch.script}
                    pitchDeck={pitch.pitchDeck}
                    trailer={pitch.trailer}
                  />
                ) : (
                  <p className="text-gray-500 text-sm">No materials attached</p>
                )
              ) : (
                <div className="space-y-2">
                  <div className="flex items-center justify-between p-2">
                    <span className="flex items-center text-gray-700"><FileText className="h-4 w-4 mr-2" />Full Script</span>
                    <span className={`text-xs font-medium px-2 py-1 rounded-full ${pitch.script ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                      {pitch.script ? 'Attached' : 'Not attached'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between p-2">
                    <span className="flex items-center text-gray-700"><FileText className="h-4 w-4 mr-2" />Pitch Deck</span>
                    <span className={`text-xs font-medium px-2 py-1 rounded-full ${pitch.pitchDeck ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                      {pitch.pitchDeck ? 'Attached' : 'Not attached'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between p-2">
                    <span className="flex items-center text-gray-700"><Film className="h-4 w-4 mr-2" />Concept Trailer</span>
                    <span className={`text-xs font-medium px-2 py-1 rounded-full ${pitch.trailer ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                      {pitch.trailer ? 'Attached' : 'Not attached'}
                    </span>
                  </div>
                  <p className="text-xs text-gray-400 mt-2">Sign the NDA to download materials</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {signCompanyNda && pitch?.companyTeamId && (
        <CollaborationNdaModal
          teamId={pitch.companyTeamId}
          company={pitch?.creator?.name || 'the company'}
          defaultName={(authUser as any)?.name || (authUser as any)?.username || ''}
          onClose={() => setSignCompanyNda(false)}
          onSigned={() => { setSignCompanyNda(false); void fetchPitchData(); }}
        />
      )}
    </div>
  );
};

export default ProductionPitchView;