// Phase 2: Simple Messaging System Handler for Worker Integration
// Direct database queries — aligned with migration 019_messaging_system_tables.sql
// Schema: conversations (is_group, created_by_id, pitch_id), conversation_participants (conversation_id, user_id, is_active), messages (conversation_id, sender_id)

export class SimpleMessagingHandler {
  constructor(private db: any) {}

  // Check if two users share a signed NDA (either direction)
  private async hasSignedNDA(userId1: number, userId2: number): Promise<boolean> {
    try {
      const result = await this.db.query(
        `SELECT 1 FROM ndas n
         JOIN pitches p ON p.id = n.pitch_id
         WHERE n.signed_at IS NOT NULL AND n.revoked_at IS NULL
           AND (
             (COALESCE(n.signer_id, n.user_id) = $1 AND p.user_id = $2)
             OR
             (COALESCE(n.signer_id, n.user_id) = $2 AND p.user_id = $1)
           )
         LIMIT 1`,
        [userId1, userId2]
      );
      return result.length > 0;
    } catch {
      return false;
    }
  }

  // Eligibility to START a conversation: a follow relationship in either direction
  // OR a shared signed NDA. ("Everybody can message everybody through the following
  // system" + preserves the existing NDA → message flow.)
  async canStartConversation(userId: number, recipientId: number): Promise<boolean> {
    try {
      const follow = await this.db.query(
        `SELECT 1 FROM follows
         WHERE (follower_id = $1 AND following_id = $2)
            OR (follower_id = $2 AND following_id = $1)
         LIMIT 1`,
        [userId, recipientId]
      );
      if (follow.length > 0) return true;
    } catch { /* follows table may differ across envs — fall through to NDA */ }
    return this.hasSignedNDA(userId, recipientId);
  }

  // People this user is allowed to start a conversation with — the same eligibility
  // as canStartConversation (follow either direction OR shared NDA), but returned as
  // a deduped contact list with the *reason* attached so the UI can explain WHY each
  // person is messageable. Replaces the old NDA-only picker that made the follow path
  // invisible (Karl: "I don't get the messaging system"). Each branch is independently
  // try/caught so NDA-schema drift can't blank out the follow-based contacts.
  async getMessageableContacts(userId: number) {
    const nameExpr = `COALESCE(NULLIF(TRIM(COALESCE(u.first_name,'') || ' ' || COALESCE(u.last_name,'')), ''), u.username, u.email)`;
    type Contact = {
      id: number; name: string; type: string; companyName?: string;
      iFollow: boolean; followsMe: boolean; hasNda: boolean;
      pitchTitle?: string; signedAt?: string;
    };
    const contacts = new Map<number, Contact>();
    const ensure = (id: number, name: string, type: string, companyName?: string): Contact => {
      let c = contacts.get(id);
      if (!c) {
        c = { id, name, type, companyName, iFollow: false, followsMe: false, hasNda: false };
        contacts.set(id, c);
      }
      return c;
    };

    // Follows — both directions. `i_follow` distinguishes "I follow them" from
    // "they follow me" so the UI can label the relationship.
    try {
      const rows = await this.db.query(
        `SELECT u.id, ${nameExpr} AS name, u.user_type AS type, u.company_name AS company_name,
                (f.follower_id = $1) AS i_follow
         FROM follows f
         JOIN users u ON u.id = CASE WHEN f.follower_id = $1 THEN f.following_id ELSE f.follower_id END
         WHERE (f.follower_id = $1 OR f.following_id = $1) AND u.id <> $1
         LIMIT 300`,
        [userId]
      );
      for (const r of rows) {
        const c = ensure(Number(r.id), r.name || 'Unknown', r.type || 'user', r.company_name || undefined);
        if (r.i_follow) c.iFollow = true; else c.followsMe = true;
      }
    } catch (e) { console.error('getMessageableContacts.follows failed:', e instanceof Error ? e.message : String(e)); }

    // Shared signed NDAs — either direction (mirrors hasSignedNDA's COALESCE shape).
    try {
      const rows = await this.db.query(
        `SELECT u.id, ${nameExpr} AS name, u.user_type AS type, u.company_name AS company_name,
                p.title AS pitch_title, n.signed_at AS signed_at
         FROM ndas n
         JOIN pitches p ON p.id = n.pitch_id
         JOIN users u ON u.id = CASE WHEN COALESCE(n.signer_id, n.user_id) = $1 THEN p.user_id ELSE COALESCE(n.signer_id, n.user_id) END
         WHERE n.signed_at IS NOT NULL AND n.revoked_at IS NULL
           AND (COALESCE(n.signer_id, n.user_id) = $1 OR p.user_id = $1)
           AND u.id <> $1
         ORDER BY n.signed_at DESC
         LIMIT 300`,
        [userId]
      );
      for (const r of rows) {
        const c = ensure(Number(r.id), r.name || 'Unknown', r.type || 'user', r.company_name || undefined);
        c.hasNda = true;
        if (!c.pitchTitle && r.pitch_title) c.pitchTitle = r.pitch_title;
        if (!c.signedAt && r.signed_at) c.signedAt = r.signed_at;
      }
    } catch (e) { console.error('getMessageableContacts.nda failed:', e instanceof Error ? e.message : String(e)); }

    return { success: true, data: { contacts: Array.from(contacts.values()) } };
  }

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
      const { conversation_id, recipient_id, content, message_type = 'text', attachments } = data;

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
          // Eligibility to open a new conversation: follow (either direction) OR a
          // shared signed NDA — same rule as findOrCreateConversation/createConversation.
          // (Was NDA-only here, which contradicted the follow-based model and the other
          // two creation paths.)
          const allowed = await this.canStartConversation(userId, recipient_id);
          if (!allowed) {
            return { success: false, error: 'Follow this user (or sign their NDA) to start a conversation' };
          }

          // Create new direct conversation
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
      const hasAttachments = Array.isArray(attachments) && attachments.length > 0;
      const message = await this.db.query(
        `INSERT INTO messages (conversation_id, sender_id, content, message_type, attachments)
         VALUES ($1, $2, $3, $4, $5) RETURNING *`,
        [convId, userId, content, hasAttachments ? 'file' : message_type, hasAttachments ? JSON.stringify(attachments) : null]
      );

      // Update conversation timestamp
      if (convId) {
        // fire-and-forget
        await this.db.query(
          `UPDATE conversations SET updated_at = NOW() WHERE id = $1`,
          [convId]
        ).catch(() => {});
      }

      // Surface messaged attachments in the recipient's activity feed (Phase 4A).
      // PRIVATE event — recipient-scoped only, never fanned out to followers, since
      // message attachments are not NDA-gated. Non-blocking.
      if (hasAttachments && convId && message[0]) {
        // recordMessageAttachmentActivity wraps its whole body in try/catch and
        // logs on failure, returning void — no outer swallow needed here.
        await this.recordMessageAttachmentActivity(
          userId, convId, Number(message[0].id), attachments, recipient_id
        );
      }

      return { success: true, data: { message: message[0] } };
    } catch (error) {
      console.error('Send message error:', error);
      return { success: false, error: 'Failed to send message' };
    }
  }

  // Write a PRIVATE (recipient-scoped) activity_feed row per conversation recipient
  // when a message carries attachments. Visibility is limited to each recipient —
  // these never fan out to the actor's followers. Best-effort; never throws.
  private async recordMessageAttachmentActivity(
    senderId: number,
    convId: number,
    messageId: number,
    attachments: any[],
    directRecipientId?: number
  ): Promise<void> {
    try {
      // Resolve recipients: the other active participants in the conversation.
      let recipientIds: number[] = [];
      if (directRecipientId) {
        recipientIds = [Number(directRecipientId)];
      } else {
        const rows = await this.db.query(
          `SELECT user_id FROM conversation_participants
           WHERE conversation_id = $1 AND user_id <> $2`,
          [convId, senderId]
        );
        recipientIds = rows.map((r: any) => Number(r.user_id)).filter((n: number) => n && n !== senderId);
      }
      if (recipientIds.length === 0) return;

      // Pitch context for the feed card link (conversations may be tied to a pitch).
      let pitchId: number | null = null;
      try {
        const [conv] = await this.db.query(`SELECT pitch_id FROM conversations WHERE id = $1`, [convId]);
        pitchId = conv?.pitch_id ?? null;
      } catch { /* pitch_id optional */ }

      const list = Array.isArray(attachments) ? attachments : [];
      const first = list[0] || {};
      const metadata = {
        conversationId: convId,
        pitchId,
        attachmentCount: list.length,
        fileName: first.originalName || first.name || first.fileName || 'a file',
      };

      for (const recipientId of recipientIds) {
        await this.db.query(
          `INSERT INTO activity_feed (actor_id, action, object_type, object_id, recipient_id, metadata)
           VALUES ($1, 'message_attachment', 'message', $2, $3, $4::jsonb)`,
          [senderId, messageId, recipientId, JSON.stringify(metadata)]
        );
      }
    } catch (err) {
      // Best-effort — a missing recipient_id column (pre-migration 095) lands here.
      console.error('recordMessageAttachmentActivity failed:', err instanceof Error ? err.message : String(err));
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

  // Edit message (only sender can edit, within 15 minutes)
  async editMessage(userId: number, messageId: number, newContent: string) {
    try {
      if (!newContent || !newContent.trim()) {
        return { success: false, error: 'Message content cannot be empty' };
      }

      const result = await this.db.query(
        `UPDATE messages SET content = $3, is_edited = TRUE, edited_at = NOW()
         WHERE id = $1 AND sender_id = $2 AND is_deleted = FALSE
           AND created_at > NOW() - INTERVAL '15 minutes'
         RETURNING *`,
        [messageId, userId, newContent.trim()]
      );

      if (result.length === 0) {
        return { success: false, error: 'Message not found, not yours, or edit window expired (15 min)' };
      }

      return { success: true, data: { message: result[0] } };
    } catch (error) {
      console.error('Edit message error:', error);
      return { success: false, error: 'Failed to edit message' };
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
        // Must follow the person (either direction) or share a signed NDA.
        const allowed = await this.canStartConversation(userId, recipientId);
        if (!allowed) {
          return { success: false, error: 'Follow this user (or sign their NDA) to start a conversation' };
        }

        // Create new direct conversation
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
         ORDER BY COALESCE(c.updated_at, c.created_at) DESC`,
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
