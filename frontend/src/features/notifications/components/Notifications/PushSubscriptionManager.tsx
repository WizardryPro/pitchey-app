/**
 * Push Subscription Manager - Handles browser push notification setup and management
 */

import React, { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { 
  Bell, 
  BellRing, 
  BellOff, 
  Smartphone, 
  Monitor, 
  Tablet, 
  Check, 
  X, 
  AlertCircle, 
  RefreshCw,
  Settings,
  Trash2,
  Shield,
  Globe,
  Wifi,
  WifiOff
} from 'lucide-react';

export interface PushSubscription {
  id: string;
  endpoint: string;
  deviceType: 'desktop' | 'mobile' | 'tablet';
  userAgent: string;
  isActive: boolean;
  createdAt: string;
  lastUsedAt: string;
}

export interface PushSubscriptionManagerProps {
  className?: string;
  onSubscriptionChange?: (subscribed: boolean) => void;
}

export const PushSubscriptionManager: React.FC<PushSubscriptionManagerProps> = ({
  className = '',
  onSubscriptionChange,
}) => {
  const [subscriptions, setSubscriptions] = useState<PushSubscription[]>([]);
  const [currentSubscription, setCurrentSubscription] = useState<PushSubscription | null>(null);
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [testNotificationSent, setTestNotificationSent] = useState(false);

  // Check if push notifications are supported
  const isPushSupported = 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;

  useEffect(() => {
    if (isPushSupported) {
      checkPermissionStatus();
      loadSubscriptions();
      checkCurrentSubscription();
    }
  }, []);

  const checkPermissionStatus = () => {
    if ('Notification' in window) {
      setPermission(Notification.permission);
    }
  };

  const loadSubscriptions = async () => {
    try {
      const response = await fetch('/api/notifications/push/subscriptions', {
        credentials: 'include',
      });

      if (response.ok) {
        const data = await response.json();
        setSubscriptions(data.subscriptions || []);
      }
    } catch (error) {
      console.error('Error loading subscriptions:', error);
    }
  };

  const checkCurrentSubscription = async () => {
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      
      if (subscription) {
        // Find matching subscription in our list
        const matchingSubscription = subscriptions.find(
          sub => sub.endpoint === subscription.endpoint
        );
        
        if (matchingSubscription) {
          setCurrentSubscription(matchingSubscription);
          setIsSubscribed(true);
        }
      }
    } catch (error) {
      console.error('Error checking current subscription:', error);
    }
  };

  const requestPermission = async () => {
    if (!isPushSupported) return false;

    try {
      const permission = await Notification.requestPermission();
      setPermission(permission);
      return permission === 'granted';
    } catch (error) {
      console.error('Error requesting permission:', error);
      setError('Failed to request notification permission');
      return false;
    }
  };

  const subscribe = async () => {
    setLoading(true);
    setError(null);

    try {
      // Request permission if not granted
      if (permission !== 'granted') {
        const granted = await requestPermission();
        if (!granted) {
          setError('Notification permission denied');
          return;
        }
      }

      // Get service worker registration
      const registration = await navigator.serviceWorker.ready;

      // Get VAPID key from server
      const vapidResponse = await fetch('/api/notifications/push/vapid-key', {
        credentials: 'include',
      });

      if (!vapidResponse.ok) {
        throw new Error('Failed to get VAPID key');
      }

      const { publicKey } = await vapidResponse.json();

      // Subscribe to push notifications
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      });

      // Send subscription to server
      const response = await fetch('/api/notifications/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          endpoint: subscription.endpoint,
          keys: {
            p256dh: arrayBufferToBase64(subscription.getKey('p256dh')!),
            auth: arrayBufferToBase64(subscription.getKey('auth')!),
          },
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to register subscription with server');
      }

      const { subscriptionId } = await response.json();

      // Update state
      setIsSubscribed(true);
      loadSubscriptions(); // Reload to get updated list
      onSubscriptionChange?.(true);

      setTestNotificationSent(false);
      toast.success('Push notifications enabled');

    } catch (error) {
      console.error('Error subscribing to push notifications:', error);
      setError(error instanceof Error ? error.message : 'Failed to subscribe');
      toast.error(error instanceof Error ? error.message : 'Couldn\'t enable push notifications');
    } finally {
      setLoading(false);
    }
  };

  const unsubscribe = async (subscriptionId?: string) => {
    setLoading(true);
    setError(null);

    try {
      if (subscriptionId) {
        // Unsubscribe specific subscription
        const response = await fetch('/api/notifications/push/unsubscribe', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ subscriptionId }),
        });

        if (!response.ok) {
          throw new Error('Failed to unsubscribe');
        }
      } else {
        // Unsubscribe current device
        const registration = await navigator.serviceWorker.ready;
        const subscription = await registration.pushManager.getSubscription();

        if (subscription) {
          await subscription.unsubscribe();
          
          // Notify server
          await fetch('/api/notifications/push/unsubscribe', {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ endpoint: subscription.endpoint }),
          });
        }

        setIsSubscribed(false);
        setCurrentSubscription(null);
        onSubscriptionChange?.(false);
      }

      // Reload subscriptions
      loadSubscriptions();
      toast.success('Push notifications disabled');

    } catch (error) {
      console.error('Error unsubscribing:', error);
      setError(error instanceof Error ? error.message : 'Failed to unsubscribe');
      toast.error(error instanceof Error ? error.message : 'Couldn\'t disable push notifications');
    } finally {
      setLoading(false);
    }
  };

  const sendTestNotification = async () => {
    if (!isSubscribed) return;

    try {
      const response = await fetch('/api/notifications/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          userId: 'current', // Server should use current user
          type: 'push',
          category: 'system',
          priority: 'low',
          title: 'Test Notification',
          message: 'This is a test push notification to verify your setup is working correctly.',
          channels: { push: true },
        }),
      });

      if (response.ok) {
        setTestNotificationSent(true);
        setTimeout(() => setTestNotificationSent(false), 5000);
      } else {
        throw new Error('Failed to send test notification');
      }
    } catch (error) {
      console.error('Error sending test notification:', error);
      setError('Failed to send test notification');
    }
  };

  const getDeviceIcon = (deviceType: string) => {
    switch (deviceType) {
      case 'mobile':
        return Smartphone;
      case 'tablet':
        return Tablet;
      default:
        return Monitor;
    }
  };

  const getPermissionMessage = () => {
    switch (permission) {
      case 'granted':
        return { text: 'Notifications enabled', color: 'text-green-600', icon: Check };
      case 'denied':
        return { text: 'Notifications blocked', color: 'text-red-600', icon: X };
      default:
        return { text: 'Permission not requested', color: 'text-yellow-600', icon: AlertCircle };
    }
  };

  // Utility functions
  const urlBase64ToUint8Array = (base64String: string) => {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding)
      .replace(/\-/g, '+')
      .replace(/_/g, '/');

    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);

    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
  };

  const arrayBufferToBase64 = (buffer: ArrayBuffer): string => {
    const bytes = new Uint8Array(buffer);
    const binary = Array.from(bytes).map(b => String.fromCharCode(b)).join('');
    return btoa(binary);
  };

  if (!isPushSupported) {
    return (
      <div className={`bg-yellow-50 border border-yellow-200 rounded-lg p-6 ${className}`}>
        <div className="flex items-center">
          <AlertCircle className="w-5 h-5 text-yellow-600 mr-3" />
          <div>
            <h3 className="font-medium text-yellow-800">Push Notifications Not Supported</h3>
            <p className="text-yellow-700 text-sm mt-1">
              Your browser doesn't support push notifications. Please use a modern browser like Chrome, Firefox, or Safari.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const permissionInfo = getPermissionMessage();
  const PermissionIcon = permissionInfo.icon;

  return (
    <div className={`bg-white rounded-lg shadow-sm border ${className}`}>
      <div className="p-6 border-b">
        <h3 className="text-lg font-semibold text-gray-900 flex items-center">
          <BellRing className="w-5 h-5 mr-2" />
          Push Notifications
        </h3>
        <p className="text-gray-600 mt-1">
          Manage browser push notifications for this device
        </p>
      </div>

      <div className="p-6">
        {/* Permission Status */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center">
            <PermissionIcon className={`w-5 h-5 ${permissionInfo.color} mr-2`} />
            <span className={`font-medium ${permissionInfo.color}`}>
              {permissionInfo.text}
            </span>
          </div>
          
          {permission === 'denied' && (
            <div className="text-sm text-gray-600">
              <p>To enable notifications:</p>
              <ol className="list-decimal list-inside text-xs mt-1 space-y-1">
                <li>Click the lock icon in your address bar</li>
                <li>Select "Allow" for notifications</li>
                <li>Refresh the page</li>
              </ol>
            </div>
          )}
        </div>

        {error && (
          <div className="mb-6 p-3 bg-red-50 border border-red-200 rounded-lg">
            <div className="flex items-center">
              <X className="w-5 h-5 text-red-600 mr-2" />
              <span className="text-red-800">{error}</span>
            </div>
          </div>
        )}

        {/* Current Device Subscription */}
        <div className="mb-6">
          <h4 className="font-medium text-gray-900 mb-3">This Device</h4>
          
          {isSubscribed ? (
            <div className="flex items-center justify-between p-4 bg-green-50 border border-green-200 rounded-lg">
              <div className="flex items-center">
                <BellRing className="w-5 h-5 text-green-600 mr-3" />
                <div>
                  <div className="font-medium text-green-800">Subscribed to notifications</div>
                  <div className="text-sm text-green-700">
                    You'll receive push notifications on this device
                  </div>
                </div>
              </div>
              
              <div className="flex items-center space-x-2">
                <button
                  onClick={sendTestNotification}
                  disabled={loading || testNotificationSent}
                  className="px-3 py-1 text-sm bg-green-600 text-white rounded hover:bg-green-700 disabled:bg-green-400"
                >
                  {testNotificationSent ? 'Sent!' : 'Test'}
                </button>
                <button
                  onClick={() => unsubscribe()}
                  disabled={loading}
                  className="px-3 py-1 text-sm bg-red-600 text-white rounded hover:bg-red-700 disabled:bg-red-400"
                >
                  {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : 'Unsubscribe'}
                </button>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between p-4 bg-gray-50 border border-gray-200 rounded-lg">
              <div className="flex items-center">
                <BellOff className="w-5 h-5 text-gray-600 mr-3" />
                <div>
                  <div className="font-medium text-gray-800">Not subscribed</div>
                  <div className="text-sm text-gray-600">
                    Enable push notifications to receive alerts on this device
                  </div>
                </div>
              </div>
              
              <button
                onClick={subscribe}
                disabled={loading || permission === 'denied'}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center"
              >
                {loading ? (
                  <>
                    <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                    Setting up...
                  </>
                ) : (
                  <>
                    <Bell className="w-4 h-4 mr-2" />
                    Enable Notifications
                  </>
                )}
              </button>
            </div>
          )}
        </div>

        {/* All Device Subscriptions */}
        {subscriptions.length > 0 && (
          <div>
            <h4 className="font-medium text-gray-900 mb-3">All Devices</h4>
            <div className="space-y-3">
              {subscriptions.map((subscription) => {
                const DeviceIcon = getDeviceIcon(subscription.deviceType);
                const isCurrentDevice = currentSubscription?.id === subscription.id;
                
                return (
                  <div
                    key={subscription.id}
                    className={`flex items-center justify-between p-3 border rounded-lg ${
                      isCurrentDevice ? 'bg-blue-50 border-blue-200' : 'bg-white'
                    }`}
                  >
                    <div className="flex items-center">
                      <DeviceIcon className="w-5 h-5 text-gray-600 mr-3" />
                      <div>
                        <div className="font-medium text-gray-900 flex items-center">
                          {subscription.deviceType.charAt(0).toUpperCase() + subscription.deviceType.slice(1)}
                          {isCurrentDevice && (
                            <span className="ml-2 px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded-full">
                              This device
                            </span>
                          )}
                          {!subscription.isActive && (
                            <span className="ml-2 px-2 py-1 text-xs bg-red-100 text-red-800 rounded-full">
                              Inactive
                            </span>
                          )}
                        </div>
                        <div className="text-sm text-gray-600">
                          Last used: {new Date(subscription.lastUsedAt).toLocaleDateString()}
                        </div>
                      </div>
                    </div>
                    
                    <button
                      onClick={() => unsubscribe(subscription.id)}
                      disabled={loading}
                      className="text-red-600 hover:text-red-800 p-1"
                      title="Remove device"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {testNotificationSent && (
          <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg">
            <div className="flex items-center">
              <Check className="w-5 h-5 text-green-600 mr-2" />
              <span className="text-green-800">Test notification sent! Check your notifications.</span>
            </div>
          </div>
        )}

        {/* Help Text */}
        <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <h5 className="font-medium text-blue-800 mb-2">About Push Notifications</h5>
          <ul className="text-sm text-blue-700 space-y-1">
            <li>• Receive instant alerts even when Pitchey isn't open</li>
            <li>• Works on desktop and mobile browsers</li>
            <li>• You can customize which notifications to receive in your preferences</li>
            <li>• Notifications respect your quiet hours settings</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default PushSubscriptionManager;