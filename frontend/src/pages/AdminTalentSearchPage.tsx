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

  // Skill selection helpers & filters
  const [skillSearchQuery, setSkillSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');

  const token = localStorage.getItem('token');

  // Helper for student initials
  const getInitials = (name: string | null) => {
    if (!name) return 'ST';
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
    return name.slice(0, 2).toUpperCase();
  };

  // Helper for dynamic avatar gradient
  const getAvatarGradient = (name: string | null) => {
    const gradients = [
      'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)',
      'linear-gradient(135deg, #0ea5e9 0%, #0284c7 100%)',
      'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)',
      'linear-gradient(135deg, #10b981 0%, #059669 100%)',
      'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
      'linear-gradient(135deg, #ec4899 0%, #be185d 100%)',
    ];
    if (!name) return gradients[0];
    let hash = 0;
    for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
    return gradients[Math.abs(hash) % gradients.length];
  };

  // Filter available skills based on search term and category
  const filteredSkills = availableSkills.filter((s) => {
    const matchesSearch = s.name.toLowerCase().includes(skillSearchQuery.toLowerCase());
    const matchesCategory = selectedCategory === 'All' || s.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  // Extract unique categories from skills
  const categories = ['All', ...Array.from(new Set(availableSkills.map((s) => s.category).filter(Boolean))) as string[]];

  // Get currently selected role object for live preview
  const selectedRole = roles.find((r) => r.id === selectedRoleId);

  const handleResetFilters = () => {
    setSelectedRoleId('');
    setSelectedSkillIds([]);
    setMatchMode('ALL_DEMONSTRATED');
    setMinMatch('0');
    setSearchQuery('');
    setDepartmentFilter('');
    setGradYearFilter('');
    setResults(null);
    setError('');
    setExpandedStudent(null);
  };

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
            <span className="talent-eyebrow">
              <i className="fa fa-crosshairs"></i> INSTITUTIONAL PLACEMENT INTELLIGENCE
            </span>
            <h1>Talent Search & Skill Analytics</h1>
            <p>
              Match student competencies against industry roles, evaluate faculty-verified skills, and identify curriculum skill gaps.
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
            <section className="talent-search-panel">
              <div className="admin-section-header" style={{ marginBottom: '16px' }}>
                <div>
                  <h2 style={{ fontSize: '1.2rem', fontWeight: 800, margin: 0, color: '#0f172a' }}>
                    Search & Rank Candidates
                  </h2>
                  <p style={{ margin: '4px 0 0 0', fontSize: '12.5px', color: '#64748b' }}>
                    Configure target competencies, verification modes, and candidate filters to find high-fit students.
                  </p>
                </div>
              </div>

              <form className="talent-search-form" onSubmit={handleSearch}>
                {/* Search Target Mode Selector (Modern Segmented Cards) */}
                <div className="talent-mode-switcher">
                  <div
                    className={`talent-mode-card ${searchTargetType === 'role' ? 'selected' : ''}`}
                    onClick={() => setSearchTargetType('role')}
                    role="button"
                    tabIndex={0}
                  >
                    <div className="talent-mode-icon">
                      <i className="fa fa-briefcase"></i>
                    </div>
                    <div className="talent-mode-text">
                      <h4>Search by Industry Job Role</h4>
                      <p>Match against standardized profiles like Full Stack Developer, ML Engineer, etc.</p>
                    </div>
                  </div>

                  <div
                    className={`talent-mode-card ${searchTargetType === 'skills' ? 'selected' : ''}`}
                    onClick={() => setSearchTargetType('skills')}
                    role="button"
                    tabIndex={0}
                  >
                    <div className="talent-mode-icon">
                      <i className="fa fa-bullseye"></i>
                    </div>
                    <div className="talent-mode-text">
                      <h4>Search by Specific Competencies</h4>
                      <p>Pick custom combinations of languages, frameworks, or database skills.</p>
                    </div>
                  </div>
                </div>

                {/* Primary Target Selection */}
                {searchTargetType === 'role' ? (
                  <div className="talent-role-field">
                    <label className="talent-field-label" htmlFor="talent-job-role">
                      <span>Target Job Role *</span>
                      {selectedRole && (
                        <span style={{ color: '#4f46e5', textTransform: 'none', fontWeight: 600 }}>
                          {selectedRole.requiredSkills.length} required competencies
                        </span>
                      )}
                    </label>
                    <select
                      id="talent-job-role"
                      className="talent-select"
                      value={selectedRoleId}
                      onChange={(e) => setSelectedRoleId(e.target.value)}
                      disabled={loadingData || searching}
                      required
                    >
                      <option value="">{loadingData ? 'Loading roles...' : '— Select an Industry Job Role —'}</option>
                      {roles.map((role) => (
                        <option key={role.id} value={role.id}>
                          {role.title} ({role.requiredSkills.length} required skills)
                        </option>
                      ))}
                    </select>

                    {/* Live Preview of Required Skills */}
                    {selectedRole && selectedRole.requiredSkills.length > 0 && (
                      <div className="talent-role-preview-box">
                        <div className="talent-role-preview-header">
                          <span>Required Competencies for {selectedRole.title}:</span>
                        </div>
                        <div className="talent-preview-chips">
                          {selectedRole.requiredSkills.map((rs) => (
                            <span key={rs.skillId} className="talent-preview-chip">
                              <i className="fa fa-check" style={{ fontSize: '10px', marginRight: '4px' }}></i>
                              {rs.skill?.name || 'Skill'}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="talent-role-field">
                    <div className="talent-field-label">
                      <span>Select Required Competencies ({selectedSkillIds.length} Selected) *</span>
                      {selectedSkillIds.length > 0 && (
                        <button
                          type="button"
                          onClick={() => setSelectedSkillIds([])}
                          style={{
                            background: 'none',
                            border: 'none',
                            color: '#ef4444',
                            fontSize: '11px',
                            fontWeight: 700,
                            cursor: 'pointer',
                            textTransform: 'none',
                          }}
                        >
                          Clear Selection
                        </button>
                      )}
                    </div>

                    <div className="talent-competency-picker">
                      {/* Search & Category Filter Controls */}
                      <div className="talent-picker-controls">
                        <input
                          type="text"
                          className="talent-skill-search-input"
                          placeholder="Search competencies (e.g. React, Python, Docker)..."
                          value={skillSearchQuery}
                          onChange={(e) => setSkillSearchQuery(e.target.value)}
                        />
                        <div className="talent-category-pills">
                          {categories.map((cat) => (
                            <button
                              type="button"
                              key={cat}
                              className={`talent-category-pill ${selectedCategory === cat ? 'active' : ''}`}
                              onClick={() => setSelectedCategory(cat)}
                            >
                              {cat}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Interactive Skills Cloud */}
                      <div className="talent-skills-cloud">
                        {filteredSkills.length === 0 ? (
                          <div style={{ padding: '10px', fontSize: '12px', color: '#94a3b8' }}>
                            No competencies match your search query.
                          </div>
                        ) : (
                          filteredSkills.map((s) => {
                            const isSelected = selectedSkillIds.includes(s.id);
                            return (
                              <button
                                type="button"
                                key={s.id}
                                className={`talent-skill-toggle-btn ${isSelected ? 'selected' : ''}`}
                                onClick={() => toggleSkillSelection(s.id)}
                              >
                                <span>{isSelected ? '✓' : '+'}</span>
                                {s.name}
                              </button>
                            );
                          })
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* Secondary Filters Section */}
                <div className="talent-filters-section">
                  <div className="talent-filters-header">
                    <span>
                      <i className="fa fa-sliders-h"></i> Candidate Filters & Verification Thresholds
                    </span>
                  </div>
                  <div className="talent-filters-grid">
                    <div className="talent-filter-field">
                      <label>Verification Filter</label>
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
                      <label>Student Search</label>
                      <input
                        type="text"
                        className="talent-filter-input"
                        placeholder="Name or PRN..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                      />
                    </div>

                    <div className="talent-filter-field">
                      <label>Department</label>
                      <input
                        type="text"
                        className="talent-filter-input"
                        placeholder="e.g. Computer Science"
                        value={departmentFilter}
                        onChange={(e) => setDepartmentFilter(e.target.value)}
                      />
                    </div>

                    <div className="talent-filter-field">
                      <label>Graduation Batch</label>
                      <input
                        type="text"
                        className="talent-filter-input"
                        placeholder="e.g. 2026"
                        value={gradYearFilter}
                        onChange={(e) => setGradYearFilter(e.target.value)}
                      />
                    </div>
                  </div>
                </div>

                {/* Actions Row */}
                <div className="talent-actions-row">
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
                  <button
                    type="button"
                    className="talent-reset-btn"
                    onClick={handleResetFilters}
                    disabled={searching}
                  >
                    <i className="fa fa-undo"></i> Reset Filters
                  </button>
                  <span className="talent-filter-hint">
                    <i className="fa fa-info-circle"></i> Evaluates students across faculty-verified competencies and project deliverables
                  </span>
                </div>
              </form>
            </section>

            {/* Results Section */}
            {results && (
              <section className="talent-results-section">
                <div className="talent-results-meta">
                  <div>
                    <h3>{results.targetTitle}</h3>
                    {results.targetDescription && <p>{results.targetDescription}</p>}
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                      <span className="talent-meta-pill">
                        <i className="fa fa-users"></i> {results.totalCandidatesMatched} Candidate(s) Found
                      </span>
                      <span className="talent-meta-pill">
                        <i className="fa fa-chart-line"></i> {results.totalStudentsEvaluated} Evaluated
                      </span>
                      {results.verificationNote && (
                        <span style={{ fontSize: '11.5px', color: '#64748b' }}>
                          · {results.verificationNote}
                        </span>
                      )}
                    </div>
                  </div>
                  <span className="talent-req-count">
                    <i className="fa fa-layer-group"></i>
                    {results.totalRequiredSkills} Required Competenc{results.totalRequiredSkills === 1 ? 'y' : 'ies'}
                  </span>
                </div>

                {results.students.length === 0 ? (
                  <div className="student-empty-state" style={{ padding: '40px 20px', textAlign: 'center' }}>
                    <i className="fa fa-user-slash" style={{ fontSize: '32px', color: '#94a3b8', marginBottom: '12px' }}></i>
                    <h3>No matching candidates found</h3>
                    <p>Try lowering the Minimum Match % threshold or switching the filter mode to "Verified + Project Exposure".</p>
                  </div>
                ) : (
                  <div className="talent-cards-grid">
                    {results.students.map((student, index) => {
                      const isExpanded = expandedStudent === student.id;
                      const matchClass =
                        student.matchPercentage >= 75
                          ? 'match-high'
                          : student.matchPercentage >= 50
                          ? 'match-medium'
                          : 'match-low';

                      const badgeClass =
                        student.matchPercentage >= 75
                          ? 'high'
                          : student.matchPercentage >= 50
                          ? 'medium'
                          : 'low';

                      return (
                        <article key={student.id} className={`talent-student-card ${matchClass}`}>
                          {/* Student Header */}
                          <div className="talent-student-header">
                            <div className="talent-student-identity">
                              <div
                                className="talent-student-avatar"
                                style={{ background: getAvatarGradient(student.name) }}
                              >
                                {getInitials(student.name)}
                              </div>
                              <div className="talent-student-info">
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                                  <span className="talent-rank-pill">#{index + 1} RANK</span>
                                  <h3>{student.name}</h3>
                                </div>
                                <p className="talent-student-email">{student.email}</p>

                                {student.headline && (
                                  <p className="talent-student-headline">
                                    {student.headline}
                                  </p>
                                )}

                                <div className="talent-student-tags">
                                  {student.studentIdNo && (
                                    <span className="talent-meta-pill">
                                      <i className="fa fa-id-card"></i> PRN: {student.studentIdNo}
                                    </span>
                                  )}
                                  {student.department && (
                                    <span className="talent-meta-pill">
                                      <i className="fa fa-graduation-cap"></i> {student.department}
                                    </span>
                                  )}
                                  {student.graduationYear && (
                                    <span className="talent-meta-pill">
                                      <i className="fa fa-calendar-alt"></i> Batch {student.graduationYear}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>

                            {/* Match Score Gauge */}
                            <div className="talent-match-box">
                              <div className={`talent-match-badge ${badgeClass}`}>
                                <i className="fa fa-percentage"></i> {student.matchPercentage}% MATCH
                              </div>
                              <span className="talent-verified-subtext">
                                <i className="fa fa-check-circle"></i> {student.verifiedMatchCount} Faculty-Verified
                              </span>
                            </div>
                          </div>

                          {/* Action Bar */}
                          <div className="talent-card-subnav">
                            <span style={{ fontSize: '12px', color: '#64748b', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                              <i className="fa fa-folder-open" style={{ color: '#4f46e5' }}></i>
                              <strong>{student.totalProjects}</strong> Academic Project{student.totalProjects === 1 ? '' : 's'}
                            </span>
                            <button
                              type="button"
                              className="talent-passport-btn"
                              onClick={() => navigate(`/portfolio/${student.shareableSlug || student.id}`)}
                            >
                              <i className="fa fa-id-badge"></i> View Digital Portfolio ↗
                            </button>
                          </div>

                          {/* Skills Breakdown */}
                          <div className="talent-skill-preview">
                            <div className="talent-skill-group">
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
                                          <i className="fa fa-check-circle"></i>
                                          {skill.name} <strong style={{ marginLeft: '2px' }}>({skill.level || 'VERIFIED'})</strong>
                                        </>
                                      ) : (
                                        <>
                                          <i className="fa fa-code-branch"></i>
                                          {skill.name} <small style={{ opacity: 0.8 }}>(Exposure)</small>
                                        </>
                                      )}
                                    </span>
                                  ))
                                ) : (
                                  <small style={{ color: '#94a3b8' }}>No required competencies matched yet.</small>
                                )}
                              </div>
                            </div>

                            {student.missingSkills.length > 0 && (
                              <div className="talent-skill-group">
                                <span className="talent-skill-label">Competencies to Develop</span>
                                <div className="talent-skill-tags">
                                  {student.missingSkills.map((skill) => (
                                    <span className="talent-skill-missing-tag" key={skill.id}>
                                      <i className="fa fa-plus-circle" style={{ opacity: 0.6 }}></i> {skill.name}
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
                          >
                            <span>
                              <i className="fa fa-shield-alt" style={{ marginRight: '6px' }}></i>
                              {isExpanded ? 'Hide Supporting Project Evidence' : 'View Supporting Project Evidence'}
                            </span>
                            <i className={`fa fa-chevron-${isExpanded ? 'up' : 'down'}`}></i>
                          </button>

                          {isExpanded && (
                            <div className="talent-evidence-panel">
                              {student.matchedSkills.length === 0 ? (
                                <p style={{ margin: 0, fontSize: '12px', color: '#64748b' }}>
                                  No project evidence linked for required skills.
                                </p>
                              ) : (
                                student.matchedSkills.map((skill) => (
                                  <div className="talent-evidence-skill" key={skill.id}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                      <strong style={{ fontSize: '13px', color: '#1e293b' }}>
                                        {skill.name}
                                      </strong>
                                      {skill.isVerified && skill.verifiedBy && (
                                        <small style={{ color: '#059669', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                          <i className="fa fa-check-circle"></i> Verified by {skill.verifiedBy.name}
                                        </small>
                                      )}
                                    </div>
                                    {skill.feedback && (
                                      <p style={{ margin: '6px 0', fontSize: '11.5px', fontStyle: 'italic', color: '#166534', background: '#f0fdf4', padding: '6px 10px', borderRadius: '6px' }}>
                                        &ldquo;{skill.feedback}&rdquo;
                                      </p>
                                    )}

                                    <div className="talent-evidence-projects">
                                      {skill.projects.map((proj) => (
                                        <div className="talent-evidence-project" key={`${skill.id}-${proj.id}`}>
                                          <i className="fa fa-folder-open" style={{ color: '#6366f1' }}></i>
                                          <span style={{ fontWeight: 600, color: '#334155' }}>{proj.title}</span>
                                          <small style={{ background: '#e2e8f0', padding: '1px 6px', borderRadius: '4px', textTransform: 'capitalize' }}>
                                            {proj.status.toLowerCase().replace(/_/g, ' ')}
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
                )}
              </section>
            )}
          </>
        )}

        {/* ─────────────────────────────────────────────────────────────
            TAB 2: UNIVERSITY SKILL GAP & READINESS ANALYTICS
           ───────────────────────────────────────────────────────────── */}
        {activeTab === 'analytics' && (
          <section>
            {loadingAnalytics ? (
              <div className="portfolio-loading" style={{ textAlign: 'center', padding: '60px 20px' }}>
                <i className="fa fa-spinner fa-spin" style={{ fontSize: '28px', color: '#4f46e5' }}></i>
                <p style={{ marginTop: '12px', fontSize: '14px', color: '#64748b' }}>
                  Computing university-wide skill gap and readiness analytics...
                </p>
              </div>
            ) : analytics ? (
              <>
                {/* Metrics Summary Row */}
                <div className="analytics-metrics-row">
                  <div className="analytics-metric-card">
                    <div className="analytics-metric-icon indigo">
                      <i className="fa fa-user-graduate"></i>
                    </div>
                    <div className="analytics-metric-content">
                      <h4>Total Active Students</h4>
                      <div className="analytics-metric-val">{analytics.totalStudents}</div>
                    </div>
                  </div>

                  <div className="analytics-metric-card">
                    <div className="analytics-metric-icon emerald">
                      <i className="fa fa-briefcase"></i>
                    </div>
                    <div className="analytics-metric-content">
                      <h4>Industry Job Roles</h4>
                      <div className="analytics-metric-val">{analytics.totalJobRoles}</div>
                    </div>
                  </div>

                  <div className="analytics-metric-card">
                    <div className="analytics-metric-icon amber">
                      <i className="fa fa-award"></i>
                    </div>
                    <div className="analytics-metric-content">
                      <h4>Catalogue Competencies</h4>
                      <div className="analytics-metric-val">{analytics.totalActiveSkills}</div>
                    </div>
                  </div>
                </div>

                {/* Top Shortages & Top Competencies Split Grid */}
                <div className="analytics-split-grid">
                  {/* Top Shortages Card */}
                  <div className="analytics-card">
                    <div className="analytics-card-header">
                      <i className="fa fa-exclamation-triangle" style={{ color: '#ef4444', fontSize: '18px' }}></i>
                      <h3>Top Institutional Skill Shortages</h3>
                    </div>
                    <p>High industry demand competencies with a shortage of verified student candidates.</p>

                    {analytics.topShortages.length === 0 ? (
                      <p style={{ color: '#94a3b8' }}>No critical skill shortages identified.</p>
                    ) : (
                      analytics.topShortages.map((s) => (
                        <div key={s.id} className="gap-bar-container">
                          <div className="gap-bar-header">
                            <span>{s.name} <small style={{ color: '#64748b' }}>({s.category})</small></span>
                            <span style={{ color: '#ef4444' }}>{s.gapPercentage}% Shortage Gap</span>
                          </div>
                          <div className="gap-bar-track">
                            <div
                              className="gap-bar-fill"
                              style={{ width: `${s.gapPercentage}%` }}
                            ></div>
                          </div>
                          <div className="gap-bar-subinfo">
                            <span><i className="fa fa-briefcase"></i> Required in {s.requiredInRoles} role(s)</span>
                            <span>{s.verifiedStudents} verified · {s.exposureStudents} exposure</span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>

                  {/* Top Verified Competencies */}
                  <div className="analytics-card">
                    <div className="analytics-card-header">
                      <i className="fa fa-award" style={{ color: '#10b981', fontSize: '18px' }}></i>
                      <h3>Top Faculty-Verified Competencies</h3>
                    </div>
                    <p>Most widely verified skills across supervised student projects and coursework.</p>

                    {analytics.topVerified.map((s) => (
                      <div key={s.id} className="gap-bar-container">
                        <div className="gap-bar-header">
                          <span>{s.name} <small style={{ color: '#64748b' }}>({s.category})</small></span>
                          <span style={{ color: '#059669' }}>{s.verifiedStudents} Verified</span>
                        </div>
                        <div className="gap-bar-track">
                          <div
                            className="gap-bar-fill safe"
                            style={{
                              width: `${Math.min(100, (s.verifiedStudents / Math.max(1, analytics.totalStudents)) * 100)}%`,
                            }}
                          ></div>
                        </div>
                        <div className="gap-bar-subinfo">
                          <span>{s.exposureStudents} with project exposure</span>
                          <span>In {s.requiredInRoles} target role(s)</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Job Role Placement Pipeline Table */}
                <div className="analytics-card">
                  <div className="analytics-card-header">
                    <i className="fa fa-table" style={{ color: '#4f46e5', fontSize: '18px' }}></i>
                    <h3>Industry Role Readiness Pipeline</h3>
                  </div>
                  <p>Distribution of student candidates ready for immediate placement vs progressing.</p>

                  <div className="talent-table-container">
                    <table className="talent-table">
                      <thead>
                        <tr>
                          <th>Job Role</th>
                          <th>Required Skills</th>
                          <th>Ready (&ge; 80% Match)</th>
                          <th>Progressing (50–79%)</th>
                          <th>Developing (&lt; 50%)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {analytics.roleReadiness.map((role) => (
                          <tr key={role.id}>
                            <td>
                              <strong>{role.title}</strong>
                            </td>
                            <td>
                              <span className="talent-meta-pill">{role.totalRequiredSkills} Skills</span>
                            </td>
                            <td>
                              <span style={{ color: '#16a34a', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                <i className="fa fa-check-circle"></i> {role.readyCount} candidates
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
