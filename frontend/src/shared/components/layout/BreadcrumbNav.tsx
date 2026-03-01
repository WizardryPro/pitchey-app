import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { ChevronRight, Home, ArrowLeft } from 'lucide-react';

interface BreadcrumbItem {
  label: string;
  path?: string;
}

interface BreadcrumbNavProps {
  items?: BreadcrumbItem[];
  showBackButton?: boolean;
}

export function BreadcrumbNav({ items, showBackButton = true }: BreadcrumbNavProps) {
  const navigate = useNavigate();
  const location = useLocation();

  // Auto-generate breadcrumbs from path if not provided
  const getBreadcrumbs = (): BreadcrumbItem[] => {
    if (items) return items;

    const pathParts = location.pathname.split('/').filter(Boolean);
    const breadcrumbs: BreadcrumbItem[] = [];

    // Determine the portal type
    const portal = pathParts[0];
    const portalLabel = portal.charAt(0).toUpperCase() + portal.slice(1);
    
    // Add home/dashboard
    breadcrumbs.push({
      label: 'Dashboard',
      path: `/${portal}/dashboard`
    });

    // Add current page
    if (pathParts.length > 1) {
      const pageName = pathParts[pathParts.length - 1]
        .split('-')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
      
      breadcrumbs.push({
        label: pageName
      });
    }

    return breadcrumbs;
  };

  const breadcrumbItems = getBreadcrumbs();

  const handleBack = () => {
    const portal = location.pathname.split('/')[1];
    navigate(`/${portal}/dashboard`);
  };

  return (
    <div className="flex items-center justify-between mb-4">
      {/* Breadcrumb trail */}
      <div className="flex items-center gap-2 text-sm">
        {showBackButton && breadcrumbItems.length > 1 && (
          <button
            onClick={handleBack}
            className="p-1 rounded-lg hover:bg-gray-100 transition-colors mr-2"
            aria-label="Back to dashboard"
          >
            <ArrowLeft className="w-4 h-4 text-gray-600" />
          </button>
        )}
        
        {breadcrumbItems.map((item, index) => (
          <React.Fragment key={index}>
            {item.path ? (
              <button
                onClick={() => navigate(item.path!)}
                className="text-blue-600 hover:text-blue-700 font-medium transition-colors"
              >
                {index === 0 && <Home className="w-4 h-4 inline mr-1" />}
                {item.label}
              </button>
            ) : (
              <span className="text-gray-700 font-medium">{item.label}</span>
            )}
            
            {index < breadcrumbItems.length - 1 && (
              <ChevronRight className="w-4 h-4 text-gray-400" />
            )}
          </React.Fragment>
        ))}
      </div>
    </div>
  );
}