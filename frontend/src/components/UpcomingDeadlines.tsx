import React from 'react';
import { Link } from 'react-router-dom'; // ⚠️ Need this import

// ⚠️ Use the new augmented interface
interface DashboardTask {
    id: string; 
    title: string;
    priority: 'high' | 'medium' | 'low';
    dueDate: Date; // Asserted not null in Dashboard.tsx
    projectId: string; // New field
    projectTitle: string; // New field
}

interface UpcomingDeadlinesProps {
    upcomingTasks: DashboardTask[];
    loading: boolean;
}

const getPriorityColor = (priority: string) => {
    switch (priority) {
        case 'high': return 'text-red-500';
        case 'medium': return 'text-yellow-500';
        default: return 'text-green-500';
    }
};

const formatDate = (date: Date) => {
    if (!date) return 'N/A';
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

const UpcomingDeadlines: React.FC<UpcomingDeadlinesProps> = ({ upcomingTasks, loading }) => {
    return (
        <div className="upcoming-deadlines-card p-6 bg-white rounded-xl shadow-md h-full">
            <h2 className="text-xl font-bold mb-4 text-gray-800">🗓️ Upcoming Deadlines</h2>
            
            {loading ? (
                <p className="text-gray-500">Loading tasks...</p>
            ) : upcomingTasks.length === 0 ? (
                <p className="text-gray-500 italic py-4">No tasks due in the next 7 days. Enjoy the break!</p>
            ) : (
                <div className="space-y-4">
                    {upcomingTasks.map(task => (
                        // 🚀 WRAP ITEM IN LINK
                        <Link 
                            key={task.id} 
                            to={`/projects/${task.projectId}`} // Link to the project board
                            className="deadline-item flex justify-between items-center p-2 rounded-lg transition duration-150 hover:bg-gray-50"
                        >
                            <div className="flex flex-col flex-1 min-w-0">
                                {/* Task Title */}
                                <span className="text-sm font-medium text-gray-800 line-clamp-1">{task.title}</span>
                                
                                {/* Project Name */}
                                <span className="text-xs text-gray-500 line-clamp-1">
                                    Project: **{task.projectTitle}**
                                </span>
                            </div>
                            
                            <div className="date-priority-info flex flex-col items-end ml-4">
                                {/* Date */}
                                <span className="font-bold text-gray-700 text-sm">{formatDate(task.dueDate)}</span>
                                {/* Priority */}
                                <span className={`text-xs ${getPriorityColor(task.priority)} capitalize`}>
                                    {task.priority}
                                </span>
                            </div>
                        </Link>
                    ))}
                </div>
            )}
        </div>
    );
};

export default UpcomingDeadlines;