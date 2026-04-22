/**
 * Messaging-related database queries using raw SQL
 * Replaces Drizzle ORM with parameterized Neon queries
 */

import type { SqlQuery } from './base';
import { WhereBuilder, extractFirst, extractMany, DatabaseError, withTransaction } from './base';

// Type definitions
export interface Conversation {
  id: string;
  title?: string;
  is_group: boolean;
  created_by_id: string;
  last_message_at?: Date;
  last_message_preview?: string;
  participant_count: number;
  unread_count?: number;
  metadata?: Record<string, any>;
  created_at: Date;
  updated_at: Date;
}

export interface Message {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string;
  message_type: 'text' | 'image' | 'file' | 'system';
  is_edited: boolean;
  edited_at?: Date;
  is_deleted: boolean;
  deleted_at?: Date;
  reply_to_id?: string;
  metadata?: Record<string, any>;
  sent_at: Date;
}

export interface ConversationParticipant {
  conversation_id: string;
  user_id: string;
  role: 'admin' | 'member';
  joined_at: Date;
  last_read_at?: Date;
  is_muted: boolean;
  muted_until?: Date;
  left_at?: Date;
}

export interface MessageAttachment {
  id: string;
  message_id: string;
  filename: string;
  file_url: string;
  file_size: number;
  mime_type: string;
  thumbnail_url?: string;
  created_at: Date;
}

export interface MessageReaction {
  message_id: string;
  user_id: string;
  emoji: string;
  created_at: Date;
}

export interface MessageReadReceipt {
  message_id: string;
  user_id: string;
  read_at: Date;
}

// Conversation management
export async function createConversation(
  sql: SqlQuery,
  creatorId: string,
  participantIds: string[],
  title?: string,
  isGroup: boolean = false
): Promise<Conversation> {
  return await withTransaction(sql, async (txSql) => {
    // Create conversation
    const result = await txSql`
      INSERT INTO conversations (
        title, is_group, created_by_id, 
        participant_count, created_at, updated_at
      ) VALUES (
        ${title || null}, ${isGroup}, ${creatorId},
        ${participantIds.length}, NOW(), NOW()
      )
      RETURNING *
    `;
    
    const conversation = extractFirst<Conversation>(result);
    if (!conversation) {
      throw new DatabaseError('Failed to create conversation');
    }

    // Add participants
    const participantValues = participantIds.map((userId, i) => {
      const base = i * 4;
      return `($${base + 1}, $${base + 2}, $${base + 3}, NOW())`;
    }).join(', ');

    const participantParams = participantIds.flatMap(userId => [
      conversation.id,
      userId,
      userId === creatorId ? 'admin' : 'member'
    ]);

    await txSql.query(
      `INSERT INTO conversation_participants (
        conversation_id, user_id, role, joined_at
      ) VALUES ${participantValues}`,
      participantParams
    );

    return conversation;
  });
}

export async function getConversation(
  sql: SqlQuery,
  conversationId: string,
  userId: string
): Promise<Conversation | null> {
  const result = await sql`
    SELECT 
      c.*,
      cp.last_read_at,
      (
        SELECT COUNT(*)::int 
        FROM messages m 
        WHERE m.conversation_id = c.id 
          AND m.sent_at > COALESCE(cp.last_read_at, '1970-01-01'::timestamp)
          AND m.sender_id != ${userId}
      ) as unread_count
    FROM conversations c
    JOIN conversation_participants cp ON cp.conversation_id = c.id
    WHERE c.id = ${conversationId} 
      AND cp.user_id = ${userId}
      AND cp.left_at IS NULL
  `;
  return extractFirst<Conversation>(result);
}

export async function getUserConversations(
  sql: SqlQuery,
  userId: string,
  limit: number = 20,
  offset: number = 0
): Promise<Conversation[]> {
  const result = await sql`
    SELECT 
      c.*,
      cp.last_read_at,
      cp.is_muted,
      (
        SELECT COUNT(*)::int 
        FROM messages m 
        WHERE m.conversation_id = c.id 
          AND m.sent_at > COALESCE(cp.last_read_at, '1970-01-01'::timestamp)
          AND m.sender_id != ${userId}
      ) as unread_count,
      (
        SELECT jsonb_agg(
          jsonb_build_object(
            'user_id', u.id,
            'username', u.username,
            'profile_image', u.profile_image
          )
        )
        FROM conversation_participants cp2
        JOIN users u ON u.id = cp2.user_id
        WHERE cp2.conversation_id = c.id
          AND cp2.left_at IS NULL
          AND cp2.user_id != ${userId}
        LIMIT 5
      ) as other_participants
    FROM conversations c
    JOIN conversation_participants cp ON cp.conversation_id = c.id
    WHERE cp.user_id = ${userId}
      AND cp.left_at IS NULL
    ORDER BY c.last_message_at DESC NULLS LAST, c.created_at DESC
    LIMIT ${limit} OFFSET ${offset}
  `;
  return extractMany<Conversation>(result);
}

// Message operations
export async function sendMessage(
  sql: SqlQuery,
  conversationId: string,
  senderId: string,
  content: string,
  messageType: 'text' | 'image' | 'file' | 'system' = 'text',
  replyToId?: string,
  metadata?: Record<string, any>
): Promise<Message> {
  return await withTransaction(sql, async (txSql) => {
    // Verify sender is participant
    const participant = await txSql`
      SELECT user_id FROM conversation_participants
      WHERE conversation_id = ${conversationId} 
        AND user_id = ${senderId}
        AND left_at IS NULL
    `;
    
    if (participant.length === 0) {
      throw new DatabaseError('User is not a participant in this conversation');
    }

    // Create message
    const result = await txSql`
      INSERT INTO messages (
        conversation_id, sender_id, content,
        message_type, reply_to_id, metadata,
        is_edited, is_deleted, sent_at
      ) VALUES (
        ${conversationId}, ${senderId}, ${content},
        ${messageType}, ${replyToId || null}, ${metadata || null}::jsonb,
        false, false, NOW()
      )
      RETURNING *
    `;
    
    const message = extractFirst<Message>(result);
    if (!message) {
      throw new DatabaseError('Failed to send message');
    }

    // Update conversation last message
    await txSql`
      UPDATE conversations 
      SET 
        last_message_at = NOW(),
        last_message_preview = ${content.substring(0, 100)},
        updated_at = NOW()
      WHERE id = ${conversationId}
    `;

    return message;
  });
}

export async function getConversationMessages(
  sql: SqlQuery,
  conversationId: string,
  userId: string,
  options?: {
    limit?: number;
    offset?: number;
    beforeDate?: Date;
    afterDate?: Date;
  }
): Promise<Message[]> {
  // Verify user is participant
  const participant = await sql`
    SELECT user_id FROM conversation_participants
    WHERE conversation_id = ${conversationId} 
      AND user_id = ${userId}
      AND left_at IS NULL
  `;
  
  if (participant.length === 0) {
    throw new DatabaseError('User is not a participant in this conversation');
  }

  const wb = new WhereBuilder();
  wb.add('m.conversation_id = $param', conversationId);
  wb.add('m.is_deleted = false');
  wb.addOptional('m.sent_at', '<', options?.beforeDate);
  wb.addOptional('m.sent_at', '>', options?.afterDate);
  
  const { where, params } = wb.build();
  
  const query = `
    SELECT 
      m.*,
      u.username as sender_username,
      u.profile_image as sender_avatar,
      CASE WHEN rm.id IS NOT NULL THEN
        jsonb_build_object(
          'id', rm.id,
          'content', rm.content,
          'sender_username', ru.username
        )
      END as reply_to_message
    FROM messages m
    JOIN users u ON m.sender_id = u.id
    LEFT JOIN messages rm ON m.reply_to_id = rm.id
    LEFT JOIN users ru ON rm.sender_id = ru.id
    ${where}
    ORDER BY m.sent_at DESC
    LIMIT ${options?.limit || 50} OFFSET ${options?.offset || 0}
  `;
  
  const result = await sql.query(query, params);
  return extractMany<Message>(result);
}

export async function editMessage(
  sql: SqlQuery,
  messageId: string,
  senderId: string,
  newContent: string
): Promise<Message | null> {
  const result = await sql`
    UPDATE messages 
    SET 
      content = ${newContent},
      is_edited = true,
      edited_at = NOW()
    WHERE id = ${messageId} 
      AND sender_id = ${senderId}
      AND is_deleted = false
    RETURNING *
  `;
  return extractFirst<Message>(result);
}

export async function deleteMessage(
  sql: SqlQuery,
  messageId: string,
  userId: string
): Promise<boolean> {
  const result = await sql`
    UPDATE messages 
    SET 
      is_deleted = true,
      deleted_at = NOW()
    WHERE id = ${messageId} 
      AND sender_id = ${userId}
    RETURNING id
  `;
  return result.length > 0;
}

// Read receipts and typing indicators
export async function markMessagesAsRead(
  sql: SqlQuery,
  conversationId: string,
  userId: string
): Promise<number> {
  return await withTransaction(sql, async (txSql) => {
    // Update last read timestamp
    await txSql`
      UPDATE conversation_participants
      SET last_read_at = NOW()
      WHERE conversation_id = ${conversationId} 
        AND user_id = ${userId}
    `;

    // Create read receipts for unread messages
    const result = await txSql`
      INSERT INTO message_read_receipts (message_id, user_id, read_at)
      SELECT m.id, ${userId}, NOW()
      FROM messages m
      WHERE m.conversation_id = ${conversationId}
        AND m.sender_id != ${userId}
        AND NOT EXISTS (
          SELECT 1 FROM message_read_receipts mr
          WHERE mr.message_id = m.id AND mr.user_id = ${userId}
        )
      RETURNING message_id
    `;

    return result.length;
  });
}

export async function getMessageReadReceipts(
  sql: SqlQuery,
  messageId: string
): Promise<Array<{ user_id: string; username: string; read_at: Date }>> {
  const result = await sql`
    SELECT 
      mr.user_id,
      u.username,
      mr.read_at
    FROM message_read_receipts mr
    JOIN users u ON mr.user_id = u.id
    WHERE mr.message_id = ${messageId}
    ORDER BY mr.read_at DESC
  `;
  return extractMany<any>(result);
}

// Attachments
export async function addMessageAttachment(
  sql: SqlQuery,
  messageId: string,
  attachment: {
    filename: string;
    file_url: string;
    file_size: number;
    mime_type: string;
    thumbnail_url?: string;
  }
): Promise<MessageAttachment> {
  const result = await sql`
    INSERT INTO message_attachments (
      message_id, filename, file_url,
      file_size, mime_type, thumbnail_url,
      created_at
    ) VALUES (
      ${messageId}, ${attachment.filename}, ${attachment.file_url},
      ${attachment.file_size}, ${attachment.mime_type}, 
      ${attachment.thumbnail_url || null},
      NOW()
    )
    RETURNING *
  `;
  
  const att = extractFirst<MessageAttachment>(result);
  if (!att) {
    throw new DatabaseError('Failed to add attachment');
  }
  return att;
}

export async function getMessageAttachments(
  sql: SqlQuery,
  messageId: string
): Promise<MessageAttachment[]> {
  const result = await sql`
    SELECT * FROM message_attachments
    WHERE message_id = ${messageId}
    ORDER BY created_at ASC
  `;
  return extractMany<MessageAttachment>(result);
}

// Reactions
export async function toggleMessageReaction(
  sql: SqlQuery,
  messageId: string,
  userId: string,
  emoji: string
): Promise<{ added: boolean }> {
  // Check if reaction exists
  const existing = await sql`
    SELECT emoji FROM message_reactions
    WHERE message_id = ${messageId} 
      AND user_id = ${userId}
      AND emoji = ${emoji}
  `;

  if (existing.length > 0) {
    // Remove reaction
    await sql`
      DELETE FROM message_reactions
      WHERE message_id = ${messageId} 
        AND user_id = ${userId}
        AND emoji = ${emoji}
    `;
    return { added: false };
  } else {
    // Add reaction
    await sql`
      INSERT INTO message_reactions (message_id, user_id, emoji, created_at)
      VALUES (${messageId}, ${userId}, ${emoji}, NOW())
      ON CONFLICT (message_id, user_id, emoji) DO NOTHING
    `;
    return { added: true };
  }
}

export async function getMessageReactions(
  sql: SqlQuery,
  messageId: string
): Promise<Array<{ emoji: string; users: string[]; count: number }>> {
  const result = await sql`
    SELECT 
      mr.emoji,
      array_agg(u.username) as users,
      COUNT(*) as count
    FROM message_reactions mr
    JOIN users u ON mr.user_id = u.id
    WHERE mr.message_id = ${messageId}
    GROUP BY mr.emoji
    ORDER BY count DESC
  `;
  return extractMany<any>(result);
}

// Conversation management
export async function leaveConversation(
  sql: SqlQuery,
  conversationId: string,
  userId: string
): Promise<boolean> {
  const result = await sql`
    UPDATE conversation_participants
    SET left_at = NOW()
    WHERE conversation_id = ${conversationId} 
      AND user_id = ${userId}
      AND left_at IS NULL
    RETURNING conversation_id
  `;
  
  if (result.length > 0) {
    // Create system message
    await sql`
      INSERT INTO messages (
        conversation_id, sender_id, content,
        message_type, sent_at
      ) VALUES (
        ${conversationId}, ${userId}, 
        'Left the conversation',
        'system', NOW()
      )
    `;
  }
  
  return result.length > 0;
}

export async function muteConversation(
  sql: SqlQuery,
  conversationId: string,
  userId: string,
  muteDuration?: number // in hours
): Promise<boolean> {
  const muteUntil = muteDuration 
    ? new Date(Date.now() + muteDuration * 60 * 60 * 1000)
    : null;

  const result = await sql`
    UPDATE conversation_participants
    SET 
      is_muted = true,
      muted_until = ${muteUntil}
    WHERE conversation_id = ${conversationId} 
      AND user_id = ${userId}
    RETURNING conversation_id
  `;
  return result.length > 0;
}

// Search
export async function searchMessages(
  sql: SqlQuery,
  userId: string,
  searchTerm: string,
  conversationId?: string,
  limit: number = 20
): Promise<Message[]> {
  const searchPattern = `%${searchTerm}%`;
  
  const wb = new WhereBuilder();
  wb.add('m.is_deleted = false');
  wb.add('LOWER(m.content) LIKE LOWER($param)', searchPattern);
  wb.addOptional('m.conversation_id', '=', conversationId);
  
  const { where, params } = wb.build();
  
  const query = `
    SELECT DISTINCT
      m.*,
      u.username as sender_username,
      c.title as conversation_title
    FROM messages m
    JOIN conversations c ON m.conversation_id = c.id
    JOIN conversation_participants cp ON cp.conversation_id = c.id
    JOIN users u ON m.sender_id = u.id
    ${where}
      AND cp.user_id = ${userId}
      AND cp.left_at IS NULL
    ORDER BY m.sent_at DESC
    LIMIT ${limit}
  `;
  
  const result = await sql.query(query, [userId, ...params]);
  return extractMany<Message>(result);
}