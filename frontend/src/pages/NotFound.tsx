import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Home, ArrowLeft, Search } from 'lucide-react';

const NotFound: React.FC = () => {
  const navigate = useNavigate();

  const handleGoHome = () => {
    void navigate('/');
  };

  const handleGoBack = () => {
    void navigate(-1);
  };

  const handleSearch = () => {
    void navigate('/marketplace');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-indigo-50 flex items-center justify-center px-4">
      <div className="max-w-lg w-full text-center">
        {/* 404 Animation */}
        <div className="mb-8">
          <div className="text-8xl font-bold text-purple-200 mb-4 animate-pulse">
            404
          </div>
          <div className="w-24 h-24 mx-auto mb-6 bg-purple-100 rounded-full flex items-center justify-center">
            <Search className="w-12 h-12 text-purple-400" />
          </div>
        </div>

        {/* Error Message */}
        <h1 className="text-3xl font-bold text-gray-900 mb-4">
          Page Not Found
        </h1>
        <p className="text-lg text-gray-600 mb-8">
          Sorry, we couldn't find the page you're looking for. The page might have been moved, deleted, or you might have entered the wrong URL.
        </p>

        {/* Action Buttons */}
        <div className="space-y-4 sm:space-y-0 sm:space-x-4 sm:flex sm:justify-center">
          <button
            onClick={handleGoBack}
            className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-3 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors font-medium"
          >
            <ArrowLeft className="w-4 h-4" />
            Go Back
          </button>
          
          <button
            onClick={handleGoHome}
            className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors font-medium"
          >
            <Home className="w-4 h-4" />
            Go Home
          </button>
          
          <button
            onClick={handleSearch}
            className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-medium"
          >
            <Search className="w-4 h-4" />
            Browse Pitches
          </button>
        </div>

        {/* Popular Links */}
        <div className="mt-12 pt-8 border-t border-gray-200">
          <h3 className="text-sm font-medium text-gray-700 mb-4">
            Popular pages:
          </h3>
          <div className="flex flex-wrap justify-center gap-4 text-sm">
            <button
              onClick={() => { void navigate('/marketplace'); }}
              className="text-purple-600 hover:text-purple-700 underline"
            >
              Marketplace
            </button>
            <button
              onClick={() => { void navigate('/login'); }}
              className="text-purple-600 hover:text-purple-700 underline"
            >
              Sign In
            </button>
            {/* Add more popular links based on user type */}
          </div>
        </div>
      </div>
    </div>
  );
};

export default NotFound;