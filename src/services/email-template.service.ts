/**
 * Email Template Engine with Dynamic Content Generation
 * Provides HTML email templates with variable substitution and A/B testing
 */

import type { DatabaseService } from '../types/worker-types.ts';

export interface EmailTemplate {
  id: string;
  name: string;
  category: string;
  subjectTemplate: string;
  htmlTemplate: string;
  textTemplate?: string;
  variables: Record<string, any>;
  isActive: boolean;
  version: string;
  testVariantId?: string;
}

export interface EmailTemplateData {
  templateName: string;
  variables: Record<string, any>;
  recipientEmail: string;
  recipientName?: string;
  unsubscribeUrl?: string;
  preferencesUrl?: string;
  abTestId?: string;
}

export interface TemplateRenderResult {
  subject: string;
  html: string;
  text?: string;
  templateId: string;
  abTestVariant?: string;
}

export class EmailTemplateService {
  constructor(private db: DatabaseService, private redis?: any) {}

  /**
   * Render email template with variables
   */
  async renderTemplate(data: EmailTemplateData): Promise<TemplateRenderResult> {
    // Get template (with A/B testing logic)
    const template = await this.getTemplate(data.templateName, data.abTestId);
    
    if (!template) {
      throw new Error(`Template not found: ${data.templateName}`);
    }

    // Prepare variables with defaults
    const variables = {
      ...data.variables,
      recipientEmail: data.recipientEmail,
      recipientName: data.recipientName || 'Valued User',
      unsubscribeUrl: data.unsubscribeUrl || this.generateUnsubscribeUrl(data.recipientEmail),
      preferencesUrl: data.preferencesUrl || this.generatePreferencesUrl(data.recipientEmail),
      currentYear: new Date().getFullYear(),
      companyName: 'Pitchey',
      supportEmail: 'support@pitchey.com',
      // `process.env.FRONTEND_URL` is always undefined on Cloudflare Workers
      // (Workers don't expose process.env). Threading `env` through the
      // EmailTemplateService constructor is tracked as separate tech debt —
      // for now this fallback is effectively the only path, so make sure it
      // points at the live canonical host.
      baseUrl: process.env.FRONTEND_URL || 'https://pitchey-5o8.pages.dev',
    };

    // Render subject and content
    const subject = this.interpolateTemplate(template.subjectTemplate, variables);
    const html = this.interpolateTemplate(template.htmlTemplate, variables);
    const text = template.textTemplate ? this.interpolateTemplate(template.textTemplate, variables) : undefined;

    return {
      subject,
      html,
      text,
      templateId: template.id,
      abTestVariant: template.testVariantId,
    };
  }

  /**
   * Get template with A/B testing support
   */
  async getTemplate(templateName: string, abTestId?: string): Promise<EmailTemplate | null> {
    try {
      // Check if A/B test is active
      if (abTestId) {
        const abTest = await this.getActiveABTest(abTestId);
        if (abTest) {
          // Determine which variant to use
          const useVariantA = Math.random() < abTest.trafficSplit;
          const templateId = useVariantA ? abTest.templateAId : abTest.templateBId;
          
          const template = await this.getTemplateById(templateId);
          if (template) {
            template.testVariantId = useVariantA ? 'A' : 'B';
            return template;
          }
        }
      }

      // Get template by name
      const result = await this.db.query(
        `SELECT * FROM notification_templates 
         WHERE name = $1 AND type = 'email' AND is_active = true
         ORDER BY created_at DESC LIMIT 1`,
        [templateName]
      );

      if (result.length === 0) {
        return null;
      }

      return this.transformTemplate(result[0]);
    } catch (error) {
      console.error('Error getting template:', error);
      throw error;
    }
  }

  /**
   * Create or update email template
   */
  async createTemplate(template: Omit<EmailTemplate, 'id' | 'isActive'>): Promise<EmailTemplate> {
    try {
      const result = await this.db.query(
        `INSERT INTO notification_templates (
          name, type, category, subject_template, html_template, body_template, variables, is_active
         ) VALUES ($1, 'email', $2, $3, $4, $5, $6, true)
         RETURNING *`,
        [
          template.name,
          template.category,
          template.subjectTemplate,
          template.htmlTemplate,
          template.textTemplate || '',
          JSON.stringify(template.variables),
        ]
      );

      return this.transformTemplate(result[0]);
    } catch (error) {
      console.error('Error creating template:', error);
      throw error;
    }
  }

  /**
   * Get all email templates for management
   */
  async getTemplates(category?: string): Promise<EmailTemplate[]> {
    try {
      let query = `SELECT * FROM notification_templates WHERE type = 'email'`;
      const params: any[] = [];

      if (category) {
        query += ` AND category = $1`;
        params.push(category);
      }

      query += ` ORDER BY category, name`;

      const result = await this.db.query(query, params);
      return result.map(row => this.transformTemplate(row));
    } catch (error) {
      console.error('Error getting templates:', error);
      throw error;
    }
  }

  /**
   * Preview template with sample data
   */
  async previewTemplate(templateName: string, sampleData: Record<string, any>): Promise<TemplateRenderResult> {
    const template = await this.getTemplate(templateName);
    if (!template) {
      throw new Error(`Template not found: ${templateName}`);
    }

    // Use sample data for preview
    const previewData: EmailTemplateData = {
      templateName,
      variables: {
        ...sampleData,
        // Add some default preview data
        recipientName: sampleData.recipientName || 'John Doe',
        pitch_title: sampleData.pitch_title || 'Sample Pitch Title',
        investor_name: sampleData.investor_name || 'Jane Smith',
        amount_raised: sampleData.amount_raised || '$50,000',
      },
      recipientEmail: 'preview@example.com',
      recipientName: 'Preview User',
    };

    return this.renderTemplate(previewData);
  }

  /**
   * Create A/B test for templates
   */
  async createABTest(
    name: string,
    description: string,
    templateAId: string,
    templateBId: string,
    trafficSplit: number = 0.5
  ): Promise<string> {
    try {
      const result = await this.db.query(
        `INSERT INTO notification_ab_tests (
          name, description, template_a_id, template_b_id, traffic_split, status
         ) VALUES ($1, $2, $3, $4, $5, 'active')
         RETURNING id`,
        [name, description, templateAId, templateBId, trafficSplit]
      );

      return result[0].id;
    } catch (error) {
      console.error('Error creating A/B test:', error);
      throw error;
    }
  }

  /**
   * Get A/B test results
   */
  async getABTestResults(testId: string): Promise<{
    testInfo: any;
    variantA: { sent: number; opened: number; clicked: number; conversionRate: number };
    variantB: { sent: number; opened: number; clicked: number; conversionRate: number };
  }> {
    try {
      // Get test info
      const [testInfo] = await this.db.query(
        'SELECT * FROM notification_ab_tests WHERE id = $1',
        [testId]
      );

      if (!testInfo) {
        throw new Error('A/B test not found');
      }

      // Get metrics for both variants
      const [variantAMetrics] = await this.db.query(`
        SELECT 
          COUNT(n.id) as sent,
          COUNT(na.id) FILTER (WHERE na.event_type = 'opened') as opened,
          COUNT(na.id) FILTER (WHERE na.event_type = 'clicked') as clicked
        FROM notifications n
        LEFT JOIN notification_analytics na ON n.id = na.notification_id
        WHERE n.template_id = $1
      `, [testInfo.template_a_id]);

      const [variantBMetrics] = await this.db.query(`
        SELECT 
          COUNT(n.id) as sent,
          COUNT(na.id) FILTER (WHERE na.event_type = 'opened') as opened,
          COUNT(na.id) FILTER (WHERE na.event_type = 'clicked') as clicked
        FROM notifications n
        LEFT JOIN notification_analytics na ON n.id = na.notification_id
        WHERE n.template_id = $1
      `, [testInfo.template_b_id]);

      const calculateConversionRate = (clicked: number, sent: number) => 
        sent > 0 ? (clicked / sent) * 100 : 0;

      return {
        testInfo,
        variantA: {
          sent: parseInt(variantAMetrics.sent),
          opened: parseInt(variantAMetrics.opened),
          clicked: parseInt(variantAMetrics.clicked),
          conversionRate: calculateConversionRate(variantAMetrics.clicked, variantAMetrics.sent),
        },
        variantB: {
          sent: parseInt(variantBMetrics.sent),
          opened: parseInt(variantBMetrics.opened),
          clicked: parseInt(variantBMetrics.clicked),
          conversionRate: calculateConversionRate(variantBMetrics.clicked, variantBMetrics.sent),
        },
      };
    } catch (error) {
      console.error('Error getting A/B test results:', error);
      throw error;
    }
  }

  // Private helper methods

  private interpolateTemplate(template: string, variables: Record<string, any>): string {
    return template.replace(/\{\{(\w+(?:\.\w+)*)\}\}/g, (match, path) => {
      const value = this.getNestedValue(variables, path);
      return value !== undefined ? String(value) : match;
    });
  }

  private getNestedValue(obj: any, path: string): any {
    return path.split('.').reduce((current, key) => current?.[key], obj);
  }

  private async getTemplateById(templateId: string): Promise<EmailTemplate | null> {
    try {
      const result = await this.db.query(
        'SELECT * FROM notification_templates WHERE id = $1',
        [templateId]
      );

      if (result.length === 0) {
        return null;
      }

      return this.transformTemplate(result[0]);
    } catch (error) {
      console.error('Error getting template by ID:', error);
      return null;
    }
  }

  private async getActiveABTest(testId: string): Promise<any> {
    try {
      const result = await this.db.query(
        'SELECT * FROM notification_ab_tests WHERE id = $1 AND status = \'active\'',
        [testId]
      );

      return result[0] || null;
    } catch (error) {
      console.error('Error getting A/B test:', error);
      return null;
    }
  }

  private transformTemplate(row: any): EmailTemplate {
    return {
      id: row.id,
      name: row.name,
      category: row.category,
      subjectTemplate: row.subject_template,
      htmlTemplate: row.html_template,
      textTemplate: row.body_template,
      variables: typeof row.variables === 'string' ? JSON.parse(row.variables) : row.variables,
      isActive: row.is_active,
      version: row.created_at,
    };
  }

  private generateUnsubscribeUrl(email: string): string {
    // This would integrate with the unsubscribe token system
    const token = btoa(email + ':' + Date.now()); // Simple encoding for demo
    return `${process.env.FRONTEND_URL}/unsubscribe?token=${token}`;
  }

  private generatePreferencesUrl(email: string): string {
    const token = btoa(email + ':preferences:' + Date.now()); // Simple encoding for demo
    return `${process.env.FRONTEND_URL}/notification-preferences?token=${token}`;
  }
}

// Pre-built email templates for common notifications
export const EMAIL_TEMPLATES = {
  NEW_INVESTOR_INTEREST: {
    name: 'new_investor_interest',
    category: 'investment',
    subjectTemplate: '🎯 New Investor Interest in {{pitch_title}}',
    htmlTemplate: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>New Investor Interest</title>
        <style>
          .container { max-width: 600px; margin: 0 auto; font-family: Arial, sans-serif; }
          .header { background: #2563eb; color: white; padding: 24px; text-align: center; border-radius: 8px 8px 0 0; }
          .content { padding: 24px; background: #f8fafc; }
          .highlight { background: #eff6ff; padding: 16px; border-radius: 8px; margin: 16px 0; }
          .button { display: inline-block; padding: 12px 24px; background: #2563eb; color: white; text-decoration: none; border-radius: 6px; margin: 16px 0; }
          .footer { padding: 20px; text-align: center; color: #666; font-size: 14px; }
          .stats { display: flex; justify-content: space-around; margin: 20px 0; }
          .stat { text-align: center; }
          .stat-number { font-size: 24px; font-weight: bold; color: #2563eb; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🎯 New Investor Interest</h1>
            <p>Someone wants to invest in your vision!</p>
          </div>
          <div class="content">
            <div class="highlight">
              <h2>Great news, {{recipientName}}!</h2>
              <p><strong>{{investor_name}}</strong> has shown interest in your pitch "<strong>{{pitch_title}}</strong>".</p>
              <p>They're ready to review your materials and potentially move forward with investment discussions.</p>
            </div>
            
            {{#if investor_profile}}
            <h3>Investor Profile:</h3>
            <ul>
              <li><strong>Investment Range:</strong> {{investor_profile.investment_range}}</li>
              <li><strong>Industry Focus:</strong> {{investor_profile.industry_focus}}</li>
              <li><strong>Previous Investments:</strong> {{investor_profile.portfolio_count}} companies</li>
            </ul>
            {{/if}}
            
            <div class="stats">
              <div class="stat">
                <div class="stat-number">{{total_views}}</div>
                <div>Total Views</div>
              </div>
              <div class="stat">
                <div class="stat-number">{{interested_investors}}</div>
                <div>Interested Investors</div>
              </div>
              <div class="stat">
                <div class="stat-number">{{completion_rate}}%</div>
                <div>Profile Views</div>
              </div>
            </div>
            
            <center>
              <a href="{{action_url}}" class="button">View Investor Profile</a>
            </center>
            
            <p><strong>Next Steps:</strong></p>
            <ol>
              <li>Review the investor's profile and investment criteria</li>
              <li>Ensure your pitch materials are up-to-date</li>
              <li>Consider scheduling a meeting if there's mutual interest</li>
            </ol>
          </div>
          <div class="footer">
            <p>Best regards,<br>The {{companyName}} Team</p>
            <p><a href="{{preferencesUrl}}">Update preferences</a> | <a href="{{unsubscribeUrl}}">Unsubscribe</a></p>
          </div>
        </div>
      </body>
      </html>`,
    textTemplate: `New Investor Interest in {{pitch_title}}

Hi {{recipientName}},

Great news! {{investor_name}} has shown interest in your pitch "{{pitch_title}}".

They would like to review your project materials and potentially move forward with investment discussions.

View Investor Profile: {{action_url}}

This is an excellent opportunity to showcase your project. Make sure your pitch materials are up-to-date and compelling.

Best regards,
The {{companyName}} Team

Update preferences: {{preferencesUrl}}
Unsubscribe: {{unsubscribeUrl}}`,
    variables: {
      pitch_title: 'string',
      investor_name: 'string',
      action_url: 'string',
      total_views: 'number',
      interested_investors: 'number',
      completion_rate: 'number',
      investor_profile: 'object',
    },
  },

  NDA_APPROVAL: {
    name: 'nda_approval_notification',
    category: 'project',
    subjectTemplate: '✅ NDA Approved for {{pitch_title}}',
    htmlTemplate: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>NDA Approved</title>
        <style>
          .container { max-width: 600px; margin: 0 auto; font-family: Arial, sans-serif; }
          .header { background: #10b981; color: white; padding: 24px; text-align: center; border-radius: 8px 8px 0 0; }
          .content { padding: 24px; background: #f0fdf4; }
          .success-badge { background: #10b981; color: white; padding: 8px 16px; border-radius: 20px; font-size: 14px; font-weight: bold; }
          .button { display: inline-block; padding: 12px 24px; background: #10b981; color: white; text-decoration: none; border-radius: 6px; margin: 16px 0; }
          .footer { padding: 20px; text-align: center; color: #666; font-size: 14px; }
          .important { background: #fef3c7; padding: 16px; border-radius: 8px; margin: 16px 0; border-left: 4px solid #f59e0b; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>✅ NDA Approved</h1>
            <div class="success-badge">ACCESS GRANTED</div>
          </div>
          <div class="content">
            <h2>Congratulations, {{recipientName}}!</h2>
            <p>Your NDA for "<strong>{{pitch_title}}</strong>" has been approved by <strong>{{approver_name}}</strong>.</p>
            
            <p>You now have access to:</p>
            <ul>
              <li>Complete project documentation</li>
              <li>Financial projections and models</li>
              <li>Confidential business information</li>
              <li>Direct communication with the project team</li>
            </ul>
            
            <center>
              <a href="{{action_url}}" class="button">Access Project Details</a>
            </center>
            
            <div class="important">
              <strong>⚠️ Important:</strong> Please remember to respect the confidentiality terms outlined in the NDA agreement. This information is proprietary and should not be shared without explicit permission.
            </div>
            
            {{#if nda_expiry}}
            <p><strong>NDA Expiry:</strong> {{nda_expiry}}</p>
            {{/if}}
          </div>
          <div class="footer">
            <p>Best regards,<br>The {{companyName}} Team</p>
            <p><a href="{{preferencesUrl}}">Update preferences</a> | <a href="{{unsubscribeUrl}}">Unsubscribe</a></p>
          </div>
        </div>
      </body>
      </html>`,
    variables: {
      pitch_title: 'string',
      approver_name: 'string',
      action_url: 'string',
      nda_expiry: 'string',
    },
  },

  FUNDING_MILESTONE: {
    name: 'funding_milestone_reached',
    category: 'investment',
    subjectTemplate: '🎉 {{pitch_title}} reached {{milestone}}% funding!',
    htmlTemplate: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Funding Milestone Reached</title>
        <style>
          .container { max-width: 600px; margin: 0 auto; font-family: Arial, sans-serif; }
          .header { background: linear-gradient(135deg, #10b981, #059669); color: white; padding: 24px; text-align: center; border-radius: 8px 8px 0 0; }
          .content { padding: 24px; background: #f0fdf4; }
          .milestone { text-align: center; margin: 24px 0; }
          .milestone-number { font-size: 72px; font-weight: bold; color: #10b981; }
          .progress-bar { background: #e5e7eb; border-radius: 10px; overflow: hidden; margin: 16px 0; }
          .progress-fill { background: linear-gradient(90deg, #10b981, #059669); height: 20px; transition: width 0.3s ease; }
          .button { display: inline-block; padding: 12px 24px; background: #10b981; color: white; text-decoration: none; border-radius: 6px; margin: 16px 0; }
          .footer { padding: 20px; text-align: center; color: #666; font-size: 14px; }
          .celebration { font-size: 24px; margin: 16px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <div class="celebration">🎉🎊🥳</div>
            <h1>Funding Milestone Reached!</h1>
            <p>Your campaign is gaining momentum!</p>
          </div>
          <div class="content">
            <div class="milestone">
              <div class="milestone-number">{{milestone}}%</div>
              <p>Funding Progress</p>
              <div class="progress-bar">
                <div class="progress-fill" style="width: {{milestone}}%"></div>
              </div>
            </div>
            
            <h2>Incredible news, {{recipientName}}!</h2>
            <p>Your pitch "<strong>{{pitch_title}}</strong>" has reached <strong>{{milestone}}%</strong> of its funding goal.</p>
            
            <p><strong>Campaign Statistics:</strong></p>
            <ul>
              <li><strong>Amount Raised:</strong> {{amount_raised}}</li>
              <li><strong>Total Investors:</strong> {{investor_count}}</li>
              <li><strong>Days Remaining:</strong> {{days_remaining}}</li>
              {{#if average_investment}}
              <li><strong>Average Investment:</strong> {{average_investment}}</li>
              {{/if}}
            </ul>
            
            <center>
              <a href="{{action_url}}" class="button">View Campaign Progress</a>
            </center>
            
            <p><strong>Keep the momentum going:</strong></p>
            <ol>
              <li>Share this milestone with your network</li>
              <li>Update your social media channels</li>
              <li>Thank your existing investors</li>
              <li>Reach out to potential investors</li>
            </ol>
          </div>
          <div class="footer">
            <p>Best regards,<br>The {{companyName}} Team</p>
            <p><a href="{{preferencesUrl}}">Update preferences</a> | <a href="{{unsubscribeUrl}}">Unsubscribe</a></p>
          </div>
        </div>
      </body>
      </html>`,
    variables: {
      pitch_title: 'string',
      milestone: 'number',
      amount_raised: 'string',
      investor_count: 'number',
      days_remaining: 'number',
      average_investment: 'string',
      action_url: 'string',
    },
  },
};

export function createEmailTemplateService(db: DatabaseService, redis?: any): EmailTemplateService {
  return new EmailTemplateService(db, redis);
}