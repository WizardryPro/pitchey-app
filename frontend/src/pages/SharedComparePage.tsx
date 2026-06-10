import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { BarChart3, Loader2 } from 'lucide-react';
import PortalTopNav from '@shared/components/layout/PortalTopNav';
import { compareService, type CompareSubject } from '../services/compare.service';
import { ComparisonMatrix } from './ComparePage';

export default function SharedComparePage() {
  const { token } = useParams();
  const [data, setData] = useState<{ title: string; type: 'creator' | 'pitch' | 'slate'; subjects: CompareSubject[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!token) { setLoading(false); setError(true); return; }
    compareService.shared(token)
      .then(setData)
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [token]);

  const typeLabel = data?.type === 'pitch' ? 'pitches' : data?.type === 'slate' ? 'slates' : 'creators';

  return (
    <div className="min-h-screen bg-gradient-to-b from-stone-50 via-white to-stone-50">
      <PortalTopNav />

      <section className="relative overflow-hidden bg-gradient-to-r from-purple-700 via-purple-600 to-indigo-600 text-white">
        <div aria-hidden className="absolute inset-0 bg-[radial-gradient(50%_60%_at_85%_0%,rgba(245,158,11,0.18),transparent_60%)]" />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="inline-flex items-center gap-2 px-3 py-1 mb-3 rounded-full bg-white/10 border border-white/20 text-[11px] font-semibold tracking-[0.18em] uppercase">
            <BarChart3 className="w-3.5 h-3.5" /> Shared comparison
          </div>
          <h1 className="font-display font-black text-4xl sm:text-5xl tracking-tight mb-2">{data?.title || 'Comparison'}</h1>
          {data && <p className="text-white/85 text-lg">A side-by-side comparison of {data.subjects.length} {typeLabel}.</p>}
        </div>
      </section>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {loading ? (
          <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 text-purple-500 animate-spin" /></div>
        ) : error || !data || data.subjects.length === 0 ? (
          <div className="text-center py-20">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-purple-50 text-purple-500 mb-4"><BarChart3 className="w-7 h-7" /></div>
            <h3 className="font-display font-bold text-xl text-gray-900 mb-1">Comparison not found</h3>
            <p className="text-gray-500 max-w-md mx-auto">This shared link may have been removed or is invalid.</p>
          </div>
        ) : (
          <ComparisonMatrix type={data.type} subjects={data.subjects} />
        )}
      </div>
    </div>
  );
}
