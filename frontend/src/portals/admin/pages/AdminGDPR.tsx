import React, { useState, useEffect } from 'react';
import { Lock, FileText, Users, Shield, Clock } from 'lucide-react';
import { adminService } from '../services/admin.service';

export default function AdminGDPR() {
  const [metrics, setMetrics] = useState<any>(null);
  const [requests, setRequests] = useState<any[]>([]);
  const [consent, setConsent] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    Promise.all([
      adminService.getGDPRMetrics(),
      adminService.getGDPRRequests(),
      adminService.getConsentMetrics(),
    ])
      .then(([metricsData, requestsData, consentData]) => {
        if (cancelled) return;
        setMetrics(metricsData?.data ?? metricsData);
        const reqArray = requestsData as any;
        setRequests(Array.isArray(reqArray?.data) ? reqArray.data : Array.isArray(reqArray) ? reqArray : []);
        setConsent(consentData?.data ?? consentData);
      })
      .catch((err) => {
        const e = err instanceof Error ? err : new Error(String(err));
        if (!cancelled) setError(e.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, []);

  if (loading) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-gray-900">GDPR Compliance</h1>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-white rounded-lg border border-gray-200 p-6 animate-pulse">
              <div className="h-4 bg-gray-200 rounded w-1/2 mb-4"></div>
              <div className="h-8 bg-gray-200 rounded w-3/4"></div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-gray-900">GDPR Compliance</h1>
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          Failed to load GDPR data: {error}
        </div>
      </div>
    );
  }

  const pendingRequests = requests.filter(r => r.status === 'pending');

  const kpis = [
    { label: 'Total Requests', value: metrics?.totalRequests ?? requests.length, icon: FileText, color: 'purple' },
    { label: 'Pending', value: metrics?.pendingRequests ?? pendingRequests.length, icon: Clock, color: 'yellow' },
    { label: 'Users with Consent', value: metrics?.usersWithConsent ?? consent?.totalConsented ?? 0, icon: Users, color: 'green' },
    { label: 'Compliance Rate', value: `${(metrics?.complianceRate ?? consent?.complianceRate ?? 0).toFixed(1)}%`, icon: Shield, color: 'blue' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">GDPR Compliance</h1>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map((kpi) => {
          const Icon = kpi.icon;
          return (
            <div key={kpi.label} className="bg-white rounded-lg border border-gray-200 p-6">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-gray-500">{kpi.label}</span>
                <Icon className={`w-5 h-5 text-${kpi.color}-600`} />
              </div>
              <div className="text-2xl font-bold text-gray-900">{kpi.value}</div>
            </div>
          );
        })}
      </div>

      {/* Consent Breakdown */}
      {consent && (
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Consent Preferences</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {(consent.preferences ?? consent.consents ?? []).map((pref: any, idx: number) => (
              <div key={idx} className="bg-gray-50 rounded-lg p-4">
                <p className="text-sm font-medium text-gray-700">{pref.type ?? pref.name ?? `Consent Type ${idx + 1}`}</p>
                <p className="text-lg font-bold text-gray-900 mt-1">{pref.count ?? pref.granted ?? 0} users</p>
                <p className="text-xs text-gray-500 mt-1">
                  {pref.percentage != null ? `${pref.percentage.toFixed(1)}% of total` : ''}
                </p>
              </div>
            ))}
            {(!consent.preferences && !consent.consents) && (
              <p className="text-sm text-gray-500 col-span-3">No consent data available.</p>
            )}
          </div>
        </div>
      )}

      {/* Requests Queue */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">Data Subject Requests</h3>
        </div>
        {requests.length === 0 ? (
          <div className="p-8 text-center text-gray-500">No GDPR requests found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">User</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">Type</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">Status</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">Submitted</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {requests.map((req, idx) => (
                  <tr key={req.id ?? idx} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-gray-900">{req.user_email ?? req.userEmail ?? req.user_id ?? '\u2014'}</td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                        <Lock className="w-3 h-3" />
                        {req.type ?? req.request_type ?? '\u2014'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                        req.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                        req.status === 'completed' ? 'bg-green-100 text-green-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {req.status ?? '\u2014'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-500 whitespace-nowrap">
                      {req.created_at || req.createdAt
                        ? new Date(req.created_at ?? req.createdAt).toLocaleDateString()
                        : '\u2014'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
