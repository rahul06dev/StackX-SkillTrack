import React, { useEffect, useState } from 'react';
import Sidebar from '../components/Sidebar';
import '../auth.css';

const API_BASE_URL = 'http://localhost:4300';

interface Skill {
  id: string;
  name: string;
  category: string | null;
  description: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

interface SkillFormData {
  name: string;
  category: string;
  description: string;
}

const emptyForm: SkillFormData = {
  name: '',
  category: '',
  description: '',
};

const AdminSkillsPage = () => {
  const [skills, setSkills] = useState<Skill[]>([]);
  const [loading, setLoading] = useState(true);

  const [isModalOpen, setIsModalOpen] =
    useState(false);

  const [editingSkill, setEditingSkill] =
    useState<Skill | null>(null);

  const [formData, setFormData] =
    useState<SkillFormData>(emptyForm);

  const [saving, setSaving] = useState(false);

  const [searchTerm, setSearchTerm] =
    useState('');

  const [error, setError] = useState('');

  // ================================
  // Fetch Skills
  // ================================

  const fetchSkills = async () => {
    try {
      setLoading(true);
      setError('');

      const token = localStorage.getItem('token');

      if (!token) {
        throw new Error(
          'Authentication token not found.'
        );
      }

      const response = await fetch(
        `${API_BASE_URL}/api/skills`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.message || 'Failed to fetch skills.'
        );
      }

      setSkills(data);
    } catch (error) {
      console.error(
        '❌ Error fetching skills:',
        error
      );

      setError(
        error instanceof Error
          ? error.message
          : 'Failed to load skills.'
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSkills();
  }, []);

  // ================================
  // Modal
  // ================================

  const openAddModal = () => {
    setEditingSkill(null);
    setFormData(emptyForm);
    setError('');
    setIsModalOpen(true);
  };

  const openEditModal = (skill: Skill) => {
    setEditingSkill(skill);

    setFormData({
      name: skill.name,
      category: skill.category || '',
      description: skill.description || '',
    });

    setError('');
    setIsModalOpen(true);
  };

  const closeModal = () => {
    if (saving) return;

    setIsModalOpen(false);
    setEditingSkill(null);
    setFormData(emptyForm);
  };

  // ================================
  // Save Skill
  // ================================

  const handleSave = async (
    event: React.FormEvent
  ) => {
    event.preventDefault();

    try {
      setSaving(true);
      setError('');

      const token = localStorage.getItem('token');

      if (!token) {
        throw new Error(
          'Authentication token not found.'
        );
      }

      const url = editingSkill
        ? `${API_BASE_URL}/api/skills/${editingSkill.id}`
        : `${API_BASE_URL}/api/skills`;

      const method = editingSkill
        ? 'PUT'
        : 'POST';

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: formData.name.trim(),
          category:
            formData.category.trim() || null,
          description:
            formData.description.trim() || null,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.message || 'Failed to save skill.'
        );
      }

      setIsModalOpen(false);
      setEditingSkill(null);
      setFormData(emptyForm);

      await fetchSkills();
    } catch (error) {
      console.error(
        '❌ Error saving skill:',
        error
      );

      setError(
        error instanceof Error
          ? error.message
          : 'Failed to save skill.'
      );
    } finally {
      setSaving(false);
    }
  };

  // ================================
  // Toggle Skill Status
  // ================================

  const handleToggleStatus = async (
    skill: Skill
  ) => {
    try {
      const token = localStorage.getItem('token');

      if (!token) {
        throw new Error(
          'Authentication token not found.'
        );
      }

      const response = await fetch(
        `${API_BASE_URL}/api/skills/${skill.id}`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            isActive: !skill.isActive,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.message ||
            'Failed to update skill status.'
        );
      }

      await fetchSkills();
    } catch (error) {
      console.error(
        '❌ Error updating skill status:',
        error
      );

      alert(
        error instanceof Error
          ? error.message
          : 'Failed to update skill status.'
      );
    }
  };

  // ================================
  // Search
  // ================================

  const filteredSkills = skills.filter(
    (skill) => {
      const search =
        searchTerm.toLowerCase();

      return (
        skill.name
          .toLowerCase()
          .includes(search) ||
        skill.category
          ?.toLowerCase()
          .includes(search) ||
        skill.description
          ?.toLowerCase()
          .includes(search)
      );
    }
  );

  return (
    <div className="admin-page">

      <Sidebar activeTab="skills" />

      <main className="admin-main">

        {/* Header */}
        <header className="admin-header">

          <div>
            <h1>Skills</h1>

            <p>
              Manage the master skill catalogue used
              across SkillTrack.
            </p>
          </div>

          <button
            type="button"
            className="admin-skills-add-button"
            onClick={openAddModal}
          >
            <i className="fa fa-plus"></i>
            Add Skill
          </button>

        </header>

        {/* Skill Catalogue */}
        <section className="admin-section">

          <div className="admin-section-header admin-skills-toolbar">

            <div>
              <h2>Skill Catalogue</h2>

              <p className="admin-skills-section-description">
                Keep skills standardized so they can
                be linked to projects and student
                profiles.
              </p>
            </div>

            <div className="admin-skills-search">
              <i className="fa fa-search"></i>

              <input
                type="text"
                placeholder="Search skills..."
                value={searchTerm}
                onChange={(event) =>
                  setSearchTerm(
                    event.target.value
                  )
                }
              />
            </div>

          </div>

          {loading ? (
            <div className="admin-empty-state">
              <h3>Loading skills...</h3>

              <p>
                Please wait while the skill catalogue
                is being loaded.
              </p>
            </div>
          ) : filteredSkills.length === 0 ? (
            <div className="admin-skills-empty">

              <div className="admin-skills-empty-icon">
                <i className="fa fa-award"></i>
              </div>

              <h3>
                {searchTerm
                  ? 'No matching skills'
                  : 'No skills yet'}
              </h3>

              <p>
                {searchTerm
                  ? 'Try a different search term.'
                  : 'Add your first skill to start building the catalogue.'}
              </p>

              {!searchTerm && (
                <button
                  type="button"
                  className="admin-skills-add-button secondary"
                  onClick={openAddModal}
                >
                  <i className="fa fa-plus"></i>
                  Add First Skill
                </button>
              )}

            </div>
          ) : (
            <div className="admin-skills-list">

              {filteredSkills.map((skill) => (
                <div
                  key={skill.id}
                  className={`admin-skill-card ${
                    !skill.isActive
                      ? 'inactive'
                      : ''
                  }`}
                >

                  <div className="admin-skill-icon">
                    <i className="fa fa-award"></i>
                  </div>

                  <div className="admin-skill-content">

                    <div className="admin-skill-title-row">

                      <h3>
                        {skill.name}
                      </h3>

                      <span
                        className={`admin-skill-status ${
                          skill.isActive
                            ? 'active'
                            : 'inactive'
                        }`}
                      >
                        <span></span>
                        {skill.isActive
                          ? 'Active'
                          : 'Inactive'}
                      </span>

                    </div>

                    <div className="admin-skill-category">
                      {skill.category ||
                        'Uncategorized'}
                    </div>

                    <p>
                      {skill.description ||
                        'No description provided.'}
                    </p>

                  </div>

                  <div className="admin-skill-actions">

                    <button
                      type="button"
                      onClick={() =>
                        openEditModal(skill)
                      }
                    >
                      <i className="fa fa-edit"></i>
                      Edit
                    </button>

                    <button
                      type="button"
                      className={
                        skill.isActive
                          ? 'danger'
                          : 'restore'
                      }
                      onClick={() =>
                        handleToggleStatus(skill)
                      }
                    >
                      <i
                        className={`fa ${
                          skill.isActive
                            ? 'fa-ban'
                            : 'fa-check'
                        }`}
                      ></i>

                      {skill.isActive
                        ? 'Disable'
                        : 'Activate'}
                    </button>

                  </div>

                </div>
              ))}

            </div>
          )}

        </section>

      </main>

      {/* Add / Edit Modal */}
      {isModalOpen && (
        <div
          className="admin-skills-modal-overlay"
          onMouseDown={(event) => {
            if (
              event.target ===
              event.currentTarget
            ) {
              closeModal();
            }
          }}
        >

          <div className="admin-skills-modal">

            <div className="admin-skills-modal-header">

              <div>
                <h2>
                  {editingSkill
                    ? 'Edit Skill'
                    : 'Add Skill'}
                </h2>

                <p>
                  {editingSkill
                    ? 'Update this skill in the master catalogue.'
                    : 'Add a standardized skill to SkillTrack.'}
                </p>
              </div>

              <button
                type="button"
                className="admin-skills-modal-close"
                onClick={closeModal}
                disabled={saving}
              >
                <i className="fa fa-times"></i>
              </button>

            </div>

            <form
              className="admin-skills-form"
              onSubmit={handleSave}
            >

              {error && (
                <div className="admin-skills-form-error">
                  <i className="fa fa-exclamation-circle"></i>
                  <span>{error}</span>
                </div>
              )}

              <div className="admin-skills-form-group">

                <label htmlFor="skill-name">
                  Skill Name
                </label>

                <input
                  id="skill-name"
                  type="text"
                  placeholder="e.g. React"
                  value={formData.name}
                  onChange={(event) =>
                    setFormData({
                      ...formData,
                      name: event.target.value,
                    })
                  }
                  required
                />

              </div>

              <div className="admin-skills-form-group">

                <label htmlFor="skill-category">
                  Category
                </label>

                <input
                  id="skill-category"
                  type="text"
                  placeholder="e.g. Frontend"
                  value={formData.category}
                  onChange={(event) =>
                    setFormData({
                      ...formData,
                      category:
                        event.target.value,
                    })
                  }
                />

              </div>

              <div className="admin-skills-form-group">

                <label htmlFor="skill-description">
                  Description
                </label>

                <textarea
                  id="skill-description"
                  placeholder="Briefly describe this skill..."
                  value={
                    formData.description
                  }
                  onChange={(event) =>
                    setFormData({
                      ...formData,
                      description:
                        event.target.value,
                    })
                  }
                  rows={4}
                />

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
                  {saving ? (
                    'Saving...'
                  ) : (
                    <>
                      <i className="fa fa-check"></i>
                      {editingSkill
                        ? 'Save Changes'
                        : 'Add Skill'}
                    </>
                  )}
                </button>

              </div>

            </form>

          </div>

        </div>
      )}

    </div>
  );
};

export default AdminSkillsPage;