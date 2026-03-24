import React, { useState, useEffect, useRef } from 'react';
import { Activity, CheckCircle, XCircle, AlertTriangle, RefreshCw } from 'lucide-react';
import { adminService } from '../services/admin.service';

interface ServiceStatus {
  name: string;
  status: 'healthy' | 'unhealthy' | 'degraded' | 'unknown';
  responseTime?: number;
  message?: string;
  lastChecked?: string;
}

export default function AdminSystemHealth() {
  const [health, setHealth] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchHealth = async (silent = false) => {
    if (!silent) setLoading(true);
    else setRefreshing(true);
    setError(null);
    try {
      const result = await adminService.getSystemHealth();
      setHealth(result);
    } catch (err) {
      const e = err instanceof Error ? err : new Error(String(err));
      if (!silent) setError(e.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    void fetchHealth();
    intervalRef.current = setInterval(() => {
      void fetchHealth(true);
    }, 30000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'healthy': return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'unhealthy': return <XCircle className="w-5 h-5 text-red-500" />;
      case 'degraded': return <AlertTriangle className="w-5 h-5 text-yellow-500" />;
      default: return <Activity className="w-5 h-5 text-gray-400" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy': return 'bg-green-50 border-green-200';
      case 'unhealthy': return 'bg-red-50 border-red-200';
      case 'degraded': return 'bg-yellow-50 border-yellow-200';
      default: return 'bg-gray-50 border-gray-200';
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-gray-900">System Health</h1>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-white rounded-lg border border-gray-200 p-6 animate-pulse">
              <div className="h-5 bg-gray-200 rounded w-1/3 mb-3"></div>
              <div className="h-4 bg-gray-200 rounded w-1/2"></div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-gray-900">System Health</h1>
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          Failed to load system health: {error}
        </div>
        <button onClick={() => { void fetchHealth(); }} className="px-4 py-2 bg-purple-900 text-white rounded-lg hover:bg-purple-800 transition">
          Retry
        </button>
      </div>
    );
  }

  // Parse services from health response
  const services: ServiceStatus[] = [];
  // Normalize: API returns { health: { status, services: { database: {...} }, metrics: {...} } }
  const raw = health as any;
  const healthData = raw?.health ?? raw?.data ?? raw ?? {};
  const serviceMap: Record<string, string> = {
    database: 'Database (Neon)',
    redis: 'Cache (Upstash Redis)',
    storage: 'Storage (R2)',
    email: 'Email (Resend)',
  };

  for (const [key, label] of Object.entries(serviceMap)) {
    const svc = healthData.services?.[key] ?? healthData[key];
    if (svc) {
      services.push({
        name: label,
        status: svc.status ?? (svc.healthy ? 'healthy' : 'unhealthy'),
        responseTime: svc.response_time ?? svc.responseTime ?? svc.latency,
        message: svc.message ?? svc.error,
        lastChecked: svc.checkedAt ?? healthData.timestamp,
      });
    } else {
      services.push({ name: label, status: 'unknown', message: 'No data' });
    }
  }

  const overallStatus = healthData.status ?? (services.every(s => s.status === 'healthy') ? 'healthy' : services.some(s => s.status === 'unhealthy') ? 'unhealthy' : 'degraded');

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">System Health</h1>
        <button
          onClick={() => { void fetchHealth(true); }}
          disabled={refreshing}
          className="flex items-center gap-2 px-3 py-1.5 text-sm text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Overall Status */}
      <div className={`rounded-lg border p-6 ${getStatusColor(overallStatus)}`}>
        <div className="flex items-center gap-3">
          {getStatusIcon(overallStatus)}
          <div>
            <h2 className="text-lg font-semibold text-gray-900">
              System is {overallStatus === 'healthy' ? 'Operational' : overallStatus === 'degraded' ? 'Degraded' : 'Experiencing Issues'}
            </h2>
            <p className="text-sm text-gray-500">
              Auto-refreshes every 30 seconds
              {healthData.timestamp && ` \u2022 Last checked: ${new Date(healthData.timestamp).toLocaleTimeString()}`}
            </p>
          </div>
        </div>
      </div>

      {/* Service Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {services.map((service) => (
          <div key={service.name} className={`rounded-lg border p-6 ${getStatusColor(service.status)}`}>
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-gray-900">{service.name}</h3>
              {getStatusIcon(service.status)}
            </div>
            <div className="space-y-1">
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Status</span>
                <span className={`font-medium capitalize ${
                  service.status === 'healthy' ? 'text-green-700' :
                  service.status === 'unhealthy' ? 'text-red-700' :
                  service.status === 'degraded' ? 'text-yellow-700' : 'text-gray-500'
                }`}>
                  {service.status}
                </span>
              </div>
              {service.responseTime !== undefined && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Response Time</span>
                  <span className="font-medium text-gray-700">{service.responseTime}ms</span>
                </div>
              )}
              {service.message && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Details</span>
                  <span className="font-medium text-gray-700 text-right max-w-[200px] truncate">{service.message}</span>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
