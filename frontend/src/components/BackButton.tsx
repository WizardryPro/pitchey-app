import { useNavigate, useLocation } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

interface BackButtonProps {
  to?: string;
  className?: string;
  label?: string;
  variant?: 'light' | 'dark';
  iconOnly?: boolean;
}

export default function BackButton({
  to,
  className = '',
  label,
  variant = 'light',
  iconOnly = false
}: BackButtonProps) {
  const navigate = useNavigate();
  const location = useLocation();

  const handleBack = () => {
    if (to) {
      void navigate(to);
      return;
    }

    // Intelligent back navigation based on current path
    const path = location.pathname;
    
    // If on a login page, go back to portals
    if (path.startsWith('/login/')) {
      void navigate('/login');
      return;
    }
    
    // If on portals page, go back to marketplace
    if (path === '/login') {
      void navigate('/');
      return;
    }
    
    // If on a pitch detail page, try to go back to marketplace
    if (path.startsWith('/pitch/') && !path.includes('/edit') && !path.includes('/analytics')) {
      void navigate('/');
      return;
    }
    
    // For creator pages, go back to creator dashboard
    if (path.startsWith('/creator/') && path !== '/creator/dashboard') {
      void navigate('/creator/dashboard');
      return;
    }
    
    // For investor pages, go back to investor dashboard
    if (path.startsWith('/investor/') && path !== '/investor/dashboard') {
      void navigate('/investor/dashboard');
      return;
    }
    
    // For production pages, go back to production dashboard
    if (path.startsWith('/production/') && path !== '/production/dashboard') {
      void navigate('/production/dashboard');
      return;
    }
    
    // Default fallback - try browser back or go to marketplace
    if (window.history.length > 1) {
      void navigate(-1);
    } else {
      void navigate('/');
    }
  };

  const getDefaultLabel = () => {
    const path = location.pathname;
    
    if (path.startsWith('/login/')) return 'Back to Portal Selection';
    if (path === '/login') return 'Back to Marketplace';
    if (path.startsWith('/pitch/')) return 'Back to Marketplace';
    if (path.startsWith('/creator/') && path !== '/creator/dashboard') return 'Back to Dashboard';
    if (path.startsWith('/investor/') && path !== '/investor/dashboard') return 'Back to Dashboard';
    if (path.startsWith('/production/') && path !== '/production/dashboard') return 'Back to Dashboard';
    
    return 'Back';
  };

  const baseClasses = variant === 'light' 
    ? 'text-gray-600 hover:text-gray-900' 
    : 'text-gray-400 hover:text-white';

  const accessibleLabel = label || getDefaultLabel();

  return (
    <button
      onClick={handleBack}
      aria-label={iconOnly ? accessibleLabel : undefined}
      title={iconOnly ? accessibleLabel : undefined}
      className={`flex items-center ${iconOnly ? '' : 'space-x-2'} transition-colors ${baseClasses} ${className}`}
    >
      <ArrowLeft className="w-4 h-4" />
      {!iconOnly && <span>{accessibleLabel}</span>}
    </button>
  );
}