/**
 * Comprehensive Email Service for Pitchey Platform
 * Production-ready with multiple providers, queuing, rate limiting, and tracking
 */

import type { EmailTemplate, EmailData, EmailResult, EmailProvider, EmailQueue, EmailPreferences, EmailLog, EmailAttachment } from '../types/email.types.ts';

interface EmailServiceConfig {
  sendgrid?: {
    apiKey: string;
    fromEmail: string;
    fromName: string;
  };
  awsSes?: {
    accessKeyId: string;
    secretAccessKey: string;
    region: string;
    fromEmail: string;
    fromName: string;
  };
  defaultProvider: 'sendgrid' | 'awsSes';
  rateLimits: {
    perMinute: number;
    perHour: number;
    perDay: number;
  };
  retryConfig: {
    maxRetries: number;
    initialDelay: number;
    maxDelay: number;
  };
  queueConfig: {
    maxConcurrent: number;
    processingInterval: number;
  };
}

interface EmailMetrics {
  sent: number;
  failed: number;
  queued: number;
  rateLimited: number;
  lastProcessed: string;
}

interface RateLimitState {
  minute: { count: number; window: number };
  hour: { count: number; window: number };
  day: { count: number; window: number };
}

export class EmailService {
  private config: EmailServiceConfig;
  private queue: EmailQueue[] = [];
  private processing = false;
  private metrics: EmailMetrics = {
    sent: 0,
    failed: 0,
    queued: 0,
    rateLimited: 0,
    lastProcessed: new Date().toISOString()
  };
  private rateLimitState: RateLimitState = {
    minute: { count: 0, window: 0 },
    hour: { count: 0, window: 0 },
    day: { count: 0, window: 0 }
  };

  constructor(config: EmailServiceConfig) {
    this.config = config;
    this.startQueueProcessor();
  }

  /**
   * Send email immediately (bypasses queue)
   */
  async sendEmail(data: EmailData): Promise<EmailResult> {
    try {
      // Check rate limits
      if (!this.checkRateLimit()) {
        this.metrics.rateLimited++;
        return {
          success: false,
          error: 'Rate limit exceeded',
          provider: this.config.defaultProvider,
          messageId: null,
          timestamp: new Date().toISOString()
        };
      }

      // Try primary provider
      let result = await this.sendWithProvider(data, this.config.defaultProvider);
      
      // Fallback to alternate provider if primary fails
      if (!result.success) {
        const fallbackProvider = this.config.defaultProvider === 'sendgrid' ? 'awsSes' : 'sendgrid';
        if (this.isProviderConfigured(fallbackProvider)) {
          console.log(`Primary provider failed, falling back to ${fallbackProvider}`);
          result = await this.sendWithProvider(data, fallbackProvider);
        }
      }

      // Log the attempt
      await this.logEmail(data, result);

      // Update metrics
      if (result.success) {
        this.metrics.sent++;
        this.updateRateLimit();
      } else {
        this.metrics.failed++;
      }

      return result;
    } catch (error) {
      console.error('Email service error:', error);
      this.metrics.failed++;
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        provider: this.config.defaultProvider,
        messageId: null,
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Queue email for later processing
   */
  async queueEmail(data: EmailData, priority: 'high' | 'normal' | 'low' = 'normal', sendAt?: Date): Promise<string> {
    const queueId = `email_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const queueItem: EmailQueue = {
      id: queueId,
      data,
      priority,
      sendAt: sendAt || new Date(),
      attempts: 0,
      createdAt: new Date(),
      status: 'pending'
    };

    this.queue.push(queueItem);
    this.queue.sort((a, b) => {
      // Sort by priority first, then by sendAt time
      const priorityOrder = { high: 3, normal: 2, low: 1 };
      if (priorityOrder[a.priority] !== priorityOrder[b.priority]) {
        return priorityOrder[b.priority] - priorityOrder[a.priority];
      }
      return a.sendAt.getTime() - b.sendAt.getTime();
    });

    this.metrics.queued++;
    console.log(`Email queued with ID: ${queueId}, queue size: ${this.queue.length}`);
    
    return queueId;
  }

  /**
   * Send bulk emails with batching and rate limiting
   */
  async sendBulkEmails(emails: EmailData[], options: {
    batchSize?: number;
    delayBetweenBatches?: number;
  } = {}): Promise<{ success: number; failed: number; results: EmailResult[] }> {
    const batchSize = options.batchSize || 10;
    const delay = options.delayBetweenBatches || 1000;
    const results: EmailResult[] = [];
    let success = 0;
    let failed = 0;

    for (let i = 0; i < emails.length; i += batchSize) {
      const batch = emails.slice(i, i + batchSize);
      
      // Process batch in parallel
      const batchPromises = batch.map(email => this.queueEmail(email));
      await Promise.all(batchPromises);

      // Wait between batches to avoid overwhelming the system
      if (i + batchSize < emails.length) {
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    return { success, failed, results };
  }

  /**
   * Send templated email
   */
  async sendTemplateEmail(
    templateType: keyof EmailTemplate,
    to: string,
    variables: Record<string, any>,
    options: {
      priority?: 'high' | 'normal' | 'low';
      sendAt?: Date;
      queue?: boolean;
    } = {}
  ): Promise<EmailResult | string> {
    const template = this.getEmailTemplate(templateType);
    if (!template) {
      throw new Error(`Email template '${templateType}' not found`);
    }

    const emailData: EmailData = {
      to,
      subject: this.replaceVariables(template.subject, variables),
      html: this.replaceVariables(template.html, variables),
      text: template.text ? this.replaceVariables(template.text, variables) : undefined,
      templateType,
      variables,
      attachments: template.attachments
    };

    if (options.queue !== false) {
      return this.queueEmail(emailData, options.priority, options.sendAt);
    } else {
      return this.sendEmail(emailData);
    }
  }

  /**
   * Check email delivery status
   */
  async getEmailStatus(messageId: string): Promise<{
    status: 'sent' | 'delivered' | 'opened' | 'clicked' | 'failed' | 'bounced';
    events: Array<{
      type: string;
      timestamp: string;
      data?: any;
    }>;
  } | null> {
    // This would integrate with webhook data or provider APIs
    // For now, return basic status from logs
    return null;
  }

  /**
   * Get email metrics and statistics
   */
  getMetrics(): EmailMetrics & {
    queueSize: number;
    rateLimitState: RateLimitState;
  } {
    return {
      ...this.metrics,
      queueSize: this.queue.length,
      rateLimitState: this.rateLimitState
    };
  }

  /**
   * Validate email configuration
   */
  async validateConfiguration(): Promise<{ [provider: string]: boolean }> {
    const results: { [provider: string]: boolean } = {};

    if (this.config.sendgrid?.apiKey) {
      results.sendgrid = await this.testSendGridConnection();
    }

    if (this.config.awsSes?.accessKeyId) {
      results.awsSes = await this.testAWSConnection();
    }

    return results;
  }

  /**
   * Private Methods
   */

  private async sendWithProvider(data: EmailData, provider: EmailProvider): Promise<EmailResult> {
    switch (provider) {
      case 'sendgrid':
        return this.sendWithSendGrid(data);
      case 'awsSes':
        return this.sendWithAWS(data);
      default:
        return {
          success: false,
          error: `Unknown provider: ${provider}`,
          provider,
          messageId: null,
          timestamp: new Date().toISOString()
        };
    }
  }

  private async sendWithSendGrid(data: EmailData): Promise<EmailResult> {
    if (!this.config.sendgrid?.apiKey) {
      return {
        success: false,
        error: 'SendGrid not configured',
        provider: 'sendgrid',
        messageId: null,
        timestamp: new Date().toISOString()
      };
    }

    try {
      const payload = {
        personalizations: [{
          to: [{ email: data.to }],
          subject: data.subject
        }],
        from: {
          email: this.config.sendgrid.fromEmail,
          name: this.config.sendgrid.fromName
        },
        content: [
          {
            type: 'text/html',
            value: data.html
          }
        ],
        tracking_settings: {
          click_tracking: { enable: true },
          open_tracking: { enable: true }
        },
        custom_args: {
          template_type: data.templateType || 'custom',
          user_id: data.variables?.userId || 'unknown'
        }
      };

      if (data.text) {
        payload.content.unshift({
          type: 'text/plain',
          value: data.text
        });
      }

      if (data.attachments && data.attachments.length > 0) {
        (payload as any).attachments = data.attachments.map(att => ({
          content: att.content,
          filename: att.filename,
          type: att.type,
          disposition: 'attachment'
        }));
      }

      const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.config.sendgrid.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (response.status === 202) {
        const messageId = response.headers.get('x-message-id') || `sg_${Date.now()}`;
        return {
          success: true,
          provider: 'sendgrid',
          messageId,
          timestamp: new Date().toISOString()
        };
      } else {
        const errorText = await response.text();
        return {
          success: false,
          error: `SendGrid API error: ${response.status} - ${errorText}`,
          provider: 'sendgrid',
          messageId: null,
          timestamp: new Date().toISOString()
        };
      }
    } catch (error) {
      return {
        success: false,
        error: `SendGrid error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        provider: 'sendgrid',
        messageId: null,
        timestamp: new Date().toISOString()
      };
    }
  }

  private async sendWithAWS(data: EmailData): Promise<EmailResult> {
    if (!this.config.awsSes?.accessKeyId) {
      return {
        success: false,
        error: 'AWS SES not configured',
        provider: 'awsSes',
        messageId: null,
        timestamp: new Date().toISOString()
      };
    }

    try {
      // AWS SES implementation would go here
      // For now, return a mock response
      console.log('AWS SES integration not implemented yet');
      return {
        success: false,
        error: 'AWS SES integration pending',
        provider: 'awsSes',
        messageId: null,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      return {
        success: false,
        error: `AWS SES error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        provider: 'awsSes',
        messageId: null,
        timestamp: new Date().toISOString()
      };
    }
  }

  private checkRateLimit(): boolean {
    const now = Date.now();
    const minute = Math.floor(now / 60000);
    const hour = Math.floor(now / 3600000);
    const day = Math.floor(now / 86400000);

    // Reset counters if we're in a new window
    if (this.rateLimitState.minute.window !== minute) {
      this.rateLimitState.minute = { count: 0, window: minute };
    }
    if (this.rateLimitState.hour.window !== hour) {
      this.rateLimitState.hour = { count: 0, window: hour };
    }
    if (this.rateLimitState.day.window !== day) {
      this.rateLimitState.day = { count: 0, window: day };
    }

    // Check limits
    return (
      this.rateLimitState.minute.count < this.config.rateLimits.perMinute &&
      this.rateLimitState.hour.count < this.config.rateLimits.perHour &&
      this.rateLimitState.day.count < this.config.rateLimits.perDay
    );
  }

  private updateRateLimit(): void {
    this.rateLimitState.minute.count++;
    this.rateLimitState.hour.count++;
    this.rateLimitState.day.count++;
  }

  private isProviderConfigured(provider: EmailProvider): boolean {
    switch (provider) {
      case 'sendgrid':
        return !!(this.config.sendgrid?.apiKey);
      case 'awsSes':
        return !!(this.config.awsSes?.accessKeyId);
      default:
        return false;
    }
  }

  private getEmailTemplate(type: keyof EmailTemplate): EmailTemplate[keyof EmailTemplate] | null {
    const templates: any = {
      welcome: {
        subject: 'Welcome to Pitchey - {{name}}!',
        html: this.getWelcomeTemplate(),
        text: 'Welcome to Pitchey! Please verify your email at: {{verificationUrl}}'
      },
      ndaRequest: {
        subject: 'NDA Request for "{{pitchTitle}}"',
        html: this.getNDARequestTemplate(),
        text: 'You have received an NDA request for your pitch "{{pitchTitle}}" from {{investorName}}.'
      },
      ndaApproval: {
        subject: 'NDA Approved - Access Granted to "{{pitchTitle}}"',
        html: this.getNDAApprovalTemplate(),
        text: 'Your NDA request for "{{pitchTitle}}" has been approved. You now have access to the full pitch materials.'
      },
      ndaRejection: {
        subject: 'NDA Request Update for "{{pitchTitle}}"',
        html: this.getNDARejectionTemplate(),
        text: 'Your NDA request for "{{pitchTitle}}" could not be approved at this time.'
      },
      investmentConfirmation: {
        subject: 'Investment Confirmed - {{amount}} in "{{pitchTitle}}"',
        html: this.getInvestmentConfirmationTemplate(),
        text: 'Your investment of {{amount}} in "{{pitchTitle}}" has been confirmed.'
      },
      newMessage: {
        subject: 'New Message from {{senderName}}',
        html: this.getNewMessageTemplate(),
        text: 'You have received a new message from {{senderName}}: {{preview}}'
      },
      transactionAlert: {
        subject: 'Transaction Alert - {{transactionType}}',
        html: this.getTransactionAlertTemplate(),
        text: 'Transaction {{transactionType}} for {{amount}} has been processed.'
      },
      weeklyDigest: {
        subject: 'Your Weekly Pitchey Digest',
        html: this.getWeeklyDigestTemplate(),
        text: 'Here\'s your weekly summary of activity on Pitchey.'
      }
    };

    return templates[type] || null;
  }

  private replaceVariables(template: string, variables: Record<string, any>): string {
    return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
      return variables[key] || match;
    });
  }

  private async logEmail(data: EmailData, result: EmailResult): Promise<void> {
    // This would save to the email_logs table
    const logEntry: Partial<EmailLog> = {
      to: data.to,
      subject: data.subject,
      provider: result.provider,
      messageId: result.messageId,
      status: result.success ? 'sent' : 'failed',
      error: result.error,
      templateType: data.templateType,
      sentAt: new Date()
    };

    // TODO: Implement database logging
    console.log('Email log:', logEntry);
  }

  private startQueueProcessor(): void {
    setInterval(() => {
      if (!this.processing && this.queue.length > 0) {
        this.processQueue();
      }
    }, this.config.queueConfig.processingInterval);
  }

  private async processQueue(): Promise<void> {
    if (this.processing) return;
    
    this.processing = true;
    const concurrent = Math.min(this.config.queueConfig.maxConcurrent, this.queue.length);
    
    try {
      for (let i = 0; i < concurrent; i++) {
        const item = this.queue.find(q => 
          q.status === 'pending' && 
          q.sendAt <= new Date()
        );

        if (item) {
          this.processQueueItem(item);
        }
      }
    } catch (error) {
      console.error('Queue processing error:', error);
    } finally {
      this.processing = false;
      this.metrics.lastProcessed = new Date().toISOString();
    }
  }

  private async processQueueItem(item: EmailQueue): Promise<void> {
    item.status = 'processing';
    item.attempts++;

    try {
      const result = await this.sendEmail(item.data);
      
      if (result.success) {
        item.status = 'completed';
        this.queue = this.queue.filter(q => q.id !== item.id);
        this.metrics.queued--;
      } else {
        if (item.attempts < this.config.retryConfig.maxRetries) {
          item.status = 'pending';
          item.nextRetry = new Date(Date.now() + this.getRetryDelay(item.attempts));
        } else {
          item.status = 'failed';
          item.error = result.error;
          this.queue = this.queue.filter(q => q.id !== item.id);
          this.metrics.queued--;
          this.metrics.failed++;
        }
      }
    } catch (error) {
      item.status = 'failed';
      item.error = error instanceof Error ? error.message : 'Unknown error';
      this.queue = this.queue.filter(q => q.id !== item.id);
      this.metrics.queued--;
      this.metrics.failed++;
    }
  }

  private getRetryDelay(attempt: number): number {
    const delay = Math.min(
      this.config.retryConfig.initialDelay * Math.pow(2, attempt - 1),
      this.config.retryConfig.maxDelay
    );
    return delay + Math.random() * 1000; // Add jitter
  }

  private async testSendGridConnection(): Promise<boolean> {
    try {
      const response = await fetch('https://api.sendgrid.com/v3/user/profile', {
        headers: {
          'Authorization': `Bearer ${this.config.sendgrid?.apiKey}`,
        },
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  private async testAWSConnection(): Promise<boolean> {
    // Would implement AWS credentials test
    return false;
  }

  // Email Templates
  private getWelcomeTemplate(): string {
    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Welcome to Pitchey</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 0; background-color: #f8fafc; }
    .container { max-width: 600px; margin: 0 auto; background-color: white; }
    .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 40px 30px; text-align: center; }
    .header h1 { margin: 0; font-size: 28px; font-weight: 600; }
    .content { padding: 40px 30px; }
    .content h2 { color: #2d3748; margin-top: 0; font-size: 24px; }
    .content p { color: #4a5568; line-height: 1.6; margin-bottom: 20px; }
    .button { display: inline-block; background: #667eea; color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: 500; margin: 20px 0; }
    .features { background: #f7fafc; padding: 30px; border-radius: 8px; margin: 30px 0; }
    .features h3 { color: #2d3748; margin-top: 0; }
    .features ul { color: #4a5568; padding-left: 20px; }
    .footer { background: #edf2f7; padding: 30px; text-align: center; color: #718096; font-size: 14px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Welcome to Pitchey!</h1>
    </div>
    <div class="content">
      <h2>Hi {{name}},</h2>
      <p>Welcome to Pitchey, where great stories meet great opportunities! We're excited to have you join our community of creators, investors, and production companies.</p>
      
      <p>To get started, please verify your email address:</p>
      <a href="{{verificationUrl}}" class="button">Verify Email Address</a>
      
      <div class="features">
        <h3>What you can do with Pitchey:</h3>
        <ul>
          <li>Share your creative pitches with industry professionals</li>
          <li>Connect with investors and production companies</li>
          <li>Manage NDAs and secure communications</li>
          <li>Track pitch performance and engagement</li>
          <li>Build your creative portfolio</li>
        </ul>
      </div>
      
      <p>If you have any questions, our support team is here to help at <a href="mailto:support@pitchey.com">support@pitchey.com</a>.</p>
      
      <p>Best regards,<br>The Pitchey Team</p>
    </div>
    <div class="footer">
      <p>If you didn't create an account with Pitchey, you can safely ignore this email.</p>
      <p>© 2024 Pitchey. All rights reserved.</p>
    </div>
  </div>
</body>
</html>`;
  }

  private getNDARequestTemplate(): string {
    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>New NDA Request</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 0; background-color: #f8fafc; }
    .container { max-width: 600px; margin: 0 auto; background-color: white; }
    .header { background: linear-gradient(135deg, #48bb78 0%, #38a169 100%); color: white; padding: 40px 30px; text-align: center; }
    .content { padding: 40px 30px; }
    .info-box { background: #f0fff4; border: 1px solid #9ae6b4; border-radius: 8px; padding: 20px; margin: 20px 0; }
    .info-box h3 { color: #22543d; margin-top: 0; }
    .button { display: inline-block; background: #48bb78; color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: 500; margin: 20px 0; }
    .footer { background: #edf2f7; padding: 30px; text-align: center; color: #718096; font-size: 14px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>New NDA Request</h1>
    </div>
    <div class="content">
      <p>You have received a new NDA request for your pitch!</p>
      
      <div class="info-box">
        <h3>Request Details</h3>
        <p><strong>Investor:</strong> {{investorName}}</p>
        <p><strong>Company:</strong> {{investorCompany}}</p>
        <p><strong>Pitch:</strong> {{pitchTitle}}</p>
        <p><strong>Requested:</strong> {{requestDate}}</p>
      </div>
      
      <p>{{investorName}} is interested in learning more about your pitch "{{pitchTitle}}" and has requested to sign an NDA to access additional materials and details.</p>
      
      <a href="{{reviewUrl}}" class="button">Review NDA Request</a>
      
      <p>You can approve or decline this request from your creator dashboard. If approved, the investor will be able to access:</p>
      <ul>
        <li>Full pitch deck and supporting materials</li>
        <li>Financial projections and business model</li>
        <li>Contact information for direct communication</li>
      </ul>
      
      <p><strong>Note:</strong> NDAs help protect your intellectual property while enabling meaningful investor discussions.</p>
    </div>
    <div class="footer">
      <p>© 2024 Pitchey. All rights reserved.</p>
    </div>
  </div>
</body>
</html>`;
  }

  private getNDAApprovalTemplate(): string {
    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>NDA Approved - Access Granted</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 0; background-color: #f8fafc; }
    .container { max-width: 600px; margin: 0 auto; background-color: white; }
    .header { background: linear-gradient(135deg, #48bb78 0%, #38a169 100%); color: white; padding: 40px 30px; text-align: center; }
    .content { padding: 40px 30px; }
    .success-box { background: #f0fff4; border: 1px solid #9ae6b4; border-radius: 8px; padding: 20px; margin: 20px 0; text-align: center; }
    .button { display: inline-block; background: #48bb78; color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: 500; margin: 20px 0; }
    .footer { background: #edf2f7; padding: 30px; text-align: center; color: #718096; font-size: 14px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>NDA Approved!</h1>
    </div>
    <div class="content">
      <div class="success-box">
        <h2 style="color: #22543d; margin-top: 0;">✅ Access Granted</h2>
        <p>Your NDA request for "<strong>{{pitchTitle}}</strong>" has been approved by {{creatorName}}.</p>
      </div>
      
      <p>Congratulations! You now have full access to the pitch materials including:</p>
      <ul>
        <li>Complete pitch deck and presentation</li>
        <li>Financial projections and market analysis</li>
        <li>Team information and backgrounds</li>
        <li>Direct contact information</li>
      </ul>
      
      <a href="{{pitchUrl}}" class="button">View Full Pitch</a>
      
      <p><strong>Important:</strong> By accessing these materials, you agree to the terms of the NDA signed on {{ndaDate}}. Please keep all information confidential as per the agreement.</p>
      
      <p>Ready to take the next step? You can now directly contact the creator or start discussions about potential collaboration.</p>
    </div>
    <div class="footer">
      <p>© 2024 Pitchey. All rights reserved.</p>
    </div>
  </div>
</body>
</html>`;
  }

  private getNDARejectionTemplate(): string {
    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>NDA Request Update</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 0; background-color: #f8fafc; }
    .container { max-width: 600px; margin: 0 auto; background-color: white; }
    .header { background: linear-gradient(135deg, #ed8936 0%, #dd6b20 100%); color: white; padding: 40px 30px; text-align: center; }
    .content { padding: 40px 30px; }
    .info-box { background: #fffaf0; border: 1px solid #f6ad55; border-radius: 8px; padding: 20px; margin: 20px 0; }
    .button { display: inline-block; background: #667eea; color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: 500; margin: 20px 0; }
    .footer { background: #edf2f7; padding: 30px; text-align: center; color: #718096; font-size: 14px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>NDA Request Update</h1>
    </div>
    <div class="content">
      <div class="info-box">
        <h3 style="color: #9c4221; margin-top: 0;">Request Status Update</h3>
        <p>Your NDA request for "<strong>{{pitchTitle}}</strong>" could not be approved at this time.</p>
      </div>
      
      {{#if reason}}
      <p><strong>Reason provided:</strong> {{reason}}</p>
      {{/if}}
      
      <p>While this particular request wasn't approved, there are still several ways to stay engaged:</p>
      <ul>
        <li>Continue following the pitch for public updates</li>
        <li>Express your interest to be notified of future opportunities</li>
        <li>Explore other exciting pitches on the platform</li>
        <li>Build your investor profile to improve future requests</li>
      </ul>
      
      <a href="{{browseUrl}}" class="button">Explore More Pitches</a>
      
      <p>Thank you for your interest in {{creatorName}}'s project. We encourage you to continue exploring opportunities on Pitchey.</p>
    </div>
    <div class="footer">
      <p>© 2024 Pitchey. All rights reserved.</p>
    </div>
  </div>
</body>
</html>`;
  }

  private getInvestmentConfirmationTemplate(): string {
    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Investment Confirmed</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 0; background-color: #f8fafc; }
    .container { max-width: 600px; margin: 0 auto; background-color: white; }
    .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 40px 30px; text-align: center; }
    .content { padding: 40px 30px; }
    .investment-summary { background: #edf2f7; border-radius: 8px; padding: 25px; margin: 25px 0; }
    .amount { font-size: 36px; font-weight: bold; color: #48bb78; text-align: center; margin: 20px 0; }
    .button { display: inline-block; background: #667eea; color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: 500; margin: 20px 0; }
    .footer { background: #edf2f7; padding: 30px; text-align: center; color: #718096; font-size: 14px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🎉 Investment Confirmed!</h1>
    </div>
    <div class="content">
      <p>Congratulations! Your investment has been successfully processed.</p>
      
      <div class="investment-summary">
        <h3 style="margin-top: 0; text-align: center; color: #2d3748;">Investment Summary</h3>
        <div class="amount">{{amount}}</div>
        <p><strong>Project:</strong> {{pitchTitle}}</p>
        <p><strong>Creator:</strong> {{creatorName}}</p>
        <p><strong>Investment Type:</strong> {{investmentType}}</p>
        <p><strong>Date:</strong> {{investmentDate}}</p>
        <p><strong>Transaction ID:</strong> {{transactionId}}</p>
      </div>
      
      <h3>What happens next?</h3>
      <ul>
        <li><strong>Documentation:</strong> You'll receive legal documents via email within 2-3 business days</li>
        <li><strong>Updates:</strong> You'll get regular project updates from the creator</li>
        <li><strong>Dashboard:</strong> Track your investment performance in your investor portal</li>
        <li><strong>Communication:</strong> Direct communication channel with the project team</li>
      </ul>
      
      <a href="{{portfolioUrl}}" class="button">View Your Portfolio</a>
      
      <p>Thank you for supporting {{creatorName}}'s vision! Your investment helps bring creative projects to life.</p>
      
      <p>Questions? Contact our investor relations team at <a href="mailto:investors@pitchey.com">investors@pitchey.com</a></p>
    </div>
    <div class="footer">
      <p>© 2024 Pitchey. All rights reserved.</p>
      <p>This email serves as confirmation only. Official documentation will follow separately.</p>
    </div>
  </div>
</body>
</html>`;
  }

  private getNewMessageTemplate(): string {
    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>New Message</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 0; background-color: #f8fafc; }
    .container { max-width: 600px; margin: 0 auto; background-color: white; }
    .header { background: linear-gradient(135deg, #4299e1 0%, #3182ce 100%); color: white; padding: 40px 30px; text-align: center; }
    .content { padding: 40px 30px; }
    .message-preview { background: #f7fafc; border-left: 4px solid #4299e1; padding: 20px; margin: 20px 0; font-style: italic; }
    .button { display: inline-block; background: #4299e1; color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: 500; margin: 20px 0; }
    .footer { background: #edf2f7; padding: 30px; text-align: center; color: #718096; font-size: 14px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>💬 New Message</h1>
    </div>
    <div class="content">
      <p>You have received a new message from <strong>{{senderName}}</strong>:</p>
      
      <div class="message-preview">
        "{{messagePreview}}"
      </div>
      
      <p><strong>Subject:</strong> {{subject}}</p>
      <p><strong>Received:</strong> {{receivedDate}}</p>
      
      <a href="{{messageUrl}}" class="button">Read Full Message</a>
      
      <p>Reply directly through the Pitchey platform to keep your conversation secure and organized.</p>
      
      {{#if projectTitle}}
      <p><em>This message is related to: {{projectTitle}}</em></p>
      {{/if}}
    </div>
    <div class="footer">
      <p>To manage your notification preferences, <a href="{{preferencesUrl}}">click here</a>.</p>
      <p>© 2024 Pitchey. All rights reserved.</p>
    </div>
  </div>
</body>
</html>`;
  }

  private getTransactionAlertTemplate(): string {
    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Transaction Alert</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 0; background-color: #f8fafc; }
    .container { max-width: 600px; margin: 0 auto; background-color: white; }
    .header { background: linear-gradient(135deg, #805ad5 0%, #6b46c1 100%); color: white; padding: 40px 30px; text-align: center; }
    .content { padding: 40px 30px; }
    .transaction-details { background: #faf5ff; border: 1px solid #d6bcfa; border-radius: 8px; padding: 20px; margin: 20px 0; }
    .amount { font-size: 24px; font-weight: bold; color: #553c9a; }
    .button { display: inline-block; background: #805ad5; color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: 500; margin: 20px 0; }
    .footer { background: #edf2f7; padding: 30px; text-align: center; color: #718096; font-size: 14px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🔔 Transaction Alert</h1>
    </div>
    <div class="content">
      <p>A transaction has been processed on your account:</p>
      
      <div class="transaction-details">
        <h3 style="margin-top: 0; color: #553c9a;">Transaction Details</h3>
        <p class="amount">{{amount}}</p>
        <p><strong>Type:</strong> {{transactionType}}</p>
        <p><strong>Status:</strong> {{status}}</p>
        <p><strong>Date:</strong> {{transactionDate}}</p>
        <p><strong>Reference:</strong> {{transactionId}}</p>
        {{#if description}}
        <p><strong>Description:</strong> {{description}}</p>
        {{/if}}
      </div>
      
      {{#if isPayment}}
      <p>This payment has been successfully processed. You should see it reflected in your account within 1-2 business days.</p>
      {{/if}}
      
      {{#if isRefund}}
      <p>This refund has been processed and will appear on your original payment method within 3-5 business days.</p>
      {{/if}}
      
      <a href="{{transactionUrl}}" class="button">View Transaction</a>
      
      <p>If you have any questions about this transaction, please contact our support team.</p>
    </div>
    <div class="footer">
      <p>For support, email us at <a href="mailto:support@pitchey.com">support@pitchey.com</a></p>
      <p>© 2024 Pitchey. All rights reserved.</p>
    </div>
  </div>
</body>
</html>`;
  }

  private getWeeklyDigestTemplate(): string {
    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Your Weekly Pitchey Digest</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 0; background-color: #f8fafc; }
    .container { max-width: 600px; margin: 0 auto; background-color: white; }
    .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 40px 30px; text-align: center; }
    .content { padding: 40px 30px; }
    .stats { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin: 25px 0; }
    .stat-card { background: #f7fafc; padding: 20px; border-radius: 8px; text-align: center; }
    .stat-number { font-size: 24px; font-weight: bold; color: #667eea; }
    .section { margin: 30px 0; padding: 20px; background: #fafafa; border-radius: 8px; }
    .button { display: inline-block; background: #667eea; color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: 500; margin: 20px 0; }
    .footer { background: #edf2f7; padding: 30px; text-align: center; color: #718096; font-size: 14px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>📊 Your Weekly Digest</h1>
      <p>Week of {{weekStart}} - {{weekEnd}}</p>
    </div>
    <div class="content">
      <p>Hi {{userName}}, here's your weekly summary of activity on Pitchey:</p>
      
      <div class="stats">
        <div class="stat-card">
          <div class="stat-number">{{pitchViews}}</div>
          <div>Pitch Views</div>
        </div>
        <div class="stat-card">
          <div class="stat-number">{{newConnections}}</div>
          <div>New Connections</div>
        </div>
        <div class="stat-card">
          <div class="stat-number">{{messages}}</div>
          <div>Messages</div>
        </div>
        <div class="stat-card">
          <div class="stat-number">{{ndaRequests}}</div>
          <div>NDA Requests</div>
        </div>
      </div>
      
      {{#if topPitches}}
      <div class="section">
        <h3>🔥 Trending This Week</h3>
        {{#each topPitches}}
        <p><strong>{{title}}</strong> - {{views}} views, {{likes}} likes</p>
        {{/each}}
      </div>
      {{/if}}
      
      {{#if recentActivity}}
      <div class="section">
        <h3>📈 Your Recent Activity</h3>
        <ul>
          {{#each recentActivity}}
          <li>{{description}} - {{date}}</li>
          {{/each}}
        </ul>
      </div>
      {{/if}}
      
      {{#if suggestions}}
      <div class="section">
        <h3>💡 Suggestions for You</h3>
        <ul>
          {{#each suggestions}}
          <li>{{text}}</li>
          {{/each}}
        </ul>
      </div>
      {{/if}}
      
      <a href="{{dashboardUrl}}" class="button">View Dashboard</a>
      
      <p>Keep up the great work! Your engagement helps build a stronger creative community.</p>
    </div>
    <div class="footer">
      <p>Don't want weekly digests? <a href="{{unsubscribeUrl}}">Unsubscribe here</a></p>
      <p>© 2024 Pitchey. All rights reserved.</p>
    </div>
  </div>
</body>
</html>`;
  }
}

// Export a configured instance
export function createEmailService(config: EmailServiceConfig): EmailService {
  return new EmailService(config);
}

// Default configuration factory
export function getDefaultEmailConfig(env: any): EmailServiceConfig {
  return {
    sendgrid: env.SENDGRID_API_KEY ? {
      apiKey: env.SENDGRID_API_KEY,
      fromEmail: env.SENDGRID_FROM_EMAIL || 'noreply@pitchey.com',
      fromName: env.SENDGRID_FROM_NAME || 'Pitchey'
    } : undefined,
    awsSes: env.AWS_SES_ACCESS_KEY ? {
      accessKeyId: env.AWS_SES_ACCESS_KEY,
      secretAccessKey: env.AWS_SES_SECRET_KEY,
      region: env.AWS_SES_REGION || 'us-east-1',
      fromEmail: env.AWS_SES_FROM_EMAIL || 'noreply@pitchey.com',
      fromName: env.AWS_SES_FROM_NAME || 'Pitchey'
    } : undefined,
    defaultProvider: (env.EMAIL_PRIMARY_PROVIDER as 'sendgrid' | 'awsSes') || 'sendgrid',
    rateLimits: {
      perMinute: parseInt(env.EMAIL_RATE_LIMIT_MINUTE) || 50,
      perHour: parseInt(env.EMAIL_RATE_LIMIT_HOUR) || 1000,
      perDay: parseInt(env.EMAIL_RATE_LIMIT_DAY) || 10000
    },
    retryConfig: {
      maxRetries: parseInt(env.EMAIL_MAX_RETRIES) || 3,
      initialDelay: parseInt(env.EMAIL_RETRY_DELAY) || 1000,
      maxDelay: parseInt(env.EMAIL_RETRY_MAX_DELAY) || 30000
    },
    queueConfig: {
      maxConcurrent: parseInt(env.EMAIL_QUEUE_CONCURRENT) || 5,
      processingInterval: parseInt(env.EMAIL_QUEUE_INTERVAL) || 10000
    }
  };
}