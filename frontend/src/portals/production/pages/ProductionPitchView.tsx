import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft, Eye, Heart, Share2, Bookmark, BookmarkCheck,
  Shield, MessageSquare, Clock, Calendar, User, Tag,
  Film, DollarSign, Briefcase, TrendingUp, Users,
  FileText, Download, Calculator, MapPin, Camera,
  Clapperboard, Settings, CheckSquare, Square,
  AlertCircle, CheckCircle, XCircle, Star, ChevronRight,
  Truck, Home, Globe, Mic, Edit3, Package, Upload, Sparkles
} from 'lucide-react';
import { pitchAPI } from '@/lib/api';
import apiClient, { savedPitchesAPI } from '@/lib/api-client';
import { useBetterAuthStore } from '@/store/betterAuthStore';
import FormatDisplay from '@/components/FormatDisplay';
import { getCreditCost } from '@config/subscription-plans';
import { ScheduleMeetingModal } from '@/components/UIActions/ScheduleMeetingModal';
import { toast } from 'react-hot-toast';
import { ProductionService } from '../services/production.service';
import type { ProductionNoteResponse, ProductionTeamMember } from '../services/production.service';
import StartProjectModal from '../components/StartProjectModal';
import { CollaboratorService } from '@/services/collaborator.service';
import FollowButton from '@features/browse/components/FollowButton';
import { pitchService } from '@features/pitches/services/pitch.service';
import SocialProofBadge from '@shared/components/SocialProofBadge';

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
  createdAt: string;
  updatedAt: string;
  hasSignedNDA?: boolean;
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
}

interface PitchCompleteness {
  score: number;
  total: number;
  fields: Array<{ label: string; present: boolean; hint: string }>;
  productionReadiness: number;
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
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [showStartProjectModal, setShowStartProjectModal] = useState(false);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([
    { role: 'Director', name: '', status: 'pending' },
    { role: 'Producer', name: '', status: 'pending' },
    { role: 'Cinematographer', name: '', status: 'pending' },
    { role: 'Production Designer', name: '', status: 'pending' },
    { role: 'Editor', name: '', status: 'pending' },
    { role: 'Composer', name: '', status: 'pending' }
  ]);

  const isOwner = !!(pitch?.userId && authUser?.id && String(pitch.userId) === String(authUser.id));
  const [isLiked, setIsLiked] = useState(false);
  const [isLiking, setIsLiking] = useState(false);
  const [hasExistingProject, setHasExistingProject] = useState(false);
  const [linkedProjectId, setLinkedProjectId] = useState<number | null>(null);
  const [autoFillLoading, setAutoFillLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (id) {
      fetchPitchData();
      loadProductionData();
      // Check if a pipeline project already exists for this pitch
      void apiClient.get<{ projects: Array<{ id: number }> }>(`/api/production/projects?pitchId=${id}`)
        .then(async (res) => {
          if (res.success && res.data?.projects && res.data.projects.length > 0) {
            setHasExistingProject(true);
            const projectId = res.data.projects[0].id;
            setLinkedProjectId(projectId);
            // Fetch accepted collaborators and merge into team
            try {
              const collabRes = await CollaboratorService.listCollaborators(projectId);
              if (collabRes.success && collabRes.data?.collaborators) {
                mergeCollaboratorsIntoTeam(collabRes.data.collaborators);
              }
            } catch {
              // Non-critical — team tab still works with manual entries
            }
          }
        })
        .catch(() => {});
    }
  }, [id]);

  // Calculate pitch completeness when pitch data or checklist changes
  useEffect(() => {
    if (pitch) {
      calculateCompleteness();
    }
  }, [pitch, productionChecklist]);

  const fetchPitchData = async () => {
    try {
      setLoading(true);
      
      // Try to use public endpoint first for better compatibility
      // This ensures the pitch loads even if authentication fails
      let response;
      try {
        // First try the public endpoint which always works
        response = await pitchAPI.getPublicById(parseInt(id!));
        
        // If user is authenticated and has proper access, try to get enhanced data
        if (isAuthenticated && authUser?.userType === 'production' && response.hasSignedNDA) {
          // User has signed NDA, try to get full authenticated data
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

  const COLLAB_ROLE_MAP: Record<string, string> = {
    director: 'Director',
    line_producer: 'Producer',
    dp: 'Cinematographer',
    production_designer: 'Production Designer',
    editor: 'Editor',
    sound_designer: 'Sound Designer',
  };

  const mergeCollaboratorsIntoTeam = (collaborators: Array<{ status: string; role: string; custom_role_name?: string | null; user?: { name: string } | null; invited_email: string }>) => {
    const accepted = collaborators.filter(c => c.status === 'active');
    if (accepted.length === 0) return;

    setTeamMembers(prev => {
      const updated = [...prev];
      const addedRoles = new Set<string>();

      for (const collab of accepted) {
        const displayRole = collab.role === 'custom'
          ? (collab.custom_role_name || 'Custom')
          : (COLLAB_ROLE_MAP[collab.role] || collab.role);
        const name = collab.user?.name || collab.invited_email || '';

        // Try to match an existing team slot with empty name
        const existingIdx = updated.findIndex(
          m => m.role === displayRole && (!m.name || m.name === '')
        );

        if (existingIdx >= 0) {
          updated[existingIdx] = { role: displayRole, name, status: 'confirmed' };
          addedRoles.add(displayRole);
        } else if (!addedRoles.has(displayRole)) {
          updated.push({ role: displayRole, name, status: 'confirmed' });
          addedRoles.add(displayRole);
        }
      }

      return updated;
    });
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
    navigate(`/production/messages?recipient=${pitch?.userId}&pitch=${id}`);
  };

  const handleLike = async () => {
    if (!pitch || isLiking) return;
    setIsLiking(true);
    const originalLiked = isLiked;
    const originalLikes = pitch.likes;
    try {
      if (isLiked) {
        setPitch(prev => prev ? { ...prev, likes: prev.likes - 1 } : null);
        setIsLiked(false);
        await pitchService.unlikePitch(parseInt(pitch.id));
      } else {
        setPitch(prev => prev ? { ...prev, likes: prev.likes + 1 } : null);
        setIsLiked(true);
        await pitchService.likePitch(parseInt(pitch.id));
      }
    } catch {
      setIsLiked(originalLiked);
      setPitch(prev => prev ? { ...prev, likes: originalLikes } : null);
    } finally {
      setIsLiking(false);
    }
  };

  const handleSharePitch = () => {
    navigator.clipboard.writeText(window.location.href).then(() => {
      toast.success('Link copied to clipboard');
    }).catch(() => {
      toast.error('Failed to copy link');
    });
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
    } catch (err) {
      const e = err instanceof Error ? err : new Error(String(err));
      setNotes(previousNotes); // Roll back
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
      console.error('Failed to save team:', e.message);
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
        await ProductionService.updatePitchChecklist(pitchId, merged).catch(() => {});
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
        await ProductionService.updatePitchTeam(pitchId, newTeam).catch(() => {});
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
      case 'schedule': return <Calendar className="h-4 w-4 text-orange-600" />;
      case 'team': return <Briefcase className="h-4 w-4 text-indigo-600" />;
      default: return <MessageSquare className="h-4 w-4 text-gray-600" />;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-600"></div>
      </div>
    );
  }

  if (error || !pitch) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-8">
        <div className="bg-white rounded-2xl shadow-xl p-8 text-center max-w-md">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Error Loading Pitch</h2>
          <p className="text-gray-600 mb-6">{error || 'Pitch not found'}</p>
          <button
            onClick={() => navigate('/production/dashboard')}
            className="px-6 py-3 bg-orange-600 text-white rounded-lg hover:bg-orange-700"
          >
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
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
          <button
            onClick={handleShortlistToggle}
            className={`flex items-center px-3 py-1.5 rounded-lg text-sm transition-colors ${
              isShortlisted
                ? 'bg-yellow-100 text-yellow-700 hover:bg-yellow-200'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            {isShortlisted ? <BookmarkCheck className="h-4 w-4 sm:mr-1.5" /> : <Bookmark className="h-4 w-4 sm:mr-1.5" />}
            <span className="hidden sm:inline">{isShortlisted ? 'Shortlisted' : 'Shortlist'}</span>
          </button>

          <button
            onClick={handleLike}
            disabled={isLiking}
            className={`flex items-center px-3 py-1.5 rounded-lg text-sm transition-colors ${
              isLiked
                ? 'bg-red-100 text-red-600 hover:bg-red-200'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            } ${isLiking ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            <Heart className={`h-4 w-4 sm:mr-1.5 ${isLiked ? 'fill-current' : ''}`} />
            <span className="hidden sm:inline">{isLiked ? 'Liked' : 'Like'}</span>
          </button>

          {!isOwner && (
            <button
              onClick={handleContactCreator}
              className="flex items-center px-3 py-1.5 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700"
            >
              <MessageSquare className="h-4 w-4 sm:mr-1.5" />
              <span className="hidden sm:inline">Contact</span>
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
            <div className="bg-white rounded-xl shadow-lg mb-6">
              <div className="flex border-b">
                {['overview', 'production', 'team', 'notes'].map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab as any)}
                    className={`flex-1 py-3 px-4 text-sm font-medium capitalize ${
                      activeTab === tab
                        ? 'text-orange-600 border-b-2 border-orange-600'
                        : 'text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    {tab === 'production' ? 'Feasibility' : tab}
                  </button>
                ))}
              </div>
            </div>

            {/* Tab Content */}
            {activeTab === 'overview' && (
              <div className="bg-white rounded-xl shadow-lg p-8">
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
                  <span className="px-3 py-1 bg-orange-100 text-orange-700 rounded-full text-sm">
                    {pitch.genre}
                  </span>
                  <span className="px-3 py-1 bg-red-100 text-red-700 rounded-full text-sm">
                    <FormatDisplay 
                      formatCategory={pitch.formatCategory}
                      formatSubtype={pitch.formatSubtype}
                      format={pitch.format}
                      variant="subtype-only"
                    />
                  </span>
                  <span className="px-3 py-1 bg-yellow-100 text-yellow-700 rounded-full text-sm">
                    {pitch.budget}
                  </span>
                  {pitch.pages && (
                    <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm">
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
                  <div className="grid grid-cols-2 gap-4 mt-4">
                    <button
                      onClick={handleLike}
                      disabled={isLiking}
                      className={`rounded-lg p-3 text-center transition-colors cursor-pointer ${
                        isLiked
                          ? 'bg-red-50 ring-2 ring-red-200'
                          : 'bg-gray-50 hover:bg-red-50'
                      } ${isLiking ? 'opacity-50' : ''}`}
                    >
                      <p className="text-2xl font-bold text-gray-900">{pitch.likes ?? 0}</p>
                      <p className={`text-xs flex items-center justify-center gap-1 ${isLiked ? 'text-red-500 font-medium' : 'text-gray-500'}`}>
                        <Heart className={`w-3 h-3 ${isLiked ? 'fill-current text-red-500' : ''}`} />
                        {isLiked ? 'Liked' : 'Like'}
                      </p>
                    </button>
                    <div className="bg-gray-50 rounded-lg p-3 text-center">
                      <p className="text-2xl font-bold text-gray-900">{pitch.ndaCount ?? 0}</p>
                      <p className="text-xs text-gray-500 flex items-center justify-center gap-1"><Shield className="w-3 h-3" /> NDAs</p>
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
            )}

            {activeTab === 'production' && completeness && (
              <div className="space-y-6">
                {/* Pitch Completeness */}
                <div className="bg-white rounded-xl shadow-lg p-8">
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
                <div className="bg-white rounded-xl shadow-lg p-8">
                  <div className="flex items-center justify-between mb-2">
                    <h2 className="text-lg font-bold text-gray-900">Production Readiness</h2>
                    <span className={`text-lg font-bold ${getScoreColor(completeness.productionReadiness)}`}>
                      {completeness.productionReadiness}%
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2 mb-6">
                    <div
                      className="bg-orange-500 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${completeness.productionReadiness}%` }}
                    />
                  </div>

                  {/* Production Checklist */}
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Production Checklist</h3>
                    <span className="text-sm text-gray-500">{getChecklistProgress().toFixed(0)}% Complete</span>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    {Object.entries(productionChecklist).map(([key, value]) => (
                      <div key={key} className="flex items-center">
                        <button
                          onClick={() => handleChecklistUpdate(key as keyof typeof productionChecklist)}
                          className="mr-2"
                        >
                          {value ? (
                            <CheckSquare className="h-5 w-5 text-green-600" />
                          ) : (
                            <Square className="h-5 w-5 text-gray-400" />
                          )}
                        </button>
                        <label className="text-gray-700 capitalize">
                          {key.replace(/([A-Z])/g, ' $1').trim()}
                        </label>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'team' && (
              <div className="bg-white rounded-xl shadow-lg p-8">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h2 className="text-2xl font-bold text-gray-900">Team Assembly</h2>
                    {linkedProjectId && (
                      <p className="text-sm text-gray-500 mt-1">Accepted collaborators auto-populate from the linked project</p>
                    )}
                  </div>
                </div>

                <div className="space-y-4">
                  {teamMembers.map((member, index) => (
                    <div key={index} className={`p-4 rounded-lg ${member.status === 'confirmed' && member.name ? 'bg-green-50 border border-green-200' : 'bg-gray-50'}`}>
                      <div className="flex items-center space-x-4">
                        <div className="flex-1">
                          <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-2">
                            {member.role}
                            {member.status === 'confirmed' && member.name && (
                              <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">Confirmed</span>
                            )}
                          </label>
                          <input
                            type="text"
                            value={member.name}
                            onChange={(e) => handleTeamUpdate(index, 'name', e.target.value)}
                            placeholder="Enter name"
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Status
                          </label>
                          <select
                            value={member.status}
                            onChange={(e) => handleTeamUpdate(index, 'status', e.target.value)}
                            className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                          >
                            <option value="pending">Pending</option>
                            <option value="considering">Considering</option>
                            <option value="confirmed">Confirmed</option>
                          </select>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                
                <button
                  onClick={async () => {
                    try {
                      await ProductionService.updatePitchTeam(parseInt(id!, 10), teamMembers);
                      toast.success('Team configuration saved');
                    } catch (err) {
                      const e = err instanceof Error ? err : new Error(String(err));
                      toast.error(e.message);
                    }
                  }}
                  className="mt-4 w-full px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700"
                >
                  Save Team Configuration
                </button>
              </div>
            )}

            {activeTab === 'notes' && (
              <div className="bg-white rounded-xl shadow-lg p-8">
                <h2 className="text-2xl font-bold text-gray-900 mb-6">Production Notes</h2>
                
                {/* Add Note Form */}
                <div className="mb-6 p-4 bg-gray-50 rounded-lg">
                  <div className="flex space-x-2 mb-3">
                    {(['casting', 'location', 'budget', 'schedule', 'team', 'general'] as const).map((cat) => (
                      <button
                        key={cat}
                        onClick={() => setNoteCategory(cat)}
                        className={`px-3 py-1 rounded-full text-sm capitalize ${
                          noteCategory === cat
                            ? 'bg-orange-600 text-white'
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
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                    rows={3}
                  />
                  <button
                    onClick={handleAddNote}
                    className="mt-2 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700"
                  >
                    Add Note
                  </button>
                </div>

                {/* Notes List */}
                <div className="space-y-3">
                  {notes.length > 0 ? (
                    notes.map((note) => (
                      <div key={note.id} className="p-4 bg-gray-50 rounded-lg">
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
                          <button
                            onClick={() => handleDeleteNote(note.id)}
                            className="text-red-600 hover:text-red-700"
                          >
                            <XCircle className="h-4 w-4" />
                          </button>
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
            {/* Production Actions — only for pitches by other users */}
            {isOwner ? (
              <div className="bg-white rounded-xl shadow-lg p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Your Pitch</h3>
                <div className="space-y-2">
                  {hasExistingProject ? (
                    <button
                      onClick={() => navigate('/production/pipeline')}
                      className="w-full flex items-center justify-between px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                    >
                      <span>View in Pipeline</span>
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  ) : (
                    <button
                      onClick={() => setShowStartProjectModal(true)}
                      className="w-full flex items-center justify-between px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
                    >
                      <span>Start Project</span>
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <div className="bg-white rounded-xl shadow-lg p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Production Actions</h3>
                <div className="space-y-2">
                  <button
                    onClick={() => {
                      if (!pitch?.userId) {
                        toast.error('Cannot send message: creator information unavailable');
                        return;
                      }
                      const greeting = pitch.creatorName || pitch.creatorCompany || 'Creator';
                      navigate(`/production/messages?recipient=${pitch.userId}&pitch=${id}&subject=${encodeURIComponent(`Script Request: ${pitch?.title}`)}&body=${encodeURIComponent(`Hi ${greeting},\n\nI'm interested in your pitch "${pitch?.title}" and would like to request the full script for review.\n\nLooking forward to discussing this further.`)}`);
                    }}
                    className="w-full flex items-center justify-between px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700"
                  >
                    <span>Request Full Script</span>
                    <ChevronRight className="h-4 w-4" />
                  </button>
                  {!pitch?.hasSignedNDA && (
                    <button
                      onClick={async () => {
                        if (!id) return;
                        if (!confirm(`Request NDA access? This costs ${getCreditCost('nda_request')} credits.`)) return;
                        try {
                          const res = await apiClient.post('/api/ndas/request', { pitchId: id });
                          if (res.success) {
                            toast.success('NDA request sent');
                          } else {
                            toast.error((res.error as any)?.message || 'Failed to request NDA');
                          }
                        } catch (err) {
                          const e = err instanceof Error ? err : new Error(String(err));
                          toast.error(e.message);
                        }
                      }}
                      className="w-full flex items-center justify-between px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700"
                    >
                      <span>Request NDA ({getCreditCost('nda_request')} credits)</span>
                      <Shield className="h-4 w-4" />
                    </button>
                  )}
                  <button
                    onClick={() => setShowScheduleModal(true)}
                    className="w-full flex items-center justify-between px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                  >
                    <span>Schedule Meeting</span>
                    <ChevronRight className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => {
                      navigate(`/production/messages?recipient=${pitch?.userId}&pitch=${id}`);
                      toast('Start your negotiation discussion');
                    }}
                    className="w-full flex items-center justify-between px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                  >
                    <span>Start Negotiations</span>
                    <ChevronRight className="h-4 w-4" />
                  </button>
                  {hasExistingProject ? (
                    <button
                      onClick={() => navigate('/production/pipeline')}
                      className="w-full flex items-center justify-between px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                    >
                      <span>View in Pipeline</span>
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  ) : (
                    <button
                      onClick={() => setShowStartProjectModal(true)}
                      className="w-full flex items-center justify-between px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
                    >
                      <span>Start Project</span>
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Production Requirements */}
            <div className="bg-white rounded-xl shadow-lg p-6">
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
                  <span className="font-semibold">{pitch.budget}</span>
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

            {/* AI Auto-fill */}
            <div className="bg-white rounded-xl shadow-lg p-6">
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
                  if (file) handleAutoFill(file);
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
            </div>

            {/* Documents */}
            {(pitch.pitchDeck || pitch.script || pitch.trailer) && (
              <div className="bg-white rounded-xl shadow-lg p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Production Materials</h3>
                <div className="space-y-2">
                  {pitch.script && (
                    <a
                      href={pitch.script}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-between p-2 hover:bg-gray-50 rounded"
                    >
                      <span className="flex items-center text-blue-600">
                        <FileText className="h-4 w-4 mr-2" />
                        Full Script
                      </span>
                      <Download className="h-4 w-4 text-gray-400" />
                    </a>
                  )}
                  {pitch.pitchDeck && (
                    <a
                      href={pitch.pitchDeck}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-between p-2 hover:bg-gray-50 rounded"
                    >
                      <span className="flex items-center text-blue-600">
                        <FileText className="h-4 w-4 mr-2" />
                        Pitch Deck
                      </span>
                      <Download className="h-4 w-4 text-gray-400" />
                    </a>
                  )}
                  {pitch.trailer && (
                    <a
                      href={pitch.trailer}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-between p-2 hover:bg-gray-50 rounded"
                    >
                      <span className="flex items-center text-blue-600">
                        <Film className="h-4 w-4 mr-2" />
                        Concept Trailer
                      </span>
                      <Download className="h-4 w-4 text-gray-400" />
                    </a>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <ScheduleMeetingModal
        isOpen={showScheduleModal}
        onClose={() => setShowScheduleModal(false)}
        recipientId={pitch.userId || ''}
        recipientName={pitch.creatorName || pitch.creatorCompany || 'Creator'}
        meetingType="production"
        defaultSubject={`Production Discussion: ${pitch.title}`}
      />

      {showStartProjectModal && (
        <StartProjectModal
          pitch={{
            id: Number(pitch.id),
            title: pitch.title,
            genre: pitch.genre,
            budget: pitch.budget,
            estimatedBudget: pitch.estimatedBudget,
            productionTimeline: pitch.productionTimeline,
            logline: pitch.logline,
            shortSynopsis: pitch.shortSynopsis,
          }}
          onClose={() => setShowStartProjectModal(false)}
        />
      )}
    </div>
  );
};

export default ProductionPitchView;