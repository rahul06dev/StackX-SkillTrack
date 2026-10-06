import React, { useEffect, useState, useMemo } from 'react';
import Sidebar from '../components/Sidebar';
import DashboardStats from '../components/DashboardStats';
import ProjectList from '../components/ProjectList';
import UpcomingDeadlines from '../components/UpcomingDeadlines'; // Will be updated below

// ⚠️ Ensure interfaces are consistent with API responses
interface Project {
  id: string; // Updated to string (UUID)
  title: string;
  description: string;
  tasks: number;
  members: number;
}

// ⚠️ NEW Interface for Tasks
interface Task {
    id: string; 
    title: string;
    priority: 'high' | 'medium' | 'low';
    dueDate: Date | null;
    columnId: string;
    // Add any other necessary fields
}

interface DashboardTask extends Task {
    projectTitle: string; // The title of the parent project
    projectId: string; // The ID of the parent project
}

const API_BASE_URL = 'http://localhost:4300';

const Dashboard = () => {
  const [projects, setProjects] = useState<Project[]>([]);
  // 🚀 NEW STATE FOR TASKS
  const [tasks, setTasks] = useState<Task[]>([]); 
  const [loading, setLoading] = useState(true);
  const [columns, setColumns] = useState<any[]>([]);

  useEffect(() => {
        const fetchDashboardData = async () => {
            setLoading(true);
            try {
                // 1. Fetch Projects
                const [projectsRes, tasksRes, columnsRes] = await Promise.all([
                    fetch(`${API_BASE_URL}/api/projects`),
                    fetch(`${API_BASE_URL}/api/tasks`),
                    // 🚀 NEW: Fetch all columns (required to link task to project)
                    fetch(`${API_BASE_URL}/api/columns`), 
                ]);

                const projectsData: Project[] = await projectsRes.json();
                const tasksData: any[] = await tasksRes.json();
                const columnsData: any[] = await columnsRes.json();
                console.log("project list", projectsData)
                
                setProjects(projectsData.map(p => ({ ...p, id: p.id.toString() })));
                setColumns(columnsData);

                const formattedTasks: Task[] = tasksData.map(task => ({
                    id: task.id,
                    title: task.title,
                    priority: task.priority,
                    columnId: task.columnId,
                    dueDate: task.dueDate ? new Date(task.dueDate) : null,
                }));
                setTasks(formattedTasks);

            } catch (error) {
                console.error("Could not fetch dashboard data:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchDashboardData();
    }, []);

    // 🚀 Use useMemo to create fast lookup maps and augment task data
    const augmentedTasks = useMemo(() => {
        // Map: columnId -> projectId
        const columnToProjectMap = new Map();
        columns.forEach(col => columnToProjectMap.set(col.id, col.projectId));

        // Map: projectId -> projectTitle
        const projectTitleMap = new Map();
        projects.forEach(p => projectTitleMap.set(p.id, p.title));
        
        return tasks.map(task => {
            const projectId = columnToProjectMap.get(task.columnId);
            const projectTitle = projectTitleMap.get(projectId) || 'Unknown Project';

            return {
                ...task,
                projectTitle,
                projectId: projectId || '0',
            } as DashboardTask;
        });
    }, [tasks, columns, projects]);


    // Logic for  (Updated Upcoming Deadlinesto use augmentedTasks)
    const upcomingDeadlines = useMemo(() => {
        const datedTasks = augmentedTasks.filter(task => task.dueDate !== null) as (DashboardTask & { dueDate: Date })[];
        
        const now = new Date();
        const oneWeekLater = new Date();
        oneWeekLater.setDate(now.getDate() + 28);
        
        const filtered = datedTasks.filter(task => task.dueDate > now && task.dueDate <= oneWeekLater);

        return filtered.sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime());
    }, [augmentedTasks]);


  // Logic for Dashboard Stats (remains the same)
  const calculatedStats = useMemo(() => {
    // ... (Your existing calculation logic: total, completed, overdue, active)
    const total = projects.length;
    const completed = projects.filter(p => p.tasks === 0).length;
    const overdue = projects.length > 3 ? 1 : 0; 
    const active = Math.max(0, total - completed - overdue);
    return { total, active, completed, overdue };
  }, [projects]);


  return (
    <div className="flex">
      <Sidebar activeTab="dashboard" />
      <div className="flex-1 p-10 dashboard-page-bg">
        <h1 className="text-4xl font-bold mb-4 welcome-heading">Welcome back! 👋</h1>
        <p className="text-gray-600 mb-8">Here's what's happening with your projects today</p>

        <DashboardStats 
            total={calculatedStats.total} 
            active={calculatedStats.active} 
            completed={calculatedStats.completed} 
            overdue={calculatedStats.overdue} 
        />

        <div className="grid grid-cols-5 gap-6">
          <div className="col-span-3">
            <ProjectList projects={projects} />
          </div>
          <div className="col-span-2">
            {/* 🚀 Pass the filtered tasks to the component */}
            <UpcomingDeadlines upcomingTasks={upcomingDeadlines} loading={loading} />
          </div>
        </div>
      </div>
    </div>
  );
};
export default Dashboard;