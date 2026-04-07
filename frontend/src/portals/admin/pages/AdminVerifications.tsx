// Route: /admin/verifications
import React, { useState, useEffect, useCallback } from 'react';
import {
  CheckCircle,
  XCircle,
  AlertTriangle,
  MinusCircle,
  ExternalLink,
  RefreshCw,
  X,
} from 'lucide-react';

const API_URL = (import.meta.env['VITE_API_URL'] as string | undefined) ?? '';

// ─── Types ────────────────────────────────────────────────────────────────────

type AutoCheckResult = 'pass' | 'fail' | 'warn' | 'skip';
type VerificationStatus = 'pending' | 'auto_approved' | 'approved' | 'rejected';
type FilterTab = 'all' | VerificationStatus;

interface Verification {
  id: string;
  user_id: string;
  company_name: string;
  region: 'usa' | 'uk' | 'other';
  ein?: string;
  company_number?: string;
  website_url: string;
  has_company_number: boolean;
  proof_of_insurance_url?: string;
  status: VerificationStatus;
  auto_checks: Record<string, AutoCheckResult>;
  rejection_reason?: string;
  submitted_at: string;
  reviewed_at?: string;
  email: string;
  user_name?: string;
}

interface ApiResponse {
  verifications: Verification[];
  total: number;
  limit: number;
  offset: number;
}

// ─── Auto-check indicator ─────────────────────────────────────────────────────

function AutoCheckDot({ label, result }: { label: string; result: AutoCheckResult }) {
  const icons: Record<AutoCheckResult, React.ReactNode> = {
    pass: <CheckCircle className="w-4 h-4 text-green-500" />,
    fail: <XCircle className="w-4 h-4 text-red-500" />,
    warn: <AlertTriangle className="w-4 h-4 text-yellow-500" />,
    skip: <MinusCircle className="w-4 h-4 text-gray-400" />,
  };

  return (
    <span className="relative group inline-flex items-center">
      {icons[result]}
      {/* Tooltip */}
      <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 px-2 py-1 text-xs bg-gray-900 text-white rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
        {label}: {result}
      </span>
    </span>
  );
}

// ─── Status badge ─────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: VerificationStatus }) {
  const styles: Record<VerificationStatus, string> = {
    pending: 'bg-yellow-100 text-yellow-800',
    auto_approved: 'bg-blue-100 text-blue-800',
    approved: 'bg-green-100 text-green-800',
    rejected: 'bg-red-100 text-red-800',
  };
  const labels: Record<VerificationStatus, string> = {
    pending: 'Pending',
    auto_approved: 'Auto-approved',
    approved: 'Approved',
    rejected: 'Rejected',
  };

  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${styles[status]}`}>
      {labels[status]}
    </span>
  );
}

// ─── Reject modal ─────────────────────────────────────────────────────────────

interface RejectModalProps {
  companyName: string;
  onConfirm: (reason: string) => void;
  onCancel: () => void;
  loading: boolean;
}

function RejectModal({ companyName, onConfirm, onCancel, loading }: RejectModalProps) {
  const [reason, setReason] = useState('');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-base font-semibold text-gray-900">Reject Verification</h2>
          <button
            onClick={onCancel}
            className="text-gray-400 hover:text-gray-600 transition-colors"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-4 space-y-3">
          <p className="text-sm text-gray-600">
            Rejecting verification for <span className="font-medium text-gray-900">{companyName}</span>.
          </p>
          <div>
            <label htmlFor="rejection-reason" className="block text-sm font-medium text-gray-700 mb-1">
              Rejection reason <span className="text-gray-400 font-normal">(optional)</span>
            </label>
            <textarea
              id="rejection-reason"
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Explain why this verification is being rejected..."
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-400 resize-none"
            />
          </div>
        </div>
        <div className="flex justify-end gap-3 px-4 pb-4">
          <button
            onClick={onCancel}
            disabled={loading}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => onConfirm(reason)}
            disabled={loading}
            className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700 disabled:opacity-50 transition-colors"
          >
            {loading ? 'Rejecting…' : 'Confirm Reject'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── ID value helper ──────────────────────────────────────────────────────────

function getIdDisplay(v: Verification): { type: string; value: string } {
  if (v.region === 'usa' && v.ein) return { type: 'EIN', value: v.ein };
  if (v.region === 'uk' && v.company_number) return { type: 'Companies House', value: v.company_number };
  if (v.has_company_number && v.company_number) return { type: 'Registration #', value: v.company_number };
  if (v.proof_of_insurance_url) return { type: 'Insurance', value: '(file attached)' };
  return { type: '—', value: '' };
}

// ─── Main component ───────────────────────────────────────────────────────────

const FILTER_TABS: { label: string; value: FilterTab }[] = [
  { label: 'All', value: 'all' },
  { label: 'Pending', value: 'pending' },
  { label: 'Auto-approved', value: 'auto_approved' },
  { label: 'Approved', value: 'approved' },
  { label: 'Rejected', value: 'rejected' },
];

const REGION_LABELS: Record<string, string> = {
  usa: 'USA',
  uk: 'UK',
  other: 'Other',
};

const AdminVerifications: React.FC = () => {
  const [verifications, setVerifications] = useState<Verification[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<FilterTab>('pending');
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Reject modal state
  const [rejectTarget, setRejectTarget] = useState<Verification | null>(null);

  const fetchVerifications = useCallback(async (status: FilterTab) => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ limit: '50', offset: '0' });
      if (status !== 'all') params.set('status', status);
      const res = await fetch(`${API_URL}/api/admin/verifications?${params}`, {
        credentials: 'include',
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: ApiResponse = await res.json() as ApiResponse;
      setVerifications(data.verifications);
      setTotal(data.total);
    } catch (err) {
      const e = err instanceof Error ? err : new Error(String(err));
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchVerifications(activeFilter);
  }, [activeFilter, fetchVerifications]);

  const handleDecision = async (id: string, approved: boolean, rejectionReason?: string) => {
    setActionLoading(id);
    try {
      const res = await fetch(`${API_URL}/api/admin/verifications/${id}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ approved, ...(rejectionReason ? { rejectionReason } : {}) }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      await fetchVerifications(activeFilter);
    } catch (err) {
      const e = err instanceof Error ? err : new Error(String(err));
      alert(`Action failed: ${e.message}`);
    } finally {
      setActionLoading(null);
      setRejectTarget(null);
    }
  };

  const handleApprove = (id: string) => void handleDecision(id, true);

  const handleRejectConfirm = (reason: string) => {
    if (!rejectTarget) return;
    void handleDecision(rejectTarget.id, false, reason || undefined);
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Company Verifications</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {loading ? 'Loading…' : `${total} verification${total !== 1 ? 's' : ''} total`}
          </p>
        </div>
        <button
          onClick={() => void fetchVerifications(activeFilter)}
          disabled={loading}
          className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 transition-colors"
          aria-label="Refresh"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1 mb-5 border-b border-gray-200">
        {FILTER_TABS.map(({ label, value }) => (
          <button
            key={value}
            onClick={() => setActiveFilter(value)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeFilter === value
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Error */}
      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md text-sm text-red-700">
          Failed to load verifications: {error}
        </div>
      )}

      {/* Table */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th scope="col" className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Company
                </th>
                <th scope="col" className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  User
                </th>
                <th scope="col" className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Region
                </th>
                <th scope="col" className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  ID
                </th>
                <th scope="col" className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Website
                </th>
                <th scope="col" className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Auto-checks
                </th>
                <th scope="col" className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th scope="col" className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Submitted
                </th>
                <th scope="col" className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-100">
              {loading && (
                <tr>
                  <td colSpan={9} className="px-4 py-8 text-center text-gray-400">
                    Loading…
                  </td>
                </tr>
              )}
              {!loading && verifications.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-4 py-8 text-center text-gray-400">
                    No verifications found.
                  </td>
                </tr>
              )}
              {!loading && verifications.map((v) => {
                const idDisplay = getIdDisplay(v);
                const isActing = actionLoading === v.id;
                const canAct = v.status === 'pending' || v.status === 'auto_approved';

                return (
                  <tr key={v.id} className="hover:bg-gray-50 transition-colors">
                    {/* Company */}
                    <td className="px-4 py-3 font-medium text-gray-900 whitespace-nowrap">
                      {v.company_name}
                    </td>

                    {/* User */}
                    <td className="px-4 py-3 text-gray-600">
                      <div>{v.user_name ?? '—'}</div>
                      <div className="text-xs text-gray-400">{v.email}</div>
                    </td>

                    {/* Region */}
                    <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                      {REGION_LABELS[v.region] ?? v.region}
                    </td>

                    {/* ID */}
                    <td className="px-4 py-3 text-gray-600">
                      <span className="text-xs font-semibold text-gray-500 uppercase mr-1">
                        {idDisplay.type}
                      </span>
                      {idDisplay.value && (
                        <span className="font-mono text-xs">{idDisplay.value}</span>
                      )}
                    </td>

                    {/* Website */}
                    <td className="px-4 py-3">
                      {v.website_url ? (
                        <a
                          href={v.website_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-indigo-600 hover:text-indigo-800 hover:underline text-xs"
                        >
                          {v.website_url.replace(/^https?:\/\//, '').slice(0, 30)}
                          {v.website_url.length > 40 && '…'}
                          <ExternalLink className="w-3 h-3 flex-shrink-0" />
                        </a>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>

                    {/* Auto-checks */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {Object.keys(v.auto_checks).length === 0 ? (
                          <span className="text-gray-400 text-xs">—</span>
                        ) : (
                          Object.entries(v.auto_checks).map(([key, result]) => (
                            <AutoCheckDot key={key} label={key} result={result as AutoCheckResult} />
                          ))
                        )}
                      </div>
                    </td>

                    {/* Status */}
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="space-y-1">
                        <StatusBadge status={v.status} />
                        {v.rejection_reason && (
                          <p className="text-xs text-gray-400 max-w-[160px] truncate" title={v.rejection_reason}>
                            {v.rejection_reason}
                          </p>
                        )}
                      </div>
                    </td>

                    {/* Submitted */}
                    <td className="px-4 py-3 text-gray-500 whitespace-nowrap text-xs">
                      {new Date(v.submitted_at).toLocaleDateString('en-GB', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </td>

                    {/* Actions */}
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      {canAct ? (
                        <div className="inline-flex gap-2">
                          <button
                            onClick={() => handleApprove(v.id)}
                            disabled={isActing}
                            className="px-3 py-1.5 text-xs font-medium text-white bg-green-600 rounded hover:bg-green-700 disabled:opacity-50 transition-colors"
                          >
                            Approve
                          </button>
                          <button
                            onClick={() => setRejectTarget(v)}
                            disabled={isActing}
                            className="px-3 py-1.5 text-xs font-medium text-white bg-red-600 rounded hover:bg-red-700 disabled:opacity-50 transition-colors"
                          >
                            Reject
                          </button>
                        </div>
                      ) : (
                        <span className="text-xs text-gray-400">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Reject modal */}
      {rejectTarget && (
        <RejectModal
          companyName={rejectTarget.company_name}
          onConfirm={handleRejectConfirm}
          onCancel={() => setRejectTarget(null)}
          loading={actionLoading === rejectTarget.id}
        />
      )}
    </div>
  );
};

export default AdminVerifications;
