import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import NotificationBell from '../components/NotificationBell';
import { API_BASE_URL as API_BASE } from '../config/api';
import '../auth.css';

const StudentDashboard = () => {
  const navigate = useNavigate();

  const userData = localStorage.getItem('user');
  const user = userData ? JSON.parse(userData) : null;

  interface ProjectSkillInfo {
    id: string;
    name: string;
    category?: string | null;
    description?: string | null;
  }

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
    faculty?: Array<{
      id: string;
      name: string;
      email: string;
    }>;
    skills?: ProjectSkillInfo[];
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
  const [projectFilter, setProjectFilter] = useState<'ALL' | 'ACTIVE' | 'COMPLETED'>('ALL');

  const activeProjects = projects.filter((p) => p.status !== 'COMPLETED');
  const completedProjects = projects.filter((p) => p.status === 'COMPLETED');
  const displayedProjects = useMemo(() => {
    if (projectFilter === 'ACTIVE') return activeProjects;
    if (projectFilter === 'COMPLETED') return completedProjects;
    return projects;
  }, [projectFilter, projects, activeProjects, completedProjects]);

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

  // Multi-Project Evidence Skill Claim Modal State
  const [showClaimModal, setShowClaimModal] = useState(false);
  const [availableSkills, setAvailableSkills] = useState<AvailableSkill[]>([]);
  const [selectedProjectIds, setSelectedProjectIds] = useState<string[]>([]);
  const [selectedSkillIds, setSelectedSkillIds] = useState<string[]>([]);
  const [claimLevel, setClaimLevel] = useState<string>('INTERMEDIATE');
  const [claimLoading, setClaimLoading] = useState(false);
  const [claimMessage, setClaimMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [loadingProjectSkills, setLoadingProjectSkills] = useState(false);
  const [projectSkillsCache, setProjectSkillsCache] = useState<Record<string, ProjectSkillInfo[]>>({});
  const [deletingClaimId, setDeletingClaimId] = useState<string | null>(null);

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
    setClaimLevel('INTERMEDIATE');

    let initialProjectIds: string[] = [];
    if (prefillProjectId) {
      initialProjectIds = [prefillProjectId];
    } else if (projects.length > 0) {
      initialProjectIds = [projects[0].id];
    }
    setSelectedProjectIds(initialProjectIds);

    if (prefillSkillId) {
      setSelectedSkillIds([prefillSkillId]);
    } else {
      setSelectedSkillIds([]);
    }

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

    // Populate or fetch project skills for student's projects
    const token = localStorage.getItem('token');
    if (token && projects.length > 0) {
      setLoadingProjectSkills(true);
      try {
        const fetchPromises = projects.map(async (p) => {
          if (p.skills && p.skills.length > 0) {
            return { projectId: p.id, skills: p.skills };
          }
          const res = await fetch(`${API_BASE}/api/project-skills/${p.id}`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (res.ok) {
            const data = await res.json();
            const skillsList = data.map((item: any) => ({
              id: item.skill.id,
              name: item.skill.name,
              category: item.skill.category || null,
              description: item.skill.description || null,
            }));
            return { projectId: p.id, skills: skillsList };
          }
          return { projectId: p.id, skills: [] };
        });

        const results = await Promise.all(fetchPromises);
        const newCache: Record<string, ProjectSkillInfo[]> = {};
        results.forEach((r) => {
          newCache[r.projectId] = r.skills;
        });
        setProjectSkillsCache((prev) => ({ ...prev, ...newCache }));
      } catch (err) {
        console.error('Error fetching project skills for claim modal:', err);
      } finally {
        setLoadingProjectSkills(false);
      }
    }
  };

  // Unique aggregated skills from all selected projects
  const skillsFromSelectedProjects = useMemo(() => {
    const map = new Map<string, { id: string; name: string; category: string | null; projectTitles: string[] }>();

    selectedProjectIds.forEach((pId) => {
      const project = projects.find((p) => p.id === pId);
      const projTitle = project?.title || 'Selected Project';
      const skills = projectSkillsCache[pId] || project?.skills || [];

      skills.forEach((skill) => {
        if (!map.has(skill.id)) {
          map.set(skill.id, {
            id: skill.id,
            name: skill.name,
            category: skill.category || null,
            projectTitles: [projTitle],
          });
        } else {
          const existing = map.get(skill.id)!;
          if (!existing.projectTitles.includes(projTitle)) {
            existing.projectTitles.push(projTitle);
          }
        }
      });
    });

    return Array.from(map.values());
  }, [selectedProjectIds, projectSkillsCache, projects]);

  const toggleProjectSelection = (projectId: string) => {
    setSelectedProjectIds((prev) =>
      prev.includes(projectId)
        ? prev.filter((id) => id !== projectId)
        : [...prev, projectId]
    );
  };

  const toggleSelectAllProjects = () => {
    if (selectedProjectIds.length === projects.length) {
      setSelectedProjectIds([]);
    } else {
      setSelectedProjectIds(projects.map((p) => p.id));
    }
  };

  const toggleSkillSelection = (skillId: string) => {
    setSelectedSkillIds((prev) =>
      prev.includes(skillId)
        ? prev.filter((id) => id !== skillId)
        : [...prev, skillId]
    );
  };

  const toggleSelectAllSkills = () => {
    if (selectedSkillIds.length === skillsFromSelectedProjects.length) {
      setSelectedSkillIds([]);
    } else {
      setSelectedSkillIds(skillsFromSelectedProjects.map((s) => s.id));
    }
  };

  const handleClaimSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedProjectIds.length === 0) {
      setClaimMessage({ type: 'error', text: 'Please select at least one project evidence.' });
      return;
    }
    if (selectedSkillIds.length === 0) {
      setClaimMessage({ type: 'error', text: 'Please select at least one skill to claim.' });
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
          skillIds: selectedSkillIds,
          projectIds: selectedProjectIds,
          level: claimLevel,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || 'Failed to submit skill claim');
      }
      setClaimMessage({
        type: 'success',
        text: `Submitted ${selectedSkillIds.length} skill claim${
          selectedSkillIds.length > 1 ? 's' : ''
        } backed by ${selectedProjectIds.length} project evidence${
          selectedProjectIds.length > 1 ? 's' : ''
        }! Pending faculty guide verification.`,
      });
      setSelectedSkillIds([]);
      fetchSkills();
      setTimeout(() => {
        setShowClaimModal(false);
        setClaimMessage(null);
      }, 2000);
    } catch (err) {
      setClaimMessage({
        type: 'error',
        text: err instanceof Error ? err.message : 'Failed to submit skill claim.',
      });
    } finally {
      setClaimLoading(false);
    }
  };

  const handleDeleteClaim = async (claimId: string, skillName: string) => {
    if (
      !window.confirm(
        `Are you sure you want to cancel and delete your pending claim for "${skillName}"?`
      )
    ) {
      return;
    }

    setDeletingClaimId(claimId);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE}/api/student-skills/${claimId}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const resData = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(resData.message || 'Failed to delete pending claim.');
      }

      setSubmittedSkills((prev) => prev.filter((item) => item.id !== claimId));
      setPendingSkills((prev) => prev.filter((item) => item.id !== claimId));
    } catch (err) {
      console.error('Error deleting skill claim:', err);
      alert(err instanceof Error ? err.message : 'Failed to delete pending claim.');
    } finally {
      setDeletingClaimId(null);
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
            <div className="claim-skill-modal-overlay" onClick={() => setShowClaimModal(false)}>
              <div className="claim-skill-modal" onClick={(e) => e.stopPropagation()}>
                <div className="claim-skill-modal-header">
                  <div>
                    <h3>Submit Skill Claim for Verification</h3>
                    <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: '#64748b' }}>
                      Select project evidence, pick demonstrated skills, and choose your claimed proficiency level.
                    </p>
                  </div>
                  <button
                    className="claim-skill-modal-close"
                    onClick={() => setShowClaimModal(false)}
                    title="Close"
                  >
                    &times;
                  </button>
                </div>

                <form onSubmit={handleClaimSubmit}>
                  {/* Step 1: Select Project Evidence (Multi-select Checkboxes) */}
                  <div className="claim-modal-step">
                    <div className="claim-step-header">
                      <div className="claim-step-title">
                        <span className="claim-step-number">1</span>
                        <span>Select Supporting Project Evidence *</span>
                      </div>
                      {projects.length > 1 && (
                        <button
                          type="button"
                          className="claim-select-all-btn"
                          onClick={toggleSelectAllProjects}
                        >
                          {selectedProjectIds.length === projects.length ? 'Deselect All' : 'Select All'}
                        </button>
                      )}
                    </div>
                    <p className="claim-step-subtitle">
                      Check one or more projects where you applied or demonstrated your skills.
                    </p>

                    {projects.length === 0 ? (
                      <div className="claim-empty-notice">
                        <i className="fa fa-folder-open text-gray-400"></i>
                        <span>You are not enrolled in any projects yet. Create or join a project first.</span>
                      </div>
                    ) : (
                      <div className="claim-projects-grid">
                        {projects.map((p) => {
                          const isSelected = selectedProjectIds.includes(p.id);
                          const pSkills = projectSkillsCache[p.id] || p.skills || [];
                          return (
                            <label
                              key={p.id}
                              className={`claim-project-card ${isSelected ? 'selected' : ''}`}
                            >
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => toggleProjectSelection(p.id)}
                                className="claim-checkbox"
                              />
                              <div className="claim-project-details">
                                <div className="claim-project-title-row">
                                  <span className="claim-project-title">{p.title}</span>
                                  <span className={`claim-project-badge ${p.status.toLowerCase()}`}>
                                    {p.status}
                                  </span>
                                </div>
                                <div className="claim-project-meta">
                                  <span>
                                    <i className="fa fa-award" style={{ marginRight: '4px' }}></i>
                                    {pSkills.length} skill{pSkills.length === 1 ? '' : 's'} attached
                                  </span>
                                  {(p.faculty?.length || p.assignedFaculty) && (
                                    <span>
                                      <i className="fa fa-user-tie" style={{ marginRight: '4px' }}></i>
                                      {p.faculty && p.faculty.length > 0
                                        ? p.faculty.map((f) => f.name).join(', ')
                                        : p.assignedFaculty?.name}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </label>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* Step 2: Skills from Selected Projects */}
                  <div className="claim-modal-step">
                    <div className="claim-step-header">
                      <div className="claim-step-title">
                        <span className="claim-step-number">2</span>
                        <span>Skills from Selected Projects *</span>
                      </div>
                      {skillsFromSelectedProjects.length > 1 && (
                        <button
                          type="button"
                          className="claim-select-all-btn"
                          onClick={toggleSelectAllSkills}
                        >
                          {selectedSkillIds.length === skillsFromSelectedProjects.length ? 'Deselect All' : 'Select All'}
                        </button>
                      )}
                    </div>
                    <p className="claim-step-subtitle">
                      Choose the skill competencies demonstrated across your selected project evidence.
                    </p>

                    {selectedProjectIds.length === 0 ? (
                      <div className="claim-empty-notice info">
                        <i className="fa fa-arrow-up text-purple-600"></i>
                        <span>Select at least one project above to view and select its skills.</span>
                      </div>
                    ) : loadingProjectSkills ? (
                      <div className="claim-empty-notice">
                        <i className="fa fa-spinner fa-spin text-purple-600"></i>
                        <span>Loading project skills...</span>
                      </div>
                    ) : skillsFromSelectedProjects.length > 0 ? (
                      <div className="claim-skills-grid">
                        {skillsFromSelectedProjects.map((skill) => {
                          const isSkillSelected = selectedSkillIds.includes(skill.id);
                          return (
                            <label
                              key={skill.id}
                              className={`claim-skill-card ${isSkillSelected ? 'selected' : ''}`}
                            >
                              <input
                                type="checkbox"
                                checked={isSkillSelected}
                                onChange={() => toggleSkillSelection(skill.id)}
                                className="claim-checkbox"
                              />
                              <div className="claim-skill-card-body">
                                <div className="claim-skill-name-row">
                                  <span className="claim-skill-name">{skill.name}</span>
                                  {skill.category && (
                                    <span className="claim-skill-category-badge">{skill.category}</span>
                                  )}
                                </div>
                                <div className="claim-skill-source">
                                  <i className="fa fa-cube" style={{ marginRight: '4px' }}></i>
                                  From: {skill.projectTitles.join(', ')}
                                </div>
                              </div>
                            </label>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="claim-no-skills-fallback">
                        <div className="claim-empty-notice warning">
                          <i className="fa fa-exclamation-circle text-amber-500"></i>
                          <div>
                            <strong>No skills attached to the selected project(s) yet.</strong>
                            <p style={{ margin: '3px 0 0 0', fontSize: '12px' }}>
                              You can select a skill from the catalogue below, or attach skills directly on the project board.
                            </p>
                          </div>
                        </div>

                        <div className="claim-fallback-select-container">
                          <label htmlFor="fallback-skill-select" style={{ fontSize: '13px', fontWeight: 600 }}>
                            Choose from catalogue:
                          </label>
                          <select
                            id="fallback-skill-select"
                            value={selectedSkillIds[0] || ''}
                            onChange={(e) => {
                              const val = e.target.value;
                              setSelectedSkillIds(val ? [val] : []);
                            }}
                            className="claim-fallback-select"
                          >
                            <option value="">Select a skill...</option>
                            {availableSkills.map((s) => (
                              <option key={s.id} value={s.id}>
                                {s.name}{s.category ? ` — ${s.category}` : ''}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Step 3: Claimed Proficiency Level */}
                  <div className="claim-modal-step">
                    <div className="claim-step-header">
                      <div className="claim-step-title">
                        <span className="claim-step-number">3</span>
                        <span>Claimed Proficiency Level *</span>
                      </div>
                    </div>
                    <p className="claim-step-subtitle">
                      Choose the rigor and depth of competency you are claiming for verification.
                    </p>

                    <div className="claim-levels-grid">
                      {[
                        {
                          level: 'BEGINNER',
                          title: 'BEGINNER',
                          desc: 'Foundational Knowledge & Coursework',
                          icon: 'fa-seedling',
                          color: '#10b981',
                        },
                        {
                          level: 'INTERMEDIATE',
                          title: 'INTERMEDIATE',
                          desc: 'Applied Implementation in Project Code (Recommended)',
                          icon: 'fa-code-branch',
                          color: '#6366f1',
                        },
                        {
                          level: 'ADVANCED',
                          title: 'ADVANCED',
                          desc: 'Architecture, Optimization & Production Rigor',
                          icon: 'fa-layer-group',
                          color: '#8b5cf6',
                        },
                      ].map((item) => {
                        const isLevelSelected = claimLevel === item.level;
                        return (
                          <div
                            key={item.level}
                            className={`claim-level-card ${isLevelSelected ? 'selected' : ''}`}
                            onClick={() => setClaimLevel(item.level)}
                          >
                            <div className="claim-level-card-top">
                              <i className={`fa ${item.icon}`} style={{ color: item.color }}></i>
                              <span className="claim-level-card-title">{item.title}</span>
                              <input
                                type="radio"
                                name="claimLevel"
                                value={item.level}
                                checked={isLevelSelected}
                                onChange={() => setClaimLevel(item.level)}
                                className="claim-radio"
                              />
                            </div>
                            <p className="claim-level-card-desc">{item.desc}</p>
                          </div>
                        );
                      })}
                    </div>
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
                      disabled={claimLoading}
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="student-primary-button"
                      disabled={
                        claimLoading ||
                        selectedProjectIds.length === 0 ||
                        selectedSkillIds.length === 0
                      }
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '8px',
                      }}
                    >
                      {claimLoading && <i className="fa fa-spinner fa-spin"></i>}
                      <span>
                        {claimLoading
                          ? 'Submitting...'
                          : selectedSkillIds.length > 0
                          ? `Submit Claim (${selectedSkillIds.length} Skill${
                              selectedSkillIds.length > 1 ? 's' : ''
                            })`
                          : 'Submit Claim'}
                      </span>
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

                      {/* Pending review status & delete option */}
                      {claim.verification === 'PENDING' && (
                        <div
                          style={{
                            marginTop: '12px',
                            padding: '10px 12px',
                            background: '#fffbeb',
                            border: '1px solid #fef3c7',
                            borderRadius: '8px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            flexWrap: 'wrap',
                            gap: '8px',
                          }}
                        >
                          <div
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '6px',
                              fontSize: '0.78rem',
                              color: '#92400e',
                              fontWeight: 600,
                            }}
                          >
                            <i className="fa fa-clock"></i>
                            <span>Awaiting Faculty Review</span>
                          </div>

                          <button
                            type="button"
                            onClick={() => handleDeleteClaim(claim.id, claim.name)}
                            disabled={deletingClaimId === claim.id}
                            title="Delete this pending claim"
                            style={{
                              background: '#ffffff',
                              border: '1px solid #fecdd3',
                              color: '#e11d48',
                              padding: '5px 10px',
                              borderRadius: '6px',
                              fontSize: '0.75rem',
                              fontWeight: 600,
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '5px',
                              transition: 'all 0.15s ease',
                              boxShadow: '0 1px 2px rgba(225, 29, 72, 0.05)',
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.background = '#fff1f2';
                              e.currentTarget.style.borderColor = '#fda4af';
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.background = '#ffffff';
                              e.currentTarget.style.borderColor = '#fecdd3';
                            }}
                          >
                            <i
                              className={`fa ${
                                deletingClaimId === claim.id
                                  ? 'fa-spinner fa-spin'
                                  : 'fa-trash-alt'
                              }`}
                            ></i>
                            <span>
                              {deletingClaimId === claim.id
                                ? 'Deleting...'
                                : 'Delete Claim'}
                            </span>
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

          <div className="student-section-header" style={{ flexWrap: 'wrap', gap: '12px' }}>
            <div>
              <h2>My Projects</h2>
              <p className="skills-section-subtitle">
                Academic projects you created or collaborate on.
              </p>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
              <div className="dashboard-filter-tabs">
                <button
                  type="button"
                  className={`dashboard-filter-tab ${projectFilter === 'ALL' ? 'active' : ''}`}
                  onClick={() => setProjectFilter('ALL')}
                >
                  All <span className="badge">{projects.length}</span>
                </button>
                <button
                  type="button"
                  className={`dashboard-filter-tab ${projectFilter === 'ACTIVE' ? 'active' : ''}`}
                  onClick={() => setProjectFilter('ACTIVE')}
                >
                  Active <span className="badge">{activeProjects.length}</span>
                </button>
                <button
                  type="button"
                  className={`dashboard-filter-tab ${projectFilter === 'COMPLETED' ? 'active' : ''}`}
                  onClick={() => setProjectFilter('COMPLETED')}
                >
                  Completed <span className="badge">{completedProjects.length}</span>
                </button>
              </div>

              {projectFilter === 'ALL' && (
                <button
                  className="student-primary-button"
                  onClick={() => navigate('/projects?create=true')}
                >
                  + New Project
                </button>
              )}
            </div>
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
          ) : displayedProjects.length === 0 ? (
            <div className="student-empty-state">
              <div style={{ fontSize: '30px', color: '#94a3b8', marginBottom: '8px' }}>
                <i className={projectFilter === 'COMPLETED' ? 'fa fa-check-circle' : 'fa fa-tasks'}></i>
              </div>
              <h3>0 {projectFilter === 'COMPLETED' ? 'Completed' : 'Active'} Projects</h3>
              <p>There are currently 0 {projectFilter.toLowerCase()} projects.</p>
              <button
                type="button"
                className="student-primary-button"
                onClick={() => setProjectFilter('ALL')}
                style={{ marginTop: '10px' }}
              >
                View All Projects ({projects.length})
              </button>
            </div>
          ) : (
            <div className="student-projects-list">
              {displayedProjects.map((project) => (
                <div
                  key={project.id}
                  className="student-project-card"
                  onClick={() => navigate(`/projects/${project.id}`)}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '6px' }}>
                    <h3 style={{ margin: 0 }}>{project.title}</h3>
                    <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                      {project.createdById === user?.id && (
                        <span style={{ fontSize: '11px', fontWeight: 700, background: '#ede9fe', color: '#6d28d9', padding: '2px 8px', borderRadius: '4px' }}>
                          Owner
                        </span>
                      )}
                      <span
                        className={`project-status-pill ${
                          project.status === 'COMPLETED' ? 'completed' : 'active'
                        }`}
                        style={{ fontSize: '11px', padding: '2px 8px' }}
                      >
                        <span className={`status-dot ${project.status === 'COMPLETED' ? 'completed' : 'active'}`}></span>
                        {project.status === 'COMPLETED' ? 'Completed' : 'Active'}
                      </span>
                    </div>
                  </div>

                  <p>{project.description}</p>

                  <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '8px' }}>
                    <i className="fa fa-user-tie" style={{ marginRight: '6px', color: (project.faculty?.length || project.assignedFaculty) ? '#4f46e5' : '#d97706' }}></i>
                    {project.faculty && project.faculty.length > 0 ? (
                      <span>Guide{project.faculty.length > 1 ? 's' : ''}: <strong>{project.faculty.map((f) => f.name).join(', ')}</strong></span>
                    ) : project.assignedFaculty ? (
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
