import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getCSRFToken, addCSRFHeader, addCSRFToFormData, CSRFInterceptor } from '../csrf';

// CSRF module has a side-effect: it instantiates CSRFTokenManager and calls start()
// which calls window.setInterval and fetch on mount. We suppress fetch errors.

beforeEach(() => {
  // Reset cookies and DOM state before each test
  document.cookie = '';
  // Remove any existing meta tags
  document.querySelectorAll('meta[name="csrf-token"]').forEach(el => el.remove());
  // Reset singleton
  (CSRFInterceptor as any).instance = undefined;
});

afterEach(() => {
  vi.clearAllMocks();
});

// ============================================================================
// getCSRFToken
// ============================================================================
describe('getCSRFToken', () => {
  it('returns null when no cookie and no meta tag', () => {
    expect(getCSRFToken()).toBeNull();
  });

  it('reads token from meta tag first', () => {
    const meta = document.createElement('meta');
    meta.setAttribute('name', 'csrf-token');
    meta.setAttribute('content', 'meta-token-123');
    document.head.appendChild(meta);

    expect(getCSRFToken()).toBe('meta-token-123');
    document.head.removeChild(meta);
  });

  it('reads token from cookie when no meta tag', () => {
    Object.defineProperty(document, 'cookie', {
      writable: true,
      value: 'csrf-token=cookie-token-abc',
    });
    expect(getCSRFToken()).toBe('cookie-token-abc');
    // Reset
    Object.defineProperty(document, 'cookie', { writable: true, value: '' });
  });

  it('returns null when csrf-token cookie is absent (other cookies present)', () => {
    Object.defineProperty(document, 'cookie', {
      writable: true,
      value: 'session=xyz; other=abc',
    });
    expect(getCSRFToken()).toBeNull();
    Object.defineProperty(document, 'cookie', { writable: true, value: '' });
  });

  it('prefers meta tag over cookie', () => {
    // Both meta and cookie are set
    Object.defineProperty(document, 'cookie', {
      writable: true,
      value: 'csrf-token=cookie-token',
    });
    const meta = document.createElement('meta');
    meta.setAttribute('name', 'csrf-token');
    meta.setAttribute('content', 'meta-wins');
    document.head.appendChild(meta);

    expect(getCSRFToken()).toBe('meta-wins');
    document.head.removeChild(meta);
    Object.defineProperty(document, 'cookie', { writable: true, value: '' });
  });
});

// ============================================================================
// addCSRFHeader
// ============================================================================
describe('addCSRFHeader', () => {
  beforeEach(() => {
    // Provide a token via meta so getCSRFToken returns something
    const meta = document.createElement('meta');
    meta.setAttribute('name', 'csrf-token');
    meta.setAttribute('content', 'test-csrf-token');
    document.head.appendChild(meta);
  });

  afterEach(() => {
    document.querySelectorAll('meta[name="csrf-token"]').forEach(el => el.remove());
  });

  it('adds token to plain object headers', () => {
    const headers = addCSRFHeader({}) as Record<string, string>;
    expect(headers['X-CSRF-Token']).toBe('test-csrf-token');
  });

  it('adds token to Headers instance', () => {
    const headers = new Headers();
    addCSRFHeader(headers);
    expect(headers.get('X-CSRF-Token')).toBe('test-csrf-token');
  });

  it('adds token to array-style headers', () => {
    const headers: [string, string][] = [];
    addCSRFHeader(headers);
    const found = headers.find(([name]) => name === 'X-CSRF-Token');
    expect(found).toBeDefined();
    expect(found![1]).toBe('test-csrf-token');
  });

  it('returns empty headers unchanged when no token available', () => {
    // Remove the meta tag so no token
    document.querySelectorAll('meta[name="csrf-token"]').forEach(el => el.remove());
    const headers = addCSRFHeader({}) as Record<string, string>;
    expect(headers['X-CSRF-Token']).toBeUndefined();
  });

  it('returns empty object when called with no argument and no token', () => {
    document.querySelectorAll('meta[name="csrf-token"]').forEach(el => el.remove());
    const headers = addCSRFHeader();
    expect(headers).toEqual({});
  });
});

// ============================================================================
// addCSRFToFormData
// ============================================================================
describe('addCSRFToFormData', () => {
  beforeEach(() => {
    const meta = document.createElement('meta');
    meta.setAttribute('name', 'csrf-token');
    meta.setAttribute('content', 'form-csrf-token');
    document.head.appendChild(meta);
  });

  afterEach(() => {
    document.querySelectorAll('meta[name="csrf-token"]').forEach(el => el.remove());
  });

  it('appends csrf_token to FormData', () => {
    const formData = new FormData();
    addCSRFToFormData(formData);
    expect(formData.get('csrf_token')).toBe('form-csrf-token');
  });

  it('does not overwrite existing csrf_token', () => {
    const formData = new FormData();
    formData.append('csrf_token', 'existing-token');
    addCSRFToFormData(formData);
    // Should still have the original value (not appended again)
    expect(formData.get('csrf_token')).toBe('existing-token');
  });

  it('returns the FormData object', () => {
    const formData = new FormData();
    const result = addCSRFToFormData(formData);
    expect(result).toBe(formData);
  });

  it('does not append when no token available', () => {
    document.querySelectorAll('meta[name="csrf-token"]').forEach(el => el.remove());
    const formData = new FormData();
    addCSRFToFormData(formData);
    expect(formData.has('csrf_token')).toBe(false);
  });
});

// ============================================================================
// CSRFInterceptor singleton
// ============================================================================
describe('CSRFInterceptor', () => {
  it('returns the same instance on multiple calls', () => {
    const a = CSRFInterceptor.getInstance();
    const b = CSRFInterceptor.getInstance();
    expect(a).toBe(b);
  });

  it('request method adds CSRF header to POST', () => {
    const meta = document.createElement('meta');
    meta.setAttribute('name', 'csrf-token');
    meta.setAttribute('content', 'interceptor-token');
    document.head.appendChild(meta);

    const interceptor = CSRFInterceptor.getInstance();
    const config = interceptor.request({ method: 'POST' });
    const headers = config.headers as Record<string, string>;
    expect(headers['X-CSRF-Token']).toBe('interceptor-token');

    document.head.removeChild(meta);
  });

  it('request method does not add CSRF header to GET', () => {
    const meta = document.createElement('meta');
    meta.setAttribute('name', 'csrf-token');
    meta.setAttribute('content', 'interceptor-token');
    document.head.appendChild(meta);

    const interceptor = CSRFInterceptor.getInstance();
    const config = interceptor.request({ method: 'GET' });
    const headers = (config.headers as Record<string, string>) || {};
    expect(headers['X-CSRF-Token']).toBeUndefined();

    document.head.removeChild(meta);
  });

  it('request method sets credentials to include by default', () => {
    const interceptor = CSRFInterceptor.getInstance();
    const config = interceptor.request({ method: 'GET' });
    expect(config.credentials).toBe('include');
  });

  it('request method does not override existing credentials', () => {
    const interceptor = CSRFInterceptor.getInstance();
    const config = interceptor.request({ method: 'GET', credentials: 'omit' });
    expect(config.credentials).toBe('omit');
  });
});
