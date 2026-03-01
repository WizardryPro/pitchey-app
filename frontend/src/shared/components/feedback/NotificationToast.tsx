import React, { useEffect, useState } from 'react';
import { CheckCircle, AlertTriangle, Info, XCircle, X } from 'lucide-react';

export interface ToastNotification {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  title: string;
  message: string;
  duration?: number;
  autoClose?: boolean;
  actions?: Array<{
    label: string;
    action: () => void;
    variant?: 'primary' | 'secondary';
  }>;
  onDismiss?: () => void;
}

interface NotificationToastProps extends ToastNotification {
  onRemove: (id: string) => void;
}

const iconMap = {
  success: CheckCircle,
  error: XCircle,
  warning: AlertTriangle,
  info: Info,
};

const colorMap = {
  success: {
    bg: 'bg-green-50',
    border: 'border-green-200',
    icon: 'text-green-500',
    title: 'text-green-800',
    message: 'text-green-700',
    button: 'bg-green-600 hover:bg-green-700',
  },
  error: {
    bg: 'bg-red-50',
    border: 'border-red-200',
    icon: 'text-red-500',
    title: 'text-red-800',
    message: 'text-red-700',
    button: 'bg-red-600 hover:bg-red-700',
  },
  warning: {
    bg: 'bg-yellow-50',
    border: 'border-yellow-200',
    icon: 'text-yellow-500',
    title: 'text-yellow-800',
    message: 'text-yellow-700',
    button: 'bg-yellow-600 hover:bg-yellow-700',
  },
  info: {
    bg: 'bg-blue-50',
    border: 'border-blue-200',
    icon: 'text-blue-500',
    title: 'text-blue-800',
    message: 'text-blue-700',
    button: 'bg-blue-600 hover:bg-blue-700',
  },
};

export function NotificationToast({
  id,
  type,
  title,
  message,
  duration = 5000,
  autoClose = true,
  actions,
  onDismiss,
  onRemove,
}: NotificationToastProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [isExiting, setIsExiting] = useState(false);

  const Icon = iconMap[type];
  const colors = colorMap[type];

  useEffect(() => {
    // Animate in
    const timer = setTimeout(() => setIsVisible(true), 10);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!autoClose) return;

    const timer = setTimeout(() => {
      handleDismiss();
    }, duration);

    return () => clearTimeout(timer);
  }, [autoClose, duration]);

  const handleDismiss = () => {
    setIsExiting(true);
    onDismiss?.();
    
    // Wait for exit animation then remove
    setTimeout(() => {
      onRemove(id);
    }, 300);
  };

  return (
    <div
      className={`
        max-w-sm w-full shadow-lg rounded-lg pointer-events-auto ring-1 ring-black ring-opacity-5 overflow-hidden
        transition-all duration-300 ease-in-out transform
        ${colors.bg} ${colors.border}
        ${isVisible && !isExiting 
          ? 'translate-x-0 opacity-100 scale-100' 
          : isExiting 
          ? 'translate-x-full opacity-0 scale-95'
          : 'translate-x-full opacity-0 scale-95'
        }
      `}
    >
      <div className="p-4">
        <div className="flex items-start">
          <div className="flex-shrink-0">
            <Icon className={`h-6 w-6 ${colors.icon}`} aria-hidden="true" />
          </div>
          <div className="ml-3 w-0 flex-1 pt-0.5">
            <p className={`text-sm font-medium ${colors.title}`}>
              {title}
            </p>
            <p className={`mt-1 text-sm ${colors.message}`}>
              {message}
            </p>
            
            {actions && actions.length > 0 && (
              <div className="mt-3 flex space-x-2">
                {actions.map((action, index) => (
                  <button
                    key={index}
                    type="button"
                    className={`
                      text-xs font-medium px-3 py-1.5 rounded-md transition-colors
                      ${action.variant === 'primary' 
                        ? `text-white ${colors.button}` 
                        : 'text-gray-700 bg-gray-200 hover:bg-gray-300'
                      }
                    `}
                    onClick={(e) => {
                      e.stopPropagation();
                      action.action();
                      handleDismiss();
                    }}
                  >
                    {action.label}
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="ml-4 flex-shrink-0 flex">
            <button
              type="button"
              className={`
                rounded-md inline-flex text-gray-400 hover:text-gray-500 
                focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500
              `}
              onClick={handleDismiss}
            >
              <span className="sr-only">Close</span>
              <X className="h-5 w-5" aria-hidden="true" />
            </button>
          </div>
        </div>
      </div>
      
      {autoClose && (
        <div className="h-1 bg-gray-200">
          <div 
            className={`h-full transition-all ease-linear ${colors.button.split(' ')[0]}`}
            style={{
              width: '100%',
              animation: `shrink ${duration}ms linear`,
            }}
          />
        </div>
      )}
      
      <style>{`
        @keyframes shrink {
          from { width: 100%; }
          to { width: 0%; }
        }
      `}</style>
    </div>
  );
}