import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { BadgeCheck, Film, Eye, Heart, Calendar } from 'lucide-react';
import { API_URL } from '../config';

interface Creator {
  id: number;
  name: string;
  username: string;
  bio: string | null;
  avatar_url: string | null;
  is_verified: boolean;
  created_at: string;
}

interface Pitch {
  id: number;
  title: string;
  logline: string;
  genre: string;
  cover_image: string | null;
  view_count: number;
  like_count: number;
  created_at: string;
}

interface PortfolioResponse {
  success: boolean;
  data?: {
    creator: Creator;
    pitches: Pitch[];
  };
  error?: string;
}

const GENRE_COLORS: Record<string, string> = {
  'Action': 'bg-red-100 text-red-700',
  'Comedy': 'bg-yellow-100 text-yellow-700',
  'Drama': 'bg-blue-100 text-blue-700',
  'Horror': 'bg-gray-100 text-gray-700',
  'Sci-Fi': 'bg-purple-100 text-purple-700',
  'Romance': 'bg-pink-100 text-pink-700',
  'Thriller': 'bg-orange-100 text-orange-700',
  'Documentary': 'bg-green-100 text-green-700',
  'Animation': 'bg-indigo-100 text-indigo-700',
  'Fantasy': 'bg-violet-100 text-violet-700',
};

export default function SharedPortfolio() {
  const { token } = useParams<{ token: string }>();
  const [creator, setCreator] = useState<Creator | null>(null);
  const [pitches, setPitches] = useState<Pitch[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!token) return;
    fetchPortfolio(token);
  }, [token]);

  async function fetchPortfolio(t: string) {
    try {
      const res = await fetch(`${API_URL}/api/portfolio/s/${t}`);
      if (res.status === 404) {
        setNotFound(true);
        return;
      }
      const json: PortfolioResponse = await res.json();
      if (json.success && json.data) {
        setCreator(json.data.creator);
        setPitches(json.data.pitches);
      } else {
        setNotFound(true);
      }
    } catch {
      setNotFound(true);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 to-indigo-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600" />
      </div>
    );
  }

  if (notFound || !creator) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 to-indigo-50 flex items-center justify-center">
        <div className="text-center max-w-md px-6">
          <Film className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Portfolio Not Available</h1>
          <p className="text-gray-500 mb-6">
            This portfolio link is no longer active or doesn't exist.
          </p>
          <Link
            to="/"
            className="inline-block px-6 py-2.5 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors font-medium"
          >
            Go to Pitchey
          </Link>
        </div>
      </div>
    );
  }

  const joinedDate = new Date(creator.created_at).toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  });

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-indigo-50">
      {/* Creator Header */}
      <div className="bg-white border-b">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6">
            <div className="w-20 h-20 rounded-full bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center text-white text-2xl font-bold flex-shrink-0">
              {creator.avatar_url ? (
                <img
                  src={creator.avatar_url}
                  alt={creator.name}
                  className="w-20 h-20 rounded-full object-cover"
                />
              ) : (
                (creator.name || '?').charAt(0).toUpperCase()
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <h1 className="text-2xl font-bold text-gray-900">{creator.name}</h1>
                {creator.is_verified && (
                  <BadgeCheck className="w-5 h-5 text-blue-500 flex-shrink-0" />
                )}
              </div>
              {creator.username && (
                <p className="text-gray-500 text-sm mb-2">@{creator.username}</p>
              )}
              {creator.bio && (
                <p className="text-gray-600 text-sm max-w-xl">{creator.bio}</p>
              )}
              <div className="flex items-center gap-4 mt-3 text-sm text-gray-500">
                <span className="flex items-center gap-1">
                  <Film className="w-4 h-4" />
                  {pitches.length} {pitches.length === 1 ? 'pitch' : 'pitches'}
                </span>
                <span className="flex items-center gap-1">
                  <Calendar className="w-4 h-4" />
                  Joined {joinedDate}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Pitches Grid */}
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {pitches.length === 0 ? (
          <div className="text-center py-16">
            <Film className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500">No published pitches yet.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {pitches.map(pitch => (
              <Link
                key={pitch.id}
                to={`/pitch/${pitch.id}`}
                className="bg-white rounded-xl shadow-sm hover:shadow-md transition-shadow overflow-hidden group"
              >
                {pitch.cover_image ? (
                  <div className="aspect-video bg-gray-100 overflow-hidden">
                    <img
                      src={pitch.cover_image}
                      alt={pitch.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  </div>
                ) : (
                  <div className="aspect-video bg-gradient-to-br from-purple-100 to-indigo-100 flex items-center justify-center">
                    <Film className="w-10 h-10 text-purple-300" />
                  </div>
                )}
                <div className="p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <h3 className="font-semibold text-gray-900 truncate">{pitch.title}</h3>
                    {pitch.genre && (
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full flex-shrink-0 ${
                          GENRE_COLORS[pitch.genre] || 'bg-gray-100 text-gray-700'
                        }`}
                      >
                        {pitch.genre}
                      </span>
                    )}
                  </div>
                  {pitch.logline && (
                    <p className="text-sm text-gray-600 line-clamp-2 mb-3">{pitch.logline}</p>
                  )}
                  <div className="flex items-center gap-4 text-xs text-gray-400">
                    <span className="flex items-center gap-1">
                      <Eye className="w-3.5 h-3.5" />
                      {pitch.view_count}
                    </span>
                    <span className="flex items-center gap-1">
                      <Heart className="w-3.5 h-3.5" />
                      {pitch.like_count}
                    </span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      <footer className="border-t bg-white mt-12">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6 text-center">
          <p className="text-sm text-gray-400">
            Powered by{' '}
            <Link to="/" className="text-purple-600 hover:text-purple-700 font-medium">
              Pitchey
            </Link>
            {' '}&middot;{' '}
            <Link to="/register" className="text-purple-600 hover:text-purple-700">
              Create your portfolio
            </Link>
          </p>
        </div>
      </footer>
    </div>
  );
}
