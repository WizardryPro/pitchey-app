import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { 
  ArrowLeft, Eye, Heart, Share2, Bookmark, BookmarkCheck,
  Shield, MessageSquare, Clock, Calendar, User, Tag, 
  Film, DollarSign, Briefcase, TrendingUp, Users,
  FileText, Download, Calculator, MapPin, Camera,
  Clapperboard, Settings, CheckSquare, Square,
  AlertCircle, CheckCircle, XCircle, Star, ChevronRight,
  Truck, Home, Globe, Mic, Edit3, Package
} from 'lucide-react';
import { pitchAPI } from '../../lib/api';
import FormatDisplay from '../../components/FormatDisplay';

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

interface FeasibilityAssessment {
  budgetViability: number;
  scheduleViability: number;
  locationViability: number;
  castingViability: number;
  overallScore: number;
}

interface TeamMember {
  role: string;
  name: string;
  status: 'confirmed' | 'pending' | 'considering';
}

const ProductionPitchView: React.FC = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const [pitch, setPitch] = useState<Pitch | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'production' | 'team' | 'schedule' | 'notes'>('overview');
  const [isShortlisted, setIsShortlisted] = useState(false);
  const [notes, setNotes] = useState<ProductionNote[]>([]);
  const [newNote, setNewNote] = useState('');
  const [noteCategory, setNoteCategory] = useState<ProductionNote['category']>('general');
  const [feasibility, setFeasibility] = useState<FeasibilityAssessment | null>(null);
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

  useEffect(() => {
    if (id) {
      fetchPitchData();
      loadProductionData();
    }
  }, [id]);

  // Recalculate feasibility when pitch data is loaded
  useEffect(() => {
    if (pitch) {
      calculateFeasibility();
    }
  }, [pitch]);

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
        const userType = localStorage.getItem('userType');
        const token = localStorage.getItem('authToken');
        
        if (token && userType === 'production' && response.hasSignedNDA) {
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
    try {
      // Load saved notes
      const savedNotes = localStorage.getItem(`production_notes_${id}`);
      if (savedNotes) {
        setNotes(JSON.parse(savedNotes));
      }

      // Load shortlist status
      const shortlist = JSON.parse(localStorage.getItem('production_shortlist') || '[]');
      setIsShortlisted(shortlist.includes(id));

      // Load production checklist
      const savedChecklist = localStorage.getItem(`production_checklist_${id}`);
      if (savedChecklist) {
        setProductionChecklist(JSON.parse(savedChecklist));
      }

      // Load team members
      const savedTeam = localStorage.getItem(`production_team_${id}`);
      if (savedTeam) {
        setTeamMembers(JSON.parse(savedTeam));
      }
    } catch (error) {
      console.error('Failed to load production data:', error);
    }
  };

  const calculateFeasibility = () => {
    if (!pitch) return;

    // Deterministic heuristics based on available pitch data
    // Budget: lower budgets are more viable for independent productions
    const budgetMap: Record<string, number> = {
      'micro': 90, 'low': 80, 'medium': 65, 'high': 50, 'blockbuster': 35
    };
    const budgetKey = (pitch.budget || '').toLowerCase();
    const budgetScore = budgetMap[budgetKey] ?? 60;

    // Schedule: shorter formats are easier to schedule
    const formatLower = (pitch.format || '').toLowerCase();
    const scheduleScore = formatLower.includes('short') ? 85 :
      formatLower.includes('series') ? 55 :
      formatLower.includes('feature') ? 65 : 60;

    // Location: fewer locations = higher viability
    const locationCount = pitch.locations?.length ?? 0;
    const locationScore = locationCount === 0 ? 50 :
      locationCount <= 3 ? 80 :
      locationCount <= 6 ? 65 : 45;

    // Casting: based on character count
    const characterCount = pitch.characters?.length ?? 0;
    const castingScore = characterCount === 0 ? 50 :
      characterCount <= 4 ? 80 :
      characterCount <= 8 ? 65 : 50;

    setFeasibility({
      budgetViability: budgetScore,
      scheduleViability: scheduleScore,
      locationViability: locationScore,
      castingViability: castingScore,
      overallScore: Math.round((budgetScore + scheduleScore + locationScore + castingScore) / 4)
    });
  };

  const handleShortlistToggle = () => {
    const shortlist = JSON.parse(localStorage.getItem('production_shortlist') || '[]');
    if (isShortlisted) {
      const updated = shortlist.filter((item: string) => item !== id);
      localStorage.setItem('production_shortlist', JSON.stringify(updated));
      setIsShortlisted(false);
    } else {
      shortlist.push(id);
      localStorage.setItem('production_shortlist', JSON.stringify(shortlist));
      setIsShortlisted(true);
    }
  };

  const handleContactCreator = () => {
    navigate(`/production/messages?recipient=${pitch?.userId}&pitch=${id}`);
  };

  const handleOptionRights = () => {
    navigate(`/production/option-agreement?pitch=${id}`);
  };

  const handleAddNote = () => {
    if (!newNote.trim()) return;

    const note: ProductionNote = {
      id: Date.now().toString(),
      content: newNote,
      createdAt: new Date().toISOString(),
      category: noteCategory,
      author: 'Production Team'
    };

    const updatedNotes = [...notes, note];
    setNotes(updatedNotes);
    localStorage.setItem(`production_notes_${id}`, JSON.stringify(updatedNotes));
    setNewNote('');
  };

  const handleDeleteNote = (noteId: string) => {
    const updatedNotes = notes.filter(note => note.id !== noteId);
    setNotes(updatedNotes);
    localStorage.setItem(`production_notes_${id}`, JSON.stringify(updatedNotes));
  };

  const handleChecklistUpdate = (key: keyof typeof productionChecklist) => {
    const updated = { ...productionChecklist, [key]: !productionChecklist[key] };
    setProductionChecklist(updated);
    localStorage.setItem(`production_checklist_${id}`, JSON.stringify(updated));
  };

  const handleTeamUpdate = (index: number, field: 'name' | 'status', value: string) => {
    const updated = [...teamMembers];
    updated[index] = { ...updated[index], [field]: value };
    setTeamMembers(updated);
    localStorage.setItem(`production_team_${id}`, JSON.stringify(updated));
  };

  const getChecklistProgress = () => {
    const completed = Object.values(productionChecklist).filter(Boolean).length;
    const total = Object.keys(productionChecklist).length;
    return (completed / total) * 100;
  };

  const getFeasibilityColor = (score: number) => {
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
      <div className="min-h-screen bg-gradient-to-br from-orange-50 via-white to-red-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-600"></div>
      </div>
    );
  }

  if (error || !pitch) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-orange-50 via-white to-red-50 p-8">
        <div className="max-w-4xl mx-auto">
          <div className="bg-white rounded-2xl shadow-xl p-8 text-center">
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
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-white to-red-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <button
              onClick={() => navigate('/production/dashboard')}
              className="flex items-center text-gray-600 hover:text-gray-900"
            >
              <ArrowLeft className="h-5 w-5 mr-2" />
              Back to Dashboard
            </button>
            
            <div className="flex items-center space-x-4">
              <button
                onClick={handleShortlistToggle}
                className={`flex items-center px-4 py-2 rounded-lg transition-colors ${
                  isShortlisted 
                    ? 'bg-yellow-100 text-yellow-700 hover:bg-yellow-200'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {isShortlisted ? <BookmarkCheck className="h-4 w-4 mr-2" /> : <Bookmark className="h-4 w-4 mr-2" />}
                {isShortlisted ? 'Shortlisted' : 'Add to Shortlist'}
              </button>
              
              <button
                onClick={handleContactCreator}
                className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                <MessageSquare className="h-4 w-4 mr-2" />
                Contact Creator
              </button>
              
              <button
                onClick={handleOptionRights}
                className="flex items-center px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700"
              >
                <Briefcase className="h-4 w-4 mr-2" />
                Option Rights
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column - Pitch Details */}
          <div className="lg:col-span-2">
            {/* Tabs */}
            <div className="bg-white rounded-xl shadow-lg mb-6">
              <div className="flex border-b">
                {['overview', 'production', 'team', 'schedule', 'notes'].map((tab) => (
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
                
                {pitch.creatorName && (
                  <p className="text-gray-600 mb-4">
                    by {pitch.creatorName} 
                    {pitch.creatorCompany && ` • ${pitch.creatorCompany}`}
                  </p>
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

            {activeTab === 'production' && feasibility && (
              <div className="bg-white rounded-xl shadow-lg p-8">
                <h2 className="text-2xl font-bold text-gray-900 mb-6">Production Feasibility Assessment</h2>
                
                {/* Overall Score */}
                <div className="mb-8 p-6 bg-gradient-to-r from-orange-50 to-red-50 rounded-lg">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Overall Feasibility Score</h3>
                  <div className="flex items-center">
                    <div className="text-4xl font-bold mr-4">
                      <span className={getFeasibilityColor(feasibility.overallScore)}>
                        {feasibility.overallScore.toFixed(0)}%
                      </span>
                    </div>
                    <div className="flex-1">
                      <div className="w-full bg-gray-200 rounded-full h-4">
                        <div 
                          className={`h-4 rounded-full ${
                            feasibility.overallScore >= 70 ? 'bg-green-500' :
                            feasibility.overallScore >= 40 ? 'bg-yellow-500' : 'bg-red-500'
                          }`}
                          style={{ width: `${feasibility.overallScore}%` }}
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Individual Metrics */}
                <div className="grid grid-cols-2 gap-4 mb-8">
                  <div className="p-4 bg-gray-50 rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <span className="flex items-center text-gray-700">
                        <DollarSign className="h-4 w-4 mr-2" />
                        Budget Viability
                      </span>
                      <span className={`font-semibold ${getFeasibilityColor(feasibility.budgetViability)}`}>
                        {feasibility.budgetViability.toFixed(0)}%
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div className="bg-blue-500 h-2 rounded-full" style={{ width: `${feasibility.budgetViability}%` }} />
                    </div>
                  </div>
                  
                  <div className="p-4 bg-gray-50 rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <span className="flex items-center text-gray-700">
                        <Calendar className="h-4 w-4 mr-2" />
                        Schedule Viability
                      </span>
                      <span className={`font-semibold ${getFeasibilityColor(feasibility.scheduleViability)}`}>
                        {feasibility.scheduleViability.toFixed(0)}%
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div className="bg-green-500 h-2 rounded-full" style={{ width: `${feasibility.scheduleViability}%` }} />
                    </div>
                  </div>
                  
                  <div className="p-4 bg-gray-50 rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <span className="flex items-center text-gray-700">
                        <MapPin className="h-4 w-4 mr-2" />
                        Location Viability
                      </span>
                      <span className={`font-semibold ${getFeasibilityColor(feasibility.locationViability)}`}>
                        {feasibility.locationViability.toFixed(0)}%
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div className="bg-purple-500 h-2 rounded-full" style={{ width: `${feasibility.locationViability}%` }} />
                    </div>
                  </div>
                  
                  <div className="p-4 bg-gray-50 rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <span className="flex items-center text-gray-700">
                        <Users className="h-4 w-4 mr-2" />
                        Casting Viability
                      </span>
                      <span className={`font-semibold ${getFeasibilityColor(feasibility.castingViability)}`}>
                        {feasibility.castingViability.toFixed(0)}%
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div className="bg-pink-500 h-2 rounded-full" style={{ width: `${feasibility.castingViability}%` }} />
                    </div>
                  </div>
                </div>

                {/* Production Checklist */}
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-gray-900">Production Checklist</h3>
                    <span className="text-sm text-gray-600">{getChecklistProgress().toFixed(0)}% Complete</span>
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
                <h2 className="text-2xl font-bold text-gray-900 mb-6">Team Assembly</h2>
                
                <div className="space-y-4">
                  {teamMembers.map((member, index) => (
                    <div key={index} className="p-4 bg-gray-50 rounded-lg">
                      <div className="flex items-center space-x-4">
                        <div className="flex-1">
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            {member.role}
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
                
                <button className="mt-4 w-full px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700">
                  Save Team Configuration
                </button>
              </div>
            )}

            {activeTab === 'schedule' && (
              <div className="bg-white rounded-xl shadow-lg p-8">
                <h2 className="text-2xl font-bold text-gray-900 mb-6">Production Schedule</h2>
                
                <div className="space-y-6">
                  {/* Pre-Production */}
                  <div className="p-4 bg-blue-50 rounded-lg">
                    <h3 className="font-semibold text-gray-900 mb-3">Pre-Production (8-12 weeks)</h3>
                    <div className="space-y-2 text-sm text-gray-700">
                      <div className="flex justify-between">
                        <span>Script Finalization</span>
                        <span>Week 1-2</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Casting</span>
                        <span>Week 2-4</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Location Scouting</span>
                        <span>Week 3-5</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Crew Assembly</span>
                        <span>Week 4-6</span>
                      </div>
                    </div>
                  </div>
                  
                  {/* Production */}
                  <div className="p-4 bg-orange-50 rounded-lg">
                    <h3 className="font-semibold text-gray-900 mb-3">Production (6-8 weeks)</h3>
                    <div className="space-y-2 text-sm text-gray-700">
                      <div className="flex justify-between">
                        <span>Principal Photography</span>
                        <span>Week 13-18</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Pick-up Shots</span>
                        <span>Week 19-20</span>
                      </div>
                    </div>
                  </div>
                  
                  {/* Post-Production */}
                  <div className="p-4 bg-green-50 rounded-lg">
                    <h3 className="font-semibold text-gray-900 mb-3">Post-Production (12-16 weeks)</h3>
                    <div className="space-y-2 text-sm text-gray-700">
                      <div className="flex justify-between">
                        <span>Editing</span>
                        <span>Week 21-26</span>
                      </div>
                      <div className="flex justify-between">
                        <span>VFX & Color Grading</span>
                        <span>Week 25-30</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Sound Design & Mix</span>
                        <span>Week 28-32</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Final Delivery</span>
                        <span>Week 33-36</span>
                      </div>
                    </div>
                  </div>
                </div>
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
            {/* Production Actions */}
            <div className="bg-white rounded-xl shadow-lg p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Production Actions</h3>
              <div className="space-y-2">
                <button className="w-full flex items-center justify-between px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700">
                  <span>Request Full Script</span>
                  <ChevronRight className="h-4 w-4" />
                </button>
                <button className="w-full flex items-center justify-between px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                  <span>Schedule Meeting</span>
                  <ChevronRight className="h-4 w-4" />
                </button>
                <button className="w-full flex items-center justify-between px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700">
                  <span>Start Negotiations</span>
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>

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

            {/* Market Analysis */}
            <div className="bg-white rounded-xl shadow-lg p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Market Analysis</h3>
              <div className="space-y-3">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm text-gray-600">Genre Popularity</span>
                    <span className="text-sm font-medium">High</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div className="bg-green-500 h-2 rounded-full" style={{ width: '80%' }} />
                  </div>
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm text-gray-600">Competition</span>
                    <span className="text-sm font-medium">Medium</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div className="bg-yellow-500 h-2 rounded-full" style={{ width: '50%' }} />
                  </div>
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm text-gray-600">ROI Potential</span>
                    <span className="text-sm font-medium">High</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div className="bg-green-500 h-2 rounded-full" style={{ width: '75%' }} />
                  </div>
                </div>
              </div>
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
    </div>
  );
};

export default ProductionPitchView;