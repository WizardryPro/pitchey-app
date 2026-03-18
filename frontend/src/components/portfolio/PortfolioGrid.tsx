import React from 'react';
import { Link } from 'react-router-dom';
import PitchCard from './PitchCard';

interface Pitch {
  id: string;
  title: string;
  tagline: string;
  genre: string;
  thumbnail: string;
  views: number;
  rating: number;
  status: string;
  budget: string;
  createdAt: string;
  description?: string;
}

interface PortfolioGridProps {
  pitches: Pitch[];
  isOwnProfile?: boolean;
}

const PortfolioGrid: React.FC<PortfolioGridProps> = ({ pitches, isOwnProfile = false }) => {
  return (
    <div className="bg-white rounded-2xl shadow-xl p-8">
      <h2 className="text-2xl font-bold text-gray-900 mb-6">🎬 Portfolio</h2>
      
      {pitches && pitches.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {pitches.map((pitch) => (
            <PitchCard key={pitch.id} pitch={pitch} />
          ))}
        </div>
      ) : (
        <div className="text-center py-12">
          <div className="text-6xl mb-4">🎬</div>
          <h3 className="text-xl font-semibold text-gray-700 mb-2">No pitches yet</h3>
          <p className="text-gray-500 mb-6">
            {isOwnProfile 
              ? "Start building your portfolio by creating your first pitch" 
              : "This creator hasn't shared any pitches yet"
            }
          </p>
          {isOwnProfile && (
            <Link 
              to="/creator/pitch/new"
              className="inline-flex items-center px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors font-medium"
            >
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"/>
              </svg>
              Create Your First Pitch
            </Link>
          )}
        </div>
      )}
    </div>
  );
};

export default PortfolioGrid;