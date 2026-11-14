import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import { API_BASE_URL as API_BASE } from '../config/api';
import '../auth.css';

interface StudentInfo {
  id: string;
  name: string;
  email: string;
  role?: string;
  headline?: string | null;
  bio?: string | null;
  department?: string | null;
  studentIdNo?: string | null;
  graduationYear?: string | null;
  githubUrl?: string | null;
  linkedinUrl?: string | null;
  shareableSlug?: string | null;
  createdAt?: string;
}

interface CertificateInfo {
  certificateId: string;
  verificationCode: string;
  institution: string;
  issuedAt: string;
  status: string;
}

interface ProjectEvidence {
  id: string;
  title: string;
  status: string;
}

interface VerifiedSkill {
  id: string;
  name: string;
  category: string | null;
  description: string | null;
  level: string;
  verifiedAt: string | null;
  verifiedBy?: {
    id: string;
    name: string;
    email: string;
  } | null;
  feedback?: string | null;
  projects: ProjectEvidence[];
}

interface ProjectSkill {
  id: string;
  name: string;
  category: string | null;
  projects: ProjectEvidence[];
}

interface PortfolioProject {
  id: string;
  title: string;
  description?: string;
  status: string;
  role: string;
  supervisor: string;
  skills: string[];
}

interface PortfolioData {
  student: StudentInfo;
  certificate?: CertificateInfo;
  summary: {
    totalProjectSkills: number;
    totalVerifiedSkills: number;
    totalProjects: number;
  };
  verifiedSkills: VerifiedSkill[];
  projectSkills: ProjectSkill[];
  projects: PortfolioProject[];
}

interface PortfolioPageProps {
  isPublic?: boolean;
}

const PortfolioPage = ({ isPublic = false }: PortfolioPageProps) => {
  const navigate = useNavigate();
  const { studentId } = useParams<{ studentId?: string }>();

  const [data, setData] = useState<PortfolioData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Profile Edit Modal State
  const [showEditModal, setShowEditModal] = useState(false);
  const [editLoading, setEditLoading] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [headline, setHeadline] = useState('');
  const [bio, setBio] = useState('');
  const [department, setDepartment] = useState('');
  const [studentIdNo, setStudentIdNo] = useState('');
  const [graduationYear, setGraduationYear] = useState('');
  const [githubUrl, setGithubUrl] = useState('');
  const [linkedinUrl, setLinkedinUrl] = useState('');
  const [shareableSlug, setShareableSlug] = useState('');

  // Toast State
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const isPublicView = isPublic || !!studentId;

  const fetchPortfolio = async () => {
    try {
      setLoading(true);
      setError(null);

      let url = `${API_BASE}/api/student-skills/portfolio`;
      const headers: Record<string, string> = {};

      if (isPublicView && studentId) {
        url = `${API_BASE}/api/student-skills/public/${studentId}`;
      } else {
        const token = localStorage.getItem('token');
        if (!token) {
          throw new Error('Authentication required to view student portfolio.');
        }
        headers['Authorization'] = `Bearer ${token}`;
      }

      const response = await fetch(url, { headers });

      if (!response.ok) {
        const errJson = await response.json().catch(() => null);
        throw new Error(errJson?.message || 'Failed to load portfolio.');
      }

      const json: PortfolioData = await response.json();
      setData(json);

      // Pre-fill edit modal fields
      if (json.student) {
        setHeadline(json.student.headline || '');
        setBio(json.student.bio || '');
        setDepartment(json.student.department || '');
        setStudentIdNo(json.student.studentIdNo || '');
        setGraduationYear(json.student.graduationYear || '');
        setGithubUrl(json.student.githubUrl || '');
        setLinkedinUrl(json.student.linkedinUrl || '');
        setShareableSlug(json.student.shareableSlug || '');
      }
    } catch (err) {
      console.error('Error loading portfolio:', err);
      setError(err instanceof Error ? err.message : 'Failed to load portfolio.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPortfolio();
  }, [studentId, isPublic]);

  const handlePrint = () => {
    window.print();
  };

  const handleCopyShareLink = () => {
    if (!data) return;
    const identifier = data.student.shareableSlug || data.student.id;
    const shareUrl = `${window.location.origin}/portfolio/${identifier}`;
    navigator.clipboard.writeText(shareUrl);
    setToastMessage('Public Digital Passport link copied to clipboard!');
    setTimeout(() => setToastMessage(null), 4000);
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setEditLoading(true);
    setEditError(null);

    try {
      const token = localStorage.getItem('token');
      if (!token) throw new Error('Authentication required');

      const response = await fetch(`${API_BASE}/api/users/profile`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          headline,
          bio,
          studentIdNo,
          graduationYear,
          githubUrl,
          linkedinUrl,
          shareableSlug: shareableSlug.trim() || undefined,
        }),
      });

      if (!response.ok) {
        const err = await response.json().catch(() => null);
        throw new Error(err?.message || 'Failed to update profile');
      }

      setShowEditModal(false);
      setToastMessage('Profile and Digital Passport details updated!');
      setTimeout(() => setToastMessage(null), 4000);
      fetchPortfolio();
    } catch (err) {
      setEditError(err instanceof Error ? err.message : 'Failed to update profile.');
    } finally {
      setEditLoading(false);
    }
  };

  return (
    <div className={`portfolio-page ${isPublicView ? 'public-view' : ''}`}>
      {/* Sidebar hidden in public view or when printing */}
      {!isPublicView && <Sidebar activeTab="portfolio" />}

      <main className="portfolio-main" style={isPublicView ? { margin: '0 auto', maxWidth: '1000px', padding: '30px 20px' } : undefined}>
        {/* Top Action Bar */}
        <div className="portfolio-action-bar no-print">
          <div>
            <h1>Student Digital Skill Passport & Portfolio</h1>
            <p>Certified academic competencies, project evidence, and verified technical skills.</p>
          </div>
          <div className="portfolio-actions">
            {!isPublicView && (
              <>
                <button className="portfolio-btn-secondary" onClick={() => navigate('/student')}>
                  <i className="fa fa-arrow-left"></i> Dashboard
                </button>
                <button className="portfolio-btn-secondary" onClick={() => setShowEditModal(true)}>
                  <i className="fa fa-user-edit"></i> Edit Profile
                </button>
              </>
            )}
            <button className="portfolio-btn-secondary" onClick={handleCopyShareLink}>
              <i className="fa fa-share-alt"></i> Share Link
            </button>
            <button className="portfolio-btn-primary" onClick={handlePrint}>
              <i className="fa fa-print"></i> Export / Print PDF
            </button>
          </div>
        </div>

        {/* Share Feedback Toast */}
        {toastMessage && (
          <div className="share-copy-toast no-print">
            <i className="fa fa-check-circle" style={{ color: '#10b981', fontSize: '18px' }}></i>
            <span>{toastMessage}</span>
          </div>
        )}

        {/* Edit Profile Modal */}
        {showEditModal && (
          <div className="claim-skill-modal-overlay no-print">
            <div className="claim-skill-modal" style={{ maxWidth: '560px' }}>
              <div className="claim-skill-modal-header">
                <h3>
                  <i className="fa fa-user-edit" style={{ color: '#4f46e5', marginRight: '8px' }}></i>
                  Edit Academic Profile & Passport
                </h3>
                <button className="claim-skill-modal-close" onClick={() => setShowEditModal(false)}>
                  &times;
                </button>
              </div>

              <form onSubmit={handleSaveProfile}>
                <div className="claim-skill-field">
                  <label htmlFor="profile-headline">Professional Headline</label>
                  <input
                    id="profile-headline"
                    type="text"
                    className="faculty-feedback-input"
                    value={headline}
                    onChange={(e) => setHeadline(e.target.value)}
                    placeholder="e.g. Full-Stack Developer & Cloud Systems Enthusiast"
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div className="claim-skill-field">
                    <label htmlFor="profile-dept">
                      Department / Program <span style={{ fontSize: '11px', color: '#64748b' }}>● Locked</span>
                    </label>
                    <div style={{ position: 'relative' }}>
                      <input
                        id="profile-dept"
                        type="text"
                        className="faculty-feedback-input"
                        value={department || 'Not Assigned'}
                        disabled
                        readOnly
                        style={{
                          background: '#f8fafc',
                          color: '#64748b',
                          cursor: 'not-allowed',
                          paddingRight: '36px',
                        }}
                      />
                      <i
                        className="fa fa-lock"
                        style={{
                          position: 'absolute',
                          right: '12px',
                          top: '50%',
                          transform: 'translateY(-50%)',
                          color: '#94a3b8',
                          fontSize: '13px',
                        }}
                        title="Department cannot be edited after registration"
                      ></i>
                    </div>
                  </div>
                  <div className="claim-skill-field">
                    <label htmlFor="profile-roll">Student ID / PRN</label>
                    <input
                      id="profile-roll"
                      type="text"
                      className="faculty-feedback-input"
                      value={studentIdNo}
                      onChange={(e) => setStudentIdNo(e.target.value)}
                      placeholder="e.g. PRN 1032210123"
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div className="claim-skill-field">
                    <label htmlFor="profile-grad">Graduation Year</label>
                    <input
                      id="profile-grad"
                      type="text"
                      className="faculty-feedback-input"
                      value={graduationYear}
                      onChange={(e) => setGraduationYear(e.target.value)}
                      placeholder="e.g. 2026"
                    />
                  </div>
                  <div className="claim-skill-field">
                    <label htmlFor="profile-slug">Public URL Slug (Optional)</label>
                    <input
                      id="profile-slug"
                      type="text"
                      className="faculty-feedback-input"
                      value={shareableSlug}
                      onChange={(e) => setShareableSlug(e.target.value)}
                      placeholder="e.g. sanjeevani-sharma"
                    />
                  </div>
                </div>

                <div className="claim-skill-field">
                  <label htmlFor="profile-bio">About Me / Career Bio</label>
                  <textarea
                    id="profile-bio"
                    className="faculty-feedback-input"
                    rows={3}
                    value={bio}
                    onChange={(e) => setBio(e.target.value)}
                    placeholder="Brief overview of your technical focus, academic achievements, and engineering interests..."
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div className="claim-skill-field">
                    <label htmlFor="profile-github">GitHub Profile URL</label>
                    <input
                      id="profile-github"
                      type="url"
                      className="faculty-feedback-input"
                      value={githubUrl}
                      onChange={(e) => setGithubUrl(e.target.value)}
                      placeholder="https://github.com/username"
                    />
                  </div>
                  <div className="claim-skill-field">
                    <label htmlFor="profile-linkedin">LinkedIn Profile URL</label>
                    <input
                      id="profile-linkedin"
                      type="url"
                      className="faculty-feedback-input"
                      value={linkedinUrl}
                      onChange={(e) => setLinkedinUrl(e.target.value)}
                      placeholder="https://linkedin.com/in/username"
                    />
                  </div>
                </div>

                {editError && (
                  <div className="claim-skill-message error" style={{ marginTop: '10px' }}>
                    {editError}
                  </div>
                )}

                <div className="claim-skill-modal-actions" style={{ marginTop: '18px' }}>
                  <button type="button" className="claim-skill-cancel-btn" onClick={() => setShowEditModal(false)}>
                    Cancel
                  </button>
                  <button type="submit" className="student-primary-button" disabled={editLoading}>
                    {editLoading ? 'Saving...' : 'Save Profile'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {loading ? (
          <div className="portfolio-loading">
            <i className="fa fa-spinner fa-spin"></i>
            <p>Compiling digital skill passport and portfolio evidence...</p>
          </div>
        ) : error ? (
          <div className="portfolio-error">
            <i className="fa fa-exclamation-triangle"></i>
            <p>{error}</p>
          </div>
        ) : data ? (
          <div className="portfolio-document">
            {/* Document Header & Identity */}
            <header className="portfolio-header-container">
              <div className="portfolio-student-identity">
                <div className="portfolio-avatar-large">
                  {data.student.name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <h2 style={{ fontSize: '1.9rem', fontWeight: 800, color: '#0f172a', margin: '0 0 4px 0' }}>
                    {data.student.name}
                  </h2>
                  <p className="portfolio-student-headline">
                    {data.student.headline || 'Software Engineering & Technology Student'}
                  </p>

                  <div className="portfolio-meta-tags">
                    {data.student.department && (
                      <span className="portfolio-meta-tag">
                        <i className="fa fa-graduation-cap"></i> {data.student.department}
                      </span>
                    )}
                    {data.student.studentIdNo && (
                      <span className="portfolio-meta-tag">
                        <i className="fa fa-id-card"></i> {data.student.studentIdNo}
                      </span>
                    )}
                    {data.student.graduationYear && (
                      <span className="portfolio-meta-tag">
                        <i className="fa fa-calendar-alt"></i> Batch of {data.student.graduationYear}
                      </span>
                    )}
                    <span className="portfolio-meta-tag">
                      <i className="fa fa-envelope"></i> {data.student.email}
                    </span>
                  </div>

                  <div className="portfolio-social-links">
                    {data.student.githubUrl && (
                      <a
                        href={data.student.githubUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="portfolio-social-link"
                      >
                        <i className="fab fa-github"></i> GitHub
                      </a>
                    )}
                    {data.student.linkedinUrl && (
                      <a
                        href={data.student.linkedinUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="portfolio-social-link"
                      >
                        <i className="fab fa-linkedin"></i> LinkedIn
                      </a>
                    )}
                  </div>
                </div>
              </div>

              <div className="portfolio-institution">
                <h3>StackX SkillTrack</h3>
                <p>Project-Based Competency System</p>
                <small>Generated: {new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</small>
                <div style={{ marginTop: '8px' }}>
                  <span className="portfolio-badge-official">
                    <i className="fa fa-shield-alt"></i> Verified Skill Passport
                  </span>
                </div>
              </div>
            </header>

            {/* Student Bio Statement */}
            {data.student.bio && (
              <div className="portfolio-bio-block">
                <strong>Profile Summary:</strong> {data.student.bio}
              </div>
            )}

            {/* Certificate Verification Banner */}
            {data.certificate && (
              <div className="portfolio-certificate-banner">
                <div className="cert-left">
                  <div className="cert-seal">
                    <i className="fa fa-award"></i>
                  </div>
                  <div className="cert-title-group">
                    <h4>{data.certificate.institution}</h4>
                    <p>Official Digital Skill Passport · Academic Competency Registry</p>
                  </div>
                </div>
                <div className="cert-code-group">
                  <span className="cert-code-label">Verification Hash & ID</span>
                  <span className="cert-hash-val">{data.certificate.verificationCode}</span>
                  <small style={{ display: 'block', color: '#047857', marginTop: '2px', fontSize: '10px' }}>
                    {data.certificate.certificateId}
                  </small>
                </div>
              </div>
            )}

            {/* Summary Metrics */}
            <section className="portfolio-metrics-grid">
              <div className="portfolio-metric-box">
                <span className="metric-number">{data.summary.totalVerifiedSkills}</span>
                <span className="metric-label">Faculty Verified Skills (Eq. 3-4)</span>
              </div>
              <div className="portfolio-metric-box">
                <span className="metric-number">{data.summary.totalProjects}</span>
                <span className="metric-label">Academic Projects</span>
              </div>
              <div className="portfolio-metric-box">
                <span className="metric-number">{data.summary.totalProjectSkills}</span>
                <span className="metric-label">Demonstrated Technologies</span>
              </div>
            </section>

            {/* Section 1: Verified Technical Competencies */}
            <section className="portfolio-section">
              <div className="portfolio-section-title">
                <i className="fa fa-check-circle" style={{ color: '#10b981' }}></i>
                <h3>Faculty-Verified Competencies (Paper Eq. 3-4)</h3>
              </div>
              <p className="portfolio-section-desc">
                Competencies that have been evaluated, reviewed, and endorsed by supervising faculty mentors based on documented project deliverables.
              </p>

              {data.verifiedSkills.length === 0 ? (
                <div className="portfolio-empty-hint">
                  <i className="fa fa-info-circle"></i>
                  <span>No faculty-verified competencies yet. Once your faculty reviews your project claims, approved skills will appear here.</span>
                </div>
              ) : (
                <div className="portfolio-verified-grid">
                  {data.verifiedSkills.map((vs) => (
                    <div key={vs.id} className="portfolio-verified-card">
                      <div className="portfolio-verified-card-header">
                        <h4>{vs.name}</h4>
                        <span className="portfolio-level-tag">{vs.level}</span>
                      </div>
                      <span className="portfolio-category-tag">{vs.category || 'General'}</span>
                      {vs.description && <p className="portfolio-skill-desc">{vs.description}</p>}

                      <div className="portfolio-verified-date">
                        <i className="fa fa-user-check"></i>
                        <span>
                          Verified by {vs.verifiedBy?.name || 'Faculty Guide'}
                          {vs.verifiedAt ? ` on ${new Date(vs.verifiedAt).toLocaleDateString()}` : ''}
                        </span>
                      </div>

                      {/* Mentor Commendation / Endorsement */}
                      {vs.feedback && (
                        <div className="portfolio-mentor-endorsement">
                          <strong>Faculty Endorsement:</strong>
                          <span className="portfolio-mentor-quote">&ldquo;{vs.feedback}&rdquo;</span>
                        </div>
                      )}

                      <div className="portfolio-evidence-tags" style={{ marginTop: '10px' }}>
                        <strong>Project Evidence ({vs.projects.length}):</strong>
                        {vs.projects.map((p) => (
                          <span key={p.id} className="evidence-project-tag">
                            <i className="fa fa-folder-open"></i> {p.title}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* Section 2: Project-Supported Technical Skills */}
            <section className="portfolio-section">
              <div className="portfolio-section-title">
                <i className="fa fa-layer-group"></i>
                <h3>Project-Supported Technical Skills</h3>
              </div>
              <p className="portfolio-section-desc">
                Skills derived directly from team projects and technical tasks practiced throughout the academic curriculum.
              </p>

              {data.projectSkills.length === 0 ? (
                <div className="portfolio-empty-hint">
                  <span>No project skills recorded yet.</span>
                </div>
              ) : (
                <div className="portfolio-skills-cloud">
                  {data.projectSkills.map((ps) => (
                    <div key={ps.id} className="portfolio-skill-chip">
                      <strong>{ps.name}</strong>
                      <span className="chip-category">{ps.category || 'Technical'}</span>
                      <small>({ps.projects.length} project{ps.projects.length > 1 ? 's' : ''})</small>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* Section 3: Academic Project Portfolio */}
            <section className="portfolio-section">
              <div className="portfolio-section-title">
                <i className="fa fa-tasks"></i>
                <h3>Academic Project Portfolio</h3>
              </div>
              <p className="portfolio-section-desc">
                Documented engineering projects completed with active Kanban tracking, faculty supervision, and team collaboration.
              </p>

              <div className="portfolio-projects-list">
                {data.projects.map((proj) => (
                  <div key={proj.id} className="portfolio-project-item">
                    <div className="portfolio-project-item-header">
                      <div>
                        <h4>{proj.title}</h4>
                        <span style={{ fontSize: '0.8rem', color: '#64748b' }}>
                          Role: <strong>{proj.role}</strong> · Supervisor: <strong>{proj.supervisor}</strong>
                        </span>
                      </div>
                      <span className={`portfolio-proj-status ${proj.status.toLowerCase()}`}>
                        {proj.status}
                      </span>
                    </div>

                    {proj.description && (
                      <p style={{ fontSize: '0.88rem', color: '#475569', margin: '4px 0 10px 0' }}>
                        {proj.description}
                      </p>
                    )}

                    {proj.skills.length > 0 && (
                      <div className="portfolio-project-tech-stack">
                        <strong>Demonstrated Technologies & Skills:</strong>
                        <div className="tech-pills">
                          {proj.skills.map((s, idx) => (
                            <span key={idx} className="tech-pill">{s}</span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </section>

            {/* Footer */}
            <footer className="portfolio-doc-footer">
              <p>StackX SkillTrack — Certified Placement Readiness & Competency Verification Document</p>
              <small>MIT Art, Design and Technology University, Pune · School of Computing</small>
            </footer>
          </div>
        ) : null}
      </main>
    </div>
  );
};

export default PortfolioPage;
