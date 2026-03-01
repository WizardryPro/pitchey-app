import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  TrendingUp, TrendingDown, Activity, Globe, Calendar,
  BarChart3, PieChart, Download, Filter, Info
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@shared/components/ui/card';
import { Button } from '@shared/components/ui/button';
import { useBetterAuthStore } from '../../store/betterAuthStore';
import { investorApi } from '@/services/investor.service';

const MarketTrends = () => {
  const navigate = useNavigate();
  const { user, logout } = useBetterAuthStore();
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState('3m');
  const [trendsData, setTrendsData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadMarketTrends();
  }, []);

  const loadMarketTrends = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await investorApi.getMarketTrends();
      
      if (response.success && response.data) {
        setTrendsData(response.data);
      } else {
        setError('Failed to load market trends');
        setTrendsData(null);
      }
    } catch (error) {
      console.error('Failed to load market trends:', error);
      setError('Failed to load market trends');
      setTrendsData(null);
    } finally {
      setLoading(false);
    }
  };


  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  };

  if (loading) {
    return (
      <div>
                <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
        </div>
      </div>
    );
  }

  return (
    <div>
            <main className="container mx-auto px-4 py-6">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Market Trends</h1>
          <p className="text-gray-600 mt-2">Industry trends and market analysis</p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-yellow-100 border border-yellow-400 text-yellow-700 rounded-md">
            Data unavailable. {error}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Market Growth</p>
                  <p className="text-2xl font-bold text-green-600">
                    {trendsData != null ? `+${trendsData.marketGrowth ?? 0}%` : 'N/A'}
                  </p>
                </div>
                <TrendingUp className="h-8 w-8 text-green-600" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Total Investment</p>
                  <p className="text-2xl font-bold text-purple-600">
                    {trendsData != null ? formatCurrency(trendsData.totalInvestment ?? 0) : 'N/A'}
                  </p>
                </div>
                <Activity className="h-8 w-8 text-purple-600" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Active Pitches</p>
                  <p className="text-2xl font-bold text-blue-600">
                    {trendsData != null ? (trendsData.activePitches ?? 0) : 'N/A'}
                  </p>
                </div>
                <Globe className="h-8 w-8 text-blue-600" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Top Genres */}
        {trendsData?.topGenres && trendsData.topGenres.length > 0 && (
          <Card className="mb-8">
            <CardHeader>
              <CardTitle>Top Genres by Investment</CardTitle>
              <CardDescription>Most popular genres for investment activity</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {trendsData.topGenres.map((genre: any, index: number) => (
                  <div key={index} className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-medium text-gray-700 w-32">{genre.genre || genre.name}</span>
                      <div className="w-64 h-3 bg-gray-200 rounded-full">
                        <div
                          className="h-3 bg-purple-500 rounded-full"
                          style={{ width: `${Math.min(100, (genre.count || genre.investment_count || 0) * 10)}%` }}
                        />
                      </div>
                    </div>
                    <span className="text-sm font-semibold text-gray-900">
                      {genre.count || genre.investment_count || 0} investments
                    </span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Average Investment by Genre */}
        {trendsData?.avgInvestmentByGenre && trendsData.avgInvestmentByGenre.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Average Investment by Genre</CardTitle>
              <CardDescription>Mean investment amount per genre category</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="min-w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Genre</th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Avg Investment</th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Total Volume</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {trendsData.avgInvestmentByGenre.map((item: any, index: number) => (
                      <tr key={index} className="hover:bg-gray-50">
                        <td className="px-6 py-4 text-sm font-medium text-gray-900">{item.genre || item.name}</td>
                        <td className="px-6 py-4 text-sm text-right text-gray-900">{formatCurrency(item.avg_investment || item.avgInvestment || 0)}</td>
                        <td className="px-6 py-4 text-sm text-right text-green-600 font-medium">{formatCurrency(item.total_volume || item.totalVolume || 0)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Fallback if no genre data */}
        {(!trendsData?.topGenres || trendsData.topGenres.length === 0) && (!trendsData?.avgInvestmentByGenre || trendsData.avgInvestmentByGenre.length === 0) && (
          <Card>
            <CardHeader>
              <CardTitle>Market Analysis</CardTitle>
              <CardDescription>Comprehensive market trends and insights</CardDescription>
            </CardHeader>
            <CardContent className="h-48 flex items-center justify-center">
              <p className="text-gray-500">No genre-level data available yet. Invest in pitches to see market trends.</p>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
};

export default MarketTrends;