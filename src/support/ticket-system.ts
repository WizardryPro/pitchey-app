import { z } from 'zod';

// Ticket priority levels
export enum TicketPriority {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

// User types for routing
export enum UserType {
  CREATOR = 'creator',
  INVESTOR = 'investor',
  PRODUCTION = 'production',
  ADMIN = 'admin'
}

// Ticket categories
export enum TicketCategory {
  ACCOUNT = 'account',
  TECHNICAL = 'technical',
  BILLING = 'billing',
  NDA = 'nda',
  PITCH = 'pitch',
  OTHER = 'other'
}

// Ticket status
export enum TicketStatus {
  OPEN = 'open',
  IN_PROGRESS = 'in_progress',
  RESOLVED = 'resolved',
  CLOSED = 'closed'
}

// Ticket schema
export const TicketSchema = z.object({
  id: z.string().uuid(),
  userType: z.enum(UserType),
  userId: z.string(),
  category: z.enum(TicketCategory),
  priority: z.enum(TicketPriority),
  status: z.enum(TicketStatus),
  title: z.string().min(5).max(200),
  description: z.string().min(10).max(2000),
  attachments: z.array(z.string()).optional(),
  createdAt: z.date(),
  updatedAt: z.date(),
  resolvedAt: z.date().optional(),
  assignedAgentId: z.string().optional()
});

export type Ticket = z.infer<typeof TicketSchema>;

// Ticket routing logic
export function routeTicket(ticket: Ticket): string | null {
  // Implement intelligent ticket routing based on category and user type
  const routingMap = {
    [UserType.CREATOR]: {
      [TicketCategory.PITCH]: 'creator-support-team',
      [TicketCategory.NDA]: 'legal-team',
    },
    [UserType.INVESTOR]: {
      [TicketCategory.BILLING]: 'finance-team',
      [TicketCategory.TECHNICAL]: 'tech-support',
    },
    [UserType.PRODUCTION]: {
      [TicketCategory.PITCH]: 'production-support',
      [TicketCategory.OTHER]: 'general-support',
    }
  };

  return routingMap[ticket.userType]?.[ticket.category] || 'general-support';
}

// Ticket SLA (Service Level Agreement) tracker
export function calculateSLA(ticket: Ticket): number {
  const now = new Date();
  const createdAt = ticket.createdAt;
  const hoursSinceCreation = (now.getTime() - createdAt.getTime()) / (1000 * 60 * 60);

  const slaDurations = {
    [TicketPriority.CRITICAL]: 4,   // 4 hours
    [TicketPriority.HIGH]: 8,       // 8 hours
    [TicketPriority.MEDIUM]: 24,    // 24 hours
    [TicketPriority.LOW]: 72        // 72 hours
  };

  const slaHours = slaDurations[ticket.priority];
  const percentageComplete = Math.min(100, (hoursSinceCreation / slaHours) * 100);

  return percentageComplete;
}