import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import '../auth.css';
import { API_BASE_URL } from '../config/api';

interface Skill {
  id: string;
  name: string;
  category?: string | null;
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
  category?: string | null;
  isVerified: boolean;
  level?: string;
  verifiedBy?: { id: string; name: string; email: string } | null;
  feedback?: string | null;
  verifiedAt?: string | null;
  projects: EvidenceProject[];
}

interface MissingSkill {
  id: string;
  name: string;
  category?: string | null;
}

interface StudentMatch {
  id: string;
  name: string | null;
  email: string;
  headline?: string | null;
  department?: string | null;
  studentIdNo?: string | null;
  graduationYear?: string | null;
  shareableSlug?: string | null;
  totalProjects: number;
  matchPercentage: number;
  verifiedMatchPercentage: number;
  matchedSkillCount: number;
  verifiedMatchCount: number;
  totalRequiredSkills: number;
  matchedSkills: MatchedSkill[];
  missingSkills: MissingSkill[];
}

interface TalentSearchResponse {
  targetTitle: string;
  targetDescription?: string | null;
  matchMode: 'VERIFIED_ONLY' | 'ALL_DEMONSTRATED';
  totalRequiredSkills: number;
  totalCandidatesMatched: number;
  totalStudentsEvaluated: number;
  verificationNote?: string;
  students: StudentMatch[];
}

interface AnalyticsData {
  totalStudents: number;
  totalJobRoles: number;
  totalActiveSkills: number;
  topShortages: Array<{
    id: string;
    name: string;
    category: string;
    requiredInRoles: number;
    verifiedStudents: number;
    exposureStudents: number;
    shortage: number;
    gapPercentage: number;
  }>;
  topVerified: Array<{
    id: string;
    name: string;
    category: string;
    requiredInRoles: number;
    verifiedStudents: number;
    exposureStudents: number;
  }>;
  roleReadiness: Array<{
    id: string;
    title: string;
    totalRequiredSkills: number;
    readyCount: number;
    progressingCount: number;
    developingCount: number;
  }>;
}

const AdminTalentSearchPage: React.FC = () => {
  const navigate = useNavigate();

  // Active top-level view tab
  const [activeTab, setActiveTab] = useState<'search' | 'analytics'>('search');

  // Search parameters
  const [searchTargetType, setSearchTargetType] = useState<'role' | 'skills'>('role');
  const [roles, setRoles] = useState<JobRole[]>([]);
  const [availableSkills, setAvailableSkills] = useState<Skill[]>([]);
  const [selectedRoleId, setSelectedRoleId] = useState('');
  const [selectedSkillIds, setSelectedSkillIds] = useState<string[]>([]);
  const [matchMode, setMatchMode] = useState<'ALL_DEMONSTRATED' | 'VERIFIED_ONLY'>('ALL_DEMONSTRATED');
  const [minMatch, setMinMatch] = useState('0');
  const [searchQuery, setSearchQuery] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState('');
  const [gradYearFilter, setGradYearFilter] = useState('');

  // Results & Loading
  const [results, setResults] = useState<TalentSearchResponse | null>(null);
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [loadingData, setLoadingData] = useState(true);
  const [searching, setSearching] = useState(false);
  const [loadingAnalytics, setLoadingAnalytics] = useState(false);
  const [error, setError] = useState('');
  const [expandedStudent, setExpandedStudent] = useState<string | null>(null);

  const token = localStorage.getItem('token');

  // Fetch initial Roles and Catalogue Skills
  useEffect(() => {
    const fetchPrerequisites = async () => {
      setLoadingData(true);
      setError('');

      try {
        const [rolesRes, skillsRes] = await Promise.all([
          fetch(`${API_BASE_URL}/api/job-roles`, {
            headers: { Authorization: `Bearer ${token}` },
          }),
          fetch(`${API_BASE_URL}/api/skills`, {
            headers: { Authorization: `Bearer ${token}` },
          }),
        ]);

        if (!rolesRes.ok || !skillsRes.ok) {
          throw new Error('Failed to load initial roles or skills catalog.');
        }

        const rolesData: JobRole[] = await rolesRes.json();
        const skillsData: Skill[] = await skillsRes.json();

        setRoles(rolesData.filter((r) => r.isActive));
        setAvailableSkills(skillsData);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Could not load search metadata.');
      } finally {
        setLoadingData(false);
      }
    };

    fetchPrerequisites();
  }, [token]);

  // Fetch Analytics when Analytics tab is clicked
  const fetchAnalytics = async () => {
    setLoadingAnalytics(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/talent-search/analytics`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Failed to fetch institutional skill gap analytics.');
      const data: AnalyticsData = await res.json();
      setAnalytics(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingAnalytics(false);
    }
  };

  const handleTabChange = (tab: 'search' | 'analytics') => {
    setActiveTab(tab);
    if (tab === 'analytics' && !analytics) {
      fetchAnalytics();
    }
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();

    if (searchTargetType === 'role' && !selectedRoleId) {
      setError('Please select a job role first.');
      return;
    }
    if (searchTargetType === 'skills' && selectedSkillIds.length === 0) {
      setError('Please select at least one skill.');
      return;
    }

    setSearching(true);
    setError('');
    setResults(null);
    setExpandedStudent(null);

    try {
      const params = new URLSearchParams();
      if (searchTargetType === 'role') {
        params.append('jobRoleId', selectedRoleId);
      } else {
        params.append('skillIds', selectedSkillIds.join(','));
      }
      params.append('matchMode', matchMode);
      if (minMatch !== '0') params.append('minMatch', minMatch);
      if (searchQuery.trim()) params.append('searchQuery', searchQuery.trim());
      if (departmentFilter.trim()) params.append('department', departmentFilter.trim());
      if (gradYearFilter.trim()) params.append('graduationYear', gradYearFilter.trim());

      const res = await fetch(`${API_BASE_URL}/api/talent-search?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Talent search failed.');

      setResults(data as TalentSearchResponse);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Talent search failed.');
    } finally {
      setSearching(false);
    }
  };

  const toggleSkillSelection = (skillId: string) => {
    setSelectedSkillIds((prev) =>
      prev.includes(skillId) ? prev.filter((id) => id !== skillId) : [...prev, skillId]
    );
  };

  return (
    <div className="admin-page">
      <Sidebar activeTab="talent-search" />

      <main className="admin-main">
        {/* Header */}
        <header className="admin-header">
          <div>
            <span className="talent-eyebrow">INSTITUTIONAL PLACEMENT INTELLIGENCE</span>
            <h1>Talent Search & Skill Analytics</h1>
            <p>
              Match student competencies against industry roles, verify faculty-backed skills, and analyze institutional skill gaps.
            </p>
          </div>
        </header>

        {/* Tab Navigation */}
        <div className="talent-tab-nav">
          <button
            type="button"
            className={`talent-tab-btn ${activeTab === 'search' ? 'active' : ''}`}
            onClick={() => handleTabChange('search')}
          >
            <i className="fa fa-search"></i> Candidate Search & Match Ranking
          </button>
          <button
            type="button"
            className={`talent-tab-btn ${activeTab === 'analytics' ? 'active' : ''}`}
            onClick={() => handleTabChange('analytics')}
          >
            <i className="fa fa-chart-pie"></i> University Skill Gap & Readiness
          </button>
        </div>

        {error && (
          <div className="faculty-feedback-toast" style={{ background: '#fef2f2', borderColor: '#fca5a5', color: '#991b1b', marginBottom: '20px' }}>
            <i className="fa fa-exclamation-triangle" style={{ color: '#ef4444' }}></i>
            <span>{error}</span>
          </div>
        )}

        {/* ─────────────────────────────────────────────────────────────
            TAB 1: CANDIDATE SEARCH & MATCH RANKING
           ───────────────────────────────────────────────────────────── */}
        {activeTab === 'search' && (
          <>
            <section className="admin-section talent-search-panel">
              <div className="admin-section-header">
                <div>
                  <h2>Search & Rank Candidates</h2>
                  <p>Configure target competencies, verification mode, and student filters.</p>
                </div>
              </div>

              <form className="talent-search-form" onSubmit={handleSearch}>
                {/* Search Target Mode Selector */}
                <div style={{ display: 'flex', gap: '20px', marginBottom: '16px' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontWeight: 600, fontSize: '13px' }}>
                    <input
                      type="radio"
                      name="targetType"
                      checked={searchTargetType === 'role'}
                      onChange={() => setSearchTargetType('role')}
                    />
                    Search by Industry Job Role
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontWeight: 600, fontSize: '13px' }}>
                    <input
                      type="radio"
                      name="targetType"
                      checked={searchTargetType === 'skills'}
                      onChange={() => setSearchTargetType('skills')}
                    />
                    Search by Specific Competencies
                  </label>
                </div>

                {/* Primary Target Selection */}
                {searchTargetType === 'role' ? (
                  <div className="talent-role-field">
                    <label htmlFor="talent-job-role">Target Job Role *</label>
                    <select
                      id="talent-job-role"
                      value={selectedRoleId}
                      onChange={(e) => setSelectedRoleId(e.target.value)}
                      disabled={loadingData || searching}
                      required
                    >
                      <option value="">{loadingData ? 'Loading roles...' : 'Select a Job Role...'}</option>
                      {roles.map((role) => (
                        <option key={role.id} value={role.id}>
                          {role.title} ({role.requiredSkills.length} required skills)
                        </option>
                      ))}
                    </select>
                  </div>
                ) : (
                  <div className="talent-role-field">
                    <label>Select Required Competencies ({selectedSkillIds.length} selected) *</label>
                    <div
                      style={{
                        maxHeight: '150px',
                        overflowY: 'auto',
                        padding: '10px',
                        border: '1px solid #cbd5e1',
                        borderRadius: '8px',
                        background: '#ffffff',
                        display: 'flex',
                        flexWrap: 'wrap',
                        gap: '8px',
                      }}
                    >
                      {availableSkills.map((s) => {
                        const isSelected = selectedSkillIds.includes(s.id);
                        return (
                          <button
                            type="button"
                            key={s.id}
                            className={`skill-filter-tab ${isSelected ? 'active' : ''}`}
                            style={{ fontSize: '12px', padding: '4px 10px' }}
                            onClick={() => toggleSkillSelection(s.id)}
                          >
                            {isSelected ? '✓ ' : '+ '}
                            {s.name}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Secondary Filters */}
                <div className="talent-filters-grid">
                  <div className="talent-filter-field">
                    <label>Verification Filter Mode</label>
                    <select
                      className="talent-filter-select"
                      value={matchMode}
                      onChange={(e) => setMatchMode(e.target.value as any)}
                    >
                      <option value="ALL_DEMONSTRATED">Verified + Project Exposure (Standard)</option>
                      <option value="VERIFIED_ONLY">Faculty-Verified Only</option>
                    </select>
                  </div>

                  <div className="talent-filter-field">
                    <label>Minimum Match %</label>
                    <select
                      className="talent-filter-select"
                      value={minMatch}
                      onChange={(e) => setMinMatch(e.target.value)}
                    >
                      <option value="0">Any Match (&gt; 0%)</option>
                      <option value="50">At Least 50% Match</option>
                      <option value="75">High Readiness (75%+)</option>
                      <option value="100">Full Alignment (100%)</option>
                    </select>
                  </div>

                  <div className="talent-filter-field">
                    <label>Student Name / PRN Search</label>
                    <input
                      type="text"
                      className="talent-filter-input"
                      placeholder="e.g. Alice, PRN 1032..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                    />
                  </div>

                  <div className="talent-filter-field">
                    <label>Department / Program</label>
                    <input
                      type="text"
                      className="talent-filter-input"
                      placeholder="e.g. Computer Science"
                      value={departmentFilter}
                      onChange={(e) => setDepartmentFilter(e.target.value)}
                    />
                  </div>

                  <div className="talent-filter-field">
                    <label>Graduation Year</label>
                    <input
                      type="text"
                      className="talent-filter-input"
                      placeholder="e.g. 2026"
                      value={gradYearFilter}
                      onChange={(e) => setGradYearFilter(e.target.value)}
                    />
                  </div>
                </div>

                <div style={{ marginTop: '20px' }}>
                  <button type="submit" className="talent-search-submit" disabled={searching || loadingData}>
                    {searching ? (
                      <>
                        <i className="fa fa-spinner fa-spin"></i> Analyzing Student Competencies...
                      </>
                    ) : (
                      <>
                        <i className="fa fa-search"></i> Run Talent Match Analysis
                      </>
                    )}
                  </button>
                </div>
              </form>
            </section>

            {/* Results Section */}
            {results && (
              <section className="admin-section talent-results-section">
                <div className="talent-results-meta">
                  <div>
                    <h3>{results.targetTitle}</h3>
                    {results.targetDescription && <p>{results.targetDescription}</p>}
                    <small style={{ color: '#64748b' }}>
                      {results.verificationNote} · {results.totalCandidatesMatched} candidate(s) found out of {results.totalStudentsEvaluated} evaluated.
                    </small>
                  </div>
                  <span className="talent-req-count">
                    {results.totalRequiredSkills} Required Competenc{results.totalRequiredSkills === 1 ? 'y' : 'ies'}
                  </span>
                </div>

                {results.students.length === 0 ? (
                  <div className="student-empty-state">
                    <h3>No matching candidates found</h3>
                    <p>Try adjusting your search criteria or switching Verification Mode to "Verified + Project Exposure".</p>
                  </div>
                ) : (
                  <div className="talent-cards-grid">
                    {results.students.map((student, index) => {
                      const isExpanded = expandedStudent === student.id;

                      return (
                        <article key={student.id} className="talent-student-card">
                          <div className="talent-student-header">
                            <div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '2px' }}>
                                <span style={{ fontSize: '11px', fontWeight: 800, color: '#4f46e5', background: '#eef2ff', padding: '2px 8px', borderRadius: '4px' }}>
                                  #{index + 1} RANK
                                </span>
                                <h3 style={{ margin: 0 }}>{student.name}</h3>
                              </div>
                              <p className="talent-student-email">{student.email}</p>

                              {student.headline && (
                                <p style={{ margin: '4px 0', fontSize: '12px', color: '#4f46e5', fontWeight: 600 }}>
                                  {student.headline}
                                </p>
                              )}

                              <div style={{ display: 'flex', gap: '8px', marginTop: '4px', flexWrap: 'wrap' }}>
                                {student.department && (
                                  <span style={{ fontSize: '11px', color: '#64748b' }}>
                                    <i className="fa fa-graduation-cap"></i> {student.department}
                                  </span>
                                )}
                                {student.graduationYear && (
                                  <span style={{ fontSize: '11px', color: '#64748b' }}>
                                    <i className="fa fa-calendar-alt"></i> Batch {student.graduationYear}
                                  </span>
                                )}
                              </div>
                            </div>

                            <div style={{ textAlign: 'right' }}>
                              <div
                                className="talent-match-badge"
                                style={{
                                  background: student.matchPercentage >= 75 ? '#dcfce7' : student.matchPercentage >= 50 ? '#fef3c7' : '#f1f5f9',
                                  color: student.matchPercentage >= 75 ? '#166534' : student.matchPercentage >= 50 ? '#854d0e' : '#475569',
                                }}
                              >
                                {student.matchPercentage}% MATCH
                              </div>
                              <small style={{ display: 'block', marginTop: '4px', fontSize: '11px', color: '#16a34a', fontWeight: 700 }}>
                                ✓ {student.verifiedMatchCount} Faculty-Verified
                              </small>
                            </div>
                          </div>

                          {/* Action Links */}
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '12px', paddingBottom: '10px', borderBottom: '1px solid #f1f5f9' }}>
                            <span style={{ fontSize: '12px', color: '#64748b' }}>
                              <i className="fa fa-folder"></i> <strong>{student.totalProjects}</strong> academic project(s)
                            </span>
                            <button
                              type="button"
                              className="talent-passport-btn"
                              onClick={() => navigate(`/portfolio/${student.shareableSlug || student.id}`)}
                            >
                              <i className="fa fa-id-badge"></i> View Skill Passport ↗
                            </button>
                          </div>

                          {/* Skills Breakdown */}
                          <div className="talent-skill-preview" style={{ marginTop: '12px' }}>
                            <div>
                              <span className="talent-skill-label">
                                Matched Competencies ({student.matchedSkills.length}/{student.totalRequiredSkills})
                              </span>
                              <div className="talent-skill-tags">
                                {student.matchedSkills.length > 0 ? (
                                  student.matchedSkills.map((skill) => (
                                    <span
                                      key={skill.id}
                                      className={skill.isVerified ? 'talent-skill-verified-tag' : 'talent-skill-exposure-tag'}
                                    >
                                      {skill.isVerified ? (
                                        <>
                                          <i className="fa fa-check-circle" style={{ color: '#10b981' }}></i>
                                          {skill.name} <small style={{ fontWeight: 800 }}>({skill.level})</small>
                                        </>
                                      ) : (
                                        <>
                                          <i className="fa fa-code-branch"></i>
                                          {skill.name} <small>(Exposure)</small>
                                        </>
                                      )}
                                    </span>
                                  ))
                                ) : (
                                  <small style={{ color: '#94a3b8' }}>No required skills matched yet.</small>
                                )}
                              </div>
                            </div>

                            {student.missingSkills.length > 0 && (
                              <div style={{ marginTop: '8px' }}>
                                <span className="talent-skill-label">Competencies to Develop</span>
                                <div className="talent-skill-tags">
                                  {student.missingSkills.map((skill) => (
                                    <span className="missing" key={skill.id}>
                                      {skill.name}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>

                          {/* Project Evidence Accordion */}
                          <button
                            type="button"
                            className="talent-evidence-toggle"
                            onClick={() => setExpandedStudent(isExpanded ? null : student.id)}
                            style={{ marginTop: '14px' }}
                          >
                            {isExpanded ? 'Hide Supporting Evidence' : 'View Supporting Project Evidence'}
                            <i className={`fa fa-chevron-${isExpanded ? 'up' : 'down'}`} style={{ marginLeft: '6px' }}></i>
                          </button>

                          {isExpanded && (
                            <div className="talent-evidence-panel">
                              {student.matchedSkills.length === 0 ? (
                                <p>No project evidence available for required skills.</p>
                              ) : (
                                student.matchedSkills.map((skill) => (
                                  <div className="talent-evidence-skill" key={skill.id}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                      <strong>{skill.name}</strong>
                                      {skill.isVerified && skill.verifiedBy && (
                                        <small style={{ color: '#059669', fontWeight: 600 }}>
                                          Verified by {skill.verifiedBy.name}
                                        </small>
                                      )}
                                    </div>
                                    {skill.feedback && (
                                      <p style={{ margin: '4px 0 8px 0', fontSize: '11px', fontStyle: 'italic', color: '#166534' }}>
                                        &ldquo;{skill.feedback}&rdquo;
                                      </p>
                                    )}

                                    <div className="talent-evidence-projects">
                                      {skill.projects.map((proj) => (
                                        <div className="talent-evidence-project" key={`${skill.id}-${proj.id}`}>
                                          <i className="fa fa-folder-open"></i>
                                          <span>{proj.title}</span>
                                          <small>{proj.status.replace(/_/g, ' ')}</small>
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
                )}
              </section>
            )}
          </>
        )}

        {/* ─────────────────────────────────────────────────────────────
            TAB 2: UNIVERSITY SKILL GAP & READINESS ANALYTICS
           ───────────────────────────────────────────────────────────── */}
        {activeTab === 'analytics' && (
          <section className="admin-section">
            {loadingAnalytics ? (
              <div className="portfolio-loading">
                <i className="fa fa-spinner fa-spin"></i>
                <p>Computing university-wide skill gap and readiness analytics...</p>
              </div>
            ) : analytics ? (
              <>
                {/* Metrics Summary Row */}
                <div className="analytics-metrics-row">
                  <div className="analytics-metric-card">
                    <h4>Total Active Students</h4>
                    <div className="analytics-metric-val">{analytics.totalStudents}</div>
                  </div>
                  <div className="analytics-metric-card">
                    <h4>Industry Job Roles</h4>
                    <div className="analytics-metric-val">{analytics.totalJobRoles}</div>
                  </div>
                  <div className="analytics-metric-card">
                    <h4>Catalogue Competencies</h4>
                    <div className="analytics-metric-val">{analytics.totalActiveSkills}</div>
                  </div>
                </div>

                {/* Top Shortages & Top Competencies Split Grid */}
                <div className="analytics-split-grid">
                  {/* Top Shortages Card */}
                  <div className="analytics-card">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                      <i className="fa fa-exclamation-triangle" style={{ color: '#ef4444', fontSize: '18px' }}></i>
                      <h3>Top Institutional Skill Shortages</h3>
                    </div>
                    <p>Skills in high industry role demand with a shortage of verified students.</p>

                    {analytics.topShortages.length === 0 ? (
                      <p>No critical skill shortages identified.</p>
                    ) : (
                      analytics.topShortages.map((s) => (
                        <div key={s.id} className="gap-bar-container">
                          <div className="gap-bar-header">
                            <span>{s.name} ({s.category})</span>
                            <span style={{ color: '#ef4444' }}>{s.gapPercentage}% Shortage Gap</span>
                          </div>
                          <div className="gap-bar-track">
                            <div
                              className="gap-bar-fill"
                              style={{ width: `${s.gapPercentage}%` }}
                            ></div>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: '#64748b', marginTop: '2px' }}>
                            <span>Required in {s.requiredInRoles} role(s)</span>
                            <span>{s.verifiedStudents} verified · {s.exposureStudents} exposure</span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>

                  {/* Top Verified Competencies */}
                  <div className="analytics-card">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                      <i className="fa fa-award" style={{ color: '#10b981', fontSize: '18px' }}></i>
                      <h3>Top Faculty-Verified Competencies</h3>
                    </div>
                    <p>Most verified skills across academic projects and curriculum.</p>

                    {analytics.topVerified.map((s) => (
                      <div key={s.id} className="gap-bar-container">
                        <div className="gap-bar-header">
                          <span>{s.name} ({s.category})</span>
                          <span style={{ color: '#059669' }}>{s.verifiedStudents} Students Verified</span>
                        </div>
                        <div className="gap-bar-track">
                          <div
                            className="gap-bar-fill safe"
                            style={{
                              width: `${Math.min(100, (s.verifiedStudents / Math.max(1, analytics.totalStudents)) * 100)}%`,
                            }}
                          ></div>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: '#64748b', marginTop: '2px' }}>
                          <span>{s.exposureStudents} with project exposure</span>
                          <span>In {s.requiredInRoles} target role(s)</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Job Role Placement Pipeline Table */}
                <div className="analytics-card" style={{ marginTop: '20px' }}>
                  <h3>Industry Role Readiness Pipeline</h3>
                  <p>Distribution of student candidates ready for immediate placement vs progressing.</p>

                  <table className="talent-table">
                    <thead>
                      <tr>
                        <th>Job Role</th>
                        <th>Required Skills</th>
                        <th>Ready Candidates (&ge; 80% Match)</th>
                        <th>Progressing (50–79%)</th>
                        <th>Developing (&lt; 50%)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {analytics.roleReadiness.map((role) => (
                        <tr key={role.id}>
                          <td><strong>{role.title}</strong></td>
                          <td>{role.totalRequiredSkills}</td>
                          <td>
                            <span style={{ color: '#16a34a', fontWeight: 700 }}>
                              {role.readyCount} candidates
                            </span>
                          </td>
                          <td>
                            <span style={{ color: '#d97706', fontWeight: 600 }}>
                              {role.progressingCount} candidates
                            </span>
                          </td>
                          <td>
                            <span style={{ color: '#64748b' }}>
                              {role.developingCount} candidates
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            ) : null}
          </section>
        )}
      </main>
    </div>
  );
};

export default AdminTalentSearchPage;
