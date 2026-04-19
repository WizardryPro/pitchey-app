import { Context } from "https://deno.land/x/hono@v3.12.0/mod.ts";
import { MessagingService } from "../services/messaging.service.ts";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

/**
 * Messaging Handlers
 * Handles conversations, messages, reactions, and real-time communication
 */

// Validation schemas
const CreateConversationSchema = z.object({
  participantIds: z.array(z.string().uuid()),
  type: z.enum(['direct', 'group', 'pitch_discussion', 'investment_chat']).default('direct'),
  name: z.string().optional(),
  metadata: z.record(z.string(), z.any()).optional(),
});

const SendMessageSchema = z.object({
  content: z.string().min(1).max(10000),
  type: z.enum(['text', 'file', 'image', 'video', 'pitch_link', 'contract_link']).default('text'),
  attachments: z.array(z.object({
    type: z.enum(['file', 'image', 'video', 'document']),
    name: z.string(),
    url: z.string().url(),
    size: z.number(),
    mimeType: z.string(),
    thumbnailUrl: z.string().url().optional(),
  })).optional(),
  replyTo: z.string().uuid().optional(),
  metadata: z.record(z.string(), z.any()).optional(),
});

const EditMessageSchema = z.object({
  content: z.string().min(1).max(10000),
});

const ReactionSchema = z.object({
  emoji: z.string().emoji(),
});

const TypingIndicatorSchema = z.object({
  isTyping: z.boolean(),
});

const NotificationPreferencesSchema = z.object({
  email: z.boolean().optional(),
  push: z.boolean().optional(),
  inApp: z.boolean().optional(),
  messageSound: z.boolean().optional(),
  mentionAlert: z.boolean().optional(),
  digestFrequency: z.enum(['instant', 'hourly', 'daily', 'weekly', 'never']).optional(),
});

export class MessagingHandlers {
  private messagingService: MessagingService;

  constructor(databaseUrl: string) {
    this.messagingService = new MessagingService(databaseUrl);
  }

  async initialize() {
    await this.messagingService.connect();
  }

  async cleanup() {
    await this.messagingService.disconnect();
  }

  /**
   * POST /api/conversations
   * Create a new conversation
   */
  async createConversation(c: Context) {
    try {
      const userId = c.get('userId');
      const body = await c.req.json();
      const validated = CreateConversationSchema.parse(body);

      const conversation = await this.messagingService.createConversation(
        userId,
        validated.participantIds,
        validated.type,
        { ...validated.metadata, name: validated.name }
      );

      return c.json({
        success: true,
        conversation,
      });
    } catch (error) {
      console.error("Error creating conversation:", error);
      return c.json({ error: error.message || "Failed to create conversation" }, 500);
    }
  }

  /**
   * GET /api/conversations
   * Get user's conversations
   */
  async getConversations(c: Context) {
    try {
      const userId = c.get('userId');
      const { type, page = '1', limit = '20' } = c.req.query();

      const conversations = await this.messagingService.getUserConversations(
        userId,
        type as any
      );

      // Paginate results
      const pageNum = parseInt(page);
      const limitNum = parseInt(limit);
      const start = (pageNum - 1) * limitNum;
      const paginatedConversations = conversations.slice(start, start + limitNum);

      return c.json({
        conversations: paginatedConversations,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total: conversations.length,
          pages: Math.ceil(conversations.length / limitNum),
        },
      });
    } catch (error) {
      console.error("Error getting conversations:", error);
      return c.json({ error: "Failed to get conversations" }, 500);
    }
  }

  /**
   * GET /api/conversations/:id
   * Get conversation details
   */
  async getConversation(c: Context) {
    try {
      const userId = c.get('userId');
      const conversationId = c.req.param('id');

      // Get conversation from database
      const conversation = await c.env.DB.prepare(`
        SELECT c.*, cp.unread_count, cp.last_read_at
        FROM conversations c
        JOIN conversation_participants cp ON c.id = cp.conversation_id
        WHERE c.id = ? AND cp.user_id = ?
      `).bind(conversationId, userId).first();

      if (!conversation) {
        return c.json({ error: "Conversation not found" }, 404);
      }

      // Get participants
      const participants = await c.env.DB.prepare(`
        SELECT 
          cp.*,
          u.name,
          u.email,
          u.avatar_url,
          u.user_type
        FROM conversation_participants cp
        JOIN users u ON cp.user_id = u.id
        WHERE cp.conversation_id = ?
      `).bind(conversationId).all();

      // Get last few messages
      const recentMessages = await this.messagingService.getMessages(
        conversationId,
        userId,
        20
      );

      return c.json({
        conversation: {
          ...conversation,
          participants: participants.results || [],
          recentMessages,
        },
      });
    } catch (error) {
      console.error("Error getting conversation:", error);
      return c.json({ error: "Failed to get conversation" }, 500);
    }
  }

  /**
   * GET /api/conversations/:id/messages
   * Get conversation messages with pagination
   */
  async getMessages(c: Context) {
    try {
      const userId = c.get('userId');
      const conversationId = c.req.param('id');
      const { limit = '50', before } = c.req.query();

      const messages = await this.messagingService.getMessages(
        conversationId,
        userId,
        parseInt(limit),
        before
      );

      return c.json({
        messages,
        hasMore: messages.length === parseInt(limit),
      });
    } catch (error) {
      console.error("Error getting messages:", error);
      return c.json({ error: error.message || "Failed to get messages" }, 500);
    }
  }

  /**
   * POST /api/conversations/:id/messages
   * Send a message
   */
  async sendMessage(c: Context) {
    try {
      const userId = c.get('userId');
      const conversationId = c.req.param('id');
      const body = await c.req.json();
      const validated = SendMessageSchema.parse(body);

      const message = await this.messagingService.sendMessage(
        conversationId,
        userId,
        validated.content,
        validated.type,
        validated.metadata,
        validated.attachments
      );

      return c.json({
        success: true,
        message,
      });
    } catch (error) {
      console.error("Error sending message:", error);
      return c.json({ error: "Failed to send message" }, 500);
    }
  }

  /**
   * PUT /api/messages/:id
   * Edit a message
   */
  async editMessage(c: Context) {
    try {
      const userId = c.get('userId');
      const messageId = c.req.param('id');
      const body = await c.req.json();
      const validated = EditMessageSchema.parse(body);

      await this.messagingService.editMessage(
        messageId,
        userId,
        validated.content
      );

      return c.json({
        success: true,
        message: "Message edited",
      });
    } catch (error) {
      console.error("Error editing message:", error);
      return c.json({ error: error.message || "Failed to edit message" }, 500);
    }
  }

  /**
   * DELETE /api/messages/:id
   * Delete a message
   */
  async deleteMessage(c: Context) {
    try {
      const userId = c.get('userId');
      const messageId = c.req.param('id');

      await this.messagingService.deleteMessage(messageId, userId);

      return c.json({
        success: true,
        message: "Message deleted",
      });
    } catch (error) {
      console.error("Error deleting message:", error);
      return c.json({ error: error.message || "Failed to delete message" }, 500);
    }
  }

  /**
   * POST /api/messages/:id/reactions
   * Add reaction to message
   */
  async addReaction(c: Context) {
    try {
      const userId = c.get('userId');
      const messageId = c.req.param('id');
      const body = await c.req.json();
      const validated = ReactionSchema.parse(body);

      await this.messagingService.addReaction(
        messageId,
        userId,
        validated.emoji
      );

      return c.json({
        success: true,
        message: "Reaction added",
      });
    } catch (error) {
      console.error("Error adding reaction:", error);
      return c.json({ error: "Failed to add reaction" }, 500);
    }
  }

  /**
   * DELETE /api/messages/:id/reactions/:emoji
   * Remove reaction from message
   */
  async removeReaction(c: Context) {
    try {
      const userId = c.get('userId');
      const messageId = c.req.param('id');
      const emoji = c.req.param('emoji');

      await c.env.DB.prepare(`
        DELETE FROM message_reactions
        WHERE message_id = ? AND user_id = ? AND emoji = ?
      `).bind(messageId, userId, emoji).run();

      return c.json({
        success: true,
        message: "Reaction removed",
      });
    } catch (error) {
      console.error("Error removing reaction:", error);
      return c.json({ error: "Failed to remove reaction" }, 500);
    }
  }

  /**
   * POST /api/conversations/:id/read
   * Mark messages as read
   */
  async markAsRead(c: Context) {
    try {
      const userId = c.get('userId');
      const conversationId = c.req.param('id');
      const { messageIds } = await c.req.json();

      await this.messagingService.markAsRead(
        conversationId,
        userId,
        messageIds
      );

      return c.json({
        success: true,
        message: "Messages marked as read",
      });
    } catch (error) {
      console.error("Error marking as read:", error);
      return c.json({ error: "Failed to mark as read" }, 500);
    }
  }

  /**
   * POST /api/conversations/:id/typing
   * Set typing indicator
   */
  async setTypingIndicator(c: Context) {
    try {
      const userId = c.get('userId');
      const conversationId = c.req.param('id');
      const body = await c.req.json();
      const validated = TypingIndicatorSchema.parse(body);

      await this.messagingService.setTypingIndicator(
        conversationId,
        userId,
        validated.isTyping
      );

      return c.json({
        success: true,
      });
    } catch (error) {
      console.error("Error setting typing indicator:", error);
      return c.json({ error: "Failed to set typing indicator" }, 500);
    }
  }

  /**
   * POST /api/conversations/:id/archive
   * Archive a conversation
   */
  async archiveConversation(c: Context) {
    try {
      const userId = c.get('userId');
      const conversationId = c.req.param('id');

      await this.messagingService.archiveConversation(conversationId, userId);

      return c.json({
        success: true,
        message: "Conversation archived",
      });
    } catch (error) {
      console.error("Error archiving conversation:", error);
      return c.json({ error: "Failed to archive conversation" }, 500);
    }
  }

  /**
   * POST /api/conversations/:id/mute
   * Mute conversation notifications
   */
  async muteConversation(c: Context) {
    try {
      const userId = c.get('userId');
      const conversationId = c.req.param('id');
      const { duration } = await c.req.json();

      await this.messagingService.muteConversation(
        conversationId,
        userId,
        duration
      );

      return c.json({
        success: true,
        message: duration ? `Muted for ${duration} minutes` : "Muted indefinitely",
      });
    } catch (error) {
      console.error("Error muting conversation:", error);
      return c.json({ error: "Failed to mute conversation" }, 500);
    }
  }

  /**
   * POST /api/conversations/:id/unmute
   * Unmute conversation notifications
   */
  async unmuteConversation(c: Context) {
    try {
      const userId = c.get('userId');
      const conversationId = c.req.param('id');

      await c.env.DB.prepare(`
        UPDATE conversation_participants
        SET is_muted = 0,
            muted_until = NULL
        WHERE conversation_id = ? AND user_id = ?
      `).bind(conversationId, userId).run();

      return c.json({
        success: true,
        message: "Conversation unmuted",
      });
    } catch (error) {
      console.error("Error unmuting conversation:", error);
      return c.json({ error: "Failed to unmute conversation" }, 500);
    }
  }

  /**
   * GET /api/messages/unread-count
   * Get total unread message count
   */
  async getUnreadCount(c: Context) {
    try {
      const userId = c.get('userId');

      const result = await c.env.DB.prepare(`
        SELECT SUM(unread_count) as total_unread
        FROM conversation_participants
        WHERE user_id = ? AND is_archived = 0
      `).bind(userId).first();

      return c.json({
        unreadCount: result?.total_unread || 0,
      });
    } catch (error) {
      console.error("Error getting unread count:", error);
      return c.json({ error: "Failed to get unread count" }, 500);
    }
  }

  /**
   * GET /api/conversations/:id/participants
   * Get conversation participants with online status
   */
  async getParticipants(c: Context) {
    try {
      const conversationId = c.req.param('id');

      const participants = await c.env.DB.prepare(`
        SELECT 
          cp.*,
          u.name,
          u.email,
          u.avatar_url,
          u.user_type,
          u.last_seen_at,
          CASE 
            WHEN u.last_seen_at > datetime('now', '-5 minutes') THEN 'online'
            WHEN u.last_seen_at > datetime('now', '-30 minutes') THEN 'away'
            ELSE 'offline'
          END as status
        FROM conversation_participants cp
        JOIN users u ON cp.user_id = u.id
        WHERE cp.conversation_id = ?
      `).bind(conversationId).all();

      return c.json({
        participants: participants.results || [],
      });
    } catch (error) {
      console.error("Error getting participants:", error);
      return c.json({ error: "Failed to get participants" }, 500);
    }
  }

  /**
   * POST /api/conversations/:id/add-participants
   * Add participants to group conversation
   */
  async addParticipants(c: Context) {
    try {
      const userId = c.get('userId');
      const conversationId = c.req.param('id');
      const { participantIds } = await c.req.json();

      // Verify user is moderator
      const isModerator = await c.env.DB.prepare(`
        SELECT 1 FROM conversation_participants
        WHERE conversation_id = ? 
          AND user_id = ?
          AND role = 'moderator'
      `).bind(conversationId, userId).first();

      if (!isModerator) {
        return c.json({ error: "Only moderators can add participants" }, 403);
      }

      // Add new participants
      for (const participantId of participantIds) {
        await c.env.DB.prepare(`
          INSERT OR IGNORE INTO conversation_participants (
            id, conversation_id, user_id, role, joined_at
          )
          VALUES (?, ?, ?, 'member', datetime('now'))
        `).bind(
          crypto.randomUUID(),
          conversationId,
          participantId
        ).run();

        // Send system message
        const user = await c.env.DB.prepare(`
          SELECT name FROM users WHERE id = ?
        `).bind(participantId).first();

        await this.messagingService.sendMessage(
          conversationId,
          'system',
          `${user?.name || 'User'} was added to the conversation`,
          'system',
          { action: 'participant_added', user_id: participantId }
        );
      }

      return c.json({
        success: true,
        message: `${participantIds.length} participants added`,
      });
    } catch (error) {
      console.error("Error adding participants:", error);
      return c.json({ error: "Failed to add participants" }, 500);
    }
  }

  /**
   * POST /api/conversations/:id/remove-participant
   * Remove participant from group conversation
   */
  async removeParticipant(c: Context) {
    try {
      const userId = c.get('userId');
      const conversationId = c.req.param('id');
      const { participantId } = await c.req.json();

      // Verify user is moderator or removing themselves
      const isModerator = await c.env.DB.prepare(`
        SELECT role FROM conversation_participants
        WHERE conversation_id = ? AND user_id = ?
      `).bind(conversationId, userId).first();

      if (isModerator?.role !== 'moderator' && userId !== participantId) {
        return c.json({ error: "Unauthorized" }, 403);
      }

      // Remove participant
      await c.env.DB.prepare(`
        DELETE FROM conversation_participants
        WHERE conversation_id = ? AND user_id = ?
      `).bind(conversationId, participantId).run();

      // Send system message
      const user = await c.env.DB.prepare(`
        SELECT name FROM users WHERE id = ?
      `).bind(participantId).first();

      await this.messagingService.sendMessage(
        conversationId,
        'system',
        `${user?.name || 'User'} left the conversation`,
        'system',
        { action: 'participant_removed', user_id: participantId }
      );

      return c.json({
        success: true,
        message: "Participant removed",
      });
    } catch (error) {
      console.error("Error removing participant:", error);
      return c.json({ error: "Failed to remove participant" }, 500);
    }
  }

  /**
   * GET /api/messages/notification-preferences
   * Get user's notification preferences
   */
  async getNotificationPreferences(c: Context) {
    try {
      const userId = c.get('userId');

      const preferences = await c.env.DB.prepare(`
        SELECT * FROM notification_preferences
        WHERE user_id = ?
      `).bind(userId).first();

      return c.json({
        preferences: preferences || {
          email: true,
          push: true,
          inApp: true,
          messageSound: true,
          mentionAlert: true,
          digestFrequency: 'instant',
        },
      });
    } catch (error) {
      console.error("Error getting notification preferences:", error);
      return c.json({ error: "Failed to get preferences" }, 500);
    }
  }

  /**
   * PUT /api/messages/notification-preferences
   * Update notification preferences
   */
  async updateNotificationPreferences(c: Context) {
    try {
      const userId = c.get('userId');
      const body = await c.req.json();
      const validated = NotificationPreferencesSchema.parse(body);

      await c.env.DB.prepare(`
        INSERT INTO notification_preferences (
          user_id, email, push, in_app, message_sound, 
          mention_alert, digest_frequency, updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
        ON CONFLICT(user_id) DO UPDATE SET
          email = COALESCE(?, email),
          push = COALESCE(?, push),
          in_app = COALESCE(?, in_app),
          message_sound = COALESCE(?, message_sound),
          mention_alert = COALESCE(?, mention_alert),
          digest_frequency = COALESCE(?, digest_frequency),
          updated_at = datetime('now')
      `).bind(
        userId,
        validated.email,
        validated.push,
        validated.inApp,
        validated.messageSound,
        validated.mentionAlert,
        validated.digestFrequency,
        validated.email,
        validated.push,
        validated.inApp,
        validated.messageSound,
        validated.mentionAlert,
        validated.digestFrequency
      ).run();

      return c.json({
        success: true,
        message: "Preferences updated",
      });
    } catch (error) {
      console.error("Error updating preferences:", error);
      return c.json({ error: "Failed to update preferences" }, 500);
    }
  }
}