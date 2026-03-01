import React from 'react';
import { Outlet, Navigate, useLocation } from 'react-router-dom';
import { useBetterAuthStore } from '../../store/betterAuthStore';
import { PortalLayout } from '@shared/components/layout/PortalLayout';
import { isProfileComplete } from '../../utils/profileCompleteness';

interface ProfileGuardProps {
  userType: 'creator' | 'investor' | 'production';
}

export function ProfileGuard({ userType }: ProfileGuardProps) {
  const { user } = useBetterAuthStore();
  const location = useLocation();
  const complete = isProfileComplete(user);
  const onboardingPath = `/${userType}/onboarding`;
  const onOnboarding = location.pathname === onboardingPath;

  if (!complete && onOnboarding) {
    return <Outlet />;
  }

  if (!complete) {
    return <Navigate to={onboardingPath} replace />;
  }

  if (complete && onOnboarding) {
    return <Navigate to={`/${userType}/dashboard`} replace />;
  }

  return <PortalLayout userType={userType} />;
}
