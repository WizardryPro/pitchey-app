# Pitchey RBAC Deployment Guide

## Overview
This guide covers the deployment of the comprehensive Role-Based Access Control (RBAC) system for the Pitchey platform.

## Components Implemented

### 1. Database Schema (✅ Complete)
- **Permissions table**: Defines all system permissions
- **Roles table**: System and custom roles
- **Role_permissions**: Maps permissions to roles
- **User_roles**: Assigns roles to users
- **Content_access**: Manages NDA-based content access
- **Permission_audit**: Logs all permission checks

### 2. Permission Service (✅ Complete)
- `src/services/permission.service.ts`: Core permission logic
- `src/services/worker-rbac.service.ts`: Worker integration
- `src/middleware/permission.middleware.ts`: Route protection

### 3. NDA Integration (✅ Complete)
- `src/handlers/nda-rbac.ts`: NDA approval with automatic access grants
- Automatic content access when NDAs are approved
- Access revocation when NDAs are revoked

### 4. Frontend Components (✅ Complete)
- `frontend/src/hooks/usePermissions.ts`: Permission context hook
- `frontend/src/components/PermissionGuard.tsx`: Conditional rendering

## Deployment Steps

### Phase 1: Database Migration

```bash
# 1. Apply RBAC schema migrations
PGPASSWORD="npg_DZhIpVaLAk06" psql -h ep-old-snow-abpr94lc-pooler.eu-west-2.aws.neon.tech \
  -U neondb_owner -d neondb -f migrations/20260103_001_rbac_schema.sql

# 2. Seed roles and permissions
PGPASSWORD="npg_DZhIpVaLAk06" psql -h ep-old-snow-abpr94lc-pooler.eu-west-2.aws.neon.tech \
  -U neondb_owner -d neondb -f migrations/20260103_002_seed_rbac.sql

# 3. Migrate existing users
PGPASSWORD="npg_DZhIpVaLAk06" psql -h ep-old-snow-abpr94lc-pooler.eu-west-2.aws.neon.tech \
  -U neondb_owner -d neondb -f migrations/20260103_003_migrate_user_roles.sql
```

### Phase 2: Deploy Worker

```bash
# 1. Build and deploy Worker with RBAC
cd /home/supremeisbeing/pitcheymovie/pitchey_v0.2
npx wrangler deploy --env production

# 2. Verify deployment
npx wrangler tail pitchey-api-prod --format pretty
```

### Phase 3: Deploy Frontend

```bash
# 1. Build frontend with permissions
cd frontend
npm run build

# 2. Deploy to Cloudflare Pages
npx wrangler pages deploy dist --project-name=pitchey --branch main
```

### Phase 4: Verification

```bash
# Run the test suite
./test-rbac-implementation.sh
```

## Permission Structure

### Roles
- **Creator**: Content creators who submit pitches
- **Investor**: Investors who fund pitches
- **Production**: Production companies
- **Admin**: Platform administrators

### Key Permissions
| Permission | Description | Roles |
|------------|-------------|-------|
| `pitch:create` | Create new pitches | Creator |
| `pitch:read_protected` | View NDA-protected content | Investor, Production |
| `nda:request` | Request NDAs | Investor, Production |
| `nda:approve` | Approve NDAs | Creator |
| `investment:create` | Make investments | Investor, Production |
| `admin:manage_users` | Manage all users | Admin |

## Frontend Usage

### Using PermissionGuard

```tsx
import { PermissionGuard } from '@/components/PermissionGuard';

// Show create button only for creators
<PermissionGuard permission="pitch:create">
  <Button onClick={handleCreate}>Create Pitch</Button>
</PermissionGuard>

// Show invest button for investors and production companies
<PermissionGuard roles={['investor', 'production']}>
  <Button onClick={handleInvest}>Invest Now</Button>
</PermissionGuard>

// Require multiple permissions
<PermissionGuard 
  permissions={['nda:approve', 'admin:manage_content']} 
  requireAll={false}
>
  <ApprovalPanel />
</PermissionGuard>
```

### Using Permission Hook

```tsx
import { usePermissions } from '@/hooks/usePermissions';

function MyComponent() {
  const { hasPermission, hasRole, capabilities } = usePermissions();
  
  if (capabilities.canCreatePitch) {
    // Show create UI
  }
  
  if (hasRole('admin')) {
    // Show admin controls
  }
  
  if (hasPermission('nda:request')) {
    // Show NDA request button
  }
}
```

## API Integration

### Protected Routes

```typescript
// In Worker routes
this.register('POST', '/api/pitches', 
  this.rbacService.withPermission('pitch:create', this.handleCreatePitch.bind(this))
);

this.register('PUT', '/api/pitches/:id', 
  this.rbacService.withOwnership('pitch', this.handleUpdatePitch.bind(this))
);

this.register('POST', '/api/ndas/:id/approve',
  this.rbacService.withRole('creator', this.handleApproveNDA.bind(this))
);
```

### Permission Check Response

```json
// GET /api/user/permissions
{
  "userId": 1,
  "email": "alex.creator@demo.com",
  "userType": "creator",
  "roles": ["creator"],
  "permissions": [
    "pitch:create",
    "pitch:update_own",
    "nda:approve",
    "document:upload"
  ],
  "capabilities": {
    "canCreatePitch": true,
    "canInvest": false,
    "canRequestNDA": false,
    "canApproveNDA": true
  }
}
```

## Monitoring & Audit

### Check Permission Denials
```sql
SELECT * FROM permission_audit 
WHERE granted = false 
ORDER BY created_at DESC 
LIMIT 50;
```

### Monitor NDA Access Grants
```sql
SELECT ca.*, u.email, p.title 
FROM content_access ca
JOIN users u ON ca.user_id = u.id
JOIN pitches p ON ca.content_id = p.id AND ca.content_type = 'pitch'
WHERE ca.granted_via = 'nda'
ORDER BY ca.granted_at DESC;
```

### Track Role Assignments
```sql
SELECT u.email, r.name as role, ur.granted_at
FROM user_roles ur
JOIN users u ON ur.user_id = u.id
JOIN roles r ON ur.role_id = r.id
ORDER BY ur.granted_at DESC;
```

## Troubleshooting

### Common Issues

1. **403 Forbidden Errors**
   - Check user has required permission
   - Verify role assignment
   - Check content_access table for NDA grants

2. **Missing Permissions**
   - Verify migrations were applied
   - Check role_permissions mappings
   - Ensure user_roles entries exist

3. **NDA Access Not Working**
   - Verify NDA status is 'approved'
   - Check content_access entries
   - Review permission_audit logs

### Debug Commands

```bash
# Check user permissions
curl -H "Authorization: Bearer $TOKEN" \
  https://pitchey-api-prod.ndlovucavelle.workers.dev/api/user/permissions

# View audit logs
PGPASSWORD="npg_DZhIpVaLAk06" psql -h ep-old-snow-abpr94lc-pooler.eu-west-2.aws.neon.tech \
  -U neondb_owner -d neondb -c "SELECT * FROM permission_audit ORDER BY created_at DESC LIMIT 20;"

# Check content access
PGPASSWORD="npg_DZhIpVaLAk06" psql -h ep-old-snow-abpr94lc-pooler.eu-west-2.aws.neon.tech \
  -U neondb_owner -d neondb -c "SELECT * FROM content_access WHERE user_id = YOUR_USER_ID;"
```

## Security Considerations

1. **Principle of Least Privilege**: Users only get permissions they need
2. **Audit Logging**: All permission checks are logged
3. **Content Protection**: NDA-protected content requires explicit access grants
4. **Role Separation**: Clear distinction between creator, investor, and production roles
5. **Admin Override**: Admins can access all content but actions are logged

## Rollback Plan

If issues arise:

```sql
-- Remove RBAC tables (CAUTION: This removes all permission data)
DROP TABLE IF EXISTS permission_audit CASCADE;
DROP TABLE IF EXISTS content_access CASCADE;
DROP TABLE IF EXISTS user_roles CASCADE;
DROP TABLE IF EXISTS role_permissions CASCADE;
DROP TABLE IF EXISTS roles CASCADE;
DROP TABLE IF EXISTS permissions CASCADE;
```

## Next Steps

1. **Monitor Usage**: Review permission_audit regularly
2. **Fine-tune Permissions**: Adjust based on user feedback
3. **Add Custom Roles**: Create specialized roles as needed
4. **Performance Optimization**: Add indexes if queries slow down
5. **Regular Audits**: Review access patterns monthly

## Support

For issues or questions:
- Check permission_audit table for denials
- Review this guide's troubleshooting section
- Contact platform administrators for role changes