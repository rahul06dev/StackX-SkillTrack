import {
  useState,
  useCallback,
  useRef,
  useEffect,
} from 'react';
import CommentsTabContent from './CommentsTabContent';
import { API_BASE_URL } from '../config/api';

// --- Interfaces ---
interface Task {
  id: string;
  title: string;
  description: string;
  priority: 'high' | 'medium' | 'low';
  assignee?: string;
  dueDate?: Date | null;
  columnId: string;
  commentsCount?: number;
}

interface Attachment {
  id: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  uploadedBy: string;
  createdAt: string;
}

interface Comment {
  id: string;
  userName: string;
  userInitials: string;
  timestamp: string;
  content: string;
}

interface TaskDetailModalProps {
  task: Task;
  columnTitle: string;
  completedColumnId?: string;
  inProgressColumnId?: string;
  isOpen: boolean;
  onClose: () => void;
  onTaskDelete: (taskId: string) => void;
  onTaskSave: (updatedTask: Task) => void;
  teamMembers?: Array<{ id: string; name: string; email: string; role?: string }>;
}
// --- END INTERFACES ---

// Get the currently logged-in user from localStorage
const getCurrentUser = () => {
  try {
    const user = localStorage.getItem('user');

    if (!user) return null;

    return JSON.parse(user);
  } catch {
    return null;
  }
};

const getCurrentUserRole = () => {
  const user = getCurrentUser();

  return user?.role || null;
};

export const formatFileSize = (bytes: number) => {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return (
    parseFloat((bytes / Math.pow(k, i)).toFixed(2)) +
    ' ' +
    sizes[i]
  );
};

export const getFileIcon = (fileType: string) => {
  if (fileType.includes('image')) return 'fa-image';
  if (fileType.includes('pdf')) return 'fa-file-pdf';
  if (
    fileType.includes('spreadsheet') ||
    fileType.includes('excel')
  ) {
    return 'fa-file-excel';
  }
  if (
    fileType.includes('word') ||
    fileType.includes('text')
  ) {
    return 'fa-file-word';
  }
  if (
    fileType.includes('zip') ||
    fileType.includes('rar')
  ) {
    return 'fa-file-archive';
  }

  return 'fa-file';
};

const TaskDetailModal: React.FC<TaskDetailModalProps> = ({
  task,
  columnTitle,
  completedColumnId,
  inProgressColumnId,
  isOpen,
  onClose,
  onTaskDelete,
  onTaskSave,
  teamMembers = [],
}) => {
  const currentUser = getCurrentUser();
  const currentUserRole = getCurrentUserRole();

  const canReviewTask =
    currentUserRole === 'FACULTY' ||
    currentUserRole === 'ADMIN';

  const fileInputRef = useRef<HTMLInputElement>(null);

  // --- LOCAL EDITABLE STATE ---
  const [localTitle, setLocalTitle] = useState(task.title);
  const [localDescription, setLocalDescription] = useState(
    task.description
  );
  const [localPriority, setLocalPriority] = useState<
    'high' | 'medium' | 'low'
  >(task.priority);

  const [localAssignee, setLocalAssignee] = useState(
    task.assignee && task.assignee !== 'Unassigned'
      ? task.assignee
      : teamMembers?.[0]?.name || ''
  );

  const [localDueDate, setLocalDueDate] = useState<Date | null>(
    task.dueDate ? new Date(task.dueDate) : null
  );

  // --- TAB / ATTACHMENT / COMMENT STATES ---
  const [activeTab, setActiveTab] = useState<
    'details' | 'attachments' | 'comments'
  >('details');

  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [loadingAttachments, setLoadingAttachments] = useState(false);
  const [uploadingAttachment, setUploadingAttachment] = useState(false);
  const [attachmentError, setAttachmentError] = useState<string | null>(null);

  const [comments, setComments] = useState<Comment[]>([]);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);



  // --- EFFECT TO INITIALIZE STATE WHEN TASK / MODAL CHANGES ---
  useEffect(() => {
    if (!isOpen) return;

    setLocalTitle(task.title);
    setLocalDescription(task.description);
    setLocalPriority(task.priority);
    const initialAssignee =
      task.assignee && task.assignee !== 'Unassigned'
        ? task.assignee
        : teamMembers?.[0]?.name || '';
    setLocalAssignee(initialAssignee);

    const dueDate = task.dueDate;

    if (dueDate) {
      setLocalDueDate(new Date(dueDate));
    } else {
      setLocalDueDate(null);
    }

    const fetchTaskData = async () => {
      const token = localStorage.getItem('token');

      if (!token) {
        console.error(
          'Authentication token not found.'
        );
        return;
      }

      // Fetch Comments
      try {
        const commentsResponse = await fetch(
          `${API_BASE_URL}/api/comments/task/${task.id}`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        if (commentsResponse.ok) {
          const fetchedComments =
            await commentsResponse.json();

          setComments(fetchedComments);
        } else {
          console.error(
            'Failed to fetch comments:',
            commentsResponse.status
          );
        }
      } catch (e) {
        console.error(
          'Network error fetching comments:',
          e
        );
      }

      // Fetch Attachments
      try {
        setLoadingAttachments(true);
        const attResponse = await fetch(
          `${API_BASE_URL}/api/attachments/task/${task.id}`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        if (attResponse.ok) {
          const fetchedAtt = await attResponse.json();
          setAttachments(fetchedAtt);
        }
      } catch (err) {
        console.error('Error fetching attachments:', err);
      } finally {
        setLoadingAttachments(false);
      }
    };

    fetchTaskData();
  }, [task, isOpen]);

  // --- DELETE TASK ---
  const handleDeleteTask = useCallback(() => {
    setShowDeleteConfirm(true);
  }, []);

  const handleConfirmDelete = useCallback(() => {
    setShowDeleteConfirm(false);
    onTaskDelete(task.id);
    onClose();
  }, [task.id, onClose, onTaskDelete]);

  // --- ADD COMMENT ---
  const handleCommentAdded = useCallback(
    async (content: string) => {
      const token = localStorage.getItem('token');

      if (!token) {
        alert(
          'Authentication token not found. Please log in again.'
        );
        return;
      }

      const commentPayload = {
        content: content,
        userName:
          currentUser?.name || 'Unknown User',
      };

      try {
        const response = await fetch(
          `${API_BASE_URL}/api/comments/task/${task.id}`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify(commentPayload),
          }
        );

        if (!response.ok) {
          const errorData =
            await response.json().catch(() => null);

          console.error(
            'Comment API error:',
            errorData
          );

          throw new Error(
            'Failed to post comment.'
          );
        }

        const newComment: Comment =
          await response.json();

        setComments((prev) => [
          newComment,
          ...prev,
        ]);
      } catch (err) {
        console.error(
          'Error posting comment:',
          err
        );

        alert('Failed to post comment.');
      }
    },
    [task.id, currentUser]
  );

  // --- SAVE TASK CHANGES ---
  const handleSaveChanges = useCallback(() => {
    const finalAssignee =
      localAssignee && localAssignee !== 'Unassigned' && localAssignee !== 'Select assignee'
        ? localAssignee
        : teamMembers?.[0]?.name || task.assignee || '';

    const updatedTask: Task = {
      ...task,
      title: localTitle,
      description: localDescription,
      priority: localPriority,
      assignee: finalAssignee,
      dueDate: localDueDate,
    };

    onTaskSave(updatedTask);
    onClose();
  }, [
    task,
    localTitle,
    localDescription,
    localPriority,
    localAssignee,
    localDueDate,
    teamMembers,
    onClose,
    onTaskSave,
  ]);

  // --- APPROVE TASK ---
  const handleApproveTask = useCallback(() => {
    if (!completedColumnId) return;

    const updatedTask: Task = {
      ...task,
      columnId: completedColumnId,
    };

    onTaskSave(updatedTask);
    onClose();
  }, [
    task,
    completedColumnId,
    onClose,
    onTaskSave,
  ]);

  // --- SEND TASK BACK ---
  const handleSendBackTask = useCallback(() => {
    if (!inProgressColumnId) return;

    const updatedTask: Task = {
      ...task,
      columnId: inProgressColumnId,
    };

    onTaskSave(updatedTask);
    onClose();
  }, [
    task,
    inProgressColumnId,
    onClose,
    onTaskSave,
  ]);

  // --- ATTACHMENTS ---
  const triggerFileInput = useCallback(
    () => fileInputRef.current?.click(),
    []
  );

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const token = localStorage.getItem('token');
    if (!token) return;

    setUploadingAttachment(true);
    setAttachmentError(null);

    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const formData = new FormData();
        formData.append('file', file);

        const res = await fetch(`${API_BASE_URL}/api/attachments/task/${task.id}`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
          body: formData,
        });

        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.message || `Failed to upload ${file.name}`);
        }

        const uploaded: Attachment = await res.json();
        setAttachments((prev) => [uploaded, ...prev]);
      }
    } catch (err) {
      console.error('Upload error:', err);
      setAttachmentError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploadingAttachment(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDownloadAttachment = async (att: Attachment) => {
    const token = localStorage.getItem('token');
    if (!token) return;

    try {
      const res = await fetch(`${API_BASE_URL}/api/attachments/${att.id}/download`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Download failed');
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = att.fileName;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      console.error('Error downloading:', err);
      alert('Failed to download attachment.');
    }
  };

  const handleDeleteAttachment = async (attId: string, fileName: string) => {
    if (!window.confirm(`Are you sure you want to delete "${fileName}"?`)) return;
    const token = localStorage.getItem('token');
    if (!token) return;

    try {
      const res = await fetch(`${API_BASE_URL}/api/attachments/${attId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || 'Failed to delete attachment');
      }
      setAttachments((prev) => prev.filter((a) => a.id !== attId));
    } catch (err) {
      console.error('Delete error:', err);
      alert(err instanceof Error ? err.message : 'Could not delete attachment.');
    }
  };

  const AttachmentsTabContent = () => (
    <div className="attachments-tab-content space-y-4 p-2">
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileUpload}
        multiple
        className="hidden"
      />

      <div
        className="attachment-dropzone p-8 text-center cursor-pointer border-2 border-dashed border-purple-200 rounded-xl hover:border-purple-400 bg-purple-50/50 transition"
        onClick={triggerFileInput}
      >
        <i className="fa fa-cloud-upload-alt text-4xl text-purple-500 mb-2"></i>
        <p className="text-gray-700 font-medium">
          {uploadingAttachment ? 'Uploading files...' : 'Click or drop files to upload'}
        </p>
        <p className="text-xs text-gray-500 mt-1">
          Supported: PDF, Images, Word, Excel, ZIP, Code (up to 15MB)
        </p>
      </div>

      {attachmentError && (
        <div className="p-3 bg-red-50 text-red-700 text-sm rounded-lg flex items-center gap-2">
          <i className="fa fa-exclamation-triangle"></i>
          <span>{attachmentError}</span>
        </div>
      )}

      {loadingAttachments ? (
        <div className="text-center py-6 text-gray-400 text-sm">
          <i className="fa fa-spinner fa-spin mr-2"></i> Loading attachments...
        </div>
      ) : attachments.length === 0 ? (
        <div className="text-center py-6 text-gray-400 text-sm">
          No attachments uploaded for this task yet.
        </div>
      ) : (
        <div className="attachments-list space-y-2 mt-4">
          {attachments.map((att) => (
            <div
              key={att.id}
              className="flex items-center justify-between p-3 bg-gray-50 hover:bg-gray-100 rounded-xl border border-gray-200 transition"
            >
              <div className="flex items-center gap-3 overflow-hidden">
                <i className={`fa ${getFileIcon(att.mimeType || att.fileName)} text-xl text-purple-600`}></i>
                <div className="truncate">
                  <p className="font-semibold text-sm text-gray-800 truncate" title={att.fileName}>
                    {att.fileName}
                  </p>
                  <p className="text-xs text-gray-500">
                    {formatFileSize(att.fileSize)} • Uploaded by {att.uploadedBy} on {new Date(att.createdAt).toLocaleDateString()}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleDownloadAttachment(att)}
                  className="p-2 text-gray-600 hover:text-purple-600 hover:bg-purple-50 rounded-lg transition"
                  title="Download file"
                >
                  <i className="fa fa-download"></i>
                </button>
                <button
                  type="button"
                  onClick={() => handleDeleteAttachment(att.id, att.fileName)}
                  className="p-2 text-gray-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
                  title="Delete file"
                >
                  <i className="fa fa-trash-alt"></i>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  if (!isOpen) return null;

  return (
    <div className="modal-overlay">
      <div className="modal-content">

        {/* Header */}
        <div className="modal-header flex justify-between items-center p-4 border-b border-gray-200">
          <input
            className="text-xl font-bold task-title-editable w-full border-0 focus:ring-0 p-0 m-0"
            value={localTitle}
            onChange={(e) =>
              setLocalTitle(e.target.value)
            }
          />

          <button
            className="text-gray-400 hover:text-gray-700 text-2xl"
            onClick={onClose}
          >
            <i className="fa fa-times"></i>
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex px-4 pt-4 modal-tabs">

          <button
            className={`tab-button px-4 py-2 text-sm font-semibold ${activeTab === 'details'
                ? 'tab-active'
                : 'tab-inactive'
              }`}
            onClick={() =>
              setActiveTab('details')
            }
          >
            Details
          </button>

          <button
            className={`tab-button px-4 py-2 text-sm font-semibold ${activeTab === 'attachments'
                ? 'tab-active'
                : 'tab-inactive'
              }`}
            onClick={() =>
              setActiveTab('attachments')
            }
          >
            Attachments ({attachments.length})
          </button>

          <button
            className={`tab-button px-4 py-2 text-sm font-semibold ${activeTab === 'comments'
                ? 'tab-active'
                : 'tab-inactive'
              }`}
            onClick={() =>
              setActiveTab('comments')
            }
          >
            Comments ({comments.length})
          </button>

        </div>

        {/* Body Content */}
        <div className="modal-body p-4 sm:p-6">

          {activeTab === 'details' && (
            <div className="details-tab-content space-y-6">

              {/* Description */}
              <div className="input-group">
                <label className="input-label text-sm font-semibold mb-2 block">
                  Description
                </label>

                <textarea
                  className="description-textarea w-full p-3 rounded-lg border resize-none"
                  rows={4}
                  placeholder="Add a description..."
                  value={localDescription}
                  onChange={(e) =>
                    setLocalDescription(
                      e.target.value
                    )
                  }
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">

                {/* Assignee */}
                <div className="input-group">
                  <label className="input-label text-sm font-semibold mb-2 block">
                    Assignee
                  </label>

                  <select
                    className="select-field w-full px-3 py-2 rounded-lg border text-gray-700"
                    value={localAssignee}
                    onChange={(e) => setLocalAssignee(e.target.value)}
                  >
                    {teamMembers && teamMembers.length > 0 ? (
                      teamMembers.map((member) => (
                        <option key={member.id} value={member.name}>
                          {member.name} {member.role ? `(${member.role})` : ''}
                        </option>
                      ))
                    ) : (
                      task.assignee && (
                        <option value={task.assignee}>{task.assignee}</option>
                      )
                    )}
                  </select>
                </div>

                {/* Priority */}
                <div className="input-group">
                  <label className="input-label text-sm font-semibold mb-2 block">
                    Priority
                  </label>

                  <select
                    className="select-field w-full px-3 py-2 rounded-lg border"
                    value={localPriority}
                    onChange={(e) =>
                      setLocalPriority(
                        e.target.value as
                        | 'high'
                        | 'medium'
                        | 'low'
                      )
                    }
                  >
                    <option value="low">
                      Low
                    </option>

                    <option value="medium">
                      Medium
                    </option>

                    <option value="high">
                      High
                    </option>
                  </select>
                </div>

              </div>

              {/* Due Date */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                <div className="input-group">
                  <div className="flex justify-between items-center mb-2">
                    <label className="input-label text-sm font-semibold block">
                      Due Date
                    </label>
                    {localDueDate && (
                      <button
                        type="button"
                        onClick={() => setLocalDueDate(null)}
                        className="text-xs text-red-500 hover:text-red-700 font-medium cursor-pointer"
                        title="Clear deadline"
                      >
                        Clear date
                      </button>
                    )}
                  </div>

                  <input
                    type="date"
                    className="select-field w-full px-3 py-2 rounded-lg border text-gray-700 font-medium"
                    value={
                      localDueDate
                        ? `${localDueDate.getFullYear()}-${String(localDueDate.getMonth() + 1).padStart(2, '0')}-${String(localDueDate.getDate()).padStart(2, '0')}`
                        : ''
                    }
                    onChange={(e) => {
                      if (!e.target.value) {
                        setLocalDueDate(null);
                      } else {
                        const [y, m, d] = e.target.value.split('-').map(Number);
                        setLocalDueDate(new Date(y, m - 1, d, 12, 0, 0));
                      }
                    }}
                  />
                </div>
              </div>
            </div>
          )}

          {activeTab === 'attachments' && (
            <AttachmentsTabContent />
          )}

          {activeTab === 'comments' && (
            <CommentsTabContent
              initialComments={comments}
              onCommentAdded={
                handleCommentAdded
              }
              currentUser={{
                name:
                  currentUser?.name ||
                  'Unknown User',
                initials:
                  currentUser?.name
                    ? currentUser.name
                      .charAt(0)
                      .toUpperCase()
                    : '?',
              }}
            />
          )}

        </div>

        {/* Footer */}
        <div className="modal-footer flex justify-between items-center p-4 border-t border-gray-200">

          {/* Delete */}
          <button
            className="delete-task-button flex items-center gap-2 px-4 py-2 rounded-lg font-semibold transition"
            onClick={handleDeleteTask}
          >
            <i className="fa fa-trash-alt"></i>
            Delete Task
          </button>

          {/* Right Side Actions */}
          <div className="flex items-center gap-3">

            {/* Faculty Review Actions */}
            {columnTitle === 'In Review' &&
              canReviewTask && (
                <>
                  <button
                    type="button"
                    className="review-send-back-button flex items-center gap-2 px-4 py-2 rounded-lg font-semibold transition"
                    onClick={
                      handleSendBackTask
                    }
                  >
                    <i className="fa fa-undo"></i>
                    Send Back
                  </button>

                  <button
                    type="button"
                    className="review-approve-button flex items-center gap-2 px-5 py-2 rounded-lg font-semibold text-white transition"
                    onClick={
                      handleApproveTask
                    }
                  >
                    <i className="fa fa-check"></i>
                    Approve & Complete
                  </button>
                </>
              )}

            {/* Normal Save */}
            <button
              type="button"
              className="save-changes-button flex items-center gap-2 px-6 py-2.5 rounded-lg font-semibold text-white transition"
              onClick={handleSaveChanges}
            >
              <i className="fa fa-save text-sm opacity-90"></i>
              <span>Save Changes</span>
            </button>
          </div>

        </div>

        {/* In-Website Delete Task Confirmation Dialog */}
        {showDeleteConfirm && (
          <div
            className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
            onClick={(e) => {
              e.stopPropagation();
              setShowDeleteConfirm(false);
            }}
          >
            <div
              className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl border border-gray-100 animate-in fade-in zoom-in-95 duration-150"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="w-12 h-12 rounded-full bg-red-100 text-red-600 flex items-center justify-center mx-auto mb-4 text-xl">
                <i className="fa fa-trash-alt"></i>
              </div>
              <h3 className="text-center font-bold text-gray-900 text-lg mb-2">Delete Task?</h3>
              <p className="text-center text-sm text-gray-600 mb-6 leading-relaxed">
                Are you sure you want to permanently delete <strong>&ldquo;{localTitle}&rdquo;</strong>? This action cannot be undone.
              </p>
              <div className="flex gap-3 justify-end">
                <button
                  type="button"
                  className="flex-1 px-4 py-2 text-sm font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition"
                  onClick={() => setShowDeleteConfirm(false)}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="flex-1 px-4 py-2 text-sm font-semibold text-white bg-red-600 hover:bg-red-700 rounded-lg transition shadow-sm"
                  onClick={handleConfirmDelete}
                >
                  Yes, Delete
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default TaskDetailModal;