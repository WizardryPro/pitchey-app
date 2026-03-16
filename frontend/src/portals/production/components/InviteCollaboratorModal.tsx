import { useState } from 'react';
import { X, UserPlus, Loader2 } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { CollaboratorService } from '@/services/collaborator.service';

const ROLES = [
  { value: 'director', label: 'Director' },
  { value: 'line_producer', label: 'Line Producer' },
  { value: 'dp', label: 'Director of Photography' },
  { value: 'production_designer', label: 'Production Designer' },
  { value: 'editor', label: 'Editor' },
  { value: 'sound_designer', label: 'Sound Designer' },
  { value: 'custom', label: 'Custom Role' },
];

interface Props {
  projectId: number;
  onClose: () => void;
  onInvited?: () => void;
}

export default function InviteCollaboratorModal({ projectId, onClose, onInvited }: Props) {
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('director');
  const [customRoleName, setCustomRoleName] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.includes('@')) {
      toast.error('Please enter a valid email address');
      return;
    }
    if (role === 'custom' && !customRoleName.trim()) {
      toast.error('Please enter a custom role name');
      return;
    }

    try {
      setSubmitting(true);
      const response = await CollaboratorService.inviteCollaborator(projectId, {
        email: email.trim(),
        role,
        custom_role_name: role === 'custom' ? customRoleName.trim() : undefined,
      });

      if (response.success) {
        toast.success(`Invitation sent to ${email}`);
        onInvited?.();
        onClose();
      } else {
        toast.error(response.error || 'Failed to send invitation');
      }
    } catch (err) {
      const e = err instanceof Error ? err : new Error(String(err));
      toast.error(e.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-lg max-w-md w-full shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-lg font-semibold text-gray-900">Invite Collaborator</h2>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded transition">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email Address</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="collaborator@example.com"
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
            >
              {ROLES.map(r => (
                <option key={r.value} value={r.value}>{r.label}</option>
              ))}
            </select>
          </div>

          {role === 'custom' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Custom Role Name</label>
              <input
                type="text"
                value={customRoleName}
                onChange={(e) => setCustomRoleName(e.target.value)}
                placeholder="e.g. Stunt Coordinator"
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 transition font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 inline-flex items-center justify-center px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 transition font-medium disabled:opacity-50"
            >
              {submitting ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : (
                <UserPlus className="w-4 h-4 mr-2" />
              )}
              Send Invite
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
