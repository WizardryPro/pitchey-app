/**
 * Pitchey Workflows - Main Worker Entry Point
 * 
 * This Worker serves as the entry point for all workflow operations. It handles:
 * - HTTP triggers for starting new workflow instances
 * - Webhook handlers for external services (DocuSign, Stripe, etc.)
 * - REST API for querying workflow status
 * - Event routing to running workflow instances
 * 
 * The Worker binds to all three workflow classes and routes requests appropriately.
 */

import { InvestmentDealWorkflow } from './investment-deal-workflow';
import { ProductionDealWorkflow } from './production-deal-cf-workflow';
import { NDAWorkflow } from './nda-workflow';

// ============================================================================
// Type Definitions
// ============================================================================

interface Env {
  // Workflow bindings - defined in wrangler.toml
  INVESTMENT_WORKFLOW: Workflow;
  PRODUCTION_WORKFLOW: Workflow;
  NDA_WORKFLOW: Workflow;
  
  // Database
  HYPERDRIVE: Hyperdrive;
  DATABASE_URL: string;
  
  // Storage
  DOCUMENTS: R2Bucket;
  DEAL_CACHE: KVNamespace;
  NDA_TEMPLATES: KVNamespace;
  
  // Queues
  NOTIFICATION_QUEUE: Queue;
  
  // Secrets (configured via wrangler secret)
  DOCUSIGN_API_KEY: string;
  DOCUSIGN_ACCOUNT_ID: string;
  WEBHOOK_SECRET: string;
  STRIPE_SECRET_KEY: string;
  STRIPE_WEBHOOK_SECRET: string;
  
  // Environment
  WORKFLOW_INSTANCE_ID?: string;
  ENVIRONMENT: string;
}

// ============================================================================
// Main Worker
// ============================================================================

export default {
  /**
   * Main fetch handler - routes incoming requests to appropriate handlers.
   */
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;
    
    // CORS headers for cross-origin requests from frontend
    const corsHeaders = {
      'Access-Control-Allow-Origin': env.ENVIRONMENT === 'production' 
        ? 'https://pitchey.pages.dev'
        : '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-User-ID, X-User-Type',
      'Access-Control-Allow-Credentials': 'true'
    };
    
    // Handle preflight requests
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }
    
    try {
      // Route based on path
      
      // ======================================================================
      // Investment Deal Endpoints
      // ======================================================================
      
      if (path === '/api/workflows/investment/create' && request.method === 'POST') {
        return await handleCreateInvestmentDeal(request, env, corsHeaders);
      }
      
      if (path.match(/^\/api\/workflows\/investment\/([^\/]+)\/status$/) && request.method === 'GET') {
        const instanceId = path.split('/')[4];
        return await handleGetWorkflowStatus(env.INVESTMENT_WORKFLOW, instanceId, corsHeaders);
      }
      
      if (path.match(/^\/api\/workflows\/investment\/([^\/]+)\/event$/) && request.method === 'POST') {
        const instanceId = path.split('/')[4];
        return await handleSendEvent(request, env.INVESTMENT_WORKFLOW, instanceId, corsHeaders);
      }
      
      // ======================================================================
      // Production Deal Endpoints
      // ======================================================================
      
      if (path === '/api/workflows/production/create' && request.method === 'POST') {
        return await handleCreateProductionDeal(request, env, corsHeaders);
      }
      
      if (path.match(/^\/api\/workflows\/production\/([^\/]+)\/status$/) && request.method === 'GET') {
        const instanceId = path.split('/')[4];
        return await handleGetWorkflowStatus(env.PRODUCTION_WORKFLOW, instanceId, corsHeaders);
      }
      
      if (path.match(/^\/api\/workflows\/production\/([^\/]+)\/event$/) && request.method === 'POST') {
        const instanceId = path.split('/')[4];
        return await handleSendEvent(request, env.PRODUCTION_WORKFLOW, instanceId, corsHeaders);
      }
      
      // ======================================================================
      // NDA Endpoints
      // ======================================================================
      
      if (path === '/api/workflows/nda/create' && request.method === 'POST') {
        return await handleCreateNDA(request, env, corsHeaders);
      }
      
      if (path.match(/^\/api\/workflows\/nda\/([^\/]+)\/status$/) && request.method === 'GET') {
        const instanceId = path.split('/')[4];
        return await handleGetWorkflowStatus(env.NDA_WORKFLOW, instanceId, corsHeaders);
      }
      
      if (path.match(/^\/api\/workflows\/nda\/([^\/]+)\/event$/) && request.method === 'POST') {
        const instanceId = path.split('/')[4];
        return await handleSendEvent(request, env.NDA_WORKFLOW, instanceId, corsHeaders);
      }
      
      // ======================================================================
      // Bulk Operations
      // ======================================================================
      
      if (path === '/api/workflows/list' && request.method === 'GET') {
        return await handleListWorkflows(request, env, corsHeaders);
      }
      
      if (path === '/api/workflows/analytics' && request.method === 'GET') {
        return await handleGetAnalytics(request, env, corsHeaders);
      }
      
      // ======================================================================
      // Webhook Endpoints (for external services)
      // ======================================================================
      
      if (path === '/webhooks/docusign' && request.method === 'POST') {
        return await handleDocuSignWebhook(request, env, ctx, corsHeaders);
      }
      
      if (path === '/webhooks/stripe' && request.method === 'POST') {
        return await handleStripeWebhook(request, env, ctx, corsHeaders);
      }
      
      // ======================================================================
      // Health Check
      // ======================================================================
      
      if (path === '/health') {
        return Response.json({ 
          status: 'healthy',
          timestamp: new Date().toISOString(),
          version: '1.0.0',
          environment: env.ENVIRONMENT
        }, { headers: corsHeaders });
      }
      
      // 404 for unknown routes
      return Response.json(
        { error: 'Not Found', path },
        { status: 404, headers: corsHeaders }
      );
      
    } catch (error) {
      console.error('Worker error:', error);
      return Response.json(
        { error: 'Internal Server Error', message: (error as Error).message },
        { status: 500, headers: corsHeaders }
      );
    }
  },
  
  /**
   * Queue consumer handler for processing notification queue.
   * Notifications are added to the queue by workflows and processed asynchronously.
   */
  async queue(batch: MessageBatch<NotificationMessage>, env: Env): Promise<void> {
    for (const message of batch.messages) {
      try {
        await processNotification(message.body, env);
        message.ack();
      } catch (error) {
        console.error('Failed to process notification:', error);
        // Message will be retried automatically
        message.retry();
      }
    }
  }
};

// ============================================================================
// Workflow Creation Handlers
// ============================================================================

/**
 * Create a new investment deal workflow instance.
 * Called when an investor expresses interest in a pitch.
 */
async function handleCreateInvestmentDeal(
  request: Request,
  env: Env,
  corsHeaders: Record<string, string>
): Promise<Response> {
  const body = await request.json() as {
    investorId: string;
    pitchId: string;
    creatorId: string;
    proposedAmount: number;
    investmentType: string;
    message?: string;
    ndaAccepted: boolean;
  };
  
  // Validate required fields
  if (!body.investorId || !body.pitchId || !body.creatorId || !body.proposedAmount) {
    return Response.json(
      { error: 'Missing required fields' },
      { status: 400, headers: corsHeaders }
    );
  }
  
  // Validate investment amount
  if (body.proposedAmount < 1000) {
    return Response.json(
      { error: 'Minimum investment amount is $1,000' },
      { status: 400, headers: corsHeaders }
    );
  }
  
  // Create workflow instance with the provided parameters
  const instance = await env.INVESTMENT_WORKFLOW.create({
    params: body
  });
  
  // Log workflow creation
  console.log(`Created investment workflow ${instance.id} for pitch ${body.pitchId}`);
  
  return Response.json({
    success: true,
    instanceId: instance.id,
    message: 'Investment deal workflow started',
    estimatedProcessingTime: '7-14 days'
  }, { headers: corsHeaders });
}

/**
 * Create a new production deal workflow instance.
 * Called when a production company expresses interest in a pitch.
 */
async function handleCreateProductionDeal(
  request: Request,
  env: Env,
  corsHeaders: Record<string, string>
): Promise<Response> {
  const body = await request.json() as {
    productionCompanyId: string;
    productionCompanyUserId: string;
    pitchId: string;
    creatorId: string;
    interestType: string;
    message?: string;
    proposedBudget?: number;
    proposedTimeline?: string;
    ndaId?: string;
  };
  
  if (!body.productionCompanyId || !body.pitchId || !body.creatorId) {
    return Response.json(
      { error: 'Missing required fields' },
      { status: 400, headers: corsHeaders }
    );
  }
  
  // Validate interest type
  const validInterestTypes = ['option', 'purchase', 'co_production', 'distribution'];
  if (!validInterestTypes.includes(body.interestType)) {
    return Response.json(
      { error: 'Invalid interest type' },
      { status: 400, headers: corsHeaders }
    );
  }
  
  const instance = await env.PRODUCTION_WORKFLOW.create({
    params: body
  });
  
  console.log(`Created production workflow ${instance.id} for pitch ${body.pitchId}`);
  
  return Response.json({
    success: true,
    instanceId: instance.id,
    message: 'Production deal workflow started',
    note: 'Creator will be notified of your interest'
  }, { headers: corsHeaders });
}

/**
 * Create a new NDA workflow instance.
 * Called when someone requests access to confidential pitch materials.
 */
async function handleCreateNDA(
  request: Request,
  env: Env,
  corsHeaders: Record<string, string>
): Promise<Response> {
  const body = await request.json() as {
    requesterId: string;
    requesterType: string;
    requesterEmail: string;
    requesterName: string;
    creatorId: string;
    pitchId: string;
    templateId: string;
    customTerms?: Record<string, any>;
    durationMonths?: number;
    territorialRestrictions?: string[];
  };
  
  if (!body.requesterId || !body.pitchId || !body.creatorId || !body.requesterEmail) {
    return Response.json(
      { error: 'Missing required fields' },
      { status: 400, headers: corsHeaders }
    );
  }
  
  // Validate email format (safe linear-time pattern)
  const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
  if (!emailRegex.test(body.requesterEmail)) {
    return Response.json(
      { error: 'Invalid email format' },
      { status: 400, headers: corsHeaders }
    );
  }
  
  const instance = await env.NDA_WORKFLOW.create({
    params: body
  });
  
  console.log(`Created NDA workflow ${instance.id} for pitch ${body.pitchId}`);
  
  return Response.json({
    success: true,
    instanceId: instance.id,
    message: 'NDA workflow started',
    estimatedProcessingTime: 'Immediate for standard NDAs, 24-48 hours for custom terms'
  }, { headers: corsHeaders });
}

// ============================================================================
// Workflow Status and Event Handlers
// ============================================================================

/**
 * Get the current status of a workflow instance.
 * Returns the workflow state, current step, and any output.
 */
async function handleGetWorkflowStatus(
  workflow: Workflow,
  instanceId: string,
  corsHeaders: Record<string, string>
): Promise<Response> {
  try {
    const instance = await workflow.get(instanceId);
    const status = await instance.status();
    
    return Response.json({
      instanceId,
      status: status.status,
      output: status.output,
      error: status.error
    }, { headers: corsHeaders });
  } catch (error) {
    return Response.json(
      { error: 'Workflow instance not found', instanceId },
      { status: 404, headers: corsHeaders }
    );
  }
}

/**
 * Send an event to a running workflow instance.
 * This is how external systems (and the frontend) communicate decisions
 * to waiting workflows.
 * 
 * Example: Creator approves an investment deal
 * POST /api/workflows/investment/{instanceId}/event
 * {
 *   "type": "creator-decision",
 *   "payload": {
 *     "decision": "approve",
 *     "decidedAt": "2024-01-15T10:30:00Z"
 *   }
 * }
 */
async function handleSendEvent(
  request: Request,
  workflow: Workflow,
  instanceId: string,
  corsHeaders: Record<string, string>
): Promise<Response> {
  const body = await request.json() as {
    type: string;
    payload: any;
  };
  
  if (!body.type) {
    return Response.json(
      { error: 'Event type is required' },
      { status: 400, headers: corsHeaders }
    );
  }
  
  try {
    const instance = await workflow.get(instanceId);
    
    // Send the event to the workflow instance
    // This will unblock any waitForEvent call with a matching type
    await instance.sendEvent({
      type: body.type,
      payload: body.payload
    });
    
    console.log(`Sent event '${body.type}' to workflow ${instanceId}`);
    
    return Response.json({
      success: true,
      message: `Event '${body.type}' sent to workflow instance`
    }, { headers: corsHeaders });
  } catch (error) {
    return Response.json(
      { error: 'Failed to send event', message: (error as Error).message },
      { status: 500, headers: corsHeaders }
    );
  }
}

/**
 * List all workflow instances for a user or pitch.
 */
async function handleListWorkflows(
  request: Request,
  env: Env,
  corsHeaders: Record<string, string>
): Promise<Response> {
  const url = new URL(request.url);
  const userId = url.searchParams.get('userId');
  const pitchId = url.searchParams.get('pitchId');
  const type = url.searchParams.get('type'); // 'investment', 'production', or 'nda'
  
  if (!userId && !pitchId) {
    return Response.json(
      { error: 'Either userId or pitchId is required' },
      { status: 400, headers: corsHeaders }
    );
  }
  
  const { neon } = await import('@neondatabase/serverless');
  const db = neon(env.DATABASE_URL);
  
  const workflows = [];
  
  // Get investment workflows
  if (!type || type === 'investment') {
    const investments = await db(`
      SELECT 
        id, workflow_instance_id, investor_id, creator_id, 
        pitch_id, proposed_amount, agreed_amount, status, created_at
      FROM investment_deals
      WHERE ${userId ? '(investor_id = $1 OR creator_id = $1)' : 'pitch_id = $1'}
      ORDER BY created_at DESC
      LIMIT 50
    `, [userId || pitchId]);
    
    workflows.push(...investments.map(i => ({ ...i, type: 'investment' })));
  }
  
  // Get production workflows
  if (!type || type === 'production') {
    const productions = await db(`
      SELECT 
        id, workflow_instance_id, production_company_id, creator_id,
        pitch_id, interest_type, status, created_at
      FROM production_deals
      WHERE ${userId ? '(production_company_user_id = $1 OR creator_id = $1)' : 'pitch_id = $1'}
      ORDER BY created_at DESC
      LIMIT 50
    `, [userId || pitchId]);
    
    workflows.push(...productions.map(p => ({ ...p, type: 'production' })));
  }
  
  // Get NDA workflows
  if (!type || type === 'nda') {
    const ndas = await db(`
      SELECT 
        id, workflow_instance_id, requester_id, creator_id,
        pitch_id, status, risk_level, created_at, expiration_date
      FROM ndas
      WHERE ${userId ? '(requester_id = $1 OR creator_id = $1)' : 'pitch_id = $1'}
      ORDER BY created_at DESC
      LIMIT 50
    `, [userId || pitchId]);
    
    workflows.push(...ndas.map(n => ({ ...n, type: 'nda' })));
  }
  
  // Sort by created_at
  workflows.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  
  return Response.json({
    success: true,
    workflows: workflows.slice(0, 50),
    total: workflows.length
  }, { headers: corsHeaders });
}

/**
 * Get analytics and metrics for workflows.
 */
async function handleGetAnalytics(
  request: Request,
  env: Env,
  corsHeaders: Record<string, string>
): Promise<Response> {
  const url = new URL(request.url);
  const pitchId = url.searchParams.get('pitchId');
  const creatorId = url.searchParams.get('creatorId');
  
  if (!pitchId && !creatorId) {
    return Response.json(
      { error: 'Either pitchId or creatorId is required' },
      { status: 400, headers: corsHeaders }
    );
  }
  
  const { neon } = await import('@neondatabase/serverless');
  const db = neon(env.DATABASE_URL);
  
  const analytics: any = {};
  
  if (pitchId) {
    // Get pitch-specific analytics
    analytics.pitch = {
      totalInvestmentInterest: await db(`
        SELECT COUNT(*) as count, SUM(proposed_amount) as total
        FROM investment_deals
        WHERE pitch_id = $1
      `, [pitchId]).then(r => r[0]),
      
      investmentFunnel: await db(`
        SELECT status, COUNT(*) as count
        FROM investment_deals
        WHERE pitch_id = $1
        GROUP BY status
      `, [pitchId]),
      
      productionInterest: await db(`
        SELECT interest_type, COUNT(*) as count
        FROM production_deals
        WHERE pitch_id = $1
        GROUP BY interest_type
      `, [pitchId]),
      
      ndaStats: await db(`
        SELECT 
          COUNT(*) as total,
          SUM(CASE WHEN status = 'ACTIVE' THEN 1 ELSE 0 END) as active,
          AVG(risk_score) as avg_risk_score
        FROM ndas
        WHERE pitch_id = $1
      `, [pitchId]).then(r => r[0])
    };
  }
  
  if (creatorId) {
    // Get creator-specific analytics
    analytics.creator = {
      totalPitches: await db(`
        SELECT COUNT(*) as count
        FROM pitches
        WHERE user_id = $1
      `, [creatorId]).then(r => r[0].count),
      
      totalInvestmentReceived: await db(`
        SELECT SUM(agreed_amount) as total
        FROM investment_deals
        WHERE creator_id = $1 AND status = 'FUNDED'
      `, [creatorId]).then(r => r[0].total || 0),
      
      activeDeals: {
        investment: await db(`
          SELECT COUNT(*) as count
          FROM investment_deals
          WHERE creator_id = $1 AND status NOT IN ('COMPLETED', 'REJECTED', 'EXPIRED')
        `, [creatorId]).then(r => r[0].count),
        
        production: await db(`
          SELECT COUNT(*) as count
          FROM production_deals
          WHERE creator_id = $1 AND status NOT IN ('COMPLETED', 'REJECTED', 'EXPIRED')
        `, [creatorId]).then(r => r[0].count)
      },
      
      conversionRates: {
        investmentToFunding: await db(`
          SELECT 
            COUNT(CASE WHEN status = 'INTEREST' THEN 1 END) as interests,
            COUNT(CASE WHEN status = 'FUNDED' THEN 1 END) as funded
          FROM investment_deals
          WHERE creator_id = $1
        `, [creatorId]).then(r => {
          const { interests, funded } = r[0];
          return interests > 0 ? (funded / interests * 100).toFixed(2) + '%' : '0%';
        })
      }
    };
  }
  
  return Response.json({
    success: true,
    analytics
  }, { headers: corsHeaders });
}

// ============================================================================
// Webhook Handlers
// ============================================================================

/**
 * Handle DocuSign Connect webhook notifications.
 * DocuSign sends these when document status changes (sent, viewed, signed, etc.)
 */
async function handleDocuSignWebhook(
  request: Request,
  env: Env,
  ctx: ExecutionContext,
  corsHeaders: Record<string, string>
): Promise<Response> {
  // Verify webhook signature
  const signature = request.headers.get('X-DocuSign-Signature-1');
  if (!signature) {
    return Response.json({ error: 'Missing signature' }, { status: 401, headers: corsHeaders });
  }
  
  // Validate HMAC-SHA256 signature if secret is configured
  let body: {
    event: string;
    data: {
      envelopeId: string;
      envelopeSummary: {
        status: string;
        completedDateTime?: string;
        declinedDateTime?: string;
        voidedReason?: string;
      };
      recipients?: {
        signers: Array<{
          email: string;
          name: string;
          status: string;
          signedDateTime?: string;
        }>;
      };
    };
  };

  if (env.WEBHOOK_SECRET) {
    const bodyText = await request.text();
    const key = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(env.WEBHOOK_SECRET),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );
    const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(bodyText));
    const expected = btoa(String.fromCharCode(...new Uint8Array(sig)));
    if (signature !== expected) {
      return Response.json({ error: 'Invalid signature' }, { status: 401, headers: corsHeaders });
    }
    body = JSON.parse(bodyText);
  } else {
    body = await request.json() as typeof body;
  }
  
  console.log(`DocuSign webhook received: ${body.event} for envelope ${body.data.envelopeId}`);
  
  // Look up which workflow instance this envelope belongs to
  const { neon } = await import('@neondatabase/serverless');
  const db = neon(env.DATABASE_URL);
  
  const result = await db(`
    SELECT workflow_instance_id 
    FROM ndas 
    WHERE envelope_id = $1
    LIMIT 1
  `, [body.data.envelopeId]);
  
  if (result.length === 0) {
    console.warn(`Unknown envelope: ${body.data.envelopeId}`);
    return Response.json({ received: true }, { headers: corsHeaders });
  }
  
  const instanceId = result[0].workflow_instance_id;
  
  // Map DocuSign status to our event format
  const statusMap: Record<string, string> = {
    'sent': 'sent',
    'delivered': 'delivered',
    'completed': 'completed',
    'declined': 'declined',
    'voided': 'voided'
  };
  
  const mappedStatus = statusMap[body.data.envelopeSummary.status] || body.data.envelopeSummary.status;
  
  // Send event to the NDA workflow instance
  ctx.waitUntil(
    (async () => {
      try {
        const instance = await env.NDA_WORKFLOW.get(instanceId);
        await instance.sendEvent({
          type: 'signature-status',
          payload: {
            envelopeId: body.data.envelopeId,
            status: mappedStatus,
            signedAt: body.data.envelopeSummary.completedDateTime,
            declinedReason: body.data.envelopeSummary.voidedReason
          }
        });
        console.log(`Sent DocuSign event to workflow ${instanceId}`);
      } catch (error) {
        console.error('Failed to send DocuSign event to workflow:', error);
      }
    })()
  );
  
  return Response.json({ received: true }, { headers: corsHeaders });
}

/**
 * Handle Stripe webhook notifications.
 * Used for escrow deposit confirmations in investment deals.
 */
async function handleStripeWebhook(
  request: Request,
  env: Env,
  ctx: ExecutionContext,
  corsHeaders: Record<string, string>
): Promise<Response> {
  // Verify Stripe webhook signature
  const signature = request.headers.get('Stripe-Signature');
  if (!signature) {
    return Response.json({ error: 'Missing signature' }, { status: 401, headers: corsHeaders });
  }
  
  // Validate Stripe signature (t=timestamp,v1=hash format) if secret is configured
  let body: {
    type: string;
    data: {
      object: {
        id: string;
        metadata: {
          dealId?: string;
          workflowInstanceId?: string;
        };
        amount: number;
        created: number;
        status?: string;
      };
    };
  };

  if (env.STRIPE_WEBHOOK_SECRET) {
    const bodyText = await request.text();
    const parts = Object.fromEntries(
      signature.split(',').map((p: string) => {
        const [k, v] = p.split('=');
        return [k, v];
      })
    );
    const payload = `${parts.t}.${bodyText}`;
    const key = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(env.STRIPE_WEBHOOK_SECRET),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );
    const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload));
    const expected = [...new Uint8Array(sig)].map(b => b.toString(16).padStart(2, '0')).join('');
    if (expected !== parts.v1) {
      return Response.json({ error: 'Invalid signature' }, { status: 401, headers: corsHeaders });
    }
    body = JSON.parse(bodyText);
  } else {
    body = await request.json() as typeof body;
  }
  
  console.log(`Stripe webhook received: ${body.type}`);
  
  // Handle relevant Stripe events
  if (body.type === 'transfer.created' || body.type === 'payment_intent.succeeded') {
    const metadata = body.data.object.metadata;
    
    if (metadata.workflowInstanceId) {
      ctx.waitUntil(
        (async () => {
          try {
            const instance = await env.INVESTMENT_WORKFLOW.get(metadata.workflowInstanceId);
            await instance.sendEvent({
              type: 'escrow-confirmed',
              payload: {
                transactionId: body.data.object.id,
                amount: body.data.object.amount / 100, // Convert from cents
                confirmedAt: new Date(body.data.object.created * 1000).toISOString()
              }
            });
            console.log(`Sent Stripe event to workflow ${metadata.workflowInstanceId}`);
          } catch (error) {
            console.error('Failed to send Stripe event to workflow:', error);
          }
        })()
      );
    }
  }
  
  return Response.json({ received: true }, { headers: corsHeaders });
}

// ============================================================================
// Notification Processing
// ============================================================================

interface NotificationMessage {
  type: string;
  recipientId: string;
  recipientType: string;
  data: Record<string, any>;
  channels: string[];
  priority: string;
}

/**
 * Process a notification message from the queue.
 * Routes to appropriate delivery channels (email, push, in-app).
 */
async function processNotification(
  notification: NotificationMessage,
  env: Env
): Promise<void> {
  const { type, recipientId, recipientType, data, channels, priority } = notification;
  
  console.log(`Processing ${priority} notification: ${type} for ${recipientType} ${recipientId}`);
  
  // Get recipient contact info from database
  const { neon } = await import('@neondatabase/serverless');
  const db = neon(env.DATABASE_URL);
  
  // Special handling for internal recipients
  if (recipientId === 'legal-team') {
    // Send to all legal team members
    const legalTeam = await db(`
      SELECT email FROM users WHERE user_type = 'admin' AND department = 'legal'
    `);
    
    for (const member of legalTeam) {
      await sendEmail(member.email, type, data, env);
    }
    return;
  }
  
  const recipientResult = await db(`
    SELECT email, push_token, notification_preferences
    FROM users
    WHERE id = $1
  `, [recipientId]);
  
  if (recipientResult.length === 0) {
    console.warn(`Recipient not found: ${recipientId}`);
    return;
  }
  
  const recipient = recipientResult[0];
  const preferences = recipient.notification_preferences || {};
  
  // Process each requested channel
  for (const channel of channels) {
    // Check if recipient has this channel enabled for this notification type
    if (preferences[type]?.[channel] === false) {
      continue;
    }
    
    switch (channel) {
      case 'email':
        await sendEmail(recipient.email, type, data, env);
        break;
      case 'push':
        if (recipient.push_token) {
          await sendPushNotification(recipient.push_token, type, data, env);
        }
        break;
      case 'in_app':
        await createInAppNotification(db, recipientId, type, data);
        break;
    }
  }
}

// Notification delivery functions
async function sendEmail(
  email: string, 
  type: string, 
  data: Record<string, any>,
  env: Env
): Promise<void> {
  // In production, integrate with email service (SendGrid, Postmark, etc.)
  console.log(`[EMAIL] To: ${email}, Type: ${type}, Data:`, data);
  
  // Example SendGrid integration:
  // const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
  //   method: 'POST',
  //   headers: {
  //     'Authorization': `Bearer ${env.SENDGRID_API_KEY}`,
  //     'Content-Type': 'application/json'
  //   },
  //   body: JSON.stringify({
  //     personalizations: [{ to: [{ email }] }],
  //     from: { email: 'notifications@pitchey.com', name: 'Pitchey' },
  //     subject: getEmailSubject(type, data),
  //     content: [{ type: 'text/html', value: getEmailContent(type, data) }]
  //   })
  // });
}

async function sendPushNotification(
  token: string, 
  type: string, 
  data: Record<string, any>,
  env: Env
): Promise<void> {
  // In production, integrate with push service (Firebase, APNs, etc.)
  console.log(`[PUSH] Token: ${token}, Type: ${type}, Data:`, data);
}

async function createInAppNotification(
  db: any,
  recipientId: string,
  type: string,
  data: Record<string, any>
): Promise<void> {
  await db(`
    INSERT INTO notifications (id, user_id, type, data, created_at, read)
    VALUES ($1, $2, $3, $4, NOW(), false)
  `, [crypto.randomUUID(), recipientId, type, JSON.stringify(data)]);
}

// ============================================================================
// Export Workflow Classes
// ============================================================================
// These exports are required for Cloudflare to bind the workflow classes

export { InvestmentDealWorkflow } from './investment-deal-workflow';
export { ProductionDealWorkflow } from './production-deal-cf-workflow';
export { NDAWorkflow } from './nda-workflow';