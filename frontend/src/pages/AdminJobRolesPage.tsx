
import React, { useEffect, useState } from 'react';
import Sidebar from '../components/Sidebar';
import '../auth.css';

import { API_BASE_URL } from '../config/api';

interface Skill {
  id: string;
  name: string;
  category: string | null;
  isActive: boolean;
}

interface JobRoleSkill {
  skillId: string;
  skill: Skill;
}

interface JobRole {
  id: string;
  title: string;
  description: string | null;
  isActive: boolean;
  requiredSkills: JobRoleSkill[];
}

interface RoleForm {
  title: string;
  description: string;
  skillIds: string[];
}

const emptyForm: RoleForm = {
  title: '',
  description: '',
  skillIds: [],
};

const AdminJobRolesPage = () => {
  const [roles, setRoles] = useState<JobRole[]>([]);
  const [skills, setSkills] = useState<Skill[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<JobRole | null>(null);
  const [form, setForm] = useState<RoleForm>(emptyForm);
  const [skillSearch, setSkillSearch] = useState('');

  const token = () => localStorage.getItem('token');

  const requestHeaders = () => ({
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token()}`,
  });

  const fetchData = async () => {
    try {
      setLoading(true);
      setError('');

      const authToken = token();

      if (!authToken) {
        throw new Error('Authentication token not found.');
      }

      const [rolesResponse, skillsResponse] = await Promise.all([
        fetch(`${API_BASE_URL}/api/job-roles`, {
          headers: { Authorization: `Bearer ${authToken}` },
        }),
        fetch(`${API_BASE_URL}/api/skills`, {
          headers: { Authorization: `Bearer ${authToken}` },
        }),
      ]);

      const rolesData = await rolesResponse.json();
      const skillsData = await skillsResponse.json();

      if (!rolesResponse.ok) {
        throw new Error(rolesData.message || 'Failed to fetch job roles.');
      }

      if (!skillsResponse.ok) {
        throw new Error(skillsData.message || 'Failed to fetch skills.');
      }

      setRoles(rolesData);
      setSkills(skillsData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const openCreateModal = () => {
    setEditingRole(null);
    setForm(emptyForm);
    setSkillSearch('');
    setError('');
    setIsModalOpen(true);
  };

  const openEditModal = (role: JobRole) => {
    setEditingRole(role);
    setForm({
      title: role.title,
      description: role.description || '',
      skillIds: role.requiredSkills.map((item) => item.skillId),
    });
    setSkillSearch('');
    setError('');
    setIsModalOpen(true);
  };

  const closeModal = () => {
    if (saving) return;
    setIsModalOpen(false);
    setEditingRole(null);
    setForm(emptyForm);
    setError('');
  };

  const toggleSkill = (skillId: string) => {
    setForm((current) => ({
      ...current,
      skillIds: current.skillIds.includes(skillId)
        ? current.skillIds.filter((id) => id !== skillId)
        : [...current.skillIds, skillId],
    }));
  };

  const handleSave = async (event: React.FormEvent) => {
    event.preventDefault();

    try {
      setSaving(true);
      setError('');

      if (!token()) {
        throw new Error('Authentication token not found.');
      }

      if (form.skillIds.length === 0) {
        throw new Error('Select at least one required skill.');
      }

      const url = editingRole
        ? `${API_BASE_URL}/api/job-roles/${editingRole.id}`
        : `${API_BASE_URL}/api/job-roles`;

      const response = await fetch(url, {
        method: editingRole ? 'PUT' : 'POST',
        headers: requestHeaders(),
        body: JSON.stringify({
          title: form.title.trim(),
          description: form.description.trim() || null,
          skillIds: form.skillIds,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to save job role.');
      }

      closeModal();
      await fetchData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save job role.');
    } finally {
      setSaving(false);
    }
  };

  const toggleRoleStatus = async (role: JobRole) => {
    try {
      setError('');

      const response = await fetch(
        `${API_BASE_URL}/api/job-roles/${role.id}`,
        {
          method: 'PUT',
          headers: requestHeaders(),
          body: JSON.stringify({ isActive: !role.isActive }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to update job role.');
      }

      await fetchData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update job role.');
    }
  };

  const filteredRoles = roles.filter((role) =>
    `${role.title} ${role.description || ''}`
      .toLowerCase()
      .includes(searchTerm.toLowerCase())
  );

  const availableSkills = skills.filter(
    (skill) =>
      skill.isActive &&
      `${skill.name} ${skill.category || ''}`
        .toLowerCase()
        .includes(skillSearch.toLowerCase())
  );

  return (
    <div className="admin-page">
      <Sidebar activeTab="job-roles" />

      <main className="admin-main">
        <header className="admin-header">
          <div>
            <h1>Job Roles</h1>
            <p>
              Define the skills required for different career paths.
            </p>
          </div>

          <button
            type="button"
            className="admin-skills-add-button"
            onClick={openCreateModal}
          >
            <i className="fa fa-plus" /> Add Job Role
          </button>
        </header>

        <section className="admin-section">
          <div className="admin-section-header admin-skills-toolbar">
            <div>
              <h2>Role Catalogue</h2>
              <p className="admin-skills-section-description">
                Required skills will be used to match students to roles.
              </p>
            </div>

            <div className="admin-skills-search">
              <i className="fa fa-search" />
              <input
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Search job roles..."
              />
            </div>
          </div>

          {error && !isModalOpen && (
            <div className="admin-skills-form-error">{error}</div>
          )}

          {loading ? (
            <div className="admin-empty-state">
              <h3>Loading job roles...</h3>
              <p>Please wait while the catalogue loads.</p>
            </div>
          ) : filteredRoles.length === 0 ? (
            <div className="admin-skills-empty">
              <div className="admin-skills-empty-icon">
                <i className="fa fa-briefcase" />
              </div>
              <h3>{searchTerm ? 'No matching roles' : 'No job roles yet'}</h3>
              <p>
                {searchTerm
                  ? 'Try another search term.'
                  : 'Create a job role and select the skills it requires.'}
              </p>
              {!searchTerm && (
                <button
                  type="button"
                  className="admin-skills-add-button secondary"
                  onClick={openCreateModal}
                >
                  <i className="fa fa-plus" /> Add First Role
                </button>
              )}
            </div>
          ) : (
            <div className="admin-skills-list">
              {filteredRoles.map((role) => (
                <article
                  key={role.id}
                  className={`admin-skill-card ${!role.isActive ? 'inactive' : ''}`}
                >
                  <div className="admin-skill-icon">
                    <i className="fa fa-briefcase" />
                  </div>

                  <div className="admin-skill-content">
                    <div className="admin-skill-title-row">
                      <h3>{role.title}</h3>
                      <span
                        className={`admin-skill-status ${
                          role.isActive ? 'active' : 'inactive'
                        }`}
                      >
                        <span />
                        {role.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </div>

                    <p>{role.description || 'No description provided.'}</p>

                    <div className="job-role-skill-tags">
                      {role.requiredSkills.map(({ skill }) => (
                        <span key={skill.id}>{skill.name}</span>
                      ))}
                    </div>

                    <small>
                      {role.requiredSkills.length} required skill
                      {role.requiredSkills.length === 1 ? '' : 's'}
                    </small>
                  </div>

                  <div className="admin-skill-actions">
                    <button type="button" onClick={() => openEditModal(role)}>
                      <i className="fa fa-edit" /> Edit
                    </button>
                    <button
                      type="button"
                      className={role.isActive ? 'danger' : 'restore'}
                      onClick={() => toggleRoleStatus(role)}
                    >
                      <i className={`fa ${role.isActive ? 'fa-ban' : 'fa-check'}`} />
                      {role.isActive ? 'Deactivate' : 'Activate'}
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </main>

      {isModalOpen && (
        <div
          className="admin-skills-modal-overlay"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) closeModal();
          }}
        >
          <div className="admin-skills-modal admin-job-role-modal">
            <div className="admin-skills-modal-header">
              <div>
                <h2>{editingRole ? 'Edit Job Role' : 'Create Job Role'}</h2>
                <p>Set the role details and select its required skills.</p>
              </div>
              <button
                type="button"
                className="admin-skills-modal-close"
                onClick={closeModal}
                disabled={saving}
              >
                <i className="fa fa-times" />
              </button>
            </div>

            <form className="admin-skills-form" onSubmit={handleSave}>
              {error && (
                <div className="admin-skills-form-error">
                  <i className="fa fa-exclamation-circle" />
                  <span>{error}</span>
                </div>
              )}

              <div className="admin-skills-form-group">
                <label htmlFor="job-role-title">Role Title</label>
                <input
                  id="job-role-title"
                  value={form.title}
                  onChange={(event) =>
                    setForm({ ...form, title: event.target.value })
                  }
                  placeholder="e.g. Frontend Developer"
                  required
                />
              </div>

              <div className="admin-skills-form-group">
                <label htmlFor="job-role-description">Description</label>
                <textarea
                  id="job-role-description"
                  rows={3}
                  value={form.description}
                  onChange={(event) =>
                    setForm({ ...form, description: event.target.value })
                  }
                  placeholder="Describe the role..."
                />
              </div>

              <div className="admin-skills-form-group">
                <label>Required Skills ({form.skillIds.length} selected)</label>
                <input
                  value={skillSearch}
                  onChange={(event) => setSkillSearch(event.target.value)}
                  placeholder="Search available skills..."
                />

                <div className="job-role-skill-picker">
                  {availableSkills.length === 0 ? (
                    <p>
                      No active skills found. Add skills in the Skills Catalogue first.
                    </p>
                  ) : (
                    availableSkills.map((skill) => (
                      <label
                        key={skill.id}
                        className={`job-role-skill-option ${
                          form.skillIds.includes(skill.id) ? 'selected' : ''
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={form.skillIds.includes(skill.id)}
                          onChange={() => toggleSkill(skill.id)}
                        />
                        <span>
                          <strong>{skill.name}</strong>
                          <small>{skill.category || 'General'}</small>
                        </span>
                      </label>
                    ))
                  )}
                </div>
              </div>

              <div className="admin-skills-form-actions">
                <button
                  type="button"
                  className="admin-skills-cancel-button"
                  onClick={closeModal}
                  disabled={saving}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="admin-skills-save-button"
                  disabled={saving}
                >
                  {saving
                    ? 'Saving...'
                    : editingRole
                      ? 'Save Changes'
                      : 'Create Job Role'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminJobRolesPage;
