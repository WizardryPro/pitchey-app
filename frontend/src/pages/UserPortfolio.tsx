import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { API_URL } from '../config';
import ProfileHeader from '../components/portfolio/ProfileHeader';
import AchievementsSection from '../components/portfolio/AchievementsSection';
import WorksGrid from '../components/portfolio/WorksGrid';
import LoadingState from '../components/portfolio/LoadingState';
import ErrorState from '../components/portfolio/ErrorState';
import { useBetterAuthStore } from '../store/betterAuthStore';

interface UserProfile {
  id: string;
  name: string;
  username: string;
  avatar: string;
  bio: string;
  location: string;
  joinedDate: string;
  verified?: boolean;
  userType: 'creator' | 'production' | 'investor';
  companyName?: string; // For production companies
  stats: {
    totalWorks: number; // Pitches for creators, Projects for production
    totalViews: number;
    totalFollowers: number;
    avgRating?: number; // For creators
    successRate?: number; // For production companies
  };
  socialLinks?: {
    website?: string;
    twitter?: string;
    linkedin?: string;
  };
}

interface Work {
  id: string;
  title: string;
  tagline: string;
  category: string; // genre for creators, type for production
  thumbnail: string;
  views: number;
  rating?: number;
  status: string;
  budget: string;
  createdAt: string;
  description?: string;
  // Production-specific fields
  releaseDate?: string;
  boxOffice?: string;
  productionStage?: string;
}

interface Achievement {
  icon: string;
  title: string;
  event: string;
  year: string;
}

interface PortfolioData {
  success: boolean;
  profile: UserProfile;
  works: Work[];
  achievements: Achievement[];
}

const UserPortfolio: React.FC = () => {
  const { userId } = useParams<{ userId: string }>();
  const { user: authUser } = useBetterAuthStore();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [portfolio, setPortfolio] = useState<PortfolioData | null>(null);
  const navigate = useNavigate();

  // Get effective user ID from route params or auth store
  const effectiveUserId = userId || authUser?.id?.toString() || null;

  // Check if this is the user's own profile
  const isOwnProfile = () => {
    if (!authUser?.id || !effectiveUserId) return false;
    return authUser.id.toString() === effectiveUserId.toString();
  };

  // Get user type from portfolio data or auth store
  const getUserType = (): string => {
    if (portfolio?.profile?.userType) {
      return portfolio.profile.userType;
    }
    return authUser?.userType || 'creator';
  };

  const fetchPortfolio = async () => {
    if (!effectiveUserId) return;
    setLoading(true);
    setError(null);

    try {
      const apiUrl = API_URL;
      
      // Use a unified endpoint that works for all user types
      const response = await fetch(`${apiUrl}/api/portfolio/${effectiveUserId}`);
      
      if (!response.ok) {
        // Fallback to creator endpoint for backward compatibility
        const creatorResponse = await fetch(`${apiUrl}/api/creator/portfolio/${effectiveUserId}`);
        if (creatorResponse.ok) {
          const creatorData = await creatorResponse.json();
          // Transform creator data to unified format
          const unifiedData: PortfolioData = {
            success: creatorData.success,
            profile: {
              ...creatorData.creator,
              userType: 'creator',
              stats: {
                totalWorks: creatorData.creator?.stats?.totalPitches ?? 0,
                totalViews: creatorData.creator?.stats?.totalViews ?? 0,
                totalFollowers: creatorData.creator?.stats?.totalFollowers ?? 0,
                avgRating: creatorData.creator?.stats?.avgRating ?? 0
              }
            },
            works: creatorData.pitches,
            achievements: creatorData.achievements
          };
          setPortfolio(unifiedData);
          return;
        }
        throw new Error(`Failed to fetch portfolio (${response.status})`);
      }

      const data: PortfolioData = await response.json();
      
      if (!data.success) {
        throw new Error('Portfolio data indicates failure');
      }
      
      setPortfolio(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load portfolio');
    } finally {
      setLoading(false);
    }
  };

  const handleRetry = () => {
    void fetchPortfolio();
  };

  const handleGoBack = () => {
    void navigate(-1);
  };

  const handleBackToDashboard = () => {
    const userType = getUserType();
    // Navigate to appropriate dashboard based on user type
    switch (userType) {
      case 'production':
        void navigate('/production/dashboard');
        break;
      case 'investor':
        void navigate('/investor/dashboard');
        break;
      default:
        void navigate('/creator/dashboard');
    }
  };

  useEffect(() => {
    if (effectiveUserId) {
      void fetchPortfolio();
    }
  }, [effectiveUserId]);

  // If no user ID available (no route param and no authenticated user), show error
  if (!effectiveUserId) {
    return (
      <div style={{ minHeight: '100vh', background: 'linear-gradient(to bottom right, #f3e7ff, #ffffff, #ffe0f7)', padding: '20px' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
          <div className="mb-6">
            <button
              onClick={() => navigate(-1)}
              className="inline-flex items-center px-4 py-2 bg-white text-gray-700 rounded-lg shadow-md hover:shadow-lg hover:bg-gray-50 transition-all duration-200 border border-gray-200"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Go Back
            </button>
          </div>
          <ErrorState
            error="Please log in to view your portfolio"
            onRetry={() => navigate('/login')}
            onGoBack={() => navigate(-1)}
          />
        </div>
      </div>
    );
  }

  if (loading) {
    return <LoadingState />;
  }

  if (error || !portfolio) {
    return (
      <div style={{ minHeight: '100vh', background: 'linear-gradient(to bottom right, #f3e7ff, #ffffff, #ffe0f7)', padding: '20px' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
          {/* Back Button */}
          <div className="mb-6">
            <button
              onClick={handleBackToDashboard}
              className="inline-flex items-center px-4 py-2 bg-white text-gray-700 rounded-lg shadow-md hover:shadow-lg hover:bg-gray-50 transition-all duration-200 border border-gray-200"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Dashboard
            </button>
          </div>
          
          <ErrorState 
            error={error || 'Portfolio not found'} 
            onRetry={handleRetry}
            onGoBack={handleGoBack}
          />
        </div>
      </div>
    );
  }

  const { profile, works, achievements } = portfolio;

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(to bottom right, #f3e7ff, #ffffff, #ffe0f7)', padding: '20px' }}>
      {/* Fixed Position Back Button */}
      <div style={{ 
        position: 'fixed', 
        top: '20px', 
        left: '20px', 
        zIndex: 50 
      }}>
        <button
          onClick={handleBackToDashboard}
          style={{
            display: 'flex',
            alignItems: 'center',
            padding: '12px 20px',
            backgroundColor: '#8b5cf6',
            color: 'white',
            borderRadius: '12px',
            border: 'none',
            cursor: 'pointer',
            fontSize: '16px',
            fontWeight: '600',
            boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
            transition: 'all 0.2s'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = '#7c3aed';
            e.currentTarget.style.boxShadow = '0 6px 12px rgba(0, 0, 0, 0.15)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = '#8b5cf6';
            e.currentTarget.style.boxShadow = '0 4px 6px rgba(0, 0, 0, 0.1)';
          }}
        >
          <ArrowLeft style={{ width: '20px', height: '20px', marginRight: '8px' }} />
          Back to Dashboard
        </button>
      </div>

      <div style={{ maxWidth: '1200px', margin: '0 auto', paddingTop: '60px' }}>
        <ProfileHeader 
          profile={profile} 
          isOwnProfile={isOwnProfile()} 
        />
        
        <AchievementsSection achievements={achievements} />
        
        <WorksGrid 
          works={works}
          userType={profile.userType}
          isOwnProfile={isOwnProfile()} 
        />
      </div>
    </div>
  );
};

export default UserPortfolio;