/**
 * Document and NDA-related database queries using raw SQL
 * Replaces Drizzle ORM with parameterized Neon queries
 */

import type { SqlQuery } from './base';
import { WhereBuilder, extractFirst, extractMany, DatabaseError, withTransaction } from './base';

// Type definitions
export interface Document {
  id: string;
  pitch_id: string;
  uploaded_by_id: string;
  file_name: string;
  file_url: string;
  file_size: number;
  mime_type: string;
  document_type: 'pitch_deck' | 'script' | 'budget' | 'schedule' | 'legal' | 'nda' | 'other';
  description?: string;
  is_public: boolean;
  requires_nda: boolean;
  version?: number;
  metadata?: Record<string, any>;
  created_at: Date;
  updated_at: Date;
}

export interface NDARequest {
  id: string;
  pitch_id: string;
  requester_id: string;
  status: 'pending' | 'approved' | 'rejected' | 'expired';
  nda_type: 'standard' | 'mutual' | 'custom';
  custom_nda_url?: string;
  signed_document_url?: string;
  requester_signature?: string;
  owner_signature?: string;
  requester_signed_at?: Date;
  owner_signed_at?: Date;
  approved_at?: Date;
  rejected_at?: Date;
  expires_at?: Date;
  rejection_reason?: string;
  metadata?: Record<string, any>;
  created_at: Date;
  updated_at: Date;
}

export interface DocumentAccess {
  id: string;
  document_id: string;
  user_id: string;
  access_type: 'view' | 'download' | 'edit' | 'delete';
  granted_by_id: string;
  expires_at?: Date;
  access_count: number;
  last_accessed_at?: Date;
  created_at: Date;
}

export interface DocumentVersion {
  id: string;
  document_id: string;
  version_number: number;
  file_url: string;
  file_size: number;
  uploaded_by_id: string;
  change_summary?: string;
  is_current: boolean;
  created_at: Date;
}

// Document management
export async function createDocument(
  sql: SqlQuery,
  input: {
    pitch_id: string;
    uploaded_by_id: string;
    file_name: string;
    file_url: string;
    file_size: number;
    mime_type: string;
    document_type: Document['document_type'];
    description?: string;
    is_public?: boolean;
    requires_nda?: boolean;
    metadata?: Record<string, any>;
  }
): Promise<Document> {
  return await withTransaction(sql, async (txSql) => {
    // Create document
    const result = await txSql`
      INSERT INTO documents (
        pitch_id, uploaded_by_id, file_name, file_url,
        file_size, mime_type, document_type,
        description, is_public, requires_nda,
        version, metadata,
        created_at, updated_at
      ) VALUES (
        ${input.pitch_id}, ${input.uploaded_by_id}, 
        ${input.file_name}, ${input.file_url},
        ${input.file_size}, ${input.mime_type}, ${input.document_type},
        ${input.description || null}, ${input.is_public ?? false}, 
        ${input.requires_nda ?? false},
        1, ${input.metadata || null}::jsonb,
        NOW(), NOW()
      )
      RETURNING *
    `;
    
    const document = extractFirst<Document>(result);
    if (!document) {
      throw new DatabaseError('Failed to create document');
    }

    // Create initial version record
    await txSql`
      INSERT INTO document_versions (
        document_id, version_number, file_url, file_size,
        uploaded_by_id, is_current, created_at
      ) VALUES (
        ${document.id}, 1, ${input.file_url}, ${input.file_size},
        ${input.uploaded_by_id}, true, NOW()
      )
    `;

    // Update pitch document count
    await txSql`
      UPDATE pitches 
      SET 
        document_count = document_count + 1,
        updated_at = NOW()
      WHERE id = ${input.pitch_id}
    `;

    return document;
  });
}

export async function getPitchDocuments(
  sql: SqlQuery,
  pitchId: string,
  userId?: string
): Promise<Document[]> {
  // Build query based on access level
  const query = userId ? `
    SELECT DISTINCT
      d.*,
      u.username as uploader_username,
      CASE 
        WHEN d.is_public = true THEN true
        WHEN d.uploaded_by_id = $2 THEN true
        WHEN EXISTS (
          SELECT 1 FROM pitches p 
          WHERE p.id = d.pitch_id AND p.creator_id = $2
        ) THEN true
        WHEN d.requires_nda = true AND EXISTS (
          SELECT 1 FROM nda_requests nr
          WHERE nr.pitch_id = d.pitch_id 
            AND nr.requester_id = $2
            AND nr.status = 'approved'
        ) THEN true
        WHEN EXISTS (
          SELECT 1 FROM document_access da
          WHERE da.document_id = d.id 
            AND da.user_id = $2
            AND (da.expires_at IS NULL OR da.expires_at > NOW())
        ) THEN true
        ELSE false
      END as has_access
    FROM documents d
    LEFT JOIN users u ON d.uploaded_by_id = u.id
    WHERE d.pitch_id = $1
    ORDER BY d.created_at DESC
  ` : `
    SELECT 
      d.*,
      u.username as uploader_username,
      d.is_public as has_access
    FROM documents d
    LEFT JOIN users u ON d.uploaded_by_id = u.id
    WHERE d.pitch_id = $1 AND d.is_public = true
    ORDER BY d.created_at DESC
  `;

  const params = userId ? [pitchId, userId] : [pitchId];
  const result = await sql.query(query, params);
  return extractMany<Document>(result);
}

export async function getDocumentById(
  sql: SqlQuery,
  documentId: string,
  userId?: string
): Promise<Document | null> {
  const query = `
    SELECT 
      d.*,
      u.username as uploader_username,
      p.title as pitch_title,
      p.creator_id as pitch_creator_id
    FROM documents d
    LEFT JOIN users u ON d.uploaded_by_id = u.id
    LEFT JOIN pitches p ON d.pitch_id = p.id
    WHERE d.id = $1
  `;
  
  const result = await sql.query(query, [documentId]);
  const document = extractFirst<Document & { pitch_creator_id: string }>(result);
  
  if (!document) return null;
  
  // Check access if userId provided
  if (userId) {
    const hasAccess = 
      document.is_public ||
      document.uploaded_by_id === userId ||
      document.pitch_creator_id === userId;
    
    if (!hasAccess) {
      // Check NDA approval or explicit access grant
      const accessCheck = await sql`
        SELECT EXISTS (
          SELECT 1 FROM nda_requests
          WHERE pitch_id = ${document.pitch_id} 
            AND requester_id = ${userId}
            AND status = 'approved'
        ) OR EXISTS (
          SELECT 1 FROM document_access
          WHERE document_id = ${documentId} 
            AND user_id = ${userId}
            AND (expires_at IS NULL OR expires_at > NOW())
        ) as has_access
      `;
      
      const access = extractFirst<{ has_access: boolean }>(accessCheck);
      if (!access?.has_access) return null;
    }
  } else if (!document.is_public) {
    return null; // No access for anonymous users to private documents
  }
  
  return document;
}

export async function updateDocument(
  sql: SqlQuery,
  documentId: string,
  userId: string,
  updates: {
    file_name?: string;
    description?: string;
    is_public?: boolean;
    requires_nda?: boolean;
    document_type?: Document['document_type'];
  }
): Promise<Document | null> {
  // Build dynamic update
  const setClauses: string[] = [];
  const values: any[] = [];
  let paramIndex = 3;

  Object.entries(updates).forEach(([key, value]) => {
    if (value !== undefined) {
      setClauses.push(`${key} = $${paramIndex}`);
      values.push(value);
      paramIndex++;
    }
  });

  if (setClauses.length === 0) return getDocumentById(sql, documentId);

  setClauses.push('updated_at = NOW()');

  const query = `
    UPDATE documents 
    SET ${setClauses.join(', ')}
    WHERE id = $1 
      AND (uploaded_by_id = $2 OR EXISTS (
        SELECT 1 FROM pitches p 
        WHERE p.id = pitch_id AND p.creator_id = $2
      ))
    RETURNING *
  `;

  const result = await sql.query(query, [documentId, userId, ...values]);
  return extractFirst<Document>(result);
}

export async function deleteDocument(
  sql: SqlQuery,
  documentId: string,
  userId: string
): Promise<boolean> {
  return await withTransaction(sql, async (txSql) => {
    // Delete document (cascades to versions and access records)
    const result = await txSql`
      DELETE FROM documents
      WHERE id = ${documentId}
        AND (uploaded_by_id = ${userId} OR EXISTS (
          SELECT 1 FROM pitches p 
          WHERE p.id = pitch_id AND p.creator_id = ${userId}
        ))
      RETURNING pitch_id
    `;
    
    if (result.length > 0) {
      const pitchId = result[0].pitch_id;
      
      // Update pitch document count
      await txSql`
        UPDATE pitches 
        SET 
          document_count = document_count - 1,
          updated_at = NOW()
        WHERE id = ${pitchId}
      `;
      
      return true;
    }
    
    return false;
  });
}

// NDA management
export async function createNDARequest(
  sql: SqlQuery,
  input: {
    pitch_id: string;
    requester_id: string;
    nda_type?: 'standard' | 'mutual' | 'custom';
    custom_nda_url?: string;
    expires_in_days?: number;
  }
): Promise<NDARequest> {
  return await withTransaction(sql, async (txSql) => {
    // Check if request already exists
    const existing = await txSql`
      SELECT id FROM nda_requests
      WHERE pitch_id = ${input.pitch_id} 
        AND requester_id = ${input.requester_id}
        AND status = 'pending'
    `;
    
    if (existing.length > 0) {
      throw new DatabaseError('NDA request already pending');
    }

    const expiresAt = input.expires_in_days 
      ? new Date(Date.now() + input.expires_in_days * 24 * 60 * 60 * 1000)
      : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // Default 30 days

    const result = await txSql`
      INSERT INTO nda_requests (
        pitch_id, requester_id, status,
        nda_type, custom_nda_url,
        expires_at, created_at, updated_at
      ) VALUES (
        ${input.pitch_id}, ${input.requester_id}, 'pending',
        ${input.nda_type || 'standard'}, ${input.custom_nda_url || null},
        ${expiresAt}, NOW(), NOW()
      )
      RETURNING *
    `;
    
    const nda = extractFirst<NDARequest>(result);
    if (!nda) {
      throw new DatabaseError('Failed to create NDA request');
    }

    // Notify pitch creator
    await txSql`
      INSERT INTO notifications (
        user_id, type, title, message,
        related_pitch_id, related_user_id,
        priority, created_at
      )
      SELECT 
        p.creator_id,
        'nda_request',
        'New NDA Request',
        'Someone has requested NDA access to your pitch',
        ${input.pitch_id}, ${input.requester_id},
        'high', NOW()
      FROM pitches p
      WHERE p.id = ${input.pitch_id}
    `;

    return nda;
  });
}

export async function getNDARequest(
  sql: SqlQuery,
  requestId: string,
  userId: string
): Promise<NDARequest | null> {
  const result = await sql`
    SELECT 
      nr.*,
      p.title as pitch_title,
      u.username as requester_username
    FROM nda_requests nr
    JOIN pitches p ON nr.pitch_id = p.id
    JOIN users u ON nr.requester_id = u.id
    WHERE nr.id = ${requestId}
      AND (nr.requester_id = ${userId} OR p.creator_id = ${userId})
  `;
  return extractFirst<NDARequest>(result);
}

export async function getUserNDARequests(
  sql: SqlQuery,
  userId: string,
  type: 'sent' | 'received' | 'all' = 'all'
): Promise<NDARequest[]> {
  const wb = new WhereBuilder();

  // ndas table uses signer_id for the requester, and pitches uses user_id for owner
  if (type === 'sent') {
    wb.add('n.signer_id = $param', userId);
  } else if (type === 'received') {
    wb.add('p.user_id = $param', userId);
  } else {
    wb.add('(n.signer_id = $param OR p.user_id = $param)', userId);
  }

  const { where, params } = wb.build();

  const query = `
    SELECT
      n.id,
      n.pitch_id,
      n.signer_id as requester_id,
      n.status,
      n.nda_type,
      n.created_at,
      n.updated_at,
      n.expires_at,
      n.signed_at,
      n.approved_at,
      n.approved_by,
      p.title as pitch_title,
      p.genre as pitch_genre,
      u1.username as requester_username,
      u2.username as creator_username
    FROM ndas n
    JOIN pitches p ON n.pitch_id = p.id
    JOIN users u1 ON n.signer_id = u1.id
    JOIN users u2 ON p.user_id = u2.id
    ${where}
    ORDER BY n.created_at DESC
  `;

  const result = await sql.query(query, params);
  return extractMany<NDARequest>(result);
}

export async function approveNDARequest(
  sql: SqlQuery,
  requestId: string,
  approverId: string,
  signature?: string
): Promise<NDARequest | null> {
  return await withTransaction(sql, async (txSql) => {
    // Update NDA request
    const result = await txSql`
      UPDATE nda_requests nr
      SET 
        status = 'approved',
        approved_at = NOW(),
        owner_signature = ${signature || null},
        owner_signed_at = ${signature ? sql`NOW()` : null},
        updated_at = NOW()
      WHERE nr.id = ${requestId}
        AND nr.status = 'pending'
        AND EXISTS (
          SELECT 1 FROM pitches p 
          WHERE p.id = nr.pitch_id AND p.creator_id = ${approverId}
        )
      RETURNING *
    `;
    
    const nda = extractFirst<NDARequest>(result);
    if (!nda) return null;

    // Grant document access
    await txSql`
      INSERT INTO document_access (
        document_id, user_id, access_type,
        granted_by_id, created_at
      )
      SELECT 
        d.id, ${nda.requester_id}, 'view',
        ${approverId}, NOW()
      FROM documents d
      WHERE d.pitch_id = ${nda.pitch_id}
        AND d.requires_nda = true
      ON CONFLICT (document_id, user_id) DO NOTHING
    `;

    // Notify requester
    await txSql`
      INSERT INTO notifications (
        user_id, type, title, message,
        related_pitch_id, related_user_id,
        priority, created_at
      ) VALUES (
        ${nda.requester_id},
        'nda_approved',
        'NDA Approved',
        'Your NDA request has been approved',
        ${nda.pitch_id}, ${approverId},
        'high', NOW()
      )
    `;

    return nda;
  });
}

export async function rejectNDARequest(
  sql: SqlQuery,
  requestId: string,
  rejectorId: string,
  reason?: string
): Promise<NDARequest | null> {
  return await withTransaction(sql, async (txSql) => {
    const result = await txSql`
      UPDATE nda_requests nr
      SET 
        status = 'rejected',
        rejected_at = NOW(),
        rejection_reason = ${reason || null},
        updated_at = NOW()
      WHERE nr.id = ${requestId}
        AND nr.status = 'pending'
        AND EXISTS (
          SELECT 1 FROM pitches p 
          WHERE p.id = nr.pitch_id AND p.creator_id = ${rejectorId}
        )
      RETURNING *
    `;
    
    const nda = extractFirst<NDARequest>(result);
    if (!nda) return null;

    // Notify requester
    await txSql`
      INSERT INTO notifications (
        user_id, type, title, message,
        related_pitch_id, related_user_id,
        priority, created_at
      ) VALUES (
        ${nda.requester_id},
        'nda_rejected',
        'NDA Rejected',
        ${reason || 'Your NDA request has been rejected'},
        ${nda.pitch_id}, ${rejectorId},
        'medium', NOW()
      )
    `;

    return nda;
  });
}

export async function signNDARequest(
  sql: SqlQuery,
  requestId: string,
  userId: string,
  signature: string
): Promise<NDARequest | null> {
  const result = await sql`
    UPDATE nda_requests
    SET 
      requester_signature = ${signature},
      requester_signed_at = NOW(),
      updated_at = NOW()
    WHERE id = ${requestId}
      AND requester_id = ${userId}
      AND status IN ('pending', 'approved')
    RETURNING *
  `;
  return extractFirst<NDARequest>(result);
}

// Document access management
export async function grantDocumentAccess(
  sql: SqlQuery,
  documentId: string,
  userId: string,
  grantedBy: string,
  accessType: 'view' | 'download' | 'edit' = 'view',
  expiresInDays?: number
): Promise<DocumentAccess> {
  const expiresAt = expiresInDays 
    ? new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000)
    : null;

  const result = await sql`
    INSERT INTO document_access (
      document_id, user_id, access_type,
      granted_by_id, expires_at,
      access_count, created_at
    ) VALUES (
      ${documentId}, ${userId}, ${accessType},
      ${grantedBy}, ${expiresAt},
      0, NOW()
    )
    ON CONFLICT (document_id, user_id) 
    DO UPDATE SET
      access_type = EXCLUDED.access_type,
      expires_at = EXCLUDED.expires_at,
      granted_by_id = EXCLUDED.granted_by_id
    RETURNING *
  `;
  
  const access = extractFirst<DocumentAccess>(result);
  if (!access) {
    throw new DatabaseError('Failed to grant document access');
  }
  return access;
}

export async function revokeDocumentAccess(
  sql: SqlQuery,
  documentId: string,
  userId: string,
  revokedBy: string
): Promise<boolean> {
  const result = await sql`
    DELETE FROM document_access
    WHERE document_id = ${documentId}
      AND user_id = ${userId}
      AND EXISTS (
        SELECT 1 FROM documents d
        JOIN pitches p ON d.pitch_id = p.id
        WHERE d.id = ${documentId}
          AND (p.creator_id = ${revokedBy} OR d.uploaded_by_id = ${revokedBy})
      )
    RETURNING id
  `;
  return result.length > 0;
}

export async function trackDocumentAccess(
  sql: SqlQuery,
  documentId: string,
  userId: string
): Promise<void> {
  await sql`
    UPDATE document_access
    SET 
      access_count = access_count + 1,
      last_accessed_at = NOW()
    WHERE document_id = ${documentId}
      AND user_id = ${userId}
  `;
}

// Document versioning
export async function createDocumentVersion(
  sql: SqlQuery,
  documentId: string,
  userId: string,
  fileUrl: string,
  fileSize: number,
  changeSummary?: string
): Promise<DocumentVersion> {
  return await withTransaction(sql, async (txSql) => {
    // Get current version number
    const currentVersion = await txSql`
      SELECT MAX(version_number) as max_version
      FROM document_versions
      WHERE document_id = ${documentId}
    `;
    
    const versionNumber = (currentVersion[0]?.max_version || 0) + 1;

    // Mark all previous versions as non-current
    await txSql`
      UPDATE document_versions
      SET is_current = false
      WHERE document_id = ${documentId}
    `;

    // Create new version
    const result = await txSql`
      INSERT INTO document_versions (
        document_id, version_number,
        file_url, file_size,
        uploaded_by_id, change_summary,
        is_current, created_at
      ) VALUES (
        ${documentId}, ${versionNumber},
        ${fileUrl}, ${fileSize},
        ${userId}, ${changeSummary || null},
        true, NOW()
      )
      RETURNING *
    `;
    
    const version = extractFirst<DocumentVersion>(result);
    if (!version) {
      throw new DatabaseError('Failed to create document version');
    }

    // Update main document
    await txSql`
      UPDATE documents
      SET 
        file_url = ${fileUrl},
        file_size = ${fileSize},
        version = ${versionNumber},
        updated_at = NOW()
      WHERE id = ${documentId}
    `;

    return version;
  });
}

export async function getDocumentVersions(
  sql: SqlQuery,
  documentId: string
): Promise<DocumentVersion[]> {
  const result = await sql`
    SELECT 
      dv.*,
      u.username as uploaded_by_username
    FROM document_versions dv
    LEFT JOIN users u ON dv.uploaded_by_id = u.id
    WHERE dv.document_id = ${documentId}
    ORDER BY dv.version_number DESC
  `;
  return extractMany<DocumentVersion>(result);
}

// Analytics
export async function getDocumentStats(
  sql: SqlQuery,
  pitchId: string
): Promise<{
  totalDocuments: number;
  publicDocuments: number;
  ndaProtectedDocuments: number;
  totalSize: number;
  totalAccessGrants: number;
  uniqueViewers: number;
}> {
  const result = await sql`
    SELECT 
      COUNT(*)::int as total_documents,
      COUNT(CASE WHEN is_public = true THEN 1 END)::int as public_documents,
      COUNT(CASE WHEN requires_nda = true THEN 1 END)::int as nda_protected_documents,
      COALESCE(SUM(file_size), 0) as total_size,
      (
        SELECT COUNT(*)::int FROM document_access da
        JOIN documents d ON da.document_id = d.id
        WHERE d.pitch_id = ${pitchId}
      ) as total_access_grants,
      (
        SELECT COUNT(DISTINCT user_id)::int FROM document_access da
        JOIN documents d ON da.document_id = d.id
        WHERE d.pitch_id = ${pitchId}
      ) as unique_viewers
    FROM documents
    WHERE pitch_id = ${pitchId}
  `;
  
  const stats = extractFirst<any>(result) || {};
  return {
    totalDocuments: Number(stats.total_documents || 0),
    publicDocuments: Number(stats.public_documents || 0),
    ndaProtectedDocuments: Number(stats.nda_protected_documents || 0),
    totalSize: Number(stats.total_size || 0),
    totalAccessGrants: Number(stats.total_access_grants || 0),
    uniqueViewers: Number(stats.unique_viewers || 0)
  };
}