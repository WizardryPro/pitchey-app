/**
 * Password hashing for Cloudflare Workers using Web Crypto API
 * PBKDF2 implementation that works without external dependencies
 */

/**
 * Hash a password using PBKDF2
 */
export async function hashPassword(password: string): Promise<string> {
  // Generate a random salt
  const salt = crypto.getRandomValues(new Uint8Array(16));
  
  // Convert password to key material
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    { name: 'PBKDF2' },
    false,
    ['deriveBits']
  );
  
  // Derive bits using PBKDF2
  const hashBuffer = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: salt,
      iterations: 100000, // OWASP recommended minimum
      hash: 'SHA-256'
    },
    keyMaterial,
    256 // 32 bytes
  );
  
  // Combine salt and hash for storage
  const hashArray = new Uint8Array(hashBuffer);
  const combined = new Uint8Array(salt.length + hashArray.length);
  combined.set(salt);
  combined.set(hashArray, salt.length);
  
  // Convert to base64 for storage, prefixed for detection
  return 'pbkdf2:' + btoa(String.fromCharCode(...combined));
}

/**
 * Verify a password against a hash
 */
/**
 * Check if a stored password is a PBKDF2 hash (vs plaintext)
 */
export function isHashedPassword(stored: string): boolean {
  return stored.startsWith('pbkdf2:');
}

export async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
  try {
    // Strip prefix if present
    const rawHash = storedHash.startsWith('pbkdf2:') ? storedHash.slice(7) : storedHash;

    // Decode the stored hash
    const combined = new Uint8Array(
      atob(rawHash).split('').map(char => char.charCodeAt(0))
    );
    
    // Extract salt and hash
    const salt = combined.slice(0, 16);
    const storedHashArray = combined.slice(16);
    
    // Hash the provided password with the same salt
    const encoder = new TextEncoder();
    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      encoder.encode(password),
      { name: 'PBKDF2' },
      false,
      ['deriveBits']
    );
    
    const hashBuffer = await crypto.subtle.deriveBits(
      {
        name: 'PBKDF2',
        salt: salt,
        iterations: 100000,
        hash: 'SHA-256'
      },
      keyMaterial,
      256
    );
    
    const hashArray = new Uint8Array(hashBuffer);
    
    // Compare hashes
    if (hashArray.length !== storedHashArray.length) {
      return false;
    }
    
    for (let i = 0; i < hashArray.length; i++) {
      if (hashArray[i] !== storedHashArray[i]) {
        return false;
      }
    }
    
    return true;
  } catch (error) {
    console.error('Password verification failed:', error);
    return false;
  }
}

/**
 * Generate a secure random token
 */
export function generateSecureToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return Array.from(bytes)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Simple password strength checker
 */
export function checkPasswordStrength(password: string): {
  score: number;
  feedback: string[];
} {
  const feedback: string[] = [];
  let score = 0;
  
  // Length check
  if (password.length >= 8) score++;
  else feedback.push('Password should be at least 8 characters');
  
  if (password.length >= 12) score++;
  if (password.length >= 16) score++;
  
  // Complexity checks
  if (/[a-z]/.test(password)) score++;
  else feedback.push('Add lowercase letters');
  
  if (/[A-Z]/.test(password)) score++;
  else feedback.push('Add uppercase letters');
  
  if (/[0-9]/.test(password)) score++;
  else feedback.push('Add numbers');
  
  if (/[^A-Za-z0-9]/.test(password)) score++;
  else feedback.push('Add special characters');
  
  // Common patterns to avoid
  if (/(.)\1{2,}/.test(password)) {
    score--;
    feedback.push('Avoid repeating characters');
  }
  
  if (/^(password|12345|qwerty)/i.test(password)) {
    score = 0;
    feedback.push('Avoid common passwords');
  }
  
  return {
    score: Math.max(0, Math.min(5, Math.floor(score * 5 / 7))),
    feedback
  };
}