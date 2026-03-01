import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  ShieldAlert, AlertTriangle, CheckCircle, Info,
  TrendingUp, TrendingDown, Activity, BarChart3
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@shared/components/ui/card';
import { Button } from '@shared/components/ui/button';
import { useBetterAuthStore } from '../../store/betterAuthStore';
import { investorApi } from '@/services/investor.service';

const RiskAssessment = () => {
  const navigate = useNavigate();
  const { user, logout } = useBetterAuthStore();
  const [loading, setLoading] = useState(true);
  const [riskData, setRiskData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadRiskAssessment();
  }, []);

  const loadRiskAssessment = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await investorApi.getPortfolioRisk();
      
      if (response.success && response.data) {
        setRiskData(response.data);
      } else {
        setError('Failed to load risk assessment');
        setRiskData(null);
      }
    } catch (error) {
      console.error('Failed to load risk assessment:', error);
      setError('Failed to load risk assessment');
      setRiskData(null);
    } finally {
      setLoading(false);
    }
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
          <h1 className="text-3xl font-bold text-gray-900">Risk Assessment</h1>
          <p className="text-gray-600 mt-2">Portfolio risk analysis and mitigation strategies</p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-yellow-100 border border-yellow-400 text-yellow-700 rounded-md">
            Unable to load risk data. {error}
          </div>
        )}

        {riskData == null ? (
          <Card className="mb-8">
            <CardContent className="h-48 flex items-center justify-center">
              <p className="text-gray-500">No risk data available.</p>
            </CardContent>
          </Card>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600">Risk Level</p>
                      <p className="text-2xl font-bold text-yellow-600">
                        {riskData.overallRisk ?? riskData.overall_risk ?? 'N/A'}
                      </p>
                    </div>
                    <ShieldAlert className="h-8 w-8 text-yellow-600" />
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600">Risk Score</p>
                      <p className="text-2xl font-bold text-blue-600">
                        {(riskData.riskScore ?? riskData.risk_score ?? 0).toFixed(1)}/10
                      </p>
                    </div>
                    <Activity className="h-8 w-8 text-blue-600" />
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600">Diversification</p>
                      <p className="text-2xl font-bold text-green-600">
                        {riskData.diversification ?? riskData.diversification_rating ?? 'N/A'}
                      </p>
                    </div>
                    <CheckCircle className="h-8 w-8 text-green-600" />
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Portfolio Risk Distribution */}
            <Card className="mb-8">
              <CardHeader>
                <CardTitle>Portfolio Risk Distribution</CardTitle>
                <CardDescription>Breakdown of your investments by risk level</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <div className="flex justify-between text-sm mb-2">
                      <span className="text-gray-600 flex items-center gap-2">
                        <CheckCircle className="w-4 h-4 text-green-500" />
                        Low Risk
                      </span>
                      <span className="font-medium">{riskData.lowRisk ?? riskData.low_risk ?? riskData.portfolio?.lowRisk ?? 0}%</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-3">
                      <div
                        className="bg-green-500 h-3 rounded-full transition-all duration-300"
                        style={{ width: `${riskData.lowRisk ?? riskData.low_risk ?? riskData.portfolio?.lowRisk ?? 0}%` }}
                      />
                    </div>
                  </div>
                  <div>
                    <div className="flex justify-between text-sm mb-2">
                      <span className="text-gray-600 flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4 text-yellow-500" />
                        Medium Risk
                      </span>
                      <span className="font-medium">{riskData.mediumRisk ?? riskData.medium_risk ?? riskData.portfolio?.mediumRisk ?? 0}%</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-3">
                      <div
                        className="bg-yellow-500 h-3 rounded-full transition-all duration-300"
                        style={{ width: `${riskData.mediumRisk ?? riskData.medium_risk ?? riskData.portfolio?.mediumRisk ?? 0}%` }}
                      />
                    </div>
                  </div>
                  <div>
                    <div className="flex justify-between text-sm mb-2">
                      <span className="text-gray-600 flex items-center gap-2">
                        <ShieldAlert className="w-4 h-4 text-red-500" />
                        High Risk
                      </span>
                      <span className="font-medium">{riskData.highRisk ?? riskData.high_risk ?? riskData.portfolio?.highRisk ?? 0}%</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-3">
                      <div
                        className="bg-red-500 h-3 rounded-full transition-all duration-300"
                        style={{ width: `${riskData.highRisk ?? riskData.high_risk ?? riskData.portfolio?.highRisk ?? 0}%` }}
                      />
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </>
        )}

        {/* Risk by Category */}
        {(riskData?.byCategory || riskData?.by_category) && (
          <Card>
            <CardHeader>
              <CardTitle>Risk by Genre Category</CardTitle>
              <CardDescription>Risk assessment broken down by investment genre</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="min-w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Category</th>
                      <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Risk Level</th>
                      <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Investments</th>
                      <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Exposure</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {(riskData.byCategory || riskData.by_category || []).map((cat: any, index: number) => (
                      <tr key={index} className="hover:bg-gray-50">
                        <td className="px-6 py-4 text-sm font-medium text-gray-900">{cat.category || cat.genre}</td>
                        <td className="px-6 py-4 text-center">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            (cat.risk_level || cat.riskLevel) === 'low' ? 'bg-green-100 text-green-800' :
                            (cat.risk_level || cat.riskLevel) === 'high' ? 'bg-red-100 text-red-800' :
                            'bg-yellow-100 text-yellow-800'
                          }`}>
                            {cat.risk_level || cat.riskLevel || 'medium'}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-sm text-center text-gray-900">{cat.count || 0}</td>
                        <td className="px-6 py-4 text-sm text-center text-gray-900">{cat.exposure || cat.allocation || 0}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
};

export default RiskAssessment;