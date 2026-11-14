import React, { useEffect, useState } from 'react';
import { API_BASE_URL } from '../config/api';

interface Activity {
  id: string;
  projectId: string;
  taskId: string | null;
  userId: string | null;
  userName: string;
  action: string;
  details: string | null;
  createdAt: string;
}

interface ActivityHistoryModalProps {
  projectId: string;
  isOpen: boolean;
  onClose: () => void;
}

const getActionBadge = (action: string) => {
  switch (action) {
    case 'TASK_CREATED':
      return { label: 'Task Created', bg: 'bg-emerald-100 text-emerald-800', icon: 'fa-plus-circle' };
    case 'TASK_MOVED':
      return { label: 'Task Moved', bg: 'bg-blue-100 text-blue-800', icon: 'fa-exchange-alt' };
    case 'ATTACHMENT_UPLOADED':
      return { label: 'Attachment Added', bg: 'bg-purple-100 text-purple-800', icon: 'fa-paperclip' };
    case 'ATTACHMENT_DELETED':
      return { label: 'Attachment Removed', bg: 'bg-red-100 text-red-800', icon: 'fa-trash' };
    case 'COMMENT_ADDED':
      return { label: 'Comment', bg: 'bg-amber-100 text-amber-800', icon: 'fa-comment' };
    case 'PROJECT_CREATED':
      return { label: 'Project Created', bg: 'bg-indigo-100 text-indigo-800', icon: 'fa-folder-plus' };
    default:
      return { label: action, bg: 'bg-gray-100 text-gray-800', icon: 'fa-info-circle' };
  }
};

const ActivityHistoryModal: React.FC<ActivityHistoryModalProps> = ({
  projectId,
  isOpen,
  onClose,
}) => {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen || !projectId) return;

    const fetchActivities = async () => {
      setLoading(true);
      setError(null);
      try {
        const token = localStorage.getItem('token');
        if (!token) throw new Error('Authentication required');

        const res = await fetch(`${API_BASE_URL}/api/activities/project/${projectId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (!res.ok) {
          throw new Error('Failed to fetch activity log.');
        }

        const data: Activity[] = await res.json();
        setActivities(data);
      } catch (err) {
        console.error('Error fetching activities:', err);
        setError(err instanceof Error ? err.message : 'Could not load activities.');
      } finally {
        setLoading(false);
      }
    };

    fetchActivities();
  }, [isOpen, projectId]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="p-5 border-b border-gray-200 flex items-center justify-between bg-gray-50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-100 flex items-center justify-center text-purple-600">
              <i className="fa fa-history text-lg"></i>
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900">Project Activity History</h2>
              <p className="text-xs text-gray-500">Chronological audit log of project and task events</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-200/50 flex items-center justify-center transition"
          >
            <i className="fa fa-times text-lg"></i>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {loading ? (
            <div className="py-12 text-center text-gray-500 text-sm">
              <i className="fa fa-spinner fa-spin text-2xl text-purple-600 mb-2 block"></i>
              Loading activity history...
            </div>
          ) : error ? (
            <div className="py-8 text-center text-red-500 text-sm">{error}</div>
          ) : activities.length === 0 ? (
            <div className="py-12 text-center text-gray-400 text-sm">
              <i className="fa fa-clock text-4xl mb-3 text-gray-300 block"></i>
              No activities logged for this project yet.
            </div>
          ) : (
            activities.map((act) => {
              const badge = getActionBadge(act.action);
              const formattedTime = new Date(act.createdAt).toLocaleString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              });

              return (
                <div
                  key={act.id}
                  className="flex items-start gap-4 p-3.5 bg-gray-50 hover:bg-gray-100/80 rounded-xl border border-gray-200/80 transition"
                >
                  <div className="w-9 h-9 rounded-full bg-purple-600 text-white font-semibold flex items-center justify-center text-sm flex-shrink-0">
                    {act.userName.charAt(0).toUpperCase()}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="font-semibold text-sm text-gray-900">{act.userName}</span>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-semibold flex items-center gap-1 ${badge.bg}`}>
                        <i className={`fa ${badge.icon} text-[10px]`}></i>
                        {badge.label}
                      </span>
                      <span className="text-xs text-gray-400 ml-auto">{formattedTime}</span>
                    </div>

                    {act.details && (
                      <p className="text-xs text-gray-600 break-words">{act.details}</p>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-200 bg-gray-50 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-xl text-sm font-semibold transition"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default ActivityHistoryModal;

