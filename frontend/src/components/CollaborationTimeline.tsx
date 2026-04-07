import { useState, useEffect } from 'react';
import {
  Handshake, Shield, FileCheck, Eye, MessageCircle,
  CheckCircle, XCircle, Clock,
} from 'lucide-react';
import { apiClient } from '../lib/api-client';

interface Milestone {
  key: string;
  label: string;
  timestamp: string | null;
  completed: boolean;
  order: number;
}

interface CollaborationTimelineProps {
  collaborationId: number | string;
}

const MILESTONE_ICONS: Record<string, React.ElementType> = {
  collaboration_requested: Handshake,
  nda_requested: Shield,
  nda_signed: FileCheck,
  pitch_viewed: Eye,
  first_message: MessageCircle,
  collaboration_accepted: CheckCircle,
  project_closed: XCircle,
};

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export default function CollaborationTimeline({ collaborationId }: CollaborationTimelineProps) {
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchTimeline();
  }, [collaborationId]);

  async function fetchTimeline() {
    try {
      const res = await apiClient.get<{ milestones: Milestone[] }>(
        `/api/collaborations/${collaborationId}/timeline`
      );
      if (res.success && res.data) {
        setMilestones(res.data.milestones);
      }
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-6">
        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-purple-600" />
      </div>
    );
  }

  if (milestones.length === 0) return null;

  const completedCount = milestones.filter(m => m.completed).length;
  const progressPct = Math.round((completedCount / milestones.length) * 100);

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <div className="flex items-center justify-between mb-4">
        <h4 className="text-sm font-semibold text-gray-900">Progress Timeline</h4>
        <span className="text-xs text-gray-500">{completedCount}/{milestones.length} completed</span>
      </div>

      {/* Progress bar */}
      <div className="w-full bg-gray-100 rounded-full h-1.5 mb-5">
        <div
          className="bg-purple-600 h-1.5 rounded-full transition-all duration-500"
          style={{ width: `${progressPct}%` }}
        />
      </div>

      {/* Milestones */}
      <div className="relative">
        {milestones.map((milestone, idx) => {
          const Icon = MILESTONE_ICONS[milestone.key] || Clock;
          const isLast = idx === milestones.length - 1;

          return (
            <div key={milestone.key} className="flex gap-3 relative">
              {/* Vertical line */}
              {!isLast && (
                <div
                  className={`absolute left-[15px] top-8 w-0.5 h-[calc(100%-8px)] ${
                    milestone.completed ? 'bg-purple-200' : 'bg-gray-100'
                  }`}
                />
              )}

              {/* Icon circle */}
              <div
                className={`relative z-10 flex items-center justify-center w-8 h-8 rounded-full flex-shrink-0 ${
                  milestone.completed
                    ? 'bg-purple-100 text-purple-600'
                    : 'bg-gray-50 text-gray-300'
                }`}
              >
                <Icon className="w-4 h-4" />
              </div>

              {/* Content */}
              <div className="pb-5 min-w-0">
                <p
                  className={`text-sm font-medium ${
                    milestone.completed ? 'text-gray-900' : 'text-gray-400'
                  }`}
                >
                  {milestone.label}
                </p>
                <p className="text-xs text-gray-400 mt-0.5">
                  {milestone.completed && milestone.timestamp
                    ? formatDate(milestone.timestamp)
                    : 'Pending'}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
