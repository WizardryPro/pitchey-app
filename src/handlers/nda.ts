/**
 * NDA and Document Handler with Upload Support
 * FIXED: Document upload system with multiple file support and custom NDAs
 */

import { getDb } from '../db/connection';
import type { Env } from '../db/connection';
import { getCorsHeaders } from '../utils/response';
import { getUserId } from '../utils/auth-extract';
import * as documentQueries from '../db/queries/documents';
import * as notificationQueries from '../db/queries/notifications';

// GET /api/nda - Get user's NDA requests
export async function ndaHandler(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const type = url.searchParams.get('type') || 'all'; // sent, received, all
  const authenticatedUserId = await getUserId(request, env);
  const userId = authenticatedUserId || url.searchParams.get('userId') || '1';
  const sql = getDb(env);
  const origin = request.headers.get('Origin');
  const corsHeaders = getCorsHeaders(origin);

  const defaultResponse = {
    success: true,
    data: {
      ndas: [],
      total: 0
    }
  };

  if (!sql) {
    console.error('NDA handler: No database connection');
    return new Response(JSON.stringify(defaultResponse), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=60',
        ...corsHeaders
      }
    });
  }

  try {
    // Query the ndas table with proper joins
    // Note: Using ndas table instead of nda_requests, with signer_id as requester
    let ndas;
    if (type === 'sent') {
      ndas = await sql`
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
          u1.first_name as requester_first_name,
          u1.last_name as requester_last_name,
          u1.company_name as requester_company_name,
          u2.username as creator_username,
          u2.first_name as creator_first_name,
          u2.last_name as creator_last_name,
          u2.company_name as creator_company_name
        FROM ndas n
        JOIN pitches p ON n.pitch_id = p.id
        JOIN users u1 ON n.signer_id = u1.id
        JOIN users u2 ON p.user_id = u2.id
        WHERE n.signer_id = ${userId}
        ORDER BY n.created_at DESC
      `;
    } else if (type === 'received') {
      ndas = await sql`
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
          u1.first_name as requester_first_name,
          u1.last_name as requester_last_name,
          u1.company_name as requester_company_name,
          u2.username as creator_username,
          u2.first_name as creator_first_name,
          u2.last_name as creator_last_name,
          u2.company_name as creator_company_name
        FROM ndas n
        JOIN pitches p ON n.pitch_id = p.id
        JOIN users u1 ON n.signer_id = u1.id
        JOIN users u2 ON p.user_id = u2.id
        WHERE p.user_id = ${userId}
        ORDER BY n.created_at DESC
      `;
    } else {
      // all - get both sent and received
      ndas = await sql`
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
          u1.first_name as requester_first_name,
          u1.last_name as requester_last_name,
          u1.company_name as requester_company_name,
          u2.username as creator_username,
          u2.first_name as creator_first_name,
          u2.last_name as creator_last_name,
          u2.company_name as creator_company_name
        FROM ndas n
        JOIN pitches p ON n.pitch_id = p.id
        JOIN users u1 ON n.signer_id = u1.id
        JOIN users u2 ON p.user_id = u2.id
        WHERE n.signer_id = ${userId} OR p.user_id = ${userId}
        ORDER BY n.created_at DESC
      `;
    }

    return new Response(JSON.stringify({
      success: true,
      data: {
        ndas: ndas || [],
        total: ndas?.length || 0
      }
    }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=60',
        ...corsHeaders
      }
    });

  } catch (error) {
    console.error('NDA query error:', error);
    return new Response(JSON.stringify({
      ...defaultResponse,
      debug: { error: String(error), userId, type }
    }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=60',
        ...corsHeaders
      }
    });
  }
}

// POST /api/nda/request - Create new NDA request
export async function createNDARequest(request: Request, env: Env): Promise<Response> {
  try {
    const body = await request.json() as Record<string, unknown>;
    const { pitch_id, requester_id, nda_type = 'standard', custom_nda_url } = body;
    
    const sql = getDb(env);
    if (!sql) {
      return new Response(JSON.stringify({ error: 'Database unavailable' }), {
        status: 503,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    const nda = await documentQueries.createNDARequest(sql, {
      pitch_id,
      requester_id,
      nda_type,
      custom_nda_url,
      expires_in_days: 30
    });
    
    return new Response(JSON.stringify({
      success: true,
      data: nda
    }), {
      status: 201,
      headers: { 'Content-Type': 'application/json' }
    });
    
  } catch (error: any) {
    console.error('Create NDA error:', error);
    return new Response(JSON.stringify({ 
      error: error.message || 'Failed to create NDA request' 
    }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

// PUT /api/nda/:id/approve - Approve NDA request
export async function approveNDARequest(request: Request, env: Env): Promise<Response> {
  try {
    const url = new URL(request.url);
    const ndaId = url.pathname.split('/').pop()?.replace('/approve', '');
    const body = await request.json() as Record<string, unknown>;
    const { approver_id, signature } = body;
    
    if (!ndaId) {
      return new Response(JSON.stringify({ error: 'NDA ID required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    const sql = getDb(env);
    if (!sql) {
      return new Response(JSON.stringify({ error: 'Database unavailable' }), {
        status: 503,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    const nda = await documentQueries.approveNDARequest(sql, ndaId, approver_id, signature);
    
    if (!nda) {
      return new Response(JSON.stringify({ error: 'NDA not found or cannot be approved' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    return new Response(JSON.stringify({
      success: true,
      data: nda
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
    
  } catch (error: any) {
    console.error('Approve NDA error:', error);
    return new Response(JSON.stringify({ 
      error: error.message || 'Failed to approve NDA' 
    }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

// PUT /api/nda/:id/reject - Reject NDA request
export async function rejectNDARequest(request: Request, env: Env): Promise<Response> {
  try {
    const url = new URL(request.url);
    const ndaId = url.pathname.split('/').pop()?.replace('/reject', '');
    const body = await request.json() as Record<string, unknown>;
    const { rejector_id, reason } = body;
    
    if (!ndaId) {
      return new Response(JSON.stringify({ error: 'NDA ID required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    const sql = getDb(env);
    if (!sql) {
      return new Response(JSON.stringify({ error: 'Database unavailable' }), {
        status: 503,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    const nda = await documentQueries.rejectNDARequest(sql, ndaId, rejector_id, reason);
    
    if (!nda) {
      return new Response(JSON.stringify({ error: 'NDA not found or cannot be rejected' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    return new Response(JSON.stringify({
      success: true,
      data: nda
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
    
  } catch (error: any) {
    console.error('Reject NDA error:', error);
    return new Response(JSON.stringify({ 
      error: error.message || 'Failed to reject NDA' 
    }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

// GET /api/documents/:pitchId - Get documents for a pitch
export async function getDocuments(request: Request, env: Env): Promise<Response> {
  try {
    const url = new URL(request.url);
    const origin = request.headers.get('Origin');
    const corsHeaders = getCorsHeaders(origin);
    const pathParts = url.pathname.split('/');
    const pitchId = pathParts[pathParts.indexOf('documents') + 1];
    const userId = url.searchParams.get('userId');

    const sql = getDb(env);
    if (!sql) {
      return new Response(JSON.stringify({ error: 'Database unavailable' }), {
        status: 503,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    const documents = await documentQueries.getPitchDocuments(sql, pitchId, userId || undefined);
    
    return new Response(JSON.stringify({
      success: true,
      data: {
        documents
      }
    }), {
      status: 200,
      headers: { 
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=60',
        ...corsHeaders
      }
    });
    
  } catch (error: any) {
    console.error('Get documents error:', error);
    return new Response(JSON.stringify({ 
      error: error.message || 'Failed to fetch documents' 
    }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

// POST /api/documents/upload - Upload multiple documents (FIXED)
export async function uploadDocuments(request: Request, env: Env): Promise<Response> {
  try {
    const formData = await request.formData();
    const pitchId = formData.get('pitch_id') as string;
    const uploaderId = formData.get('uploader_id') as string;
    const requiresNda = formData.get('requires_nda') === 'true';
    const isPublic = formData.get('is_public') === 'true';
    
    const sql = getDb(env);
    if (!sql) {
      return new Response(JSON.stringify({ error: 'Database unavailable' }), {
        status: 503,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    const uploadedDocuments = [];
    const files = formData.getAll('files') as File[];
    
    // Process multiple files
    for (const file of files) {
      // Upload to R2 storage
      const fileBuffer = await file.arrayBuffer();
      const fileKey = `documents/${pitchId}/${Date.now()}-${file.name}`;
      
      if (env.R2_BUCKET) {
        await env.R2_BUCKET.put(fileKey, fileBuffer, {
          httpMetadata: { contentType: file.type },
        });
      }
      const fileUrl = `https://storage.pitchey.com/${fileKey}`;
      
      // Determine document type from extension
      const extension = file.name.split('.').pop()?.toLowerCase();
      let documentType: any = 'other';
      if (extension === 'pdf' && file.name.includes('deck')) {
        documentType = 'pitch_deck';
      } else if (extension === 'pdf' && file.name.includes('script')) {
        documentType = 'script';
      } else if (file.name.includes('budget')) {
        documentType = 'budget';
      } else if (file.name.includes('schedule')) {
        documentType = 'schedule';
      } else if (file.name.includes('nda')) {
        documentType = 'nda';
      }
      
      // Create document record
      const document = await documentQueries.createDocument(sql, {
        pitch_id: pitchId,
        uploaded_by_id: uploaderId,
        file_name: file.name,
        file_url: fileUrl,
        file_size: file.size,
        mime_type: file.type,
        document_type: documentType,
        description: formData.get(`description_${file.name}`) as string,
        is_public: isPublic,
        requires_nda: requiresNda
      });
      
      uploadedDocuments.push(document);
    }
    
    return new Response(JSON.stringify({
      success: true,
      data: {
        documents: uploadedDocuments,
        count: uploadedDocuments.length
      }
    }), {
      status: 201,
      headers: { 'Content-Type': 'application/json' }
    });
    
  } catch (error: any) {
    console.error('Upload documents error:', error);
    return new Response(JSON.stringify({ 
      error: error.message || 'Failed to upload documents' 
    }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

// GET /api/nda/stats - NDA statistics
export async function ndaStatsHandler(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const authenticatedUserId = await getUserId(request, env);
  const userId = authenticatedUserId || url.searchParams.get('userId') || '1';
  const sql = getDb(env);
  const origin = request.headers.get('Origin');
  const corsHeaders = getCorsHeaders(origin);
  
  const defaultResponse = {
    success: true,
    data: {
      total: 0,
      pending: 0,
      approved: 0,
      rejected: 0,
      expired: 0
    }
  };
  
  if (!sql) {
    return new Response(JSON.stringify(defaultResponse), {
      status: 200,
      headers: { 
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=120',
        ...corsHeaders
      }
    });
  }
  
  try {
    const result = await sql`
      SELECT 
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE status = 'pending') as pending,
        COUNT(*) FILTER (WHERE status = 'approved') as approved,
        COUNT(*) FILTER (WHERE status = 'rejected') as rejected,
        COUNT(*) FILTER (WHERE status = 'expired') as expired
      FROM nda_requests n
      JOIN pitches p ON n.pitch_id = p.id
      WHERE n.requester_id = ${userId} OR p.user_id = ${userId}
    `;
    
    return new Response(JSON.stringify({
      success: true,
      data: {
        total: Number(result[0]?.total) || 0,
        pending: Number(result[0]?.pending) || 0,
        approved: Number(result[0]?.approved) || 0,
        rejected: Number(result[0]?.rejected) || 0,
        expired: Number(result[0]?.expired) || 0
      }
    }), {
      status: 200,
      headers: { 
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=120'
      }
    });
    
  } catch (error) {
    console.error('NDA stats query error:', error);
    return new Response(JSON.stringify(defaultResponse), {
      status: 200,
      headers: { 
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=120'
      }
    });
  }
}