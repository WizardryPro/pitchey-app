import React, { useState, useEffect } from 'react';
import { Shield, Download, ChevronLeft, ChevronRight } from 'lucide-react';
import { adminService } from '../services/admin.service';

const PAGE_SIZE = 25;

export default function AdminAuditLog() {
  const [logs, setLogs] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [stats, setStats] = useState<any>(null);
  const [page, setPage] = useState(1);
  const [actionFilter, setActionFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    const filters: any = { page, limit: PAGE_SIZE };
    if (actionFilter) filters.action = actionFilter;

    Promise.all([
      adminService.getAuditLog(filters),
      page === 1 ? adminService.getAuditLogStats() : Promise.resolve(null),
    ])
      .then(([logResult, statsResult]) => {
        if (cancelled) return;
        const entries = logResult?.data ?? (Array.isArray(logResult) ? logResult : []);
        setLogs(entries);
        setTotal(logResult?.total ?? entries.length);
        if (statsResult) setStats(statsResult);
      })
      .catch((err) => {
        const e = err instanceof Error ? err : new Error(String(err));
        if (!cancelled) setError(e.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [page, actionFilter]);

  const handleExport = async () => {
    setExporting(true);
    try {
      const blob = await adminService.exportAuditLog();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `audit-log-${new Date().toISOString().split('T')[0]}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      const e = err instanceof Error ? err : new Error(String(err));
      console.error('Export failed:', e.message);
    } finally {
      setExporting(false);
    }
  };

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const actionTypes = [
    '', 'login', 'logout', 'create', 'update', 'delete',
    'approve', 'reject', 'flag', 'export', 'settings_change',
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Audit Log</h1>
        <button
          onClick={() => { void handleExport(); }}
          disabled={exporting}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-purple-900 rounded-lg hover:bg-purple-800 transition disabled:opacity-50"
        >
          <Download className="w-4 h-4" />
          {exporting ? 'Exporting...' : 'Export CSV'}
        </button>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <p className="text-sm text-gray-500">Total Events</p>
            <p className="text-xl font-bold text-gray-900">{(stats.totalEvents ?? stats.total ?? total).toLocaleString()}</p>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <p className="text-sm text-gray-500">Today</p>
            <p className="text-xl font-bold text-gray-900">{(stats.today ?? 0).toLocaleString()}</p>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <p className="text-sm text-gray-500">Unique Users</p>
            <p className="text-xl font-bold text-gray-900">{(stats.uniqueUsers ?? 0).toLocaleString()}</p>
          </div>
        </div>
      )}

      {/* Filter */}
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <div className="flex items-center gap-4">
          <label className="text-sm font-medium text-gray-700">Filter by action:</label>
          <select
            value={actionFilter}
            onChange={(e) => { setActionFilter(e.target.value); setPage(1); }}
            className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-800"
          >
            <option value="">All Actions</option>
            {actionTypes.filter(Boolean).map((a) => (
              <option key={a} value={a}>{a.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase())}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          Failed to load audit log: {error}
        </div>
      )}

      {/* Table */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-500">Loading audit log...</div>
        ) : logs.length === 0 ? (
          <div className="p-8 text-center text-gray-500">No audit log entries found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">Timestamp</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">User</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">Action</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">Resource</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">IP Address</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {logs.map((log, idx) => (
                  <tr key={log.id ?? idx} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-gray-500 whitespace-nowrap">
                      {log.created_at || log.createdAt
                        ? new Date(log.created_at ?? log.createdAt).toLocaleString()
                        : '\u2014'}
                    </td>
                    <td className="px-4 py-3 text-gray-900">
                      {log.user_email ?? log.userEmail ?? log.user_id ?? log.userId ?? '\u2014'}
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                        <Shield className="w-3 h-3" />
                        {log.action ?? '\u2014'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-700">
                      {log.resource_type ?? log.resourceType ?? '\u2014'}
                      {(log.resource_id ?? log.resourceId) ? ` #${log.resource_id ?? log.resourceId}` : ''}
                    </td>
                    <td className="px-4 py-3 text-gray-500 font-mono text-xs">
                      {log.ip_address ?? log.ipAddress ?? '\u2014'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200 bg-gray-50">
            <span className="text-sm text-gray-500">
              Page {page} of {totalPages} ({total} entries)
            </span>
            <div className="flex gap-2">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="p-1.5 rounded border border-gray-300 hover:bg-white disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="p-1.5 rounded border border-gray-300 hover:bg-white disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
