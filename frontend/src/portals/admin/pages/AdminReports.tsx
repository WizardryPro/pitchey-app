import React, { useState } from 'react';
import { FileBarChart, Download, Loader2 } from 'lucide-react';
import { adminService } from '../services/admin.service';

type ReportType = 'users' | 'transactions' | 'content' | 'revenue';

export default function AdminReports() {
  const [reportType, setReportType] = useState<ReportType>('users');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<Array<{ type: string; date: string; filename: string }>>([]);

  const handleGenerate = async () => {
    setGenerating(true);
    setError(null);
    try {
      const filters: Record<string, any> = {};
      if (dateFrom) filters.dateFrom = dateFrom;
      if (dateTo) filters.dateTo = dateTo;

      const blob = await adminService.generateReport(reportType, filters);
      const url = URL.createObjectURL(blob);
      const filename = `${reportType}-report-${new Date().toISOString().split('T')[0]}.csv`;
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);

      setHistory(prev => [{ type: reportType, date: new Date().toISOString(), filename }, ...prev]);
    } catch (err) {
      const e = err instanceof Error ? err : new Error(String(err));
      setError(e.message);
    } finally {
      setGenerating(false);
    }
  };

  const reportTypes: { value: ReportType; label: string; description: string }[] = [
    { value: 'users', label: 'Users Report', description: 'User accounts, roles, activity, and registration data' },
    { value: 'transactions', label: 'Transactions Report', description: 'Payment history, refunds, and revenue breakdown' },
    { value: 'content', label: 'Content Report', description: 'Pitch submissions, moderation actions, and genre distribution' },
    { value: 'revenue', label: 'Revenue Report', description: 'Revenue trends, subscription metrics, and credit purchases' },
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Reports</h1>

      {/* Report Type Selection */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {reportTypes.map((rt) => (
          <button
            key={rt.value}
            onClick={() => setReportType(rt.value)}
            className={`text-left p-4 rounded-lg border-2 transition-colors ${
              reportType === rt.value
                ? 'border-purple-900 bg-purple-50'
                : 'border-gray-200 bg-white hover:border-gray-300'
            }`}
          >
            <div className="flex items-center gap-3 mb-1">
              <FileBarChart className={`w-5 h-5 ${reportType === rt.value ? 'text-purple-900' : 'text-gray-400'}`} />
              <span className={`font-medium ${reportType === rt.value ? 'text-purple-900' : 'text-gray-900'}`}>
                {rt.label}
              </span>
            </div>
            <p className="text-sm text-gray-500 ml-8">{rt.description}</p>
          </button>
        ))}
      </div>

      {/* Date Range */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="text-sm font-medium text-gray-700 mb-3">Date Range (optional)</h3>
        <div className="flex flex-wrap items-center gap-4">
          <div>
            <label className="block text-xs text-gray-500 mb-1">From</label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-800"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">To</label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-800"
            />
          </div>
          <div className="pt-4">
            <button
              onClick={() => { void handleGenerate(); }}
              disabled={generating}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-purple-900 rounded-lg hover:bg-purple-800 transition disabled:opacity-50"
            >
              {generating ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Download className="w-4 h-4" />
              )}
              {generating ? 'Generating...' : 'Generate & Download'}
            </button>
          </div>
        </div>

        {error && (
          <div className="mt-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
            {error}
          </div>
        )}
      </div>

      {/* Download History (session-only) */}
      {history.length > 0 && (
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h3 className="text-sm font-medium text-gray-700 mb-3">Recent Downloads</h3>
          <div className="space-y-2">
            {history.map((item, idx) => (
              <div key={idx} className="flex items-center justify-between py-2 px-3 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-3">
                  <FileBarChart className="w-4 h-4 text-gray-400" />
                  <span className="text-sm text-gray-900">{item.filename}</span>
                </div>
                <span className="text-xs text-gray-500">{new Date(item.date).toLocaleTimeString()}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
