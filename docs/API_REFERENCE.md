# Pitchey Platform - API Reference

**Version**: 3.0  
**Base URL**: https://pitchey-api-prod.ndlovucavelle.workers.dev  
**Last Updated**: December 30, 2024  
**Authentication**: Better Auth (cookie-based sessions) with JWT fallback

## Table of Contents

1. [Authentication](#authentication)
2. [User Management](#user-management)
3. [Creator Portal](#creator-portal)
4. [Investor Portal](#investor-portal)
5. [Production Portal](#production-portal)
6. [Pitch Management](#pitch-management)
7. [NDA Workflow](#nda-workflow)
8. [File Upload](#file-upload)
9. [Search & Browse](#search--browse)
10. [Team Management](#team-management)
11. [Settings & Preferences](#settings--preferences)
12. [Analytics](#analytics)
13. [Notifications](#notifications)
14. [WebSocket & Polling](#websocket--polling)
15. [Admin & Monitoring](#admin--monitoring)

## Authentication

### Overview
The platform uses Better Auth for session-based authentication with cookie storage. JWT tokens are supported for backward compatibility. All authenticated endpoints require either a valid session cookie or Authorization header with JWT token.

### Login Endpoints

#### Universal Login
```http
POST /api/auth/login
```
**Body:**
```json
{
  "email": "user@example.com",
  "password": "password123"
}
```
**Response:**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "123",
      "email": "user@example.com",
      "name": "John Doe",
      "userType": "creator"
    }
  }
}
```

#### Portal-Specific Login
```http
POST /api/auth/creator/login
POST /api/auth/investor/login
POST /api/auth/production/login
```
Each portal validates the user type matches the requested portal.

### Registration
```http
POST /api/auth/register
```
**Body:**
```json
{
  "email": "user@example.com",
  "password": "password123",
  "name": "John Doe",
  "userType": "creator"
}
```

### Session Management
```http
GET /api/auth/session
```
Returns current session information.

```http
POST /api/auth/logout
```
Clears session and logs out user.

### Demo Accounts
- **Creator**: alex.creator@demo.com (password: Demo123)
- **Investor**: sarah.investor@demo.com (password: Demo123)
- **Production**: stellar.production@demo.com (password: Demo123)

## User Management

### Profile
```http
GET /api/profile
GET /api/users/profile
```
Returns authenticated user's profile.
**Auth Required**: Yes

```http
PUT /api/users/profile
```
Updates user profile.
**Auth Required**: Yes

### Settings
```http
GET /api/user/settings
```
Get user settings and preferences.

```http
PUT /api/user/settings
```
Update user settings.

### Account Management
```http
DELETE /api/user/account
```
Delete user account (requires confirmation).

```http
GET /api/user/sessions
```
List active sessions.

```http
GET /api/user/activity
```
Get account activity log.

### Two-Factor Authentication
```http
POST /api/user/two-factor/enable
POST /api/user/two-factor/disable
```
Enable/disable 2FA.

## Creator Portal

### Dashboard
```http
GET /api/creator/dashboard
```
**Response:**
```json
{
  "success": true,
  "data": {
    "stats": {
      "totalPitches": 15,
      "activeInvestments": 3,
      "totalViews": 1250,
      "totalRevenue": 250000
    },
    "recentActivity": [...],
    "upcomingDeadlines": [...]
  }
}
```
**Auth Required**: Yes (creator only)

### Revenue Management
```http
GET /api/creator/revenue
GET /api/creator/revenue/trends
GET /api/creator/revenue/breakdown
```
Revenue tracking and analytics.

### Contracts
```http
GET /api/creator/contracts
GET /api/creator/contracts/:id
PUT /api/creator/contracts/:id
```
Contract management for creators.

### Analytics
```http
GET /api/creator/analytics
GET /api/creator/analytics/pitches
GET /api/creator/analytics/engagement
GET /api/creator/analytics/demographics
```
Detailed analytics for creators.

### Investor Relations
```http
GET /api/creator/investors
GET /api/creator/investors/:id/communication
POST /api/creator/investors/:id/message
```
Manage investor relationships.

### Additional Endpoints
```http
GET /api/creator/portfolio
GET /api/creator/funding
GET /api/creator/funding/overview
GET /api/creator/pitches
POST /api/creator/pitches
GET /api/creator/ndas
GET /api/creator/following
GET /api/creator/calendar
```

## Investor Portal

### Dashboard
```http
GET /api/investor/dashboard
```
**Response:**
```json
{
  "success": true,
  "data": {
    "portfolio": {
      "totalInvested": 5000000,
      "currentValue": 7500000,
      "roi": 50,
      "activeProjects": 12
    },
    "recentActivity": [...],
    "recommendations": [...]
  }
}
```
**Auth Required**: Yes (investor only)

### Portfolio Management
```http
GET /api/investor/portfolio/summary
GET /api/investor/investments
GET /api/investor/investments/all
GET /api/investor/investments/summary
```

### Financial Overview
```http
GET /api/investor/financial/summary
GET /api/investor/financial/recent-transactions
```

### Transaction Management
```http
GET /api/investor/transactions
GET /api/investor/transactions/export
GET /api/investor/transactions/stats
```
**Query Parameters:**
- `startDate`: ISO date string
- `endDate`: ISO date string
- `status`: pending|completed|cancelled
- `limit`: number (default: 50)

### Budget Allocation
```http
GET /api/investor/budget/allocations
POST /api/investor/budget/allocations
PUT /api/investor/budget/allocations/:id
```

### Tax Documents
```http
GET /api/investor/tax/documents
GET /api/investor/tax/documents/:id/download
POST /api/investor/tax/generate
```

### Deal Management
```http
GET /api/investor/deals/pending
PUT /api/investor/deals/:id/status
GET /api/investor/deals/:id/timeline
```

### Project Tracking
```http
GET /api/investor/projects/completed
GET /api/investor/projects/:id/performance
GET /api/investor/projects/:id/documents
```

### ROI Analysis
```http
GET /api/investor/analytics/roi/summary
GET /api/investor/analytics/roi/by-category
GET /api/investor/analytics/roi/timeline
```

### Market Analysis
```http
GET /api/investor/analytics/market/trends
GET /api/investor/analytics/market/genres
GET /api/investor/analytics/market/forecast
```

### Risk Assessment
```http
GET /api/investor/analytics/risk/portfolio
GET /api/investor/analytics/risk/projects
GET /api/investor/analytics/risk/recommendations
```

### Social Features
```http
GET /api/investor/recommendations
GET /api/investor/saved-pitches
GET /api/investor/watchlist
GET /api/investor/activity
GET /api/investor/following
GET /api/investor/notifications
GET /api/investor/nda-requests
```

## Production Portal

### Dashboard
```http
GET /api/production/dashboard
```
**Response:**
```json
{
  "success": true,
  "data": {
    "activeProjects": 8,
    "inDevelopment": 12,
    "totalBudget": 150000000,
    "teamSize": 245,
    "upcomingDeadlines": [...]
  }
}
```
**Auth Required**: Yes (production only)

### Talent Discovery
```http
GET /api/production/talent/search
GET /api/production/talent/:id
POST /api/production/talent/:id/contact
```
**Query Parameters for search:**
- `role`: director|writer|actor|producer
- `genre`: action|drama|comedy|etc
- `experience`: junior|mid|senior

### Project Pipeline
```http
GET /api/production/pipeline
GET /api/production/pipeline/:id
PUT /api/production/pipeline/:id/status
GET /api/production/projects
```

### Budget Management
```http
GET /api/production/budget
GET /api/production/budget/:projectId
PUT /api/production/budget/:projectId
GET /api/production/budget/:projectId/variance
```

### Schedule Management
```http
GET /api/production/schedule
GET /api/production/schedule/:projectId
PUT /api/production/schedule/:projectId
GET /api/production/schedule/:projectId/conflicts
```

### Location Scouting
```http
GET /api/production/locations/search
GET /api/production/locations/:id
POST /api/production/locations/:id/book
```

### Crew Assembly
```http
GET /api/production/crew/search
GET /api/production/crew/:id
POST /api/production/crew/:id/hire
```

### Additional Features
```http
GET /api/production/analytics
GET /api/production/submissions
GET /api/production/investments
GET /api/production/investments/overview
GET /api/production/smart-pitch-discovery
GET /api/production/team
GET /api/production/contracts
GET /api/production/reviews
GET /api/production/following
```

## Pitch Management

### List Pitches
```http
GET /api/pitches
```
**Query Parameters:**
- `status`: draft|published|archived
- `genre`: string
- `budget`: min-max range
- `sort`: trending|newest|popular
- `limit`: number (default: 20)
- `offset`: number (default: 0)

### Create Pitch
```http
POST /api/pitches
```
**Body:**
```json
{
  "title": "My Amazing Movie",
  "logline": "A compelling one-liner",
  "synopsis": "Detailed synopsis...",
  "genre": ["action", "thriller"],
  "budget": 5000000,
  "targetAudience": "18-35",
  "themes": ["redemption", "family"],
  "comparableFilms": ["Film 1", "Film 2"],
  "status": "draft",
  "seekingInvestment": true,
  "ndaRequired": true
}
```
**Auth Required**: Yes (creator only)

### Get Pitch
```http
GET /api/pitches/:id
```
Returns full pitch details. NDA acceptance may be required.

```http
GET /api/pitches/public/:id
```
Returns public pitch information (no NDA required).

### Update Pitch
```http
PUT /api/pitches/:id
```
**Auth Required**: Yes (pitch owner only)

### Delete Pitch
```http
DELETE /api/pitches/:id
```
**Auth Required**: Yes (pitch owner only)

### Special Endpoints
```http
GET /api/pitches/public
```
List all public pitches (marketplace).

```http
GET /api/pitches/following
```
Get pitches from followed creators.

## NDA Workflow

### NDA Management
```http
GET /api/ndas
```
List all NDAs for authenticated user.

```http
GET /api/ndas/stats
```
Get NDA statistics.

### NDA Status Check
```http
GET /api/ndas/pitch/:pitchId/status
```
Check NDA status for a specific pitch.
**Response:**
```json
{
  "success": true,
  "data": {
    "hasNDA": true,
    "status": "approved",
    "approvedAt": "2024-12-01T10:00:00Z"
  }
}
```

### Request NDA
```http
GET /api/ndas/pitch/:pitchId/can-request
```
Check if user can request NDA for pitch.

```http
POST /api/ndas/request
```
**Body:**
```json
{
  "pitchId": "123",
  "message": "I'm interested in learning more about this project."
}
```
**Auth Required**: Yes

### Approve/Reject NDA
```http
POST /api/ndas/:id/approve
POST /api/ndas/:id/reject
```
**Body:**
```json
{
  "reason": "Optional reason for rejection"
}
```
**Auth Required**: Yes (pitch owner only)

## File Upload

### Upload Files
```http
POST /api/upload
```
General file upload endpoint.
**Headers:**
- `Content-Type`: multipart/form-data
**Body:** FormData with file(s)

```http
POST /api/upload/document
```
Upload documents (PDF, DOC, etc).

```http
POST /api/upload/media
```
Upload media files (images, videos).

```http
POST /api/upload/nda
```
Upload custom NDA documents.

### File Management
```http
GET /api/files
```
List uploaded files.

```http
GET /api/files/:id
```
Get specific file details/download.

```http
DELETE /api/files/:id
DELETE /api/upload/:key
```
Delete uploaded file.

## Search & Browse

### Search
```http
GET /api/search
```
**Query Parameters:**
- `q`: search query
- `type`: pitch|creator|investor|production
- `genre`: filter by genre
- `budget`: min-max range
- `status`: filter by status

### Browse
```http
GET /api/browse
```
Browse content with filters.
**Query Parameters:**
- `category`: trending|new|popular|funded
- `genre`: filter by genre
- `sort`: relevance|date|views|investment

### Autocomplete
```http
GET /api/search/autocomplete
```
**Query Parameters:**
- `q`: partial search query
- `limit`: max suggestions (default: 10)

### Trending & Discovery
```http
GET /api/search/trending
```
Get trending content.

```http
GET /api/search/facets
```
Get search facets for filtering.

## Team Management

### Teams
```http
GET /api/teams
```
List user's teams.

```http
POST /api/teams
```
Create new team.
**Body:**
```json
{
  "name": "My Production Team",
  "description": "Team description",
  "type": "production"
}
```

```http
GET /api/teams/:id
PUT /api/teams/:id
DELETE /api/teams/:id
```
Team CRUD operations.

### Team Invitations
```http
POST /api/teams/:id/invite
```
**Body:**
```json
{
  "email": "member@example.com",
  "role": "member|admin"
}
```

```http
GET /api/teams/invites
```
List pending invitations.

```http
POST /api/teams/invites/:id/accept
POST /api/teams/invites/:id/reject
```
Accept or reject invitation.

### Team Members
```http
PUT /api/teams/:teamId/members/:memberId
```
Update member role.

```http
DELETE /api/teams/:teamId/members/:memberId
```
Remove team member.

## Settings & Preferences

### User Settings
```http
GET /api/user/settings
PUT /api/user/settings
```

### Notification Preferences
```http
GET /api/user/preferences
PUT /api/user/preferences
```

### Saved Content
```http
GET /api/user/saved-pitches
```

### Session Management
```http
POST /api/user/session/log
```
Log session activity.

## Analytics

### Dashboard Analytics
```http
GET /api/analytics/dashboard
```
Overall analytics dashboard.

```http
GET /api/analytics/user
```
User-specific analytics.

```http
GET /api/analytics/realtime
```
Real-time analytics data.

## Notifications

### Get Notifications
```http
GET /api/notifications/unread
GET /api/user/notifications
```

### Polling (Free Tier)
```http
GET /api/poll/notifications
```
Poll for new notifications.

## WebSocket & Polling

### WebSocket Connection (Disabled on Free Tier)
```http
GET /ws
```
Upgrade to WebSocket connection (returns 503 on free tier).

### Polling Endpoints (Free Tier Alternative)
```http
GET /api/poll/all
GET /api/poll/messages
GET /api/poll/dashboard
```
Efficient polling endpoints that combine multiple data sources.

## Admin & Monitoring

### Health Check
```http
GET /api/health
GET /api/admin/health
```
**Response:**
```json
{
  "status": "healthy",
  "version": "3.0",
  "timestamp": "2024-12-30T10:00:00Z"
}
```

### Metrics
```http
GET /api/admin/metrics
GET /api/admin/metrics/history
```
Platform metrics and performance data.

### Payment Status
```http
GET /api/payments/credits/balance
GET /api/payments/subscription-status
```

### Follow System
```http
GET /api/follows/followers
GET /api/follows/following
```

### Investments
```http
GET /api/investments
POST /api/investments
GET /api/portfolio
```

## Rate Limiting

The API implements rate limiting based on endpoint type:

- **General API**: 100 requests/minute
- **Authentication**: 10 requests/minute
- **File Upload**: 10 requests/minute
- **Sensitive Operations** (investments, NDAs): 5 requests/minute

Rate limit headers are included in responses:
- `X-RateLimit-Limit`: Maximum requests allowed
- `X-RateLimit-Remaining`: Requests remaining
- `X-RateLimit-Reset`: Reset timestamp

## Error Responses

All errors follow a consistent format:
```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable error message",
    "details": {}
  }
}
```

Common error codes:
- `UNAUTHORIZED`: Authentication required
- `FORBIDDEN`: Insufficient permissions
- `NOT_FOUND`: Resource not found
- `VALIDATION_ERROR`: Input validation failed
- `RATE_LIMITED`: Rate limit exceeded
- `INTERNAL_ERROR`: Server error

## CORS Configuration

The API supports CORS with the following configuration:
- **Allowed Origins**: https://pitchey.pages.dev, http://localhost:5173
- **Allowed Methods**: GET, POST, PUT, DELETE, PATCH, OPTIONS
- **Allowed Headers**: Content-Type, Authorization, X-Requested-With
- **Credentials**: Supported (for cookie-based sessions)

## Migration Notes

### From JWT to Better Auth
The platform has migrated from JWT-based authentication to Better Auth's session-based system. Key changes:

1. **Sessions stored in cookies** - No need to send Authorization headers
2. **JWT still supported** - For backward compatibility
3. **Portal endpoints work** - All portal-specific endpoints route through Better Auth
4. **Demo accounts unchanged** - Same credentials, now work with Better Auth

### WebSocket to Polling
Due to free tier limitations, WebSocket functionality has been replaced with efficient polling:

1. **Combined endpoints** - `/api/poll/all` returns multiple data types
2. **Smart caching** - Results cached for 5-30 seconds based on data type
3. **Reduced requests** - Single poll replaces multiple WebSocket subscriptions

## Implementation Status

### ✅ Fully Implemented (117+ endpoints)
- All authentication endpoints
- Creator, Investor, and Production dashboards
- Pitch CRUD operations
- NDA workflow
- File upload system
- Search and browse
- Team management
- User settings
- Analytics endpoints
- Notification system
- Follow system
- Investment tracking

### ⚠️ Partial Implementation
- WebSocket support (disabled on free tier, polling available)
- Email/messaging routes (commented out due to Drizzle ORM issues)
- Some advanced production features pending full data

### 🔧 Known Limitations (Free Tier)
- WebSocket connections return 503
- Polling used instead of real-time updates
- Rate limiting enforced
- Some caching delays (5-30 seconds)

## Support

For API issues or questions:
- **Documentation**: This document
- **Health Check**: GET /api/health
- **Demo Accounts**: Use provided demo credentials for testing
- **Rate Limits**: Monitor X-RateLimit headers