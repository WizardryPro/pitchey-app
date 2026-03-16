import { useState } from 'react';
import { UserMinus, RefreshCw, Clock, CheckCircle, Loader2 } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { CollaboratorService, type Collaborator } from '@/services/collaborator.service';

const roleLabels: Record<string, string> = {
  director: 'Director',
  line_producer: 'Line Producer',
  dp: 'DP',
  production_designer: 'Prod. Designer',
  editor: 'Editor',
  sound_designer: 'Sound Designer',
  custom: 'Custom',
};

interface Props {
  projectId: number;
  collaborators: Collaborator[];
  isOwner: boolean;
  onRefresh: () => void;
}

export default function CollaboratorList({ projectId, collaborators, isOwner, onRefresh }: Props) {
  const [removing, setRemoving] = useState<number | null>(null);
  const [resending, setResending] = useState<number | null>(null);

  const handleRemove = async (collab: Collaborator) => {
    if (!confirm(`Remove ${collab.user?.name || collab.invited_email} from this project?`)) return;

    try {
      setRemoving(collab.id);
      const response = await CollaboratorService.removeCollaborator(projectId, collab.id);
      if (response.success) {
        toast.success('Collaborator removed');
        onRefresh();
      } else {
        toast.error(response.error || 'Failed to remove');
      }
    } catch (err) {
      const e = err instanceof Error ? err : new Error(String(err));
      toast.error(e.message);
    } finally {
      setRemoving(null);
    }
  };

  const handleResend = async (collab: Collaborator) => {
    try {
      setResending(collab.id);
      const response = await CollaboratorService.resendInvite(projectId, collab.id);
      if (response.success) {
        toast.success('Invitation resent');
      } else {
        toast.error(response.error || 'Failed to resend');
      }
    } catch (err) {
      const e = err instanceof Error ? err : new Error(String(err));
      toast.error(e.message);
    } finally {
      setResending(null);
    }
  };

  if (collaborators.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        <p>No collaborators yet. Invite team members to get started.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {collaborators.map((collab) => (
        <div key={collab.id} className="flex items-center justify-between p-3 bg-white rounded-lg border">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center">
              <span className="text-purple-600 font-medium text-sm">
                {(collab.user?.name || collab.invited_email)[0].toUpperCase()}
              </span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <p className="font-medium text-gray-900">
                  {collab.user?.name || collab.invited_email}
                </p>
                {collab.status === 'pending' ? (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                    <Clock className="w-3 h-3" />
                    Pending
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                    <CheckCircle className="w-3 h-3" />
                    Active
                  </span>
                )}
              </div>
              <p className="text-sm text-gray-500">
                {roleLabels[collab.role] || collab.custom_role_name || collab.role}
                {collab.status === 'active' && collab.accepted_at && (
                  <span> &middot; Joined {new Date(collab.accepted_at).toLocaleDateString()}</span>
                )}
              </p>
            </div>
          </div>

          {isOwner && (
            <div className="flex items-center gap-2">
              {collab.status === 'pending' && (
                <button
                  onClick={() => handleResend(collab)}
                  disabled={resending === collab.id}
                  className="p-1.5 text-gray-500 hover:text-purple-600 hover:bg-purple-50 rounded transition"
                  title="Resend invitation"
                >
                  {resending === collab.id ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <RefreshCw className="w-4 h-4" />
                  )}
                </button>
              )}
              <button
                onClick={() => handleRemove(collab)}
                disabled={removing === collab.id}
                className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded transition"
                title="Remove collaborator"
              >
                {removing === collab.id ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <UserMinus className="w-4 h-4" />
                )}
              </button>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
