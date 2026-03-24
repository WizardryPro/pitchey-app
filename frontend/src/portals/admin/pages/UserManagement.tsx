import React, { useState, useEffect } from 'react';
import { adminService } from '../services/admin.service';

interface User {
  id: string;
  email: string;
  name: string;
  userType: 'creator' | 'investor' | 'production' | 'admin';
  credits: number;
  status: 'active' | 'banned' | 'suspended';
  createdAt: string;
  lastLogin: string | null;
  pitchCount: number;
  investmentCount: number;
  adminAccess?: boolean;
  adminInvitePending?: boolean;
}

interface UserFilters {
  search: string;
  userType: string;
  status: string;
  sortBy: 'createdAt' | 'lastLogin' | 'name' | 'credits';
  sortOrder: 'asc' | 'desc';
}

const UserManagement: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<UserFilters>({
    search: '',
    userType: '',
    status: '',
    sortBy: 'createdAt',
    sortOrder: 'desc'
  });
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [showUserModal, setShowUserModal] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  useEffect(() => {
    loadUsers();
  }, [filters]);

  const loadUsers = async () => {
    try {
      setLoading(true);
      const data = await adminService.getUsers(filters) as any;
      // Normalize: API may return { users: [...] } or flat array
      const userList = Array.isArray(data) ? data : (data?.users ?? data?.data ?? []);
      // Map snake_case to camelCase
      const normalized = userList.map((u: any) => ({
        id: String(u.id),
        email: u.email,
        name: u.name ?? u.username ?? u.email?.split('@')[0] ?? '',
        userType: u.user_type ?? u.userType ?? 'creator',
        credits: u.credits ?? 0,
        status: u.status ?? 'active',
        createdAt: u.created_at ?? u.createdAt ?? '',
        lastLogin: u.last_login ?? u.lastLogin ?? null,
        pitchCount: u.total_pitches ?? u.pitchCount ?? 0,
        investmentCount: u.total_investments ?? u.investmentCount ?? 0,
        adminAccess: !!u.admin_access || !!u.adminAccess,
        adminInvitePending: !!u.admin_invite_pending || !!u.adminInvitePending,
      }));
      setUsers(normalized);
    } catch (err) {
      setError('Failed to load users');
      console.error('Users error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleInviteAdmin = async (userId: string) => {
    try {
      setActionLoading(userId);
      await adminService.inviteAsAdmin(userId);
      await loadUsers();
      setShowUserModal(false);
    } catch (err) {
      console.error('Invite admin error:', err);
    } finally {
      setActionLoading(null);
    }
  };

  const handleRevokeAdmin = async (userId: string) => {
    try {
      setActionLoading(userId);
      await adminService.revokeAdmin(userId);
      await loadUsers();
      setShowUserModal(false);
    } catch (err) {
      console.error('Revoke admin error:', err);
    } finally {
      setActionLoading(null);
    }
  };

  const handleBanUser = async (userId: string, banned: boolean) => {
    try {
      setActionLoading(userId);
      await adminService.updateUser(userId, {
        status: banned ? 'banned' : 'active'
      });
      await loadUsers();
      setShowUserModal(false);
    } catch (err) {
      console.error('Ban user error:', err);
      alert('Failed to update user status');
    } finally {
      setActionLoading(null);
    }
  };

  const handleUpdateCredits = async (userId: string, credits: number) => {
    try {
      setActionLoading(userId);
      await adminService.updateUser(userId, { credits });
      await loadUsers();
      setShowUserModal(false);
    } catch (err) {
      console.error('Update credits error:', err);
      alert('Failed to update user credits');
    } finally {
      setActionLoading(null);
    }
  };

  const getStatusBadge = (status: string) => {
    const styles = {
      active: 'bg-green-100 text-green-800',
      banned: 'bg-red-100 text-red-800',
      suspended: 'bg-yellow-100 text-yellow-800'
    };
    return `px-2 py-1 text-xs font-medium rounded-full ${styles[status as keyof typeof styles] || 'bg-gray-100 text-gray-800'}`;
  };

  const getUserTypeBadge = (userType: string) => {
    const styles = {
      creator: 'bg-blue-100 text-blue-800',
      investor: 'bg-green-100 text-green-800',
      production: 'bg-purple-100 text-purple-800',
      admin: 'bg-red-100 text-red-800'
    };
    return `px-2 py-1 text-xs font-medium rounded-full ${styles[userType as keyof typeof styles] || 'bg-gray-100 text-gray-800'}`;
  };

  const UserModal = ({ user }: { user: User }) => {
    const [newCredits, setNewCredits] = useState(user.credits);

    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-6 w-full max-w-md">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold">Manage User</h2>
            <button
              onClick={() => setShowUserModal(false)}
              className="text-gray-400 hover:text-gray-600"
            >
              ✕
            </button>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Email
              </label>
              <p className="text-gray-900">{user.email}</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Name
              </label>
              <p className="text-gray-900">{user.name}</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Type
              </label>
              <span className={getUserTypeBadge(user.userType)}>
                {user.userType}
              </span>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Status
              </label>
              <span className={getStatusBadge(user.status)}>
                {user.status}
              </span>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Credits
              </label>
              <div className="flex space-x-2">
                <input
                  type="number"
                  value={newCredits}
                  onChange={(e) => setNewCredits(Number(e.target.value))}
                  className="flex-1 border border-gray-300 rounded-md px-3 py-2"
                  min="0"
                />
                <button
                  onClick={() => handleUpdateCredits(user.id, newCredits)}
                  disabled={actionLoading === user.id}
                  className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:opacity-50"
                >
                  Update
                </button>
              </div>
            </div>

            <div className="pt-4 border-t">
              <p className="text-sm text-gray-600 mb-2">Actions</p>
              <div className="space-y-2">
                {/* Admin invite/revoke */}
                {user.adminAccess && user.userType !== 'admin' && (
                  <button
                    onClick={() => handleRevokeAdmin(user.id)}
                    disabled={actionLoading === user.id}
                    className="w-full bg-orange-600 text-white py-2 rounded hover:bg-orange-700 disabled:opacity-50"
                  >
                    Revoke Admin Access
                  </button>
                )}
                {user.adminInvitePending && (
                  <div className="w-full bg-yellow-50 text-yellow-800 py-2 px-3 rounded border border-yellow-200 text-center text-sm font-medium">
                    Admin Invite Pending
                  </div>
                )}
                {!user.adminAccess && !user.adminInvitePending && user.userType !== 'admin' && (
                  <button
                    onClick={() => handleInviteAdmin(user.id)}
                    disabled={actionLoading === user.id}
                    className="w-full bg-purple-900 text-white py-2 rounded hover:bg-purple-800 disabled:opacity-50"
                  >
                    Invite as Admin
                  </button>
                )}

                {/* Ban/Unban */}
                {user.status === 'active' ? (
                  <button
                    onClick={() => handleBanUser(user.id, true)}
                    disabled={actionLoading === user.id}
                    className="w-full bg-red-600 text-white py-2 rounded hover:bg-red-700 disabled:opacity-50"
                  >
                    Ban User
                  </button>
                ) : (
                  <button
                    onClick={() => handleBanUser(user.id, false)}
                    disabled={actionLoading === user.id}
                    className="w-full bg-green-600 text-white py-2 rounded hover:bg-green-700 disabled:opacity-50"
                  >
                    Unban User
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">User Management</h1>
          <p className="text-gray-600">Manage platform users, credits, and permissions</p>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Search
              </label>
              <input
                type="text"
                value={filters.search}
                onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                placeholder="Search by name or email..."
                className="w-full border border-gray-300 rounded-md px-3 py-2"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                User Type
              </label>
              <select
                value={filters.userType}
                onChange={(e) => setFilters({ ...filters, userType: e.target.value })}
                className="w-full border border-gray-300 rounded-md px-3 py-2"
              >
                <option value="">All Types</option>
                <option value="creator">Creator</option>
                <option value="investor">Investor</option>
                <option value="production">Production</option>
                <option value="admin">Admin</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Status
              </label>
              <select
                value={filters.status}
                onChange={(e) => setFilters({ ...filters, status: e.target.value })}
                className="w-full border border-gray-300 rounded-md px-3 py-2"
              >
                <option value="">All Statuses</option>
                <option value="active">Active</option>
                <option value="banned">Banned</option>
                <option value="suspended">Suspended</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Sort By
              </label>
              <select
                value={filters.sortBy}
                onChange={(e) => setFilters({ ...filters, sortBy: e.target.value as any })}
                className="w-full border border-gray-300 rounded-md px-3 py-2"
              >
                <option value="createdAt">Created Date</option>
                <option value="lastLogin">Last Login</option>
                <option value="name">Name</option>
                <option value="credits">Credits</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Order
              </label>
              <select
                value={filters.sortOrder}
                onChange={(e) => setFilters({ ...filters, sortOrder: e.target.value as any })}
                className="w-full border border-gray-300 rounded-md px-3 py-2"
              >
                <option value="desc">Descending</option>
                <option value="asc">Ascending</option>
              </select>
            </div>
          </div>
        </div>

        {/* Users Table */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    User
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Type
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Credits
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Activity
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {loading ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-4 text-center">
                      <div className="animate-pulse">Loading users...</div>
                    </td>
                  </tr>
                ) : users.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-4 text-center text-gray-500">
                      No users found
                    </td>
                  </tr>
                ) : (
                  users.map((user) => (
                    <tr key={user.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div>
                          <div className="text-sm font-medium text-gray-900">{user.name}</div>
                          <div className="text-sm text-gray-500">{user.email}</div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={getUserTypeBadge(user.userType)}>
                          {user.userType}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={getStatusBadge(user.status)}>
                          {user.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {user.credits}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        <div>
                          <div>Pitches: {user.pitchCount}</div>
                          <div>Investments: {user.investmentCount}</div>
                          <div>Last login: {user.lastLogin ? new Date(user.lastLogin).toLocaleDateString() : 'Never'}</div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <button
                          onClick={() => {
                            setSelectedUser(user);
                            setShowUserModal(true);
                          }}
                          className="text-blue-600 hover:text-blue-900"
                        >
                          Manage
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* User Modal */}
        {showUserModal && selectedUser && (
          <UserModal user={selectedUser} />
        )}

        {error && (
          <div className="fixed bottom-4 right-4 bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-red-600">{error}</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default UserManagement;