import React from 'react';
import { Link } from 'react-router-dom';
import GenrePlaceholder from '@shared/components/GenrePlaceholder';

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

interface PitchCardProps {
  pitch: Pitch;
}

const PitchCard: React.FC<PitchCardProps> = ({ pitch }) => {
  const formatNumber = (num: number) => {
    if (num >= 1000000) {
      return (num / 1000000).toFixed(1) + 'M';
    } else if (num >= 1000) {
      return (num / 1000).toFixed(1) + 'K';
    }
    return num.toString();
  };

  return (
    <div className="bg-white rounded-xl shadow-lg overflow-hidden hover:shadow-2xl transition-all group">
      <div className="relative h-48 overflow-hidden">
        {pitch.thumbnail ? (
          <img
            src={pitch.thumbnail}
            alt={pitch.title}
            className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
          />
        ) : (
          <GenrePlaceholder genre={pitch.genre} />
        )}
        <div className="absolute top-2 right-2 px-2 py-1 bg-black bg-opacity-70 text-white text-xs rounded z-10">
          {pitch.genre}
        </div>
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black via-black/50 to-transparent p-4 pt-8">
          <div className="flex items-center justify-between text-white text-sm">
            <span className="flex items-center min-w-0 flex-1 mr-2">
              <svg className="w-4 h-4 mr-1 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path d="M10 12a2 2 0 100-4 2 2 0 000 4z"/>
                <path d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z"/>
              </svg>
              <span className="truncate">{formatNumber(pitch.views)}</span>
            </span>
            <span className="flex items-center flex-shrink-0">
              <svg className="w-4 h-4 mr-1 text-yellow-400 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/>
              </svg>
              {pitch.rating.toFixed(1)}
            </span>
          </div>
        </div>
      </div>
      
      <div className="p-6 flex flex-col h-auto">
        <h3 className="text-xl font-bold text-gray-900 mb-2 line-clamp-2 min-h-[3.5rem]">
          {pitch.title}
        </h3>
        <p className="text-gray-600 mb-4 line-clamp-2 flex-grow min-h-[2.5rem]">
          {pitch.tagline}
        </p>
        {pitch.description && (
          <p className="text-sm text-gray-500 mb-4 line-clamp-3 flex-grow min-h-[3.75rem]">
            {pitch.description}
          </p>
        )}
        <div className="flex items-center justify-between text-sm mb-4 mt-auto">
          <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-xs font-medium">
            {pitch.status}
          </span>
          <span className="text-gray-500 font-semibold text-xs">
            {pitch.budget}
          </span>
        </div>
        <div className="pt-4 border-t mt-auto">
          <Link 
            to={`/pitch/${pitch.id}`}
            className="block w-full text-center px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors text-sm font-medium"
          >
            View Details
          </Link>
        </div>
      </div>
    </div>
  );
};

export default PitchCard;