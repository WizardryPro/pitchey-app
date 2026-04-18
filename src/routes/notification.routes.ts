/**
 * Notification API Routes
 * Handles all notification-related endpoints
 */

import { Hono } from "hono";
import { notificationService } from "../services/notification.service";
import { authMiddleware } from "../middleware/auth";
import { z } from "zod";
import { validator } from "hono/validator";

const notificationRoutes = new Hono();

// Apply auth middleware to all routes
notificationRoutes.use("*", authMiddleware);

// Get notifications for current user
notificationRoutes.get("/", async (c) => {
  try {
    const userId = c.get("userId");
    const { limit, offset, unreadOnly, type } = c.req.query();
    
    const notifications = await notificationService.getUserNotifications(userId, {
      limit: limit ? parseInt(limit) : 20,
      offset: offset ? parseInt(offset) : 0,
      unreadOnly: unreadOnly === "true",
      type
    });
    
    return c.json({
      success: true,
      data: notifications
    });
  } catch (error) {
    console.error("Error fetching notifications:", error);
    return c.json({ success: false, error: "Failed to fetch notifications" }, 500);
  }
});

// Get unread notification count
notificationRoutes.get("/unread/count", async (c) => {
  try {
    const userId = c.get("userId");
    const count = await notificationService.getUnreadCount(userId);
    
    return c.json({
      success: true,
      count
    });
  } catch (error) {
    console.error("Error getting unread count:", error);
    return c.json({ success: false, error: "Failed to get unread count" }, 500);
  }
});

// Get notification preferences
notificationRoutes.get("/preferences", async (c) => {
  try {
    const userId = c.get("userId");
    const preferences = await notificationService.getUserPreferences(userId);
    
    return c.json({
      success: true,
      data: preferences
    });
  } catch (error) {
    console.error("Error fetching preferences:", error);
    return c.json({ success: false, error: "Failed to fetch preferences" }, 500);
  }
});

// Update notification preferences
const preferencesSchema = z.object({
  emailEnabled: z.boolean().optional(),
  pushEnabled: z.boolean().optional(),
  smsEnabled: z.boolean().optional(),
  inAppEnabled: z.boolean().optional(),
  typePreferences: z.record(z.string(), z.boolean()).optional(),
  quietHoursEnabled: z.boolean().optional(),
  quietHoursStart: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/).optional(),
  quietHoursEnd: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/).optional(),
  timezone: z.string().optional(),
  emailDigest: z.enum(["immediate", "daily", "weekly", "never"]).optional(),
  maxDailyEmails: z.number().min(0).max(100).optional()
});

notificationRoutes.put(
  "/preferences",
  validator("json", preferencesSchema),
  async (c) => {
    try {
      const userId = c.get("userId");
      const preferences = c.req.valid("json");
      
      await notificationService.updateUserPreferences(userId, preferences);
      
      return c.json({
        success: true,
        message: "Preferences updated successfully"
      });
    } catch (error) {
      console.error("Error updating preferences:", error);
      return c.json({ success: false, error: "Failed to update preferences" }, 500);
    }
  }
);

// Mark notifications as read
const markReadSchema = z.object({
  notificationIds: z.array(z.number()).optional()
});

notificationRoutes.post(
  "/read",
  validator("json", markReadSchema),
  async (c) => {
    try {
      const userId = c.get("userId");
      const { notificationIds } = c.req.valid("json");
      
      await notificationService.markAsRead(userId, notificationIds);
      
      return c.json({
        success: true,
        message: "Notifications marked as read"
      });
    } catch (error) {
      console.error("Error marking as read:", error);
      return c.json({ success: false, error: "Failed to mark as read" }, 500);
    }
  }
);

// Mark all notifications as read
notificationRoutes.post("/read/all", async (c) => {
  try {
    const userId = c.get("userId");
    await notificationService.markAsRead(userId);
    
    return c.json({
      success: true,
      message: "All notifications marked as read"
    });
  } catch (error) {
    console.error("Error marking all as read:", error);
    return c.json({ success: false, error: "Failed to mark all as read" }, 500);
  }
});

// Delete notifications
const deleteSchema = z.object({
  notificationIds: z.array(z.number()).min(1)
});

notificationRoutes.delete(
  "/",
  validator("json", deleteSchema),
  async (c) => {
    try {
      const userId = c.get("userId");
      const { notificationIds } = c.req.valid("json");
      
      await notificationService.deleteNotifications(userId, notificationIds);
      
      return c.json({
        success: true,
        message: "Notifications deleted"
      });
    } catch (error) {
      console.error("Error deleting notifications:", error);
      return c.json({ success: false, error: "Failed to delete notifications" }, 500);
    }
  }
);

// Test endpoint to create a notification (admin only - for testing)
const testNotificationSchema = z.object({
  type: z.string(),
  title: z.string().optional(),
  message: z.string().optional(),
  priority: z.enum(["low", "medium", "high", "urgent"]).optional(),
  metadata: z.record(z.string(), z.any()).optional()
});

notificationRoutes.post(
  "/test",
  validator("json", testNotificationSchema),
  async (c) => {
    try {
      const userId = c.get("userId");
      const data = c.req.valid("json");
      
      const notification = await notificationService.createNotification({
        userId,
        ...data
      });
      
      return c.json({
        success: true,
        data: notification
      });
    } catch (error) {
      console.error("Error creating test notification:", error);
      return c.json({ success: false, error: "Failed to create notification" }, 500);
    }
  }
);

export { notificationRoutes };