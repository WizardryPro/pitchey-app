import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Heart, UserPlus, Bookmark, Star } from 'lucide-react';
import { API_URL } from '@/config';
import { socialService } from '@features/browse/services/social.service';

/**
 * InterestedCard — the single, shared "Interested?" engagement box used on every
 * pitch view (Public, Creator portal, Production portal, generic PitchDetail).
 *
 * It groups the three audience actions Karl asked for — "Like this pitch",
 * "Follow this creator", "Save for later" — into one stylish, neat card so the
 * controls are no longer scattered/inconsistent per portal.
 *
 * Self-contained: it owns its own like/save/follow state and calls the proven
 * endpoints (POST/DELETE /api/pitches/:id/like + /save, socialService for follow).
 * Anonymous clicks route to sign-in carrying the current path. Owners see nothing.
 */
export interface InterestedCardProps {
  // Portals type pitch.id / creator id inconsistently (number vs string) — accept both.
  pitchId: number | string;
  creatorId?: number | string;
  initialLiked?: boolean;
  initialSaved?: boolean;
  isAuthenticated: boolean;
  isOwner?: boolean;
  /** Path to return to after sign-in for anonymous users. Defaults to current location. */
  fromPath?: string;
  /** Fired after a successful save/unsave so a parent can react (e.g. unlock a workspace). */
  onSavedChange?: (saved: boolean) => void;
  /** When set, shows a prominent "Rate & review" action that jumps to the feedback
   *  section. Surfaces the highest-value audience signal (rating/feedback) instead
   *  of leaving it buried below the fold. Authenticated → onRate(); anon → sign-in. */
  onRate?: () => void;
  className?: string;
}

const InterestedCard: React.FC<InterestedCardProps> = ({
  pitchId,
  creatorId,
  initialLiked = false,
  initialSaved = false,
  isAuthenticated,
  isOwner = false,
  fromPath,
  onSavedChange,
  onRate,
  className = '',
}) => {
  const navigate = useNavigate();
  // socialService follow APIs expect a numeric id; coerce once.
  const numericCreatorId =
    creatorId != null && creatorId !== '' && !Number.isNaN(Number(creatorId))
      ? Number(creatorId)
      : undefined;
  const [isLiked, setIsLiked] = useState(initialLiked);
  const [isSaved, setIsSaved] = useState(initialSaved);
  const [isFollowing, setIsFollowing] = useState(false);
  const [busy, setBusy] = useState<'like' | 'save' | 'follow' | null>(null);

  useEffect(() => { setIsLiked(initialLiked); }, [initialLiked]);
  useEffect(() => { setIsSaved(initialSaved); }, [initialSaved]);

  // Hydrate follow state on mount (FollowButton does the same).
  useEffect(() => {
    let cancelled = false;
    if (isAuthenticated && numericCreatorId && !isOwner) {
      socialService.checkFollowStatus(numericCreatorId, 'user')
        .then((s) => { if (!cancelled) setIsFollowing(s); })
        .catch(() => { /* non-fatal: default to not-following */ });
    }
    return () => { cancelled = true; };
  }, [isAuthenticated, numericCreatorId, isOwner]);

  const goToLogin = useCallback(() => {
    const from = fromPath ?? (typeof window !== 'undefined' ? window.location.pathname : `/pitch/${pitchId}`);
    void navigate('/login', { state: { from } });
  }, [navigate, fromPath, pitchId]);

  const toggleLike = useCallback(async () => {
    if (!isAuthenticated) return goToLogin();
    if (busy) return;
    const next = !isLiked;
    setIsLiked(next);
    setBusy('like');
    try {
      const res = await fetch(`${API_URL}/api/pitches/${pitchId}/like`, {
        method: next ? 'POST' : 'DELETE',
        credentials: 'include',
      });
      if (!res.ok) throw new Error(`Like failed: ${res.status}`);
    } catch (err) {
      console.error('InterestedCard like error:', err);
      setIsLiked(!next); // revert
    } finally {
      setBusy(null);
    }
  }, [isAuthenticated, busy, isLiked, pitchId, goToLogin]);

  const toggleSave = useCallback(async () => {
    if (!isAuthenticated) return goToLogin();
    if (busy) return;
    const next = !isSaved;
    setIsSaved(next);
    setBusy('save');
    try {
      const res = await fetch(`${API_URL}/api/pitches/${pitchId}/save`, {
        method: next ? 'POST' : 'DELETE',
        credentials: 'include',
      });
      if (!res.ok) throw new Error(`Save failed: ${res.status}`);
      onSavedChange?.(next);
    } catch (err) {
      console.error('InterestedCard save error:', err);
      setIsSaved(!next); // revert
    } finally {
      setBusy(null);
    }
  }, [isAuthenticated, busy, isSaved, pitchId, goToLogin, onSavedChange]);

  const toggleFollow = useCallback(async () => {
    if (!numericCreatorId) return;
    if (!isAuthenticated) return goToLogin();
    if (busy) return;
    const next = !isFollowing;
    setIsFollowing(next);
    setBusy('follow');
    try {
      if (next) await socialService.followUser(numericCreatorId);
      else await socialService.unfollowUser(numericCreatorId);
    } catch (err) {
      console.error('InterestedCard follow error:', err);
      setIsFollowing(!next); // revert
    } finally {
      setBusy(null);
    }
  }, [numericCreatorId, isAuthenticated, busy, isFollowing, goToLogin]);

  // Owners don't engage with their own pitch.
  if (isOwner) return null;

  const showFollow = !!numericCreatorId;

  return (
    <div className={`bg-white rounded-xl shadow-sm p-6 ${className}`}>
      <h3 className="text-lg font-semibold text-gray-900 mb-1">Interested?</h3>
      <p className="text-sm text-gray-500 mb-4">
        {isAuthenticated
          ? 'Rate it, follow the creator, or keep it close — all free.'
          : 'Sign in to rate, like, follow, and save — all free.'}
      </p>

      <div className="space-y-2">
        {/* Rate & review — the highest-value audience signal, surfaced up top */}
        {onRate && (
          <button
            type="button"
            onClick={() => (isAuthenticated ? onRate() : goToLogin())}
            className="w-full flex items-center gap-3 px-4 py-2.5 rounded-lg transition group bg-amber-50 text-amber-700 hover:bg-amber-100 ring-1 ring-amber-200/60"
          >
            <Star className="w-4 h-4 group-hover:fill-amber-300" />
            <span className="flex-1 text-left text-sm font-medium">Rate &amp; review</span>
            {!isAuthenticated && <span className="text-xs text-amber-500/80">Free</span>}
          </button>
        )}

        {/* Like this pitch */}
        <button
          type="button"
          onClick={toggleLike}
          aria-pressed={isLiked}
          className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg transition group ${
            isLiked
              ? 'bg-red-50 text-red-600 hover:bg-red-100'
              : 'bg-gray-50 text-gray-700 hover:bg-red-50 hover:text-red-600'
          }`}
        >
          <Heart className={`w-4 h-4 ${isLiked ? 'fill-current' : 'group-hover:fill-red-200'}`} />
          <span className="flex-1 text-left text-sm font-medium">
            {isLiked ? 'Liked' : 'Like this pitch'}
          </span>
          {!isAuthenticated && <span className="text-xs text-gray-400">Free</span>}
        </button>

        {/* Follow this creator */}
        {showFollow && (
          <button
            type="button"
            onClick={toggleFollow}
            aria-pressed={isFollowing}
            className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg transition group ${
              isFollowing
                ? 'bg-purple-50 text-purple-600 hover:bg-purple-100'
                : 'bg-gray-50 text-gray-700 hover:bg-purple-50 hover:text-purple-600'
            }`}
          >
            <UserPlus className="w-4 h-4" />
            <span className="flex-1 text-left text-sm font-medium">
              {isFollowing ? 'Following creator' : 'Follow this creator'}
            </span>
            {!isAuthenticated && <span className="text-xs text-gray-400">Free</span>}
          </button>
        )}

        {/* Save for later */}
        <button
          type="button"
          onClick={toggleSave}
          aria-pressed={isSaved}
          className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg transition group ${
            isSaved
              ? 'bg-blue-50 text-blue-600 hover:bg-blue-100'
              : 'bg-gray-50 text-gray-700 hover:bg-blue-50 hover:text-blue-600'
          }`}
        >
          <Bookmark className={`w-4 h-4 ${isSaved ? 'fill-current' : ''}`} />
          <span className="flex-1 text-left text-sm font-medium">
            {isSaved ? 'Saved for later' : 'Save for later'}
          </span>
          {!isAuthenticated && <span className="text-xs text-gray-400">Free</span>}
        </button>
      </div>

      {!isAuthenticated && (
        <p className="text-xs text-gray-400 mt-3 text-center">No credit card required</p>
      )}
    </div>
  );
};

export default InterestedCard;
