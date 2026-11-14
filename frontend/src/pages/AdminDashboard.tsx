import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import NotificationBell from '../components/NotificationBell';
import { API_BASE_URL } from '../config/api';
import '../auth.css';

interface AdminOverview {
  totalUsers: number;
  totalStudents: number;
  totalFaculty: number;
  totalProjects: number;
  activeProjects: number;
  completedProjects: number;
  overdueProjects: number;
  unassignedGuideProjects?: number;
  pendingInvitationsCount?: number;
  totalTasksCount?: number;
}

interface SkillVerificationOverview {
  totalClaims: number;
  verifiedClaims: number;
  pendingClaims: number;
  rejectedClaims: number;
  approvalRate: number;
  recentVerifications: Array<{
    id: string;
    studentName: string;
    skillName: string;
    level: string;
    verifiedAt: string;
  }>;
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

  const [overview, setOverview] = useState<AdminOverview | null>(null);
  const [loadingOverview, setLoadingOverview] = useState(true);

  const [skillOverview, setSkillOverview] = useState<SkillVerificationOverview | null>(null);
  const [loadingSkillOverview, setLoadingSkillOverview] = useState(true);

  const [recentProjects, setRecentProjects] = useState<RecentProject[]>([]);
  const [loadingRecentProjects, setLoadingRecentProjects] = useState(true);

  // ================================
  // Fetch Admin Overview & Skill Intelligence
  // ================================
  useEffect(() => {
    const fetchAdminOverview = async () => {
      try {
        const token = localStorage.getItem('token');
        if (!token) throw new Error('Authentication token not found');

        const [projRes, skillRes] = await Promise.all([
          fetch(`${API_BASE_URL}/api/projects/admin/overview`, {
            headers: { Authorization: `Bearer ${token}` },
          }),
          fetch(`${API_BASE_URL}/api/student-skills/admin/overview`, {
            headers: { Authorization: `Bearer ${token}` },
          }),
        ]);

        if (projRes.ok) {
          const data: AdminOverview = await projRes.json();
          setOverview(data);
        }

        if (skillRes.ok) {
          const sData: SkillVerificationOverview = await skillRes.json();
          setSkillOverview(sData);
        }
      } catch (error) {
        console.error('Failed to load admin dashboard overview:', error);
      } finally {
        setLoadingOverview(false);
        setLoadingSkillOverview(false);
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
        if (!token) throw new Error('Authentication token not found');

        const response = await fetch(`${API_BASE_URL}/api/projects/admin/recent`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (!response.ok) throw new Error('Failed to fetch recent projects');
        const data: RecentProject[] = await response.json();
        setRecentProjects(data);
      } catch (error) {
        console.error('Failed to load recent projects:', error);
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
            <h1>Welcome back, {user?.name || 'Admin'}!</h1>
            <p>Institutional coordination, user governance, project health, and skill analytics.</p>
          </div>

          <div className="admin-profile" style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <NotificationBell />
            <span>{user?.name || 'Admin'}</span>
          </div>
        </header>

        {/* Executive Statistics */}
        <section className="admin-stats">
          <div className="admin-stat-card">
            <h3>Total Users</h3>
            <p>{loadingOverview ? '—' : overview?.totalUsers ?? 0}</p>
          </div>

          <div className="admin-stat-card">
            <h3>Students Enrolled</h3>
            <p>{loadingOverview ? '—' : overview?.totalStudents ?? 0}</p>
          </div>

          <div className="admin-stat-card">
            <h3>Faculty Guides</h3>
            <p>{loadingOverview ? '—' : overview?.totalFaculty ?? 0}</p>
          </div>

          <div className="admin-stat-card">
            <h3>Total Projects</h3>
            <p>{loadingOverview ? '—' : overview?.totalProjects ?? 0}</p>
          </div>
        </section>

        {/* Project Health & Governance */}
        <section className="admin-section">
          <div className="admin-section-header">
            <div>
              <h2>Project & Supervision Health</h2>
              <p>Active engineering projects, supervision coverage, and deadline compliance.</p>
            </div>
            <button className="student-primary-button" onClick={() => navigate('/admin/projects')}>
              View All Projects
            </button>
          </div>

          <div className="admin-overview-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}>
            <div className="admin-overview-card">
              <span>Active Projects</span>
              <strong>{loadingOverview ? '—' : overview?.activeProjects ?? 0}</strong>
            </div>

            <div className="admin-overview-card">
              <span>Completed Projects</span>
              <strong style={{ color: '#16a34a' }}>{loadingOverview ? '—' : overview?.completedProjects ?? 0}</strong>
            </div>

            <div className="admin-overview-card">
              <span>Overdue Tasks / Projects</span>
              <strong style={{ color: (overview?.overdueProjects ?? 0) > 0 ? '#dc2626' : '#64748b' }}>
                {loadingOverview ? '—' : overview?.overdueProjects ?? 0}
              </strong>
            </div>

            <div className="admin-overview-card">
              <span>Awaiting Faculty Guide</span>
              <strong style={{ color: (overview?.unassignedGuideProjects ?? 0) > 0 ? '#d97706' : '#64748b' }}>
                {loadingOverview ? '—' : overview?.unassignedGuideProjects ?? 0}
              </strong>
            </div>

            <div className="admin-overview-card">
              <span>Pending Invitations</span>
              <strong>{loadingOverview ? '—' : overview?.pendingInvitationsCount ?? 0}</strong>
            </div>

            <div className="admin-overview-card">
              <span>Total System Tasks</span>
              <strong>{loadingOverview ? '—' : overview?.totalTasksCount ?? 0}</strong>
            </div>
          </div>
        </section>

        {/* Institutional Skill Verification & Talent Placement Intelligence */}
        <section className="admin-section">
          <div className="admin-section-header">
            <div>
              <h2>Skill Verification & Talent Placement Intelligence</h2>
              <p>Faculty verification volume, institutional competency approval rate, and recruiter search.</p>
            </div>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                className="talent-passport-btn"
                style={{ padding: '8px 14px', fontSize: '13px' }}
                onClick={() => navigate('/admin/talent-search')}
              >
                <i className="fa fa-search"></i> Talent Search & Analytics
              </button>
            </div>
          </div>

          <div className="analytics-metrics-row">
            <div className="analytics-metric-card">
              <h4>Total Skill Claims</h4>
              <div className="analytics-metric-val">
                {loadingSkillOverview ? '—' : skillOverview?.totalClaims ?? 0}
              </div>
            </div>

            <div className="analytics-metric-card">
              <h4>Verified Competencies</h4>
              <div className="analytics-metric-val" style={{ color: '#16a34a' }}>
                {loadingSkillOverview ? '—' : skillOverview?.verifiedClaims ?? 0}
              </div>
            </div>

            <div className="analytics-metric-card">
              <h4>Faculty Approval Rate</h4>
              <div className="analytics-metric-val" style={{ color: '#4f46e5' }}>
                {loadingSkillOverview ? '—' : `${skillOverview?.approvalRate ?? 0}%`}
              </div>
            </div>

            <div className="analytics-metric-card">
              <h4>Pending Faculty Review</h4>
              <div className="analytics-metric-val" style={{ color: '#d97706' }}>
                {loadingSkillOverview ? '—' : skillOverview?.pendingClaims ?? 0}
              </div>
            </div>
          </div>

          {/* Quick Nav Pills */}
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginTop: '14px' }}>
            <button
              type="button"
              className="skill-filter-tab"
              onClick={() => navigate('/admin/talent-search')}
            >
              <i className="fa fa-briefcase" style={{ color: '#6366f1' }}></i> Match Students to Job Roles
            </button>
            <button
              type="button"
              className="skill-filter-tab"
              onClick={() => navigate('/admin/skills')}
            >
              <i className="fa fa-award" style={{ color: '#10b981' }}></i> Manage Skills Catalogue
            </button>
            <button
              type="button"
              className="skill-filter-tab"
              onClick={() => navigate('/admin/job-roles')}
            >
              <i className="fa fa-layer-group" style={{ color: '#f59e0b' }}></i> Configure Industry Career Roles
            </button>
          </div>
        </section>

        {/* Recent Projects */}
        <section className="admin-section">
          <div className="admin-section-header">
            <div>
              <h2>Recent Engineering Projects</h2>
              <p>Projects created or updated recently with live team participation.</p>
            </div>
          </div>

          {loadingRecentProjects ? (
            <div className="admin-empty-state">
              <h3>Loading projects...</h3>
              <p>Please wait while recent projects are being loaded.</p>
            </div>
          ) : recentProjects.length === 0 ? (
            <div className="admin-empty-state">
              <h3>No projects available</h3>
              <p>Recently created projects will appear here.</p>
            </div>
          ) : (
            <div className="admin-projects-list">
              {recentProjects.map((project) => {
                const formattedDate = new Date(project.updatedAt).toLocaleDateString('en-IN', {
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric',
                });

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
                        <h3>{project.title}</h3>
                        <p>{project.description}</p>
                        <span>Updated {formattedDate}</span>
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

                      <span className={`admin-project-status ${project.status.toLowerCase()}`}>
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
