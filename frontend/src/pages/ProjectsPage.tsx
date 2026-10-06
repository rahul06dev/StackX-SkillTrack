import React, { useState, useEffect } from 'react';
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
}

const API_BASE_URL = 'http://localhost:4300';

const ProjectsPage = () => {
  const userData = localStorage.getItem('user');
  const user = userData ? JSON.parse(userData) : null;

  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [isModalOpen, setIsModalOpen] = useState(false);

  const [searchParams] = useSearchParams();

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

    if (
      shouldCreate === 'true' &&
      (user?.role === 'FACULTY' || user?.role === 'ADMIN')
    ) {
      setIsModalOpen(true);
    }
  }, [searchParams, user?.role]);

  const handleProjectCreated = (newProject: Project) => {
    setProjects((currentProjects) => [
      newProject,
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

          {(user?.role === 'FACULTY' || user?.role === 'ADMIN') && (
            <button
              onClick={handleOpenModal}
              className="projects-new-button"
            >
              <span>+</span>
              New Project
            </button>
          )}

        </div>

        {/* Project Count */}
        <div className="projects-summary">
          <span>
            {projects.length}{' '}
            {projects.length === 1 ? 'Project' : 'Projects'}
          </span>
        </div>

        {/* Projects */}
        <div className="projects-grid">

          {projects.length > 0 ? (

            projects.map((project) => (
              <ProjectListItem
                key={project.id}
                project={project}
                isGridItem={true}
              />
            ))

          ) : (

            <div className="projects-empty-state">

              <div className="projects-empty-icon">
                +
              </div>

              <h2>No projects yet</h2>

              <p>
                {user?.role === 'STUDENT'
                  ? 'You have no projects assigned to you yet.'
                  : 'Create a project to start tracking tasks and progress.'}
              </p>

              {(user?.role === 'FACULTY' || user?.role === 'ADMIN') && (
                <button
                  onClick={handleOpenModal}
                  className="projects-new-button"
                >
                  + Create Project
                </button>
              )}

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