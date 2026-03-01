import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { userService } from '@/services/user.service';
import type { User } from '@shared/types';

interface UserProfile extends User {
  followers?: number;
  following?: number;
  bio?: string;
  socialLinks?: {
    twitter?: string;
    linkedin?: string;
    website?: string;
  };
}

interface UserContextType {
  userProfiles: Map<string, UserProfile>;
  currentProfile: UserProfile | null;
  isLoading: boolean;
  error: string | null;
  fetchUserProfile: (userId: string) => Promise<UserProfile>;
  updateUserProfile: (userId: string, data: Partial<UserProfile>) => Promise<void>;
  followUser: (userId: string) => Promise<void>;
  unfollowUser: (userId: string) => Promise<void>;
  getFollowers: (userId: string) => Promise<User[]>;
  getFollowing: (userId: string) => Promise<User[]>;
  clearCache: () => void;
}

const UserContext = createContext<UserContextType | undefined>(undefined);

export const useUser = () => {
  const context = useContext(UserContext);
  if (!context) {
    throw new Error('useUser must be used within UserProvider');
  }
  return context;
};

interface UserProviderProps {
  children: ReactNode;
}

export const UserProvider: React.FC<UserProviderProps> = ({ children }) => {
  const [userProfiles, setUserProfiles] = useState<Map<string, UserProfile>>(new Map());
  const [currentProfile, setCurrentProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchUserProfile = useCallback(async (userId: string): Promise<UserProfile> => {
    // Check cache first
    const cached = userProfiles.get(userId);
    if (cached) {
      setCurrentProfile(cached);
      return cached;
    }

    try {
      setIsLoading(true);
      setError(null);

      const profile = await (userService as any).getProfile(userId);
      const userProfile: UserProfile = {
        ...profile,
        followers: (profile as any).followersCount || 0,
        following: (profile as any).followingCount || 0,
      };
      
      // Update cache
      setUserProfiles(prev => new Map(prev).set(userId, userProfile));
      setCurrentProfile(userProfile);
      
      return userProfile;
    } catch (err: any) {
      setError(err.message || 'Failed to fetch user profile');
      console.error('Error fetching user profile:', err);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [userProfiles]);

  const updateUserProfile = useCallback(async (userId: string, data: Partial<UserProfile>) => {
    try {
      setIsLoading(true);
      setError(null);

      const updatedProfile = await (userService as any).updateProfile(data);
      const userProfile: UserProfile = {
        ...updatedProfile,
        followers: (updatedProfile as any).followersCount || 0,
        following: (updatedProfile as any).followingCount || 0,
      };
      
      // Update cache
      setUserProfiles(prev => new Map(prev).set(userId, userProfile));
      
      // Update current if it's the same user
      if (currentProfile?.id.toString() === userId) {
        setCurrentProfile(userProfile);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to update user profile');
      console.error('Error updating user profile:', err);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [currentProfile]);

  const followUser = useCallback(async (userId: string) => {
    try {
      setIsLoading(true);
      setError(null);

      await (userService as any).followUser(userId);
      
      // Update cached profile if exists
      const profile = userProfiles.get(userId);
      if (profile) {
        const updated = {
          ...profile,
          followers: (profile.followers || 0) + 1,
        };
        setUserProfiles(prev => new Map(prev).set(userId, updated));
        
        if (currentProfile?.id.toString() === userId) {
          setCurrentProfile(updated);
        }
      }
    } catch (err: any) {
      setError(err.message || 'Failed to follow user');
      console.error('Error following user:', err);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [userProfiles, currentProfile]);

  const unfollowUser = useCallback(async (userId: string) => {
    try {
      setIsLoading(true);
      setError(null);

      await (userService as any).unfollowUser(userId);
      
      // Update cached profile if exists
      const profile = userProfiles.get(userId);
      if (profile) {
        const updated = {
          ...profile,
          followers: Math.max((profile.followers || 0) - 1, 0),
        };
        setUserProfiles(prev => new Map(prev).set(userId, updated));
        
        if (currentProfile?.id.toString() === userId) {
          setCurrentProfile(updated);
        }
      }
    } catch (err: any) {
      setError(err.message || 'Failed to unfollow user');
      console.error('Error unfollowing user:', err);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [userProfiles, currentProfile]);

  const getFollowers = useCallback(async (userId: string): Promise<User[]> => {
    try {
      setIsLoading(true);
      setError(null);
      return await (userService as any).getFollowers(userId);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch followers');
      console.error('Error fetching followers:', err);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const getFollowing = useCallback(async (userId: string): Promise<User[]> => {
    try {
      setIsLoading(true);
      setError(null);
      return await (userService as any).getFollowing(userId);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch following');
      console.error('Error fetching following:', err);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const clearCache = useCallback(() => {
    setUserProfiles(new Map());
    setCurrentProfile(null);
  }, []);

  const value: UserContextType = {
    userProfiles,
    currentProfile,
    isLoading,
    error,
    fetchUserProfile,
    updateUserProfile,
    followUser,
    unfollowUser,
    getFollowers,
    getFollowing,
    clearCache,
  };

  return <UserContext.Provider value={value}>{children}</UserContext.Provider>;
};