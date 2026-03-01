import React, { useState } from 'react';
import { Download, FileSpreadsheet, FileText } from 'lucide-react';
import { toast } from 'react-hot-toast';

interface AnalyticsExportProps {
  data: Record<string, unknown>[];
  title?: string;
}

export const AnalyticsExport: React.FC<AnalyticsExportProps> = ({
  data,
  title = 'analytics'
}) => {
  const [menuOpen, setMenuOpen] = useState(false);

  const exportToCSV = () => {
    try {
      if (!data || data.length === 0) {
        toast.error('No data available to export');
        setMenuOpen(false);
        return;
      }
      const headers = Object.keys(data[0]);
      const csvRows = [
        headers.join(','),
        ...data.map(row => headers.map(h => JSON.stringify(row[h] ?? '')).join(','))
      ];
      const blob = new Blob([csvRows.join('\n')], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${title}-${new Date().toISOString().split('T')[0]}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('CSV exported successfully');
    } catch {
      toast.error('Export failed');
    }
    setMenuOpen(false);
  };

  const exportToJSON = () => {
    try {
      if (!data || data.length === 0) {
        toast.error('No data available to export');
        setMenuOpen(false);
        return;
      }
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${title}-${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('JSON exported successfully');
    } catch {
      toast.error('Export failed');
    }
    setMenuOpen(false);
  };

  return (
    <div className="relative">
      <button
        onClick={() => setMenuOpen(!menuOpen)}
        className="flex items-center gap-2 px-3 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
      >
        <Download className="w-4 h-4" />
        Export
      </button>

      {menuOpen && (
        <div className="absolute right-0 mt-2 w-48 bg-white border rounded-lg shadow-lg z-50">
          <button
            onClick={exportToCSV}
            className="flex items-center gap-2 w-full px-4 py-2 hover:bg-gray-100"
          >
            <FileSpreadsheet className="w-4 h-4 text-green-500" />
            Export to CSV
          </button>
          <button
            onClick={exportToJSON}
            className="flex items-center gap-2 w-full px-4 py-2 hover:bg-gray-100"
          >
            <FileText className="w-4 h-4 text-blue-500" />
            Export to JSON
          </button>
        </div>
      )}
    </div>
  );
};
