import { Shield, CheckCircle, Clock, XCircle, Lock, Eye } from 'lucide-react';

export type NDAStatus = 'none' | 'pending' | 'approved' | 'signed' | 'rejected' | 'required' | 'expired' | 'active';

interface NDAStatusBadgeProps {
  status: NDAStatus;
  requiresNDA?: boolean;
  className?: string;
  showLabel?: boolean;
}

const statusConfig = {
  none: {
    icon: Eye,
    label: 'Public',
    color: 'bg-gray-100 text-gray-700',
    iconColor: 'text-gray-500'
  },
  required: {
    icon: Lock,
    label: 'NDA Required',
    color: 'bg-amber-100 text-amber-800',
    iconColor: 'text-amber-600'
  },
  pending: {
    icon: Clock,
    label: 'NDA Pending',
    color: 'bg-yellow-100 text-yellow-800',
    iconColor: 'text-yellow-600'
  },
  approved: {
    icon: Shield,
    label: 'NDA Approved',
    color: 'bg-blue-100 text-blue-800',
    iconColor: 'text-blue-600'
  },
  signed: {
    icon: CheckCircle,
    label: 'NDA Signed',
    color: 'bg-green-100 text-green-800',
    iconColor: 'text-green-600'
  },
  rejected: {
    icon: XCircle,
    label: 'NDA Rejected',
    color: 'bg-red-100 text-red-800',
    iconColor: 'text-red-600'
  },
  expired: {
    icon: Clock,
    label: 'NDA Expired',
    color: 'bg-gray-100 text-gray-700',
    iconColor: 'text-gray-500'
  },
  active: {
    icon: CheckCircle,
    label: 'NDA Active',
    color: 'bg-green-100 text-green-800',
    iconColor: 'text-green-600'
  }
};

export default function NDAStatusBadge({ 
  status, 
  requiresNDA = false, 
  className = '',
  showLabel = true 
}: NDAStatusBadgeProps) {
  // Determine the actual status to display
  const displayStatus = status === 'none' && requiresNDA ? 'required' : status;
  const config = statusConfig[displayStatus as keyof typeof statusConfig] || statusConfig.none;
  const Icon = config.icon;

  return (
    <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${config.color} ${className}`}>
      <Icon className={`w-3.5 h-3.5 ${config.iconColor}`} />
      {showLabel && <span>{config.label}</span>}
    </div>
  );
}