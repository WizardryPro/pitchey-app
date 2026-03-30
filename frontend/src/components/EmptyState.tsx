import React, { ReactNode, ElementType } from 'react';

interface EmptyStateProps {
  icon?: ElementType;
  title: string;
  description: string;
  action?: {
    label: string;
    onClick: () => void;
    variant?: 'primary' | 'secondary';
  };
  children?: ReactNode;
  className?: string;
}

const EmptyState: React.FC<EmptyStateProps> = ({
  icon: Icon,
  title,
  description,
  action,
  children,
  className = ''
}) => {
  return (
    <div 
      className={`text-center py-12 px-4 ${className}`}
      data-testid="empty-state"
      role="status"
      aria-live="polite"
    >
      <div className="max-w-md mx-auto">
        {Icon && (
          <div className="w-16 h-16 bg-brand-empty-icon/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <Icon className="w-8 h-8 text-brand-empty-icon" aria-hidden="true" />
          </div>
        )}

        <h3 className="text-lg font-semibold text-gray-900 mb-1" data-testid="empty-state-title">
          {title}
        </h3>

        <p className="text-gray-500 mb-6" data-testid="empty-state-description">
          {description}
        </p>

        {action && (
          <button
            onClick={action.onClick}
            className={`px-6 py-2.5 rounded-lg font-medium transition focus:outline-none focus:ring-2 focus:ring-offset-2 ${
              action.variant === 'secondary'
                ? 'bg-gray-100 text-gray-700 hover:bg-gray-200 focus:ring-gray-500'
                : 'bg-brand-action text-white hover:opacity-90 focus:ring-purple-500'
            }`}
            data-testid="empty-state-action"
          >
            {action.label}
          </button>
        )}

        {children}
      </div>
    </div>
  );
};

export default EmptyState;