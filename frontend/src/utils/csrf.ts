/**
 * CSRF Token Management for Frontend
 * Handles double-submit cookie pattern
 */

const CSRF_COOKIE_NAME = 'csrf-token';
const CSRF_HEADER_NAME = 'X-CSRF-Token';
const CSRF_META_NAME = 'csrf-token';

/**
 * Get CSRF token from cookie
 */
export function getCSRFToken(): string | null {
  // First try to get from meta tag (server-rendered)
  const metaTag = document.querySelector(`meta[name="${CSRF_META_NAME}"]`);
  if (metaTag) {
    return metaTag.getAttribute('content');
  }
  
  // Fall back to cookie
  const cookies = document.cookie.split(';').map(c => c.trim());
  const csrfCookie = cookies.find(c => c.startsWith(`${CSRF_COOKIE_NAME}=`));
  
  if (csrfCookie) {
    return csrfCookie.split('=')[1];
  }
  
  return null;
}

/**
 * Add CSRF token to request headers
 */
export function addCSRFHeader(headers: HeadersInit = {}): HeadersInit {
  const token = getCSRFToken();
  
  if (token) {
    if (headers instanceof Headers) {
      headers.set(CSRF_HEADER_NAME, token);
    } else if (Array.isArray(headers)) {
      headers.push([CSRF_HEADER_NAME, token]);
    } else {
      (headers as Record<string, string>)[CSRF_HEADER_NAME] = token;
    }
  }
  
  return headers;
}

/**
 * Enhanced fetch with automatic CSRF token injection
 */
export async function secureFetch(
  url: RequestInfo | URL,
  options: RequestInit = {}
): Promise<Response> {
  // Only add CSRF token for mutation methods
  const method = options.method?.toUpperCase() || 'GET';
  
  if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(method)) {
    // Add CSRF token to headers
    options.headers = addCSRFHeader(options.headers);
  }
  
  // Ensure credentials are included for cookies
  options.credentials = options.credentials || 'include';
  
  try {
    const response = await fetch(url, options);
    
    // Check for CSRF error
    if (response.status === 403) {
      const data = await response.clone().json().catch(() => null);
      
      if (data?.error === 'CSRF validation failed') {
        // Token might be expired or missing
        console.error('CSRF validation failed:', data.message);
        
        // Try to refresh token by making a GET request
        await fetch('/api/csrf/token', {
          method: 'GET',
          credentials: 'include'
        });
        
        // Retry the original request
        const retryToken = getCSRFToken();
        if (retryToken) {
          options.headers = addCSRFHeader(options.headers);
          return fetch(url, options);
        }
      }
    }
    
    return response;
  } catch (error) {
    console.error('Fetch error:', error);
    throw error;
  }
}

/**
 * Add CSRF token to form data
 */
export function addCSRFToFormData(formData: FormData): FormData {
  const token = getCSRFToken();
  
  if (token && !formData.has('csrf_token')) {
    formData.append('csrf_token', token);
  }
  
  return formData;
}

/**
 * Create axios-like interceptor for CSRF
 */
export class CSRFInterceptor {
  private static instance: CSRFInterceptor;
  
  static getInstance(): CSRFInterceptor {
    if (!CSRFInterceptor.instance) {
      CSRFInterceptor.instance = new CSRFInterceptor();
    }
    return CSRFInterceptor.instance;
  }
  
  /**
   * Intercept and modify request
   */
  request(config: RequestInit): RequestInit {
    const method = config.method?.toUpperCase() || 'GET';
    
    if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(method)) {
      config.headers = addCSRFHeader(config.headers);
    }
    
    config.credentials = config.credentials || 'include';
    
    return config;
  }
  
  /**
   * Handle response errors
   */
  async responseError(error: Response): Promise<Response> {
    if (error.status === 403) {
      const data = await error.clone().json().catch(() => null);
      
      if (data?.error === 'CSRF validation failed') {
        // Attempt to refresh token
        await this.refreshCSRFToken();
        
        // Could implement retry logic here
        console.error('CSRF token refresh attempted');
      }
    }
    
    throw error;
  }
  
  /**
   * Refresh CSRF token
   */
  private async refreshCSRFToken(): Promise<void> {
    try {
      await fetch('/api/csrf/token', {
        method: 'GET',
        credentials: 'include'
      });
    } catch (error) {
      console.error('Failed to refresh CSRF token:', error);
    }
  }
}

/**
 * Monitor and refresh CSRF token periodically
 */
export class CSRFTokenManager {
  private refreshInterval: number | null = null;
  private readonly REFRESH_INTERVAL = 30 * 60 * 1000; // 30 minutes
  
  start(): void {
    // Initial check
    void this.checkAndRefreshToken();
    
    // Set up periodic refresh
    this.refreshInterval = window.setInterval(() => {
      void this.checkAndRefreshToken();
    }, this.REFRESH_INTERVAL);
    
    // Refresh on visibility change
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) {
        void this.checkAndRefreshToken();
      }
    });
    
    // Refresh on online event
    window.addEventListener('online', () => {
      void this.checkAndRefreshToken();
    });
  }
  
  stop(): void {
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
      this.refreshInterval = null;
    }
  }
  
  private async checkAndRefreshToken(): Promise<void> {
    const token = getCSRFToken();
    
    if (!token) {
      // No token, try to get one
      try {
        await fetch('/api/csrf/token', {
          method: 'GET',
          credentials: 'include'
        });
      } catch (error) {
        console.error('Failed to get CSRF token:', error);
      }
    }
  }
}

// Auto-start token manager
const tokenManager = new CSRFTokenManager();

if (typeof window !== 'undefined') {
  tokenManager.start();
}

/**
 * React hook for CSRF token
 */
export function useCSRFToken(): string | null {
  const [token, setToken] = React.useState<string | null>(getCSRFToken());
  
  React.useEffect(() => {
    // Update token when it changes
    const interval = setInterval(() => {
      const newToken = getCSRFToken();
      if (newToken !== token) {
        setToken(newToken);
      }
    }, 1000);
    
    return () => clearInterval(interval);
  }, [token]);
  
  return token;
}

// Make sure React is imported if using the hook
import * as React from 'react';