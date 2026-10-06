import React, {
  useState,
  useMemo,
  useCallback,
  useRef,
  useEffect,
} from 'react';
import CommentsTabContent from './CommentsTabContent';

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
  id: number;
  fileName: string;
  fileSize: number;
  uploadedBy: string;
  uploadDate: string;
  fileType: string;
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

const formatFileSize = (bytes: number) => {
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

const getFileIcon = (fileType: string) => {
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
    task.assignee || 'Select assignee'
  );

  // --- TAB / ATTACHMENT / COMMENT STATES ---
  const [activeTab, setActiveTab] = useState<
    'details' | 'attachments' | 'comments'
  >('details');

  const [attachments, setAttachments] = useState<Attachment[]>(
    []
  );

  const [comments, setComments] = useState<Comment[]>([]);

  // --- CALENDAR STATE ---
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [selectedDay, setSelectedDay] = useState(0);
  const [currentDate, setCurrentDate] = useState(new Date());

  const API_BASE_URL = 'http://localhost:4300';

  // --- EFFECT TO INITIALIZE STATE WHEN TASK / MODAL CHANGES ---
  useEffect(() => {
    if (!isOpen) return;

    setLocalTitle(task.title);
    setLocalDescription(task.description);
    setLocalPriority(task.priority);
    setLocalAssignee(
      task.assignee || 'Select assignee'
    );

    const dueDate = task.dueDate;

    if (dueDate) {
      const dateObj = new Date(dueDate);

      setSelectedDay(dateObj.getDate());

      setCurrentDate(
        new Date(
          dateObj.getFullYear(),
          dateObj.getMonth(),
          1
        )
      );
    } else {
      setSelectedDay(0);
      setCurrentDate(new Date());
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

      // Future: Fetch Attachments
    };

    fetchTaskData();
  }, [task, isOpen]);

  // --- DELETE TASK ---
  const handleDeleteTask = useCallback(() => {
    const isConfirmed = window.confirm(
      `Are you sure you want to permanently delete the task: "${localTitle}"?`
    );

    if (isConfirmed) {
      onTaskDelete(task.id);
      onClose();
    }
  }, [
    localTitle,
    task.id,
    onClose,
    onTaskDelete,
  ]);

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
    const updatedTask: Task = {
      ...task,
      title: localTitle,
      description: localDescription,
      priority: localPriority,
      assignee:
        localAssignee === 'Select assignee'
          ? undefined
          : localAssignee,
      dueDate:
        selectedDay === 0
          ? null
          : new Date(
            currentDate.getFullYear(),
            currentDate.getMonth(),
            selectedDay
          ),
    };

    onTaskSave(updatedTask);
    onClose();
  }, [
    task,
    localTitle,
    localDescription,
    localPriority,
    localAssignee,
    selectedDay,
    currentDate,
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

  // --- CALENDAR HELPERS ---
  const calendarHeaders = [
    'Su',
    'Mo',
    'Tu',
    'We',
    'Th',
    'Fr',
    'Sa',
  ];

  const handleDateSelect = (day: number) => {
    setSelectedDay(day);
    setIsCalendarOpen(false);
  };

  const changeMonth = (delta: number) => {
    setCurrentDate((prevDate) =>
      new Date(
        prevDate.getFullYear(),
        prevDate.getMonth() + delta,
        1
      )
    );
  };

  const getFormattedDate = (day: number) => {
    if (day === 0) return 'Select date';

    const suffix =
      day === 1 ||
        day === 21 ||
        day === 31
        ? 'st'
        : day === 2 ||
          day === 22
          ? 'nd'
          : day === 3 ||
            day === 23
            ? 'rd'
            : 'th';

    return `${currentDate.toLocaleString(
      'default',
      { month: 'long' }
    )} ${day}${suffix}, ${currentDate.getFullYear()}`;
  };

  const calendarDays = useMemo(() => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();

    const firstDayOfMonth = new Date(
      year,
      month,
      1
    ).getDay();

    const daysInMonth = new Date(
      year,
      month + 1,
      0
    ).getDate();

    const days = [];

    let day = 1;

    for (let i = 0; i < 42; i++) {
      if (i < firstDayOfMonth) {
        days.push({
          day:
            new Date(
              year,
              month,
              0
            ).getDate() -
            firstDayOfMonth +
            i +
            1,
          isPrev: true,
        });
      } else if (day <= daysInMonth) {
        days.push({
          day: day++,
          isPrev: false,
          isToday:
            day - 1 === new Date().getDate() &&
            month === new Date().getMonth(),
        });
      } else {
        days.push({
          day: day++ - daysInMonth,
          isPrev: true,
        });
      }
    }

    return days;
  }, [currentDate]);

  // --- ATTACHMENTS ---
  const triggerFileInput = useCallback(
    () => fileInputRef.current?.click(),
    []
  );

  const AttachmentsTabContent = () => (
    <div className="attachments-tab-content space-y-4">
      <input
        type="file"
        ref={fileInputRef}
        onChange={() => {
          /* handleFileSelect(e) */
        }}
        multiple
        className="hidden"
      />

      <div
        className="attachment-dropzone p-10 text-center cursor-pointer"
        onClick={triggerFileInput}
      >
        <i className="fa fa-cloud-upload-alt fa-3x text-purple-400 mb-3 upload-icon"></i>

        <p className="text-gray-600 font-medium">
          Click to upload files
        </p>
      </div>

      {/* Attachment list rendering */}
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
        <div className="modal-body p-6">

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

              <div className="grid grid-cols-2 gap-6">

                {/* Assignee */}
                <div className="input-group">
                  <label className="input-label text-sm font-semibold mb-2 block">
                    Assignee
                  </label>

                  <select
                    className="select-field w-full px-3 py-2 rounded-lg border"
                    value={localAssignee}
                    onChange={(e) =>
                      setLocalAssignee(
                        e.target.value
                      )
                    }
                  >
                    <option
                      value="Select assignee"
                      disabled
                    >
                      Select assignee
                    </option>

                    {/* Temporary existing options.
                        These will be replaced with
                        project-based users in Step 3. */}
                    <option value="Soumyaranjan Parida">
                      Soumyaranjan Parida
                    </option>

                    <option value="Admin">
                      Admin
                    </option>
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
              <div className="grid grid-cols-2 gap-6">

                <div className="input-group relative">

                  <label className="input-label text-sm font-semibold mb-2 block">
                    Due Date
                  </label>

                  <div
                    className="due-date-button select-field flex items-center px-3 py-2 rounded-lg border cursor-pointer"
                    onClick={() =>
                      setIsCalendarOpen(
                        !isCalendarOpen
                      )
                    }
                  >
                    <i className="fa fa-calendar-alt text-gray-500 mr-2"></i>

                    <span className="text-gray-700">
                      {getFormattedDate(
                        selectedDay
                      )}
                    </span>
                  </div>

                  {isCalendarOpen && (
                    <div className="calendar-popup calendar-popup-above absolute mt-2 p-4 rounded-xl shadow-lg">

                      <div className="calendar-header flex justify-between items-center mb-4">

                        <button
                          className="calendar-arrow"
                          onClick={() =>
                            changeMonth(-1)
                          }
                        >
                          <i className="fa fa-chevron-left"></i>
                        </button>

                        <span className="font-semibold text-gray-800">
                          {currentDate.toLocaleString(
                            'default',
                            {
                              month: 'long',
                              year: 'numeric',
                            }
                          )}
                        </span>

                        <button
                          className="calendar-arrow"
                          onClick={() =>
                            changeMonth(1)
                          }
                        >
                          <i className="fa fa-chevron-right"></i>
                        </button>

                      </div>

                      <div className="calendar-grid">

                        {calendarHeaders.map(
                          (day) => (
                            <span
                              key={day}
                              className="day-header text-xs font-medium text-gray-500"
                            >
                              {day}
                            </span>
                          )
                        )}

                        {calendarDays.map(
                          (day, index) => (
                            <button
                              key={index}
                              className={`day-cell text-sm font-medium ${day.isPrev
                                  ? 'text-gray-400'
                                  : 'text-gray-700'
                                } ${day.day ===
                                  selectedDay &&
                                  !day.isPrev
                                  ? 'day-selected'
                                  : ''
                                } ${day.isToday
                                  ? 'day-today'
                                  : ''
                                }`}
                              onClick={() =>
                                handleDateSelect(
                                  day.day
                                )
                              }
                              disabled={day.isPrev}
                            >
                              {day.day}
                            </button>
                          )
                        )}

                      </div>
                    </div>
                  )}

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
              className="save-changes-button px-6 py-2 rounded-lg font-semibold text-white transition"
              onClick={
                handleSaveChanges
              }
            >
              Save Changes
            </button>
          </div>

        </div>
      </div>
    </div>
  );
};

export default TaskDetailModal;