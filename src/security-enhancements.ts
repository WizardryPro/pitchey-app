/**
 * Security Enhancements for Production Worker
 * Addresses security verification findings
 */

// Enhanced CORS response with security headers
export function secureResponse(request: Request, data: any, statusCode: number = 200): Response {
  const response = new Response(JSON.stringify(data), {
    status: statusCode,
    headers: {
      'Content-Type': 'application/json',
      
      // CORS headers
      'Access-Control-Allow-Origin': getAllowedOrigin(request),
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
      'Access-Control-Allow-Credentials': 'true',
      'Access-Control-Max-Age': '86400',
      
      // Security headers
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'X-XSS-Protection': '1; mode=block',
      'Referrer-Policy': 'strict-origin-when-cross-origin',
      'Content-Security-Policy': "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; connect-src 'self' https:;",
      'Permissions-Policy': 'geolocation=(), microphone=(), camera=(), payment=(), usb=(), magnetometer=(), gyroscope=(), accelerometer=(), ambient-light-sensor=()',
      'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload',
      
      // Cache control
      'Cache-Control': statusCode >= 400 ? 'no-cache, no-store, must-revalidate' : 'public, max-age=300',
      'Pragma': 'no-cache',
      'Expires': '0',
      
      // Additional security
      'Server': 'Cloudflare',
      'X-Robots-Tag': 'noindex, nofollow'
    }
  });

  return response;
}

// Get allowed origin for CORS
function getAllowedOrigin(request: Request): string {
  const origin = request.headers.get('Origin');
  const allowedOrigins = [
    'https://pitchey.pages.dev',
    'https://pitchey-frontend.pages.dev',
    'http://localhost:5173',
    'http://localhost:3000',
    'http://localhost:8001'
  ];
  
  // Check if origin is in allowed list
  if (origin && allowedOrigins.includes(origin)) {
    return origin;
  }
  
  // Check if origin is a Cloudflare Pages subdomain (for preview deployments)
  if (origin && origin.match(/^https:\/\/[a-z0-9-]+\.pitchey\.pages\.dev$/)) {
    return origin;
  }
  
  // Check if origin is localhost (for development)
  if (origin && origin.startsWith('http://localhost:')) {
    return origin;
  }
  
  return 'https://pitchey.pages.dev';
}

// Input sanitization and validation
export function sanitizeInput(input: string): string {
  if (typeof input !== 'string') {
    return '';
  }
  
  // Remove potentially dangerous characters
  return input
    .replace(/[<>\"'&]/g, '') // Remove HTML/XML characters
    .replace(/[\x00-\x1f\x7f-\x9f]/g, '') // Remove control characters
    .replace(/script|javascript|vbscript|onload|onerror/gi, '') // Remove script-related keywords
    .trim()
    .substring(0, 1000); // Limit length
}

// Validate email format
export function validateEmail(email: string): boolean {
  const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  return emailRegex.test(email) && email.length <= 254;
}

// Rate limiting implementation
export class RateLimiter {
  private requests: Map<string, number[]> = new Map();
  
  constructor(
    private maxRequests: number = 100,
    private windowMs: number = 60000 // 1 minute
  ) {}
  
  isRateLimited(identifier: string): boolean {
    const now = Date.now();
    const windowStart = now - this.windowMs;
    
    // Get existing requests for this identifier
    let requests = this.requests.get(identifier) || [];
    
    // Remove old requests outside the window
    requests = requests.filter(timestamp => timestamp > windowStart);
    
    // Check if rate limit exceeded
    if (requests.length >= this.maxRequests) {
      return true;
    }
    
    // Add current request
    requests.push(now);
    this.requests.set(identifier, requests);
    
    // Cleanup old entries periodically
    if (this.requests.size > 10000) {
      this.cleanup();
    }
    
    return false;
  }
  
  private cleanup(): void {
    const now = Date.now();
    const windowStart = now - this.windowMs;
    
    for (const [identifier, requests] of this.requests.entries()) {
      const validRequests = requests.filter(timestamp => timestamp > windowStart);
      if (validRequests.length === 0) {
        this.requests.delete(identifier);
      } else {
        this.requests.set(identifier, validRequests);
      }
    }
  }
}

// SQL injection protection
export function validateAndSanitizeQuery(query: string): string {
  // List of dangerous SQL keywords and patterns
  const sqlPatterns = [
    /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|UNION|SCRIPT)\b)/gi,
    /('|(\\x27)|(\\x2D)|(\\x00))/gi, // Single quotes and null bytes
    /((\%27)|(\'))((\%6F)|o|(\%4F))((\%72)|r|(\%52))/gi, // 'or' patterns
    /(\;|\||\|\||&&|\band\b|\bor\b)/gi // SQL operators
  ];
  
  // Check for SQL injection patterns
  for (const pattern of sqlPatterns) {
    if (pattern.test(query)) {
      throw new Error('Invalid characters detected in query');
    }
  }
  
  return query;
}

// Authentication helper
export function extractBearerToken(request: Request): string | null {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }
  
  return authHeader.substring(7);
}

// Secure error response
export function secureErrorResponse(request: Request, message: string, statusCode: number = 500): Response {
  // Don't leak internal error details in production
  const sanitizedMessage = process.env.ENVIRONMENT === 'production' 
    ? 'An error occurred while processing your request'
    : message;
  
  return secureResponse(request, {
    success: false,
    message: sanitizedMessage,
    timestamp: new Date().toISOString(),
    status: statusCode
  }, statusCode);
}

// IP address extraction for rate limiting
export function getClientIP(request: Request): string {
  // Try to get real IP from Cloudflare headers
  const cfConnectingIP = request.headers.get('CF-Connecting-IP');
  if (cfConnectingIP) {
    return cfConnectingIP;
  }
  
  // Fallback to other headers
  const xForwardedFor = request.headers.get('X-Forwarded-For');
  if (xForwardedFor) {
    return xForwardedFor.split(',')[0].trim();
  }
  
  const xRealIP = request.headers.get('X-Real-IP');
  if (xRealIP) {
    return xRealIP;
  }
  
  return 'unknown';
}

// Content validation
export function validateContentType(request: Request, expectedType: string = 'application/json'): boolean {
  const contentType = request.headers.get('Content-Type');
  return contentType?.includes(expectedType) ?? false;
}

// Request size validation
export function validateRequestSize(request: Request, maxSize: number = 1048576): boolean { // 1MB default
  const contentLength = request.headers.get('Content-Length');
  if (contentLength) {
    return parseInt(contentLength) <= maxSize;
  }
  return true; // Allow if no content length header
}

// Path traversal protection
export function validatePath(path: string): string {
  // Remove any path traversal attempts
  const sanitized = path
    .replace(/\.\./g, '') // Remove ..
    .replace(/\/+/g, '/') // Normalize multiple slashes
    .replace(/[<>\"'&\x00-\x1f\x7f-\x9f]/g, ''); // Remove dangerous characters
  
  // Ensure path starts with /
  return sanitized.startsWith('/') ? sanitized : '/' + sanitized;
}

// Security logging
export function logSecurityEvent(event: string, details: any, severity: 'low' | 'medium' | 'high' = 'medium'): void {
  const logEntry = {
    timestamp: new Date().toISOString(),
    event,
    severity,
    details,
    environment: process.env.ENVIRONMENT || 'unknown'
  };
  
  // In production, this would typically go to a security monitoring service
  console.warn(`[SECURITY-${severity.toUpperCase()}] ${event}:`, JSON.stringify(logEntry));
}

// Export all security functions
export const Security = {
  secureResponse,
  sanitizeInput,
  validateEmail,
  validateAndSanitizeQuery,
  extractBearerToken,
  secureErrorResponse,
  getClientIP,
  validateContentType,
  validateRequestSize,
  validatePath,
  logSecurityEvent,
  RateLimiter
};