
import React, { useEffect, useState } from 'react';
import Sidebar from '../components/Sidebar';
import '../auth.css';

const API_BASE_URL = 'http://localhost:4300';

interface Skill {
  id: string;
  name: string;
}

interface JobRoleSkill {
  skillId: string;
  skill: Skill & { isActive?: boolean };
}

interface JobRole {
  id: string;
  title: string;
  description: string | null;
  isActive: boolean;
  requiredSkills: JobRoleSkill[];
}

interface EvidenceProject {
  id: string;
  title: string;
  status: string;
}

interface MatchedSkill {
  id: string;
  name: string;
  projects: EvidenceProject[];
}

interface MissingSkill {
  id: string;
  name: string;
}

interface StudentMatch {
  id: string;
  name: string | null;
  email: string;
  totalProjects: number;
  matchPercentage: number;
  matchedSkillCount: number;
  totalRequiredSkills: number;
  matchedSkills: MatchedSkill[];
  missingSkills: MissingSkill[];
}

interface TalentSearchResponse {
  jobRole: {
    id: string;
    title: string;
    description: string | null;
  };
  totalRequiredSkills: number;
  totalStudents: number;
  students: StudentMatch[];
}

const AdminTalentSearchPage: React.FC = () => {
  const [roles, setRoles] = useState<JobRole[]>([]);
  const [selectedRoleId, setSelectedRoleId] = useState('');
  const [results, setResults] = useState<TalentSearchResponse | null>(null);
  const [loadingRoles, setLoadingRoles] = useState(true);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState('');
  const [expandedStudent, setExpandedStudent] = useState<string | null>(null);

  const token = localStorage.getItem('token');

  useEffect(() => {
    const fetchRoles = async () => {
      setLoadingRoles(true);
      setError('');

      try {
        const response = await fetch(`${API_BASE_URL}/api/job-roles`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.message || 'Could not load job roles.');
        }

        const activeRoles: JobRole[] = Array.isArray(data)
          ? data.filter((role: JobRole) => role.isActive)
          : [];

        setRoles(activeRoles);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : 'Could not load job roles.'
        );
      } finally {
        setLoadingRoles(false);
      }
    };

    fetchRoles();
  }, [token]);

  const handleSearch = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!selectedRoleId) {
      setError('Please select a job role first.');
      return;
    }

    setSearching(true);
    setError('');
    setResults(null);
    setExpandedStudent(null);

    try {
      const response = await fetch(
        `${API_BASE_URL}/api/talent-search?jobRoleId=${encodeURIComponent(
          selectedRoleId
        )}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Talent search failed.');
      }

      setResults(data as TalentSearchResponse);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Talent search failed.'
      );
    } finally {
      setSearching(false);
    }
  };

  const selectedRole = roles.find((role) => role.id === selectedRoleId);

  return (
    <div className="admin-page">
      <Sidebar activeTab="talent-search" />

      <main className="admin-main">
        <header className="admin-header">
          <div>
            <span className="talent-eyebrow">STUDENT SKILL INTELLIGENCE</span>
            <h1>Talent Search</h1>
            <p>
              Discover students whose project experience aligns with a
              selected job role.
            </p>
          </div>
        </header>

        <section className="admin-section talent-search-panel">
          <div className="admin-section-header">
            <div>
              <h2>Find matching students</h2>
              <p>Select a job role to compare its required skills with student
                project experience.</p>
            </div>
          </div>

          <form className="talent-search-form" onSubmit={handleSearch}>
            <div className="talent-role-field">
              <label htmlFor="talent-job-role">Job role</label>

              <select
                id="talent-job-role"
                value={selectedRoleId}
                onChange={(event) => {
                  setSelectedRoleId(event.target.value);
                  setResults(null);
                  setError('');
                }}
                disabled={loadingRoles || searching}
                required
              >
                <option value="">
                  {loadingRoles ? 'Loading job roles...' : 'Choose a job role'}
                </option>

                {roles.map((role) => (
                  <option key={role.id} value={role.id}>
                    {role.title}
                  </option>
                ))}
              </select>

              {selectedRole && (
                <small>
                  {selectedRole.requiredSkills.filter(
                    (item) => item.skill.isActive !== false
                  ).length}{' '}
                  required skills configured
                </small>
              )}
            </div>

            <button
              className="talent-search-button"
              type="submit"
              disabled={!selectedRoleId || searching || loadingRoles}
            >
              {searching ? (
                <>
                  <i className="fa fa-spinner fa-spin"></i> Searching...
                </>
              ) : (
                <>
                  <i className="fa fa-search"></i> Find Talent
                </>
              )}
            </button>
          </form>

          {!loadingRoles && roles.length === 0 && (
            <p className="talent-empty-message">
              No active job roles found. Create a job role and add its required
              skills first.
            </p>
          )}

          {error && <div className="talent-error">{error}</div>}
        </section>

        {results && (
          <>
            <section className="talent-summary-grid">
              <div className="talent-summary-card">
                <span>Selected Role</span>
                <strong>{results.jobRole.title}</strong>
                <small>Matching criteria</small>
              </div>

              <div className="talent-summary-card">
                <span>Students Analysed</span>
                <strong>{results.totalStudents}</strong>
                <small>All registered students</small>
              </div>

              <div className="talent-summary-card">
                <span>Required Skills</span>
                <strong>{results.totalRequiredSkills}</strong>
                <small>Active catalogue skills</small>
              </div>
            </section>

            <section className="admin-section talent-results-section">
              <div className="admin-section-header">
                <div>
                  <h2>Matching students</h2>
                  <p>
                    Ranked by required-skill coverage, highest match first.
                  </p>
                </div>
                <span className="talent-result-count">
                  {results.students.length} students
                </span>
              </div>

              {results.totalRequiredSkills === 0 && (
                <div className="talent-empty-message">
                  This job role has no active required skills. Add skills to
                  the role before comparing students.
                </div>
              )}

              {results.students.length === 0 &&
                results.totalRequiredSkills > 0 && (
                  <div className="talent-empty-message">
                    No student accounts were found.
                  </div>
                )}

              <div className="talent-student-list">
                {results.students.map((student, index) => {
                  const isExpanded = expandedStudent === student.id;

                  return (
                    <article className="talent-student-card" key={student.id}>
                      <div className="talent-student-top">
                        <div className="talent-student-identity">
                          <div className="talent-student-avatar">
                            {(student.name || student.email || 'S')
                              .charAt(0)
                              .toUpperCase()}
                          </div>

                          <div className="talent-student-details">
                            <div className="talent-student-name-line">
                              <h3>{student.name || 'Unnamed Student'}</h3>
                              <span className="talent-rank">
                                #{index + 1}
                              </span>
                            </div>
                            <p>{student.email}</p>
                            <small>
                              {student.totalProjects}{' '}
                              {student.totalProjects === 1 ? 'project' : 'projects'}
                            </small>
                          </div>
                        </div>

                        <div className="talent-match-block">
                          <strong>{student.matchPercentage}%</strong>
                          <span>Skill match</span>
                          <div
                            className="talent-match-track"
                            role="progressbar"
                            aria-label={`${student.name || student.email} skill match`}
                            aria-valuemin={0}
                            aria-valuemax={100}
                            aria-valuenow={student.matchPercentage}
                          >
                            <div
                              className="talent-match-fill"
                              style={{
                                width: `${student.matchPercentage}%`,
                              }}
                            />
                          </div>
                          <small>
                            {student.matchedSkillCount} of{' '}
                            {student.totalRequiredSkills} skills
                          </small>
                        </div>
                      </div>

                      <div className="talent-skill-preview">
                        <div>
                          <span className="talent-skill-label">
                            Matched skills
                          </span>
                          <div className="talent-skill-tags">
                            {student.matchedSkills.length > 0 ? (
                              student.matchedSkills.map((skill) => (
                                <span className="matched" key={skill.id}>
                                  <i className="fa fa-check"></i> {skill.name}
                                </span>
                              ))
                            ) : (
                              <small>No required skills matched yet.</small>
                            )}
                          </div>
                        </div>

                        <div>
                          <span className="talent-skill-label">
                            Skills to develop
                          </span>
                          <div className="talent-skill-tags">
                            {student.missingSkills.length > 0 ? (
                              student.missingSkills.map((skill) => (
                                <span className="missing" key={skill.id}>
                                  {skill.name}
                                </span>
                              ))
                            ) : (
                              <small>
                                {results.totalRequiredSkills > 0
                                  ? 'All required skills matched.'
                                  : 'No required skills configured.'}
                              </small>
                            )}
                          </div>
                        </div>
                      </div>

                      <button
                        type="button"
                        className="talent-evidence-toggle"
                        onClick={() =>
                          setExpandedStudent(isExpanded ? null : student.id)
                        }
                        aria-expanded={isExpanded}
                      >
                        {isExpanded ? 'Hide project evidence' : 'View project evidence'}
                        <i
                          className={`fa fa-chevron-${isExpanded ? 'up' : 'down'}`}
                        ></i>
                      </button>

                      {isExpanded && (
                        <div className="talent-evidence-panel">
                          {student.matchedSkills.length === 0 ? (
                            <p>
                              No supporting project evidence was found for the
                              selected role's required skills.
                            </p>
                          ) : (
                            student.matchedSkills.map((skill) => (
                              <div
                                className="talent-evidence-skill"
                                key={skill.id}
                              >
                                <strong>{skill.name}</strong>

                                <div className="talent-evidence-projects">
                                  {skill.projects.map((project) => (
                                    <div
                                      className="talent-evidence-project"
                                      key={`${skill.id}-${project.id}`}
                                    >
                                      <i className="fa fa-folder-open"></i>
                                      <span>{project.title}</span>
                                      <small>
                                        {project.status.replace(/_/g, ' ')}
                                      </small>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            ))
                          )}
                        </div>
                      )}
                    </article>
                  );
                })}
              </div>

              <p className="talent-disclaimer">
                Match percentages indicate skills associated with assigned
                projects. They represent project-supported exposure, not
                verified proficiency or a hiring recommendation.
              </p>
            </section>
          </>
        )}
      </main>
    </div>
  );
};

export default AdminTalentSearchPage;
