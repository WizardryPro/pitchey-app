/**
 * Enhanced NDA Workflow Endpoint Handler for Cloudflare Worker
 * Integrates with comprehensive NDA workflow service for complete lifecycle management
 */

import type { Env, DatabaseService, User, AuthPayload, SentryLogger } from '../types/worker-types';
import { NDAWorkflowService } from '../services/nda-workflow.service';
import { 
  handleNDARequest,
  handleNDAApproval,
  handleNDARejection,
  handleNDASignature,
  handleNDARevocation,
  handleNDAStatus,
  handleCanRequestNDA,
  handleNDAAuditTrail,
  handleNDAStatistics,
  handleCreatorNDARequests,
  handleInvestorNDARequests,
  handleExpireNDAs
} from '../handlers/nda-handlers';

export class EnhancedNDAEndpointsHandler {
  constructor(
    private env: Env,
    private db: DatabaseService,
    private sentry: SentryLogger
  ) {}

  async handleNDARequest(request: Request, path: string, method: string, userAuth?: AuthPayload): Promise<Response> {
    const corsHeaders = {
      'Access-Control-Allow-Origin': this.env.FRONTEND_URL || 'https://pitchey-5o8.pages.dev',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With, Cookie',
      'Access-Control-Allow-Credentials': 'true',
      'Access-Control-Max-Age': '86400',
    };

    try {
      // Handle preflight
      if (method === 'OPTIONS') {
        return new Response(null, { status: 200, headers: corsHeaders });
      }

      // Routes requiring authentication
      if (!userAuth && this.requiresAuth(path)) {
        await this.sentry.captureMessage(`Unauthorized access attempt to ${path}`, 'warning');
        return new Response(JSON.stringify({ 
          success: false, 
          error: { message: 'Authentication required' } 
        }), { 
          status: 401, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        });
      }

      // Create an environment object with database service
      const enhancedEnv = {
        ...this.env,
        db: this.db
      };

      // Create auth result object
      const authResult = userAuth ? {
        user: {
          id: userAuth.userId,
          email: userAuth.email,
          role: userAuth.role
        },
        session: userAuth.session
      } : null;

      // Enhanced NDA endpoints using new workflow service
      
      // Request NDA
      if (path === '/api/ndas/request' && method === 'POST') {
        return handleNDARequest(request, enhancedEnv, authResult);
      }

      // Approve NDA
      if (path.match(/^\/api\/ndas\/\d+\/approve$/) && method === 'POST') {
        // Add params to request for handler
        (request as any).params = { id: path.split('/')[3] };
        return handleNDAApproval(request, enhancedEnv, authResult);
      }

      // Reject NDA
      if (path.match(/^\/api\/ndas\/\d+\/reject$/) && method === 'POST') {
        (request as any).params = { id: path.split('/')[3] };
        return handleNDARejection(request, enhancedEnv, authResult);
      }

      // Sign NDA
      if (path.match(/^\/api\/ndas\/\d+\/sign$/) && method === 'POST') {
        (request as any).params = { id: path.split('/')[3] };
        return handleNDASignature(request, enhancedEnv, authResult);
      }

      // Revoke NDA
      if (path.match(/^\/api\/ndas\/\d+\/revoke$/) && method === 'POST') {
        (request as any).params = { id: path.split('/')[3] };
        return handleNDARevocation(request, enhancedEnv, authResult);
      }

      // Get NDA status for pitch
      if (path.match(/^\/api\/ndas\/pitch\/\d+\/status$/) && method === 'GET') {
        (request as any).params = { pitchId: path.split('/')[4] };
        return handleNDAStatus(request, enhancedEnv, authResult);
      }

      // Check if can request NDA
      if (path.match(/^\/api\/ndas\/pitch\/\d+\/can-request$/) && method === 'GET') {
        (request as any).params = { pitchId: path.split('/')[4] };
        return handleCanRequestNDA(request, enhancedEnv, authResult);
      }

      // Get NDA audit trail
      if (path.match(/^\/api\/ndas\/\d+\/audit$/) && method === 'GET') {
        (request as any).params = { id: path.split('/')[3] };
        return handleNDAAuditTrail(request, enhancedEnv, authResult);
      }

      // Get NDA statistics
      if (path === '/api/ndas/stats' && method === 'GET') {
        return handleNDAStatistics(request, enhancedEnv, authResult);
      }

      // Get creator's NDA requests
      if (path === '/api/ndas/creator/requests' && method === 'GET') {
        return handleCreatorNDARequests(request, enhancedEnv, authResult);
      }

      // Get investor's NDA requests
      if (path === '/api/ndas/investor/requests' && method === 'GET') {
        return handleInvestorNDARequests(request, enhancedEnv, authResult);
      }

      // Scheduled job to expire NDAs
      if (path === '/api/ndas/expire' && method === 'POST') {
        return handleExpireNDAs(request, enhancedEnv);
      }

      // Get all NDAs (with filtering)
      if (path === '/api/ndas' && method === 'GET') {
        return this.handleGetNDAs(request, corsHeaders, enhancedEnv, authResult);
      }

      // Get single NDA
      if (path.match(/^\/api\/ndas\/\d+$/) && method === 'GET') {
        const ndaId = parseInt(path.split('/')[3]);
        return this.handleGetSingleNDA(request, corsHeaders, enhancedEnv, authResult, ndaId);
      }

      // Download NDA document
      if (path.match(/^\/api\/ndas\/\d+\/download$/) && method === 'GET') {
        const ndaId = parseInt(path.split('/')[3]);
        return this.handleDownloadNDA(request, corsHeaders, enhancedEnv, authResult, ndaId, false);
      }

      // Download signed NDA document
      if (path.match(/^\/api\/ndas\/\d+\/download-signed$/) && method === 'GET') {
        const ndaId = parseInt(path.split('/')[3]);
        return this.handleDownloadNDA(request, corsHeaders, enhancedEnv, authResult, ndaId, true);
      }

      // Generate NDA preview
      if (path === '/api/ndas/preview' && method === 'POST') {
        return this.handleGeneratePreview(request, corsHeaders, enhancedEnv, authResult);
      }

      // Template endpoints
      if (path === '/api/ndas/templates' && method === 'GET') {
        return this.handleGetTemplates(request, corsHeaders, enhancedEnv);
      }

      if (path === '/api/ndas/templates' && method === 'POST') {
        return this.handleCreateTemplate(request, corsHeaders, enhancedEnv, authResult);
      }

      if (path.match(/^\/api\/ndas\/templates\/\d+$/) && method === 'GET') {
        const templateId = parseInt(path.split('/')[4]);
        return this.handleGetTemplate(request, corsHeaders, enhancedEnv, templateId);
      }

      // Route not found
      return new Response(JSON.stringify({ 
        success: false, 
        error: { message: 'NDA endpoint not found' } 
      }), { 
        status: 404, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });

    } catch (error) {
      await this.sentry.captureError(error as Error, { path, method, userId: userAuth?.userId });
      return new Response(JSON.stringify({ 
        success: false, 
        error: { message: 'Internal server error' } 
      }), { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }
  }

  private requiresAuth(path: string): boolean {
    const publicPaths = [
      '/api/ndas/templates', // GET only - templates are public for viewing
      '/api/ndas/expire'     // Internal scheduled job
    ];
    
    return !publicPaths.some(publicPath => path === publicPath || path.startsWith(publicPath + '/'));
  }

  private async handleGetNDAs(request: Request, corsHeaders: Record<string, string>, env: any, authResult: any): Promise<Response> {
    try {
      const url = new URL(request.url);
      const status = url.searchParams.get('status');
      const pitchId = url.searchParams.get('pitchId');
      const limit = parseInt(url.searchParams.get('limit') || '20');
      const offset = parseInt(url.searchParams.get('offset') || '0');

      const ndaService = new NDAWorkflowService(env);
      
      // Determine if user is creator or investor
      const userRole = authResult.user.role || 'investor';
      
      let ndas = [];
      if (userRole === 'creator') {
        ndas = await ndaService.getCreatorNDARequests(authResult.user.id, status);
      } else {
        ndas = await ndaService.getInvestorNDARequests(authResult.user.id, status);
      }

      // Apply pitch filter if specified
      if (pitchId) {
        ndas = ndas.filter(nda => nda.pitchId === parseInt(pitchId));
      }

      // Apply pagination
      const total = ndas.length;
      ndas = ndas.slice(offset, offset + limit);

      return new Response(JSON.stringify({ 
        success: true, 
        data: { ndas, total }
      }), { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    } catch (error) {
      await this.sentry.captureError(error as Error);
      return new Response(JSON.stringify({ 
        success: false, 
        error: { message: 'Failed to fetch NDAs' } 
      }), { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }
  }

  private async handleGetSingleNDA(request: Request, corsHeaders: Record<string, string>, env: any, authResult: any, ndaId: number): Promise<Response> {
    try {
      const db = env.db;
      
      const [nda] = await db.query(`
        SELECT n.*, nr.*, 
               p.title as pitch_title,
               u1.first_name as requester_first_name, u1.last_name as requester_last_name,
               u2.first_name as owner_first_name, u2.last_name as owner_last_name
        FROM ndas n
        LEFT JOIN nda_requests nr ON nr.id = n.nda_request_id
        LEFT JOIN pitches p ON p.id = n.pitch_id
        LEFT JOIN users u1 ON u1.id = n.signer_id
        LEFT JOIN users u2 ON u2.id = p.created_by
        WHERE n.id = $1 AND (n.signer_id = $2 OR p.created_by = $2)
      `, [ndaId, authResult.user.id]);

      if (!nda) {
        return new Response(JSON.stringify({ 
          success: false, 
          error: { message: 'NDA not found' } 
        }), { 
          status: 404, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        });
      }

      return new Response(JSON.stringify({ 
        success: true, 
        data: { nda }
      }), { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    } catch (error) {
      await this.sentry.captureError(error as Error);
      return new Response(JSON.stringify({ 
        success: false, 
        error: { message: 'Failed to fetch NDA' } 
      }), { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }
  }

  private async handleDownloadNDA(request: Request, corsHeaders: Record<string, string>, env: any, authResult: any, ndaId: number, signed: boolean): Promise<Response> {
    try {
      const db = env.db;
      
      // Get NDA document
      const [doc] = await db.query(`
        SELECT nd.*, n.signer_id, p.created_by
        FROM nda_documents nd
        JOIN ndas n ON n.id = nd.nda_id
        JOIN pitches p ON p.id = n.pitch_id
        WHERE nd.nda_id = $1 AND (n.signer_id = $2 OR p.created_by = $2)
      `, [ndaId, authResult.user.id]);

      if (!doc) {
        return new Response(JSON.stringify({ 
          success: false, 
          error: { message: 'NDA document not found' } 
        }), { 
          status: 404, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        });
      }

      const downloadUrl = signed ? doc.signed_document_url : doc.document_url;
      
      if (!downloadUrl) {
        return new Response(JSON.stringify({ 
          success: false, 
          error: { message: 'Document not available' } 
        }), { 
          status: 404, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        });
      }

      // Check if watermarking is enabled
      if (!signed && doc.watermark_enabled) {
        // Return watermarked URL if available
        const url = doc.watermarked_url || downloadUrl;
        return new Response(JSON.stringify({ 
          success: true, 
          data: { downloadUrl: url, watermarked: true }
        }), { 
          status: 200, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        });
      }

      return new Response(JSON.stringify({ 
        success: true, 
        data: { downloadUrl }
      }), { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    } catch (error) {
      await this.sentry.captureError(error as Error);
      return new Response(JSON.stringify({ 
        success: false, 
        error: { message: 'Failed to download NDA' } 
      }), { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }
  }

  private async handleGeneratePreview(request: Request, corsHeaders: Record<string, string>, env: any, authResult: any): Promise<Response> {
    try {
      const body = await request.json();
      const { templateId, pitchId, customTerms } = body;

      const db = env.db;
      
      // Get template
      const [template] = await db.query(
        `SELECT * FROM nda_templates WHERE id = $1 AND is_active = true`,
        [templateId || 1]
      );

      if (!template) {
        return new Response(JSON.stringify({ 
          success: false, 
          error: { message: 'Template not found' } 
        }), { 
          status: 404, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        });
      }

      // Get pitch details
      const [pitch] = await db.query(
        `SELECT p.*, u.first_name, u.last_name, u.company 
         FROM pitches p
         JOIN users u ON u.id = p.created_by
         WHERE p.id = $1`,
        [pitchId]
      );

      // Generate preview by replacing variables
      let preview = template.content;
      const variables = {
        '{date}': new Date().toLocaleDateString(),
        '{pitch_title}': pitch?.title || '[Pitch Title]',
        '{creator_name}': pitch ? `${pitch.first_name} ${pitch.last_name}` : '[Creator Name]',
        '{investor_name}': `${authResult.user.first_name} ${authResult.user.last_name}`,
        '{expiration_days}': '90',
        '{jurisdiction}': 'United States'
      };

      for (const [key, value] of Object.entries(variables)) {
        preview = preview.replace(new RegExp(key, 'g'), value);
      }

      // Add custom terms if provided
      if (customTerms) {
        preview += `\n\nADDITIONAL TERMS:\n${customTerms}`;
      }

      return new Response(JSON.stringify({ 
        success: true, 
        data: { preview }
      }), { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    } catch (error) {
      await this.sentry.captureError(error as Error);
      return new Response(JSON.stringify({ 
        success: false, 
        error: { message: 'Failed to generate preview' } 
      }), { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }
  }

  private async handleGetTemplates(request: Request, corsHeaders: Record<string, string>, env: any): Promise<Response> {
    try {
      const db = env.db;
      
      const templates = await db.query(
        `SELECT * FROM nda_templates WHERE is_active = true ORDER BY is_default DESC, name ASC`
      );

      return new Response(JSON.stringify({ 
        success: true, 
        data: { templates }
      }), { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    } catch (error) {
      await this.sentry.captureError(error as Error);
      return new Response(JSON.stringify({ 
        success: false, 
        error: { message: 'Failed to fetch templates' } 
      }), { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }
  }

  private async handleCreateTemplate(request: Request, corsHeaders: Record<string, string>, env: any, authResult: any): Promise<Response> {
    try {
      const body = await request.json();
      const { name, type, content, variables, isDefault } = body;

      if (!name || !content) {
        return new Response(JSON.stringify({ 
          success: false, 
          error: { message: 'Name and content are required' } 
        }), { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        });
      }

      const db = env.db;
      
      // If setting as default, unset other defaults
      if (isDefault) {
        await db.query(
          `UPDATE nda_templates SET is_default = false WHERE creator_id = $1`,
          [authResult.user.id]
        );
      }

      const [template] = await db.query(
        `INSERT INTO nda_templates (creator_id, name, type, content, variables, is_default, is_active, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, true, $7, $8)
         RETURNING *`,
        [
          authResult.user.id,
          name,
          type || 'standard',
          content,
          JSON.stringify(variables || []),
          isDefault || false,
          new Date().toISOString(),
          new Date().toISOString()
        ]
      );

      return new Response(JSON.stringify({ 
        success: true, 
        data: { template }
      }), { 
        status: 201, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    } catch (error) {
      await this.sentry.captureError(error as Error);
      return new Response(JSON.stringify({ 
        success: false, 
        error: { message: 'Failed to create template' } 
      }), { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }
  }

  private async handleGetTemplate(request: Request, corsHeaders: Record<string, string>, env: any, templateId: number): Promise<Response> {
    try {
      const db = env.db;
      
      const [template] = await db.query(
        `SELECT * FROM nda_templates WHERE id = $1 AND is_active = true`,
        [templateId]
      );

      if (!template) {
        return new Response(JSON.stringify({ 
          success: false, 
          error: { message: 'Template not found' } 
        }), { 
          status: 404, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        });
      }

      return new Response(JSON.stringify({ 
        success: true, 
        data: { template }
      }), { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    } catch (error) {
      await this.sentry.captureError(error as Error);
      return new Response(JSON.stringify({ 
        success: false, 
        error: { message: 'Failed to fetch template' } 
      }), { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }
  }
}