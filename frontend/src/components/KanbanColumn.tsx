import React, {
    useState,
    useEffect,
    useRef,
    useCallback,
} from 'react';
import TaskCard from './TaskCard';
import TaskDetailModal from './TaskDetailModal';

const API_BASE_URL = 'http://localhost:4300';

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

interface KanbanColumnProps {
    columnId: string;
    title: string;
    colorClass: string;
    completedColumnId?: string;
    inProgressColumnId?: string;
    targetTaskId?: string | null;
    onTaskAutoOpened?: () => void;
    onColumnDelete: (columnId: string) => void;
    onTaskMove: (
        taskId: string,
        sourceColumnId: string,
        targetColumnId: string
    ) => void;
    refreshKey: number;
}

const KanbanColumn: React.FC<KanbanColumnProps> = ({
    columnId,
    title,
    colorClass,
    completedColumnId,
    inProgressColumnId,
    targetTaskId,
    onTaskAutoOpened,
    onColumnDelete,
    onTaskMove,
    refreshKey,
}) => {

    const [tasks, setTasks] = useState<Task[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const [isAdding, setIsAdding] = useState(false);
    const [newTaskTitle, setNewTaskTitle] = useState('');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedTask, setSelectedTask] = useState<Task | null>(null);

    const hasAutoOpenedTask = useRef(false);

    const [isDragOver, setIsDragOver] = useState(false);
    const [moveError, setMoveError] = useState<string | null>(null);
    const [moveSuccess, setMoveSuccess] = useState<string | null>(null);

    const defaultPriority: 'high' | 'medium' | 'low' = 'medium';

    const handleDeleteClick = () => {
        onColumnDelete(columnId);
    };

    const fetchTasks = useCallback(async () => {
        setLoading(true);
        setError(null);

        try {
            const token = localStorage.getItem('token');

            if (!token) {
                throw new Error('Authentication token not found');
            }

            const response = await fetch(
                `${API_BASE_URL}/api/tasks?columnId=${columnId}`,
                {
                    headers: {
                        Authorization: `Bearer ${token}`,
                    },
                }
            );

            if (!response.ok) {
                throw new Error('Failed to fetch tasks.');
            }

            const fetchedTasks: Task[] = await response.json();

            const formattedTasks = fetchedTasks.map(task => ({
                ...task,
                dueDate: task.dueDate
                    ? new Date(task.dueDate)
                    : null,
                commentsCount: task.commentsCount || 0,
            }));

            setTasks(formattedTasks);

        } catch (err) {
            console.error(
                `Error loading tasks for column ${columnId}:`,
                err
            );

            setError('Could not load tasks.');

        } finally {
            setLoading(false);
        }
    }, [columnId]);

    useEffect(() => {
        fetchTasks();
    }, [fetchTasks, refreshKey]);

    useEffect(() => {
    if (
        !targetTaskId ||
        tasks.length === 0 ||
        hasAutoOpenedTask.current
    ) {
        return;
    }

    const targetTask = tasks.find(
        task => task.id === targetTaskId
    );

    if (targetTask) {
        hasAutoOpenedTask.current = true;

        setSelectedTask(targetTask);
        setIsModalOpen(true);

        onTaskAutoOpened?.();
    }
}, [
    targetTaskId,
    tasks,
    onTaskAutoOpened,
]);

    // -------------------------------
    // DRAG & DROP
    // -------------------------------

    const handleDragOver = (
        e: React.DragEvent<HTMLDivElement>
    ) => {
        e.preventDefault();

        e.dataTransfer.dropEffect = 'move';

        setIsDragOver(true);
    };

    const handleDragLeave = (
        e: React.DragEvent<HTMLDivElement>
    ) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node)) {
            setIsDragOver(false);
        }
    };

    const handleDrop = async (
        e: React.DragEvent<HTMLDivElement>
    ) => {
        e.preventDefault();

        setIsDragOver(false);

        const taskId = e.dataTransfer.getData('text/plain');

        if (!taskId) {
            return;
        }

        const sourceColumnId =
            e.dataTransfer.getData('sourceColumnId');

        if (!sourceColumnId || sourceColumnId === columnId) {
            return;
        }

        try {
            const token = localStorage.getItem('token');

            if (!token) {
                throw new Error('Authentication token not found');
            }

            const response = await fetch(
                `${API_BASE_URL}/api/tasks/${taskId}`,
                {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                        Authorization: `Bearer ${token}`,
                    },
                    body: JSON.stringify({
                        columnId,
                    }),
                }
            );

            if (!response.ok) {
                const errorData = await response.json();

                throw new Error(
                    errorData.message || 'Failed to move task.'
                );
            }

            onTaskMove(
                taskId,
                sourceColumnId,
                columnId
            );

            fetchTasks();

            // Show submission confirmation
            // when a task enters In Review.
            const user = localStorage.getItem('user');

            let userRole = null;

            try {
                userRole = user
                    ? JSON.parse(user).role
                    : null;
            } catch {
                userRole = null;
            }

            if (
                userRole === 'STUDENT' &&
                title === 'In Review'
            ) {
                setMoveSuccess(
                    'Task submitted for faculty review.'
                );

                setTimeout(() => {
                    setMoveSuccess(null);
                }, 4000);
            }

        } catch (err) {
            console.error('Error moving task:', err);

            setMoveError(
                err instanceof Error
                    ? err.message
                    : 'Failed to move task.'
            );

            setTimeout(() => {
                setMoveError(null);
            }, 4000);
        }
    };

    // -------------------------------
    // ADD TASK
    // -------------------------------

    const handleAddTask = async () => {
        if (!newTaskTitle.trim()) return;

        const newTaskPayload = {
            columnId,
            title: newTaskTitle.trim(),
            description: '',
            priority: defaultPriority,
            dueDate: null,
        };

        try {
            const token = localStorage.getItem('token');

            if (!token) {
                throw new Error('Authentication token not found');
            }

            const response = await fetch(
                `${API_BASE_URL}/api/tasks`,
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        Authorization: `Bearer ${token}`,
                    },
                    body: JSON.stringify(newTaskPayload),
                }
            );

            if (!response.ok) {
                throw new Error('Failed to create task on API.');
            }

            const createdTask: Task = await response.json();

            setTasks(prevTasks => [
                ...prevTasks,
                {
                    ...createdTask,
                    dueDate: createdTask.dueDate
                        ? new Date(createdTask.dueDate)
                        : null,
                },
            ]);

            setNewTaskTitle('');
            setIsAdding(false);

        } catch (err) {
            console.error('Error creating task:', err);

            alert('Failed to create task. Check API status.');
        }
    };

    // -------------------------------
    // EDIT TASK
    // -------------------------------

    const handleTaskSave = async (updatedTask: Task) => {
        try {
            const token = localStorage.getItem('token');

            if (!token) {
                throw new Error('Authentication token not found');
            }

            const response = await fetch(
                `${API_BASE_URL}/api/tasks/${updatedTask.id}`,
                {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                        Authorization: `Bearer ${token}`,
                    },
                    body: JSON.stringify({
                        title: updatedTask.title,
                        description: updatedTask.description,
                        priority: updatedTask.priority,
                        assignee: updatedTask.assignee,
                        columnId: updatedTask.columnId,
                        dueDate: updatedTask.dueDate,
                    }),
                }
            );

            if (!response.ok) {
                const errorData = await response.json().catch(() => null);

                throw new Error(
                    errorData?.message || 'Failed to update task.'
                );
            }

            // If the task moved to another column,
            // refresh all Kanban columns.
            if (updatedTask.columnId !== columnId) {
                onTaskMove(
                    updatedTask.id,
                    columnId,
                    updatedTask.columnId
                );
            } else {
                // Normal edit within the same column.
                setTasks(prevTasks =>
                    prevTasks.map(t =>
                        t.id === updatedTask.id
                            ? updatedTask
                            : t
                    )
                );
            }

        } catch (err) {
            console.error('Error saving task:', err);

            alert(
                err instanceof Error
                    ? err.message
                    : 'Failed to save changes. Check API status.'
            );
        }
    };

    // -------------------------------
    // DELETE TASK
    // -------------------------------

    const handleTaskDelete = async (taskId: string) => {
        try {
            const token = localStorage.getItem('token');

            if (!token) {
                throw new Error('Authentication token not found');
            }

            const response = await fetch(
                `${API_BASE_URL}/api/tasks/${taskId}`,
                {
                    method: 'DELETE',
                    headers: {
                        Authorization: `Bearer ${token}`,
                    },
                }
            );

            if (!response.ok && response.status !== 204) {
                throw new Error('Failed to delete task.');
            }

            setTasks(prevTasks =>
                prevTasks.filter(
                    t => t.id !== taskId
                )
            );

            handleCloseModal();

        } catch (err) {
            console.error('Error deleting task:', err);

            alert('Failed to delete task. Check API status.');
        }
    };

    const handleOpenModal = (task: Task) => {
        setSelectedTask(task);
        setIsModalOpen(true);
    };

    const handleCloseModal = () => {
        setIsModalOpen(false);
        setSelectedTask(null);
    };

    const handleCancel = () => {
        setNewTaskTitle('');
        setIsAdding(false);
    };

    return (
        <>
            {moveError && (
                <div className="kanban-error-toast">
                    <i className="fa fa-exclamation-circle"></i>

                    <span>{moveError}</span>

                    <button
                        onClick={() => setMoveError(null)}
                        title="Dismiss"
                    >
                        <i className="fa fa-times"></i>
                    </button>
                </div>
            )}
            {moveSuccess && (
                <div className="kanban-success-toast">
                    <i className="fa fa-check-circle"></i>

                    <span>{moveSuccess}</span>

                    <button
                        onClick={() => setMoveSuccess(null)}
                        title="Dismiss"
                    >
                        <i className="fa fa-times"></i>
                    </button>
                </div>
            )}
            <div
                className={`kanban-column flex flex-col rounded-xl p-0.5 shadow-md ${isDragOver ? 'kanban-column-drag-over' : ''
                    }`}
            >

                {/* Column Header */}
                <div
                    className={`column-header flex items-center justify-between p-4 rounded-t-xl text-white ${colorClass}`}
                >
                    <div className="flex items-center gap-2">

                        <span className="font-semibold text-lg">
                            {title}
                        </span>

                        <span className="bg-white/30 text-white px-2 py-0.5 rounded-full text-sm font-semibold">
                            {tasks.length}
                        </span>

                    </div>

                    <i
                        className="fa fa-trash-alt cursor-pointer hover:text-red-300 transition"
                        onClick={handleDeleteClick}
                        title="Delete Column"
                    ></i>
                </div>

                {/* Column Content */}
                <div
                    className="column-content flex-1 p-4"
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                >

                    {isAdding ? (
                        <div className="task-input-form mb-4 p-0">

                            <input
                                type="text"
                                className="task-input-field w-full px-4 py-3 mb-2 rounded-lg text-gray-700 font-medium"
                                placeholder="Task title..."
                                value={newTaskTitle}
                                onChange={(e) =>
                                    setNewTaskTitle(e.target.value)
                                }
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                        handleAddTask();
                                    }
                                }}
                                autoFocus
                            />

                            <div className="flex gap-2 items-center">

                                <button
                                    className="add-task-submit-button flex-1 flex items-center justify-center gap-2 py-3 rounded-lg font-semibold transition"
                                    onClick={handleAddTask}
                                >
                                    <i className="fa fa-plus"></i>
                                    Add
                                </button>

                                <button
                                    className="add-task-cancel-button px-4 py-3 rounded-lg transition"
                                    onClick={handleCancel}
                                >
                                    <i className="fa fa-times"></i>
                                </button>

                            </div>
                        </div>
                    ) : (
                        <button
                            className="add-task-button w-full py-2 mb-4 rounded-lg flex items-center justify-center gap-2 font-medium transition duration-200"
                            onClick={() => setIsAdding(true)}
                        >
                            <i className="fa fa-plus text-sm"></i>
                            Add Task
                        </button>
                    )}

                    <div className="tasks-area">

                        {loading ? (
                            <p className="text-gray-500">
                                Loading tasks...
                            </p>

                        ) : error ? (
                            <p className="text-red-500">
                                Error loading tasks.
                            </p>

                        ) : tasks.length === 0 ? (
                            <p className="text-gray-500 text-sm italic">
                                No tasks yet.
                            </p>

                        ) : (
                            tasks.map((task) => (
                                <TaskCard
                                    key={task.id}
                                    task={task}
                                    onCardClick={handleOpenModal}
                                    onDragStart={(draggedTask, event) => {
                                        event.dataTransfer.setData(
                                            'sourceColumnId',
                                            draggedTask.columnId
                                        );
                                    }}
                                />
                            ))
                        )}

                    </div>
                </div>
            </div>

            {selectedTask && (
                <TaskDetailModal
                    task={selectedTask}
                    columnTitle={title}
                    completedColumnId={completedColumnId}
                    inProgressColumnId={inProgressColumnId}
                    isOpen={isModalOpen}
                    onClose={handleCloseModal}
                    onTaskDelete={handleTaskDelete}
                    onTaskSave={handleTaskSave}
                />
            )}
        </>
    );
};

export default KanbanColumn;