import React from 'react';

// Task interface
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

interface TaskCardProps {
    task: Task;
    commentsCount?: number;
    onCardClick: (task: Task) => void;
    onDragStart?: (
        task: Task,
        event: React.DragEvent<HTMLDivElement>
    ) => void;
}

const getPriorityClasses = (
    priority: 'high' | 'medium' | 'low'
) => {
    switch (priority) {
        case 'high':
            return 'priority-high-dot bg-red-500';

        case 'medium':
            return 'priority-medium-dot bg-yellow-500';

        case 'low':
            return 'priority-low-dot bg-green-500';

        default:
            return 'bg-gray-400';
    }
};

const TaskCard: React.FC<TaskCardProps> = ({
    task,
    commentsCount = 0,
    onCardClick,
    onDragStart,
}) => {

    const priorityDotClass = getPriorityClasses(task.priority);

    const formattedDueDate = task.dueDate
        ? new Date(task.dueDate).toLocaleDateString(
            'en-US',
            {
                month: 'short',
                day: 'numeric',
            }
        )
        : 'No Date';

    const handleDragStart = (
        e: React.DragEvent<HTMLDivElement>
    ) => {
        e.dataTransfer.setData(
            'text/plain',
            task.id
        );

        e.dataTransfer.effectAllowed = 'move';

        onDragStart?.(task, e);
    };

    return (
        <div
            data-task-id={task.id}
            draggable
            onDragStart={handleDragStart}
            className="task-card bg-white p-4 mb-3 rounded-xl shadow-sm border border-gray-200 transition duration-150 hover:shadow-md cursor-grab active:cursor-grabbing"
            onClick={() => onCardClick(task)}
        >
            <div className="flex justify-between items-start mb-2">

                {/* Task Title */}
                <p className="text-gray-800 font-medium text-base leading-snug break-words">
                    {task.title}
                </p>

                {/* Priority Indicator */}
                <div
                    className={`w-3 h-3 rounded-full ml-3 flex-shrink-0 ${priorityDotClass}`}
                ></div>
            </div>

            {/* Footer Stats */}
            <div className="task-stats flex justify-between items-center text-xs text-gray-500 mt-2">

                <div className="flex gap-3">

                    {/* Assignee Initial */}
                    <div className="flex items-center gap-1">
                        <i className="fa fa-user-circle"></i>

                        <span>
                            {task.assignee
                                ? task.assignee.substring(0, 1)
                                : '?'}
                        </span>
                    </div>

                    {/* Comments Count */}
                    <p className="flex items-center gap-1">
                        <i className="fa fa-comment-dots"></i>
                        {commentsCount}
                    </p>

                </div>

                {/* Due Date */}
                <div className="due-date flex items-center gap-1">
                    <i className="fa fa-calendar-alt"></i>

                    {formattedDueDate}
                </div>

            </div>
        </div>
    );
};

export default TaskCard;