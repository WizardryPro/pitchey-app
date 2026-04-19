import { Context } from "https://deno.land/x/hono@v3.12.0/mod.ts";
import { ContractService } from "../services/contract.service.ts";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

/**
 * Contract Management Handlers
 * Handles contract creation, signing, templates, and document generation
 */

// Validation schemas
const CreateContractSchema = z.object({
  templateId: z.string().uuid(),
  pitchId: z.string().uuid().optional(),
  investmentId: z.string().uuid().optional(),
  parties: z.array(z.object({
    userId: z.string().uuid(),
    role: z.enum(['creator', 'investor', 'production', 'platform']),
    signatureRequired: z.boolean().default(true),
  })),
  variables: z.record(z.string(), z.any()).default({}),
  metadata: z.record(z.string(), z.any()).optional(),
});

const SignContractSchema = z.object({
  signature: z.string(),
  signatureType: z.enum(['drawn', 'typed', 'upload']).default('typed'),
});

const CreateTemplateSchema = z.object({
  name: z.string(),
  type: z.enum(['nda', 'investment', 'production', 'distribution', 'licensing']),
  content: z.string(),
  variables: z.array(z.string()).default([]),
  clauses: z.array(z.object({
    title: z.string(),
    content: z.string(),
    isRequired: z.boolean().default(true),
    order: z.number(),
  })).default([]),
});

export class ContractHandlers {
  private contractService: ContractService;

  constructor(databaseUrl: string) {
    this.contractService = new ContractService(databaseUrl);
  }

  async initialize() {
    await this.contractService.connect();
  }

  async cleanup() {
    await this.contractService.disconnect();
  }

  /**
   * POST /api/contracts
   * Create a new contract
   */
  async createContract(c: Context) {
    try {
      const userId = c.get('userId');
      const body = await c.req.json();
      const validated = CreateContractSchema.parse(body);

      // Ensure requesting user is included in parties
      const userIncluded = validated.parties.some(p => p.userId === userId);
      if (!userIncluded) {
        return c.json({ error: "Creator must be included in contract parties" }, 400);
      }

      const contract = await this.contractService.createContract(
        validated.templateId,
        validated.parties,
        validated.variables,
        {
          ...validated.metadata,
          pitchId: validated.pitchId,
          investmentId: validated.investmentId,
        }
      );

      return c.json({
        success: true,
        contract,
      });
    } catch (error) {
      console.error("Error creating contract:", error);
      return c.json({ error: "Failed to create contract" }, 500);
    }
  }

  /**
   * GET /api/contracts
   * List user's contracts
   */
  async listContracts(c: Context) {
    try {
      const userId = c.get('userId');
      const { status, page = '1', limit = '20' } = c.req.query();

      const contracts = await this.contractService.getUserContracts(userId, status);
      
      // Paginate results
      const pageNum = parseInt(page);
      const limitNum = parseInt(limit);
      const start = (pageNum - 1) * limitNum;
      const paginatedContracts = contracts.slice(start, start + limitNum);

      return c.json({
        contracts: paginatedContracts,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total: contracts.length,
          pages: Math.ceil(contracts.length / limitNum),
        },
      });
    } catch (error) {
      console.error("Error listing contracts:", error);
      return c.json({ error: "Failed to list contracts" }, 500);
    }
  }

  /**
   * GET /api/contracts/:id
   * Get contract details
   */
  async getContract(c: Context) {
    try {
      const userId = c.get('userId');
      const contractId = c.req.param('id');

      // Get contract from database
      const result = await c.env.DB.prepare(`
        SELECT c.*, cp.role, cp.signed_at, cp.signature_required
        FROM contracts c
        JOIN contract_parties cp ON c.id = cp.contract_id
        WHERE c.id = ? AND cp.user_id = ?
      `).bind(contractId, userId).first();

      if (!result) {
        return c.json({ error: "Contract not found or unauthorized" }, 404);
      }

      // Get all parties
      const parties = await c.env.DB.prepare(`
        SELECT 
          cp.*, 
          u.name, 
          u.email,
          u.avatar_url
        FROM contract_parties cp
        JOIN users u ON cp.user_id = u.id
        WHERE cp.contract_id = ?
      `).bind(contractId).all();

      // Get signature status
      const signatures = await c.env.DB.prepare(`
        SELECT * FROM contract_signatures
        WHERE contract_id = ?
        ORDER BY signed_at DESC
      `).bind(contractId).all();

      return c.json({
        contract: result,
        parties: parties.results || [],
        signatures: signatures.results || [],
      });
    } catch (error) {
      console.error("Error getting contract:", error);
      return c.json({ error: "Failed to get contract" }, 500);
    }
  }

  /**
   * POST /api/contracts/:id/send
   * Send contract for signatures
   */
  async sendForSignature(c: Context) {
    try {
      const userId = c.get('userId');
      const contractId = c.req.param('id');
      const { message } = await c.req.json();

      // Verify user owns the contract
      const owner = await c.env.DB.prepare(`
        SELECT 1 FROM contracts 
        WHERE id = ? AND created_by = ?
      `).bind(contractId, userId).first();

      if (!owner) {
        return c.json({ error: "Unauthorized" }, 403);
      }

      await this.contractService.sendForSignature(contractId, message);

      return c.json({
        success: true,
        message: "Contract sent for signatures",
      });
    } catch (error) {
      console.error("Error sending for signature:", error);
      return c.json({ error: "Failed to send for signature" }, 500);
    }
  }

  /**
   * POST /api/contracts/:id/sign
   * Sign a contract
   */
  async signContract(c: Context) {
    try {
      const userId = c.get('userId');
      const contractId = c.req.param('id');
      const body = await c.req.json();
      const validated = SignContractSchema.parse(body);

      // Get IP address from request
      const ipAddress = c.req.header('CF-Connecting-IP') || 
                       c.req.header('X-Forwarded-For') || 
                       c.req.header('X-Real-IP');

      await this.contractService.signContract(
        contractId,
        userId,
        validated.signature,
        ipAddress
      );

      return c.json({
        success: true,
        message: "Contract signed successfully",
      });
    } catch (error) {
      console.error("Error signing contract:", error);
      return c.json({ error: error.message || "Failed to sign contract" }, 500);
    }
  }

  /**
   * GET /api/contracts/:id/pdf
   * Generate PDF of contract
   */
  async generatePDF(c: Context) {
    try {
      const userId = c.get('userId');
      const contractId = c.req.param('id');

      // Verify user has access
      const access = await c.env.DB.prepare(`
        SELECT 1 FROM contract_parties
        WHERE contract_id = ? AND user_id = ?
      `).bind(contractId, userId).first();

      if (!access) {
        return c.json({ error: "Unauthorized" }, 403);
      }

      const pdfBytes = await this.contractService.generatePDF(contractId);

      return new Response(pdfBytes, {
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename="contract-${contractId}.pdf"`,
        },
      });
    } catch (error) {
      console.error("Error generating PDF:", error);
      return c.json({ error: "Failed to generate PDF" }, 500);
    }
  }

  /**
   * POST /api/contracts/:id/terminate
   * Terminate a contract
   */
  async terminateContract(c: Context) {
    try {
      const userId = c.get('userId');
      const contractId = c.req.param('id');
      const { reason } = await c.req.json();

      // Check termination rights
      const canTerminate = await c.env.DB.prepare(`
        SELECT 1 FROM contract_parties
        WHERE contract_id = ? 
          AND user_id = ?
          AND role IN ('creator', 'platform')
      `).bind(contractId, userId).first();

      if (!canTerminate) {
        return c.json({ error: "No termination rights" }, 403);
      }

      // Update contract status
      await c.env.DB.prepare(`
        UPDATE contracts
        SET status = 'terminated',
            termination_reason = ?,
            terminated_by = ?,
            terminated_at = datetime('now')
        WHERE id = ?
      `).bind(reason, userId, contractId).run();

      // Notify all parties
      const parties = await c.env.DB.prepare(`
        SELECT user_id FROM contract_parties
        WHERE contract_id = ?
      `).bind(contractId).all();

      for (const party of parties.results || []) {
        await c.env.DB.prepare(`
          INSERT INTO notifications (
            id, user_id, type, title, message, metadata, created_at
          )
          VALUES (?, ?, 'contract_terminated', ?, ?, ?, datetime('now'))
        `).bind(
          crypto.randomUUID(),
          party.user_id,
          'Contract Terminated',
          'A contract you are party to has been terminated',
          JSON.stringify({ contract_id: contractId, reason })
        ).run();
      }

      return c.json({
        success: true,
        message: "Contract terminated",
      });
    } catch (error) {
      console.error("Error terminating contract:", error);
      return c.json({ error: "Failed to terminate contract" }, 500);
    }
  }

  /**
   * GET /api/contracts/templates
   * List available contract templates
   */
  async listTemplates(c: Context) {
    try {
      const { type } = c.req.query();

      const query = type
        ? `SELECT * FROM contract_templates WHERE type = ? AND is_active = 1`
        : `SELECT * FROM contract_templates WHERE is_active = 1`;

      const templates = type
        ? await c.env.DB.prepare(query).bind(type).all()
        : await c.env.DB.prepare(query).all();

      return c.json({
        templates: templates.results || [],
      });
    } catch (error) {
      console.error("Error listing templates:", error);
      return c.json({ error: "Failed to list templates" }, 500);
    }
  }

  /**
   * POST /api/contracts/templates
   * Create a new contract template (admin only)
   */
  async createTemplate(c: Context) {
    try {
      const userType = c.get('userType');
      
      // Only platform admins can create templates
      if (userType !== 'admin') {
        return c.json({ error: "Unauthorized" }, 403);
      }

      const body = await c.req.json();
      const validated = CreateTemplateSchema.parse(body);

      const templateId = crypto.randomUUID();

      // Create template
      await c.env.DB.prepare(`
        INSERT INTO contract_templates (
          id, name, type, content, variables, version, is_active, created_at
        )
        VALUES (?, ?, ?, ?, ?, '1.0', 1, datetime('now'))
      `).bind(
        templateId,
        validated.name,
        validated.type,
        validated.content,
        JSON.stringify(validated.variables)
      ).run();

      // Add clauses
      for (const clause of validated.clauses) {
        await c.env.DB.prepare(`
          INSERT INTO contract_clauses (
            id, template_id, title, content, is_required, "order", created_at
          )
          VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
        `).bind(
          crypto.randomUUID(),
          templateId,
          clause.title,
          clause.content,
          clause.isRequired,
          clause.order
        ).run();
      }

      return c.json({
        success: true,
        templateId,
      });
    } catch (error) {
      console.error("Error creating template:", error);
      return c.json({ error: "Failed to create template" }, 500);
    }
  }

  /**
   * POST /api/contracts/:id/amend
   * Create an amendment to existing contract
   */
  async amendContract(c: Context) {
    try {
      const userId = c.get('userId');
      const contractId = c.req.param('id');
      const { changes, reason } = await c.req.json();

      // Verify user can amend
      const canAmend = await c.env.DB.prepare(`
        SELECT 1 FROM contract_parties
        WHERE contract_id = ? 
          AND user_id = ?
          AND role IN ('creator', 'platform')
      `).bind(contractId, userId).first();

      if (!canAmend) {
        return c.json({ error: "No amendment rights" }, 403);
      }

      // Get current contract
      const current = await c.env.DB.prepare(`
        SELECT content FROM contracts WHERE id = ?
      `).bind(contractId).first();

      // Apply changes to content
      let newContent = current.content;
      for (const change of changes) {
        newContent = newContent.replace(change.old, change.new);
      }

      // Create new version
      await this.contractService.createVersion(contractId, newContent, reason);

      // Update contract
      await c.env.DB.prepare(`
        UPDATE contracts
        SET content = ?,
            status = 'pending_signature',
            updated_at = datetime('now')
        WHERE id = ?
      `).bind(newContent, contractId).run();

      // Reset signatures (requires re-signing)
      await c.env.DB.prepare(`
        UPDATE contract_parties
        SET signed_at = NULL,
            ip_address = NULL
        WHERE contract_id = ?
      `).bind(contractId).run();

      // Send for new signatures
      await this.contractService.sendForSignature(contractId, `Contract amended: ${reason}`);

      return c.json({
        success: true,
        message: "Contract amended and sent for re-signature",
      });
    } catch (error) {
      console.error("Error amending contract:", error);
      return c.json({ error: "Failed to amend contract" }, 500);
    }
  }

  /**
   * GET /api/contracts/:id/versions
   * Get contract version history
   */
  async getVersions(c: Context) {
    try {
      const userId = c.get('userId');
      const contractId = c.req.param('id');

      // Verify access
      const access = await c.env.DB.prepare(`
        SELECT 1 FROM contract_parties
        WHERE contract_id = ? AND user_id = ?
      `).bind(contractId, userId).first();

      if (!access) {
        return c.json({ error: "Unauthorized" }, 403);
      }

      const versions = await c.env.DB.prepare(`
        SELECT * FROM contract_versions
        WHERE contract_id = ?
        ORDER BY created_at DESC
      `).bind(contractId).all();

      return c.json({
        versions: versions.results || [],
      });
    } catch (error) {
      console.error("Error getting versions:", error);
      return c.json({ error: "Failed to get versions" }, 500);
    }
  }

  /**
   * POST /api/contracts/bulk-send
   * Send multiple contracts (e.g., NDAs to multiple investors)
   */
  async bulkSendContracts(c: Context) {
    try {
      const userId = c.get('userId');
      const { templateId, recipientIds, variables, message } = await c.req.json();

      const contracts = [];
      
      for (const recipientId of recipientIds) {
        // Create individual contract for each recipient
        const contract = await this.contractService.createContract(
          templateId,
          [
            { userId, role: 'creator', signatureRequired: true },
            { userId: recipientId, role: 'investor', signatureRequired: true },
          ],
          variables,
          { bulk_send: true }
        );

        // Send for signature
        await this.contractService.sendForSignature(contract.id, message);
        contracts.push(contract);
      }

      return c.json({
        success: true,
        contracts,
        message: `${contracts.length} contracts sent`,
      });
    } catch (error) {
      console.error("Error bulk sending contracts:", error);
      return c.json({ error: "Failed to bulk send contracts" }, 500);
    }
  }
}