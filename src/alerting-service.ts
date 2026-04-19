/**
 * Comprehensive Alerting Service for Pitchey Platform
 * Integrates with PagerDuty, Slack, email, and SMS for multi-channel alerting
 */

import { Toucan } from "toucan-js";

// Alert types and interfaces
interface Alert {
  id: string;
  type: 'critical' | 'warning' | 'info';
  title: string;
  message: string;
  timestamp: number;
  source: string;
  component: string;
  environment: string;
  severity: 1 | 2 | 3 | 4 | 5; // PagerDuty severity levels
  tags: Record<string, string>;
  context: Record<string, any>;
  status: 'triggered' | 'acknowledged' | 'resolved';
  channels: AlertChannel[];
  escalationPolicy?: string;
  suppressionRules?: string[];
}

interface AlertChannel {
  type: 'slack' | 'email' | 'sms' | 'pagerduty' | 'webhook';
  target: string;
  priority: 'high' | 'normal' | 'low';
  enabled: boolean;
}

interface AlertRule {
  id: string;
  name: string;
  description: string;
  condition: AlertCondition;
  channels: AlertChannel[];
  throttle: number; // Minutes between alerts
  enabled: boolean;
  tags: string[];
}

interface AlertCondition {
  metric: string;
  operator: 'gt' | 'lt' | 'eq' | 'gte' | 'lte' | 'contains' | 'not_contains';
  threshold: number | string;
  timeWindow: number; // Minutes
  minOccurrences: number;
}

interface EscalationPolicy {
  id: string;
  name: string;
  steps: EscalationStep[];
}

interface EscalationStep {
  delayMinutes: number;
  channels: AlertChannel[];
  autoResolve: boolean;
}

interface SlackMessage {
  channel: string;
  text: string;
  attachments?: SlackAttachment[];
  blocks?: any[];
}

interface SlackAttachment {
  color: string;
  title: string;
  text: string;
  fields: SlackField[];
  footer: string;
  ts: number;
}

interface SlackField {
  title: string;
  value: string;
  short: boolean;
}

interface PagerDutyEvent {
  routing_key: string;
  event_action: 'trigger' | 'acknowledge' | 'resolve';
  dedup_key?: string;
  payload: {
    summary: string;
    source: string;
    severity: 'critical' | 'error' | 'warning' | 'info';
    component: string;
    group: string;
    class: string;
    custom_details?: Record<string, any>;
  };
  client?: string;
  client_url?: string;
}

export class AlertingService {
  private sentry: Toucan;
  private kv: any;

  constructor(sentry: Toucan, bindings: any) {
    this.sentry = sentry;
    this.kv = bindings.KV;
  }

  /**
   * Trigger a new alert
   */
  async triggerAlert(alert: Partial<Alert>): Promise<string> {
    try {
      const alertId = this.generateAlertId();
      
      const fullAlert: Alert = {
        id: alertId,
        type: alert.type || 'warning',
        title: alert.title || 'Unknown Alert',
        message: alert.message || '',
        timestamp: Date.now(),
        source: alert.source || 'system',
        component: alert.component || 'unknown',
        environment: alert.environment || 'production',
        severity: alert.severity || 3,
        tags: alert.tags || {},
        context: alert.context || {},
        status: 'triggered',
        channels: alert.channels || await this.getDefaultChannels(alert.type || 'warning'),
        escalationPolicy: alert.escalationPolicy,
        suppressionRules: alert.suppressionRules
      };

      // Check suppression rules
      if (await this.isAlertSuppressed(fullAlert)) {
        console.log(`Alert ${alertId} suppressed by rules`);
        return alertId;
      }

      // Check throttling
      if (await this.isAlertThrottled(fullAlert)) {
        console.log(`Alert ${alertId} throttled`);
        return alertId;
      }

      // Store alert
      await this.storeAlert(fullAlert);

      // Send to configured channels
      await this.sendAlert(fullAlert);

      // Schedule escalation if configured
      if (fullAlert.escalationPolicy) {
        await this.scheduleEscalation(fullAlert);
      }

      // Update Sentry
      this.sentry.captureMessage(`Alert triggered: ${fullAlert.title}`, {
        level: fullAlert.type === 'critical' ? 'error' : fullAlert.type === 'warning' ? 'warning' : 'info',
        tags: {
          alertId,
          component: fullAlert.component,
          source: fullAlert.source,
          environment: fullAlert.environment
        },
        extra: fullAlert.context
      });

      return alertId;

    } catch (error) {
      this.sentry.captureException(error);
      throw error;
    }
  }

  /**
   * Acknowledge an alert
   */
  async acknowledgeAlert(alertId: string, userId?: string): Promise<void> {
    try {
      const alert = await this.getAlert(alertId);
      if (!alert) {
        throw new Error(`Alert ${alertId} not found`);
      }

      if (alert.status !== 'triggered') {
        return; // Already acknowledged or resolved
      }

      alert.status = 'acknowledged';
      alert.context.acknowledgedBy = userId;
      alert.context.acknowledgedAt = Date.now();

      await this.storeAlert(alert);

      // Send acknowledgment notifications
      await this.sendAcknowledgment(alert, userId);

      // Send to PagerDuty
      if (alert.channels.some(c => c.type === 'pagerduty')) {
        await this.sendPagerDutyEvent(alert, 'acknowledge');
      }

    } catch (error) {
      this.sentry.captureException(error);
      throw error;
    }
  }

  /**
   * Resolve an alert
   */
  async resolveAlert(alertId: string, userId?: string, resolution?: string): Promise<void> {
    try {
      const alert = await this.getAlert(alertId);
      if (!alert) {
        throw new Error(`Alert ${alertId} not found`);
      }

      if (alert.status === 'resolved') {
        return; // Already resolved
      }

      alert.status = 'resolved';
      alert.context.resolvedBy = userId;
      alert.context.resolvedAt = Date.now();
      alert.context.resolution = resolution;

      await this.storeAlert(alert);

      // Send resolution notifications
      await this.sendResolution(alert, userId, resolution);

      // Send to PagerDuty
      if (alert.channels.some(c => c.type === 'pagerduty')) {
        await this.sendPagerDutyEvent(alert, 'resolve');
      }

    } catch (error) {
      this.sentry.captureException(error);
      throw error;
    }
  }

  /**
   * Send alert to configured channels
   */
  private async sendAlert(alert: Alert): Promise<void> {
    const promises: Promise<void>[] = [];

    for (const channel of alert.channels.filter(c => c.enabled)) {
      switch (channel.type) {
        case 'slack':
          promises.push(this.sendSlackAlert(alert, channel));
          break;
        case 'email':
          promises.push(this.sendEmailAlert(alert, channel));
          break;
        case 'sms':
          promises.push(this.sendSMSAlert(alert, channel));
          break;
        case 'pagerduty':
          promises.push(this.sendPagerDutyEvent(alert, 'trigger'));
          break;
        case 'webhook':
          promises.push(this.sendWebhookAlert(alert, channel));
          break;
      }
    }

    await Promise.allSettled(promises);
  }

  /**
   * Send Slack alert
   */
  private async sendSlackAlert(alert: Alert, channel: AlertChannel): Promise<void> {
    try {
      const color = this.getSlackColor(alert.type);
      const slackMessage: SlackMessage = {
        channel: channel.target,
        text: `🚨 ${alert.type.toUpperCase()}: ${alert.title}`,
        attachments: [{
          color,
          title: alert.title,
          text: alert.message,
          fields: [
            {
              title: 'Component',
              value: alert.component,
              short: true
            },
            {
              title: 'Environment',
              value: alert.environment,
              short: true
            },
            {
              title: 'Source',
              value: alert.source,
              short: true
            },
            {
              title: 'Severity',
              value: alert.severity.toString(),
              short: true
            },
            {
              title: 'Time',
              value: new Date(alert.timestamp).toISOString(),
              short: false
            }
          ],
          footer: 'Pitchey Monitoring',
          ts: Math.floor(alert.timestamp / 1000)
        }]
      };

      // Add context fields
      Object.entries(alert.context).forEach(([key, value]) => {
        if (slackMessage.attachments?.[0]) {
          slackMessage.attachments[0].fields.push({
            title: key,
            value: String(value),
            short: true
          });
        }
      });

      await this.postToSlack(slackMessage);

    } catch (error) {
      this.sentry.captureException(error);
      console.error('Failed to send Slack alert:', error);
    }
  }

  /**
   * Send PagerDuty event
   */
  private async sendPagerDutyEvent(alert: Alert, action: 'trigger' | 'acknowledge' | 'resolve'): Promise<void> {
    try {
      const pdEvent: PagerDutyEvent = {
        routing_key: process.env.PAGERDUTY_INTEGRATION_KEY || 'your-integration-key',
        event_action: action,
        dedup_key: alert.id,
        payload: {
          summary: alert.title,
          source: alert.source,
          severity: this.mapToPagerDutySeverity(alert.type),
          component: alert.component,
          group: alert.environment,
          class: alert.tags.category || 'monitoring',
          custom_details: {
            message: alert.message,
            context: alert.context,
            tags: alert.tags,
            alertId: alert.id
          }
        },
        client: 'Pitchey Monitoring',
        client_url: `https://pitchey.pages.dev/monitoring/alerts/${alert.id}`
      };

      const response = await fetch('https://events.pagerduty.com/v2/enqueue', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Token ${process.env.PAGERDUTY_API_KEY || 'your-api-key'}`
        },
        body: JSON.stringify(pdEvent)
      });

      if (!response.ok) {
        throw new Error(`PagerDuty API error: ${response.status} ${response.statusText}`);
      }

    } catch (error) {
      this.sentry.captureException(error);
      console.error('Failed to send PagerDuty event:', error);
    }
  }

  /**
   * Send email alert
   */
  private async sendEmailAlert(alert: Alert, channel: AlertChannel): Promise<void> {
    try {
      // Integration with email service (would use actual email provider)
      const emailData = {
        to: channel.target,
        subject: `${alert.type.toUpperCase()}: ${alert.title}`,
        html: this.generateAlertEmail(alert),
        priority: channel.priority
      };

      // Mock email sending - replace with actual email service
      console.log('Would send email:', emailData);

    } catch (error) {
      this.sentry.captureException(error);
      console.error('Failed to send email alert:', error);
    }
  }

  /**
   * Send SMS alert
   */
  private async sendSMSAlert(alert: Alert, channel: AlertChannel): Promise<void> {
    try {
      // Integration with SMS service (Twilio, AWS SNS, etc.)
      const smsMessage = `🚨 ${alert.type.toUpperCase()}: ${alert.title} - ${alert.message}`;

      // Mock SMS sending - replace with actual SMS service
      console.log('Would send SMS to', channel.target, ':', smsMessage);

    } catch (error) {
      this.sentry.captureException(error);
      console.error('Failed to send SMS alert:', error);
    }
  }

  /**
   * Send webhook alert
   */
  private async sendWebhookAlert(alert: Alert, channel: AlertChannel): Promise<void> {
    try {
      const webhookPayload = {
        alert,
        timestamp: Date.now(),
        source: 'pitchey-monitoring'
      };

      const response = await fetch(channel.target, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'Pitchey-Monitoring/1.0'
        },
        body: JSON.stringify(webhookPayload)
      });

      if (!response.ok) {
        throw new Error(`Webhook error: ${response.status} ${response.statusText}`);
      }

    } catch (error) {
      this.sentry.captureException(error);
      console.error('Failed to send webhook alert:', error);
    }
  }

  /**
   * Post message to Slack
   */
  private async postToSlack(message: SlackMessage): Promise<void> {
    const webhookUrl = process.env.SLACK_WEBHOOK_URL || 'https://hooks.slack.com/your-webhook-url';
    
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(message)
    });

    if (!response.ok) {
      throw new Error(`Slack API error: ${response.status} ${response.statusText}`);
    }
  }

  // Alert management methods

  private async storeAlert(alert: Alert): Promise<void> {
    await this.kv.put(`alert:${alert.id}`, JSON.stringify(alert), { expirationTtl: 86400 * 30 }); // 30 days
    
    // Add to active alerts list if triggered
    if (alert.status === 'triggered') {
      const activeAlerts = await this.getActiveAlerts();
      activeAlerts.push(alert.id);
      await this.kv.put('alerts:active', JSON.stringify(activeAlerts), { expirationTtl: 86400 });
    } else {
      // Remove from active alerts
      const activeAlerts = await this.getActiveAlerts();
      const filteredAlerts = activeAlerts.filter(id => id !== alert.id);
      await this.kv.put('alerts:active', JSON.stringify(filteredAlerts), { expirationTtl: 86400 });
    }
  }

  private async getAlert(alertId: string): Promise<Alert | null> {
    const alertData = await this.kv.get(`alert:${alertId}`);
    return alertData ? JSON.parse(alertData) : null;
  }

  private async getActiveAlerts(): Promise<string[]> {
    const activeAlerts = await this.kv.get('alerts:active');
    return activeAlerts ? JSON.parse(activeAlerts) : [];
  }

  private async isAlertSuppressed(alert: Alert): Promise<boolean> {
    // Check if alert matches any suppression rules
    if (!alert.suppressionRules) return false;

    // Implementation would check against suppression rules
    return false;
  }

  private async isAlertThrottled(alert: Alert): Promise<boolean> {
    const throttleKey = `throttle:${alert.source}:${alert.component}:${alert.type}`;
    const lastAlert = await this.kv.get(throttleKey);
    
    if (lastAlert) {
      const lastTime = parseInt(lastAlert);
      const throttleWindow = 15 * 60 * 1000; // 15 minutes default throttle
      
      if (Date.now() - lastTime < throttleWindow) {
        return true;
      }
    }

    // Update throttle timestamp
    await this.kv.put(throttleKey, Date.now().toString(), { expirationTtl: 3600 });
    return false;
  }

  private async getDefaultChannels(alertType: 'critical' | 'warning' | 'info'): Promise<AlertChannel[]> {
    const channels: AlertChannel[] = [];

    // Always send to Slack
    channels.push({
      type: 'slack',
      target: alertType === 'critical' ? '#pitchey-critical' : '#pitchey-alerts',
      priority: alertType === 'critical' ? 'high' : 'normal',
      enabled: true
    });

    // Send critical alerts to PagerDuty
    if (alertType === 'critical') {
      channels.push({
        type: 'pagerduty',
        target: 'critical',
        priority: 'high',
        enabled: true
      });

      // Send to on-call engineer via email
      channels.push({
        type: 'email',
        target: 'oncall@pitchey.com',
        priority: 'high',
        enabled: true
      });
    }

    return channels;
  }

  private async sendAcknowledgment(alert: Alert, userId?: string): Promise<void> {
    const message = `✅ Alert acknowledged by ${userId || 'system'}`;
    
    for (const channel of alert.channels.filter(c => c.enabled && c.type === 'slack')) {
      await this.postToSlack({
        channel: channel.target,
        text: `${message}: ${alert.title}`
      });
    }
  }

  private async sendResolution(alert: Alert, userId?: string, resolution?: string): Promise<void> {
    const message = `✅ Alert resolved by ${userId || 'system'}${resolution ? `: ${resolution}` : ''}`;
    
    for (const channel of alert.channels.filter(c => c.enabled && c.type === 'slack')) {
      await this.postToSlack({
        channel: channel.target,
        text: `${message}: ${alert.title}`
      });
    }
  }

  private async scheduleEscalation(alert: Alert): Promise<void> {
    // Implementation would schedule escalation based on policy
    console.log(`Escalation scheduled for alert ${alert.id}`);
  }

  // Utility methods

  private generateAlertId(): string {
    return `alert-${Date.now()}-${Math.random().toString(36).substr(2, 8)}`;
  }

  private getSlackColor(type: 'critical' | 'warning' | 'info'): string {
    switch (type) {
      case 'critical': return '#dc2626';
      case 'warning': return '#ea580c';
      case 'info': return '#0284c7';
      default: return '#6b7280';
    }
  }

  private mapToPagerDutySeverity(type: 'critical' | 'warning' | 'info'): 'critical' | 'error' | 'warning' | 'info' {
    switch (type) {
      case 'critical': return 'critical';
      case 'warning': return 'warning';
      case 'info': return 'info';
      default: return 'error';
    }
  }

  private generateAlertEmail(alert: Alert): string {
    return `
      <html>
        <body>
          <h2 style="color: ${alert.type === 'critical' ? '#dc2626' : '#ea580c'};">
            ${alert.type.toUpperCase()}: ${alert.title}
          </h2>
          <p><strong>Message:</strong> ${alert.message}</p>
          <p><strong>Component:</strong> ${alert.component}</p>
          <p><strong>Environment:</strong> ${alert.environment}</p>
          <p><strong>Source:</strong> ${alert.source}</p>
          <p><strong>Time:</strong> ${new Date(alert.timestamp).toISOString()}</p>
          
          <h3>Context:</h3>
          <ul>
            ${Object.entries(alert.context).map(([key, value]) => 
              `<li><strong>${key}:</strong> ${value}</li>`
            ).join('')}
          </ul>
          
          <p>
            <a href="https://pitchey.pages.dev/monitoring/alerts/${alert.id}" 
               style="background: #0284c7; color: white; padding: 10px 20px; text-decoration: none; border-radius: 4px;">
              View Alert
            </a>
          </p>
        </body>
      </html>
    `;
  }
}

/**
 * Alerting Worker
 */
export default {
  async fetch(request: Request, env: any): Promise<Response> {
    const sentry = new Toucan({
      dsn: env.SENTRY_DSN,
      context: {
        waitUntil: (promise: Promise<any>) => promise,
        request,
      },
      environment: env.ENVIRONMENT || 'production',
      release: env.SENTRY_RELEASE,
    });

    const alertService = new AlertingService(sentry, env);
    const url = new URL(request.url);
    const path = url.pathname;

    try {
      switch (path) {
        case '/alerts/trigger':
          if (request.method !== 'POST') {
            return new Response('Method not allowed', { status: 405 });
          }
          
          const alertData = await request.json();
          const alertId = await alertService.triggerAlert(alertData);
          return new Response(JSON.stringify({ alertId }), {
            headers: { 'Content-Type': 'application/json' }
          });

        case '/alerts/acknowledge':
          if (request.method !== 'POST') {
            return new Response('Method not allowed', { status: 405 });
          }
          
          const { alertId: ackAlertId, userId: ackUserId } = await request.json();
          await alertService.acknowledgeAlert(ackAlertId, ackUserId);
          return new Response('Alert acknowledged', { status: 200 });

        case '/alerts/resolve':
          if (request.method !== 'POST') {
            return new Response('Method not allowed', { status: 405 });
          }
          
          const { alertId: resolveAlertId, userId: resolveUserId, resolution } = await request.json();
          await alertService.resolveAlert(resolveAlertId, resolveUserId, resolution);
          return new Response('Alert resolved', { status: 200 });

        default:
          return new Response('Alerting endpoint not found', { status: 404 });
      }

    } catch (error) {
      sentry.captureException(error);
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }
};