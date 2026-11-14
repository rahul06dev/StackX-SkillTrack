import React, { useState, useEffect, useRef } from 'react';
import { Droppable, Draggable } from '@hello-pangea/dnd';
import TaskCard from './TaskCard';
import TaskDetailModal from './TaskDetailModal';
import { API_BASE_URL } from '../config/api';

export interface Task {
    id: string;
    title: string;
    description: string;
    priority: 'high' | 'medium' | 'low';
    assignee?: string;
    dueDate?: Date | null;
    columnId: string;
    order?: number;
    commentsCount?: number;
    attachmentsCount?: number;
}

interface KanbanColumnProps {
    columnId: string;
    title: string;
    colorClass: string;
    tasks: Task[];
    completedColumnId?: string;
    inProgressColumnId?: string;
    targetTaskId?: string | null;
    readOnly?: boolean;
    onTaskAutoOpened?: () => void;
    onColumnDelete: (columnId: string) => void;
    onTaskCreate: (columnId: string, newTask: Task) => void;
    onTaskSave: (updatedTask: Task) => void;
    onTaskDelete: (taskId: string) => void;
}

const KanbanColumn: React.FC<KanbanColumnProps> = ({
    columnId,
    title,
    colorClass,
    tasks,
    completedColumnId,
    inProgressColumnId,
    targetTaskId,
    readOnly = false,
    onTaskAutoOpened,
    onColumnDelete,
    onTaskCreate,
    onTaskSave,
    onTaskDelete,
}) => {
    const [isAdding, setIsAdding] = useState(false);
    const [newTaskTitle, setNewTaskTitle] = useState('');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedTask, setSelectedTask] = useState<Task | null>(null);

    const hasAutoOpenedTask = useRef(false);

    // Auto-open task if URL has ?task=id
    useEffect(() => {
        if (!targetTaskId || tasks.length === 0 || hasAutoOpenedTask.current) {
            return;
        }

        const targetTask = tasks.find((t) => t.id === targetTaskId);
        if (targetTask) {
            hasAutoOpenedTask.current = true;
            setSelectedTask(targetTask);
            setIsModalOpen(true);
            onTaskAutoOpened?.();
        }
    }, [targetTaskId, tasks, onTaskAutoOpened]);

    // Handle adding a new task
    const handleAddTask = async () => {
        if (!newTaskTitle.trim()) return;

        const payload = {
            columnId,
            title: newTaskTitle.trim(),
            description: '',
            priority: 'medium',
            dueDate: null,
        };

        try {
            const token = localStorage.getItem('token');
            if (!token) throw new Error('Authentication token not found');

            const res = await fetch(`${API_BASE_URL}/api/tasks`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify(payload),
            });

            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                throw new Error(err.message || 'Failed to create task.');
            }

            const createdTask = await res.json();
            const formattedTask: Task = {
                ...createdTask,
                dueDate: createdTask.dueDate ? new Date(createdTask.dueDate) : null,
                commentsCount: 0,
                attachmentsCount: 0,
            };

            onTaskCreate(columnId, formattedTask);
            setNewTaskTitle('');
            setIsAdding(false);
        } catch (err) {
            console.error('Error creating task:', err);
            alert(err instanceof Error ? err.message : 'Failed to create task.');
        }
    };

    const handleTaskCardClick = (task: Task) => {
        setSelectedTask(task);
        setIsModalOpen(true);
    };

    return (
        <div className="kanban-column flex flex-col rounded-xl overflow-hidden bg-gray-50 border border-gray-200 shadow-sm">
            {/* Column Header */}
            <div
                className={`column-header flex justify-between items-center p-4 text-white ${colorClass}`}
            >
                <div className="flex items-center gap-2">
                    <span className="font-semibold text-lg">{title}</span>
                    <span className="bg-white/30 text-white px-2 py-0.5 rounded-full text-xs font-bold">
                        {tasks.length}
                    </span>
                </div>

                {!readOnly && (
                    <button
                        type="button"
                        onClick={() => onColumnDelete(columnId)}
                        className="text-white/80 hover:text-white p-1 transition"
                        title="Delete Column"
                    >
                        <i className="fa fa-trash-alt text-sm"></i>
                    </button>
                )}
            </div>

            {/* Column Body & Add Task Button */}
            <div className="column-content flex-1 flex flex-col p-3">
                {!readOnly && (
                    isAdding ? (
                        <div className="task-input-form mb-3 p-3 bg-white rounded-xl shadow-sm border border-purple-200">
                            <input
                                type="text"
                                className="task-input-field w-full px-3 py-2 mb-2 rounded-lg border border-gray-300 text-gray-800 text-sm focus:ring-purple-500 focus:border-purple-500"
                                placeholder="Enter task title..."
                                value={newTaskTitle}
                                onChange={(e) => setNewTaskTitle(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') handleAddTask();
                                    if (e.key === 'Escape') setIsAdding(false);
                                }}
                                autoFocus
                            />

                            <div className="flex gap-2">
                                <button
                                    type="button"
                                    className="add-task-submit-button flex-1 py-1.5 px-3 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm font-semibold transition"
                                    onClick={handleAddTask}
                                >
                                    Add Task
                                </button>
                                <button
                                    type="button"
                                    className="add-task-cancel-button py-1.5 px-3 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg text-sm transition"
                                    onClick={() => setIsAdding(false)}
                                >
                                    Cancel
                                </button>
                            </div>
                        </div>
                    ) : (
                        <button
                            type="button"
                            className="add-task-button w-full py-2 mb-3 bg-white hover:bg-gray-100 border border-dashed border-gray-300 text-gray-600 rounded-xl flex items-center justify-center gap-2 text-sm font-medium transition"
                            onClick={() => setIsAdding(true)}
                        >
                            <i className="fa fa-plus text-xs text-purple-600"></i>
                            Add Task
                        </button>
                    )
                )}

                {/* Droppable Task Container */}
                <Droppable droppableId={columnId}>
                    {(provided, snapshot) => (
                        <div
                            ref={provided.innerRef}
                            {...provided.droppableProps}
                            className={`tasks-area flex-1 min-h-[120px] rounded-xl transition-colors ${
                                snapshot.isDraggingOver
                                    ? 'bg-purple-50/70 ring-2 ring-purple-300 ring-dashed'
                                    : ''
                            }`}
                        >
                            {tasks.map((task, index) => (
                                <Draggable
                                    key={task.id}
                                    draggableId={task.id}
                                    index={index}
                                    isDragDisabled={readOnly}
                                >
                                    {(dragProvided, dragSnapshot) => (
                                        <div
                                            ref={dragProvided.innerRef}
                                            {...dragProvided.draggableProps}
                                            {...dragProvided.dragHandleProps}
                                            className={`mb-3 transition-transform ${
                                                dragSnapshot.isDragging
                                                    ? 'shadow-2xl ring-2 ring-purple-500 rounded-xl opacity-95 scale-[1.02]'
                                                    : ''
                                            }`}
                                        >
                                            <TaskCard
                                                task={task}
                                                commentsCount={task.commentsCount}
                                                onCardClick={() => handleTaskCardClick(task)}
                                            />
                                        </div>
                                    )}
                                </Draggable>
                            ))}
                            {provided.placeholder}

                            {tasks.length === 0 && !snapshot.isDraggingOver && (
                                <div className="h-24 flex items-center justify-center text-xs text-gray-400 italic">
                                    Drop tasks here
                                </div>
                            )}
                        </div>
                    )}
                </Droppable>
            </div>

            {/* Task Detail Modal */}
            {isModalOpen && selectedTask && (
                <TaskDetailModal
                    task={selectedTask}
                    columnTitle={title}
                    completedColumnId={completedColumnId}
                    inProgressColumnId={inProgressColumnId}
                    isOpen={isModalOpen}
                    onClose={() => {
                        setIsModalOpen(false);
                        setSelectedTask(null);
                    }}
                    onTaskDelete={(taskId) => {
                        onTaskDelete(taskId);
                        setIsModalOpen(false);
                        setSelectedTask(null);
                    }}
                    onTaskSave={(updatedTask) => {
                        onTaskSave(updatedTask);
                        setIsModalOpen(false);
                        setSelectedTask(null);
                    }}
                />
            )}
        </div>
    );
};

export default KanbanColumn;
