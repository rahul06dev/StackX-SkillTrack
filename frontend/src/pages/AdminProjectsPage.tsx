
import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import CreateProjectModal from '../components/CreateProjectModal';
import '../auth.css';

interface ProjectPerson {
    id: string;
    name: string;
    email: string;
    role: 'STUDENT' | 'FACULTY' | 'ADMIN';
}

interface Project {
    id: string;
    title: string;
    description: string;
    status: string;
    tasksCount: number;
    peopleCount: number;
    students: ProjectPerson[];
    faculty: ProjectPerson[];
    admins: ProjectPerson[];
    createdAt: string;
    updatedAt: string;
}

type StatusFilter = 'ALL' | 'ACTIVE' | 'COMPLETED';

import { API_BASE_URL } from '../config/api';

const AdminProjectsPage: React.FC = () => {
    const navigate = useNavigate();

    const [projects, setProjects] = useState<Project[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] =
        useState<StatusFilter>('ALL');
    const [isModalOpen, setIsModalOpen] = useState(false);

    const fetchProjects = async () => {
        try {
            const token = localStorage.getItem('token');

            if (!token) {
                throw new Error('Authentication token not found');
            }

            const response = await fetch(
                `${API_BASE_URL}/api/projects/admin/projects`,
                {
                    headers: {
                        Authorization: `Bearer ${token}`,
                    },
                }
            );

            if (!response.ok) {
                throw new Error(
                    `Failed to fetch projects: ${response.status}`
                );
            }

            const data: Project[] = await response.json();
            setProjects(data);
        } catch (error) {
            console.error('Failed to load admin projects:', error);
            setProjects([]);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchProjects();
    }, []);

    const handleProjectCreated = async (_newProject: Project) => {
        setIsModalOpen(false);
        await fetchProjects();
    };

    const handleCloseModal = () => {
        setIsModalOpen(false);
    };

    const filteredProjects = useMemo(() => {
        const normalizedSearch = searchTerm.trim().toLowerCase();

        const matchesWordStart = (text: string) => {
            if (!normalizedSearch) return true;

            const words = text
                .toLowerCase()
                .split(/[\s\-_. ,!?()[\]{}:;]+/)
                .filter(Boolean);

            return words.some((word) =>
                word.startsWith(normalizedSearch)
            );
        };

        return projects.filter((project) => {
            const statusMatches =
                statusFilter === 'ALL' ||
                project.status === statusFilter;

            const searchMatches =
                matchesWordStart(project.title) ||
                matchesWordStart(project.description || '');

            return statusMatches && searchMatches;
        });
    }, [projects, searchTerm, statusFilter]);

    const clearSearch = () => {
        setSearchTerm('');
    };

    return (
        <div className="admin-page">
            <Sidebar activeTab="projects" />

            <main className="admin-main">
                <header className="admin-header">
                    <div>
                        <h1>All Projects</h1>
                        <p>
                            View and manage projects across the
                            SkillTrack platform.
                        </p>
                    </div>

                    {statusFilter === 'ALL' && (
                        <button
                            type="button"
                            className="admin-primary-button"
                            onClick={() => setIsModalOpen(true)}
                        >
                            <i className="fa fa-plus" />
                            New Project
                        </button>
                    )}
                </header>

                <section className="admin-project-toolbar">
                    <div className="admin-project-search">
                        <i className="fa fa-search" />

                        <input
                            type="text"
                            value={searchTerm}
                            onChange={(event) =>
                                setSearchTerm(event.target.value)
                            }
                            placeholder="Search projects..."
                            aria-label="Search projects"
                        />

                        {searchTerm && (
                            <button
                                type="button"
                                onClick={clearSearch}
                                className="admin-project-search-clear"
                                aria-label="Clear search"
                            >
                                <i className="fa fa-times" />
                            </button>
                        )}
                    </div>

                    <select
                        value={statusFilter}
                        onChange={(event) =>
                            setStatusFilter(
                                event.target.value as StatusFilter
                            )
                        }
                        className="admin-project-filter"
                        aria-label="Filter projects by status"
                    >
                        <option value="ALL">All Status</option>
                        <option value="ACTIVE">Active</option>
                        <option value="COMPLETED">Completed</option>
                    </select>
                </section>

                <div className="admin-projects-heading">
                    <h2>Projects</h2>

                    {!loading && (
                        <span>
                            {filteredProjects.length}{' '}
                            {filteredProjects.length === 1
                                ? 'project'
                                : 'projects'}
                        </span>
                    )}
                </div>

                {loading ? (
                    <div className="admin-empty-state">
                        <h3>Loading projects...</h3>
                        <p>
                            Please wait while projects are being loaded.
                        </p>
                    </div>
                ) : filteredProjects.length === 0 ? (
                    <div className="admin-empty-state">
                        <i className="fa fa-folder-open" />

                        <h3>
                            {searchTerm
                                ? 'No projects found'
                                : statusFilter !== 'ALL'
                                ? `0 ${statusFilter === 'COMPLETED' ? 'Completed' : 'Active'} Projects`
                                : 'No projects available'}
                        </h3>

                        <p>
                            {searchTerm
                                ? `No projects match "${searchTerm}". Try a different search.`
                                : statusFilter !== 'ALL'
                                ? `There are currently 0 ${statusFilter.toLowerCase()} projects.`
                                : 'Projects created on SkillTrack will appear here.'}
                        </p>

                        {searchTerm && (
                            <button
                                type="button"
                                onClick={clearSearch}
                                className="admin-clear-search-button"
                            >
                                Clear Search
                            </button>
                        )}

                        {!searchTerm && statusFilter === 'ALL' && (
                            <button
                                type="button"
                                onClick={() => setIsModalOpen(true)}
                                className="admin-primary-button"
                            >
                                <i className="fa fa-plus" />
                                Create Project
                            </button>
                        )}

                        {!searchTerm && statusFilter !== 'ALL' && (
                            <button
                                type="button"
                                onClick={() => setStatusFilter('ALL')}
                                className="admin-primary-button"
                            >
                                View All Projects ({projects.length})
                            </button>
                        )}
                    </div>
                ) : (
                    <div className="admin-project-management-list">
                        {filteredProjects.map((project) => (
                            <div
                                key={project.id}
                                className="admin-management-project-card"
                                onClick={() =>
                                    navigate(`/projects/${project.id}`)
                                }
                                role="button"
                                tabIndex={0}
                                onKeyDown={(event) => {
                                    if (
                                        event.key === 'Enter' ||
                                        event.key === ' '
                                    ) {
                                        event.preventDefault();
                                        navigate(
                                            `/projects/${project.id}`
                                        );
                                    }
                                }}
                            >
                                <div className="admin-management-project-main">
                                    <div className="admin-management-project-icon">
                                        <i className="fa fa-folder-open" />
                                    </div>

                                    <div className="admin-management-project-info">
                                        <h3>{project.title}</h3>

                                        <p>
                                            {project.description ||
                                                'No project description available.'}
                                        </p>

                                        <div className="admin-management-project-stats">
                                            <span>
                                                <i className="fa fa-tasks" />
                                                {project.tasksCount ?? 0} Tasks
                                            </span>

                                            <span>
                                                <i className="fa fa-users" />
                                                {project.peopleCount ?? 0} People
                                            </span>

                                            <span
                                                className={`admin-project-status ${(project.status || 'ACTIVE').toLowerCase()}`}
                                            >
                                                {project.status || 'ACTIVE'}
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                <div className="admin-management-project-arrow">
                                    <i className="fa fa-chevron-right" />
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </main>

            <CreateProjectModal
                isOpen={isModalOpen}
                onClose={handleCloseModal}
                onProjectCreated={handleProjectCreated}
            />
        </div>
    );
};

export default AdminProjectsPage;
