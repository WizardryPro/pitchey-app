import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Building2, FileText, ArrowRight, Shield, Lock } from 'lucide-react';
import apiClient from '../../../lib/api-client';
import { useBetterAuthStore } from '../../../store/betterAuthStore';
import { CollaborationNdaModal } from './CollaborationNdaModal';

interface CollabPitch {
  id: number;
  title: string;
  poster: string | null;
  genre: string | null;
  format: string | null;
  status: string | null;
}
interface Company {
  teamId: number;
  name: string;
  company: string;
  ownerId: number;
  ndaSigned: boolean;
  documentUrl: string | null;
  pitches: CollabPitch[];
}

/**
 * Creator-side entry point for B3: the production companies you've joined (via a
 * code) and their projects. Clicking a project opens its shared workspace
 * (Team/Notes/Feasibility) — without this, the join code led nowhere for creators.
 * Renders nothing until you've joined at least one company.
 */
export function CreatorCollaborations() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [signingCompany, setSigningCompany] = useState<Company | null>(null);
  const navigate = useNavigate();
  const { user: authUser } = useBetterAuthStore();

  const load = async () => {
    try {
      const res: any = await apiClient.get('/api/creator/companies');
      const data = res?.data ?? res;
      setCompanies(Array.isArray(data?.companies) ? data.companies : []);
    } catch {
      /* degrade quietly */
    } finally {
      setLoaded(true);
    }
  };

  useEffect(() => {
    let live = true;
    (async () => { await load(); if (!live) setLoaded(false); })();
    return () => { live = false; };
  }, []);

  if (!loaded || companies.length === 0) return null;

  return (
    <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-gray-100">
      <div className="mb-1 flex items-center gap-2.5">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-purple-50 text-purple-600 ring-1 ring-inset ring-purple-100">
          <Building2 className="h-5 w-5" />
        </span>
        <h3 className="text-lg font-semibold text-gray-900">Collaborating With</h3>
      </div>
      <p className="mb-5 pl-[3.05rem] text-sm text-gray-500">
        Production companies you've joined — open a project to co-build its Team, Notes &amp; Feasibility.
      </p>

      <div className="space-y-5">
        {companies.map((c) => (
          <div key={c.teamId}>
            <div className="mb-2 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <p className="text-sm font-semibold text-gray-800">{c.company}</p>
                {!c.ndaSigned && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-700 ring-1 ring-inset ring-amber-200">
                    <Lock className="h-3 w-3" /> NDA required
                  </span>
                )}
              </div>
              <div className="flex items-center gap-3">
                {c.ndaSigned && c.documentUrl && (
                  <a
                    href={`${import.meta.env.VITE_API_URL || ''}${c.documentUrl}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs font-medium text-purple-600 hover:text-purple-800"
                    title="View your signed NDA"
                  >
                    <FileText className="h-3.5 w-3.5" /> Signed NDA
                  </a>
                )}
                <span className="text-xs text-gray-400">{c.pitches.length} project{c.pitches.length === 1 ? '' : 's'}</span>
              </div>
            </div>

            {!c.ndaSigned ? (
              <div className="flex flex-col items-start gap-2 rounded-xl border border-amber-200 bg-amber-50/60 px-3.5 py-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-xs leading-relaxed text-amber-800">
                  Sign {c.company}'s NDA to open their projects and join the shared workspace.
                </p>
                <button
                  onClick={() => setSigningCompany(c)}
                  className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-purple-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-purple-700"
                >
                  <Shield className="h-3.5 w-3.5" /> Sign NDA to collaborate
                </button>
              </div>
            ) : c.pitches.length === 0 ? (
              <p className="rounded-lg border border-dashed border-gray-200 bg-gray-50/60 px-3 py-3 text-xs text-gray-400">
                No projects yet — they'll appear here when {c.company} adds pitches.
              </p>
            ) : (
              <div className="grid gap-2 sm:grid-cols-2">
                {c.pitches.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => navigate(`/production/pitch/${p.id}`)}
                    className="group flex items-center gap-3 rounded-xl border border-gray-100 bg-white p-2.5 text-left transition hover:border-purple-200 hover:shadow-sm"
                  >
                    {p.poster ? (
                      <img src={p.poster} alt="" className="h-10 w-10 shrink-0 rounded-lg object-cover" />
                    ) : (
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-purple-50 text-purple-400">
                        <FileText className="h-5 w-5" />
                      </span>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-gray-900">{p.title || 'Untitled'}</p>
                      <p className="truncate text-xs text-gray-400">{[p.format, p.genre].filter(Boolean).join(' · ') || '—'}</p>
                    </div>
                    <ArrowRight className="h-4 w-4 shrink-0 text-gray-300 transition group-hover:text-purple-500" />
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      {signingCompany && (
        <CollaborationNdaModal
          teamId={signingCompany.teamId}
          company={signingCompany.company}
          defaultName={(authUser as any)?.name || (authUser as any)?.username || ''}
          onClose={() => setSigningCompany(null)}
          onSigned={load}
        />
      )}
    </div>
  );
}
