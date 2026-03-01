import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import ReactDOM from 'react-dom';
import { NotificationToast, type ToastNotification } from './NotificationToast';

interface ToastContextType {
  addToast: (toast: Omit<ToastNotification, 'id'>) => string;
  removeToast: (id: string) => void;
  clearAllToasts: () => void;
  // Convenience methods
  success: (title: string, message: string, options?: Partial<ToastNotification>) => string;
  error: (title: string, message: string, options?: Partial<ToastNotification>) => string;
  warning: (title: string, message: string, options?: Partial<ToastNotification>) => string;
  info: (title: string, message: string, options?: Partial<ToastNotification>) => string;
  // Real-time notification methods
  notifyNDARequest: (pitchTitle: string, requesterName: string, pitchId: number) => string;
  notifyNDAApproved: (pitchTitle: string) => string;
  notifyNDADeclined: (pitchTitle: string) => string;
  notifyNewInvestment: (amount: number, pitchTitle: string) => string;
  notifyNewMessage: (senderName: string, preview: string, conversationId: number) => string;
  notifyPitchViewed: (pitchTitle: string, viewerName: string) => string;
  notifyFollowReceived: (followerName: string, followerId: number) => string;
}

const ToastContext = createContext<ToastContextType | null>(null);

interface NotificationToastProviderProps {
  children: ReactNode;
}

export function NotificationToastProvider({ children }: NotificationToastProviderProps) {
  const [toasts, setToasts] = useState<ToastNotification[]>([]);

  const addToast = useCallback((toast: Omit<ToastNotification, 'id'>) => {
    const id = `toast_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const newToast: ToastNotification = {
      id,
      autoClose: true,
      duration: 5000,
      ...toast,
    };

    setToasts(prev => [...prev, newToast]);
    return id;
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(toast => toast.id !== id));
  }, []);

  const clearAllToasts = useCallback(() => {
    setToasts([]);
  }, []);

  // Convenience methods
  const success = useCallback((title: string, message: string, options?: Partial<ToastNotification>) => {
    return addToast({ type: 'success', title, message, ...options });
  }, [addToast]);

  const error = useCallback((title: string, message: string, options?: Partial<ToastNotification>) => {
    return addToast({ type: 'error', title, message, autoClose: false, ...options });
  }, [addToast]);

  const warning = useCallback((title: string, message: string, options?: Partial<ToastNotification>) => {
    return addToast({ type: 'warning', title, message, ...options });
  }, [addToast]);

  const info = useCallback((title: string, message: string, options?: Partial<ToastNotification>) => {
    return addToast({ type: 'info', title, message, ...options });
  }, [addToast]);

  // Real-time notification methods
  const notifyNDARequest = useCallback((pitchTitle: string, requesterName: string, pitchId: number) => {
    return addToast({
      type: 'warning',
      title: 'New NDA Request',
      message: `${requesterName} wants to view "${pitchTitle}"`,
      duration: 8000,
      actions: [
        {
          label: 'Review Request',
          action: () => window.location.href = `/creator/ndas`,
          variant: 'primary'
        },
        {
          label: 'View Pitch',
          action: () => window.location.href = `/creator/pitch/${pitchId}`,
          variant: 'secondary'
        }
      ]
    });
  }, [addToast]);

  const notifyNDAApproved = useCallback((pitchTitle: string) => {
    return addToast({
      type: 'success',
      title: 'NDA Approved',
      message: `Your NDA request for "${pitchTitle}" has been approved!`,
      duration: 6000,
      actions: [
        {
          label: 'View Pitch',
          action: () => window.location.href = `/pitch/${pitchTitle}`,
          variant: 'primary'
        }
      ]
    });
  }, [addToast]);

  const notifyNDADeclined = useCallback((pitchTitle: string) => {
    return addToast({
      type: 'error',
      title: 'NDA Request Declined',
      message: `Your NDA request for "${pitchTitle}" was declined.`,
      duration: 6000,
      autoClose: false
    });
  }, [addToast]);

  const notifyNewInvestment = useCallback((amount: number, pitchTitle: string) => {
    return addToast({
      type: 'success',
      title: 'New Investment Received!',
      message: `You received $${amount.toLocaleString()} for "${pitchTitle}"`,
      duration: 10000,
      actions: [
        {
          label: 'View Details',
          action: () => window.location.href = `/creator/analytics`,
          variant: 'primary'
        }
      ]
    });
  }, [addToast]);

  const notifyNewMessage = useCallback((senderName: string, preview: string, conversationId: number) => {
    return addToast({
      type: 'info',
      title: `New message from ${senderName}`,
      message: preview.length > 50 ? `${preview.substring(0, 50)}...` : preview,
      duration: 6000,
      actions: [
        {
          label: 'Reply',
          action: () => window.location.href = `/messages?conversation=${conversationId}`,
          variant: 'primary'
        }
      ]
    });
  }, [addToast]);

  const notifyPitchViewed = useCallback((pitchTitle: string, viewerName: string) => {
    return addToast({
      type: 'info',
      title: 'Pitch Viewed',
      message: `${viewerName} viewed "${pitchTitle}"`,
      duration: 4000
    });
  }, [addToast]);

  const notifyFollowReceived = useCallback((followerName: string, followerId: number) => {
    return addToast({
      type: 'success',
      title: 'New Follower',
      message: `${followerName} started following you!`,
      duration: 5000,
      actions: [
        {
          label: 'View Profile',
          action: () => window.location.href = `/user/${followerId}`,
          variant: 'primary'
        }
      ]
    });
  }, [addToast]);

  const contextValue: ToastContextType = {
    addToast,
    removeToast,
    clearAllToasts,
    success,
    error,
    warning,
    info,
    notifyNDARequest,
    notifyNDAApproved,
    notifyNDADeclined,
    notifyNewInvestment,
    notifyNewMessage,
    notifyPitchViewed,
    notifyFollowReceived,
  };

  return (
    <ToastContext.Provider value={contextValue}>
      {children}
      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </ToastContext.Provider>
  );
}

interface ToastContainerProps {
  toasts: ToastNotification[];
  onRemove: (id: string) => void;
}

function ToastContainer({ toasts, onRemove }: ToastContainerProps) {
  const containerElement = document.getElementById('toast-root');
  
  if (!containerElement) {
    // Create the container if it doesn't exist
    const newContainer = document.createElement('div');
    newContainer.id = 'toast-root';
    document.body.appendChild(newContainer);
    return null;
  }

  return ReactDOM.createPortal(
    <div
      className="fixed top-4 right-4 z-50 flex flex-col space-y-3 pointer-events-none"
      style={{ maxHeight: 'calc(100vh - 2rem)', overflowY: 'auto' }}
    >
      {toasts.map((toast) => (
        <div key={toast.id} className="pointer-events-auto">
          <NotificationToast {...toast} onRemove={onRemove} />
        </div>
      ))}
    </div>,
    containerElement
  );
}

export function useNotificationToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useNotificationToast must be used within a NotificationToastProvider');
  }
  return context;
}

// Initialize toast container element on module load
if (typeof window !== 'undefined' && !document.getElementById('toast-root')) {
  const container = document.createElement('div');
  container.id = 'toast-root';
  document.body.appendChild(container);
}