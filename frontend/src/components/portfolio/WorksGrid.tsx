import React from 'react';
import { Link } from 'react-router-dom';
import WorkCard from './WorkCard';

interface Work {
  id: string;
  title: string;
  tagline: string;
  category: string;
  thumbnail: string;
  views: number;
  rating?: number;
  status: string;
  budget: string;
  createdAt: string;
  description?: string;
  releaseDate?: string;
  boxOffice?: string;
  productionStage?: string;
}

interface WorksGridProps {
  works: Work[];
  userType: 'creator' | 'production' | 'investor';
  isOwnProfile?: boolean;
}

const WorksGrid: React.FC<WorksGridProps> = ({ works, userType, isOwnProfile = false }) => {
  // Get appropriate labels based on user type
  const getPortfolioTitle = () => {
    switch (userType) {
      case 'production':
        return '🎬 Productions';
      case 'investor':
        return '💼 Investments';
      default:
        return '🎬 Portfolio';
    }
  };

  const getEmptyStateMessage = () => {
    if (isOwnProfile) {
      switch (userType) {
        case 'production':
          return 'Showcase your production company\'s work';
        case 'investor':
          return 'Start tracking your investment portfolio';
        default:
          return 'Start building your portfolio by creating your first pitch';
      }
    } else {
      switch (userType) {
        case 'production':
          return 'This production company hasn\'t shared any projects yet';
        case 'investor':
          return 'This investor hasn\'t shared any investments yet';
        default:
          return 'This creator hasn\'t shared any pitches yet';
      }
    }
  };

  const getCreateButtonText = () => {
    switch (userType) {
      case 'production':
        return 'Add Your First Project';
      case 'investor':
        return 'Add Your First Investment';
      default:
        return 'Create Your First Pitch';
    }
  };

  const getCreateButtonLink = () => {
    switch (userType) {
      case 'production':
        return '/production/add-project';
      case 'investor':
        return '/investor/add-investment';
      default:
        return '/creator/pitch/new';
    }
  };

  return (
    <div className="bg-white rounded-2xl shadow-xl p-8">
      <h2 className="text-2xl font-bold text-gray-900 mb-6">{getPortfolioTitle()}</h2>
      
      {works && works.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {works.map((work) => (
            <WorkCard 
              key={work.id} 
              work={work} 
              userType={userType}
            />
          ))}
        </div>
      ) : (
        <div className="text-center py-12">
          <div className="text-6xl mb-4">
            {userType === 'production' ? '🎥' : userType === 'investor' ? '💰' : '🎬'}
          </div>
          <h3 className="text-xl font-semibold text-gray-700 mb-2">
            No {userType === 'production' ? 'projects' : userType === 'investor' ? 'investments' : 'pitches'} yet
          </h3>
          <p className="text-gray-500 mb-6">
            {getEmptyStateMessage()}
          </p>
          {isOwnProfile && (
            <Link 
              to={getCreateButtonLink()}
              className="inline-flex items-center px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors font-medium"
            >
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"/>
              </svg>
              {getCreateButtonText()}
            </Link>
          )}
        </div>
      )}
    </div>
  );
};

export default WorksGrid;