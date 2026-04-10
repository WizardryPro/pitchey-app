import React from 'react';
import { Outlet, Navigate, useLocation } from 'react-router-dom';
import { useBetterAuthStore } from '@/store/betterAuthStore';
import { PortalLayout } from '@shared/components/layout/PortalLayout';
import { isProfileComplete } from '@/utils/profileCompleteness';
import { getPortalPath } from '@/utils/navigation';

interface ProfileGuardProps {
  userType: 'creator' | 'investor' | 'production';
}

export function ProfileGuard({ userType }: ProfileGuardProps) {
  const { user } = useBetterAuthStore();
  const location = useLocation();
  const portalPath = getPortalPath(userType);
  const onboardingPath = `/${portalPath}/onboarding`;
  const onOnboarding = location.pathname === onboardingPath;

  // Wait for auth to settle before making redirect decisions
  if (!user) {
    return null;
  }

  const complete = isProfileComplete(user);

  if (!complete && onOnboarding) {
    return <Outlet />;
  }

  if (!complete) {
    return <Navigate to={onboardingPath} replace />;
  }

  if (complete && onOnboarding) {
    return <Navigate to={`/${portalPath}/dashboard`} replace />;
  }

  return <PortalLayout userType={userType} />;
}
