import React, { useState } from 'react';
import { Shield, X } from 'lucide-react';
import { useBetterAuthStore } from '@/store/betterAuthStore';
import { adminService } from '@portals/admin/services/admin.service';

export function AdminInviteBanner() {
  const { user } = useBetterAuthStore();
  const [dismissed, setDismissed] = useState(false);
  const [accepting, setAccepting] = useState(false);

  if (!user?.adminInvitePending || dismissed) return null;

  const handleAccept = async () => {
    setAccepting(true);
    try {
      const result = await adminService.acceptAdminInvite();
      // Update the store user with new admin access
      const currentUser = useBetterAuthStore.getState().user;
      if (currentUser) {
        useBetterAuthStore.setState({
          user: {
            ...currentUser,
            adminAccess: true,
            adminInvitePending: false,
          }
        });
      }
    } catch (err) {
      const e = err instanceof Error ? err : new Error(String(err));
      console.error('Failed to accept admin invite:', e.message);
    } finally {
      setAccepting(false);
    }
  };

  return (
    <div className="bg-gradient-to-r from-purple-900 to-indigo-900 text-white px-4 py-3 rounded-lg mb-4 shadow-md">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Shield className="w-5 h-5 flex-shrink-0" />
          <div>
            <p className="font-medium text-sm">You've been invited as a platform admin</p>
            <p className="text-purple-200 text-xs">Accept to gain access to the Admin Portal alongside your current portal.</p>
          </div>
        </div>
        <div className="flex items-center gap-2 ml-4">
          <button
            onClick={() => { void handleAccept(); }}
            disabled={accepting}
            className="px-3 py-1.5 bg-white text-purple-900 text-sm font-medium rounded-md hover:bg-purple-50 transition disabled:opacity-50"
          >
            {accepting ? 'Accepting...' : 'Accept Invite'}
          </button>
          <button
            onClick={() => setDismissed(true)}
            className="p-1 text-purple-200 hover:text-white transition"
            aria-label="Dismiss"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
