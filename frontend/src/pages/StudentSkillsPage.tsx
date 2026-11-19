import { useEffect, useState, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import NotificationBell from '../components/NotificationBell';
import { API_BASE_URL as API_BASE } from '../config/api';
import '../auth.css';

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

const StudentSkillsPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const userData = localStorage.getItem('user');
  const user = userData ? JSON.parse(userData) : null;

  const [projects, setProjects] = useState<Project[]>([]);
  const [, setLoadingProjects] = useState(true);

  const [submittedSkills, setSubmittedSkills] = useState<SubmittedSkill[]>([]);
  const [verifiedSkills, setVerifiedSkills] = useState<SubmittedSkill[]>([]);
  const [pendingSkills, setPendingSkills] = useState<SubmittedSkill[]>([]);
  const [rejectedSkills, setRejectedSkills] = useState<SubmittedSkill[]>([]);
  const [exposureSkills, setExposureSkills] = useState<ExposureSkill[]>([]);
  const [skillFilterTab, setSkillFilterTab] = useState<'all' | 'verified' | 'pending' | 'rejected' | 'exposure'>('all');
  const [loadingSkills, setLoadingSkills] = useState(true);

  // Multi-Project Evidence Skill Claim Modal State
  const [showClaimModal, setShowClaimModal] = useState(false);
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
    fetchProjects();
    fetchSkills();
  }, []);

  // Check if opened with ?claim=true
  useEffect(() => {
    if (searchParams.get('claim') === 'true') {
      openClaimModal();
    }
  }, [searchParams, projects]);

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

  // Common skills present across ALL selected projects (intersection)
  const skillsFromSelectedProjects = useMemo(() => {
    if (selectedProjectIds.length === 0) return [];

    const projectSkillLists = selectedProjectIds.map((pId) => {
      const project = projects.find((p) => p.id === pId);
      const skills: ProjectSkillInfo[] = projectSkillsCache[pId] || project?.skills || [];
      return {
        projectId: pId,
        projectTitle: project?.title || 'Selected Project',
        skills,
      };
    });

    const firstProject = projectSkillLists[0];
    if (!firstProject || firstProject.skills.length === 0) {
      return [];
    }

    const commonSkills: Array<{
      id: string;
      name: string;
      category: string | null;
      projectTitles: string[];
    }> = [];

    firstProject.skills.forEach((skill) => {
      const inAllProjects = projectSkillLists.every((p) =>
        p.skills.some((s) => s.id === skill.id)
      );

      if (inAllProjects) {
        commonSkills.push({
          id: skill.id,
          name: skill.name,
          category: skill.category || null,
          projectTitles: projectSkillLists.map((p) => p.projectTitle),
        });
      }
    });

    return commonSkills;
  }, [selectedProjectIds, projectSkillsCache, projects]);

  useEffect(() => {
    const validSkillIds = new Set(skillsFromSelectedProjects.map((s) => s.id));
    setSelectedSkillIds((prev) => prev.filter((id) => validSkillIds.has(id)));
  }, [skillsFromSelectedProjects]);

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
        `Are you sure you want to delete your claim for "${skillName}"?`
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
        throw new Error(resData.message || 'Failed to delete claim.');
      }

      setSubmittedSkills((prev) => prev.filter((item) => item.id !== claimId));
      setPendingSkills((prev) => prev.filter((item) => item.id !== claimId));
      setRejectedSkills((prev) => prev.filter((item) => item.id !== claimId));
    } catch (err) {
      console.error('Error deleting skill claim:', err);
      alert(err instanceof Error ? err.message : 'Failed to delete claim.');
    } finally {
      setDeletingClaimId(null);
    }
  };

  return (
    <div className="student-page">
      <Sidebar activeTab="skills" />

      <main className="student-main">
        {/* Header */}
        <header className="student-header">
          <div>
            <h1>Your Skills & Competencies</h1>
            <p>Academic competencies verified by faculty mentors and mapped from project technologies.</p>
          </div>

          <div className="student-profile" style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <NotificationBell />
            <span>{user?.name || 'Student'}</span>
          </div>
        </header>

        {/* Quick summary stats */}
        <section className="student-stats">
          <div className="student-stat-card">
            <h3>Total Claims</h3>
            <p>{submittedSkills.length}</p>
          </div>

          <div className="student-stat-card">
            <h3>Verified Competencies</h3>
            <p style={{ color: '#10b981' }}>{loadingSkills ? '...' : verifiedSkills.length}</p>
          </div>

          <div className="student-stat-card">
            <h3>Pending Review</h3>
            <p style={{ color: '#f59e0b' }}>{loadingSkills ? '...' : pendingSkills.length}</p>
          </div>

          <div className="student-stat-card">
            <h3>Action Needed</h3>
            <p style={{ color: '#ef4444' }}>{loadingSkills ? '...' : rejectedSkills.length}</p>
          </div>
        </section>

        {/* Digital Passport Prompt Banner */}
        <section
          className="student-section"
          style={{
            background: 'linear-gradient(135deg, #f8fafc 0%, #eef2ff 100%)',
            border: '1.5px solid #c7d2fe',
            padding: '18px 24px',
            borderRadius: '14px',
            marginBottom: '24px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '16px',
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
              <span className="portfolio-badge-official" style={{ background: '#e0e7ff', color: '#4338ca' }}>
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
                  ? `✓ ${verifiedSkills.length} Verified Competencies`
                  : 'Awaiting Faculty Verification'}
              </span>
            </div>
            <p style={{ margin: 0, fontSize: '0.88rem', color: '#475569' }}>
              Verified skills are automatically showcased on your public, shareable Digital Skill Passport.
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
        </section>

        {/* Skills Management Section */}
        <section className="student-section">
          <div className="student-section-header">
            <div>
              <h2>Skill Claims & Verification Lifecycle</h2>
              <p className="skills-section-subtitle">
                Submit claims backed by your project work, track faculty review, or address reviewer feedback.
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
                  {/* Step 1: Select Project Evidence */}
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
                      {selectedProjectIds.length > 1
                        ? 'Showing only common skills shared across ALL selected projects to ensure authentic evidence.'
                        : 'Choose the skill competencies demonstrated in your selected project.'}
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
                            <strong>
                              {selectedProjectIds.length > 1
                                ? 'No common skills across selected projects.'
                                : 'No skills attached to this project yet.'}
                            </strong>
                            <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: '#475569' }}>
                              {selectedProjectIds.length > 1
                                ? 'To claim skills across multiple projects as evidence, they must share common skills. Please add common skills on each project board first, or select projects with shared skills.'
                                : 'Please add skills to the project on the project board first to claim skills.'}
                            </p>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Step 3: Proficiency Level */}
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

          {/* Filter Tabs */}
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
              <i className="fa fa-check-circle" style={{ color: '#10b981' }}></i> Verified Profile{' '}
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

          {/* Dynamic Content */}
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
                <p>Add technologies to your projects to automatically detect candidate skills.</p>
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

                      {/* Rejected details & 1-click resubmission + Delete option */}
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
                          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '10px' }}>
                            <button
                              type="button"
                              className="resubmit-claim-btn"
                              onClick={() =>
                                openClaimModal(claim.skillId || claim.id, claim.projects[0]?.id)
                              }
                            >
                              <i className="fa fa-redo"></i> Resubmit with New Evidence
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteClaim(claim.id, claim.name)}
                              disabled={deletingClaimId === claim.id}
                              title="Delete this declined claim"
                              style={{
                                background: '#ffffff',
                                border: '1px solid #fecdd3',
                                color: '#e11d48',
                                padding: '6px 12px',
                                borderRadius: '6px',
                                fontSize: '0.78rem',
                                fontWeight: 600,
                                cursor: 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '5px',
                                transition: 'all 0.15s ease',
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
      </main>
    </div>
  );
};

export default StudentSkillsPage;
