import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
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

const FacultyDashboard = () => {
  const navigate = useNavigate();

  const userData = localStorage.getItem('user');
  const user = userData ? JSON.parse(userData) : null;

  const [projects, setProjects] = useState<Project[]>([]);
  const [loadingProjects, setLoadingProjects] = useState(true);

  const [deadlines, setDeadlines] = useState<FacultyDeadline[]>([]);
  const [deadlinesLoading, setDeadlinesLoading] = useState(true);

  const [reviews, setReviews] = useState<FacultyReview[]>([]);
  const [reviewsLoading, setReviewsLoading] = useState(true);

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
        console.error('Failed to load faculty projects:', error);
      } finally {
        setLoadingProjects(false);
      }
    };

    fetchProjects();
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
          'http://localhost:4300/api/projects/faculty/deadlines',
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
          'http://localhost:4300/api/tasks/faculty/reviews',
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
              Review student projects, track progress, and provide feedback.
            </p>
          </div>

          <div className="faculty-profile">
            <span>{user?.name || 'Faculty'}</span>
          </div>
        </header>

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
            <h3>Pending Reviews</h3>
            <p>{reviews.length}</p>
          </div>

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
            <h2>Reviews Pending</h2>
          </div>

          {reviewsLoading ? (
            <div className="faculty-empty-state">
              <p>Loading pending reviews...</p>
            </div>
          ) : reviews.length === 0 ? (
            <div className="faculty-empty-state">
              <h3>No reviews pending</h3>

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
