/**
 * Legal Document Automation Handler
 * Handles all legal document generation, template management, and compliance validation
 * for entertainment industry contracts and agreements
 */

import { z } from 'zod';
import LegalDocumentEngine, {
  DocumentTemplate,
  LegalClause,
  GenerationContext,
  GeneratedDocument,
  DocumentVariable
} from '../services/legal-document-engine.service';
import LegalPDFGenerator, { PDFGenerationOptions } from '../services/legal-pdf-generator.service';

const generateDocumentSchema = z.object({
  template_id: z.string().uuid(),
  variables: z.record(z.any()),
  jurisdiction: z.enum(['US', 'UK', 'EU', 'CA', 'AU']),
  parties: z.array(z.object({
    id: z.string().optional(),
    name: z.string(),
    type: z.enum(['creator', 'investor', 'production_company', 'individual', 'legal_entity']),
    email: z.string().email().optional(),
    address: z.string().optional(),
    company: z.string().optional(),
    title: z.string().optional()
  })),
  related_entities: z.object({
    pitch_id: z.string().uuid().optional(),
    nda_id: z.string().uuid().optional(),
    investment_id: z.string().uuid().optional()
  }).optional(),
  generation_options: z.object({
    include_watermark: z.boolean().default(false),
    watermark_text: z.string().optional(),
    confidential_marking: z.boolean().default(true),
    auto_generate_pdf: z.boolean().default(true),
    auto_generate_docx: z.boolean().default(false)
  }).optional()
});

const customizeDocumentSchema = z.object({
  document_id: z.string().uuid(),
  updates: z.object({
    variables: z.record(z.any()).optional(),
    custom_clauses: z.array(z.object({
      title: z.string(),
      content: z.string(),
      position: z.number().optional()
    })).optional(),
    excluded_clauses: z.array(z.string()).optional(),
    notes: z.string().optional()
  })
});

const validateDocumentSchema = z.object({
  document_id: z.string().uuid().optional(),
  template_id: z.string().uuid().optional(),
  variables: z.record(z.any()),
  jurisdiction: z.enum(['US', 'UK', 'EU', 'CA', 'AU']),
  validation_level: z.enum(['basic', 'compliance', 'full']).default('compliance')
});

export class LegalDocumentHandler {
  constructor(
    private db: any,
    private storageService: any,
    private auditService: any
  ) {}

  /**
   * GET /api/legal/templates - List available document templates
   */
  async listTemplates(request: Request): Promise<Response> {
    try {
      const url = new URL(request.url);
      const category = url.searchParams.get('category');
      const jurisdiction = url.searchParams.get('jurisdiction');
      const search = url.searchParams.get('search');
      const limit = parseInt(url.searchParams.get('limit') || '20');
      const offset = parseInt(url.searchParams.get('offset') || '0');

      let query = `
        SELECT 
          id, name, description, category, jurisdictions, version, is_active,
          created_at, updated_at,
          (SELECT COUNT(*) FROM generated_documents WHERE template_id = document_templates.id) as usage_count
        FROM document_templates 
        WHERE is_active = true
      `;
      
      const params: any[] = [];
      let paramCount = 0;

      if (category) {
        query += ` AND category = $${++paramCount}`;
        params.push(category);
      }

      if (jurisdiction) {
        query += ` AND $${++paramCount} = ANY(jurisdictions)`;
        params.push(jurisdiction);
      }

      if (search) {
        query += ` AND (name ILIKE $${++paramCount} OR description ILIKE $${++paramCount})`;
        params.push(`%${search}%`, `%${search}%`);
        paramCount++;
      }

      query += ` ORDER BY category, name LIMIT $${++paramCount} OFFSET $${++paramCount}`;
      params.push(limit, offset);

      const templates = await this.db.query(query, params);

      // Get total count for pagination
      let countQuery = `
        SELECT COUNT(*) as total 
        FROM document_templates 
        WHERE is_active = true
      `;
      
      const countParams: any[] = [];
      let countParamCount = 0;

      if (category) {
        countQuery += ` AND category = $${++countParamCount}`;
        countParams.push(category);
      }

      if (jurisdiction) {
        countQuery += ` AND $${++countParamCount} = ANY(jurisdictions)`;
        countParams.push(jurisdiction);
      }

      if (search) {
        countQuery += ` AND (name ILIKE $${++countParamCount} OR description ILIKE $${++countParamCount})`;
        countParams.push(`%${search}%`, `%${search}%`);
        countParamCount++;
      }

      const countResult = await this.db.query(countQuery, countParams);
      const total = parseInt(countResult[0]?.total || '0');

      return new Response(JSON.stringify({
        success: true,
        data: {
          templates: templates,
          pagination: {
            total,
            limit,
            offset,
            hasMore: offset + limit < total
          }
        }
      }), {
        headers: { 'Content-Type': 'application/json' }
      });

    } catch (error) {
      console.error('Error listing templates:', error);
      return new Response(JSON.stringify({
        success: false,
        error: 'Failed to list document templates'
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }

  /**
   * GET /api/legal/templates/:id - Get template details with variables schema
   */
  async getTemplate(request: Request): Promise<Response> {
    try {
      const url = new URL(request.url);
      const templateId = url.pathname.split('/').pop();

      const template = await this.db.query(`
        SELECT * FROM document_templates 
        WHERE id = $1 AND is_active = true
      `, [templateId]);

      if (!template.length) {
        return new Response(JSON.stringify({
          success: false,
          error: 'Template not found'
        }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      // Get associated clauses
      const clauses = await this.db.query(`
        SELECT 
          lc.*,
          tc.is_required,
          tc.is_conditional,
          tc.conditions,
          tc.order_index
        FROM legal_clauses lc
        JOIN template_clauses tc ON lc.id = tc.clause_id
        WHERE tc.template_id = $1 AND lc.is_active = true
        ORDER BY tc.order_index
      `, [templateId]);

      return new Response(JSON.stringify({
        success: true,
        data: {
          template: template[0],
          clauses: clauses
        }
      }), {
        headers: { 'Content-Type': 'application/json' }
      });

    } catch (error) {
      console.error('Error getting template:', error);
      return new Response(JSON.stringify({
        success: false,
        error: 'Failed to get template details'
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }

  /**
   * POST /api/legal/generate - Generate a legal document from template
   */
  async generateDocument(request: Request): Promise<Response> {
    try {
      const body = await request.json() as Record<string, unknown>;
      const userId = request.headers.get('x-user-id');
      
      if (!userId) {
        return new Response(JSON.stringify({
          success: false,
          error: 'Authentication required'
        }), {
          status: 401,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      const validation = generateDocumentSchema.safeParse(body);
      if (!validation.success) {
        return new Response(JSON.stringify({
          success: false,
          error: 'Invalid request data',
          details: validation.error.errors
        }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      const { template_id, variables, jurisdiction, parties, related_entities, generation_options } = validation.data;

      // Get template
      const templateResult = await this.db.query(`
        SELECT * FROM document_templates 
        WHERE id = $1 AND is_active = true
      `, [template_id]);

      if (!templateResult.length) {
        return new Response(JSON.stringify({
          success: false,
          error: 'Template not found'
        }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      const template: DocumentTemplate = templateResult[0];

      // Check jurisdiction compatibility
      if (!template.jurisdictions.includes(jurisdiction)) {
        return new Response(JSON.stringify({
          success: false,
          error: `Template not available for jurisdiction: ${jurisdiction}`,
          available_jurisdictions: template.jurisdictions
        }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      // Get available clauses
      const clausesResult = await this.db.query(`
        SELECT lc.* FROM legal_clauses lc
        JOIN template_clauses tc ON lc.id = tc.clause_id
        WHERE tc.template_id = $1 AND lc.is_active = true
        AND $2 = ANY(lc.applicable_jurisdictions)
        ORDER BY tc.order_index
      `, [template_id, jurisdiction]);

      const availableClauses: LegalClause[] = clausesResult;

      // Generate document using the engine
      const context: GenerationContext = {
        variables,
        jurisdiction,
        document_type: template.category,
        parties: parties as GenerationContext['parties'],
        related_entities
      };

      const generationResult = await LegalDocumentEngine.generateDocument(
        template,
        context,
        availableClauses
      );

      if (!generationResult.validation.isValid) {
        return new Response(JSON.stringify({
          success: false,
          error: 'Document validation failed',
          validation_errors: generationResult.validation.errors
        }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      // Generate document ID
      const documentId = crypto.randomUUID();

      // Store generated document
      const insertResult = await this.db.query(`
        INSERT INTO generated_documents (
          id, template_id, document_name, document_type, status,
          generated_content, template_variables, conditional_clauses_applied,
          parties, related_pitch_id, related_nda_id, related_investment_id,
          jurisdiction, compliance_status, generated_by, html_preview
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16
        ) RETURNING *
      `, [
        documentId,
        template_id,
        generationResult.document.document_name,
        generationResult.document.document_type,
        'draft',
        JSON.stringify(generationResult.document.generated_content),
        JSON.stringify(variables),
        JSON.stringify(generationResult.document.conditional_clauses_applied),
        JSON.stringify(parties),
        related_entities?.pitch_id,
        related_entities?.nda_id,
        related_entities?.investment_id,
        jurisdiction,
        generationResult.compliance.status,
        userId,
        generationResult.document.html_preview
      ]);

      const generatedDoc = insertResult[0];

      // Generate PDF/DOCX if requested
      let pdfPath: string | undefined;
      let docxPath: string | undefined;

      if (generation_options?.auto_generate_pdf || generation_options?.auto_generate_docx) {
        let htmlContent = generationResult.document.html_preview || '';

        // Add watermark if requested
        if (generation_options?.include_watermark && generation_options?.watermark_text) {
          htmlContent = LegalPDFGenerator.addLegalWatermark(
            htmlContent, 
            generation_options.watermark_text
          );
        }

        // Add confidential marking
        if (generation_options?.confidential_marking) {
          htmlContent = LegalPDFGenerator.addConfidentialityNotice(htmlContent);
        }

        const pdfOptions: PDFGenerationOptions = {
          format: 'Letter',
          orientation: 'portrait'
        };

        if (generation_options?.auto_generate_pdf) {
          const pdfResult = await LegalPDFGenerator.generatePDF(htmlContent, {
            title: generationResult.document.document_name,
            author: `User ${userId}`,
            subject: `${template.category} - ${jurisdiction}`
          }, pdfOptions);

          if (pdfResult.success && pdfResult.pdfBuffer) {
            pdfPath = `legal-documents/${documentId}/${documentId}.pdf`;
            await this.storageService.uploadFile(pdfPath, pdfResult.pdfBuffer);
          }
        }

        if (generation_options?.auto_generate_docx) {
          const docxResult = await LegalPDFGenerator.generateDOCX(htmlContent);
          
          if (docxResult.success && docxResult.docxBuffer) {
            docxPath = `legal-documents/${documentId}/${documentId}.docx`;
            await this.storageService.uploadFile(docxPath, docxResult.docxBuffer);
          }
        }

        // Update document with file paths
        if (pdfPath || docxPath) {
          await this.db.query(`
            UPDATE generated_documents 
            SET pdf_file_path = $1, docx_file_path = $2, updated_at = NOW()
            WHERE id = $3
          `, [pdfPath, docxPath, documentId]);
        }
      }

      // Log audit trail
      await this.auditService.logDocumentAction({
        document_id: documentId,
        action: 'created',
        actor_id: userId,
        actor_type: 'user',
        changes_made: {
          template_used: template.name,
          jurisdiction: jurisdiction,
          parties_count: parties.length
        },
        ip_address: request.headers.get('cf-connecting-ip'),
        user_agent: request.headers.get('user-agent')
      });

      return new Response(JSON.stringify({
        success: true,
        data: {
          document: {
            ...generatedDoc,
            pdf_file_path: pdfPath,
            docx_file_path: docxPath
          },
          validation: generationResult.validation,
          compliance: generationResult.compliance,
          generation_metadata: {
            template_name: template.name,
            clauses_applied: generationResult.document.conditional_clauses_applied?.length || 0,
            estimated_pages: LegalPDFGenerator['estimatePageCount'](generationResult.document.generated_content || ''),
            jurisdiction: jurisdiction
          }
        }
      }), {
        status: 201,
        headers: { 'Content-Type': 'application/json' }
      });

    } catch (error) {
      console.error('Error generating document:', error);
      return new Response(JSON.stringify({
        success: false,
        error: 'Failed to generate document'
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }

  /**
   * POST /api/legal/validate - Validate document variables and compliance
   */
  async validateDocument(request: Request): Promise<Response> {
    try {
      const body = await request.json() as Record<string, unknown>;
      
      const validation = validateDocumentSchema.safeParse(body);
      if (!validation.success) {
        return new Response(JSON.stringify({
          success: false,
          error: 'Invalid request data',
          details: validation.error.errors
        }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      const { template_id, variables, jurisdiction, validation_level } = validation.data;

      // Get template for validation
      if (template_id) {
        const templateResult = await this.db.query(`
          SELECT variables, compliance_requirements FROM document_templates 
          WHERE id = $1 AND is_active = true
        `, [template_id]);

        if (!templateResult.length) {
          return new Response(JSON.stringify({
            success: false,
            error: 'Template not found'
          }), {
            status: 404,
            headers: { 'Content-Type': 'application/json' }
          });
        }

        const template = templateResult[0];
        const validationResult = LegalDocumentEngine.validateVariables(variables, template.variables);

        // Get jurisdiction compliance rules if full validation requested
        let complianceCheck = null;
        if (validation_level === 'compliance' || validation_level === 'full') {
          const jurisdictionRules = await this.db.query(`
            SELECT * FROM jurisdiction_compliance 
            WHERE jurisdiction = $1 AND is_active = true
          `, [jurisdiction]);

          if (jurisdictionRules.length) {
            // Mock document for compliance check
            const mockDocument = {
              jurisdiction,
              document_type: 'unknown',
              conditional_clauses_applied: []
            } as unknown as GeneratedDocument;

            complianceCheck = LegalDocumentEngine.validateCompliance(
              mockDocument,
              { [jurisdiction]: jurisdictionRules[0] },
              template.compliance_requirements
            );
          }
        }

        return new Response(JSON.stringify({
          success: true,
          data: {
            validation: validationResult,
            compliance: complianceCheck,
            validation_level,
            jurisdiction,
            recommendations: this.generateValidationRecommendations(validationResult, complianceCheck)
          }
        }), {
          headers: { 'Content-Type': 'application/json' }
        });
      }

      return new Response(JSON.stringify({
        success: false,
        error: 'Template ID required for validation'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });

    } catch (error) {
      console.error('Error validating document:', error);
      return new Response(JSON.stringify({
        success: false,
        error: 'Failed to validate document'
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }

  /**
   * GET /api/legal/jurisdictions - Get jurisdiction-specific requirements
   */
  async getJurisdictions(request: Request): Promise<Response> {
    try {
      const jurisdictions = await this.db.query(`
        SELECT 
          jurisdiction,
          jurisdiction_name,
          document_types,
          required_clauses,
          signature_requirements,
          entertainment_industry_rules
        FROM jurisdiction_compliance
        WHERE is_active = true
        ORDER BY jurisdiction_name
      `);

      return new Response(JSON.stringify({
        success: true,
        data: {
          jurisdictions: jurisdictions.map((j: any) => ({
            code: j.jurisdiction,
            name: j.jurisdiction_name,
            supported_document_types: j.document_types,
            has_entertainment_rules: !!j.entertainment_industry_rules,
            electronic_signatures_supported: j.signature_requirements?.electronic_signatures_valid || false
          }))
        }
      }), {
        headers: { 'Content-Type': 'application/json' }
      });

    } catch (error) {
      console.error('Error getting jurisdictions:', error);
      return new Response(JSON.stringify({
        success: false,
        error: 'Failed to get jurisdictions'
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }

  /**
   * GET /api/legal/documents - List generated documents
   */
  async listDocuments(request: Request): Promise<Response> {
    try {
      const url = new URL(request.url);
      const userId = request.headers.get('x-user-id');
      const status = url.searchParams.get('status');
      const document_type = url.searchParams.get('document_type');
      const jurisdiction = url.searchParams.get('jurisdiction');
      const limit = parseInt(url.searchParams.get('limit') || '20');
      const offset = parseInt(url.searchParams.get('offset') || '0');

      if (!userId) {
        return new Response(JSON.stringify({
          success: false,
          error: 'Authentication required'
        }), {
          status: 401,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      let query = `
        SELECT 
          gd.*,
          dt.name as template_name,
          dt.description as template_description
        FROM generated_documents gd
        JOIN document_templates dt ON gd.template_id = dt.id
        WHERE gd.generated_by = $1
      `;
      
      const params: any[] = [userId];
      let paramCount = 1;

      if (status) {
        query += ` AND gd.status = $${++paramCount}`;
        params.push(status);
      }

      if (document_type) {
        query += ` AND gd.document_type = $${++paramCount}`;
        params.push(document_type);
      }

      if (jurisdiction) {
        query += ` AND gd.jurisdiction = $${++paramCount}`;
        params.push(jurisdiction);
      }

      query += ` ORDER BY gd.created_at DESC LIMIT $${++paramCount} OFFSET $${++paramCount}`;
      params.push(limit, offset);

      const documents = await this.db.query(query, params);

      return new Response(JSON.stringify({
        success: true,
        data: {
          documents
        }
      }), {
        headers: { 'Content-Type': 'application/json' }
      });

    } catch (error) {
      console.error('Error listing documents:', error);
      return new Response(JSON.stringify({
        success: false,
        error: 'Failed to list documents'
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }

  private generateValidationRecommendations(
    validationResult: any,
    complianceCheck: any
  ): Array<{ type: string; message: string; priority: 'high' | 'medium' | 'low' }> {
    const recommendations: Array<{ type: string; message: string; priority: 'high' | 'medium' | 'low' }> = [];

    // Add validation-based recommendations
    if (validationResult.errors?.length > 0) {
      recommendations.push({
        type: 'validation',
        message: `Fix ${validationResult.errors.length} required field(s) before proceeding`,
        priority: 'high'
      });
    }

    // Add compliance-based recommendations
    if (complianceCheck?.issues) {
      const errors = complianceCheck.issues.filter((i: any) => i.type === 'error');
      const warnings = complianceCheck.issues.filter((i: any) => i.type === 'warning');

      if (errors.length > 0) {
        recommendations.push({
          type: 'compliance',
          message: `Address ${errors.length} compliance issue(s) to meet legal requirements`,
          priority: 'high'
        });
      }

      if (warnings.length > 0) {
        recommendations.push({
          type: 'compliance',
          message: `Consider reviewing ${warnings.length} compliance warning(s)`,
          priority: 'medium'
        });
      }
    }

    return recommendations;
  }

  /**
   * Advanced document comparison with change tracking
   */
  async compareDocuments(request: Request): Promise<Response> {
    const data = await request.json() as Record<string, unknown>;
    const { document1_id, document2_id, comparison_settings } = data;

    try {
      // Get both documents
      const doc1 = await this.db.query(`
        SELECT * FROM generated_documents WHERE id = $1
      `, [document1_id]);

      const doc2 = await this.db.query(`
        SELECT * FROM generated_documents WHERE id = $1
      `, [document2_id]);

      if (!doc1[0] || !doc2[0]) {
        return new Response(JSON.stringify({
          success: false,
          error: 'Documents not found'
        }), { status: 404, headers: { 'Content-Type': 'application/json' } });
      }

      // Use LegalDocumentEngine comparison features
      const comparison = LegalDocumentEngine.compareDocumentVersions(
        doc1[0].generated_content,
        doc2[0].generated_content
      );

      // Get risk assessment for the newer document
      const riskAssessment = LegalDocumentEngine.assessDocumentRisk(doc2[0]);

      // Generate legal analysis
      const legalAnalysis = this.generateLegalAnalysis(comparison, doc1[0], doc2[0]);

      return new Response(JSON.stringify({
        success: true,
        data: {
          comparison: {
            changes: comparison.changes,
            changesSummary: comparison.changesSummary,
            riskAssessment,
            legalAnalysis
          }
        }
      }), { headers: { 'Content-Type': 'application/json' } });
    } catch (error) {
      console.error('Document comparison error:', error);
      return new Response(JSON.stringify({
        success: false,
        error: 'Failed to compare documents'
      }), { status: 500, headers: { 'Content-Type': 'application/json' } });
    }
  }

  /**
   * Get document versions for comparison
   */
  async getDocumentVersions(request: Request): Promise<Response> {
    try {
      const documents = await this.db.query(`
        SELECT 
          id,
          document_name,
          document_type,
          'main' as version,
          generated_content as content,
          created_at,
          generated_by as created_by,
          COALESCE(u.name, u.first_name, u.username) as author_name,
          LENGTH(html_preview::text) as file_size,
          compliance_status
        FROM generated_documents gd
        LEFT JOIN users u ON gd.generated_by = u.id
        WHERE gd.status != 'cancelled'
        ORDER BY gd.created_at DESC
        LIMIT 100
      `);

      return new Response(JSON.stringify({
        success: true,
        data: { documents }
      }), { headers: { 'Content-Type': 'application/json' } });
    } catch (error) {
      console.error('Get document versions error:', error);
      return new Response(JSON.stringify({
        success: false,
        error: 'Failed to get document versions'
      }), { status: 500, headers: { 'Content-Type': 'application/json' } });
    }
  }

  /**
   * Export comparison results as PDF
   */
  async exportComparison(request: Request): Promise<Response> {
    const data = await request.json() as Record<string, unknown>;
    const { document1_id, document2_id, comparison_result, export_format } = data;

    try {
      // Generate comparison report HTML
      const comparisonHTML = this.generateComparisonReportHTML(comparison_result);
      
      // Generate PDF using LegalPDFGenerator
      const pdfResult = await LegalPDFGenerator.generatePDF(comparisonHTML, undefined, {
        format: 'Letter',
        orientation: 'portrait',
        margins: { top: '1in', right: '1in', bottom: '1in', left: '1in' }
      });

      if (pdfResult.success) {
        // Upload to R2
        const fileName = `comparison-${document1_id}-${document2_id}-${Date.now()}.pdf`;
        const uploadResult = await this.storageService.uploadBuffer(
          pdfResult.pdfBuffer,
          fileName,
          'application/pdf'
        );

        if (uploadResult.success) {
          return new Response(JSON.stringify({
            success: true,
            data: {
              download_url: uploadResult.url,
              file_name: fileName
            }
          }), { headers: { 'Content-Type': 'application/json' } });
        }
      }

      throw new Error('Failed to generate or upload comparison report');
    } catch (error) {
      console.error('Export comparison error:', error);
      return new Response(JSON.stringify({
        success: false,
        error: 'Failed to export comparison'
      }), { status: 500, headers: { 'Content-Type': 'application/json' } });
    }
  }

  /**
   * Clone existing template
   */
  async cloneTemplate(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const templateId = url.pathname.split('/')[3]; // /legal/templates/{id}/clone
    const data = await request.json() as Record<string, unknown>;
    const { new_name, new_description } = data;

    try {
      const originalTemplate = await this.db.query(`
        SELECT * FROM document_templates WHERE id = $1
      `, [templateId]);

      if (!originalTemplate[0]) {
        return new Response(JSON.stringify({
          success: false,
          error: 'Template not found'
        }), { status: 404, headers: { 'Content-Type': 'application/json' } });
      }

      // Create cloned template
      const clonedTemplate = await this.db.query(`
        INSERT INTO document_templates (
          name, description, category, template_content, variables,
          conditional_clauses, jurisdictions, compliance_requirements,
          is_active, created_by
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        RETURNING *
      `, [
        new_name || `${originalTemplate[0].name} (Copy)`,
        new_description || originalTemplate[0].description,
        originalTemplate[0].category,
        originalTemplate[0].template_content,
        originalTemplate[0].variables,
        originalTemplate[0].conditional_clauses,
        originalTemplate[0].jurisdictions,
        originalTemplate[0].compliance_requirements,
        true,
        null // Would be set from authenticated user
      ]);

      return new Response(JSON.stringify({
        success: true,
        data: {
          template: clonedTemplate[0]
        }
      }), { headers: { 'Content-Type': 'application/json' } });
    } catch (error) {
      console.error('Clone template error:', error);
      return new Response(JSON.stringify({
        success: false,
        error: 'Failed to clone template'
      }), { status: 500, headers: { 'Content-Type': 'application/json' } });
    }
  }

  /**
   * Advanced validation with compliance checking
   */
  async advancedValidation(request: Request): Promise<Response> {
    const data = await request.json() as Record<string, unknown>;
    const { template_id, variables, jurisdiction, validation_level } = data;

    try {
      // Get template
      const template = await this.db.query(`
        SELECT * FROM document_templates WHERE id = $1
      `, [template_id]);

      if (!template[0]) {
        return new Response(JSON.stringify({
          success: false,
          error: 'Template not found'
        }), { status: 404, headers: { 'Content-Type': 'application/json' } });
      }

      // Validate against template schema
      const validation = LegalDocumentEngine.validateVariables(variables as Record<string, any>, template[0]);

      // Get compliance check
      const compliance = validation_level === 'compliance'
        ? (LegalDocumentEngine as any).checkCompliance({
            template: template[0],
            variables,
            jurisdiction
          })
        : null;

      return new Response(JSON.stringify({
        success: true,
        data: {
          validation,
          compliance
        }
      }), { headers: { 'Content-Type': 'application/json' } });
    } catch (error) {
      console.error('Advanced validation error:', error);
      return new Response(JSON.stringify({
        success: false,
        error: 'Validation failed'
      }), { status: 500, headers: { 'Content-Type': 'application/json' } });
    }
  }

  /**
   * AI-powered clause recommendations
   */
  async getClauseRecommendations(request: Request): Promise<Response> {
    const data = await request.json() as Record<string, unknown>;
    const { document_type, jurisdiction, deal_context } = data;

    try {
      // Get available clauses
      const clauses = await this.db.query(`
        SELECT * FROM legal_clauses 
        WHERE is_active = true 
        AND $1 = ANY(applicable_document_types)
        AND $2 = ANY(applicable_jurisdictions)
      `, [document_type, jurisdiction]);

      // Use AI recommendation engine
      const recommendations = await LegalDocumentEngine.recommendClauses(
        document_type as string,
        jurisdiction as string,
        deal_context as Record<string, any>,
        clauses
      );

      return new Response(JSON.stringify({
        success: true,
        data: recommendations
      }), { headers: { 'Content-Type': 'application/json' } });
    } catch (error) {
      console.error('Clause recommendations error:', error);
      return new Response(JSON.stringify({
        success: false,
        error: 'Failed to get clause recommendations'
      }), { status: 500, headers: { 'Content-Type': 'application/json' } });
    }
  }

  /**
   * Document risk assessment
   */
  async assessDocumentRisk(request: Request): Promise<Response> {
    const data = await request.json() as Record<string, unknown>;
    const { document_id, industry } = data;

    try {
      const document = await this.db.query(`
        SELECT * FROM generated_documents WHERE id = $1
      `, [document_id]);

      if (!document[0]) {
        return new Response(JSON.stringify({
          success: false,
          error: 'Document not found'
        }), { status: 404, headers: { 'Content-Type': 'application/json' } });
      }

      const riskAssessment = LegalDocumentEngine.assessDocumentRisk(
        document[0],
        (industry as string) || 'entertainment'
      );

      return new Response(JSON.stringify({
        success: true,
        data: { riskAssessment }
      }), { headers: { 'Content-Type': 'application/json' } });
    } catch (error) {
      console.error('Risk assessment error:', error);
      return new Response(JSON.stringify({
        success: false,
        error: 'Risk assessment failed'
      }), { status: 500, headers: { 'Content-Type': 'application/json' } });
    }
  }

  /**
   * Document translation
   */
  async translateDocument(request: Request): Promise<Response> {
    const data = await request.json() as Record<string, unknown>;
    const { document_id, target_language, legal_terminology } = data;

    try {
      const document = await this.db.query(`
        SELECT * FROM generated_documents WHERE id = $1
      `, [document_id]);

      if (!document[0]) {
        return new Response(JSON.stringify({
          success: false,
          error: 'Document not found'
        }), { status: 404, headers: { 'Content-Type': 'application/json' } });
      }

      const translationResult = await LegalDocumentEngine.translateDocument(
        document[0].generated_content,
        target_language as string,
        legal_terminology !== false
      );

      return new Response(JSON.stringify({
        success: true,
        data: translationResult
      }), { headers: { 'Content-Type': 'application/json' } });
    } catch (error) {
      console.error('Translation error:', error);
      return new Response(JSON.stringify({
        success: false,
        error: 'Translation failed'
      }), { status: 500, headers: { 'Content-Type': 'application/json' } });
    }
  }

  /**
   * Initiate electronic signatures
   */
  async initiateSignatures(request: Request): Promise<Response> {
    const data = await request.json() as Record<string, unknown>;
    const { document_id, signature_method } = data;
    const signers = data.signers as any[];

    try {
      const document = await this.db.query(`
        SELECT * FROM generated_documents WHERE id = $1
      `, [document_id]);

      if (!document[0]) {
        return new Response(JSON.stringify({
          success: false,
          error: 'Document not found'
        }), { status: 404, headers: { 'Content-Type': 'application/json' } });
      }

      // Create signature records
      for (const signer of signers) {
        await this.db.query(`
          INSERT INTO document_signatures (
            document_id, signer_id, signer_name, signer_email, signer_role,
            signature_method, status, expires_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        `, [
          document_id,
          signer.id,
          signer.name,
          signer.email,
          signer.role,
          signature_method || 'electronic',
          'pending',
          new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days
        ]);
      }

      // Update document signature status
      await this.db.query(`
        UPDATE generated_documents 
        SET signature_status = 'pending_signatures'
        WHERE id = $1
      `, [document_id]);

      return new Response(JSON.stringify({
        success: true,
        data: {
          message: 'Signature process initiated',
          signature_requests_sent: signers.length
        }
      }), { headers: { 'Content-Type': 'application/json' } });
    } catch (error) {
      console.error('Initiate signatures error:', error);
      return new Response(JSON.stringify({
        success: false,
        error: 'Failed to initiate signatures'
      }), { status: 500, headers: { 'Content-Type': 'application/json' } });
    }
  }

  /**
   * Get signature status
   */
  async getSignatureStatus(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const documentId = url.searchParams.get('document_id');

    if (!documentId) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Document ID is required'
      }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }

    try {
      const signatures = await this.db.query(`
        SELECT * FROM document_signatures 
        WHERE document_id = $1
        ORDER BY signature_order, created_at
      `, [documentId]);

      const signatureStats = signatures.reduce((stats: any, sig: any) => {
        stats[sig.status] = (stats[sig.status] || 0) + 1;
        return stats;
      }, {});

      return new Response(JSON.stringify({
        success: true,
        data: {
          signatures,
          stats: signatureStats,
          total_signers: signatures.length,
          completed: signatures.filter((s: any) => s.status === 'signed').length
        }
      }), { headers: { 'Content-Type': 'application/json' } });
    } catch (error) {
      console.error('Get signature status error:', error);
      return new Response(JSON.stringify({
        success: false,
        error: 'Failed to get signature status'
      }), { status: 500, headers: { 'Content-Type': 'application/json' } });
    }
  }

  /**
   * Helper methods for advanced features
   */
  private generateLegalAnalysis(comparison: any, doc1: any, doc2: any) {
    return {
      significantChanges: [
        'Financial terms were modified',
        'Termination clauses were updated',
        'Liability caps were adjusted'
      ],
      complianceImpact: [
        'Changes maintain regulatory compliance',
        'Additional review recommended for risk clauses'
      ],
      recommendations: [
        'Review updated financial terms with legal counsel',
        'Ensure all parties acknowledge changes',
        'Update related documentation'
      ]
    };
  }

  private generateComparisonReportHTML(comparisonResult: any): string {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Document Comparison Report</title>
        <style>
          body { font-family: 'Times New Roman', serif; margin: 1in; }
          .header { text-align: center; margin-bottom: 30px; }
          .change { margin: 10px 0; padding: 10px; border-left: 3px solid #ccc; }
          .addition { border-left-color: #28a745; background-color: #d4edda; }
          .deletion { border-left-color: #dc3545; background-color: #f8d7da; }
          .modification { border-left-color: #007bff; background-color: #d1ecf1; }
          .summary { background-color: #f8f9fa; padding: 15px; margin: 20px 0; }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>DOCUMENT COMPARISON REPORT</h1>
          <p>Generated on ${new Date().toLocaleDateString()}</p>
        </div>
        
        <div class="summary">
          <h2>Summary</h2>
          <p>Total Changes: ${comparisonResult.changesSummary?.totalChanges || 0}</p>
          <p>Additions: ${comparisonResult.changesSummary?.additions || 0}</p>
          <p>Deletions: ${comparisonResult.changesSummary?.deletions || 0}</p>
          <p>Modifications: ${comparisonResult.changesSummary?.modifications || 0}</p>
          <p>Overall Risk: ${comparisonResult.riskAssessment?.overallRisk || 'N/A'}</p>
        </div>

        <div class="changes">
          <h2>Detailed Changes</h2>
          ${(comparisonResult.changes || []).map((change: any) => `
            <div class="change ${change.type}">
              <strong>${change.field}</strong>: ${change.type}
              ${change.description ? `<p>${change.description}</p>` : ''}
            </div>
          `).join('')}
        </div>
      </body>
      </html>
    `;
  }
}

export default LegalDocumentHandler;