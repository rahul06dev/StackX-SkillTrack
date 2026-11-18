import { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';

import Sidebar from '../components/Sidebar';
import ProjectListItem from '../components/ProjectListItem';
import CreateProjectModal from '../components/CreateProjectModal';
import '../auth.css';

interface Project {
  id: string;
  title: string;
  description: string;
  tasks: number;
  members: number;
  status?: string;
}

import { API_BASE_URL } from '../config/api';

const ProjectsPage = () => {
  const userData = localStorage.getItem('user');
  const user = userData ? JSON.parse(userData) : null;

  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [projectFilter, setProjectFilter] = useState<'ALL' | 'ACTIVE' | 'COMPLETED'>('ALL');

  const [isModalOpen, setIsModalOpen] = useState(false);

  const [searchParams] = useSearchParams();

  const activeCount = projects.filter((p) => p.status !== 'COMPLETED').length;
  const completedCount = projects.filter((p) => p.status === 'COMPLETED').length;

  const displayedProjects = useMemo(() => {
    if (projectFilter === 'ACTIVE') return projects.filter((p) => p.status !== 'COMPLETED');
    if (projectFilter === 'COMPLETED') return projects.filter((p) => p.status === 'COMPLETED');
    return projects;
  }, [projectFilter, projects]);

  const fetchProjects = async () => {
    try {
      setLoading(true);
      setError(null);

      const token = localStorage.getItem('token');

      if (!token) {
        throw new Error('Authentication token not found');
      }

      const response = await fetch(
        `${API_BASE_URL}/api/projects`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data: Project[] = await response.json();

      setProjects(data);
    } catch (err) {
      console.error('Failed to fetch projects:', err);

      setError(
        'Failed to load projects. Please check the API server.'
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProjects();
  }, []);

  /*
   * Open Create Project modal when URL contains:
   * /projects?create=true
   */
  useEffect(() => {
    const shouldCreate = searchParams.get('create');

    if (shouldCreate === 'true') {
      setIsModalOpen(true);
    }
  }, [searchParams]);

  const handleProjectCreated = (newProject: any) => {
    const formattedProject: Project = {
      id: newProject.id,
      title: newProject.title,
      description: newProject.description,
      tasks: newProject.tasks ?? newProject.tasksCount ?? 0,
      members: newProject.members ?? newProject.membersCount ?? 0,
    };

    setProjects((currentProjects) => [
      formattedProject,
      ...currentProjects,
    ]);

    setIsModalOpen(false);
  };

  const handleOpenModal = () => {
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
  };
  
  if (loading) {
    return (
      <div className="projects-page-wrapper">
        <Sidebar activeTab="projects" />

        <main className="projects-main">
          <div className="projects-loading">
            Loading projects...
          </div>
        </main>
      </div>
    );
  }

  if (error) {
    return (
      <div className="projects-page-wrapper">
        <Sidebar activeTab="projects" />

        <main className="projects-main">
          <div className="projects-error">
            <h2>Unable to load projects</h2>
            <p>{error}</p>

            <button
              onClick={fetchProjects}
              className="projects-retry-button"
            >
              Try Again
            </button>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="projects-page-wrapper">

      <Sidebar activeTab="projects" />

      <main className="projects-main">

        {/* Header */}
        <div className="projects-header">

          <div>
            <h1>
              {user?.role === 'STUDENT'
                ? 'My Projects'
                : user?.role === 'FACULTY'
                  ? 'Student Projects'
                  : 'All Projects'}
            </h1>

            <p>
              {user?.role === 'STUDENT'
                ? 'View and manage your projects'
                : user?.role === 'FACULTY'
                  ? 'Review and manage supervised projects'
                  : 'Manage all projects in SkillTrack'}
            </p>
          </div>

          {projectFilter === 'ALL' && (
            <button
              onClick={handleOpenModal}
              className="projects-new-button"
            >
              <span>+</span>
              New Project
            </button>
          )}

        </div>

        {/* Project Filter Tabs & Summary */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', margin: '20px 0 16px' }}>
          <div className="dashboard-filter-tabs">
            <button
              type="button"
              className={`dashboard-filter-tab ${projectFilter === 'ALL' ? 'active' : ''}`}
              onClick={() => setProjectFilter('ALL')}
            >
              All Projects <span className="badge">{projects.length}</span>
            </button>
            <button
              type="button"
              className={`dashboard-filter-tab ${projectFilter === 'ACTIVE' ? 'active' : ''}`}
              onClick={() => setProjectFilter('ACTIVE')}
            >
              Active <span className="badge">{activeCount}</span>
            </button>
            <button
              type="button"
              className={`dashboard-filter-tab ${projectFilter === 'COMPLETED' ? 'active' : ''}`}
              onClick={() => setProjectFilter('COMPLETED')}
            >
              Completed <span className="badge">{completedCount}</span>
            </button>
          </div>

          <div style={{ fontSize: '13px', color: '#64748b' }}>
            Showing <strong>{displayedProjects.length}</strong> of <strong>{projects.length}</strong> projects
          </div>
        </div>

        {/* Projects */}
        <div className="projects-grid">

          {displayedProjects.length > 0 ? (

            displayedProjects.map((project) => (
              <ProjectListItem
                key={project.id}
                project={project}
                isGridItem={true}
              />
            ))

          ) : projects.length === 0 ? (

            <div className="projects-empty-state">

              <div className="projects-empty-icon" style={{ fontSize: '32px', color: '#4f46e5' }}>
                <i className="fa fa-folder-open"></i>
              </div>

              <h2>No projects yet</h2>

              <p>
                {user?.role === 'STUDENT'
                  ? 'You haven’t created or joined any projects yet. Start an academic project or collaborate with your peers!'
                  : user?.role === 'FACULTY'
                    ? 'No projects under your supervision yet. Projects assigned to you will appear here.'
                    : 'Create a project to start tracking tasks and mapping competency skills.'}
              </p>

              <button
                onClick={handleOpenModal}
                className="skilltrack-btn-primary"
                style={{ marginTop: '14px' }}
              >
                <i className="fa fa-plus"></i> Create New Project
              </button>

            </div>

          ) : (

            <div className="projects-empty-state" style={{ padding: '36px 20px' }}>

              <div className="projects-empty-icon" style={{ fontSize: '32px', color: '#94a3b8' }}>
                <i className={projectFilter === 'COMPLETED' ? 'fa fa-check-circle' : 'fa fa-tasks'}></i>
              </div>

              <h2>0 {projectFilter === 'COMPLETED' ? 'Completed' : 'Active'} Projects</h2>

              <p>
                {projectFilter === 'COMPLETED'
                  ? 'There are currently 0 completed projects. Projects marked as completed will appear here.'
                  : 'There are currently 0 active projects. All projects are either completed or archived.'}
              </p>

              <button
                type="button"
                onClick={() => setProjectFilter('ALL')}
                className="student-primary-button"
                style={{ marginTop: '14px', background: '#f1f5f9', color: '#334155', border: '1px solid #cbd5e1' }}
              >
                View All Projects ({projects.length})
              </button>

            </div>

          )}

        </div>

      </main>

      {/* Create Project Modal */}
      <CreateProjectModal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        onProjectCreated={handleProjectCreated}
      />

    </div>
  );
};

export default ProjectsPage;