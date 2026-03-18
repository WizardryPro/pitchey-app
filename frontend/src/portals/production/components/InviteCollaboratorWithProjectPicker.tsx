import { useState, useEffect } from 'react';
import { X, FolderOpen, Loader2 } from 'lucide-react';
import { ProductionService } from '../services/production.service';
import InviteCollaboratorModal from './InviteCollaboratorModal';

interface Props {
  onClose: () => void;
  onInvited?: () => void;
}

interface Project {
  id: number;
  title: string;
}

export default function InviteCollaboratorWithProjectPicker({ onClose, onInvited }: Props) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedProjectId, setSelectedProjectId] = useState<number | null>(null);

  useEffect(() => {
    ProductionService.getProjects()
      .then((data) => {
        const list = Array.isArray(data) ? data : [];
        setProjects(list.map((p: Record<string, unknown>) => ({ id: Number(p.id), title: String(p.title || 'Untitled') })));
        if (list.length === 1) {
          setSelectedProjectId(Number(list[0].id));
        }
      })
      .catch(() => setProjects([]))
      .finally(() => setLoading(false));
  }, []);

  if (selectedProjectId) {
    return (
      <InviteCollaboratorModal
        projectId={selectedProjectId}
        onClose={onClose}
        onInvited={onInvited}
      />
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-lg max-w-md w-full shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-lg font-semibold text-gray-900">Select Project</h2>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded transition">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <div className="p-6">
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-indigo-500" />
            </div>
          ) : projects.length === 0 ? (
            <div className="text-center py-8">
              <FolderOpen className="w-10 h-10 text-gray-400 mx-auto mb-3" />
              <p className="text-gray-600 font-medium">No projects yet</p>
              <p className="text-sm text-gray-500 mt-1">Create a project first to invite collaborators</p>
            </div>
          ) : (
            <>
              <p className="text-sm text-gray-600 mb-4">Choose which project to invite a collaborator to:</p>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {projects.map((project) => (
                  <button
                    key={project.id}
                    onClick={() => setSelectedProjectId(project.id)}
                    className="w-full text-left px-4 py-3 border border-gray-200 rounded-lg hover:border-indigo-300 hover:bg-indigo-50 transition"
                  >
                    <span className="font-medium text-gray-900">{project.title}</span>
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
