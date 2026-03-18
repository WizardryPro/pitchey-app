import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useBetterAuthStore } from '@/store/betterAuthStore';
import { socialService } from '../services/social.service';

interface FollowButtonProps {
  creatorId?: number;
  pitchId?: number;
  className?: string;
  variant?: 'default' | 'small' | 'large';
  showFollowingText?: boolean;
  onFollowChange?: (isFollowing: boolean) => void;
}

const FollowButton: React.FC<FollowButtonProps> = ({
  creatorId,
  pitchId,
  className = '',
  variant = 'default',
  showFollowingText = true,
  onFollowChange,
}) => {
  const [isFollowing, setIsFollowing] = useState(false);
  const [loading, setLoading] = useState(true);
  const { isAuthenticated } = useBetterAuthStore();
  const navigate = useNavigate();

  const checkFollowStatus = useCallback(async () => {
    if (!creatorId && !pitchId) {
      setLoading(false);
      return;
    }

    setLoading(true);

    try {
      if (!isAuthenticated) {
        setLoading(false);
        return;
      }

      let targetId: number;
      let type: 'user' | 'pitch';

      if (pitchId) {
        targetId = pitchId;
        type = 'pitch';
      } else if (creatorId) {
        targetId = creatorId;
        type = 'user';
      } else {
        setIsFollowing(false);
        setLoading(false);
        return;
      }

      const status = await socialService.checkFollowStatus(targetId, type);
      setIsFollowing(status);
    } catch (error) {
      console.error('Error checking follow status:', error);
      setIsFollowing(false);
    } finally {
      setLoading(false);
    }
  }, [creatorId, pitchId, isAuthenticated]);

  useEffect(() => {
    checkFollowStatus();
  }, [checkFollowStatus]);

  const handleFollow = useCallback(async () => {
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }

    setLoading(true);

    try {
      if (isFollowing) {
        // Unfollow
        if (pitchId) {
          await socialService.unfollowPitch(pitchId);
        } else if (creatorId) {
          await socialService.unfollowUser(creatorId);
        }
        setIsFollowing(false);
        onFollowChange?.(false);
      } else {
        // Follow
        if (pitchId) {
          await socialService.followPitch(pitchId);
        } else if (creatorId) {
          await socialService.followUser(creatorId);
        }
        setIsFollowing(true);
        onFollowChange?.(true);
      }
    } catch (error) {
      console.error('Error updating follow status:', error);
      // You might want to show a toast notification here
    } finally {
      setLoading(false);
    }
  }, [isFollowing, pitchId, creatorId, onFollowChange, navigate, isAuthenticated]);

  const getButtonClasses = useCallback(() => {
    const baseClasses = 'font-medium rounded-lg transition-colors duration-200 flex items-center justify-center';
    
    const variantClasses = {
      small: 'px-3 py-1 text-sm',
      default: 'px-4 py-2 text-sm',
      large: 'px-6 py-3 text-base',
    };

    const stateClasses = isFollowing
      ? 'bg-gray-100 text-gray-700 hover:bg-gray-200 border border-gray-300'
      : 'bg-blue-600 text-white hover:bg-blue-700 border border-blue-600';

    const disabledClasses = loading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer';

    return `${baseClasses} ${variantClasses[variant]} ${stateClasses} ${disabledClasses} ${className}`;
  }, [isFollowing, loading, variant, className]);

  const getButtonText = useCallback(() => {
    if (loading) return 'Loading...';
    
    if (isFollowing) {
      return showFollowingText ? 'Following' : 'Unfollow';
    }
    
    return 'Follow';
  }, [loading, isFollowing, showFollowingText]);

  const getIcon = useCallback(() => {
    if (loading) {
      return (
        <svg className="animate-spin -ml-1 mr-2 h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
      );
    }

    if (isFollowing) {
      return (
        <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
        </svg>
      );
    }

    return (
      <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
      </svg>
    );
  }, [loading, isFollowing]);

  // Don't render if we're still loading and not authenticated
  if (loading && !isAuthenticated) {
    return null;
  }
  
  // Don't render if no valid target ID
  if (!creatorId && !pitchId) {
    return null;
  }
  
  // Don't render if creator ID is empty string or 0
  if (!pitchId && (!creatorId || String(creatorId) === '' || Number(creatorId) === 0)) {
    return null;
  }

  return (
    <button
      onClick={handleFollow}
      disabled={loading}
      className={getButtonClasses()}
      title={isFollowing ? `Unfollow ${pitchId ? 'pitch' : 'creator'}` : `Follow ${pitchId ? 'pitch' : 'creator'}`}
    >
      {getIcon()}
      <span>{getButtonText()}</span>
    </button>
  );
};

export default FollowButton;