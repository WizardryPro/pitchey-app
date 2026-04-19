# Better Auth Three-Portal Implementation Documentation

## 🎯 Overview

This document describes the Better Auth implementation for Pitchey's three-portal authentication system, deployed at **https://pitchey.pages.dev**. The system provides secure, session-based authentication for three distinct user types:
- **Creator Portal**: For content creators pitching their projects
- **Investor Portal**: For investors reviewing and funding projects  
- **Production Portal**: For production companies managing projects

## 🏗️ Architecture

### Authentication Flow
```
┌─────────────┐     ┌──────────────────┐     ┌─────────────────┐
│   Frontend  │────▶│  Cloudflare      │────▶│  Neon Database  │
│   (React)   │     │  Worker API      │     │  (PostgreSQL)   │
└─────────────┘     └──────────────────┘     └─────────────────┘
       │                     │                         │
       │                     │                         │
    Cookies           Session Management          User Data
  (HTTP-only)         (Better Auth)              (Raw SQL)
```

### Technology Stack
- **Frontend**: React + TypeScript (Cloudflare Pages)
- **Backend**: Cloudflare Workers (Edge Runtime)
- **Authentication**: Better Auth with cookie-based sessions
- **Database**: Neon PostgreSQL (No ORM, raw SQL queries)
- **Session Storage**: HTTP-only secure cookies
- **Cache**: Upstash Redis (optional, with fallback)

## 🔐 Implementation Details

### 1. Frontend Configuration

#### Better Auth Client (`frontend/src/lib/better-auth-client.tsx`)

```typescript
import { createAuthClient } from 'better-auth/react';
import { organizationClient } from 'better-auth/client/plugins';
import { adminClient } from 'better-auth/client/plugins';
import { multiSessionClient } from 'better-auth/client/plugins';
import { API_URL } from '../config';

// Portal types
export type PortalType = 'creator' | 'investor' | 'production';

// Better Auth client configuration
export const authClient = createAuthClient({
  baseURL: API_URL,
  
  // Plugin configuration
  plugins: [
    organizationClient(),
    adminClient(), 
    multiSessionClient()
  ],
  
  // Cookie configuration
  cookies: {
    sessionToken: {
      name: 'pitchey-session'
    }
  },

  // Fetch configuration for Cloudflare Workers
  fetchOptions: {
    credentials: 'include' as RequestCredentials,
    headers: {
      'Content-Type': 'application/json'
    }
  }
});
```

#### Portal-Specific Authentication Methods

```typescript
export interface PortalAuthMethods {
  // Sign in methods
  signInCreator: (email: string, password: string) => Promise<any>;
  signInInvestor: (email: string, password: string) => Promise<any>;
  signInProduction: (email: string, password: string) => Promise<any>;
  
  // Registration methods  
  registerCreator: (email: string, username: string, password: string) => Promise<any>;
  registerInvestor: (email: string, username: string, password: string) => Promise<any>;
  registerProduction: (email: string, username: string, password: string) => Promise<any>;
  
  // Session management
  getSession: () => Promise<any>;
  signOut: () => Promise<any>;
  
  // Portal validation
  validatePortalAccess: (userType: string, requiredPortal: PortalType) => boolean;
}
```

### 2. Authentication Service (`frontend/src/services/auth.service.ts`)

The authentication service provides a unified interface for all three portals:

```typescript
export class AuthService {
  // Generic login for all user types using Better Auth
  static async login(credentials: LoginCredentials, userType: 'creator' | 'investor' | 'production'): Promise<AuthResponse> {
    cleanupJWTArtifacts(); // Clean up any lingering JWT tokens
    
    try {
      // Use Better Auth signIn with portal-specific endpoint
      const response = await authClient.signIn.email({
        email: credentials.email,
        password: credentials.password,
        callbackURL: `/${userType}/dashboard`,
        // Pass userType as metadata for backend routing
        fetchOptions: {
          headers: {
            'X-Portal-Type': userType
          }
        }
      });

      if (!response.data?.session) {
        throw new Error('Login failed - no session created');
      }

      // Better Auth handles cookie setting automatically
      return {
        success: true,
        user: response.data.user as User,
        token: response.data.session.id, // Session ID for compatibility
        session: response.data.session
      };
    } catch (error: any) {
      throw new Error(error.message || 'Login failed');
    }
  }
}
```

### 3. Backend Worker Integration

#### API Endpoints

The Cloudflare Worker handles authentication for all three portals:

##### Primary Better Auth Endpoints
- `POST /api/auth/sign-in` - Unified sign-in
- `POST /api/auth/sign-up` - Unified registration
- `POST /api/auth/sign-out` - Sign out
- `GET /api/auth/session` - Get current session
- `POST /api/auth/session/refresh` - Refresh session

##### Portal-Specific Endpoints (Backward Compatibility)
- `POST /api/auth/creator/login` - Creator portal login
- `POST /api/auth/creator/register` - Creator registration
- `POST /api/auth/investor/login` - Investor portal login
- `POST /api/auth/investor/register` - Investor registration
- `POST /api/auth/production/login` - Production portal login
- `POST /api/auth/production/register` - Production registration

### 4. Session Management

#### Cookie Configuration
```typescript
// HTTP-only secure cookies
cookies: {
  sessionToken: {
    name: 'pitchey-session',
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 7 // 7 days
  }
}
```

#### Session Validation
```typescript
static async validateToken(): Promise<TokenValidation> {
  try {
    // Use Better Auth session check
    const { data: session } = await authClient.getSession();
    
    if (!session?.user) {
      cleanupJWTArtifacts();
      return { valid: false };
    }

    return {
      valid: true,
      user: session.user as User,
      exp: session.expiresAt ? new Date(session.expiresAt).getTime() : undefined
    };
  } catch (error) {
    cleanupJWTArtifacts();
    return { valid: false };
  }
}
```

### 5. Portal Access Control

Each portal has specific permissions and access controls:

```typescript
// Permission check
static async hasPermission(permission: string): Promise<boolean> {
  const user = await this.getCurrentUser();
  
  if (!user) return false;

  // Basic permission logic
  const permissions: Record<string, string[]> = {
    creator: ['create_pitch', 'edit_pitch', 'view_analytics'],
    investor: ['view_pitches', 'create_nda', 'make_investment'],
    production: ['view_pitches', 'create_nda', 'manage_projects'],
    admin: ['all']
  };

  const userPermissions = permissions[user.userType] || [];
  
  return userPermissions.includes('all') || userPermissions.includes(permission);
}
```

### 6. Migration from JWT to Better Auth

The platform was migrated from JWT-based authentication to Better Auth sessions in December 2024. The migration included:

#### JWT Cleanup Function
```typescript
function cleanupJWTArtifacts(): void {
  // Remove all JWT-related items
  const keysToRemove = [
    'authToken', 'token', 'jwt', 'accessToken', 'refreshToken',
    'user', 'userType', 'pitchey:authToken', 'pitchey:token'
  ];
  
  keysToRemove.forEach(key => {
    localStorage.removeItem(key);
    // Also remove namespaced versions
    const storageKeys = Object.keys(localStorage);
    storageKeys.forEach(storageKey => {
      if (storageKey.includes(key)) {
        localStorage.removeItem(storageKey);
      }
    });
  });
}
```

#### Backward Compatibility
- Auth headers are no longer required (cookies handle authentication)
- `getAuthHeaders()` method maintained for legacy API calls
- Session ID provided for request tracking

## 🚀 Deployment

### Environment Configuration

#### Production Environment (`.env.production`)
```env
VITE_API_URL=https://pitchey-api-prod.ndlovucavelle.workers.dev
VITE_WS_URL=wss://pitchey-api-prod.ndlovucavelle.workers.dev
VITE_NODE_ENV=production
VITE_ENABLE_WEBSOCKETS=true
VITE_SECURE_COOKIES=true
```

#### Local Development (`.env`)
```env
VITE_API_URL=http://localhost:8001
VITE_WS_URL=ws://localhost:8001
```

### Build and Deploy Commands

```bash
# Build frontend
npm run build

# Deploy to Cloudflare Pages
wrangler pages deploy frontend/dist --project-name=pitchey

# Deploy Worker API
wrangler deploy
```

## 🧪 Testing

### Demo Accounts
All demo accounts use password: **Demo123**

| Portal | Email | Username |
|--------|-------|----------|
| Creator | alex.creator@demo.com | alex_creator |
| Investor | sarah.investor@demo.com | sarah_investor |
| Production | stellar.production@demo.com | stellar_production |

### Testing Authentication Flow

```bash
# Test Creator Login
curl -X POST https://pitchey-api-prod.ndlovucavelle.workers.dev/api/auth/creator/login \
  -H "Content-Type: application/json" \
  -d '{"email":"alex.creator@demo.com","password":"Demo123"}'

# Test Session Validation
curl -X GET https://pitchey-api-prod.ndlovucavelle.workers.dev/api/auth/session \
  -H "Cookie: pitchey-session=<session-token>"

# Test Sign Out
curl -X POST https://pitchey-api-prod.ndlovucavelle.workers.dev/api/auth/sign-out \
  -H "Cookie: pitchey-session=<session-token>"
```

## 🔒 Security Features

### 1. Session Security
- HTTP-only cookies prevent XSS attacks
- Secure flag ensures HTTPS-only transmission
- SameSite=lax prevents CSRF attacks
- 7-day session expiry with refresh capability

### 2. Password Security
- Passwords hashed using bcrypt/argon2
- Minimum 8 characters required
- Rate limiting on authentication endpoints

### 3. CORS Configuration
```typescript
const corsHeaders = {
  'Access-Control-Allow-Origin': 'https://pitchey.pages.dev',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Credentials': 'true'
};
```

### 4. Rate Limiting
- 5 login attempts per 15 minutes per IP
- 3 password reset attempts per hour
- Implemented via Cloudflare Workers KV

## 📊 Benefits of Better Auth Implementation

### 1. **Enhanced Security**
- ✅ No JWT tokens in localStorage (prevents XSS attacks)
- ✅ HTTP-only cookies (prevents JavaScript access)
- ✅ Automatic CSRF protection
- ✅ Built-in rate limiting

### 2. **Improved User Experience**
- ✅ Seamless session management
- ✅ Automatic session refresh
- ✅ Remember me functionality
- ✅ Multi-device session support

### 3. **Better Performance**
- ✅ Edge-optimized authentication
- ✅ Reduced payload size (no JWT in headers)
- ✅ KV caching for sessions
- ✅ Connection pooling with database

### 4. **Developer Experience**
- ✅ Type-safe authentication
- ✅ Unified API across portals
- ✅ Built-in session management
- ✅ Easy to extend with plugins

## 🐛 Common Issues and Solutions

### Issue: "User is undefined" in Dashboard
**Cause**: Session not properly loaded
**Solution**: Use optional chaining and fallbacks:
```typescript
<span>By @{pitch.creator?.username || pitch.creator?.name || 'Unknown'}</span>
```

### Issue: 404 on authentication endpoints
**Cause**: Endpoint not registered in Worker
**Solution**: Ensure endpoint is registered in `worker-integrated.ts`

### Issue: Session not persisting
**Cause**: Cookie configuration mismatch
**Solution**: Check domain, secure, and sameSite settings

### Issue: CORS errors
**Cause**: Mismatched origins
**Solution**: Update CORS headers to include your domain

## 🎯 Future Enhancements

1. **OAuth Integration**
   - Google OAuth for easier sign-up
   - GitHub OAuth for developer portals
   - LinkedIn OAuth for professional networking

2. **Two-Factor Authentication**
   - TOTP support
   - SMS verification
   - Email verification codes

3. **Advanced Session Management**
   - Device tracking
   - Session activity logs
   - Remote session termination

4. **Enhanced Security**
   - WebAuthn/Passkeys support
   - Biometric authentication
   - Hardware key support

## 📚 Resources

- [Better Auth Documentation](https://better-auth.com)
- [Cloudflare Workers Documentation](https://developers.cloudflare.com/workers/)
- [Neon PostgreSQL Documentation](https://neon.tech/docs)
- [Pitchey API Documentation](/docs/api-reference.md)

## 📝 Conclusion

The Better Auth three-portal implementation provides a robust, secure, and scalable authentication system for Pitchey. By leveraging cookie-based sessions instead of JWT tokens, the platform achieves better security while maintaining excellent performance at the edge through Cloudflare Workers.

The system successfully handles authentication for three distinct user types (Creator, Investor, Production) while maintaining clean separation of concerns and providing a unified API interface. The migration from JWT to Better Auth has resolved critical security issues while improving the overall user experience.

---

*Last Updated: December 31, 2024*
*Version: 1.0.0*
*Status: Production Ready*