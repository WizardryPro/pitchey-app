import { useState, useEffect } from 'react';
import { investorApi } from '../../services/investor.service';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@shared/components/ui/card';
import { Button } from '@shared/components/ui/button';
import { Download, FileText, Calendar, TrendingUp, DollarSign, BarChart3, PieChart, FileSpreadsheet, Loader2 } from 'lucide-react';

interface Report {
  id: string;
  title: string;
  type: string;
  category: string;
  date: string;
  fileSize: string;
  format: string;
  description: string;
}

const InvestorReports = () => {
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedPeriod, setSelectedPeriod] = useState<string>('all');

  useEffect(() => {
    const fetchReports = async () => {
      try {
        setLoading(true);
        const response = await investorApi.getReports() as { success: boolean; data?: { reports?: Report[] } };
        if (response.success && response.data?.reports) {
          setReports(response.data.reports);
        } else {
          setReports([]);
        }
      } catch (err) {
        const e = err instanceof Error ? err : new Error(String(err));
        setError(e.message);
        setReports([]);
      } finally {
        setLoading(false);
      }
    };
    fetchReports();
  }, []);

  const filteredReports = reports.filter(report => {
    const categoryMatch = selectedCategory === 'all' || report.category === selectedCategory;
    const periodMatch = selectedPeriod === 'all' || report.type === selectedPeriod;
    return categoryMatch && periodMatch;
  });

  const getFormatColor = (format: string) => {
    switch (format) {
      case 'pdf':
        return 'text-red-600 bg-red-100';
      case 'excel':
        return 'text-green-600 bg-green-100';
      case 'csv':
        return 'text-blue-600 bg-blue-100';
      default:
        return 'text-gray-600 bg-gray-100';
    }
  };

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'performance':
        return 'text-purple-600 bg-purple-100';
      case 'portfolio':
        return 'text-blue-600 bg-blue-100';
      case 'tax':
        return 'text-orange-600 bg-orange-100';
      case 'analytics':
        return 'text-green-600 bg-green-100';
      default:
        return 'text-gray-600 bg-gray-100';
    }
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'performance': return TrendingUp;
      case 'portfolio': return DollarSign;
      case 'tax': return FileText;
      case 'analytics': return BarChart3;
      default: return FileText;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div>
      <main className="container mx-auto px-4 py-6">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Investment Reports</h1>
          <p className="text-gray-600 mt-2">
            Download and review your investment reports and tax documents
          </p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
            Failed to load reports: {error}
          </div>
        )}

        {/* Filters */}
        <div className="mb-6 flex flex-wrap gap-4">
          <div className="flex gap-2">
            <Button
              variant={selectedCategory === 'all' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setSelectedCategory('all')}
            >
              All Categories
            </Button>
            <Button
              variant={selectedCategory === 'performance' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setSelectedCategory('performance')}
            >
              Performance
            </Button>
            <Button
              variant={selectedCategory === 'portfolio' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setSelectedCategory('portfolio')}
            >
              Portfolio
            </Button>
            <Button
              variant={selectedCategory === 'tax' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setSelectedCategory('tax')}
            >
              Tax Documents
            </Button>
            <Button
              variant={selectedCategory === 'analytics' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setSelectedCategory('analytics')}
            >
              Analytics
            </Button>
          </div>

          <div className="flex gap-2">
            <Button
              variant={selectedPeriod === 'all' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setSelectedPeriod('all')}
            >
              All Periods
            </Button>
            <Button
              variant={selectedPeriod === 'monthly' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setSelectedPeriod('monthly')}
            >
              Monthly
            </Button>
            <Button
              variant={selectedPeriod === 'quarterly' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setSelectedPeriod('quarterly')}
            >
              Quarterly
            </Button>
            <Button
              variant={selectedPeriod === 'annual' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setSelectedPeriod('annual')}
            >
              Annual
            </Button>
          </div>
        </div>

        {/* Reports List */}
        {filteredReports.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredReports.map((report) => {
              const Icon = getCategoryIcon(report.category);
              return (
                <Card key={report.id} className="hover:shadow-lg transition-shadow">
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="flex items-start space-x-3">
                        <div className="p-2 bg-purple-100 rounded-lg">
                          <Icon className="h-6 w-6 text-purple-600" />
                        </div>
                        <div className="flex-1">
                          <CardTitle className="text-lg">{report.title}</CardTitle>
                          <div className="flex gap-2 mt-2">
                            <span className={`px-2 py-1 text-xs font-medium rounded-full ${getCategoryColor(report.category)}`}>
                              {report.category}
                            </span>
                            <span className={`px-2 py-1 text-xs font-medium rounded-full ${getFormatColor(report.format)}`}>
                              {report.format.toUpperCase()}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <CardDescription className="mb-4">
                      {report.description}
                    </CardDescription>
                    <div className="flex items-center justify-between text-sm text-gray-500 mb-4">
                      <span className="flex items-center">
                        <Calendar className="h-4 w-4 mr-1" />
                        {new Date(report.date).toLocaleDateString()}
                      </span>
                      <span>{report.fileSize}</span>
                    </div>
                    <Button className="w-full" variant="outline">
                      <Download className="h-4 w-4 mr-2" />
                      Download Report
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-16">
            <FileText className="h-16 w-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No reports available yet</h3>
            <p className="text-gray-500 max-w-md mx-auto">
              Reports will be generated as your investment activity grows. Check back after making your first investment.
            </p>
          </div>
        )}
      </main>
    </div>
  );
};

export default InvestorReports;
