/**
 * User-related database queries using raw SQL
 * Replaces Drizzle ORM with parameterized Neon queries
 */

import type { SqlQuery } from './base';
import { WhereBuilder, extractFirst, extractMany, DatabaseError } from './base';

// Type definitions
export interface User {
  id: string;
  email: string;
  username: string;
  password_hash: string;
  user_type: 'creator' | 'investor' | 'production' | 'admin';
  first_name?: string;
  last_name?: string;
  profile_image?: string;
  bio?: string;
  company_name?: string;
  phone?: string;
  location?: string;
  website?: string;
  social_links?: Record<string, string>;
  email_verified: boolean;
  is_active: boolean;
  subscription_tier: string;
  subscription_status: string;
  created_at: Date;
  updated_at: Date;
}

export interface CreateUserInput {
  email: string;
  username: string;
  password_hash: string;
  user_type: User['user_type'];
  first_name?: string;
  last_name?: string;
  company_name?: string;
  profile_image?: string;
  bio?: string;
}

export interface UpdateUserInput {
  first_name?: string;
  last_name?: string;
  username?: string;
  bio?: string;
  profile_image?: string;
  company_name?: string;
  phone?: string;
  location?: string;
  website?: string;
  social_links?: Record<string, string>;
}

// Query functions
export async function getUserById(
  sql: SqlQuery,
  userId: string
): Promise<User | null> {
  const result = await sql`
    SELECT 
      id, email, username, password_hash, user_type,
      first_name, last_name, profile_image, bio, company_name,
      phone, location, website, social_links,
      email_verified, is_active, subscription_tier, subscription_status,
      created_at, updated_at
    FROM users
    WHERE id = ${userId}
  `;
  return extractFirst<User>(result);
}

export async function getUserByEmail(
  sql: SqlQuery,
  email: string
): Promise<User | null> {
  const result = await sql`
    SELECT 
      id, email, username, password_hash, user_type,
      first_name, last_name, profile_image, bio, company_name,
      phone, location, website, social_links,
      email_verified, is_active, subscription_tier, subscription_status,
      created_at, updated_at
    FROM users
    WHERE LOWER(email) = LOWER(${email})
  `;
  return extractFirst<User>(result);
}

export async function getUserByUsername(
  sql: SqlQuery,
  username: string
): Promise<User | null> {
  const result = await sql`
    SELECT 
      id, email, username, password_hash, user_type,
      first_name, last_name, profile_image, bio, company_name,
      phone, location, website, social_links,
      email_verified, is_active, subscription_tier, subscription_status,
      created_at, updated_at
    FROM users
    WHERE LOWER(username) = LOWER(${username})
  `;
  return extractFirst<User>(result);
}

export async function createUser(
  sql: SqlQuery,
  input: CreateUserInput
): Promise<User> {
  const result = await sql`
    INSERT INTO users (
      email, username, password_hash, user_type,
      first_name, last_name, company_name, profile_image, bio,
      email_verified, is_active, subscription_tier, subscription_status,
      created_at, updated_at
    ) VALUES (
      ${input.email}, ${input.username}, ${input.password_hash}, ${input.user_type},
      ${input.first_name || null}, ${input.last_name || null}, 
      ${input.company_name || null}, ${input.profile_image || null}, ${input.bio || null},
      false, true, 'free', 'active',
      NOW(), NOW()
    )
    RETURNING *
  `;
  
  const user = extractFirst<User>(result);
  if (!user) {
    throw new DatabaseError('Failed to create user');
  }
  return user;
}

export async function updateUser(
  sql: SqlQuery,
  userId: string,
  input: UpdateUserInput
): Promise<User | null> {
  // Build dynamic UPDATE clause
  const setClauses: string[] = [];
  const values: any[] = [];
  let paramIndex = 2; // $1 is userId

  Object.entries(input).forEach(([key, value]) => {
    if (value !== undefined) {
      setClauses.push(`${key} = $${paramIndex}`);
      values.push(value);
      paramIndex++;
    }
  });

  if (setClauses.length === 0) {
    return getUserById(sql, userId);
  }

  // Always update updated_at
  setClauses.push(`updated_at = NOW()`);

  const query = `
    UPDATE users 
    SET ${setClauses.join(', ')}
    WHERE id = $1
    RETURNING *
  `;

  const result = await sql.query(query, [userId, ...values]);
  return extractFirst<User>(result);
}

export async function verifyUserEmail(
  sql: SqlQuery,
  userId: string
): Promise<boolean> {
  const result = await sql`
    UPDATE users 
    SET email_verified = true, updated_at = NOW()
    WHERE id = ${userId}
    RETURNING id
  `;
  return result.length > 0;
}

export async function updateUserSubscription(
  sql: SqlQuery,
  userId: string,
  tier: string,
  status: string
): Promise<User | null> {
  const result = await sql`
    UPDATE users 
    SET 
      subscription_tier = ${tier},
      subscription_status = ${status},
      updated_at = NOW()
    WHERE id = ${userId}
    RETURNING *
  `;
  return extractFirst<User>(result);
}

export async function getUsersByType(
  sql: SqlQuery,
  userType: User['user_type'],
  options?: {
    limit?: number;
    offset?: number;
    isActive?: boolean;
  }
): Promise<User[]> {
  const wb = new WhereBuilder();
  wb.add('user_type = $param', userType);
  wb.addOptional('is_active', '=', options?.isActive);
  
  const { where, params } = wb.build();
  
  const query = `
    SELECT 
      id, email, username, user_type,
      first_name, last_name, profile_image, bio, company_name,
      email_verified, is_active, subscription_tier,
      created_at, updated_at
    FROM users
    ${where}
    ORDER BY created_at DESC
    ${options?.limit ? `LIMIT ${options.limit}` : ''}
    ${options?.offset ? `OFFSET ${options.offset}` : ''}
  `;
  
  const result = await sql.query(query, params);
  return extractMany<User>(result);
}

export async function searchUsers(
  sql: SqlQuery,
  searchTerm: string,
  options?: {
    userType?: User['user_type'];
    limit?: number;
    offset?: number;
  }
): Promise<User[]> {
  const searchPattern = `%${searchTerm}%`;
  
  const wb = new WhereBuilder();
  wb.add(`(
    LOWER(username) LIKE LOWER($param) OR 
    LOWER(email) LIKE LOWER($param) OR 
    LOWER(first_name) LIKE LOWER($param) OR 
    LOWER(last_name) LIKE LOWER($param) OR
    LOWER(company_name) LIKE LOWER($param)
  )`, searchPattern);
  wb.addOptional('user_type', '=', options?.userType);
  wb.add('is_active = true');
  
  const { where, params } = wb.build();
  
  const query = `
    SELECT 
      id, email, username, user_type,
      first_name, last_name, profile_image, bio, company_name,
      created_at
    FROM users
    ${where}
    ORDER BY 
      CASE 
        WHEN LOWER(username) = LOWER($1) THEN 1
        WHEN LOWER(username) LIKE LOWER($1 || '%') THEN 2
        ELSE 3
      END,
      created_at DESC
    ${options?.limit ? `LIMIT ${options.limit}` : 'LIMIT 20'}
    ${options?.offset ? `OFFSET ${options.offset}` : ''}
  `;
  
  const result = await sql.query(query, [searchTerm, ...params]);
  return extractMany<User>(result);
}

export async function getUserStats(
  sql: SqlQuery,
  userId: string
): Promise<{
  totalPitches: number;
  totalFollowers: number;
  totalFollowing: number;
  totalInvestments?: number;
}> {
  const result = await sql`
    SELECT 
      (SELECT COUNT(*) FROM pitches WHERE creator_id = ${userId}) as total_pitches,
      (SELECT COUNT(*) FROM follows WHERE following_id = ${userId}) as total_followers,
      (SELECT COUNT(*) FROM follows WHERE follower_id = ${userId}) as total_following,
      CASE 
        WHEN u.user_type = 'investor' 
        THEN (SELECT COUNT(*) FROM investments WHERE investor_id = ${userId})
        ELSE NULL
      END as total_investments
    FROM users u
    WHERE u.id = ${userId}
  `;
  
  const stats = extractFirst<any>(result);
  return {
    totalPitches: Number(stats?.total_pitches || 0),
    totalFollowers: Number(stats?.total_followers || 0),
    totalFollowing: Number(stats?.total_following || 0),
    totalInvestments: stats?.total_investments ? Number(stats.total_investments) : undefined
  };
}

export async function deactivateUser(
  sql: SqlQuery,
  userId: string
): Promise<boolean> {
  const result = await sql`
    UPDATE users 
    SET 
      is_active = false,
      updated_at = NOW()
    WHERE id = ${userId}
    RETURNING id
  `;
  return result.length > 0;
}

export async function checkUserExists(
  sql: SqlQuery,
  email: string,
  username?: string
): Promise<{ emailExists: boolean; usernameExists: boolean }> {
  const result = await sql`
    SELECT 
      EXISTS(SELECT 1 FROM users WHERE LOWER(email) = LOWER(${email})) as email_exists,
      EXISTS(SELECT 1 FROM users WHERE LOWER(username) = LOWER(${username || ''})) as username_exists
  `;
  
  const check = extractFirst<any>(result);
  return {
    emailExists: Boolean(check?.email_exists),
    usernameExists: Boolean(check?.username_exists)
  };
}