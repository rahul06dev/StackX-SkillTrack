import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import '../auth.css';

interface AdminOverview {
  totalUsers: number;
  totalStudents: number;
  totalFaculty: number;
  totalProjects: number;
  activeProjects: number;
  completedProjects: number;
}

interface ProjectPerson {
  id: string;
  name: string;
  email: string;
  role: 'STUDENT' | 'FACULTY' | 'ADMIN';
}

interface RecentProject {
  id: string;
  title: string;
  description: string;
  status: string;
  tasksCount: number;
  peopleCount: number;
  students: ProjectPerson[];
  faculty: ProjectPerson[];
  admins: ProjectPerson[];
  createdAt: string;
  updatedAt: string;
}

const AdminDashboard = () => {
  const userData = localStorage.getItem('user');
  const user = userData ? JSON.parse(userData) : null;
  const navigate = useNavigate();

  const [overview, setOverview] =
    useState<AdminOverview | null>(null);

  const [loadingOverview, setLoadingOverview] =
    useState(true);

  const [recentProjects, setRecentProjects] =
    useState<RecentProject[]>([]);

  const [loadingRecentProjects, setLoadingRecentProjects] =
    useState(true);

  // ================================
  // Fetch Admin Overview
  // ================================

  useEffect(() => {
    const fetchAdminOverview = async () => {
      try {
        const token = localStorage.getItem('token');

        if (!token) {
          throw new Error('Authentication token not found');
        }

        const response = await fetch(
          'http://localhost:4300/api/projects/admin/overview',
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        if (!response.ok) {
          throw new Error(
            'Failed to fetch admin dashboard overview'
          );
        }

        const data: AdminOverview =
          await response.json();

        setOverview(data);
      } catch (error) {
        console.error(
          'Failed to load admin dashboard overview:',
          error
        );
      } finally {
        setLoadingOverview(false);
      }
    };

    fetchAdminOverview();
  }, []);

  // ================================
  // Fetch Recent Projects
  // ================================

  useEffect(() => {
    const fetchRecentProjects = async () => {
      try {
        const token = localStorage.getItem('token');

        if (!token) {
          throw new Error('Authentication token not found');
        }

        const response = await fetch(
          'http://localhost:4300/api/projects/admin/recent',
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        if (!response.ok) {
          throw new Error(
            'Failed to fetch recent projects'
          );
        }

        const data: RecentProject[] =
          await response.json();

        setRecentProjects(data);
      } catch (error) {
        console.error(
          'Failed to load recent projects:',
          error
        );

        setRecentProjects([]);
      } finally {
        setLoadingRecentProjects(false);
      }
    };

    fetchRecentProjects();
  }, []);

  return (
    <div className="admin-page">

      {/* Shared Sidebar */}
      <Sidebar activeTab="dashboard" />

      {/* Main Content */}
      <main className="admin-main">

        {/* Header */}
        <header className="admin-header">
          <div>
            <h1>
              Welcome back, {user?.name || 'Admin'}!
            </h1>

            <p>
              Manage users, projects, and the overall SkillTrack platform.
            </p>
          </div>

          <div className="admin-profile">
            <span>{user?.name || 'Admin'}</span>
          </div>
        </header>

        {/* Statistics */}
        <section className="admin-stats">

          <div className="admin-stat-card">
            <h3>Total Users</h3>

            <p>
              {loadingOverview
                ? '—'
                : overview?.totalUsers ?? 0}
            </p>
          </div>

          <div className="admin-stat-card">
            <h3>Students</h3>

            <p>
              {loadingOverview
                ? '—'
                : overview?.totalStudents ?? 0}
            </p>
          </div>

          <div className="admin-stat-card">
            <h3>Faculty</h3>

            <p>
              {loadingOverview
                ? '—'
                : overview?.totalFaculty ?? 0}
            </p>
          </div>

          <div className="admin-stat-card">
            <h3>Total Projects</h3>

            <p>
              {loadingOverview
                ? '—'
                : overview?.totalProjects ?? 0}
            </p>
          </div>

        </section>

        {/* Project Overview */}
        <section className="admin-section">

          <div className="admin-section-header">
            <h2>Project Overview</h2>
          </div>

          <div className="admin-overview-grid">

            <div className="admin-overview-card">
              <span>Active Projects</span>

              <strong>
                {loadingOverview
                  ? '—'
                  : overview?.activeProjects ?? 0}
              </strong>
            </div>

            <div className="admin-overview-card">
              <span>Completed Projects</span>

              <strong>
                {loadingOverview
                  ? '—'
                  : overview?.completedProjects ?? 0}
              </strong>
            </div>

            <div className="admin-overview-card">
              <span>Overdue Projects</span>

              <strong>—</strong>
            </div>

          </div>

        </section>

        {/* Recent Projects */}
        <section className="admin-section">

          <div className="admin-section-header">
            <h2>Recent Projects</h2>
          </div>

          {loadingRecentProjects ? (
            <div className="admin-empty-state">
              <h3>Loading projects...</h3>

              <p>
                Please wait while recent projects are being loaded.
              </p>
            </div>
          ) : recentProjects.length === 0 ? (
            <div className="admin-empty-state">
              <h3>No projects available</h3>

              <p>
                Recently created projects will appear here.
              </p>
            </div>
          ) : (
            <div className="admin-projects-list">

              {recentProjects.map((project) => {

                const formattedDate =
                  new Date(
                    project.updatedAt
                  ).toLocaleDateString(
                    'en-IN',
                    {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                    }
                  );

                return (
                  <div
                    key={project.id}
                    className="admin-project-card"
                    onClick={() => navigate(`/projects/${project.id}`)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        navigate(`/projects/${project.id}`);
                      }
                    }}
                  >

                    <div className="admin-project-main">

                      <div className="admin-project-icon">
                        <i className="fa fa-folder-open"></i>
                      </div>

                      <div className="admin-project-info">

                        <h3>
                          {project.title}
                        </h3>

                        <p>
                          {project.description}
                        </p>

                        <span>
                          Updated {formattedDate}
                        </span>

                      </div>

                    </div>

                    <div className="admin-project-meta">
                      <div className="admin-project-stat">
                        <span>Tasks</span>
                        <strong>{project.tasksCount}</strong>
                      </div>

                      <div className="admin-project-stat">
                        <span>People</span>
                        <strong>{project.peopleCount}</strong>
                      </div>

                      <span
                        className={`admin-project-status ${project.status.toLowerCase()}`}
                      >
                        {project.status}
                      </span>
                    </div>

                  </div>
                );
              })}

            </div>
          )}

        </section>

      </main>

    </div>
  );
};

export default AdminDashboard;