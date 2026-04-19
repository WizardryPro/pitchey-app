# Pitchey Platform Technical Architecture

## System Overview

Pitchey is a modern edge-first application built with a React frontend, Cloudflare Workers backend, and PostgreSQL database, designed to support a three-portal marketplace for the entertainment industry.

### Architecture Diagram
```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Frontend      │    │    Backend      │    │    Database     │
│   React/Vite    │◄──►│   CF Workers    │◄──►│   PostgreSQL    │
│   Port 5173     │    │   Port 8001     │    │   Port 5432     │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         │              ┌─────────────────┐              │
         │              │     Redis       │              │
         └──────────────►│   Caching       │◄─────────────┘
                        │   WebSockets    │
                        └─────────────────┘
```

## Frontend Architecture

### Technology Stack
- **React 18** with TypeScript
- **Vite** for development and building
- **React Router v6** for client-side routing
- **Tailwind CSS** for styling
- **Axios** for API communication
- **Zustand** for state management

### Project Structure
```
frontend/
├── src/
│   ├── components/          # Reusable UI components
│   │   ├── layout/         # Layout components
│   │   ├── portfolio/      # Portfolio-specific components
│   │   ├── Search/         # Search functionality
│   │   └── LegalAgreements/ # NDA and legal components
│   ├── pages/              # Page components
│   ├── services/           # API service layer
│   ├── hooks/              # Custom React hooks
│   ├── types/              # TypeScript type definitions
│   ├── stores/             # Zustand state stores
│   └── utils/              # Utility functions
├── public/                 # Static assets
└── dist/                   # Build output
```

### Key Components

#### Layout Components
- **Layout.tsx**: Main navigation wrapper with responsive design
- **ErrorBoundary.tsx**: Global error handling
- **Toast/ToastProvider.tsx**: Notification system

#### Business Logic Components
- **FollowButton.tsx**: Social following functionality
- **NDAModal.tsx**: NDA request interface
- **SearchBar.tsx**: Advanced search with autocomplete
- **PitchCard.tsx**: Pitch display component

#### Real-time Components
- **WebSocketProvider**: Real-time connection management
- **LiveMetrics.tsx**: Live analytics display
- **NotificationDropdown.tsx**: Real-time notifications

### State Management

#### Zustand Stores
```typescript
// authStore: User authentication state
interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  login: (credentials: LoginData) => Promise<void>;
  logout: () => void;
}

// pitchStore: Pitch data management
interface PitchState {
  pitches: Pitch[];
  currentPitch: Pitch | null;
  loading: boolean;
  fetchPitches: () => Promise<void>;
  createPitch: (data: PitchData) => Promise<void>;
}
```

### Routing Architecture

#### Portal-Based Routing
```typescript
// Route structure by portal type
/creator/*    - Creator portal routes (protected)
/investor/*   - Investor portal routes (protected)  
/production/* - Production portal routes (protected)
/             - Public routes (homepage, marketplace)
/portals      - Portal selection
```

#### Route Protection
```typescript
// ProtectedRoute component
const ProtectedRoute = ({ children, requiredUserType }) => {
  const { user, isAuthenticated } = useAuthStore();
  
  if (!isAuthenticated) return <Navigate to="/portals" />;
  if (requiredUserType && user?.userType !== requiredUserType) {
    return <Navigate to={`/${user?.userType}/dashboard`} />;
  }
  
  return children;
};
```

## Backend Architecture

### Technology Stack
- **Cloudflare Workers** runtime with TypeScript
- **Hono/custom routing** for HTTP handling
- **Raw SQL** for database operations (no ORM)
- **Better Auth** for session-based authentication
- **Upstash Redis** for caching and sessions
- **WebSocket** for real-time features

### Project Structure
```
src/
├── db/                     # Database configuration
│   ├── schema.ts          # Drizzle schema definitions
│   ├── client.ts          # Database client setup
│   └── migrate.ts         # Migration utilities
├── services/              # Business logic services
│   ├── auth.service.ts    # Authentication logic
│   ├── pitch.service.ts   # Pitch management
│   ├── user.service.ts    # User operations
│   ├── notification.service.ts # Notifications
│   ├── websocket-integration.service.ts # Real-time features
│   └── redis.service.ts   # Caching layer
├── middleware/            # Request middleware
├── utils/                 # Utility functions
└── types/                 # TypeScript definitions
```

### Service Architecture

#### Service Layer Pattern
```typescript
// Base service structure
class BaseService {
  protected db: Database;
  protected redis: RedisService;
  
  constructor() {
    this.db = getDatabase();
    this.redis = RedisService.getInstance();
  }
}

// Pitch service example
class PitchService extends BaseService {
  async createPitch(data: PitchData, userId: number): Promise<Pitch> {
    // Validation
    const validated = this.validatePitchData(data);
    
    // Database operation
    const pitch = await this.db.insert(pitches).values({
      ...validated,
      creatorId: userId,
      createdAt: new Date()
    }).returning();
    
    // Cache invalidation
    await this.redis.invalidatePattern(`pitches:*`);
    
    return pitch[0];
  }
}
```

### Authentication System

#### JWT Implementation
```typescript
// Token generation
const generateToken = (user: User): string => {
  return jwt.sign(
    {
      userId: user.id,
      email: user.email,
      userType: user.userType
    },
    JWT_SECRET,
    { expiresIn: '24h' }
  );
};

// Token validation middleware
const authenticateToken = async (context: Context, next: () => Promise<void>) => {
  const authHeader = context.request.headers.get('authorization');
  const token = authHeader?.split(' ')[1];
  
  if (!token) {
    context.response.status = 401;
    context.response.body = { error: 'Access token required' };
    return;
  }
  
  try {
    const payload = await jwt.verify(token, JWT_SECRET);
    context.state.user = payload;
    await next();
  } catch (error) {
    context.response.status = 403;
    context.response.body = { error: 'Invalid token' };
  }
};
```

#### Portal-Specific Authentication
```typescript
// Multi-portal login endpoints
router.post('/auth/creator/login', async (context) => {
  const { email, password } = await context.request.body().value;
  
  const user = await UserService.validateCredentials(email, password);
  if (!user || user.userType !== 'creator') {
    throw new Error('Invalid creator credentials');
  }
  
  const token = generateToken(user);
  context.response.body = { success: true, token, user };
});
```

### Database Architecture

#### Schema Design
```typescript
// Core tables (Drizzle schema)
export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  passwordHash: varchar('password_hash', { length: 255 }).notNull(),
  userType: varchar('user_type', { length: 20 }).notNull(), // creator, investor, production
  username: varchar('username', { length: 100 }),
  companyName: varchar('company_name', { length: 255 }),
  createdAt: timestamp('created_at').defaultNow(),
});

export const pitches = pgTable('pitches', {
  id: serial('id').primaryKey(),
  title: varchar('title', { length: 255 }).notNull(),
  logline: text('logline'),
  genre: varchar('genre', { length: 50 }),
  format: varchar('format', { length: 50 }),
  shortSynopsis: text('short_synopsis'),
  longSynopsis: text('long_synopsis'),
  budget: varchar('budget', { length: 50 }),
  creatorId: integer('creator_id').references(() => users.id),
  createdAt: timestamp('created_at').defaultNow(),
});

// Social features (MISSING - Critical Issue)
export const follows = pgTable('follows', {
  id: serial('id').primaryKey(),
  followerId: integer('follower_id').references(() => users.id),
  followingId: integer('following_id').references(() => users.id),
  createdAt: timestamp('created_at').defaultNow(),
});
```

#### Database Relationships
```typescript
// User relationships
export const userRelations = relations(users, ({ many }) => ({
  pitches: many(pitches),
  followers: many(follows, { relationName: 'followers' }),
  following: many(follows, { relationName: 'following' }),
  messages: many(messages),
}));

// Pitch relationships  
export const pitchRelations = relations(pitches, ({ one, many }) => ({
  creator: one(users, {
    fields: [pitches.creatorId],
    references: [users.id],
  }),
  views: many(pitchViews),
}));
```

### Caching Layer

#### Redis Integration
```typescript
class RedisService {
  private client: Redis;
  
  async cached<T>(
    key: string,
    fetcher: () => Promise<T>,
    ttl: number = 300
  ): Promise<T> {
    // Check cache first
    const cached = await this.get(key);
    if (cached) return JSON.parse(cached);
    
    // Fetch fresh data
    const fresh = await fetcher();
    
    // Cache the result
    await this.setex(key, ttl, JSON.stringify(fresh));
    
    return fresh;
  }
  
  async invalidatePattern(pattern: string): Promise<void> {
    const keys = await this.keys(pattern);
    if (keys.length > 0) {
      await this.del(...keys);
    }
  }
}
```

### WebSocket Architecture

#### Real-time Features
```typescript
// WebSocket message types
interface WebSocketMessage {
  type: 'notification' | 'dashboard_update' | 'typing' | 'presence_update';
  data: any;
  userId?: number;
  timestamp: string;
}

// WebSocket service
class WebSocketService {
  private clients = new Map<number, WebSocket>();
  
  broadcast(message: WebSocketMessage, userIds?: number[]): void {
    const targets = userIds || Array.from(this.clients.keys());
    
    targets.forEach(userId => {
      const ws = this.clients.get(userId);
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(message));
      }
    });
  }
  
  subscribe(userId: number, ws: WebSocket): void {
    this.clients.set(userId, ws);
    
    ws.onclose = () => {
      this.clients.delete(userId);
    };
  }
}
```

## Security Implementation

### Authentication Security
- **JWT Tokens**: Secure token-based authentication
- **Password Hashing**: bcrypt with salt rounds
- **Session Management**: Secure session handling
- **CORS Configuration**: Proper cross-origin setup

### API Security
```typescript
// Input validation middleware
const validateInput = (schema: any) => {
  return async (context: Context, next: () => Promise<void>) => {
    try {
      const body = await context.request.body().value;
      const validated = schema.parse(body);
      context.state.validatedInput = validated;
      await next();
    } catch (error) {
      context.response.status = 400;
      context.response.body = { error: 'Invalid input data' };
    }
  };
};

// Rate limiting (configured but may not be active)
const rateLimit = {
  general: 100, // requests per minute
  auth: 10,     // auth requests per minute
  websocket: 120 // messages per minute
};
```

### Data Protection
- **SQL Injection Prevention**: Parameterized queries via ORM
- **XSS Protection**: Input sanitization
- **CSRF Protection**: Token validation
- **Data Validation**: Schema-based validation

## Performance Considerations

### Frontend Performance
- **Code Splitting**: Route-based splitting with React.lazy
- **Component Memoization**: React.memo for expensive components
- **Bundle Optimization**: Vite optimization
- **Image Optimization**: Lazy loading and responsive images

### Backend Performance
- **Database Indexing**: Strategic index placement
- **Query Optimization**: Efficient database queries
- **Caching Strategy**: Redis caching with TTL
- **Connection Pooling**: Database connection management

### Current Performance Metrics
- **API Response Time**: 200-500ms (working endpoints)
- **Frontend Load Time**: 2-3 seconds initial load
- **Database Query Time**: <100ms for simple queries
- **WebSocket Latency**: <50ms when operational

## Current Issues and Limitations

### Critical Infrastructure Issues

#### Database Schema Problems
```sql
-- Missing tables causing major functionality failures
-- These tables are referenced in code but don't exist in database:

CREATE TABLE follows (
    id SERIAL PRIMARY KEY,
    follower_id INTEGER NOT NULL REFERENCES users(id),
    following_id INTEGER NOT NULL REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(follower_id, following_id)
);

CREATE TABLE notifications (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id),
    type VARCHAR(50) NOT NULL,
    title VARCHAR(255),
    message TEXT,
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE portfolio (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id),
    pitch_id INTEGER NOT NULL REFERENCES pitches(id),
    investment_amount DECIMAL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

#### Service Configuration Issues
```typescript
// Redis service initialization problems
// Error: nativeRedisService is not defined
// Impact: Caching and real-time features fail

// DATABASE_URL configuration inconsistencies  
// Error: "DATABASE_URL not configured"
// Impact: Some database operations fail
```

### Deployment Architecture

#### Development Environment
```bash
# Local development setup
Frontend: http://localhost:5173 (Vite dev server)
Backend:  http://localhost:8787 (Wrangler dev server)
Database: postgresql://postgres:password@localhost:5432/pitchey
Redis:    localhost:6379 (Docker container)
```

#### Production Environment
```bash
# Production deployment
Frontend: https://pitchey.pages.dev (cloudflare-pages)
Backend:  https://pitchey-api-prod.ndlovucavelle.workers.dev (Cloudflare Workers)
Database: Neon PostgreSQL (cloud-hosted)
Redis:    Upstash Redis (cloud-hosted)
```

#### Environment Configuration
```bash
# Required environment variables
DATABASE_URL=postgresql://user:pass@host:port/db?sslmode=require
JWT_SECRET=your-secret-key
FRONTEND_URL=https://pitchey.pages.dev
REDIS_URL=redis://localhost:6379
PORT=8001
```

## Monitoring and Observability

### Health Monitoring
```typescript
// Health check endpoint
router.get('/api/health', (context) => {
  context.response.body = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: '3.4',
    services: {
      database: 'connected',
      redis: 'connected', // when working
      websocket: 'active'
    }
  };
});
```

### Error Tracking
- **Sentry Integration**: Error monitoring and reporting
- **Structured Logging**: JSON-formatted logs
- **Performance Monitoring**: Response time tracking

### Analytics Integration
- **Custom Analytics**: Event tracking system
- **User Behavior**: Interaction analytics
- **Performance Metrics**: System performance tracking

## Scalability Considerations

### Horizontal Scaling
- **Stateless Backend**: No server-side session storage
- **Database Scaling**: Connection pooling and read replicas
- **Caching Strategy**: Distributed caching with Redis
- **CDN Integration**: Static asset delivery

### Vertical Scaling
- **Resource Optimization**: Memory and CPU efficiency
- **Database Optimization**: Query performance tuning
- **Connection Management**: Efficient connection handling