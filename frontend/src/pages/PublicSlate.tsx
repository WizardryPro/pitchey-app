import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Layers, Film, Eye, Heart, BadgeCheck } from 'lucide-react';
import { API_URL } from '../config';

interface Creator {
  id: number;
  name: string;
  username: string | null;
  avatar_url: string | null;
}

interface SlatePitch {
  id: number;
  title: string;
  logline: string | null;
  genre: string | null;
  format: string | null;
  cover_image: string | null;
  view_count: number;
  like_count: number;
  position: number;
}

interface Slate {
  id: number;
  title: string;
  description: string | null;
  cover_image: string | null;
  creator: Creator;
  pitches: SlatePitch[];
}

interface SlateResponse {
  success: boolean;
  data?: Slate;
  error?: string;
}

export default function PublicSlate() {
  const { id } = useParams<{ id: string }>();
  const [slate, setSlate] = useState<Slate | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!id) return;
    (async () => {
      try {
        const res = await fetch(`${API_URL}/api/slates/${id}/public`);
        if (res.status === 404) {
          setNotFound(true);
          return;
        }
        const json: SlateResponse = await res.json();
        if (json.success && json.data) {
          setSlate(json.data);
        } else {
          setNotFound(true);
        }
      } catch {
        setNotFound(true);
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 to-indigo-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600" />
      </div>
    );
  }

  if (notFound || !slate) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 to-indigo-50 flex items-center justify-center">
        <div className="text-center max-w-md px-6">
          <Layers className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Slate Not Available</h1>
          <p className="text-gray-500 mb-6">This slate is not published or doesn't exist.</p>
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-indigo-50">
      {/* Slate header */}
      <div className="bg-white border-b">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {slate.cover_image && (
            <div className="aspect-[3/1] bg-gray-100 rounded-xl overflow-hidden mb-6">
              <img src={slate.cover_image} alt={slate.title} className="w-full h-full object-cover" />
            </div>
          )}
          <div className="flex items-center gap-2 mb-2 text-sm text-purple-600">
            <Layers className="w-4 h-4" />
            <span className="font-medium uppercase tracking-wide">Slate</span>
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">{slate.title}</h1>
          {slate.description && (
            <p className="text-gray-600 max-w-3xl mb-4">{slate.description}</p>
          )}
          <Link
            to={`/user/${slate.creator.id}`}
            className="inline-flex items-center gap-2 text-sm text-gray-700 hover:text-purple-600 transition-colors"
          >
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
              {slate.creator.avatar_url ? (
                <img
                  src={slate.creator.avatar_url}
                  alt={slate.creator.name}
                  className="w-8 h-8 rounded-full object-cover"
                />
              ) : (
                (slate.creator.name || '?').charAt(0).toUpperCase()
              )}
            </div>
            <span className="font-medium">{slate.creator.name}</span>
            {slate.creator.username && (
              <span className="text-gray-400">@{slate.creator.username}</span>
            )}
          </Link>
          <div className="mt-3 text-sm text-gray-500">
            {slate.pitches.length} {slate.pitches.length === 1 ? 'pitch' : 'pitches'}
          </div>
        </div>
      </div>

      {/* Pitches */}
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {slate.pitches.length === 0 ? (
          <div className="text-center py-16">
            <Film className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500">No pitches in this slate yet.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {slate.pitches.map(pitch => (
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
                  <h3 className="font-semibold text-gray-900 truncate">{pitch.title}</h3>
                  {pitch.logline && (
                    <p className="text-sm text-gray-600 line-clamp-2 mt-1 mb-3">{pitch.logline}</p>
                  )}
                  <div className="flex items-center gap-4 text-xs text-gray-400">
                    {pitch.genre && <span>{pitch.genre}</span>}
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

      <footer className="border-t bg-white mt-12">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6 text-center">
          <p className="text-sm text-gray-400">
            Powered by{' '}
            <Link to="/" className="text-purple-600 hover:text-purple-700 font-medium">
              Pitchey
            </Link>
            {' '}&middot;{' '}
            <Link to="/register" className="text-purple-600 hover:text-purple-700">
              Create your slate
            </Link>
          </p>
        </div>
      </footer>
    </div>
  );
}
