import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  PieChart, DollarSign, Target, Settings, Plus,
  BarChart3, TrendingUp, Calculator
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@shared/components/ui/card';
import { Button } from '@shared/components/ui/button';
import { investorApi } from '@features/deals/services/investor.service';

const BudgetAllocation = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [allocations, setAllocations] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [showNewModal, setShowNewModal] = useState(false);
  const [newCategory, setNewCategory] = useState('');
  const [newAmount, setNewAmount] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadBudgetAllocations();
  }, []);

  const loadBudgetAllocations = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await investorApi.getBudgetAllocations();

      if (response.success && response.data) {
        setAllocations((response.data as any).allocations || []);
      } else {
        setError('Failed to load budget allocations');
        setAllocations([]);
      }
    } catch (err) {
      const e = err instanceof Error ? err : new Error(String(err));
      console.error('Failed to load budget allocations:', e.message);
      setError('Failed to load budget allocations');
      setAllocations([]);
    } finally {
      setLoading(false);
    }
  };


  const handleCreateAllocation = async () => {
    const amount = parseFloat(newAmount);
    if (!newCategory.trim()) { toast.error('Enter a category'); return; }
    if (!Number.isFinite(amount) || amount <= 0) { toast.error('Enter a valid amount'); return; }
    try {
      setSaving(true);
      const res = await investorApi.createBudgetAllocation({ category: newCategory.trim(), allocated_amount: amount });
      if ((res as any)?.success !== false) {
        toast.success('Allocation created');
        setShowNewModal(false);
        setNewCategory('');
        setNewAmount('');
        await loadBudgetAllocations();
      } else {
        toast.error('Failed to create allocation');
      }
    } catch (err) {
      const e = err instanceof Error ? err : new Error(String(err));
      toast.error(e.message || 'Failed to create allocation');
    } finally {
      setSaving(false);
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

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  };

  const totalBudget = allocations.reduce((sum, allocation) => sum + (allocation.allocated_amount || allocation.allocated || 0), 0);
  const totalUsed = allocations.reduce((sum, allocation) => sum + (allocation.used_amount || allocation.used || 0), 0);
  const utilization = totalBudget > 0 ? (totalUsed / totalBudget) * 100 : 0;

  return (
    <div>
            <main className="container mx-auto px-4 py-6">
        <div className="mb-8">
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Budget Allocation</h1>
              <p className="text-gray-600 mt-2">Manage your investment budget across different categories</p>
            </div>
            <Button onClick={() => setShowNewModal(true)}>
              <Plus className="h-4 w-4 mr-2" />
              New Allocation
            </Button>
          </div>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-yellow-100 border border-yellow-400 text-yellow-700 rounded-md flex items-center justify-between">
            <span>{error}</span>
            <button
              onClick={() => void loadBudgetAllocations()}
              className="ml-4 px-3 py-1 text-sm border border-yellow-500 rounded hover:bg-yellow-200"
            >
              Retry
            </button>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Total Budget</p>
                  <p className="text-2xl font-bold text-gray-900">{formatCurrency(totalBudget)}</p>
                </div>
                <DollarSign className="h-8 w-8 text-purple-600" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Used</p>
                  <p className="text-2xl font-bold text-blue-600">{formatCurrency(totalUsed)}</p>
                </div>
                <Target className="h-8 w-8 text-blue-600" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Utilization</p>
                  <p className="text-2xl font-bold text-indigo-600">{utilization.toFixed(1)}%</p>
                </div>
                <Calculator className="h-8 w-8 text-indigo-600" />
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Category Allocations</CardTitle>
            <CardDescription>Budget distribution across different film categories</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {allocations.map((item, index) => {
                const allocated = item.allocated_amount || item.allocated || 0;
                const used = item.used_amount || item.used || 0;
                const percentage = item.percentage || (totalBudget > 0 ? (allocated / totalBudget) * 100 : 0);
                const utilization = allocated > 0 ? (used / allocated) * 100 : 0;
                
                return (
                  <div key={index} className="p-4 border rounded-lg">
                    <div className="flex justify-between items-center mb-2">
                      <h3 className="font-medium text-gray-900">{item.category}</h3>
                      <span className="text-sm font-medium text-purple-600">{percentage.toFixed(1)}%</span>
                    </div>
                    <div className="flex justify-between text-sm text-gray-600 mb-2">
                      <span>Used: {formatCurrency(used)}</span>
                      <span>Allocated: {formatCurrency(allocated)}</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div 
                        className="bg-purple-600 h-2 rounded-full"
                        style={{ width: `${Math.min(utilization, 100)}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </main>

      {showNewModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">New Budget Allocation</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                <input
                  type="text"
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value)}
                  placeholder="e.g. Feature Films, Documentaries, Early Stage"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Allocated Amount (USD)</label>
                <input
                  type="number"
                  min="0"
                  value={newAmount}
                  onChange={(e) => setNewAmount(e.target.value)}
                  placeholder="e.g. 500000"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setShowNewModal(false)}
                disabled={saving}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateAllocation}
                disabled={saving}
                className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition disabled:opacity-50"
              >
                {saving ? 'Creating…' : 'Create Allocation'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default BudgetAllocation;