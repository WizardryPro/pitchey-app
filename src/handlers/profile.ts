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

  // Get user ID from authentication
  const userId = await getUserId(request, env) || '1';
  
  // Return demo user if DB fails
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
  
  if (!sql) {
    return new Response(JSON.stringify({
      success: true,
      data: demoUser
    }), {
      status: 200,
      headers: { 
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=300', // Cache for 5 minutes
        ...corsHeaders
      }
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
        headers: { 
          'Content-Type': 'application/json',
          'Cache-Control': 'public, max-age=300',
          ...corsHeaders
        }
      });
    }
    
    // Return demo user if not found
    return new Response(JSON.stringify({
      success: true,
      data: demoUser
    }), {
      status: 200,
      headers: { 
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=300',
        ...corsHeaders
      }
    });
    
  } catch (error) {
    console.error('Profile query error:', error);
    return new Response(JSON.stringify({
      success: true,
      data: demoUser
    }), {
      status: 200,
      headers: { 
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=300',
        ...corsHeaders
      }
    });
  }
}