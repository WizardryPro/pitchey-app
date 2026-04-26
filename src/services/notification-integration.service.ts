/**
 * Notification Integration Service
 * Integrates the comprehensive notification system with existing platform features
 */

import type { DatabaseService } from '../types/worker-types';
import { NotificationService, type NotificationData } from './notification.service';
import { PushNotificationService } from './push-notification.service';
import { IntelligentNotificationService } from './intelligent-notification.service';

export interface NotificationIntegrationConfig {
  database: DatabaseService;
  redis?: any;
  vapidKeys?: {
    publicKey: string;
    privateKey: string;
    subject: string;
  };
}

export class NotificationIntegrationService {
  private notificationService: NotificationService;
  private pushService: PushNotificationService;
  private intelligentService: IntelligentNotificationService;

  constructor(config: NotificationIntegrationConfig) {
    // Initialize all notification services
    this.pushService = new PushNotificationService(config.database, config.redis, config.vapidKeys);
    this.notificationService = new NotificationService(config.database, config.redis);
    this.intelligentService = new IntelligentNotificationService(
      config.database,
      this.notificationService,
      config.redis
    );
  }

  /**
   * Send notification for new investor interest
   */
  async notifyNewInvestorInterest(data: {
    pitchId: string;
    pitchTitle: string;
    pitchOwnerId: string;
    investorId: string;
    investorName: string;
  }): Promise<void> {
    const notificationData: any = {
      userId: parseInt(data.pitchOwnerId, 10) || 0,
      type: 'investment',
      category: 'investment',
      priority: 'high',
      title: `New investor interest in ${data.pitchTitle}`,
      message: `${data.investorName} has shown interest in your pitch "${data.pitchTitle}". They would like to review your project materials.`,
      relatedPitchId: parseInt(data.pitchId, 10) || undefined,
      actionUrl: `/dashboard/pitches/${data.pitchId}/investors`,
      metadata: {
        pitch_title: data.pitchTitle,
        investor_name: data.investorName,
        action_url: `/dashboard/pitches/${data.pitchId}/investors`,
      },
    };

    await this.sendIntelligentNotification(notificationData, 'new_investor_interest');
  }

  /**
   * Send notification for NDA approval
   */
  async notifyNDAApproval(data: {
    ndaRequestId: string;
    pitchId: string;
    pitchTitle: string;
    requesterId: string;
    approverId: string;
    approverName: string;
  }): Promise<void> {
    const notificationData: any = {
      userId: parseInt(data.requesterId, 10) || 0,
      type: 'nda_approval',
      category: 'project',
      priority: 'high',
      title: `NDA Approved for ${data.pitchTitle}`,
      message: `Your NDA for "${data.pitchTitle}" has been approved by ${data.approverName}. You can now access the full project details.`,
      contextType: 'nda',
      contextId: data.ndaRequestId,
      actionUrl: `/pitches/${data.pitchId}`,
      actionText: 'Access Project Details',
      variables: {
        pitch_title: data.pitchTitle,
        approver_name: data.approverName,
        action_url: `/pitches/${data.pitchId}`,
      },
    };

    await this.sendIntelligentNotification(notificationData, 'nda_approval_notification');
  }

  /**
   * Send notification for funding milestone reached
   */
  async notifyFundingMilestone(data: {
    pitchId: string;
    pitchTitle: string;
    pitchOwnerId: string;
    milestone: number;
    amountRaised: string;
    investorCount: number;
  }): Promise<void> {
    const notificationData: any = {
      userId: parseInt(data.pitchOwnerId, 10) || 0,
      type: 'investment',
      category: 'investment',
      priority: 'high',
      title: `Congratulations! ${data.pitchTitle} reached ${data.milestone}% funding`,
      message: `Exciting news! Your pitch "${data.pitchTitle}" has reached ${data.milestone}% of its funding goal. Total raised: ${data.amountRaised}.`,
      relatedPitchId: parseInt(data.pitchId, 10) || undefined,
      actionUrl: `/dashboard/pitches/${data.pitchId}/analytics`,
      metadata: {
        pitch_title: data.pitchTitle,
        milestone: data.milestone,
        amount_raised: data.amountRaised,
        investor_count: data.investorCount,
        action_url: `/dashboard/pitches/${data.pitchId}/analytics`,
      },
    };

    await this.sendIntelligentNotification(notificationData, 'funding_milestone_reached');
  }

  /**
   * Send notification for pitch status change
   */
  async notifyPitchStatusChange(data: {
    pitchId: string;
    pitchTitle: string;
    pitchOwnerId: string;
    oldStatus: string;
    newStatus: string;
    statusMessage?: string;
  }): Promise<void> {
    const priorityMap: Record<string, 'low' | 'normal' | 'high' | 'urgent'> = {
      approved: 'high',
      rejected: 'high',
      under_review: 'normal',
      published: 'high',
      draft: 'low',
    };

    const notificationData: any = {
      userId: parseInt(data.pitchOwnerId, 10) || 0,
      type: 'pitch_update',
      category: 'project',
      priority: priorityMap[data.newStatus] || 'normal',
      title: `Status Update: ${data.pitchTitle} is now ${data.newStatus}`,
      message: data.statusMessage || `Your pitch "${data.pitchTitle}" status has been updated to ${data.newStatus}.`,
      contextType: 'pitch',
      contextId: data.pitchId,
      actionUrl: `/dashboard/pitches/${data.pitchId}`,
      actionText: 'View Pitch Details',
      variables: {
        pitch_title: data.pitchTitle,
        new_status: data.newStatus,
        status_message: data.statusMessage || `Status updated to ${data.newStatus}`,
        action_url: `/dashboard/pitches/${data.pitchId}`,
      },
    };

    await this.sendIntelligentNotification(notificationData, 'pitch_status_change');
  }

  /**
   * Send security alert notification
   */
  async notifySecurityAlert(data: {
    userId: string;
    alertType: string;
    alertMessage: string;
    ipAddress?: string;
    userAgent?: string;
  }): Promise<void> {
    const notificationData: any = {
      userId: parseInt(data.userId, 10) || 0,
      type: 'system',
      category: 'system',
      priority: 'urgent',
      title: `Security Alert: ${data.alertType} detected`,
      message: `We detected ${data.alertType} on your account. ${data.alertMessage} Please review your account security.`,
      actionUrl: '/settings/security',
      metadata: {
        alert_type: data.alertType,
        alert_message: data.alertMessage,
        action_url: '/settings/security',
      },
    };

    // Security alerts always send immediately, bypassing intelligent routing
    await this.notificationService.sendNotification(notificationData);
  }

  /**
   * Send performance milestone notification
   */
  async notifyPerformanceMilestone(data: {
    userId: string;
    metricName: string;
    threshold: string;
    milestoneDetails: string;
    dashboardUrl: string;
  }): Promise<void> {
    const notificationData: any = {
      userId: parseInt(data.userId, 10) || 0,
      type: 'system',
      category: 'analytics',
      priority: 'normal',
      title: `Performance Milestone: ${data.metricName} reached ${data.threshold}`,
      message: `Congratulations! Your ${data.metricName} has reached ${data.threshold}. ${data.milestoneDetails}`,
      contextType: 'analytics',
      contextId: crypto.randomUUID(),
      actionUrl: data.dashboardUrl,
      actionText: 'View Analytics Dashboard',
      variables: {
        metric_name: data.metricName,
        threshold: data.threshold,
        milestone_details: data.milestoneDetails,
        action_url: data.dashboardUrl,
      },
    };

    await this.sendIntelligentNotification(notificationData, 'performance_milestone');
  }

  /**
   * Send market opportunity notification
   */
  async notifyMarketOpportunity(data: {
    userId: string;
    opportunityTitle: string;
    opportunityDescription: string;
    actionUrl: string;
  }): Promise<void> {
    const notificationData: any = {
      userId: parseInt(data.userId, 10) || 0,
      type: 'system',
      category: 'market',
      priority: 'normal',
      title: `Market Opportunity: ${data.opportunityTitle}`,
      message: `New market opportunity identified: ${data.opportunityTitle}. ${data.opportunityDescription}`,
      contextType: 'market',
      contextId: crypto.randomUUID(),
      actionUrl: data.actionUrl,
      actionText: 'Explore Opportunity',
      variables: {
        opportunity_title: data.opportunityTitle,
        opportunity_description: data.opportunityDescription,
        action_url: data.actionUrl,
      },
    };

    await this.sendIntelligentNotification(notificationData, 'market_opportunity');
  }

  /**
   * Send welcome notification for new users
   */
  async notifyWelcome(data: {
    userId: string;
    userName: string;
    userType: 'creator' | 'investor' | 'production';
  }): Promise<void> {
    const dashboardUrls = {
      creator: '/creator/dashboard',
      investor: '/investor/dashboard',
      production: '/production/dashboard',
    };

    const notificationData: any = {
      userId: parseInt(data.userId, 10) || 0,
      type: 'system',
      category: 'system',
      priority: 'normal',
      title: 'Welcome to Pitchey!',
      message: `Welcome to Pitchey, ${data.userName}! Complete your profile to get started with pitch creation and investment opportunities.`,
      contextType: 'user',
      contextId: data.userId,
      actionUrl: dashboardUrls[data.userType],
      actionText: 'Complete Profile',
      variables: {
        user_name: data.userName,
        user_type: data.userType,
        action_url: dashboardUrls[data.userType],
      },
    };

    await this.sendIntelligentNotification(notificationData, 'welcome_notification');
  }

  /**
   * Send team invitation notification
   */
  async notifyTeamInvitation(data: {
    inviteeId: string;
    inviterName: string;
    teamName: string;
    role: string;
    invitationId: string;
  }): Promise<void> {
    const notificationData: any = {
      userId: parseInt(data.inviteeId, 10) || 0,
      type: 'system',
      category: 'system',
      priority: 'high',
      title: `Team Invitation: ${data.teamName}`,
      message: `${data.inviterName} has invited you to join the team "${data.teamName}" as a ${data.role}.`,
      contextType: 'team',
      contextId: data.invitationId,
      actionUrl: `/team/invitations/${data.invitationId}`,
      actionText: 'View Invitation',
      variables: {
        inviter_name: data.inviterName,
        team_name: data.teamName,
        role: data.role,
        action_url: `/team/invitations/${data.invitationId}`,
      },
    };

    await this.sendIntelligentNotification(notificationData);
  }

  /**
   * Send maintenance notification
   */
  async notifyMaintenance(data: {
    userIds: string[];
    maintenanceDate: string;
    startTime: string;
    endTime: string;
    duration: string;
    maintenanceDetails: string;
  }): Promise<void> {
    const notifications: any[] = data.userIds.map(userId => ({
      userId,
      type: 'system',
      category: 'system',
      priority: 'normal',
      title: `Scheduled Maintenance: ${data.maintenanceDate}`,
      message: `Pitchey will undergo scheduled maintenance on ${data.maintenanceDate} from ${data.startTime} to ${data.endTime}. ${data.maintenanceDetails}`,
      contextType: 'system',
      contextId: crypto.randomUUID(),
      variables: {
        maintenance_date: data.maintenanceDate,
        start_time: data.startTime,
        end_time: data.endTime,
        duration: data.duration,
        maintenance_details: data.maintenanceDetails,
      },
    }));

    // Send as bulk notification
    for (const notification of notifications) {
      await this.notificationService.sendNotification(notification);
    }
  }

  /**
   * Send intelligent notification with routing
   */
  private async sendIntelligentNotification(
    data: NotificationData,
    templateName?: string
  ): Promise<void> {
    try {
      // Use intelligent routing for optimal timing
      const routingDecision = await this.intelligentService.processNotification(data);

      switch (routingDecision.action) {
        case 'send_immediately':
          await this.notificationService.sendNotification(data);
          break;
        
        case 'delay':
          if (routingDecision.timing) {
            // Schedule for later (would implement with job queue)
            console.log(`Scheduling notification for ${routingDecision.timing.sendTime}`);
            await this.scheduleNotification(data, routingDecision.timing.sendTime);
          } else {
            // Fallback to immediate
            await this.notificationService.sendNotification(data);
          }
          break;
        
        case 'batch':
          // Add to batch (would implement with batch system)
          console.log(`Adding to batch ${routingDecision.batchId}`);
          await this.addToBatch(data, routingDecision.batchId!);
          break;
        
        case 'suppress':
          console.log(`Suppressing notification: ${routingDecision.reason}`);
          break;
        
        default:
          await this.notificationService.sendNotification(data);
      }
    } catch (error) {
      console.error('Error in intelligent notification routing:', error);
      // Fallback to immediate send
      await this.notificationService.sendNotification(data);
    }
  }

  /**
   * Schedule notification for later delivery
   */
  private async scheduleNotification(data: NotificationData, sendTime: Date): Promise<void> {
    // This would integrate with a job queue system
    // For now, just log the scheduled time
    console.log(`Notification scheduled for ${sendTime}:`, data.title);
    
    // In a real implementation, you might:
    // 1. Store in a scheduled_notifications table
    // 2. Use a cron job or queue system to process later
    // 3. Use Cloudflare Durable Objects for scheduling
  }

  /**
   * Add notification to batch
   */
  private async addToBatch(data: NotificationData, batchId: string): Promise<void> {
    // This would add the notification to a batch
    // For now, just log the batch addition
    console.log(`Notification added to batch ${batchId}:`, data.title);
    
    // In a real implementation, you might:
    // 1. Store in a notification_batches table
    // 2. Process batches at scheduled times
    // 3. Combine multiple notifications into digest format
  }

  /**
   * Get notification services for direct access
   */
  getServices() {
    return {
      notification: this.notificationService,
      push: this.pushService,
      intelligent: this.intelligentService,
    };
  }

  /**
   * Process pending batches (call this periodically)
   */
  async processPendingBatches(): Promise<void> {
    await this.intelligentService.processBatches();
  }

  /**
   * Update user engagement based on interaction
   */
  async trackEngagement(
    userId: string,
    notificationId: string,
    action: 'opened' | 'clicked' | 'dismissed' | 'ignored'
  ): Promise<void> {
    await this.intelligentService.updateEngagement(userId, notificationId, action);
  }
}

export function createNotificationIntegration(
  config: NotificationIntegrationConfig
): NotificationIntegrationService {
  return new NotificationIntegrationService(config);
}