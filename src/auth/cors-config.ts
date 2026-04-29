/**
 * Centralized CORS Configuration
 * Ensures consistent cross-origin policies across all handlers
 */

interface CORSConfig {
  allowedOrigins: string[];
  credentials: boolean;
}

const PRODUCTION_FRONTEND = 'https://pitchey-5o8.pages.dev';
const ALTERNATIVE_FRONTENDS = [
  'https://pitchey-api-prod.ndlovucavelle.workers.dev'
];

export function getCORSHeaders(origin: string | null, credentials: boolean = true): Record<string, string> {
  // Determine the appropriate origin
  let allowOrigin = PRODUCTION_FRONTEND; // Default to primary production URL
  
  if (origin) {
    // Allow localhost for development
    if (origin.startsWith('http://localhost:')) {
      allowOrigin = origin;
    }
    // Allow any *.pages.dev subdomain (preview deployments)
    else if (origin.includes('.pages.dev')) {
      allowOrigin = origin;
    }
    // Allow alternative production domains
    else if (ALTERNATIVE_FRONTENDS.includes(origin)) {
      allowOrigin = origin;
    }
  }
  
  const headers: Record<string, string> = {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS, PATCH',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, Cookie',
    'Access-Control-Max-Age': '86400', // 24 hours
  };
  
  // When credentials are required, we MUST use specific origin (not wildcard)
  if (credentials) {
    headers['Access-Control-Allow-Credentials'] = 'true';
  }
  
  return headers;
}

export function createCookieHeader(
  name: string,
  value: string,
  options: {
    maxAge?: number; // in seconds
    sameSite?: 'Strict' | 'Lax' | 'None';
    secure?: boolean;
    httpOnly?: boolean;
    path?: string;
    domain?: string; // ADDED: Domain for cross-subdomain session sharing
  } = {}
): string {
  const {
    maxAge = 604800, // 7 days default
    sameSite = 'None', // Cross-origin by default
    secure = true,
    httpOnly = true,
    path = '/',
    domain // Domain attribute for cross-subdomain cookies
  } = options;

  let cookie = `${name}=${value}; Path=${path}`;

  // CRITICAL: Domain attribute enables session sharing across subdomains
  // e.g., Domain=.pages.dev allows cookies to work across:
  // - pitchey-5o8.pages.dev (main frontend)
  // - creator.pitchey-5o8.pages.dev (creator portal)
  // - investor.pitchey-5o8.pages.dev (investor portal)
  if (domain) {
    cookie += `; Domain=${domain}`;
  }

  if (httpOnly) {
    cookie += '; HttpOnly';
  }

  if (secure) {
    cookie += '; Secure';
  }

  cookie += `; SameSite=${sameSite}`;
  cookie += `; Max-Age=${maxAge}`;

  return cookie;
}

export function clearCookieHeader(name: string, domain?: string): string {
  let cookie = `${name}=; Path=/`;
  if (domain) {
    cookie += `; Domain=${domain}`;
  }
  cookie += '; HttpOnly; Secure; SameSite=None; Max-Age=0';
  return cookie;
}