/**
 * Profile Handler with Error Resilience
 */

import { getDb } from '../db/connection';
import type { Env } from '../db/connection';
import { getCorsHeaders } from '../utils/response';
import { getUserId } from '../utils/auth-extract';

export async function profileHandler(request: Request, env: Env): Promise<Response> {
  const sql = getDb(env);
  const origin = request.headers.get('Origin');
  const corsHeaders = getCorsHeaders(origin);

  // Per-user authenticated data: never let a browser or shared cache hold it.
  // This endpoint previously shipped `Cache-Control: public, max-age=300`,
  // which made profile edits look like they didn't persist — a reload within
  // 5 minutes served the stale pre-edit body from cache (and risked one user's
  // PII being served to another via a shared cache).
  const noStore = 'private, no-store';

  // Get user ID from authentication
  const userId = await getUserId(request, env) || '1';

  // Env-level fallback: no DB binding (misconfiguration), not a per-user error.
  if (!sql) {
    const demoUser = {
      id: userId,
      email: 'alex.creator@demo.com',
      username: 'alexcreator',
      name: 'Alex Creator',
      userType: 'creator',
      firstName: 'Alex',
      lastName: 'Creator',
      companyName: 'Creative Studios',
      profileImage: null,
      subscriptionTier: 'pro',
      createdAt: new Date().toISOString(),
      bio: 'Demo user profile',
      verified: false
    };
    return new Response(JSON.stringify({ success: true, data: demoUser }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', 'Cache-Control': noStore, ...corsHeaders }
    });
  }

  try {
    const result = await sql`
      SELECT
        id, email, username,
        COALESCE(name, username, email) as name,
        user_type as "userType",
        first_name as "firstName",
        last_name as "lastName",
        company_name as "companyName",
        company_address as "companyAddress",
        profile_image as "profileImage",
        subscription_tier as "subscriptionTier",
        created_at as "createdAt",
        bio, phone, website, location, verified
      FROM users
      WHERE id = ${userId}
      LIMIT 1
    `;

    if (result && result[0]) {
      return new Response(JSON.stringify({
        success: true,
        data: result[0]
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', 'Cache-Control': noStore, ...corsHeaders }
      });
    }

    // Genuinely not found — surface it instead of masking with demo data
    // (returning a hardcoded user here made wrong/stale data look like the
    // logged-in user's own profile). The frontend falls back to the auth-store
    // user on a non-2xx, which is the real session user.
    return new Response(JSON.stringify({
      success: false,
      error: { message: 'Profile not found' }
    }), {
      status: 404,
      headers: { 'Content-Type': 'application/json', 'Cache-Control': noStore, ...corsHeaders }
    });

  } catch (error) {
    console.error('Profile query error:', error);
    // Surface DB errors rather than returning a 200 demo user that masks the
    // failure (this masking hid the persistence-class bugs for weeks).
    return new Response(JSON.stringify({
      success: false,
      error: { message: 'Failed to load profile' }
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', 'Cache-Control': noStore, ...corsHeaders }
    });
  }
}
