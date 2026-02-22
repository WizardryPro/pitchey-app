// Phase 2: Simple Messaging System Handler for Worker Integration
// Direct database queries without external dependencies

export class SimpleMessagingHandler {
  constructor(private db: any) {}

  // Get all messages for a user
  async getMessages(userId: number, limit: number = 50, offset: number = 0) {
    try {
      const messages = await this.db.query(
        `SELECT
          m.*,
          c.title as conversation_title,
          COALESCE(u.name, u.first_name || ' ' || u.last_name, u.email) as sender_name,
          u.avatar_url as sender_avatar
         FROM messages m
         JOIN conversations c ON c.id = m.conversation_id
         JOIN conversation_participants cp ON cp.conversation_id = c.id
         JOIN users u ON u.id = m.sender_id
         WHERE cp.user_id = $1 AND m.is_deleted = FALSE
         ORDER BY m.created_at DESC
         LIMIT $2 OFFSET $3`,
        [userId, limit, offset]
      );

      return { success: true, data: { messages } };
    } catch (error) {
      console.error('Get messages error:', error);
      // Return empty array as fallback
      return { success: true, data: { messages: [] } };
    }
  }

  // Get single message
  async getMessageById(userId: number, messageId: number) {
    try {
      const message = await this.db.query(
        `SELECT m.*, COALESCE(u.name, u.first_name || ' ' || u.last_name, u.email) as sender_name
         FROM messages m
         JOIN users u ON u.id = m.sender_id
         JOIN conversation_participants cp ON cp.conversation_id = m.conversation_id
         WHERE m.id = $1 AND cp.user_id = $2`,
        [messageId, userId]
      );

      if (message.length === 0) {
        return { success: false, error: 'Message not found' };
      }

      return { success: true, data: { message: message[0] } };
    } catch (error) {
      console.error('Get message error:', error);
      return { success: false, error: 'Failed to fetch message' };
    }
  }

  // Send a message
  async sendMessage(userId: number, data: any) {
    try {
      const { conversation_id, recipient_id, content, message_type = 'text' } = data;

      let convId = conversation_id;

      // If no conversation_id, create or find direct conversation
      if (!convId && recipient_id) {
        const existing = await this.db.query(
          `SELECT c.id FROM conversations c
           JOIN conversation_participants cp1 ON cp1.conversation_id = c.id AND cp1.user_id = $1
           JOIN conversation_participants cp2 ON cp2.conversation_id = c.id AND cp2.user_id = $2
           WHERE c.is_group = FALSE LIMIT 1`,
          [userId, recipient_id]
        );

        if (existing.length > 0) {
          convId = existing[0].id;
        } else {
          // Create new conversation
          const newConv = await this.db.query(
            `INSERT INTO conversations (is_group, created_by_id) VALUES (FALSE, $1) RETURNING id`,
            [userId]
          );
          convId = newConv[0].id;

          // Add participants
          await this.db.query(
            `INSERT INTO conversation_participants (conversation_id, user_id)
             VALUES ($1, $2), ($1, $3)`,
            [convId, userId, recipient_id]
          );
        }
      }

      // Insert message
      const message = await this.db.query(
        `INSERT INTO messages (conversation_id, sender_id, content, message_type)
         VALUES ($1, $2, $3, $4) RETURNING *`,
        [convId, userId, content, message_type]
      );

      return { success: true, data: { message: message[0] } };
    } catch (error) {
      console.error('Send message error:', error);
      return { success: false, error: 'Failed to send message' };
    }
  }

  // Mark as read
  async markMessageAsRead(userId: number, messageId: number) {
    try {
      await this.db.query(
        `INSERT INTO message_read_receipts (message_id, user_id)
         VALUES ($1, $2) ON CONFLICT DO NOTHING`,
        [messageId, userId]
      );

      return { success: true };
    } catch (error) {
      console.error('Mark as read error:', error);
      return { success: true }; // Don't fail on read receipts
    }
  }

  // Delete message
  async deleteMessage(userId: number, messageId: number) {
    try {
      await this.db.query(
        `UPDATE messages SET is_deleted = TRUE, deleted_at = NOW()
         WHERE id = $1 AND sender_id = $2`,
        [messageId, userId]
      );

      return { success: true };
    } catch (error) {
      console.error('Delete message error:', error);
      return { success: false, error: 'Failed to delete message' };
    }
  }

  // Find or create a direct conversation (without requiring a message)
  async findOrCreateConversation(userId: number, recipientId: number, pitchId?: number) {
    try {
      if (!recipientId || recipientId === userId) {
        return { success: false, error: 'Invalid recipient' };
      }

      // Check for existing direct conversation between these two users
      const existing = await this.db.query(
        `SELECT c.id FROM conversations c
         JOIN conversation_participants cp1 ON cp1.conversation_id = c.id AND cp1.user_id = $1
         JOIN conversation_participants cp2 ON cp2.conversation_id = c.id AND cp2.user_id = $2
         WHERE c.is_group = FALSE LIMIT 1`,
        [userId, recipientId]
      );

      let conversationId: number;

      if (existing.length > 0) {
        conversationId = existing[0].id;
      } else {
        // Create new conversation
        const newConv = await this.db.query(
          `INSERT INTO conversations (is_group, created_by_id, pitch_id) VALUES (FALSE, $1, $2) RETURNING id`,
          [userId, pitchId || null]
        );
        conversationId = newConv[0].id;

        // Add participants
        await this.db.query(
          `INSERT INTO conversation_participants (conversation_id, user_id)
           VALUES ($1, $2), ($1, $3)`,
          [conversationId, userId, recipientId]
        );
      }

      return { success: true, data: { conversation: { id: conversationId } } };
    } catch (error) {
      console.error('Find or create conversation error:', error);
      return { success: false, error: 'Failed to find or create conversation' };
    }
  }

  // Get conversations for a user
  async getConversations(userId: number) {
    try {
      const conversations = await this.db.query(
        `SELECT c.*,
          (SELECT content FROM messages WHERE conversation_id = c.id
           ORDER BY created_at DESC LIMIT 1) as last_message,
          (SELECT created_at FROM messages WHERE conversation_id = c.id
           ORDER BY created_at DESC LIMIT 1) as last_message_time,
          (SELECT COUNT(*) FROM conversation_participants WHERE conversation_id = c.id) as participant_count,
          -- Get the other participant's name for direct conversations
          (SELECT COALESCE(u2.name, u2.first_name || ' ' || u2.last_name, u2.email)
           FROM conversation_participants cp2
           JOIN users u2 ON u2.id = cp2.user_id
           WHERE cp2.conversation_id = c.id AND cp2.user_id != $1
           LIMIT 1) as participant_name,
          (SELECT u2.user_type
           FROM conversation_participants cp2
           JOIN users u2 ON u2.id = cp2.user_id
           WHERE cp2.conversation_id = c.id AND cp2.user_id != $1
           LIMIT 1) as participant_type
         FROM conversations c
         JOIN conversation_participants cp ON cp.conversation_id = c.id
         WHERE cp.user_id = $1
         ORDER BY COALESCE(c.last_message_at, c.updated_at, c.created_at) DESC`,
        [userId]
      );

      return { success: true, data: { conversations } };
    } catch (error) {
      console.error('Get conversations error:', error);
      return { success: true, data: { conversations: [] } };
    }
  }

  // Get conversation by ID
  async getConversationById(userId: number, conversationId: number) {
    try {
      // Get conversation
      const conversation = await this.db.query(
        `SELECT c.* FROM conversations c
         JOIN conversation_participants cp ON cp.conversation_id = c.id
         WHERE c.id = $1 AND cp.user_id = $2`,
        [conversationId, userId]
      );

      if (conversation.length === 0) {
        return { success: false, error: 'Conversation not found' };
      }

      // Get messages
      const messages = await this.db.query(
        `SELECT m.*,
           COALESCE(u.name, u.first_name || ' ' || u.last_name, u.email) as sender_name,
           u.avatar_url as sender_avatar
         FROM messages m
         JOIN users u ON u.id = m.sender_id
         WHERE m.conversation_id = $1 AND m.is_deleted = FALSE
         ORDER BY m.created_at ASC LIMIT 50`,
        [conversationId]
      );

      return {
        success: true,
        data: {
          conversation: conversation[0],
          messages
        }
      };
    } catch (error) {
      console.error('Get conversation error:', error);
      return { success: false, error: 'Failed to fetch conversation' };
    }
  }

  // Send message to conversation
  async sendMessageToConversation(userId: number, conversationId: number, data: any) {
    return this.sendMessage(userId, {
      ...data,
      conversation_id: conversationId
    });
  }
}
