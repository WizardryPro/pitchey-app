// Team Management TypeScript Interfaces
// Shared interfaces for team-related components

export interface TeamMember {
  id: string;
  name: string;
  email: string;
  phone?: string;
  role: string;
  department: string;
  joinDate: string;
  lastActive: string;
  status: 'active' | 'inactive' | 'pending';
  avatar?: string;
  projects: number;
  rating: number;
  permissions: string[];
  location?: string;
  skills: string[];
  reportsTo?: string;
  bio?: string;
  socialLinks?: {
    linkedin?: string;
    twitter?: string;
    portfolio?: string;
  };
}

export interface TeamInvitation {
  id: string;
  email: string;
  name: string;
  role: string;
  department: string;
  invitedBy: string;
  invitedAt: string;
  expiresAt: string;
  status: 'pending' | 'accepted' | 'expired' | 'cancelled';
  lastReminderSent?: string;
  message?: string;
  permissions: string[];
  inviteLink?: string;
  acceptedAt?: string;
  cancelledAt?: string;
  cancelledBy?: string;
}

export interface TeamStats {
  totalMembers: number;
  activeMembers: number;
  inactiveMembers: number;
  pendingInvites: number;
  departments: number;
  averageRating: number;
  totalProjects: number;
  completedProjects: number;
  activeProjects: number;
  membersByDepartment: Record<string, number>;
  membersByRole: Record<string, number>;
  recentJoins: number; // last 30 days
}

export interface TeamActivity {
  id: string;
  type: 'member_joined' | 'member_left' | 'role_updated' | 'project_assigned' | 'project_completed' | 'invite_sent' | 'invite_accepted';
  user: string;
  targetUser?: string; // for actions involving another user
  description: string;
  timestamp: string;
  metadata?: {
    projectName?: string;
    previousRole?: string;
    newRole?: string;
    department?: string;
    inviteEmail?: string;
  };
}

export interface TeamEvent {
  id: string;
  title: string;
  type: 'meeting' | 'deadline' | 'review' | 'milestone' | 'training' | 'social';
  date: string;
  endDate?: string;
  participants: string[]; // member IDs or names
  organizer: string;
  location?: string;
  isVirtual?: boolean;
  meetingLink?: string;
  description?: string;
  priority: 'low' | 'medium' | 'high';
  status: 'scheduled' | 'in_progress' | 'completed' | 'cancelled';
  reminder?: {
    enabled: boolean;
    minutesBefore: number;
  };
}

export interface Permission {
  id: string;
  name: string;
  description: string;
  category: 'project' | 'team' | 'finance' | 'content' | 'admin';
  level: 'read' | 'write' | 'admin';
}

export interface Role {
  id: string;
  name: string;
  description: string;
  department: string;
  permissions: string[]; // permission IDs
  level: 'junior' | 'mid' | 'senior' | 'lead' | 'manager' | 'director';
  isCustom: boolean;
  createdBy?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface Department {
  id: string;
  name: string;
  description: string;
  head?: string; // member ID
  memberCount: number;
  activeProjects: number;
  budget?: number;
  color: string; // for UI theming
}

export interface TeamProject {
  id: string;
  name: string;
  description: string;
  status: 'planning' | 'in_progress' | 'on_hold' | 'completed' | 'cancelled';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  startDate: string;
  endDate?: string;
  budget?: number;
  team: TeamMember[];
  lead: string; // member ID
  department: string;
  progress: number; // 0-100
  tags: string[];
}

// Form interfaces for creating/editing
export interface CreateMemberForm {
  name: string;
  email: string;
  phone?: string;
  role: string;
  department: string;
  permissions: string[];
  bio?: string;
  location?: string;
  skills: string[];
  reportsTo?: string;
  startDate: string;
}

export interface InviteForm {
  email: string;
  name: string;
  role: string;
  department: string;
  permissions: string[];
  message: string;
  expiryDays: number;
}

export interface EditMemberForm extends Partial<CreateMemberForm> {
  id: string;
}

// Filter and search interfaces
export interface TeamFilters {
  department: string;
  role: string;
  status: string;
  skills: string[];
  rating: {
    min: number;
    max: number;
  };
  joinDate: {
    from?: string;
    to?: string;
  };
}

export interface TeamSearchQuery {
  term: string;
  filters: TeamFilters;
  sortBy: 'name' | 'role' | 'department' | 'joinDate' | 'rating' | 'projects';
  sortOrder: 'asc' | 'desc';
  page: number;
  limit: number;
}

// API response interfaces
export interface TeamMembersResponse {
  members: TeamMember[];
  total: number;
  page: number;
  limit: number;
  hasNext: boolean;
  hasPrevious: boolean;
}

export interface TeamInvitationsResponse {
  invitations: TeamInvitation[];
  total: number;
  pending: number;
  accepted: number;
  expired: number;
}

export interface TeamOverviewResponse {
  stats: TeamStats;
  recentActivity: TeamActivity[];
  upcomingEvents: TeamEvent[];
  departments: Department[];
  topPerformers: TeamMember[];
}

// Utility types
export type MemberStatus = TeamMember['status'];
export type InvitationStatus = TeamInvitation['status'];
export type ActivityType = TeamActivity['type'];
export type EventType = TeamEvent['type'];
export type ProjectStatus = TeamProject['status'];

// Constants
export const TEAM_DEPARTMENTS = [
  'Production',
  'Development', 
  'Creative',
  'Technical',
  'Marketing',
  'Finance',
  'Legal',
  'Operations'
] as const;

export const TEAM_ROLES = [
  'Producer',
  'Executive Producer',
  'Director',
  'Writer',
  'Screenwriter',
  'Editor',
  'Cinematographer',
  'Sound Designer',
  'VFX Supervisor',
  'VFX Artist',
  'Composer',
  'Casting Director',
  'Production Designer',
  'Costume Designer',
  'Makeup Artist',
  'Location Manager',
  'Script Supervisor',
  'Gaffer',
  'Camera Operator',
  'Boom Operator',
  'Colorist',
  'Sound Mixer',
  'Foley Artist',
  'Marketing Manager',
  'Publicist',
  'Financial Analyst',
  'Legal Advisor',
  'Project Manager',
  'Assistant Director',
  'Production Assistant'
] as const;

export const PERMISSION_CATEGORIES = [
  'project',
  'team', 
  'finance',
  'content',
  'admin'
] as const;

export const PERMISSION_LEVELS = [
  'read',
  'write', 
  'admin'
] as const;

export type TeamDepartment = typeof TEAM_DEPARTMENTS[number];
export type TeamRole = typeof TEAM_ROLES[number];
export type PermissionCategory = typeof PERMISSION_CATEGORIES[number];
export type PermissionLevel = typeof PERMISSION_LEVELS[number];