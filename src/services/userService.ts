import { db } from "../db/client.ts";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";
// Note: AuthService and CacheService imports removed as they may have Drizzle dependencies

export const UpdateProfileSchema = z.object({
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  phone: z.string().optional(),
  location: z.string().optional(),
  bio: z.string().optional(),
  profileImageUrl: z.string().optional(),
  companyName: z.string().optional(),
  companyWebsite: z.string().optional(),
  companyAddress: z.string().optional(),
});

export class UserService {
  static async getUserById(userId: number) {
    const result = await db.query(`
      SELECT id, email, username, user_type, first_name, last_name, 
             phone, location, bio, website, avatar_url, profile_image_url,
             company_name, company_number, company_website, company_address,
             email_verified, created_at, updated_at
      FROM users 
      WHERE id = $1
    `, [userId]);
    
    return result[0] || null;
  }
  
  static async getUserByEmail(email: string) {
    const result = await db.query(`
      SELECT id, email, username, user_type, first_name, last_name, 
             phone, location, bio, website, avatar_url, profile_image_url,
             company_name, company_number, company_website, company_address,
             email_verified, created_at, updated_at
      FROM users 
      WHERE email = $1
    `, [email]);
    
    return result[0] || null;
  }
  
  static async updateProfile(userId: number, data: z.infer<typeof UpdateProfileSchema>) {
    const validated = UpdateProfileSchema.parse(data);
    
    const updateFields = Object.keys(validated).map((key, index) => 
      `${key.replace(/([A-Z])/g, '_$1').toLowerCase()} = $${index + 2}`
    ).join(', ');
    
    const updateValues = Object.values(validated);
    
    const updatedUserResult = await db.query(`
      UPDATE users SET 
        ${updateFields}, 
        updated_at = $${updateValues.length + 2}
      WHERE id = $1
      RETURNING id, email, username, user_type, first_name, last_name, 
                phone, location, bio, profile_image_url, company_name, 
                company_website, company_address, email_verified, 
                company_verified, subscription_tier, updated_at
    `, [userId, ...updateValues, new Date()]);
    
    const updatedUser = updatedUserResult[0];
    
    // Invalidate user session cache after profile update
    try {
      // CacheService disabled during Drizzle conversion
    } catch (error) {
      console.warn("Failed to invalidate user session cache:", error);
    }
    
    return updatedUser;
  }
  
  static async getUserProfile(userId: number) {
    const user = await db.query(`SELECT * FROM users`({
      where: eq(users.id, userId),
      columns: {
        passwordHash: false,
        emailVerificationToken: false,
      },
    });
    
    if (!user) {
      throw new Error("User not found");
    }
    
    // Get additional stats based on user type
    let additionalData = {};
    
    if (user.userType === "creator") {
      // Get creator stats
      const pitchStats = await db
        .select({
          totalPitches: sql<number>`count(*)`,
          publishedPitches: sql<number>`count(*) filter (where status = 'published')`,
          totalViews: sql<number>`sum(view_count)`,
          totalLikes: sql<number>`sum(like_count)`,
          totalNDAs: sql<number>`sum(nda_count)`,
        })
        .from(pitches)
        .where(eq(pitches.userId, userId))
        .groupBy(pitches.userId);
      
      additionalData = {
        stats: pitchStats[0] || {
          totalPitches: 0,
          publishedPitches: 0,
          totalViews: 0,
          totalLikes: 0,
          totalNDAs: 0,
        },
      };
    } else if (user.userType === "investor") {
      // Get investor stats (follows, investments, etc.)
      const followStats = await db
        .select({
          totalFollows: sql<number>`count(*)`,
        })
        .from(follows)
        .where(eq(follows.followerId, userId));
      
      additionalData = {
        stats: {
          totalFollows: followStats[0]?.totalFollows || 0,
        },
      };
    }
    
    return {
      ...user,
      ...additionalData,
    };
  }
  
  static async searchUsers(params: {
    query?: string;
    userType?: string;
    limit?: number;
    offset?: number;
  }) {
    const conditions = [];
    
    if (params.userType) {
      conditions.push(eq(users.userType, params.userType as any));
    }
    
    // Basic search - would need full-text search for production
    let query = db.query.users.findMany({
      where: conditions.length > 0 ? and(...conditions) : undefined,
      limit: params.limit || 20,
      offset: params.offset || 0,
      orderBy: [desc(users.createdAt)],
      columns: {
        passwordHash: false,
        emailVerificationToken: false,
      },
    });
    
    return await query;
  }
  
  static async getUserDashboardData(userId: number) {
    const user = await this.getUserProfile(userId);
    
    if (!user) {
      throw new Error("User not found");
    }
    
    const dashboardData: any = {
      user,
      recentActivity: [],
    };
    
    if (user.userType === "creator") {
      // Get recent pitches
      const recentPitches = await db
        .select()
        .from(pitches)
        .where(eq(pitches.userId, userId))
        .orderBy(desc(pitches.updatedAt))
        .limit(5);
      
      dashboardData.recentPitches = recentPitches;
    } else if (user.userType === "investor") {
      // Get followed pitches
      const followedPitches = await db
        .select({
          follow: follows,
          pitch: pitches,
          creator: {
            username: users.username,
            companyName: users.companyName,
          },
        })
        .from(follows)
        .leftJoin(pitches, eq(follows.pitchId, pitches.id))
        .leftJoin(users, eq(pitches.userId, users.id))
        .where(eq(follows.followerId, userId))
        .orderBy(desc(follows.followedAt))
        .limit(5);
      
      const formattedFollowedPitches = followedPitches.map(row => ({
        ...row.follow,
        pitch: {
          ...row.pitch,
          creator: row.creator,
        },
      }));
      
      dashboardData.followedPitches = formattedFollowedPitches;
    }
    
    return dashboardData;
  }
  
  static async followPitch(userId: number, pitchId: number) {
    const [follow] = await db.insert(follows)
      .values({
        followerId: userId,
        pitchId,
      })
      .onConflictDoNothing()
      .returning();
    
    return follow;
  }
  
  static async unfollowPitch(userId: number, pitchId: number) {
    await db.delete(follows)
      .where(and(
        eq(follows.followerId, userId),
        eq(follows.pitchId, pitchId)
      ));
  }
  
  static async getFollowedPitches(userId: number, limit = 20, offset = 0) {
    const results = await db
      .select({
        follow: follows,
        pitch: pitches,
        creator: {
          username: users.username,
          companyName: users.companyName,
          profileImageUrl: users.profileImageUrl,
        },
      })
      .from(follows)
      .leftJoin(pitches, eq(follows.pitchId, pitches.id))
      .leftJoin(users, eq(pitches.userId, users.id))
      .where(eq(follows.followerId, userId))
      .orderBy(desc(follows.followedAt))
      .limit(limit)
      .offset(offset);
    
    return results.map(row => ({
      ...row.follow,
      pitch: {
        ...row.pitch,
        creator: row.creator,
      },
    }));
  }
  
  static async deactivateAccount(userId: number) {
    const [deactivatedUser] = await db.update(users)
      .set({
        isActive: false,
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId))
      .returning({
        id: users.id,
        isActive: users.isActive,
      });
    
    // Optionally set pitches to hidden
    await db.update(pitches)
      .set({
        status: "hidden",
        updatedAt: new Date(),
      })
      .where(eq(pitches.userId, userId));
    
    return deactivatedUser;
  }
  
  static async reactivateAccount(userId: number) {
    const [reactivatedUser] = await db.update(users)
      .set({
        isActive: true,
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId))
      .returning({
        id: users.id,
        isActive: users.isActive,
      });
    
    return reactivatedUser;
  }

  static async getUserCreditsBalance(userId: number) {
    try {
      const result = await db.query(`
        SELECT balance, total_purchased, total_used, last_updated
        FROM user_credits
        WHERE user_id = $1
      `, [userId]);

      if (result && result[0]) {
        return {
          userId,
          balance: result[0].balance ?? 0,
          totalPurchased: result[0].total_purchased ?? 0,
          totalUsed: result[0].total_used ?? 0,
          createdAt: result[0].last_updated ?? new Date(),
          updatedAt: result[0].last_updated ?? new Date(),
        };
      }

      // User has no credits record yet
      return {
        userId,
        balance: 0,
        totalPurchased: 0,
        totalUsed: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
    } catch (err) {
      const e = err instanceof Error ? err : new Error(String(err));
      console.error('Failed to fetch credits balance:', e.message);
      return {
        userId,
        balance: 0,
        totalPurchased: 0,
        totalUsed: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
    }
  }

  static async createUser(data: any) {
    try {
      const result = await AuthService.register(data);
      return {
        success: true,
        user: result.user
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }
}