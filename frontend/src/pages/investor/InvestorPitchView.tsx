import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft, Bookmark, BookmarkCheck,
  MessageSquare, Clock, Calendar,
  DollarSign, TrendingUp, Users,
  FileText, Download, Target,
  AlertCircle, CheckCircle, XCircle, ChevronRight,
  X, Loader2
} from 'lucide-react';
import { pitchAPI } from '../../lib/api';
import { apiClient } from '../../lib/api-client';
import { InvestorService } from '../../services/investor.service';
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
  marketPotential?: string;
  revenueProjections?: string;
  distributionStrategy?: string;
}

interface InvestmentNote {
  id: string;
  content: string;
  createdAt: string;
  isPrivate: boolean;
  category: 'strength' | 'concern' | 'question' | 'general';
}

interface ROICalculation {
  investmentAmount: number;
  projectedRevenue: number;
  roi: number;
  breakEvenPoint: string;
  paybackPeriod: string;
}

interface PitchInvestmentDetail {
  totalRaised: number;
  investorCount: number;
  avgInvestment: number;
  targetAmount: number | null;
  percentageRaised: number;
  expectedROI: number | null;
  riskLevel: 'low' | 'medium' | 'high';
  isWatchlisted: boolean;
  hasExpressedInterest: boolean;
  interestLevel: string | null;
}

const InvestorPitchView: React.FC = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const [pitch, setPitch] = useState<Pitch | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'financials' | 'diligence' | 'notes'>('overview');
  const [isWatchlisted, setIsWatchlisted] = useState(false);
  const [watchlistLoading, setWatchlistLoading] = useState(false);
  const [notes, setNotes] = useState<InvestmentNote[]>([]);
  const [newNote, setNewNote] = useState('');
  const [noteCategory, setNoteCategory] = useState<InvestmentNote['category']>('general');
  const [roiCalculation, setRoiCalculation] = useState<ROICalculation | null>(null);
  const [investmentAmount, setInvestmentAmount] = useState('');
  const [pitchDetail, setPitchDetail] = useState<PitchInvestmentDetail | null>(null);
  const [diligenceChecklist, setDiligenceChecklist] = useState({
    scriptReview: false,
    budgetAnalysis: false,
    marketResearch: false,
    teamBackground: false,
    legalClearance: false,
    distributionPlan: false,
    competitiveAnalysis: false,
    audienceTesting: false
  });

  // Modal states
  const [showInterestModal, setShowInterestModal] = useState(false);
  const [showMeetingModal, setShowMeetingModal] = useState(false);
  const [showInfoModal, setShowInfoModal] = useState(false);

  // Action form states
  const [interestForm, setInterestForm] = useState({ amount: '', level: 'medium', message: '' });
  const [meetingForm, setMeetingForm] = useState({ dateTime: '', meetingType: 'video', message: '' });
  const [infoForm, setInfoForm] = useState({ message: '', categories: [] as string[] });
  const [actionLoading, setActionLoading] = useState(false);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const fetchPitchData = useCallback(async () => {
    if (!id) return;
    try {
      setLoading(true);

      let response;
      const userType = localStorage.getItem('userType');
      const token = localStorage.getItem('authToken');

      try {
        response = await pitchAPI.getPublicById(parseInt(id));

        if (token && userType === 'investor' && response.hasSignedNDA) {
          try {
            const authResponse = await pitchAPI.getById(parseInt(id));
            response = authResponse;
          } catch {
            // Fall back to public data
          }
        }
      } catch {
        response = await pitchAPI.getById(parseInt(id));
      }

      setPitch(response);
    } catch {
      setError('Failed to load pitch details');
    } finally {
      setLoading(false);
    }
  }, [id]);

  const fetchInvestmentDetail = useCallback(async () => {
    if (!id) return;
    try {
      const response = await apiClient.get<PitchInvestmentDetail>(
        `/api/investor/pitch/${id}/investment-detail`
      );
      if (response.success && response.data) {
        setPitchDetail(response.data);
        setIsWatchlisted(response.data.isWatchlisted);
      }
    } catch {
      // Non-critical — sidebar will show defaults
    }
  }, [id]);

  useEffect(() => {
    if (id) {
      fetchPitchData();
      fetchInvestmentDetail();
      loadLocalData();
    }
  }, [id, fetchPitchData, fetchInvestmentDetail]);

  const loadLocalData = () => {
    try {
      const savedNotes = localStorage.getItem(`investor_notes_${id}`);
      if (savedNotes) setNotes(JSON.parse(savedNotes));

      const savedChecklist = localStorage.getItem(`diligence_${id}`);
      if (savedChecklist) setDiligenceChecklist(JSON.parse(savedChecklist));
    } catch {
      // Ignore localStorage errors
    }
  };

  const handleWatchlistToggle = async () => {
    if (!id || watchlistLoading) return;
    setWatchlistLoading(true);
    try {
      if (isWatchlisted) {
        await InvestorService.removeFromWatchlist(parseInt(id));
        setIsWatchlisted(false);
      } else {
        await InvestorService.addToWatchlist(parseInt(id));
        setIsWatchlisted(true);
      }
    } catch {
      // Silently fail — button stays in current state
    } finally {
      setWatchlistLoading(false);
    }
  };

  const handleContactCreator = () => {
    navigate(`/investor/messages?recipient=${pitch?.userId}&pitch=${id}`);
  };

  const handleExpressInterest = async () => {
    if (!id || !interestForm.amount) return;
    setActionLoading(true);
    setActionError(null);
    try {
      await InvestorService.invest({
        pitchId: parseInt(id),
        amount: parseFloat(interestForm.amount),
        message: interestForm.message || undefined,
      });
      setActionSuccess('Interest expressed successfully!');
      setShowInterestModal(false);
      setInterestForm({ amount: '', level: 'medium', message: '' });
      // Refresh detail to update hasExpressedInterest
      fetchInvestmentDetail();
    } catch (err) {
      const e = err instanceof Error ? err : new Error(String(err));
      setActionError(e.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleScheduleMeeting = async () => {
    if (!id || !pitch || !meetingForm.dateTime) return;
    setActionLoading(true);
    setActionError(null);
    try {
      await apiClient.post('/api/meetings/schedule', {
        pitchId: parseInt(id),
        creatorId: pitch.userId,
        dateTime: meetingForm.dateTime,
        meetingType: meetingForm.meetingType,
        message: meetingForm.message,
        duration: 60,
      });
      setActionSuccess('Meeting scheduled successfully!');
      setShowMeetingModal(false);
      setMeetingForm({ dateTime: '', meetingType: 'video', message: '' });
    } catch (err) {
      const e = err instanceof Error ? err : new Error(String(err));
      setActionError(e.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleRequestInfo = async () => {
    if (!id || !pitch || !infoForm.message) return;
    setActionLoading(true);
    setActionError(null);
    try {
      await apiClient.post('/api/info-requests', {
        targetUserId: pitch.userId,
        pitchId: parseInt(id),
        message: infoForm.message,
        categories: infoForm.categories,
      });
      setActionSuccess('Info request sent successfully!');
      setShowInfoModal(false);
      setInfoForm({ message: '', categories: [] });
    } catch (err) {
      const e = err instanceof Error ? err : new Error(String(err));
      setActionError(e.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleAddNote = () => {
    if (!newNote.trim()) return;

    const note: InvestmentNote = {
      id: Date.now().toString(),
      content: newNote,
      createdAt: new Date().toISOString(),
      isPrivate: true,
      category: noteCategory
    };

    const updatedNotes = [...notes, note];
    setNotes(updatedNotes);
    localStorage.setItem(`investor_notes_${id}`, JSON.stringify(updatedNotes));
    setNewNote('');
  };

  const handleDeleteNote = (noteId: string) => {
    const updatedNotes = notes.filter(note => note.id !== noteId);
    setNotes(updatedNotes);
    localStorage.setItem(`investor_notes_${id}`, JSON.stringify(updatedNotes));
  };

  const calculateROI = () => {
    if (!investmentAmount || !pitch?.estimatedBudget) return;

    const investment = parseFloat(investmentAmount);
    const budget = parseFloat(pitch.estimatedBudget.replace(/[^0-9.]/g, ''));

    // Use market-data ROI when available, fallback to 2.5x
    const roiMultiplier = (pitchDetail?.expectedROI ?? 150) / 100 + 1;
    const projectedRevenue = budget * roiMultiplier;
    const roi = ((projectedRevenue - investment) / investment) * 100;
    const breakEven = investment / (projectedRevenue / 36);

    setRoiCalculation({
      investmentAmount: investment,
      projectedRevenue,
      roi,
      breakEvenPoint: `${Math.ceil(breakEven)} months`,
      paybackPeriod: `${Math.ceil(breakEven * 1.5)} months`
    });
  };

  const handleDiligenceUpdate = (key: keyof typeof diligenceChecklist) => {
    const updated = { ...diligenceChecklist, [key]: !diligenceChecklist[key] };
    setDiligenceChecklist(updated);
    localStorage.setItem(`diligence_${id}`, JSON.stringify(updated));
  };

  const getDiligenceProgress = () => {
    const completed = Object.values(diligenceChecklist).filter(Boolean).length;
    const total = Object.keys(diligenceChecklist).length;
    return (completed / total) * 100;
  };

  const getCategoryIcon = (category: InvestmentNote['category']) => {
    switch (category) {
      case 'strength': return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'concern': return <XCircle className="h-4 w-4 text-red-600" />;
      case 'question': return <AlertCircle className="h-4 w-4 text-yellow-600" />;
      default: return <MessageSquare className="h-4 w-4 text-gray-600" />;
    }
  };

  const getRiskColor = (level: string) => {
    switch (level) {
      case 'low': return 'text-green-600';
      case 'high': return 'text-red-600';
      default: return 'text-yellow-600';
    }
  };

  const getRiskBarColor = (level: string) => {
    switch (level) {
      case 'low': return 'bg-green-500';
      case 'high': return 'bg-red-500';
      default: return 'bg-yellow-500';
    }
  };

  const getRiskPercent = (level: string) => {
    switch (level) {
      case 'low': return 25;
      case 'high': return 75;
      default: return 50;
    }
  };

  const toggleInfoCategory = (cat: string) => {
    setInfoForm(prev => ({
      ...prev,
      categories: prev.categories.includes(cat)
        ? prev.categories.filter(c => c !== cat)
        : [...prev.categories, cat]
    }));
  };

  // Clear action success toast after 3s
  useEffect(() => {
    if (actionSuccess) {
      const t = setTimeout(() => setActionSuccess(null), 3000);
      return () => clearTimeout(t);
    }
  }, [actionSuccess]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-green-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error || !pitch) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-green-50 p-8">
        <div className="max-w-4xl mx-auto">
          <div className="bg-white rounded-2xl shadow-xl p-8 text-center">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Error Loading Pitch</h2>
            <p className="text-gray-600 mb-6">{error || 'Pitch not found'}</p>
            <button
              onClick={() => navigate('/investor/browse')}
              className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Back to Browse
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-green-50">
      {/* Success Toast */}
      {actionSuccess && (
        <div className="fixed top-4 right-4 z-50 bg-green-600 text-white px-4 py-3 rounded-lg shadow-lg flex items-center">
          <CheckCircle className="h-5 w-5 mr-2" />
          {actionSuccess}
        </div>
      )}

      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <button
              onClick={() => navigate('/investor/browse')}
              className="flex items-center text-gray-600 hover:text-gray-900"
            >
              <ArrowLeft className="h-5 w-5 mr-2" />
              Back to Browse
            </button>

            <div className="flex items-center space-x-4">
              <button
                onClick={handleWatchlistToggle}
                disabled={watchlistLoading}
                className={`flex items-center px-4 py-2 rounded-lg transition-colors ${
                  isWatchlisted
                    ? 'bg-yellow-100 text-yellow-700 hover:bg-yellow-200'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                } ${watchlistLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                {watchlistLoading ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : isWatchlisted ? (
                  <BookmarkCheck className="h-4 w-4 mr-2" />
                ) : (
                  <Bookmark className="h-4 w-4 mr-2" />
                )}
                {isWatchlisted ? 'Watchlisted' : 'Add to Watchlist'}
              </button>

              <button
                onClick={handleContactCreator}
                className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                <MessageSquare className="h-4 w-4 mr-2" />
                Contact Creator
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
                {['overview', 'financials', 'diligence', 'notes'].map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab as typeof activeTab)}
                    className={`flex-1 py-3 px-4 text-sm font-medium capitalize ${
                      activeTab === tab
                        ? 'text-blue-600 border-b-2 border-blue-600'
                        : 'text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    {tab === 'diligence' ? 'Due Diligence' : tab}
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
                  <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm">
                    {pitch.genre}
                  </span>
                  <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm">
                    <FormatDisplay
                      formatCategory={(pitch as any).formatCategory}
                      formatSubtype={(pitch as any).formatSubtype}
                      format={pitch.format}
                      variant="compact"
                    />
                  </span>
                  <span className="px-3 py-1 bg-purple-100 text-purple-700 rounded-full text-sm">
                    {pitch.budget}
                  </span>
                </div>

                <p className="text-xl text-gray-700 mb-6 italic">&ldquo;{pitch.logline}&rdquo;</p>

                <div className="space-y-6">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">Investment Opportunity</h3>
                    <p className="text-gray-700 whitespace-pre-wrap">{pitch.shortSynopsis}</p>
                  </div>

                  {pitch.marketPotential && (
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900 mb-2">Market Potential</h3>
                      <p className="text-gray-700">{pitch.marketPotential}</p>
                    </div>
                  )}

                  {pitch.comparableFilms && (
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900 mb-2">Comparable Success Stories</h3>
                      <p className="text-gray-700">{pitch.comparableFilms}</p>
                    </div>
                  )}

                  {pitch.targetAudience && (
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900 mb-2">Target Market</h3>
                      <p className="text-gray-700">{pitch.targetAudience}</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {activeTab === 'financials' && (
              <div className="bg-white rounded-xl shadow-lg p-8">
                <h2 className="text-2xl font-bold text-gray-900 mb-6">Financial Analysis</h2>

                {/* Budget Breakdown */}
                <div className="mb-8 p-6 bg-gray-50 rounded-lg">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Budget Overview</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <span className="text-sm text-gray-600">Total Budget</span>
                      <p className="text-2xl font-bold text-gray-900">{pitch.budget}</p>
                    </div>
                    <div>
                      <span className="text-sm text-gray-600">Production Timeline</span>
                      <p className="text-2xl font-bold text-gray-900">{pitch.productionTimeline || 'TBD'}</p>
                    </div>
                  </div>
                </div>

                {/* ROI Calculator */}
                <div className="mb-8 p-6 bg-blue-50 rounded-lg">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">
                    ROI Calculator
                    {pitchDetail?.expectedROI != null && (
                      <span className="ml-2 text-sm font-normal text-gray-500">
                        (using {pitchDetail.expectedROI}% genre avg ROI)
                      </span>
                    )}
                  </h3>
                  <div className="space-y-4">
                    <div>
                      <label htmlFor="investment-amount" className="block text-sm font-medium text-gray-700 mb-1">
                        Investment Amount ($)
                      </label>
                      <div className="flex space-x-2">
                        <input
                          type="number"
                          id="investment-amount"
                          name="investment-amount"
                          value={investmentAmount}
                          onChange={(e) => setInvestmentAmount(e.target.value)}
                          placeholder="Enter amount"
                          className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                        <button
                          onClick={calculateROI}
                          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                        >
                          Calculate
                        </button>
                      </div>
                    </div>

                    {roiCalculation && (
                      <div className="mt-4 p-4 bg-white rounded-lg">
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <span className="text-sm text-gray-600">Projected ROI</span>
                            <p className="text-xl font-bold text-green-600">
                              {roiCalculation.roi.toFixed(1)}%
                            </p>
                          </div>
                          <div>
                            <span className="text-sm text-gray-600">Break-even</span>
                            <p className="text-xl font-bold text-blue-600">
                              {roiCalculation.breakEvenPoint}
                            </p>
                          </div>
                          <div>
                            <span className="text-sm text-gray-600">Projected Revenue</span>
                            <p className="text-xl font-bold text-gray-900">
                              ${roiCalculation.projectedRevenue.toLocaleString()}
                            </p>
                          </div>
                          <div>
                            <span className="text-sm text-gray-600">Payback Period</span>
                            <p className="text-xl font-bold text-gray-900">
                              {roiCalculation.paybackPeriod}
                            </p>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Revenue Projections */}
                {pitch.revenueProjections && (
                  <div className="p-6 bg-green-50 rounded-lg">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">Revenue Projections</h3>
                    <p className="text-gray-700">{pitch.revenueProjections}</p>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'diligence' && (
              <div className="bg-white rounded-xl shadow-lg p-8">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-2xl font-bold text-gray-900">Due Diligence Checklist</h2>
                  <div className="flex items-center">
                    <span className="text-sm text-gray-600 mr-2">Progress:</span>
                    <div className="w-32 bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-blue-600 h-2 rounded-full transition-all"
                        style={{ width: `${getDiligenceProgress()}%` }}
                      />
                    </div>
                    <span className="ml-2 text-sm font-semibold">{getDiligenceProgress().toFixed(0)}%</span>
                  </div>
                </div>

                <div className="space-y-3">
                  {Object.entries(diligenceChecklist).map(([key, value]) => (
                    <div key={key} className="flex items-center p-4 bg-gray-50 rounded-lg hover:bg-gray-100">
                      <input
                        type="checkbox"
                        id={`diligence-${key}`}
                        name={`diligence-${key}`}
                        checked={value}
                        onChange={() => handleDiligenceUpdate(key as keyof typeof diligenceChecklist)}
                        className="h-5 w-5 text-blue-600 rounded focus:ring-blue-500"
                      />
                      <label htmlFor={`diligence-${key}`} className="ml-3 flex-1 text-gray-700 capitalize">
                        {key.replace(/([A-Z])/g, ' $1').trim()}
                      </label>
                      {value && <CheckCircle className="h-5 w-5 text-green-600" />}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {activeTab === 'notes' && (
              <div className="bg-white rounded-xl shadow-lg p-8">
                <h2 className="text-2xl font-bold text-gray-900 mb-6">Private Notes</h2>

                {/* Add Note Form */}
                <div className="mb-6 p-4 bg-gray-50 rounded-lg">
                  <div className="flex space-x-2 mb-3">
                    {(['strength', 'concern', 'question', 'general'] as const).map((cat) => (
                      <button
                        key={cat}
                        onClick={() => setNoteCategory(cat)}
                        className={`px-3 py-1 rounded-full text-sm capitalize ${
                          noteCategory === cat
                            ? 'bg-blue-600 text-white'
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
                    placeholder="Add a private note..."
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    rows={3}
                  />
                  <button
                    onClick={handleAddNote}
                    className="mt-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
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
                                {new Date(note.createdAt).toLocaleString()}
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
                    <p className="text-gray-500 text-center py-8">No notes yet. Start by adding your thoughts above.</p>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Right Column - Sidebar */}
          <div className="space-y-6">
            {/* Investment Quick Actions */}
            <div className="bg-white rounded-xl shadow-lg p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h3>
              <div className="space-y-2">
                <button
                  onClick={() => setShowInterestModal(true)}
                  disabled={pitchDetail?.hasExpressedInterest}
                  className={`w-full flex items-center justify-between px-4 py-2 rounded-lg ${
                    pitchDetail?.hasExpressedInterest
                      ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                      : 'bg-green-600 text-white hover:bg-green-700'
                  }`}
                >
                  <span>{pitchDetail?.hasExpressedInterest ? 'Interest Expressed' : 'Express Interest'}</span>
                  {pitchDetail?.hasExpressedInterest ? (
                    <CheckCircle className="h-4 w-4" />
                  ) : (
                    <ChevronRight className="h-4 w-4" />
                  )}
                </button>
                <button
                  onClick={() => setShowMeetingModal(true)}
                  className="w-full flex items-center justify-between px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  <span>Schedule Meeting</span>
                  <ChevronRight className="h-4 w-4" />
                </button>
                <button
                  onClick={() => setShowInfoModal(true)}
                  className="w-full flex items-center justify-between px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                >
                  <span>Request More Info</span>
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Investment Metrics */}
            <div className="bg-white rounded-xl shadow-lg p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Investment Metrics</h3>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="flex items-center text-gray-600">
                    <DollarSign className="h-4 w-4 mr-2" />
                    Invested
                  </span>
                  <span className="font-semibold">
                    {pitchDetail && pitchDetail.totalRaised > 0
                      ? `$${pitchDetail.totalRaised.toLocaleString()}`
                      : 'No investments yet'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="flex items-center text-gray-600">
                    <TrendingUp className="h-4 w-4 mr-2" />
                    Expected ROI
                  </span>
                  <span className="font-semibold text-green-600">
                    {pitchDetail?.expectedROI != null ? `${pitchDetail.expectedROI}%` : 'N/A'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="flex items-center text-gray-600">
                    <Users className="h-4 w-4 mr-2" />
                    Investors
                  </span>
                  <span className="font-semibold">{pitchDetail?.investorCount ?? 0}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="flex items-center text-gray-600">
                    <Target className="h-4 w-4 mr-2" />
                    Avg Investment
                  </span>
                  <span className="font-semibold">
                    {pitchDetail && pitchDetail.avgInvestment > 0
                      ? `$${pitchDetail.avgInvestment.toLocaleString()}`
                      : 'N/A'}
                  </span>
                </div>
                {/* Funding progress bar */}
                {pitchDetail && pitchDetail.targetAmount && pitchDetail.targetAmount > 0 && (
                  <div className="pt-2">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm text-gray-600">Funding Progress</span>
                      <span className="text-sm font-medium">{pitchDetail.percentageRaised}%</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-blue-600 h-2 rounded-full transition-all"
                        style={{ width: `${Math.min(100, pitchDetail.percentageRaised)}%` }}
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Risk Assessment */}
            <div className="bg-white rounded-xl shadow-lg p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Risk Assessment</h3>
              <div className="space-y-3">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm text-gray-600">Market Risk</span>
                    <span className={`text-sm font-medium capitalize ${getRiskColor(pitchDetail?.riskLevel ?? 'medium')}`}>
                      {pitchDetail?.riskLevel ?? 'Medium'}
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className={`h-2 rounded-full ${getRiskBarColor(pitchDetail?.riskLevel ?? 'medium')}`}
                      style={{ width: `${getRiskPercent(pitchDetail?.riskLevel ?? 'medium')}%` }}
                    />
                  </div>
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm text-gray-600">Funding Progress</span>
                    <span className="text-sm font-medium">{pitchDetail?.percentageRaised ?? 0}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-blue-500 h-2 rounded-full"
                      style={{ width: `${Math.min(100, pitchDetail?.percentageRaised ?? 0)}%` }}
                    />
                  </div>
                </div>
                <div className="pt-2 flex items-center justify-between">
                  <span className="text-sm text-gray-600">Overall Risk</span>
                  <span className={`text-sm font-semibold capitalize px-2 py-0.5 rounded ${
                    pitchDetail?.riskLevel === 'low' ? 'bg-green-100 text-green-700' :
                    pitchDetail?.riskLevel === 'high' ? 'bg-red-100 text-red-700' :
                    'bg-yellow-100 text-yellow-700'
                  }`}>
                    {pitchDetail?.riskLevel ?? 'Medium'}
                  </span>
                </div>
              </div>
            </div>

            {/* Documents */}
            {(pitch.pitchDeck || pitch.script) && (
              <div className="bg-white rounded-xl shadow-lg p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Investment Documents</h3>
                <div className="space-y-2">
                  {pitch.pitchDeck && (
                    <a
                      href={pitch.pitchDeck}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-between p-2 hover:bg-gray-50 rounded"
                    >
                      <span className="flex items-center text-blue-600">
                        <FileText className="h-4 w-4 mr-2" />
                        Investment Deck
                      </span>
                      <Download className="h-4 w-4 text-gray-400" />
                    </a>
                  )}
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
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Express Interest Modal */}
      {showInterestModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Express Interest</h3>
              <button onClick={() => setShowInterestModal(false)} className="text-gray-400 hover:text-gray-600">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label htmlFor="interest-amount" className="block text-sm font-medium text-gray-700 mb-1">
                  Investment Amount ($) *
                </label>
                <input
                  type="number"
                  id="interest-amount"
                  value={interestForm.amount}
                  onChange={(e) => setInterestForm(prev => ({ ...prev, amount: e.target.value }))}
                  placeholder="e.g. 50000"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                />
              </div>
              <div>
                <label htmlFor="interest-level" className="block text-sm font-medium text-gray-700 mb-1">
                  Interest Level
                </label>
                <select
                  id="interest-level"
                  value={interestForm.level}
                  onChange={(e) => setInterestForm(prev => ({ ...prev, level: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="very_high">Very High</option>
                </select>
              </div>
              <div>
                <label htmlFor="interest-message" className="block text-sm font-medium text-gray-700 mb-1">
                  Message (optional)
                </label>
                <textarea
                  id="interest-message"
                  value={interestForm.message}
                  onChange={(e) => setInterestForm(prev => ({ ...prev, message: e.target.value }))}
                  placeholder="Tell the creator why you're interested..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                  rows={3}
                />
              </div>
              {actionError && <p className="text-sm text-red-600">{actionError}</p>}
              <div className="flex space-x-3">
                <button
                  onClick={() => setShowInterestModal(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleExpressInterest}
                  disabled={actionLoading || !interestForm.amount}
                  className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
                >
                  {actionLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Submit'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Schedule Meeting Modal */}
      {showMeetingModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Schedule Meeting</h3>
              <button onClick={() => setShowMeetingModal(false)} className="text-gray-400 hover:text-gray-600">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label htmlFor="meeting-datetime" className="block text-sm font-medium text-gray-700 mb-1">
                  Date & Time *
                </label>
                <input
                  type="datetime-local"
                  id="meeting-datetime"
                  value={meetingForm.dateTime}
                  onChange={(e) => setMeetingForm(prev => ({ ...prev, dateTime: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label htmlFor="meeting-type" className="block text-sm font-medium text-gray-700 mb-1">
                  Meeting Type
                </label>
                <select
                  id="meeting-type"
                  value={meetingForm.meetingType}
                  onChange={(e) => setMeetingForm(prev => ({ ...prev, meetingType: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="video">Video Call</option>
                  <option value="phone">Phone Call</option>
                  <option value="in_person">In Person</option>
                </select>
              </div>
              <div>
                <label htmlFor="meeting-message" className="block text-sm font-medium text-gray-700 mb-1">
                  Message (optional)
                </label>
                <textarea
                  id="meeting-message"
                  value={meetingForm.message}
                  onChange={(e) => setMeetingForm(prev => ({ ...prev, message: e.target.value }))}
                  placeholder="Any topics you'd like to discuss..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  rows={3}
                />
              </div>
              {actionError && <p className="text-sm text-red-600">{actionError}</p>}
              <div className="flex space-x-3">
                <button
                  onClick={() => setShowMeetingModal(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleScheduleMeeting}
                  disabled={actionLoading || !meetingForm.dateTime}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
                >
                  {actionLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Schedule'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Request Info Modal */}
      {showInfoModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Request More Info</h3>
              <button onClick={() => setShowInfoModal(false)} className="text-gray-400 hover:text-gray-600">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Information Categories
                </label>
                <div className="flex flex-wrap gap-2">
                  {['Financial Details', 'Team Background', 'Market Analysis', 'Distribution Plan', 'Legal Documents', 'Timeline'].map((cat) => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => toggleInfoCategory(cat)}
                      className={`px-3 py-1 rounded-full text-sm ${
                        infoForm.categories.includes(cat)
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label htmlFor="info-message" className="block text-sm font-medium text-gray-700 mb-1">
                  Message *
                </label>
                <textarea
                  id="info-message"
                  value={infoForm.message}
                  onChange={(e) => setInfoForm(prev => ({ ...prev, message: e.target.value }))}
                  placeholder="Describe what information you need..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  rows={4}
                />
              </div>
              {actionError && <p className="text-sm text-red-600">{actionError}</p>}
              <div className="flex space-x-3">
                <button
                  onClick={() => setShowInfoModal(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleRequestInfo}
                  disabled={actionLoading || !infoForm.message}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
                >
                  {actionLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Send Request'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default InvestorPitchView;
