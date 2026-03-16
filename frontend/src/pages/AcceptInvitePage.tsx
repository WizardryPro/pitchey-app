import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { CheckCircle, AlertTriangle, Loader2, ArrowRight } from 'lucide-react';
import { CollaboratorService } from '@/services/collaborator.service';
import { useBetterAuthStore } from '@/store/betterAuthStore';

type Status = 'loading' | 'success' | 'error';

export default function AcceptInvitePage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user, isAuthenticated } = useBetterAuthStore();
  const token = searchParams.get('token') || '';

  const [status, setStatus] = useState<Status>('loading');
  const [errorMessage, setErrorMessage] = useState('');
  const [projectData, setProjectData] = useState<{ project_id: number; title: string; stage: string } | null>(null);

  useEffect(() => {
    if (!token) {
      setStatus('error');
      setErrorMessage('No invitation token provided.');
      return;
    }

    if (!isAuthenticated) {
      const redirect = `/collaborate/accept?token=${encodeURIComponent(token)}`;
      navigate(`/register?redirect=${encodeURIComponent(redirect)}`, { replace: true });
      return;
    }

    acceptInvitation();
  }, [token, isAuthenticated]);

  const acceptInvitation = async () => {
    try {
      setStatus('loading');
      const response = await CollaboratorService.acceptInvite(token);

      if (response.success && response.data) {
        setProjectData(response.data);
        setStatus('success');
      } else {
        setErrorMessage(response.error || 'Failed to accept invitation.');
        setStatus('error');
      }
    } catch (err) {
      const e = err instanceof Error ? err : new Error(String(err));
      setErrorMessage(e.message);
      setStatus('error');
    }
  };

  const portalPrefix = `/${user?.userType || 'creator'}`;

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="max-w-md w-full">
        {status === 'loading' && (
          <div className="bg-white rounded-lg shadow-lg p-8 text-center">
            <Loader2 className="w-12 h-12 text-purple-600 animate-spin mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-gray-900 mb-2">Accepting Invitation</h2>
            <p className="text-gray-600">Please wait while we set up your access...</p>
          </div>
        )}

        {status === 'success' && projectData && (
          <div className="bg-white rounded-lg shadow-lg p-8 text-center">
            <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-gray-900 mb-2">Invitation Accepted!</h2>
            <p className="text-gray-600 mb-6">
              You now have access to this project.
            </p>
            <div className="bg-gray-50 rounded-lg p-4 mb-6 text-left">
              <h3 className="font-medium text-gray-900">{projectData.title}</h3>
              <p className="text-sm text-gray-600 mt-1 capitalize">
                Stage: {projectData.stage?.replace(/-/g, ' ').replace(/_/g, ' ')}
              </p>
            </div>
            <button
              onClick={() => navigate(`${portalPrefix}/my-collaborations/${projectData.project_id}`)}
              className="w-full inline-flex items-center justify-center px-4 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition font-medium"
            >
              Go to Project
              <ArrowRight className="w-4 h-4 ml-2" />
            </button>
          </div>
        )}

        {status === 'error' && (
          <div className="bg-white rounded-lg shadow-lg p-8 text-center">
            <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-gray-900 mb-2">Invitation Error</h2>
            <p className="text-gray-600 mb-6">{errorMessage}</p>
            <button
              onClick={() => navigate(`${portalPrefix}/dashboard`)}
              className="w-full px-4 py-3 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition font-medium"
            >
              Go to Dashboard
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
