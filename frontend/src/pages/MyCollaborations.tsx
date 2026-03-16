import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Users, FolderOpen, CheckCircle, Clock, ArrowRight } from 'lucide-react';
import { CollaboratorService, type Collaboration } from '@/services/collaborator.service';
import { useBetterAuthStore } from '@/store/betterAuthStore';

const stageColors: Record<string, string> = {
  development: 'bg-blue-100 text-blue-800',
  'pre-production': 'bg-yellow-100 text-yellow-800',
  production: 'bg-green-100 text-green-800',
  'post-production': 'bg-purple-100 text-purple-800',
  delivery: 'bg-indigo-100 text-indigo-800',
  release: 'bg-pink-100 text-pink-800',
};

const roleLabels: Record<string, string> = {
  director: 'Director',
  line_producer: 'Line Producer',
  dp: 'Director of Photography',
  production_designer: 'Production Designer',
  editor: 'Editor',
  sound_designer: 'Sound Designer',
  custom: 'Custom',
};

export default function MyCollaborations() {
  const navigate = useNavigate();
  const { user } = useBetterAuthStore();
  const portalPrefix = `/${user?.userType || 'creator'}`;

  const [collaborations, setCollaborations] = useState<Collaboration[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadCollaborations();
  }, []);

  const loadCollaborations = async () => {
    try {
      setLoading(true);
      const response = await CollaboratorService.getMyCollaborations();
      if (response.success && response.data) {
        setCollaborations(response.data.collaborations);
      }
    } catch (err) {
      console.error('Failed to load collaborations:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">My Collaborations</h1>
        <p className="mt-2 text-sm text-gray-600">
          Projects you've been invited to collaborate on
        </p>
      </div>

      {collaborations.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-lg shadow-sm border">
          <FolderOpen className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No active collaborations</h3>
          <p className="text-gray-600 max-w-md mx-auto">
            You'll see projects here when a production company invites you to collaborate.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {collaborations.map((collab) => (
            <div
              key={collab.project_id}
              onClick={() => navigate(`${portalPrefix}/my-collaborations/${collab.project_id}`)}
              className="bg-white rounded-lg shadow-sm border hover:shadow-md transition-shadow cursor-pointer"
            >
              <div className="p-6">
                <div className="flex items-start justify-between mb-3">
                  <h3 className="text-lg font-semibold text-gray-900 line-clamp-1">
                    {collab.project_title}
                  </h3>
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${stageColors[collab.project_stage] || 'bg-gray-100 text-gray-800'}`}>
                    {collab.project_stage?.replace(/-/g, ' ').replace(/_/g, ' ')}
                  </span>
                </div>

                <div className="flex items-center gap-2 mb-4">
                  <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                    {roleLabels[collab.my_role] || collab.custom_role_name || collab.my_role}
                  </span>
                </div>

                {/* Progress bar */}
                <div className="mb-4">
                  <div className="flex items-center justify-between text-sm mb-1">
                    <span className="text-gray-600">Progress</span>
                    <span className="font-medium text-gray-900">{collab.completion_percentage}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-purple-600 h-2 rounded-full transition-all"
                      style={{ width: `${collab.completion_percentage}%` }}
                    />
                  </div>
                </div>

                {collab.next_milestone && (
                  <div className="flex items-center gap-2 text-sm text-gray-600 mb-4">
                    <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
                    <span className="line-clamp-1">Next: {collab.next_milestone}</span>
                  </div>
                )}

                <div className="flex items-center justify-between pt-4 border-t">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 bg-gray-200 rounded-full flex items-center justify-center">
                      <Users className="w-3 h-3 text-gray-600" />
                    </div>
                    <span className="text-sm text-gray-600">{collab.owner.name}</span>
                  </div>
                  <ArrowRight className="w-4 h-4 text-gray-400" />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
