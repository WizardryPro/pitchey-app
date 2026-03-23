import React, { useState, useEffect } from 'react';
import { ClipboardList, Shield, User, AlertTriangle, CheckCircle, XCircle } from 'lucide-react';
import { adminService } from '../services/admin.service';

export default function AdminModerationLog() {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionFilter, setActionFilter] = useState('');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    const filters: any = {};
    if (actionFilter) filters.action = actionFilter;

    adminService.getModerationLog(filters)
      .then((result) => {
        if (!cancelled) {
          const res = result as any;
          setLogs(Array.isArray(res?.data) ? res.data : Array.isArray(res) ? res : []);
        }
      })
      .catch((err) => {
        const e = err instanceof Error ? err : new Error(String(err));
        if (!cancelled) setError(e.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [actionFilter]);

  const getActionIcon = (action: string) => {
    switch (action) {
      case 'approve': return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'reject': return <XCircle className="w-4 h-4 text-red-500" />;
      case 'flag': return <AlertTriangle className="w-4 h-4 text-yellow-500" />;
      case 'ban': case 'suspend': return <Shield className="w-4 h-4 text-red-500" />;
      default: return <ClipboardList className="w-4 h-4 text-gray-400" />;
    }
  };

  const getActionColor = (action: string) => {
    switch (action) {
      case 'approve': case 'verify': case 'restore': return 'bg-green-100 text-green-800';
      case 'reject': case 'ban': case 'suspend': return 'bg-red-100 text-red-800';
      case 'flag': case 'warning': return 'bg-yellow-100 text-yellow-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const actionTypes = ['', 'approve', 'reject', 'flag', 'ban', 'suspend', 'verify', 'restore', 'warning'];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Moderation Log</h1>

      {/* Filter */}
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <div className="flex items-center gap-4">
          <label className="text-sm font-medium text-gray-700">Filter by action:</label>
          <select
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value)}
            className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-800"
          >
            <option value="">All Actions</option>
            {actionTypes.filter(Boolean).map((a) => (
              <option key={a} value={a}>{a.charAt(0).toUpperCase() + a.slice(1)}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          Failed to load moderation log: {error}
        </div>
      )}

      {/* Log Entries */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-500">Loading moderation log...</div>
        ) : logs.length === 0 ? (
          <div className="p-8 text-center text-gray-500">No moderation actions found.</div>
        ) : (
          <div className="divide-y divide-gray-100">
            {logs.map((log, idx) => (
              <div key={log.id ?? idx} className="p-4 hover:bg-gray-50">
                <div className="flex items-start gap-3">
                  {getActionIcon(log.action ?? log.type ?? '')}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${getActionColor(log.action ?? log.type ?? '')}`}>
                        {log.action ?? log.type ?? 'Unknown'}
                      </span>
                      <span className="text-xs text-gray-500">
                        {log.created_at || log.createdAt || log.timestamp
                          ? new Date(log.created_at ?? log.createdAt ?? log.timestamp).toLocaleString()
                          : ''}
                      </span>
                    </div>
                    <p className="text-sm text-gray-900">
                      {log.description ?? log.message ?? log.details ?? 'Moderation action performed'}
                    </p>
                    <div className="flex items-center gap-4 mt-1">
                      {(log.moderator ?? log.admin_email ?? log.adminEmail) && (
                        <span className="flex items-center gap-1 text-xs text-gray-500">
                          <User className="w-3 h-3" />
                          {log.moderator ?? log.admin_email ?? log.adminEmail}
                        </span>
                      )}
                      {(log.target ?? log.user ?? log.target_email ?? log.targetEmail) && (
                        <span className="text-xs text-gray-500">
                          Target: {log.target ?? log.user ?? log.target_email ?? log.targetEmail}
                        </span>
                      )}
                    </div>
                    {log.notes && (
                      <p className="text-xs text-gray-500 mt-1 italic">"{log.notes}"</p>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
