import { db } from "../db/client.ts";
import { NotificationService } from "./notification.service.ts";

// Production interface (until we have the table in schema)
export interface Production {
  id: number;
  pitchId: number;
  producerId: number;
  title: string;
  budget: number;
  spent: number;
  crewSize: number;
  status: "pre_production" | "production" | "post_production" | "completed" | "cancelled";
  progress: number;
  location?: string;
  startDate?: Date;
  targetEndDate?: Date;
  actualEndDate?: Date;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateProductionData {
  pitchId: number;
  producerId: number;
  title: string;
  budget: number;
  location?: string;
  startDate?: Date;
  targetEndDate?: Date;
  notes?: string;
}

export interface ProductionUpdate {
  title?: string;
  updateType: "milestone" | "budget" | "schedule" | "crew" | "general";
  description: string;
  metadata?: Record<string, any>;
}

export class ProductionService {
  // Create a new production project
  static async createProduction(data: CreateProductionData) {
    try {
      // Verify the pitch exists and is ready for production
      const pitchResult = await db.query(`
        SELECT 
          p.*,
          u.id as creator_id,
          u.username as creator_username,
          u.email as creator_email
        FROM pitches p
        LEFT JOIN users u ON p.user_id = u.id
        WHERE p.id = $1
        LIMIT 1
      `, [data.pitchId]);

      if (!pitchResult.length) {
        return { success: false, error: "Pitch not found" };
      }

      const pitchData = pitchResult[0];
      const pitch = {
        ...pitchData,
        creator: {
          id: pitchData.creator_id,
          username: pitchData.creator_username,
          email: pitchData.creator_email,
        },
      };

      // For now, simulate production creation
      const production: Production = {
        id: Date.now(),
        pitchId: data.pitchId,
        producerId: data.producerId,
        title: data.title,
        budget: data.budget,
        spent: 0,
        crewSize: 0,
        status: "pre_production",
        progress: 0,
        location: data.location,
        startDate: data.startDate,
        targetEndDate: data.targetEndDate,
        notes: data.notes,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // Notify the pitch creator
      if (pitch.creator) {
        await NotificationService.create({
          userId: pitch.creator.id,
          type: "pitch_update",
          title: "Your pitch is going into production!",
          message: `${data.title} has been greenlit for production with a budget of $${data.budget.toLocaleString()}`,
          metadata: { productionId: production.id, pitchId: data.pitchId },
          relatedId: data.pitchId,
        });
      }

      return {
        success: true,
        production,
      };
    } catch (error) {
      console.error("Error creating production:", error);
      return { success: false, error: error.message };
    }
  }

  // Get all productions for a producer
  static async getProducerProjects(producerId: number) {
    try {
      // For now, return empty array
      // In production, query the productions table
      return {
        success: true,
        projects: [],
        stats: {
          total: 0,
          inProduction: 0,
          completed: 0,
          totalBudget: 0,
          totalSpent: 0,
        },
      };
    } catch (error) {
      console.error("Error fetching producer projects:", error);
      return {
        success: false,
        error: error.message,
        projects: [],
      };
    }
  }

  // Update production progress
  static async updateProgress(productionId: number, progress: number, update?: ProductionUpdate) {
    try {
      if (progress < 0 || progress > 100) {
        return { success: false, error: "Progress must be between 0 and 100" };
      }

      // For now, just log the update
      console.log(`Production ${productionId} progress updated to ${progress}%`);

      // Send update notification if provided
      if (update) {
        // Would notify investors and creators about the update
        console.log("Production update:", update);
      }

      return {
        success: true,
        progress,
      };
    } catch (error) {
      console.error("Error updating production progress:", error);
      return { success: false, error: error.message };
    }
  }

  // Add crew member
  static async addCrewMember(productionId: number, memberData: {
    name: string;
    role: string;
    department: string;
    dailyRate?: number;
    startDate?: Date;
    endDate?: Date;
  }) {
    try {
      // For now, simulate adding crew
      const crewMember = {
        id: Date.now(),
        productionId,
        ...memberData,
        addedAt: new Date(),
      };

      console.log("Added crew member:", crewMember);

      return {
        success: true,
        crewMember,
      };
    } catch (error) {
      console.error("Error adding crew member:", error);
      return { success: false, error: error.message };
    }
  }

  // Update budget and spending
  static async updateBudget(productionId: number, spent: number, category?: string) {
    try {
      // For now, just track the spending
      console.log(`Production ${productionId}: $${spent} spent on ${category || "general"}`);

      return {
        success: true,
        spent,
      };
    } catch (error) {
      console.error("Error updating budget:", error);
      return { success: false, error: error.message };
    }
  }

  // Get production analytics
  static async getProductionAnalytics(productionId: number) {
    try {
      // Returns zero-state — production analytics requires integration with
      // production_projects/production_checklists tables via a DB connection
      const analytics = {
        dailyBurnRate: 0,
        projectedOverrun: 0,
        daysRemaining: 0,
        tasksCompleted: 0,
        totalTasks: 0,
        crewUtilization: 0,
        budgetUtilization: 0,
        timeline: {
          scheduled: 0,
          actual: 0,
          variance: 0,
        },
        departments: {
          camera: { budget: 0, spent: 0 },
          lighting: { budget: 0, spent: 0 },
          sound: { budget: 0, spent: 0 },
          art: { budget: 0, spent: 0 },
          post: { budget: 0, spent: 0 },
        },
      };

      return {
        success: true,
        analytics,
      };
    } catch (error) {
      console.error("Error fetching production analytics:", error);
      return {
        success: false,
        error: error.message,
        analytics: null,
      };
    }
  }

  // Complete production
  static async completeProduction(productionId: number, finalData: {
    actualEndDate: Date;
    finalBudget: number;
    notes?: string;
  }) {
    try {
      // Mark production as completed
      console.log(`Production ${productionId} completed`, finalData);

      // Notify all stakeholders
      // This would send notifications to investors, creators, etc.

      return {
        success: true,
        message: "Production completed successfully",
      };
    } catch (error) {
      console.error("Error completing production:", error);
      return { success: false, error: error.message };
    }
  }

  // Get production milestones
  static async getMilestones(productionId: number) {
    try {
      // For now, return default milestones
      const milestones = [
        {
          id: 1,
          name: "Pre-production",
          status: "completed",
          completedAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
          progress: 100,
        },
        {
          id: 2,
          name: "Principal Photography",
          status: "in_progress",
          progress: 45,
        },
        {
          id: 3,
          name: "Post-production",
          status: "pending",
          progress: 0,
        },
        {
          id: 4,
          name: "Distribution",
          status: "pending",
          progress: 0,
        },
      ];

      return {
        success: true,
        milestones,
      };
    } catch (error) {
      console.error("Error fetching milestones:", error);
      return {
        success: false,
        error: error.message,
        milestones: [],
      };
    }
  }

  // Generate production report
  static async generateProductionReport(productionId: number) {
    try {
      const report = {
        summary: {
          title: "Production Report",
          date: new Date(),
          status: "in_progress",
          progress: 45,
        },
        budget: {
          allocated: 0,
          spent: 0,
          remaining: 0,
          projectedFinal: 0,
        },
        schedule: {
          startDate: null,
          targetEnd: null,
          currentPhase: "production",
          daysElapsed: 0,
          daysRemaining: 0,
        },
        crew: {
          total: 0,
          departments: {},
          dailyCost: 0,
        },
        risks: [
          "Weather delays possible in next week",
          "Key talent availability conflict on Day 23",
        ],
        recommendations: [
          "Consider adding buffer days for weather contingency",
          "Review and optimize lighting setup time",
        ],
      };

      return {
        success: true,
        report,
      };
    } catch (error) {
      console.error("Error generating production report:", error);
      return {
        success: false,
        error: error.message,
        report: null,
      };
    }
  }

  // Get production dashboard stats
  static async getDashboardStats(userId: number) {
    try {
      const stats = {
        activeProductions: 0,
        completedProductions: 0,
        totalBudgetManaged: 0,
        averageProgress: 0,
        upcomingMilestones: [],
        recentUpdates: [],
      };

      return {
        success: true,
        stats,
      };
    } catch (error) {
      console.error("Error fetching dashboard stats:", error);
      return {
        success: false,
        error: error.message,
        stats: null,
      };
    }
  }
}