import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Shield, Loader } from 'lucide-react';

/**
 * Public view of the platform Standard NDA (the lawyer-drafted "Pitchey Standard NDA").
 * Optional ?pitchId= auto-fills the project name + disclosing party from that pitch;
 * unfilled fields render as blank lines for the parties to complete.
 */
export default function StandardNDA() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const pitchId = params.get('pitchId');
  const [name, setName] = useState('Pitchey Standard NDA');
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    const qs = pitchId ? `?pitchId=${encodeURIComponent(pitchId)}` : '';
    fetch(`${import.meta.env.VITE_API_URL}/api/ndas/standard${qs}`, { credentials: 'include' })
      .then((r) => r.json())
      .then((d) => {
        if (d?.success && d.data) {
          setContent(d.data.content || '');
          if (d.data.name) setName(d.data.name);
        } else {
          setErr('Unable to load the standard NDA.');
        }
      })
      .catch(() => setErr('Unable to load the standard NDA.'))
      .finally(() => setLoading(false));
  }, [pitchId]);

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center gap-3">
          <button
            onClick={() => (window.history.length > 1 ? navigate(-1) : navigate('/'))}
            className="p-2 hover:bg-gray-100 rounded-lg transition"
            aria-label="Go back"
          >
            <ArrowLeft className="w-5 h-5 text-gray-700" />
          </button>
          <Shield className="w-5 h-5 text-purple-600" />
          <h1 className="text-lg font-semibold text-gray-900">{name}</h1>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-8">
        {loading ? (
          <div className="flex items-center justify-center py-20 text-gray-500">
            <Loader className="w-6 h-6 animate-spin mr-2" /> Loading…
          </div>
        ) : err ? (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-4">{err}</div>
        ) : (
          <article className="bg-white border border-gray-200 rounded-xl p-6 sm:p-8 shadow-sm">
            <p className="text-xs text-gray-500 mb-4">
              Blank lines (________________) are completed by the parties when the agreement is signed.
            </p>
            <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed text-gray-800">{content}</pre>
          </article>
        )}
      </main>
    </div>
  );
}
