import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import NotificationBell from '../components/NotificationBell';
import { API_BASE_URL as API_BASE } from '../config/api';
import '../auth.css';

const StudentDashboard = () => {
  const navigate = useNavigate();

  const userData = localStorage.getItem('user');
  const user = userData ? JSON.parse(userData) : null;

  interface Project {
    id: string;
    title: string;
    description: string;
    tasks: number;
    members: number;
    status: string;
    createdById?: string | null;
    assignedFaculty?: {
      id: string;
      name: string;
      email: string;
    } | null;
  }

  interface NewTask {
    id: string;
    title: string;
    description: string | null;
    priority: string;
    dueDate: string | null;
    projectId: string;
    projectTitle: string;
    columnId: string;
    columnTitle: string;
  }

  interface UpcomingDeadline {
    id: string;
    title: string;
    description: string | null;
    priority: string;
    dueDate: string;
    projectId: string;
    projectTitle: string;
    columnId: string;
    columnTitle: string;
  }

  interface SkillProject {
    id: string;
    title: string;
    status: string;
  }

  interface SubmittedSkill {
    id: string;
    skillId?: string;
    name: string;
    category: string | null;
    description: string | null;
    level: string;
    verification: string;
    rejectionReason?: string | null;
    feedback?: string | null;
    verifiedAt?: string | null;
    verifiedBy?: {
      id: string;
      name: string;
      email: string;
    } | null;
    projects: SkillProject[];
  }

  interface ExposureSkill {
    id: string;
    name: string;
    category: string | null;
    description: string | null;
    projects: SkillProject[];
  }

  interface AvailableSkill {
    id: string;
    name: string;
    category: string | null;
    isActive: boolean;
  }

  interface TeamInvitation {
    id: string;
    projectId: string;
    type: string;
    status: string;
    message: string | null;
    createdAt: string;
    project: {
      id: string;
      title: string;
      description: string;
      createdBy?: {
        id: string;
        name: string;
        email: string;
      };
    };
    invitedBy: {
      id: string;
      name: string;
      email: string;
      role: string;
    };
  }

  const [projects, setProjects] = useState<Project[]>([]);
  const [loadingProjects, setLoadingProjects] = useState(true);

  const [invitations, setInvitations] = useState<TeamInvitation[]>([]);
  const [, setLoadingInvitations] = useState(true);
  const [invitationFeedback, setInvitationFeedback] = useState<string | null>(null);
  const [invitationActionId, setInvitationActionId] = useState<string | null>(null);

  const [newTasks, setNewTasks] = useState<NewTask[]>([]);
  const [loadingNewTasks, setLoadingNewTasks] = useState(true);

  const [upcomingDeadlines, setUpcomingDeadlines] =
    useState<UpcomingDeadline[]>([]);

  const [loadingDeadlines, setLoadingDeadlines] =
    useState(true);

  const [submittedSkills, setSubmittedSkills] = useState<SubmittedSkill[]>([]);
  const [verifiedSkills, setVerifiedSkills] = useState<SubmittedSkill[]>([]);
  const [pendingSkills, setPendingSkills] = useState<SubmittedSkill[]>([]);
  const [rejectedSkills, setRejectedSkills] = useState<SubmittedSkill[]>([]);
  const [exposureSkills, setExposureSkills] = useState<ExposureSkill[]>([]);
  const [skillFilterTab, setSkillFilterTab] = useState<'all' | 'verified' | 'pending' | 'rejected' | 'exposure'>('all');
  const [loadingSkills, setLoadingSkills] = useState(true);

  // Claim skill modal state
  const [showClaimModal, setShowClaimModal] = useState(false);
  const [availableSkills, setAvailableSkills] = useState<AvailableSkill[]>([]);
  const [claimSkillId, setClaimSkillId] = useState('');
  const [claimProjectId, setClaimProjectId] = useState('');
  const [claimLevel, setClaimLevel] = useState('INTERMEDIATE');
  const [claimLoading, setClaimLoading] = useState(false);
  const [claimMessage, setClaimMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const fetchProjects = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) throw new Error('Authentication token not found');

      const response = await fetch(`${API_BASE}/api/projects`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) throw new Error('Failed to fetch projects');
      const data: Project[] = await response.json();
      setProjects(data);
    } catch (error) {
      console.error('Failed to load student projects:', error);
    } finally {
      setLoadingProjects(false);
    }
  };

  const fetchInvitations = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) throw new Error('Authentication token not found');

      const response = await fetch(`${API_BASE}/api/invitations/me?status=PENDING`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) throw new Error('Failed to fetch invitations');
      const data: TeamInvitation[] = await response.json();
      setInvitations(data.filter((inv) => inv.type === 'TEAM_MEMBER'));
    } catch (error) {
      console.error('Failed to load team invitations:', error);
      setInvitations([]);
    } finally {
      setLoadingInvitations(false);
    }
  };

  const handleAcceptInvitation = async (invitationId: string, projectTitle: string) => {
    setInvitationActionId(invitationId);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_BASE}/api/invitations/${invitationId}/accept`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) {
        const errJson = await res.json();
        throw new Error(errJson.message || 'Failed to accept invitation');
      }

      setInvitations((prev) => prev.filter((i) => i.id !== invitationId));
      setInvitationFeedback(`Successfully joined "${projectTitle}"! The project is now added to your dashboard.`);
      setTimeout(() => setInvitationFeedback(null), 5000);

      fetchProjects();
      fetchSkills();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to accept invitation');
    } finally {
      setInvitationActionId(null);
    }
  };

  const handleDeclineInvitation = async (invitationId: string) => {
    if (!window.confirm('Are you sure you want to decline this team invitation?')) return;
    setInvitationActionId(invitationId);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_BASE}/api/invitations/${invitationId}/decline`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) throw new Error('Failed to decline invitation');

      setInvitations((prev) => prev.filter((i) => i.id !== invitationId));
      setInvitationFeedback('Team invitation declined.');
      setTimeout(() => setInvitationFeedback(null), 4000);
    } catch (err) {
      alert('Failed to decline invitation');
    } finally {
      setInvitationActionId(null);
    }
  };

  useEffect(() => {
    fetchProjects();
    fetchInvitations();
  }, []);

  useEffect(() => {
    const fetchNewTasks = async () => {
      try {
        const token = localStorage.getItem('token');
        if (!token) throw new Error('Authentication token not found');

        const response = await fetch(`${API_BASE}/api/tasks/student/new`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (!response.ok) throw new Error('Failed to fetch new tasks');
        const data: NewTask[] = await response.json();
        setNewTasks(data);
      } catch (error) {
        console.error('Failed to load student new tasks:', error);
        setNewTasks([]);
      } finally {
        setLoadingNewTasks(false);
      }
    };

    fetchNewTasks();
  }, []);

  useEffect(() => {
    const fetchUpcomingDeadlines = async () => {
      try {
        const token = localStorage.getItem('token');
        if (!token) throw new Error('Authentication token not found');

        const response = await fetch(`${API_BASE}/api/tasks/student/deadlines`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (!response.ok) throw new Error('Failed to fetch upcoming deadlines');
        const data: UpcomingDeadline[] = await response.json();
        setUpcomingDeadlines(data);
      } catch (error) {
        console.error('Failed to load upcoming deadlines:', error);
        setUpcomingDeadlines([]);
      } finally {
        setLoadingDeadlines(false);
      }
    };

    fetchUpcomingDeadlines();
  }, []);

  const fetchSkills = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) throw new Error('Authentication token not found');

      const response = await fetch(`${API_BASE}/api/student-skills/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) throw new Error('Failed to fetch student skills');
      const data = await response.json();
      setSubmittedSkills(data.submittedSkills ?? []);
      setVerifiedSkills(data.verifiedSkills ?? []);
      setPendingSkills(data.pendingSkills ?? []);
      setRejectedSkills(data.rejectedSkills ?? []);
      setExposureSkills(data.exposureSkills ?? []);
    } catch (error) {
      console.error('Failed to load student skills:', error);
      setSubmittedSkills([]);
      setVerifiedSkills([]);
      setPendingSkills([]);
      setRejectedSkills([]);
      setExposureSkills([]);
    } finally {
      setLoadingSkills(false);
    }
  };

  useEffect(() => {
    fetchSkills();
  }, []);

  const openClaimModal = async (prefillSkillId = '', prefillProjectId = '') => {
    setShowClaimModal(true);
    setClaimMessage(null);
    setClaimSkillId(prefillSkillId);
    setClaimProjectId(prefillProjectId || (projects[0]?.id || ''));
    setClaimLevel('INTERMEDIATE');

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE}/api/skills`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) throw new Error('Failed to fetch skills');
      const data: AvailableSkill[] = await response.json();
      setAvailableSkills(data.filter((s) => s.isActive));
    } catch (err) {
      console.error('Error loading skills for claim:', err);
      setAvailableSkills([]);
    }
  };

  const handleClaimSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!claimSkillId || !claimProjectId) {
      setClaimMessage({ type: 'error', text: 'Please select both a skill and a project.' });
      return;
    }
    setClaimLoading(true);
    setClaimMessage(null);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE}/api/student-skills/submit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          skillId: claimSkillId,
          projectId: claimProjectId,
          level: claimLevel,
        }),
      });
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.message || 'Failed to submit skill claim');
      }
      setClaimMessage({ type: 'success', text: 'Skill claimed — pending faculty verification.' });
      setClaimSkillId('');
      setClaimProjectId('');
      fetchSkills();
    } catch (err) {
      setClaimMessage({
        type: 'error',
        text: err instanceof Error ? err.message : 'Failed to submit skill claim.',
      });
    } finally {
      setClaimLoading(false);
    }
  };

  return (
    <div className="student-page">

      {/* Sidebar */}
      <Sidebar activeTab="dashboard" />

      {/* Main Content */}
      <main className="student-main">

        {/* Header */}
        <header className="student-header">
          <div>
            <h1>Welcome back, {user?.name || 'Student'}!</h1>
            <p>Track your projects, skills, and progress from one place.</p>
          </div>

          <div className="student-profile" style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <NotificationBell />
            <span>{user?.name || 'Student'}</span>
          </div>
        </header>

        {invitationFeedback && (
          <div className="faculty-feedback-toast" style={{ background: '#ecfdf5', borderColor: '#a7f3d0', color: '#065f46', marginBottom: '20px' }}>
            <i className="fa fa-check-circle" style={{ color: '#059669' }}></i>
            <span>{invitationFeedback}</span>
          </div>
        )}

        {/* Statistics */}
        <section className="student-stats">

          <div className="student-stat-card">
            <h3>Total Projects</h3>
            <p>{projects.length}</p>
          </div>

          <div className="student-stat-card">
            <h3>Active Projects</h3>
            <p>{projects.filter((p) => p.status !== 'COMPLETED').length}</p>
          </div>

          <div className="student-stat-card">
            <h3>Completed</h3>
            <p>{projects.filter((p) => p.status === 'COMPLETED').length}</p>
          </div>

          <div className="student-stat-card">
            <h3>Verified Competencies</h3>
            <p style={{ color: '#10b981' }}>{loadingSkills ? '...' : verifiedSkills.length}</p>
          </div>

          {invitations.length > 0 && (
            <div className="student-stat-card" style={{ borderLeft: '4px solid #4f46e5', background: '#f5f7ff' }}>
              <h3>Team Invites</h3>
              <p style={{ color: '#4f46e5' }}>{invitations.length} Pending</p>
            </div>
          )}

        </section>

        {/* Digital Skill Passport Completion & Readiness Banner (Phase 6) */}
        <section
          className="student-section"
          style={{
            background: 'linear-gradient(135deg, #f8fafc 0%, #eef2ff 100%)',
            border: '1.5px solid #c7d2fe',
            padding: '20px 24px',
            borderRadius: '14px',
            marginBottom: '24px',
          }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '16px',
            }}
          >
            <div style={{ maxWidth: '620px' }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  marginBottom: '6px',
                }}
              >
                <span
                  className="portfolio-badge-official"
                  style={{ background: '#e0e7ff', color: '#4338ca' }}
                >
                  <i className="fa fa-id-badge"></i> Academic Skill Passport
                </span>
                <span
                  style={{
                    fontSize: '13px',
                    fontWeight: 700,
                    color: verifiedSkills.length > 0 ? '#059669' : '#d97706',
                  }}
                >
                  {verifiedSkills.length > 0
                    ? `✓ ${verifiedSkills.length} Verified Competencies (Eq. 3-4)`
                    : 'Awaiting Faculty Verification'}
                </span>
              </div>
              <h3
                style={{
                  margin: '0 0 4px 0',
                  fontSize: '1.15rem',
                  color: '#0f172a',
                }}
              >
                Your Certified Digital Placement Passport
              </h3>
              <p style={{ margin: 0, fontSize: '0.88rem', color: '#475569' }}>
                {verifiedSkills.length > 0
                  ? 'Your competencies are verified by faculty supervisors and ready for industry recruiter discovery.'
                  : 'Submit project technologies and request faculty review to earn official placement endorsements.'}
              </p>
            </div>

            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                type="button"
                className="student-primary-button"
                style={{
                  padding: '9px 18px',
                  fontSize: '13px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
                onClick={() => navigate('/student/portfolio')}
              >
                <i className="fa fa-external-link-alt"></i> View Skill Passport
              </button>
            </div>
          </div>
        </section>

        {/* Pending Team Invitations (Phase 2 Student-led Collaboration) */}
        {invitations.length > 0 && (
          <section className="student-section invitation-highlight-section">
            <div className="student-section-header">
              <div>
                <h2>
                  <i className="fa fa-envelope-open-text" style={{ marginRight: '8px', color: '#4f46e5' }}></i>
                  Pending Team Invitations ({invitations.length})
                </h2>
                <p className="skills-section-subtitle">
                  Fellow students have invited you to collaborate on their academic projects. Accept to join their team.
                </p>
              </div>
            </div>

            <div className="invitations-cards-grid">
              {invitations.map((inv) => (
                <div key={inv.id} className="invitation-card">
                  <div className="invitation-card-header">
                    <h3>{inv.project.title}</h3>
                    <span className="invitation-badge">Team Invitation</span>
                  </div>

                  <p className="invitation-description">
                    {inv.project.description}
                  </p>

                  <div className="invitation-meta">
                    <span>
                      <strong>Invited by:</strong> {inv.invitedBy.name} ({inv.invitedBy.email})
                    </span>
                    {inv.message && (
                      <p className="invitation-note">"{inv.message}"</p>
                    )}
                    <span className="invitation-date">
                      <i className="fa fa-clock"></i> Received {new Date(inv.createdAt).toLocaleDateString()}
                    </span>
                  </div>

                  <div className="invitation-actions">
                    <button
                      type="button"
                      className="invitation-accept-btn"
                      onClick={() => handleAcceptInvitation(inv.id, inv.project.title)}
                      disabled={invitationActionId === inv.id}
                    >
                      {invitationActionId === inv.id ? (
                        <>
                          <i className="fa fa-spinner fa-spin"></i> Joining...
                        </>
                      ) : (
                        <>
                          <i className="fa fa-check"></i> Accept & Join Team
                        </>
                      )}
                    </button>
                    <button
                      type="button"
                      className="invitation-decline-btn"
                      onClick={() => handleDeclineInvitation(inv.id)}
                      disabled={invitationActionId === inv.id}
                    >
                      ✕ Decline
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Skills Profile — Equations (3)-(4) Lifecycle */}
        <section className="student-section">
          <div className="student-section-header">
            <div>
              <h2>My Skills & Competencies</h2>
              <p className="skills-section-subtitle">
                Academic competencies verified by faculty mentors and mapped from project technologies.
              </p>
            </div>
            <button className="student-primary-button" onClick={() => openClaimModal()}>
              + Claim a Skill
            </button>
          </div>

          {/* Claim / Resubmit Skill Modal */}
          {showClaimModal && (
            <div className="claim-skill-modal-overlay">
              <div className="claim-skill-modal">
                <div className="claim-skill-modal-header">
                  <h3>Submit Skill Claim for Verification</h3>
                  <button
                    className="claim-skill-modal-close"
                    onClick={() => setShowClaimModal(false)}
                  >
                    &times;
                  </button>
                </div>

                <form onSubmit={handleClaimSubmit}>
                  <div className="claim-skill-field">
                    <label htmlFor="claim-skill-select">Skill Competency *</label>
                    <select
                      id="claim-skill-select"
                      value={claimSkillId}
                      onChange={(e) => setClaimSkillId(e.target.value)}
                      required
                    >
                      <option value="">Select a skill...</option>
                      {availableSkills.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name}{s.category ? ` — ${s.category}` : ''}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="claim-skill-field">
                    <label htmlFor="claim-project-select">Supporting Project Evidence *</label>
                    <select
                      id="claim-project-select"
                      value={claimProjectId}
                      onChange={(e) => setClaimProjectId(e.target.value)}
                      required
                    >
                      <option value="">Select an enrolled project...</option>
                      {projects.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.title}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="claim-skill-field">
                    <label htmlFor="claim-level-select">Claimed Proficiency Level</label>
                    <select
                      id="claim-level-select"
                      value={claimLevel}
                      onChange={(e) => setClaimLevel(e.target.value)}
                    >
                      <option value="BEGINNER">BEGINNER — Basic Knowledge & Coursework</option>
                      <option value="INTERMEDIATE">INTERMEDIATE — Practical Implementation in Project</option>
                      <option value="ADVANCED">ADVANCED — Architecture, Optimization & Production</option>
                    </select>
                  </div>

                  {claimMessage && (
                    <div className={`claim-skill-message ${claimMessage.type}`}>
                      {claimMessage.text}
                    </div>
                  )}

                  <div className="claim-skill-modal-actions">
                    <button
                      type="button"
                      className="claim-skill-cancel-btn"
                      onClick={() => setShowClaimModal(false)}
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="student-primary-button"
                      disabled={claimLoading}
                    >
                      {claimLoading ? 'Submitting...' : 'Submit Claim'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* Filter Tabs for Verification Lifecycle */}
          <div className="skill-filter-tabs">
            <button
              type="button"
              className={`skill-filter-tab ${skillFilterTab === 'all' ? 'active' : ''}`}
              onClick={() => setSkillFilterTab('all')}
            >
              All Claims <span className="skill-filter-tab-count">{submittedSkills.length}</span>
            </button>
            <button
              type="button"
              className={`skill-filter-tab ${skillFilterTab === 'verified' ? 'active' : ''}`}
              onClick={() => setSkillFilterTab('verified')}
            >
              <i className="fa fa-check-circle" style={{ color: '#10b981' }}></i> Verified Profile (Pₛ){' '}
              <span className="skill-filter-tab-count">{verifiedSkills.length}</span>
            </button>
            <button
              type="button"
              className={`skill-filter-tab ${skillFilterTab === 'pending' ? 'active' : ''}`}
              onClick={() => setSkillFilterTab('pending')}
            >
              <i className="fa fa-clock" style={{ color: '#f59e0b' }}></i> Pending Faculty Review{' '}
              <span className="skill-filter-tab-count">{pendingSkills.length}</span>
            </button>
            <button
              type="button"
              className={`skill-filter-tab ${skillFilterTab === 'rejected' ? 'active' : ''}`}
              onClick={() => setSkillFilterTab('rejected')}
            >
              <i className="fa fa-exclamation-triangle" style={{ color: '#ef4444' }}></i> Action Needed{' '}
              <span className="skill-filter-tab-count">{rejectedSkills.length}</span>
            </button>
            <button
              type="button"
              className={`skill-filter-tab ${skillFilterTab === 'exposure' ? 'active' : ''}`}
              onClick={() => setSkillFilterTab('exposure')}
            >
              <i className="fa fa-cubes" style={{ color: '#6366f1' }}></i> Project Exposure{' '}
              <span className="skill-filter-tab-count">{exposureSkills.length}</span>
            </button>
          </div>

          {/* Dynamic Content based on selected tab */}
          {loadingSkills ? (
            <div className="student-empty-state">
              <p>Loading skills and verification records...</p>
            </div>
          ) : skillFilterTab === 'exposure' ? (
            /* PROJECT EXPOSURE TAB */
            exposureSkills.length === 0 ? (
              <div className="student-empty-state">
                <div style={{ fontSize: '30px', color: '#9ca3af', marginBottom: '8px' }}>
                  <i className="fa fa-cubes"></i>
                </div>
                <h3>No project exposure logged yet</h3>
                <p>Add technologies (T) to your projects to automatically detect candidate skills.</p>
              </div>
            ) : (
              <div className="student-skills-grid">
                {exposureSkills.map((item) => (
                  <article className="student-skill-card" key={item.id}>
                    <div className="student-skill-card-top">
                      <div className="student-skill-icon">
                        <i className="fa fa-cubes"></i>
                      </div>
                      <span className="student-skill-category">{item.category || 'Technology'}</span>
                    </div>

                    <h3>{item.name}</h3>

                    <p className="student-skill-description">
                      {item.description || 'Skill detected from project tools & technologies.'}
                    </p>

                    <div className="student-skill-evidence">
                      <strong>Detected in ({item.projects.length}) Project(s)</strong>
                      {item.projects.map((p) => (
                        <div className="student-skill-project" key={p.id}>
                          <div>
                            <i className="fa fa-folder-open"></i>
                            <span>{p.title}</span>
                          </div>
                          <span
                            className={`student-skill-status ${
                              p.status === 'COMPLETED' ? 'completed' : 'active'
                            }`}
                          >
                            {p.status === 'COMPLETED' ? 'Completed' : 'Active'}
                          </span>
                        </div>
                      ))}
                    </div>

                    <button
                      type="button"
                      className="resubmit-claim-btn"
                      style={{ marginTop: '14px', width: '100%', justifyContent: 'center' }}
                      onClick={() => openClaimModal(item.id, item.projects[0]?.id)}
                    >
                      <i className="fa fa-plus-circle"></i> Claim for Verification
                    </button>
                  </article>
                ))}
              </div>
            )
          ) : (
            /* CLAIMS TABS (ALL, VERIFIED, PENDING, REJECTED) */
            (() => {
              const displayed = submittedSkills.filter((s) => {
                if (skillFilterTab === 'verified') return s.verification === 'VERIFIED';
                if (skillFilterTab === 'pending') return s.verification === 'PENDING';
                if (skillFilterTab === 'rejected') return s.verification === 'REJECTED';
                return true;
              });

              if (displayed.length === 0) {
                return (
                  <div className="student-empty-state">
                    <div style={{ fontSize: '30px', color: '#9ca3af', marginBottom: '8px' }}>
                      <i className="fa fa-award"></i>
                    </div>
                    <h3>No claims in this category</h3>
                    <p>
                      {skillFilterTab === 'verified'
                        ? 'No verified skills yet. Verified competencies appear here once approved by your faculty supervisor.'
                        : skillFilterTab === 'pending'
                        ? 'No claims awaiting faculty review at this time.'
                        : skillFilterTab === 'rejected'
                        ? 'No declined claims. Great job!'
                        : 'Use "+ Claim a Skill" to submit competencies for verification.'}
                    </p>
                  </div>
                );
              }

              return (
                <div className="student-skills-grid">
                  {displayed.map((claim) => (
                    <article className="student-skill-card" key={claim.id}>
                      <div className="student-skill-card-top">
                        <div className="student-skill-icon">
                          <i
                            className={
                              claim.verification === 'VERIFIED'
                                ? 'fa fa-certificate'
                                : claim.verification === 'REJECTED'
                                ? 'fa fa-exclamation-circle'
                                : 'fa fa-clock'
                            }
                          ></i>
                        </div>
                        <span className="student-skill-category">
                          {claim.category || 'General'}
                        </span>
                      </div>

                      <h3>{claim.name}</h3>

                      <div className="student-claim-badges">
                        <span
                          className={`student-claim-status-badge ${
                            claim.verification === 'VERIFIED'
                              ? 'verified'
                              : claim.verification === 'REJECTED'
                              ? 'rejected'
                              : 'pending'
                          }`}
                        >
                          {claim.verification === 'VERIFIED'
                            ? '✓ Verified'
                            : claim.verification === 'REJECTED'
                            ? '✕ Declined'
                            : '⏳ Pending Review'}
                        </span>
                        <span className="student-claim-level-badge">{claim.level}</span>
                      </div>

                      <p className="student-skill-description">
                        {claim.description || 'A claimed competency backed by project evidence.'}
                      </p>

                      {/* Verified details */}
                      {claim.verification === 'VERIFIED' && (
                        <div className="skill-verified-meta">
                          <div>
                            <strong>Verified by:</strong> {claim.verifiedBy?.name || 'Faculty Guide'}
                            {claim.verifiedAt && (
                              <span style={{ marginLeft: '6px', color: '#15803d' }}>
                                on {new Date(claim.verifiedAt).toLocaleDateString()}
                              </span>
                            )}
                          </div>
                          {claim.feedback && (
                            <div className="skill-feedback-text">
                              &ldquo;{claim.feedback}&rdquo;
                            </div>
                          )}
                        </div>
                      )}

                      {/* Rejected details & 1-click resubmission */}
                      {claim.verification === 'REJECTED' && (
                        <div className="skill-rejection-note">
                          <div>
                            <strong>Faculty Feedback:</strong>{' '}
                            {claim.rejectionReason || 'Additional evidence required.'}
                          </div>
                          {claim.feedback && (
                            <div style={{ marginTop: '4px', fontStyle: 'italic' }}>
                              &ldquo;{claim.feedback}&rdquo;
                            </div>
                          )}
                          <button
                            type="button"
                            className="resubmit-claim-btn"
                            onClick={() =>
                              openClaimModal(claim.skillId || claim.id, claim.projects[0]?.id)
                            }
                          >
                            <i className="fa fa-redo"></i> Resubmit with New Evidence
                          </button>
                        </div>
                      )}

                      {/* Project evidence */}
                      {claim.projects && claim.projects.length > 0 && (
                        <div className="student-skill-evidence">
                          <strong>Project Evidence ({claim.projects.length})</strong>
                          {claim.projects.map((project) => (
                            <div className="student-skill-project" key={project.id}>
                              <div>
                                <i className="fa fa-folder-open"></i>
                                <span>{project.title}</span>
                              </div>
                              <span
                                className={`student-skill-status ${
                                  project.status === 'COMPLETED' ? 'completed' : 'active'
                                }`}
                              >
                                {project.status === 'COMPLETED' ? 'Completed' : 'Active'}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </article>
                  ))}
                </div>
              );
            })()
          )}
        </section>

        {/* Projects */}
        <section className="student-section">

          <div className="student-section-header">
            <div>
              <h2>My Projects</h2>
              <p className="skills-section-subtitle">
                Academic projects you created or collaborate on.
              </p>
            </div>
            <button
              className="student-primary-button"
              onClick={() => navigate('/projects?create=true')}
            >
              + New Project
            </button>
          </div>

          {loadingProjects ? (
            <div className="student-empty-state">
              <h3>Loading projects...</h3>
              <p>Please wait while your projects are being loaded.</p>
            </div>
          ) : projects.length === 0 ? (
            <div className="student-empty-state">
              <div style={{ fontSize: '32px', color: '#9ca3af', marginBottom: '8px' }}>
                <i className="fa fa-folder-open"></i>
              </div>
              <h3>No projects yet</h3>
              <p>You haven't created or joined any projects yet. Start an academic project or collaborate with peers.</p>
              <button
                type="button"
                className="skilltrack-btn-primary"
                onClick={() => navigate('/projects?create=true')}
                style={{ marginTop: '12px' }}
              >
                <i className="fa fa-plus"></i> Start Your First Project
              </button>
            </div>
          ) : (
            <div className="student-projects-list">
              {projects.map((project) => (
                <div
                  key={project.id}
                  className="student-project-card"
                  onClick={() => navigate(`/projects/${project.id}`)}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '6px' }}>
                    <h3 style={{ margin: 0 }}>{project.title}</h3>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      {project.createdById === user?.id && (
                        <span style={{ fontSize: '11px', fontWeight: 700, background: '#ede9fe', color: '#6d28d9', padding: '2px 8px', borderRadius: '4px' }}>
                          Owner
                        </span>
                      )}
                      <span
                        className={`student-skill-status ${
                          project.status === 'COMPLETED' ? 'completed' : 'active'
                        }`}
                        style={{ fontSize: '11px', padding: '2px 8px' }}
                      >
                        {project.status === 'COMPLETED' ? 'Completed' : 'Active'}
                      </span>
                    </div>
                  </div>

                  <p>{project.description}</p>

                  <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '8px' }}>
                    <i className="fa fa-user-tie" style={{ marginRight: '6px', color: project.assignedFaculty ? '#4f46e5' : '#d97706' }}></i>
                    {project.assignedFaculty ? (
                      <span>Guide: <strong>{project.assignedFaculty.name}</strong></span>
                    ) : (
                      <span style={{ color: '#d97706' }}>Guide: Supervision Invitation Pending</span>
                    )}
                  </div>

                  <div className="student-project-meta">
                    <span>Tasks: {project.tasks}</span>
                    <span>Members: {project.members}</span>
                  </div>
                </div>
              ))}
            </div>
          )}

        </section>

        {/* New Tasks */}
        <section className="student-section">

          <div className="student-section-header">
            <h2>New Tasks</h2>
          </div>

          {loadingNewTasks ? (
            <div className="student-empty-state">
              <h3>Loading new tasks...</h3>
              <p>Please wait while your new tasks are being loaded.</p>
            </div>
          ) : newTasks.length === 0 ? (
            <div className="student-empty-state">
              <h3>No new tasks</h3>
              <p>New tasks assigned to you will appear here.</p>
            </div>
          ) : (
            <div className="student-new-tasks-list">
              {newTasks.map((task) => (
                <div
                  key={task.id}
                  className="student-new-task-card"
                  onClick={() => navigate(`/projects/${task.projectId}?task=${task.id}`)}
                >
                  <div className="student-new-task-main">
                    <div className="student-new-task-icon">
                      <i className="fa fa-tasks"></i>
                    </div>
                    <div className="student-new-task-info">
                      <h3>{task.title}</h3>
                      <p>{task.projectTitle}</p>
                      <span>New task</span>
                    </div>
                  </div>

                  <div className="student-new-task-right">
                    <span className={`student-new-task-priority ${task.priority.toLowerCase()}`}>
                      {task.priority}
                    </span>
                    <span className="student-new-task-status">To Do</span>
                    <span className="student-new-task-action">
                      Open Task
                      <i className="fa fa-arrow-right"></i>
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Upcoming Deadlines */}
        <section className="student-section">
          <div className="student-section-header">
            <h2>Upcoming Deadlines</h2>
          </div>

          {loadingDeadlines ? (
            <div className="student-empty-state">
              <h3>Loading deadlines...</h3>
              <p>Please wait while your upcoming deadlines are being loaded.</p>
            </div>
          ) : upcomingDeadlines.length === 0 ? (
            <div className="student-empty-state">
              <h3>No upcoming deadlines</h3>
              <p>You're all caught up! Tasks with upcoming due dates will appear here.</p>
            </div>
          ) : (
            <div className="student-deadlines-list">
              {upcomingDeadlines.map((task) => {
                const dueDate = new Date(task.dueDate);
                const formattedDate = dueDate.toLocaleDateString('en-IN', {
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric',
                });
                const daysRemaining = Math.ceil(
                  (dueDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
                );

                return (
                  <div
                    key={task.id}
                    className="student-deadline-card"
                    onClick={() => navigate(`/projects/${task.projectId}?task=${task.id}`)}
                  >
                    <div className="student-deadline-main">
                      <div className="student-deadline-icon">
                        <i className="fa fa-calendar-alt"></i>
                      </div>
                      <div className="student-deadline-info">
                        <h3>{task.title}</h3>
                        <p>{task.projectTitle}</p>
                        <span>{task.columnTitle}</span>
                      </div>
                    </div>

                    <div className="student-deadline-right">
                      <span className={`student-deadline-priority ${task.priority.toLowerCase()}`}>
                        {task.priority}
                      </span>
                      <div className="student-deadline-date">
                        <strong>{formattedDate}</strong>
                        <span>
                          {daysRemaining === 0
                            ? 'Due today'
                            : daysRemaining === 1
                            ? 'Due tomorrow'
                            : `Due in ${daysRemaining} days`}
                        </span>
                      </div>
                      <i className="fa fa-arrow-right student-deadline-arrow"></i>
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

export default StudentDashboard;
