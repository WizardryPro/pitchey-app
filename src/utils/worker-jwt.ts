/**
 * JWT implementation for Cloudflare Workers
 * Uses Web Crypto API for secure token generation and verification
 */

export interface JWTPayload {
  sub: string; // User ID
  email: string;
  name: string;
  userType: string;
  iat: number;
  exp: number;
  jti?: string;
}

/**
 * Create a HMAC key from the JWT secret
 */
async function getSigningKey(secret: string): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  return crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify']
  );
}

/**
 * Base64URL encode
 */
function base64UrlEncode(data: ArrayBuffer | string): string {
  const str = typeof data === 'string' 
    ? data 
    : Array.from(new Uint8Array(data), b => String.fromCharCode(b)).join('');
  
  return btoa(str)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

/**
 * Base64URL decode
 */
function base64UrlDecode(str: string): string {
  // Add padding if needed
  const padding = (4 - (str.length % 4)) % 4;
  str = str + '='.repeat(padding);
  // Replace URL-safe characters with standard base64 characters
  return atob(str.replace(/-/g, '+').replace(/_/g, '/'));
}

/**
 * Create a JWT token
 */
export async function createJWT(
  payload: Omit<JWTPayload, 'iat' | 'exp'>,
  secret: string,
  expiresIn: number = 7200 // 2 hours default
): Promise<string> {
  // Add timestamps
  const now = Math.floor(Date.now() / 1000);
  const fullPayload: JWTPayload = {
    ...payload,
    iat: now,
    exp: now + expiresIn,
    jti: crypto.randomUUID()
  };

  // Create header
  const header = {
    alg: 'HS256',
    typ: 'JWT'
  };

  // Encode header and payload
  const encoder = new TextEncoder();
  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(fullPayload));
  const message = `${encodedHeader}.${encodedPayload}`;

  // Sign the message
  const key = await getSigningKey(secret);
  const signature = await crypto.subtle.sign(
    'HMAC',
    key,
    encoder.encode(message)
  );

  // Encode signature
  const encodedSignature = base64UrlEncode(signature);

  return `${message}.${encodedSignature}`;
}

/**
 * Verify a JWT token
 */
export async function verifyJWT(
  token: string,
  secret: string
): Promise<JWTPayload | null> {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) {
      console.error('Invalid JWT format');
      return null;
    }

    const [encodedHeader, encodedPayload, encodedSignature] = parts;
    
    // Decode payload to check expiration
    const payload = JSON.parse(base64UrlDecode(encodedPayload)) as JWTPayload;
    
    // Check expiration
    const now = Math.floor(Date.now() / 1000);
    if (payload.exp && payload.exp < now) {
      console.error('JWT has expired');
      return null;
    }

    // Verify signature
    const message = `${encodedHeader}.${encodedPayload}`;
    const key = await getSigningKey(secret);
    const encoder = new TextEncoder();
    
    // Decode the signature
    const signatureData = base64UrlDecode(encodedSignature);
    const signature = new Uint8Array(signatureData.length);
    for (let i = 0; i < signatureData.length; i++) {
      signature[i] = signatureData.charCodeAt(i);
    }

    // Verify the signature
    const isValid = await crypto.subtle.verify(
      'HMAC',
      key,
      signature,
      encoder.encode(message)
    );

    if (!isValid) {
      console.error('Invalid JWT signature');
      return null;
    }

    return payload;
  } catch (error) {
    console.error('JWT verification failed:', error);
    return null;
  }
}

/**
 * Extract JWT from Authorization header
 */
export function extractJWT(authHeader: string | null): string | null {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }
  return authHeader.substring(7);
}

/**
 * Create a mock JWT for testing (remove in production)
 */
export async function createMockJWT(user: {
  id: string;
  email: string;
  name: string;
  userType: string;
}): Promise<string> {
  // Use a test secret if JWT_SECRET is not configured
  const secret = 'test-secret-key-for-development';
  return createJWT({
    sub: user.id,
    email: user.email,
    name: user.name,
    userType: user.userType
  }, secret);
}