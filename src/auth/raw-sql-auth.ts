/**
 * Raw SQL Authentication for Cloudflare Workers
 * Simple, fast, and reliable using Neon's serverless driver
 */

import { neon } from '@neondatabase/serverless';
import { z } from 'zod';

// Validation schemas
const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1)
});

const SignUpSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  username: z.string().min(1),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  userType: z.enum(['creator', 'investor', 'production']).default('creator')
});

export type UserType = 'creator' | 'investor' | 'production';

export interface User {
  id: number;
  email: string;
  username: string;
  first_name?: string;
  last_name?: string;
  user_type: UserType;
  profile_image_url?: string;
  bio?: string;
  company_name?: string;
  email_verified: boolean;
  created_at: Date;
}

export interface Session {
  id: string;
  user_id: string;
  token: string;
  expires_at: Date;
  created_at: Date;
}

export class RawSQLAuth {
  private sql: ReturnType<typeof neon>;
  
  constructor(databaseUrl: string) {
    this.sql = neon(databaseUrl);
  }

  /**
   * Hash password using Web Crypto API (edge-compatible)
   */
  private async hashPassword(password: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(password);
    
    // Generate salt
    const salt = crypto.getRandomValues(new Uint8Array(16));
    
    // Use PBKDF2 for password hashing
    const keyMaterial = await crypto.subtle.importKey(
      "raw",
      data,
      { name: "PBKDF2" },
      false,
      ["deriveBits"]
    );
    
    const hashBuffer = await crypto.subtle.deriveBits(
      {
        name: "PBKDF2",
        salt: salt,
        iterations: 100000,
        hash: "SHA-256"
      },
      keyMaterial,
      256
    );
    
    // Combine salt and hash
    const hashArray = new Uint8Array(hashBuffer);
    const combined = new Uint8Array(salt.length + hashArray.length);
    combined.set(salt);
    combined.set(hashArray, salt.length);
    
    // Return base64 encoded
    return btoa(String.fromCharCode(...combined));
  }

  /**
   * Verify password
   */
  private async verifyPassword(password: string, hash: string): Promise<boolean> {
    try {
      // Decode stored hash
      const decoded = atob(hash);
      const bytes = new Uint8Array(decoded.length);
      for (let i = 0; i < decoded.length; i++) {
        bytes[i] = decoded.charCodeAt(i);
      }
      
      // Extract salt
      const salt = bytes.slice(0, 16);
      const storedHash = bytes.slice(16);
      
      // Hash the input password
      const encoder = new TextEncoder();
      const data = encoder.encode(password);
      
      const keyMaterial = await crypto.subtle.importKey(
        "raw",
        data,
        { name: "PBKDF2" },
        false,
        ["deriveBits"]
      );
      
      const hashBuffer = await crypto.subtle.deriveBits(
        {
          name: "PBKDF2",
          salt: salt,
          iterations: 100000,
          hash: "SHA-256"
        },
        keyMaterial,
        256
      );
      
      const hashArray = new Uint8Array(hashBuffer);
      
      // Compare hashes
      if (hashArray.length !== storedHash.length) return false;
      
      for (let i = 0; i < hashArray.length; i++) {
        if (hashArray[i] !== storedHash[i]) return false;
      }
      
      return true;
    } catch (error) {
      console.error('Password verification error:', error);
      return false;
    }
  }

  /**
   * Generate secure session token
   */
  private generateToken(): string {
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
  }

  /**
   * Sign up a new user
   */
  async signUp(data: unknown): Promise<{ user: User; session: Session }> {
    // Validate input
    const validated = SignUpSchema.parse(data);
    
    // Check if user exists
    const existing = await this.sql`
      SELECT id FROM users WHERE email = ${validated.email} LIMIT 1
    `;
    
    if (existing.length > 0) {
      throw new Error('User already exists');
    }
    
    // Hash password
    const passwordHash = await this.hashPassword(validated.password);
    
    // Create user - note: id is auto-incrementing integer, not UUID
    const now = new Date();
    
    const [user] = await this.sql`
      INSERT INTO users (
        email, username, password_hash, user_type,
        first_name, last_name,
        email_verified, created_at, updated_at
      ) VALUES (
        ${validated.email}, ${validated.username}, 
        ${passwordHash}, ${validated.userType},
        ${validated.firstName || null}, ${validated.lastName || null},
        false, ${now}, ${now}
      ) RETURNING *
    `;
    
    // Create session
    const sessionToken = this.generateToken();
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days
    
    const [session] = await this.sql`
      INSERT INTO session (
        id, user_id, token, expires_at, created_at, updated_at
      ) VALUES (
        ${crypto.randomUUID()}, ${user.id}, ${sessionToken}, 
        ${expiresAt}, ${now}, ${now}
      ) RETURNING *
    `;
    
    return { user, session };
  }

  /**
   * Sign in an existing user
   */
  async signIn(data: unknown): Promise<{ user: User; session: Session }> {
    // Validate input
    const validated = LoginSchema.parse(data);
    
    // Find user
    const [user] = await this.sql`
      SELECT * FROM users WHERE email = ${validated.email} LIMIT 1
    `;
    
    if (!user) {
      throw new Error('Invalid credentials');
    }
    
    // Verify password
    const isValid = await this.verifyPassword(validated.password, user.password_hash);
    
    if (!isValid) {
      throw new Error('Invalid credentials');
    }
    
    // Create new session
    const sessionToken = this.generateToken();
    const now = new Date();
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    
    const [session] = await this.sql`
      INSERT INTO session (
        id, user_id, token, expires_at, created_at, updated_at
      ) VALUES (
        ${crypto.randomUUID()}, ${user.id}, ${sessionToken}, 
        ${expiresAt}, ${now}, ${now}
      ) RETURNING *
    `;
    
    // Remove sensitive data
    delete user.password_hash;
    delete user.password;
    delete user.email_verification_token;
    delete user.password_reset_token;
    
    return { user, session };
  }

  /**
   * Portal-specific login with user type validation
   */
  async portalLogin(data: unknown, portalType: UserType): Promise<{ user: User; session: Session }> {
    // Validate input
    const validated = LoginSchema.parse(data);
    
    // Find user
    const [user] = await this.sql`
      SELECT * FROM users 
      WHERE email = ${validated.email} 
        AND user_type = ${portalType}
      LIMIT 1
    `;
    
    if (!user) {
      throw new Error('Invalid credentials or portal access denied');
    }
    
    // Verify password
    const isValid = await this.verifyPassword(validated.password, user.password_hash);
    
    if (!isValid) {
      throw new Error('Invalid credentials');
    }
    
    // Create session
    const sessionToken = this.generateToken();
    const now = new Date();
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    
    const [session] = await this.sql`
      INSERT INTO session (
        id, user_id, token, expires_at, created_at, updated_at
      ) VALUES (
        ${crypto.randomUUID()}, ${user.id}, ${sessionToken}, 
        ${expiresAt}, ${now}, ${now}
      ) RETURNING *
    `;
    
    // Remove sensitive data
    delete user.password_hash;
    delete user.password;
    delete user.email_verification_token;
    delete user.password_reset_token;
    
    return { user, session };
  }

  /**
   * Validate session token
   */
  async validateSession(token: string): Promise<{ user: User; session: Session } | null> {
    if (!token) return null;
    
    // Find session with user
    const result = await this.sql`
      SELECT 
        s.*,
        u.id as user_id,
        u.email,
        u.username,
        u.first_name,
        u.last_name,
        u.user_type,
        u.profile_image_url,
        u.bio,
        u.company_name,
        u.email_verified
      FROM session s
      JOIN users u ON s.user_id = u.id
      WHERE s.token = ${token}
        AND s.expires_at > NOW()
      LIMIT 1
    `;
    
    if (result.length === 0) return null;
    
    const row = result[0];
    
    // Parse user and session
    const user: User = {
      id: row.user_id,
      email: row.email,
      username: row.username,
      first_name: row.first_name,
      last_name: row.last_name,
      user_type: row.user_type,
      profile_image_url: row.profile_image_url,
      bio: row.bio,
      company_name: row.company_name,
      email_verified: row.email_verified,
      created_at: row.created_at
    };
    
    const session: Session = {
      id: row.id,
      user_id: row.user_id,
      token: row.token,
      expires_at: row.expires_at,
      created_at: row.created_at
    };
    
    // Update last activity
    await this.sql`
      UPDATE session 
      SET updated_at = NOW() 
      WHERE id = ${session.id}
    `;
    
    return { user, session };
  }

  /**
   * Sign out (invalidate session)
   */
  async signOut(token: string): Promise<void> {
    if (!token) return;
    
    await this.sql`
      DELETE FROM session WHERE token = ${token}
    `;
  }

  /**
   * Clean up expired sessions
   */
  async cleanupSessions(): Promise<number> {
    const result = await this.sql`
      DELETE FROM session 
      WHERE expires_at < NOW()
      RETURNING id
    `;
    
    return result.length;
  }
}

/**
 * Helper function to extract session token from request
 */
export function getSessionToken(request: Request): string | null {
  // Check cookie
  const cookieHeader = request.headers.get('Cookie');
  if (cookieHeader) {
    const cookies = cookieHeader.split(';').reduce((acc, cookie) => {
      const [key, value] = cookie.trim().split('=');
      acc[key] = value;
      return acc;
    }, {} as Record<string, string>);
    
    if (cookies['pitchey-session']) {
      return cookies['pitchey-session'];
    }
  }
  
  // Check Authorization header
  const authHeader = request.headers.get('Authorization');
  if (authHeader?.startsWith('Bearer ')) {
    return authHeader.substring(7);
  }
  
  return null;
}

/**
 * Create standardized response
 */
export function createAuthResponse(
  success: boolean,
  message: string,
  data: any = null,
  status: number = 200,
  additionalHeaders: Record<string, string> = {}
): Response {
  const response = {
    success,
    message,
    data,
    timestamp: new Date().toISOString()
  };
  
  return new Response(JSON.stringify(response), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Credentials': 'true',
      ...additionalHeaders
    }
  });
}