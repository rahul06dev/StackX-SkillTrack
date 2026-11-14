import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import NotificationBell from '../components/NotificationBell';
import { API_BASE_URL } from '../config/api';
import '../auth.css';

interface Project {
  id: string;
  title: string;
  description: string;
  tasks: number;
  members: number;
  status: string;
}

interface FacultyDeadline {
  id: string;
  title: string;
  priority: string;
  dueDate: string;
  projectId: string;
  projectTitle: string;
}

interface FacultyReview {
  id: string;
  title: string;
  description: string | null;
  priority: string;
  dueDate: string | null;
  updatedAt: string;
  projectId: string;
  projectTitle: string;
  columnId: string;
  columnTitle: string;
}

interface PendingSkillVerification {
  id: string;
  level: string;
  verification: string;
  createdAt: string;
  student: {
    id: string;
    name: string;
    email: string;
  };
  skill: {
    id: string;
    name: string;
    category: string | null;
  };
  evidence: Array<{
    id: string;
    title: string;
  }>;
}

interface SupervisionInvitation {
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
  };
}

const FacultyDashboard = () => {
  const navigate = useNavigate();

  const userData = localStorage.getItem('user');
  const user = userData ? JSON.parse(userData) : null;

  const [projects, setProjects] = useState<Project[]>([]);
  const [loadingProjects, setLoadingProjects] = useState(true);

  const [supervisionInvitations, setSupervisionInvitations] = useState<SupervisionInvitation[]>([]);
  const [, setSupervisionLoading] = useState(true);

  const [deadlines, setDeadlines] = useState<FacultyDeadline[]>([]);
  const [deadlinesLoading, setDeadlinesLoading] = useState(true);

  const [reviews, setReviews] = useState<FacultyReview[]>([]);
  const [reviewsLoading, setReviewsLoading] = useState(true);

  interface ReviewModalState {
    type: 'verify' | 'reject';
    claim: PendingSkillVerification;
    level: string;
    feedback: string;
    rejectionReason: string;
  }

  const [pendingSkills, setPendingSkills] = useState<PendingSkillVerification[]>([]);
  const [pendingSkillsLoading, setPendingSkillsLoading] = useState(true);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [verificationFeedback, setVerificationFeedback] = useState<string | null>(null);
  const [reviewModal, setReviewModal] = useState<ReviewModalState | null>(null);

  const fetchProjects = async () => {
    try {
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
        throw new Error('Failed to fetch projects');
      }

      const data: Project[] = await response.json();

      setProjects(data);
    } catch (error) {
      console.error('Failed to load faculty projects:', error);
    } finally {
      setLoadingProjects(false);
    }
  };

  const fetchSupervisionInvitations = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) return;

      const response = await fetch(`${API_BASE_URL}/api/invitations/me?status=PENDING`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) throw new Error('Failed to fetch supervision invitations');
      const data: SupervisionInvitation[] = await response.json();
      setSupervisionInvitations(data.filter((inv) => inv.type === 'FACULTY_GUIDE'));
    } catch (error) {
      console.error('Failed to load supervision invitations:', error);
      setSupervisionInvitations([]);
    } finally {
      setSupervisionLoading(false);
    }
  };

  const handleAcceptSupervision = async (invitationId: string, projectTitle: string) => {
    setActionLoadingId(invitationId);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_BASE_URL}/api/invitations/${invitationId}/accept`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) {
        const errJson = await res.json();
        throw new Error(errJson.message || 'Failed to accept supervision');
      }

      setSupervisionInvitations((prev) => prev.filter((i) => i.id !== invitationId));
      setVerificationFeedback(`Accepted project supervision for "${projectTitle}". You are now assigned as the academic faculty guide.`);
      setTimeout(() => setVerificationFeedback(null), 5000);

      fetchProjects();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to accept supervision');
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleDeclineSupervision = async (invitationId: string) => {
    if (!window.confirm('Are you sure you want to decline this project supervision invitation?')) return;
    setActionLoadingId(invitationId);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_BASE_URL}/api/invitations/${invitationId}/decline`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) throw new Error('Failed to decline invitation');

      setSupervisionInvitations((prev) => prev.filter((i) => i.id !== invitationId));
      setVerificationFeedback('Project supervision invitation declined.');
      setTimeout(() => setVerificationFeedback(null), 4000);
    } catch (err) {
      alert('Failed to decline invitation');
    } finally {
      setActionLoadingId(null);
    }
  };

  useEffect(() => {
    fetchProjects();
    fetchSupervisionInvitations();
  }, []);

  useEffect(() => {
    const fetchDeadlines = async () => {
      try {
        const token = localStorage.getItem('token');

        if (!token) {
          setDeadlinesLoading(false);
          return;
        }

        const response = await fetch(
          `${API_BASE_URL}/api/projects/faculty/deadlines`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        if (!response.ok) {
          throw new Error('Failed to fetch deadlines');
        }

        const data = await response.json();

        setDeadlines(data);
      } catch (error) {
        console.error('Error fetching faculty deadlines:', error);
        setDeadlines([]);
      } finally {
        setDeadlinesLoading(false);
      }
    };

    fetchDeadlines();
  }, []);

  useEffect(() => {
    const fetchReviews = async () => {
      try {
        const token = localStorage.getItem('token');

        if (!token) {
          setReviewsLoading(false);
          return;
        }

        const response = await fetch(
          `${API_BASE_URL}/api/tasks/faculty/reviews`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        if (!response.ok) {
          throw new Error('Failed to fetch pending reviews');
        }

        const data: FacultyReview[] = await response.json();

        setReviews(data);
      } catch (error) {
        console.error(
          'Error fetching faculty reviews:',
          error
        );

        setReviews([]);
      } finally {
        setReviewsLoading(false);
      }
    };

    fetchReviews();
  }, []);

  useEffect(() => {
    const fetchPendingSkills = async () => {
      try {
        const token = localStorage.getItem('token');

        if (!token) {
          setPendingSkillsLoading(false);
          return;
        }

        const response = await fetch(
          `${API_BASE_URL}/api/student-skills/pending`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        if (!response.ok) {
          throw new Error('Failed to fetch pending skill claims');
        }

        const data: PendingSkillVerification[] = await response.json();
        setPendingSkills(data);
      } catch (error) {
        console.error('Error fetching pending skill claims:', error);
        setPendingSkills([]);
      } finally {
        setPendingSkillsLoading(false);
      }
    };

    fetchPendingSkills();
  }, []);

  const openVerifyModal = (claim: PendingSkillVerification) => {
    setReviewModal({
      type: 'verify',
      claim,
      level: claim.level || 'INTERMEDIATE',
      feedback: '',
      rejectionReason: '',
    });
  };

  const openRejectModal = (claim: PendingSkillVerification) => {
    setReviewModal({
      type: 'reject',
      claim,
      level: claim.level || 'INTERMEDIATE',
      feedback: '',
      rejectionReason: 'Inadequate evidence in project tasks',
    });
  };

  const handleSubmitReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reviewModal) return;

    const { type, claim, level, feedback, rejectionReason } = reviewModal;
    setActionLoadingId(claim.id);

    try {
      const token = localStorage.getItem('token');
      const endpoint =
        type === 'verify'
          ? `${API_BASE_URL}/api/student-skills/${claim.id}/verify`
          : `${API_BASE_URL}/api/student-skills/${claim.id}/reject`;

      const payload =
        type === 'verify'
          ? { level, feedback: feedback.trim() || undefined }
          : {
              rejectionReason: rejectionReason.trim(),
              feedback: feedback.trim() || undefined,
            };

      const res = await fetch(endpoint, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || `Failed to ${type} skill claim`);
      }

      setPendingSkills((prev) => prev.filter((item) => item.id !== claim.id));
      setVerificationFeedback(
        type === 'verify'
          ? `✓ Verified competency in "${claim.skill.name}" for ${claim.student.name} at level ${level}.`
          : `Declined claim for "${claim.skill.name}". Feedback sent to ${claim.student.name}.`
      );
      setReviewModal(null);
      setTimeout(() => setVerificationFeedback(null), 5000);
    } catch (err) {
      console.error(`Error during skill ${type}:`, err);
      alert(err instanceof Error ? err.message : `Failed to ${type} skill claim.`);
    } finally {
      setActionLoadingId(null);
    }
  };

  const activeProjects = projects.filter(
    (project) => project.status !== 'COMPLETED'
  );

  const completedProjects = projects.filter(
    (project) => project.status === 'COMPLETED'
  );

  return (
    <div className="faculty-page">

      {/* Shared Sidebar */}
      <Sidebar activeTab="dashboard" />

      {/* Main Content */}
      <main className="faculty-main">

        {/* Header */}
        <header className="faculty-header">
          <div>
            <h1>
              Welcome back, {user?.name || 'Faculty'}!
            </h1>

            <p>
              Review student projects, verify competencies, track progress, and provide feedback.
            </p>
          </div>

          <div className="faculty-profile" style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <NotificationBell />
            <span>{user?.name || 'Faculty'}</span>
          </div>
        </header>

        {verificationFeedback && (
          <div className="faculty-feedback-toast">
            <i className="fa fa-check-circle"></i>
            <span>{verificationFeedback}</span>
          </div>
        )}

        {/* Statistics */}
        <section className="faculty-stats">

          <div className="faculty-stat-card">
            <h3>Supervised Projects</h3>
            <p>{projects.length}</p>
          </div>

          <div className="faculty-stat-card">
            <h3>Active Projects</h3>
            <p>{activeProjects.length}</p>
          </div>

          <div className="faculty-stat-card">
            <h3>Completed</h3>
            <p>{completedProjects.length}</p>
          </div>

          <div className="faculty-stat-card">
            <h3>Pending Tasks</h3>
            <p>{reviews.length}</p>
          </div>

          <div className="faculty-stat-card faculty-stat-highlight">
            <h3>Skill Approvals</h3>
            <p>{pendingSkills.length}</p>
          </div>

          {supervisionInvitations.length > 0 && (
            <div className="faculty-stat-card" style={{ borderLeft: '4px solid #f59e0b', background: '#fffbeb' }}>
              <h3>Guide Requests</h3>
              <p style={{ color: '#d97706' }}>{supervisionInvitations.length} Pending</p>
            </div>
          )}

        </section>

        {/* Project Supervision Invitations (Phase 2 Student-led Guidance Requests) */}
        {supervisionInvitations.length > 0 && (
          <section className="faculty-section invitation-highlight-section">
            <div className="faculty-section-header">
              <div>
                <h2>
                  <i className="fa fa-user-tie" style={{ marginRight: '8px', color: '#d97706' }}></i>
                  Project Supervision Invitations ({supervisionInvitations.length})
                </h2>
                <p className="faculty-section-subtitle">
                  Student teams have invited you to supervise their academic project and provide mentor oversight.
                </p>
              </div>
              <span className="faculty-pending-badge" style={{ background: '#fef3c7', color: '#92400e', border: '1px solid #fde68a' }}>
                {supervisionInvitations.length} Pending
              </span>
            </div>

            <div className="invitations-cards-grid">
              {supervisionInvitations.map((inv) => (
                <div key={inv.id} className="invitation-card" style={{ borderLeft: '4px solid #f59e0b' }}>
                  <div className="invitation-card-header">
                    <h3>{inv.project.title}</h3>
                    <span className="invitation-badge faculty">Supervision Request</span>
                  </div>

                  <p className="invitation-description">
                    {inv.project.description}
                  </p>

                  <div className="invitation-meta">
                    <span>
                      <strong>Student Lead:</strong> {inv.invitedBy.name} ({inv.invitedBy.email})
                    </span>
                    {inv.message && (
                      <p className="invitation-note">"{inv.message}"</p>
                    )}
                    <span className="invitation-date">
                      <i className="fa fa-clock"></i> Requested {new Date(inv.createdAt).toLocaleDateString()}
                    </span>
                  </div>

                  <div className="invitation-actions">
                    <button
                      type="button"
                      className="invitation-accept-btn"
                      onClick={() => handleAcceptSupervision(inv.id, inv.project.title)}
                      disabled={actionLoadingId === inv.id}
                      style={{ background: '#d97706' }}
                    >
                      {actionLoadingId === inv.id ? (
                        <>
                          <i className="fa fa-spinner fa-spin"></i> Confirming...
                        </>
                      ) : (
                        <>
                          <i className="fa fa-check"></i> Accept Supervision
                        </>
                      )}
                    </button>
                    <button
                      type="button"
                      className="invitation-decline-btn"
                      onClick={() => handleDeclineSupervision(inv.id)}
                      disabled={actionLoadingId === inv.id}
                    >
                      ✕ Decline
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Skill Verification Requests (Paper Core Mechanism) */}
        <section className="faculty-section">
          <div className="faculty-section-header">
            <div>
              <h2>Skill Verification Requests (Faculty Oversight)</h2>
              <p className="faculty-section-subtitle">
                Student-submitted skill claims awaiting faculty guide verification backed by project evidence.
              </p>
            </div>
            <span className="faculty-pending-badge">
              {pendingSkills.length} Pending
            </span>
          </div>

          {pendingSkillsLoading ? (
            <div className="faculty-empty-state">
              <p>Loading pending skill verifications...</p>
            </div>
          ) : pendingSkills.length === 0 ? (
            <div className="faculty-empty-state">
              <div style={{ fontSize: '30px', color: '#10b981', marginBottom: '8px' }}>
                <i className="fa fa-clipboard-check"></i>
              </div>
              <h3>No pending skill verifications</h3>
              <p>When students submit skill claims for their projects, they will appear here for your review.</p>
            </div>
          ) : (
            <div className="faculty-skill-verifications-list">
              {pendingSkills.map((claim) => (
                <div key={claim.id} className="faculty-verification-card">
                  <div className="faculty-verification-main">
                    <div className="faculty-verification-icon">
                      <i className="fa fa-user-graduate"></i>
                    </div>

                    <div className="faculty-verification-info">
                      <div className="student-header-row">
                        <h4>{claim.student.name}</h4>
                        <span className="student-email-tag">{claim.student.email}</span>
                      </div>

                      <div className="skill-claim-row">
                        <strong className="skill-claimed-name">{claim.skill.name}</strong>
                        <span className="skill-category-pill">{claim.skill.category || 'General'}</span>
                        <span className="skill-level-pill">{claim.level}</span>
                      </div>

                      {claim.evidence && claim.evidence.length > 0 && (
                        <div className="evidence-projects-row">
                          <small>Project Evidence:</small>
                          {claim.evidence.map((p) => (
                            <span key={p.id} className="evidence-chip">
                              <i className="fa fa-folder-open"></i> {p.title}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="faculty-verification-actions">
                    <button
                      className="btn-verify-skill"
                      onClick={() => openVerifyModal(claim)}
                      disabled={actionLoadingId === claim.id}
                    >
                      <i className="fa fa-check"></i> Approve & Verify
                    </button>
                    <button
                      className="btn-reject-skill"
                      onClick={() => openRejectModal(claim)}
                      disabled={actionLoadingId === claim.id}
                    >
                      <i className="fa fa-times"></i> Reject
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Faculty Review / Verification Modal */}
          {reviewModal && (
            <div className="claim-skill-modal-overlay">
              <div className="claim-skill-modal" style={{ maxWidth: '520px' }}>
                <div className="claim-skill-modal-header">
                  <h3>
                    {reviewModal.type === 'verify' ? (
                      <>
                        <i className="fa fa-certificate" style={{ color: '#10b981', marginRight: '8px' }}></i>
                        Verify Student Competency
                      </>
                    ) : (
                      <>
                        <i className="fa fa-times-circle" style={{ color: '#ef4444', marginRight: '8px' }}></i>
                        Decline Skill Claim
                      </>
                    )}
                  </h3>
                  <button
                    className="claim-skill-modal-close"
                    onClick={() => setReviewModal(null)}
                  >
                    &times;
                  </button>
                </div>

                <form onSubmit={handleSubmitReview}>
                  {/* Context Card */}
                  <div
                    style={{
                      padding: '12px 14px',
                      background: '#f8fafc',
                      borderRadius: '8px',
                      border: '1px solid #e2e8f0',
                      marginBottom: '16px',
                      fontSize: '13px',
                    }}
                  >
                    <div style={{ marginBottom: '6px' }}>
                      <strong>Student:</strong> {reviewModal.claim.student.name} ({reviewModal.claim.student.email})
                    </div>
                    <div style={{ marginBottom: '6px' }}>
                      <strong>Skill:</strong> {reviewModal.claim.skill.name}{' '}
                      <span style={{ color: '#64748b' }}>({reviewModal.claim.skill.category || 'General'})</span>
                    </div>
                    <div>
                      <strong>Evidence:</strong>{' '}
                      {reviewModal.claim.evidence.map((p) => p.title).join(', ') || 'Project Submission'}
                    </div>
                  </div>

                  {reviewModal.type === 'verify' ? (
                    <>
                      <div className="claim-skill-field">
                        <label htmlFor="verify-level-select">Confirmed Proficiency Level</label>
                        <select
                          id="verify-level-select"
                          className="faculty-level-select"
                          value={reviewModal.level}
                          onChange={(e) =>
                            setReviewModal({ ...reviewModal, level: e.target.value })
                          }
                        >
                          <option value="BEGINNER">BEGINNER — Basic Knowledge & Project Foundation</option>
                          <option value="INTERMEDIATE">INTERMEDIATE — Practical Implementation</option>
                          <option value="ADVANCED">ADVANCED — Architecture, Optimization & Quality</option>
                        </select>
                      </div>

                      <div className="claim-skill-field">
                        <label htmlFor="verify-feedback">Mentor Commendation / Remarks (Optional)</label>
                        <textarea
                          id="verify-feedback"
                          className="faculty-feedback-input"
                          rows={3}
                          value={reviewModal.feedback}
                          onChange={(e) =>
                            setReviewModal({ ...reviewModal, feedback: e.target.value })
                          }
                          placeholder="e.g. Demonstrated solid API integration and clean error handling in this project."
                        />
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="claim-skill-field">
                        <label htmlFor="reject-reason-select">Rejection Reason *</label>
                        <select
                          id="reject-reason-select"
                          className="faculty-level-select"
                          value={reviewModal.rejectionReason}
                          onChange={(e) =>
                            setReviewModal({ ...reviewModal, rejectionReason: e.target.value })
                          }
                          required
                        >
                          <option value="Inadequate evidence in project tasks">Inadequate evidence in project tasks</option>
                          <option value="Code commits or contributions do not reflect this skill yet">Code commits do not reflect this skill yet</option>
                          <option value="Skill level claimed exceeds current project demonstration">Skill level claimed exceeds current project demonstration</option>
                          <option value="Requires additional task completion before verification">Requires additional task completion before verification</option>
                        </select>
                      </div>

                      <div className="claim-skill-field">
                        <label htmlFor="reject-feedback">Constructive Feedback / Next Steps *</label>
                        <textarea
                          id="reject-feedback"
                          className="faculty-feedback-input"
                          rows={3}
                          value={reviewModal.feedback}
                          onChange={(e) =>
                            setReviewModal({ ...reviewModal, feedback: e.target.value })
                          }
                          placeholder="Provide actionable guidance so the student can resubmit with proper evidence..."
                          required
                        />
                      </div>
                    </>
                  )}

                  <div className="claim-skill-modal-actions" style={{ marginTop: '20px' }}>
                    <button
                      type="button"
                      className="claim-skill-cancel-btn"
                      onClick={() => setReviewModal(null)}
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className={reviewModal.type === 'verify' ? 'student-primary-button' : 'btn-reject-skill'}
                      style={{
                        padding: '10px 18px',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        fontWeight: 600,
                      }}
                      disabled={actionLoadingId === reviewModal.claim.id}
                    >
                      {actionLoadingId === reviewModal.claim.id ? (
                        <i className="fa fa-spinner fa-spin"></i>
                      ) : reviewModal.type === 'verify' ? (
                        '✓ Confirm Verification'
                      ) : (
                        '✕ Decline Claim'
                      )}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </section>

        {/* Supervised Projects */}
        <section className="faculty-section">

          <div className="faculty-section-header">
            <h2>Supervised Projects</h2>

            <button
              className="student-primary-button"
              onClick={() => navigate('/projects?create=true')}
            >
              + New Project
            </button>
          </div>

          {loadingProjects ? (
            <div className="faculty-empty-state">
              <h3>Loading projects...</h3>

              <p>
                Please wait while your projects are being loaded.
              </p>
            </div>
          ) : projects.length === 0 ? (
            <div className="faculty-empty-state">
              <div style={{ fontSize: '30px', color: '#9ca3af', marginBottom: '8px' }}>
                <i className="fa fa-folder-open"></i>
              </div>
              <h3>No projects assigned yet</h3>

              <p>
                Projects assigned to you for supervision will appear here.
              </p>
            </div>
          ) : (
            <div className="faculty-projects-list">

              {projects.map((project) => (
                <div
                  key={project.id}
                  className="faculty-project-card"
                  onClick={() => navigate(`/projects/${project.id}`)}
                >
                  <div className="faculty-project-card-header">
                    <h3>{project.title}</h3>

                    <span
                      className={
                        project.status === 'COMPLETED'
                          ? 'faculty-status completed'
                          : 'faculty-status active'
                      }
                    >
                      {project.status === 'COMPLETED'
                        ? 'Completed'
                        : 'Active'}
                    </span>
                  </div>

                  <p>{project.description}</p>

                  <div className="faculty-project-meta">
                    <span>
                      Tasks <strong>{project.tasks}</strong>
                    </span>

                    <span>
                      Members <strong>{project.members}</strong>
                    </span>
                  </div>
                </div>
              ))}

            </div>
          )}

        </section>

        {/* Reviews Pending */}
        <section className="faculty-section">

          <div className="faculty-section-header">
            <h2>Task Reviews Pending</h2>
          </div>

          {reviewsLoading ? (
            <div className="faculty-empty-state">
              <p>Loading pending reviews...</p>
            </div>
          ) : reviews.length === 0 ? (
            <div className="faculty-empty-state">
              <h3>No task reviews pending</h3>

              <p>
                Tasks submitted by students for review will appear here.
              </p>
            </div>
          ) : (
            <div className="faculty-reviews-list">

              {reviews.map((review) => (
                <div
                  key={review.id}
                  className="faculty-review-card"
                  onClick={() =>
                    navigate(
                      `/projects/${review.projectId}?task=${review.id}`
                    )
                  }
                >
                  <div className="faculty-review-main">

                    <div className="faculty-review-icon">
                      <i className="fa fa-clipboard-check"></i>
                    </div>

                    <div className="faculty-review-info">
                      <h3>{review.title}</h3>

                      <p>{review.projectTitle}</p>

                      <span className="faculty-review-submitted">
                        Submitted for review
                      </span>
                    </div>

                  </div>

                  <div className="faculty-review-right">

                    <span
                      className={`faculty-review-priority ${review.priority.toLowerCase()}`}
                    >
                      {review.priority}
                    </span>

                    <span className="faculty-review-status">
                      In Review
                    </span>

                    <span className="faculty-review-action">
                      Review Task
                      <i className="fa fa-arrow-right"></i>
                    </span>

                  </div>

                </div>
              ))}

            </div>
          )}

        </section>

        {/* Upcoming Deadlines */}
        <section className="faculty-section">

          <div className="faculty-section-header">
            <h2>Upcoming Deadlines</h2>
          </div>

          {deadlinesLoading ? (
            <div className="faculty-empty-state">
              <p>Loading deadlines...</p>
            </div>
          ) : deadlines.length === 0 ? (
            <div className="faculty-empty-state">
              <p>No upcoming deadlines.</p>
            </div>
          ) : (
            <div className="faculty-deadlines-list">
              {deadlines.map((deadline) => (
                <div
                  key={deadline.id}
                  className="faculty-deadline-card"
                  onClick={() => navigate(`/projects/${deadline.projectId}`)}
                >
                  <div className="faculty-deadline-info">
                    <h4>{deadline.title}</h4>
                    <p>{deadline.projectTitle}</p>
                  </div>

                  <div className="faculty-deadline-right">
                    <span
                      className={`faculty-deadline-priority ${deadline.priority.toLowerCase()}`}
                    >
                      {deadline.priority}
                    </span>

                    <span className="faculty-deadline-date">
                      {new Date(deadline.dueDate).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}

        </section>

      </main>

    </div>
  );
};

export default FacultyDashboard;
