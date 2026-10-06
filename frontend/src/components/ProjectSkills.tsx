import React, { useEffect, useState } from 'react';

const API_BASE_URL = 'http://localhost:4300';

interface Skill {
  id: string;
  name: string;
  category: string | null;
  description: string | null;
  isActive: boolean;
}

interface ProjectSkill {
  id: string;
  skill: Skill;
}

interface ProjectSkillsProps {
  projectId: string;
}

interface StoredUser {
  id: string;
  name: string;
  email: string;
  role: 'STUDENT' | 'FACULTY' | 'ADMIN';
}

const ProjectSkills: React.FC<ProjectSkillsProps> = ({
  projectId,
}) => {
  const [projectSkills, setProjectSkills] = useState<
    ProjectSkill[]
  >([]);

  const [availableSkills, setAvailableSkills] = useState<
    Skill[]
  >([]);

  const [selectedSkillId, setSelectedSkillId] =
    useState('');

  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState('');

  const token = localStorage.getItem('token');

  const storedUser = localStorage.getItem('user');

  let currentUser: StoredUser | null = null;

  try {
    currentUser = storedUser
      ? JSON.parse(storedUser)
      : null;
  } catch {
    currentUser = null;
  }

  const canManageSkills =
    currentUser?.role === 'ADMIN' ||
    currentUser?.role === 'FACULTY';

  // ==========================================
  // FETCH PROJECT SKILLS
  // ==========================================

  const fetchProjectSkills = async () => {
    try {
      const response = await fetch(
        `${API_BASE_URL}/api/project-skills/${projectId}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.message ||
            'Failed to load project skills.'
        );
      }

      setProjectSkills(data);
    } catch (err) {
      console.error(err);

      setError(
        err instanceof Error
          ? err.message
          : 'Failed to load project skills.'
      );
    }
  };

  // ==========================================
  // FETCH AVAILABLE SKILLS
  // ==========================================

  const fetchAvailableSkills = async () => {
    // Students don't need the catalogue because
    // they cannot add project skills.
    if (!canManageSkills) {
      return;
    }

    try {
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
          data.message ||
            'Failed to load skills.'
        );
      }

      setAvailableSkills(
        data.filter(
          (skill: Skill) => skill.isActive
        )
      );
    } catch (err) {
      console.error(err);

      setError(
        err instanceof Error
          ? err.message
          : 'Failed to load available skills.'
      );
    }
  };

  // ==========================================
  // LOAD SKILLS
  // ==========================================

  const loadSkills = async () => {
    setLoading(true);
    setError('');

    await Promise.all([
      fetchProjectSkills(),
      fetchAvailableSkills(),
    ]);

    setLoading(false);
  };

  useEffect(() => {
    loadSkills();
  }, [projectId]);

  // ==========================================
  // ADD SKILL
  // ==========================================

  const handleAddSkill = async () => {
    if (!selectedSkillId || !canManageSkills) {
      return;
    }

    try {
      setAdding(true);
      setError('');

      const response = await fetch(
        `${API_BASE_URL}/api/project-skills/${projectId}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            skillId: selectedSkillId,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.message ||
            'Failed to add skill.'
        );
      }

      setProjectSkills((current) => [
        ...current,
        data,
      ]);

      setSelectedSkillId('');
    } catch (err) {
      console.error(err);

      setError(
        err instanceof Error
          ? err.message
          : 'Failed to add skill.'
      );
    } finally {
      setAdding(false);
    }
  };

  // ==========================================
  // AVAILABLE SKILLS TO ADD
  // ==========================================

  const attachedSkillIds = new Set(
    projectSkills.map(
      (projectSkill) =>
        projectSkill.skill.id
    )
  );

  const skillsToAdd =
    availableSkills.filter(
      (skill) =>
        !attachedSkillIds.has(skill.id)
    );

  // ==========================================
  // LOADING STATE
  // ==========================================

  if (loading) {
    return (
      <section className="project-skills-section">
        <div className="project-skills-header">
          <div>
            <h2>Project Skills</h2>

            <p>
              Skills associated with this project.
            </p>
          </div>
        </div>

        <div className="project-skills-loading">
          Loading skills...
        </div>
      </section>
    );
  }

  // ==========================================
  // MAIN UI
  // ==========================================

  return (
    <section className="project-skills-section">
      <div className="project-skills-header">
        <div>
          <h2>Project Skills</h2>

          <p>
            Skills students can develop through
            this project.
          </p>
        </div>

        {/* ======================================
            ADMIN / FACULTY CONTROLS
            ====================================== */}

        {canManageSkills && (
          <div className="project-skills-add">
            <select
              value={selectedSkillId}
              onChange={(e) =>
                setSelectedSkillId(
                  e.target.value
                )
              }
              disabled={
                adding ||
                skillsToAdd.length === 0
              }
            >
              <option value="">
                {skillsToAdd.length === 0
                  ? 'All skills added'
                  : 'Select a skill'}
              </option>

              {skillsToAdd.map((skill) => (
                <option
                  key={skill.id}
                  value={skill.id}
                >
                  {skill.name}
                  {skill.category
                    ? ` — ${skill.category}`
                    : ''}
                </option>
              ))}
            </select>

            <button
              type="button"
              className="project-skills-add-button"
              onClick={handleAddSkill}
              disabled={
                !selectedSkillId || adding
              }
            >
              {adding
                ? 'Adding...'
                : '+ Add Skill'}
            </button>
          </div>
        )}
      </div>

      {/* ========================================
          ERROR
          ======================================== */}

      {error && (
        <div className="project-skills-error">
          {error}
        </div>
      )}

      {/* ========================================
          EMPTY STATE
          ======================================== */}

      {projectSkills.length === 0 ? (
        <div className="project-skills-empty">
          <div className="project-skills-empty-icon">
            <i className="fa fa-award"></i>
          </div>

          <h3>No skills added yet</h3>

          <p>
            {canManageSkills
              ? 'Add relevant skills to define what students can develop through this project.'
              : 'No skills have been associated with this project yet.'}
          </p>
        </div>
      ) : (
        /* ======================================
           SKILL LIST
           ====================================== */

        <div className="project-skills-list">
          {projectSkills.map(
            (projectSkill) => (
              <div
                className="project-skill-card"
                key={projectSkill.id}
              >
                <div className="project-skill-icon">
                  <i className="fa fa-award"></i>
                </div>

                <div className="project-skill-info">
                  <h3>
                    {projectSkill.skill.name}
                  </h3>

                  {projectSkill.skill.category && (
                    <span>
                      {
                        projectSkill.skill
                          .category
                      }
                    </span>
                  )}

                  {projectSkill.skill
                    .description && (
                    <p>
                      {
                        projectSkill.skill
                          .description
                      }
                    </p>
                  )}
                </div>
              </div>
            )
          )}
        </div>
      )}
    </section>
  );
};

export default ProjectSkills;