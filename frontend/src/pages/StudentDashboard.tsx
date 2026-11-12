import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import '../auth.css';

const StudentDashboard = () => {
  const navigate = useNavigate();

  const userData = localStorage.getItem('user');
  const user = userData ? JSON.parse(userData) : null;

  interface Project {
    id: string;
    title: string;
    description: string;
    tasks: number;
    members: number;
    status: string;
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

  interface ProfileSkill {
    id: string;
    name: string;
    category: string | null;
    description: string | null;
    projects: SkillProject[];
  }

  const [projects, setProjects] = useState<Project[]>([]);
  const [loadingProjects, setLoadingProjects] = useState(true);

  const [newTasks, setNewTasks] = useState<NewTask[]>([]);
  const [loadingNewTasks, setLoadingNewTasks] = useState(true);

  const [upcomingDeadlines, setUpcomingDeadlines] =
    useState<UpcomingDeadline[]>([]);

  const [loadingDeadlines, setLoadingDeadlines] =
    useState(true);

  const [skills, setSkills] = useState<ProfileSkill[]>([]);
  const [loadingSkills, setLoadingSkills] = useState(true);

  useEffect(() => {

    const fetchProjects = async () => {
      try {
        const token = localStorage.getItem('token');

        if (!token) {
          throw new Error('Authentication token not found');
        }

        const response = await fetch(
          'http://localhost:4300/api/projects',
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
        console.error('Failed to load student projects:', error);
      } finally {
        setLoadingProjects(false);
      }
    };

    fetchProjects();
  }, []);

  useEffect(() => {
    const fetchNewTasks = async () => {
      try {
        const token = localStorage.getItem('token');

        if (!token) {
          throw new Error('Authentication token not found');
        }

        const response = await fetch(
          'http://localhost:4300/api/tasks/student/new',
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        if (!response.ok) {
          throw new Error('Failed to fetch new tasks');
        }

        const data: NewTask[] = await response.json();

        setNewTasks(data);
      } catch (error) {
        console.error(
          'Failed to load student new tasks:',
          error
        );

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

        if (!token) {
          throw new Error('Authentication token not found');
        }

        const response = await fetch(
          'http://localhost:4300/api/tasks/student/deadlines',
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        if (!response.ok) {
          throw new Error('Failed to fetch upcoming deadlines');
        }

        const data: UpcomingDeadline[] =
          await response.json();

        setUpcomingDeadlines(data);
      } catch (error) {
        console.error(
          'Failed to load upcoming deadlines:',
          error
        );

        setUpcomingDeadlines([]);
      } finally {
        setLoadingDeadlines(false);
      }
    };

    fetchUpcomingDeadlines();
  }, []);

  useEffect(() => {
    const fetchSkills = async () => {
      try {
        const token = localStorage.getItem('token');

        if (!token) {
          throw new Error('Authentication token not found');
        }

        const response = await fetch(
          'http://localhost:4300/api/student-skills/me',
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        if (!response.ok) {
          throw new Error('Failed to fetch student skills');
        }

        const data = await response.json();
        setSkills(data.skills ?? []);
      } catch (error) {
        console.error('Failed to load student skills:', error);
        setSkills([]);
      } finally {
        setLoadingSkills(false);
      }
    };

    fetchSkills();
  }, []);

  return (
    <div className="student-page">

      {/* Sidebar */}
      <Sidebar activeTab="dashboard" />

      {/* Main Content */}
      <main className="student-main">

        {/* Header */}
        <header className="student-header">
          <div>
            <h1>
              Welcome back, {user?.name || 'Student'}!
            </h1>

            <p>
              Track your projects, skills, and progress from one place.
            </p>
          </div>

          <div className="student-profile">
            <span>{user?.name || 'Student'}</span>
          </div>
        </header>

        {/* Statistics */}
        <section className="student-stats">

          <div className="student-stat-card">
            <h3>Total Projects</h3>
            <p>{projects.length}</p>
          </div>

          <div className="student-stat-card">
            <h3>Active Projects</h3>
            <p>
              {projects.filter(
                (project) => project.status !== 'COMPLETED'
              ).length}
            </p>
          </div>

          <div className="student-stat-card">
            <h3>Completed</h3>
            <p>
              {projects.filter(
                (project) => project.status === 'COMPLETED'
              ).length}
            </p>
          </div>

          <div className="student-stat-card">
            <h3>Skills</h3>
            <p>{loadingSkills ? '...' : skills.length}</p>
          </div>

        </section>

        {/* Skills Profile */}
        <section className="student-section">
          <div className="student-section-header">
            <div>
              <h2>My Skills</h2>
              <p className="skills-section-subtitle">
                Skills connected to your assigned projects.
              </p>
            </div>
          </div>

          {loadingSkills ? (
            <div className="student-empty-state">
              <h3>Loading your skills...</h3>
              <p>Your skills profile is being prepared.</p>
            </div>
          ) : skills.length === 0 ? (
            <div className="student-empty-state">
              <h3>No skills mapped yet</h3>
              <p>
                Skills will appear here when they match the
                catalogue skills associated with your projects.
              </p>
            </div>
          ) : (
            <div className="student-skills-grid">
              {skills.map((skill) => (
                <article className="student-skill-card" key={skill.id}>
                  <div className="student-skill-card-top">
                    <div className="student-skill-icon">
                      <i className="fa fa-code"></i>
                    </div>

                    <span className="student-skill-category">
                      {skill.category || 'General'}
                    </span>
                  </div>

                  <h3>{skill.name}</h3>

                  <p className="student-skill-description">
                    {skill.description || 'A skill connected to your project work.'}
                  </p>

                  <div className="student-skill-evidence">
                    <strong>
                      Project evidence ({skill.projects.length})
                    </strong>

                    {skill.projects.map((project) => (
                      <div
                        className="student-skill-project"
                        key={project.id}
                      >
                        <div>
                          <i className="fa fa-folder-open"></i>
                          <span>{project.title}</span>
                        </div>

                        <span
                          className={`student-skill-status ${project.status === 'COMPLETED'
                              ? 'completed'
                              : 'active'
                            }`}
                        >
                          {project.status === 'COMPLETED'
                            ? 'Completed'
                            : 'Active'}
                        </span>
                      </div>
                    ))}
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>

        {/* Projects */}
        <section className="student-section">

          <div className="student-section-header">
            <h2>My Projects</h2>
          </div>

          {loadingProjects ? (
            <div className="student-empty-state">
              <h3>Loading projects...</h3>
              <p>Please wait while your projects are being loaded.</p>
            </div>
          ) : projects.length === 0 ? (
            <div className="student-empty-state">
              <h3>No projects yet</h3>
              <p>
                Your projects will appear here once a project is assigned to you.
              </p>
            </div>
          ) : (
            <div className="student-projects-list">
              {projects.map((project) => (
                <div
                  key={project.id}
                  className="student-project-card"
                  onClick={() => navigate(`/projects/${project.id}`)}
                >
                  <h3>{project.title}</h3>

                  <p>{project.description}</p>

                  <div className="student-project-meta">
                    <span>
                      Tasks: {project.tasks}
                    </span>

                    <span>
                      Members: {project.members}
                    </span>
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

              <p>
                Please wait while your new tasks are being loaded.
              </p>
            </div>
          ) : newTasks.length === 0 ? (
            <div className="student-empty-state">
              <h3>No new tasks</h3>

              <p>
                New tasks assigned to you will appear here.
              </p>
            </div>
          ) : (
            <div className="student-new-tasks-list">

              {newTasks.map((task) => (
                <div
                  key={task.id}
                  className="student-new-task-card"
                  onClick={() =>
                    navigate(
                      `/projects/${task.projectId}?task=${task.id}`
                    )
                  }
                >

                  <div className="student-new-task-main">

                    <div className="student-new-task-icon">
                      <i className="fa fa-tasks"></i>
                    </div>

                    <div className="student-new-task-info">

                      <h3>{task.title}</h3>

                      <p>{task.projectTitle}</p>

                      <span>
                        New task
                      </span>

                    </div>

                  </div>

                  <div className="student-new-task-right">

                    <span
                      className={`student-new-task-priority ${task.priority.toLowerCase()}`}
                    >
                      {task.priority}
                    </span>

                    <span className="student-new-task-status">
                      To Do
                    </span>

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
              <p>
                Please wait while your upcoming deadlines are being loaded.
              </p>
            </div>
          ) : upcomingDeadlines.length === 0 ? (
            <div className="student-empty-state">
              <h3>No upcoming deadlines</h3>
              <p>
                You're all caught up! Tasks with upcoming due dates will appear here.
              </p>
            </div>
          ) : (
            <div className="student-deadlines-list">
              {upcomingDeadlines.map((task) => {
                const dueDate = new Date(task.dueDate);

                const formattedDate = dueDate.toLocaleDateString(
                  'en-IN',
                  {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                  }
                );

                const daysRemaining = Math.ceil(
                  (dueDate.getTime() - Date.now()) /
                  (1000 * 60 * 60 * 24)
                );

                return (
                  <div
                    key={task.id}
                    className="student-deadline-card"
                    onClick={() =>
                      navigate(
                        `/projects/${task.projectId}?task=${task.id}`
                      )
                    }
                  >
                    <div className="student-deadline-main">
                      <div className="student-deadline-icon">
                        <i className="fa fa-calendar-alt"></i>
                      </div>

                      <div className="student-deadline-info">
                        <h3>{task.title}</h3>
                        <p>{task.projectTitle}</p>

                        <span>
                          {task.columnTitle}
                        </span>
                      </div>
                    </div>

                    <div className="student-deadline-right">
                      <span
                        className={`student-deadline-priority ${task.priority.toLowerCase()}`}
                      >
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